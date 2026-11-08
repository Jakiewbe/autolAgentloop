// Failure modes: the resume flag goes on the first turn as well (codex's resume takes no -C); a part that is only a
// placeholder is passed through as that word; a Codex stream with a line that is not a JSON object is graded as a pass
// because the broken lines are skipped; a Codex stream that never finished or never named its session is graded as a
// pass with half an answer; a plain command's own text is parsed away.
import assert from "node:assert/strict";
import { test } from "node:test";
import adapter from "../plugins/command/agent.ts";
import type { Turn } from "../worker/agents.ts";

const turn = (over: Partial<Turn> = {}): Turn => ({
  prompt: "P",
  session: "s-new",
  resume: null,
  cwd: "C:/work",
  access: "edit",
  command: ["codex", "exec", "{resumeArgs}", "--skip-git-repo-check", "{cwdArgs}", "--json", "{prompt}"],
  contextFile: "C:/home/context.md",
  folder: "C:/work",
  ...over,
});

const source = (command: string[]) => ({ command });
const codex = source(["codex", "exec", "--json", "P"]);
const line = (...events: object[]) => events.map((event) => JSON.stringify(event)).join("\n");
const started = { type: "thread.started", thread_id: "t-9" };
const said = (text: string) => ({ type: "item.completed", item: { type: "agent_message", text } });
const done = { type: "turn.completed", usage: { input_tokens: 10, output_tokens: 3, cached_input_tokens: 4 } };

test("the first turn gets the folder flag and no resume", () => {
  assert.deepEqual(adapter.command(turn()), ["codex", "exec", "--skip-git-repo-check", "-C", "C:/work", "--json", "P"]);
});

test("going on in a session puts resume and the id first, and drops the flag that resume refuses", () => {
  assert.deepEqual(adapter.command(turn({ resume: "t-1" })), [
    "codex",
    "exec",
    "resume",
    "t-1",
    "--skip-git-repo-check",
    "--json",
    "P",
  ]);
});

test("a word can carry a placeholder, and the session can be asked for by name", () => {
  const one = turn({ command: ["oc", "run", "{prompt}", "--session", "{session}"] });
  assert.deepEqual(adapter.command(one), ["oc", "run", "P", "--session", "s-new"]);
  assert.deepEqual(adapter.command({ ...one, resume: "t-2" }), ["oc", "run", "P", "--session", "t-2"]);
  assert.deepEqual(
    adapter.command(turn({ command: ["x", "{sessionArgs}"], session: "s-3" })),
    ["x", "--session", "s-3"],
    "an arguments placeholder expands to its own words, not to itself",
  );
});

test("a Codex stream that finished gives its last message, its session and what it used", () => {
  const stdout = line(started, { type: "turn.started" }, said("第一句"), said("第二句"), done);
  const read = adapter.read(stdout, 0, "", codex);
  assert.equal(read.text, "第二句", "the last message is the answer, not the play by play");
  assert.equal(read.session, "t-9");
  assert.deepEqual(read.usage, { input: 10, output: 3, cached: 4 });
  assert.equal(read.started, true, "a turn that got this far must not be started over in a new session");
});

test("one line that is not a JSON object fails a Codex turn, and the line number names it", () => {
  // (1) and (6): skipping the bad line and grading the rest would hide a crash behind half a message.
  const stdout = line(started, { type: "turn.started" }, said("好了"), done) + "\n最后一句话";
  const read = adapter.read(stdout, 0, "", codex);
  assert.equal(read.error, "Codex stdout 第 5 行不是 JSON 对象，原始输出保留在日志中");
  assert.equal(read.text, undefined);
});

test("cleanup noise after the turn completed is a broken line too", () => {
  // Codex on Windows leaves taskkill lines on stdout after turn.completed; a pass is never earned with them there.
  const stdout = line(started, said("好了"), done, { type: "error" }) + '\nERROR: 进程 "4242" 无法终止';
  const read = adapter.read(stdout, 0, "", codex);
  assert.match(read.error ?? "", /不是 JSON 对象/);
});

test("a JSON line that is not an object is broken as well", () => {
  const stdout = line(started, said("好了"), done) + "\n[1,2]";
  assert.match(adapter.read(stdout, 0, "", codex).error ?? "", /第 4 行不是 JSON 对象/);
});

test("a plain command's own words are its answer", () => {
  // (5): recognising Codex by its events must not let a script's text be parsed away.
  const stdout = "第一行\n不是 json\n";
  assert.deepEqual(adapter.read(stdout, 0, "", source(["node", "script.mjs", "{prompt}"])), { text: stdout });
});

test("a Codex turn that never completed is not a pass", () => {
  const stdout = line(started, said("做到一半"));
  assert.equal(adapter.read(stdout, 0, "", codex).error, "Codex 没有成功完成本轮");
});

test("a Codex turn that never named its session is not a pass", () => {
  const stdout = line({ type: "turn.started" }, said("好了"), done);
  assert.equal(adapter.read(stdout, 0, "", codex).error, "Codex 没有返回会话编号");
});

test("a Codex turn that failed says what it said", () => {
  const reported = line(started, { type: "turn.failed", error: { message: "额度用完了" } });
  assert.equal(adapter.read(reported, 0, "", codex).error, "额度用完了");
  const reportedFlat = line(started, { type: "error", message: "连不上模型" });
  assert.equal(adapter.read(reportedFlat, 0, "", codex).error, "连不上模型");
});

test("Codex is recognised by how it was called, even before it prints anything", () => {
  const read = adapter.read("随便一行\n", 0, "", source(["C:\\tools\\codex.cmd", "exec", "--json", "P"]));
  assert.match(read.error ?? "", /不是 JSON 对象/);
});

test("a turn still going, or one that died without saying, only reports the session it named", () => {
  // (2): a null code is not a failure to report.
  assert.deepEqual(adapter.read(line(started), null, "", codex), { session: "t-9" });
});

test("an exit code of its own is the reason", () => {
  // (3): whatever it printed, the number it left says why it stopped.
  const read = adapter.read('{"sessionID":"s-8"}\n坏了', 3, "找不到模型", codex);
  assert.match(read.error ?? "", /退出码 3：找不到模型/);
  assert.equal(read.session, "s-8");
});
