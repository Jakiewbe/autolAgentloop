#!/usr/bin/env bash
# 启动/复用 ngrok 隧道把中心 3350 暴露成受保护 HTTPS 地址，并把结果写进 evidence。
set -u
cd /d/Vibe_coding-Project/autoAgentloop
OUT=evidence/raw/handoff/tunnel-info.json
API=http://127.0.0.1:4041/api/tunnels
NGROK="C:/Users/chs/AppData/Local/Microsoft/WinGet/Packages/Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe/ngrok.exe"
LOG=evidence/raw/handoff/$(date +%Y%m%d-%H%M)-ngrok-tunnel.log
: > "$LOG"

url=""
if curl -s --max-time 3 "$API" | grep -q public_url; then
  url=$(curl -s "$API" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);const t=(j.tunnels||[]).find(t=>t.config&&t.config.addr&&t.config.addr.includes("3350"));console.log(t?t.public_url:"");});')
  echo "复用已在跑的隧道" | tee -a "$LOG"
else
  nohup "$NGROK" http 3350 --log stdout >> "$LOG" 2>&1 &
  for _ in $(seq 1 20); do sleep 2; url=$(curl -s --max-time 3 "$API" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const j=JSON.parse(s);const t=(j.tunnels||[]).find(t=>t.config&&t.config.addr&&t.config.addr.includes("3350"));console.log(t?t.public_url:"");}catch(e){console.log("");}});'); [ -n "$url" ] && break; done
  echo "新起隧道" | tee -a "$LOG"
fi
if [ -z "$url" ]; then echo "NO_URL" | tee -a "$LOG"; exit 1; fi
echo "public_url=$url" | tee -a "$LOG"
curl -s -o /dev/null -w "healthz=%{http_code} tls_verify=%{ssl_verify_result}\n" "$url/healthz" | tee -a "$LOG"
curl -s -o /dev/null -w "state_no_token=%{http_code}\n" "$url/v1/state" | tee -a "$LOG"
OWNER=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).owner)' C:/Users/chs/.agent-autoloop/config.json)
curl -s -o /dev/null -w "state_with_owner=%{http_code}\n" -H "Authorization: Bearer $OWNER" "$url/v1/state" | tee -a "$LOG"
BK=$(cat C:/Users/chs/agent-autoloop-handoff/b-magicbook14.worker.key)
curl -s -o /dev/null -w "work_with_b_key=%{http_code}\n" -H "Authorization: Bearer $BK" "$url/v1/work?claim=tunnel-probe-$(date +%s)&wait=0" | tee -a "$LOG"
node -e '
const fs=require("fs");
const info={public_url:process.argv[1],proto:"https",target:"http://127.0.0.1:3350",provider:"ngrok",fidelity:"免费档随机域名，隧道进程重启即换地址；地址以本文件为准",checked_at:new Date().toISOString()};
fs.writeFileSync(process.argv[2],JSON.stringify(info,null,2)+"\n");
console.log("wrote "+process.argv[2]);' "$url" "$OUT" | tee -a "$LOG"
