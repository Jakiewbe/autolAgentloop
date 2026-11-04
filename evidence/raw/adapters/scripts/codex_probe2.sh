#!/usr/bin/env bash
# codex_probe2.sh - probe with explicit codex binary path.
# usage: codex_probe2.sh TAG CODEX_BIN MODEL WORKDIR PROMPT
set -u
TAG="$1"; CODEX="$2"; MODEL="$3"; WD="$4"; PROMPT="$5"
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
CODE=$?; END=$(date +%s)
{ echo "tag=$TAG"; echo "codex_bin=$CODEX"; echo "codex_version=$("$CODEX" --version 2>&1 | head -1)";
  echo "started=$(date -d @$START +%Y-%m-%dT%H:%M:%S%z)"; echo "exit_code=$CODE"; echo "elapsed_s=$((END-START))";
  echo "model_arg=$MARG"; echo "workdir=$WD"; echo "jsonl=$JSONL"; echo "stderr=$ERRF"; echo "last_message=$LAST"; } > "$META"
cat "$META"
echo "--- event types ---"; grep -oE '"type":"[a-z._]+"' "$JSONL" | sort | uniq -c
echo "--- thread_id ---"; grep -o '"thread_id":"[^"]*"' "$JSONL" | head -1
echo "--- last message ---"; head -5 "$LAST" 2>/dev/null