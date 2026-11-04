// The three Windows entry kinds, started the way a turn is started: a .exe, a .cmd (through %ComSpec% /d /s /c) and a
// .ps1 (through pwsh/powershell -File). Each writes its output and exit code where the worker looks for them.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { launchTurn, runTreeAlive, stopRun } from "../../../app/host/platform.ts";

const here = import.meta.dirname;
const work = join(here, "entry-kinds");
mkdirSync(work, { recursive: true });

const ps1 = join(work, "hello.ps1");
writeFileSync(ps1, 'Write-Output "powershell 入口 ok"\nexit 0\n');
const cmd = join(work, "hello.cmd");
writeFileSync(cmd, '@echo off\r\necho cmd 入口 ok\r\nexit /b 0\r\n');
const exe = join(work, "hello.mjs");
writeFileSync(exe, 'process.stdout.write("exe 入口 ok\\n");\n');

const run = async (name: string, argv: string[]) => {
  const dir = join(work, name);
  mkdirSync(dir, { recursive: true });
  const files = { out: join(dir, "stdout-1.log"), err: join(dir, "stderr-1.log"), result: join(dir, "exit-1") };
  const pid = launchTurn({
    argv,
    cwd: work,
    env: process.env,
    files,
    commandFile: join(dir, "command-1.json"),
    marker: "agent-autoloop-run:77:1:1",
  });
  const end = Date.now() + 30_000;
  while (!existsSync(files.result)) {
    if (Date.now() > end) {
      stopRun(pid, true);
      throw new Error(name + " 没写出 exit 文件");
    }
    await new Promise((again) => setTimeout(again, 100));
  }
  const spec = JSON.parse(readFileSync(join(dir, "command-1.json"), "utf8"));
  console.log(
    name,
    "| exit=" + readFileSync(files.result, "utf8").trim(),
    "| out=" + JSON.stringify(readFileSync(files.out, "utf8").trim()),
    "| shell=" + spec.shell,
    "| program=" + spec.program,
    "| args=" + JSON.stringify(spec.args),
    "| tree gone=" + !runTreeAlive(pid),
  );
};

await run("exe", [process.execPath, exe]);
await run("cmd", [cmd]);
await run("ps1", [ps1]);
