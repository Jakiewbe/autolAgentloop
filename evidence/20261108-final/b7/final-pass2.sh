#!/usr/bin/env bash
set -u
R=/d/AutoAgentloop/_night/b-repo
SRC=/d/AutoAgentloop/evidence/20261108-final
PROXY=http://127.0.0.1:18080
LOG=$SRC/b7/final-pass2.log
: > $LOG
say(){ echo "$@" | tee -a $LOG; }
cd $R
rm -rf evidence/20261108-final
cp -a $SRC evidence/20261108-final
cd $R/evidence
find 20261108-final -type f ! -name INDEX.sha256 | LC_ALL=C sort | xargs sha256sum -b > 20261108-final/INDEX.sha256
say "INDEX lines: $(wc -l < 20261108-final/INDEX.sha256)"
say "INDEX sha256: $(sha256sum 20261108-final/INDEX.sha256 | cut -d' ' -f1)"
say "noncompliant: $(grep -vcE '^[0-9a-f]{64} \*20261108-final/' 20261108-final/INDEX.sha256)"
sha256sum -c 20261108-final/INDEX.sha256 > /tmp/lv2.txt 2>&1
say "local verify rc=$? ok=$(grep -c ': OK$' /tmp/lv2.txt) bad=$(grep -vc ': OK$' /tmp/lv2.txt)"
cp $LOG $SRC/b7/final-pass2.log 2>/dev/null || true
cd $R
# 关键：根 .gitignore 的 *.log 会吞证据日志，这里对整包强制纳入
git add -f -A evidence/20261108-final
say "staged files: $(git diff --cached --name-only | wc -l)"
say "staged .log count: $(git diff --cached --name-only | grep -c '\.log$')"
git -c user.name=B -c user.email=b@local commit -q -m "deliver(final2): 证据包整包 -f 纳入（绕开根 .gitignore 的 *.log），INDEX $(wc -l < evidence/20261108-final/INDEX.sha256) 条"
say "commit: $(git rev-parse HEAD)"
git -c http.proxy=$PROXY -c https.proxy=$PROXY push origin b-final-20261108 >> $LOG 2>&1 && say "push OK" || say "push FAILED"
git -c http.proxy=$PROXY ls-remote origin refs/heads/b-final-20261108 2>&1 | tee -a $LOG
echo ===FRESH-CLONE===
rm -rf /d/AutoAgentloop/_night/b7-clone3
T0=$(date +%s)
git -c http.proxy=$PROXY -c https.proxy=$PROXY clone -q --branch b-final-20261108 --depth 1 https://github.com/Jakiewbe/autolAgentloop.git /d/AutoAgentloop/_night/b7-clone3 && say "clone OK" || say "clone FAILED"
T1=$(date +%s); say "clone elapsed_s=$((T1-T0))"
OUT=/d/AutoAgentloop/evidence/20261108-final-INDEX-verify.txt
cd /d/AutoAgentloop/_night/b7-clone3/evidence
{
  echo "# B7 终版 INDEX 新 clone 复验 $(date -u +%FT%TZ)"
  echo "clone: https://github.com/Jakiewbe/autolAgentloop.git --branch b-final-20261108 --depth 1"
  echo "HEAD: $(git -C /d/AutoAgentloop/_night/b7-clone3 rev-parse HEAD)"
  echo "INDEX sha256: $(sha256sum 20261108-final/INDEX.sha256 | cut -d' ' -f1)"
  echo "INDEX lines: $(wc -l < 20261108-final/INDEX.sha256)"
  echo "files in package: $(find 20261108-final -type f | wc -l)"
  echo "--- sha256sum -c ---"
  sha256sum -c 20261108-final/INDEX.sha256 2>&1
  echo "rc=$?"
} > $OUT
say "clone verify: ok=$(grep -c ': OK$' $OUT) bad=$(grep -vc ': OK$' $OUT)"
tail -2 $OUT | tee -a $LOG
echo DONE-FINAL2
