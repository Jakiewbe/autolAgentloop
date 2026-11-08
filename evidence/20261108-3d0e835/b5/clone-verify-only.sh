#!/usr/bin/env bash
# b5/clone-verify-only.sh —— 只做 clone + 校验（push 已成功时用；网络抖动时多次重试，轮换钉住的 IP）
set -u
E=/d/AutoAgentloop/evidence/20261108-3d0e835/b5
OUT=/d/AutoAgentloop/evidence/20261108-3d0e835-clone-verify.txt
PROXY=/d/AutoAgentloop/evidence/20261108-final/b4/ip-proxy.js
C=/d/AutoAgentloop/_night/b-3d0e835-clone1
echo "# clone verify $(date -u +%FT%TZ)" | tee -a "$OUT"
RC=1
for round in 1 2 3 4 5 6; do
  if [ $((round % 2)) -eq 1 ]; then IPS="140.82.112.3,140.82.121.4"; else IPS="140.82.121.4,140.82.112.3"; fi
  PIN_IPS="$IPS" PIN_HOSTS="github.com,codeload.github.com,objects.githubusercontent.com,api.github.com" PROXY_PORT=18080 node "$PROXY" > "$E/ip-proxy.log" 2>&1 &
  PID=$!
  sleep 2
  rm -rf "$C"
  S=$(date +%s)
  git -c http.proxy=http://127.0.0.1:18080 -c https.proxy=http://127.0.0.1:18080 -c http.version=HTTP/1.1 \
      clone --depth 1 --branch b-3d0e835-20261108 https://github.com/Jakiewbe/autolAgentloop.git "$C" > /tmp/clone.txt 2>&1
  RC=$?
  echo "clone_attempt=$round ips=$IPS rc=$RC seconds=$(( $(date +%s) - S ))" | tee -a "$OUT"
  kill $PID 2>/dev/null
  [ $RC -eq 0 ] && break
  tail -2 /tmp/clone.txt | tee -a "$OUT"
  sleep 4
done
if [ $RC -eq 0 ]; then
  echo "HEAD=$(git -C "$C" rev-parse HEAD)" | tee -a "$OUT"
  ( cd "$C" && sha256sum -c evidence/20261108-3d0e835/b5/manifest-full.sha256 > /tmp/m.txt 2>&1; echo "manifest_rc=$? ok=$(grep -c ': OK$' /tmp/m.txt) failed=$(grep -c ': FAILED' /tmp/m.txt)" | tee -a "$OUT" )
  ( cd "$C/evidence" && sha256sum -c 20261108-3d0e835/b5/INDEX.sha256 > /tmp/i.txt 2>&1; echo "index_rc=$? ok=$(grep -c ': OK$' /tmp/i.txt) failed=$(grep -c ': FAILED' /tmp/i.txt)" | tee -a "$OUT"; grep ': FAILED' /tmp/i.txt | head -3 | tee -a "$OUT" )
  echo "index_sha256_in_clone=$(sha256sum "$C/evidence/20261108-3d0e835/b5/INDEX.sha256" | awk '{print $1}')" | tee -a "$OUT"
  echo "report_present=$([ -f "$C/evidence/20261108-3d0e835/B-report.md" ] && echo yes)" | tee -a "$OUT"
else
  echo "clone failed after 6 attempts" | tee -a "$OUT"
fi
echo "done $(date -u +%FT%TZ)" | tee -a "$OUT"
