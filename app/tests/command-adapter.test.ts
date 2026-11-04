// Failure modes: the resume flag goes on the first turn as well (codex's resume takes no -C), the session id an agent
// prints is dropped so every turn starts over, and a part that is only a placeholder is passed through as that word.
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
  command: ["codex", "exec", "{resumeArgs}", "--skip-git-repo-check", "{cwdArgs}", "{prompt}"],
  contextFile: "C:/home/context.md",
  folder: "C:/work",
  ...over,
});

test("the first turn gets the folder flag and no resume", () => {
  assert.deepEqual(adapter.command(turn()), ["codex", "exec", "--skip-git-repo-check", "-C", "C:/work", "P"]);
});

test("going on in a session puts resume and the id first, and drops the flag that resume refuses", () => {
  assert.deepEqual(adapter.command(turn({ resume: "t-1" })), [
    "codex",
    "exec",
    "resume",
    "t-1",
    "--skip-git-repo-check",
    "P",
  ]);
});

test("a word can still carry a placeholder, and the session can be asked for by name", () => {
  const one = turn({ command: ["oc", "run", "{prompt}", "--session", "{session}"] });
  assert.deepEqual(adapter.command(one), ["oc", "run", "P", "--session", "s-new"]);
  assert.deepEqual(adapter.command({ ...one, resume: "t-2" }), ["oc", "run", "P", "--session", "t-2"]);
});

test("the session an agent says it is in comes back from its output", () => {
  const stdout = ['{"type":"thread.started","thread_id":"t-9"}', '{"type":"item","text":"好了"}', "最后一句话"].join("\n");
  assert.deepEqual(adapter.read(stdout, 0, ""), { text: stdout, session: "t-9" });
  assert.deepEqual(adapter.read(stdout, null, ""), { session: "t-9" });
  assert.deepEqual(adapter.read("没有 json\n", 0, ""), { text: "没有 json\n" });
});

test("a print mode that answers in JSON lines gives its message, not the wrapper", () => {
  const stdout = [
    '{"type":"thread.started","thread_id":"t-9"}',
    '{"type":"turn.started"}',
    '{"type":"item.completed","item":{"id":"item_0","type":"agent_message","text":"第一句"}}',
    '{"type":"item.completed","item":{"id":"item_1","type":"agent_message","text":"第二句"}}',
    '{"type":"turn.completed","usage":{"input_tokens":10}}',
  ].join("\n");
  const read = adapter.read(stdout, 0, "") as { text?: string; session?: string };
  assert.equal(read.text, "第二句", "the last message is the answer, not the play by play");
  assert.equal(read.session, "t-9");
  // Mixed or broken output is left alone: guessing there would hide a crash behind half a message.
  assert.equal((adapter.read('{"type":"x"}\n不是 json', 0, "") as { text?: string }).text, '{"type":"x"}\n不是 json');
});

test("a turn that fails says why, and keeps the session it named", () => {
  const read = adapter.read('{"sessionID":"s-8"}\n坏了', 3, "") as { error?: string; session?: string };
  assert.match(read.error ?? "", /退出码 3/);
  assert.equal(read.session, "s-8");
});
