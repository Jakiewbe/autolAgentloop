// supplement.mjs：v2 包缺口补证（取消刷新时序 A/B、/c/ 入口、真实两档宽度）
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { bootBoard } from "./board.mjs";
import { attachRealPage } from "./page-real.mjs";
import { openBrowser } from "../selftest-v2/cdp.mjs";
import { hub2 } from "../selftest-v2/lib2.mjs";

const EVID = path.join(import.meta.dirname, "..", "evidence");
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");
function outDir(name) {
  const dir = path.join(EVID, name + "-" + stamp());
  mkdirSync(dir, { recursive: true });
  return dir;
}

function intercept(raw, decide) {
  const state = { failed: [], held: [], passed: [], errors: [] };
  const sid = raw.sessionId;
  const onEvent = async (event) => {
    let data;
    try { data = JSON.parse(String(event.data)); } catch { return; }
    if (data.sessionId !== sid || data.method !== "Fetch.requestPaused") return;
    const requestId = data.params.requestId;
    const request = data.params.request;
    let action = "pass";
    try { action = decide(request) || "pass"; } catch { action = "pass"; }
    try {
      if (action === "fail") {
        state.failed.push(request.url);
        await raw.send("Fetch.failRequest", { requestId, errorReason: "Failed" });
      } else if (action === "hold") {
        state.held.push(request.url);
      } else {
        state.passed.push(request.url);
        await raw.send("Fetch.continueRequest", { requestId });
      }
    } catch (error) { state.errors.push(String(error).slice(0, 120)); }
  };
  raw.ws.addEventListener("message", onEvent);
  const ready = raw.send("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
  return ready.then(() => ({
    state,
    async release() {
      for (const url of state.held.splice(0)) { void url; }
    },
    async stop() {
      try { await raw.send("Fetch.disable"); } catch {}
      raw.ws.removeEventListener("message", onEvent);
    },
  }));
}

const countUrl = (raw, needle) => raw.requests.filter((url) => String(url).includes(needle)).length;
const rawText = (page, selector) =>
  page.raw.eval("(() => { const el = document.querySelector(" + JSON.stringify(selector) + "); return el ? (el.textContent || '') : ''; })()");
const isDisabled = (page, selector) =>
  page.raw.eval("(() => { const el = document.querySelector(" + JSON.stringify(selector) + "); return el ? el.disabled === true : null; })()");

async function seedClaimed(hub, tag = "sup") {
  await hub.event("feedback.new");
  const job = await hub.claim(tag + "-" + Date.now());
  if (!job) throw new Error("没有可领的活");
  await hub.started(job.run, job.token, "s-" + tag + "-" + job.run);
  return job.run;
}

function save(dir, name, record) {
  writeFileSync(path.join(dir, name + ".json"), JSON.stringify(record, null, 2));
}

async function openCancel(hub, page, runId) {
  await page.view("runs");
  const found = await page.clickOptional('button[data-run="' + runId + '"]');
  if (!found) return false;
  await page.waitFor("#run-detail[open]", 8000);
  await page.waitFor("#run-detail [data-stop-run]", 8000);
  await page.click("#run-detail [data-stop-run]");
  return page.waitFor("#action-dialog[open] form#cancel-form", 8000);
}

// 时序 A：状态读取还没返回时提交取消；本次刷新被跳过，只能表示未确认。
async function caseHold() {
  const dir = outDir("supplement-cancel-hold");
  const board = await bootBoard();
  const hub = hub2({ publicUrl: board.hub.publicUrl, keys: board.hub.keys, home: board.hub.home });
  const raw = await openBrowser({ width: 1440, height: 900 });
  const page = attachRealPage(raw, board.url, { keys: board.hub.keys });
  const checks = [];
  let runId = null;
  try {
    runId = await seedClaimed(hub, "sup-hold");
    const opened = await openCancel(hub, page, runId);
    if (!opened) throw new Error("取消对话框没打开");
    const net = await intercept(raw, (request) => (String(request.url).includes("/api/state") ? "hold" : "pass"));
    await page.raw.eval("document.querySelector('#refresh').click()");
    let held = 0;
    for (let index = 0; index < 60 && !held; index++) {
      await sleep(100);
      held = net.state.held.length;
    }
    const inFlight = await isDisabled(page, "#refresh");
    const writesBefore = countUrl(raw, "/api/runs/" + runId + "/cancel");
    await page.raw.eval("document.querySelector('#cancel-form').requestSubmit()");
    let message = "";
    for (let index = 0; index < 90; index++) {
      message = String(await rawText(page, "#action-message")).trim();
      if (message) break;
      await sleep(200);
    }
    const writes = countUrl(raw, "/api/runs/" + runId + "/cancel");
    const rowText = await page.raw.eval("(() => { const row = document.querySelector('table tbody tr:has(button[data-run=\"" + runId + "\"])') || document.querySelector('button[data-run=\"" + runId + "\"]'); return row ? row.innerText : ''; })()");
    const after = await hub.runDetail(runId);
    await page.screenshot(path.join(dir, "cancel-hold.png"));
    await net.stop();
    checks.push({ name: "读取在提交时确实还没返回", ok: inFlight === true && held > 0, detail: JSON.stringify({ refreshDisabled: inFlight, held }) });
    checks.push({ name: "提示只能表示尚未确认", ok: message.includes("没能刷新中心状态") && !message.includes("已确认这轮已取消"), detail: JSON.stringify({ message }) });
    checks.push({ name: "写请求只发一次、不自动重试", ok: writesBefore === 0 && writes === 1, detail: JSON.stringify({ writesBefore, writes }) });
    checks.push({ name: "页面没有声称已停止", ok: !rowText.includes("已取消") && !message.includes("已确认这轮已取消") && after && after.stopping === true && after.state === "claimed", detail: JSON.stringify({ rowText, stopping: after && after.stopping, state: after && after.state }) });
    const record = { case: "cancel-hold", at: new Date().toISOString(), runId, message, writes, held, hub: { state: after && after.state, stopping: after && after.stopping }, checks };
    save(dir, "record", record);
    console.log("HOLD " + JSON.stringify({ message, writes, held, checks: checks.map((c) => [c.name, c.ok]) }));
    return record;
  } finally {
    await page.close().catch(() => {});
    for (const child of board.children || []) { try { child.kill(); } catch {} }
  }
}

// 时序 B：历史页提交取消，最新读取失败、恢复历史页成功；仍须表示未确认。
async function caseHistory() {
  const dir = outDir("supplement-cancel-history");
  const board = await bootBoard();
  const hub = hub2({ publicUrl: board.hub.publicUrl, keys: board.hub.keys, home: board.hub.home });
  const raw = await openBrowser({ width: 1440, height: 900 });
  const page = attachRealPage(raw, board.url, { keys: board.hub.keys });
  const checks = [];
  let runId = null;
  try {
    await hub.event("recheck.new");
    const targetJob = await hub.claim("sup-hist-target");
    if (!targetJob) throw new Error("目标轮没领到");
    await hub.started(targetJob.run, targetJob.token, "s-sup-hist");
    runId = targetJob.run;
    for (let index = 0; index < 62; index++) {
      await hub.event("feedback.new");
      const job = await hub.claim("sup-hist-" + index);
      if (!job) throw new Error("历史造数第 " + index + " 条没领到");
      await hub.finish(job.run, job.token, { outcome: "done", summary: "历史样本 " + index });
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
      if (!found) {
        found = await page.raw.eval("(() => { const el = document.querySelector('#view-content'); return el ? el.innerText.includes(" + JSON.stringify(String(runId)) + ") : false; })()");
      }
    }
    if (!found) throw new Error("历史页里没找到目标轮 " + runId);
    const opened = await openCancel(hub, page, runId).catch(() => false);
    if (!opened) throw new Error("历史页取消对话框没打开");
    const net = await intercept(raw, (request) => {
      const url = String(request.url);
      if (!url.includes("/api/state")) return "pass";
      return url.includes("before=") ? "pass" : "fail";
    });
    await page.raw.eval("document.querySelector('#cancel-form').requestSubmit()");
    let message = "";
    for (let index = 0; index < 90; index++) {
      message = String(await rawText(page, "#action-message")).trim();
      if (message) break;
      await sleep(200);
    }
    const writes = countUrl(raw, "/api/runs/" + runId + "/cancel");
    const latestFails = net.state.failed.filter((url) => url.includes("/api/state")).length;
    const restoredReads = net.state.passed.filter((url) => url.includes("/api/state") && url.includes("before=")).length;
    const bodyText = await page.raw.eval("document.body.innerText");
    const after = await hub.runDetail(runId);
    await page.screenshot(path.join(dir, "cancel-history.png"));
    await net.stop();
    checks.push({ name: "历史页能提交取消", ok: writes >= 1 && after && after.stopping === true, detail: JSON.stringify({ writes, stopping: after && after.stopping }) });
    checks.push({ name: "最新读取确实失败", ok: latestFails >= 1, detail: JSON.stringify({ latestFails }) });
    checks.push({ name: "恢复历史页读取成功", ok: restoredReads >= 1, detail: JSON.stringify({ restoredReads, stillOlder: bodyText.includes("正在查看较早历史") }) });
    const rowText = await page.raw.eval("(() => { const row = document.querySelector('table tbody tr:has(button[data-run=\"" + runId + "\"])') || document.querySelector('button[data-run=\"" + runId + "\"]'); return row ? row.innerText : ''; })()");
    checks.push({ name: "仍只能表示未确认", ok: message.includes("没能刷新中心状态") && !message.includes("已确认这轮已取消") && !rowText.includes("已取消") && after && after.state === "claimed", detail: JSON.stringify({ message, rowText, state: after && after.state }) });
    checks.push({ name: "写请求只发一次", ok: writes === 1, detail: JSON.stringify({ writes }) });
    const record = { case: "cancel-history", at: new Date().toISOString(), runId, hops, message, writes, latestFails, restoredReads, hub: { state: after && after.state, stopping: after && after.stopping }, checks };
    save(dir, "record", record);
    console.log("HISTORY " + JSON.stringify({ message, writes, latestFails, restoredReads, hops, checks: checks.map((c) => [c.name, c.ok]) }));
    return record;
  } finally {
    await page.close().catch(() => {});
    for (const child of board.children || []) { try { child.kill(); } catch {} }
  }
}

// /c/：包里没有该路由；隔离中心也不实现，故只验面板侧没有入口且不泄漏能力链接。
async function caseCentry() {
  const dir = outDir("supplement-centry");
  const board = await bootBoard();
  const hub = hub2({ publicUrl: board.hub.publicUrl, keys: board.hub.keys, home: board.hub.home });
  const raw = await openBrowser({ width: 1440, height: 900 });
  const page = attachRealPage(raw, board.url, { keys: board.hub.keys });
  const checks = [];
  try {
    const asked = await hub.ask("C 入口探针卡片", ["甲", "乙"]);
    await page.view("attention");
    const state = await (await fetch(board.url + "/api/state")).text();
    const probe = {};
    for (const target of ["/c/probe-token", "/c/", "/c", "/c/" + "a".repeat(70)]) {
      const response = await fetch(board.url + target, { redirect: "manual" });
      probe[target] = { status: response.status, type: response.headers.get("content-type") };
    }
    const bodyText = await page.raw.eval("document.body.innerText");
    await page.screenshot(path.join(dir, "panel.png"));
    checks.push({ name: "面板没有 /c/ 路由", ok: probe["/c/probe-token"].status === 404, detail: JSON.stringify(probe) });
    checks.push({ name: "页面不出现能力链接", ok: !bodyText.includes("/c/") && state.indexOf("/c/") < 0, detail: JSON.stringify({ page: bodyText.includes("/c/"), state: state.indexOf("/c/") }) });
    checks.push({ name: "卡片仍可正常操作", ok: await page.raw.eval("!!document.querySelector('[data-open-card=\"" + asked.card.id + "\"]')"), detail: JSON.stringify({ card: asked.card.id }) });
    const record = { case: "centry", at: new Date().toISOString(), probe, checks };
    save(dir, "record", record);
    console.log("CENTRY " + JSON.stringify({ probe, checks: checks.map((c) => [c.name, c.ok]) }));
    return record;
  } finally {
    await page.close().catch(() => {});
    for (const child of board.children || []) { try { child.kill(); } catch {} }
  }
}

// 两档真实宽度：真的开两个窗口尺寸，记录 innerWidth / scrollWidth。
async function caseWidths() {
  const dir = outDir("supplement-widths");
  const board = await bootBoard();
  const hub = hub2({ publicUrl: board.hub.publicUrl, keys: board.hub.keys, home: board.hub.home });
  const checks = [];
  const measured = [];
  try {
    await hub.ask("宽度探针卡片", ["甲", "乙"]);
    for (const spec of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const raw = await openBrowser({ width: spec.width, height: spec.height });
      const page = attachRealPage(raw, board.url, { keys: board.hub.keys });
      try {
        // 无头窗口有最小宽度（要求 390 时实际被撑到 ~500），因此按目标视口设真实布局尺寸：
        // innerWidth / 媒体查询 / 布局都按该宽度计算，是真实视口而不是截图裁剪。
        await raw.send("Emulation.setDeviceMetricsOverride", {
          width: spec.width,
          height: spec.height,
          deviceScaleFactor: 1,
          mobile: spec.width < 600,
        });
        if (spec.width < 600) await raw.send("Emulation.setTouchEmulationEnabled", { enabled: true });
        for (const view of ["attention", "runs", "plans"]) {
          await page.view(view);
          const box = await page.raw.eval("JSON.stringify({ innerWidth: window.innerWidth, scrollWidth: document.documentElement.scrollWidth, bodyScroll: document.body.scrollWidth, outerWidth: window.outerWidth, clientWidth: document.documentElement.clientWidth, mq: matchMedia('(max-width: 600px)').matches })");
          const parsed = JSON.parse(box);
          measured.push({ requested: spec.width, view, ...parsed });
          await page.screenshot(path.join(dir, spec.width + "-" + view + ".png"));
        }
      } finally {
        await page.close().catch(() => {});
      }
    }
    const wide = measured.filter((row) => row.requested === 1440);
    const narrow = measured.filter((row) => row.requested === 390);
    checks.push({ name: "1440 窗口真实生效", ok: wide.length > 0 && wide.every((row) => row.innerWidth === 1440), detail: JSON.stringify(wide.map((row) => row.innerWidth)) });
    checks.push({ name: "390 窗口真实生效", ok: narrow.length > 0 && narrow.every((row) => row.innerWidth === 390), detail: JSON.stringify(narrow.map((row) => row.innerWidth)) });
    const overflow = measured.filter((row) => row.scrollWidth > row.innerWidth + 1);
    checks.push({ name: "两档都没有横向溢出", ok: overflow.length === 0, detail: JSON.stringify(overflow.map((row) => [row.requested, row.view, row.innerWidth, row.scrollWidth])) });
    const record = { case: "widths", at: new Date().toISOString(), measured, checks };
    save(dir, "record", record);
    console.log("WIDTHS " + JSON.stringify({ measured, checks: checks.map((c) => [c.name, c.ok]) }));
    return record;
  } finally {
    for (const child of board.children || []) { try { child.kill(); } catch {} }
  }
}

export const cases = { hold: caseHold, history: caseHistory, centry: caseCentry, widths: caseWidths };

const which = process.argv[2] || "hold";
if (cases[which]) {
  const record = await cases[which]();
  const failed = record.checks.filter((check) => !check.ok);
  console.log("RESULT " + (failed.length ? "FAIL" : "PASS") + " " + JSON.stringify(failed));
  process.exit(failed.length ? 1 : 0);
} else {
  console.log("未知用例: " + which);
  process.exit(2);
}
