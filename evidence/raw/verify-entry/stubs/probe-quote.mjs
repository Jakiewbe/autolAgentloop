
import { spawn } from "node:child_process";
const exe = process.argv[2];
const args = ["exec","--json","-m","deepseek-v4.1-flash-1017","Reply with only this token: AGENT_VERIFY_deadbeef"];
const quote = (v) => (v === "" ? '""' : (/[\s"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v));
function run(label, cmd, argv, opts) {
  return new Promise((resolve) => {
    const c = spawn(cmd, argv, { stdio: ["ignore","pipe","pipe"], windowsHide: true, ...opts });
    let out = ""; let err = "";
    c.stdout.on("data", d => out += d); c.stderr.on("data", d => err += d);
    c.on("close", (code) => { console.log("###", label, "exit=" + code); console.log(out.trim().split("\n").slice(-2).join("\n")); if (err.trim()) console.log("ERR:", err.trim().split("\n")[0]); resolve(); });
  });
}
const comspec = process.env.ComSpec || "cmd.exe";
const line1 = [exe, ...args].map(quote).join(" ");
await run("A verbatim outer-quoted", comspec, ["/d","/s","/c", '"' + line1 + '"'], { windowsVerbatimArguments: true });
await run("B verbatim plain", comspec, ["/d","/s","/c", line1], { windowsVerbatimArguments: true });
