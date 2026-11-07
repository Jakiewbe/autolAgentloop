$ErrorActionPreference = 'Stop'
$act = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy Bypass -File "D:\AutoAgentloop\evidence\20261107-logon\after-capture.ps1"'
$trg = New-ScheduledTaskTrigger -AtLogOn -User 'MAGICBOOK14-ZZ\chs'
$pr = New-ScheduledTaskPrincipal -UserId 'MAGICBOOK14-ZZ\chs' -LogonType Interactive -RunLevel Limited
$st = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 15)
Register-ScheduledTask -TaskName 'agent-autoloop-aftercap' -Action $act -Trigger $trg -Principal $pr -Settings $st -Description 'B2 one-shot: capture after-logon snapshot then self-unregister' -Force | Out-Null
$t = Get-ScheduledTask -TaskName 'agent-autoloop-aftercap'
Write-Output ('TASK=' + $t.TaskName + ' state=' + $t.State)
Write-Output ('EXEC=' + $t.Actions[0].Execute)
Write-Output ('ARGS=' + $t.Actions[0].Arguments)
Write-Output ('TRIGGER=' + $t.Triggers[0].CimClass.CimClassName + ' user=' + $t.Principal.UserId + ' logon=' + $t.Principal.LogonType)
Write-Output 'ALL_TASKS:'
Get-ScheduledTask | Where-Object { $_.TaskName -like 'agent-autoloop*' } | ForEach-Object { Write-Output ('  ' + $_.TaskPath + $_.TaskName + ' ' + $_.State) }
