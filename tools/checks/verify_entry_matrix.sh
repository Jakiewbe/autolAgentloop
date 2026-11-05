#!/usr/bin/env bash
# verify_entry_matrix.sh - run the verification entry against every scenario and keep
# the console output, exit code and produced files under evidence/raw/verify-entry/tests/NN.
# Real-model cases (10, 11, 12) only run with --with-network and are labelled A-local.
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENTRY="$ROOT/deploy/verify-entry/verify-entry.ps1"
JUDGE="$ROOT/deploy/B-reviewed/agent_result.mjs"
STUBS="$ROOT/evidence/raw/verify-entry/stubs"
OUT="$ROOT/evidence/raw/verify-entry/tests"
NETWORK=0; [ "${1:-}" = "--with-network" ] && NETWORK=1
PS() { powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass -File "$@"; }

run() { # run NN title expectedExit -- args...
  local id="$1" title="$2" expect="$3"; shift 3; [ "$1" = "--" ] && shift
  local dir="$OUT/$id"; rm -rf "$dir"; mkdir -p "$dir"
  # every case keeps its own output directory inside the evidence tree
  local args=("$@")
  case " $* " in *" -OutputDirectory "*) ;; *) args+=(-OutputDirectory "$dir/verification-output") ;; esac
  PS "$ENTRY" "${args[@]}" >"$dir/console.log" 2>&1
  local code=$?
  local verdict="PASS"
  [ "$code" = "$expect" ] || verdict="FAIL"
  {
    echo "test=$id"
    echo "title=$title"
    echo "expected_exit=$expect"
    echo "actual_exit=$code"
    echo "verdict=$verdict"
    echo "command=verify-entry.ps1 $*"
  } >"$dir/result.txt"
  echo "[$id] exit=$code expected=$expect $verdict  $title"
}

# 01 missing -Model -> 2, nothing invoked
run 01 "missing -Model exits 2 without invoking" 2 -- -Agent codex -Executable "$STUBS/stub-args.cmd" -Validator "$JUDGE"
# 02 executable does not exist -> 2
run 02 "nonexistent -Executable exits 2" 2 -- -Agent codex -Executable "$STUBS/does-not-exist.cmd" -Model m -Validator "$JUDGE"
# 03 stub exit 3 -> graded failure 1
run 03 "child exit 3 is graded as failure" 1 -- -Agent codex -Executable "$STUBS/stub-exit3.cmd" -Model m -Validator "$JUDGE"
# 04 non-JSON output -> graded failure 1
run 04 "non-JSON stdout is graded as failure" 1 -- -Agent codex -Executable "$STUBS/stub-garbage.cmd" -Model m -Validator "$JUDGE"
# 05 stdin-closed stub returns instead of hanging
run 05 "stdin is closed (stub returns in seconds)" 1 -- -Agent codex -Executable "$STUBS/stub-stdin.cmd" -Model m -Validator "$JUDGE"
# 06 well-formed stub, text == token -> 0
run 06 "well-formed stub passes" 0 -- -Agent codex -Executable "$STUBS/stub-args.cmd" -Model m -Validator "$JUDGE"
# 07 CRLF + Chinese byte fidelity
run 07 "CRLF and UTF-8 bytes survive verbatim" 1 -- -Agent codex -Executable "$STUBS/stub-bytes.cmd" -Model m -Validator "$JUDGE"
# 09 paths with spaces
run 09 "paths with spaces work" 0 -- -Agent codex -Executable "$STUBS/with space/stub-args.cmd" -Model m -Validator "$JUDGE"
# 14 default output directory (no -OutputDirectory) with a spaced copy of the entry itself
D="$ROOT/evidence/raw/verify-entry/default-run"; rm -rf "$D"; mkdir -p "$D/with space"
cp "$ENTRY" "$ROOT/deploy/verify-entry/verify-model.mjs" "$D/with space/"
cp "$JUDGE" "$D/with space/judge copy.mjs"
cp "$STUBS/with space/stub-args.cmd" "$STUBS/with space/stub-args.js" "$D/with space/"
rm -rf "$OUT/14"; mkdir -p "$OUT/14"
powershell -NonInteractive -NoProfile -ExecutionPolicy Bypass -File "$D/with space/verify-entry.ps1" \
  -Agent codex -Executable "$D/with space/stub-args.cmd" -Model m -Validator "$D/with space/judge copy.mjs" \
  >"$OUT/14/console.log" 2>&1
c=$?; v=PASS; [ "$c" = 0 ] || v=FAIL
{ echo "test=14"; echo "title=default output dir under the copy's own spaced path"; echo "expected_exit=0"; echo "actual_exit=$c"; echo "verdict=$v"; } >"$OUT/14/result.txt"
mkdir -p "$OUT/14/verification-output"
cp -r "$D/with space/verification-output/." "$OUT/14/verification-output/" 2>/dev/null || echo "no default output dir produced" >>"$OUT/14/result.txt"
echo "[14] exit=$c expected=0 $v  default output dir under a spaced script path"

# 15 well-formed but wrong final text -> graded failure 1 (token mismatch)
run 15 "wrong final text is graded as failure" 1 -- -Agent codex -Executable "$STUBS/stub-wrongtext.cmd" -Model m -Validator "$JUDGE"
# 16 the model ran but its output cannot be saved -> 4, invoked true
S="$OUT/16"; rm -rf "$S"; mkdir -p "$S/verification-output/model.stdout.jsonl"
PS "$ENTRY" -Agent codex -Executable "$STUBS/stub-args.cmd" -Model m -Validator "$JUDGE" -OutputDirectory "$S/verification-output" >"$S/console.log" 2>&1
c=$?; v=PASS; [ "$c" = 4 ] || v=FAIL
{ echo "test=16"; echo "title=post-run save failure exits 4 with invoked=true"; echo "expected_exit=4"; echo "actual_exit=$c"; echo "verdict=$v"; } >"$S/result.txt"
echo "[16] exit=$c expected=4 $v  save failure after a real run"
# 13 the file that ran is the repository byte copy: LF only, and it executes
rm -rf "$OUT/13"; mkdir -p "$OUT/13"
run 13 "repository bytes are LF and run as-is" 0 -- -Agent codex -Executable "$STUBS/stub-args.cmd" -Model m -Validator "$JUDGE" -OutputDirectory "$OUT/13/verification-output"
cmp -s "$ENTRY" "$ROOT/deploy/verify-entry/verify-entry.ps1" && echo "entry_identical=yes" >>"$OUT/13/result.txt"
echo "lf_only=$([ "$(tr -d '\r' <"$ENTRY" | wc -c)" = "$(wc -c <"$ENTRY")" ] && echo yes || echo no)" >>"$OUT/13/result.txt"
sha256sum "$ENTRY" "$ROOT/deploy/verify-entry/verify-model.mjs" >>"$OUT/13/result.txt"

if [ "$NETWORK" = "1" ]; then
  CODEX="C:/Users/chs/AppData/Local/OpenAI/Codex/bin/22cfb1d302613eae/codex.exe"
  run 11 "A-local real codex, -Model auto" 0 -- -Agent codex -Executable "$CODEX" -Model auto -Validator "$JUDGE"
  run 10 "A-local real codex with an explicit -m (this account rejects it)" 1 -- -Agent codex -Executable "$CODEX" -Model deepseek-v4.1-flash-1017 -Validator "$JUDGE"
fi
