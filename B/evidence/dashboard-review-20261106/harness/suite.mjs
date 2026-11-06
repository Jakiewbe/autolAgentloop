// 10 类工作流验收：真实浏览器操作 + 假中心原始回执对账。用法:
//   node suite.mjs <dashboardUrl> <review-center.json> <outDir> [--only=T1,T2]
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { openBrowser } from "./cdp.mjs";
import { centerApi } from "./lib.mjs";

const [url, centerFile, outDir, ...flags] = process.argv.slice(2);
if (!url || !centerFile || !outDir) throw new Error("用法: node suite.mjs <dashboardUrl> <review-center.json> <outDir>");
mkdirSync(outDir, { recursive: true });
const only = (flags.find((f) => f.startsWith("--only=")) || "").replace("--only=", "").split(",").filter(Boolean);
const center = JSON.parse(readFileSync(centerFile, "utf8"));
const hub = centerApi(center);
const snippet = (name) => readFileSync(path.join(import.meta.dirname, "snippets", name), "utf8");
const tag = "SUITE" + Date.now().toString(36).toUpperCase();
const results = [];
const shots = [];
const secrets = Object.values(center.keys).filter((value) => typeof value === "string" && value.length > 8);

function record(id, name, status, detail, extra = {}) {
  results.push({ id, name, status, detail, ...extra });
  console.log(status.padEnd(10), id, name, "-", detail);
}
async function step(id, name, fn) {
  if (only.length && !only.includes(id)) return record(id, name, "SKIP", "按 --only 跳过");
  const started = Date.now();
  try {
    const outcome = await fn();
    record(id, name, outcome.status || "PASS", outcome.detail || "", { ms: Date.now() - started, ...(outcome.extra || {}) });
  } catch (error) {
    record(id, name, "FAIL", String(error && error.message ? error.message : error), { ms: Date.now() - started });
  }
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(probe, options = {}) {
  const timeout = options.timeout || 15000;
  const interval = options.interval || 300;
  const label = options.label || "条件";
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await probe()) return true;
    await sleep(interval);
  }
  throw new Error("等待超时: " + label);
}
async function shot(browser, name) {
  const file = path.join(outDir, name + ".png");
  await browser.screenshot(file);
  shots.push(file);
  return file;
}

const browser = await openBrowser({ headless: true });
async function drain() {
  for (let index = 0; index < 20; index++) {
    const job = await hub.claim("drain-" + Date.now() + "-" + index);
    if (!job) return index;
    const answer = await hub.finish(job.run, job.token, { outcome: "cancelled", summary: "清场" });
    console.log("DRAIN", job.run, answer.status);
  }
  return 20;
}

try {
  const drained = await drain();
  console.log("DRAINED", drained);
  await browser.goto(url);
  await sleep(800);

  await step("T1", "选择与文字回答", async () => {
    const choiceAsk = await hub.ask(tag + " 选择颜色", ["蓝色", "绿色"]);
    await browser.goto(url);
    await waitFor(async () => (await browser.text()).includes(choiceAsk.card.title), { label: "卡片出现" });
    const clicked = await browser.clickText("绿色", { within: choiceAsk.card.title });
    if (!clicked) throw new Error("找不到「绿色」按钮");
    await waitFor(async () => {
      const card = await hub.cardById(choiceAsk.card.id);
      return card && card.state === "decided";
    }, { label: "中心侧 decided" });
    const decided = await hub.cardById(choiceAsk.card.id);
    const choiceRaw = JSON.stringify(decided.choice !== undefined ? decided.choice : decided.answer);
    const choiceOk = choiceRaw.includes("1") || choiceRaw.includes("绿色");
    const textAsk = await hub.ask(tag + " 补充说明", ["好", "再说"]);
    await browser.goto(url);
    await waitFor(async () => (await browser.text()).includes(textAsk.card.title), { label: "文字卡出现" });
    const typed = await browser.typeInto(textAsk.card.title, tag + "-人工回答");
    let textOk = false;
    if (typed) {
      await browser.clickText("提交", { within: textAsk.card.title, optional: true });
      try {
        await waitFor(async () => {
          const card = await hub.cardById(textAsk.card.id);
          return card && card.state === "decided";
        }, { timeout: 8000, label: "文字卡 decided" });
        const card = await hub.cardById(textAsk.card.id);
        textOk = String(card.answer !== undefined ? card.answer : card.choice).includes(tag + "-人工回答");
      } catch (error) { textOk = false; }
    }
    const file = await shot(browser, "T1");
    return {
      status: choiceOk ? "PASS" : "FAIL",
      detail: "选项回答=" + (choiceOk ? "中心 decided 且选项匹配" : "未匹配") + "；文字回答=" + (textOk ? "已落库" : (typed ? "已输入但未落库" : "页面无可输入框")),
      extra: { choiceCard: choiceAsk.card.id, textCard: textAsk.card.id, decision: decided, shot: file },
    };
  });

  await step("T2", "notice 结案与 fyi 只读", async () => {
    const note = await hub.fyi(tag + " 只读通知文本");
    await browser.goto(url);
    await waitFor(async () => (await browser.text()).includes(tag + " 只读通知文本"), { label: "通知出现" });
    const card = await hub.cardById(note.card.id);
    const closed = card && card.state === "closed";
    const actionable = await browser.hasActionableInside(tag + " 只读通知文本");
    const file = await shot(browser, "T2");
    return {
      status: closed && actionable === false ? "PASS" : "FAIL",
      detail: "中心 state=" + (card ? card.state : "缺失") + "；通知区内可操作元素=" + (actionable === null ? "无法判定" : actionable),
      extra: { shot: file },
    };
  });

  await step("T3", "已回答与后续完成分开", async () => {
    const asked = await hub.ask(tag + " 分开呈现", ["同意", "不同意"]);
    await browser.goto(url);
    await waitFor(async () => (await browser.text()).includes(asked.card.title), { label: "卡片出现" });
    await browser.clickText("同意", { within: asked.card.title });
    await waitFor(async () => {
      const card = await hub.cardById(asked.card.id);
      return card && card.state === "decided";
    }, { label: "已回答" });
    await sleep(1200);
    await browser.goto(url);
    await sleep(1000);
    const text = await browser.text();
    const file = await shot(browser, "T3");
    const answeredShown = /已回答|已答|decided|已经回答/.test(text);
    const doneShown = /完成|结果|finished/.test(text);
    return {
      status: answeredShown ? "PASS" : "UNVERIFIED",
      detail: "页面出现「已回答」语义=" + answeredShown + "；运行结果区独立存在=" + doneShown,
      extra: { shot: file },
    };
  });

  await step("T4", "重复提交不重复派发", async () => {
    const asked = await hub.ask(tag + " 重复提交", ["确认", "取消"]);
    await browser.goto(url);
    await waitFor(async () => (await browser.text()).includes(asked.card.title), { label: "卡片出现" });
    const script = snippet("answer-twice.js").replace("__CARD__", String(asked.card.id));
    const double = await browser.eval(script);
    await sleep(2000);
    const beforeCount = double.afterFirstCount;
    const afterCount = (await hub.state()).data.runs.length;
    const card = await hub.cardById(asked.card.id);
    const file = await shot(browser, "T4");
    return {
      status: card.state === "decided" && afterCount === beforeCount ? "PASS" : "FAIL",
      detail: "两次提交状态 " + double.first + "/" + double.second + "；卡片 " + card.state + "；答复后 run 数 " + beforeCount + "->" + afterCount,
      extra: { double, shot: file },
    };
  });

  await step("T5", "取消等待执行端确认", async () => {
    const running = await hub.running();
    await browser.goto(url);
    await sleep(1200);
    await browser.goto(url);
    const seen = await waitFor(async () => (await browser.text()).includes("#" + running.run), { timeout: 10000, label: "运行出现" }).then(() => true).catch(() => false);
    const clicked = seen ? await browser.clickText("取消", { within: "#" + running.run, optional: true }) : false;
    await sleep(1500);
    const text = await browser.text();
    const run = await hub.runById(running.run);
    const pendingShown = /等待执行端确认|等待确认|已请求取消|pending/.test(text);
    const file = await shot(browser, "T5");
    const cleanup = await hub.finish(running.run, running.token, { outcome: "cancelled", summary: "用例清理" });
    console.log("T5_CLEANUP", cleanup.status, String(cleanup.text || cleanup.t || "").slice(0, 160));
    if (!clicked) return { status: "UNVERIFIED", detail: "页面找不到该运行或取消按钮（运行区=" + seen + "）", extra: { shot: file } };
    return {
      status: pendingShown && run && run.state !== "cancelled" ? "PASS" : "FAIL",
      detail: "界面显示待确认=" + pendingShown + "；中心 run 状态=" + (run ? run.state : "缺失"),
      extra: { shot: file },
    };
  });

  await step("T6", "时间线关联", async () => {
    const asked = await hub.ask(tag + " 时间线", ["好的", "稍后"]);
    await browser.goto(url);
    await waitFor(async () => (await browser.text()).includes(asked.card.title), { label: "卡片出现" });
    await browser.clickText("好的", { within: asked.card.title });
    await waitFor(async () => {
      const card = await hub.cardById(asked.card.id);
      return card && card.state === "decided";
    }, { label: "已回答" });
    await browser.goto(url);
    await sleep(1200);
    const text = await browser.text();
    const file = await shot(browser, "T6");
    const linked = text.includes(asked.card.title) && /回答|answered|已答/.test(text);
    return { status: linked ? "PASS" : "UNVERIFIED", detail: "时间线含该卡片与其回答动作=" + linked, extra: { shot: file } };
  });

  await step("T7", "分页与计划面", async () => {
    await hub.bulk(120);
    await browser.goto(url);
    await sleep(800);
    const paged = await browser.clickText("更早", { optional: true });
    await sleep(1500);
    const pagedCalls = browser.requests.filter((entry) => /before=/.test(entry.url));
    const text = await browser.text();
    const file = await shot(browser, "T7");
    const snapshot = (await hub.state()).data;
    return {
      status: paged || pagedCalls.length ? "PASS" : "UNVERIFIED",
      detail: "翻页请求 " + pagedCalls.length + " 条；计划面 lines=" + (snapshot.lines || []).length + " elsewhere=" + (snapshot.elsewhere || []).length + "；页面含「计划」=" + /计划/.test(text),
      extra: { shot: file },
    };
  });

  await step("T8", "断线保留旧数据并禁用操作", async () => {
    const asked = await hub.ask(tag + " 断线保留", ["是", "否"]);
    await browser.goto(url);
    await waitFor(async () => (await browser.text()).includes(asked.card.title), { label: "数据就绪" });
    await browser.offline(true);
    await sleep(7000);
    const text = await browser.text();
    const kept = text.includes(asked.card.title);
    const disabled = await browser.countDisabledButtons();
    const file = await shot(browser, "T8");
    await browser.offline(false);
    return {
      status: kept && disabled > 0 ? "PASS" : "FAIL",
      detail: "断线后旧数据仍在=" + kept + "；disabled 按钮数=" + disabled,
      extra: { shot: file },
    };
  });

  await step("T9", "错误不自动重试", async () => {
    const asked = await hub.ask(tag + " 错误重试", ["甲", "乙"]);
    await browser.goto(url);
    await waitFor(async () => (await browser.text()).includes(asked.card.title), { label: "卡片出现" });
    const trap = await browser.failRequests("/answer");
    await browser.offline(false);
    await browser.clickText("甲", { within: asked.card.title });
    await sleep(6000);
    const attempts = trap.state.urls.slice();
    await trap.stop();
    const pageText = await browser.text();
    const card = await hub.cardById(asked.card.id);
    const file = await shot(browser, "T9");
    if (attempts.length === 0) {
      return {
        status: "UNVERIFIED",
        detail: "点击后浏览器没有发出 answer 请求（参照实现按钮未命中）；卡片仍为 " + (card ? card.state : "缺失") + "，错误提示=" + /失败|错误/.test(pageText),
        extra: { shot: file },
      };
    }
    return {
      status: attempts.length === 1 ? "PASS" : "FAIL",
      detail: "6 秒内 answer 请求次数=" + attempts.length + "（期望 1 次，不自动重试）",
      extra: { shot: file },
    };
  });

  await step("T10", "凭据与能力链接不进网页", async () => {
    await browser.goto(url);
    await sleep(1000);
    const dump = await browser.eval(snippet("dump-page.js"));
    const leaks = secrets.filter((secret) => dump.includes(secret));
    const capabilityLinks = (dump.match(/\/c\/[A-Za-z0-9_-]{12,}/g) || []).length;
    const requestLeaks = browser.requests.filter((entry) => secrets.some((secret) => entry.url.includes(secret))).length;
    const file = await shot(browser, "T10");
    return {
      status: leaks.length === 0 && requestLeaks === 0 ? "PASS" : "FAIL",
      detail: "页面/存储泄漏密钥 " + leaks.length + " 处；请求 URL 泄漏 " + requestLeaks + " 处；能力链接出现 " + capabilityLinks + " 次",
      extra: { shot: file },
    };
  });
} finally {
  await browser.close();
}

const summary = { url, center: center.publicUrl, at: new Date().toISOString(), tag, results, shots };
writeFileSync(path.join(outDir, "suite-result.json"), JSON.stringify(summary, null, 2));
const tally = results.reduce((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {});
console.log("SUITE_DONE", JSON.stringify(tally), "out=" + outDir);