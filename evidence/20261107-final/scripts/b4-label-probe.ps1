$ErrorActionPreference='Continue'

function ExactProbe($label, $dir) {
  try {
    [IO.Directory]::CreateDirectory($dir) | Out-Null
    $acl = [Security.AccessControl.DirectorySecurity]::new()
    $acl.SetAccessRuleProtection($true, $false)
    $owner = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl.SetOwner($owner)
    foreach ($sid in @($owner, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
      $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow'))
    }
    [IO.Directory]::SetAccessControl($dir, $acl)
    Write-Output ("  " + $label + " => OK")
  } catch {
    Write-Output ("  " + $label + " => FAIL " + $_.Exception.Message.Split([char]10)[0])
  }
}

function ForceClean($dir) {
  if (-not (Test-Path -LiteralPath $dir)) { return }
  try {
    $acl = Get-Acl -LiteralPath $dir
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl.SetAccessRuleProtection($true,$false)
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))
    [IO.Directory]::SetAccessControl($dir, $acl)
  } catch {}
  Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
}

$tag = [guid]::NewGuid().ToString('N').Substring(0,6)
$d1 = 'D:\AutoAgentloop\labprobe-' + $tag
Write-Output "=== A: D-tree child, label cleared to Medium first ==="
[IO.Directory]::CreateDirectory($d1) | Out-Null
icacls $d1 /setintegritylevel Medium 2>&1 | Out-Null
Write-Output ("  label now: " + ((icacls $d1 2>&1 | Select-String -Pattern 'Mandatory|强制' | ForEach-Object { $_.ToString().Trim() }) -join ' | '))
ExactProbe 'D-tree child after icacls Medium' $d1
ForceClean $d1

Write-Output "=== B: TEMP child, label forced to Low ==="
$d2 = $env:TEMP + '\labprobe-' + $tag
[IO.Directory]::CreateDirectory($d2) | Out-Null
icacls $d2 /setintegritylevel Low 2>&1 | Out-Null
Write-Output ("  label now: " + ((icacls $d2 2>&1 | Select-String -Pattern 'Mandatory|强制' | ForEach-Object { $_.ToString().Trim() }) -join ' | '))
ExactProbe 'TEMP child after icacls Low' $d2
ForceClean $d2

Write-Output "=== C: D-tree child, DACL-only write (no SetOwner call) ==="
$d3 = 'D:\AutoAgentloop\labprobe-' + $tag + 'c'
[IO.Directory]::CreateDirectory($d3) | Out-Null
try {
  $acl = [Security.AccessControl.DirectorySecurity]::new()
  $acl.SetAccessRuleProtection($true,$false)
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))
  [IO.Directory]::SetAccessControl($d3, $acl)
  Write-Output "  DACL-only => OK"
} catch { Write-Output ("  DACL-only => FAIL " + $_.Exception.Message.Split([char]10)[0]) }
ForceClean $d3

Write-Output "=== D: TEMP child, with SetOwner call (control) ==="
$d4 = $env:TEMP + '\labprobe-' + $tag + 'd'
ExactProbe 'TEMP with owner call' $d4
ForceClean $d4

Write-Output "=== leftover ==="
Write-Output ("D tree labprobe: " + (Get-ChildItem -LiteralPath 'D:\AutoAgentloop' -Directory -Filter 'labprobe-*' -Recurse -ErrorAction SilentlyContinue | Measure-Object).Count)
Write-Output ("TEMP labprobe: " + (Get-ChildItem -LiteralPath $env:TEMP -Directory -Filter 'labprobe-*' -ErrorAction SilentlyContinue | Measure-Object).Count)
