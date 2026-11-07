
set -u
cd /d/AutoAgentloop
EV=evidence/20261108-final/b4
mkdir -p "$EV"
WORK=/d/AutoAgentloop/_night/b4-clone
rm -rf "$WORK"
{
  echo "## B4 fresh clone + verify $(date -u +%FT%TZ)"
  start=$(date +%s)
  tries=0
  until [ $tries -ge 5 ]; do
    tries=$((tries+1))
    echo "### attempt $tries $(date -u +%FT%TZ)"
    if git clone --branch b-final-20261107 --single-branch --no-tags https://github.com/Jakiewbe/autolAgentloop.git "$WORK" 2>&1; then
      echo "### clone ok on attempt $tries"; break
    fi
    echo "### clone failed attempt $tries"
    rm -rf "$WORK"
    sleep 5
  done
  end=$(date +%s)
  echo "### clone attempts=$tries elapsed=$((end-start))s"
  echo "### HEAD:"; git -C "$WORK" rev-parse HEAD
  echo "### branch:"; git -C "$WORK" rev-parse --abbrev-ref HEAD
} > "$EV/01-clone.txt" 2>&1
cat "$EV/01-clone.txt"

{
  echo "## sha256sum -c on evidence/20261107-final/INDEX.sha256 $(date -u +%FT%TZ)"
  cd "$WORK/evidence"
  start=$(date +%s)
  sha256sum -c 20261107-final/INDEX.sha256 > /tmp/b4-verify.txt 2>&1
  code=$?
  end=$(date +%s)
  echo "exit=$code elapsed=$((end-start))s"
  echo "ok=$(grep -c ': OK$' /tmp/b4-verify.txt) fail=$(grep -vc ': OK$' /tmp/b4-verify.txt)"
  grep -v ': OK$' /tmp/b4-verify.txt | head -20
  echo "### total lines checked: $(wc -l < 20261107-final/INDEX.sha256)"
} > "$EV/02-verify.txt" 2>&1
cat "$EV/02-verify.txt"
