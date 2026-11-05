# B worker-only wrapper v5 - installer guard, evidence-only. Real install requires A inputs.
# v5 (review a1c6095 accounting): the executed verification entry is the supplemental fixed entry
#   (verify-b-fixed.ps1, hash-pinned); no fallback to the shipped verify-b.ps1; key metadata only.
# v4 (review a80c18d accounting): verify preflight BEFORE installer; hub re-checked after install;
#   trailing-dot and IPv4-mapped loopback normalized; receipt contract strict; package hash is a
#   hard constant with no parameter that can override it; every stop path prints installer_started.
[CmdletBinding()]
param(
  [string]$Package = "",
  [string]$CenterUrl = "",
  [string]$WorkerKeyFile = "",
  [string]$WorkerName = "b-magicbook14",
  [string]$Root = "D:\AutoAgentloop",
  [switch]$SelfTest,
  [string]$SystemProbeFile = "",
  [ValidateSet("pass","fail","missing")][string]$SimVerify = "pass",
  [ValidateSet("ok","mismatch")][string]$SimPackageHash = "ok",
  [ValidateSet("ok","empty","wrong")][string]$SimReceipt = "ok",
  [switch]$SimPreHub,
  [switch]$SimPostHub,
  [switch]$SimInstallerFail,
  [string]$VerifyEntry = "",
  [ValidateSet("ok","missing","hash-bad")][string]$SimVerifyEntry = "ok",
  [string]$ExpectedKeySha256 = "",
  [int]$ExpectedKeyBytes = 43
)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$EXPECTED_PACKAGE_SHA256 = "e0b4fb5b2e03bd9701cf8af42d9c7f9af0106dc09fd1c3018fd64e427394d853"
$EXPECTED_VERIFY_ENTRY_NAME = "verify-b-fixed.ps1"
$EXPECTED_VERIFY_ENTRY_SHA256 = "36c964e32c039c158d422c4d4ad648a25442226182945f7fadd1b05b653a7e31"
$stamp = (Get-Date).ToString("yyyyMMddTHHmmssfff") + "-" + [guid]::NewGuid().ToString("N")
$installerStarted = $false
$stateWritten = $false
function Log([string]$s) { [Console]::WriteLine($s) }
function Stop-Here([string]$reason) {
  Log ("STOP: " + $reason)
  Log ("installer_started=" + $installerStarted.ToString().ToLower())
  Log "success_state_written=false"
  Log "no_files_deleted=true; 不自动清理 HOME 或回滚未知文件"
  exit 2
}
function Safe-Url([string]$v) {
  $u = $null
  if ([Uri]::TryCreate($v, [UriKind]::Absolute, [ref]$u) -and $u.Scheme -in @("http","https")) {
    return $u.Scheme + "://" + $u.IdnHost + ":" + $u.Port + $u.AbsolutePath
  }
  return "<invalid-or-unavailable>"
}
function Normalize-Host([string]$rawHost) {
  $h = $rawHost.Trim("[","]")
  while ($h.EndsWith(".")) { $h = $h.Substring(0, $h.Length - 1) }
  return $h.ToLowerInvariant()
}
function Validate-Center([string]$value) {
  if ([string]::IsNullOrWhiteSpace($value)) { Stop-Here "中心地址为空" }
  $u = $null
  if (-not [Uri]::TryCreate($value, [UriKind]::Absolute, [ref]$u)) { Stop-Here "中心地址不是绝对 URL" }
  if ($u.Scheme -notin @("http","https")) { Stop-Here "中心地址协议不是 http(s)" }
  if ($u.UserInfo -or $u.Query -or $u.Fragment) { Stop-Here "中心地址含内嵌凭据/查询/片段" }
  $h = Normalize-Host $u.DnsSafeHost
  if ($h -eq "" -or $h -eq "localhost" -or $h.EndsWith(".localhost") -or $h -eq "127.0.0.1.nip.io") { Stop-Here ("中心地址为回环主机名：" + $h) }
  $ip = $null
  if ([Net.IPAddress]::TryParse($h, [ref]$ip)) {
    if ($ip.IsIPv4MappedToIPv6) { $ip = $ip.MapToIPv4() }
    if ([Net.IPAddress]::IsLoopback($ip)) { Stop-Here ("中心地址为回环 IP：" + $ip.ToString()) }
    if ($ip.Equals([Net.IPAddress]::Any) -or $ip.Equals([Net.IPAddress]::IPv6Any)) { Stop-Here ("中心地址为通配 IP：" + $ip.ToString()) }
    if ($ip.AddressFamily -eq [Net.Sockets.AddressFamily]::InterNetwork -and $ip.GetAddressBytes()[0] -eq 0) { Stop-Here "中心地址为 0.0.0.0/8" }
  }
  return $u.AbsoluteUri.TrimEnd("/")
}
function Quote-Arg([string]$s) {
  return '"' + [regex]::Replace([regex]::Replace($s, '(\\*)"', '$1$1\"'), '(\\+)$', '$1$1') + '"'
}
function Invoke-Quiet([string]$exe, [string[]]$argv) {
  $si = New-Object Diagnostics.ProcessStartInfo
  $si.FileName = $exe
  $si.Arguments = (($argv | ForEach-Object { Quote-Arg $_ }) -join " ")
  $si.UseShellExecute = $false; $si.CreateNoWindow = $true
  $si.RedirectStandardOutput = $true; $si.RedirectStandardError = $true; $si.RedirectStandardInput = $true
  $p = New-Object Diagnostics.Process; $p.StartInfo = $si
  try {
    [void]$p.Start()
    $p.StandardInput.Close()
    $so = $p.StandardOutput.ReadToEndAsync(); $se = $p.StandardError.ReadToEndAsync()
    $p.WaitForExit()
    $native = $p.ExitCode
    [void]$so.Result; [void]$se.Result
    return $native
  } finally { $p.Dispose() }
}
function Get-SiteFacts([string]$phase) {
  if ($SelfTest) {
    $probe = Get-Content -LiteralPath $SystemProbeFile -Raw | ConvertFrom-Json
    if ($probe.error) { Stop-Here ("模拟系统探针失败：" + $phase) }
    $listenerCount = [int]$probe.listeners
    $hubCount = [int]$probe.hubs
  } else {
    $listeners = @(Get-NetTCPConnection -ErrorAction Stop | Where-Object { $_.LocalPort -eq 3350 -and $_.State -eq "Listen" })
    $listeners += @(Get-NetUDPEndpoint -ErrorAction Stop | Where-Object { $_.LocalPort -eq 3350 })
    $all = @(Get-CimInstance Win32_Process -ErrorAction Stop)
    $hubs = New-Object "System.Collections.Generic.List[object]"
    $expectedWorkerApp = if ($script:runtimeSha) { Join-Path $Root ("runtime\" + $script:runtimeSha.Substring(0,12)) } else { "" }
    foreach ($proc in $all) {
      if ($proc.Name -ne "node.exe" -or -not $proc.CommandLine) { continue }
      $cmd = $proc.CommandLine
      if ($cmd -match "server\.mjs") {
        $parent = $all | Where-Object { $_.ProcessId -eq $proc.ParentProcessId } | Select-Object -First 1
        $explained = ($parent -and $parent.CreationDate -le $proc.CreationDate -and $parent.CommandLine -match "launch_codex_app_tools_mcp\.cmd")
        if (-not $explained) { $hubs.Add($proc) }
        continue
      }
      if ($cmd -match "(agent[-_]?auto|autoloop).*\b(init|up|try|hub|serve)\b") {
        $isOwnWorker = ($expectedWorkerApp -ne "" -and ($cmd.Replace("/","\") -match [regex]::Escape($expectedWorkerApp)) -and $cmd -match "(^|\s)up(\s|$)")
        if (-not $isOwnWorker) { $hubs.Add($proc) }
        continue
      }
      if ($cmd -match "(agent[-_]?auto|autoloop|[\\/]app[\\/]).*(hub|center|server\.(mjs|ts|js))") { $hubs.Add($proc) }
    }
    $hubs = @($hubs)
    $listenerCount = @($listeners).Count
    $hubCount = @($hubs).Count
  }
  Log ($phase + "_listeners_3350=" + $listenerCount + " " + $phase + "_hub_candidates=" + $hubCount)
  return @{ listeners = $listenerCount; hubs = $hubCount }
}
try {
  $Root = [IO.Path]::GetFullPath($Root)
  if ($SelfTest) {
    $tempPrefix = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd("\") + "\b-round"
    if (-not $Root.StartsWith($tempPrefix, [StringComparison]::OrdinalIgnoreCase) -or
        $env:USERPROFILE -ne (Join-Path $Root "home") -or $env:HOME -ne $env:USERPROFILE -or
        -not (Test-Path -LiteralPath (Join-Path $Root "SIMULATION-ONLY")) -or
        -not $SystemProbeFile.StartsWith($Root + "\", [StringComparison]::OrdinalIgnoreCase)) { Stop-Here "隔离模拟边界不满足" }
    Log "SIMULATION ONLY: fixture package/hash and system probes; NOT a B deployment"
  } elseif ($SystemProbeFile) { Stop-Here "真实模式禁止模拟探针" }

  Log "step=1 node"
  $node = (Get-Command node.exe -ErrorAction Stop).Source
  $ver = & $node --version
  if ($LASTEXITCODE -ne 0 -or $ver -notmatch "^v(\d+)\." -or [int]$Matches[1] -lt 24) { Stop-Here "需要 Node >=24" }
  Log ("node=" + $ver)

  Log "step=2 existing_config"
  $configCandidates = @((Join-Path $env:USERPROFILE ".agent-autoloop\config.json"))
  if ($env:HOME) { $configCandidates += (Join-Path $env:HOME ".agent-autoloop\config.json") }
  foreach ($config in ($configCandidates | Select-Object -Unique)) {
    if (Test-Path -LiteralPath $config) {
      $shape = @{ url = "<unparseable>"; worker = "<unparseable>"; key_present = $false }
      try {
        $j = Get-Content -LiteralPath $config -Raw | ConvertFrom-Json
        $shape.url = Safe-Url $j.url
        $shape.worker = if ($j.worker.name -eq "b-magicbook14") { "b-magicbook14" } else { "<other-or-missing>" }
        $shape.key_present = [bool]$j.worker.key
      } catch { }
      Log ("existing_config=" + ($shape | ConvertTo-Json -Compress))
      Stop-Here "已存在 config.json，保留现场"
    }
  }

  Log "step=3 package_hash"
  if (-not $Package -or -not (Test-Path -LiteralPath $Package -PathType Leaf)) { Stop-Here "审核包不存在" }
  $actual = (Get-FileHash -LiteralPath $Package -Algorithm SHA256).Hash.ToLowerInvariant()
  Log ("package_sha256=" + $actual)
  Log ("package_sha256_expected=" + $EXPECTED_PACKAGE_SHA256 + " (hard constant; 无参数可覆盖)")
  $hashOk = $actual -eq $EXPECTED_PACKAGE_SHA256
  if ($SelfTest) { $hashOk = ($SimPackageHash -eq "ok") }
  if (-not $hashOk) { Stop-Here "审核包哈希不匹配" }

  Log "step=4 identity"
  if ($WorkerName -ne "b-magicbook14") { Stop-Here "worker 名不是 b-magicbook14" }
  if (-not $WorkerKeyFile -or -not (Test-Path -LiteralPath $WorkerKeyFile -PathType Leaf)) { Stop-Here "worker 身份文件缺失" }
  if ((Get-Item -LiteralPath $WorkerKeyFile).Length -eq 0) { Stop-Here "worker 身份文件为空" }
  $keySha = (Get-FileHash -LiteralPath $WorkerKeyFile -Algorithm SHA256).Hash.ToLowerInvariant()
  $keyBytes = (Get-Item -LiteralPath $WorkerKeyFile).Length
  $firstByte = ([IO.File]::ReadAllBytes($WorkerKeyFile))[0]
  Log ("worker_key_file_sha256=" + $keySha + " bytes=" + $keyBytes + " (只记哈希，不读内容)")
  Log ("worker_key_first_byte_is_brace=" + ($firstByte -eq 123).ToString().ToLowerInvariant() + " (描述性元数据，不参与判定)")
  if ($ExpectedKeySha256) {
    $keyOk = ($keySha -eq $ExpectedKeySha256.ToLowerInvariant()) -and ($keyBytes -eq $ExpectedKeyBytes)
    if ($SelfTest) { $keyOk = $true }
    if (-not $keyOk) { Stop-Here ("身份文件与契约不符：sha/bytes 与 A 记录不一致（sha_match=" + ($keySha -eq $ExpectedKeySha256.ToLowerInvariant()).ToString().ToLowerInvariant() + " bytes_expected=" + $ExpectedKeyBytes + ")") }
    Log "worker_key_contract=sha+bytes match (原始文本 43 字节，非 JSON 形态要求)"
  } else { Log "worker_key_contract=recorded-only (未传 -ExpectedKeySha256；安装门禁第 1 步由 report-key-file.ps1 核对)" }

  Log "step=5 center_url"
  $center = Validate-Center $CenterUrl
  Log ("center_url=" + (Safe-Url $center))

  Log "step=6 unpack_and_integrity"
  $unpack = Join-Path $Root ("_incoming\" + $stamp)
  New-Item -ItemType Directory -Path $unpack | Out-Null
  Expand-Archive -LiteralPath $Package -DestinationPath $unpack
  $installers = @(Get-ChildItem -LiteralPath $unpack -Recurse -File -Filter "install-b.mjs")
  $verifiers = @(Get-ChildItem -LiteralPath $unpack -Recurse -File -Filter "verify-b.ps1")
  if ($installers.Count -ne 1) { Stop-Here "包内 install-b.mjs 缺失或不唯一" }
  if ($SelfTest -and $SimVerify -eq "missing") { Log "fixture: verify-b.ps1 removed by simulation" }
  elseif ($verifiers.Count -ne 1) { Stop-Here "包内 verify-b.ps1 缺失或不唯一（安装器未启动）" }
  elseif ($installers[0].DirectoryName -ne $verifiers[0].DirectoryName) { Stop-Here "安装器与 verify 目录不一致" }
  $release = $installers[0].DirectoryName
  foreach ($required in @("manifest.json","delivery.json","agent-autoloop-reviewed.zip","README.md")) {
    if (-not (Test-Path -LiteralPath (Join-Path $release $required) -PathType Leaf)) { Stop-Here ("包内必需依赖缺失：" + $required) }
  }
  $delivery = Get-Content -LiteralPath (Join-Path $release "delivery.json") -Raw | ConvertFrom-Json
  $requiredList = @("install-b.mjs","agent_result.mjs","manifest.json","agent-autoloop-reviewed.zip","README.md")
  if ($SimVerify -ne "missing") { $requiredList += "verify-b.ps1" }
  foreach ($required in $requiredList) {
    $entry = @($delivery.artifacts | Where-Object { $_.file -eq $required })
    $file = Join-Path $release $required
    if ($SelfTest -and $SimPackageHash -eq "mismatch") { Log ("fixture: skip delivery hash for " + $required) ; continue }
    if ($entry.Count -ne 1) { Stop-Here ("delivery.json 未唯一登记：" + $required) }
    if ($entry[0].sha256 -ne (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -or $entry[0].bytes -ne (Get-Item -LiteralPath $file).Length) { Stop-Here ("包内完整性核对失败：" + $required) }
  }
  $manifest = Get-Content -LiteralPath (Join-Path $release "manifest.json") -Raw | ConvertFrom-Json
  $runtimeSha = (Get-FileHash -LiteralPath (Join-Path $release "agent-autoloop-reviewed.zip") -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($manifest.package.file -ne "agent-autoloop-reviewed.zip" -or $manifest.package.sha256 -ne $runtimeSha) { Stop-Here "manifest 运行包哈希不匹配" }
  $script:runtimeSha = $runtimeSha
  Log ("runtime_package_sha256=" + $runtimeSha)

  Log "step=7 verify_preflight (before installer)"
  $entryPath = $VerifyEntry
  if (-not $entryPath) { $entryPath = Join-Path (Join-Path $Root "_incoming\B-reviewed-delivery\supplement") $EXPECTED_VERIFY_ENTRY_NAME }
  Log ("verify_entry=" + $entryPath)
  $entryMissing = -not (Test-Path -LiteralPath $entryPath -PathType Leaf)
  if ($SelfTest -and $SimVerifyEntry -eq "missing") { $entryMissing = $true }
  if ($entryMissing) { Stop-Here "验证入口缺失（补充交付 verify-b-fixed.ps1 未就位）：安装器未启动，不回退到包内 verify-b.ps1" }
  $entrySha = (Get-FileHash -LiteralPath $entryPath -Algorithm SHA256).Hash.ToLowerInvariant()
  Log ("verify_entry_sha256=" + $entrySha)
  Log ("verify_entry_sha256_expected=" + $EXPECTED_VERIFY_ENTRY_SHA256 + " (hard constant)")
  $entryOk = ($entrySha -eq $EXPECTED_VERIFY_ENTRY_SHA256)
  if ($SelfTest) { $entryOk = ($SimVerifyEntry -ne "hash-bad") }
  if (-not $entryOk) { Stop-Here "验证入口哈希与固定值不一致：安装器未启动" }
  $ast = [System.Management.Automation.Language.Parser]::ParseFile($entryPath, [ref]$null, [ref]$null)
  $names = @($ast.ParamBlock.Parameters | ForEach-Object { $_.Name.VariablePath.UserPath })
  Log ("verify_params=" + ($names -join ","))
  foreach ($need in @("Agent","Executable","Model","OutputDirectory")) {
    if ($names -notcontains $need) { Stop-Here ("验证入口缺少必需参数：" + $need) }
  }
  if ($names -notcontains "SettingsFile") { Stop-Here "验证入口缺少 SettingsFile 参数（Claude 私有配置需要）" }
  $validator = Join-Path (Split-Path -Parent $entryPath) "agent_result.mjs"
  if (-not (Test-Path -LiteralPath $validator -PathType Leaf)) { Stop-Here "验证入口依赖缺失：同目录 agent_result.mjs" }
  if (-not $SelfTest) {
    & $node --check $validator 2>$null
    if ($LASTEXITCODE -ne 0) { Stop-Here "agent_result.mjs 语法检查失败" }
  }
  Log "verify_preflight=ok (安装器尚未启动；执行入口=补充交付 verify-b-fixed.ps1)"

  Log "step=8 pre_install_site"
  $pre = Get-SiteFacts "pre"
  if ($SelfTest -and $SimPreHub) { $pre = @{ listeners = 1; hubs = 1 } ; Log "fixture: pre-install hub injected" }
  if ($pre.listeners -gt 0) { Stop-Here "安装前已存在 3350 监听" }
  if ($pre.hubs -gt 0) { Stop-Here "安装前已存在 hub 候选进程" }

  Log "step=9 installer"
  $modelExe = Join-Path $env:USERPROFILE "AppData\Local\OpenAI\Codex\bin\codex.exe"
  if (-not $SelfTest -and -not (Test-Path -LiteralPath $modelExe -PathType Leaf)) { Stop-Here "verify 所需 Codex CLI 不存在" }
  $beforeReceipts = @{}
  Get-ChildItem -LiteralPath $Root -Recurse -File -Filter "B-install-receipt*.json" -ErrorAction SilentlyContinue | ForEach-Object { $beforeReceipts[$_.FullName] = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash }
  $installStart = [DateTime]::UtcNow
  $installerStarted = $true
  Push-Location $release
  try { $instExit = Invoke-Quiet $node @($installers[0].FullName,"--center-url",$center,"--worker-key-file",$WorkerKeyFile,"--worker-name",$WorkerName,"--root",$Root) } finally { Pop-Location }
  Log ("installer_native_exit=" + $instExit)
  if ($SelfTest -and $SimInstallerFail) { $instExit = 1 }
  if ($instExit -ne 0) { Stop-Here "安装器退出非零" }

  Log "step=10 post_install_site (hub re-checked)"
  if ($SelfTest -and $SimPostHub) { Log "fixture: post-install hub injected" ; Stop-Here "安装后发现 hub，疑似第二个中心" }
  $post = Get-SiteFacts "post"
  if ($post.listeners -gt 0) { Stop-Here "安装后发现 3350 监听" }
  if ($post.hubs -gt 0) { Stop-Here "安装后发现 hub 或未辨明 server.mjs" }

  Log "step=11 verify_with_required_args (supplemental entry only)"
  $verifyOutput = Join-Path ([IO.Path]::GetTempPath()) ("b-private-verify-" + $stamp)
  Log ("verify_output_dir=" + $verifyOutput)
  Push-Location (Split-Path -Parent $entryPath)
  try { $verifyExit = Invoke-Quiet (Join-Path $env:SystemRoot "System32\WindowsPowerShell\v1.0\powershell.exe") @("-NoProfile","-ExecutionPolicy","Bypass","-File",$entryPath,"-Agent","codex","-Executable",$modelExe,"-Model","deepseek-v4.1-flash-1017","-OutputDirectory",$verifyOutput) } finally { Pop-Location }
  Log ("verify_native_exit=" + $verifyExit)
  if ($SelfTest -and $SimVerify -eq "fail") { $verifyExit = 1 }
  if ($verifyExit -ne 0) { Stop-Here "验证入口（verify-b-fixed.ps1）退出非零" }

  Log "step=12 receipt_contract"
  $receipts = @(Get-ChildItem -LiteralPath $Root -Recurse -File -Filter "B-install-receipt*.json" -ErrorAction SilentlyContinue | Where-Object {
    $_.LastWriteTimeUtc -ge $installStart -and (-not $beforeReceipts.ContainsKey($_.FullName) -or $beforeReceipts[$_.FullName] -ne (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash)
  })
  if ($receipts.Count -ne 1) { Stop-Here ("本次回执数量不是 1：" + $receipts.Count) }
  $rawReceipt = Get-Content -LiteralPath $receipts[0].FullName -Raw
  if ($SelfTest -and $SimReceipt -eq "empty") { $rawReceipt = "{}" }
  if ($SelfTest -and $SimReceipt -eq "wrong") { $rawReceipt = (Get-Content -LiteralPath $receipts[0].FullName -Raw).Replace('worker-started-only','complete-and-verified') }
  $r = $rawReceipt | ConvertFrom-Json
  $expectedApp = Join-Path $Root ("runtime\" + $runtimeSha.Substring(0,12))
  $problems = New-Object "System.Collections.Generic.List[string]"
  if ($r.machine -ne "B") { $problems.Add("machine") }
  if ($r.worker -ne $WorkerName) { $problems.Add("worker") }
  if ($r.package_sha256 -ne $runtimeSha) { $problems.Add("package_sha256") }
  if ($r.status -ne "worker-started-only") { $problems.Add("status") }
  if ($r.model_verified -ne $false) { $problems.Add("model_verified") }
  if ($r.cross_network_task_verified -ne $false) { $problems.Add("cross_network_task_verified") }
  if (-not $r.pid -or [int]$r.pid -le 0) { $problems.Add("pid") }
  if (-not $r.app -or [IO.Path]::GetFullPath([string]$r.app).TrimEnd("\") -ne $expectedApp.TrimEnd("\")) { $problems.Add("app") }
  Log ("receipt_fields_bad=" + $(if ($problems.Count) { $problems -join "," } else { "none" }))
  if ($problems.Count) { Stop-Here ("回执契约不满足：" + ($problems -join ",")) }
  $configPath = Join-Path $env:USERPROFILE ".agent-autoloop\config.json"
  $configNow = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
  if ($configNow.worker.name -ne $WorkerName -or $configNow.url.TrimEnd("/") -ne $center -or -not $configNow.worker.key) { Stop-Here "本次配置 worker/url/key_present 不匹配" }
  if (-not $SelfTest) {
    $workerPid = [int]$r.pid
    $wp = Get-CimInstance Win32_Process -Filter ("ProcessId=" + $workerPid) -ErrorAction Stop
    if (-not $wp -or $wp.Name -ne "node.exe" -or $wp.CommandLine -notmatch [regex]::Escape($expectedApp) -or $wp.CommandLine -notmatch "\bup\b") { Stop-Here "回执 PID 不能对应本次 worker 进程" }
  }

  Log "step=13 write_state"
  $logDir = Join-Path $Root "evidence\deploy-b"
  New-Item -ItemType Directory -Path $logDir -Force | Out-Null
  $phase = if ($SelfTest) { "simulation_verified" } else { "worker_installed_locally_verified" }
  $state = @{
    schema = "b-installer-result/4"; phase = $phase; simulated = [bool]$SelfTest
    deployment_complete = $false; cross_machine_verified = $false; generated_at = (Get-Date).ToString("o")
    worker_name = $WorkerName; center_url = $center; package_sha256 = $actual; runtime_package_sha256 = $runtimeSha
    installer_native_exit = $instExit; verify_native_exit = $verifyExit; worker_key_file_sha256 = $keySha;
    verify_entry = $entryPath; verify_entry_sha256 = $entrySha
    receipt_checked = @{ fresh = $true; contract = "worker-started-only"; fields_bad = @(); config_url_match = $true }
    site_checked = @{ pre_listeners_3350 = $pre.listeners; pre_hub_candidates = $pre.hubs; post_listeners_3350 = $post.listeners; post_hub_candidates = $post.hubs }
  }
  $statePath = Join-Path $logDir ("install-b-state-" + $stamp + ".json")
  [IO.File]::WriteAllText($statePath, ($state | ConvertTo-Json -Depth 6), (New-Object Text.UTF8Encoding($false)))
  $stateWritten = $true
  Log ("state_written=true path=" + $statePath)
  if ($SelfTest) { Log "SIMULATION PASS: not a B installation" } else { Log "DONE: 安装、verify、现场与回执契约核对通过（仍不等于跨机验收）" }
  exit 0
} catch { Stop-Here ("检查或执行异常（原始输出不入证据）：" + $_.Exception.GetType().Name) }