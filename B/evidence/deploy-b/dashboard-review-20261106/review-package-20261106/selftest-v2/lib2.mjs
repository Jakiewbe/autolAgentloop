// lib2：在 lib.mjs 之上补齐 v2 判据需要的动作（答案序号、结案原因、翻页、批量历史）。
import { centerApi } from "./lib.mjs";

export function hub2(center) {
  const hub = centerApi(center);
  const base = center.publicUrl.replace(/\/$/, "");
  const keys = center.keys;
  const auth = (token = keys.owner) => ({ authorization: "Bearer " + token, "content-type": "application/json" });

  const api = {
    ...hub,
    keys,
    base,
    async answerChoice(cardId, index) {
      const response = await fetch(base + "/v1/cards/" + cardId + "/answer", {
        method: "POST", headers: auth(), body: JSON.stringify({ choice: index, by: "me" }),
      });
      return { status: response.status, text: await response.text() };
    },
    async answerText(cardId, text) {
      const response = await fetch(base + "/v1/cards/" + cardId + "/answer", {
        method: "POST", headers: auth(), body: JSON.stringify({ text, by: "me" }),
      });
      return { status: response.status, text: await response.text() };
    },
    async resolveCard(cardId, reason) {
      const response = await fetch(base + "/v1/cards/" + cardId + "/resolve", {
        method: "POST", headers: auth(keys.channel ?? keys.owner), body: JSON.stringify({ reason }),
      });
      return { status: response.status, text: await response.text() };
    },
    async notice(text) {
      const key = "note-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
      const answer = await hub.call("POST", "/v1/tell", keys.source, { key, text });
      if (!answer.ok) throw new Error("造通知失败: " + answer.text.slice(0, 160));
      const state = await hub.state();
      const card = (state.data.recentCards || []).find((entry) => entry.text === text);
      if (!card) throw new Error("通知没出现在 state 里: " + text);
      return card;
    },
    async runs() {
      const state = await hub.state();
      return state.data.runs || [];
    },
    async runDetail(id) {
      const state = await hub.state();
      return (state.data.runs || []).find((entry) => entry.id === id) ?? null;
    },
    async why(id) {
      return hub.call("GET", "/v1/runs/" + id + "/why");
    },
    /** 造 n 条已收尾的历史，把 state 撑过一页。 */
    async bulkClosed(count) {
      for (let index = 0; index < count; index++) {
        await hub.call("POST", "/v1/tell", keys.source, { key: "hist-" + Date.now() + "-" + index, text: "历史样本 " + index });
      }
      return count;
    },
    async stateBefore(before) {
      const answer = await hub.call("GET", "/v1/state" + (before ? "?before=" + before : ""));
      return answer.data;
    },
    /** 把队列里不属于本次用例的活全部取消，避免占住泳道。 */
    async drain(times = 12) {
      const cleared = [];
      for (let index = 0; index < times; index++) {
        const job = await hub.claim("drain-" + Date.now() + "-" + index);
        if (!job) break;
        await hub.finish(job.run, job.token, { outcome: "cancelled", summary: "用例清场" });
        cleared.push(job.run);
      }
      return cleared;
    },
    /** 领活并核对归属，避免劫持别人的后续轮。 */
    async claimOwn(eventId, token = keys.worker, tag = "v2") {
      for (let attempt = 0; attempt < 12; attempt++) {
        const job = await hub.claim(tag + "-" + Date.now() + "-" + attempt);
        if (!job) { await new Promise((r) => setTimeout(r, 250)); continue; }
        const ids = ((job.context && job.context.events) || []).map((entry) => entry.id);
        if (ids.includes(eventId)) return job;
        await hub.finish(job.run, job.token, { outcome: "cancelled", summary: "清场：不是本次事件" });
      }
      return null;
    },
  };
  return api;
}
