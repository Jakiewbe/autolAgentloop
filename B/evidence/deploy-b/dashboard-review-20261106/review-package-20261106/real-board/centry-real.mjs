// centry-real.mjs：在隔离的真实内核上验证 /c/<token> 的用途与边界（只动临时 home，不碰生产）
import { createHmac } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const HOME = "D:/AutoAgentloop/coordination/dashboard-workflow-review/incoming/center-home-link";
const HOME2 = "D:/AutoAgentloop/coordination/dashboard-workflow-review/incoming/center-home-nolinks";
const BASE = "http://127.0.0.1:34517";
const BASE2 = "http://127.0.0.1:34518";
const OUT = path.join(import.meta.dirname, "..", "evidence", "supplement-centry-real-" + new Date().toISOString().replace(/[:.]/g, "-"));
mkdirSync(OUT, { recursive: true });

const config = JSON.parse(readFileSync(path.join(HOME, "config.json"), "utf8"));
const secret = readFileSync(path.join(HOME, "master.key"), "utf8").trim();
const token = (purpose, ...parts) => createHmac("sha256", secret).update(JSON.stringify([purpose, ...parts])).digest("base64url");
const auth = (key) => ({ authorization: "Bearer " + key, "content-type": "application/json" });
const stamp = () => "ct-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
const state = async (base = BASE) => (await fetch(base + "/v1/state", { headers: auth(config.owner) })).json();
const findCard = (snapshot, id) => [...(snapshot.cards || []), ...(snapshot.recentCards || [])].find((row) => row.id === id);

const results = [];
const note = (name, ok, detail) => results.push({ name, ok, detail });

const text = "C 入口真实内核探针 " + stamp();
const tell = await fetch(BASE + "/v1/tell", { method: "POST", headers: auth(config.source.key), body: JSON.stringify({ key: stamp(), text }) });
const tellBody = await tell.json().catch(() => null);
note("能造出一张卡片", tell.ok && tellBody && tellBody.card > 0, JSON.stringify({ status: tell.status, body: tellBody }));

const before = await state();
const card = findCard(before, tellBody.card);
note("卡片出现在 state", Boolean(card), JSON.stringify({ kind: card?.kind, state: card?.state }));

const link = token("card", card.id, card.createdAt);
const page = await fetch(BASE + "/c/" + link, { redirect: "manual" });
const html = await page.text();
note(
  "合法链接能打开只读页",
  page.status === 200 && html.includes(String(card.id)) && !/<script|<form/i.test(html),
  JSON.stringify({ status: page.status, bytes: html.length, hasScript: /<script/i.test(html), hasForm: /<form/i.test(html) }),
);

const afterGet = await state();
note(
  "打开链接不写事实",
  JSON.stringify(findCard(afterGet, card.id)) === JSON.stringify(card) && JSON.stringify(afterGet).length === JSON.stringify(before).length,
  JSON.stringify({ beforeState: card.state, afterState: findCard(afterGet, card.id)?.state }),
);

const answer = await fetch(BASE + "/c/" + link, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "text=" + encodeURIComponent("从链接回答"), redirect: "manual" });
note("链接表单能提交（303 回本路径）", answer.status === 303 && answer.headers.get("location") === "/c/" + link, JSON.stringify({ status: answer.status, location: answer.headers.get("location") }));
await sleep(400);
const afterAnswer = await state();
const row = findCard(afterAnswer, card.id);
note(
  "已结的卡片再答一次不重复计数",
  row.state === "closed" && row.by === null && row.answer === null,
  JSON.stringify({ state: row.state, by: row.by, answer: row.answer }),
);

const forged = await fetch(BASE + "/c/" + token("card", card.id, "2000-01-01T00:00:00.000Z"));
note("换掉时间戳的伪造链接 404", forged.status === 404, JSON.stringify({ status: forged.status }));
const garbage = await fetch(BASE + "/c/" + "x".repeat(43));
note("无效链接 404", garbage.status === 404, JSON.stringify({ status: garbage.status }));

// 第二个内核实例：通道没有 links，同一格式的 token 也不该被认
const second = await fetch(BASE2 + "/c/" + link);
const secondBody = await second.text();
note("没开 links 的内核不认这个入口", second.status === 404, JSON.stringify({ status: second.status, body: secondBody.slice(0, 80) }));

const record = {
  at: new Date().toISOString(),
  kernel: { base: BASE, base2: BASE2, home: HOME, home2: HOME2 },
  card: { id: card.id, kind: card.kind, state: card.state, createdAt: card.createdAt },
  results,
};
writeFileSync(path.join(OUT, "record.json"), JSON.stringify(record, null, 2));
writeFileSync(path.join(OUT, "page.html"), html);
console.log("OUT " + OUT);
console.log("CENTRYREAL " + JSON.stringify(results.map((row2) => [row2.name, row2.ok])));
const failed = results.filter((row2) => !row2.ok);
console.log("FAILED " + JSON.stringify(failed));
