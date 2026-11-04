
const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs");
const killer = (args) => {
  try {
    const out = execFileSync("taskkill", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { code: 0, out: out.trim() };
  } catch (error) {
    return { code: error.status, out: String(error.stdout || "") + String(error.stderr || "") };
  }
};
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } };
const child = spawn(process.execPath, ["-e", "setTimeout(()=>{},60000)"], { stdio: "ignore", windowsHide: true });
console.log("parent", process.pid, "child", child.pid, "childAlive", alive(child.pid));
console.log("soft", JSON.stringify(killer(["/PID", String(process.pid), "/T"])));
setTimeout(() => {
  console.log("afterSoft childAlive", alive(child.pid));
  console.log("hard", JSON.stringify(killer(["/PID", String(child.pid), "/T", "/F"])));
  setTimeout(() => { console.log("afterHard childAlive", alive(child.pid)); process.exit(0); }, 1500);
}, 1500);
