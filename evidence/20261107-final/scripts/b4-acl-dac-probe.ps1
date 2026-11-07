$ErrorActionPreference='Continue'
function Try-Case($name, $dir, $scriptBlock) {
  if (Test-Path $dir) { Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue }
  New-Item -ItemType Directory -Path $dir | Out-Null
  try { & $scriptBlock $dir; Write-Output ("CASE " + $name + " = OK") }
  catch { Write-Output ("CASE " + $name + " = FAIL " + $_.Exception.GetType().Name + " :: " + $_.Exception.Message) }
  $acl = Get-Acl $dir
  Write-Output ("      protected=" + $acl.AreAccessRulesProtected + " aceCount=" + $acl.Access.Count)
  if (Test-Path $dir) { Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue }
}
$base = 'D:\AutoAgentloop\_priv_probe'

Try-Case 'A: protect+owner+2ACE (exact privateDirectory)' ($base + 'A') {
  param($d)
  $acl = [Security.AccessControl.DirectorySecurity]::new()
  $acl.SetAccessRuleProtection($true, $false)
  $owner = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $acl.SetOwner($owner)
  foreach ($sid in @($owner, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
  }
  [IO.Directory]::SetAccessControl($d, $acl)
}

Try-Case 'B: protect only (keep existing DACL, strip inheritance)' ($base + 'B') {
  param($d)
  $acl = Get-Acl $d
  $acl.SetAccessRuleProtection($true, $true)
  [IO.Directory]::SetAccessControl($d, $acl)
}

Try-Case 'C: add one Allow ACE, keep inheritance' ($base + 'C') {
  param($d)
  $acl = Get-Acl $d
  $owner = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($owner, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
  [IO.Directory]::SetAccessControl($d, $acl)
}

Try-Case 'D: same as A but under TEMP (control)' (Join-Path $env:TEMP '_priv_probeD') {
  param($d)
  $acl = [Security.AccessControl.DirectorySecurity]::new()
  $acl.SetAccessRuleProtection($true, $false)
  $owner = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $acl.SetOwner($owner)
  foreach ($sid in @($owner, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
  }
  [IO.Directory]::SetAccessControl($d, $acl)
}
Write-Output ("whoami_il=" + (whoami /groups | Select-String 'Mandatory Label'))
