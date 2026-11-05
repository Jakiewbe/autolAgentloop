# run-guard-tests.ps1 - 驱动 install-b-when-ready.ps1 v5 走受控自测用例（合成夹具，不触真实系统）。
# 每个用例使用全新隔离根与临时 HOME；真实 HOME/配置不被写入。
[CmdletBinding()]
param(
  [string]$Guard = "",
  [string]$FixturePackage = "",
  [string]$Supplement = "",
  [string]$OutJson = "",
  [string]$LogDir = ""
)
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
# $PSScriptRoot 在 -File 调用时可能为空（本机 PowerShell 5.1 实测），默认值改在脚本体里解析。
$scriptDir = $PSScriptRoot
if (-not $scriptDir -and $MyInvocation.MyCommand.Path) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }
if (-not $Guard) { $Guard = Join-Path $scriptDir "..\install-b-when-ready.ps1" }
if (-not $FixturePackage) { $FixturePackage = Join-Path $scriptDir "fixture\B-reviewed-delivery.zip" }
if (-not $Supplement) { $Supplement = Join-Path $scriptDir "..\supplement" }
if (-not $OutJson) { $OutJson = Join-Path $scriptDir "guard-selftest-v5.json" }
if (-not $LogDir) { $LogDir = Join-Path $scriptDir "logs" }

if (-not (Test-Path -LiteralPath $Guard)) { throw "guard missing: $Guard" }
if (-not (Test-Path -LiteralPath $FixturePackage)) { throw "fixture package missing: $FixturePackage" }
if (-not (Test-Path -LiteralPath $Supplement)) { throw "supplement missing: $Supplement" }
if (Test-Path -LiteralPath $LogDir) { Remove-Item -LiteralPath $LogDir -Recurse -Force }
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
$keyFile = Join-Path $env:TEMP "b-round5-fixture\worker.key"
New-Item -ItemType Directory -Path (Split-Path -Parent $keyFile) -Force | Out-Null
[IO.File]::WriteAllText($keyFile, "SIMULATED-NOT-A-REAL-KEY-0123456789abcdefghi", (New-Object Text.UTF8Encoding($false)))
$savedUser = $env:USERPROFILE; $savedHome = $env:HOME
$results = New-Object "System.Collections.Generic.List[object]"
function Run-Case([string]$name, [string]$center, [string[]]$extra, [bool]$expectSuccess, [scriptblock]$prepare = $null, [string]$rootOverride = "", [string]$supplementMode = "stub") {
  $root = if ($rootOverride) { $rootOverride } else { Join-Path $env:TEMP ("b-round5-" + $name) }
  if (Test-Path -LiteralPath $root) { Remove-Item -LiteralPath $root -Recurse -Force }
  New-Item -ItemType Directory -Path (Join-Path $root "home") -Force | Out-Null
  [IO.File]::WriteAllText((Join-Path $root "SIMULATION-ONLY"), "fixture", (New-Object Text.UTF8Encoding($false)))
  $probe = Join-Path $root "probe.json"
  [IO.File]::WriteAllText($probe, (@{ listeners = 0; hubs = 0 } | ConvertTo-Json -Compress), (New-Object Text.UTF8Encoding($false)))
  $suppDir = Join-Path $root "_incoming\B-reviewed-delivery\supplement"
  if ($supplementMode -ne "missing") {
    New-Item -ItemType Directory -Path $suppDir -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $Supplement "agent_result.mjs") -Destination $suppDir -Force
    if ($supplementMode -eq "stub") {
      $stub = @(
        'param([ValidateSet("claude","codex")][string]$Agent,[string]$Executable,[string]$Model,[string]$SettingsFile,[string]$OutputDirectory)',
        '# SIMULATION STUB: not the reviewed verification entry',
        'Write-Output "SIMULATED VERIFY OK"',
        'exit 0',
        ""
      ) -join [Environment]::NewLine
      [IO.File]::WriteAllText((Join-Path $suppDir "verify-b-fixed.ps1"), $stub, (New-Object Text.UTF8Encoding($false)))
    } else {
      Copy-Item -LiteralPath (Join-Path $Supplement "verify-b-fixed.ps1") -Destination $suppDir -Force
    }
    if ($supplementMode -eq "no-settings") {
      $stub2 = @(
        'param([ValidateSet("claude","codex")][string]$Agent,[string]$Executable,[string]$Model,[string]$OutputDirectory)',
        '# SIMULATION STUB without SettingsFile',
        'exit 0',
        ''
      ) -join [Environment]::NewLine
      [IO.File]::WriteAllText((Join-Path $suppDir "verify-b-fixed.ps1"), $stub2, (New-Object Text.UTF8Encoding($false)))
    }
    if ($supplementMode -eq "hash-bad") {
      [IO.File]::WriteAllText((Join-Path $suppDir "verify-b-fixed.ps1"), "; tampered fixture" + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))
    }
  }
  if ($prepare) { & $prepare $root }
  $env:USERPROFILE = Join-Path $root "home"; $env:HOME = $env:USERPROFILE
  $argv = @("-NoProfile","-ExecutionPolicy","Bypass","-File",$Guard,"-Package",$FixturePackage,"-CenterUrl",$center,"-WorkerKeyFile",$keyFile,"-Root",$root,"-SystemProbeFile",$probe) + $extra
  [IO.File]::WriteAllText((Join-Path $LogDir ("case-" + $name + ".argv.txt")), ($argv -join " "), (New-Object Text.UTF8Encoding($false)))
  $log = Join-Path $LogDir ("case-" + $name + ".log")
  $err = Join-Path $LogDir ("case-" + $name + ".err")
  $p = Start-Process -FilePath "powershell.exe" -ArgumentList $argv -Wait -PassThru -NoNewWindow -RedirectStandardOutput $log -RedirectStandardError $err
  $out = ""
  if (Test-Path -LiteralPath $log) { $out = [IO.File]::ReadAllText($log) }
  $stateFiles = @(Get-ChildItem -LiteralPath $root -Recurse -File -Filter "install-b-state*.json" -ErrorAction SilentlyContinue)
  $row = [ordered]@{
    case = $name; expected = $(if ($expectSuccess) { "exit 0 + state" } else { "exit 2 + no state" })
    exit = $p.ExitCode
    installer_started = [bool](($out -match "installer_started=true") -or ($out -match "installer_native_exit="))
    state_written = [bool]($stateFiles.Count -gt 0)
    done_printed = [bool]($out -match "(DONE:|SIMULATION PASS)")
    verify_entry_missing = [bool]($out -match "验证入口缺失")
    stop_line = (($out -split "`r?`n") | Where-Object { $_ -like "STOP:*" } | Select-Object -First 1)
    ok = $false
  }
  if ($expectSuccess) { $row.ok = ($p.ExitCode -eq 0 -and $row.state_written -and $row.done_printed -and $row.installer_started) }
  else {
    $row.ok = ($p.ExitCode -eq 2 -and -not $row.state_written -and -not $row.done_printed)
    if ($name -eq "verify-entry-missing") { $row.ok = $row.ok -and (-not $row.installer_started) }
  }
  $results.Add([pscustomobject]$row)
  [Console]::WriteLine(("{0,-24} exit={1} inst={2} state={3} done={4} ok={5}  {6}" -f $name, $p.ExitCode, $row.installer_started, $row.state_written, $row.done_printed, $row.ok, $row.stop_line))
  $env:USERPROFILE = $savedUser; $env:HOME = $savedHome
}
$base = @("-SelfTest")
Run-Case "happy" "https://example.com" $base $true
Run-Case "happy-base-path" "https://example.com:443/base" $base $true
Run-Case "verify-entry-missing" "https://example.com" ($base + @("-SimVerifyEntry","missing")) $false $null "" "missing"
Run-Case "verify-entry-hash-bad" "https://example.com" ($base + @("-SimVerifyEntry","hash-bad")) $false $null "" "hash-bad"
Run-Case "entry-no-settingsfile" "https://example.com" $base $false $null "" "no-settings"
Run-Case "verify-fail" "https://example.com" ($base + @("-SimVerify","fail")) $false
Run-Case "package-hash-mismatch" "https://example.com" ($base + @("-SimPackageHash","mismatch")) $false
Run-Case "receipt-empty" "https://example.com" ($base + @("-SimReceipt","empty")) $false
Run-Case "receipt-wrong-status" "https://example.com" ($base + @("-SimReceipt","wrong")) $false
Run-Case "pre-install-hub" "https://example.com" ($base + @("-SimPreHub")) $false
Run-Case "post-install-hub" "https://example.com" ($base + @("-SimPostHub")) $false
Run-Case "installer-fail" "https://example.com" ($base + @("-SimInstallerFail")) $false
Run-Case "center-localhost-dot" "https://localhost.:8443" $base $false
Run-Case "center-localhost" "https://localhost:8443" $base $false
Run-Case "center-ipv6-loopback" "https://[::1]:8443" $base $false
Run-Case "center-ipv4-loopback" "http://127.0.0.1:3350" $base $false
Run-Case "center-127-8" "http://127.5.5.5:3350" $base $false
Run-Case "center-wildcard" "http://0.0.0.0:3350" $base $false
Run-Case "center-ipv4-mapped" "http://[::ffff:127.0.0.1]:3350" $base $false
Run-Case "center-userinfo" "http://u:p@example.com" $base $false
Run-Case "center-not-absolute" "not-a-url" $base $false
Run-Case "existing-config" "https://example.com" $base $false { param($root) New-Item -ItemType Directory -Path (Join-Path $root "home\.agent-autoloop") -Force | Out-Null; [IO.File]::WriteAllText((Join-Path $root "home\.agent-autoloop\config.json"), "{}", (New-Object Text.UTF8Encoding($false))) }
Run-Case "probe-without-selftest" "https://example.com" @() $false
Run-Case "bad-isolation" "https://example.com" $base $false $null (Join-Path $env:TEMP "b-other-root")
$summary = [ordered]@{
  schema = "b-guard-selftest/5"; generated_at = (Get-Date).ToString("o")
  guard_path = (Resolve-Path -LiteralPath $Guard).ProviderPath
  guard_sha256 = (Get-FileHash -LiteralPath $Guard -Algorithm SHA256).Hash.ToLower()
  fixture_package_sha256 = (Get-FileHash -LiteralPath $FixturePackage -Algorithm SHA256).Hash.ToLower()
  supplement_entry_sha256 = (Get-FileHash -LiteralPath (Join-Path $Supplement "verify-b-fixed.ps1") -Algorithm SHA256).Hash.ToLower()
  cases_total = $results.Count; cases_ok = @($results | Where-Object { $_.ok }).Count; cases_bad = @($results | Where-Object { -not $_.ok }).Count
  cases = $results
}
[IO.File]::WriteAllText($OutJson, ($summary | ConvertTo-Json -Depth 6), (New-Object Text.UTF8Encoding($false)))
[Console]::WriteLine("SUMMARY cases=" + $summary.cases_total + " ok=" + $summary.cases_ok + " bad=" + $summary.cases_bad)
if ($summary.cases_bad -gt 0) { exit 2 }
exit 0
