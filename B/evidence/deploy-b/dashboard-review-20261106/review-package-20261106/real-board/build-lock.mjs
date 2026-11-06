// build-lock.mjs：把受审构建钉死在字节上。
// 1) 校验 extract-v2-c66a3c64/dashboard 下 5 个实际提供页面的字节与哈希；
// 2) 校验 SUBJECT.json 登记表本身：15 个成员、路径唯一、sha256 必须是 64 位小写十六进制；
// 3) 两种模式：
//      provenance-only（默认，未给 REVIEW_ZIP）：只核来源登记，明确标注未核实际 ZIP；
//      actual（给了 REVIEW_ZIP）：逐项核对实际 ZIP 的 15 个成员路径/字节数/哈希 + ZIP 本体身份。
// 退出码：0 = 通过；1 = 不匹配；2 = 用法/输入错误（REVIEW_ZIP 指定但文件不存在、登记表非法）。
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const REVIEW = path.join(import.meta.dirname, "..");
const EXTRACT = process.env.REVIEW_EXTRACT ?? path.join(REVIEW, "extract-v2-c66a3c64");
const HEX64 = /^[0-9a-f]{64}$/;
export const MEMBER_COUNT = 15;

export const BUILD = {
  zip: { file: "incoming/dashboard-item-key-cancel-v2.zip", bytes: 58408, sha256: "c66a3c64db5f1a5c2270d0cf1130a5ac764d2dcee7eaffefd0d1808d0309a525" },
  files: [
    { path: "dashboard/server.mjs", bytes: 16373, sha256: "744c7b9d168fc3bccb067bfd1a0e621597637fb1336b00f7eee1634611db34b8" },
    { path: "dashboard/public/app.js", bytes: 40117, sha256: "fc7c6ba3947d956fe05b65af2423ab30259bdfdc5dd8855c480c7b7ff0ed2926" },
    { path: "dashboard/public/workflow.mjs", bytes: 5843, sha256: "11babc0eacbc109f46c891a44941b1a58de52fa97dc2fabd0cdf2b532db8af4a" },
    { path: "dashboard/public/index.html", bytes: 4472, sha256: "ba59799d3567bfd64ffe9d9f242c88883d671e62e9d26053edaba527cace4070" },
    { path: "dashboard/public/styles.css", bytes: 31148, sha256: "8b7ece17c4b94a08376a1613574fb1dd640bdf8fabf8d42ca4b0886b0ca6bb0f" },
  ],
};

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

// 只读解析 ZIP 中央目录：返回每个成员的路径、解压后字节数、解压内容的 sha256。
export function readZipMembers(file) {
  const buf = readFileSync(file);
  let eocd = -1;
  const floor = Math.max(0, buf.length - 66000);
  for (let i = buf.length - 22; i >= floor; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("找不到 ZIP 中央目录（不是有效 ZIP）");
  const total = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const members = [];
  for (let n = 0; n < total; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error("中央目录项损坏 @" + off);
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);
    const lnLen = buf.readUInt16LE(localOff + 26);
    const leLen = buf.readUInt16LE(localOff + 28);
    const start = localOff + 30 + lnLen + leLen;
    const comp = buf.subarray(start, start + compSize);
    const data = method === 0 ? comp : zlib.inflateRawSync(comp);
    members.push({ path: name, bytes: data.length, sha256: sha256(data), method });
    off += 46 + nameLen + extraLen + commentLen;
  }
  return { bytes: buf.length, sha256: sha256(buf), members };
}

// 登记表自检：结构、格式、唯一性、数量、served 覆盖。
export function checkRegistry(subject) {
  const problems = [];
  const members = Array.isArray(subject?.members) ? subject.members : [];
  if (!members.length) problems.push("members 为空");
  const seen = new Set();
  for (const row of members) {
    const where = row?.path ?? "(缺 path)";
    if (typeof row?.path !== "string" || !row.path) problems.push("成员 path 非法：" + where);
    else if (seen.has(row.path)) problems.push("成员 path 重复：" + row.path);
    else seen.add(row.path);
    if (!Number.isInteger(row?.bytes) || row.bytes < 0) problems.push("成员 bytes 非法：" + where);
    if (typeof row?.sha256 !== "string" || !HEX64.test(row.sha256)) {
      problems.push("成员 sha256 不是 64 位小写十六进制：" + where + "（长度 " + (row?.sha256?.length ?? "无") + "）");
    }
  }
  if (members.length !== MEMBER_COUNT) problems.push("成员数 " + members.length + " ≠ 期望 " + MEMBER_COUNT);
  if (!Number.isInteger(subject?.zip?.bytes) || subject.zip.bytes <= 0) problems.push("zip.bytes 非法");
  if (typeof subject?.zip?.sha256 !== "string" || !HEX64.test(subject.zip.sha256)) problems.push("zip.sha256 不是 64 位小写十六进制");
  const byPath = new Map(members.filter((m) => typeof m?.path === "string").map((m) => [m.path, m]));
  const served = subject?.servedFiles ?? [];
  for (const spec of BUILD.files) {
    const row = byPath.get(spec.path);
    if (!row) { problems.push("served 文件未登记：" + spec.path); continue; }
    if (row.sha256 !== spec.sha256) problems.push("served 登记哈希与 BUILD 不符：" + spec.path);
    if (row.bytes !== spec.bytes) problems.push("served 登记字节与 BUILD 不符：" + spec.path);
  }
  for (const p of served) if (!byPath.has(p)) problems.push("servedFiles 列了未登记成员：" + p);
  return { ok: problems.length === 0, problems, members: members.length };
}

export function checkBuild(extract = EXTRACT, { zipFile, subjectFile } = {}) {
  const rows = [];
  for (const spec of BUILD.files) {
    const file = path.join(extract, spec.path);
    if (!existsSync(file)) { rows.push({ ...spec, actual: null, ok: false, reason: "missing" }); continue; }
    const body = readFileSync(file);
    const actual = sha256(body);
    rows.push({ ...spec, actual, actualBytes: body.length, ok: actual === spec.sha256 && body.length === spec.bytes });
  }
  let registry = null;
  let subject = null;
  if (subjectFile && existsSync(subjectFile)) {
    subject = JSON.parse(readFileSync(subjectFile, "utf8"));
    registry = checkRegistry(subject);
  } else if (subjectFile) {
    registry = { ok: false, problems: ["SUBJECT 文件不存在：" + subjectFile], members: 0 };
  }
  const zipIdentityOk = Boolean(subject) && subject.zip?.sha256 === BUILD.zip.sha256 && subject.zip?.bytes === BUILD.zip.bytes;
  let zip = null;
  if (zipFile) {
    if (!existsSync(zipFile)) {
      zip = { mode: "actual", file: zipFile, ok: false, reason: "REVIEW_ZIP_MISSING" };
    } else {
      const actual = readZipMembers(zipFile);
      const byPath = new Map(actual.members.map((m) => [m.path, m]));
      const registered = subject?.members ?? [];
      const diffs = [];
      for (const row of registered) {
        const got = byPath.get(row.path);
        if (!got) { diffs.push({ path: row.path, problem: "missing-in-zip" }); continue; }
        if (got.bytes !== row.bytes) diffs.push({ path: row.path, problem: "bytes", expected: row.bytes, actual: got.bytes });
        if (got.sha256 !== row.sha256) diffs.push({ path: row.path, problem: "sha256", expected: row.sha256, actual: got.sha256 });
      }
      for (const m of actual.members) if (!registered.some((r) => r.path === m.path)) diffs.push({ path: m.path, problem: "not-registered" });
      const bytesOk = actual.bytes === BUILD.zip.bytes;
      const shaOk = actual.sha256 === BUILD.zip.sha256;
      if (!bytesOk) diffs.push({ path: "(zip)", problem: "bytes", expected: BUILD.zip.bytes, actual: actual.bytes });
      if (!shaOk) diffs.push({ path: "(zip)", problem: "sha256", expected: BUILD.zip.sha256, actual: actual.sha256 });
      zip = {
        mode: "actual",
        file: zipFile,
        bytes: actual.bytes,
        sha256: actual.sha256,
        members: actual.members.length,
        checkedMembers: registered.length,
        diffs,
        ok: diffs.length === 0 && bytesOk && shaOk && actual.members.length === MEMBER_COUNT,
      };
    }
  }
  return {
    extract,
    rows,
    registry: registry ? { ...registry, zipIdentityOk } : null,
    zip,
    subject: subject ? { subject: subject.subject, zip: subject.zip } : null,
    ok: rows.every((r) => r.ok) && Boolean(registry?.ok) && zipIdentityOk && (!zip || zip.ok),
  };
}

if (process.argv[1] && process.argv[1].endsWith("build-lock.mjs")) {
  const explicit = process.env.REVIEW_ZIP ?? "";
  const subjectFile = process.env.REVIEW_SUBJECT ?? path.join(REVIEW, "SUBJECT.json");
  const mode = explicit ? "actual" : "provenance-only";
  if (explicit && !existsSync(explicit)) {
    console.log("BUILD_LOCK " + JSON.stringify({ mode, ok: false, error: "REVIEW_ZIP_MISSING", zip: explicit, note: "REVIEW_ZIP 指向的 ZIP 不存在；不做「只核登记」的降级。" }, null, 1));
    process.exit(2);
  }
  let result;
  try {
    result = checkBuild(EXTRACT, { zipFile: explicit || null, subjectFile });
  } catch (error) {
    console.log("BUILD_LOCK " + JSON.stringify({ mode, ok: false, error: "INPUT_ERROR", message: String(error?.message ?? error) }, null, 1));
    process.exit(2);
  }
  const notes = [];
  if (mode === "provenance-only") notes.push("仅核来源登记，未核实际ZIP（用 REVIEW_ZIP=<path> 复核真实字节）");
  console.log("BUILD_LOCK " + JSON.stringify({
    mode,
    extract: result.extract,
    ok: result.ok,
    files: result.rows.map((r) => [r.path, r.ok, r.actualBytes ?? null, r.actual ? r.actual.slice(0, 16) : null]),
    registry: result.registry,
    zip: result.zip,
    notes,
  }, null, 1));
  const inputError = !result.registry || (result.registry.problems ?? []).some((p) => p.includes("不存在"));
  process.exit(inputError ? 2 : result.ok ? 0 : 1);
}
