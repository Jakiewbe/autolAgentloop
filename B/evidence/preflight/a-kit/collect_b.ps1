#requires -Version 5.1
<#
  B 机盘点采集脚本 —— DSH 双机部署任务 T3
  用途：在 B 机上只读采集系统/工具链/Agent 通道/凭据存在性/网络/常驻条件/项目，生成 B 本地原始报告并打包回传 A。
  原则：只读；不改系统配置；不记录凭据内容（只记存在性与大小）；不复制项目数据。
  用法（B 机普通 PowerShell，无需管理员）：
      powershell -NoProfile -ExecutionPolicy Bypass -File collect_b.ps1
      powershell -NoProfile -ExecutionPolicy Bypass -File collect_b.ps1 -OutDir D:\evidence_b -Alias B
  产物：<OutDir>\B.md、<OutDir>\raw\*.txt、<OutDir>\B-bundle-<host>-<stamp>.zip 与 .sha256
#>
[CmdletBinding()]
param(
  [string]$OutDir = (Join-Path $env:USERPROFILE ("b_preflight_" + (Get-Date -Format "yyyyMMdd_HHmmss"))),
  [string]$Alias = "B",
  [string[]]$ProjectRoots = @()
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"
$NL = [Environment]::NewLine
$stamp = Get-Date -Format "yyyy-MM-ddTHH:mm:sszzz"
$rawDir = Join-Path $OutDir "raw"
New-Item -ItemType Directory -Force -Path $rawDir | Out-Null

function Save-Raw {
  param([string]$Name, [scriptblock]$Body)
  $path = Join-Path $rawDir ($Name + ".txt")
  $text = ""
  try { $text = (& $Body 2>&1 | Out-String -Width 400) } catch { $text = "COLLECT_ERROR: " + $_.Exception.Message }
  $text = [regex]::Replace($text, "(?i)((?:token|secret|password|passwd|api[_-]?key|authtoken)[\s]*[:=][\s]*)\S+", "$1<redacted>")
  $text = [regex]::Replace($text, "(?i)sk-[A-Za-z0-9_\-]{8,}", "<redacted-key>")
  $text = [regex]::Replace($text, "(?i)(Bearer\s+)[A-Za-z0-9._\-]{8,}", "$1<redacted>")
  Set-Content -Path $path -Value $text -Encoding UTF8
  return $text
}

function Which($name) {
  $c = Get-Command $name -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  return ""
}

function Is-Admin {
  try {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  } catch { return "unknown" }
}

# ---------- 1 系统 ----------
Save-Raw "01-system" {
  $os = Get-CimInstance Win32_OperatingSystem
  "caption=" + $os.Caption + " version=" + $os.Version + " build=" + $os.BuildNumber + " arch=" + $os.OSArchitecture
  "lastboot=" + $os.LastBootUpTime + " uptime_hours=" + [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalHours, 1)
  "ram_total_gb=" + [math]::Round($os.TotalVisibleMemorySize / 1MB, 1) + " ram_free_gb=" + [math]::Round($os.FreePhysicalMemory / 1MB, 1)
  Get-CimInstance Win32_Processor | ForEach-Object { "cpu=" + $_.Name.Trim() + " cores=" + $_.NumberOfCores + " logical=" + $_.NumberOfLogicalProcessors }
  Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | ForEach-Object { "disk=" + $_.DeviceID + " size_gb=" + [math]::Round($_.Size / 1GB, 1) + " free_gb=" + [math]::Round($_.FreeSpace / 1GB, 1) }
  "timezone=" + (Get-TimeZone).Id + " offset=" + (Get-TimeZone).BaseUtcOffset
  "culture=" + (Get-Culture).Name + " ui=" + (Get-UICulture).Name + " codepage=" + [System.Text.Encoding]::Default.CodePage
  "long_paths_enabled=" + (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name LongPathsEnabled -ErrorAction SilentlyContinue).LongPathsEnabled
}

# ---------- 2 工具链 ----------
Save-Raw "02-toolchain" {
  foreach ($n in "node","npm","pnpm","yarn","git","python","py","pwsh","powershell","cmd","code","gh","curl","tar","7z","rg") {
    $p = Which $n
    if ($p) { "which " + $n + " = " + $p } else { "which " + $n + " = (absent)" }
  }
  "--- versions"
  $probes = @(
    @("node", @("--version")),
    @("npm", @("--version")),
    @("pnpm", @("--version")),
    @("git", @("--version")),
    @("python", @("--version")),
    @("pwsh", @("-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"))
  )
  foreach ($probe in $probes) {
    $exe = Which $probe[0]
    if ($exe) {
      try { $v = (& $exe @($probe[1]) 2>&1 | Out-String).Trim(); $probe[0] + " => " + $v } catch { $probe[0] + " => ERROR " + $_.Exception.Message }
    }
  }
  "--- PATH entries"
  $env:PATH -split ";" | Where-Object { $_ } | ForEach-Object { "path: " + $_ }
  "--- PATHEXT"
  $env:PATHEXT
}

# ---------- 3 Agent 入口与版本 ----------
Save-Raw "03-agents" {
  $cands = @(
    @{ n = "codex";    pats = @((Join-Path $env:LOCALAPPDATA "OpenAI\Codex\bin\codex.exe")) },
    @{ n = "opencode"; pats = @((Join-Path $env:USERPROFILE ".opencode\bin\opencode.exe"), (Join-Path $env:LOCALAPPDATA "opencode\opencode.exe")) },
    @{ n = "claude";   pats = @((Join-Path $env:USERPROFILE ".local\bin\claude.exe"), (Join-Path $env:APPDATA "npm\claude.cmd")) },
    @{ n = "dsh";      pats = @((Join-Path $env:LOCALAPPDATA "Programs\dsh\dsh.exe")) }
  )
  foreach ($c in $cands) {
    $onPath = Which $c.n
    if ($onPath) { "agent " + $c.n + ": on_path=" + $onPath } else { "agent " + $c.n + ": on_path=(absent)" }
    foreach ($p in $c.pats) {
      if (Test-Path $p) { "  found: " + $p + " size=" + (Get-Item $p).Length + " mtime=" + (Get-Item $p).LastWriteTime }
    }
    foreach ($p in $c.pats) {
      $dir = Split-Path $p -Parent
      if (Test-Path $dir) {
        Get-ChildItem $dir -Filter "*.exe" -ErrorAction SilentlyContinue | ForEach-Object { "  sibling: " + $_.FullName + " mtime=" + $_.LastWriteTime }
      }
    }
  }
  "--- 用户级 Agent 配置目录（仅名字与大小，不读内容）"
  foreach ($d in (Join-Path $env:USERPROFILE ".codex"), (Join-Path $env:USERPROFILE ".claude"), (Join-Path $env:USERPROFILE ".opencode"), (Join-Path $env:USERPROFILE ".dsh"), (Join-Path $env:USERPROFILE ".agent-autoloop")) {
    if (Test-Path $d) {
      "dir " + $d + " :"
      Get-ChildItem $d -Force -ErrorAction SilentlyContinue | Select-Object -First 25 | ForEach-Object {
        $sz = "<dir>"
        if (-not $_.PSIsContainer) { $sz = [string]$_.Length }
        "  " + $_.Name + " " + $sz
      }
    } else { "dir " + $d + " : (absent)" }
  }
}

# ---------- 4 凭据存在性 ----------
Save-Raw "04-credentials" {
  "--- 只记录是否存在，不读取内容"
  $checks = @(
    (Join-Path $env:USERPROFILE ".dsh\.credentials.yaml"),
    (Join-Path $env:USERPROFILE ".codex\auth.json"),
    (Join-Path $env:USERPROFILE ".claude\.credentials.json"),
    (Join-Path $env:USERPROFILE ".claude.json"),
    (Join-Path $env:USERPROFILE ".opencode\auth.json"),
    (Join-Path $env:USERPROFILE ".agent-autoloop\secrets.env")
  )
  foreach ($p in $checks) {
    if (Test-Path $p) { "exists: " + $p + " size=" + (Get-Item $p).Length + " mtime=" + (Get-Item $p).LastWriteTime } else { "absent: " + $p }
  }
  "--- 环境变量中的凭据类变量名（不输出值）"
  Get-ChildItem Env: | Where-Object { $_.Name -match "(?i)(key|token|secret|password|api)" } | ForEach-Object { "env " + $_.Name + " len=" + $_.Value.Length }
  "--- Windows 凭据管理器条目名（不导出秘密）"
  try { cmdkey /list 2>&1 | Select-String -Pattern "Target:|目标:" | ForEach-Object { $_.Line.Trim() } } catch { "cmdkey_failed" }
}

# ---------- 5 网络 ----------
Save-Raw "05-network" {
  "--- 适配器"
  Get-NetIPConfiguration -ErrorAction SilentlyContinue | ForEach-Object { "if=" + $_.InterfaceIndex + " alias=" + $_.InterfaceAlias + " ipv4=" + (($_.IPv4Address.IPAddress) -join ",") + " gw=" + (($_.IPv4DefaultGateway.NextHop) -join ",") }
  "--- 默认路由"
  Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction SilentlyContinue | ForEach-Object { "gw=" + $_.NextHop + " if=" + $_.InterfaceAlias + " metric=" + $_.RouteMetric }
  "--- DNS"
  Get-DnsClientServerAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.ServerAddresses } | ForEach-Object { $_.InterfaceAlias + ": " + ($_.ServerAddresses -join ",") }
  "--- 私网/VPN/隧道组件（进程）"
  Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.ProcessName -match "(?i)tailscale|zerotier|wireguard|openvpn|clash|mihomo|cpolar|sunlogin|todesk|gameviewer|frpc|ngrok" } | Select-Object ProcessName, Id | Format-Table -AutoSize | Out-String
  "--- 服务"
  Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -match "(?i)Tailscale|ZeroTier|WireGuard|OpenVPN|Sunlogin|ToDesk|cpolar" } | Select-Object Name, Status, StartType | Format-Table -AutoSize | Out-String
  "--- 已安装远程/隧道软件"
  Get-ItemProperty "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*", "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*", "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*" -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -match "(?i)Tailscale|ZeroTier|WireGuard|OpenVPN|向日葵|Sunlogin|ToDesk|cpolar|ngrok|frp" } | Select-Object DisplayName, DisplayVersion | Format-Table -AutoSize | Out-String
  "--- 监听端口（非 loopback）"
  Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalAddress -notmatch "^(127\.|::1$)" } | Sort-Object LocalPort | Select-Object LocalAddress, LocalPort, OwningProcess -Unique | Format-Table -AutoSize | Out-String
  "--- 出网"
  try { $r = Invoke-RestMethod "https://ipinfo.io/json" -TimeoutSec 10; "egress_ip=" + $r.ip + " city=" + $r.city + " org=" + $r.org } catch { "egress_failed: " + $_.Exception.Message }
  "--- 防火墙配置文件"
  Get-NetFirewallProfile -ErrorAction SilentlyContinue | Select-Object Name, Enabled, DefaultInboundAction, DefaultOutboundAction | Format-Table -AutoSize | Out-String
}

# ---------- 6 常驻与自启动能力 ----------
Save-Raw "06-autostart" {
  $startup = [Environment]::GetFolderPath("Startup")
  "startup_dir=" + $startup
  Get-ChildItem $startup -ErrorAction SilentlyContinue | ForEach-Object { "  " + $_.Name }
  foreach ($k in "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run", "HKLM:\Software\Microsoft\Windows\CurrentVersion\Run") {
    "key " + $k
    $item = Get-ItemProperty $k -ErrorAction SilentlyContinue
    if ($item) { $item.PSObject.Properties | Where-Object { $_.Name -notmatch "^PS" } | ForEach-Object { "  " + $_.Name + " = " + $_.Value } }
  }
  "--- 计划任务（agent/dsh/autoloop 关键字）"
  Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -match "(?i)agent|dsh|autoloop|codex" } | Select-Object TaskName, State | Format-Table -AutoSize | Out-String
  "--- 自建服务"
  Get-CimInstance Win32_Service | Where-Object { $_.PathName -match "(?i)agent-autoloop|dsh|autoloop" } | Select-Object Name, State, StartMode, PathName | Format-Table -AutoSize | Out-String
}

# ---------- 7 项目盘点 ----------
Save-Raw "07-projects" {
  $roots = @()
  if ($ProjectRoots.Count -gt 0) { $roots = $roots + $ProjectRoots }
  else {
    foreach ($d in (Get-PSDrive -PSProvider FileSystem | Where-Object { $_.Free -ne $null }).Name) {
      $cand = $d + ":\Vibe_coding-Project"
      if (Test-Path $cand) { $roots = $roots + $cand }
    }
    foreach ($cand in (Join-Path $env:USERPROFILE "Documents\GitHub"), (Join-Path $env:USERPROFILE "source\repos"), "D:\projects", "D:\code") { if (Test-Path $cand) { $roots = $roots + $cand } }
  }
  if ($roots.Count -eq 0) { "no_candidate_roots (请用 -ProjectRoots 显式指定)" }
  foreach ($r in ($roots | Select-Object -Unique)) {
    "=== root " + $r
    Get-ChildItem $r -Directory -ErrorAction SilentlyContinue | Select-Object -First 40 | ForEach-Object {
      $isGit = Test-Path (Join-Path $_.FullName ".git")
      $hasAgent = Test-Path (Join-Path $_.FullName ".agent")
      $files = (Get-ChildItem $_.FullName -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object).Count
      $sum = (Get-ChildItem $_.FullName -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
      $sizeMb = [math]::Round($sum / 1MB, 1)
      "  dir=" + $_.Name + " git=" + $isGit + " agent_ledger=" + $hasAgent + " files=" + $files + " size_mb=" + $sizeMb + " mtime=" + $_.LastWriteTime
      if ($isGit) {
        $head = (git -C $_.FullName rev-parse --short HEAD 2>&1 | Out-String).Trim()
        $br = (git -C $_.FullName branch --show-current 2>&1 | Out-String).Trim()
        $dirty = (git -C $_.FullName status --porcelain 2>&1 | Measure-Object).Count
        "    head=" + $head + " branch=" + $br + " dirty_entries=" + $dirty
      }
    }
  }
}

# ---------- 8 路径/编码兼容探针 ----------
Save-Raw "08-path-probe" {
  $probe = Join-Path $env:TEMP ("中文 目录 probe " + [guid]::NewGuid().ToString("N").Substring(0, 6))
  New-Item -ItemType Directory -Path $probe -Force | Out-Null
  "created=" + $probe + " exists=" + (Test-Path $probe)
  Set-Content -Path (Join-Path $probe "a b.txt") -Value "ok" -Encoding UTF8
  "file_with_space=" + (Test-Path (Join-Path $probe "a b.txt"))
  $cmd = Join-Path $probe "probe.cmd"
  Set-Content -Path $cmd -Value ("@echo off" + $NL + "echo CMD_OK") -Encoding ASCII
  "cmd_out=" + ((& $cmd 2>&1 | Out-String).Trim())
  $ps1 = Join-Path $probe "probe.ps1"
  Set-Content -Path $ps1 -Value "Write-Output PS1_OK" -Encoding UTF8
  $psExe = Which "powershell"
  if ($psExe) { "ps1_out=" + ((& $psExe -NoProfile -ExecutionPolicy Bypass -File $ps1 2>&1 | Out-String).Trim()) }
  Remove-Item $probe -Recurse -Force -ErrorAction SilentlyContinue
  "cleaned=" + (-not (Test-Path $probe))
  "--- 长路径（>260 字符）"
  $deep = Join-Path $env:TEMP ("deep_" + ("x" * 60))
  try {
    New-Item -ItemType Directory -Path $deep -Force | Out-Null
    $sub = Join-Path $deep ("y" * 120)
    New-Item -ItemType Directory -Path $sub -Force | Out-Null
    $p = Join-Path $sub "z.txt"
    Set-Content -Path $p -Value "ok" -Encoding UTF8
    "long_path_len=" + $p.Length + " readable=" + ((Get-Item $p -ErrorAction SilentlyContinue) -ne $null)
    Remove-Item $deep -Recurse -Force -ErrorAction SilentlyContinue
  } catch { "long_path_error=" + $_.Exception.Message }
}

# ---------- 9 汇总 B.md ----------
$osInfo = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
$osLine = "unknown"
if ($osInfo) { $osLine = $osInfo.Caption + " build " + $osInfo.BuildNumber }
function Try-Ver($cmd) { try { return ((& $cmd --version 2>&1 | Out-String).Trim()) } catch { return "(absent)" } }

$md = @()
$md += "# " + $Alias + " 机环境盘点（本地原始报告）"
$md += ""
$md += "> 由 collect_b.ps1 于 " + $stamp + " 在主机 " + $env:COMPUTERNAME + "、账户 " + $env:USERDOMAIN + "\" + $env:USERNAME + " 上实际运行生成。"
$md += "> 报告不含凭据内容；raw/ 保留每节原始输出，供 A 侧逐条核对。"
$md += ""
$md += "## 0 采集元信息"
$md += "- 机器别名：" + $Alias
$md += "- 主机名：" + $env:COMPUTERNAME
$md += "- 运行账户：" + $env:USERDOMAIN + "\" + $env:USERNAME
$md += "- 采集时间：" + $stamp
$md += "- 管理员权限：" + (Is-Admin)
$md += "- 采集目录：" + $OutDir
$md += ""
$md += "## 1 系统"
$md += "- OS：" + $osLine
$md += "- 时区：" + (Get-TimeZone).Id
$md += "- 原始：raw/01-system.txt"
$md += ""
$md += "## 2 工具链"
$md += "- node：" + (Try-Ver "node")
$md += "- pnpm：" + (Try-Ver "pnpm")
$md += "- git：" + (Try-Ver "git")
$md += "- python：" + (Try-Ver "python")
$md += "- 原始：raw/02-toolchain.txt"
$md += ""
$md += "## 3 Agent 入口与版本"
$md += "- codex：" + (Which "codex")
$md += "- opencode：" + (Which "opencode")
$md += "- claude：" + (Which "claude")
$md += "- dsh：" + (Which "dsh")
$md += "- 原始：raw/03-agents.txt（含同目录其它版本二进制、配置目录清单）"
$md += ""
$md += "## 4 凭据存在性（不含内容）"
$md += "- 原始：raw/04-credentials.txt（逐项列出 .dsh/.codex/.claude/.opencode/.agent-autoloop 下凭据文件是否存在、大小、修改时间）"
$md += ""
$md += "## 5 网络"
$md += "- 原始：raw/05-network.txt（适配器、默认路由、DNS、VPN/隧道组件、非 loopback 监听端口、出网 IP、防火墙配置）"
$md += ""
$md += "## 6 常驻与自启动能力"
$md += "- 原始：raw/06-autostart.txt（Startup 目录、Run 键、计划任务、相关服务）"
$md += ""
$md += "## 7 项目盘点"
$md += "- 原始：raw/07-projects.txt（候选根目录下一层的 git 状态、.agent 账本存在性、文件数与体积）"
$md += "- 唯一工作副本判定：由人工补充，本脚本只采集事实。"
$md += ""
$md += "## 8 路径/编码兼容探针"
$md += "- 原始：raw/08-path-probe.txt（中文+空格目录、.cmd/.ps1 入口、长路径）"
$md += ""
$md += "## 9 待人工补充（A 侧判断项）"
$md += "- B 的实际管理目录与运行账户是否符合设计，还是需要另定。"
$md += "- 哪些项目是唯一工作副本；首版禁止两机同时写同一项目。"
$md += "- Codex 后续能否在 B 上直接复验；若只能提供日志，明确标注为「仅日志」。"
$md += "- 与 A 的版本差异结论（回传后由 A 侧填写差异表，对照 evidence/preflight/A.md）。"
$md += ""
$md += "## 10 校验"
$md += "- 报告与 raw/ 一并打包为 zip 并附 sha256；A 侧解压前先校验哈希。"

$mdPath = Join-Path $OutDir "B.md"
Set-Content -Path $mdPath -Value ($md -join $NL) -Encoding UTF8

# ---------- 10 打包 ----------
$zipBase = "B-bundle-" + $env:COMPUTERNAME + "-" + (Get-Date -Format "yyyyMMdd_HHmmss")
$zip = Join-Path $OutDir ($zipBase + ".zip")
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path $mdPath, $rawDir -DestinationPath $zip -CompressionLevel Optimal -ErrorAction Stop
$hash = (Get-FileHash $zip -Algorithm SHA256).Hash
Set-Content -Path ($zip + ".sha256") -Value ($hash + "  " + (Split-Path $zip -Leaf)) -Encoding ASCII

Write-Host ""
Write-Host "=== B 盘点完成 ===" -ForegroundColor Green
Write-Host ("报告：" + $mdPath)
Write-Host ("原始：" + $rawDir)
Write-Host ("打包：" + $zip)
Write-Host ("哈希：" + $hash)
Write-Host ""
Write-Host "回传 A（任选，优先 1）："
Write-Host "  1) 把 zip 与 .sha256 复制到 A 的 evidence/raw/preflight/（U 盘/共享目录/远程桌面拖拽均可）"
Write-Host "  2) 若 A 的隧道已开启，按 A 给出的 URL 上传；A 侧收到后必须核对文件名与 sha256"
Write-Host ""
Write-Host "注意：不要打包任何 secrets 文件；本脚本已按关键字脱敏，raw/ 内也只有目录名与大小。"
