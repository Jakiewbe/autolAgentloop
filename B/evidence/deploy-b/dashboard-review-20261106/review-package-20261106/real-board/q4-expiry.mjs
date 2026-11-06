// q4-expiry.mjs：/c/ 链接的「合法访问 / 无效访问 / 提交回跳 / CSP / 过期行为」运行期取证。
// 过期行为用**可控时钟**：直接构造内核 Services 的 now()，不改系统时间、不改数据库、不改生产。
// 隔离：临时 AGENT_AUTOLOOP_HOME（含 fixture rules.json），内核自建库与 master.key，跑完删除。
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash, createHmac } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const REVIEW = path.join(import.meta.dirname, "..");
const APP = process.env.REVIEW_APP_DIR ?? (path.join(REVIEW, "app"));
const HOME = path.join(os.tmpdir(), "q4-expiry-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6));
const OUT = path.join(REVIEW, "evidence", "q4-expiry-" + new Date().toISOString().replace(/[:.]/g, "-"));
mkdirSync(HOME, { recursive: true, mode: 0o700 });
mkdirSync(OUT, { recursive: true });

const RULES = {
  timezone: "Asia/Shanghai",
  sources: { app: { name: "应用" } },
  agents: { a1: { name: "甲", worker: "w1", use: "claude", model: "m1", access: "edit" } },
  channels: { chat: { name: "聊天", answerers: ["本人"], links: true } },
  rules: [{ name: "意见", when: { source: "app", types: ["feedback.*"] }, to: "a1", cwd: "~/x", prompt: "按手册做。" }],
};
const RULES_FILE = path.join(HOME, "rules.json");
writeFileSync(RULES_FILE, JSON.stringify(RULES, null, 2));

process.env.AGENT_AUTOLOOP_HOME = HOME;
process.env.AGENT_AUTOLOOP_RULES = RULES_FILE;
process.env.AGENT_AUTOLOOP_PUBLIC_URL = "https://hub.test";

const imp = async (rel) => import(pathToFileURL(path.join(APP, rel)).href);
const hub = await imp("host/runtime.ts");
const { createHandler } = await imp("kernel/http.ts");
const { PAGE_HEADERS } = await imp("kernel/card-page.ts");

// 固定起点，与内核测试同一口径（tests/helpers.ts at(0) = 2026-10-18T02:00:00Z）
const T0 = Date.parse("2026-10-18T02:00:00.000Z");
const DAY = 86400_000;
const LIFETIME = 7 * DAY;
let clock = T0;
const services = {
  commit: "q4-expiry",
  now: () => clock,
  view: hub.getView,
  environment: hub.environment,
  dispatch: hub.execute,
  state: hub.stateOf,
  why: hub.why,
  card: hub.cardByToken,
  wait: async () => {},
  stream: () => new ReadableStream(),
  adapt: async () => [],
};
const handle = createHandler(services);
const base = "https://hub.test";
const send = (method, p, body) =>
  handle(new Request(base + p, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/x-www-form-urlencoded" },
    body,
  }));

const results = [];
const note = (name, ok, detail, flags = {}) => results.push({ name, ok, ...flags, detail });
const cardRow = (id) => {
  const row = hub.one("SELECT data FROM projections WHERE collection='cards' AND json_extract(data,'$.id')=?", [id]);
  return row ? JSON.parse(String(row.data)) : null;
};
const factCount = () => hub.logAfter(0, 100000).length;
const tokenOf = (card) =>
  createHmac("sha256", hub.environment.secret).update(JSON.stringify(["card", card.id, card.created_at])).digest("base64url");

const raw = {};
try {
  // 造两张 ask 卡（state=open）：A 用于有效期内提交，B 用于过期提交
  const a = hub.createCard({ key: "q4-expiry-a", kind: "ask", title: "到期探针 A", text: "有效期内提交", options: ["甲", "乙"] }, T0);
  const b = hub.createCard({ key: "q4-expiry-b", kind: "ask", title: "到期探针 B", text: "过期提交", options: ["甲", "乙"] }, T0);
  const cardA = cardRow(a.card);
  const cardB = cardRow(b.card);
  const linkA = tokenOf(cardA);
  const linkB = tokenOf(cardB);

  clock = T0 + 60_000;
  // 1) 合法 GET：200 + 完整安全头（与内核 PAGE_HEADERS 逐字段相等）
  const get = await send("GET", "/c/" + linkA);
  const html = await get.text();
  const got = Object.fromEntries(get.headers.entries());
  raw.get = { status: get.status, headers: got, body: html.slice(0, 4000) };
  const headerOk = Object.entries(PAGE_HEADERS).every(([k, v]) => got[k] === v);
  note("合法链接 GET 200", get.status === 200, JSON.stringify({ status: get.status, bytes: html.length }));
  note("安全头与内核 PAGE_HEADERS 逐字段相等", headerOk, JSON.stringify({ got: Object.keys(got), expect: Object.keys(PAGE_HEADERS) }));
  note(
    "CSP 为逐字策略（default-src 'none' + style-src sha256 + form-action/frame-ancestors/base-uri）",
    got["content-security-policy"] === PAGE_HEADERS["content-security-policy"] &&
      got["content-security-policy"].startsWith("default-src 'none'; style-src 'sha256-"),
    JSON.stringify({ csp: got["content-security-policy"] }),
  );
  note("页面无脚本、表单指向自身", !/<script/i.test(html) && /<form method="post">/.test(html), JSON.stringify({ hasScript: /<script/i.test(html), hasForm: /<form method="post">/.test(html) }));

  // 2) 无效访问：伪造 token 404；页面仍是受控 HTML
  const bad = await send("GET", "/c/" + createHmac("sha256", hub.environment.secret).update(JSON.stringify(["card", cardA.id, new Date(Date.parse(cardA.created_at) + 1000).toISOString()])).digest("base64url"));
  const badBody = await bad.text();
  raw.badToken = { status: bad.status, body: badBody.slice(0, 800) };
  note("换创建时间的伪造 token → 404", bad.status === 404, JSON.stringify({ status: bad.status }));
  const badPost = await send("POST", "/c/made-up-token", "text=x");
  raw.badTokenPost = { status: badPost.status };
  note("无效 token POST → 404", badPost.status === 404, JSON.stringify({ status: badPost.status }));

  // 3) 有效期内提交：303 回本路径，卡片状态推进，且恰好产生事实
  const factsBefore = factCount();
  const okPost = await send("POST", "/c/" + linkA, "choice=0");
  await okPost.text();
  const afterA = cardRow(a.card);
  const factsAfter = factCount();
  raw.validPost = { status: okPost.status, location: okPost.headers.get("location"), card: { stateBefore: cardA.state, stateAfter: afterA.state } };
  note(
    "有效期内 POST 303 回本路径（提交回跳）",
    okPost.status === 303 && okPost.headers.get("location") === "/c/" + linkA,
    JSON.stringify({ status: okPost.status, location: okPost.headers.get("location") }),
  );
  note("提交后卡片离开 open 且产生事实", cardA.state === "open" && afterA.state !== "open" && factsAfter > factsBefore,
    JSON.stringify({ before: cardA.state, after: afterA.state, factsBefore, factsAfter }));

  // 4) 边界：恰好 7 天（代码判据 > 而非 >=）仍可提交
  const c = hub.createCard({ key: "q4-expiry-c", kind: "ask", title: "到期探针 C", text: "边界提交", options: ["甲", "乙"] }, T0);
  const cardC = cardRow(c.card);
  clock = T0 + LIFETIME;
  const edge = await send("POST", "/c/" + tokenOf(cardC), "choice=1");
  await edge.text();
  raw.edge = { status: edge.status, state: cardRow(c.card).state };
  note("恰好 7×86400_000ms 仍可提交（判据是严格大于）", edge.status === 303, JSON.stringify({ status: edge.status, state: cardRow(c.card).state }));

  // 5) 过期：7 天 + 1ms 提交被拒 401，卡片不动，不产生事实
  const factsBeforeExpiry = factCount();
  clock = T0 + LIFETIME + 1;
  const expired = await send("POST", "/c/" + linkB, "choice=0");
  const expiredBody = await expired.text();
  const afterB = cardRow(b.card);
  const factsAfterExpiry = factCount();
  raw.expired = { status: expired.status, body: expiredBody.slice(0, 800), card: { state: afterB.state, version: afterB.version }, factsBeforeExpiry, factsAfterExpiry };
  note(
    "过期提交 → 401 且文案逐字",
    expired.status === 401 && expiredBody.includes("这个链接过期了") && expiredBody.includes("agent-autoloop answer " + b.card),
    JSON.stringify({ status: expired.status, text: expiredBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) }),
  );
  note("过期提交不改卡片、不产生事实", afterB.state === "open" && afterB.version === cardB.version && factsAfterExpiry === factsBeforeExpiry,
    JSON.stringify({ state: afterB.state, versionBefore: cardB.version, versionAfter: afterB.version, factsBeforeExpiry, factsAfterExpiry }));

  // 6) 过期后 GET 仍渲染页面（GET 分支不做期限判断，属设计现状，仅记录）
  const getExpired = await send("GET", "/c/" + linkB);
  const getExpiredBody = await getExpired.text();
  raw.getExpired = { status: getExpired.status, hasForm: /<form method="post">/.test(getExpiredBody) };
  note("过期后 GET 仍 200 渲染（GET 不判期限，记录型观测）", getExpired.status === 200 && /<form method="post">/.test(getExpiredBody),
    JSON.stringify({ status: getExpired.status, hasForm: /<form method="post">/.test(getExpiredBody) }), { observation: true });

  // 7) 链接关闭时合法 token 也不可达：改规则后重载（仍在本临时 HOME 内）
  const noLinks = { ...RULES, channels: { chat: { name: "聊天", answerers: ["本人"], links: false } } };
  writeFileSync(RULES_FILE, JSON.stringify(noLinks, null, 2));
  hub.reloadRules(RULES_FILE);
  const offGet = await send("GET", "/c/" + tokenOf(cardB));
  const offPost = await send("POST", "/c/" + tokenOf(cardB), "choice=0");
  await offGet.text(); await offPost.text();
  raw.linksOff = { get: offGet.status, post: offPost.status };
  note("links 关闭时 /c/ 一律 404（GET/POST）", offGet.status === 404 && offPost.status === 404,
    JSON.stringify({ get: offGet.status, post: offPost.status }));

  const files = ["kernel/http.ts", "kernel/card-page.ts", "kernel/credentials.ts", "host/runtime.ts", "host/server.ts"].map((rel) => {
    const buf = readFileSync(path.join(APP, rel));
    return { path: "app/" + rel, bytes: buf.length, sha256: createHash("sha256").update(buf).digest("hex") };
  });
  const record = {
    probe: "q4-expiry",
    at: new Date().toISOString(),
    node: process.version,
    platform: process.platform + " " + os.release(),
    clock: { start: new Date(T0).toISOString(), lifetimeMs: LIFETIME, note: "内核 Services.now 由探针提供；系统时间未改" },
    app: APP,
    appFiles: files,
    pass: results.filter((r) => r.ok === true).length,
    fail: results.filter((r) => r.ok === false).length,
    observations: results.filter((r) => r.observation).length,
    total: results.length,
    results,
    raw,
  };
  writeFileSync(path.join(OUT, "record.json"), JSON.stringify(record, null, 2));
  console.log(JSON.stringify({ pass: record.pass, fail: record.fail, total: record.total, out: OUT }));
  process.exitCode = record.fail === 0 ? 0 : 1;
} catch (error) {
  writeFileSync(path.join(OUT, "error.txt"), String(error && (error.stack || error.message)));
  console.error(String(error && (error.stack || error.message)));
  process.exitCode = 1;
} finally {
  try { hub.db.close(); } catch {}
  try { rmSync(HOME, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }); } catch {}
}
