$all = Get-CimInstance Win32_Process -Filter "Name='node.exe'"
"node.exe count: " + @($all).Count
$ours = @($all | Where-Object { $_.CommandLine -match 'agent-autoloop|runner\.ts' })
"agent-autoloop/runner processes: " + $ours.Count
$ours | ForEach-Object { "  PID " + $_.ProcessId + " :: " + $_.CommandLine }
