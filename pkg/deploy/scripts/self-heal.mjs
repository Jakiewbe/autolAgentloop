#!/usr/bin/env node
// Self-heal patrol for DSH session logs on this machine. Zero model calls.
//
// Rules it follows, in order:
//  1. Never touch a log that is open in another process, or that changed in the last 15 minutes.
//  2. A repair only counts when DSH's own validator accepts the result; the tool's own
//     "verified" line is not evidence (the release ships 8 synthetic checks that call no validator).
//  3. The original is copied to ~/.dsh/session-repair-backup/self-heal/<stamp>/ before anything
//     replaces it, and the installed file is re-validated; a failed re-validation restores the original.
//  4. Unrepairable input is recorded for the evolution loop; it is never "fixed" silently.
//
// usage: node deploy/scripts/self-heal.mjs [--apply] [--max 3] [--json] [--stale-minutes 15]
// exit 0 = healthy or everything already loadable; 1 = unresolved problems remain; 2 = patrol could not run
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync, appendFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..");
const tool = path.join(repo, "delivery", "session-repair-release", "dsh-session-repair-step.mjs");
const verify = path.join(repo, "delivery", "session-repair-release", "checks", "native_verify.mjs");
const probe = path.join(here, "lock-probe.ps1");
const outDir = path.join(repo, "evidence", "ops", "self-heal");

const args = process.argv.slice(2);
const value = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? Number(args[i + 1]) : fallback; };
const text = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const sessions = path.resolve(text("--sessions", path.join(homedir(), ".dsh", "sessions")));
const backupRoot = path.resolve(text("--backup-root", path.join(homedir(), ".dsh", "session-repair-backup", "self-heal")));
const apply = args.includes("--apply");
const asJson = args.includes("--json");
const max = value("--max", 3);
const staleMinutes = value("--stale-minutes", 15);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const report = { stamp, apply, checked: 0, loadable: 0, repaired: 0, refused: 0, held: 0, fresh: 0, problems: [], health: {}, installs: [] };

function probeHeld(files) {
  if (!files.length) return {};
  const listFile = path.join(outDir, "probe-" + stamp + ".json");
  writeFileSync(listFile, JSON.stringify(files));
  const r = spawnSync("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", probe, listFile], { encoding: "utf8", timeout: 120000, windowsHide: true });
  try {
    const parsed = JSON.parse((r.stdout || "").trim());
    const rows = Array.isArray(parsed) ? parsed : [parsed];
    return Object.fromEntries(rows.map(row => [row.path, row.held === true]));
  } catch {
    // A probe failure must not turn into "assume free": mark everything held so nothing is touched.
    return Object.fromEntries(files.map(f => [f, true]));
  }
}

function listLogs() {
  const found = [];
  if (!existsSync(sessions)) return found;
  for (const proj of readdirSync(sessions, { withFileTypes: true })) {
    if (!proj.isDirectory()) continue;
    const projDir = path.join(sessions, proj.name);
    for (const session of readdirSync(projDir, { withFileTypes: true })) {
      if (!session.isDirectory()) continue;
      const file = path.join(projDir, session.name, "session.v4.jsonl.zstd");
      if (existsSync(file)) found.push({ file, session: session.name });
    }
  }
  return found;
}

function native(input, extra = []) {
  const r = spawnSync(process.execPath, [verify, input, "--tool", tool, ...extra], { encoding: "utf8", timeout: 600000, windowsHide: true });
  const line = (r.stdout || "").trim().split("\n").pop() ?? "";
  try { return JSON.parse(line); } catch { return { exit: r.status ?? 2, problem: (r.stderr || line).slice(0, 300) }; }
}

async function health() {
  const out = {};
  const http = async (url) => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      return res.status + " " + (await res.text()).slice(0, 120);
    } catch (e) { return "ERR " + e.message; }
  };
  out.hub = await http("http://127.0.0.1:3350/healthz");
  out.dashboard = await http("http://127.0.0.1:3351/healthz");
  out.tunnel = await http("http://127.0.0.1:4041/healthz");
  const home = path.join(homedir(), ".agent-autoloop");
  try { out.hubDbBytes = statSync(path.join(home, "hub.db")).size; } catch { out.hubDbBytes = null; }
  try { out.walBytes = statSync(path.join(home, "hub.db-wal")).size; } catch { out.walBytes = null; }
  return out;
}

if (!existsSync(tool) || !existsSync(verify)) {
  console.log(JSON.stringify({ exit: 2, problem: "release tool or native verifier missing; refusing to patrol" }));
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

const logs = listLogs();
report.health = await health();
const now = Date.now();
const stale = [];
for (const entry of logs) {
  const info = statSync(entry.file);
  entry.bytes = info.size;
  if (now - info.mtimeMs < staleMinutes * 60 * 1000) { report.fresh += 1; continue; }
  stale.push(entry);
}
const held = probeHeld(stale.map(e => e.file));

for (const entry of stale) {
  report.checked += 1;
  if (held[entry.file]) { report.held += 1; continue; }
  const pre = native(entry.file, ["--check-only"]);
  if (pre.nativeOk === true) { report.loadable += 1; continue; }
  if (apply === false || report.installs.length >= max) {
    report.problems.push({ file: entry.file, kind: "needs-repair", reason: pre.nativeMessage ?? pre.problem ?? "native validator rejected" });
    continue;
  }
  const fixed = native(entry.file, ["--keep"]);
  if (fixed.nativeOk !== true || !fixed.copy) {
    const refused = fixed.repairExit !== 0;
    report.refused += 1;
    report.problems.push({ file: entry.file, kind: refused ? "unrepairable" : "tool-claimed-but-native-rejected",
      reason: fixed.nativeMessage ?? fixed.problem ?? "no accepted copy", repairExit: fixed.repairExit });
    continue;
  }
  const dir = path.join(backupRoot, stamp);
  mkdirSync(dir, { recursive: true });
  const backup = path.join(dir, path.basename(entry.file) + "." + entry.session + ".orig");
  copyFileSync(entry.file, backup);
  const staged = entry.file + ".heal-staged";
  copyFileSync(fixed.copy, staged);
  renameSync(staged, entry.file);
  const post = native(entry.file, ["--check-only"]);
  if (post.nativeOk === true) {
    report.repaired += 1;
    report.installs.push({ file: entry.file, backup, bytesBefore: entry.bytes, bytesAfter: statSync(entry.file).size });
  } else {
    copyFileSync(backup, entry.file);
    report.problems.push({ file: entry.file, kind: "installed-copy-failed-revalidation-restored", reason: post.nativeMessage ?? "validator rejected installed file" });
  }
}

// A reachable tunnel endpoint is any HTTP answer (ngrok's local API answers 404); only a refused
// connection counts as broken.
const healthy = /^200 /.test(report.health.hub) && /^200 /.test(report.health.dashboard) && !/^ERR /.test(report.health.tunnel);
const code = report.problems.length === 0 && healthy ? 0 : 1;
report.exit = code;
report.healthy = healthy;

const payload = JSON.stringify(report);
const day = encodeURIComponent(report.stamp.slice(0, 10));
appendFileSync(path.join(outDir, day + ".jsonl"), payload + "\n");
writeFileSync(path.join(outDir, "latest.json"), JSON.stringify(report, null, 2));
if (asJson) console.log(payload);
else console.log(JSON.stringify({ exit: code, checked: report.checked, loadable: report.loadable, repaired: report.repaired,
  refused: report.refused, held: report.held, fresh: report.fresh, healthy,
  problems: report.problems.map(p => p.kind) }, null, 2));
process.exit(code);
