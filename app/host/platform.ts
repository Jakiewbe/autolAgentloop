// Where this program meets the operating system, and the only place it does: finding a program, starting a turn so it
// outlives the worker that started it, looking at it afterwards, and stopping its whole process tree. Everything else
// in the program talks in these names and knows nothing about shells or process groups.
import { execFileSync, spawn } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";

export const WINDOWS = process.platform === "win32";
/** Windows starts the turn through this: the same rules as the POSIX wrapper below, as a process that can be stopped. */
const RUNNER = path.join(import.meta.dirname, "..", "worker", "runner.ts");
const NODE = ["--disable-warning=ExperimentalWarning"];

const found = new Map<string, string | null>();

/** A program's path from Windows' PATH and PATHEXT, with the extension a person would not type. */
export function which(name: string) {
  const hasDirectory = name.includes("/") || name.includes("\\");
  const extensions = !WINDOWS
    ? [""]
    : path.extname(name)
      ? [""]
      : ["", ...(process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD").split(";")];
  const directories = hasDirectory ? [""] : (process.env.PATH ?? "").split(path.delimiter);
  for (const directory of directories) {
    if (!hasDirectory && !directory) continue;
    for (const extension of extensions) {
      const file = path.resolve(directory, name + extension);
      if (existsSync(file)) return file;
    }
  }
  return null;
}

const onPath = (name: string) => {
  if (WINDOWS) return which(name);
  // A login shell has the PATH the owner has in a terminal; a service starts with a bare one.
  try {
    const printed = execFileSync(process.env.SHELL ?? "/bin/sh", ["-lc", `command -v ${name}`], {
      encoding: "utf8",
      timeout: 15_000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    return printed.trim().split("\n").at(-1) || null;
  } catch {
    return null;
  }
};

/** Where a program is: on the PATH a person would have, or in one of the places the caller knows. */
export function findProgram(name: string, elsewhere: () => string[] = () => []) {
  if (!found.has(name)) found.set(name, onPath(name) ?? elsewhere().find(existsSync) ?? null);
  const program = found.get(name);
  if (!program) throw new Error(`找不到 ${name}：先装好并登录`);
  return program;
}

export type TurnFiles = { out: string; err: string; result: string };
export type Launch = {
  /** Program and arguments, as the adapter built them: no shell has seen them. */
  argv: string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
  files: TurnFiles;
  /** Where the command line is written down, in a form the process that runs it reads back. */
  commandFile: string;
  /** What this launch is called in the process table, so a number reused by another process isn't mistaken for it. */
  marker: string;
  onError?: (error: Error) => void;
};

const quoted = (word: string) => `'${word.replaceAll("'", `'\\''`)}'`;

/**
 * POSIX: a login shell gives the turn the PATH and sign-in its owner has in a terminal; the command waits in a file for
 * /bin/sh because login shells disagree on how a command reads its arguments (fish has no $0 or $@), and because the
 * install path can hold any character. Output and the exit code go through that shell, so they land in their files even
 * if this program has gone by then. Detached, so the turn is its own process group: stopping it stops what it started.
 */
function launchPosix({ argv, cwd, env, files, commandFile, marker, onError }: Launch) {
  writeFileSync(commandFile, `unset AGENT_AUTOLOOP_COMMAND\nexec ${argv.map(quoted).join(" ")}\n`, { mode: 0o600 });
  const script = [
    "out=$1",
    "err=$2",
    "result=$3",
    "shift 3",
    "umask 077",
    '"$@" >"$out" 2>"$err"',
    'echo $? >"$result.tmp"',
    'mv "$result.tmp" "$result"',
    // A final external command can replace the shell before publishing its exit file.
    ":",
  ].join("\n");
  const login = [process.env.SHELL ?? "/bin/sh", "-lc", 'exec /bin/sh "$AGENT_AUTOLOOP_COMMAND"'];
  const child = spawn("/bin/sh", ["-c", script, marker, files.out, files.err, files.result, ...login], {
    cwd,
    env: { ...env, AGENT_AUTOLOOP_COMMAND: commandFile },
    detached: true,
    stdio: "ignore",
  });
  child.on("error", (error) => onError?.(error));
  child.unref();
  return child.pid!;
}

const CMD_SPECIAL = /[\s"&|<>^()%,;=]/;

/** One word of a command line read by cmd.exe: quoted once, here, and never handed to a second shell. */
const cmdWord = (word: string) =>
  CMD_SPECIAL.test(word) ? `"${word.replaceAll("%", "%%").replaceAll('"', '\\"')}"` : word;

const comspec = () => process.env.ComSpec ?? path.join(process.env.SystemRoot ?? "C:\\Windows", "System32", "cmd.exe");

export type Program = { program: string; args: string[]; shell: boolean };

/**
 * Windows has no shebang and no signals: a program is a .exe, or a script only an interpreter can run. Each is started
 * the way its own kind needs, and the words are passed as a list, not as a line a shell would split again. Only a
 * .cmd/.bat is read by cmd.exe, because nothing else can run one; its words are quoted for that one parser.
 */
export function programFor(argv: string[]): Program {
  const [name, ...rest] = argv;
  const file = path.isAbsolute(name) || name.includes("\\") || name.includes("/") ? name : (which(name) ?? name);
  const extension = path.extname(file).toLowerCase();
  if (extension === ".cmd" || extension === ".bat") {
    const line = [file, ...rest].map(cmdWord).join(" ");
    return { program: comspec(), args: ["/d", "/s", "/c", line], shell: false };
  }
  if (extension === ".ps1") {
    const powershell = which("pwsh") ?? which("powershell");
    if (!powershell) throw new Error("找不到 PowerShell：先装好 PowerShell 7 或 Windows PowerShell");
    return {
      program: powershell,
      args: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", file, ...rest],
      shell: false,
    };
  }
  return { program: file, args: rest, shell: false };
}

/**
 * Windows: a small runner of this install's own starts the turn and waits for it, with the turn's output going straight
 * into its files. It is one process to look at and one tree to stop (taskkill /T), which is what Windows offers instead
 * of a process group. It outlives the worker, so a job started before a restart is still found running after one.
 */
function launchWindows({ argv, cwd, env, files, commandFile, marker, onError }: Launch) {
  const program = programFor(argv);
  writeFileSync(commandFile, `${JSON.stringify({ ...program, cwd }, null, 2)}\n`, { mode: 0o600 });
  const child = spawn(process.execPath, [...NODE, RUNNER, commandFile, files.out, files.err, files.result, marker], {
    cwd,
    env,
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.on("error", (error) => onError?.(error));
  child.unref();
  return child.pid!;
}

/** Starts a turn as a process of its own; the pid it returns is the one that is stopped to stop the whole turn. */
export function launchTurn(launch: Launch) {
  return WINDOWS ? launchWindows(launch) : launchPosix(launch);
}

/** Whether a process with this number is there, whether or not it is ours. */
export const pidAlive = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // A process this account may not open is still there.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
};

const lines = new Map<number, { at: number; line: string | null }>();

/** What a process was started with, for telling it apart from another process that got its number. */
export function commandLineOf(pid: number) {
  if (!WINDOWS) {
    try {
      return execFileSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" });
    } catch {
      return null;
    }
  }
  const known = lines.get(pid);
  const moment = Date.now();
  if (known && moment - known.at < 2_000) return known.line;
  let line: string | null = null;
  try {
    const printed = execFileSync("wmic", ["process", "where", `processid=${pid}`, "get", "commandline", "/value"], {
      encoding: "utf8",
      timeout: 15_000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    line = /CommandLine=(.*)/.exec(printed)?.[1]?.trim() || null;
  } catch {
    try {
      const printed = execFileSync(
        "powershell",
        [
          "-NoProfile",
          "-NonInteractive",
          "-Command",
          `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`,
        ],
        { encoding: "utf8", timeout: 30_000, stdio: ["ignore", "pipe", "ignore"] },
      );
      line = printed.trim() || null;
    } catch {
      line = null;
    }
  }
  lines.set(pid, { at: moment, line });
  return line;
}

/** Whether the turn started here is still the process that has its number. */
export function runAlive(pid: number | undefined, marker: string) {
  if (!pid) return false;
  if (!WINDOWS) {
    try {
      return execFileSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" }).includes(marker);
    } catch {
      return false;
    }
  }
  if (!pidAlive(pid)) return false;
  const line = commandLineOf(pid);
  // Nothing can read a command line here: the number is all there is.
  return line === null || line.includes(marker);
}

/** Whether anything of the turn is still going: on Windows the runner waits for its turn, so it stands for the tree. */
export function runTreeAlive(pid: number | undefined) {
  if (!pid) return false;
  if (WINDOWS) return pidAlive(pid);
  try {
    // The wrapper can die before a child; zombies have already stopped and only their parent can reap them.
    return execFileSync("ps", ["-ax", "-o", "pgid=", "-o", "stat="], { encoding: "utf8" })
      .trim()
      .split("\n")
      .some((line) => {
        const [group, state] = line.trim().split(/\s+/);
        return Number(group) === pid && !state.startsWith("Z");
      });
  } catch {
    return false;
  }
}

/** Stops the turn and everything it started. Windows has no signals: the tree is ended by the console host. */
export function stopRun(pid: number | undefined, force: boolean) {
  if (!pid) return;
  if (WINDOWS) {
    // taskkill without /F refuses a console program ("只能强制终止"), and Windows hands a console program no signal to
    // wind down with, so a stop here is the whole tree ended at once.
    try {
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", timeout: 30_000 });
    } catch {}
    return;
  }
  try {
    process.kill(-pid, force ? "SIGKILL" : "SIGTERM");
  } catch {}
}
