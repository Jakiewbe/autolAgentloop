// Installing the start-up script on Windows: it must land in this user's Startup folder, be recognisable, and be
// removable without touching anything else. APPDATA points at a scratch folder so the real one is never touched.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const scratch = join(import.meta.dirname, "service-scratch");
process.env.APPDATA = join(scratch, "appdata");
process.env.AGENT_AUTOLOOP_HOME = join(scratch, "home");
mkdirSync(process.env.APPDATA, { recursive: true });
mkdirSync(process.env.AGENT_AUTOLOOP_HOME, { recursive: true });

const { installService, removeService, serviceRunning, startupFile } = await import("../../../app/host/service.ts");

const file = startupFile();
console.log("startup file  =", file);
console.log("in this user's startup folder =", file.startsWith(join(process.env.APPDATA, "Microsoft", "Windows", "Start Menu", "Programs", "Startup")));
console.log("missing before install =", existsSync(file) === false, "| serviceRunning before =", serviceRunning());

installService();
const text = readFileSync(file, "utf8");
console.log("created =", existsSync(file));
console.log("line endings CRLF =", !/[^\r]\n/.test(text));
console.log("sets this home  =", text.includes(process.env.AGENT_AUTOLOOP_HOME));
console.log("starts up      =", text.includes("agent-autoloop.ts") && text.includes('"up"'));
console.log("log folder ready =", existsSync(join(process.env.AGENT_AUTOLOOP_HOME, "logs")));
console.log("restarts       =", text.includes("goto agent-autoloop") && text.includes("timeout /t 10"));
console.log("logs           =", text.includes(join(process.env.AGENT_AUTOLOOP_HOME, "logs", "up.log")));
console.log("serviceRunning while no up process =", serviceRunning());
console.log("---- script ----");
console.log(text);

// A file that is not ours must be left alone.
const stranger = startupFile();
writeFileSync(stranger, "@echo off\r\necho something else\r\n");
removeService();
console.log("stranger kept =", existsSync(stranger));

installService();
removeService();
console.log("removed after install =", existsSync(startupFile()) === false);
