
set -u
cd /d/AutoAgentloop
EV=evidence/20261108-final/b3
OLD='C:/Users/19082/.agent-autoloop'
NEW='D:/AutoAgentloop/home'
REL=/d/AutoAgentloop/release/b-c067fdb-20261107
read -r HUB KEY < <(cd "$REL" && AGENT_AUTOLOOP_HOME="$NEW" node --disable-warning=ExperimentalWarning -e '
import("./host/config.ts").then(m=>{const c=m.readConfig();process.stdout.write(c.url+" "+c.worker.key)})
')
{
  echo "## after migration $(date -u +%FT%TZ)"
  echo "### new up.pid: $(cat "$NEW/up.pid" 2>/dev/null || echo none)"
  echo "### old up.pid file (leftover, old home untouched): $(cat "$OLD/up.pid" 2>/dev/null || echo gone)"
  echo "### runs count new: $(ls "$NEW/worker/runs" | wc -l)"
  echo "### processes:"
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe' or Name='wscript.exe'\" | Where-Object { \$_.CommandLine -like '*agent-autoloop*' } | ForEach-Object { \$_.ProcessId.ToString() + ' <- ' + \$_.ParentProcessId + ' :: ' + \$_.CommandLine }"
  echo "### heartbeat probe (after) $(date -u +%FT%TZ)"
  curl -sS -m 30 -o /tmp/hb-after.json -w "http_code=%{http_code} time=%{time_total}" \
    -H "authorization: Bearer $KEY" "$HUB/v1/work?wait=0&capacity=0&claim=beat"; echo
  head -c 300 /tmp/hb-after.json; echo
  echo "### up.log since restart:"
  tail -3 "$NEW/logs/up.log"
} > "$EV/06-after-migration.txt" 2>&1
cat "$EV/06-after-migration.txt"
