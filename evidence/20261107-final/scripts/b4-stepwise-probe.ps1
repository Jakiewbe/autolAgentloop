$ErrorActionPreference='Continue'
$me = New-Object System.Security.Principal.NTAccount('MAGICBOOK14-ZZ\chs')
$sis = New-Object System.Security.Principal.SecurityIdentifier('S-1-5-18')

function TryStep($label, [scriptblock]$sb) {
  try { & $sb; Write-Output ("  [OK  ] " + $label) }
  catch { Write-Output ("  [FAIL] " + $label + " :: " + $_.Exception.GetType().Name + " :: " + ($_.Exception.Message -replace "\s+"," ")) }
}

function Probe($base, $case) {
  $dir = Join-Path $base ("aclprobe-" + $case + "-" + [guid]::NewGuid().ToString('N').Substring(0,6))
  Write-Output ("=== BASE " + $base + " CASE " + $case + " ===")
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
  $acl0 = Get-Acl -LiteralPath $dir
  Write-Output ("  owner0=" + $acl0.Owner + " protected0=" + $acl0.AreAccessRulesProtected + " aces0=" + $acl0.Access.Count)

  $sec = Get-Acl -LiteralPath $dir
  TryStep "SetOwner(chs)" { $d = Join-Path $dir "child.txt"; Set-Content -LiteralPath $d -Value x; $s = Get-Acl -LiteralPath $dir; $s.SetOwner($me); Set-Acl -LiteralPath $dir -AclObject $s }

  $sec2 = Get-Acl -LiteralPath $dir
  TryStep "SetAccessRuleProtection(true,false)" { $sec2.SetAccessRuleProtection($true,$false); Set-Acl -LiteralPath $dir -AclObject $sec2 }

  $after = Get-Acl -LiteralPath $dir
  Write-Output ("  after: owner=" + $after.Owner + " protected=" + $after.AreAccessRulesProtected + " aces=" + $after.Access.Count)

  $sec3 = Get-Acl -LiteralPath $dir
  TryStep "AddAccessRule(chs FullControl) + rule removal of inherited" {
     $sec3.SetAccessRuleProtection($true,$false)
     $sec3.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($me,'FullControl','ContainerInherit,ObjectInherit','None','Allow')))
     $sec3.AddAccessRule((New-Object System.Security.AccessControl.FileSystemAccessRule($sis,'FullControl','ContainerInherit,ObjectInherit','None','Allow')))
     Set-Acl -LiteralPath $dir -AclObject $sec3
  }

  $final = Get-Acl -LiteralPath $dir
  Write-Output ("  final: owner=" + $final.Owner + " protected=" + $final.AreAccessRulesProtected + " aces=" + $final.Access.Count)
  icacls $dir 2>&1 | Select-Object -Last 2
  Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
  Write-Output ("  cleaned=" + (-not (Test-Path $dir)))
  Write-Output ""
}

Probe 'D:\AutoAgentloop\work\agent-autoloop' 'dsub'
Probe $env:TEMP 'temp'
Write-Output "=== integrity of current process ==="
whoami /groups 2>&1 | Select-String -Pattern 'S-1-16'
Write-Output "=== parent chain ==="
$p = Get-CimInstance Win32_Process -Filter ("ProcessId=" + $PID)
while ($p) { Write-Output ("  " + $p.ProcessId + " " + $p.Name); if ($p.ParentProcessId -eq 0) { break }; $p = Get-CimInstance Win32_Process -Filter ("ProcessId=" + $p.ParentProcessId) -ErrorAction SilentlyContinue }
