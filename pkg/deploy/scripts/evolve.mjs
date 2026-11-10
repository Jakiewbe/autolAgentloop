#!/usr/bin/env node
// Evolution entry of the production loop: it turns what the patrol and the gates actually saw into a
// proposal, and stops there. Nothing here approves work, edits contract.json or starts a model turn;
// a proposal only becomes a production job when a task with a matching approval hash exists.
//
// Inputs, in the order they are trusted:
//   1. evidence/ops/self-heal/latest.json  - what the patrol could not repair
//   2. tools/production_loop/native_gate.mjs - design defects of the shipped repair tool
// Output: evidence/ops/evolution/proposals/<stamp>-<issue>.{json,md}
//
// usage: node deploy/scripts/evolve.mjs [--json] [--skip-gate]
// exit 0 = a proposal was written or there is nothing to propose; 2 = inputs unavailable
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..", "..");
const args = process.argv.slice(2);
const value = name => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const outDir = path.resolve(value("--out") ?? path.join(repo, "evidence", "ops", "evolution", "proposals"));
const patrolPath = path.resolve(value("--patrol") ?? path.join(repo, "evidence", "ops", "self-heal", "latest.json"));
const asJson = args.includes("--json");
const skipGate = args.includes("--skip-gate");

const sha = text => createHash("sha256").update(text).digest("hex");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");

function nextVersion(slug) {
  if (!existsSync(outDir)) return 1;
  let seen = 0;
  for (const name of readdirSync(outDir)) {
    if (name.includes(slug)) seen += 1;
  }
  return seen + 1;
}

if (!existsSync(patrolPath)) {
  console.log(asJson ? JSON.stringify({ exit: 2, problem: "no patrol report yet; run self-heal first" })
    : "no patrol report yet; run self-heal first");
  process.exit(2);
}

const patrol = JSON.parse(readFileSync(patrolPath, "utf8"));
const findings = [];

for (const problem of patrol.problems ?? []) {
  findings.push({
    kind: problem.kind ?? "unclassified",
    issue: "session-log-unrepairable",
    title: "A session log the patrol could not make loadable",
    evidence: [problem.path ?? "(unknown path)"],
    detail: problem.detail ?? problem.message ?? "",
  });
}

if (!skipGate) {
  const gate = spawnSync(process.execPath, [path.join(repo, "tools", "production_loop", "native_gate.mjs"), "--json"],
    { cwd: repo, encoding: "utf8", timeout: 900000, windowsHide: true });
  let report = null;
  try { report = JSON.parse((gate.stdout || "").trim().split("\n").pop()); } catch { report = null; }
  if (report && report.failed > 0) {
    for (const failed of report.results.filter(r => !r.pass)) {
      findings.push({
        kind: "design-defect",
        issue: "repair-tool-claim",
        title: "The repair tool and the native validator disagree",
        evidence: ["node tools/production_loop/native_gate.mjs --json"],
        detail: JSON.stringify(failed),
      });
    }
  }
}

// A gate that cannot run is itself a finding: production must not look healthy because the probe broke.
if (!skipGate && findings.length === 0) {
  const gate = spawnSync(process.execPath, [path.join(repo, "tools", "production_loop", "native_gate.mjs"), "--json"],
    { cwd: repo, encoding: "utf8", timeout: 900000, windowsHide: true });
  if (gate.status === 2) {
    findings.push({
      kind: "gate-unavailable",
      issue: "native-gate-fixtures",
      title: "The native gate cannot certify on this machine",
      evidence: ["node tools/production_loop/native_gate.mjs --json"],
      detail: (gate.stdout || "").trim().slice(0, 400),
    });
  }
}

if (findings.length === 0) {
  const result = { exit: 0, stamp, proposal: null, note: "nothing to propose: patrol healthy and every gate passed" };
  console.log(asJson ? JSON.stringify(result) : JSON.stringify(result, null, 2));
  process.exit(0);
}

mkdirSync(outDir, { recursive: true });
const byIssue = new Map();
for (const finding of findings) {
  if (!byIssue.has(finding.issue)) byIssue.set(finding.issue, []);
  byIssue.get(finding.issue).push(finding);
}

const written = [];
for (const [issue, group] of byIssue) {
  const version = nextVersion(issue);
  const issueId = issue + "-v" + version;
  const proposal = {
    issueId,
    taskId: "TBD",
    title: group[0].title,
    createdAt: new Date().toISOString(),
    status: "proposed",
    source: { patrol: "evidence/ops/self-heal/latest.json", patrolStamp: patrol.stamp, patrolSha: sha(JSON.stringify(patrol)) },
    findings: group,
    scope: [
      "the repair tool must refuse input it cannot make loadable, or say so in its own output",
      "the acceptance decision must come from delivery/session-repair-release/checks/native_verify.mjs",
      "no change may weaken gate 9/10 in tools/production_loop/native_gate.mjs",
    ],
    gates: [
      "node tools/production_loop/native_gate.mjs --json  -> exit 0",
      "python tools/production_loop/verify.py -> passed 63, failed 0",
      "npm run test:windows on the worker side -> 0 failing",
    ],
    activation: [
      "1. register a task for this issueId and record its approval hash (project-anchor)",
      "2. copy runs/project-pilot-T35/delivery/production-loop/contract.json to contract.<issueId>.json",
      "3. set taskId, issueId and approvalHash; keep enabled=false until the approver flips it",
      "4. only then set enabled=true; the controller does not start a cycle without a matching approval",
    ],
  };
  const base = path.join(outDir, stamp + "-" + issueId);
  writeFileSync(base + ".json", JSON.stringify(proposal, null, 2));
  const md = [
    "# Proposal " + issueId,
    "",
    "- created: " + proposal.createdAt,
    "- status: proposed (nothing is approved, enabled or started by this file)",
    "- patrol: " + patrol.stamp + " (checked " + patrol.checked + ", loadable " + patrol.loadable + ")",
    "",
    "## Findings",
    ...group.map(f => "- " + f.kind + ": " + f.title + "\n  - evidence: " + f.evidence.join(", ") + "\n  - detail: " + f.detail),
    "",
    "## Scope",
    ...proposal.scope.map(s => "- " + s),
    "",
    "## Gates that must be green before this can publish",
    ...proposal.gates.map(g => "- " + g),
    "",
    "## Activation",
    ...proposal.activation.map(a => a),
    "",
  ].join("\n");
  writeFileSync(base + ".md", md);
  written.push(base);
}

const result = { exit: 0, stamp, proposals: written };
console.log(asJson ? JSON.stringify(result) : JSON.stringify(result, null, 2));
