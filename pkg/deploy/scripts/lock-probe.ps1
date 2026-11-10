param([string]$ListPath)
$paths = Get-Content -Raw -LiteralPath $ListPath | ConvertFrom-Json
$out = @()
foreach ($p in $paths) {
  try { $fs = [System.IO.File]::Open($p, 'Open', 'ReadWrite', 'None'); $fs.Close(); $out += [pscustomobject]@{ path = $p; held = $false } }
  catch { $out += [pscustomobject]@{ path = $p; held = $true } }
}
$out | ConvertTo-Json -Compress -Depth 3