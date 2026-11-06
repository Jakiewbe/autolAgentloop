// 隔离假中心：临时 AGENT_AUTOLOOP_HOME + 回环随机端口 + 只读复制的 fixture 规则。
// 不接触生产 HOME、不读 A 的身份/配置、不监听非回环地址。
import { copyFileSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const APP = process.env.REVIEW_APP_DIR ?? "D:/AutoAgentloop/_night/b-repo/app";
const root = mkdtempSync(path.join(tmpdir(), "dashboard-review-center-"));
const home = path.join(root, "home");
mkdirSync(home, { recursive: true });
const rulesFile = path.join(home, "rules.json");
copyFileSync(process.env.REVIEW_RULES ?? path.join(import.meta.dirname, "rules.review.json"), rulesFile);
process.env.AGENT_AUTOLOOP_HOME = home;
process.env.AGENT_AUTOLOOP_RULES = rulesFile;
process.env.AGENT_AUTOLOOP_RULES_FIXTURE = process.env.REVIEW_RULES ?? path.join(import.meta.dirname, "rules.review.json");

// 选一个回环空端口
const net = await import("node:net");
const port = await new Promise((resolve) => {
  const s = net.createServer();
  s.listen(0, "127.0.0.1", () => {
    const p = s.address().port;
    s.close(() => resolve(p));
  });
});
const publicUrl = `http://127.0.0.1:${port}`;
process.env.AGENT_AUTOLOOP_PUBLIC_URL = publicUrl;

const { pathToFileURL } = await import("node:url");
const runtime = await import(pathToFileURL(path.join(APP, "host", "runtime.ts")).href);
const { serve } = await import(pathToFileURL(path.join(APP, "host", "http.ts")).href);

const keys = {
  owner: runtime.addKey("owner", "reviewer"),
  worker: runtime.addKey("worker", "w1"),
  worker2: runtime.addKey("worker", "w2"),
  channel: runtime.addKey("channel", "chat"),
  source: runtime.addKey("source", "app"),
};
const server = serve(port, "127.0.0.1", { commit: "dashboard-review" });
await new Promise((resolve, reject) => {
  server.on("listening", resolve);
  server.on("error", reject);
});
writeFileSync(path.join(home, "review-center.json"), JSON.stringify({ port, publicUrl, home, rulesFile, keys }, null, 2));
console.log("CENTER_READY " + JSON.stringify({ port, publicUrl, home, keys }));

if (process.env.REVIEW_SMOKE === "1") {
  const health = await fetch(publicUrl + "/healthz");
  const state = await fetch(publicUrl + "/v1/state", { headers: { authorization: "Bearer " + keys.owner } });
  console.log("SMOKE healthz=" + health.status + " state=" + state.status + " body=" + (await state.text()).slice(0, 120));
  server.close();
  server.closeAllConnections();
  process.exit(0);
}

const shutdown = () => {
  server.close();
  server.closeAllConnections();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
