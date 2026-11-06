import {
  groupItems,
  futurePlans,
  timelineNodes,
  cancelNote,
  itemTitle,
  itemNote,
  stateLabels,
} from "/workflow.mjs";
const icons = {
  overview:
    '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  tasks: '<path d="M8 5h12M8 12h12M8 19h12M3 5h.01M3 12h.01M3 19h.01"/>',
  server:
    '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01M11 6.5h6M11 17.5h6"/>',
  inbox: '<path d="M5 4h14l3 12v4H2v-4L5 4Z"/><path d="M2 15h6l2 3h4l2-3h6"/>',
  workflow:
    '<rect x="8" y="2" width="8" height="5" rx="1"/><rect x="2" y="17" width="8" height="5" rx="1"/><rect x="14" y="17" width="8" height="5" rx="1"/><path d="M12 7v5M6 17v-5h12v5"/>',
  refresh:
    '<path d="M20 8a8 8 0 0 0-13-3L3 9m0-6v6h6M4 16a8 8 0 0 0 13 3l4-4m0 6v-6h-6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  activity: '<path d="M2 12h5l3-8 4 16 3-8h5"/>',
  usage: '<path d="m12 2 9 5-9 5-9-5 9-5Zm-9 10 9 5 9-5M3 17l9 5 9-5"/>',
};
const icon = (name) =>
  `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.tasks}</svg>`;
document
  .querySelectorAll("[data-icon]")
  .forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
const $ = (selector) => document.querySelector(selector);
const escape = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const number = (value) =>
  Number.isFinite(value) ? value.toLocaleString("zh-CN") : "—";
const compact = (value) =>
  !Number.isFinite(value)
    ? "—"
    : value >= 1e6
      ? `${(value / 1e6).toFixed(1)}M`
      : value >= 1e3
        ? `${(value / 1e3).toFixed(1)}K`
        : String(value);
const tokenCount = (usage) =>
  Number.isFinite(usage?.input) && Number.isFinite(usage?.output)
    ? usage.input + usage.output
    : null;
const names = {
  overview: ["运行总览", "任务、执行端与待办，一处查看。"],
  runs: ["任务记录", "查看执行结果、会话和每一次真实用量。"],
  workers: ["执行端", "查看每台机器的连接与任务状态。"],
  attention: ["决策中心", "回答问题、查看处理进度，保留每一次决定。"],
  items: ["事项工作台", "沿着同一件事，查看多轮执行与结果。"],
  plans: ["后续计划", "查看何时开始、由谁执行，以及哪些计划在其他应用运行。"],
  connections: ["规则与连接", "查看事件从哪里来，以及交给谁处理。"],
};
const labels = stateLabels;
let data = null,
  page = null,
  latest = null,
  currentView = names[location.hash.slice(1)]
    ? location.hash.slice(1)
    : "overview";
let auto = true,
  inFlight = false,
  filter = "",
  agentFilter = "",
  search = "",
  cursor = null,
  historyLeft = false;
const dialog = $("#run-detail");

function time(value, full = false) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: data?.timezone || "Asia/Shanghai",
    ...(full ? { month: "2-digit", day: "2-digit" } : {}),
    hour: "2-digit",
    minute: "2-digit",
    ...(full ? { second: "2-digit" } : {}),
    hour12: false,
  }).format(new Date(value));
}
function ago(value) {
  if (!value) return "尚无心跳";
  const seconds = Math.max(
    0,
    Math.floor((Date.parse(data.now) - Date.parse(value)) / 1000),
  );
  return seconds < 60
    ? `${seconds} 秒前`
    : seconds < 3600
      ? `${Math.floor(seconds / 60)} 分钟前`
      : `${Math.floor(seconds / 3600)} 小时前`;
}
function duration(run) {
  if (!run.claimedAt) return "未记录";
  const seconds = Math.max(
    0,
    Math.round(
      (Date.parse(run.finishedAt || data.now) - Date.parse(run.claimedAt)) /
        1000,
    ),
  );
  return seconds < 60
    ? `${seconds} 秒`
    : `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`;
}
const agentName = (id) =>
  data.agents.find((a) => a.id === id)?.name || id || "—";
const badge = (run) =>
  `<span class="badge ${escape(run.state)}">${run.stopping && ["claimed", "unknown"].includes(run.state) ? "等待停止确认" : labels[run.state] || escape(run.state)}</span>`;
function machines() {
  const groups = new Map();
  data.agents.forEach((a) => {
    const key = a.worker || a.id;
    if (!groups.has(key))
      groups.set(key, {
        id: key,
        agents: [],
        online: a.online,
        seenAt: a.seenAt,
      });
    groups.get(key).agents.push(a);
  });
  return [...groups.values()].map((m, i) => ({
    ...m,
    letter: String.fromCharCode(65 + i),
    name:
      m.id === "b-magicbook14"
        ? "MagicBook 14"
        : m.id === "desktop-lm7rki1"
          ? "本机 Desktop"
          : m.id,
  }));
}
function empty(title, text, name = "inbox") {
  return `<div class="empty"><div class="empty-icon">${icon(name)}</div><strong>${escape(title)}</strong><p>${escape(text)}</p></div>`;
}
function machine(m, detailed = false) {
  const running = m.agents.reduce((n, a) => n + (a.totals.running || 0), 0);
  return `<article class="machine"><div class="machine-head"><span class="machine-letter">${m.letter}</span><div><div class="machine-name">${escape(m.name)}</div><div class="machine-id">${escape(m.id)}</div></div><span class="presence ${m.online ? "" : "offline"}"><span class="status-dot"></span>${m.online ? "在线" : "离线"}</span></div><div class="machine-bottom"><span>${m.agents.length} 个 Agent · <span class="machine-count">${running ? running + " 项运行中" : "空闲"}</span></span><span>心跳 ${ago(m.seenAt)}</span></div>${detailed ? `<div class="device-detail">${m.agents.map((a) => `<div class="device-agent"><span class="agent-square">${icon("activity")}</span><div>${escape(a.name)}<small>${escape(a.id)} · ${escape(a.use)}</small></div><span class="right">${number(a.totals.done)} 已完成</span></div>`).join("")}</div>` : ""}</article>`;
}

function taskTable(runs) {
  if (!runs.length)
    return empty("没有匹配的任务", "试试调整搜索词或筛选条件。", "search");
  return `<div class="table-wrap"><table><thead><tr><th>任务</th><th>执行 Agent</th><th>状态</th><th>用时</th><th>用量</th><th>更新时间</th><th></th></tr></thead><tbody>${runs.map((r) => `<tr class="task-row"><td><button class="task-open" data-run="${r.id}" aria-label="查看任务 ${r.id}"><span class="task-name">${escape(r.summary || r.rule || "未命名任务")}</span><span class="task-id">#${r.id} · ${escape(r.rule)}</span></button></td><td><span class="agent-label"><span class="agent-square">${escape(agentName(r.agent).slice(0, 1))}</span>${escape(agentName(r.agent))}</span></td><td>${badge(r)}</td><td class="mono">${duration(r)}</td><td class="mono">${tokenCount(r.usage) !== null ? compact(tokenCount(r.usage)) : '<span class="usage-sub">未上报</span>'}${tokenCount(r.usage) !== null ? '<span class="usage-sub">Tokens</span>' : ""}</td><td class="mono">${time(r.finishedAt || r.claimedAt || r.createdAt, true)}</td><td class="chevron">›</td></tr>`).join("")}</tbody></table></div>`;
}

function overview() {
  const active = data.runs.filter((r) =>
    ["claimed", "unknown"].includes(r.state),
  );
  const plans = futurePlans(data);
  const week = data.spending.week;
  return `<section class="work-focus"><div class="work-focus-copy"><div class="eyebrow">YOUR WORK, IN MOTION</div><h2>今天的工作</h2><p>${data.cards.length ? `有 ${data.cards.length} 个决定等你处理。` : "当前没有等待你的决定。"} ${active.length ? `${active.length} 轮正在推进或等待确认。` : data.totals.queued ? `${data.totals.queued} 轮等待执行。` : "当前没有运行或排队任务。"}</p></div><button class="button" data-nav="attention">进入决策中心 ${icon("arrow")}</button></section>
  <div class="work-columns"><section><div class="section-heading"><h2 class="section-title">等待我决定 <small>${data.cards.length}</small></h2><button class="text-button" data-nav="attention">全部 →</button></div>${
    data.cards.length
      ? data.cards
          .slice(0, 3)
          .map(
            (c) =>
              `<button class="focus-row" data-open-card="${c.id}"><span class="agent-square">${icon("inbox")}</span><span><strong>${escape(c.title)}</strong><small>#${c.id} · ${escape(c.rule || "中心通知")}</small></span><span>›</span></button>`,
          )
          .join("")
      : empty("暂时不用你做决定", "有新的提问会出现在这里。", "check")
  }</section>
  <section><div class="section-heading"><h2 class="section-title">正在推进 <small>${active.length}</small></h2><button class="text-button" data-nav="runs">执行记录 →</button></div>${
    active.length
      ? active
          .slice(0, 4)
          .map(
            (r) =>
              `<button class="focus-row" data-run="${r.id}"><span class="agent-square">${icon("activity")}</span><span><strong>${escape(r.rule)}</strong><small>#${r.id} · ${escape(agentName(r.agent))}</small></span>${badge(r)}</button>`,
          )
          .join("")
      : empty(
          "没有运行中的任务",
          "新任务到达后会显示领取与执行进度。",
          "activity",
        )
  }</section>
  <section><div class="section-heading"><h2 class="section-title">接下来 <small>${plans.length}</small></h2><button class="text-button" data-nav="plans">计划 →</button></div>${plans.length ? plans.slice(0, 4).map(planRow).join("") : empty("暂无已登记计划", "事件触发规则会在新事件到达时执行。", "clock")}</section></div>
  <section class="recent-section"><div class="recent-heading"><h2 class="section-title">最近推进<small>当前加载 ${data.runs.length} 轮</small></h2><button class="text-button" data-nav="items">按事项查看 →</button></div>${taskTable(data.runs.slice(0, 5))}</section>
  <div class="workspace-footnote"><span>${machines().filter((m) => m.online).length} / ${machines().length} 台机器在线 · ${data.agents.length} 个 Agent</span><span>今日已报 ${compact(data.spending.today?.tokens)} Tokens · 最近7天 ${compact(week?.tokens)}${week?.missingTokens ? `（${week.missingTokens} 轮缺报）` : ""}</span><button class="text-button" data-nav="workers">执行端状态 →</button></div>`;
}

function planRow(p) {
  return `<div class="plan-row"><div class="plan-time">${p.at ? time(p.at, true) : "时间未登记"}</div><div><strong>${escape(p.name || "未命名计划")}</strong><small>${escape(p.type)} · ${escape(agentName(p.agent))}${p.note ? ` · ${escape(p.note)}` : ""}</small></div>${p.run ? `<button class="text-button" data-run="${p.run}">#${p.run} →</button>` : ""}</div>`;
}
function plansView() {
  const plans = futurePlans(data);
  return `<section class="list-section"><div class="section-heading"><h2 class="section-title">已登记的后续安排</h2><span class="tag">${plans.length} 项</span></div><p class="soft-note">时间采用中心时区 ${escape(data.timezone)}。定时规则给出下次触发时间；排队任务的最早执行时间不保证准点。</p>${plans.length ? plans.map(planRow).join("") : empty("暂无定时或排队计划", "当前规则可能都由事件触发，不会编造下一次运行时间。", "clock")}</section><section class="list-section"><h2 class="section-title">按事件触发</h2>${
    data.lines
      .filter((l) => !l.next)
      .map(
        (l) =>
          `<div class="connection-row"><div>${escape(l.name)}<small>${escape(l.source)} · ${escape((l.types || []).join("、"))}</small></div><span class="right">事件到达后执行</span></div>`,
      )
      .join("") || '<p class="soft-note">暂无事件规则。</p>'
  }<p class="soft-note">范围：已加载的排队任务、中心定时规则及 elsewhere 外部登记。Agent 的 later 定时器未由当前状态接口统一列出；不在此页推测其全量。外部计划由对应应用执行，中心不代为启动。</p></section>`;
}
function itemCard(g) {
  return `<article class="item-group"><header><div><small>${escape(g.known ? "规则 " + g.rule : "缺权威归属")}</small><h2>${escape(itemTitle(g))}</h2></div><span class="tag">${g.runs.length} 轮</span></header><p class="soft-note">${escape(itemNote(g))}</p>${g.runs.map((r) => `<button class="focus-row" data-run="${r.id}"><span class="item-step">#${r.id}</span><span><strong>${escape(r.summary || r.rule)}</strong><small>${escape(r.rule)} · ${time(r.finishedAt || r.createdAt, true)}</small></span>${badge(r)}</button>`).join("")}</article>`;
}
function itemsView() {
  const groups = groupItems(data.runs).sort(
    (a, b) => Number(b.known) - Number(a.known),
  );
  const linked = groups.filter((g) => g.known).length;
  const unlinked = groups.length - linked;
  return `<p class="soft-note">事项按中心自己的归属关联：同一条规则 + 同一个对象（lane）算一件事。事件文字、标题、会话编号都不参与判断；跨规则不合并。</p><p class="soft-note">仅覆盖当前已加载 ${data.runs.length} 轮：${linked} 个事项${unlinked ? `，另有 ${unlinked} 轮没有权威归属，单独列在最后` : ""}。</p><section class="item-list">${groups.map(itemCard).join("") || empty("还没有事项", "新事件产生执行记录后会在此关联展示。")}</section>`;
}

function runsView() {
  const visible = data.runs.filter(
    (r) =>
      (!filter ||
        (filter === "attention"
          ? ["failed", "unknown"].includes(r.state)
          : r.state === filter)) &&
      (!agentFilter || r.agent === agentFilter) &&
      (!search ||
        `${r.id} ${r.rule} ${r.summary} ${r.error} ${agentName(r.agent)}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  return `<div class="filters"><label class="search">${icon("search")}<input id="task-search" type="search" placeholder="搜索任务、编号或结果…" value="${escape(search)}" aria-label="搜索任务"></label><select id="state-filter" aria-label="筛选任务状态">${[
    ["", "全部状态"],
    ["claimed", "运行中"],
    ["done", "已完成"],
    ["attention", "失败 / 待确认"],
    ["queued", "待执行"],
    ["cancelled", "已取消"],
  ]
    .map(
      ([v, t]) =>
        `<option value="${v}" ${filter === v ? "selected" : ""}>${t}</option>`,
    )
    .join(
      "",
    )}</select><select id="agent-filter" aria-label="筛选执行 Agent"><option value="">全部 Agent</option>${data.agents.map((a) => `<option value="${escape(a.id)}" ${agentFilter === a.id ? "selected" : ""}>${escape(a.name)}</option>`).join("")}</select><span class="filter-count">当前页 ${visible.length} / ${data.runs.length} 条</span></div><div id="filtered-table">${taskTable(visible)}</div><div class="table-footer"><span>筛选仅作用于当前已加载记录${cursor ? " · 正在查看较早历史" : ""}</span><div>${cursor ? '<button class="text-button" id="latest-page">返回最新</button>' : ""}${data.hasMore ? '<button class="button" id="older-page">更早记录 →</button>' : ""}</div></div>`;
}

const cardState = (state) =>
  ({
    open: "等待回答",
    decided: "已回答 · 等待后续",
    done: "后续已完成",
    closed: "已结案",
  })[state] || state;
function resultText(c) {
  if (c.result) return c.result;
  if (c.state === "decided")
    return "中心尚未收到后续结果。这只说明现在没有结果，不保证后面一定会执行，也不表示要永远等下去。";
  if (c.state === "closed")
    return "已关闭（仅告知或已结案），没有处理结果记录；面板不补写未发生过的处理。";
  return "尚未记录后续结果";
}
function decisionCard(c, history = false) {
  const choice = Number.isInteger(c.choice) ? c.options?.[c.choice] : c.answer;
  return `<article class="attention-card"><div class="section-heading"><h3>${escape(c.title)}</h3><span class="tag">${escape(c.state === "open" && c.kind !== "ask" ? "等待处理" : cardState(c.state))}</span></div><p>${escape(c.text)}</p>${history ? `<div class="decision-answer">我的回答：${escape(choice || "未记录")}<br>处理结果：${escape(resultText(c))}</div>${c.state === "decided" ? '<p class="soft-note">中心只接受对「等待回答」的卡片结案；已回答的卡片要等后续执行回报结果，面板不提供结案入口。</p>' : ""}` : `<div class="options">${(c.options || []).map((o) => `<span class="tag">${escape(o)}</span>`).join("")}</div><button class="button" data-open-card="${c.id}">${c.kind === "ask" ? "回答这个问题" : "查看并处理"}</button>`}<div class="attention-meta">#${c.id} · ${escape(c.rule || "中心通知")} · 创建 ${time(c.createdAt, true)}${c.decidedAt ? ` · 回答 ${time(c.decidedAt, true)}` : ""}${c.closedAt ? ` · 结案 ${time(c.closedAt, true)}` : ""}</div></article>`;
}
function attentionView() {
  return `<section class="list-section"><div class="section-heading"><h2 class="section-title">等待我决定 <small>${data.cards.length}</small></h2><span class="tag">回答后才触发后续</span></div>${data.cards.length ? data.cards.map((c) => decisionCard(c)).join("") : empty("当前没有待处理事项", "新的提问和通知会在这里列出。", "check")}</section><section class="list-section"><h2 class="section-title">最近决定与处理结果</h2><p class="soft-note">来自中心最近卡片记录，非全量历史。已回答不等于后续执行完成。</p>${data.recentCards.length ? data.recentCards.map((c) => decisionCard(c, true)).join("") : '<p class="soft-note">暂无历史记录。</p>'}</section><section class="list-section"><h2 class="section-title">未匹配的事件 <small>${data.unrouted.length} 条最近记录</small></h2><p class="soft-note">没有匹配规则不等同于执行失败。</p>${data.unrouted.map((e) => `<div class="connection-row"><div>${escape(e.summary || e.subject || e.type)}<small>${escape(e.source)} · ${escape(e.type)}</small></div><span class="right">${time(e.received_at, true)}</span></div>`).join("") || '<p class="soft-note">暂无未匹配事件。</p>'}</section>`;
}

function connectionsView() {
  return `<div class="connection-grid"><section class="list-section"><h2 class="section-title">事件来源</h2>${data.sources.map((s) => `<div class="connection-row"><span class="agent-square">${icon("workflow")}</span><div>${escape(s.name)}<small>${escape(s.id)}</small></div><span class="right">${number(s.events)} 条事件</span></div>`).join("") || '<p class="soft-note">暂无来源。</p>'}</section><section class="list-section"><h2 class="section-title">通知通道</h2>${data.channels.map((c) => `<div class="connection-row"><span class="agent-square">${icon("inbox")}</span><div>${escape(c.name)}<small>心跳 ${ago(c.seenAt)}</small></div><span class="presence ${c.online ? "" : "offline"}"><span class="status-dot"></span>${c.online ? "在线" : "离线"}</span></div>`).join("") || '<p class="soft-note">暂无通知通道。</p>'}</section></div><section class="list-section"><div class="section-heading"><h2 class="section-title">已加载规则</h2><span class="tag">${data.lines.length} 条</span></div>${data.lines.map((l) => `<div class="rule-row"><span class="agent-square">${icon("workflow")}</span><div><strong>${escape(l.name)}</strong><small>${escape(l.source)} → ${escape(agentName(l.agent))}</small></div><div class="rule-tags">${(l.types || []).map((t) => `<span class="tag">${escape(t)}</span>`).join("")}${l.every ? `<span class="tag">${escape(l.every)}</span>` : ""}<span class="tag">${number(l.totals.done)} 已完成</span></div></div>`).join("")}</section>`;
}

function render() {
  const [title, description] = names[currentView];
  $("#page-title").textContent = title;
  $("#page-description").textContent = description;
  $("#breadcrumb-current").textContent = title;
  document.querySelectorAll("[data-view]").forEach((el) => {
    el.classList.toggle("active", el.dataset.view === currentView);
    if (el.dataset.view === currentView)
      el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  });
  if (!data) return;
  $("#nav-runs").textContent = data.runs.length;
  $("#nav-attention").textContent = data.cards.length;
  $("#view-content").innerHTML =
    currentView === "overview"
      ? overview()
      : currentView === "runs"
        ? runsView()
        : currentView === "workers"
          ? `<div class="section-heading"><h2 class="section-title">机器与 Agent</h2><span class="section-caption">${machines().filter((m) => m.online).length} / ${machines().length} 台在线</span></div><div class="device-grid">${machines()
              .map((m) => machine(m, true))
              .join(
                "",
              )}</div><p class="soft-note">在线状态采用中心的心跳判断。同一台机器上的多个 Agent 合并显示。</p>`
          : currentView === "attention"
            ? attentionView()
            : currentView === "plans"
              ? plansView()
              : currentView === "items"
                ? itemsView()
                : connectionsView();
  if (historyLeft && currentView !== "runs")
    $("#view-content").insertAdjacentHTML(
      "afterbegin",
      `<p class="soft-note banner-note">刚才查看的是较早的历史记录页；这里的数字来自最近一次成功读取的最新快照（${time(latest?.now ?? data.now, true)}），不用历史页推断当前状态。</p>`,
    );
  $("#updated-at").textContent =
    `最后同步 ${time(data.now, true)} · ${auto ? "每 5 秒更新" : "已暂停自动更新"}`;
}

async function showDetail(id) {
  const r = data.runs.find((run) => run.id === id);
  if (!r) return;
  const pairs = [
    ["执行 Agent", agentName(r.agent)],
    ["用时", duration(r)],
    ["开始时间", time(r.claimedAt, true)],
    ["结束时间", time(r.finishedAt, true)],
    ["中心重试计数", `${r.attempts} 次（不等于实际执行次数）`],
    ["会话", r.session || "未建立 / 未上报"],
  ];
  $("#detail-content").innerHTML =
    `<header class="detail-header"><div><small>任务 #${r.id} · ${escape(r.rule)}</small><h2 id="detail-title">${escape(r.summary || r.rule || "任务详情")}</h2>${badge(r)}</div><button class="icon-button" id="close-detail" aria-label="关闭任务详情">${icon("close")}</button></header><div class="detail-body"><dl class="detail-grid">${pairs.map(([k, v]) => `<div><dt>${k}</dt><dd>${escape(v)}</dd></div>`).join("")}</dl>${r.error ? `<section class="detail-section"><h3>失败原因</h3><div class="detail-text error">${escape(r.error)}</div></section>` : ""}<section class="detail-section"><h3>结果摘要</h3><div class="detail-text">${escape(r.summary || "尚未产生结果摘要。")}</div></section><section class="detail-section"><h3>实际用量</h3>${
      r.usage
        ? `<dl class="detail-grid">${[
            ["输入", number(r.usage.input)],
            ["输出", number(r.usage.output)],
            ["缓存输入", number(r.usage.cached)],
            [
              "费用",
              Number.isFinite(r.usage.cost) ? String(r.usage.cost) : "未上报",
            ],
          ]
            .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
            .join("")}</dl>`
        : '<div class="detail-text">本轮未上报用量。未开始或取消的任务可能没有用量记录。</div>'
    }</section>${r.events?.length ? `<section class="detail-section"><h3>关联事件</h3><ul class="detail-events">${r.events.map((e) => `<li>${escape(e.subject || e.summary || e.type)}<br><span class="mono">${escape(e.source)} · ${escape(e.type)}</span></li>`).join("")}</ul></section>` : ""}<p class="detail-note">数据快照：${time(data.now, true)}。中心提供结果摘要；原始执行日志保留在对应执行端。</p></div>`;
  const stopNote =
    r.state === "unknown"
      ? '<p class="soft-note">状态待确认：中心还没有确认这轮的结束状态（例如运行中超过租约仍未回报），面板不猜原因；中心不接受取消，也不提供伪造的停止入口，需要处理请在中心侧核实。</p>'
      : r.stopping && r.state === "claimed"
        ? '<p class="soft-note">取消请求已记录，等待执行端确认停止；确认前不能视作已经停止。</p>'
        : r.state === "queued"
          ? '<p class="soft-note">这是排队任务：中心会直接记为已取消，不会开始执行。</p>'
          : r.state === "claimed"
            ? '<p class="soft-note">正在运行：取消只是请求，要等执行端确认组内进程结束后才算停止。</p>'
            : r.state === "cancelled"
              ? '<p class="soft-note">中心已记录取消。</p>'
              : "";
  $(".detail-body").insertAdjacentHTML(
    "beforeend",
    `<section class="detail-section"><div class="section-heading"><h3>执行时间线</h3>${["queued", "claimed"].includes(r.state) && !r.stopping ? `<button class="danger-button" data-stop-run="${r.id}">请求取消</button>` : ""}</div>${stopNote}<div id="run-timeline" role="status">正在读取中心事实…</div></section>`,
  );
  dialog.dataset.run = String(id);
  if (!dialog.open) dialog.showModal();
  try {
    const response = await fetch(`/api/runs/${id}/why`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw Error("history");
    const history = await response.json();
    if (dialog.dataset.run !== String(id) || !dialog.open) return;
    $("#run-timeline").innerHTML = timelineHtml(history.facts);
  } catch {
    if (dialog.dataset.run === String(id) && dialog.open)
      $("#run-timeline").textContent =
        "时间线读取失败，未用摘要补造。关闭后重新打开可重查。";
  }
}

function factRow(f) {
  return `<li class="timeline-fact"><div><strong>${escape(factLabel(f.type))}</strong><small>${time(new Date(f.at).toISOString(), true)} · 事实 #${f.seq}</small></div>${f.changes.map((c) => `<p><span class="tag">${escape({ runs: "执行", events: "事件", cards: "卡片", timers: "复查", config: "规则" }[c.table] || c.table)} #${escape(c.key)}</span> ${escape(factText(c))}</p>`).join("") || '<p class="soft-note">这条事实没有附带数据变化。</p>'}</li>`;
}
function timelineHtml(facts) {
  if (!Array.isArray(facts) || !facts.length)
    return '<p class="soft-note">中心未返回关联事实。</p>';
  const nodes = timelineNodes(facts);
  return `<ol class="timeline">${nodes
    .map((node) =>
      node.kind !== "heartbeat"
        ? factRow(node.fact)
        : node.facts.length === 1
          ? factRow(node.facts[0])
          : `<li class="timeline-heartbeat"><details><summary>连续 ${node.facts.length} 条执行端心跳（${time(new Date(node.facts[0].at).toISOString(), true)} 至 ${time(new Date(node.facts.at(-1).at).toISOString(), true)}）· 展开查看全部事实</summary><ol class="timeline timeline-nested">${node.facts.map(factRow).join("")}</ol></details></li>`,
    )
    .join("")}</ol>`;
}
function factLabel(type) {
  return (
    {
      rules: "规则更新",
      ingest: "事件到达",
      claimNext: "执行端领取",
      started: "开始执行",
      finish: "交回执行结果",
      answer: "用户回答",
      resolve: "人工结案",
      cancel: "请求取消",
      tick: "中心定时检查",
      heartbeat: "执行端心跳",
    }[type] || type
  );
}
function factText(change) {
  const r = change.row;
  if (r === null) return "记录已移除";
  if (change.table === "config")
    return `使用规则版本 ${r.version ?? change.key}（完整配置不下发）`;
  if (change.table === "events")
    return `${r.source || ""} · ${r.type || ""} · ${r.subject || r.summary || ""}`;
  if (change.table === "runs")
    return [
      r.state ? labels[r.state] || r.state : null,
      r.cancel_at ? "有取消请求" : null,
      r.session ? `会话 ${r.session}` : r.resume ? `续接 ${r.resume}` : null,
      r.summary,
      r.error,
    ]
      .filter(Boolean)
      .join(" · ");
  if (change.table === "cards")
    return `${r.title || ""} · ${cardState(r.state)}${r.answer ? ` · 回答：${r.answer}` : Number.isInteger(r.choice) ? ` · 选项索引 ${r.choice}（从0开始）` : ""}${r.result ? ` · 结果：${r.result}` : ""}`;
  if (change.table === "timers")
    return `${r.about || r.key || ""} · ${r.at || ""}`;
  return "";
}

function message(text) {
  $("#action-message").hidden = false;
  $("#action-message").innerHTML =
    `<span>${escape(text)}</span><button aria-label="关闭提示" data-dismiss-message>×</button>`;
}
function showCard(id) {
  if (document.body.classList.contains("stale"))
    return message("当前数据已过期，请先刷新连接。");
  const c = data.cards.find((card) => card.id === id);
  if (!c || c.state !== "open")
    return message("这张卡片不再等待回答，请刷新核对。");
  const infoOnly = c.kind === "fyi";
  $("#action-content").innerHTML =
    `<header class="detail-header"><div><small>卡片 #${c.id}</small><h2 id="action-title">${escape(c.title)}</h2></div><button class="icon-button" data-close-action aria-label="关闭操作">${icon("close")}</button></header><div class="detail-body"><p class="card-body-text">${escape(c.text)}</p>${infoOnly ? "<p>这是一条告知，无需回答。</p>" : `<form id="decision-form" data-card="${c.id}"><label class="field">处理方式<select name="mode">${c.kind === "ask" ? '<option value="answer">回答并继续处理</option>' : ""}<option value="resolve">直接结案，不触发续接</option></select></label>${c.kind === "ask" && c.options?.length ? `<fieldset class="choice-list"><legend>选择一个选项，或在下方填写回答</legend>${c.options.map((o, i) => `<label><input type="radio" name="choice" value="${i}"><span>${escape(o)}</span></label>`).join("")}<button type="button" id="clear-choice" class="text-button">清除选择</button></fieldset>` : ""}<label class="field">文字回答 / 结案原因<textarea name="text" rows="4" maxlength="10000" placeholder="选项和文字回答择一；结案时必须写明原因。"></textarea></label><p class="soft-note">提交回答会交给中心处理，可能触发下一轮执行。结案只关闭这张卡片。提交前请核对内容。</p><p id="form-error" class="form-error" role="alert"></p><button class="button" type="submit">确认提交</button></form>`}</div>`;
  $("#action-dialog").showModal();
}
function showStop(id) {
  if (document.body.classList.contains("stale"))
    return message("当前数据已过期，请先刷新连接。");
  dialog.close();
  $("#action-content").innerHTML =
    `<header class="detail-header"><h2 id="action-title">请求取消任务 #${id}</h2><button class="icon-button" data-close-action aria-label="关闭操作">${icon("close")}</button></header><div class="detail-body"><p>这会向中心提交取消请求。正在运行的任务需要等待执行端确认；此时不能视作已经停止。</p><form id="cancel-form" data-run="${id}"><p id="form-error" class="form-error" role="alert"></p><button class="danger-button" type="submit">确认请求取消</button></form></div>`;
  $("#action-dialog").showModal();
}
document.addEventListener("click", (event) => {
  if (event.target.closest("[data-dismiss-message]"))
    $("#action-message").hidden = true;
  if (event.target.closest("#clear-choice"))
    document
      .querySelectorAll('#decision-form input[name="choice"]')
      .forEach((input) => (input.checked = false));
});
document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!["decision-form", "cancel-form"].includes(form.id)) return;
  event.preventDefault();
  if (form.dataset.pending === "true") return;
  const error = $("#form-error");
  if (document.body.classList.contains("stale")) {
    error.textContent = "连接已过期，请关闭后刷新核对。";
    return;
  }
  let path, body;
  if (form.id === "cancel-form") {
    path = `/api/runs/${form.dataset.run}/cancel`;
    body = {};
  } else {
    const fields = new FormData(form),
      text = String(fields.get("text") || "").trim();
    const resolve = fields.get("mode") === "resolve",
      choice = fields.get("choice");
    if (
      resolve
        ? !text || text.length > 1000
        : (choice === null && !text) || (choice !== null && !!text)
    ) {
      error.textContent = resolve
        ? "请填写结案原因，最多1000字。"
        : "请选择一个选项或填写文字，两者择一。";
      return;
    }
    path = `/api/cards/${form.dataset.card}/${resolve ? "resolve" : "answer"}`;
    body = resolve
      ? { reason: text }
      : choice !== null
        ? { choice: Number(choice) }
        : { text };
  }
  form.dataset.pending = "true";
  form.querySelector('button[type="submit"]').disabled = true;
  error.textContent = "正在提交，请勿重复操作…";
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json();
    if (!response.ok) throw Error(result.error || "提交未确认，请刷新核对。");
    const keptCursor = cursor;
    const cancelId =
      form.id === "cancel-form" ? Number(form.dataset.run) : null;
    $("#action-dialog").close();
    $("#action-message").hidden = true;
    error.textContent = "正在核对中心记录…";
    // The wording must rest on a read that succeeded after this request. A read
    // skipped while another one runs, or one that failed, leaves the old snapshot
    // unusable as a confirmation; restoring the older page afterwards cannot undo that.
    const latestOk = await refresh(null);
    const confirmed = latestOk ? latest : null;
    if (keptCursor !== null) await refresh(keptCursor);
    message(
      cancelId !== null
        ? cancelNote(cancelId, confirmed?.runs ?? [], latestOk)
        : result.changed === false
          ? "中心未更改：这张卡片已被处理。"
          : body.reason
            ? "结案已提交，请以刷新后的中心记录为准。"
            : "回答已提交，后续执行请查看任务记录。",
    );
  } catch (failure) {
    error.textContent = `${failure.name === "TimeoutError" || failure.name === "TypeError" ? "未确认操作结果。" : failure.message} 请关闭后刷新核对，不会自动重试。`;
  }
});

// Resolves to whether the read it was asked for actually succeeded on the hub.
async function refresh(nextCursor = cursor) {
  if (inFlight) return false;
  inFlight = true;
  $("#refresh").disabled = true;
  const focus = document.activeElement?.id,
    position =
      focus === "task-search" ? document.activeElement.selectionStart : null;
  try {
    const response = await fetch(
      "/api/state" + (nextCursor ? "?before=" + nextCursor : ""),
      { cache: "no-store", signal: AbortSignal.timeout(10000) },
    );
    if (!response.ok) throw Error("unavailable");
    const payload = await response.json();
    cursor = nextCursor;
    page = payload;
    if (!nextCursor) latest = payload;
    // Older pages never describe the present: only a cursor-free read can.
    data = currentView === "runs" ? page : (latest ?? page);
    document.body.classList.remove("stale");
    $("#connection-alert").hidden = true;
    $("#connection-status").textContent = "中心已连接";
    $("#connection-status").classList.remove("offline");
    render();
    if (focus === "task-search" && $("#task-search")) {
      $("#task-search").focus();
      if (position !== null)
        $("#task-search").setSelectionRange(position, position);
    }
    return true;
  } catch {
    document.body.classList.add("stale");
    $("#connection-status").textContent = "中心暂时未连接";
    $("#connection-status").classList.add("offline");
    $("#connection-alert").hidden = false;
    $("#connection-alert").textContent = data
      ? `暂时无法更新。当前显示 ${time(data.now, true)} 的最后一次成功数据，请勿当作实时状态。`
      : "暂时无法连接中心。请确认本机中心正在运行，然后点击刷新。";
    if (!data)
      $("#view-content").innerHTML = empty(
        "尚未读取到中心数据",
        "没有展示示例或模拟数据。连接恢复后将自动更新。",
        "activity",
      );
    return false;
  } finally {
    inFlight = false;
    $("#refresh").disabled = false;
  }
}

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-nav]");
  if (nav) location.hash = nav.dataset.nav;
  const row = event.target.closest("button[data-run]");
  if (row) showDetail(Number(row.dataset.run));
  const cardButton = event.target.closest("[data-open-card]");
  if (cardButton) showCard(Number(cardButton.dataset.openCard));
  const stopButton = event.target.closest("[data-stop-run]");
  if (stopButton) showStop(Number(stopButton.dataset.stopRun));
  if (event.target.closest("[data-close-action]")) $("#action-dialog").close();
  if (event.target.closest("#close-detail")) dialog.close();
  if (event.target.closest("#older-page") && data.nextBefore)
    refresh(data.nextBefore);
  if (event.target.closest("#latest-page")) {
    historyLeft = false;
    refresh(null);
  }
});
document.addEventListener("input", (event) => {
  if (event.target.id !== "task-search") return;
  search = event.target.value;
  const runs = data.runs.filter(
    (r) =>
      (!filter ||
        (filter === "attention"
          ? ["failed", "unknown"].includes(r.state)
          : r.state === filter)) &&
      (!agentFilter || r.agent === agentFilter) &&
      `${r.id} ${r.rule} ${r.summary} ${r.error} ${agentName(r.agent)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  $("#filtered-table").innerHTML = taskTable(runs);
  $(".filter-count").textContent =
    `当前页 ${runs.length} / ${data.runs.length} 条`;
});
document.addEventListener("change", (event) => {
  if (event.target.id === "state-filter") {
    filter = event.target.value;
    render();
  }
  if (event.target.id === "agent-filter") {
    agentFilter = event.target.value;
    render();
  }
});
window.addEventListener("hashchange", () => {
  currentView = names[location.hash.slice(1)]
    ? location.hash.slice(1)
    : "overview";
  // Leaving an older page for a view that states the present: say so, and read
  // the newest snapshot instead of reusing the page just left behind.
  historyLeft = cursor !== null && currentView !== "runs";
  if (page) data = currentView === "runs" ? page : (latest ?? page);
  render();
  if (cursor && currentView !== "runs") refresh(null);
  window.scrollTo({ top: 0 });
});
$("#refresh").addEventListener("click", () => refresh());
$("#auto-refresh").addEventListener("click", () => {
  auto = !auto;
  $("#auto-refresh").setAttribute("aria-pressed", String(auto));
  $("#auto-refresh").querySelector("span:last-child").textContent = auto
    ? "自动更新"
    : "更新已暂停";
  render();
  if (auto) refresh();
});
dialog.addEventListener("click", (event) => {
  if (
    event.target === dialog &&
    event.clientX < dialog.getBoundingClientRect().left
  )
    dialog.close();
});
render();
refresh();
setInterval(() => {
  if (auto && !document.hidden && !$("#action-dialog").open) refresh();
}, 5000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && auto) refresh();
});
