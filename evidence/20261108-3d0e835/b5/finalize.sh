#!/usr/bin/env bash
# b5/finalize.sh —— 报告改动后重算 INDEX、自校、同步、提交（不 amend 已推历史）
set -u
E=/d/AutoAgentloop/evidence/20261108-3d0e835
R=/d/AutoAgentloop/_night/b-repo
REL=/d/AutoAgentloop/release/b-3d0e835-20261108
PFILES=$(find "$E" -type f | wc -l)
MFILES=$(wc -l < "$E/b5/manifest-full.sha256")
MFPRINT=$(sha256sum "$E/b5/manifest-full.sha256" | awk '{print $1}')
cat > "$E/b5/SEAL.txt" <<SEAL
# SEAL · evidence/20261108-3d0e835
generated_at=$(date -u +%FT%TZ)
release_tree=release/b-3d0e835-20261108
release_commit=f28c7faf86cdada31e70f812716b4a9afe79f6c8 (parent 3d0e8353fd9e5e4d3e45b574806ef6fcd41dba45)
delivery_branch=b-3d0e835-20261108
manifest=b5/manifest-full.sha256
manifest_sha256=$MFPRINT
manifest_lines=$MFILES
package_files=$PFILES
index_lines_expected=$(( PFILES - 1 ))
index_self_sha256=recorded outside the package (D:/AutoAgentloop/evidence/20261108-3d0e835-clone-verify.txt)
manifest_format=<64hex><two spaces><repo-root-relative path>; find -type f, LC_ALL=C sort -z, no directory excluded
index_format=<64hex> *20261108-3d0e835/<path relative to evidence/>; sha256sum -b style
SEAL
( cd /d/AutoAgentloop/evidence && find 20261108-3d0e835 -type f ! -name INDEX.sha256 -print0 | LC_ALL=C sort -z | xargs -0 sha256sum ) \
  | sed -E 's|^([0-9a-f]{64})[ *]{1,2}|\1 *|' > "$E/b5/INDEX.sha256"
echo "package_files=$PFILES index_lines=$(wc -l < "$E/b5/INDEX.sha256")"
( cd /d/AutoAgentloop/evidence && sha256sum -c 20261108-3d0e835/b5/INDEX.sha256 > /tmp/i.txt 2>&1; echo "index_selfcheck_rc=$? ok=$(grep -c ': OK$' /tmp/i.txt) failed=$(grep -c ': FAILED' /tmp/i.txt)" )
( cd "$REL" && sha256sum -c "$E/b5/manifest-full.sha256" > /tmp/m.txt 2>&1; echo "manifest_selfcheck_rc=$? ok=$(grep -c ': OK$' /tmp/m.txt)" )
rm -rf "$R/evidence/20261108-3d0e835"
cp -a "$E" "$R/evidence/20261108-3d0e835"
cd "$R"
git add -f evidence/20261108-3d0e835
git -c user.name=B -c user.email=b@local commit -q --amend -m "deliver(b-3d0e835): 补 pristine windows-admin 对照；报告条数改为引用 SEAL，避免包内自指追尾" && echo "commit=$(git rev-parse HEAD)"
git log --oneline -1
