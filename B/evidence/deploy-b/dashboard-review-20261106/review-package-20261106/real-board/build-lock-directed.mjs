// build-lock-directed.mjs：build-lock 的定向校验（5 项）。
// 结果写 evidence/build-lock-directed-<stamp>/record.json，并打印每个用例的真实退出码。
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const HERE = import.meta.dirname;
const PKG = path.resolve(HERE, "..");
const LOCK = path.join(PKG, "real-board", "build-lock.mjs");
const SUBJECT = path.join(PKG, "SUBJECT.json");
const REAL_ZIP = path.join(PKG, "incoming", "dashboard-item-key-cancel-v2.zip");

const run = (env) => {
  const r = spawnSync(process.execPath, [LOCK], { cwd: PKG, env: { ...process.env, ...env }, encoding: "utf8" });
  const out = (r.stdout || "") + (r.stderr || "");
  let parsed = null;
  const m = out.match(/BUILD_LOCK (\{[\s\S]*\})/);
  if (m) { try { parsed = JSON.parse(m[1]); } catch { parsed = null; } }
  return { status: r.status, signal: r.signal, out, parsed };
};

const tmp = mkdtempSync(path.join(tmpdir(), "buildlock-"));
const base = JSON.parse(readFileSync(SUBJECT, "utf8"));
const patchIdx = base.members.findIndex((row) => row.path === "PATCH.json");

const sub65 = JSON.parse(JSON.stringify(base));
sub65.members[patchIdx].sha256 = base.members[patchIdx].sha256 + "4";
const sub65File = path.join(tmp, "SUBJECT-65.json");
writeFileSync(sub65File, JSON.stringify(sub65, null, 2));

// 长度正确、只改一位（末位 4 → 5），其余保持真实值
const sub1bit = JSON.parse(JSON.stringify(base));
const good = base.members[patchIdx].sha256;
sub1bit.members[patchIdx].sha256 = good.slice(0, -1) + (good.endsWith("5") ? "6" : "5");
const sub1bitFile = path.join(tmp, "SUBJECT-1bit.json");
writeFileSync(sub1bitFile, JSON.stringify(sub1bit, null, 2));

const cases = [
  { id: "T1_default_registry_only", expect: 0, env: {}, check: (r) => r.parsed?.mode === "provenance-only" && (r.parsed?.notes ?? []).some((n) => n.includes("未核实际ZIP")) },
  { id: "T2_real_zip_all_members", expect: 0, env: { REVIEW_ZIP: REAL_ZIP }, check: (r) => r.parsed?.zip?.ok === true && r.parsed?.zip?.members === 15 && r.parsed?.zip?.diffs?.length === 0 },
  { id: "T3_hash_65_chars", expect: [1, 2], env: { REVIEW_SUBJECT: sub65File }, check: (r) => r.parsed?.ok === false && (r.parsed?.registry?.problems ?? []).some((p) => p.includes("64 位小写十六进制")) },
  { id: "T4_hash_one_bit_wrong", expect: [1, 2], env: { REVIEW_SUBJECT: sub1bitFile, REVIEW_ZIP: REAL_ZIP }, check: (r) => r.parsed?.ok === false && (r.parsed?.zip?.diffs ?? []).some((d) => d.path === "PATCH.json" && d.problem === "sha256") },
  { id: "T5_zip_missing", expect: [1, 2], env: { REVIEW_ZIP: path.join(tmp, "no-such.zip") }, check: (r) => r.parsed?.ok === false && r.parsed?.error === "REVIEW_ZIP_MISSING" },
];

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = path.join(path.resolve(PKG, ".."), "evidence", "build-lock-directed-" + stamp);
mkdirSync(outDir, { recursive: true });
const results = [];
for (const c of cases) {
  const r = run(c.env);
  const expected = Array.isArray(c.expect) ? c.expect : [c.expect];
  const ok = expected.includes(r.status) && c.check(r);
  results.push({
    id: c.id,
    exitCode: r.status,
    expectedExit: c.expect,
    ok,
    mode: r.parsed?.mode ?? null,
    error: r.parsed?.error ?? null,
    registryProblems: r.parsed?.registry?.problems ?? null,
    zip: r.parsed?.zip ? { ok: r.parsed.zip.ok, members: r.parsed.zip.members, checkedMembers: r.parsed.zip.checkedMembers, diffs: r.parsed.zip.diffs } : null,
    notes: r.parsed?.notes ?? null,
    stdoutHead: r.out.split("\n")[0].slice(0, 200),
  });
}
writeFileSync(path.join(outDir, "record.json"), JSON.stringify({
  at: new Date().toISOString(),
  lock: { file: LOCK, bytes: readFileSync(LOCK).length },
  subject: { file: SUBJECT, bytes: readFileSync(SUBJECT).length },
  realZip: REAL_ZIP,
  tmpDir: tmp,
  results,
  passed: results.filter((r) => r.ok).length,
  total: results.length,
}, null, 2) + "\n");
console.log("DIRECTED", JSON.stringify(results.map((r) => [r.id, r.exitCode, r.ok])));
console.log("PASSED", results.filter((r) => r.ok).length, "/", results.length, "->", outDir);
process.exit(results.every((r) => r.ok) ? 0 : 1);
