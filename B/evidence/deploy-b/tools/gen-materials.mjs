import { readdir, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const ROOTS = [
  "D:/AutoAgentloop/evidence/deploy-b",
  "D:/AutoAgentloop/evidence/deployment",
  "D:/AutoAgentloop/outbox/to-A-deploy",
];
const EXCLUDE = new Set(["MATERIALS.sha256"]);
// claude-mem 会在任意目录写 AGENTS.md 记忆横幅，属工具噪声而非 B 的证据，统一排除
const EXCLUDE_PATH = /(^|\/)(evidence\/deploy-b)\/.*AGENTS\.md$/;
const rows = [];
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.posix.join(dir, e.name);
    if (e.isDirectory()) { await walk(p); continue; }
    if (EXCLUDE.has(e.name)) continue;
    if (EXCLUDE_PATH.test(p.replace(/\\/g, "/"))) continue;
    const buf = await readFile(p);
    rows.push({ p, bytes: buf.length, sha: createHash("sha256").update(buf).digest("hex") });
  }
}
for (const r of ROOTS) { try { await walk(r); } catch (err) { console.log("SKIP", r, err.code); } }
rows.sort((a, b) => a.p.localeCompare(b.p));
const lines = rows.map(r => r.sha + "  " + r.p.replace("D:/AutoAgentloop/", ""));
await writeFile("D:/AutoAgentloop/evidence/deploy-b/MATERIALS.sha256", lines.join("\n") + "\n", "utf8");
const md = ["| # | 文件（相对 D:\\AutoAgentloop\\） | 字节 | sha256 |", "| ---: | --- | ---: | --- |",
  ...rows.map((r, i) => `| ${i + 1} | \`${r.p.replace("D:/AutoAgentloop/", "").replace(/\//g, "\\")}\` | ${r.bytes} | \`${r.sha}\` |`)].join("\n");
await writeFile("D:/AutoAgentloop/_probe/materials-table.md", md, "utf8");
console.log("files=" + rows.length);
