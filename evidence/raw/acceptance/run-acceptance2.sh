#!/usr/bin/env bash
# 第二轮独立验收：同一台 A、同一个 codex 0.166 二进制；材料换成本轮修复后的。
set -u
ROOT=/d/Vibe_coding-Project/autoAgentloop
CODEX="C:/Users/chs/AppData/Local/OpenAI/Codex/bin/22cfb1d302613eae/codex.exe"
LOG="$ROOT/evidence/raw/acceptance/20261104-codex-acceptance2.log"
OUT="$ROOT/evidence/raw/acceptance/codex-final-2.txt"
: > "$LOG"
echo "== start $(date -Is) ==" >> "$LOG"
"$CODEX" exec --skip-git-repo-check -C "$ROOT" --sandbox workspace-write -o "$OUT" "$(cat "$ROOT/evidence/raw/acceptance/prompt2.txt")" >> "$LOG" 2>&1
echo "exit=$? $(date -Is)" | tee -a "$LOG"
ls -l "$OUT" 2>/dev/null | tee -a "$LOG"
