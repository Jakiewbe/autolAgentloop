// 场景数据构造器：只用公开 HTTP 协议在隔离假中心里造数据，并逐条回读确认。
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
if (!file) throw new Error("用法: node seed.mjs <review-center.json>");
const center = JSON.parse(readFileSync(file, "utf8"));
const base = center.publicUrl.replace(/\/$/, "");
const K = center.keys;
const steps = [];

async function call(method, path, token, body, timeout = 20) {
  const response = await fetch(base + path, {
    method,
    headers: { authorization: "Bearer " + token, ...(body !== undefined && { "content-type": "application/json" }) },
    ...(body !== undefined && { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(timeout * 1000),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) throw new Error(method + " " + path + " -> " + response.status + " " + (data?.error ?? text.slice(0, 200)));
  return data;
}
const step = (name, value) => { steps.push({ name, value }); console.log("STEP " + name + " " + JSON.stringify(value).slice(0, 240)); };
const state = () => call("GET", "/v1/state", K.owner);
const event = (n, extra = {}) => call("POST", "/v1/events", K.source, { id: `feedback:${n}:new`, type: "feedback.new", subject: `#${n}`, summary: `第 ${n} 条意见`, ...extra });
const claim = (tag) => call("GET", "/v1/work?claim=" + tag + "&wait=0&running=&capacity=1", K.worker);
const started = (run, token, session) => call("POST", "/v1/runs/" + run + "/started", token, { session, link: "app://" + session });
const result = (run, token, body) => call("POST", "/v1/runs/" + run + "/result", token, body);

// S1 提出问题（open 的 ask 卡）
await event(1, { summary: "要不要删旧表", detail: "占了 10 GB" });
let job = (await claim("seed-s1")).job;
await started(job.run, job.token, "s-1");
await result(job.run, job.token, {
  outcome: "done",
  summary: "等你决定",
  session: "s-1",
  ask: [{ title: "要不要删旧表", text: "占了 10 GB。", options: ["删", "留着"], recommend: 1, about: "表名 old_x", key: "drop-old-x" }],
  later: [{ key: "回访", at: new Date(Date.now() + 90 * 60000).toISOString(), about: "90 分钟后再看一次" }],
});
step("s1-ask", { run: job.run });

// S2 fyi 只读通知
await call("POST", "/v1/tell", K.source, { key: "note-1", text: "晚间巡检完成：无异常。" });
step("s2-fyi", { ok: true });

// S3 一组问题（选择题 + 文字回答）
await event(3, { summary: "两条待定" });
job = (await claim("seed-s3")).job;
await started(job.run, job.token, "s-3");
await result(job.run, job.token, {
  outcome: "done",
  summary: "两个问题",
  session: "s-3",
  ask: [
    { title: "选颜色", text: "要哪一个", options: ["蓝色", "绿色"], key: "pick-color" },
    { title: "补充说明", text: "还有什么要说的", options: ["好", "再说"], key: "free-text" },
  ],
});
const afterS3 = await state();
step("s3-state", { cards: afterS3.cards.map((c) => [c.id, c.kind, c.state, c.title]), totals: afterS3.totals });

const ask1 = afterS3.cards.find((c) => c.title === "要不要删旧表");
const pick = afterS3.cards.find((c) => c.title === "选颜色");
const free = afterS3.cards.find((c) => c.title === "补充说明");

// S4 已回答：选择题回答 -> 唤醒线程 -> 收尾
const answered = await call("POST", "/v1/cards/" + ask1.id + "/answer", K.owner, { choice: 1, by: "me" });
step("s4-answer-choice", answered);
const woken = (await claim("seed-s4")).job;
if (woken) {
  await started(woken.run, woken.token, "s-1");
  await result(woken.run, woken.token, { outcome: "done", summary: "已按回答处理：不动旧表", session: "s-1" });
}
// 文字回答（同一张卡的 answer 只第一次算数，这里回答另一张）
const textAnswer = await call("POST", "/v1/cards/" + free.id + "/answer", K.owner, { text: "先按现状跑一周", by: "me" });
step("s5-answer-text", textAnswer);

// S6 运行中（取消场景）：领活并启动，不收尾
await event(2, { summary: "第二条意见" });
const running = (await claim("seed-s6")).job;
await started(running.run, running.token, "s-2");
step("s6-running", { run: running.run });

// S7 计划：cron + 外部计划 + 延后任务
const planState = await state();
step("s7-plans", {
  lines: planState.lines?.length ?? 0,
  elsewhere: planState.elsewhere?.length ?? 0,
  nextBefore: planState.nextBefore,
  hasMore: planState.hasMore,
});

const finalState = await state();
const summary = {
  center: { port: center.port, home: center.home },
  steps,
  cards: finalState.cards.map((c) => ({ id: c.id, kind: c.kind, state: c.state, title: c.title, choice: c.choice, answer: c.answer, result: c.result })),
  totals: finalState.totals,
  lines: finalState.lines,
  elsewhere: finalState.elsewhere,
  runs: finalState.runs?.length ?? 0,
  ids: { askOpen: ask1.id, pick: pick.id, free: free.id, runningRun: running.run },
};
writeFileSync(new URL("./seed-report.json", import.meta.url), JSON.stringify(summary, null, 2));
console.log("SEED_DONE " + JSON.stringify({ cards: summary.cards.length, runningRun: running.run, askOpen: ask1.id }));
