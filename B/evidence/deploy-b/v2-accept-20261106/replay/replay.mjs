import { readFileSync } from "node:fs";
const mod = await import("file:///D:/AutoAgentloop/runtime/d504e4876d07/plugins/command/agent.ts");
const read = (mod.default ?? mod).read ?? mod.read;
const runs = [
  ["29-1", "C:/Users/19082/.agent-autoloop/worker/runs/29-1"],
  ["30-1", "C:/Users/19082/.agent-autoloop/worker/runs/30-1"]
];
const out = {};
for (const [name, base] of runs) {
  const stdout = readFileSync(base + "/stdout-1.log", "utf8");
  const stderr = readFileSync(base + "/stderr-1.log", "utf8");
  try { out[name] = { ok: true, value: read(stdout, 0, stderr, { command: "codex.exe exec --json" }) }; }
  catch (e) { out[name] = { ok: false, error: String(e && e.message || e).slice(0, 300) }; }
}
console.log(JSON.stringify(out, null, 1));
