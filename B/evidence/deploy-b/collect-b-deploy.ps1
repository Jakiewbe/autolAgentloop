# B collector v4: bounded search with explicit omissions/errors; UTF-8 BOM for PS5.1.
[CmdletBinding()]
param([string]$OutFile = '', [int]$MaxDepth = 8)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$lines = New-Object 'System.Collections.Generic.List[string]'
function W($s) { $script:lines.Add([string]$s) }
function Sec($s) { W ('== ' + $s + ' ==') }
function Safe-Cmd([string]$cmd) {
  return [regex]::Replace($cmd, '(?i)(--(?:key|token|password|api-key)\s+)("[^"]*"|\S+)', '$1<REDACTED>')
}
Sec 'collected_at'; W (Get-Date).ToString('o')
Sec 'collector'; W ('v5 sha256=' + (Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLower())
Sec 'host'; W ('hostname=' + (& hostname)); W ('user=' + $env:USERNAME + ' USERPROFILE=' + $env:USERPROFILE + ' HOME=' + $env:HOME + ' dotnet_userprofile=' + [Environment]::GetFolderPath('UserProfile')); W ('powershell=' + $PSVersionTable.PSVersion)
Sec 'node'; $nv = & node.exe --version; $ne = $LASTEXITCODE; W ($nv + ' native_exit=' + $ne)
Sec 'home_paths'
@((Join-Path $env:USERPROFILE '.agent-autoloop'), 'C:\Users\19082\.agent-autoloop', 'C:\Users\19082.agent-autoloop') | Select-Object -Unique | ForEach-Object { W ('exists=' + (Test-Path -LiteralPath $_) + ' path=' + $_) }
W '19082.agent-autoloop is a literal alternate spelling; normal directory is 19082\.agent-autoloop. Contents/keys are not collected.'
Sec 'listener_3350'
try {
  $tcp = @(Get-NetTCPConnection -ErrorAction Stop | Where-Object { $_.State -eq 'Listen' -and $_.LocalPort -eq 3350 })
  $udp = @(Get-NetUDPEndpoint -ErrorAction Stop | Where-Object { $_.LocalPort -eq 3350 })
  W ('tcp_listen_count=' + $tcp.Count + ' udp_endpoint_count=' + $udp.Count)
  $tcp + $udp | ForEach-Object { W ($_ | Select-Object LocalAddress,LocalPort,OwningProcess,State | ConvertTo-Json -Compress) }
} catch { W ('PORT_QUERY_ERROR: ' + $_.Exception.Message) }
Sec 'node_worker_hub_processes_with_ancestors'
try {
  $all = @(Get-CimInstance Win32_Process -ErrorAction Stop)
  $nodes = @($all | Where-Object { $_.Name -eq 'node.exe' -or ($_.Name -match '^(agent-autoloop|autoloop)' ) })
  foreach ($p in $nodes) {
    W ('process pid=' + $p.ProcessId + ' ppid=' + $p.ParentProcessId + ' created=' + $p.CreationDate.ToString('o') + ' cmd=' + (Safe-Cmd $p.CommandLine))
    $current = $p
    for ($i=0; $i -lt 3; $i++) {
      $parent = $all | Where-Object { $_.ProcessId -eq $current.ParentProcessId } | Select-Object -First 1
      if (-not $parent) { W 'ancestor_unavailable'; break }
      W ('ancestor pid=' + $parent.ProcessId + ' ppid=' + $parent.ParentProcessId + ' created=' + $parent.CreationDate.ToString('o') + ' cmd=' + (Safe-Cmd $parent.CommandLine))
      if ($i -eq 0 -and $p.CommandLine -match 'server\.mjs') { W ('server_mjs_classification=' + $(if ($parent.CreationDate -le $p.CreationDate -and $parent.CommandLine -match 'launch_codex_app_tools_mcp\.cmd') { 'Codex_app_tools_MCP_parent_confirmed' } else { 'UNRESOLVED' })) }
      $current = $parent
    }
  }
} catch { W ('PROCESS_QUERY_ERROR: ' + $_.Exception.Message) }
Sec 'reviewed_package_search'
$roots = @($env:USERPROFILE, 'C:\Users\19082', 'D:\', 'F:\') | Select-Object -Unique
$patterns = @('*reviewed*delivery*','install-b.mjs','verify-b.ps1','B-install-receipt*.json')
W ('roots=' + ($roots -join '; ')); W ('patterns=' + ($patterns -join '; ') + '; max_depth=' + $MaxDepth + '; root files at depth=0; reparse directories never followed')
function Get-HitKind([string]$path) {
  foreach ($prefix in $fixturePrefixes) { if ($path.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { return "FIXTURE_HIT" } }
  foreach ($prefix in $receivedPrefixes) { if ($path.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { return "RECEIVED_HIT" } }
  foreach ($prefix in $clonePrefixes) { if ($path.StartsWith($prefix, [StringComparison]::OrdinalIgnoreCase)) { return "CLONE_HIT" } }
  return "HIT"
}
$fixturePrefixes = @(
  ([IO.Path]::GetFullPath([IO.Path]::GetTempPath()) + "b-"),
  "D:\AutoAgentloop\_probe\"
)
$receivedPrefixes = @("D:\AutoAgentloop\_incoming\")
$clonePrefixes = @("D:\AutoAgentloop\.tmp-repo\")
$hitsByPattern = @{}
$realHits = 0; $fixtureHits = 0; $cloneHits = 0; $receivedHits = 0
$hitKindByPath = New-Object "System.Collections.Generic.List[string]"
$totalHits = 0; $totalErrors = 0; $totalDirs = 0; $totalOmitted = 0
foreach ($root in $roots) {
  $hits=0; $errors=0; $dirs=0; $omitted=0; $realInRoot=0; $fixtureInRoot=0; $cloneInRoot=0; $receivedInRoot=0
  $stack = New-Object "System.Collections.Generic.Stack[object]"
  $stack.Push(@{path=$root; depth=0})
  while ($stack.Count) {
    $entry = $stack.Pop(); $dirs++
    try { $items = @(Get-ChildItem -LiteralPath $entry.path -Force -ErrorAction Stop) }
    catch { $errors++; W ("ACCESS_ERROR path=" + $entry.path + " reason=" + $_.Exception.Message); continue }
    foreach ($item in $items) {
      if ($item.PSIsContainer) {
        if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { $omitted++; W ("UNSEARCHED_REPARSE path=" + $item.FullName) }
        elseif ($entry.depth -ge $MaxDepth) { $omitted++; W ("UNSEARCHED_DEPTH path=" + $item.FullName) }
        else { $stack.Push(@{path=$item.FullName; depth=$entry.depth+1}) }
      } else {
        $matched = @($patterns | Where-Object { $item.Name -like $_ })
        if ($matched.Count) {
          $hits++
          $kind = Get-HitKind $item.FullName
          if ($kind -eq "FIXTURE_HIT") { $fixtureInRoot++ } elseif ($kind -eq "RECEIVED_HIT") { $receivedInRoot++ } elseif ($kind -eq "CLONE_HIT") { $cloneInRoot++ } else { $realInRoot++ }
          foreach ($pn in $matched) { if ($hitsByPattern.ContainsKey($pn)) { $hitsByPattern[$pn] = $hitsByPattern[$pn] + 1 } else { $hitsByPattern[$pn] = 1 } }
          $hitKindByPath.Add($kind + " " + $item.FullName)
          try { $hash=(Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256 -ErrorAction Stop).Hash.ToLower(); W ($kind + " path=" + $item.FullName + " patterns=" + ($matched -join ",") + " bytes=" + $item.Length + " sha256=" + $hash) }
          catch { $errors++; W ("HIT_HASH_ERROR path=" + $item.FullName + " reason=" + $_.Exception.Message) }
        }
      }
    }
  }
  W ("ROOT_SUMMARY root=" + $root + " dirs=" + $dirs + " hits=" + $hits + " real=" + $realInRoot + " received=" + $receivedInRoot + " clone=" + $cloneInRoot + " fixture=" + $fixtureInRoot + " errors=" + $errors + " omitted_dirs=" + $omitted)
  $totalHits += $hits; $totalErrors += $errors; $totalDirs += $dirs; $totalOmitted += $omitted
  $realHits += $realInRoot; $fixtureHits += $fixtureInRoot; $cloneHits += $cloneInRoot; $receivedHits += $receivedInRoot
}
$patternLine = ($hitsByPattern.GetEnumerator() | Sort-Object Name | ForEach-Object { $_.Key + "=" + $_.Value }) -join "; "
W ("HITS_BY_PATTERN " + $patternLine)
W ("HIT_KIND_TOTALS real=" + $realHits + " received=" + $receivedHits + " clone=" + $cloneHits + " fixture=" + $fixtureHits)
W ("SEARCH_SUMMARY dirs=" + $totalDirs + " hits=" + $totalHits + " real=" + $realHits + " received=" + $receivedHits + " clone=" + $cloneHits + " fixture=" + $fixtureHits + " errors=" + $totalErrors + " omitted_dirs=" + $totalOmitted)
W "ERRORS_ALL_LISTED_ABOVE=true (每条访问错误逐条输出，抽样截断已取消)"
W "FIXTURE_SEPARATION fixture_hits 来自本机自测夹具目录（%TEMP%\b-*、_probe），不计入现场证据；received_hits 是 B 实际收到的审核包副本（_incoming）；clone_hits 来自 .tmp-repo 的 A 仓库克隆；只有 real_hits 是分布在本机业务目录中的副本。"
W "Conclusion limited to searched files/patterns/depth. Inaccessible, reparse, depth-limited and unsearched roots remain unsearched; no whole-machine absence claim."

W 'Conclusion limited to searched files/patterns/depth. Inaccessible, reparse, depth-limited and other roots remain unsearched; no whole-machine absence claim.'
Sec 'finished_at'; W (Get-Date).ToString('o')
$text = ($lines -join [Environment]::NewLine) + [Environment]::NewLine
if ($OutFile) { [IO.File]::WriteAllText($OutFile, $text, (New-Object Text.UTF8Encoding($true))); [Console]::WriteLine('facts_saved=' + $OutFile) } else { [Console]::Write($text) }
