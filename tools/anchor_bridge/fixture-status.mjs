// A stand-in for the governance program in the bridge's end-to-end check: it prints what kit.py prints for a project
// with one task that is ready and one that is a draft, so the bridge's event path can be exercised without touching a
// real ledger.
const state = {
  name: "fixture-project",
  task_revision: 7,
  tasks: [
    { task_id: "F1", title: "可领的一条", plan: "approved", status: "todo", dependencies: [], deliverable_coverage: "covered", scope_dirty: false, legacy_unverified: false },
    { task_id: "F2", title: "草稿", plan: "draft", status: "todo", dependencies: [], deliverable_coverage: "covered", scope_dirty: false, legacy_unverified: false },
  ],
};
console.log(JSON.stringify(state));
