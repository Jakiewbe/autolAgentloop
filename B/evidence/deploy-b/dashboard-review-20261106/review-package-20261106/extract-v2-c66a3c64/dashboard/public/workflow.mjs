// The hub's unit of work is a rule plus a lane, never a title, a subject or a session.
// A run only belongs to an item when the hub's own history said so; the server forwards that lane.
export const stateLabels = {
  done: "已完成",
  nothing: "无需处理",
  failed: "失败",
  cancelled: "已取消",
  claimed: "运行中",
  queued: "待执行",
  unknown: "状态待确认",
};

const runId = (run) => Number(run?.id);

export function groupItems(runs) {
  const groups = new Map();
  for (const run of runs ?? []) {
    // laneKnown is set by the dashboard server from the run's own history fact.
    // An empty lane is authoritative too: the rule was not split per object.
    const known = run?.laneKnown === true && typeof run.lane === "string";
    const key = known
      ? JSON.stringify(["item", run.rule ?? "", run.lane])
      : "unlinked:" + runId(run);
    if (!groups.has(key))
      groups.set(key, {
        key,
        known,
        rule: known ? (run.rule ?? "") : null,
        lane: known ? run.lane : null,
        grp: known ? (run.grp ?? null) : null,
        runs: [],
      });
    groups.get(key).runs.push(run);
  }
  return [...groups.values()].map((group) => ({
    ...group,
    runs: group.runs.sort((a, b) => runId(b) - runId(a)),
  }));
}

export function itemTitle(group) {
  if (!group?.known)
    return "未关联的事项 · 任务 #" + (group?.runs?.[0]?.id ?? "?");
  if (group.lane) return group.lane;
  return group.rule || "未命名规则";
}

export function itemNote(group) {
  if (!group?.known)
    return "中心历史里没有这轮的权威归属（规则 + 对象），这里不按标题、事件文字或会话推断。";
  if (group.lane)
    return (
      "规则「" +
      group.rule +
      "」下的对象 " +
      group.lane +
      "：同规则同对象的多轮收在这里，跨规则不合并。"
    );
  return (
    "规则「" +
    group.rule +
    "」下这些轮次的对象标识为空；这里只按中心给出的规则 + 对象归组，不推断这条规则是否配过 parallel，也不倒推历史规则。"
  );
}

// Consecutive pure keepalive beats are folded for reading; every fact stays, in order, one click away.
// A heartbeat that closes an offline notice, changes a run's state or switches its session is a
// real transition and stays on its own line: the hub writes those through heartbeat facts too.
export function timelineNodes(facts) {
  const nodes = [];
  const seen = new Map();
  for (const fact of facts ?? []) {
    if (!fact) continue;
    let keepalive = fact.type === "heartbeat";
    for (const change of Array.isArray(fact.changes) ? fact.changes : []) {
      if (!change) continue;
      if (change.table === "cards") keepalive = false;
      if (change.table !== "runs") continue;
      const row = change.row ?? {};
      const id = String(change.key);
      const before = seen.get(id) ?? {};
      if (
        before.state !== undefined &&
        row.state !== undefined &&
        row.state !== before.state
      )
        keepalive = false;
      if (
        before.session !== undefined &&
        row.session !== undefined &&
        row.session !== before.session
      )
        keepalive = false;
      seen.set(id, {
        state: row.state !== undefined ? row.state : before.state,
        session: row.session !== undefined ? row.session : before.session,
      });
    }
    const last = nodes[nodes.length - 1];
    if (keepalive) {
      if (last && last.kind === "heartbeat") last.facts.push(fact);
      else nodes.push({ kind: "heartbeat", facts: [fact] });
    } else nodes.push({ kind: "fact", fact });
  }
  return nodes;
}

export function cancelNote(id, runs, refreshed = true) {
  if (!refreshed)
    return "已提交取消请求，但没能刷新中心状态，无法确认结果；请稍后刷新核对，不要重复提交。";
  const run = (runs ?? []).find((r) => runId(r) === Number(id));
  if (!run) return "已提交取消请求；当前加载的记录里没有这轮，请回到最新核对。";
  if (run.state === "cancelled")
    return "中心已确认这轮已取消。是否曾经开始执行，请看这轮的执行时间线；面板不据此推断。";
  if (run.state === "claimed")
    return run.stopping
      ? "取消请求已记录，等待执行端确认停止；确认前不能视作已经停止。"
      : "中心没有记录取消请求，请刷新核对当前状态，不要直接重复提交。";
  if (run.state === "unknown")
    return "状态待确认的轮次中心不接受取消；面板不提供伪造的停止入口。";
  return (
    "中心当前登记为「" +
    (stateLabels[run.state] || run.state) +
    "」，这轮已经结束，不再接受取消。"
  );
}

export function futurePlans(data) {
  const plans = [
    ...data.lines
      .filter((line) => line.next)
      .map((line) => ({
        type: "中心定时规则",
        name: line.name,
        agent: line.agent,
        at: line.next,
        note: line.every,
      })),
    ...data.runs
      .filter((run) => run.state === "queued")
      .map((run) => ({
        type: run.attempts > 0 ? "等待重试" : "等待执行",
        name: run.rule,
        agent: run.agent,
        at: run.notBefore || null,
        run: run.id,
        note:
          run.attempts > 0
            ? "已排队重试 " + run.attempts + " 次"
            : "等待可用执行端",
      })),
    ...(data.elsewhere ?? []).map((plan) => ({
      type: "外部计划",
      name: plan.name,
      agent: plan.agent,
      at: plan.next,
      note:
        (plan.every || plan.cron || "") +
        " · " +
        (plan.where || "在其他应用运行"),
    })),
  ];
  return plans.sort(
    (a, b) => (Date.parse(a.at) || Infinity) - (Date.parse(b.at) || Infinity),
  );
}
