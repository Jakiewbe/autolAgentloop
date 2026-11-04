#!/usr/bin/env bash
# codex_probe.sh - one non-interactive codex exec probe, evidence-logged.
# usage: codex_probe.sh TAG MODEL WORKDIR PROMPT
set -u
TAG="$1"; MODEL="$2"; WD="$3"; PROMPT="$4"
CODEX="C:/Users/chs/AppData/Local/OpenAI/Codex/bin/codex.exe"
TS=$(date +%Y%m%dT%H%M%S%z)
BASE="evidence/raw/adapters"
JSONL="$BASE/"$TS"_"$TAG".jsonl"
ERRF="$BASE/"$TS"_"$TAG".stderr.txt"
LAST="$BASE/"$TS"_"$TAG".last.txt"
META="$BASE/"$TS"_"$TAG".meta.txt"
ARGS=(exec --skip-git-repo-check --json -C "$WD" -o "$LAST")
if [ -n "$MODEL" ]; then ARGS+=(-m "$MODEL"); MARG="$MODEL"; else MARG="<config default>"; fi
START=$(date +%s)
"$CODEX" "${ARGS[@]}" "$PROMPT" >"$JSONL" 2>"$ERRF"
CODE=$?
END=$(date +%s)
{
  echo "tag=$TAG"
  echo "started=$(date -d @$START +%Y-%m-%dT%H:%M:%S%z)"
  echo "exit_code=$CODE"
  echo "elapsed_s=$((END-START))"
  echo "model_arg=$MARG"
  echo "workdir=$WD"
  echo "jsonl=$JSONL"
  echo "stderr=$ERRF"
  echo "last_message=$LAST"
} > "$META"
echo "--- META ---"; cat "$META"
echo "--- event types ---"
grep -oE '"type":"(thread\.started|turn\.started|turn\.completed|error|turn\.failed)"' "$JSONL" | sort | uniq -c
echo "--- thread_id ---"; grep -o '"thread_id":"[^"]*"' "$JSONL" | head -1
echo "--- error messages (300 chars each) ---"
grep -o '"message":"[^"]*' "$JSONL" | head -3 | cut -c1-300
echo "--- usage ---"; grep -o '"usage":{[^}]*}' "$JSONL" | tail -1
echo "--- last message file ---"; head -20 "$LAST" 2>/dev/null
echo "--- stderr bytes: $(wc -c < "$ERRF"); tail 3 ---"; tail -3 "$ERRF" | cut -c1-200
