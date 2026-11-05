#!/usr/bin/env bash
# B/T3 probe: run DSH automation entry (dsh --profile headless) with the OpenCode Go
# credential supplied only as a transient environment variable.
# The secret is read from B's own DSH credential store and never printed or written.
set +e
LOG="/d/AutoAgentloop/evidence/preflight/raw/dsh-headless-env-$(date +%Y%m%dT%H%M%S).log"
DSH="/d/DPH/resources/runtime/cli/bin/dsh.cmd"
KEY=$(awk '/^  OPENCODE_GO_API_KEY:/{sub(/^[^:]*:[ ]*/,"");print;exit}' /c/Users/19082/.dsh/.credentials.yaml)
if [ -z "$KEY" ]; then echo "NO_KEY_EXTRACTED"; exit 3; fi
N=$(printf '%s' "$KEY" | wc -c)
echo "key_loaded_chars=$N (value not printed)"
START=$(date +%s)
export OPENCODE_GO_API_KEY="$KEY"
"$DSH" --profile headless "Reply with exactly: DSH_HEADLESS_OK" > "$LOG" 2>&1
RC=$?
END=$(date +%s)
echo "EXIT=$RC ELAPSED=$((END-START))s LOG=$LOG"
echo "--- tail ---"
tail -12 "$LOG" | sed -E 's/oc_s[A-Za-z0-9_-]+/oc_s<RED>/g'
