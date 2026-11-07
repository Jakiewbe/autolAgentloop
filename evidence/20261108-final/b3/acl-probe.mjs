import { privateDirectory } from "file:///D:/AutoAgentloop/release/b-c067fdb-20261107/host/files.ts";
const dir = process.argv[2];
try {
  privateDirectory(dir);
  console.log("OK  privateDirectory succeeded:", dir);
} catch (e) {
  const first = String(e && e.message ? e.message : e).split(/\r?\n/)[0];
  console.log("FAIL", e && e.constructor ? e.constructor.name : "Error", first);
  process.exitCode = 1;
}
