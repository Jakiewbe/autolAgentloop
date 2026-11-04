#!/usr/bin/env bash
set -u
BASE="D:/Vibe_coding-Project/autoAgentloop/evidence/raw/adapters"; WD="$BASE/work/claude-min"
TS=$(date +%Y%m%dT%H%M%S%z)
cd "$WD" || exit 9
for M in "$@"; do
  SAFE=$(echo "$M" | tr -c "a-zA-Z0-9._-" "_")
  OUT="$BASE/"$TS"_claude_p_model-$SAFE.json"; ERRF="$BASE/"$TS"_claude_p_model-$SAFE.stderr.txt"
  echo "===== model=$M ====="
  START=$(date +%s)
  claude -p "Reply with exactly this token and nothing else: PROBE-CL-9Q2" --model "$M" --output-format json >"$OUT" 2>"$ERRF"
  CODE=$?; END=$(date +%s); echo "exit_code=$CODE elapsed_s=$((END-START))"
  node -e 'const fs=require("fs");let j;try{j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"))}catch(e){console.log("PARSE_FAIL",e.message);process.exit(0)};console.log(JSON.stringify({is_error:j.is_error,result:j.result,session_id:j.session_id,modelUsage:j.modelUsage,total_cost_usd:j.total_cost_usd,usage:j.usage&&{input_tokens:j.usage.input_tokens,output_tokens:j.usage.output_tokens,cache_read_input_tokens:j.usage.cache_read_input_tokens,cache_creation_input_tokens:j.usage.cache_creation_input_tokens}}))' "$OUT" | cut -c1-900
done
