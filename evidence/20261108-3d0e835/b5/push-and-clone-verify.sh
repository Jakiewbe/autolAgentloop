#!/usr/bin/env bash
# b5/push-and-clone-verify.sh —— 网络被掐时的落地：本机 CONNECT 隧道（钉 IP），只对本次命令生效，不改 hosts / 不改全局 git 配置
set -u
E=/d/AutoAgentloop/evidence/20261108-3d0e835/b5
OUT=/d/AutoAgentloop/evidence/20261108-3d0e835-clone-verify.txt
PROXY=/d/AutoAgentloop/evidence/20261108-final/b4/ip-proxy.js
LOG=$E/ip-proxy.log
: > "$OUT"

echo "# push + fresh clone verify $(date -u +%FT%TZ)" | tee -a "$OUT"

PIN_IPS="${PIN_IPS:-140.82.112.3,140.82.121.4}" PIN_HOSTS="github.com,codeload.github.com,objects.githubusercontent.com,api.github.com" PROXY_PORT=18080 node "$PROXY" > "$LOG" 2>&1 &
PID=$!
sleep 2
echo "proxy_pid=$PID" | tee -a "$OUT"
curl -s -o /dev/null -w "via-proxy github.com https=%{http_code} time=%{time_total}\n" --max-time 20 -x http://127.0.0.1:18080 https://github.com/ 2>&1 | tee -a "$OUT"

cd /d/AutoAgentloop/_night/b-repo
S=$(date +%s)
git -c http.proxy=http://127.0.0.1:18080 -c https.proxy=http://127.0.0.1:18080 push origin b-3d0e835-20261108 > "$E/push.log" 2>&1
RC=$?
echo "push rc=$RC seconds=$(( $(date +%s) - S ))" | tee -a "$OUT"
tail -3 "$E/push.log" | tee -a "$OUT"

if [ $RC -eq 0 ]; then
  echo "--- fresh clone (--depth 1, branch b-3d0e835-20261108) ---" | tee -a "$OUT"
  C=/d/AutoAgentloop/_night/b-3d0e835-clone1
  rm -rf "$C"
  S=$(date +%s)
  git -c http.proxy=http://127.0.0.1:18080 -c https.proxy=http://127.0.0.1:18080 clone --depth 1 --branch b-3d0e835-20261108 https://github.com/Jakiewbe/autolAgentloop.git "$C" >> "$OUT" 2>&1
  CRC=$?
  echo "clone rc=$CRC seconds=$(( $(date +%s) - S ))" | tee -a "$OUT"
  if [ $CRC -eq 0 ]; then
    echo "HEAD=$(git -C "$C" rev-parse HEAD)" | tee -a "$OUT"
    echo "--- sha256sum -c manifest-full.sha256 (release tree, 253) ---" | tee -a "$OUT"
    ( cd "$C" && sha256sum -c evidence/20261108-3d0e835/b5/manifest-full.sha256 > /tmp/mcheck.txt 2>&1; echo "manifest_rc=$?" | tee -a "$OUT"; echo "manifest_ok=$(grep -c ': OK$' /tmp/mcheck.txt)" | tee -a "$OUT"; echo "manifest_failed=$(grep -c ': FAILED' /tmp/mcheck.txt)" | tee -a "$OUT"; tail -2 /tmp/mcheck.txt | tee -a "$OUT" )
    echo "--- sha256sum -c INDEX.sha256 (package, 266) ---" | tee -a "$OUT"
    ( cd "$C/evidence" && sha256sum -c 20261108-3d0e835/b5/INDEX.sha256 > /tmp/icheck.txt 2>&1; echo "index_rc=$?" | tee -a "$OUT"; echo "index_ok=$(grep -c ': OK$' /tmp/icheck.txt)" | tee -a "$OUT"; echo "index_failed=$(grep -c ': FAILED' /tmp/icheck.txt)" | tee -a "$OUT"; grep ': FAILED' /tmp/icheck.txt | head -5 | tee -a "$OUT" )
    echo "index_sha256_in_clone=$(sha256sum "$C/evidence/20261108-3d0e835/b5/INDEX.sha256" | awk '{print $1}')" | tee -a "$OUT"
  fi
fi

kill $PID 2>/dev/null
echo "proxy stopped" | tee -a "$OUT"
