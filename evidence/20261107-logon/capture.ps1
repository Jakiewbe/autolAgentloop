param([string]$Phase = "before", [string]$Out)
$ErrorActionPreference = 'Continue'
$NL = [char]13 + [char]10
$log = New-Object System.Collections.Generic.List[string]
function Add-Line($s) { $script:log.Add([string]$s) }

Add-Line "=== PHASE: $Phase ==="
Add-Line ("timestamp_local=" + (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffK'))
Add-Line ("timestamp_utc=" + (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ss.fffZ'))
Add-Line ("host=" + $env:COMPUTERNAME + " user=" + $env:USERNAME + " session=" + $env:SESSIONNAME)

Add-Line ""
Add-Line "=== SCHEDULED TASK \agent-autoloop (definition + state) ==="
try {
  $t = Get-ScheduledTask -TaskName 'agent-autoloop' -TaskPath '\' -ErrorAction Stop
  Add-Line ("TaskName=" + $t.TaskName + " TaskPath=" + $t.TaskPath + " State=" + $t.State)
  $i = Get-ScheduledTaskInfo -TaskName 'agent-autoloop' -TaskPath '\' -ErrorAction Stop
  Add-Line ("LastRunTime=" + $i.LastRunTime + " LastTaskResult=" + $i.LastTaskResult + " NextRunTime=" + $i.NextRunTime + " MissedRuns=" + $i.NumberOfMissedRuns)
  $n = 0
  foreach ($a in $t.Actions) { Add-Line ("Action[" + $n + "].Execute=" + $a.Execute); Add-Line ("Action[" + $n + "].Arguments=" + $a.Arguments); Add-Line ("Action[" + $n + "].WorkingDirectory=" + $a.WorkingDirectory); $n++ }
  $n = 0
  foreach ($tr in $t.Triggers) { Add-Line ("Trigger[" + $n + "] class=" + $tr.CimClass.CimClassName + " start=" + $tr.StartBoundary + " user=" + $tr.UserId); $n++ }
  Add-Line ("Principal UserId=" + $t.Principal.UserId + " LogonType=" + $t.Principal.LogonType + " RunLevel=" + $t.Principal.RunLevel)
  Add-Line ("Settings ExecutionTimeLimit=" + $t.Settings.ExecutionTimeLimit + " RestartCount=" + $t.Settings.RestartCount + " MultipleInstances=" + $t.Settings.MultipleInstances + " Hidden=" + $t.Settings.Hidden)
  $xml = Export-ScheduledTask -TaskName 'agent-autoloop' -TaskPath '\' -ErrorAction Stop
  Add-Line "--- task XML ---"
  foreach ($line in ($xml -split "\r?\n")) { Add-Line $line }
  Add-Line "--- end task XML ---"
} catch { Add-Line ("ERR task: " + $_) }

Add-Line ""
Add-Line "=== ALL TASKS agent-autoloop* ==="
try {
  $all = @(Get-ScheduledTask -ErrorAction Stop | Where-Object { $_.TaskName -like 'agent-autoloop*' })
  if ($all.Count -eq 0) { Add-Line "(none)" }
  foreach ($x in $all) { Add-Line ("TASK " + $x.TaskPath + $x.TaskName + " state=" + $x.State) }
} catch { Add-Line ("ERR tasks: " + $_) }

Add-Line ""
Add-Line "=== PROCESS TREE: agent-autoloop related ==="
try {
  $procs = @(Get-CimInstance Win32_Process -Filter "Name='node.exe' or Name='wscript.exe'" -ErrorAction Stop)
  $hit = 0
  foreach ($p in $procs) {
    if ($p.CommandLine -match 'agent-autoloop|background\.ts') {
      $hit++
      Add-Line ("PROC pid=" + $p.ProcessId + " ppid=" + $p.ParentProcessId + " name=" + $p.Name + " start=" + $p.CreationDate)
      Add-Line ("     cmd=" + $p.CommandLine)
    }
  }
  if ($hit -eq 0) { Add-Line "(no agent-autoloop process)" }
} catch { Add-Line ("ERR procs: " + $_) }

Add-Line ""
Add-Line "=== LISTENING PORTS ==="
try {
  $upId = 0
  try { $upId = [int](Get-Content -LiteralPath (Join-Path $env:USERPROFILE '.agent-autoloop\up.pid') -Raw).Trim() } catch {}
  $conns = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.OwningProcess -eq $upId -or ($_.LocalPort -ge 3300 -and $_.LocalPort -le 3500) -or $_.LocalPort -eq 4347 })
  if ($conns.Count -eq 0) { Add-Line ("(none: up pid " + $upId + " listens on nothing; 3300-3500 and 4347 empty)") }
  foreach ($c in $conns) { Add-Line ("LISTEN " + $c.LocalAddress + ":" + $c.LocalPort + " pid=" + $c.OwningProcess) }
} catch { Add-Line ("ERR ports: " + $_) }

Add-Line ""
Add-Line "=== up.pid ==="
try {
  $raw = (Get-Content -LiteralPath (Join-Path $env:USERPROFILE '.agent-autoloop\up.pid') -Raw -ErrorAction Stop).Trim()
  Add-Line ("up.pid=" + $raw)
  $alive = $null
  try { $alive = Get-Process -Id ([int]$raw) -ErrorAction Stop } catch {}
  if ($alive) { Add-Line ("up.pid process alive: " + $alive.ProcessName + " start=" + $alive.StartTime) } else { Add-Line "up.pid process NOT running" }
} catch { Add-Line ("ERR up.pid: " + $_) }

Add-Line ""
Add-Line "=== STARTUP FOLDER + Run keys ==="
foreach ($dir in @((Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'), (Join-Path $env:ProgramData 'Microsoft\Windows\Start Menu\Programs\Startup'))) {
  Add-Line ("DIR " + $dir)
  try { $f = @(Get-ChildItem -LiteralPath $dir -Force -ErrorAction Stop); if ($f.Count -eq 0) { Add-Line "  (empty)" }; foreach ($x in $f) { Add-Line ("  " + $x.Name + " " + $x.Length + "B") } } catch { Add-Line ("  ERR " + $_) }
}
foreach ($k in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Run','HKLM:\Software\Microsoft\Windows\CurrentVersion\Run')) {
  Add-Line ("KEY " + $k)
  try { $p = Get-ItemProperty -Path $k -ErrorAction Stop; $names = $p.PSObject.Properties | Where-Object { $_.Name -notlike 'PS*' }; if (-not $names) { Add-Line "  (none)" }; foreach ($n in $names) { Add-Line ("  " + $n.Name + "=" + $n.Value) } } catch { Add-Line ("  ERR " + $_) }
}

Add-Line ""
Add-Line "=== up.log tail 20 (raw) ==="
try {
  $lines = @(Get-Content -LiteralPath (Join-Path $env:USERPROFILE '.agent-autoloop\logs\up.log') -ErrorAction Stop)
  Add-Line ("total_lines=" + $lines.Count)
  foreach ($l in ($lines | Select-Object -Last 20)) { Add-Line $l }
} catch { Add-Line ("ERR up.log: " + $_) }

Add-Line ""
Add-Line "=== DESKTOP WINDOWS BY CLASS ConsoleWindowClass ==="
try {
  if (-not ("Win32Enum" -as [type])) {
    Add-Type -TypeDefinition @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class Win32Enum {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr hWnd, StringBuilder sb, int max);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr hWnd, StringBuilder sb, int max);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  public static List<string> ConsoleWindows() {
    var found = new List<string>();
    EnumWindows((h, l) => {
      var cls = new StringBuilder(256);
      GetClassName(h, cls, 256);
      if (cls.ToString() == "ConsoleWindowClass") {
        var title = new StringBuilder(512);
        GetWindowText(h, title, 512);
        uint pid; GetWindowThreadProcessId(h, out pid);
        found.Add("HWND=" + h.ToInt64() + " class=" + cls + " visible=" + IsWindowVisible(h) + " pid=" + pid + " title=" + title);
      }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
"@
  }
  $w = [Win32Enum]::ConsoleWindows()
  Add-Line ("ConsoleWindowClass count=" + $w.Count)
  foreach ($x in $w) { Add-Line $x }
} catch { Add-Line ("ERR window enum: " + $_) }

$dir = Split-Path -Parent $Out
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
Set-Content -LiteralPath $Out -Value ($log -join $NL) -Encoding UTF8
Write-Output ("WROTE " + $Out + " lines=" + $log.Count)
