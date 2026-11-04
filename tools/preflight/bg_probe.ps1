$ErrorActionPreference = "Continue"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$out = "D:\Vibe_coding-Project\autoAgentloop\evidence\raw\preflight\" + $stamp + "-bg-context.txt"
$lines = @()
$lines += "collected_at=" + (Get-Date).ToString("o")
$lines += "session=background-detached user=" + $env:USERNAME + " interactive=" + [Environment]::UserInteractive
$lines += "node=" + (& node -v 2>&1)
$lines += "npm=" + (& npm -v 2>&1)
$lines += "cwd=" + (Get-Location).Path
$lines += "PATH_has_npm_global=" + [bool]($env:PATH -split ";" | Where-Object { $_ -match "Roaming\\npm" })
$lines += "CODEX_HOME=" + $env:CODEX_HOME
$lines += "HOME=" + $env:USERPROFILE
$lines += "codex_version=" + (& "$env:LOCALAPPDATA\OpenAI\Codex\bin\codex.exe" --version 2>&1)
$lines += "claude_version=" + (& claude --version 2>&1)
$lines += "exit_marker=done"
Set-Content -Path $out -Value ($lines -join [Environment]::NewLine) -Encoding utf8