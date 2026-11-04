#!/usr/bin/env bash
set -u
BASE="D:/Vibe_coding-Project/autoAgentloop/evidence/raw/adapters"; WD="$BASE/work/opencode-min"; mkdir -p "$WD"; cd "$WD" || exit 9
TS=$(date +%Y%m%dT%H%M%S%z)
MODEL="${1:-opencode/deepseek-v4.1-flash}"; PROMPT="${2:-Reply with exactly: PROBE-OC-A1}"
JSON="$BASE/"$TS"_oc_run1.json"; ERR="$BASE/"$TS"_oc_run1.stderr.txt"
echo "model=$MODEL"
START=$(date +%s)
timeout -k 3 180 opencode run "$PROMPT" --model "$MODEL" --format json >"$JSON" 2>"$ERR"
C=$?; echo "exit_code=$C elapsed_s=$(( $(date +%s)-START ))"; echo "json_bytes=$(wc -c <"$JSON")"
echo "--- sessionID / tokens / cost ---"
node -e 'const fs=require("fs");const t=fs.readFileSync(process.argv[1],"utf8");const ids=new Set();for(const m of t.matchAll(/"sessionID":"([^"]+)"/g))ids.add(m[1]);console.log("sessionID(s):",[...ids].join(",")||"<none>");for(const m of t.matchAll(/"tokens":\{[^}]*\}/g))console.log(m[0]);for(const m of t.matchAll(/"cost":[0-9.]+/g))console.log(m[0]);' "$JSON"
echo "--- text parts ---"
node -e 'const fs=require("fs");for(const l of fs.readFileSync(process.argv[1],"utf8").split(/\r?\n/)){if(!l.trim())continue;let j;try{j=JSON.parse(l)}catch{continue}if(j.type==="text"&&j.part&&j.part.text)console.log("TEXT:",j.part.text.slice(0,120));if(j.type==="step_finish"&&j.part)console.log("STEP_FINISH:",JSON.stringify(j.part).slice(0,300));}' "$JSON" | head -8
echo "--- stderr tail ---"; tr -d "\r" <"$ERR" | tail -3 | cut -c1-200
echo "meta: json=$JSON stderr=$ERR"
