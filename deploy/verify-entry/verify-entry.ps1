# verify-entry.ps1 - Windows PowerShell 5.1 entry for the B installation wrapper.
# It only validates parameters and forwards them to verify-model.mjs, which runs the
# real model turn, keeps raw bytes and the native exit code, and grades the result
# with the reviewed agent_result.mjs. Parameters match the reviewed verify-b.ps1.
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)][ValidateSet('claude','codex')][string]$Agent,
    [Parameter(Mandatory=$true)][string]$Executable,
    [Parameter(Mandatory=$true)][string]$Model,
    [string]$SettingsFile,
    [string]$OutputDirectory,
    [string]$Validator
)
$ErrorActionPreference = 'Stop'
if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
    $OutputDirectory = Join-Path $PSScriptRoot 'verification-output'
}
$entry = Join-Path $PSScriptRoot 'verify-model.mjs'
if (-not (Test-Path -LiteralPath $entry -PathType Leaf)) {
    Write-Output ('{"passed":false,"stage":"input","error":"missing verify-model.mjs next to verify-entry.ps1: ' + $entry + '"}')
    exit 2
}
$node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $node) {
    Write-Output '{"passed":false,"stage":"input","error":"node.exe not found in PATH (Node 18+ required)"}'
    exit 2
}
$forward = @('--agent', $Agent, '--executable', $Executable, '--model', $Model, '--output-dir', $OutputDirectory)
if (-not [string]::IsNullOrWhiteSpace($SettingsFile)) { $forward += @('--settings-file', $SettingsFile) }
if (-not [string]::IsNullOrWhiteSpace($Validator)) { $forward += @('--validator', $Validator) }
# Native stderr must not be rethrown as a PowerShell terminating error.
$ErrorActionPreference = 'Continue'
& $node $entry @forward
$code = $LASTEXITCODE
if ($null -eq $code) { $code = 3 }
exit $code
