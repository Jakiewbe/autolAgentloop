
$ErrorActionPreference = "Continue"
"=== AweSun/sunlogin state (no secrets) ==="
Get-ChildItem "D:\SunloginClient" -Include *.ini,*.json,*.conf -File -ErrorAction SilentlyContinue | Select-Object Name,Length,LastWriteTime | Format-Table -AutoSize | Out-String
"awesun_guard dir:"; Get-ChildItem "D:\SunloginClient\awesun_guard" -ErrorAction SilentlyContinue | Select-Object -First 6 Name | Format-Table -AutoSize | Out-String
"=== cpolar ==="
$c = Get-Content "C:\Users\chs\.cpolar\cpolar.yml" -ErrorAction SilentlyContinue
"cpolar.yml key names: " + (($c | Select-String -Pattern '^\s*[a-z_]+:' -AllMatches).Matches.Value -join ", ")
Get-ChildItem "C:\Users\chs\.cpolar\logs" -ErrorAction SilentlyContinue | Sort-Object LastWriteTime | Select-Object -Last 2 Name,LastWriteTime | Format-Table -AutoSize | Out-String
"=== candidate projects ==="
$root = "D:\Vibe_coding-Project"
Get-ChildItem $root -Directory | ForEach-Object {
  $p = $_.FullName
  $n = $_.Name
  $git = Test-Path (Join-Path $p ".git")
  $agent = Test-Path (Join-Path $p ".agent")
  $pkg = Test-Path (Join-Path $p "package.json")
  $req = Test-Path (Join-Path $p "requirements.txt")
  $pyproj = Test-Path (Join-Path $p "pyproject.toml")
  $info = "$n | git=$git agent=$agent pkg=$pkg req=$req pyproj=$pyproj"
  if ($git) {
    $b = & git -C $p rev-parse --abbrev-ref HEAD 2>&1
    $dl = (& git -C $p status --porcelain 2>&1 | Measure-Object -Line).Lines
    $info += " | branch=$b dirty=$dl"
  }
  if ($pkg) {
    try { $j = Get-Content (Join-Path $p "package.json") -Raw | ConvertFrom-Json; $info += " | scripts=" + (($j.scripts.PSObject.Properties.Name) -join ",") } catch { $info += " | scripts=<parse-error>" }
  }
  $info
}
