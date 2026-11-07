$ErrorActionPreference='Stop'
$dir = 'D:\AutoAgentloop\_private_probe'
if (Test-Path $dir) { Remove-Item -LiteralPath $dir -Recurse -Force }
New-Item -ItemType Directory -Path $dir | Out-Null
try {
  $acl = [Security.AccessControl.DirectorySecurity]::new()
  $acl.SetAccessRuleProtection($true, $false)
  $owner = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $acl.SetOwner($owner)
  foreach ($sid in @($owner, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
  }
  [IO.Directory]::SetAccessControl($dir, $acl)
  Write-Output "privateDirectory-on-subdir=OK"
} catch {
  Write-Output ("privateDirectory-on-subdir=FAIL " + $_.Exception.GetType().FullName + " :: " + $_.Exception.Message)
}
Write-Output "--- resulting ACL ---"
(Get-Acl $dir).Access | ForEach-Object { Write-Output ("  " + $_.IdentityReference + " " + $_.FileSystemRights + " " + $_.AccessControlType) }
Write-Output ("areAccessRulesProtected=" + (Get-Acl $dir).AreAccessRulesProtected)
Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
Write-Output ("cleanup_exists=" + (Test-Path $dir))
