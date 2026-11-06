// Anything with a print mode: its command line in rules.json, its last message on stdout. A script is an agent too, and
// a plain command needn't take the prompt at all: it finds what it needs through the environment (AGENT_AUTOLOOP_CONTEXT).
//
// Two placeholders stand for a list rather than a word, because going on in a session changes the command line itself:
// {resumeArgs} is `resume <会话>` when there is a session to go on in, nothing on the first turn; {cwdArgs} is `-C <目录>`
// on the first turn, nothing when going on (codex's resume takes no -C). A session id printed in the output as a JSON line
// with thread_id / threadId / sessionID / session_id is reported, so the next turn goes on in it.
import { tail, type Adapter, type Turn } from "../../worker/agents.ts";

const SESSION_KEYS = ["thread_id", "threadId", "sessionID", "session_id"];

/** The session an agent said it is in, if its output names one: the last JSON line that carries it wins. */
export function sessionOf(stdout: string): string | undefined {
  let found: string | undefined;
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    let value: unknown;
    try {
      value = JSON.parse(trimmed);
    } catch {
      continue;
    }
    for (const key of SESSION_KEYS) {
      const id = (value as Record<string, unknown>)[key];
      if (typeof id === "string" && id) found = id;
    }
  }
  return found;
}

/** A print mode that answers in JSON lines (codex --json, opencode --format json): the message is a field, not stdout. */
export function messageOf(stdout: string): string | undefined {
  const lines = stdout.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length || !lines.every((line) => line.trim().startsWith("{"))) return undefined;
  // The last message is the answer: earlier ones are the agent saying what it is about to do.
  let last = "";
  for (const line of lines) {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      return undefined;
    }
    const item = (value as { item?: { type?: string; text?: string } }).item;
    if (item?.type === "agent_message" && typeof item.text === "string") last = item.text;
  }
  return last;
}

function argv(turn: Turn): string[] {
  const out: string[] = [];
  for (const part of turn.command ?? []) {
    const token = part.trim();
    // A part that is only a placeholder standing for arguments expands to none, one, or several words.
    if (token === "{resumeArgs}") {
      if (turn.resume) out.push("resume", turn.resume);
      continue;
    }
    if (token === "{cwdArgs}") {
      if (!turn.resume) out.push("-C", turn.cwd);
      continue;
    }
    if (token === "{sessionArgs}") {
      if (turn.resume ?? turn.session) out.push("--session", turn.resume ?? turn.session);
      continue;
    }
    out.push(
      part
        .replaceAll("{prompt}", turn.prompt)
        .replaceAll("{model}", turn.model ?? "")
        .replaceAll("{effort}", turn.effort ?? "")
        .replaceAll("{cwd}", turn.cwd)
        .replaceAll("{session}", turn.resume ?? turn.session)
        .replaceAll("{context}", turn.contextFile),
    );
  }
  return out;
}

export default {
  command: (turn) => argv(turn),
  read(stdout, code, stderr) {
    const session = sessionOf(stdout);
    if (code === null) return session ? { session } : {};
    if (code !== 0) return { error: `退出码 ${code}：${tail(stderr || stdout) || "没留下原因"}`, ...(session ? { session } : {}) };
    return { text: messageOf(stdout) ?? stdout, ...(session ? { session } : {}) };
  },
} satisfies Adapter;
