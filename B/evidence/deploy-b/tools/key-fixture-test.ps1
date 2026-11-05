param([string]$Work = (Join-Path $env:TEMP "b-key-fixture"), [string]$Report = "D:\AutoAgentloop\evidence\deploy-b\report-key-file.ps1")
# 非凭据夹具：只验证核对逻辑；夹具内容是明显的示例串，不是任何真实密钥。
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [Text.Encoding]::UTF8
if (Test-Path -LiteralPath $Work) { Remove-Item -LiteralPath $Work -Recurse -Force }
New-Item -ItemType Directory -Path $Work -Force | Out-Null
function New-Fixture([string]$name, [string]$text) {
  $p = Join-Path $Work $name
  [IO.File]::WriteAllText($p, $text, (New-Object Text.UTF8Encoding($false)))
  return $p
}
function Sha256Hex([string]$path) {
  $b = [IO.File]::ReadAllBytes($path)
  $h = [Security.Cryptography.SHA256]::Create().ComputeHash($b)
  return (($h | ForEach-Object { $_.ToString("x2") }) -join "")
}
$raw = New-Fixture "raw-43.txt" "EXAMPLE-NOT-A-REAL-KEY-0123456789abcdefghij"
$json = New-Fixture "json-43.txt" ('{"example":"not-a-real-key"}' + (" " * 15))
$mismatch = "a221bdfd990c3fc9d89241a43f6be065a04d3be661988f8e91a78151b0ef695f"
$results = New-Object "System.Collections.Generic.List[object]"
function Run-Key([string]$name, [string]$path, [string]$expected, [int]$expectedBytes) {
  $out = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $Report -Path $path -ExpectedSha256 $expected -ExpectedBytes $expectedBytes 2>&1
  $code = $LASTEXITCODE
  $txt = ($out | Out-String).Trim()
  $obj = [pscustomobject]@{ case = $name; exit = $code; json_like = ""; sha_match = ""; bytes_match = ""; printed = "" }
  foreach ($line in ($txt -split "`r?`n")) {
    if ($line -match "^KEY_JSON_LIKE=(True|False)$") { $obj.json_like = $Matches[1].ToLowerInvariant() }
    if ($line -match "^KEY_SHA_MATCH=(yes|no)$") { $obj.sha_match = $Matches[1] }
    if ($line -match "^KEY_BYTES_MATCH=(yes|no)$") { $obj.bytes_match = $Matches[1] }
    if ($line -match "^KEY_CONTENT_PRINTED=(yes|no)$") { $obj.printed = $Matches[1] }
  }
  $results.Add($obj)
  Write-Output ("CASE=" + $name + " EXIT=" + $code + " JSON_LIKE=" + $obj.json_like + " SHA_MATCH=" + $obj.sha_match + " BYTES_MATCH=" + $obj.bytes_match + " CONTENT_PRINTED=" + $obj.printed)
}
Run-Key "raw43-match" $raw (Sha256Hex $raw) 43
Run-Key "json43-match" $json (Sha256Hex $json) 43
Run-Key "raw43-hash-mismatch" $raw $mismatch 43
Run-Key "missing" (Join-Path $Work "not-there.key") $mismatch 43
$leaks = @($results | Where-Object { $_.printed -ne "no" })
Write-Output ("CASES=" + $results.Count + " CONTENT_LEAKS=" + $leaks.Count)
$failList = New-Object "System.Collections.Generic.List[string]"
function Check([string]$case, [int]$exit, [string]$json, [string]$sha) {
  $r = $results | Where-Object { $_.case -eq $case } | Select-Object -First 1
  if (-not $r) { $failList.Add("missing-case " + $case); return }
  if ($r.exit -ne $exit) { $failList.Add($case + " exit=" + $r.exit); return }
  if ($json -and $r.json_like -ne $json) { $failList.Add($case + " json_like=" + $r.json_like); return }
  if ($sha -and $r.sha_match -ne $sha) { $failList.Add($case + " sha_match=" + $r.sha_match); return }
  Write-Output ("CHECK_OK " + $case)
}
Check "raw43-match" 0 "false" "yes"
Check "json43-match" 0 "true" "yes"
Check "raw43-hash-mismatch" 3 "" "no"
Check "missing" 2 "" ""
foreach ($f in $failList) { Write-Output ("CHECK_FAIL " + $f) }
Write-Output ("RESULT=" + $(if ($failList.Count -eq 0) { "PASS" } else { "FAIL" }) + " FAILURES=" + $failList.Count)
if ($failList.Count -ne 0) { exit 1 }
exit 0
