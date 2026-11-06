// 只做一件事：把受审包里的 dashboard/server.mjs 原样挂到一个随机回环端口上。
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const file = process.env.CENTER_FILE;
const main = process.env.DASHBOARD_MAIN;
const center = JSON.parse(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
const mod = await import(pathToFileURL(main).href);
const server = mod.createDashboard({ owner: center.keys.owner, hubUrl: center.publicUrl });
server.on("error", (error) => {
  console.error("BOARD_ERROR " + String(error && error.message));
  process.exitCode = 1;
});
server.listen(0, "127.0.0.1", () => {
  const url = "http://127.0.0.1:" + server.address().port;
  console.log("BOARD_READY " + JSON.stringify({ url: url, dashboard: main }));
});
process.on("SIGTERM", () => server.close(() => process.exit(0)));