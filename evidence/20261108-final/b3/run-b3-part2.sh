
set -u
cd /d/AutoAgentloop
EV=evidence/20261108-final/b3
OLD='C:/Users/19082/.agent-autoloop'
NEW='D:/AutoAgentloop/home'
REL=/d/AutoAgentloop/release/b-c067fdb-20261107

{
  echo "## copy data old -> new $(date -u +%FT%TZ)"
  mkdir -p "$NEW/logs"
  cp -a "$OLD/config.json" "$NEW/config.json"
  cp -a "$OLD/worker" "$NEW/worker"
  cp -a "$OLD/logs/." "$NEW/logs/"
  echo "### new home tree:"
  find "$NEW" -maxdepth 2 -not -path "*/runs/*" | sed "s|$NEW|.|"
  echo "### runs count new: $(ls "$NEW/worker/runs" | wc -l)"
  echo "### config.json sha256:"
  sha256sum "$OLD/config.json" "$NEW/config.json"
} > "$EV/04-copy-data.txt" 2>&1

{
  echo "## install service with new HOME $(date -u +%FT%TZ)"
  cd "$REL"
  AGENT_AUTOLOOP_HOME="$NEW" node --disable-warning=ExperimentalWarning bin/agent-autoloop.ts service install 2>&1
  echo "exit=$?"
  sleep 8
  echo "### tasks:"
  powershell -NoProfile -Command "Get-ScheduledTask | Where-Object { \$_.TaskName -like 'agent-autoloop*' } | ForEach-Object { \$_.TaskName + ' | ' + \$_.State + ' | ' + \$_.Actions.Arguments }"
  echo "### task info:"
  powershell -NoProfile -Command "Get-ScheduledTask | Where-Object { \$_.TaskName -like 'agent-autoloop*' } | ForEach-Object { \$i = \$_ | Get-ScheduledTaskInfo; \$_.TaskName + ' LastRun=' + \$i.LastRunTime + ' Result=' + \$i.LastTaskResult }"
  echo "### new up.pid: $(cat "$NEW/up.pid" 2>/dev/null || echo none)"
  echo "### processes:"
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe' or Name='wscript.exe'\" | Where-Object { \$_.CommandLine -like '*agent-autoloop*' } | ForEach-Object { \$_.ProcessId.ToString() + ' <- ' + \$_.ParentProcessId + ' :: ' + \$_.CommandLine }"
  echo "### new up.log:"
  cat "$NEW/logs/up.log"
} > "$EV/05-start-new.txt" 2>&1
