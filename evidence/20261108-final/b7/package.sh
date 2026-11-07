#!/usr/bin/env bash
set -u
R=/d/AutoAgentloop/_night/b-repo
SRC=/d/AutoAgentloop/evidence/20261108-final
E=$SRC/b7
LOG=$E/package.log
: > $LOG
say() { echo "$@" | tee -a $LOG; }

say "### B7 packaging $(date -u +%FT%TZ)"
cd $R || exit 1
say "repo: $(pwd)  origin: $(git remote get-url origin)"
git fetch --prune 2>&1 | tail -2 | tee -a $LOG || true
git checkout -q b-final-20261107 2>&1 | tee -a $LOG
say "base: $(git rev-parse --short HEAD) $(git rev-parse --abbrev-ref HEAD)"
git checkout -q -B b-final-20261108 b-final-20261107 2>&1 | tee -a $LOG
say "new branch: $(git rev-parse --abbrev-ref HEAD) @ $(git rev-parse --short HEAD)"

mkdir -p $R/evidence
rm -rf $R/evidence/20261108-final
cp -a $SRC $R/evidence/20261108-final
say "copied: $(find $R/evidence/20261108-final -type f | wc -l) files, $(du -sh $R/evidence/20261108-final | cut -f1)"

cd $R/evidence
find 20261108-final -type f ! -name INDEX.sha256 ! -name 'verify-after-index.log' | LC_ALL=C sort | xargs sha256sum -b > 20261108-final/INDEX.sha256
say "INDEX lines: $(wc -l < 20261108-final/INDEX.sha256)"
say "INDEX sha256: $(sha256sum 20261108-final/INDEX.sha256 | cut -d' ' -f1)"
say "INDEX format noncompliant lines: $(grep -vcE '^[0-9a-f]{64} \*20261108-final/' 20261108-final/INDEX.sha256)"

sha256sum -c 20261108-final/INDEX.sha256 > 20261108-final/b7/verify-after-index.log 2>&1
RC=$?
OK=$(grep -c ': OK$' 20261108-final/b7/verify-after-index.log)
BAD=$(grep -vc ': OK$' 20261108-final/b7/verify-after-index.log)
say "verify rc=$RC ok=$OK bad=$BAD"

cd $R
git add -A evidence/20261108-final
say "staged: $(git diff --cached --name-only | wc -l) files"
git -c user.name=B -c user.email=b@local commit -q -m "deliver: B-OVERNIGHT-20261108 交付包（B1 溯源对账/B2 F1 修复两方向/B3 ACL 方案乙迁移/B4 clone 57-57/B5 前置清单/B6 test-windows 484 全过），INDEX $(wc -l < evidence/20261108-final/INDEX.sha256) 条" 2>&1 | tee -a $LOG
say "commit: $(git rev-parse --short HEAD) $(git log -1 --pretty=%s | cut -c1-60)"
say "tree files: $(git ls-tree -r --name-only HEAD | wc -l)"
say "DONE-PACKAGE"
