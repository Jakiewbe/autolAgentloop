// 起一个隔离中心 + 受审包真实面板（未改一个字节），给用例一个可用入口。
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

export const HERE = import.meta.dirname;
export const REVIEW = path.join(HERE, "..");
export const SUITE_ROOT = path.join(REVIEW, "selftest-v2");
export const EXTRACT = process.env.REVIEW_EXTRACT ?? path.join(REVIEW, "extract-v2-c66a3c64");
export const DASHBOARD_DIR = path.join(EXTRACT, "dashboard");
export const DASHBOARD_MAIN = path.join(DASHBOARD_DIR, "server.mjs");
export const RULES = process.env.REVIEW_RULES ?? path.join(SUITE_ROOT, "rules-v2.json");

function waitLine(child, prefix, timeout, label) {
  return new Promise((resolve, reject) => {
    let out = "";
    let err = "";
    const timer = setTimeout(() => reject(new Error(label + " 没起来: " + err.slice(-400))), timeout);
    child.stdout.on("data", (chunk) => {
      out += String(chunk);
      const line = out.split("\n").find((entry) => entry.startsWith(prefix));
      if (!line) return;
      clearTimeout(timer);
      resolve({ child: child, info: JSON.parse(line.slice(prefix.length)) });
    });
    child.stderr.on("data", (chunk) => (err += String(chunk)));
    child.on("exit", (code) => {
      if (code !== 0) {
        clearTimeout(timer);
        reject(new Error(label + " 退出 " + code + ": " + err.slice(-400)));
      }
    });
  });
}

export function startCenter(rules = RULES) {
  const child = spawn(process.execPath, [path.join(REVIEW, "selftest", "center.mjs")], {
    cwd: REVIEW,
    env: { ...process.env, REVIEW_RULES: rules },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return waitLine(child, "CENTER_READY ", 40000, "隔离中心");
}

export function startBoard(centerFile) {
  const child = spawn(process.execPath, [path.join(HERE, "launcher.mjs")], {
    cwd: HERE,
    env: { ...process.env, CENTER_FILE: centerFile, DASHBOARD_MAIN: DASHBOARD_MAIN },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return waitLine(child, "BOARD_READY ", 30000, "受审面板");
}

export function bootBoard(rules) {
  return startCenter(rules).then((center) => {
    const centerFile = path.join(center.info.home, "review-center.json");
    return startBoard(centerFile).then((board) => ({
      center: center.info,
      centerFile: centerFile,
      hub: JSON.parse(readFileSync(centerFile, "utf8")),
      url: board.info.url,
      children: [center.child, board.child],
    }));
  });
}

if (process.argv[1] && process.argv[1].endsWith("board.mjs")) {
  const live = await bootBoard();
  console.log("BOARD_URL " + live.url);
  console.log("CENTER_URL " + live.center.publicUrl);
  console.log("CENTER_HOME " + live.center.home);
  process.on("SIGINT", () => {
    for (const child of live.children) child.kill();
    process.exit(0);
  });
}