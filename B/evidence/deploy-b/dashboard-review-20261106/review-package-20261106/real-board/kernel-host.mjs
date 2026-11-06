// 只做一件事：用给定 HOME 起一个真实内核实例（不建 worker 循环），供 /c/ 头与过期行为取证。
// 用法：AGENT_AUTOLOOP_HOME=<home> AGENT_AUTOLOOP_PUBLIC_URL=http://127.0.0.1:<port> node kernel-host.mjs <port> <appDir>
// Q4_BOOTSTRAP=1 时先用 app/host/runtime.ts 的 addKey 现生成探针要用的密钥（只写进这个临时 HOME）。
import path from "node:path";
import { pathToFileURL } from "node:url";

const port = Number(process.argv[2]);
const appDir = process.argv[3] ?? path.join(import.meta.dirname, "..", "app");
const runtime = process.env.Q4_BOOTSTRAP === "1"
  ? await import(pathToFileURL(path.join(appDir, "host", "runtime.ts")).href)
  : null;
const keys = runtime
  ? { owner: runtime.addKey("owner", "q4-owner"), source: runtime.addKey("source", "q4-app"), channel: runtime.addKey("channel", "q4-chat") }
  : null;
const { serve } = await import(pathToFileURL(path.join(appDir, "host", "http.ts")).href);
const server = serve(port, "127.0.0.1", { commit: "q4-centry" });
server.on("error", (error) => {
  console.error("KERNEL_ERROR " + String(error && error.message));
  process.exitCode = 1;
});
await new Promise((resolve, reject) => {
  server.on("listening", resolve);
  server.on("error", reject);
});
console.log("KERNEL_READY " + JSON.stringify({ port, keys }));
process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
