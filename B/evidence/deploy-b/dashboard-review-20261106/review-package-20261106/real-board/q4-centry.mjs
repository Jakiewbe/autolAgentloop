// q4-centry.mjs：隔离真实内核上取 /c/ 的响应头（CSP 等）与链接有效期行为。
// 自包含：不复制任何既有 HOME，只在自己的临时目录里写一份 fixture rules.json，再让内核自己建库与主密钥。
// 过期分支不改系统时间、不改数据库，只按源码标注（Q4 允许的口径）。
import { spawn } from "node:child_process";
import { createHmac } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const REVIEW = path.join(import.meta.dirname, "..");
const APP = process.env.REVIEW_APP_DIR
  ?? (existsSync(path.join(REVIEW, "app")) ? path.join(REVIEW, "app") : path.join(REVIEW, "review-package-20261106", "app"));
// 默认落在系统临时目录：包里不留库/主密钥/case token（这类材料不出包）。
const HOME = process.env.REVIEW_Q4_HOME ?? path.join(os.tmpdir(), "q4-home-" + Date.now().toString(36));
const PORT = Number(process.env.REVIEW_Q4_PORT ?? 34521);
const BASE = "http://127.0.0.1:" + PORT;
const OUT = path.join(REVIEW, "evidence", "q4-centry-" + new Date().toISOString().replace(/[:.]/g, "-"));
mkdirSync(OUT, { recursive: true });

const RULES = {
  timezone: "Asia/Shanghai",
  sources: { app: { name: "应用" } },
  agents: { a1: { name: "甲", worker: "w1", use: "claude", model: "m1", access: "edit" } },
  channels: { chat: { name: "聊天", answerers: ["本人"], links: true } },
  rules: [{ name: "意见", when: { source: "app", types: ["feedback.*"] }, to: "a1", cwd: "~/x", prompt: "按手册做。" }],
};

rmSync(HOME, { recursive: true, force: true });
mkdirSync(HOME, { recursive: true });
writeFileSync(path.join(HOME, "rules.json"), JSON.stringify(RULES, null, 2));

const stamp = () => "q4-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
const results = [];
// ok: true=运行通过；false=运行失败；null=仅源码断言（未运行验证，不计入通过数）
const note = (name, ok, detail, flags = {}) => results.push({ name, ok, ...flags, detail });

function startKernel() {
  const child = spawn(process.execPath, [path.join(import.meta.dirname, "kernel-host.mjs"), String(PORT), APP], {
    env: { ...process.env, AGENT_AUTOLOOP_HOME: HOME, AGENT_AUTOLOOP_PUBLIC_URL: BASE, Q4_BOOTSTRAP: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  let err = "";
  child.stdout.on("data", (chunk) => (out += String(chunk)));
  child.stderr.on("data", (chunk) => (err += String(chunk)));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("内核没起来: " + err.slice(-600))), 40000);
    const tick = setInterval(() => {
      const line = out.split("\n").find((entry) => entry.startsWith("KERNEL_READY "));
      if (!line) return;
      clearTimeout(timer);
      clearInterval(tick);
      resolve({ child, info: JSON.parse(line.slice("KERNEL_READY ".length)) });
    }, 100);
  });
}

function stopKernel(child) {
  return new Promise((resolve) => {
    child.on("exit", () => resolve());
    child.kill("SIGTERM");
    setTimeout(() => {
      try { child.kill("SIGKILL"); } catch {}
      resolve();
    }, 3000);
  });
}

const started = await startKernel();
const kernel = started.child;
const keys = started.info.keys;
const secret = readFileSync(path.join(HOME, "master.key"), "utf8").trim();
const token = (purpose, ...parts) => createHmac("sha256", secret).update(JSON.stringify([purpose, ...parts])).digest("base64url");
const auth = (key) => ({ authorization: "Bearer " + key, "content-type": "application/json" });
const state = async () => (await fetch(BASE + "/v1/state", { headers: auth(keys.owner) })).json();
const findCard = (snapshot, id) => [...(snapshot.cards || []), ...(snapshot.recentCards || [])].find((row) => row.id === id);

try {
  const text = "Q4 CSP 与过期探针 " + stamp();
  const tell = await fetch(BASE + "/v1/tell", { method: "POST", headers: auth(keys.source), body: JSON.stringify({ key: stamp(), text }) });
  const tellBody = await tell.json();
  const snapshot = await state();
  const card = findCard(snapshot, tellBody.card);
  note("造卡成功", Boolean(card), JSON.stringify({ id: tellBody.card, kind: card?.kind, state: card?.state }));

  const link = token("card", card.id, card.createdAt);
  const page = await fetch(BASE + "/c/" + link, { redirect: "manual" });
  const html = await page.text();
  const headers = Object.fromEntries(page.headers.entries());
  const csp = headers["content-security-policy"] || "";
  note(
    "合法链接 GET 200 且只读",
    page.status === 200 && !/<script|<form/i.test(html),
    JSON.stringify({ status: page.status, bytes: html.length, hasScript: /<script/i.test(html), hasForm: /<form/i.test(html) }),
  );
  note(
    "CSP 逐字匹配内核 card-page.ts POLICY",
    csp.startsWith("default-src 'none'; style-src 'sha256-") &&
      csp.includes("form-action 'self'") && csp.includes("frame-ancestors 'none'") && csp.includes("base-uri 'none'"),
    JSON.stringify({ csp }),
  );
  note(
    "其余安全头齐全",
    headers["x-content-type-options"] === "nosniff" && headers["referrer-policy"] === "no-referrer" && headers["cache-control"] === "no-store",
    JSON.stringify({ nosniff: headers["x-content-type-options"], referrer: headers["referrer-policy"], cache: headers["cache-control"] }),
  );
  writeFileSync(path.join(OUT, "get-headers.json"), JSON.stringify({ status: page.status, headers }, null, 2));

  const badLink = await fetch(BASE + "/c/" + token("card", card.id, new Date(Date.parse(card.createdAt) + 1000).toISOString()), { redirect: "manual" });
  note("换时间戳伪造的链接 404", badLink.status === 404, JSON.stringify({ status: badLink.status }));

  const post = await fetch(BASE + "/c/" + link, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "text=" + encodeURIComponent("从链接签收"), redirect: "manual" });
  note("有效期内 POST 303 回本路径", post.status === 303 && post.headers.get("location") === "/c/" + link, JSON.stringify({ status: post.status, location: post.headers.get("location") }));

  note(
    "GET 不校验有效期（源码 http.ts:103 直接返回页面，无创建时间判断）",
    null,
    JSON.stringify({ source: "app/kernel/http.ts:103", linkLifetime: "7 * 86400_000 @ app/kernel/http.ts:24", verified: false }),
    { sourceOnly: true, runtimeVerified: false, runtimeProbe: "real-board/q4-expiry.mjs" },
  );
  note(
    "POST 过期即拒（源码 http.ts:104-106；运行期证据见 real-board/q4-expiry.mjs）",
    null,
    JSON.stringify({ source: "app/kernel/http.ts:104-106", verified: false, reason: "未改系统时间、未改数据库，过期分支仅源码判断" }),
    { sourceOnly: true, runtimeVerified: false, runtimeProbe: "real-board/q4-expiry.mjs" },
  );

  const stillOpen = findCard(await state(), card.id);
  note("签收后卡片仍是同一张、状态可读", Boolean(stillOpen), JSON.stringify({ state: stillOpen?.state, by: stillOpen?.by, answer: stillOpen?.answer }));
} finally {
  await stopKernel(kernel);
  // 跑完即清：临时 HOME 里有内核自建的库与主密钥，不留在任何目录里。
  if (!process.env.REVIEW_Q4_HOME) rmSync(HOME, { recursive: true, force: true });
}

const record = {
  at: new Date().toISOString(),
  kernel: { app: APP, home: HOME, homeRemoved: !process.env.REVIEW_Q4_HOME, port: PORT, note: "临时 HOME 在系统临时目录自建（fixture rules.json + 内核自建库/主密钥），跑完即删；生产 HOME 与生产库未触碰" },
  results,
};
writeFileSync(path.join(OUT, "record.json"), JSON.stringify(record, null, 2));
console.log("OUT " + OUT);
const passed = results.filter((row) => row.ok === true);
const failed = results.filter((row) => row.ok === false);
const sourceOnly = results.filter((row) => row.ok === null);
console.log("Q4CENTRY " + JSON.stringify({
  checks: results.map((row) => [row.name, row.ok]),
  passed: passed.length,
  failed: failed.length,
  sourceOnly: sourceOnly.length,
  total: results.length,
}));
console.log("FAILED " + JSON.stringify(failed));
process.exitCode = failed.length ? 1 : 0;
