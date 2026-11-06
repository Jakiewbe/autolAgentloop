// Windows has no /bin/sh, no signals and no process groups, so the way a turn is started, looked at and stopped is
// different there; these are the checks for that way, on Windows only. They run real processes: a turn started in a
// folder with a space and Chinese in its path, a turn stopped with the child it started, a turn over its time, and a
// worker restarted while a turn is still going. What matters is what the operating system shows afterwards: no process
// left, and the exit code and the result where the worker looks for them. The POSIX side keeps its checks in
// worker.test.ts, which needs /bin/sh and so cannot run here.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { WINDOWS, launchTurn, pidAlive, runAlive, runTreeAlive, stopRun } from "../host/platform.ts";
import { setup } from "./helpers.ts";

const home = setup("windows-runtime");
// A folder a Windows path often is: a space and Chinese in it, which is where quoting goes wrong.
const folder = join(home, "project 目录");
mkdirSync(folder, { recursive: true });

const { createWorker } = await import("../worker/worker.ts");

const scriptFile = (name: string, body: string) => {
  const file = join(home, name);
  writeFileSync(file, body.trimStart());
  return file;
};

/** Ticks until `done`, or fails: a test that waits for ever is a test that hides a hang. */
async function until(done: () => boolean) {
  const end = Date.now() + 30_000;
  while (!done()) {
    assert.ok(Date.now() < end, "等了 30 秒还没好");
    await new Promise((again) => setTimeout(again, 50));
  }
}

/** The worker's own round, over and over: it is what looks at a run, so nothing happens without it. */
async function drive(worker: { tick(): Promise<boolean> }, done: () => boolean) {
  const end = Date.now() + 30_000;
  while (!done()) {
    assert.ok(Date.now() < end, "30 秒内没收住这一轮");
    await worker.tick();
    await new Promise((again) => setTimeout(again, 100));
  }
}

const jobFor = (over: { run: number; command: string[]; timeout?: number }) => ({
  run: over.run,
  token: `token-${over.run}`,
  attempt: 1,
  session: null,
  askFirst: [],
  rule: { name: "跑一下", cwd: folder, prompt: "做点事。" },
  agent: { id: "a", name: "甲", use: "command", access: "edit", command: over.command, timeout: over.timeout },
  context: { events: [], answers: [], timers: [], waiting: [], open: [], decided: [] },
});

function fakeHub() {
  const hub = {
    jobs: [] as any[],
    results: [] as any[],
    async work(query: any) {
      return { job: query.capacity ? (hub.jobs.shift() ?? null) : null, cancel: [] };
    },
    async started() {
      return { ok: true };
    },
    async result(run: number, token: string, body: any) {
      hub.results.push({ run, token, ...body });
      return { rejected: [] };
    },
  };
  return hub;
}

const runFolder = (run: number) => join(home, "worker", "runs", `${run}-1`);

/** Whatever a test left running is stopped and taken away, so the next one starts on a machine with nothing on it. */
function clearRuns() {
  const runs = join(home, "worker", "runs");
  if (!existsSync(runs)) return;
  for (const id of readdirSync(runs)) {
    const file = join(runs, id, "entry.json");
    try {
      const entry = JSON.parse(readFileSync(file, "utf8"));
      if (entry.pid) stopRun(entry.pid, true);
    } catch {}
    for (let tries = 0; tries < 40 && existsSync(file); tries++) {
      try {
        rmSync(join(runs, id), { recursive: true, force: true });
      } catch {}
      if (existsSync(join(runs, id))) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
}

test(
  "windows: a turn runs in the rule's folder and keeps its output, exit code and result",
  { skip: !WINDOWS },
  async () => {
    const starts = join(home, "happy-starts.log");
    const script = scriptFile(
      "say.mjs",
      `
import { appendFileSync } from "node:fs";
appendFileSync(process.argv[2], "started\\n");
process.stdout.write("好了\\n");
`,
    );
    const hub = fakeHub();
    hub.jobs.push(jobFor({ run: 1, command: [process.execPath, script, starts] }));
    const worker = createWorker({ hub, name: "本机", wait: 1 });
    try {
      await drive(worker, () => hub.results.length === 1);
    } finally {
      clearRuns();
    }
    const [result] = hub.results;
    assert.equal(result.outcome, "done");
    assert.equal(readFileSync(join(runFolder(1), "exit-1"), "utf8").trim(), "0");
    assert.match(readFileSync(join(runFolder(1), "stdout-1.log"), "utf8"), /好了/);
    const spec = JSON.parse(readFileSync(join(runFolder(1), "command-1.json"), "utf8"));
    assert.equal(spec.program.toLowerCase(), process.execPath.toLowerCase());
    assert.deepEqual(spec.args, [script, starts]);
    assert.equal(spec.cwd, folder);
    assert.equal(readFileSync(starts, "utf8").trim(), "started");
    void worker;
  },
);

test("windows: stopping a turn ends the tree it started", { skip: !WINDOWS }, async () => {
  const pids = join(home, "tree-pids.txt");
  const script = scriptFile(
    "tree.mjs",
    `
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
const kid = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore", windowsHide: true });
writeFileSync(process.argv[2], process.pid + " " + kid.pid);
setInterval(() => {}, 1000);
`,
  );
  const dir = join(home, "direct-run");
  mkdirSync(dir, { recursive: true });
  const marker = "agent-autoloop-run:9:1:1";
  const pid = launchTurn({
    argv: [process.execPath, script, pids],
    cwd: folder,
    env: process.env,
    files: { out: join(dir, "stdout-1.log"), err: join(dir, "stderr-1.log"), result: join(dir, "exit-1") },
    commandFile: join(dir, "command-1.json"),
    marker,
  });
  await until(() => existsSync(pids) && readFileSync(pids, "utf8").trim().split(" ").length === 2);
  const kid = Number(readFileSync(pids, "utf8").trim().split(" ")[1]);
  assert.equal(runAlive(pid, marker), true);
  assert.equal(runTreeAlive(pid), true);
  assert.equal(pidAlive(kid), true);
  stopRun(pid, false);
  await until(() => !runTreeAlive(pid) && !pidAlive(kid));
  assert.equal(runTreeAlive(pid), false);
  assert.equal(pidAlive(kid), false);
});

test("windows: a turn over its time is stopped and the run says why", { skip: !WINDOWS }, async () => {
  const starts = join(home, "slow-starts.log");
  const script = scriptFile(
    "slow.mjs",
    `
import { appendFileSync } from "node:fs";
appendFileSync(process.argv[2], "started\\n");
setTimeout(() => process.exit(0), 30_000);
`,
  );
  const hub = fakeHub();
  hub.jobs.push(jobFor({ run: 7, command: [process.execPath, script, starts], timeout: 1 }));
  let clock = Date.parse("2026-10-18T02:00:00.000Z");
  const worker = createWorker({ hub, name: "本机", wait: 1, now: () => clock });
  // It is started through the runner, so the script itself is what says it is up.
  await drive(worker, () => existsSync(starts));
  assert.equal(readFileSync(starts, "utf8").trim(), "started");
  // A minute past when it started: the worker's clock moves, the stopping happens in real time.
  clock += 61_000;
  try {
    await drive(worker, () => hub.results.length === 1);
  } finally {
    clearRuns();
  }
  const [result] = hub.results;
  assert.equal(result.outcome, "failed");
  assert.match(result.error, /超过 1 分钟/);
});

test(
  "windows: a restarted worker keeps the turn it finds, and doesn't start it again",
  { skip: !WINDOWS },
  async () => {
    const starts = join(home, "restart-starts.log");
    const script = scriptFile(
      "finish.mjs",
      `
import { appendFileSync } from "node:fs";
appendFileSync(process.argv[2], "started\\n");
setTimeout(() => process.stdout.write("完成了\\n"), 2_500);
`,
    );
    const hub = fakeHub();
    hub.jobs.push(jobFor({ run: 3, command: [process.execPath, script, starts] }));
    const first = createWorker({ hub, name: "本机", wait: 1 });
    // This one goes away without stopping the turn: another one starts on the same home, as after a restart.
    const second = createWorker({ hub, name: "本机", wait: 1 });
    try {
      await drive(first, () => existsSync(starts));
      await drive(second, () => hub.results.length === 1);
    } finally {
      clearRuns();
    }
    assert.equal(hub.results[0].outcome, "done");
    assert.equal(readFileSync(starts, "utf8").trim().split("\n").length, 1);
    assert.equal(existsSync(join(runFolder(3), "command-2.json")), false);
    await first.tick();
  },
);
