// The bridge between a project's governance program and the hub: it asks the governance program what may be worked on,
// and says so to the hub as an event. It never writes a ledger, never decides a task is done, and never claims a task for
// a machine — the hub and the worker do that. Failure this guards against: a draft task, a task whose dependencies are
// not done, a task whose delivery files are not declared, or a task whose scope just changed being handed to an agent.
//
// Why it asks the governance program instead of reading .agent/tasks.json: the predicates are policy (approved plan,
// dependency state, evidence freshness, delivery coverage), and the program already computes them. Reading the file here
// would be a second copy of that policy, free to drift.
//
// Usage:
//   node tools/anchor_bridge/bridge.mjs --project <dir> [--emit] [--json]
//   ANCHOR_KIT=<path to kit.py> ANCHOR_PYTHON=<interpreter> to pin them instead of discovery.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name, fallback) => {
  const at = args.indexOf(name);
  return at === -1 ? fallback : args[at + 1];
};

/**
 * Where the governance program is. Discovery, not a path copied from another machine: the installed skill owns the
 * answer, in its runtime.json (kit + interpreter, absolute paths written by the installer). Every client keeps skills
 * somewhere else — .agents/skills for the DSH/agents client, .codex/skills and .claude/skills for the others, and a
 * DSH_HOME profile can hold its own — so all of them are searched before giving up. A bare kit.py is the last resort.
 */
function skillRoots(startDir) {
  const home = homedir();
  const roots = [
    path.join(startDir, ".agents", "skills"),
    path.join(startDir, ".codex", "skills"),
    path.join(startDir, ".claude", "skills"),
    path.join(home, ".agents", "skills"),
    path.join(home, ".codex", "skills"),
    path.join(home, ".claude", "skills"),
  ];
  const dshHome = process.env.DSH_HOME;
  if (dshHome) roots.push(path.join(dshHome, "skills"));
  roots.push(path.join(home, ".dsh", "skills"));
  return roots;
}

/** runtime.json is the installer's own locator file: absolute kit and interpreter, no guessing, no PATH lookup. */
function fromRuntime(file) {
  try {
    const runtime = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
    if (runtime?.schema !== 1) return null;
    if (typeof runtime.kit !== "string" || !path.isAbsolute(runtime.kit)) return null;
    if (!existsSync(runtime.kit)) return null;
    const python = typeof runtime.python === "string" && path.isAbsolute(runtime.python) ? runtime.python : undefined;
    return { program: runtime.kit, python, via: file };
  } catch {
    return null;
  }
}

function findKit(startDir) {
  if (process.env.ANCHOR_KIT) return { program: process.env.ANCHOR_KIT, via: "ANCHOR_KIT" };
  for (const root of skillRoots(startDir)) {
    if (!existsSync(root)) continue;
    for (const entry of readdirSync(root)) {
      if (!entry.startsWith("project-anchor")) continue;
      const at = path.join(root, entry);
      const located = fromRuntime(path.join(at, "runtime.json"));
      if (located) return located;
      const found = findFile(at, "kit.py", 2);
      if (found) return { program: found, via: at };
    }
  }
  return null;
}

function findFile(directory, name, depth) {
  if (depth < 0 || !existsSync(directory)) return null;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isFile() && entry.name === name) return full;
    if (entry.isDirectory()) {
      const nested = findFile(full, name, depth - 1);
      if (nested) return nested;
    }
  }
  return null;
}

/**
 * The interpreter to drive the program with: the one the installer recorded first, then what the machine has, not what
 * one machine happened to have.
 */
function interpreters(pinned) {
  if (process.env.ANCHOR_PYTHON) return [{ program: process.env.ANCHOR_PYTHON, args: [] }];
  return [
    ...(pinned ? [{ program: pinned, args: [] }] : []),
    { program: "py", args: ["-3"] },
    { program: "python", args: [] },
    { program: "python3", args: [] },
  ];
}

/** What the governance program says about this project, as it says it. */
function status(program, project, pinned) {
  const failures = [];
  for (const { program: interpreter, args: prefix } of interpreters(pinned)) {
    const result = spawnSync(interpreter, [...prefix, program, "status", project, "--brief", "--all"], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.status === 0) return JSON.parse(result.stdout);
    const first = (result.stderr || result.error?.message || "").trim().split("\n")[0] ?? "";
    failures.push(interpreter + " " + prefix.join(" ") + ": " + first.slice(0, 160));
  }
  throw new Error("治理程序跑不起来：" + failures.join("；"));
}

/**
 * Why a task may or may not be handed out. Order matters: the first reason is the one worth telling a person.
 * plan is the approval, dependencies the ordering, deliverable_coverage whether its delivery files are declared,
 * scope_dirty whether its scope changed after approval — all four are the governance program's words.
 */
function objection(task, byId) {
  if (task.plan !== "approved") return "计划是 " + task.plan + "，没有批准";
  if (task.status === "done" || task.status === "cancelled") return "已经 " + task.status;
  if (task.status === "blocked") return "任务自身被阻塞";
  if (task.scope_dirty) return "批准后范围变过，需要重新批准";
  if (task.legacy_unverified) return "旧账本未迁移核验";
  // A dependency is only met when the program says both that it is done and that its checks still cover its current
  // materials. status alone was too generous: a done task whose verification went stale would unlock the next one.
  const unmet = (task.dependencies ?? []).filter((id) => (byId.get(id)?.status ?? "missing") !== "done");
  if (unmet.length) return "依赖未完成：" + unmet.join("、");
  const stale = (task.dependencies ?? []).filter((id) => byId.get(id)?.verification_state !== "pass");
  if (stale.length) {
    const why = stale.map((id) => id + "（" + (byId.get(id)?.verification_state ?? "没有记录") + "）");
    return "依赖的验收记录不是当前材料对应的结果：" + why.join("、");
  }
  if (task.deliverable_coverage !== "covered") return "交付未声明（" + task.deliverable_coverage + "）";
  if (task.status === "doing") return "已经在做";
  return null;
}

export { findKit, objection, status };

const SUBJECT_SAFE = /[^A-Za-z0-9#._:/@-]/g;

// The center rejects any other character, so a Chinese project name becomes a readable ASCII address instead of a 400.
function slug(value) {
  const cleaned = String(value).replace(SUBJECT_SAFE, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return cleaned === "" ? "project" : cleaned;
}

function subjectOf(projectName, taskId) {
  return "task/" + slug(projectName) + "/" + slug(taskId);
}

export { subjectOf };

async function main() {
const project = path.resolve(value("--project", process.cwd()));
const found = findKit(project);
if (!found) {
  console.error("找不到治理程序：设置 ANCHOR_KIT，或把 project-anchor 技能装在 ~/.codex/skills 下");
  process.exit(2);
}

const state = status(found.program, project, found.python);
const byId = new Map(state.tasks.map((task) => [task.task_id, task]));
const decided = state.tasks.map((task) => ({ task, why: objection(task, byId) }));
const claimable = decided.filter((entry) => entry.why === null).map((entry) => entry.task);

console.log("治理程序：" + found.program + "（经 " + found.via + "）");
console.log("项目：" + state.name + " · 账本 rev " + state.task_revision + " · 任务 " + state.tasks.length + " 条 ⇒ 可领 " + claimable.length + " 条");
for (const { task, why } of decided) {
  console.log("  " + task.task_id + " " + String(task.status).padEnd(9) + " " + (why ?? "可领"));
}

if (flag("--json")) {
  console.log(JSON.stringify({ project: state.name, revision: state.task_revision, claimable: claimable.map((t) => t.task_id) }));
}

if (flag("--emit")) {
  const home = process.env.AGENT_AUTOLOOP_HOME ?? path.join(homedir(), ".agent-autoloop");
  const url = process.env.AGENT_AUTOLOOP_URL ?? "http://127.0.0.1:3350";
  const key = process.env.AGENT_AUTOLOOP_SOURCE_KEY;
  if (!key) {
    console.error("--emit 需要 AGENT_AUTOLOOP_SOURCE_KEY（来源密钥不写进本脚本，也不写进项目）");
    process.exit(2);
  }
  const record = path.join(home, "bridge", "anchor-events.json");
  mkdirSync(path.dirname(record), { recursive: true });
  const sent = existsSync(record) ? JSON.parse(readFileSync(record, "utf8")) : {};
  let posted = 0;
  for (const task of claimable) {
    // One event per task revision: a re-run after a crash is a no-op, not a second dispatch of the same work.
    const id = "anchor/" + state.name + "/" + task.task_id + "/r" + state.task_revision;
    if (sent[id]) continue;
    const response = await fetch(url + "/v1/events", {
      method: "POST",
      headers: { authorization: "Bearer " + key, "content-type": "application/json" },
      body: JSON.stringify({
        id,
        type: "task.claimable",
        // subject is an address, not prose: the center only accepts letters, digits and # . _ : / @ - there.
        subject: subjectOf(state.name, task.task_id),
        summary: task.task_id + " " + task.title + "：治理程序说这条已经批准、依赖完成、交付已声明",
        detail: "项目账本 rev " + state.task_revision,
      }),
    });
    if (!response.ok) {
      console.error(task.task_id + " 发送失败：" + response.status + " " + (await response.text()).slice(0, 200));
      continue;
    }
    sent[id] = new Date().toISOString();
    posted += 1;
  }
  writeFileSync(record, JSON.stringify(sent, null, 2) + "\n");
  console.log("已发送 " + posted + " 条事件；发送记录 " + record);
}
}

if (process.argv[1] && path.basename(process.argv[1]) === "bridge.mjs") await main();
