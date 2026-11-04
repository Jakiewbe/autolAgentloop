param(
    [Parameter(Mandatory=$true)][ValidateSet('claude','codex')][string]$Agent,
    [Parameter(Mandatory=$true)][string]$Executable,
    [Parameter(Mandatory=$true)][string]$Model,
    [string]$SettingsFile,
    [string]$OutputDirectory
)
$ErrorActionPreference = 'Stop'
# 修正版：原 verify-b.ps1 在 param 默认值里用 $PSScriptRoot，本机 PowerShell 5.1 下该变量为空，
# 不显式传 -OutputDirectory 就会在参数绑定阶段报 "Join-Path ... Path 为空字符串"。
# 这里把默认值移到脚本体内，并保留显式传参优先。
$scriptDir = $PSScriptRoot
if (-not $scriptDir -and $MyInvocation.MyCommand.Path) { $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
if (-not $scriptDir) { $scriptDir = (Get-Location).Path }
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $scriptDir 'verification-output' }
if (-not (Test-Path -LiteralPath $Executable -PathType Leaf)) { throw 'Agent执行文件不存在' }
if ($Agent -eq 'claude' -and -not (Test-Path -LiteralPath $SettingsFile -PathType Leaf)) { throw 'Claude私有配置不存在' }
$nodeExe = (Get-Command node.exe -ErrorAction Stop).Source
$validator = Join-Path $scriptDir 'agent_result.mjs'
if (-not (Test-Path -LiteralPath $validator)) { $validator = Join-Path (Split-Path $scriptDir -Parent) 'checks\agent_result.mjs' }
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
$stdout = & $Executable @agentArgs 2> $stderrFile
$agentExit = $LASTEXITCODE
[System.IO.File]::WriteAllText($stdoutFile, ($stdout -join "`n"), (New-Object System.Text.UTF8Encoding($false)))
& $nodeExe $validator --agent $Agent --stdout $stdoutFile --exit-code $agentExit --expected $expected
if ($LASTEXITCODE -ne 0) { throw '模型实测失败，原始输出已保存；不能计为通过' }
Write-Output '模型真实回复校验通过；这不是编辑、命令执行或双机部署验收。'
