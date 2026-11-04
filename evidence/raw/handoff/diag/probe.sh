#!/usr/bin/env bash
set -u
ROOT=/d/Vibe_coding-Project/autoAgentloop
LOG=$ROOT/evidence/raw/handoff/20261105-0140-handoff-param-probe.log
: > "$LOG"
PS="powershell -NoProfile -ExecutionPolicy Bypass -File"

cd "$ROOT"
echo "== [1] install-b.mjs 旧参数 --url/--worker/--key ==" >> "$LOG"
node deploy/B-reviewed/install-b.mjs --url http://x --worker b --key k 2>&1 | grep -m1 "Unknown option" >> "$LOG"
echo "exit=${PIPESTATUS[0]}" >> "$LOG"

echo "== [2] install-b.mjs 正确参数名（中心不可达应止于探测）==" >> "$LOG"
printf 'bogus-k\n' > evidence/raw/handoff/diag/bogus.key
node deploy/B-reviewed/install-b.mjs --center-url http://127.0.0.1:1 --worker-key-file evidence/raw/handoff/diag/bogus.key --worker-name b-magicbook14 2>&1 | grep -m1 -E "fetch failed|ECONNREFUSED|中心" >> "$LOG"
echo "exit=${PIPESTATUS[0]}" >> "$LOG"
rm -f evidence/raw/handoff/diag/bogus.key

echo "== [3] verify-b.ps1 在自身目录、显式 -OutputDirectory ==" >> "$LOG"
cd "$ROOT/deploy/B-reviewed"
$PS "./verify-b.ps1" -Agent codex -Executable "C:\Windows\System32\cmd.exe" -Model deepseek-v4.1-flash-1017 -OutputDirectory "C:\Users\chs\AppData\Local\Temp\vb-probe3" 2>&1 | head -3 >> "$LOG"

echo "== [4] verify-b.ps1 省略 -OutputDirectory（默认值求值报错）==" >> "$LOG"
$PS "./verify-b.ps1" -Agent codex -Executable "C:\Windows\System32\cmd.exe" -Model x 2>&1 | head -3 >> "$LOG"

echo "== [5] 显式 -OutputDirectory 时产物 ==" >> "$LOG"
ls -1 "C:/Users/chs/AppData/Local/Temp/vb-probe3" 2>&1 | head -4 >> "$LOG"
