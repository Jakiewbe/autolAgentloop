$ErrorActionPreference='Continue'
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
$tag = [guid]::NewGuid().ToString('N').Substring(0,6)
$dir = 'D:\AutoAgentloop\labprobe-' + $tag
[IO.Directory]::CreateDirectory($dir) | Out-Null
Write-Output ("target=" + $dir)
Write-Output ("icacls-head: " + ((icacls $dir 2>&1 | Select-Object -First 3) -join ' / '))

function Probe1($label, [scriptblock]$sb) {
  try { & $sb; Write-Output ("  " + $label + " => OK") }
  catch { Write-Output ("  " + $label + " => FAIL " + $_.Exception.Message.Split([char]10)[0]) }
}

Write-Output "=== T1: owner-only write on D-tree child ==="
Probe1 'owner-only' { $a = [Security.AccessControl.DirectorySecurity]::new(); $a.SetOwner($sid); [IO.Directory]::SetAccessControl($dir, $a) }

Write-Output "=== T2: DACL-only (protected, chs FullControl) ==="
Probe1 'dacl-only' { $a = [Security.AccessControl.DirectorySecurity]::new(); $a.SetAccessRuleProtection($true,$false); $a.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow')); [IO.Directory]::SetAccessControl($dir, $a) }

Write-Output "=== T3: owner write AFTER dacl now grants FullControl ==="
Probe1 'owner-after-grant' { $a = [Security.AccessControl.DirectorySecurity]::new(); $a.SetOwner($sid); [IO.Directory]::SetAccessControl($dir, $a) }

Write-Output "=== T4: exact files.ts code on same dir ==="
Probe1 'exact-files.ts' {
  $acl = [Security.AccessControl.DirectorySecurity]::new()
  $acl.SetAccessRuleProtection($true, $false)
  $acl.SetOwner($sid)
  foreach ($s in @($sid, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($s, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
  }
  [IO.Directory]::SetAccessControl($dir, $acl)
}

Write-Output "=== T5: fresh child under that dir ==="
$sub = $dir + '\sub'
[IO.Directory]::CreateDirectory($sub) | Out-Null
Probe1 'fresh-child-under-granted' {
  $acl = [Security.AccessControl.DirectorySecurity]::new()
  $acl.SetAccessRuleProtection($true, $false)
  $acl.SetOwner($sid)
  foreach ($s in @($sid, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($s, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
  }
  [IO.Directory]::SetAccessControl($sub, $acl)
}

Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
Write-Output ("removed=" + (-not (Test-Path -LiteralPath $dir)))
Write-Output ("leftover=" + (Get-ChildItem -LiteralPath 'D:\AutoAgentloop' -Directory -Filter 'labprobe-*' -Recurse -ErrorAction SilentlyContinue | Measure-Object).Count)
