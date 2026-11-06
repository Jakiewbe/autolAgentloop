// Failure modes: a Go deployment uses a different executable/profile, loses the session or model, or bypasses permissions.
import assert from "node:assert/strict";
import { test } from "node:test";
import adapter from "../plugins/claude-go/agent.ts";
import type { Turn } from "../worker/agents.ts";

const turn: Turn = {
  prompt: "do approved work",
  session: "new-session",
  resume: null,
  cwd: "D:/project",
  access: "edit",
  model: "deepseek-v4.1-flash",
  contextFile: "D:/context.json",
  folder: "D:/run",
  command: ["D:/claude.exe", "D:/private/go.json"],
};
test("uses the configured executable, profile and exact model", () => {
  const args = adapter.command(turn);
  assert.equal(args[0], "D:/claude.exe");
  assert.equal(args[args.indexOf("--settings") + 1], "D:/private/go.json");
  assert.equal(args[args.indexOf("--model") + 1], "deepseek-v4.1-flash");
  assert.equal(args[args.indexOf("--permission-mode") + 1], "acceptEdits");
  assert.ok(!args.includes("--dangerously-skip-permissions"));
});
test("resumes only the named session and keeps model configuration", () => {
  const args = adapter.command({ ...turn, resume: "old-session" });
  assert.equal(args[args.indexOf("--resume") + 1], "old-session");
  assert.ok(!args.includes("--session-id"));
  assert.ok(args.includes("deepseek-v4.1-flash"));
});
test("fails without an explicit executable and private profile", () => {
  assert.throws(() => adapter.command({ ...turn, command: undefined }));
});
test("keeps the native Claude result parser instead of accepting raw output", () => {
  assert.equal(adapter.read("echo prompt", 0, "").error, "echo prompt");
  const result = adapter.read(
    JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "done", session_id: "s1" }),
    0,
    "",
  );
  assert.equal(result.text, "done");
  assert.equal(result.session, "s1");
});

test("loads by folder name from the shipped plugins folder, and only under a legal name", async () => {
  const { loadPlugin } = await import("../host/plugins.ts");
  const loaded: any = await loadPlugin("claude-go", "agent");
  assert.equal(loaded.command(turn)[0], "D:/claude.exe");
  assert.equal(typeof loaded.read, "function");
  assert.equal(loaded.link, adapter.link);
  await assert.rejects(() => loadPlugin("Claude_Go", "agent"), /插件名字不正确/);
  await assert.rejects(() => loadPlugin("no-such-plugin", "agent"), /没有 no-such-plugin 的插件/);
});

test("does not report Claude's estimate as a verified Go charge", () => {
  const result = adapter.read(
    JSON.stringify({
      type: "result",
      subtype: "success",
      result: "done",
      session_id: "s1",
      total_cost_usd: 12,
      usage: { input_tokens: 3, output_tokens: 2 },
    }),
    0,
    "",
  );
  assert.equal(result.usage?.input, 3);
  assert.equal(result.usage?.cost, undefined);
});
