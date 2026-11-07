$ErrorActionPreference='Continue'

function ForceClean($dir) {
  if (-not (Test-Path -LiteralPath $dir)) { return }
  try {
    $acl = Get-Acl -LiteralPath $dir
    $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl.SetAccessRuleProtection($true,$false)
    $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))
    [IO.Directory]::SetAccessControl($dir, $acl)
  } catch { Write-Output ("  cleanup-acl-fail: " + $_.Exception.Message) }
  Remove-Item -LiteralPath $dir -Recurse -Force -ErrorAction SilentlyContinue
}

# leftover from previous stepwise probe
Get-ChildItem -LiteralPath 'D:\AutoAgentloop\work\agent-autoloop' -Directory -Filter 'aclprobe-*' -ErrorAction SilentlyContinue | ForEach-Object { Write-Output ("cleanup-leftover: " + $_.FullName); ForceClean $_.FullName }
Get-ChildItem -LiteralPath $env:TEMP -Directory -Filter 'aclprobe-*' -ErrorAction SilentlyContinue | ForEach-Object { Write-Output ("cleanup-leftover: " + $_.FullName); ForceClean $_.FullName }

function ExactProbe($label, $dir) {
  Write-Output ("=== " + $label + " :: " + $dir + " ===")
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
    Write-Output "  RESULT=OK"
  } catch {
    Write-Output ("  RESULT=FAIL " + $_.Exception.GetType().FullName)
    Write-Output ("  MSG=" + ($_.Exception.Message -replace "\s+"," "))
  }
  if (Test-Path -LiteralPath $dir) {
    $a = Get-Acl -LiteralPath $dir
    Write-Output ("  post: owner=" + $a.Owner + " protected=" + $a.AreAccessRulesProtected + " aces=" + $a.Access.Count)
    icacls $dir 2>&1 | Select-Object -Last 2 | ForEach-Object { Write-Output ("  icacls: " + $_) }
  }
  ForceClean $dir
  Write-Output ("  removed=" + (-not (Test-Path -LiteralPath $dir)))
  Write-Output ""
}

$tag = [guid]::NewGuid().ToString('N').Substring(0,6)
ExactProbe 'D-sub-work'   ('D:\AutoAgentloop\work\agent-autoloop\aclprobe-' + $tag)
ExactProbe 'D-root-child' ('D:\AutoAgentloop\aclprobe-' + $tag)
ExactProbe 'A-suggested-home' ('D:\AutoAgentloop\work\agent-autoloop\.home\aclprobe-' + $tag)
ExactProbe 'TEMP'         ($env:TEMP + '\aclprobe-' + $tag)
ExactProbe 'LOCALAPPDATA' ($env:LOCALAPPDATA + '\aclprobe-' + $tag)
Write-Output "=== leftover check ==="
Write-Output ("D tree aclprobe: " + (Get-ChildItem -LiteralPath 'D:\AutoAgentloop' -Directory -Filter 'aclprobe-*' -Recurse -ErrorAction SilentlyContinue | Measure-Object).Count)
Write-Output ("TEMP aclprobe: " + (Get-ChildItem -LiteralPath $env:TEMP -Directory -Filter 'aclprobe-*' -ErrorAction SilentlyContinue | Measure-Object).Count)
