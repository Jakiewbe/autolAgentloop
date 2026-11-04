#!/usr/bin/env bash
set -u
cd /d/Vibe_coding-Project/autoAgentloop/app
LOG=/d/Vibe_coding-Project/autoAgentloop/evidence/raw/handoff/20261105-0045-center-restart.log
: > "$LOG"
echo "== typecheck ==" | tee -a "$LOG"
npx tsc -p . 2>&1 | tail -5 | tee -a "$LOG"
echo "typecheck_done" | tee -a "$LOG"
CFG=C:/Users/chs/.agent-autoloop/config.json
OWNER=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).owner)' "$CFG")
echo "== before: pid in up.pid = $(cat C:/Users/chs/.agent-autoloop/up.pid)" | tee -a "$LOG"
taskkill //PID $(cat C:/Users/chs/.agent-autoloop/up.pid) //F 2>&1 | tee -a "$LOG"
sleep 2
nohup node bin/agent-autoloop.ts up >> "$LOG" 2>&1 &
sleep 6
NEW=$(cat C:/Users/chs/.agent-autoloop/up.pid)
echo "new_pid=$NEW" | tee -a "$LOG"
curl -s -o /dev/null -w "healthz=%{http_code}\n" http://127.0.0.1:3350/healthz | tee -a "$LOG"
echo "== agents after restart ==" | tee -a "$LOG"
curl -s -H "Authorization: Bearer $OWNER" http://127.0.0.1:3350/v1/state | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log((j.agents||[]).map(a=>a.id+"|"+a.worker+"|"+a.name).join("\n"));});' | tee -a "$LOG"
echo "== hot reload probe: rename agent, no restart ==" | tee -a "$LOG"
node -e '
const fs=require("fs");const p="C:/Users/chs/.agent-autoloop/rules.json";
const j=JSON.parse(fs.readFileSync(p,"utf8"));
j.agents["b-magicbook14"].name="B / MagicBook14 (reload-probe)";
fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n");
console.log("patched name");'
sleep 3
curl -s -H "Authorization: Bearer $OWNER" http://127.0.0.1:3350/v1/state | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const a=(j.agents||[]).find(x=>x.id==="b-magicbook14");console.log("after_patch="+(a?a.name:"MISSING"));});' | tee -a "$LOG"
node -e '
const fs=require("fs");const p="C:/Users/chs/.agent-autoloop/rules.json";
const j=JSON.parse(fs.readFileSync(p,"utf8"));
j.agents["b-magicbook14"].name="B / MagicBook14";
fs.writeFileSync(p,JSON.stringify(j,null,2)+"\n");
console.log("reverted name");'
sleep 3
curl -s -H "Authorization: Bearer $OWNER" http://127.0.0.1:3350/v1/state | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const a=(j.agents||[]).find(x=>x.id==="b-magicbook14");console.log("after_revert="+(a?a.name:"MISSING"));console.log("runs="+(j.runs||[]).length);});' | tee -a "$LOG"
echo "pid_still=$NEW now=$(cat C:/Users/chs/.agent-autoloop/up.pid)" | tee -a "$LOG"
