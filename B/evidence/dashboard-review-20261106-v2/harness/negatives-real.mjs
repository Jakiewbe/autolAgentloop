// negatives-real.mjs：对真实面板套件做负例自测——故意破坏观察层/页面事实，判据必须判 FAIL。
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { runCase } from "./suite-real.mjs";

const OUT = path.join(import.meta.dirname, "..", "evidence");
const ALL = [
  ["drop-answer", "T1", "页面把答案抹掉"],
  ["drop-reason", "T2", "结案原因不显示"],
  ["strip-summary", "T3", "运行结果被清空"],
  ["dup-card", "T4", "同一张卡重复渲染"],
  ["no-form", "T5", "取消没有确认表单"],
  ["fabricate-fact", "T6", "时间线伪造事实 id"],
  ["drop-plan", "T7", "计划面被抹掉"],
  ["same-page", "T7", "翻页不换内容"],
  ["force-actionable", "T8", "只读卡片也报可操作"],
  ["stale-off", "T9", "断线仍显示正常"],
  ["leak-key", "T10", "页面出现钥匙"],
  ["strip-cancel", "T11", "排队取消不显示已取消"],
  ["strip-cancel", "T12", "执行中不显示等待停止"],
  ["fake-stop", "T13", "终态仍给取消入口"],
  ["drop-items", "T14", "泳道分组被抹掉"],
];
const only = process.argv.slice(2);
const PAIRS = only.length ? ALL.filter((entry) => only.indexOf(entry[0]) >= 0) : ALL;

const results = [];
for (const [mutation, caseId, why] of PAIRS) {
  const record = await runCase(caseId, { label: "negative", mutation: mutation });
  const caught = record.status === "FAIL";
  results.push({ mutation: mutation, caseId: caseId, why: why, caught: caught, status: record.status, failedChecks: (record.checks || []).filter((check) => !check.ok).map((check) => check.name), error: record.error ?? null });
  console.log([mutation, caseId, caught ? "CAUGHT" : "MISSED", record.status, (record.checks || []).filter((check) => !check.ok).map((check) => check.name).join(",")].join(" | "));
}
const caughtCount = results.filter((entry) => entry.caught).length;
const missed = results.filter((entry) => !entry.caught);
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dir = path.join(OUT, "negatives-real-" + stamp);
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "negatives-real-result.json"), JSON.stringify({ at: new Date().toISOString(), total: results.length, caught: caughtCount, missed: missed.length, results: results }, null, 2));
console.log("NEGATIVES caught=" + caughtCount + "/" + results.length + " missed=" + missed.map((entry) => entry.mutation).join(",") + " RESULT " + path.join(dir, "negatives-real-result.json"));
process.exit(missed.length === 0 ? 0 : 1);
