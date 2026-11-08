// Failure modes: --json changes the state instead of printing it; the human output stops being the plain one; an
// unknown flag is ignored and the command quietly does something else.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { once } from "node:events";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import { after, test } from "node:test";
import { at, setup } from "./helpers.ts";

const home = setup("status-json");
const hub = await import("./hub.ts");
const { serve } = await import("../host/http.ts");
const server = serve(0);
await once(server, "listening");
after(() => {
  server.closeAllConnections();
  server.close();
  if (hub.db.isOpen) hub.db.close();
});
writeFileSync(
  join(home, "config.json"),
  JSON.stringify({ url: `http://127.0.0.1:${(server.address() as any).port}`, owner: hub.addKey("owner", "reader") }),
);
const cli = async (...args: string[]) =>
  (
    await promisify(execFile)(
      process.execPath,
      ["--disable-warning=ExperimentalWarning", join(import.meta.dirname, "../bin/agent-autoloop.ts"), ...args],
      { env: { ...process.env } },
    )
  ).stdout;

test("state exposes only pending timers on the first page", () => {
  hub.ingest("app", { id: "timer-state", type: "feedback.new", subject: "#timer" }, at(0));
  const job = hub.claimNext("w1", "timer-state", at(0))!;
  hub.finish(
    job.run,
    job.token,
    { outcome: "done", later: [{ key: "verify", at: new Date(at(100)).toISOString(), about: "核对结果" }] },
    at(1),
  );
  assert.deepEqual(hub.stateOf(at(2)).timers, [
    { rule: "意见", lane: "#timer", key: "verify", about: "核对结果", at: new Date(at(100)).toISOString() },
  ]);
  assert.deepEqual(hub.stateOf(at(2), job.run + 1).timers, []);
  hub.execute("tick", [], at(101));
  assert.deepEqual(hub.stateOf(at(101)).timers, []);
});

test("status --json prints the same state the hub serves, and the plain output stays human", async () => {
  hub.execute(
    "rules",
    [
      hub.parseRules(
        JSON.stringify({
          sources: { local: { name: "本机" } },
          agents: { helper: { name: "助手", worker: "this-machine", use: "command", command: ["true"] } },
          channels: {},
          rules: [],
        }),
        Date.now(),
      ),
    ],
    Date.now(),
  );
  const state = JSON.parse(await cli("status", "--json"));
  assert.deepEqual(Object.keys(state).sort(), Object.keys(hub.stateOf()).sort());
  assert.equal(state.timezone, hub.stateOf().timezone);
  assert.ok(Array.isArray(state.runs));
  assert.ok(Array.isArray(state.cards));
  const human = await cli("status");
  assert.ok(!human.trim().startsWith("{"));
  assert.match(human, /在跑|排队|等你/);
});

test("an unknown flag is refused instead of ignored", async () => {
  await assert.rejects(cli("status", "--wat"), /不认识的参数/);
});
