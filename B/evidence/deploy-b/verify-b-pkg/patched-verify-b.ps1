param(
    [Parameter(Mandatory=$true)][ValidateSet('claude','codex')][string]$Agent,
    [Parameter(Mandatory=$true)][string]$Executable,
    [Parameter(Mandatory=$true)][string]$Model,
    [string]$SettingsFile,
    [string]$OutputDirectory = (Join-Path $PSScriptRoot 'verification-output')
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Executable -PathType Leaf)) { throw 'Agent执行文件不存在' }
if ($Agent -eq 'claude' -and -not (Test-Path -LiteralPath $SettingsFile -PathType Leaf)) { throw 'Claude私有配置不存在' }
$nodeExe = (Get-Command node.exe -ErrorAction Stop).Source
$validator = Join-Path $PSScriptRoot 'agent_result.mjs'
if (-not (Test-Path -LiteralPath $validator)) { $validator = Join-Path (Split-Path $PSScriptRoot -Parent) 'checks\agent_result.mjs' }
if (-not (Test-Path -LiteralPath $validator)) { throw '缺少结果校验程序' }
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$expected = 'AGENT_VERIFY_' + [guid]::NewGuid().ToString('N')
$stdoutFile = Join-Path $OutputDirectory 'model.stdout.jsonl'
$stderrFile = Join-Path $OutputDirectory 'model.stderr.log'
if ($Agent -eq 'claude') {
    $agentArgs = @('-p', "Reply with only this token: $expected", '--output-format', 'json', '--model', $Model, '--settings', $SettingsFile, '--strict-mcp-config')
} else {
    $agentArgs = @('exec', '--json', '--skip-git-repo-check', '--sandbox', 'workspace-write', '-m', $Model, "Reply with only this token: $expected")
}
# PATCHED COPY (not the reviewed artifact): 关闭 stdin + Start-Process 取原生退出码
# 原因：Windows PowerShell 下 codex 读取 stdin 会挂起；& 调用把 stderr 当 NativeCommandError，$ErrorActionPreference=Stop 会直接终止脚本。
$stdinFile = Join-Path $OutputDirectory 'stdin-empty.txt'
[System.IO.File]::WriteAllText($stdinFile, '', (New-Object System.Text.UTF8Encoding($false)))
$quotedArgs = @()
foreach ($a in $agentArgs) { if ($a -match '\s') { $quotedArgs += ('"' + $a + '"') } else { $quotedArgs += $a } }
$sp = Start-Process -FilePath $Executable -ArgumentList $quotedArgs -RedirectStandardInput $stdinFile -RedirectStandardOutput $stdoutFile -RedirectStandardError $stderrFile -NoNewWindow -PassThru -Wait
$agentExit = $sp.ExitCode
& $nodeExe $validator --agent $Agent --stdout $stdoutFile --exit-code $agentExit --expected $expected
if ($LASTEXITCODE -ne 0) { throw '模型实测失败，原始输出已保存；不能计为通过' }
Write-Output '模型真实回复校验通过；这不是编辑、命令执行或双机部署验收。'
