// B3 对照：同一台机器、同一 token，新建目录只继承「修改」权限（无 WRITE_OWNER）
// 旧基座 privateDirectory 必抛 UnauthorizedAccessException；新基座（#178）应成功。
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";

const OLD = "D:/AutoAgentloop/release/b-c067fdb-20261107/host/files.ts";
const NEW = "D:/AutoAgentloop/release/b-3d0e835-20261108/host/files.ts";
const base = "D:/AutoAgentloop/_b3probe-new";
const out = {};

function attempt(label, mod, dir) {
  const rec = { label, dir };
  try {
    mod.privateDirectory(dir);
    rec.result = "OK";
  } catch (error) {
    rec.result = "THROW";
    rec.message = String((error as Error).message ?? error).split("\n").slice(0, 6).join(" | ");
  }
  return rec;
}

rmSync(base, { recursive: true, force: true });
mkdirSync(base, { recursive: true });

const oldMod = await import(pathToFileURL(OLD).href);
const newMod = await import(pathToFileURL(NEW).href);

out.old_on_fresh = attempt("old-on-fresh", oldMod, base + "/old-fresh");
out.new_on_fresh = attempt("new-on-fresh", newMod, base + "/new-fresh");
// 已在用家目录（owner 已是本人，DACL 已是产品形态）
out.new_on_home = attempt("new-on-home", newMod, "D:/AutoAgentloop/home");
console.log(JSON.stringify(out, null, 1));
