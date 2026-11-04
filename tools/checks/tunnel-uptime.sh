#!/usr/bin/env bash
# 联调窗口保活记录：每 60 秒记一次「本机中心 + 隧道入口」的健康码，用于证明 A 侧在线时段。
# 用法：bash tools/checks/tunnel-uptime.sh [间隔秒] [次数，0=一直跑]
set -u
ROOT=/d/Vibe_coding-Project/autoAgentloop
LOG=$ROOT/evidence/raw/handoff/tunnel-uptime.log
INTERVAL=${1:-60}
ROUNDS=${2:-0}
URL=$(cd "$ROOT" && node -p "JSON.parse(require('fs').readFileSync('evidence/raw/handoff/tunnel-info.json','utf8')).public_url" 2>/dev/null || true)
echo "# uptime watch start $(date -Iseconds) interval=${INTERVAL}s tunnel=${URL:-MISSING}" >> "$LOG"
i=0
while :; do
  i=$((i+1))
  L=$(curl -s -o /dev/null -m 5 -w '%{http_code}' http://127.0.0.1:3350/healthz)
  if [ -n "${URL:-}" ]; then T=$(curl -s -o /dev/null -m 10 -w '%{http_code}' "$URL/healthz"); else T=NA; fi
  P=$(tasklist //FI "IMAGENAME eq ngrok.exe" 2>/dev/null | grep -c ngrok.exe)
  echo "$(date -Iseconds) local=$L tunnel=$T ngrok_proc=$P" >> "$LOG"
  if [ "$ROUNDS" -gt 0 ] && [ "$i" -ge "$ROUNDS" ]; then break; fi
  sleep "$INTERVAL"
done
echo "# uptime watch stop $(date -Iseconds) rounds=$i" >> "$LOG"