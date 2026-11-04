#!/usr/bin/env bash
set -u
BASE="D:/Vibe_coding-Project/autoAgentloop/evidence/raw/adapters"; WD="$BASE/work/codex-ab"; mkdir -p "$WD"; cd "$WD" || exit 9
TS=$(date +%Y%m%dT%H%M%S%z)
OLD="C:/Users/chs/AppData/Local/OpenAI/Codex/bin/codex.exe"; NEW="C:/Users/chs/AppData/Local/OpenAI/Codex/bin/22cfb1d302613eae/codex.exe"
echo "CODEX_HOME=${CODEX_HOME:-<unset>}"
for TAG in old:$OLD new:$NEW; do
  NAME=${TAG%%:*}; BIN=${TAG#*:}
  VER=$("$BIN" --version 2>&1 | tr -d "\r")
  J="$BASE/"$TS"_codex-ab_$NAME.jsonl"; E="$BASE/"$TS"_codex-ab_$NAME.stderr.txt"
  echo "===== $NAME : $BIN"; echo "version=$VER"
  START=$(date +%s)
  timeout -k 3 110 "$BIN" exec --skip-git-repo-check --json -C "$WD" "Reply with exactly: PROBE-AB-OK and nothing else." >"$J" 2>"$E"
  C=$?; END=$(date +%s)
  echo "exit_code=$C elapsed_s=$((END-START))"
  echo "thread=$(grep -oE '"thread_id":"[^"]+"' "$J" | head -1)"
  echo "turn_completed=$(grep -c 'turn.completed' "$J")"
  echo "--- assistant text ---"; node -e 'const fs=require("fs");for(const l of fs.readFileSync(process.argv[1],"utf8").split(/\r?\n/)){if(!l.trim())continue;let j;try{j=JSON.parse(l)}catch{continue}if(j.type==="item.completed"&&j.item&&j.item.type==="agent_message")console.log(j.item.text)}' "$J" | head -3
  echo "--- error lines (first 3) ---"; grep -oE '"message":"[^"]{0,220}"' "$J" | head -3
  grep -iE "error|400|401|not supported" "$E" | head -3 | cut -c1-260
done
