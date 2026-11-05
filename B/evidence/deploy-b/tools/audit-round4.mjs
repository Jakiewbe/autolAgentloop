
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const CLONE = "D:/AutoAgentloop/_verify/clone-20261105T103251";
const PROMPT = readFileSync("D:/AutoAgentloop/.tmp-repo/probe/B/reviews/2026-11-05-t11-round4.md", "utf8");
const stamp = process.argv[2];
const OUT = "D:/AutoAgentloop/evidence/deploy-b/audit-" + stamp;
mkdirSync(OUT, { recursive: true });

function run(cmd, args, opts) {
  return new Promise((res) => {
    const p = spawn(cmd, args, { cwd: CLONE, stdio: ["ignore", "pipe", "pipe"], ...opts });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d.toString("utf8")));
    p.stderr.on("data", (d) => (err += d.toString("utf8")));
    p.on("close", (code) => res({ code, out, err }));
  });
}

const checks = [
  ["git log -4", "git", ["log", "-4", "--format=%H %an <%ae> %ci %s", "--"]],
  ["diff-status", "git", ["diff", "--name-status", "origin/main", "origin/b"]],
  ["diff-names", "git", ["diff", "--name-only", "origin/main", "origin/b"]],
  ["main-authors", "git", ["log", "origin/main", "--format=%an"]],
  ["manifest-check", "git", ["rev-parse", "HEAD"]],
];
const pre = [];
for (const [name, cmd, args] of checks) {
  const r = await run(cmd, args);
  pre.push("### " + name + " exit=" + r.code + "\n" + r.out.trim() + (r.err.trim() ? "\nSTDERR: " + r.err.trim() : ""));
}
// manifest -c needs shell glob semantics: run via bash
const mf = await run("C:\\Users\\19082\\.dsh\\profiles\\desktop\\node_modules\\@dsh-ops\\bash-win32-x64\\usr\\bin\\bash.exe", ["-lc", "sha256sum -c B/MATERIALS.repo.sha256 | grep -v ': OK$' | head -5; sha256sum -c B/MATERIALS.repo.sha256 | grep -c ': OK$'; wc -l < B/MATERIALS.repo.sha256; find B -type f | wc -l; grep -c 'MATERIALS.repo.sha256' B/MATERIALS.repo.sha256 || true; grep -c '\"self_sha256\"' B/evidence/deploy-b/B-install-state.json || true"]);
pre.push("### manifest-and-counts exit=" + mf.code + "\n" + mf.out.trim() + (mf.err.trim() ? "\nSTDERR: " + mf.err.trim() : ""));
writeFileSync(OUT + "/prechecks.txt", pre.join("\n\n"), "utf8");

async function audit(name, exe, args) {
  const r = await run(exe, args);
  const raw = OUT + "/" + name + "-raw.txt";
  writeFileSync(raw, "EXIT=" + r.code + "\n--- STDOUT ---\n" + r.out + "\n--- STDERR ---\n" + r.err, "utf8");
  const lines = r.out.split(/\r?\n/);
  const kept = [], dropped = [];
  for (const l of lines) { if (l.trim().startsWith("{")) kept.push(l); else if (l.trim()) dropped.push(l); }
  writeFileSync(OUT + "/" + name + "-dropped.txt", dropped.join("\n"), "utf8");
  let msg = "";
  for (const l of kept) {
    try { const o = JSON.parse(l); if (o.type === "item.completed" && o.item?.type === "agent_message") msg = o.item.text; } catch {}
  }
  writeFileSync(OUT + "/" + name + "-verdict.md", msg || "(no agent_message)", "utf8");
  return { name, exit: r.code, dropped: dropped.length, verdictChars: (msg || "").length };
}

const res = [];
res.push(await audit("codex", "C:\\Users\\19082\\AppData\\Local\\OpenAI\\Codex\\bin\\codex.exe",
  ["exec", "--json", "--skip-git-repo-check", "--sandbox", "read-only", "-c", "approval_policy=\"never\"", "-c", "model_reasoning_effort=\"low\"", "-m", "deepseek-v4.1-flash-1017", PROMPT]));
res.push(await audit("claude", "C:\\Users\\19082\\.local\\bin\\claude.exe",
  ["-p", PROMPT, "--output-format", "json", "--model", "deepseek-v4.1-flash-1017", "--settings", OUT + "/settings.json"]));
writeFileSync(OUT + "/summary.json", JSON.stringify({ stamp, clone: CLONE, results: res }, null, 2), "utf8");
console.log(JSON.stringify(res));
