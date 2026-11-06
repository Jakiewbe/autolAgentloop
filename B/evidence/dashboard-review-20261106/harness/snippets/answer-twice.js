(async () => {
  const id = __CARD__;
  const post = (body) => fetch("/api/cards/" + id + "/answer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const first = await post({ choice: 0, by: "me" });
  const firstBody = (await first.text()).slice(0, 200);
  const snapshot = await (await fetch("/api/state")).json();
  const afterFirstCount = (snapshot.runs || []).length;
  const second = await post({ choice: 1, by: "me" });
  const secondBody = (await second.text()).slice(0, 200);
  return { first: first.status, firstBody, second: second.status, secondBody, afterFirstCount };
})()