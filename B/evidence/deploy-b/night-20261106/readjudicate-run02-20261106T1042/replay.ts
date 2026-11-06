
import { readFileSync } from "node:fs";
import archived from "./plugins/command/agent.ts";

const stdout = readFileSync(new URL("./replay-stdout.jsonl", import.meta.url), "utf8");
const stderr = readFileSync(new URL("./replay-stderr.log", import.meta.url), "utf8");
const command = [
  "C:/Users/19082/.codex-nighttest-20261106/codex-medium.exe",
  "exec", "--skip-git-repo-check", "-C", "D:\\AutoAgentloop", "--json",
  "-m", "deepseek-v4.1-flash-1017",
  "Use the node_repl MCP tool to evaluate the JavaScript expression 1+1, then reply with only the numeric result and nothing else.",
];

const out: string[] = [];
const A = archived.read(stdout, 0, stderr, { command });
out.push("A exact-replay code=0 => " + JSON.stringify(A));

const lines = stdout.split(/\r?\n/).filter((l) => l.trim());
// B: inject a non-JSON line before the terminal event
const injected = [...lines];
injected.splice(injected.length - 1, 0, "SUCCESS: taskkill (pid 11480)");
out.push("B nonJSON-before-terminal => " + JSON.stringify(archived.read(injected.join("\n") + "\n", 0, stderr, { command })));

// C: drop turn.completed
const noTerminal = lines.filter((l) => !l.includes('"turn.completed"'));
out.push("C missing-turn.completed => " + JSON.stringify(archived.read(noTerminal.join("\n"), 0, stderr, { command })));

// D: upstream exit code non-zero
out.push("D code=11 => " + JSON.stringify(archived.read(stdout, 11, stderr, { command })));

// E: mcp_tool_call evidence extraction
const events = lines.map((l) => JSON.parse(l));
const calls = events.filter((e: any) => e.item?.type === "mcp_tool_call").map((e: any) => ({
  id: e.item.id, server: e.item.server, tool: e.item.tool,
  args: e.item.arguments, status: e.item.status,
  resultText: e.item.result?.content?.map((c: any) => c.text) ?? null,
}));
out.push("E mcp_calls => " + JSON.stringify(calls));
const terminal = events.findLast((e: any) => e.type === "turn.completed");
const agent = events.findLast((e: any) => e.item?.type === "agent_message");
const started = events.find((e: any) => e.type === "thread.started");
out.push("F thread_id=" + started.thread_id + " agent_message=" + JSON.stringify(agent.item.text) + " usage=" + JSON.stringify(terminal.usage));
out.push("G cached<=input => " + (terminal.usage.cached_input_tokens <= terminal.usage.input_tokens));
console.log(out.join("\n"));
