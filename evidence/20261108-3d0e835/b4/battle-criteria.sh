#!/usr/bin/env bash
set -u
E=/d/AutoAgentloop/evidence/20261108-3d0e835/b4
REL=/d/AutoAgentloop/release/b-3d0e835-20261108
P=/d/AutoAgentloop/evidence/probes
cd /d/AutoAgentloop/work/agent-autoloop

echo "=== GATE1 cancel-tree @ $(date -u +%FT%TZ) ==="
AA_SRC="$REL" timeout 180 node --disable-warning=ExperimentalWarning "$P/b3-gate1-cancel-release.mjs" > $E/gate1-cancel.log 2>&1
echo "GATE1_EXIT=$?" | tee -a $E/gate1-cancel.log
tail -20 $E/gate1-cancel.log

echo
echo "=== GATE2 resume @ $(date -u +%FT%TZ) ==="
AA_SRC="$REL" timeout 180 node --disable-warning=ExperimentalWarning "$P/b3-gate2-resume-release.mjs" > $E/gate2-resume.log 2>&1
echo "GATE2_EXIT=$?" | tee -a $E/gate2-resume.log
tail -25 $E/gate2-resume.log

echo
echo "=== POSITIVE strict judgement (release tree) @ $(date -u +%FT%TZ) ==="
cd "$REL"
timeout 300 node --disable-warning=ExperimentalWarning --test tests/command-adapter.test.ts > $E/strict-positive.log 2>&1
echo "POS_EXIT=$?" | tee -a $E/strict-positive.log
grep -E "^ℹ (tests|pass|fail|skipped)" $E/strict-positive.log

echo
echo "=== NEGATIVE N1 (upstream adapter in a throwaway copy) @ $(date -u +%FT%TZ) ==="
N1=/d/AutoAgentloop/_night/n1-tree
rm -rf $N1 && mkdir -p $N1 && cp -a "$REL"/. $N1/
cd /d/AutoAgentloop/work/agent-autoloop
git show 3d0e835:plugins/command/agent.ts > $N1/plugins/command/agent.ts
echo "upstream_adapter_sha=$(sha256sum $N1/plugins/command/agent.ts | cut -d' ' -f1)"
echo "ours_adapter_sha=$(sha256sum $REL/plugins/command/agent.ts | cut -d' ' -f1)"
cd $N1
timeout 300 node --disable-warning=ExperimentalWarning --test tests/command-adapter.test.ts > $E/strict-negative-n1.log 2>&1
echo "N1_EXIT=$?" | tee -a $E/strict-negative-n1.log
grep -E "^ℹ (tests|pass|fail|skipped)" $E/strict-negative-n1.log
grep -E "^✖" $E/strict-negative-n1.log | head -5
echo "release tree untouched: $(sha256sum $REL/plugins/command/agent.ts | cut -d' ' -f1)"
