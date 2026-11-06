// q4-fold-unit.mjs：心跳折叠规则的模块级核对。直接用受审包真实的 workflow.mjs，
// 输入是合成事实（因为 cards/state/session 三种变化都要由中心在心跳事实里写下，
// 现场造齐要等租约/离线阈值，代价与结论不成比例；这里只证明折叠判据本身）。
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const EXTRACT = process.env.REVIEW_EXTRACT ?? path.join(import.meta.dirname, "..", "extract-v2-c66a3c64");
const FILE = path.join(EXTRACT, "dashboard", "public", "workflow.mjs");
const bytes = readFileSync(FILE);
const module = await import("file:///" + FILE.replace(/\\/g, "/"));
const checks = [];
const note = (name, ok, detail = "") => checks.push({ name, ok: !!ok, detail });

const beat = (seq, changes = []) => ({ seq, type: "heartbeat", changes });
const runFact = (seq, fields) => ({ seq, type: "tick", changes: [{ table: "runs", key: "7", row: fields }] });

// 1. 纯心跳折叠
const pure = module.timelineNodes([beat(1), beat(2), beat(3)]);
note("3 条连续纯心跳折成 1 个节点", pure.length === 1 && pure[0].kind === "heartbeat" && pure[0].facts.length === 3, JSON.stringify(pure.map((n) => n.kind)));

// 2. 心跳里带 cards 变化 → 不折叠
const withCard = module.timelineNodes([beat(4, [{ table: "cards", key: "3", row: { state: "closed" } }]), beat(5)]);
note("心跳里带 cards 变化不被折叠", withCard[0].kind === "fact" && withCard[1].kind === "heartbeat", JSON.stringify(withCard.map((n) => n.kind)));

// 3. 心跳里同一轮 state 变化 → 不折叠（先看见旧值，再变）
const withState = module.timelineNodes([runFact(1, { state: "claimed" }), beat(2, [{ table: "runs", key: "7", row: { state: "unknown" } }])]);
note("心跳里 state 变化保持可见", withState[1].kind === "fact", JSON.stringify(withState.map((n) => n.kind)));

// 4. 心跳里 session 变化 → 不折叠
const withSession = module.timelineNodes([runFact(1, { session: "s-a" }), beat(2, [{ table: "runs", key: "7", row: { session: "s-b" } }])]);
note("心跳里 session 变化保持可见", withSession[1].kind === "fact", JSON.stringify(withSession.map((n) => n.kind)));

// 5. 只改 seen_at 的心跳（没 state/session/cards）仍折叠
const withSeen = module.timelineNodes([runFact(1, { state: "claimed", session: "s-a" }), beat(2, [{ table: "runs", key: "7", row: { seen_at: "2026-11-06T00:00:00Z" } }])]);
note("只刷新 seen_at 的心跳仍折叠", withSeen[1] && withSeen[1].kind === "heartbeat", JSON.stringify(withSeen.map((n) => n.kind)));

// 6. 折叠节点内事实按 seq 原序保留
const order = module.timelineNodes([beat(10), beat(11), beat(12)])[0].facts.map((f) => f.seq);
note("折叠内事实按 seq 递增且不丢", JSON.stringify(order) === "[10,11,12]", JSON.stringify(order));

const result = {
  case: "q4-fold-unit",
  at: new Date().toISOString(),
  module: { file: FILE, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") },
  checks,
  passed: checks.filter((entry) => entry.ok).length,
  failed: checks.filter((entry) => !entry.ok).map((entry) => entry.name),
};
const out = path.join(import.meta.dirname, "..", "evidence", "q4-fold-unit-" + new Date().toISOString().replace(/[:.]/g, "-"));
const { mkdirSync, writeFileSync } = await import("node:fs");
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, "record.json"), JSON.stringify(result, null, 2));
console.log("OUT " + out);
console.log("Q4FOLD " + JSON.stringify(checks.map((entry) => [entry.name, entry.ok])));
console.log("FAILED " + JSON.stringify(result.failed));
process.exitCode = result.failed.length ? 1 : 0;
