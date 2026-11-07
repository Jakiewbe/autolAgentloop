// b4/ip-proxy.js — 本机 CONNECT 隧道代理：把 github.com:443 的 TLS 连接钉到可用 IP。
// 背景：本机 DNS 解析 github.com -> 20.205.243.166（该 IP 的 443 被掐，curl 20s 超时），
// 但 140.82.121.3 / 20.27.177.113 等 IP 的 443 可用（curl --resolve 200）。不改 hosts（非管理员），
// 只在本进程内做 TCP 落地，git 走 http.proxy 指向本代理，TLS/SNI/Host 仍是 github.com。
const http = require("node:http");
const net = require("node:net");

const LISTEN = Number(process.env.PROXY_PORT || 18080);
const PIN = (process.env.PIN_HOSTS || "github.com,codeload.github.com,objects.githubusercontent.com,api.github.com").split(",");
const IPS = (process.env.PIN_IPS || "20.27.177.113,140.82.121.3,140.82.112.3").split(",");

function connectAny(port, idx) {
  return new Promise((resolve, reject) => {
    if (idx >= IPS.length) return reject(new Error("all pinned IPs failed"));
    const ip = IPS[idx];
    const s = net.connect({ host: ip, port, timeout: 8000 });
    s.once("connect", () => { s.setTimeout(0); resolve(s); });
    s.once("timeout", () => { s.destroy(); reject(new Error("timeout " + ip)); });
    s.once("error", (e) => { s.destroy(); reject(e); });
  }).catch(() => connectAny(port, idx + 1));
}

http.createServer((req, res) => { res.writeHead(400); res.end("CONNECT only\n"); }).on("connect", (req, client, head) => {
  const [host, portStr] = String(req.url).split(":");
  const port = Number(portStr || 443);
  if (!PIN.includes(host)) { client.end("HTTP/1.1 403 Forbidden\r\n\r\n"); return; }
  connectAny(port, 0).then((up) => {
    client.write("HTTP/1.1 200 Connection Established\r\n\r\n");
    if (head && head.length) up.write(head);
    up.pipe(client); client.pipe(up);
    const bail = () => { up.destroy(); client.destroy(); };
    up.on("error", bail); client.on("error", bail);
  }).catch((e) => { client.end("HTTP/1.1 502 Bad Gateway\r\n\r\n"); console.error("CONNECT " + host + ":" + port + " -> " + e.message); });
}).listen(LISTEN, "127.0.0.1", () => console.log("ip-proxy listening 127.0.0.1:" + LISTEN + " pin=" + PIN.join(",") + " ips=" + IPS.join(",")));
