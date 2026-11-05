#!/usr/bin/env bash
# 独立复核：从 GitHub 重新克隆，按证据自身声明逐项核对（不读本地工作副本，避免自证）
# 用法：recheck-b.sh [TARGET_COMMIT]   默认 origin/b；TARGET 会被 checkout 到干净克隆里
# 说明：日志文件本身无法包含自己的哈希，因此日志记录的是它被提交前的目标提交（off-by-one 已在报告 §18.1 说明）
set -uo pipefail
STAMP=$(date +%Y%m%dT%H%M%S)
TARGET=${1:-origin/b}
LOG=/d/AutoAgentloop/evidence/deploy-b/recheck-$STAMP.log
OUT=/d/AutoAgentloop/_verify/clone-$STAMP
mkdir -p /d/AutoAgentloop/_verify
{
echo "RECHECK_START=$STAMP"
echo "HOST=$(hostname) USER=$USERNAME"
echo "TARGET=$TARGET"
echo '== 1. 重新克隆（不复用本地工作副本）=='
rm -rf "$OUT"
git clone -q https://github.com/Jakiewbe/autolAgentloop.git "$OUT" 2>&1
cd "$OUT" || exit 3
git fetch -q origin b:refs/remotes/origin/b 2>&1
git checkout -q "$TARGET" -- 2>/dev/null || git checkout -q -B recheck "$TARGET"
echo "CLONE_HEAD=$(git rev-parse HEAD)"
echo "ORIGIN_B=$(git rev-parse origin/b)"
echo "MAIN_HEAD=$(git rev-parse origin/main)"
echo "AUTHOR=$(git log -1 --format='%an <%ae>')"
echo "PARENT=$(git rev-parse HEAD^)"
echo '== 2. 分支形态 =='
echo "DIFF_NAMES=$(git diff --name-only origin/main origin/b | wc -l) NON_B=$(git diff --name-only origin/main origin/b | grep -vc '^B/') DIFF_TYPES=$(git diff --name-status origin/main origin/b | awk '{print $1}' | sort -u | tr '\n' ' ')"
echo "MAIN_HAS_B_COMMITS=$(git log origin/main --format='%an' | grep -c 'B Magicbook14-zz')"
echo '== 3. 清单全量校验（逐条输出，不抽样）=='
echo "MANIFEST_LINES=$(wc -l < B/MATERIALS.repo.sha256)"
echo "B_FILES=$(find B -type f | wc -l)"
sha256sum -c B/MATERIALS.repo.sha256 2>&1
echo "MANIFEST_OK=$(sha256sum -c B/MATERIALS.repo.sha256 2>/dev/null | grep -c ': OK$')"
echo "MANIFEST_BAD=$(sha256sum -c B/MATERIALS.repo.sha256 2>/dev/null | grep -vc ': OK$')"
echo '== 4. 报告与状态机哈希一致性 =='
echo "B_MD_SHA_NOW=$(sha256sum B/evidence/deployment/B.md | cut -d' ' -f1)"
echo "B_MD_SHA_IN_MANIFEST=$(grep '  B/evidence/deployment/B.md$' B/MATERIALS.repo.sha256 | cut -d' ' -f1)"
echo "STATE_SHA_NOW=$(sha256sum B/evidence/deploy-b/B-install-state.json | cut -d' ' -f1)"
echo "STATE_SHA_IN_MANIFEST=$(grep '  B/evidence/deploy-b/B-install-state.json$' B/MATERIALS.repo.sha256 | cut -d' ' -f1)"
echo '== 5. 自指检查 =='
echo "SELF_REF_LINES=$(grep -c 'MATERIALS.repo.sha256' B/MATERIALS.repo.sha256 || true)"
echo "SELF_SHA_FIELD=$(grep -c '\"self_sha256\"' B/evidence/deploy-b/B-install-state.json || true)"
echo '== 6. 密钥扫描 =='
echo "SECRET_HITS=$(grep -rIl -E 'oc_s[A-Za-z0-9]{10}|sk-[A-Za-z0-9]{20}|AUTHORIZATION: Bearer [A-Za-z0-9]{10}' B/ 2>/dev/null | wc -l)"
echo "KEYLIKE_FILES=$(find B -iname '*.key' -o -iname 'config.json' -o -iname '*.credentials*' | wc -l)"
echo '== 7. 关键证据存在性 =='
for f in B/evidence/deploy-b/verify-b-pkg/recheck-claude-20261105T102219.log B/evidence/deploy-b/verify-b-pkg/recheck-claude-20261105T102219/model.stderr.log B/evidence/deploy-b/verify-b-pkg/agent_result.mjs B/evidence/deploy-b/install-b-when-ready.ps1 B/evidence/deploy-b/report-key-file.ps1 B/evidence/deploy-b/key-receipt-protocol.md; do
  if [ -f "$f" ]; then echo "EXISTS $(sha256sum "$f" | cut -d' ' -f1) $f"; else echo "MISSING $f"; fi
done
echo '== 8. 失败留档原文（claude 第 1 次） =='
cat B/evidence/deploy-b/verify-b-pkg/recheck-claude-20261105T102219/model.stderr.log 2>/dev/null || echo NO_STDERR_FILE
echo "RECHECK_END=$STAMP"
} 2>&1 | tee "$LOG"
echo "LOG=$LOG"