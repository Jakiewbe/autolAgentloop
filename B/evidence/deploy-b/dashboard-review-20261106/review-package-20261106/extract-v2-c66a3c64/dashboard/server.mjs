import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const assets = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/workflow.mjs", ["workflow.mjs", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
]);
const pick = (value, keys) =>
  Object.fromEntries(
    keys.filter((k) => value?.[k] !== undefined).map((k) => [k, value[k]]),
  );
const countKeys = [
  "running",
  "queued",
  "retrying",
  "unknown",
  "done",
  "doneToday",
  "nothing",
  "attention",
];
const usageKeys = ["input", "output", "cached", "cost"];
const totals = (value) => ({
  ...pick(value, countKeys),
  usage: pick(value?.usage, usageKeys),
});
const usage = (value) =>
  value === null || value === undefined ? null : pick(value, usageKeys);
const card = (value) =>
  pick(value, [
    "id",
    "version",
    "kind",
    "state",
    "title",
    "text",
    "options",
    "recommend",
    "choice",
    "answer",
    "result",
    "rule",
    "createdAt",
    "decidedAt",
    "closedAt",
  ]);

export function projectState(state) {
  if (
    !state ||
    !Number.isFinite(Date.parse(state.now)) ||
    !state.totals ||
    !Array.isArray(state.runs) ||
    !Array.isArray(state.agents) ||
    !Array.isArray(state.cards)
  ) {
    throw Error("Invalid upstream state");
  }
  const spending = (period) =>
    period
      ? pick(period, [
          "rounds",
          "tokens",
          "cost",
          "missingTokens",
          "missingCost",
        ])
      : null;
  return {
    now: state.now,
    timezone: state.timezone,
    totals: totals(state.totals),
    spending: {
      today: spending(state.spending?.today),
      week: spending(state.spending?.week),
    },
    agents: state.agents.map((a) => ({
      ...pick(a, ["id", "name", "use", "worker", "seenAt", "online"]),
      totals: totals(a.totals),
    })),
    runs: state.runs.map((r) => ({
      ...pick(r, [
        "id",
        "rule",
        "agent",
        "state",
        "attempts",
        "createdAt",
        "claimedAt",
        "finishedAt",
        "notBefore",
        "summary",
        "error",
        "session",
        "stopping",
      ]),
      usage: usage(r.usage),
      events: (r.events ?? []).map((e) =>
        pick(e, ["source", "type", "subject", "summary"]),
      ),
    })),
    cards: state.cards.map(card),
    recentCards: (state.recentCards ?? []).map(card),
    sources: (state.sources ?? []).map((s) =>
      pick(s, ["id", "name", "events"]),
    ),
    channels: (state.channels ?? []).map((c) =>
      pick(c, ["id", "name", "online", "seenAt"]),
    ),
    lines: (state.lines ?? []).map((l) => ({
      ...pick(l, [
        "id",
        "name",
        "group",
        "agent",
        "source",
        "types",
        "every",
        "next",
      ]),
      totals: totals(l.totals),
    })),
    elsewhere: (state.elsewhere ?? []).map((p) =>
      pick(p, [
        "id",
        "name",
        "source",
        "agent",
        "cron",
        "every",
        "next",
        "where",
      ]),
    ),
    unrouted: (state.unrouted ?? []).map((e) =>
      pick(e, ["id", "source", "type", "subject", "summary", "received_at"]),
    ),
    hasMore: state.hasMore === true,
    nextBefore: state.nextBefore ?? null,
  };
}

// A why response includes old full configuration rows. Never forward these rows wholesale.
export function projectWhy(facts, runId) {
  if (!Array.isArray(facts) || facts.some((f) => !Array.isArray(f.changes)))
    throw Error("Invalid upstream history");
  const columns = {
    events: ["id", "source", "type", "subject", "summary", "received_at"],
    runs: [
      "id",
      "rule",
      "agent",
      "state",
      "attempts",
      "created_at",
      "claimed_at",
      "finished_at",
      "not_before",
      "summary",
      "error",
      "session",
      "resume",
      "cancel_at",
      "rules_version",
      "lane",
      "grp",
    ],
    cards: [
      "id",
      "run_id",
      "rule",
      "kind",
      "state",
      "title",
      "text",
      "options",
      "choice",
      "answer",
      "result",
      "answer_event",
      "created_at",
      "decided_at",
      "closed_at",
    ],
    timers: ["id", "rule", "key", "about", "at", "event_id"],
  };
  return facts.flatMap((fact) => {
    const changes = fact.changes.flatMap((change) => {
      if (change.table === "config")
        return [
          {
            table: "config",
            key: change.key,
            row: pick(change.row, ["version"]),
          },
        ];
      if (
        !columns[change.table] ||
        (change.table === "runs" && String(change.key) !== String(runId))
      )
        return [];
      return [
        {
          table: change.table,
          key: change.key,
          row:
            change.row === null
              ? null
              : pick(change.row, columns[change.table]),
        },
      ];
    });
    return changes.length
      ? [{ seq: fact.seq, at: fact.at, type: fact.type, changes }]
      : [];
  });
}

// A run's lane is fixed when the hub creates it, so one history read per run is enough.
// Only the two attribution columns are kept; every other column stays server-side.
export function laneOf(facts, id) {
  if (!Array.isArray(facts)) return null;
  const rows = facts
    .flatMap((fact) => (Array.isArray(fact?.changes) ? fact.changes : []))
    .filter(
      (change) =>
        change?.table === "runs" &&
        String(change.key) === String(id) &&
        change.row &&
        typeof change.row.lane === "string",
    );
  const row = rows[rows.length - 1]?.row;
  if (!row) return null;
  return {
    lane: row.lane.slice(0, 200),
    grp: typeof row.grp === "string" ? row.grp.slice(0, 200) : "",
  };
}

export function createDashboard({
  owner,
  hubUrl = "http://127.0.0.1:3350",
  fetchImpl = fetch,
} = {}) {
  if (typeof owner !== "string" || !owner)
    throw Error("未找到本人访问凭据，请检查现有中心配置。");
  const hub = new URL("/v1/state", hubUrl);
  const lanes = new Map();
  const readLane = async (id) => {
    try {
      const response = await fetchImpl(new URL(`/v1/runs/${id}/why`, hub), {
        headers: { Authorization: `Bearer ${owner}` },
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) return null;
      return laneOf(await response.json(), id);
    } catch {
      return null;
    }
  };
  // Only runs whose lane the hub has not answered yet cost a history read; the answer never changes.
  const attachLanes = async (runs) => {
    const queue = runs.filter((run) => !lanes.has(run.id));
    const drain = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        const found = await readLane(next.id);
        if (!found) continue;
        if (lanes.size >= 5000) lanes.delete(lanes.keys().next().value);
        lanes.set(next.id, found);
      }
    };
    await Promise.all([drain(), drain(), drain(), drain(), drain(), drain()]);
    for (const run of runs) {
      const found = lanes.get(run.id);
      run.laneKnown = Boolean(found);
      run.lane = found ? found.lane : null;
      run.grp = found ? found.grp : null;
    }
  };
  return createServer(async (request, response) => {
    const authority = request.headers.host;
    const allowed = [
      `127.0.0.1:${request.socket.localPort}`,
      `localhost:${request.socket.localPort}`,
    ];
    const headers = {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    };
    const send = (status, type, body) => {
      response.writeHead(status, { ...headers, "Content-Type": type });
      response.end(body);
    };
    if (!allowed.includes(authority))
      return send(403, "text/plain", "Forbidden");
    const url = new URL(request.url, `http://${authority}`);
    if (
      url.pathname.startsWith("/api/") &&
      ((request.headers.origin && request.headers.origin !== url.origin) ||
        request.headers["sec-fetch-site"] === "cross-site")
    )
      return send(403, "text/plain", "Forbidden");
    const runHistory = /^\/api\/runs\/([1-9]\d{0,12})\/why$/.exec(url.pathname);
    const action =
      /^\/api\/(cards|runs)\/([1-9]\d{0,12})\/(answer|resolve|cancel)$/.exec(
        url.pathname,
      );
    if (
      request.method === "POST" &&
      action &&
      ((action[1] === "cards" && action[3] !== "cancel") ||
        (action[1] === "runs" && action[3] === "cancel"))
    ) {
      if (request.headers.origin !== url.origin)
        return send(403, "text/plain", "Forbidden");
      if (
        url.search ||
        request.headers["content-type"]?.split(";")[0] !== "application/json"
      )
        return send(
          400,
          "application/json",
          JSON.stringify({ error: "请使用同源 JSON 请求。" }),
        );
      let body;
      try {
        const chunks = [];
        let length = 0;
        for await (const chunk of request) {
          length += chunk.length;
          if (length > 16384) {
            send(
              413,
              "application/json",
              JSON.stringify({ error: "提交内容过长。" }),
            );
            return;
          }
          chunks.push(chunk);
        }
        body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!body || Array.isArray(body) || typeof body !== "object")
          throw Error("object required");
        const keys = Object.keys(body);
        const valid =
          action[3] === "cancel"
            ? keys.length === 0
            : action[3] === "resolve"
              ? keys.length === 1 &&
                typeof body.reason === "string" &&
                !!body.reason.trim() &&
                body.reason.length <= 1000
              : keys.length === 1 &&
                ((keys[0] === "choice" &&
                  Number.isInteger(body.choice) &&
                  body.choice >= 0 &&
                  body.choice < 1000) ||
                  (keys[0] === "text" &&
                    typeof body.text === "string" &&
                    !!body.text.trim() &&
                    body.text.length <= 10000));
        if (!valid) throw Error("invalid action");
      } catch {
        return send(
          400,
          "application/json",
          JSON.stringify({ error: "提交内容不正确，未发起操作。" }),
        );
      }
      try {
        const upstream = await fetchImpl(
          new URL(`/v1/${action[1]}/${action[2]}/${action[3]}`, hub),
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${owner}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(8000),
          },
        );
        if (!upstream.ok)
          return send(
            [400, 404, 409].includes(upstream.status) ? upstream.status : 502,
            "application/json",
            JSON.stringify({ error: "中心未接受操作。请刷新核对当前状态。" }),
          );
        const result = await upstream.json();
        if (
          !result ||
          typeof result !== "object" ||
          Array.isArray(result) ||
          (action[3] === "cancel"
            ? result.ok !== true
            : typeof result.changed !== "boolean")
        )
          throw Error("invalid action response");
        return send(
          200,
          "application/json",
          JSON.stringify(pick(result, ["ok", "changed", "state"])).replaceAll(
            owner,
            "[已隐藏]",
          ),
        );
      } catch {
        return send(
          502,
          "application/json",
          JSON.stringify({
            error: "未确认操作结果。请刷新核对，不要直接重复提交。",
          }),
        );
      }
    }
    if (request.method !== "GET")
      return send(405, "text/plain", "Method not allowed");
    if (runHistory) {
      if (url.search) return send(400, "text/plain", "Invalid query");
      try {
        const upstream = await fetchImpl(
          new URL(`/v1/runs/${runHistory[1]}/why`, hub),
          {
            headers: { Authorization: `Bearer ${owner}` },
            signal: AbortSignal.timeout(8000),
          },
        );
        if (!upstream.ok)
          return send(
            upstream.status === 404 ? 404 : 502,
            "application/json",
            JSON.stringify({ error: "无法读取这轮的事实记录。" }),
          );
        const facts = projectWhy(await upstream.json(), runHistory[1]);
        return send(
          200,
          "application/json; charset=utf-8",
          JSON.stringify({ facts }).replaceAll(owner, "[已隐藏]"),
        );
      } catch {
        return send(
          502,
          "application/json",
          JSON.stringify({ error: "暂时无法读取时间线，请重新打开详情。" }),
        );
      }
    }
    if (url.pathname === "/healthz")
      return send(
        200,
        "application/json",
        JSON.stringify({
          app: "agent-loop-dashboard",
          version: "workflow-2",
          writes: ["cards/answer", "cards/resolve", "runs/cancel"],
        }),
      );
    if (url.pathname === "/api/state") {
      if (
        (request.headers.origin && request.headers.origin !== url.origin) ||
        request.headers["sec-fetch-site"] === "cross-site"
      ) {
        return send(403, "text/plain", "Forbidden");
      }
      const cursor = url.searchParams.get("before");
      if (
        [...url.searchParams.keys()].some((k) => k !== "before") ||
        url.searchParams.getAll("before").length > 1 ||
        (cursor !== null && !/^[1-9]\d{0,12}$/.test(cursor))
      ) {
        return send(
          400,
          "application/json",
          JSON.stringify({ error: "历史页参数不正确。" }),
        );
      }
      try {
        const target = new URL(hub);
        if (cursor) target.searchParams.set("before", cursor);
        const upstream = await fetchImpl(target, {
          headers: { Authorization: `Bearer ${owner}` },
          signal: AbortSignal.timeout(8000),
        });
        if (!upstream.ok) throw Error("Upstream unavailable");
        const data = projectState(await upstream.json());
        await attachLanes(data.runs);
        // The credential is server-only, even if it is echoed in upstream free text.
        const json = JSON.stringify(data).replaceAll(owner, "[已隐藏]");
        return send(200, "application/json; charset=utf-8", json);
      } catch {
        return send(
          502,
          "application/json; charset=utf-8",
          JSON.stringify({
            error: "暂时无法读取中心，请检查中心是否仍在运行。",
          }),
        );
      }
    }
    const asset = assets.get(url.pathname);
    if (!asset) return send(404, "text/plain", "Not found");
    try {
      return send(
        200,
        asset[1],
        await readFile(join(ROOT, "public", asset[0])),
      );
    } catch {
      return send(500, "text/plain", "面板文件缺失。");
    }
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const config = JSON.parse(
    (
      await readFile(join(homedir(), ".agent-autoloop", "config.json"), "utf8")
    ).replace(/^\uFEFF/, ""),
  );
  const server = createDashboard({ owner: config.owner });
  server.on("error", (error) => {
    console.error(
      error.code === "EADDRINUSE"
        ? "3351端口已被占用，请检查是否已经启动面板。"
        : "面板无法启动。",
    );
    process.exitCode = 1;
  });
  server.listen(3351, "127.0.0.1", () =>
    console.log("Agent Loop 面板：http://127.0.0.1:3351"),
  );
}
