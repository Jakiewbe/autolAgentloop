import assert from "node:assert/strict";
import test from "node:test";
import adapter from "../plugins/claude-go/agent.ts";

// B 侧独立判据：估价不得进入记账通道。真正记账的是 sessionUsage（plugins/claude/agent.ts:82
// -> worker/worker.ts:92 sessionRise -> :376 addUsage），per-turn usage.cost 从来不存在。
test("B criterion: claude-go never hands a price estimate to the account", () => {
  const stdout = JSON.stringify({
    type: "result",
    subtype: "success",
    result: "done",
    session_id: "s1",
    total_cost_usd: 12,
    usage: { input_tokens: 3, output_tokens: 2, cache_read_input_tokens: 1 },
  });
  const r = adapter.read(stdout, 0, "");
  assert.equal(r.usage?.input, 3);
  assert.equal(r.usage?.output, 2);
  assert.equal(JSON.stringify(r).includes("cost"), false, "sessionUsage/usage 里不得出现 cost");
  assert.equal(r.sessionUsage, undefined);
});
