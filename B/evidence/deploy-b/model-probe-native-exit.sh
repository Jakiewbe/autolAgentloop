#!/usr/bin/env bash
# model-probe-native-exit.sh - 记录原生退出码（不经管道，避免 PIPESTATUS 混淆）
set -u
cd /d/AutoAgentloop
STAMP=${1:-$(date +%Y%m%dT%H%M%S)}
OUT=evidence/deploy-b
CODEX="C:/Users/19082/AppData/Local/OpenAI/Codex/bin/codex.exe"
CLAUDE="C:/Users/19082/.local/bin/claude.exe"

echo "== codex probe ==" 
CLOG="$OUT/model-codex-$STAMP.log"
{
  echo "# collected_at $(date +%Y-%m-%dT%H:%M:%S%:z)"
  echo "# host $(hostname) user $USERNAME"
  echo "# argv: codex.exe exec --skip-git-repo-check --json -o <last-msg> -m deepseek-v4.1-flash-1017 \"<prompt>\""
  echo "# note: 直接重定向到文件，不经管道；NATIVE_EXIT 为进程自身退出码"
} > "$CLOG"
"$CODEX" exec --skip-git-repo-check --json -o "_probe/codex-last-msg-$STAMP.txt" -m deepseek-v4.1-flash-1017 "只输出一行：B-CODEX-OK" >> "$CLOG" 2>&1
CX=$?
echo "# NATIVE_EXIT=$CX" >> "$CLOG"
echo "codex NATIVE_EXIT=$CX log=$CLOG"
echo "codex last message: $(cat "_probe/codex-last-msg-$STAMP.txt" 2>/dev/null | tr -d "\r")"
echo "codex jsonl events: $(grep -c . "$CLOG")"

echo "== claude probe =="
ALOG="$OUT/model-claude-$STAMP.log"
{
  echo "# collected_at $(date +%Y-%m-%dT%H:%M:%S%:z)"
  echo "# host $(hostname) user $USERNAME"
  echo "# argv: claude.exe -p --model deepseek-v4.1-flash-1017 --output-format json \"<prompt>\""
} > "$ALOG"
"$CLAUDE" -p --model deepseek-v4.1-flash-1017 --output-format json "只输出 JSON：{\"probe\":\"B-MODEL-OK\",\"worker\":\"b-magicbook14\"}" >> "$ALOG" 2>&1
CL=$?
echo "# NATIVE_EXIT=$CL" >> "$ALOG"
echo "claude NATIVE_EXIT=$CL log=$ALOG"
echo "done"