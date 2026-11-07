
set -u
cd /d/AutoAgentloop
EV=evidence/20261108-final/b4
WORK=/d/AutoAgentloop/_night/b4-clone
LOG=$EV/01-clone.txt
{
  echo "## B4 fresh clone retry loop (background) $(date -u +%FT%TZ)"
} >> "$LOG"
start=$(date +%s)
tries=0
ok=0
while [ $tries -lt 30 ]; do
  tries=$((tries+1))
  rm -rf "$WORK"
  echo "### attempt $tries $(date -u +%FT%TZ)" >> "$LOG"
  if git clone --branch b-final-20261107 --single-branch --no-tags https://github.com/Jakiewbe/autolAgentloop.git "$WORK" >> "$LOG" 2>&1; then
    ok=1; echo "### clone ok on attempt $tries" >> "$LOG"; break
  fi
  echo "### clone failed attempt $tries" >> "$LOG"
  sleep 20
done
end=$(date +%s)
{
  echo "### RESULT ok=$ok attempts=$tries elapsed=$((end-start))s"
} >> "$LOG"
if [ $ok -eq 1 ]; then
  {
    echo "### HEAD: $(git -C "$WORK" rev-parse HEAD)"
    echo "### branch: $(git -C "$WORK" rev-parse --abbrev-ref HEAD)"
  } >> "$LOG"
  {
    echo "## sha256sum -c on evidence/20261107-final/INDEX.sha256 $(date -u +%FT%TZ)"
    cd "$WORK/evidence"
    s=$(date +%s)
    sha256sum -c 20261107-final/INDEX.sha256 > /tmp/b4-verify.txt 2>&1
    code=$?
    e=$(date +%s)
    echo "exit=$code elapsed=$((e-s))s"
    echo "ok=$(grep -c ': OK$' /tmp/b4-verify.txt) fail=$(grep -vc ': OK$' /tmp/b4-verify.txt)"
    grep -v ': OK$' /tmp/b4-verify.txt | head -20
    echo "### index lines: $(wc -l < 20261107-final/INDEX.sha256)"
  } > "$EV/02-verify.txt" 2>&1
fi
