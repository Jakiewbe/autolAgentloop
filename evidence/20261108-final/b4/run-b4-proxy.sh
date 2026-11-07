#!/usr/bin/env bash
# B4: 新 clone b-final-20261107 (b12ec1c) -> sha256sum -c 57/57，记录重试次数与耗时
set -u
OUT=/d/AutoAgentloop/evidence/20261108-final/b4
PROXY=http://127.0.0.1:18080
DEST=/d/AutoAgentloop/_night/b4-clone
REPO=https://github.com/Jakiewbe/autolAgentloop.git
: > $OUT/03-clone-via-proxy.txt
rm -rf $DEST
T0=$(date +%s)
ATT=0
OK=0
while [ $ATT -lt 8 ]; do
  ATT=$((ATT+1))
  echo "### attempt $ATT $(date -u +%FT%TZ)" | tee -a $OUT/03-clone-via-proxy.txt
  rm -rf $DEST
  if git -c http.proxy=$PROXY -c https.proxy=$PROXY clone --branch b-final-20261107 $REPO $DEST >> $OUT/03-clone-via-proxy.txt 2>&1; then
    OK=1; echo "### clone OK on attempt $ATT" | tee -a $OUT/03-clone-via-proxy.txt; break
  fi
  echo "### attempt $ATT failed" | tee -a $OUT/03-clone-via-proxy.txt
  sleep 10
done
T1=$(date +%s)
echo "attempts=$ATT ok=$OK elapsed_s=$((T1-T0))" | tee -a $OUT/03-clone-via-proxy.txt
if [ $OK -eq 1 ]; then
  echo "=== HEAD ===" | tee -a $OUT/03-clone-via-proxy.txt
  git -C $DEST rev-parse HEAD | tee -a $OUT/03-clone-via-proxy.txt
  git -C $DEST rev-parse --abbrev-ref HEAD | tee -a $OUT/03-clone-via-proxy.txt
  echo "=== verify ===" | tee -a $OUT/03-clone-via-proxy.txt
  cd $DEST/evidence && sha256sum -c 20261107-final/INDEX.sha256 > $OUT/02-verify.txt 2>&1
  RC=$?
  echo "sha256sum -c rc=$RC" | tee -a $OUT/03-clone-via-proxy.txt
  grep -c ': OK$' $OUT/02-verify.txt | sed 's/^/OK lines: /' | tee -a $OUT/03-clone-via-proxy.txt
  grep -v ': OK$' $OUT/02-verify.txt | head -5 | tee -a $OUT/03-clone-via-proxy.txt
  wc -l < 20261107-final/INDEX.sha256 | sed 's/^/INDEX lines: /' | tee -a $OUT/03-clone-via-proxy.txt
fi
echo "DONE"
