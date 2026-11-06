// 真实面板页面适配器：只按用户可见/可操作的语义定位，不依赖受审实现内部命名。
// 负例在这里注入「观察层突变」，用来证明判据不是摆设；受审前端不动一个字节。
import { readFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { openBrowser } from "../selftest-v2/cdp.mjs";

const PROBE = readFileSync(path.join(import.meta.dirname, "probe-snapshot.js.txt"), "utf8");
const TIMELINE = [
  "(() => {",
  "  const P = { \"执行\": \"run\", \"事件\": \"event\", \"卡片\": \"card\", \"复查\": \"timer\", \"规则\": \"config\" };",
  "  const out = [];",
  "  for (const tag of document.querySelectorAll(\"#run-timeline span.tag\")) {",
  "    const text = (tag.innerText || \"\").trim();",
  "    const parts = text.split(\"#\");",
  "    if (parts.length !== 2) continue;",
  "    const prefix = P[parts[0].trim()];",
  "    const id = parts[1].trim();",
  "    if (prefix && id) out.push(prefix + \":\" + id);",
  "  }",
  "  return out;",
  "})()",
].join("\n");

export function attachRealPage(raw, url, options = {}) {
  const mutations = [].concat(options.mutation ?? []).filter(Boolean);
  const keys = options.keys ?? {};
  const has = (name) => mutations.indexOf(name) >= 0;
  const sleepMs = (ms) => sleep(ms);

  const api = {
    raw: raw,
    url: url,
    mutation: mutations,
    async waitFor(selector, timeout = 10000) {
      const started = Date.now();
      while (Date.now() - started < timeout) {
        const found = await raw.eval("!!document.querySelector(" + JSON.stringify(selector) + ")");
        if (found) return true;
        await sleepMs(150);
      }
      return false;
    },
    async click(selector) {
      if (!(await api.waitFor(selector))) throw new Error("等不到可点元素: " + selector);
      await raw.click(selector);
      return true;
    },
    async clickOptional(selector) {
      const found = await raw.eval("!!document.querySelector(" + JSON.stringify(selector) + ")");
      if (!found) return false;
      await raw.click(selector);
      return true;
    },
    async setValue(selector, value) {
      const script =
        "(() => { const el = document.querySelector(" +
        JSON.stringify(selector) +
        "); if (!el) return false; const proto = el.tagName === \"SELECT\" ? HTMLSelectElement.prototype : el.tagName === \"TEXTAREA\" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; const setter = Object.getOwnPropertyDescriptor(proto, \"value\").set; setter.call(el, " +
        JSON.stringify(value) +
        "); el.dispatchEvent(new Event(\"input\", { bubbles: true })); el.dispatchEvent(new Event(\"change\", { bubbles: true })); return true; })()";
      return raw.eval(script);
    },
    async open(view) {
      await raw.goto(url + (view ? "#" + view : ""));
      await api.waitFor("#page-title");
      await sleepMs(600);
      await api.clickOptional("#refresh");
      await sleepMs(900);
      return api.snapshot();
    },
    async view(name) {
      const here = String(await raw.eval("location.href"));
      if (here.indexOf(url) !== 0) {
        await raw.goto(url + "#" + name);
        await api.waitFor("#page-title");
      } else {
        await raw.eval("location.hash = " + JSON.stringify("#" + name));
      }
      await sleepMs(450);
      const clicked = await api.clickOptional("#refresh");
      await sleepMs(clicked ? 1100 : 700);
      return api.snapshot();
    },
    async snapshot() {
      const snap = await raw.eval(PROBE);
      return mutate(snap);
    },
    async card(id) {
      return (await api.snapshot()).cards.find((entry) => entry.id === String(id)) || null;
    },
    async run(id) {
      return (await api.snapshot()).runs.find((entry) => entry.id === String(id)) || null;
    },
    async openCard(id) {
      await api.view("attention");
      const clicked = await api.clickOptional("[data-open-card=\"" + id + "\"]");
      if (!clicked) return false;
      const opened = await api.waitFor("#action-dialog[open]");
      await sleepMs(250);
      return opened;
    },
    async submitDecision() {
      await api.click("#action-dialog form#decision-form button[type=submit]");
      await sleepMs(1600);
      const message = await raw.eval(
        "(() => { const el = document.querySelector(\"#action-message\"); return el && !el.hidden ? (el.innerText || \"\").trim() : \"\"; })()",
      );
      return { message: message };
    },
    async answerChoice(id, index) {
      const opened = await api.openCard(id);
      if (!opened) return { clicked: false, message: "" };
      await api.click("#action-dialog input[name=choice][value=\"" + index + "\"]");
      const result = await api.submitDecision();
      return { clicked: true, message: result.message };
    },
    async answerText(id, text) {
      const opened = await api.openCard(id);
      if (!opened) return { clicked: false, message: "" };
      await api.setValue("#action-dialog textarea[name=text]", text);
      const result = await api.submitDecision();
      return { clicked: true, message: result.message };
    },
    async resolveNotice(id, reason) {
      const opened = await api.openCard(id);
      if (!opened) return { clicked: false, message: "" };
      await api.setValue("#action-dialog select[name=mode]", "resolve");
      await sleepMs(300);
      await api.setValue("#action-dialog textarea[name=text]", reason);
      const result = await api.submitDecision();
      return { clicked: true, message: result.message };
    },
    async cancelRun(id) {
      await api.view("runs");
      const row = await api.run(id);
      if (!row) return { clicked: false, message: "", row: null };
      await api.click("tr.task-row button[data-run=\"" + id + "\"]");
      await api.waitFor("#run-detail[open]");
      await sleepMs(500);
      const clicked = await api.clickOptional("#run-detail [data-stop-run]");
      let message = "";
      if (clicked) {
        await api.waitFor("#cancel-form");
        await sleepMs(200);
        await api.click("#cancel-form button[type=submit]");
        await sleepMs(1800);
        message = await raw.eval(
          "(() => { const el = document.querySelector(\"#action-message\"); return el && !el.hidden ? (el.innerText || \"\").trim() : \"\"; })()",
        );
      }
      await api.view("runs");
      return { clicked: clicked, message: message, row: await api.run(id) };
    },
    async timelineFacts(id) {
      await api.view("runs");
      const clicked = await api.clickOptional("tr.task-row button[data-run=\"" + id + "\"]");
      if (!clicked) return null;
      await api.waitFor("#run-timeline");
      const started = Date.now();
      while (Date.now() - started < 8000) {
        const count = await raw.eval("document.querySelectorAll(\"#run-timeline li\").length");
        if (count > 0) break;
        await sleepMs(200);
      }
      await sleepMs(300);
      const facts = await raw.eval(TIMELINE);
      await api.clickOptional("#close-detail");
      await sleepMs(200);
      if (has("fabricate-fact")) return (facts || []).concat(["event:999999"]);
      return facts;
    },
    async older() {
      const before = await api.snapshot();
      const clicked = await api.clickOptional("#older-page");
      if (!clicked) return { clicked: false, snapshot: before };
      await sleepMs(1500);
      const after = await api.snapshot();
      if (has("same-page")) {
        return {
          clicked: true,
          snapshot: Object.assign({}, after, { runs: before.runs.slice(), hasOlder: before.hasOlder, hasLatest: true }),
        };
      }
      return { clicked: true, snapshot: after };
    },
    async postJson(route, body) {
      const script =
        "(async () => { const response = await fetch(" +
        JSON.stringify(route) +
        ", { method: \"POST\", headers: { \"content-type\": \"application/json\" }, body: " +
        JSON.stringify(JSON.stringify(body)) +
        " }); let payload = null; try { payload = await response.json(); } catch { payload = null; } return { status: response.status, payload: payload }; })()";
      return raw.eval(script);
    },
    async setOffline(flag) {
      await raw.offline(flag);
    },
    async failRequests(pattern) {
      return raw.failRequests(pattern);
    },
    async screenshot(file) {
      return raw.screenshot(file);
    },
    async requests() {
      return raw.requests;
    },
    async close() {
      await raw.close();
    },
  };

  function mutate(snap) {
    if (!snap) return snap;
    const out = JSON.parse(JSON.stringify(snap));
    if (has("drop-answer")) for (const card of out.cards) { card.answer = ""; card.closedReason = ""; }
    if (has("drop-reason")) for (const card of out.cards) card.closedReason = "";
    if (has("dup-card") && out.cards.length) out.cards.push(Object.assign({}, out.cards[0]));
    if (has("strip-cancel")) for (const row of out.runs) row.cancelMark = "";
    if (has("strip-summary")) for (const row of out.runs) row.summary = "";
    if (has("force-actionable")) for (const card of out.cards) if (card.state !== "open") card.actionable = 1;
    if (has("stale-off")) { out.stale = false; out.alert = ""; }
    if (has("drop-plan")) {
      out.plan = { rows: [], lines: [], elsewhere: [], delayed: [] };
    }
    if (has("drop-items")) for (const item of out.items) item.title = "";
    if (has("fake-stop")) out.dialog.stopButton = true;
    if (has("no-form")) out.dialog.formId = "";
    if (has("leak-key")) {
      const first = Object.values(keys)[0] || "leaked-owner-key";
      out.text = out.text + " " + first;
    }
    return out;
  }

  return api;
}

export async function openRealPage(url, options = {}) {
  return attachRealPage(await openBrowser(options), url, options);
}