
set -u
OUT=$1
{
  echo "# snapshot $OUT $(date -u +%FT%TZ)"
  echo "## scheduled tasks matching agent-autoloop*:"
  powershell -NoProfile -Command "Get-ScheduledTask | Where-Object { \$_.TaskName -like 'agent-autoloop*' } | ForEach-Object { \$_.TaskName + ' | ' + \$_.State }"
  echo "## listening ports 3350-3400 and 4347:"
  powershell -NoProfile -Command "Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { (\$_.LocalPort -ge 3350 -and \$_.LocalPort -le 3400) -or \$_.LocalPort -eq 4347 } | ForEach-Object { \$_.LocalAddress + ':' + \$_.LocalPort + ' pid=' + \$_.OwningProcess }"
  echo "## %TEMP% agent-autoloop-* dirs:"
  echo "count=$(ls -d "$TEMP"/agent-autoloop-* 2>/dev/null | wc -l)"
  ls -d "$TEMP"/agent-autoloop-* 2>/dev/null | sed 's|.*/||'
  echo "## node processes with agent-autoloop in command line:"
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*agent-autoloop*' } | ForEach-Object { \$_.ProcessId.ToString() + ' ' + \$_.CommandLine.Substring(0, [Math]::Min(90, \$_.CommandLine.Length)) }"
} > "$OUT" 2>&1
