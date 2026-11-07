
set -u
cd /d/AutoAgentloop
EV=evidence/20261108-final/b3
mkdir -p "$EV"
OLD='C:/Users/19082/.agent-autoloop'
NEW='D:/AutoAgentloop/home'
REL=/d/AutoAgentloop/release/b-c067fdb-20261107
NODE="C:/Program Files/nodejs/node.exe"

# ---- 1. baseline
{
  echo "# B3 baseline $(date -u +%FT%TZ)"
  echo "## old HOME=$OLD"
  echo "### up.pid: $(cat "$OLD/up.pid" 2>/dev/null)"
  echo "### runs count: $(ls "$OLD/worker/runs" | wc -l)"
  echo "### up.log tail:"; tail -5 "$OLD/logs/up.log"
  echo "### scheduled tasks:"
  powershell -NoProfile -Command "Get-ScheduledTask | Where-Object { \$_.TaskName -like 'agent-autoloop*' } | ForEach-Object { \$_.TaskName + ' | ' + \$_.State + ' | ' + \$_.Actions.Arguments }"
} > "$EV/01-before-migration.txt" 2>&1

# hub heartbeat probe (worker's own key, capacity=0 -> report only)
read -r HUB KEY < <(cd "$REL" && AGENT_AUTOLOOP_HOME="$OLD" node --disable-warning=ExperimentalWarning -e '
import("./host/config.ts").then(m=>{const c=m.readConfig();process.stdout.write(c.url+" "+c.worker.key)})
')
echo "HUB=$HUB" >> "$EV/01-before-migration.txt"
{
  echo "### heartbeat probe (before) $(date -u +%FT%TZ)"
  curl -sS -m 30 -o /tmp/hb-before.json -w "http_code=%{http_code} time=%{time_total}\n" \
    -H "authorization: Bearer $KEY" "$HUB/v1/work?wait=0&capacity=0&claim=beat"
  head -c 300 /tmp/hb-before.json; echo
} >> "$EV/01-before-migration.txt" 2>&1

# ---- 2. new home + privateDirectory two directions
echo "## new home=$NEW" >> "$EV/02-acl-new-home.txt"
powershell -NoProfile -Command "New-Item -ItemType Directory -Force -Path 'D:\AutoAgentloop\home' | Out-Null; '### ACL before grant:'; (Get-Acl 'D:\AutoAgentloop\home').AccessToString" >> "$EV/02-acl-new-home.txt" 2>&1

echo "### privateDirectory BEFORE grant (expect throw)" >> "$EV/02-acl-new-home.txt"
( cd "$REL" && AGENT_AUTOLOOP_HOME="$NEW" node --disable-warning=ExperimentalWarning -e '
import("./host/files.ts").then(m=>{m.privateDirectory(process.env.AGENT_AUTOLOOP_HOME);console.log("PRIVATE_DIRECTORY OK")}).catch(e=>console.log("PRIVATE_DIRECTORY ERR: "+e.message))
' ) >> "$EV/02-acl-new-home.txt" 2>&1

echo "### one-time grant: TakeOwnership (WRITE_OWNER) inheritable ACE to current user on $NEW only" >> "$EV/02-acl-new-home.txt"
powershell -NoProfile -Command "\$d='D:\AutoAgentloop\home'; \$me=[Security.Principal.WindowsIdentity]::GetCurrent().User; \$a=Get-Acl \$d; \$a.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new(\$me,[Security.AccessControl.FileSystemRights]::TakeOwnership,'ContainerInherit,ObjectInherit','None','Allow')); Set-Acl -Path \$d -AclObject \$a; '### ACL after grant:'; (Get-Acl \$d).AccessToString" >> "$EV/02-acl-new-home.txt" 2>&1

echo "### privateDirectory AFTER grant (expect OK)" >> "$EV/02-acl-new-home.txt"
( cd "$REL" && AGENT_AUTOLOOP_HOME="$NEW" node --disable-warning=ExperimentalWarning -e '
import("./host/files.ts").then(m=>{m.privateDirectory(process.env.AGENT_AUTOLOOP_HOME);console.log("PRIVATE_DIRECTORY OK")}).catch(e=>console.log("PRIVATE_DIRECTORY ERR: "+e.message))
' ) >> "$EV/02-acl-new-home.txt" 2>&1
powershell -NoProfile -Command "'### ACL after product block:'; (Get-Acl 'D:\AutoAgentloop\home').AccessToString; '### owner:'; (Get-Acl 'D:\AutoAgentloop\home').Owner" >> "$EV/02-acl-new-home.txt" 2>&1

# ---- 3. stop old service
{
  echo "## stop old service $(date -u +%FT%TZ)"
  cd "$REL"
  AGENT_AUTOLOOP_HOME="$OLD" node --disable-warning=ExperimentalWarning bin/agent-autoloop.ts service remove 2>&1
  echo "exit=$?"
  sleep 3
  echo "### tasks after remove:"
  powershell -NoProfile -Command "Get-ScheduledTask | Where-Object { \$_.TaskName -like 'agent-autoloop*' } | ForEach-Object { \$_.TaskName + ' | ' + \$_.State }"
  echo "### old up.pid file: $(ls "$OLD/up.pid" 2>/dev/null || echo gone)"
  echo "### processes:"
  powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe' or Name='wscript.exe'\" | Where-Object { \$_.CommandLine -like '*agent-autoloop*' } | ForEach-Object { \$_.ProcessId }"
} > "$EV/03-stop-old.txt" 2>&1
