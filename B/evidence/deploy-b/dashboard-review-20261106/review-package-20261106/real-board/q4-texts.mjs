// q4-texts.mjs：Q4 剩余取证——三处文案（空 lane、closed 无 result、unknown）+ 心跳折叠 + 事实 seq 对账。
// 只造数据、只读页面，不改受审包一个字节；unknown 走现场真实租约（RUN_LEASE=5 分钟），不改时钟、不改数据库。
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { bootBoard } from "./board.mjs";
import { attachRealPage } from "./page-real.mjs";
import { openBrowser } from "../selftest-v2/cdp.mjs";
import { hub2 } from "../selftest-v2/lib2.mjs";

const EVID = path.join(import.meta.dirname, "..", "evidence");
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");
const out = path.join(EVID, "q4-texts-" + stamp());
mkdirSync(out, { recursive: true });

const checks = [];
const note = (name, ok, detail = "") => { checks.push({ name, ok: !!ok, detail }); };

const text = (page, selector) =>
  page.raw.eval("(() => { const el = document.querySelector(" + JSON.stringify(selector) + "); return el ? (el.textContent || '') : null; })()");
const allText = (page, selector) =>
  page.raw.eval("(() => Array.from(document.querySelectorAll(" + JSON.stringify(selector) + ")).map((el) => (el.textContent || '').trim()))()");
const html = (page, selector) =>
  page.raw.eval("(() => { const el = document.querySelector(" + JSON.stringify(selector) + "); return el ? el.outerHTML : null; })()");

const beat = (hub, ids, tag) =>
  hub.call("GET", "/v1/work?claim=" + encodeURIComponent(tag) + "&running=" + ids.join(",") + "&capacity=0&wait=0", hub.keys.worker);

const live = await bootBoard();
const hub = hub2({ publicUrl: live.hub.publicUrl, keys: live.hub.keys, home: live.hub.home });
const session = await openBrowser({ width: 1440, height: 900 });
const page = attachRealPage(session, live.url, { keys: live.hub.keys });
const record = { case: "q4-texts", at: new Date().toISOString(), checks, texts: {}, timeline: {}, unknown: {} };

try {
  // ── 1. 空 lane：非 parallel 规则（意见）的轮 lane 就是空串
  await hub.event("feedback.new");
  const jobA = await hub.claim("q4-lane-" + Date.now());
  if (!jobA) throw new Error("没有可领的活");
  await hub.started(jobA.run, jobA.token, "s-q4-lane-" + jobA.run);
  const stateA = await hub.state();
  const runA = (stateA.data.runs || []).find((entry) => entry.id === jobA.run);
  record.texts.lane = { run: jobA.run, lane: runA && runA.lane, rule: runA && runA.rule, laneKnown: runA && runA.laneKnown };

  // ── 2. closed 且无 result：fyi 通知卡建档即 closed，没有 result
  const patched = await hub.notice("Q4 文案样本：只告知不处理 " + Date.now());
  record.texts.closed = { card: patched.id, state: patched.state, kind: patched.kind };

  // ── 3. 心跳：先领一轮（复查规则，另一条泳道），再连发 4 次真实心跳
  await hub.event("recheck.new");
  const jobB = await hub.claim("q4-beat-" + Date.now());
  if (!jobB) throw new Error("没有可领的第二轮");
  await hub.started(jobB.run, jobB.token, "s-q4-beat-" + jobB.run);
  for (let index = 0; index < 4; index++) {
    await beat(hub, [jobB.run], "q4-hb-" + jobB.run + "-" + index);
    await sleep(120);
  }
  record.texts.beat = { run: jobB.run };

  // ── 4. 页面读三处文案
  await page.view("items");
  const itemNotes = await allText(page, ".item-group p.soft-note");
  const laneNote = itemNotes.find((entry) => entry.indexOf("对象标识为空") >= 0) ?? null;
  record.texts.items = { notes: itemNotes, laneNote };
  writeFileSync(path.join(out, "items.html"), (await html(page, "#view-content")) || "");
  note("空 lane 文案出现在事项页且逐字命中", laneNote === "规则「意见」下这些轮次的对象标识为空；这里只按中心给出的规则 + 对象归组，不推断这条规则是否配过 parallel，也不倒推历史规则。", laneNote || "未出现");

  await page.view("attention");
  const answers = await allText(page, ".attention-card .decision-answer");
  const closedLine = answers.find((entry) => entry.indexOf("已关闭") >= 0) ?? null;
  record.texts.attention = { answers, closedLine };
  writeFileSync(path.join(out, "attention.html"), (await html(page, "#view-content")) || "");
  note("closed 无 result 文案逐字命中", closedLine === "我的回答：未记录\n处理结果：已关闭（仅告知或已结案），没有处理结果记录；面板不补写未发生过的处理。", closedLine || "未出现");

  // ── 5. 执行时间线：纯心跳折叠 + 每个事实保留 seq
  await page.view("runs");
  await page.clickOptional('button[data-run="' + jobB.run + '"]');
  await page.waitFor("#run-detail[open]", 8000);
  await page.waitFor("#run-timeline .timeline-fact, #run-timeline details", 12000);
  const folded = await page.raw.eval("(() => Array.from(document.querySelectorAll('#run-timeline details')).map((el) => ({ summary: (el.querySelector('summary') || {}).textContent || '', facts: Array.from(el.querySelectorAll('li')).map((li) => (li.textContent || '').trim()) })))()");
  const openFacts = await page.raw.eval("(() => Array.from(document.querySelectorAll('#run-timeline > .timeline-fact, #run-timeline > li, #run-timeline > *')).filter((el) => el.tagName !== 'DETAILS').map((el) => (el.textContent || '').trim()).slice(0, 40))()");
  record.timeline = { folded, openFacts, timelineHtml: await html(page, "#run-timeline") };
  const foldedBeats = folded.find((node) => node.summary.indexOf("连续") >= 0) ?? null;
  note("4 条连续心跳折叠成 1 个可展开节点", !!foldedBeats && foldedBeats.facts.length === 4, JSON.stringify(foldedBeats));
  const seqs = (foldedBeats?.facts ?? []).map((line) => Number((line.match(/事实 #(\d+)/) || [])[1])).filter(Number.isFinite);
  const ordered = seqs.length === 4 && seqs.every((value, index) => index === 0 || value > seqs[index - 1]);
  note("折叠内事实按中心 seq 递增且完整保留", ordered, JSON.stringify(seqs));
  note("非心跳事实单独成行（未被折进心跳块）", openFacts.length >= 2, JSON.stringify(openFacts.slice(0, 6)));

  // ── 6. 现场造 unknown：心跳只保活 worker、不再提这一轮，等真实租约过期后由 tick 判 unknown
  const startedAt = Date.now();
  const leaseMs = 5 * 60 * 1000;
  const waitMs = leaseMs + 30 * 1000;
  process.stderr.write("WAIT_LEASE " + waitMs + "ms\n");
  await sleep(waitMs);
  await beat(hub, [], "q4-hb-nofresh-" + Date.now());      // worker 保持新鲜
  await hub.call("GET", "/v1/work?claim=" + encodeURIComponent("q4-tick-" + Date.now()) + "&running=&capacity=0&wait=1", hub.keys.worker);
  await sleep(1500);
  const afterBeat = await hub.call("GET", "/v1/work?claim=" + encodeURIComponent("q4-tick2-" + Date.now()) + "&running=&capacity=0&wait=1", hub.keys.worker);
  const stateB = await hub.state();
  const runB = (stateB.data.runs || []).find((entry) => entry.id === jobB.run) ?? null;
  record.unknown = { run: jobB.run, waitedMs: Date.now() - startedAt, state: runB && runB.state, stopping: runB && runB.stopping, tickStatus: afterBeat.status };

  await page.view("runs");
  await page.clickOptional('button[data-run="' + jobB.run + '"]');
  await page.waitFor("#run-detail[open]", 8000);
  await sleep(700);
  const unknownNote = await page.raw.eval("(() => { const nodes = Array.from(document.querySelectorAll('#run-detail .detail-body p.soft-note')); const hit = nodes.find((el) => (el.textContent || '').indexOf('状态待确认') >= 0); return hit ? hit.textContent : null; })()");
  const stopButtons = await page.raw.eval("(() => document.querySelectorAll('#run-detail [data-stop-run]').length)()");
  record.unknown.note = unknownNote;
  record.unknown.stopButtons = stopButtons;
  writeFileSync(path.join(out, "detail.html"), (await html(page, "#run-detail")) || "");
  note("unknown 文案逐字命中", unknownNote === "状态待确认：中心还没有确认这轮的结束状态（例如运行中超过租约仍未回报），面板不猜原因；中心不接受取消，也不提供伪造的停止入口，需要处理请在中心侧核实。", unknownNote || "未出现");
  note("unknown 轮没有停止入口", stopButtons === 0, String(stopButtons));
} catch (error) {
  record.error = String(error && error.stack || error).slice(0, 2000);
  note("探针未抛错", false, record.error);
} finally {
  record.finishedAt = new Date().toISOString();
  record.passed = checks.filter((entry) => entry.ok).length;
  record.failed = checks.filter((entry) => !entry.ok).map((entry) => entry.name);
  writeFileSync(path.join(out, "record.json"), JSON.stringify(record, null, 2));
  for (const child of live.children) child.kill();
  await session.close();
  console.log("OUT " + out);
  console.log("Q4TEXTS " + JSON.stringify(checks.map((entry) => [entry.name, entry.ok])));
  console.log("FAILED " + JSON.stringify(record.failed));
  process.exitCode = record.failed.length ? 1 : 0;
}
