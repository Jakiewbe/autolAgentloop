// q5-order.mjs：两处取消时序的请求顺序取证。
// 记录「本回合」内每个 /api/* 请求的序号、方法、URL、注入动作、最终结果（200 / 失败 / 挂起后放行），
// 以及写请求次数与分母（本回合 /api/* 请求总数）。只用一个拦截器，避免多重放行掩盖注入。
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { bootBoard } from "./board.mjs";
import { attachRealPage } from "./page-real.mjs";
import { openBrowser } from "../selftest-v2/cdp.mjs";
import { hub2 } from "../selftest-v2/lib2.mjs";

const EVID = path.join(import.meta.dirname, "..", "evidence");
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");
const rel = (url) => {
  try { const u = new URL(url); return u.pathname + (u.search || ""); } catch { return String(url); }
};

function ledger(raw) {
  const records = [];
  const byId = new Map();
  const held = new Map();
  const sid = raw.sessionId;
  const onMessage = (event) => {
    let data;
    try { data = JSON.parse(String(event.data)); } catch { return; }
    if (data.sessionId !== sid) return;
    if (data.method === "Network.requestWillBeSent") {
      const p = data.params;
      if (!String(p.request.url).includes("/api/")) return;
      const record = { order: records.length + 1, method: p.request.method, path: rel(p.request.url), injected: "pass", outcome: "pending" };
      records.push(record);
      byId.set(p.requestId, record);
    } else if (data.method === "Network.responseReceived") {
      const record = byId.get(data.params.requestId);
      if (record) record.outcome = String(data.params.response.status);
    } else if (data.method === "Network.loadingFailed") {
      const record = byId.get(data.params.requestId);
      if (record) record.outcome = "failed(" + (data.params.errorText || "?") + ")";
    }
  };
  raw.ws.addEventListener("message", onMessage);
  return {
    records,
    async enable(decideFn) {
      const onPause = async (event) => {
        let data;
        try { data = JSON.parse(String(event.data)); } catch { return; }
        if (data.sessionId !== sid || data.method !== "Fetch.requestPaused") return;
        const requestId = data.params.requestId;
        const networkId = data.params.networkId;
        const request = data.params.request;
        let action = "pass";
        try { action = decideFn(request) || "pass"; } catch { action = "pass"; }
        const record = byId.get(networkId);
        if (record) record.injected = action;
        if (action === "hold") {
          held.set(networkId, requestId);
          if (record) record.outcome = "held";
          return;
        }
        if (action === "fail") {
          if (record) record.outcome = "failed(injected)";
          await raw.send("Fetch.failRequest", { requestId, errorReason: "Failed" }).catch(() => {});
          return;
        }
        await raw.send("Fetch.continueRequest", { requestId }).catch(() => {});
      };
      raw.ws.addEventListener("message", onPause);
      await raw.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
      return {
        heldCount: () => held.size,
        async releaseAll() {
          for (const [networkId, requestId] of held) {
            await raw.send("Fetch.continueRequest", { requestId }).catch(() => {});
            const record = byId.get(networkId);
            if (record && record.outcome === "held") record.outcome = "held→released";
          }
          held.clear();
        },
        async stop() {
          try { await raw.send("Fetch.disable"); } catch {}
          raw.ws.removeEventListener("message", onPause);
        },
      };
    },
    stop() { raw.ws.removeEventListener("message", onMessage); },
  };
}

const rawText = (page, selector) =>
  page.raw.eval("(() => { const el = document.querySelector(" + JSON.stringify(selector) + "); return el ? (el.textContent || '') : ''; })()");
const isDisabled = (page, selector) =>
  page.raw.eval("(() => { const el = document.querySelector(" + JSON.stringify(selector) + "); return el ? el.disabled === true : null; })()");

async function seedClaimed(hub, tag) {
  await hub.event("feedback.new");
  const job = await hub.claim(tag + "-" + Date.now());
  if (!job) throw new Error("没领到活");
  await hub.started(job.run, job.token, "s-" + tag + "-" + job.run);
  return job.run;
}

async function openCancel(page, runId) {
  await page.view("runs");
  const found = await page.clickOptional('button[data-run="' + runId + '"]');
  if (!found) throw new Error("详情按钮没找到");
  await page.waitFor("#run-detail[open]", 8000);
  await page.waitFor("#run-detail [data-stop-run]", 8000);
  await page.click("#run-detail [data-stop-run]");
  return page.waitFor("#action-dialog[open] form#cancel-form", 8000);
}

async function scenarioHold(dir) {
  const board = await bootBoard();
  const hub = hub2({ publicUrl: board.hub.publicUrl, keys: board.hub.keys, home: board.hub.home });
  const raw = await openBrowser({ width: 1440, height: 900 });
  const page = attachRealPage(raw, board.url, { keys: board.hub.keys });
  const book = ledger(raw);
  try {
    const runId = await seedClaimed(hub, "q5-hold");
    if (!(await openCancel(page, runId))) throw new Error("取消对话框没打开");
    const flags = { hold: false };
    const gate = await book.enable((request) => {
      const url = String(request.url);
      if (!flags.hold) return "pass";
      return url.includes("/api/state") && !url.includes("before=") ? "hold" : "pass";
    });
    await sleep(300);
    const turnStart = book.records.length;
    flags.hold = true;
    await page.raw.eval("document.querySelector('#refresh').click()");
    let guard = 0;
    while (guard++ < 80 && gate.heldCount() === 0) await sleep(50);
    const readHeld = gate.heldCount();
    const refreshDisabled = await isDisabled(page, "#refresh");
    const inflightState = await page.raw.eval("document.querySelector('#refresh') ? document.querySelector('#refresh').disabled : null");
    await page.raw.eval("document.querySelector('#cancel-form').requestSubmit()");
    let message = "";
    for (let i = 0; i < 100 && !message; i++) { message = String(await rawText(page, "#action-message")).trim(); if (!message) await sleep(100); }
    const messageAt = book.records.slice(turnStart).map((r) => r.order);
    await gate.releaseAll();
    await sleep(800);
    const turn = book.records.slice(turnStart);
    const detail = await hub.runDetail(runId);
    await gate.stop();
    await page.screenshot(path.join(dir, "cancel-hold.png"));
    const record = {
      case: "q5-hold", at: new Date().toISOString(), runId,
      turnDefinition: "从点击 #refresh 到提示出现（含被注入的读取与写请求）",
      turn, turnTotalApi: turn.length,
      writes: turn.filter((r) => r.method !== "GET").length,
      reads: turn.filter((r) => r.method === "GET").length,
      heldReadOrder: turn.filter((r) => r.injected === "hold").map((r) => r.order),
      message, refreshDisabled, inflightState, readHeld, orderSeenAtMessage: messageAt,
      hub: { state: detail && detail.state, stopping: detail && detail.stopping },
    };
    writeFileSync(path.join(dir, "record-hold.json"), JSON.stringify(record, null, 2));
    console.log("Q5_HOLD " + JSON.stringify(record, null, 1));
    return record;
  } finally {
    await page.close().catch(() => {});
    for (const child of board.children || []) { try { child.kill(); } catch {} }
  }
}

async function scenarioHistory(dir) {
  const board = await bootBoard();
  const hub = hub2({ publicUrl: board.hub.publicUrl, keys: board.hub.keys, home: board.hub.home });
  const raw = await openBrowser({ width: 1440, height: 900 });
  const page = attachRealPage(raw, board.url, { keys: board.hub.keys });
  const book = ledger(raw);
  try {
    await hub.event("recheck.new");
    const targetJob = await hub.claim("q5-hist-target");
    if (!targetJob) throw new Error("目标轮没领到");
    await hub.started(targetJob.run, targetJob.token, "s-q5-hist");
    const runId = targetJob.run;
    for (let i = 0; i < 62; i++) {
      await hub.event("feedback.new");
      const job = await hub.claim("q5-hist-" + i);
      if (!job) throw new Error("历史造数第 " + i + " 条没领到");
      await hub.finish(job.run, job.token, { outcome: "done", summary: "历史样本 " + i });
    }
    await page.view("runs");
    let hops = 0;
    let found = false;
    while (hops < 4 && !found) {
      const moved = await page.clickOptional("#older-page");
      if (!moved) break;
      hops += 1;
      await page.waitFor("#page-title", 6000);
      found = await page.raw.eval("!!document.querySelector('button[data-run=\"" + runId + "\"]')");
    }
    if (!found) throw new Error("历史页没找到目标轮 " + runId);
    if (!(await openCancel(page, runId))) throw new Error("历史页取消对话框没打开");
    const flags = { fail: true };
    const gate = await book.enable((request) => {
      const url = String(request.url);
      if (!url.includes("/api/state")) return "pass";
      if (!flags.fail) return "pass";
      return url.includes("before=") ? "pass" : "fail";
    });
    await sleep(300);
    const turnStart = book.records.length;
    await page.raw.eval("document.querySelector('#cancel-form').requestSubmit()");
    let message = "";
    for (let i = 0; i < 120 && !message; i++) { message = String(await rawText(page, "#action-message")).trim(); if (!message) await sleep(100); }
    await sleep(1200);
    const turn = book.records.slice(turnStart);
    const detail = await hub.runDetail(runId);
    const bodyText = await page.raw.eval("document.body.innerText");
    await gate.stop();
    await page.screenshot(path.join(dir, "cancel-history.png"));
    const record = {
      case: "q5-history", at: new Date().toISOString(), runId, hops,
      turnDefinition: "从提交取消表单到提示出现并完成回落读取",
      turn, turnTotalApi: turn.length,
      writes: turn.filter((r) => r.method !== "GET").length,
      reads: turn.filter((r) => r.method === "GET").length,
      failedReads: turn.filter((r) => /failed/.test(String(r.outcome))).map((r) => ({ order: r.order, path: r.path, outcome: r.outcome })),
      message, stillOlder: bodyText.includes("正在查看较早历史"),
      hub: { state: detail && detail.state, stopping: detail && detail.stopping },
    };
    writeFileSync(path.join(dir, "record-history.json"), JSON.stringify(record, null, 2));
    console.log("Q5_HISTORY " + JSON.stringify(record, null, 1));
    return record;
  } finally {
    await page.close().catch(() => {});
    for (const child of board.children || []) { try { child.kill(); } catch {} }
  }
}

async function main() {
  const which = process.argv[2] || "hold";
  const dir = path.join(EVID, "q5-order-" + stamp());
  mkdirSync(dir, { recursive: true });
  const record = which === "history" ? await scenarioHistory(dir) : await scenarioHold(dir);
  writeFileSync(path.join(dir, "record.json"), JSON.stringify(record, null, 2));
  console.log("Q5_DIR " + dir);
}
main().catch((error) => { console.error("Q5_FAIL " + (error && error.stack || error)); process.exit(1); });
