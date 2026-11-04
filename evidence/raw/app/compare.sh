#!/bin/bash
cd /d/Vibe_coding-Project/autoAgentloop/evidence/raw/app || exit 2
for f in tests/*.log; do
  name=$(basename "$f" .log)
  b=$(grep -m1 -E "ENOENT|Error:|AssertionError" "$f" | cut -c1-80)
  a=$(grep -m1 -E "ENOENT|Error:|AssertionError" "tests-after/$name.log" 2>/dev/null | cut -c1-80)
  printf "%-20s B: %s\n%-20s A: %s\n" "$name" "$b" "" "$a"
done
