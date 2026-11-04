#!/usr/bin/env bash
set -u
BASE="D:/Vibe_coding-Project/autoAgentloop/evidence/raw/adapters"; WD="$BASE/work/codex-ab"; cd "$WD" || exit 9
NEW="C:/Users/chs/AppData/Local/OpenAI/Codex/bin/22cfb1d302613eae/codex.exe"; TS=$(date +%Y%m%dT%H%M%S%z)
TID="$1"; PROMPT="${2:-In your previous turn you replied with one token. Repeat that exact token only.}"
echo "=== codex exec resume <id> --skip-git-repo-check --json ==="
START=$(date +%s)
timeout -k 3 120 "$NEW" exec resume "$TID" --skip-git-repo-check --json "$PROMPT" >"$BASE/"$TS"_codex_resume2.jsonl" 2>"$BASE/"$TS"_codex_resume2.stderr.txt"
C=$?; echo "exit_code=$C elapsed_s=$(( $(date +%s)-START ))"; echo "requested_thread=$TID"
J="$BASE/"$TS"_codex_resume2.jsonl"
echo "returned_thread=$(grep -oE '"thread_id":"[^"]+"' "$J" | head -1)"
echo "turn_completed=$(grep -c turn.completed "$J")"
echo "assistant_text:"; node -e 'const fs=require("fs");for(const l of fs.readFileSync(process.argv[1],"utf8").split(/\r?\n/)){if(!l.trim())continue;let j;try{j=JSON.parse(l)}catch{continue}if(j.type==="item.completed"&&j.item&&j.item.type==="agent_message")console.log(j.item.text)}' "$J" | head -3
echo "usage:"; grep -o '"usage":{[^}]*}' "$J" | tail -1
echo "stderr(non-skill):"; grep -viE "failed to load skill" "$BASE/"$TS"_codex_resume2.stderr.txt" | tr -d "\r" | tail -4 | cut -c1-200
