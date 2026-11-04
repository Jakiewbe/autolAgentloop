// The bridge decides what may be handed out; these are the cases where it must say no. Failure it guards against: a
// draft task, a task waiting on another, a task whose delivery files are not declared, a task whose scope changed after
// approval, or a task already being worked on, being handed to an agent as if it were ready.
import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { objection, subjectOf } from "./bridge.mjs";

const ready = (over = {}) => ({
  task_id: "T1",
  plan: "approved",
  status: "todo",
  dependencies: [],
  deliverable_coverage: "covered",
  scope_dirty: false,
  legacy_unverified: false,
  ...over,
});
const deps = (...tasks) => new Map(tasks.map((task) => [task.task_id, task]));

test("a task that is approved, unblocked and declared is claimable", () => {
  assert.equal(objection(ready(), deps(ready())), null);
});

test("a draft task is not claimable", () => {
  assert.match(objection(ready({ plan: "draft" }), deps(ready())), /没有批准/);
});

test("a task whose dependency is not done waits", () => {
  const after = ready({ task_id: "T2", dependencies: ["T1"] });
  assert.match(objection(after, deps(ready({ status: "doing" }), after)), /依赖未完成：T1/);
});

test("a task whose delivery files are not declared waits", () => {
  assert.match(objection(ready({ deliverable_coverage: "missing" }), deps()), /交付未声明/);
});

test("a task whose scope changed after approval waits for a new approval", () => {
  assert.match(objection(ready({ scope_dirty: true }), deps()), /重新批准/);
});

test("a task already being worked on is not handed out twice", () => {
  assert.match(objection(ready({ status: "doing" }), deps()), /已经在做/);
});

test("a non-ASCII project name still yields an address the center accepts", () => {
  const subject = subjectOf("数字生命 项目", "T8");
  assert.match(subject, /^[A-Za-z0-9#._:/@-]+$/);
  assert.equal(subjectOf("", ""), "task/project/project");
});

test("a blocked task says it is blocked, not that it waits on a dependency", () => {
  assert.match(objection(ready({ status: "blocked" }), deps()), /自身被阻塞/);
});

test("a dependency that is done but whose verification went stale does not unlock the next task", () => {
  const after = ready({ task_id: "T2", dependencies: ["T1"] });
  const done = ready({ status: "done", verification_state: "stale" });
  assert.match(objection(after, deps(done, after)), /验收记录不是当前材料对应的结果：T1（stale）/);
});

test("a dependency that is done and still passes its checks unlocks the next task", () => {
  const after = ready({ task_id: "T2", dependencies: ["T1"] });
  const done = ready({ status: "done", verification_state: "pass" });
  assert.equal(objection(after, deps(done, after)), null);
});

test("a dependency the ledger does not know is not met", () => {
  const after = ready({ task_id: "T2", dependencies: ["T9"] });
  assert.match(objection(after, deps(after)), /依赖未完成：T9/);
});

test("the installed skill's runtime.json is where the governance program is found", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { findKit } = await import("./bridge.mjs");
  const dir = mkdtempSync(path.join(tmpdir(), "anchor-bridge-"));
  const skill = path.join(dir, ".agents", "skills", "project-anchor");
  mkdirSync(skill, { recursive: true });
  const kit = path.join(dir, "kit.py");
  writeFileSync(kit, "# stand-in\n");
  writeFileSync(path.join(skill, "runtime.json"), JSON.stringify({ schema: 1, kit, python: process.execPath }));
  assert.deepEqual(findKit(dir), { program: kit, python: process.execPath, via: path.join(skill, "runtime.json") });
});
