param(
  [string]$CandidateHome,
  [string]$ForbiddenRoot = 'D:\AutoAgentloop'
)
# Read-only assertion. Resolution mirrors host/home.ts:5
#   (process.env.AGENT_AUTOLOOP_HOME ?? path.join(homedir(), '.agent-autoloop'))
# The verdict runs BEFORE any file read/write; a violation exits 2 immediately.
$ErrorActionPreference = 'Stop'

if ($CandidateHome) {
  $effective = $CandidateHome
  $source = 'param:CandidateHome'
} elseif ($env:AGENT_AUTOLOOP_HOME) {
  $effective = $env:AGENT_AUTOLOOP_HOME
  $source = 'env:AGENT_AUTOLOOP_HOME'
} else {
  $effective = Join-Path $env:USERPROFILE '.agent-autoloop'
  $source = 'default(homedir)'
}

try { $resolved = [IO.Path]::GetFullPath($effective) } catch { Write-Output ('VIOLATION unparsable home: ' + $effective); exit 2 }
try { $rootResolved = [IO.Path]::GetFullPath($ForbiddenRoot) } catch { Write-Output ('VIOLATION unparsable root: ' + $ForbiddenRoot); exit 2 }

$rootTrim = $rootResolved.TrimEnd('\')
$resolvedTrim = $resolved.TrimEnd('\')
$isSelf = ($resolvedTrim -ieq $rootTrim)
$isInside = ($resolvedTrim + '\').StartsWith(($rootTrim + '\'), [StringComparison]::OrdinalIgnoreCase)

if ($isSelf -or $isInside) {
  Write-Output ('VIOLATION home lies inside the forbidden root: ' + $resolved)
  Write-Output ('  source=' + $source)
  Write-Output ('  forbidden=' + $rootTrim)
  Write-Output '  reason=host/files.ts:5-17 privateDirectory() drops inherited ACEs and rewrites the owner; on objects under this root chs has no WRITE_OWNER, so it throws UnauthorizedAccessException'
  Write-Output 'RESULT=REFUSED (no read, no write performed)'
  exit 2
}

Write-Output ('OK home=' + $resolved)
Write-Output ('  source=' + $source)
Write-Output ('  forbidden=' + $rootTrim + ' (not an ancestor)')
Write-Output ('  exists=' + (Test-Path -LiteralPath $resolved))
Write-Output 'RESULT=PASS'
exit 0
