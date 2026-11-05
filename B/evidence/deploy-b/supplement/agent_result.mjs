import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

export function verifyAgentResult({ agent, stdout, exitCode, expected }) {
  if (exitCode !== 0) throw new Error(`进程退出码为 ${exitCode}`);
  if (!expected) throw new Error("缺少本次检查的随机标识");
  if (agent === "dsh") {
    if (stdout.trim() !== expected)
      throw new Error("headless 实际回复与检查标识不一致");
    return { passed: true };
  }
  const events = stdout
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
  let text, session;
  if (agent === "claude") {
    const result = events.findLast((event) => event.type === "result");
    if (!result || result.subtype !== "success" || result.is_error)
      throw new Error("Claude 没有成功的最终结果");
    if (result.permission_denials?.length)
      throw new Error("Claude 有未获准执行的操作");
    text = result.result;
    session = result.session_id;
  } else if (agent === "codex") {
    if (
      !events.some((event) => event.type === "turn.completed") ||
      events.some((event) => ["turn.failed", "error"].includes(event.type))
    ) {
      throw new Error("Codex 没有成功完成本轮");
    }
    text = events.findLast(
      (event) =>
        event.type === "item.completed" && event.item?.type === "agent_message",
    )?.item.text;
    session = events.find(
      (event) => event.type === "thread.started",
    )?.thread_id;
  } else throw new Error(`不支持的工具：${agent}`);
  if (typeof text !== "string" || text.trim() !== expected)
    throw new Error("实际最终回复与检查标识不一致");
  if (typeof session !== "string" || !session)
    throw new Error("没有返回会话编号");
  return { passed: true, session };
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      agent: { type: "string" },
      stdout: { type: "string" },
      "exit-code": { type: "string" },
      expected: { type: "string" },
    },
  });
  try {
    console.log(
      JSON.stringify(
        verifyAgentResult({
          agent: values.agent,
          stdout: readFileSync(values.stdout, "utf8"),
          exitCode: Number(values["exit-code"]),
          expected: values.expected,
        }),
      ),
    );
  } catch (error) {
    console.error(JSON.stringify({ passed: false, error: error.message }));
    process.exitCode = 1;
  }
}
