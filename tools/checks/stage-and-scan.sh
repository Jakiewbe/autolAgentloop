#!/usr/bin/env bash
set -u
cd /d/Vibe_coding-Project/autoAgentloop
ls -l evidence/raw/app/20261105-0050-targeted-tests.log 2>/dev/null || echo "log missing"
git reset -q
git add deploy/B-reviewed-delivery.zip deploy/agent-autoloop-96b6c9c7-win3.tar.gz \
  evidence/handoff/A-to-B.md evidence/source-baseline.json evidence/manifest.json \
  evidence/raw/handoff \
  evidence/raw/app/windows-changes.patch evidence/raw/app/windows-changes.sha256 \
  evidence/raw/app/windows-bundle.sha256 evidence/raw/app/windows-files.txt \
  evidence/raw/app/20261105-0038-source-baseline-recheck.txt \
  evidence/raw/app/20261105-0050-targeted-tests.log \
  tools/checks/check_source_baseline.py tools/checks/refresh_source_baseline.py \
  tools/checks/restart-center.sh tools/checks/probe-b-key.sh tools/checks/tunnel-up.sh tools/checks/stage-and-scan.sh
echo "== staged =="
git status --porcelain | head -30
echo "== staged secret scan =="
git diff --cached | grep -nE 'sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}' | head -5
echo "scan_done"
