param([string]$OutDir = "evidence/raw/preflight")
$ErrorActionPreference = "Continue"
$proj = "D:\Vibe_coding-Project\autoAgentloop"
Set-Location $proj
$abs = Join-Path $proj $OutDir
New-Item -ItemType Directory -Force -Path $abs | Out-Null
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$nl = [Environment]::NewLine
function Cap($name, $block) {
  $p = Join-Path $abs ($ts + "-" + $name + ".txt")
  $sw = [Diagnostics.Stopwatch]::StartNew()
  $out = & $block 2>&1 | Out-String
  $sw.Stop()
  $hdr = "### collected_at=" + (Get-Date).ToString("o") + " machine=DESKTOP-LM7RKI1 alias=A command=" + $name + " elapsed_ms=" + $sw.ElapsedMilliseconds + $nl
  Set-Content -Path $p -Value ($hdr + $out) -Encoding utf8
  Write-Output ("----- " + $name + " -> " + $p + " (" + $out.Length + " chars) -----")
}
Cap "os" {
  Get-CimInstance Win32_OperatingSystem | Select-Object Caption,BuildNumber,Version,OSArchitecture,LastBootUpTime | Format-List | Out-String
  Get-CimInstance Win32_Processor | Select-Object Name,NumberOfCores,NumberOfLogicalProcessors | Format-List | Out-String
}
Cap "hardware-disk" {
  Get-CimInstance Win32_ComputerSystem | Select-Object Manufacturer,Model,TotalPhysicalMemory | Format-List | Out-String
  Get-PSDrive -PSProvider FileSystem | Select-Object Name,@{n="FreeGB";e={[math]::Round($_.Free/1GB,1)}},@{n="UsedGB";e={[math]::Round($_.Used/1GB,1)}} | Format-Table -AutoSize | Out-String
}
Cap "toolchain" {
  "node:  " + (Get-Command node).Source + "  " + (& node -v 2>&1)
  "npm:   " + (Get-Command npm).Source + "  " + (& npm -v 2>&1)
  "pnpm:  " + (Get-Command pnpm).Source + "  " + (& pnpm -v 2>&1)
  "git:   " + (Get-Command git).Source + "  " + (& git --version 2>&1)
  "python default: " + (Get-Command python -ErrorAction SilentlyContinue).Source + "  " + (& python --version 2>&1)
  "python311: " + (& "C:\Users\chs\AppData\Local\Programs\Python\Python311\python.exe" --version 2>&1)
  "where.exe git:"; & where.exe git 2>&1
  "where.exe node:"; & where.exe node 2>&1
}
Cap "agents" {
  "where codex:"; & where.exe codex 2>&1
  Get-ChildItem "$env:LOCALAPPDATA\OpenAI\Codex\bin" -Filter *.exe -ErrorAction SilentlyContinue | Select-Object FullName,Length,LastWriteTime | Format-Table -AutoSize | Out-String
  "codex --version: " + (& "$env:LOCALAPPDATA\OpenAI\Codex\bin\codex.exe" --version 2>&1)
  "claude: " + (Get-Command claude).Source + "  " + (& claude --version 2>&1)
  "opencode: " + (Get-Command opencode).Source + "  " + (& opencode --version 2>&1)
  "dsh on PATH: " + ((Get-Command dsh -ErrorAction SilentlyContinue).Source | Out-String)
  Get-Item "D:\DSH\DeepSeek Harness.exe" -ErrorAction SilentlyContinue | Select-Object FullName,Length,LastWriteTime | Format-List | Out-String
  "DSH version file: " + (Get-Content "D:\DSH\version" -ErrorAction SilentlyContinue)
  "DSH checkout package version: " + ((Get-Content "D:\DSH\resources\app.asar\dsh\package.json" -ErrorAction SilentlyContinue | Select-Object -First 12) -join " | ")
}
Cap "credential-presence" {
  foreach($p in @("$env:USERPROFILE\.codex\config.toml","$env:USERPROFILE\.codex\auth.json","$env:USERPROFILE\.claude","$env:USERPROFILE\.claude.json","$env:USERPROFILE\.config\opencode","$env:USERPROFILE\.local\share\opencode")) { "exists=" + (Test-Path $p) + "  " + $p }
  "env var names present in this session (names+length only):"
  Get-ChildItem Env: | Where-Object { $_.Name -match "ANTHROPIC|OPENAI|DEEPSEEK|API_KEY|TOKEN|BASE_URL|OPENCODE|CODEX" } | ForEach-Object { "  " + $_.Name + " len=" + $_.Value.Length }
  "persisted User env var names:"
  [Environment]::GetEnvironmentVariables("User").Keys | Where-Object { $_ -match "ANTHROPIC|OPENAI|DEEPSEEK|API|TOKEN|BASE_URL|OPENCODE|CODEX|NODE" }
  "codex config.toml structure lines:"
  Select-String -Path "$env:USERPROFILE\.codex\config.toml" -Pattern "^\[|^model|^provider|^approval|^sandbox" -ErrorAction SilentlyContinue | ForEach-Object { $_.Line }
  "opencode config dir:"
  Get-ChildItem "$env:USERPROFILE\.config\opencode" -ErrorAction SilentlyContinue | Select-Object Name,Length | Format-Table -AutoSize | Out-String
}
Cap "background-and-power" {
  "startup folder entries:"; Get-ChildItem "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup" -ErrorAction SilentlyContinue | Select-Object Name | Format-Table -AutoSize | Out-String
  "scheduled tasks outside Microsoft:"; Get-ScheduledTask | Where-Object { $_.TaskPath -notlike "\Microsoft\*" } | Select-Object TaskName,State | Format-Table -AutoSize | Out-String
  "services of interest:"; Get-Service | Where-Object { $_.Name -match "ssh|docker|vmcompute|Lxss|WslService" } | Select-Object Name,Status,StartType | Format-Table -AutoSize | Out-String
  "powercfg /a:"; & powercfg /a 2>&1
  "sleep timeout (AC) :"; & powercfg /q SCHEME_CURRENT SUB_SLEEP 2>&1 | Select-String -Pattern "STANDBYIDLE" -Context 0,4 | Out-String
  "hibernate enabled:"; & powercfg /q SCHEME_CURRENT SUB_SLEEP HIBERNATEIDLE 2>&1 | Select-Object -Last 6 | Out-String
  "last boot: " + (Get-CimInstance Win32_OperatingSystem).LastBootUpTime
}
Cap "candidate-projects" {
  Get-ChildItem "D:\Vibe_coding-Project" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $g = "no-git"; if (Test-Path (Join-Path $_.FullName ".git")) { $g = "git" }
    $a = "no-anchor"; if (Test-Path (Join-Path $_.FullName ".agent\state.json")) { $a = "anchor" }
    $n = (Get-ChildItem $_.FullName -Force -ErrorAction SilentlyContinue | Measure-Object).Count
    $_.Name + " | " + $g + " | " + $a + " | entries=" + $n + " | mtime=" + $_.LastWriteTime
  }
}
Cap "network" {
  Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notlike "127.*"} | Select-Object IPAddress,InterfaceAlias,PrefixLength | Format-Table -AutoSize | Out-String
  "default routes:"; Get-NetRoute -DestinationPrefix "0.0.0.0/0" | Select-Object NextHop,InterfaceAlias,RouteMetric | Format-Table -AutoSize | Out-String
  "neighbors:"; Get-NetNeighbor -AddressFamily IPv4 | Where-Object {$_.State -in @("Reachable","Stale","Delay","Probe")} | Select-Object IPAddress,LinkLayerAddress,InterfaceAlias,State | Format-Table -AutoSize | Out-String
  "listeners (non-loopback):"; Get-NetTCPConnection -State Listen | Where-Object { $_.LocalAddress -notmatch "^(127\.|::1)" } | Select-Object LocalAddress,LocalPort,OwningProcess | Sort-Object LocalPort | Format-Table -AutoSize | Out-String
  "mesh/vpn/remote-desktop services:"; Get-Service | Where-Object { $_.Name -match "tailscale|zerotier|wireguard|openvpn|syncthing|anydesk|todesk|sunlogin|rustdesk" } | Select-Object Name,Status,StartType | Format-Table -AutoSize | Out-String
}
Write-Output ("done ts=" + $ts)