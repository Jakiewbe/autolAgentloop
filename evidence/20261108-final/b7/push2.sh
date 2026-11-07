#!/usr/bin/env bash
set -u
R=/d/AutoAgentloop/_night/b-repo
PROXY=http://127.0.0.1:18080
LOG=/d/AutoAgentloop/evidence/20261108-final/b7/push2.log
: > $LOG
say(){ echo "$@" | tee -a $LOG; }
cd $R
git add -f evidence/20261108-final/b2/run-b8-criterion.log evidence/20261108-final/b4/ip-proxy.log evidence/20261108-final/b6/test-windows.log evidence/20261108-final/b7/package.log
git -c user.name=B -c user.email=b@local commit -q -m "fix(deliver): 证据包内 4 个 .log 被根 .gitignore(*.log) 忽略，-f 补入，使 INDEX 46 条在 clone 后可校验"
say "commit2: $(git rev-parse --short HEAD) $(git log -1 --pretty=%s)"
say "pkg files now: $(git ls-tree -r --name-only HEAD evidence/20261108-final | wc -l)"
git -c http.proxy=$PROXY -c https.proxy=$PROXY push origin b-final-20261108 >> $LOG 2>&1 && say "push2 OK" || say "push2 FAILED"
git -c http.proxy=$PROXY ls-remote origin refs/heads/b-final-20261108 2>&1 | tee -a $LOG
echo ===FRESH-CLONE-VERIFY===
rm -rf /d/AutoAgentloop/_night/b7-clone
T0=$(date +%s)
git -c http.proxy=$PROXY -c https.proxy=$PROXY clone --branch b-final-20261108 --depth 1 https://github.com/Jakiewbe/autolAgentloop.git /d/AutoAgentloop/_night/b7-clone >> $LOG 2>&1 && say "clone OK" || say "clone FAILED"
T1=$(date +%s); say "clone elapsed_s=$((T1-T0))"
cd /d/AutoAgentloop/_night/b7-clone/evidence
sha256sum -c 20261108-final/INDEX.sha256 > /d/AutoAgentloop/_night/b7-verify.txt 2>&1
RC=$?
say "fresh clone verify rc=$RC ok=$(grep -c ': OK$' /d/AutoAgentloop/_night/b7-verify.txt) bad=$(grep -vc ': OK$' /d/AutoAgentloop/_night/b7-verify.txt)"
grep -v ': OK$' /d/AutoAgentloop/_night/b7-verify.txt | head -5 | tee -a $LOG
say "HEAD=$(git -C /d/AutoAgentloop/_night/b7-clone rev-parse HEAD)"
say "INDEX sha256=$(sha256sum 20261108-final/INDEX.sha256 | cut -d' ' -f1)"
cp /d/AutoAgentloop/_night/b7-verify.txt /d/AutoAgentloop/evidence/20261108-final/b7/verify-fresh-clone.txt
echo DONE
