// verify-b-node-filtered.mjs —— 在 verify-b-node.mjs 基础上，剔除 codex 0.130 在 Windows 沙箱里
// 由 taskkill 子进程混入 stdout 的非 JSON 行（GBK 编码），再交包内 agent_result.mjs 判分。
// 丢弃行数与原文全部记录在日志里，便于 A 侧复核；这不是把失败改成通过。
// 目的：Windows 下 PowerShell 的 &/Start-Process 重定向会让子进程继承文件句柄，
// codex 的沙箱子进程(taskkill)输出会写进 stdout 文件，破坏 JSONL 解析。
// 本脚本用管道 spawn，agent 子进程不继承文件句柄；判分仍调用包内 agent_result.mjs。
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { verifyAgentResult } from "./agent_result.mjs";

function filterNoise(raw) {
  const kept = [], dropped = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (line.trimStart().startsWith("{")) kept.push(line);
    else dropped.push(line);
  }
  return { text: kept.join("\n"), dropped };
}

const args = process.argv.slice(2);
const opt = {};
for (let i = 0; i < args.length; i++) if (args[i].startsWith("--")) { opt[args[i].slice(2)] = args[i + 1]; i++; }
const agent = opt.agent, exe = opt.executable, model = opt.model, settings = opt.settings;
const outDir = opt["output-dir"] || join(process.cwd(), "verification-output");
if (!agent || !exe || !model) { console.error(JSON.stringify({ passed: false, error: "缺少 --agent/--executable/--model" })); process.exit(2); }
mkdirSync(outDir, { recursive: true });
const expected = "AGENT_VERIFY_" + randomUUID().replace(/-/g, "");
const prompt = "Reply with only this token: " + expected;
const agentArgs = agent === "claude"
  ? ["-p", prompt, "--output-format", "json", "--model", model, "--settings", settings, "--strict-mcp-config"]
  : ["exec", "--json", "--skip-git-repo-check", "--sandbox", "workspace-write", "-m", model, prompt];

const child = spawn(exe, agentArgs, { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
let out = "", err = "";
child.stdout.setEncoding("utf8"); child.stderr.setEncoding("utf8");
child.stdout.on("data", d => { out += d; });
child.stderr.on("data", d => { err += d; });
child.on("error", e => { console.error(JSON.stringify({ passed: false, error: "spawn: " + e.message })); process.exit(3); });
child.on("close", code => {
  const stdoutFile = join(outDir, "model.stdout.jsonl"), stderrFile = join(outDir, "model.stderr.log");
  writeFileSync(stdoutFile, out, "utf8");
  writeFileSync(stderrFile, err, "utf8");
  console.log(JSON.stringify({ agent, native_exit: code, stdout_file: stdoutFile, stdout_bytes: out.length, stderr_bytes: err.length }));
  const f = filterNoise(out);
  writeFileSync(join(outDir, "model.stdout.filtered.jsonl"), f.text, "utf8");
  console.log(JSON.stringify({ agent, dropped_lines: f.dropped.length, dropped_samples: f.dropped.slice(0, 5).map(s => Buffer.from(s, "utf8").toString("latin1")) }));
  let verdict;
  try { verdict = verifyAgentResult({ agent, stdout: f.text, exitCode: code, expected }); }
  catch (e) { verdict = { passed: false, error: e.message }; }
  console.log(JSON.stringify({ agent, expected, ...verdict }));
  process.exit(verdict.passed ? 0 : 1);
});
