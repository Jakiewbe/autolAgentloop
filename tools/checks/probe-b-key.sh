#!/usr/bin/env bash
set -u
cd /d/Vibe_coding-Project/autoAgentloop
LOG=evidence/raw/handoff/20261105-0048-b-worker-key-probe.log
: > "$LOG"
D=C:/Users/chs/agent-autoloop-handoff
BK=$(cat "$D/b-magicbook14.worker.key")
CFG=C:/Users/chs/.agent-autoloop/config.json
OWNER=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).owner)' "$CFG")
AW=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).worker.key)' "$CFG")
CLAIM="probe-$(date +%s)"
code() { curl -s -o /tmp/body.$$ -w "%{http_code}" "$@"; }
line() { echo -n "$1" | tee -a "$LOG"; code "${@:2}" | tee -a "$LOG"; echo "   body=$(head -c 200 /tmp/body.$$ | sed -E 's/[A-Za-z0-9_-]{30,}/<REDACTED>/g')" | tee -a "$LOG"; }
line "b_key /v1/work (claim 正确)      -> " -H "Authorization: Bearer $BK" "http://127.0.0.1:3350/v1/work?claim=$CLAIM&wait=0"
line "b_key /v1/state (owner 专用)     -> " -H "Authorization: Bearer $BK" http://127.0.0.1:3350/v1/state
line "a_worker_key /v1/work            -> " -H "Authorization: Bearer $AW" "http://127.0.0.1:3350/v1/work?claim=a-${CLAIM}&wait=0"
line "owner /v1/work (种类不符)         -> " -H "Authorization: Bearer $OWNER" "http://127.0.0.1:3350/v1/work?claim=o-${CLAIM}&wait=0"
line "owner /v1/state                  -> " -H "Authorization: Bearer $OWNER" http://127.0.0.1:3350/v1/state
line "bogus /v1/work                   -> " -H "Authorization: Bearer NOT-A-REAL-KEY" "http://127.0.0.1:3350/v1/work?claim=x-${CLAIM}&wait=0"
rm -f /tmp/body.$$
