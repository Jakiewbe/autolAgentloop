#!/usr/bin/env bash
set -u
BASE="D:/Vibe_coding-Project/autoAgentloop/evidence/raw/adapters"; WD="$BASE/work/claude-min"; mkdir -p "$WD"
TS=$(date +%Y%m%dT%H%M%S%z)
OUT="$BASE/"$TS"_claude_p.json"; ERRF="$BASE/"$TS"_claude_p.stderr.txt"; META="$BASE/"$TS"_claude_p.meta.txt"
echo "which claude: $(command -v claude)"
CLAUDE_VER=$(claude --version 2>&1 | tr -d "\r")
echo "claude_version=$CLAUDE_VER"
cd "$WD" || exit 9
START=$(date +%s)
claude -p "Reply with exactly this token and nothing else: PROBE-CL-9Q2" --output-format json >"$OUT" 2>"$ERRF"
CODE=$?; END=$(date +%s); EL=$((END-START))
echo "exit_code=$CODE"; echo "elapsed_s=$EL"; echo "out_bytes=$(wc -c <"$OUT")"; echo "err_bytes=$(wc -c <"$ERRF")"
echo "--- model / usage / session fields from JSON ---"
node -e 'const fs=require("fs");let j;try{j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"))}catch(e){console.log("JSON parse failed:",e.message);process.exit(0)};const pick={};for(const k of ["type","subtype","is_error","result","session_id","total_cost_usd","num_turns","duration_ms","duration_api_ms","modelUsage","usage"])if(k in j)pick[k]=j[k];console.log(JSON.stringify(pick,null,1).slice(0,2500));' "$OUT"
{ echo "tag=claude_p"; echo "started=$TS"; echo "claude_version=$CLAUDE_VER"; echo "exit_code=$CODE"; echo "elapsed_s=$EL"; echo "out=$OUT"; echo "stderr=$ERRF"; } >"$META"
