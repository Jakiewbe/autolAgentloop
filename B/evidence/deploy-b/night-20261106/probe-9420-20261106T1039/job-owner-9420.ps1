
$ErrorActionPreference='Continue'
Write-Output "== parent 11060"
$pp = Get-CimInstance Win32_Process -Filter 'ProcessId=11060' -ErrorAction SilentlyContinue
if ($pp) { Write-Output ("parent alive: " + $pp.Name + " " + $pp.CommandLine) } else { Write-Output "parent alive: NO (gone)" }

Write-Output "== IsProcessInJob via P/Invoke"
$sig = @"
using System;
using System.Runtime.InteropServices;
public static class J {
  [DllImport("kernel32.dll", SetLastError=true)] public static extern IntPtr OpenProcess(uint a, bool b, int pid);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool IsProcessInJob(IntPtr p, IntPtr j, out bool r);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll", SetLastError=true)] public static extern bool QueryInformationJobObject(IntPtr j, int cls, IntPtr buf, int len, out int ret);
}
"@
Add-Type -TypeDefinition $sig -ErrorAction Stop
foreach ($pid0 in 9420) {
  $h = [J]::OpenProcess(0x0400, $false, $pid0)
  if ($h -eq [IntPtr]::Zero) { Write-Output "pid $pid0 OpenProcess failed err=$([Runtime.InteropServices.Marshal]::GetLastWin32Error())"; continue }
  $inJob = $false
  $ok = [J]::IsProcessInJob($h, [IntPtr]::Zero, [ref]$inJob)
  Write-Output "pid $pid0 inAnyJob=$inJob ok=$ok err=$([Runtime.InteropServices.Marshal]::GetLastWin32Error())"
  [void][J]::CloseHandle($h)
}

Write-Output "== tcp from 9420"
Get-NetTCPConnection -OwningProcess 9420 -ErrorAction SilentlyContinue | Select-Object State,RemoteAddress,RemotePort,LocalPort | Format-Table -AutoSize | Out-String

Write-Output "== log files"
Get-ChildItem 'C:\Users\19082\.agent-autoloop\logs\worker.stdout.post-night-20261106T1020.log','C:\Users\19082\.agent-autoloop\logs\worker.stderr.post-night-20261106T1020.log','C:\Users\19082\.agent-autoloop\up.pid' -ErrorAction SilentlyContinue | Select-Object Name,Length,LastWriteTime | Format-Table -AutoSize | Out-String
Write-Output "== up.pid"
Get-Content 'C:\Users\19082\.agent-autoloop\up.pid' -ErrorAction SilentlyContinue
Write-Output "== tail stdout log"
Get-Content 'C:\Users\19082\.agent-autoloop\logs\worker.stdout.post-night-20261106T1020.log' -Tail 6
Write-Output "== tail stderr log"
Get-Content 'C:\Users\19082\.agent-autoloop\logs\worker.stderr.post-night-20261106T1020.log' -Tail 6 -ErrorAction SilentlyContinue
