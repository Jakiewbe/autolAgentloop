// Guard the local read-only bridge: credentials and upstream capabilities must not reach the browser.
import test from "node:test";
import assert from "node:assert/strict";
import { get } from "node:http";
import { readFileSync } from "node:fs";
import {
  createDashboard,
  projectState,
  projectWhy,
  laneOf,
} from "./server.mjs";
import {
  groupItems,
  futurePlans,
  timelineNodes,
  cancelNote,
  itemTitle,
  itemNote,
} from "./public/workflow.mjs";

const state = {
  now: "2026-11-06T07:00:00.000Z",
  timezone: "Asia/Shanghai",
  totals: {
    running: 0,
    queued: 0,
    retrying: 0,
    unknown: 0,
    done: 1,
    attention: 0,
  },
  spending: {
    today: { rounds: 1, tokens: 12, cost: 0, missingTokens: 0, missingCost: 1 },
  },
  agents: [
    {
      id: "b",
      name: "B",
      worker: "b",
      use: "command",
      online: true,
      seenAt: null,
      key: "SECRET",
      totals: {},
    },
  ],
  runs: [
    {
      id: 1,
      state: "done",
      summary: "<img src=x onerror=alert(1)>",
      token: "SECRET",
      link: "https://secret",
      usage: null,
      events: [{ subject: "test", detail: "SECRET" }],
    },
  ],
  cards: [
    {
      id: 1,
      title: "test",
      options: ["yes"],
      link: "https://secret",
      token: "SECRET",
    },
  ],
  recentCards: [],
  sources: [],
  channels: [],
  lines: [],
  unrouted: [],
  hasMore: false,
  nextBefore: null,
};

async function bridge(t, fetchImpl = async () => Response.json(state)) {
  const server = createDashboard({ owner: "OWNER_SECRET", fetchImpl });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(
    () =>
      new Promise((resolve) => {
        server.closeAllConnections();
        server.close(resolve);
      }),
  );
  return `http://127.0.0.1:${server.address().port}`;
}

test("state whitelist drops nested secrets and capability links without changing untrusted text", () => {
  const data = projectState(state);
  assert(!JSON.stringify(data).includes("SECRET"));
  assert(!JSON.stringify(data).includes("https://secret"));
  assert.equal(data.runs[0].summary, state.runs[0].summary);
  assert.equal(data.runs[0].usage, null);
  assert.equal(data.spending.today.missingCost, 1);
});

test("reads the real upstream with server-side authorization and preserves pagination", async (t) => {
  let seen;
  const url = await bridge(t, async (u, options) => {
    // Lane lookups also reach the upstream; they are not the state read under test.
    if (!String(u).includes("/v1/runs/")) seen = { u: String(u), options };
    return Response.json(state);
  });
  const response = await fetch(url + "/api/state?before=10");
  assert.equal(response.status, 200);
  const text = await response.text();
  assert(!text.includes("OWNER_SECRET"));
  assert.equal(seen.options.headers.Authorization, "Bearer OWNER_SECRET");
  assert.equal(new URL(seen.u).searchParams.get("before"), "10");
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("rejects writes without calling the upstream", async (t) => {
  let calls = 0;
  const url = await bridge(t, async () => {
    calls++;
    return Response.json(state);
  });
  assert.equal(
    (await fetch(url + "/api/state", { method: "POST" })).status,
    405,
  );
  assert.equal(calls, 0);
});

test("rejects cross-site reads and rebinding hosts", async (t) => {
  const url = await bridge(t);
  assert.equal(
    (
      await fetch(url + "/api/state", {
        headers: { Origin: "https://example.com" },
      })
    ).status,
    403,
  );
  const status = await new Promise((resolve, reject) => {
    get(
      url + "/api/state",
      { headers: { Host: "attacker.example" } },
      (response) => {
        response.resume();
        resolve(response.statusCode);
      },
    ).on("error", reject);
  });
  assert.equal(status, 403);
});

test("does not serve repository/config files or unknown API routes", async (t) => {
  const url = await bridge(t);
  for (const path of [
    "/server.mjs",
    "/.agent-autoloop/config.json",
    "/api/runs/1/cancel",
    "/%2e%2e/config.json",
  ]) {
    assert.equal((await fetch(url + path)).status, 404);
  }
});

test("rejects malformed cursors before reaching upstream", async (t) => {
  let calls = 0;
  const url = await bridge(t, async () => {
    calls++;
    return Response.json(state);
  });
  for (const query of [
    "before=-1",
    "before=abc",
    "before=1&owner=secret",
    "before=1&before=2",
  ]) {
    assert.equal((await fetch(url + "/api/state?" + query)).status, 400);
  }
  assert.equal(calls, 0);
});

test("upstream failures produce an explicit error without cached success or secret-bearing diagnostics", async (t) => {
  const url = await bridge(t, async () => {
    throw Error("OWNER_SECRET");
  });
  const response = await fetch(url + "/api/state");
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: "暂时无法读取中心，请检查中心是否仍在运行。",
  });
});

test("static client has a strict content policy and never contains a configured secret", async (t) => {
  const url = await bridge(t);
  const response = await fetch(url + "/");
  assert.equal(response.status, 200);
  assert(
    response.headers
      .get("content-security-policy")
      .includes("connect-src 'self'"),
  );
  assert(!(await response.text()).includes("OWNER_SECRET"));
});

test("malformed state is a failure rather than a fabricated empty dashboard", async (t) => {
  const url = await bridge(t, async () =>
    Response.json({ now: "not-a-date", runs: [], agents: [] }),
  );
  assert.equal((await fetch(url + "/api/state")).status, 502);
});

const post = (url, path, body, headers = {}) =>
  fetch(url + path, {
    method: "POST",
    headers: { Origin: url, "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

test("only the three exact owner actions are forwarded; reply contains no capability fields", async (t) => {
  const calls = [];
  const url = await bridge(t, async (target, options) => {
    calls.push({ target: String(target), options });
    return Response.json({
      ok: true,
      changed: true,
      state: "decided",
      key: "OWNER_SECRET",
      link: "secret",
    });
  });
  for (const [path, body] of [
    ["/api/cards/1/answer", { choice: 0 }],
    ["/api/cards/1/answer", { text: "请检查真实来源" }],
    ["/api/cards/1/resolve", { reason: "已人工处理" }],
    ["/api/runs/1/cancel", {}],
  ]) {
    const reply = await post(url, path, body);
    assert.equal(reply.status, 200);
    assert.deepEqual(await reply.json(), {
      ok: true,
      changed: true,
      state: "decided",
    });
  }
  assert.equal(calls.length, 4);
  assert.equal(calls[0].options.headers.Authorization, "Bearer OWNER_SECRET");
  assert.equal(calls[0].options.body, '{"choice":0}');
  assert(calls[3].target.endsWith("/v1/runs/1/cancel"));
});

test("writes require exact same origin and JSON; a web page cannot use this bridge cross-site", async (t) => {
  let calls = 0;
  const url = await bridge(t, async () => {
    calls++;
    return Response.json({ changed: true });
  });
  assert.equal(
    (
      await fetch(url + "/api/cards/1/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: '{"choice":0}',
      })
    ).status,
    403,
  );
  for (const origin of ["null", "https://evil.example", url + "x"])
    assert.equal(
      (
        await post(
          url,
          "/api/cards/1/answer",
          { choice: 0 },
          { Origin: origin },
        )
      ).status,
      403,
    );
  assert.equal(
    (
      await post(
        url,
        "/api/cards/1/answer",
        { choice: 0 },
        { "Content-Type": "text/plain" },
      )
    ).status,
    400,
  );
  assert.equal(calls, 0);
});

test("invalid action values fail before upstream including JSON null, arrays, extra fields and mixed answers", async (t) => {
  let calls = 0;
  const url = await bridge(t, async () => {
    calls++;
    return Response.json({ changed: true });
  });
  for (const body of [
    null,
    [],
    {},
    { choice: null },
    { choice: -1 },
    { choice: "0" },
    { choice: 0.5 },
    { text: "" },
    { text: "  " },
    { choice: 0, text: "both" },
    { choice: 0, by: "owner" },
    { url: "https://evil.example" },
  ])
    assert.equal((await post(url, "/api/cards/1/answer", body)).status, 400);
  for (const body of [
    { reason: "" },
    { reason: "x".repeat(1001) },
    { reason: 1 },
    { reason: "ok", extra: true },
  ])
    assert.equal((await post(url, "/api/cards/1/resolve", body)).status, 400);
  assert.equal(
    (await post(url, "/api/runs/1/cancel", { force: true })).status,
    400,
  );
  assert.equal(calls, 0);
});

test("arbitrary owner APIs, card cancel, run answer and action query injection cannot be proxied", async (t) => {
  let calls = 0;
  const url = await bridge(t, async () => {
    calls++;
    return Response.json({ ok: true });
  });
  for (const path of [
    "/api/events",
    "/api/keys/worker/b",
    "/api/cards/1/cancel",
    "/api/runs/1/answer",
    "/api/cards/0/answer",
    "/api/cards/1/answer?target=https://evil.example",
  ])
    assert((await post(url, path, { choice: 0 })).status >= 400);
  assert.equal(calls, 0);
});

test("oversized bodies and malformed JSON never reach upstream", async (t) => {
  let calls = 0;
  const url = await bridge(t, async () => {
    calls++;
    return Response.json({ ok: true });
  });
  assert.equal(
    (await post(url, "/api/cards/1/answer", { text: "x".repeat(17000) }))
      .status,
    413,
  );
  assert.equal(
    (
      await fetch(url + "/api/cards/1/answer", {
        method: "POST",
        headers: { Origin: url, "Content-Type": "application/json" },
        body: "{",
      })
    ).status,
    400,
  );
  assert.equal(calls, 0);
});

test("already answered result stays unchanged and upstream conflict is not reported as success", async (t) => {
  const url = await bridge(t, async (target) =>
    String(target).endsWith("/resolve")
      ? Response.json({ error: "OWNER_SECRET" }, { status: 409 })
      : Response.json({ changed: false, state: "decided" }),
  );
  assert.deepEqual(
    await (await post(url, "/api/cards/1/answer", { choice: 0 })).json(),
    { changed: false, state: "decided" },
  );
  const reply = await post(url, "/api/cards/1/resolve", { reason: "done" });
  assert.equal(reply.status, 409);
  assert(!(await reply.text()).includes("OWNER_SECRET"));
});

test("an uncertain action result is not retried or converted to success", async (t) => {
  let calls = 0;
  const url = await bridge(t, async () => {
    calls++;
    throw Error("OWNER_SECRET");
  });
  const result = await post(url, "/api/cards/1/answer", { choice: 0 });
  assert.equal(result.status, 502);
  assert((await result.text()).includes("不要直接重复提交"));
  assert.equal(calls, 1);
});

test("invalid acknowledgement shapes fail closed", async (t) => {
  const url = await bridge(t, async () => Response.json(null));
  assert.equal((await post(url, "/api/runs/1/cancel", {})).status, 502);
  assert.equal(
    (await post(url, "/api/cards/1/answer", { choice: 0 })).status,
    502,
  );
});

test("an owner string echoed even in action state never reaches the browser", async (t) => {
  const url = await bridge(t, async () =>
    Response.json({ changed: false, state: "OWNER_SECRET" }),
  );
  const response = await post(url, "/api/cards/1/answer", { choice: 0 });
  assert.equal(response.status, 200);
  assert(!(await response.text()).includes("OWNER_SECRET"));
});

const facts = [
  {
    seq: 1,
    at: 1,
    type: "rules",
    changes: [
      { table: "keys", key: "owner", row: { secret: "SECRET" } },
      {
        table: "config",
        key: "rules",
        row: {
          version: 1,
          value: {
            worker: { key: "SECRET" },
            agents: { a: { command: ["secret-command"] } },
          },
        },
      },
    ],
  },
  {
    seq: 2,
    at: 2,
    type: "started",
    meta: { secret: "SECRET" },
    changes: [
      {
        table: "runs",
        key: "1",
        row: {
          id: 1,
          state: "claimed",
          session: "thread-1",
          token: "SECRET",
          last_answer: "SECRET",
          rules_version: 1,
        },
      },
      { table: "runs", key: "2", row: { id: 2, summary: "unrelated" } },
      {
        table: "cards",
        key: "3",
        row: {
          id: 3,
          title: "决定",
          state: "decided",
          choice: 0,
          options: '["甲"]',
          answer_event: 4,
          link: "SECRET",
        },
      },
    ],
  },
];
test("timeline projection retains fact order and relation IDs, drops keys, unrelated runs and full configs", () => {
  const output = projectWhy(facts, 1),
    json = JSON.stringify(output);
  assert(!json.includes("SECRET"));
  assert(!json.includes("secret-command"));
  assert(!json.includes("unrelated"));
  assert.deepEqual(
    output.map((f) => f.seq),
    [1, 2],
  );
  assert.equal(output[0].changes[0].row.version, 1);
  assert.equal(output[1].changes[0].row.state, "claimed");
  assert.equal(output[1].changes[1].row.answer_event, 4);
});
test("timeline bridge is read-only, authenticated server-side and rejects bad history", async (t) => {
  let authorization;
  const url = await bridge(t, async (target, options) => {
    authorization = options.headers.Authorization;
    return Response.json(String(target).includes("/runs/2/") ? {} : facts);
  });
  const response = await fetch(url + "/api/runs/1/why");
  assert.equal(response.status, 200);
  assert.equal(authorization, "Bearer OWNER_SECRET");
  assert.equal((await response.json()).facts.length, 2);
  assert.equal((await fetch(url + "/api/runs/2/why")).status, 502);
  assert.equal((await fetch(url + "/api/runs/1/why?token=bad")).status, 400);
});
test("state preserves historical decisions and external schedules without their credentials", () => {
  const projected = projectState({
    ...state,
    recentCards: [
      {
        id: 3,
        state: "decided",
        answer: "甲",
        result: null,
        version: 2,
        link: "SECRET",
      },
    ],
    elsewhere: [
      {
        id: "daily",
        name: "早报",
        next: "2026-11-07",
        where: "其他应用",
        key: "SECRET",
      },
    ],
  });
  assert.equal(projected.recentCards[0].state, "decided");
  assert.equal(projected.recentCards[0].version, 2);
  assert.equal(projected.elsewhere[0].where, "其他应用");
  assert(!JSON.stringify(projected).includes("SECRET"));
});
test("items follow the hub's rule and lane, never titles, subjects or sessions", () => {
  const grouped = groupItems([
    // One rule, one lane: an answer continuation joins its own item even with an empty event subject.
    { id: 1, rule: "r1", laneKnown: true, lane: "repo#1", grp: "g" },
    { id: 2, rule: "r1", laneKnown: true, lane: "repo#1", grp: "g" },
    // No parallel: an empty lane is authoritative and the whole rule is one item.
    { id: 3, rule: "r2", laneKnown: true, lane: "", grp: "r2" },
    { id: 4, rule: "r2", laneKnown: true, lane: "", grp: "r2" },
    // The same text under two rules stays two items.
    { id: 5, rule: "r3", laneKnown: true, lane: "same", grp: "g" },
    { id: 6, rule: "r4", laneKnown: true, lane: "same", grp: "g" },
    // Two lanes of one parallel rule never merge.
    { id: 7, rule: "r5", laneKnown: true, lane: "a", grp: "r5" },
    { id: 8, rule: "r5", laneKnown: true, lane: "b", grp: "r5" },
    // Without the hub's lane nothing is inferred from the title or the summary.
    { id: 9, rule: "r5", summary: "a", events: [{ subject: "a" }] },
  ]);
  assert.equal(grouped.length, 7);
  assert.deepEqual(
    grouped[0].runs.map((r) => r.id),
    [2, 1],
  );
  assert.equal(grouped[1].key, JSON.stringify(["item", "r2", ""]));
  assert.deepEqual(
    grouped[1].runs.map((r) => r.id),
    [4, 3],
  );
  assert.equal(grouped[2].key, JSON.stringify(["item", "r3", "same"]));
  assert.equal(grouped[3].key, JSON.stringify(["item", "r4", "same"]));
  assert.deepEqual(
    grouped[4].runs.map((r) => r.id),
    [7],
  );
  assert.deepEqual(
    grouped[5].runs.map((r) => r.id),
    [8],
  );
  assert.equal(grouped[6].key, "unlinked:9");
  assert.equal(grouped[6].known, false);
  assert.match(itemTitle(grouped[6]), /未关联的事项 \u00b7 任务 #9/);
  assert.match(itemNote(grouped[6]), /不按标题、事件文字或会话推断/);
  assert.equal(itemTitle(grouped[1]), "r2");
  // An empty lane says only that this round carries no object id; it never proves
  // the rule was configured without parallel.
  assert.match(itemNote(grouped[1]), /对象标识为空/);
  assert.match(itemNote(grouped[1]), /不推断/);
  assert.doesNotMatch(itemNote(grouped[1]), /未设 parallel/);
  assert.equal(itemTitle(grouped[2]), "same");
  assert.match(itemNote(grouped[2]), /跨规则不合并/);
});
test("future plans retain separate queued retries, center schedules and external plans sorted by actual date", () => {
  const plans = futurePlans({
    lines: [
      { name: "定时", next: "2026-11-08", every: "每天" },
      { name: "事件", next: null },
    ],
    runs: [
      {
        id: 1,
        rule: "恢复",
        state: "queued",
        attempts: 1,
        notBefore: "2026-11-07",
      },
      { id: 2, state: "done" },
    ],
    elsewhere: [{ name: "外部", next: "2026-11-09", where: "Claude" }],
  });
  assert.equal(plans.length, 3);
  assert.equal(plans[0].type, "等待重试");
  assert.equal(plans[1].type, "中心定时规则");
  assert.equal(plans[2].type, "外部计划");
});

test("laneOf takes only the authoritative lane row of that run and refuses anything else", () => {
  const facts = [
    {
      type: "claimNext",
      changes: [{ table: "runs", key: 5, row: { lane: "", grp: "g1" } }],
    },
    {
      type: "started",
      changes: [{ table: "runs", key: 6, row: { lane: 7, grp: "g" } }],
    },
    {
      type: "finish",
      changes: [{ table: "runs", key: 5, row: { lane: "late", grp: "g2" } }],
    },
  ];
  assert.deepEqual(laneOf(facts, 5), { lane: "late", grp: "g2" });
  assert.equal(laneOf(facts, 6), null);
  assert.equal(laneOf({ facts }, 5), null);
  assert.equal(laneOf(null, 5), null);
  assert.equal(
    laneOf(
      [{ changes: [{ table: "cards", key: 5, row: { lane: "card" } }] }],
      5,
    ),
    null,
  );
});
test("state carries the hub's lane once, marks unanswerable runs unlinked, and consumes no request twice", async (t) => {
  const counts = {};
  const url = await bridge(t, async (target) => {
    const u = String(target);
    const match = u.match(/\/v1\/runs\/(\d+)\/why/);
    if (!match)
      return Response.json({
        ...state,
        runs: [
          { id: 1, state: "done" },
          { id: 2, state: "queued" },
        ],
      });
    counts[match[1]] = (counts[match[1]] || 0) + 1;
    if (match[1] === "2") return new Response("no", { status: 500 });
    return Response.json([
      {
        type: "claimNext",
        changes: [{ table: "runs", key: 1, row: { lane: "", grp: "V2" } }],
      },
    ]);
  });
  const read = async () =>
    (await fetch(url + "/api/state")).json().then((data) => data.runs);
  const first = await read();
  assert.deepEqual(
    first.map((r) => [r.laneKnown, r.lane, r.grp]),
    [
      [true, "", "V2"],
      [false, null, null],
    ],
  );
  const second = await read();
  assert.deepEqual(
    second.map((r) => r.laneKnown),
    [true, false],
  );
  assert.equal(counts["1"], 1);
  assert.equal(counts["2"], 2);
});
test("healthz lists the enabled writes instead of claiming a read-only bridge", async (t) => {
  const url = await bridge(t);
  const body = await (await fetch(url + "/healthz")).json();
  assert.equal(body.app, "agent-loop-dashboard");
  assert.equal(body.version, "workflow-2");
  assert.deepEqual(body.writes, [
    "cards/answer",
    "cards/resolve",
    "runs/cancel",
  ]);
  assert.equal(body.readOnly, undefined);
});
test("consecutive heartbeats fold for reading while every fact survives in order", () => {
  const facts = [
    { seq: 1, type: "started", changes: [] },
    { seq: 2, type: "heartbeat", changes: [] },
    { seq: 3, type: "heartbeat", changes: [] },
    { seq: 4, type: "answer", changes: [] },
    { seq: 5, type: "heartbeat", changes: [] },
  ];
  const nodes = timelineNodes(facts);
  assert.deepEqual(
    nodes.map((n) =>
      n.kind === "heartbeat" ? "h" + n.facts.length : n.fact.seq,
    ),
    [1, "h2", 4, "h1"],
  );
  assert.deepEqual(
    nodes
      .flatMap((n) => (n.kind === "heartbeat" ? n.facts : [n.fact]))
      .map((f) => f.seq),
    [1, 2, 3, 4, 5],
  );
  assert.deepEqual(timelineNodes([]), []);
});
// Real heartbeats also carry the run row and may close an offline notice: those are
// transitions, not keepalive noise, and must stay visible as their own line.
test("only genuinely keepalive beats fold; card, state and session changes stay apart", () => {
  const facts = [
    {
      seq: 1,
      type: "started",
      changes: [
        {
          table: "runs",
          key: "7",
          row: { id: 7, state: "claimed", session: "s1" },
        },
      ],
    },
    {
      seq: 2,
      type: "heartbeat",
      changes: [
        {
          table: "seen",
          key: "worker:b",
          row: { seen_at: "2026-11-06T00:00:00Z" },
        },
        {
          table: "runs",
          key: "7",
          row: { id: 7, state: "claimed", session: "s1" },
        },
        { table: "due", key: "offline", row: { at: null } },
      ],
    },
    {
      seq: 3,
      type: "heartbeat",
      changes: [
        {
          table: "seen",
          key: "worker:b",
          row: { seen_at: "2026-11-06T00:01:00Z" },
        },
        {
          table: "runs",
          key: "7",
          row: { id: 7, state: "claimed", session: "s1" },
        },
      ],
    },
    {
      seq: 4,
      type: "heartbeat",
      changes: [
        {
          table: "cards",
          key: "8",
          row: { id: 8, state: "closed", title: "接单程序没连上" },
        },
      ],
    },
    {
      seq: 5,
      type: "heartbeat",
      changes: [
        {
          table: "runs",
          key: "7",
          row: { id: 7, state: "unknown", session: "s1" },
        },
      ],
    },
    {
      seq: 6,
      type: "heartbeat",
      changes: [
        {
          table: "runs",
          key: "7",
          row: { id: 7, state: "unknown", session: "s2" },
        },
      ],
    },
    { seq: 7, type: "heartbeat", changes: [] },
  ];
  const nodes = timelineNodes(facts);
  assert.deepEqual(
    nodes.map((n) =>
      n.kind === "heartbeat" ? "h" + n.facts.length : n.fact.seq,
    ),
    [1, "h2", 4, 5, 6, "h1"],
  );
  assert.deepEqual(
    nodes
      .flatMap((n) => (n.kind === "heartbeat" ? n.facts : [n.fact]))
      .map((f) => f.seq),
    [1, 2, 3, 4, 5, 6, 7],
  );
});
test("cancel wording follows the hub's state after the refresh, never the request", () => {
  assert.match(cancelNote(1, [], false), /没能刷新中心状态/);
  assert.match(cancelNote(1, [], true), /没有这轮/);
  // A confirmed cancel can follow a real run: no claim that it never started.
  assert.match(
    cancelNote(1, [{ id: 1, state: "cancelled" }]),
    /中心已确认这轮已取消/,
  );
  assert.doesNotMatch(
    cancelNote(1, [
      { id: 1, state: "cancelled", claimedAt: "2026-11-06T00:00:00Z" },
    ]),
    /不会开始执行|排队任务/,
  );
  assert.match(
    cancelNote(1, [{ id: 1, state: "claimed", stopping: true }]),
    /等待执行端确认停止/,
  );
  assert.match(
    cancelNote(1, [{ id: 1, state: "claimed", stopping: false }]),
    /中心没有记录取消请求/,
  );
  assert.match(cancelNote(1, [{ id: 1, state: "unknown" }]), /不接受取消/);
  assert.match(cancelNote(1, [{ id: 1, state: "done" }]), /已经结束/);
});
// The confirmation may only rest on a read that succeeded for this request. A read
// skipped while another runs, or one that failed, leaves the older snapshot unusable.
test("a skipped or failed read cannot confirm a cancel from the older snapshot", () => {
  const older = [
    { id: 97, state: "claimed", stopping: false },
    { id: 7, state: "cancelled" },
  ];
  const skipped = cancelNote(7, older, false);
  assert.match(skipped, /没能刷新中心状态/);
  assert.match(skipped, /无法确认结果/);
  assert.doesNotMatch(skipped, /中心已确认这轮已取消/);
  // Reading an older page afterwards is a different read: it never revisits this record.
  assert.equal(cancelNote(7, older, false), skipped);
});
// The submit handler must freeze the latest read's outcome before any restore of the
// older page, so a later successful read cannot turn an unconfirmed cancel into a
// confirmed one, and a skipped read cannot borrow the previous snapshot.
test("cancel wording is decided by that read's own result, before any page restore", () => {
  const source = readFileSync(
    new URL("./public/app.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /if \(inFlight\) return false;/);
  assert.match(source, /\n    return true;\n  } catch \{/);
  assert.match(source, /\n    return false;\n  } finally \{/);
  const at = source.indexOf("const latestOk = await refresh(null);");
  const restore = source.indexOf(
    "if (keptCursor !== null) await refresh(keptCursor);",
    at,
  );
  assert(at > 0 && restore > at);
  assert.match(
    source.slice(at, restore),
    /const confirmed = latestOk \? latest : null;/,
  );
  assert.match(
    source.slice(restore, restore + 400),
    /cancelNote\(cancelId, confirmed\?\.runs \?\? \[\], latestOk\)/,
  );
});
