param(
  [Parameter(Mandatory=$true)][string]$Path
)
# 只输出「路径 / 字节数 / SHA256 / 时间 / ACL 属主 / 是否为 JSON 形态」，绝不输出密钥内容。
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
  Write-Output ("KEY_FILE=missing")
  Write-Output ("KEY_PATH=" + $Path)
  exit 2
}
$full = (Resolve-Path -LiteralPath $Path).ProviderPath
$bytes = [System.IO.File]::ReadAllBytes($full)
$sha = [System.Security.Cryptography.SHA256]::Create()
$hash = ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join ''
$first = if ($bytes.Length -gt 0) { [char]$bytes[0] } else { '' }
$owner = try { (Get-Acl -LiteralPath $full).Owner } catch { 'unknown' }
Write-Output ("KEY_FILE=present")
Write-Output ("KEY_PATH=" + $full)
Write-Output ("KEY_BYTES=" + $bytes.Length)
Write-Output ("KEY_SHA256=" + $hash)
Write-Output ("KEY_MTIME_UTC=" + ([System.IO.File]::GetLastWriteTimeUtc($full).ToString('o')))
Write-Output ("KEY_ACL_OWNER=" + $owner)
Write-Output ("KEY_JSON_LIKE=" + ($first -eq '{'))
Write-Output ("KEY_LINE_COUNT=" + (($bytes | Where-Object { $_ -eq 10 }).Count + 1))
Write-Output "KEY_CONTENT_PRINTED=no"
exit 0
