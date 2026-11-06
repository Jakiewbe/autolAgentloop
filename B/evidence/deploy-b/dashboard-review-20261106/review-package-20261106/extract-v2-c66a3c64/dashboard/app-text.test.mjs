// Text-level regressions for the panel's own wording. They evaluate only the small
// formatting helpers, so no service, hub or browser is needed.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(
  new URL("./public/app.js", import.meta.url),
  "utf8",
);
function slice(name, until) {
  const begin = source.indexOf("function " + name + "(");
  const end = source.indexOf("function " + until + "(", begin);
  assert(
    begin >= 0 && end > begin,
    name + " and " + until + " must exist in order",
  );
  return source.slice(begin, end).trim();
}
const resultText = vm.runInNewContext(
  "(" + slice("resultText", "decisionCard") + ")",
);

test("a closed card without a result credits no human handling", () => {
  const text = resultText({ kind: "notice", state: "closed", result: null });
  assert.match(text, /没有处理结果记录/);
  assert.doesNotMatch(text, /人工/);
});

test("recorded results and decided cards keep their own wording", () => {
  assert.equal(
    resultText({ state: "closed", result: "后续已跑完" }),
    "后续已跑完",
  );
  assert.match(
    resultText({ state: "decided", result: null }),
    /中心尚未收到后续结果/,
  );
  assert.match(resultText({ state: "open", result: null }), /尚未记录后续结果/);
});

test("an unconfirmed state is described by the hub's own lease semantics, not a retry count", () => {
  assert.doesNotMatch(source, /超出重试范围/);
  assert.match(source, /运行中超过租约仍未回报/);
  assert.match(source, /不接受取消/);
});
