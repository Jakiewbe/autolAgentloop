// Anything with a print mode: its command line in rules.json, its last message on stdout. A script is an agent too, and
// a plain command needn't take the prompt at all: it finds what it needs through the environment (AGENT_AUTOLOOP_CONTEXT).
//
// Two placeholders stand for a list rather than a word, because going on in a session changes the command line itself:
// {resumeArgs} is `resume <会话>` when there is a session to go on in, nothing on the first turn; {cwdArgs} is `-C <目录>`
// on the first turn, nothing when going on (codex's resume takes no -C). A session id printed in the output as a JSON line
// with thread_id / threadId / sessionID / session_id is reported, so the next turn goes on in it.
//
// Reading is a judgement, not a copy: a program that speaks the Codex JSONL protocol is held to it (this is the one place
// B keeps a stricter reading than upstream), while a plain command still gets its text back untouched.
import { basename } from "node:path";
import { basename as winBasename } from "node:path/win32";
import { tail, type Adapter, type Reading, type Turn, type Usage } from "../../worker/agents.ts";

const PLACEHOLDER = /\{(prompt|model|effort|cwd|context|session)\}/g;
const SESSION_KEYS = ["thread_id", "threadId", "sessionID", "session_id"];
const CODEX_EVENTS = ["thread.started", "turn.started", "turn.completed", "turn.failed", "item.completed"];

/** A command word can be written with either separator; how it is spelled decides nothing about what it is. */
const programName = (word: string) => winBasename(basename(word));

function argv(turn: Turn): string[] {
  const values: Record<string, string> = {
    prompt: turn.prompt,
    model: turn.model ?? "",
    effort: turn.effort ?? "",
    cwd: turn.cwd,
    context: turn.contextFile,
    session: turn.resume ?? turn.session,
  };
  const out: string[] = [];
  for (const part of turn.command ?? []) {
    // A part that is only a placeholder standing for arguments expands to none, one, or several words.
    const token = part.trim();
    if (token === "{resumeArgs}") {
      if (turn.resume) out.push("resume", turn.resume);
      continue;
    }
    if (token === "{cwdArgs}") {
      if (!turn.resume) out.push("-C", turn.cwd);
      continue;
    }
    if (token === "{sessionArgs}") {
      const session = turn.resume ?? turn.session;
      if (session) out.push("--session", session);
      continue;
    }
    // One pass, with a function: the prompt is what someone asked for, so a {cwd} or a $& inside those words is not a
    // placeholder of its own and must arrive as written.
    out.push(part.replace(PLACEHOLDER, (_, name: string) => values[name]));
  }
  return out;
}

export default {
  command: (turn) => argv(turn),
  read(stdout, code, stderr, source?: Pick<Turn, "command">): Reading {
    // (1) Parse once at the output boundary, keeping the number of the first line that is not a JSON object.
    const events: Record<string, unknown>[] = [];
    let invalidLine: number | undefined;
    let session: string | undefined;
    // Every line of a Codex JSONL stream is the protocol, wherever it sits: one line that is not a JSON
    // object fails the turn. Cleanup noise that Codex itself prints to stdout after its terminal event
    // (run 18 carries three unredirected taskkill lines after turn.completed) is a protocol violation
    // here too — the raw log keeps it, and a turn is never graded as passed because of it.
    for (const [index, line] of stdout.split(/\r?\n/).entries()) {
      if (!line.trim()) continue;
      let value: unknown;
      try {
        value = JSON.parse(line);
      } catch {
        invalidLine ??= index + 1;
        continue;
      }
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        invalidLine ??= index + 1;
        continue;
      }
      const event = value as Record<string, unknown>;
      events.push(event);
      for (const key of SESSION_KEYS) {
        const id = event[key];
        if (typeof id === "string" && id) session = id;
      }
    }
    const known = session ? { session } : {};
    // (2) Still running, or it died without saying: the session it already named is all there is to know.
    if (code === null) return known;
    // (3) An exit code of its own is the reason, whatever it printed.
    if (code !== 0) return { error: `退出码 ${code}：${tail(stderr || stdout) || "没留下原因"}`, ...known };
    // (4) Codex is recognised by how it was called or by the events it emits; anything else keeps its text.
    const command = source?.command ?? [];
    const codexCommand =
      /^codex(?:\.(?:exe|cmd|bat))?$/i.test(programName(command[0] ?? "")) && command.includes("--json");
    const codexEvents = events.some((event) => CODEX_EVENTS.includes(event.type as string));
    // (5) A plain command's words are its answer: nothing is parsed away from it.
    if (!codexCommand && !codexEvents) return { text: stdout, ...known };
    // (6) A broken line makes the whole turn a failure, and the line number says which one.
    if (invalidLine !== undefined)
      return { error: `Codex stdout 第 ${invalidLine} 行不是 JSON 对象，原始输出保留在日志中`, ...known };
    // (7) Its own report of failure, or a turn that never completed, is what it is.
    const failed = events.find((event) => event.type === "turn.failed" || event.type === "error");
    if (failed) {
      const detail = failed.error as { message?: unknown } | undefined;
      const message = failed.message ?? detail?.message;
      return { error: typeof message === "string" && message ? message : "Codex 本轮失败", ...known };
    }
    const completed = events.findLast((event) => event.type === "turn.completed");
    if (!completed) return { error: "Codex 没有成功完成本轮", ...known };
    const codexSession = events.find((event) => event.type === "thread.started")?.thread_id;
    if (typeof codexSession !== "string" || !codexSession.trim()) return { error: "Codex 没有返回会话编号" };
    // The last message it finished is the answer; earlier ones are only how far it had got.
    let text: unknown;
    for (const event of events) {
      const item = event.item as { type?: unknown; text?: unknown } | undefined;
      if (event.type === "item.completed" && item?.type === "agent_message") text = item.text;
    }
    if (typeof text !== "string" || !text.trim()) return { error: "Codex 没有留下最终回复", session: codexSession };
    const usage: Usage = {};
    if (completed.usage !== undefined) {
      if (typeof completed.usage !== "object" || completed.usage === null || Array.isArray(completed.usage))
        return { error: "Codex usage 必须是对象", session: codexSession };
      const given = completed.usage as Record<string, unknown>;
      for (const [from, to] of [
        ["input_tokens", "input"],
        ["output_tokens", "output"],
        ["cached_input_tokens", "cached"],
      ] as const) {
        const value = given[from];
        if (value === undefined) continue;
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
          return { error: `Codex usage.${from} 必须是有限非负数字`, session: codexSession };
        usage[to] = value;
      }
    }
    // A turn that got this far had started: the worker must not start it over in a new session.
    const started = events.some((event) =>
      ["thread.started", "turn.started", "item.completed"].includes(event.type as string),
    );
    return { text, session: codexSession, started, ...(Object.keys(usage).length ? { usage } : {}) };
  },
} satisfies Adapter;
