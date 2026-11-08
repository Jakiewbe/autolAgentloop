Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' } | ForEach-Object {
  $c = $_.CommandLine
  if ($c -and $c.Length -gt 300) { $c = $c.Substring(0,300) }
  "PID=$($_.ProcessId) PPID=$($_.ParentProcessId) START=$($_.CreationDate)"
  "  CMD=$c"
}
