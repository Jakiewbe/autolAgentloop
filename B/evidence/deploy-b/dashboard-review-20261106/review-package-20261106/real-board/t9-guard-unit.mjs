// t9-guard-unit.mjs：writeGuard 的正负例（证明空录制不再空真通过）。
import { writeGuard } from "./write-guard.mjs";

const cases = [
  { name: "空录制不再算通过", input: [], expect: false },
  { name: "只有读请求算通过（分母>0）", input: ["http://x/api/state", "http://x/api/runs/1/why"], expect: true },
  { name: "出现一次写就失败", input: ["http://x/api/state", "http://x/api/cards/7/answer"], expect: false },
  { name: "非 /api/ 请求不计入分母", input: ["http://x/index.html", "http://x/api/state"], expect: true },
];
let bad = 0;
for (const spec of cases) {
  const got = writeGuard(spec.input);
  const ok = got.ok === spec.expect;
  if (!ok) bad += 1;
  console.log((ok ? "OK " : "BAD ") + spec.name + " " + JSON.stringify(got) + " expect.ok=" + spec.expect);
}
console.log("T9_GUARD " + JSON.stringify({ cases: cases.length, bad }));
process.exitCode = bad ? 1 : 0;
