// Go uses the existing Claude protocol; the deployment supplies its executable and private provider settings explicitly.
import claude from "../claude/agent.ts";
import type { Adapter, Reading } from "../../worker/agents.ts";

export default {
  command(turn) {
    const [program, settings] = turn.command ?? [];
    if (!program || !settings) throw new Error("Claude/Go 的 command 必须提供执行文件和私有配置路径");
    return [
      program,
      "-p",
      turn.prompt,
      "--output-format",
      "json",
      "--settings",
      settings,
      "--strict-mcp-config",
      ...(turn.resume ? ["--resume", turn.resume] : ["--session-id", turn.session]),
      ...(turn.model ? ["--model", turn.model] : []),
      "--permission-mode",
      { read: "plan", edit: "acceptEdits", full: "bypassPermissions" }[turn.access],
      "--add-dir",
      turn.folder,
      "--disallowedTools=EnterWorktree,ExitWorktree",
    ];
  },
  read(stdout, code, stderr) {
    const result: Reading = claude.read(stdout, code, stderr);
    // Claude's local price estimate is not the amount charged by OpenCode Go.
    delete result.sessionUsage;
    return result;
  },
  link: claude.link,
} satisfies Adapter;
