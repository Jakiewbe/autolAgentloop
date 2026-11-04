#!/bin/bash
# Checks that are written into evidence/windows-runtime.md, run in one go with the real exit codes.
cd /d/Vibe_coding-Project/autoAgentloop/app || exit 2
LOG=../evidence/raw/app/10-final-checks.log
: > "$LOG"
say() { echo "== $* ==" | tee -a "$LOG"; }

say "typecheck $(date -Is)"
node ./node_modules/typescript/bin/tsc -p . >> "$LOG" 2>&1
echo "tsc exit=$?" | tee -a "$LOG"

say "format (default endOfLine) $(date -Is)"
node ./node_modules/prettier/bin/prettier.cjs --check "**/*.{ts,json,yml}" > /tmp/fmt1.txt 2>&1
echo "prettier default exit=$? files_warned=$(grep -c '^\[warn\]' /tmp/fmt1.txt)" | tee -a "$LOG"

say "format (crlf checkout) $(date -Is)"
node ./node_modules/prettier/bin/prettier.cjs --check --end-of-line crlf "**/*.{ts,json,yml}" >> "$LOG" 2>&1
echo "prettier crlf exit=$?" | tee -a "$LOG"

say "windows runtime tests $(date -Is)"
node --disable-warning=ExperimentalWarning --test --test-force-exit tests/windows-runtime.test.ts > /tmp/wrt.txt 2>&1
echo "windows-runtime exit=$? $(grep -E '^ℹ (pass|fail)' /tmp/wrt.txt | tr '\n' ' ')" | tee -a "$LOG"
cp /tmp/wrt.txt ../evidence/raw/app/11-windows-runtime-final.log

say "residual processes $(date -Is)"
tasklist /FI "IMAGENAME eq node.exe" /FO CSV 2>/dev/null | wc -l | sed 's/^/node.exe lines: /' | tee -a "$LOG"
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -match 'agent-autoloop|runner\\.ts|windows-runtime' } | Select-Object ProcessId,CommandLine | Format-List" >> "$LOG" 2>&1
echo "residual listed above (expect none)" | tee -a "$LOG"

say "startup folder $(date -Is)"
ls "$APPDATA/Microsoft/Windows/Start Menu/Programs/Startup" | tee -a "$LOG"

say "diff stat $(date -Is)"
git diff --stat | tee -a "$LOG"
git status --porcelain | tee -a "$LOG"
