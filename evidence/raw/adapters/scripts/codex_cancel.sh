#!/usr/bin/env bash
set -u
CODEX="C:/Users/chs/AppData/Local/OpenAI/Codex/bin/22cfb1d302613eae/codex.exe"; WD="D:/Vibe_coding-Project/autoAgentloop/evidence/raw/adapters/work/codex-min"; BASE="D:/Vibe_coding-Project/autoAgentloop/evidence/raw/adapters"
TS=$(date +%Y%m%dT%H%M%S%z)
JSONL="$BASE/"$TS"_codex166_cancel.jsonl"
ERRF="$BASE/"$TS"_codex166_cancel.stderr.txt"
cd "$WD" || exit 9
PROMPT="Run exactly this command and wait for it to finish: Start-Sleep -Seconds 150 . Then report that it finished."
"$CODEX" exec --skip-git-repo-check --json -C "$WD" "$PROMPT" >"$JSONL" 2>"$ERRF" &
PID=$!
echo "codex_pid=$PID"; sleep 18
echo "--- is codex still running? ---"; ps -p $PID -o pid,etime,cmd 2>/dev/null | tail -2
echo "--- sleeping pwsh child before kill ---"
wmic process where "name='pwsh.exe'" get processid,parentprocessid,commandline 2>/dev/null | grep -i sleep | cut -c1-160
echo "--- jsonl state before kill (should have no turn.completed) ---"
grep -c "turn.completed" "$JSONL" || true
echo "--- kill tree ---"; taskkill //F //T //PID $PID 2>&1 | head -5
wait $PID; CODE=$?; echo "wait_exit_code=$CODE"
sleep 4
echo "--- after kill: any awk/pwsh sleeping left? ---"
wmic process where "name='pwsh.exe'" get processid,parentprocessid,commandline 2>/dev/null | grep -i "Start-Sleep" | cut -c1-160 || echo "(none: grep found nothing)"
echo "--- final jsonl event types ---"
grep -oE '"type":"[a-z._]+"' "$JSONL" | sort | uniq -c
echo "--- final jsonl tail ---"; tail -2 "$JSONL" | cut -c1-160
{ echo "tag=codex166_cancel2"; echo "started=$TS"; echo "wait_exit_code=$CODE"; echo "jsonl=$JSONL"; } > "$BASE/"$TS"_codex166_cancel.meta.txt"
