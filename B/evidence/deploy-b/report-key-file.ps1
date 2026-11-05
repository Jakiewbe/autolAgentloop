param(
  [Parameter(Mandatory=$true)][string]$Path,
  [string]$ExpectedSha256 = "a221bdfd990c3fc9d89241a43f6be065a04d3be661988f8e91a78151b0ef695f",
  [int]$ExpectedBytes = 43
)
# 只输出元数据：路径 / 字节数 / SHA256 / 时间 / ACL 属主 / 形态描述 / 与契约的比对结果。绝不输出文件内容。
# KEY_JSON_LIKE 是描述性元数据，不参与判定；判定只看完整 SHA256 与字节数。
$ErrorActionPreference = "Stop"
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
  Write-Output "KEY_FILE=missing"
  Write-Output ("KEY_PATH=" + $Path)
  Write-Output ("KEY_EXPECTED_SHA256=" + $ExpectedSha256)
  Write-Output ("KEY_EXPECTED_BYTES=" + $ExpectedBytes)
  Write-Output "KEY_CONTENT_PRINTED=no"
  exit 2
}
$full = (Resolve-Path -LiteralPath $Path).ProviderPath
$bytes = [System.IO.File]::ReadAllBytes($full)
$sha = [System.Security.Cryptography.SHA256]::Create()
$hash = ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString("x2") }) -join ""
$first = if ($bytes.Length -gt 0) { [char]$bytes[0] } else { "" }
$owner = try { (Get-Acl -LiteralPath $full).Owner } catch { "unknown" }
$shaMatch = ($hash -eq $ExpectedSha256.ToLowerInvariant())
$bytesMatch = ($bytes.Length -eq $ExpectedBytes)
Write-Output "KEY_FILE=present"
Write-Output ("KEY_PATH=" + $full)
Write-Output ("KEY_BYTES=" + $bytes.Length)
Write-Output ("KEY_SHA256=" + $hash)
Write-Output ("KEY_MTIME_UTC=" + ([System.IO.File]::GetLastWriteTimeUtc($full).ToString("o")))
Write-Output ("KEY_ACL_OWNER=" + $owner)
Write-Output ("KEY_JSON_LIKE=" + ($first -eq "{"))
Write-Output "KEY_JSON_LIKE_IS_METADATA_ONLY=yes"
Write-Output ("KEY_LINE_COUNT=" + (($bytes | Where-Object { $_ -eq 10 }).Count))
Write-Output ("KEY_EXPECTED_SHA256=" + $ExpectedSha256)
Write-Output ("KEY_EXPECTED_BYTES=" + $ExpectedBytes)
Write-Output ("KEY_SHA_MATCH=" + $(if ($shaMatch) { "yes" } else { "no" }))
Write-Output ("KEY_BYTES_MATCH=" + $(if ($bytesMatch) { "yes" } else { "no" }))
Write-Output "KEY_CONTENT_PRINTED=no"
if (-not ($shaMatch -and $bytesMatch)) {
  Write-Output "KEY_VERDICT=mismatch-stop"
  exit 3
}
Write-Output "KEY_VERDICT=ok"
exit 0
