#!/bin/bash
# Per-file matrix after the Windows changes: every upstream test file alone, hard timeout, so a POSIX-only hang
# cannot hide the rest. Raw output per file under evidence/raw/app/tests-after/.
cd "$(dirname "$0")/../../../app" || exit 2
OUT=../evidence/raw/app/08-test-matrix-after.log
DET=../evidence/raw/app/tests-after
mkdir -p "$DET"
: > "$OUT"
echo "started $(date -Is)" >> "$OUT"
for f in tests/*.test.ts; do
  name=$(basename "$f" .test.ts)
  begin=$(date +%s)
  timeout 90 node --disable-warning=ExperimentalWarning --test --test-force-exit "$f" > "$DET/$name.log" 2>&1
  code=$?
  secs=$(( $(date +%s) - begin ))
  p=$(grep -m1 "^ℹ pass " "$DET/$name.log" | awk '{print $3}')
  fl=$(grep -m1 "^ℹ fail " "$DET/$name.log" | awk '{print $3}')
  echo "FILE $name exit=$code secs=$secs pass=${p:-?} fail=${fl:-?}" >> "$OUT"
done
echo "finished $(date -Is)" >> "$OUT"
