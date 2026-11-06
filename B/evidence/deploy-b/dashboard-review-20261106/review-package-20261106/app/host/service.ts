// Keeping it running: launchd on a Mac, systemd on Linux, the sign-in Startup folder on Windows. All three start it at
// sign-in; the first two also start it again if it stops, which is what the Windows script's loop is for.
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { HOME } from "./home.ts";
import { WINDOWS, commandLineOf, pidAlive } from "./platform.ts";

const PROGRAM = path.join(import.meta.dirname, "..", "bin", "agent-autoloop.ts");
/** Another install on this machine (another AGENT_AUTOLOOP_HOME) has a service of its own. */
const label = () =>
  HOME === path.join(homedir(), ".agent-autoloop")
    ? "agent-autoloop"
    : `agent-autoloop-${createHash("sha256").update(HOME).digest("hex").slice(0, 8)}`;
const plistFile = () => path.join(homedir(), "Library/LaunchAgents", `${label()}.plist`);
const unitFile = () => path.join(homedir(), ".config/systemd/user", `${label()}.service`);
/** Windows has no service manager here: one script in a folder Windows runs at sign-in, and nothing else on the machine. */
const startupDir = () =>
  path.join(
    process.env.APPDATA ?? path.join(homedir(), "AppData", "Roaming"),
    "Microsoft",
    "Windows",
    "Start Menu",
    "Programs",
    "Startup",
  );
export const startupFile = () => path.join(startupDir(), `${label()}.cmd`);
const xml = (text: string) => text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export type UnitOptions = {
  home: string;
  executable: string;
  program: string;
};

const systemdItem = (text: string, escapeDollar = false) => {
  if (/[\u0000-\u001f\u007f]/u.test(text)) throw new Error("systemd unit 的值不能包含控制字符");
  let escaped = text.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("%", "%%");
  if (escapeDollar) escaped = escaped.replaceAll("$", () => "$$");
  return `"${escaped}"`;
};

export function plist() {
  const logs = path.join(HOME, "logs");
  const systemPaths = ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"];
  const searchPath = [path.dirname(process.execPath), ...systemPaths].join(":");
  const program = [process.execPath, "--disable-warning=ExperimentalWarning", PROGRAM, "up"];
  const programArguments = program.map((part) => `<string>${xml(part)}</string>`).join("");
  const homeEntry = `<key>AGENT_AUTOLOOP_HOME</key><string>${xml(HOME)}</string>`;
  const pathEntry = `<key>PATH</key><string>${xml(searchPath)}</string>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${label()}</string>
  <key>ProgramArguments</key><array>${programArguments}</array>
  <key>EnvironmentVariables</key><dict>${homeEntry}${pathEntry}</dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>${xml(logs)}/up.log</string>
  <key>StandardErrorPath</key><string>${xml(logs)}/up.log</string>
</dict></plist>
`;
}

export function unit(options: UnitOptions = { home: HOME, executable: process.execPath, program: PROGRAM }) {
  const environment = systemdItem(`AGENT_AUTOLOOP_HOME=${options.home}`);
  const command = [options.executable, "--disable-warning=ExperimentalWarning", options.program, "up"]
    .map((part) => systemdItem(part, true))
    .join(" ");
  return `[Unit]
Description=Agent 自动化中台

[Service]
Environment=${environment}
ExecStart=${command}
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
`;
}

/**
 * Windows: a script Windows itself runs at sign-in, with a loop that starts it again after ten seconds if it stops.
 * Deleting this one file, which is in the owner's own Startup folder, is the whole undo.
 */
export function startupScript() {
  const logs = path.join(HOME, "logs", "up.log");
  // cmd reads % first, so a percent in a path would otherwise be taken for a variable.
  const word = (text: string) => `"${text.replaceAll("%", "%%")}"`;
  const command = [process.execPath, "--disable-warning=ExperimentalWarning", PROGRAM, "up"].map(word).join(" ");
  return [
    "@echo off",
    "rem Starts it at sign-in, and again after ten seconds if it stops. Delete this file to stop that.",
    `set "AGENT_AUTOLOOP_HOME=${HOME.replaceAll("%", "%%")}"`,
    ":agent-autoloop",
    `${command} >>${word(logs)} 2>&1`,
    "timeout /t 10 /nobreak >nul",
    "goto agent-autoloop",
    "",
  ].join("\r\n");
}

const domain = () => `gui/${process.getuid!()}`;
const launchdHasIt = () =>
  spawnSync("launchctl", ["print", `${domain()}/${label()}`], { stdio: "ignore" }).status === 0;
const pause = (ms: number) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

export function installService() {
  mkdirSync(path.join(HOME, "logs"), { recursive: true, mode: 0o700 });
  if (WINDOWS) {
    mkdirSync(startupDir(), { recursive: true });
    writeFileSync(startupFile(), startupScript());
    return;
  }
  if (process.platform === "darwin") {
    mkdirSync(path.dirname(plistFile()), { recursive: true });
    writeFileSync(plistFile(), plist());
    spawnSync("launchctl", ["bootout", `${domain()}/${label()}`], { stdio: "ignore" });
    // bootout returns before the old one is gone; loading before that fails and leaves none.
    for (let tries = 0; tries < 100 && launchdHasIt(); tries++) pause(100);
    execFileSync("launchctl", ["bootstrap", domain(), plistFile()]);
  } else {
    mkdirSync(path.dirname(unitFile()), { recursive: true });
    writeFileSync(unitFile(), unit());
    execFileSync("systemctl", ["--user", "daemon-reload"]);
    execFileSync("systemctl", ["--user", "enable", "--now", label()]);
    execFileSync("systemctl", ["--user", "restart", label()]);
  }
}

export function removeService() {
  if (WINDOWS) {
    // Only a script this install wrote is removed: another install's file is left alone.
    if (!existsSync(startupFile())) return;
    if (!readFileSync(startupFile(), "utf8").includes(PROGRAM)) return;
    stopUp();
    rmSync(startupFile(), { force: true });
    return;
  }
  const file = process.platform === "darwin" ? plistFile() : unitFile();
  if (!existsSync(file)) return;
  const service = readFileSync(file, "utf8");
  const ownsService =
    process.platform === "darwin"
      ? service.includes(xml(PROGRAM))
      : service.includes(systemdItem(PROGRAM, true)) || service.includes(PROGRAM);
  if (!ownsService) return;
  if (process.platform === "darwin") {
    spawnSync("launchctl", ["bootout", `${domain()}/${label()}`], { stdio: "ignore" });
    rmSync(plistFile(), { force: true });
  } else {
    spawnSync("systemctl", ["--user", "disable", "--now", label()], { stdio: "ignore" });
    rmSync(unitFile(), { force: true });
  }
}

/** The process that left its number in up.pid, if it still is that process: the number may be someone else's by now. */
export function runningUp() {
  const file = path.join(HOME, "up.pid");
  if (!existsSync(file)) return null;
  const number = Number(readFileSync(file, "utf8").trim());
  if (!Number.isInteger(number) || number <= 0) return null;
  // The number may belong to someone else by now, so what it is started with is what tells them apart.
  if (!pidAlive(number)) return null;
  const command = commandLineOf(number) ?? "";
  return /agent-autoloop(\.ts)? up\b/.test(command) ? number : null;
}

/** Stopping a service returns before its process is gone, and one started by hand has no service to stop it. */
export function stopUp() {
  const pid = runningUp();
  if (pid === null) return;
  if (WINDOWS) {
    // Windows has no SIGTERM to hand a console program: the process is ended, and the number it left behind is
    // recognised as stale on the next start.
    spawnSync("taskkill", ["/PID", String(pid), "/T"], { stdio: "ignore" });
    for (let tries = 0; tries < 50 && runningUp() !== null; tries++) pause(100);
    if (runningUp() !== null) spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {}
  for (let tries = 0; tries < 50 && runningUp() !== null; tries++) pause(100);
}

export function serviceRunning() {
  if (WINDOWS) return existsSync(startupFile()) && runningUp() !== null;
  if (process.platform === "darwin") return existsSync(plistFile()) && launchdHasIt();
  return spawnSync("systemctl", ["--user", "is-active", "--quiet", label()], { stdio: "ignore" }).status === 0;
}
