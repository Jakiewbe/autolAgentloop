#!/bin/bash
cd /d/Vibe_coding-Project/autoAgentloop/evidence/raw/app/tests-after || exit 2
for f in *.log; do
  if grep -q "fail 0" "$f"; then continue; fi
  msg=$(grep -m1 -E "ENOENT|Error:|AssertionError" "$f" | cut -c1-110)
  name=$(basename "$f" .log)
  printf "%-22s %s\n" "$name" "$msg"
done
