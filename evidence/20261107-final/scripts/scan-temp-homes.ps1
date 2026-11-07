# Read-only credential scan of leftover test home directories. Nothing is deleted.
$ErrorActionPreference = 'Continue'
$root = $env:TEMP
$dirs = @(Get-ChildItem -LiteralPath $root -Directory -Filter 'agent-autoloop-*' -ErrorAction SilentlyContinue | Sort-Object Name)
Write-Output ('scan_root=' + $root)
Write-Output ('dirs_found=' + $dirs.Count)
$prodHome = Join-Path $env:USERPROFILE '.agent-autoloop'
$prodFiles = @{}
foreach ($n in @('master.key','config.json','hub.db','secrets.env')) {
  $p = Join-Path $prodHome $n
  if (Test-Path -LiteralPath $p) { $prodFiles[$n] = (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash }
}
Write-Output ('production_home=' + $prodHome)
foreach ($k in $prodFiles.Keys | Sort-Object) { Write-Output ('  prod ' + $k + ' sha256=' + $prodFiles[$k]) }
Write-Output ''
$hits = New-Object System.Collections.Generic.List[string]
foreach ($d in $dirs) {
  $files = @(Get-ChildItem -LiteralPath $d.FullName -Recurse -File -Force -ErrorAction SilentlyContinue)
  $total = ($files | Measure-Object Length -Sum).Sum
  Write-Output ('DIR ' + $d.Name + ' files=' + $files.Count + ' bytes=' + [int64]$total + ' mtime=' + $d.LastWriteTime.ToString('yyyy-MM-ddTHH:mm:ss'))
  foreach ($f in $files) {
    $rel = $f.FullName.Substring($d.FullName.Length + 1)
    $flag = ''
    if ($f.Name -match '^(master\.key|hub\.db|config\.json|secrets\.env)$' -or $f.Name -match '\.key$' -or $f.Name -match 'credentials|token') { $flag = ' <- SENSITIVE-NAME' }
    $h = ''
    if ($prodFiles.ContainsKey($f.Name)) {
      $fh = (Get-FileHash -LiteralPath $f.FullName -Algorithm SHA256 -ErrorAction SilentlyContinue).Hash
      if ($fh -eq $prodFiles[$f.Name]) { $h = ' SAME-AS-PRODUCTION' } else { $h = ' differs-from-production' }
    }
    if ($flag -ne '' -or $h -ne '') {
      Write-Output ('  HIT ' + $rel + ' size=' + $f.Length + ' mtime=' + $f.LastWriteTime.ToString('yyyy-MM-ddTHH:mm:ss') + $flag + $h)
      $script:hits.Add($d.Name + '/' + $rel + $flag + $h)
    }
  }
}
Write-Output ''
Write-Output ('hits_total=' + $hits.Count)
if ($hits.Count -eq 0) { Write-Output 'RESULT=0 hits across scanned directories' } else { $hits | ForEach-Object { Write-Output ('HITLIST ' + $_) } }
# also report whether the 8 first-round directories are gone
Write-Output ''
Write-Output '=== first-round (11:30-11:32) directory names, presence check ==='
foreach ($n in @('agent-autoloop-plugin-trouble','agent-autoloop-service-PYoJaH')) {
  $m = @($dirs | Where-Object { $_.Name -like ($n + '*') })
  Write-Output ('  ' + $n + '* -> ' + $m.Count + ' present')
}
