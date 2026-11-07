param(
  [string]$LogPath = (Join-Path $env:USERPROFILE '.agent-autoloop\logs\up.log'),
  [string]$StateFile = 'D:\AutoAgentloop\evidence\20261107-final\hub-gap-state.txt',
  [string]$OutFile = 'D:\AutoAgentloop\evidence\20261107-final\hub-gap-log.txt',
  [double]$ThresholdMinutes = 10,
  [double]$MaxSilenceMinutes = 5,
  [string]$Now = ''
)
# Local observation only. It never touches config.json, never restarts the tunnel.
# Rule: when the trailing contiguous block of "couldn't reach the hub" lines in up.log
# has been running for >= ThresholdMinutes, append exactly ONE timestamped line.
# One outage = one line: the block start timestamp is the key kept in the state file.
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $LogPath)) { Write-Output ('MISSING log: ' + $LogPath); exit 3 }

$lines = @(Get-Content -LiteralPath $LogPath -Encoding UTF8)
$fail = @()
foreach ($l in $lines) {
  if ($l -match '^\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\s+(.*)$') {
    $ts = $matches[1]; $msg = $matches[2]
    if ($msg -match "couldn't reach the hub") { $fail += ,@($ts, $l) }
  }
}
if ($fail.Count -eq 0) { Write-Output 'RESULT=no reach-failure lines at all'; exit 0 }

# trailing contiguous block: the last logged event must be a reach failure
$lastTs = $null
for ($i = $lines.Count - 1; $i -ge 0; $i--) {
  $l = $lines[$i]
  if ($l -match '^\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\s+') { $lastTs = $matches[1]; break }
}
$lastIsFailure = $false
foreach ($f in $fail) { if ($f[0] -eq $lastTs) { $lastIsFailure = $true } }
if (-not $lastIsFailure) { Write-Output ('RESULT=no ongoing outage (last logged event ' + $lastTs + ' is not a reach failure)'); exit 0 }

if ($Now) { $nowUtc0 = [datetime]::Parse($Now, $null, [Globalization.DateTimeStyles]::AdjustToUniversal) } else { $nowUtc0 = (Get-Date).ToUniversalTime() }
$lastUtc = [datetime]::Parse($lastTs, $null, [Globalization.DateTimeStyles]::AdjustToUniversal)
$silenceMin = [math]::Round(($nowUtc0 - $lastUtc).TotalMinutes, 1)
if ($silenceMin -gt $MaxSilenceMinutes) { Write-Output ('RESULT=no ongoing outage (last failure ' + $lastTs + ' is ' + $silenceMin + ' min old, silent > ' + $MaxSilenceMinutes + ' min; a successful poll logs nothing, so silence means the worker got through or stopped)'); exit 0 }

# Walk back over the trailing run of reach-failure lines. The run ends at either
#  (a) the last logged event that is NOT a reach failure, or
#  (b) a silence longer than MaxSilenceMinutes between two consecutive log lines
#      (a restart or a stopped worker is not a continuing outage).
$blockStart = $lastTs
$count = 0
$prev = $null
for ($i = $lines.Count - 1; $i -ge 0; $i--) {
  $l = $lines[$i]
  if ($l -notmatch '^\s*(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\s+(.*)$') { continue }
  $ts = $matches[1]; $msg = $matches[2]
  if ($msg -notmatch "couldn't reach the hub") { break }
  if ($prev -ne $null) {
    $gapMin = ([datetime]::Parse($prev, $null, [Globalization.DateTimeStyles]::AdjustToUniversal) - [datetime]::Parse($ts, $null, [Globalization.DateTimeStyles]::AdjustToUniversal)).TotalMinutes
    if ($gapMin -gt $MaxSilenceMinutes) { break }
  }
  $blockStart = $ts
  $count++
  $prev = $ts
}

if ($Now) { $nowUtc = [datetime]::Parse($Now, $null, [Globalization.DateTimeStyles]::AdjustToUniversal) } else { $nowUtc = (Get-Date).ToUniversalTime() }
$startUtc = [datetime]::Parse($blockStart, $null, [Globalization.DateTimeStyles]::AdjustToUniversal)
# The measured span is how long the failures actually lasted, not how long ago they started:
# end = the later of (last failure line, now). A worker that recovered and went quiet must not
# keep accruing outage minutes.
$endUtc = $nowUtc
if ($lastUtc -lt $nowUtc) { $endUtc = $lastUtc }
$minutes = [math]::Round(($endUtc - $startUtc).TotalMinutes, 1)

Write-Output ('trailing_block_start_utc=' + $blockStart + ' consecutive_lines=' + $count + ' elapsed_minutes=' + $minutes + ' threshold=' + $ThresholdMinutes)

if ($minutes -lt $ThresholdMinutes) { Write-Output 'RESULT=below threshold, nothing recorded'; exit 0 }

$recorded = ''
if (Test-Path -LiteralPath $StateFile) { $recorded = (Get-Content -LiteralPath $StateFile -Raw).Trim() }
if ($recorded -eq $blockStart) { Write-Output ('RESULT=already recorded for this outage (' + $blockStart + '), no duplicate'); exit 0 }

$stamp = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ss.fffK')
$line = $stamp + ' | gap_start_utc=' + $blockStart + ' | gap_minutes=' + $minutes + ' | consecutive_failure_lines=' + $count + ' | log=' + $LogPath + ' | note=worker has not reached the hub for >= ' + $ThresholdMinutes + ' min; tunnel is A-side (task agent-autoloop-tunnel, 5-min self-heal); no config change made here'
Add-Content -LiteralPath $OutFile -Value $line -Encoding UTF8
Set-Content -LiteralPath $StateFile -Value $blockStart -Encoding UTF8 -NoNewline
Write-Output ('RESULT=recorded -> ' + $OutFile)
Write-Output ('LINE ' + $line)
exit 0
