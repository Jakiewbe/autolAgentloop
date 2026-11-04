$ErrorActionPreference='Continue'
& { $listenPid = 1; Write-Output ("listenPid=" + $listenPid) }
& { try { $pid = 1; Write-Output "pid_assign=no-error" } catch { Write-Output ("pid_assign=" + $_.Exception.Message) } }
Write-Output ("current_PID=" + $PID)
