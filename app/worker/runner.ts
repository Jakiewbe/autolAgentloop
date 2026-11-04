// Runs one turn on Windows: starts the agent where the worker said, puts its output in the files the worker reads, and
// publishes its exit code where the worker looks for it. It is the process the worker's pid names, so stopping it
// (taskkill /T) stops everything the turn started, and it outlives the worker, so a turn started before a restart is
// still found running after one. Nothing here goes through a shell: the words arrive as a list.
import { spawn } from "node:child_process";
import { closeSync, openSync, readFileSync, renameSync, writeFileSync } from "node:fs";

const [commandFile, out, err, result, marker] = process.argv.slice(2);
const spec = JSON.parse(readFileSync(commandFile, "utf8")) as { program: string; args: string[]; shell?: boolean };

/** The worker reads the exit code from this file; it is written whole, then renamed, so it never reads half. */
function publish(code: number) {
  try {
    writeFileSync(`${result}.tmp`, String(code));
    renameSync(`${result}.tmp`, result);
  } catch {}
}

const stdout = openSync(out, "w");
const stderr = openSync(err, "w");
// The marker is only here so the process table carries it: the worker tells its own turn apart from a number reused.
const child = spawn(spec.program, spec.args, {
  stdio: ["ignore", stdout, stderr],
  windowsHide: true,
  shell: spec.shell === true,
});

child.on("error", (error) => {
  try {
    writeFileSync(err, `${error}\n`);
  } catch {}
  publish(127);
  closeSync(stdout);
  closeSync(stderr);
  process.exit(127);
});

child.on("exit", (code, signal) => {
  publish(code ?? (signal === "SIGTERM" ? 143 : signal === "SIGKILL" ? 137 : 1));
  closeSync(stdout);
  closeSync(stderr);
  process.exit(0);
});

// Nothing to do but wait: the marker keeps this process identifiable while the turn runs.
void marker;
