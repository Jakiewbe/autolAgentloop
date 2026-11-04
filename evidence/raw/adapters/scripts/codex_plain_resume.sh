#!/usr/bin/env bash
set -u
BASE="D:/Vibe_coding-Project/autoAgentloop/evidence/raw/adapters"; WD="$BASE/work/codex-ab"; cd "$WD" || exit 9
NEW="C:/Users/chs/AppData/Local/OpenAI/Codex/bin/22cfb1d302613eae/codex.exe"; TS=$(date +%Y%m%dT%H%M%S%z)
TID="$1"
echo "=== A) 纯文本 exec（给 Lead 的可用命令） ==="
START=$(date +%s)
timeout -k 3 110 "$NEW" exec --skip-git-repo-check -C "$WD" "Reply with exactly: PROBE-PLAIN-OK" >"$BASE/"$TS"_codex_plain.stdout.txt" 2>"$BASE/"$TS"_codex_plain.stderr.txt"
C=$?; echo "exit_code=$C elapsed_s=$(( $(date +%s)-START ))"; echo "stdout_tail:"; tail -3 "$BASE/"$TS"_codex_plain.stdout.txt"
echo
echo "=== B) exec resume（无 -C，先 cd 到工作目录） ==="
START=$(date +%s)
timeout -k 3 110 "$NEW" exec resume "$TID" --json "In your previous turn you replied with one token. Repeat that exact token only." >"$BASE/"$TS"_codex_resume.jsonl" 2>"$BASE/"$TS"_codex_resume.stderr.txt"
C2=$?; echo "exit_code=$C2 elapsed_s=$(( $(date +%s)-START ))"; echo "requested_thread=$TID"
echo "returned_thread=$(grep -oE '"thread_id":"[^"]+"' "$BASE/"$TS"_codex_resume.jsonl" | head -1)"
echo "turn_completed=$(grep -c turn.completed "$BASE/"$TS"_codex_resume.jsonl")"
echo "assistant_text:"; node -e 'const fs=require("fs");for(const l of fs.readFileSync(process.argv[1],"utf8").split(/\r?\n/)){if(!l.trim())continue;let j;try{j=JSON.parse(l)}catch{continue}if(j.type==="item.completed"&&j.item&&j.item.type==="agent_message")console.log(j.item.text)}' "$BASE/"$TS"_codex_resume.jsonl" | head -3
echo "usage:"; grep -o '"usage":{[^}]*}' "$BASE/"$TS"_codex_resume.jsonl" | tail -1
