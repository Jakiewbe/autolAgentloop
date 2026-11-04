$ErrorActionPreference = "Continue"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$out = "D:\Vibe_coding-Project\autoAgentloop\evidence\raw\preflight\" + $stamp + "-task-env.txt"
$l = @()
$l += "collected_at=" + (Get-Date).ToString("o")
$l += "session=scheduled-task user=" + $env:USERNAME
$l += "interactive=" + [Environment]::UserInteractive
$l += "node_path=" + ((Get-Command node -ErrorAction SilentlyContinue).Source)
$l += "node=" + (& node -v 2>&1)
$l += "claude_path=" + ((Get-Command claude -ErrorAction SilentlyContinue).Source)
$l += "claude=" + (& claude --version 2>&1)
$l += "PATH=" + $env:PATH
Set-Content -Path $out -Value ($l -join [Environment]::NewLine) -Encoding utf8