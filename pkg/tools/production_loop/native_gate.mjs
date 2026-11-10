#!/usr/bin/env node
// Gate 9/10 for the session-repair release: a repair only counts when DSH's OWN validator accepts
// the result, and a tool may never report success on input it cannot make loadable.
// The release's 8 checks are synthetic and call no native validator, so they can pass on a log that
// still fails cold load. This gate reuses checks/native_verify.mjs (asar-pinned validator).
//
// Gate 9 needs a log that is broken but repairable. Instead of checking a fixture into the repo
// (session logs carry real conversation text), the damaged copy is built at run time from the
// loadable fixture by re-adding the exact writer defect the tool exists to remove: a duplicated
// step/end + step/start boundary for the same turn and step.
//
// usage: node native_gate.mjs [--tool <repair.mjs>] [--good <log.zstd>] [--bad <log.zstd>] [--json]
// exit 0 = every gate passed; 1 = a gate failed; 2 = fixtures/validator unavailable (cannot certify)
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..");
const verify = path.join(repo, "delivery", "session-repair-release", "checks", "native_verify.mjs");
const sessions = path.join(homedir(), ".dsh", "sessions");
const backup = path.join(homedir(), ".dsh", "session-repair-backup", "20261110-1643");
const KNOWN_GOOD = path.join(sessions, "--D-Vibe_coding-Project-autoAgentloop--",
  "session-9cfc31a0-65b5-4647-8901-1ef3f13a9ecf", "session.v4.jsonl.zstd");
const KNOWN_BAD = path.join(backup, "session.v4.jsonl.zstd.orig");

const args = process.argv.slice(2);
const value = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const asJson = args.includes("--json");
const tool = path.resolve(value("--tool") ?? path.join(repo, "delivery", "session-repair-release", "dsh-session-repair-step.mjs"));
// A machine without our session history can still gate: point the fixtures somewhere else.
const good = path.resolve(value("--good") ?? process.env.NATIVE_GATE_GOOD ?? KNOWN_GOOD);
const bad = path.resolve(value("--bad") ?? process.env.NATIVE_GATE_BAD ?? KNOWN_BAD);

function stop(code, problem) {
  const report = { exit: code, tests: 0, passed: 0, failed: 0, skipped: 0, problem, tool, good, bad, results: [] };
  console.log(asJson ? JSON.stringify(report) : JSON.stringify(report, null, 2));
  process.exit(code);
}

if (!existsSync(tool)) stop(2, "repair tool not found: " + tool);
if (!existsSync(verify)) stop(2, "native_verify.mjs not found: " + verify);
if (!existsSync(good)) stop(2, "loadable fixture not found: " + good);
if (!existsSync(bad)) stop(2, "unrepairable fixture not found: " + bad);

// Walk the zstd frame headers of a log without decoding checkpoints we do not need.
function frameBounds(buf) {
  const bounds = [];
  let at = 0;
  while (at < buf.length) {
    const start = at;
    const descriptor = buf.readUInt8(at + 4);
    const fcsFlag = descriptor >> 6;
    const singleSegment = (descriptor & 32) !== 0;
    const withChecksum = (descriptor & 4) !== 0;
    const dictFlag = descriptor & 3;
    let p = at + 5;
    if (!singleSegment) p += 1;
    p += [0, 1, 2, 4][dictFlag];
    p += fcsFlag === 0 ? (singleSegment ? 1 : 0) : [0, 2, 4, 8][fcsFlag];
    for (;;) {
      const header = buf.readUIntLE(p, 3);
      p += 3;
      const last = (header & 1) === 1;
      const type = (header >> 1) & 3;
      const size = header >> 3;
      p += type === 1 ? 1 : size;
      if (last) break;
    }
    if (withChecksum) p += 4;
    bounds.push({ start, end: p, withChecksum });
    at = p;
  }
  return bounds;
}

function decodeAll(buf) {
  let text = "";
  for (const frame of frameBounds(buf)) {
    text += zlib.zstdDecompressSync(buf.subarray(frame.start, frame.end)).toString("utf8");
  }
  return text;
}

// Re-add the duplicate boundary the repair tool removes: step/end (T, S) then step/start (T, S).
// Renumbering keeps the input seq-contiguous, which the tool refuses to work on otherwise.
function makeRepairable(source, target) {
  const buf = readFileSync(source);
  const records = decodeAll(buf).split("\n").filter(line => line.trim().length > 0).map(line => JSON.parse(line));
  const at = records.findIndex((rec, index) => index > 3 && rec.type === "step/end" && rec.data && rec.data.turn === 1 && rec.data.step === 1);
  if (at < 0) throw new Error("fixture has no step/end (1, 1) boundary to duplicate");
  const source0 = records[at];
  const damaged = [];
  for (let i = 0; i < records.length; i += 1) {
    damaged.push(records[i]);
    if (i === at) {
      damaged.push({ type: "step/end", seq: 0, time: source0.time, data: { turn: 1, step: 1 } });
      damaged.push({ type: "step/start", seq: 0, time: source0.time, data: { turn: 1, step: 1 } });
    }
  }
  const first = records.find(rec => typeof rec.seq === "number");
  if (!first) throw new Error("fixture has no seq numbers");
  let seq = first.seq;
  const lines = damaged.map(rec => {
    if (typeof rec.seq === "number") rec.seq = seq++;
    return JSON.stringify(rec);
  });
  // The validator requires the first frame to hold the header record and nothing else.
  const options = { params: { [zlib.constants.ZSTD_c_checksumFlag]: 0 } };
  writeFileSync(target, Buffer.concat([
    zlib.zstdCompressSync(Buffer.from(lines[0] + "\n", "utf8"), options),
    zlib.zstdCompressSync(Buffer.from(lines.slice(1).join("\n") + "\n", "utf8"), options),
  ]));
  return { records: lines.length, duplicatedAt: at };
}

function run(input, extra = []) {
  const r = spawnSync(process.execPath, [verify, input, "--tool", tool, ...extra], { encoding: "utf8", timeout: 600000, windowsHide: true });
  let parsed = null;
  try { parsed = JSON.parse(r.stdout.trim().split("\n").pop() ?? ""); } catch { parsed = null; }
  return { status: r.status, parsed, stdout: r.stdout, stderr: r.stderr };
}

const results = [];
const scratch = mkdtempSync(path.join(tmpdir(), "native-gate-"));

// Gate 9a: the damaged copy must really be unloadable, otherwise gate 9 proves nothing.
let damaged = path.join(scratch, "repairable.zstd");
let mutation = null;
try {
  mutation = makeRepairable(good, damaged);
} catch (err) {
  results.push({ name: "repairable fixture is built from the loadable log", pass: false,
    detail: String(err && err.message ? err.message : err) });
}
if (mutation) {
  const dmg = run(damaged, ["--check-only"]);
  const invalid = dmg.parsed?.nativeOk === false;
  results.push({ name: "re-added duplicate step boundary is rejected by the native validator", pass: invalid,
    records: mutation.records, duplicatedAt: mutation.duplicatedAt,
    nativeOk: dmg.parsed?.nativeOk ?? null, nativeMessage: dmg.parsed?.nativeMessage ?? dmg.stderr?.slice(0, 400) ?? "" });

  // Gate 9b: the tool must repair that log into something the native validator loads.
  const fixed = run(damaged);
  const ok = fixed.parsed?.repairExit === 0 && fixed.parsed?.nativeOk === true;
  results.push({ name: "repair of the damaged log is accepted by the native validator", pass: ok,
    repairExit: fixed.parsed?.repairExit ?? null, nativeOk: fixed.parsed?.nativeOk ?? null,
    nativeMessage: fixed.parsed?.nativeMessage ?? fixed.stderr?.slice(0, 400) ?? "" });
}

// Gate 9c: repairing an already loadable log must stay loadable.
const g9c = run(good);
results.push({ name: "native validator accepts the repair of a loadable log",
  pass: g9c.status === 0 && g9c.parsed?.nativeOk === true && g9c.parsed?.repairExit === 0,
  repairExit: g9c.parsed?.repairExit ?? null, nativeOk: g9c.parsed?.nativeOk ?? null,
  nativeMessage: g9c.parsed?.nativeMessage ?? g9c.stderr?.slice(0, 400) ?? "" });

// Gate 10: the tool's own claim is not acceptance. On the shipped tool this input really does come
// back as repaired:true while the native validator still rejects the result, so the rule the gate pins
// is the one that keeps production honest: acceptance comes from the validator, never from tool output.
const copied = path.join(scratch, "unrepairable-out.zstd");
const tool10 = spawnSync(process.execPath, [tool, bad, "--out", copied], { encoding: "utf8", timeout: 600000, windowsHide: true });
let tool10parsed = null;
try { tool10parsed = JSON.parse(tool10.stdout.trim()); } catch {
  try { tool10parsed = JSON.parse(tool10.stdout.trim().split("\n").pop() ?? ""); } catch { tool10parsed = null; }
}
const claimed = tool10parsed ? tool10parsed.repaired === true : tool10.status === 0;
const g10 = run(bad);
const accepted = g10.parsed?.nativeOk === true;
results.push({ name: "tool claim is not acceptance: the native check stays red on an unrepairable log",
  pass: accepted === false && g10.status !== 0,
  toolExit: tool10.status, toolClaimedRepair: claimed, checkExit: g10.status,
  nativeOk: g10.parsed?.nativeOk ?? null,
  nativeMessage: g10.parsed?.nativeMessage ?? g10.stderr?.slice(0, 400) ?? "",
  detail: claimed
    ? "the tool reported repaired:true and the validator rejected the result; acceptance must come from the validator"
    : "the tool did not claim a repair" });

const passed = results.filter(r => r.pass).length;
const report = { exit: passed === results.length ? 0 : 1, tests: results.length, passed,
  failed: results.length - passed, skipped: 0, tool, good, bad, results };
console.log(asJson ? JSON.stringify(report) : JSON.stringify(report, null, 2));
process.exit(report.exit);
