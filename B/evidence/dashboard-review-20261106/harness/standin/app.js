// 参照实现前端：只用 /api/*，密钥不落到浏览器；错误只给手动重试；断线保留旧数据并禁用操作。
const state = { data: null, offline: false, error: null, pendingAnswer: new Set(), cancelWait: new Set() };

const $ = (sel) => document.querySelector(sel);
const banner = (kind, text) => {
  const el = $("#banner");
  el.className = "banner on " + kind;
  el.textContent = text;
};
const clearBanner = () => {
  const el = $("#banner");
  el.className = "banner";
  el.textContent = "";
};

async function api(method, path, body) {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!response.ok) throw new Error((data && data.error) || "中台返回 " + response.status);
  return data;
}

async function load(before) {
  try {
    const data = await api("GET", "/api/state" + (before ? "?before=" + before : ""));
    state.data = data;
    state.offline = false;
    state.error = null;
    clearBanner();
  } catch (error) {
    state.error = String(error.message || error);
    state.offline = true;
    banner("offline", "连接中断，下面是上次取到的数据；操作已禁用。错误：" + state.error);
  }
  render();
}

function render() {
  const data = state.data;
  const root = $("#root");
  if (!data) {
    root.textContent = "还没有数据";
    return;
  }
  const cards = (data.cards || []).filter((card) => card.state === "open");
  const notices = (data.recentCards || []).filter((card) => card.kind === "notice");
  const runs = (data.runs || []).filter((run) => ["claimed", "running", "retrying"].includes(run.state));
  const offline = state.offline;
  const disabled = offline ? " disabled" : "";

  const cardsHtml = cards.length
    ? cards.map((card) => {
        const waiting = state.pendingAnswer.has(card.id);
        const options = (card.options || []).map((option, index) =>
          `<button data-card="${card.id}" data-choice="${index}"${waiting || offline ? " disabled" : ""}>${escapeHtml(option)}</button>`,
        ).join("");
        return `<article class="card" data-card-id="${card.id}" data-kind="ask" data-state="${card.state}">
          <h3>${escapeHtml(card.title)}</h3>
          <div class="meta">${escapeHtml(card.text || "")}${card.rule ? " · 规则 " + escapeHtml(card.rule) : ""}</div>
          <div class="opt">${options}</div>
          <textarea data-text="${card.id}" placeholder="或者写下你的回答" ${waiting || offline ? "disabled" : ""}></textarea>
          <div class="opt"><button data-submit="${card.id}"${waiting || offline ? " disabled" : ""}>提交文字回答</button>
          <span class="meta" data-answered="${card.id}">${waiting ? "提交中…" : ""}</span></div>
        </article>`;
      }).join("")
    : "<p class='meta' data-empty='cards'>没有待处理的卡片</p>";

  const noticeHtml = notices.length
    ? notices.map((card) => `<article class="card" data-card-id="${card.id}" data-kind="notice" data-state="${card.state}">
        <h3>${escapeHtml(card.title)}</h3><div class="meta">${escapeHtml(card.text || "")}</div>
        <div class="meta">${card.state === "closed" ? "只读（已结案）" : "通知"}</div>
      </article>`).join("")
    : "<p class='meta' data-empty='notices'>没有通知</p>";

  const runsHtml = runs.length
    ? runs.map((run) => `<article class="card" data-run-id="${run.id}" data-run-state="${run.state}">
        <h3>#${run.id} ${escapeHtml(run.rule || "")}</h3>
        <div class="meta">状态 ${escapeHtml(run.state)} · 会话 ${escapeHtml(run.session || "—")}</div>
        <div class="opt"><button data-cancel="${run.id}"${offline || state.cancelWait.has(run.id) ? " disabled" : ""}>取消</button>
        <span class="meta" data-cancel-state="${run.id}">${state.cancelWait.has(run.id) ? "等待执行端确认" : ""}</span></div>
      </article>`).join("")
    : "<p class='meta' data-empty='runs'>没有在跑的运行</p>";

  const lines = data.lines || [];
  const plansHtml = lines.length || (data.elsewhere || []).length
    ? '<ul data-plans>' + lines.map((line) => `<li data-plan="${escapeHtml(line.id)}">${escapeHtml(line.name)} · ${escapeHtml(line.every || "按事件")} · 下次 ${escapeHtml(line.next || "—")}</li>`).join("") +
      (data.elsewhere || []).map((plan) => `<li data-plan-elsewhere="${escapeHtml(plan.id)}">${escapeHtml(plan.name)} · ${escapeHtml(plan.every)} · 在 ${escapeHtml(plan.where)}</li>`).join("") + "</ul>"
    : "<p class='meta' data-empty='plans'>没有计划</p>";

  const timeline = (data.runs || []).flatMap((run) => (run.events || []).map((event) => ({ run: run.id, ...event })));
  const timelineHtml = timeline.length
    ? '<ul class="timeline">' + timeline.slice(0, 20).map((event) => `<li data-event-subject="${escapeHtml(event.subject || "")}">#${event.run} ${escapeHtml(event.type)} ${escapeHtml(event.subject || "")} ${escapeHtml(event.summary || "")}</li>`).join("") + "</ul>"
    : "<p class='meta' data-empty='timeline'>没有事件</p>";

  root.innerHTML = `
    <section><h2>待处理（${cards.length}）</h2>${cardsHtml}</section>
    <section><h2>通知（${notices.length}）</h2>${noticeHtml}</section>
    <section><h2>在跑（${runs.length}）</h2>${runsHtml}</section>
    <section><h2>计划</h2>${plansHtml}</section>
    <section><h2>时间线</h2>${timelineHtml}</section>
    <p class="meta" data-has-more="${data.hasMore ? "1" : "0"}">${data.hasMore ? "还有更早的记录" : "没有更早的记录"}</p>`;

  root.querySelectorAll("button[data-choice]").forEach((button) =>
    button.addEventListener("click", () => answer(Number(button.dataset.card), { choice: Number(button.dataset.choice) })),
  );
  root.querySelectorAll("button[data-submit]").forEach((button) =>
    button.addEventListener("click", () => {
      const id = Number(button.dataset.submit);
      const area = root.querySelector(`textarea[data-text="${id}"]`);
      const text = (area && area.value || "").trim();
      answer(id, text ? { text } : {});
    }),
  );
  root.querySelectorAll("button[data-cancel]").forEach((button) =>
    button.addEventListener("click", () => cancelRun(Number(button.dataset.cancel))),
  );
  $("#older").disabled = !data.nextBefore || offline;
  $("#older").dataset.before = data.nextBefore || "";
}

async function answer(id, body) {
  if (state.offline) return;
  state.pendingAnswer.add(id);
  render();
  try {
    const answer = await api("POST", "/api/cards/" + id + "/answer", { ...body, by: "me" });
    if (answer && answer.changed === false) {
      banner("err", "这张卡片已经回答过了，没有重复提交。");
    }
  } catch (error) {
    banner("err", "提交失败：" + String(error.message || error) + "（不会自动重试，请手动再点一次）");
  } finally {
    state.pendingAnswer.delete(id);
    await load();
  }
}

async function cancelRun(id) {
  if (state.offline) return;
  state.cancelWait.add(id);
  render();
  try {
    await api("POST", "/api/runs/" + id + "/cancel", {});
    banner("err", "已请求取消，等待执行端确认。");
  } catch (error) {
    banner("err", "取消失败：" + String(error.message || error));
    state.cancelWait.delete(id);
  }
  render();
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

$("#older").addEventListener("click", () => {
  const before = $("#older").dataset.before;
  if (before) load(before);
});
load();
setInterval(() => load(), 5000);
