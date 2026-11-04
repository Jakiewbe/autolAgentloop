#!/usr/bin/env bash
set -u
ROOT="D:/Vibe_coding-Project/autoAgentloop"
CODEX="C:/Users/chs/AppData/Local/OpenAI/Codex/bin/22cfb1d302613eae/codex.exe"
OUT="$ROOT/evidence/raw/acceptance"
LOG="$OUT/20261104-codex-acceptance.log"
mkdir -p "$OUT"
echo "[$(date +%H:%M:%S)] 启动；等额度恢复（报错称 19:18）" >>"$LOG"
now=$(date +%s); target=$(date -d "19:19" +%s)
if [ "$target" -gt "$now" ]; then sleep $((target-now)); fi
for attempt in 1 2 3; do
  echo "[$(date +%H:%M:%S)] attempt=$attempt" >>"$LOG"
  "$CODEX" exec --skip-git-repo-check -C "$ROOT" --sandbox workspace-write -o "$OUT/codex-final-$attempt.txt" "$(cat "$OUT/prompt.txt")" >>"$LOG" 2>&1
  code=$?
  echo "[$(date +%H:%M:%S)] exit=$code" >>"$LOG"
  [ $code -eq 0 ] && break
  sleep 240
done
echo "[$(date +%H:%M:%S)] 结束" >>"$LOG"
