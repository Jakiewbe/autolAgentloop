#!/usr/bin/env bash
set -u
CODEX="C:/Users/chs/AppData/Local/OpenAI/Codex/bin/22cfb1d302613eae/codex.exe"; WD="D:/Vibe_coding-Project/autoAgentloop/evidence/raw/adapters/work/codex-min"; BASE="D:/Vibe_coding-Project/autoAgentloop/evidence/raw/adapters"
TS=$(date +%Y%m%dT%H%M%S%z)
JSONL="$BASE/"$TS"_codex166_cancel_sigterm.jsonl"
ERRF="$BASE/"$TS"_codex166_cancel_sigterm.stderr.txt"
cd "$WD" || exit 9
PROMPT="Run exactly this command and wait for it to finish: Start-Sleep -Seconds 120 . Then report that it finished."
START=$(date +%s)
timeout -k 3 20 "$CODEX" exec --skip-git-repo-check --json -C "$WD" "$PROMPT" >"$JSONL" 2>"$ERRF"
CODE=$?; END=$(date +%s)
echo "timeout_wrapped_exit_code=$CODE (124=timeout fired, 137=kill)"
echo "elapsed_s=$((END-START))"
echo "--- turn.completed count (expect 0 if cancelled mid-turn) ---"; grep -c "turn.completed" "$JSONL" || true
echo "--- event types ---"; grep -oE '"type":"[a-z._]+"' "$JSONL" | sort | uniq -c
echo "--- orphan check: pwsh still running Start-Sleep 120 ---"
wmic process where "name='pwsh.exe'" get processid,parentprocessid,commandline 2>/dev/null | grep -i "Start-Sleep" | cut -c1-200 || echo "(none)"
echo "--- orphan check: codex exec still running ---"
wmic process where "name='codex.exe'" get processid,commandline 2>/dev/null | grep -i " exec " | cut -c1-160 || echo "(none)"
{ echo "tag=codex166_cancel_sigterm"; echo "started=$TS"; echo "exit_code=$CODE"; echo "jsonl=$JSONL"; echo "stderr=$ERRF"; } > "$BASE/"$TS"_codex166_cancel_sigterm.meta.txt"
