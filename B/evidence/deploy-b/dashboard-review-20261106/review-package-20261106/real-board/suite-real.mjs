// suite-real.mjs：对「受审包真实面板」跑 14 条判据。判据只认用户可见/可操作的事实，
// 不依赖受审实现的内部命名；受审前端一个字节都不改。
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { bootBoard } from "./board.mjs";
import { openRealPage } from "./page-real.mjs";
import { hub2 } from "../selftest-v2/lib2.mjs";

export const SUITE_VERSION = "dashboard-real-suite-v2.1.0";
const HERE = import.meta.dirname;
const OUT_ROOT = path.join(HERE, "..", "evidence");

const wait = (ms) => sleep(ms);
const rand = () => Math.random().toString(36).slice(2, 7).toUpperCase();

async function until(fn, timeout = 10000, step = 150) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < timeout) {
    last = await fn();
    if (last) return last;
    await wait(step);
  }
  return last;
}

async function runsForEvent(hub, eventKey) {
  const state = await hub.state();
  const found = [];
  for (const run of (state.data.runs || []).slice(0, 31)) {
    const why = await hub.why(run.id);
    const byId = new Map();
    const links = [];
    for (const entry of why.data || []) {
      for (const change of entry.changes || []) {
        const row = change.row || {};
        if (change.table === "events") byId.set(Number(row.id), String(row.key));
        if (change.table === "run_events" && Number(row.run_id) === Number(run.id)) links.push(Number(row.event_id));
      }
    }
    if (links.some((id) => byId.get(id) === eventKey)) found.push(run);
  }
  return found;
}

async function eventIdsFor(hub, keys) {
  const want = new Set(keys.map(String));
  const map = new Map();
  const state = await hub.state();
  for (const run of (state.data.runs || []).slice(0, 31)) {
    const why = await hub.why(run.id);
    for (const entry of why.data || []) {
      for (const change of entry.changes || []) {
        const row = change.row || {};
        if (change.table === "events" && want.has(String(row.key))) map.set(String(row.key), String(row.id));
      }
    }
  }
  return map;
}

async function claimFor(hub, eventId, tag = "real") {
  for (let attempt = 0; attempt < 15; attempt++) {
    const job = await hub.claim(tag + "-" + Date.now() + "-" + attempt);
    if (!job) { await wait(200); continue; }
    const ids = ((job.context && job.context.events) || []).map((entry) => entry.id);
    if (!eventId || ids.includes(eventId)) return job;
    await hub.finish(job.run, job.token, { outcome: "cancelled", summary: "清场：不是本次事件" });
  }
  return null;
}

async function openNotice(hub, title) {
  const event = await hub.event();
  const job = await claimFor(hub, event.id);
  if (!job) throw new Error("没领到造通知的轮次");
  await hub.started(job.run, job.token, "s-" + job.run);
  const receipt = await hub.finish(job.run, job.token, { outcome: "done", summary: "有件事要你确认", notice: [{ title: title, text: "验收用通知正文" }] });
  if (!receipt.ok) throw new Error("发通知失败: " + receipt.text.slice(0, 200));
  const card = await until(async () => {
    const state = await hub.state();
    return (state.data.cards || []).find((entry) => entry.title === title && entry.kind === "notice") ?? null;
  });
  if (!card) throw new Error("通知卡片没出现: " + title);
  return card;
}

function verdict(checks) {
  return { status: checks.every((c) => c.ok) ? "PASS" : "FAIL", checks: checks };
}

const CASES = [
  {
    id: "T1",
    name: "选择与文字都必须结案并回显",
    required: true,
    async run(ctx) {
      const hub = ctx.hub, page = ctx.page;
      const choice = await hub.ask("T1 选择题", ["甲", "乙", "丙"]);
      const text = await hub.ask("T1 文字题", ["是", "否"]);
      await page.view("attention");
      const first = await page.snapshot();
      const seen = (id) => first.cards.some((card) => card.id === String(id));
      if (!seen(choice.card.id) || !seen(text.card.id))
        return { status: "FAIL", checks: [{ name: "两张卡都在页面上", ok: false, detail: "页面没有渲染出 T1 的两张卡" }] };
      await page.answerChoice(choice.card.id, 1);
      const answered = await until(async () => {
        const card = await hub.cardById(choice.card.id);
        return card && card.state !== "open" ? card : null;
      });
      const word = "T1-TEXT-" + rand();
      await page.answerText(text.card.id, word);
      const typed = await until(async () => {
        const card = await hub.cardById(text.card.id);
        return card && card.answer === word ? card : null;
      });
      await page.view("attention");
      const shot = await page.snapshot();
      const shownChoice = shot.cards.find((card) => card.id === String(choice.card.id));
      const shownText = shot.cards.find((card) => card.id === String(text.card.id));
      const checks = [
        { name: "选择题按序号结案", ok: Boolean(answered && answered.choice === 1), detail: JSON.stringify({ state: answered && answered.state, choice: answered && answered.choice }) },
        { name: "文字题按原文结案", ok: Boolean(typed && typed.answer === word), detail: JSON.stringify({ state: typed && typed.state, answer: typed && typed.answer }) },
        { name: "页面回显选择题答案", ok: Boolean(shownChoice && shownChoice.answer.indexOf("乙") >= 0), detail: JSON.stringify({ answer: shownChoice && shownChoice.answer }) },
        { name: "页面回显文字答案", ok: Boolean(shownText && shownText.answer.indexOf(word) >= 0), detail: JSON.stringify({ answer: shownText && shownText.answer }) },
      ];
      return verdict(checks);
    },
  },
  {
    id: "T2",
    name: "通知必须带原因结案，fyi 只读",
    required: true,
    async run(ctx) {
      const hub = ctx.hub, page = ctx.page;
      const notice = await openNotice(hub, "T2 待确认通知");
      const note = await hub.fyi("T2 只读通知 " + Date.now());
      await page.view("attention");
      const before = await page.snapshot();
      const noticeCard = before.cards.find((card) => card.id === String(notice.id));
      const fyiCard = before.cards.find((card) => card.id === String(note.card.id));
      const reason = "T2-REASON-" + rand();
      let resolved = null;
      if (noticeCard && noticeCard.actionable > 0) {
        await page.resolveNotice(notice.id, reason);
        resolved = await until(async () => {
          const card = await hub.cardById(notice.id);
          return card && card.state === "closed" ? card : null;
        });
      }
      await page.view("attention");
      const after = await page.snapshot();
      const shown = after.cards.find((card) => card.id === String(notice.id));
      const checks = [
        { name: "通知卡片自身有结案操作", ok: Boolean(noticeCard && noticeCard.actionable > 0), detail: JSON.stringify({ actionable: noticeCard && noticeCard.actionable, tag: noticeCard && noticeCard.tagText }) },
        { name: "结案原因落到中台", ok: Boolean(resolved && resolved.result === reason), detail: JSON.stringify({ state: resolved && resolved.state, result: resolved && resolved.result }) },
        { name: "页面显示结案原因", ok: Boolean(shown && shown.closedReason.indexOf(reason) >= 0), detail: JSON.stringify({ closedReason: shown && shown.closedReason }) },
        { name: "fyi 卡片只读", ok: Boolean(fyiCard && fyiCard.actionable === 0 && fyiCard.state === "closed"), detail: JSON.stringify({ actionable: fyiCard && fyiCard.actionable, state: fyiCard && fyiCard.state }) },
      ];
      return verdict(checks);
    },
  },
  {
    id: "T3",
    name: "后续轮真实完成，卡片结果与运行结果分立",
    required: true,
    async run(ctx) {
      const hub = ctx.hub, page = ctx.page;
      const asked = await hub.ask("T3 目标卡片", ["确认", "再等等"]);
      await page.view("attention");
      await page.answerChoice(asked.card.id, 0);
      const follow = await until(async () => {
        const runs = await runsForEvent(hub, "card:" + asked.card.id);
        return runs.sort((a, b) => b.id - a.id)[0] ?? null;
      }, 8000);
      if (!follow) return { status: "FAIL", checks: [{ name: "回答后派出后续轮", ok: false, detail: "没有同线程的后续 run" }] };
      const job = await claimFor(hub, "card:" + asked.card.id);
      if (!job || job.run !== follow.id) return { status: "FAIL", checks: [{ name: "领到后续轮", ok: false, detail: JSON.stringify({ expected: follow.id, got: job && job.run }) }] };
      await hub.started(job.run, job.token, "s-" + job.run);
      const marker = "T3-RUN-OK-" + rand();
      const receipt = await hub.finish(job.run, job.token, { outcome: "done", summary: marker });
      const done = await until(async () => {
        const run = await hub.runById(follow.id);
        return run && run.state === "done" ? run : null;
      });
      await page.view("runs");
      const runShot = await page.snapshot();
      const row = runShot.runs.find((entry) => entry.id === String(follow.id));
      await page.view("attention");
      const attShot = await page.snapshot();
      const card = attShot.cards.find((entry) => entry.id === String(asked.card.id));
      const checks = [
        { name: "后续轮收据被接受", ok: Boolean(receipt.ok && done), detail: JSON.stringify({ status: receipt.status, state: done && done.state }) },
        { name: "运行结果单独呈现", ok: Boolean(row && row.summary === marker && row.state === "done"), detail: JSON.stringify({ state: row && row.state, summary: row && row.summary }) },
        { name: "卡片结论落在卡片上", ok: Boolean(card && card.state === "done" && card.closedReason.indexOf(marker) >= 0), detail: JSON.stringify({ state: card && card.state, closedReason: card && card.closedReason }) },
        { name: "卡片保留原问题不吞运行正文", ok: Boolean(card && card.text.indexOf("T3 目标卡片") >= 0), detail: JSON.stringify({ text: card && card.text && card.text.slice(0, 160) }) },
      ];
      return verdict(checks);
    },
  },
  {
    id: "T4",
    name: "重复提交不重复落库",
    required: true,
    async run(ctx) {
      const hub = ctx.hub, page = ctx.page;
      const asked = await hub.ask("T4 重复提交", ["好", "不"]);
      await page.view("attention");
      await page.answerChoice(asked.card.id, 0);
      await wait(600);
      const again = await page.postJson("/api/cards/" + asked.card.id + "/answer", { choice: 1 });
      const card = await hub.cardById(asked.card.id);
      const runs = await runsForEvent(hub, "card:" + asked.card.id);
      await page.view("attention");
      const shot = await page.snapshot();
      const shown = shot.cards.filter((entry) => entry.id === String(asked.card.id)).length;
      const rejected = again.status === 409 || Boolean(again.payload && again.payload.changed === false);
      const checks = [
        { name: "重复提交被拒", ok: rejected, detail: JSON.stringify({ status: again.status, payload: again.payload }) },
        { name: "卡片只结一次", ok: Boolean(card && card.state !== "open" && Number(card.version) <= 3), detail: JSON.stringify({ state: card && card.state, version: card && card.version }) },
        { name: "只派一条后续轮", ok: runs.length === 1, detail: JSON.stringify({ runs: runs.map((entry) => entry.id) }) },
        { name: "页面上这张卡只出现一次", ok: shown === 1, detail: JSON.stringify({ shown: shown }) },
      ];
      return verdict(checks);
    },
  },
  {
    id: "T5",
    name: "取消必须先过确认表单再等执行端确认",
    required: true,
    async run(ctx) {
      const hub = ctx.hub, page = ctx.page;
      const running = await hub.running();
      await page.view("runs");
      await page.click('tr.task-row button[data-run="' + running.run + '"]');
      await page.waitFor("#run-detail[open]");
      await wait(400);
      const detail = await page.snapshot();
      const stopClicked = await page.clickOptional("#run-detail [data-stop-run]");
      const formShown = stopClicked ? await page.waitFor("#cancel-form") : false;
      const formSnap = await page.snapshot();
      const before = await hub.runById(running.run);
      if (stopClicked) {
        await page.click("#cancel-form button[type=submit]");
        await wait(1600);
      }
      const after = await hub.runById(running.run);
      const pendingShot = await page.view("runs");
      const pendingRow = pendingShot.runs.find((entry) => entry.id === String(running.run));
      const receipt = await hub.finish(running.run, running.token, { outcome: "cancelled", summary: "执行端确认取消" });
      const final = await until(async () => {
        const row = await hub.runById(running.run);
        return row && row.state === "cancelled" ? row : null;
      }, 6000);
      const lastShot = await page.view("runs");
      const lastRow = lastShot.runs.find((entry) => entry.id === String(running.run));
      const checks = [
        { name: "详情里有取消入口", ok: detail.dialog.stopButton === true, detail: JSON.stringify({ stopButton: detail.dialog.stopButton }) },
        { name: "取消先弹确认表单", ok: Boolean(formShown && formSnap.dialog.formId === "cancel-form"), detail: JSON.stringify({ formShown: formShown, formId: formSnap.dialog.formId }) },
        { name: "提交前中台没有取消请求", ok: Boolean(before && !before.stopping), detail: JSON.stringify({ state: before && before.state, stopping: before && before.stopping }) },
        { name: "提交后只记待确认", ok: Boolean(after && after.stopping === true && ["claimed", "running"].indexOf(after.state) >= 0), detail: JSON.stringify({ state: after && after.state, stopping: after && after.stopping }) },
        { name: "界面显示等待确认", ok: Boolean(pendingRow && pendingRow.cancelMark === "pending" && pendingRow.badgeText === "等待停止确认"), detail: JSON.stringify({ badge: pendingRow && pendingRow.badgeText }) },
        { name: "执行端确认后才显示已取消", ok: Boolean(receipt.ok && final && lastRow && lastRow.state === "cancelled" && lastRow.badgeText === "已取消"), detail: JSON.stringify({ status: receipt.status, state: lastRow && lastRow.state }) },
      ];
      return verdict(checks);
    },
  },
  {
    id: "T6",
    name: "时间线按事实 ID 对账，不靠全文关键词",
    required: true,
    async run(ctx) {
      const hub = ctx.hub, page = ctx.page;
      const asked = await hub.ask("T6 时间线目标", ["一", "二"]);
      await page.view("attention");
      await page.answerChoice(asked.card.id, 1);
      const follow = await until(async () => {
        const runs = await runsForEvent(hub, "card:" + asked.card.id);
        return runs.sort((a, b) => b.id - a.id)[0] ?? null;
      }, 8000);
      if (!follow) return { status: "FAIL", checks: [{ name: "有后续轮", ok: false, detail: "没有可查的时间线目标" }] };
      const job = await claimFor(hub, "card:" + asked.card.id);
      await hub.started(job.run, job.token, "s-" + job.run);
      await hub.finish(job.run, job.token, { outcome: "done", summary: "T6 完成" });
      const facts = await page.timelineFacts(follow.id);
      const why = await hub.why(follow.id);
      const allowed = new Set();
      let answerEventId = null;
      for (const entry of why.data || []) {
        for (const change of entry.changes || []) {
          const row = change.row || {};
          if (change.table === "events") {
            allowed.add("event:" + row.id);
            if (String(row.key) === "card:" + asked.card.id) answerEventId = row.id;
          }
          if (change.table === "cards") allowed.add("card:" + row.id);
          if (change.table === "due") allowed.add("timer:" + (row.key || ""));
          if (change.table === "config") allowed.add("config:" + (row.key || "rules"));
          if (change.table === "runs") allowed.add("run:" + row.id);
        }
      }
      allowed.add("run:" + follow.id);
      const set = new Set(facts || []);
      const fabricated = (facts || []).filter((fact) => !allowed.has(fact) && !/^run:[0-9]+$/.test(fact) && !/^config:/.test(fact));
      const checks = [
        { name: "能打开时间线", ok: Array.isArray(facts) && facts.length > 0, detail: JSON.stringify({ facts: facts }) },
        { name: "命中回答事件 ID", ok: Boolean(answerEventId && set.has("event:" + answerEventId)), detail: JSON.stringify({ answerEventId: answerEventId, facts: (facts || []).slice(0, 12) }) },
        { name: "命中目标卡片 ID", ok: set.has("card:" + asked.card.id), detail: JSON.stringify({ card: asked.card.id }) },
        { name: "没有凭空事实", ok: fabricated.length === 0, detail: JSON.stringify({ fabricated: fabricated, allowed: [...allowed] }) },
      ];
      return verdict(checks);
    },
  },
  {
    id: "T7",
    name: "分页真换内容、活动轮、计划面与延后任务",
    required: true,
    async run(ctx) {
      const hub = ctx.hub, page = ctx.page;
      for (let index = 0; index < 62; index++) {
        const seeded = await hub.event("feedback.new");
        const job = await claimFor(hub, seeded.id, "t7-seed");
        if (!job) throw new Error("历史造数第 " + index + " 条没领到");
        await hub.finish(job.run, job.token, { outcome: "done", summary: "历史样本 " + index });
      }
      const fresh = await hub.event("feedback.new");
      const freshRun = (await runsForEvent(hub, fresh.id))[0];
      const failedEvent = await hub.event("feedback.new");
      const failedJob = await claimFor(hub, failedEvent.id, "t7-later");
      if (failedJob) await hub.finish(failedJob.run, failedJob.token, { outcome: "failed", error: "用例制造延后" });
      await page.view("runs");
      const first = await page.snapshot();
      const firstIds = first.runs.map((row) => row.id);
      const older = await page.older();
      const second = older.snapshot;
      const secondIds = second.runs.map((row) => row.id);
      const overlap = firstIds.filter((id) => secondIds.indexOf(id) >= 0);
      await page.view("plans");
      const plans = await page.snapshot();
      const checks = [
        { name: "有更早一页", ok: Boolean(older.clicked && secondIds.length > 0), detail: JSON.stringify({ clicked: older.clicked, first: firstIds.length, second: secondIds.length }) },
        { name: "翻页真的换内容", ok: overlap.length === 0 && secondIds.length > 0, detail: JSON.stringify({ overlap: overlap.slice(0, 5), first: firstIds.slice(0, 4), second: secondIds.slice(0, 4) }) },
        { name: "首页含最新活动轮", ok: Boolean(freshRun && firstIds.indexOf(String(freshRun.id)) >= 0), detail: JSON.stringify({ freshRun: freshRun && freshRun.id }) },
        { name: "计划面在", ok: plans.plan.lines.length >= 1, detail: JSON.stringify(plans.plan.lines.map((row) => row.meta)) },
        { name: "外部计划在", ok: plans.plan.elsewhere.length >= 1, detail: JSON.stringify(plans.plan.elsewhere.map((row) => row.meta)) },
        { name: "延后任务在", ok: plans.plan.delayed.length >= 1, detail: JSON.stringify(plans.plan.rows.map((row) => row.meta)) },
      ];
      return verdict(checks);
    },
  },
  {
    id: "T8",
    name: "卡片自身操作可用性，不拿任意禁用按钮当证据",
    required: true,
    async run(ctx) {
      const hub = ctx.hub, page = ctx.page;
      const asked = await hub.ask("T8 可操作卡片", ["行", "不行"]);
      const note = await hub.fyi("T8 只读样本 " + Date.now());
      await page.view("attention");
      const snap = await page.snapshot();
      const open = snap.cards.find((card) => card.id === String(asked.card.id));
      const closed = snap.cards.find((card) => card.id === String(note.card.id));
      const openBtn = await page.raw.eval("!!document.querySelector('[data-open-card=\"" + asked.card.id + "\"]')");
      const closedBtn = await page.raw.eval("!!document.querySelector('[data-open-card=\"" + note.card.id + "\"]')");
      const checks = [
        { name: "待处理卡片自身可操作", ok: Boolean(open && open.actionable > 0 && openBtn), detail: JSON.stringify({ actionable: open && open.actionable, button: openBtn }) },
        { name: "只读卡片自身无可操作", ok: Boolean(closed && closed.actionable === 0 && !closedBtn), detail: JSON.stringify({ actionable: closed && closed.actionable, button: closedBtn }) },
      ];
      return verdict(checks);
    },
  },
  {
    id: "T9",
    name: "断线时提示、拒绝写入并按需重试",
    required: true,
    async run(ctx) {
      const hub = ctx.hub, page = ctx.page;
      const asked = await hub.ask("T9 断线卡片", ["甲", "乙"]);
      await page.view("attention");
      const gate = await page.failRequests("/api/state");
      await page.setOffline(true);
      await wait(6500);
      const offline = await page.snapshot();
      const attempts = gate.state.attempts;
      await page.clickOptional('[data-open-card="' + asked.card.id + '"]');
      await wait(600);
      const offlineMsg = await page.raw.eval("(() => { const el = document.querySelector('#action-message'); return el && !el.hidden ? (el.innerText || '').trim() : ''; })()");
      const writes = (await page.requests()).filter((url) => String(url).indexOf("/api/cards/") >= 0).length;
      const dialogOpen = await page.raw.eval("!!document.querySelector('#action-dialog[open]')");
      await gate.stop();
      await page.setOffline(false);
      await wait(6000);
      const back = await page.snapshot();
      const target = back.cards.find((card) => card.id === String(asked.card.id));
      const checks = [
        { name: "断线时提示并可重试", ok: Boolean(offline.stale === true && /暂时/.test(offline.alert) && offline.retry >= 1 && attempts >= 1), detail: JSON.stringify({ stale: offline.stale, alert: offline.alert, retry: offline.retry, attempts: attempts }) },
        { name: "过期时点操作被拒", ok: Boolean(offlineMsg.indexOf("已过期") >= 0 && dialogOpen === false), detail: JSON.stringify({ message: offlineMsg, dialogOpen: dialogOpen }) },
        { name: "被拒时不发写入请求", ok: writes === 0, detail: JSON.stringify({ writes: writes }) },
        { name: "恢复后重新可操作", ok: Boolean(back.stale === false && target && target.actionable > 0), detail: JSON.stringify({ stale: back.stale, actionable: target && target.actionable }) },
      ];
      return verdict(checks);
    },
  },
  {
    id: "T10",
    name: "页面与接口投影都不出现凭据或能力链接",
    required: true,
    async run(ctx) {
      const hub = ctx.hub, page = ctx.page;
      await hub.ask("T10 正常卡片", ["好", "不"]);
      await hub.fyi("T10 只读 " + Date.now());
      const shots = [];
      for (const view of ["overview", "attention", "runs", "items", "plans"]) shots.push(await page.view(view));
      const secrets = Object.values(hub.keys).map(String).filter((value) => value && value.length >= 8);
      const texts = shots.map((shot) => shot.text).join("\n");
      const keyHit = secrets.filter((value) => texts.indexOf(value) >= 0);
      const links = [];
      for (const shot of shots) for (const link of shot.links) links.push(link);
      const leaked = links.filter((link) => /\/c\/|cap-|token=|key=/i.test(link.href));
      const apiText = String(await page.raw.eval("fetch('/api/state').then((response) => response.text())"));
      const apiHit = secrets.filter((value) => apiText.indexOf(value) >= 0);
      const checks = [
        { name: "没有能力链接", ok: leaked.length === 0, detail: JSON.stringify(leaked.slice(0, 5)) },
        { name: "页面不含钥匙", ok: keyHit.length === 0, detail: JSON.stringify({ hits: keyHit.length }) },
        { name: "接口投影不含钥匙", ok: apiHit.length === 0 && apiText.length > 0, detail: JSON.stringify({ hits: apiHit.length, bytes: apiText.length }) },
      ];
      return verdict(checks);
    },
  },
  {
    id: "T11",
    name: "排队中的活立即取消",
    required: true,
    async run(ctx) {
      const hub = ctx.hub, page = ctx.page;
      const event = await hub.event();
      const run = (await runsForEvent(hub, event.id))[0];
      await page.view("runs");
      const result = await page.cancelRun(run.id);
      const after = await until(async () => {
        const row = await hub.runById(run.id);
        return row && row.state !== "queued" ? row : null;
      }, 6000);
      const checks = [
        { name: "排队可直接取消", ok: Boolean(after && after.state === "cancelled"), detail: JSON.stringify({ state: after && after.state }) },
        { name: "界面显示已取消", ok: Boolean(result.row && result.row.cancelMark === "cancelled"), detail: JSON.stringify({ badge: result.row && result.row.badgeText }) },
        { name: "提示语说清已取消", ok: Boolean(result.message && result.message.indexOf("已取消") >= 0), detail: JSON.stringify({ message: result.message }) },
      ];
      return verdict(checks);
    },
  },
  {
    id: "T12",
    name: "执行中的活要等执行端确认，不许提前报已取消",
    required: true,
    async run(ctx) {
      const hub = ctx.hub, page = ctx.page;
      const running = await hub.running();
      await page.view("runs");
      const result = await page.cancelRun(running.run);
      await wait(800);
      const middle = await hub.runById(running.run);
      const pendingShot = await page.view("runs");
      const pendingRow = pendingShot.runs.find((entry) => entry.id === String(running.run));
      const receipt = await hub.finish(running.run, running.token, { outcome: "cancelled", summary: "执行端确认取消" });
      const final = await until(async () => {
        const row = await hub.runById(running.run);
        return row && row.state === "cancelled" ? row : null;
      }, 6000);
      const lastShot = await page.view("runs");
      const lastRow = lastShot.runs.find((entry) => entry.id === String(running.run));
      const checks = [
        { name: "取消请求不直接改状态", ok: Boolean(middle && middle.stopping === true && ["claimed", "running"].indexOf(middle.state) >= 0), detail: JSON.stringify({ state: middle && middle.state, stopping: middle && middle.stopping }) },
        { name: "确认前只说等待停止", ok: Boolean(pendingRow && pendingRow.cancelMark === "pending" && pendingRow.badgeText.indexOf("已取消") < 0), detail: JSON.stringify({ badge: pendingRow && pendingRow.badgeText }) },
        { name: "执行端确认后才取消", ok: Boolean(receipt.ok && final), detail: JSON.stringify({ status: receipt.status, state: final && final.state }) },
        { name: "页面同步显示取消", ok: Boolean(lastRow && lastRow.state === "cancelled"), detail: JSON.stringify({ state: lastRow && lastRow.state }) },
      ];
      return verdict(checks);
    },
  },
  {
    id: "T13",
    name: "终态不提供取消操作",
    required: true,
    async run(ctx) {
      const hub = ctx.hub, page = ctx.page;
      const doneEvent = await hub.event();
      const doneJob = await claimFor(hub, doneEvent.id, "t13");
      await hub.started(doneJob.run, doneJob.token, "s-" + doneJob.run);
      await hub.finish(doneJob.run, doneJob.token, { outcome: "done", summary: "T13 已收尾" });
      const cancelEvent = await hub.event();
      const cancelJob = await claimFor(hub, cancelEvent.id, "t13b");
      await hub.started(cancelJob.run, cancelJob.token, "s-" + cancelJob.run);
      await hub.finish(cancelJob.run, cancelJob.token, { outcome: "cancelled", summary: "执行端确认取消" });
      await page.view("runs");
      await page.click('tr.task-row button[data-run="' + doneJob.run + '"]');
      await page.waitFor("#run-detail[open]");
      await wait(500);
      const doneDetail = await page.snapshot();
      const doneRow = doneDetail.runs.find((entry) => entry.id === String(doneJob.run));
      await page.raw.eval("(() => { const el = document.querySelector('#run-detail'); if (el) el.close(); })()");
      await wait(300);
      await page.click('tr.task-row button[data-run="' + cancelJob.run + '"]');
      await page.waitFor("#run-detail[open]");
      await wait(400);
      const cancelDetail = await page.snapshot();
      const cancelRow = cancelDetail.runs.find((entry) => entry.id === String(cancelJob.run));
      const checks = [
        { name: "已完成是终态、没有取消入口", ok: Boolean(doneDetail.dialog.stopButton === false && doneRow && doneRow.badgeText === "已完成"), detail: JSON.stringify({ stopButton: doneDetail.dialog.stopButton, badge: doneRow && doneRow.badgeText }) },
        { name: "已取消是终态、没有取消入口", ok: Boolean(cancelDetail.dialog.stopButton === false && cancelRow && cancelRow.badgeText === "已取消"), detail: JSON.stringify({ stopButton: cancelDetail.dialog.stopButton, badge: cancelRow && cancelRow.badgeText }) },
      ];
      return verdict(checks);
    },
  },
  {
    id: "T14",
    name: "规则与泳道：空泳道续接、跨规则并行、并行泳道",
    required: true,
    async run(ctx) {
      const hub = ctx.hub, page = ctx.page;
      const first = await hub.event("feedback.new");
      const second = await hub.event("feedback.new");
      const job = await claimFor(hub, first.id, "t14-lane");
      await hub.started(job.run, job.token, "s-" + job.run);
      await hub.finish(job.run, job.token, { outcome: "failed", error: "用例制造重排" });
      const merged = await until(async () => {
        const state = await hub.state();
        const queuedSame = (state.data.runs || []).filter((run) => run.rule === "意见" && run.state === "queued");
        return queuedSame.length <= 1 ? queuedSame : null;
      }, 6000);
      const mergedWhy = merged && merged.length ? await hub.why(merged[0].id) : { data: [] };
      const events = [];
      for (const entry of mergedWhy.data || []) {
        for (const change of entry.changes || []) {
          if (change.table === "run_events") events.push(String(change.row && change.row.event_id));
        }
      }
      const resolved = await eventIdsFor(hub, [first.id, second.id]);
      const crossEvent = await hub.event("recheck.new");
      const cross = await claimFor(hub, crossEvent.id, "t14-cross");
      const feedbackEvent = await hub.event("feedback.new");
      const feedbackQueued = await until(async () => {
        const state = await hub.state();
        const jobs = (state.data.runs || []).filter((run) => run.rule === "意见" && (run.state === "queued" || run.state === "claimed"));
        return jobs.length > 0 ? jobs : null;
      }, 6000);
      const paraA = await hub.event("parallel.new", { subject: "#para-A" });
      const paraB = await hub.event("parallel.new", { subject: "#para-B" });
      const jobA = await claimFor(hub, paraA.id, "t14-a");
      const jobB = await claimFor(hub, paraB.id, "t14-b");
      await page.view("items");
      const items = await page.snapshot();
      const titles = items.items.map((item) => item.title);
      const bothEvents = [first.id, second.id].every((key) => events.indexOf(resolved.get(String(key))) >= 0);
      const checks = [
        { name: "空泳道只留一条续接轮", ok: Boolean(merged && merged.length <= 1 && bothEvents), detail: JSON.stringify({ queued: (merged || []).length, events: events, resolved: [...resolved] }) },
        { name: "跨规则互不阻塞", ok: Boolean(cross && cross.run !== job.run && feedbackQueued && feedbackQueued.length >= 1), detail: JSON.stringify({ cross: cross && cross.run, feedback: (feedbackQueued || []).map((run) => [run.id, run.state]) }) },
        { name: "并行泳道各自领活", ok: Boolean(jobA && jobB && jobA.run !== jobB.run), detail: JSON.stringify({ a: jobA && jobA.run, b: jobB && jobB.run }) },
        { name: "页面按泳道分组", ok: Boolean(titles.indexOf("意见") >= 0 && titles.indexOf("#para-A") >= 0 && titles.indexOf("#para-B") >= 0), detail: JSON.stringify(titles) },
      ];
      return verdict(checks);
    },
  },
];

export async function runCase(caseId, options = {}) {
  const definition = CASES.find((entry) => entry.id === caseId);
  if (!definition) throw new Error("没有这个用例: " + caseId);
  const label = options.label ?? "canonical";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const workDir = path.join(OUT_ROOT, "real-" + label + "-" + caseId + "-" + stamp);
  mkdirSync(workDir, { recursive: true });
  const live = await bootBoard();
  const hub = hub2(live.hub);
  const page = await openRealPage(live.url, { mutation: options.mutation, keys: live.hub.keys });
  let record;
  try {
    const outcome = await definition.run({ hub: hub, page: page, workDir: workDir, center: live.center });
    record = Object.assign({ id: definition.id, name: definition.name, required: definition.required }, outcome, { mutation: options.mutation ?? null });
  } catch (error) {
    record = { id: definition.id, name: definition.name, required: definition.required, status: "FAIL", error: String((error && error.stack) || error).slice(0, 1200), checks: [], mutation: options.mutation ?? null };
  } finally {
    try { await page.screenshot(path.join(workDir, "screen.png")); } catch {}
    try { await page.close(); } catch {}
    for (const child of live.children) child.kill();
    try { rmSync(live.center.home, { recursive: true, force: true }); } catch {}
  }
  record.workDir = workDir;
  return record;
}

async function main() {
  const only = process.argv.slice(2);
  const picked = only.length ? CASES.filter((entry) => only.indexOf(entry.id) >= 0) : CASES;
  const label = process.env.SUITE_LABEL ?? "canonical";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const results = [];
  for (const definition of picked) results.push(await runCase(definition.id, { label: label }));
  const counts = { PASS: 0, FAIL: 0, UNVERIFIED: 0, SKIP: 0 };
  for (const record of results) counts[record.status] = (counts[record.status] ?? 0) + 1;
  const dir = path.join(OUT_ROOT, "suite-real-" + label + "-" + stamp);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "suite-real-result.json"), JSON.stringify({ suite: SUITE_VERSION, label: label, at: new Date().toISOString(), counts: counts, results: results }, null, 2));
  for (const record of results) {
    console.log([record.id, record.status, record.name, JSON.stringify((record.checks || []).map((c) => [c.name, c.ok]))].join(" | "));
  }
  console.log("COUNTS " + JSON.stringify(counts) + " RESULT " + path.join(dir, "suite-real-result.json"));
  const blocking = results.some((record) => record.required && record.status !== "PASS");
  process.exit(blocking ? 1 : 0);
}

if (process.argv[1] && process.argv[1].endsWith("suite-real.mjs")) await main();
