
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const child = spawn(process.execPath, ["-e", "setTimeout(()=>{},60000)"], { stdio: "ignore", windowsHide: true });
fs.writeFileSync(process.argv[2], String(process.pid) + " " + String(child.pid));
setTimeout(()=>{}, 60000);
