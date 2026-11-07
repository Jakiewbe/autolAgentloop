#!/usr/bin/env bash
set -u
R=/d/AutoAgentloop/_night/b-repo
PROXY=http://127.0.0.1:18080
LOG=/d/AutoAgentloop/evidence/20261108-final/b7/package2.log
: > $LOG
say(){ echo "$@" | tee -a $LOG; }
cd $R/evidence
find 20261108-final -type f ! -name INDEX.sha256 ! -name 'verify-after-index.log' ! -name 'package2.log' | LC_ALL=C sort | xargs sha256sum -b > 20261108-final/INDEX.sha256
say "INDEX lines: $(wc -l < 20261108-final/INDEX.sha256)  sha256: $(sha256sum 20261108-final/INDEX.sha256 | cut -d' ' -f1)"
say "noncompliant: $(grep -vcE '^[0-9a-f]{64} \*20261108-final/' 20261108-final/INDEX.sha256)"
sha256sum -c 20261108-final/INDEX.sha256 > 20261108-final/b7/verify-after-index.log 2>&1
say "verify rc=$? ok=$(grep -c ': OK$' 20261108-final/b7/verify-after-index.log) bad=$(grep -vc ': OK$' 20261108-final/b7/verify-after-index.log)"
cp $LOG /d/AutoAgentloop/evidence/20261108-final/b7/package2.log
cd $R
git add -A evidence/20261108-final
git -c user.name=B -c user.email=b@local commit -q --amend -m "deliver: B-OVERNIGHT-20261108 交付包（B1 溯源对账/B2 F1 修复两方向/B3 ACL 方案乙迁移/B4 clone 57-57/B5 前置清单/B6 test-windows 484 全过），INDEX $(wc -l < evidence/20261108-final/INDEX.sha256) 条"
say "commit: $(git rev-parse HEAD)"
say "pkg files committed: $(git ls-tree -r --name-only HEAD evidence/20261108-final | wc -l)"
say "=== push ==="
T0=$(date +%s)
ATT=0; OK=0
while [ $ATT -lt 5 ]; do
  ATT=$((ATT+1))
  say "attempt $ATT $(date -u +%FT%TZ)"
  if git -c http.proxy=$PROXY -c https.proxy=$PROXY push -u origin b-final-20261108 >> $LOG 2>&1; then OK=1; say "push OK attempt $ATT"; break; fi
  say "push failed attempt $ATT"; sleep 8
done
T1=$(date +%s); say "push attempts=$ATT ok=$OK elapsed_s=$((T1-T0))"
git -c http.proxy=$PROXY ls-remote origin 'refs/heads/b-final-20261108' 2>&1 | tee -a $LOG
echo DONE-PUSH
