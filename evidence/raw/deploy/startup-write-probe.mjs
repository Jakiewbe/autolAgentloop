// Isolated reproduction: can this node process create a .cmd in the sign-in Startup folder?
import { mkdirSync, writeFileSync, existsSync, unlinkSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const dir = path.join(process.env.APPDATA ?? path.join(homedir(), "AppData", "Roaming"), "Microsoft", "Windows", "Start Menu", "Programs", "Startup");
console.log("startup dir:", dir);
console.log("exists:", existsSync(dir));
console.log("before:", readdirSync(dir).join(" | "));
try {
  mkdirSync(dir, { recursive: true });
  console.log("mkdir ok");
} catch (e) {
  console.log("mkdir failed:", e.code, e.message);
}
for (const name of ["probe-a.cmd", "probe-b.txt"]) {
  const file = path.join(dir, name);
  try {
    writeFileSync(file, "@echo off\r\n");
    console.log("write ok:", name);
    unlinkSync(file);
    console.log("unlink ok:", name);
  } catch (e) {
    console.log("write failed:", name, e.code, e.message);
  }
}
