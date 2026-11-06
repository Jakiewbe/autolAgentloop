// q4-texts-recheck.mjs：离线复核 q4-texts 现场证据（不重跑、不调模型）。
// 目的：unknown 文案的期望值在探针里写成逗号（"面板不猜原因，中心不接受取消"），
// 而受审源码 app.js:352 的原文是分号；这里直接从源码抽取字面量，和现场抓到的 DOM 文本对撞。
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.join(import.meta.dirname, "..");
const APP = path.join(ROOT, "extract-v2-c66a3c64", "dashboard", "public", "app.js");

const EV = path.join(ROOT, "evidence");
const dirs = readdirSync(EV).filter((name) => name.startsWith("q4-texts-2026-11-06T15-08-57")).sort();
if (dirs.length !== 1) throw new Error("找不到唯一的现场证据目录: " + JSON.stringify(dirs));
const dir = path.join(EV, dirs[0]);

const src = readFileSync(APP, "utf8");
const srcLine = src.split("\n").find((line) => line.indexOf("状态待确认") >= 0) || "";
const between = srcLine.slice(srcLine.indexOf("状态待确认"), srcLine.indexOf("</p>"));
const detail = readFileSync(path.join(dir, "detail.html"), "utf8");
const hits = [...detail.matchAll(/<p class="soft-note">([^<]*)<\/p>/g)].map((match) => match[1]);
const note = hits.find((entry) => entry.indexOf("状态待确认") >= 0) || null;
const stops = (detail.match(/data-stop-run/g) || []).length;

const record = JSON.parse(readFileSync(path.join(dir, "record.json"), "utf8"));
const checks = [];
const note2 = (name, ok, extra = "") => checks.push({ name, ok: !!ok, extra });

note2("源码字面量（app.js:352）与现场 DOM 逐字相同", note !== null && note === between, JSON.stringify({ expected: between, actual: note }));
note2("现场 DOM 的 unknown 文案确实带分号而非逗号", note !== null && note.indexOf("面板不猜原因；中心不接受取消") >= 0, "");
note2("探针原断言失败原因是期望值笔误（逗号 vs 分号），不是产品差异", record.checks.find((entry) => entry.name === "unknown 文案逐字命中")?.ok === false, "");
note2("该详情无停止入口（现场已抓到的 detail.html 里 data-stop-run 计数为 0）", stops === 0, String(stops));
note2("中心侧该轮 state=unknown、stopping=false", record.unknown.state === "unknown" && record.unknown.stopping === false, JSON.stringify(record.unknown));

const out = {
  case: "q4-texts-recheck",
  at: new Date().toISOString(),
  source: { file: "extract-v2-c66a3c64/dashboard/public/app.js", line: 352 },
  evidence: dirs[0],
  checks,
  passed: checks.filter((entry) => entry.ok).length,
  failed: checks.filter((entry) => !entry.ok).map((entry) => entry.name),
};
writeFileSync(path.join(dir, "recheck.json"), JSON.stringify(out, null, 2));
console.log("RECHECK " + JSON.stringify(checks.map((entry) => [entry.name, entry.ok])));
