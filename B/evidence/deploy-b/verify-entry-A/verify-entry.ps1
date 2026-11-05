# verify-entry.ps1 - Windows PowerShell 5.1 entry for the B installation wrapper.
# It only validates parameters and forwards them to verify-model.mjs, which runs the
# real model turn, keeps raw bytes and the native exit code, and grades the result
# with the reviewed agent_result.mjs. Parameters match the reviewed verify-b.ps1.
#
# Parameter validation is done here, not by PowerShell binding: a [Parameter(Mandatory)]
# or [ValidateSet] failure exits 1, which cannot be told apart from "graded and failed".
# Missing or invalid input must exit 2 and must not start the model.
[CmdletBinding()]
param(
    [string]$Agent,
    [string]$Executable,
    [string]$Model,
    [string]$SettingsFile,
    [string]$OutputDirectory,
    [string]$Validator
)
$ErrorActionPreference = 'Stop'

function Fail-Input([string]$message) {
    $json = @{ passed = $false; stage = 'input'; invoked = $false; error = $message } | ConvertTo-Json -Compress
    Write-Output $json
    exit 2
}

if ([string]::IsNullOrWhiteSpace($Agent)) { Fail-Input 'missing required parameter -Agent (claude|codex)' }
if ($Agent -ne 'codex' -and $Agent -ne 'claude') { Fail-Input ('-Agent must be claude or codex, got: ' + $Agent) }
if ([string]::IsNullOrWhiteSpace($Executable)) { Fail-Input 'missing required parameter -Executable' }
if ([string]::IsNullOrWhiteSpace($Model)) { Fail-Input 'missing required parameter -Model' }
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $PSScriptRoot 'verification-output'
}
$entry = Join-Path $PSScriptRoot 'verify-model.mjs'
if (-not (Test-Path -LiteralPath $entry -PathType Leaf)) {
    Fail-Input ('missing verify-model.mjs next to verify-entry.ps1: ' + $entry)
}
$node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $node) { Fail-Input 'node.exe not found in PATH (Node 18+ required)' }

$forward = @('--agent', $Agent, '--executable', $Executable, '--model', $Model, '--output-dir', $OutputDirectory)
if (-not [string]::IsNullOrWhiteSpace($SettingsFile)) { $forward += @('--settings-file', $SettingsFile) }
if (-not [string]::IsNullOrWhiteSpace($Validator)) { $forward += @('--validator', $Validator) }

# Native stderr must not be rethrown as a PowerShell terminating error, and the exit
# code must be the executor's own (0/1/2/3/4), not a PowerShell-invented one.
$ErrorActionPreference = 'Continue'
& $node $entry @forward
$code = $LASTEXITCODE
if ($null -eq $code) { $code = 4 }
exit $code
