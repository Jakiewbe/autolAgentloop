#!/usr/bin/env bash
set -u
BASE="D:/Vibe_coding-Project/autoAgentloop/evidence/raw/adapters"; WD="$BASE/work/opencode-min"; cd "$WD" || exit 9
TS=$(date +%Y%m%dT%H%M%S%z)
echo "=== 0) 现有 JSON 里是否出现 model 标识 ==="
grep -oE '"(modelID|providerID|model)":"[^"]+"' "$BASE/20261104T180603+0800_oc_run1.json" | sort -u | head -6
echo
echo "=== 1) 文件读写能力（默认权限，非 --dangerously-skip-permissions） ==="
rm -f probe-oc-edit.txt
START=$(date +%s)
timeout -k 3 120 opencode run "Create a file named probe-oc-edit.txt in the current directory containing exactly OC-EDIT-7 (no trailing newline). Then read it back and print its bytes." --model opencode/deepseek-v4.1-flash --format json >"$BASE/"$TS"_oc_edit.json" 2>"$BASE/"$TS"_oc_edit.stderr.txt"
echo "exit_code=$? elapsed_s=$(( $(date +%s)-START ))"
echo "file_exists=$([ -f probe-oc-edit.txt ] && echo yes || echo no) bytes=$( [ -f probe-oc-edit.txt ] && wc -c < probe-oc-edit.txt || echo 0) content=[$( [ -f probe-oc-edit.txt ] && cat probe-oc-edit.txt )]"
node -e 'const fs=require("fs");for(const l of fs.readFileSync(process.argv[1],"utf8").split(/\r?\n/)){if(!l.trim())continue;let j;try{j=JSON.parse(l)}catch{continue}if(j.type==="text"&&j.part&&j.part.text)console.log("TEXT:",j.part.text.slice(0,120));if(j.type==="tool")console.log("TOOL:",JSON.stringify(j.part.state&&{status:j.part.state.status,tool:j.part.tool,title:j.part.state.title}).slice(0,160));if(j.type==="step_finish")console.log("TOKENS:",JSON.stringify(j.part.tokens),"cost="+j.part.cost);}' "$BASE/"$TS"_oc_edit.json" | head -12
echo
echo "=== 2) 取消：3s 后 SIGTERM，检查残留 ==="
START=$(date +%s)
timeout -k 2 3 opencode run "Write a detailed 5000 word essay about compilers." --model opencode/deepseek-v4.1-flash --format json >"$BASE/"$TS"_oc_cancel.json" 2>"$BASE/"$TS"_oc_cancel.stderr.txt"
echo "exit_code=$? elapsed_s=$(( $(date +%s)-START )) (124=timeout fired)"
echo "sessionID_in_partial=$(grep -oE '"sessionID":"[^"]+"' "$BASE/"$TS"_oc_cancel.json" | head -1)"
echo "step_finish_count=$(grep -c step_finish "$BASE/"$TS"_oc_cancel.json" || true)"
sleep 2; echo "--- 残留 opencode/node 进程（命令含 opencode run） ---"
wmic process where "name='node.exe'" get processid,commandline 2>/dev/null | grep -i "opencode" | cut -c1-140 || echo "(none)"
echo "files=$TS"
