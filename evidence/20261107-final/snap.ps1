param([string]$Out)
$ErrorActionPreference = 'Continue'
$log = @()
$NL = [char]13 + [char]10
$log += "=== TIMESTAMP (local) ==="
$log += (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffK')
$log += "=== host/user ==="
$log += ("host=" + $env:COMPUTERNAME + " user=" + $env:USERNAME)
$log += "=== SCHEDULED TASKS agent-autoloop* ==="
$tasks = @()
try { $tasks = @(Get-ScheduledTask -ErrorAction Stop | Where-Object { $_.TaskName -like 'agent-autoloop*' }) } catch { $log += "ERR Get-ScheduledTask: $_" }
if ($tasks.Count -eq 0) { $log += "(none)" }
foreach ($t in $tasks) {
  $log += ("TASK name=" + $t.TaskName + " path=" + $t.TaskPath + " state=" + $t.State)
  try {
    $i = Get-ScheduledTaskInfo -TaskName $t.TaskName -TaskPath $t.TaskPath -ErrorAction Stop
    $log += ("  LastRunTime=" + $i.LastRunTime + " LastTaskResult=" + $i.LastTaskResult + " NextRunTime=" + $i.NextRunTime + " MissedRuns=" + $i.NumberOfMissedRuns)
  } catch { $log += ("  ERR info: " + $_) }
  try {
    $log += ("  Action.Exec=" + (($t.Actions | ForEach-Object { $_.Execute }) -join ' ; '))
    $log += ("  Action.Args=" + (($t.Actions | ForEach-Object { $_.Arguments }) -join ' ; '))
    $log += ("  Action.WorkDir=" + (($t.Actions | ForEach-Object { $_.WorkingDirectory }) -join ' ; '))
    $log += ("  Triggers=" + (($t.Triggers | ForEach-Object { $_.CimClass.CimClassName + '@' + $_.StartBoundary }) -join ' ; '))
    $log += ("  Principal=" + $t.Principal.UserId + " LogonType=" + $t.Principal.LogonType + " RunLevel=" + $t.Principal.RunLevel)
    $log += ("  Settings.Hidden=" + $t.Settings.Hidden + " DisallowStartIfOnBatteries=" + $t.Settings.DisallowStartIfOnBatteries)
  } catch { $log += ("  ERR def: " + $_) }
}
$log += "=== LISTENING 3300-3500 and 4347 ==="
$ln = @()
try {
  $ln = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { ($_.LocalPort -ge 3300 -and $_.LocalPort -le 3500) -or $_.LocalPort -eq 4347 })
} catch { $log += "ERR Get-NetTCPConnection: $_" }
if ($ln.Count -eq 0) { $log += "(none)" }
foreach ($c in $ln) {
  $pname = '?'
  try { $pname = (Get-Process -Id $c.OwningProcess -ErrorAction Stop).ProcessName } catch {}
  $log += ("LISTEN " + $c.LocalAddress + ":" + $c.LocalPort + " pid=" + $c.OwningProcess + " proc=" + $pname)
}
$log += "=== TEMP agent-autoloop-* ==="
$tmp = $env:TEMP
$log += ("TEMP=" + $tmp)
$dirs = @()
try { $dirs = @(Get-ChildItem -LiteralPath $tmp -Directory -Filter 'agent-autoloop-*' -ErrorAction Stop) } catch { $log += "ERR list: $_" }
if ($dirs.Count -eq 0) { $log += "(none)" }
foreach ($d in $dirs) {
  $bytes = 0; $files = 0
  try {
    $items = @(Get-ChildItem -LiteralPath $d.FullName -Recurse -Force -File -ErrorAction SilentlyContinue)
    $files = $items.Count
    $bytes = ($items | Measure-Object -Property Length -Sum).Sum
    if (-not $bytes) { $bytes = 0 }
  } catch {}
  $log += ("TEMP-DIR " + $d.FullName + " sizeBytes=" + $bytes + " files=" + $files + " mtime=" + $d.LastWriteTime.ToString('yyyy-MM-ddTHH:mm:ss'))
}
$log += "=== node processes ==="
try {
  @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction Stop) | ForEach-Object {
    $log += ("NODE pid=" + $_.ProcessId + " ppid=" + $_.ParentProcessId + " start=" + $_.CreationDate + " cmd=" + $_.CommandLine)
  }
} catch { $log += "ERR Win32_Process: $_" }
$log += "=== up.pid ==="
try { $log += ("up.pid=" + (Get-Content -LiteralPath (Join-Path $env:USERPROFILE '.agent-autoloop\up.pid') -Raw -ErrorAction Stop).Trim()) } catch { $log += "ERR up.pid: $_" }
Set-Content -LiteralPath $Out -Value ($log -join $NL) -Encoding UTF8
Write-Output ("WROTE " + $Out + " entries=" + $log.Count)
