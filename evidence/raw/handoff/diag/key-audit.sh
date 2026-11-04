#!/usr/bin/env bash
set -u
ROOT=/d/Vibe_coding-Project/autoAgentloop
KF="C:/Users/chs/agent-autoloop-handoff/b-magicbook14.worker.key"
LOG=$ROOT/evidence/raw/handoff/20261105-0145-identity-audit.log
: > "$LOG"
echo "== 1. 身份文件现状 ==" >> "$LOG"
ls -l "$KF" >> "$LOG" 2>&1
echo "size=$(stat -c %s "$KF") bytes  lines=$(wc -l < "$KF")  sha256=$(sha256sum "$KF" | cut -d' ' -f1)" >> "$LOG"
echo "prefix=$(cut -c1-6 "$KF")  total_len=$(tr -d '\r\n' < "$KF" | wc -c)" >> "$LOG"
echo "期望 sha256=a221bdfd990c3fc9d89241a43f6be065a04d3be661988f8e91a78151b0ef695f" >> "$LOG"
echo "== 2. 密钥是否出现在仓库（只报计数，不打印内容）==" >> "$LOG"
KEY=$(tr -d '\r\n' < "$KF")
cd "$ROOT"
HITS=$(grep -rlF "$KEY" --exclude-dir=node_modules --exclude-dir=.git . 2>/dev/null | wc -l)
echo "plaintext_hits=$HITS file(s)" >> "$LOG"
echo "partial_prefix_hits(browser-safe 6 字符前缀 e4Hu8j):" >> "$LOG"
grep -rlF "e4Hu8j" --exclude-dir=node_modules --exclude-dir=.git . 2>/dev/null | head -5 >> "$LOG"
echo "tracked_key_files:" >> "$LOG"
git ls-files | grep -Ei '\.key$|worker.*\.key|credentials|secret' | head -10 >> "$LOG"
echo "tracked_key_files_count=$(git ls-files | grep -Eic '\.key$')" >> "$LOG"
echo "== 3. git 历史里是否有密钥（当前 HEAD 树 + 全部提交 blob 名）==" >> "$LOG"
echo "commits=$(git rev-list --count HEAD)" >> "$LOG"
git ls-tree -r --name-only HEAD | grep -Eic '\.key$' >> "$LOG"
echo "== 4. 交接目标路径规划（B 侧，B 自己定）==" >> "$LOG"
echo "A: $KF（43 字符单行）→ 人工通道 → B: C:\Users\<B账户>\agent-autoloop-handoff\b-magicbook14.worker.key" >> "$LOG"
