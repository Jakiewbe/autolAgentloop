// build-lock.mjs：把受审构建钉死在字节上。
// 1) 校验 extract-v2-c66a3c64/dashboard 下 5 个实际提供页面的文件哈希；
// 2) 按 SUBJECT.json 断言「受审 ZIP 身份」（ZIP 本体不随包分发，故默认走来源登记）；
// 3) 若给出 REVIEW_ZIP=<path> 且文件存在，再核实际 ZIP 字节。
// 任何一处不匹配 → 退出码 1，并打印期望/实际，便于在跑用例前就拦住「跑的不是受审构建」。
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const REVIEW = path.join(import.meta.dirname, "..");
const EXTRACT = process.env.REVIEW_EXTRACT ?? path.join(REVIEW, "extract-v2-c66a3c64");

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

const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

export function checkBuild(extract = EXTRACT, { zipFile, subjectFile } = {}) {
  const rows = [];
  for (const spec of BUILD.files) {
    const file = path.join(extract, spec.path);
    if (!existsSync(file)) { rows.push({ ...spec, actual: null, ok: false, reason: "missing" }); continue; }
    const bytes = readFileSync(file).length;
    const actual = sha256(file);
    rows.push({ ...spec, actual, actualBytes: bytes, ok: actual === spec.sha256 && bytes === spec.bytes });
  }
  let provenance = null;
  if (subjectFile && existsSync(subjectFile)) {
    const subject = JSON.parse(readFileSync(subjectFile, "utf8"));
    const memberOf = new Map((subject.members ?? []).map((row) => [row.path, row]));
    const servedOk = BUILD.files.every((spec) => {
      const row = memberOf.get(spec.path);
      return Boolean(row) && row.sha256 === spec.sha256 && row.bytes === spec.bytes;
    });
    const zipOk = subject.zip?.sha256 === BUILD.zip.sha256 && subject.zip?.bytes === BUILD.zip.bytes;
    const memberCount = subject.members?.length ?? 0;
    provenance = {
      file: subjectFile,
      mode: "provenance",
      ok: zipOk && servedOk && memberCount === 15,
      zip: zipOk,
      served: servedOk,
      members: memberCount,
      expectedMembers: 15,
      subject: subject.subject,
    };
  }
  let zip = null;
  if (zipFile && existsSync(zipFile)) {
    const actual = sha256(zipFile);
    zip = { file: zipFile, mode: "actual", expected: BUILD.zip.sha256, actual, ok: actual === BUILD.zip.sha256 };
  }
  return {
    extract,
    rows,
    zip,
    provenance,
    ok: rows.every((row) => row.ok) && (!zip || zip.ok) && (!provenance || provenance.ok),
  };
}

if (process.argv[1] && process.argv[1].endsWith("build-lock.mjs")) {
  // REVIEW_ZIP 指向实际 ZIP 时才核真实字节；否则只核 SUBJECT.json 的来源登记。
  const zipFile = process.env.REVIEW_ZIP ?? path.join(REVIEW, BUILD.zip.file);
  const subjectFile = process.env.REVIEW_SUBJECT ?? path.join(REVIEW, "SUBJECT.json");
  const result = checkBuild(EXTRACT, { zipFile: existsSync(zipFile) ? zipFile : null, subjectFile });
  console.log("BUILD_LOCK " + JSON.stringify({
    extract: result.extract,
    ok: result.ok,
    files: result.rows.map((row) => [row.path, row.ok, row.actualBytes ?? null, row.actual ? row.actual.slice(0, 16) : null]),
    zip: result.zip,
    provenance: result.provenance,
  }, null, 1));
  process.exit(result.ok ? 0 : 1);
}
