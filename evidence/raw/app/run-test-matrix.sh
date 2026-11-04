#!/bin/bash
# Per-file baseline matrix: every upstream test file alone, with a hard timeout, so a POSIX-only hang
# cannot hide the rest of the suite. Raw output per file under evidence/raw/app/tests/.
cd "$(dirname "$0")/../../../app" || exit 2
OUT=../evidence/raw/app/05-test-matrix.log
DET=../evidence/raw/app/tests
mkdir -p "$DET"
: > "$OUT"
started=$(date -Is)
echo "started $started" >> "$OUT"
for f in tests/*.test.ts; do
  name=$(basename "$f" .test.ts)
  begin=$(date +%s)
  timeout 60 node --disable-warning=ExperimentalWarning --test --test-force-exit "$f" > "$DET/$name.log" 2>&1
  code=$?
  secs=$(( $(date +%s) - begin ))
  pass=$(grep -c "^# pass " "$DET/$name.log" 2>/dev/null || true)
  fail=$(grep -c "^# fail " "$DET/$name.log" 2>/dev/null || true)
  p=$(grep -m1 "^# pass " "$DET/$name.log" | awk '{print $3}')
  fl=$(grep -m1 "^# fail " "$DET/$name.log" | awk '{print $3}')
  echo "FILE $name exit=$code secs=$secs pass=${p:-?} fail=${fl:-?}" >> "$OUT"
done
echo "finished $(date -Is)" >> "$OUT"
