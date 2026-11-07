$ErrorActionPreference='Continue'
function Dump($path) {
  Write-Output ("=== " + $path + " ===")
  if (-not (Test-Path $path)) { Write-Output "  (missing)"; return }
  $acl = Get-Acl -LiteralPath $path
  Write-Output ("  Owner=" + $acl.Owner)
  Write-Output ("  RulesProtected=" + $acl.AreAccessRulesProtected)
  Write-Output ("  SDDL=" + $acl.Sddl)
  foreach ($a in $acl.Access) {
    $tag = if ($a.IsInherited) { "INHERITED" } else { "EXPLICIT " }
    Write-Output ("  [" + $tag + "] " + $a.IdentityReference + " | " + $a.AccessControlType + " | " + $a.FileSystemRights + " | inh=" + $a.InheritanceFlags + " prop=" + $a.PropagationFlags)
  }
}
Dump 'D:\AutoAgentloop'
Write-Output ""
Write-Output "=== icacls tail (integrity label) ==="
icacls 'D:\AutoAgentloop' 2>&1 | Select-Object -Last 3
Write-Output "--- TEMP ---"
icacls $env:TEMP 2>&1 | Select-Object -Last 3
Write-Output "=== whoami integrity groups ==="
whoami /groups 2>&1 | Select-String -Pattern 'Mandatory|S-1-16'
