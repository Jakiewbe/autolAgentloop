// 依赖完整性自检：确认本目录自带受审面板、隔离中心内核、测试台全部 import 目标；
// 逐项比对 MANIFEST.json 里的 sha256；不读工作区其他目录，不联网。
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const HERE = import.meta.dirname;
const manifest = JSON.parse(readFileSync(path.join(HERE, "MANIFEST.json"), "utf8"));
const rows = [];
let bad = 0;
for (const entry of manifest.files) {
  const file = path.join(HERE, entry.path);
  if (!existsSync(file)) { rows.push(["MISSING", entry.path, "", entry.sha256]); bad++; continue; }
  const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
  const ok = hash === entry.sha256;
  if (!ok) bad++;
  rows.push([ok ? "OK" : "HASH_MISMATCH", entry.path, hash, entry.sha256]);
}
// import 目标静态核对：harness 里所有相对 import 必须落在本目录内且存在
const harness = ["real-board/board.mjs", "real-board/launcher.mjs", "real-board/page-real.mjs", "real-board/suite-real.mjs", "real-board/negatives-real.mjs", "real-board/supplement.mjs", "real-board/centry-real.mjs", "selftest/center.mjs", "selftest-v2/cdp.mjs", "selftest-v2/lib2.mjs"];
const imports = [];
for (const rel of harness) {
  const text = readFileSync(path.join(HERE, rel), "utf8");
  for (const m of text.matchAll(/from\s+"([^"]+)"/g)) {
    const spec = m[1];
    if (!spec.startsWith(".")) continue;
    const target = path.resolve(path.dirname(path.join(HERE, rel)), spec);
    const ok = existsSync(target);
    if (!ok) bad++;
    imports.push([ok ? "OK" : "MISSING_IMPORT", rel + " -> " + spec, target.startsWith(HERE) ? "inside" : "OUTSIDE_PACKAGE"]);
  }
}
for (const row of rows) console.log(row.join(" | "));
for (const row of imports) console.log(row.join(" | "));
const outside = imports.filter((row) => row[2] === "OUTSIDE_PACKAGE").length;
console.log("DEPS files=" + manifest.files.length + " imports=" + imports.length + " outside=" + outside + " bad=" + bad);
process.exit(bad === 0 ? 0 : 1);
