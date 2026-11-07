param([int]$DelaySeconds = 60)
$ErrorActionPreference = 'Continue'
Start-Sleep -Seconds $DelaySeconds
$base = 'D:\AutoAgentloop\evidence\20261107-logon'
$marker = Join-Path $base 'after-capture-log.txt'
function Log($s) { Add-Content -LiteralPath $marker -Value ((Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffK') + ' | ' + $s) -Encoding UTF8 }
Log ('after-capture start pid=' + $PID + ' user=' + $env:USERNAME + ' session=' + $env:SESSIONNAME)
try { Unregister-ScheduledTask -TaskName 'agent-autoloop-aftercap' -Confirm:$false -ErrorAction Stop; Log 'self-unregistered OK' } catch { Log ('self-unregister FAILED: ' + $_) }
Start-Sleep -Seconds 3
$ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$out = Join-Path $base ('after-b2-' + $ts + '.txt')
try { & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $base 'capture.ps1') -Phase after -Out $out | ForEach-Object { Log ('capture: ' + $_) } } catch { Log ('capture FAILED: ' + $_) }
try { & powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'D:\AutoAgentloop\evidence\20261107-final\snap.ps1' -Out 'D:\AutoAgentloop\evidence\20261107-final\after\b2-b3-after-logon.txt' | ForEach-Object { Log ('snap: ' + $_) } } catch { Log ('snap FAILED: ' + $_) }
Log 'after-capture done'
