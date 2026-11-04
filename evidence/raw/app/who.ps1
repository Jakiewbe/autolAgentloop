Get-CimInstance Win32_Process -Filter "ProcessId=45704" | Select-Object ProcessId,@{n='cmd';e={$_.CommandLine}} | Format-List
