
import { spawn } from "node:child_process";
const exe = process.argv[2];
const args = ["exec","--json","-m","m","Reply with only this token: AGENT_VERIFY_cafe"];
const quote = (v) => (v === "" ? '""' : (/[\s"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v));
const comspec = process.env.ComSpec || "cmd.exe";
const line = [exe, ...args].map(quote).join(" ");
const c = spawn(comspec, ["/d","/s","/c", '"' + line + '"'], { stdio: ["ignore","pipe","pipe"], windowsHide: true, windowsVerbatimArguments: true });
let out = ""; let err = "";
c.stdout.on("data", d => out += d); c.stderr.on("data", d => err += d);
c.on("close", (code) => { console.log("exit=" + code); console.log(out.trim()); if (err.trim()) console.log("ERR:", err.trim()); });
