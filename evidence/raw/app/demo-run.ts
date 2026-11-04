// A run kept where a person can look at it: two real turns through the Windows runner, one finishing on its own and
// one stopped by a cancel from the hub, with everything the worker wrote left on disk under evidence/raw/app/demo-home.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const here = import.meta.dirname;
const home = resolve(here, "demo-home");
mkdirSync(home, { recursive: true });
process.env.AGENT_AUTOLOOP_HOME = home;

const folder = join(home, "project 目录 with spaces");
mkdirSync(folder, { recursive: true });

writeFileSync(
  join(home, "say.mjs"),
  ["process.stdout.write('这一轮干完了\\n');", "process.exit(0);", ""].join("\n"),
);
writeFileSync(
  join(home, "long.mjs"),
  ["setInterval(() => {}, 1000);", ""].join("\n"),
);

const { createWorker } = await import("../../../app/worker/worker.ts");

const makeJob = (run: number, script: string) => ({
  run,
  token: "token-" + run,
  attempt: 1,
  session: null,
  askFirst: [],
  rule: { name: "演示", cwd: folder, prompt: "做点事。" },
  agent: { id: "a", name: "甲", use: "command", access: "edit", command: [process.execPath, join(home, script)] },
  context: { events: [], answers: [], timers: [], waiting: [], open: [], decided: [] },
});

const jobs = [makeJob(101, "say.mjs"), makeJob(102, "long.mjs")];
const results: any[] = [];
let cancelNext = false;
const hub = {
  async work(query: any) {
    const cancel = cancelNext ? [102] : [];
    cancelNext = false;
    return { job: query.capacity ? (jobs.shift() ?? null) : null, cancel };
  },
  async started(run: number, _token: string, body: any) {
    console.log("started", run, JSON.stringify(body));
    return { ok: true };
  },
  async result(run: number, _token: string, body: any) {
    results.push({ run, ...body });
    console.log("result", run, body.outcome, body.error ?? body.summary ?? "");
    return { rejected: [] };
  },
};

const worker = createWorker({ hub, name: "演示机", wait: 1, capacity: 2 });
const runs = join(home, "worker", "runs");
const end = Date.now() + 60_000;
now: {
  while (results.length < 2) {
    if (Date.now() > end) throw new Error("演示跑不完");
    await worker.tick();
    // The second one is long on purpose: the hub takes it back once it is really running.
    const second = readdirSync(runs).find((id) => id.startsWith("102-"));
    if (second && !cancelNext && results.length === 1) {
      const entry = JSON.parse(readFileSync(join(runs, second, "entry.json"), "utf8"));
      if (entry.pid) {
        console.log("asking the hub to cancel 102, pid", entry.pid);
        cancelNext = true;
        await new Promise((again) => setTimeout(again, 500));
      }
    }
    await new Promise((again) => setTimeout(again, 200));
  }
  break now;
}

for (const id of readdirSync(runs)) {
  console.log("---", id);
  for (const file of readdirSync(join(runs, id)).sort()) {
    const path = join(runs, id, file);
    const text = file === "entry.json" ? "(entry, left behind only if the hub refused it)" : readFileSync(path, "utf8").slice(0, 200).replace(/\n/g, " / ");
    console.log("   ", file, "=>", text);
  }
}
console.log("summary:", JSON.stringify(results.map((r) => [r.run, r.outcome]), null, 0));
