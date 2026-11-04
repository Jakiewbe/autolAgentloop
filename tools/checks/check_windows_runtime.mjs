#!/usr/bin/env node
// T6 自校验：在 app/ 目录内跑 Windows 原生生命周期回归（真实起进程），把子进程退出码透传。
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(here, "..", "..", "app");
const child = spawn(process.execPath, ["--test", "--test-force-exit", "tests/windows-runtime.test.ts"], {
  cwd: appDir,
  stdio: "inherit",
  shell: false,
});
child.on("exit", (code, signal) => {
  if (signal) { console.error("child killed by " + signal); process.exit(1); }
  process.exit(code ?? 1);
});
child.on("error", (err) => { console.error("spawn failed: " + err.message); process.exit(1); });
