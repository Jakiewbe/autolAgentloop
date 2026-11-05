#!/usr/bin/env bash
# B/T3 probe 2: headless profile + provider patch (opencode-go / deepseek-v4.1-flash)
# + transient OPENCODE_GO_API_KEY. Secret never printed.
set +e
LOG="/d/AutoAgentloop/evidence/preflight/raw/dsh-headless-patched-$(date +%Y%m%dT%H%M%S).log"
DSH="/d/DPH/resources/runtime/cli/bin/dsh.cmd"
PATCH="/d/AutoAgentloop/evidence/preflight/raw/headless-opencode-go.patch.yml"
KEY=$(awk '/^  OPENCODE_GO_API_KEY:/{sub(/^[^:]*:[ ]*/,"");print;exit}' /c/Users/19082/.dsh/.credentials.yaml)
export OPENCODE_GO_API_KEY="$KEY"
START=$(date +%s)
"$DSH" --profile headless --patch "$PATCH" "Reply with exactly: DSH_HEADLESS_OK" > "$LOG" 2>&1
RC=$?
END=$(date +%s)
echo "EXIT=$RC ELAPSED=$((END-START))s LOG=$LOG"
echo "--- tail ---"
tail -15 "$LOG" | sed -E 's/oc_s[A-Za-z0-9_-]+/oc_s<RED>/g'
