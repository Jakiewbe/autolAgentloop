// 假中心侧的工具：直接走公开 HTTP，造数据与对账都用它。
export function centerApi(center) {
  const base = center.publicUrl.replace(/\/$/, "");
  const keys = center.keys;
  async function call(method, path, token = keys.owner, body) {
    const response = await fetch(base + path, {
      method,
      headers: { authorization: "Bearer " + token, ...(body !== undefined && { "content-type": "application/json" }) },
      ...(body !== undefined && { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(20000),
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch {}
    return { status: response.status, ok: response.ok, data, text };
  }
  let counter = 0;
  const api = {
    call,
    state: (before) => call("GET", "/v1/state" + (before ? "?before=" + before : "")),
    health: () => call("GET", "/healthz"),
    async event(type = "feedback.new", extra = {}) {
      counter += 1;
      const id = `suite:${Date.now()}:${counter}`;
      const subject = `#suite-${counter}`;
      const answer = await call("POST", "/v1/events", keys.source, { id, type, subject, summary: "验收用事件 " + counter, ...extra });
      if (!answer.ok) throw new Error("造事件失败: " + answer.text.slice(0, 200));
      return { id, subject };
    },
    async claim(tag) {
      for (const token of [keys.worker, keys.worker2]) {
        const answer = await call("GET", "/v1/work?claim=" + encodeURIComponent(tag) + "&wait=0&running=&capacity=1", token);
        if (!answer.ok) throw new Error("领活失败: " + answer.text.slice(0, 200));
        if (answer.data?.job) return answer.data.job;
      }
      return null;
    },
    /** 用完就把这一轮结束掉，别占着泳道。 */
    async finish(run, token, body = { outcome: "cancelled", summary: "用例清理" }) {
      return call("POST", "/v1/runs/" + run + "/result", token, body);
    },
    /** 灌一批通知，用来把历史撑过一页。 */
    async bulk(count) {
      for (let index = 0; index < count; index++) {
        const key = "bulk-" + Date.now() + "-" + index;
        const answer = await call("POST", "/v1/tell", keys.source, { key, text: "历史样本 " + index });
        if (!answer.ok) throw new Error("灌历史失败: " + answer.text.slice(0, 120));
      }
      return count;
    },
    async cancelQueue() {
      const answer = await call("GET", "/v1/work?claim=probe-" + Date.now() + "&wait=0&running=&capacity=0", keys.worker);
      return answer.data ?? null;
    },
    started: (run, token, session) => call("POST", "/v1/runs/" + run + "/started", token, { session, link: "app://" + session }),
    result: (run, token, body) => call("POST", "/v1/runs/" + run + "/result", token, body),
    /** 造一张 open 的 ask 卡。只处理本次事件派生的活，别的一律结掉，免得占住泳道。 */
    async ask(title, options = ["是", "否"], extra = {}) {
      const event = await api.event();
      let card = null;
      for (let attempt = 0; attempt < 10 && !card; attempt++) {
        const job = await api.claim("ask-" + Date.now() + "-" + attempt);
        if (!job) break;
        const contextIds = ((job.context && job.context.events) || []).map((entry) => entry.id);
        if (!contextIds.includes(event.id)) {
          await api.finish(job.run, job.token, { outcome: "cancelled", summary: "清场：不是本次事件" });
          continue;
        }
        await api.started(job.run, job.token, "s-" + job.run);
        const answer = await api.result(job.run, job.token, {
          outcome: "done",
          summary: "等你决定",
          session: "s-" + job.run,
          ask: [{ title, text: "验收用问题", options, key: "k-" + Date.now(), ...extra }],
        });
        if (!answer.ok) console.log("ASK_RESULT_FAIL", job.run, answer.status, answer.text.slice(0, 200));
        for (let wait = 0; wait < 10 && !card; wait++) {
          const state = await api.state();
          card = (state.data.cards || []).find((entry) => entry.title === title) ?? null;
          if (!card) await new Promise((resolve) => setTimeout(resolve, 200));
        }
        if (!card) await api.finish(job.run, job.token, { outcome: "cancelled", summary: "没收据，先结掉" });
      }
      if (!card) throw new Error("没有造出卡片: " + title);
      return { card, run: card.run ?? null, session: card.session ?? null };
    },
    /** 造一张 fyi 只读通知。 */
    async fyi(text) {
      const key = "suite-note-" + Date.now();
      const answer = await call("POST", "/v1/tell", keys.source, { key, text });
      if (!answer.ok) throw new Error("造通知失败: " + answer.text.slice(0, 200));
      const state = await api.state();
      const card = (state.data.recentCards || []).find((entry) => entry.text === text);
      return { card, key };
    },
    /** 造一个停在运行中的 run（可取消）。 */
    async running() {
      await api.event();
      const job = await api.claim("running-" + Date.now());
      if (!job) throw new Error("没有领到活（泳道被占）");
      await api.started(job.run, job.token, "s-" + job.run);
      return { run: job.run, token: job.token, session: "s-" + job.run };
    },
    async cardById(id) {
      const state = await api.state();
      const all = [...(state.data.cards || []), ...(state.data.recentCards || [])];
      return all.find((entry) => entry.id === id) ?? null;
    },
    async runById(id) {
      const state = await api.state();
      return (state.data.runs || []).find((entry) => entry.id === id) ?? null;
    },
  };
  return api;
}
