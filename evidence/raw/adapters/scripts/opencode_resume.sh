#!/usr/bin/env bash
set -u
BASE="D:/Vibe_coding-Project/autoAgentloop/evidence/raw/adapters"; WD="$BASE/work/opencode-min"; cd "$WD" || exit 9
TS=$(date +%Y%m%dT%H%M%S%z)
SID="$1"; MODEL="opencode/deepseek-v4.1-flash"
echo "=== A) --session $SID 接续 ==="
START=$(date +%s)
timeout -k 3 180 opencode run "In your previous turn you replied with a single token. Repeat that exact token and nothing else." --session "$SID" --model "$MODEL" --format json >"$BASE/"$TS"_oc_resume_session.json" 2>"$BASE/"$TS"_oc_resume_session.stderr.txt"
echo "exit_code=$? elapsed_s=$(( $(date +%s)-START ))"
node -e 'const fs=require("fs");const t=fs.readFileSync(process.argv[1],"utf8");const ids=new Set();for(const m of t.matchAll(/"sessionID":"([^"]+)"/g))ids.add(m[1]);console.log("sessionID(s):",[...ids].join(","));const md=new Set();for(const m of t.matchAll(/"modelID":"([^"]+)"/g))md.add(m[1]);console.log("modelID(s):",[...md].join(",")||"<none>");for(const l of t.split(/\r?\n/)){if(!l.trim())continue;let j;try{j=JSON.parse(l)}catch{continue}if(j.type==="text"&&j.part&&j.part.text)console.log("TEXT:",j.part.text.slice(0,100));if(j.type==="step_finish")console.log("TOKENS:",JSON.stringify(j.part.tokens),"cost="+j.part.cost);}' "$BASE/"$TS"_oc_resume_session.json" | head -8
echo
echo "=== B) --continue 接续（同一目录最近会话） ==="
START=$(date +%s)
timeout -k 3 180 opencode run "State the session id you are running in, if you can see it in context; otherwise reply: PROBE-OC-CONT" --continue --model "$MODEL" --format json >"$BASE/"$TS"_oc_continue.json" 2>"$BASE/"$TS"_oc_continue.stderr.txt"
echo "exit_code=$? elapsed_s=$(( $(date +%s)-START ))"
node -e 'const fs=require("fs");const t=fs.readFileSync(process.argv[1],"utf8");const ids=new Set();for(const m of t.matchAll(/"sessionID":"([^"]+)"/g))ids.add(m[1]);console.log("sessionID(s):",[...ids].join(","));for(const l of t.split(/\r?\n/)){if(!l.trim())continue;let j;try{j=JSON.parse(l)}catch{continue}if(j.type==="text"&&j.part&&j.part.text)console.log("TEXT:",j.part.text.slice(0,100));if(j.type==="step_finish")console.log("TOKENS:",JSON.stringify(j.part.tokens),"cost="+j.part.cost);}' "$BASE/"$TS"_oc_continue.json" | head -8
echo "files: $TS"
