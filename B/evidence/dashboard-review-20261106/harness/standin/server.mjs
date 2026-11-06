// 参照实现的同源代理 + 静态页：密钥只在服务端，浏览器只碰 /api/*。
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";

const centerFile = process.argv[2];
if (!centerFile) throw new Error("用法: node server.mjs <review-center.json> [port]");
const center = JSON.parse(readFileSync(centerFile, "utf8"));
const base = center.publicUrl.replace(/\/$/, "");
const key = center.keys.owner;
const port = Number(process.argv[3] ?? 0);
const here = import.meta.dirname;

async function hub(method, pathname, body) {
  const response = await fetch(base + pathname, {
    method,
    headers: { authorization: "Bearer " + key, ...(body !== undefined && { "content-type": "application/json" }) },
    ...(body !== undefined && { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  return { status: response.status, text, type: response.headers.get("content-type") ?? "application/json" };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const send = (status, body, type = "application/json") => {
    res.writeHead(status, { "content-type": type, "cache-control": "no-store" });
    res.end(body);
  };
  try {
    if (url.pathname === "/" || url.pathname === "/index.html")
      return send(200, readFileSync(path.join(here, "index.html")), "text/html; charset=utf-8");
    if (url.pathname === "/app.js")
      return send(200, readFileSync(path.join(here, "app.js")), "text/javascript; charset=utf-8");
    if (url.pathname === "/api/health") {
      const answer = await hub("GET", "/healthz");
      return send(answer.status, answer.text);
    }
    if (url.pathname === "/api/state") {
      const before = url.searchParams.get("before");
      const answer = await hub("GET", "/v1/state" + (before ? "?before=" + encodeURIComponent(before) : ""));
      return send(answer.status, answer.text);
    }
    let match = /^\/api\/cards\/(\d+)\/(answer|resolve)$/.exec(url.pathname);
    if (match && req.method === "POST") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
      const answer = await hub("POST", "/v1/cards/" + match[1] + "/" + match[2], body);
      return send(answer.status, answer.text);
    }
    match = /^\/api\/runs\/(\d+)\/cancel$/.exec(url.pathname);
    if (match && req.method === "POST") {
      const answer = await hub("POST", "/v1/runs/" + match[1] + "/cancel", {});
      return send(answer.status, answer.text);
    }
    match = /^\/api\/why\/(\d+)$/.exec(url.pathname);
    if (match) {
      const answer = await hub("GET", "/v1/runs/" + match[1] + "/why");
      return send(answer.status, answer.text);
    }
    return send(404, JSON.stringify({ error: "没有这个接口" }));
  } catch (error) {
    return send(502, JSON.stringify({ error: "代理失败: " + String(error).slice(0, 200) }));
  }
});

server.listen(port, "127.0.0.1", () => {
  const actual = server.address().port;
  console.log("STANDIN_READY http://127.0.0.1:" + actual);
});
