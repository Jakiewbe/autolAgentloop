#!/usr/bin/env bash
set -u
TAG="$1"; CODEX="$2"; WD="$3"; THREAD="$4"; PROMPT="$5"; BASE="D:/Vibe_coding-Project/autoAgentloop/evidence/raw/adapters"
TS=$(date +%Y%m%dT%H%M%S%z)
JSONL="$BASE/"$TS"_"$TAG".jsonl"
ERRF="$BASE/"$TS"_"$TAG".stderr.txt"
LAST="$BASE/"$TS"_"$TAG".last.txt"
START=$(date +%s)
cd "$WD" || exit 9
"$CODEX" exec resume --skip-git-repo-check --json -o "$LAST" "$THREAD" "$PROMPT" >"$JSONL" 2>"$ERRF"
CODE=$?; END=$(date +%s)
echo "tag=$TAG exit_code=$CODE elapsed_s=$((END-START)) resumed_thread=$THREAD cwd=$(pwd)"
echo "jsonl=$JSONL stderr=$ERRF"
echo "--- thread.started ---"; grep -o '"thread_id":"[^"]*"' "$JSONL" | head -1
echo "--- event types ---"; grep -oE '"type":"[a-z._]+"' "$JSONL" | sort | uniq -c
echo "--- last message ---"; head -8 "$LAST" 2>/dev/null
echo "--- stderr head ---"; head -3 "$ERRF" | cut -c1-300
