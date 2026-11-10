# Self-heal patrol on a timer, without a console window. Started at logon by
# deploy\scripts\self-heal-launcher.vbs through a Startup shortcut.
#
# Only one patrol may run at a time: the mutex is taken for the lifetime of this process.
# Every run appends one line to deploy\logs\self-heal.log so the patrol can be audited later.
param([switch]$Once)
$ErrorActionPreference = 'Stop'
$repo = 'D:\Vibe_coding-Project\autoAgentloop'
$mutex = New-Object System.Threading.Mutex($false, 'Local\agent-autoloop-self-heal')
if (-not $mutex.WaitOne(0)) { exit 0 }
$logDir = Join-Path $repo 'deploy\logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir 'self-heal.log'
$node = 'C:\Program Files\nodejs\node.exe'
$intervalSeconds = 10800
while ($true) {
  $stamp = (Get-Date).ToString('s')
  try {
    $out = & $node (Join-Path $repo 'deploy\scripts\self-heal.mjs') --apply --max 3 --json 2>&1 | Out-String
    Add-Content -LiteralPath $log -Value ("[" + $stamp + "] self-heal exit=" + $LASTEXITCODE + " " + $out.Trim())
    # Whatever the patrol could not fix becomes a proposal; it never approves or starts anything itself.
    $evo = & $node (Join-Path $repo 'deploy\scripts\evolve.mjs') --json 2>&1 | Out-String
    Add-Content -LiteralPath $log -Value ("[" + $stamp + "] evolve exit=" + $LASTEXITCODE + " " + $evo.Trim())
  } catch {
    Add-Content -LiteralPath $log -Value ("[" + $stamp + "] error: " + $_.Exception.Message)
  }
  if ((Test-Path -LiteralPath $log) -and ((Get-Item -LiteralPath $log).Length -gt 2MB)) {
    Move-Item -LiteralPath $log -Destination ($log + '.1') -Force
  }
  if ($Once) { break }
  Start-Sleep -Seconds $intervalSeconds
}
$mutex.ReleaseMutex();
