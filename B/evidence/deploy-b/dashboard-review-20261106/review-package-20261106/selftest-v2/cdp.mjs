// 零依赖 CDP 驱动：启动本机 Chrome/Edge（headless=new，回环调试端口），用内置 WebSocket 发 CDP 命令。
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const CANDIDATES = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
];

export function browserPath() {
  const found = CANDIDATES.find((p) => existsSync(p));
  if (!found) throw new Error("没有找到 Chrome 或 Edge");
  return found;
}

export async function launch({ width = 1280, height = 900 } = {}) {
  const profile = mkdtempSync(path.join(tmpdir(), "dashboard-review-browser-"));
  const child = spawn(
    browserPath(),
    [
      "--headless=new",
      "--remote-debugging-port=0",
      "--remote-allow-origins=*",
      "--user-data-dir=" + profile,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-background-networking",
      `--window-size=${width},${height}`,
      "about:blank",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let stderr = "";
  child.stderr.on("data", (chunk) => (stderr += String(chunk)));
  const activeFile = path.join(profile, "DevToolsActivePort");
  let port = null;
  for (let i = 0; i < 200; i++) {
    if (existsSync(activeFile)) {
      const first = readFileSync(activeFile, "utf8").split("\n")[0].trim();
      if (/^\d+$/.test(first)) {
        port = Number(first);
        break;
      }
    }
    await sleep(100);
  }
  if (!port) throw new Error("浏览器没有给出调试端口: " + stderr.slice(-400));

  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  const events = [];
  ws.addEventListener("message", (event) => {
    const data = JSON.parse(String(event.data));
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      data.error ? reject(new Error(data.method + " " + JSON.stringify(data.error))) : resolve(data.result);
    } else if (data.method) {
      events.push(data);
    }
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const message = { id: ++id, method, params, ...(sessionId && { sessionId }) };
      pending.set(message.id, { resolve, reject });
      ws.send(JSON.stringify(message));
      setTimeout(() => {
        if (pending.delete(message.id)) reject(new Error("CDP 超时: " + method));
      }, 30000);
    });

  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const page = (method, params) => send(method, params, sessionId);
  await page("Page.enable");
  await page("Runtime.enable");
  await page("Network.enable");

  const consoleErrors = [];
  const requests = [];
  ws.addEventListener("message", (event) => {
    const data = JSON.parse(String(event.data));
    if (data.sessionId !== sessionId) return;
    if (data.method === "Runtime.consoleAPICalled" && data.params.type === "error")
      consoleErrors.push(data.params.args.map((a) => a.value ?? a.description ?? "").join(" "));
    if (data.method === "Runtime.exceptionThrown") {
      const details = data.params.exceptionDetails ?? {};
      const where = (details.url ?? "") + ":" + (details.lineNumber ?? "?");
      consoleErrors.push(where + " " + String(details.exception?.description ?? details.text ?? ""));
    }
    if (data.method === "Network.requestWillBeSent") requests.push(data.params.request.url);
  });

  const api = {
    sessionId,
    ws,
    port,
    requests,
    consoleErrors,
    send: page,
    async goto(url) {
      const loaded = new Promise((resolve) => {
        const onEvent = (event) => {
          const data = JSON.parse(String(event.data));
          if (data.sessionId === sessionId && data.method === "Page.loadEventFired") {
            ws.removeEventListener("message", onEvent);
            resolve();
          }
        };
        ws.addEventListener("message", onEvent);
      });
      await page("Page.navigate", { url });
      await Promise.race([loaded, sleep(15000)]);
      await sleep(300);
    },
    async eval(expression) {
      const result = await page("Runtime.evaluate", {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      });
      if (result.exceptionDetails) throw new Error("页面脚本异常: " + JSON.stringify(result.exceptionDetails.text ?? result.exceptionDetails));
      return result.result.value;
    },
    async text(selector) {
      return api.eval(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); return el ? el.innerText : null; })()`);
    },
    async count(selector) {
      return api.eval(`document.querySelectorAll(${JSON.stringify(selector)}).length`);
    },
    async click(selector) {
      const box = await api.eval(
        `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; el.scrollIntoView({ block: "center", inline: "center" }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`,
      );
      if (!box) throw new Error("点不到: " + selector);
      for (const type of ["mousePressed", "mouseReleased"]) {
        await page("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: "left", clickCount: 1 });
      }
      await sleep(150);
    },
    async type(selector, text) {
      await api.eval(`document.querySelector(${JSON.stringify(selector)}).focus()`);
      for (const char of text) {
        await page("Input.dispatchKeyEvent", { type: "keyDown", text: char, key: char });
        await page("Input.dispatchKeyEvent", { type: "keyUp", key: char });
      }
      await sleep(100);
    },
    async screenshot(file) {
      const { data } = await page("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
      const { writeFileSync } = await import("node:fs");
      writeFileSync(file, Buffer.from(data, "base64"));
      return file;
    },
    async close() {
      try {
        await send("Browser.close");
      } catch {}
      try {
        ws.close();
      } catch {}
      child.kill();
    },
  };
  return api;
}



// 面向用例的高层封装：文本定位点击、区域内输入、断网模拟、请求日志。
export async function openBrowser(options = {}) {
  const base = await launch(options);
  const page = base.send;
  const api = {};
  const findRegion = (needle, mode = "actionable") =>
    api.eval(
      "(() => {" +
        " const needle = " + JSON.stringify(needle) + ";" +
        " const mode = " + JSON.stringify(mode) + ";" +
        " const hits = [...document.querySelectorAll('*')].filter((el) => (el.innerText || '').includes(needle));" +
        " if (!hits.length) return null;" +
        " const boxOf = (el) => el.closest('article, li, section, [data-run-id], [data-card-id], tr') || el;" +
        " const seen = new Set();" +
        " const scored = [];" +
        " for (const el of hits) { const box = boxOf(el); if (seen.has(box)) continue; seen.add(box);" +
        "   const buttons = box.querySelectorAll('button:not([disabled]), a[href], [role=button], input[type=submit]').length;" +
        "   scored.push({ box, buttons, size: (box.innerText || '').length }); }" +
        " if (!scored.length) return null;" +
        " if (mode === 'tight') scored.sort((a, b) => (a.size - b.size) || (a.buttons - b.buttons));" +
        " else scored.sort((a, b) => (b.buttons - a.buttons) || (a.size - b.size));" +
        " const pick = (mode === 'tight' ? scored[0] : (scored.find((s) => s.buttons > 0) || scored[0]));" +
        " const box = pick.box;" +
        " const marker = 'r' + Math.random().toString(36).slice(2);" +
        " box.setAttribute('data-review-region', marker);" +
        " return { marker, buttons: pick.buttons, size: pick.size, problem: pick.buttons > 0 ? '' : 'no-actionable' };" +
      " })()",
    );
  Object.assign(api, base);
  // Object.assign 会把 getter 的当前值复制成快照（空数组），必须事后重定义实时取值。
  Object.defineProperty(api, "requests", {
    get() {
      return base.requests;
    },
    configurable: true,
  });
  Object.assign(api, {
    async text() {
      return api.eval("document.body.innerText");
    },
    async clickText(label, opts = {}) {
      const scope = opts.within ? await findRegion(opts.within) : null;
      if (opts.within && !scope) {
        if (opts.optional) return false;
        throw new Error("找不到包含文本的区域: " + opts.within);
      }
      const box = await api.eval(
        "(() => {" +
          " const label = " + JSON.stringify(label) + ";" +
          " const marker = " + JSON.stringify(scope ? scope.marker : null) + ";" +
          " const root = marker ? document.querySelector('[data-review-region=\"' + marker + '\"]') : document;" +
          " if (!root) return null;" +
          " const nodes = [...root.querySelectorAll('button, a, [role=button], input[type=submit], input[type=button], label')];" +
          " const hit = nodes.filter((el) => (((el.innerText || el.value || '') + ' ' + (el.getAttribute('aria-label') || '')).trim().includes(label)) && !el.disabled);" +
          " if (!hit.length) return null;" +
          " const el = hit[0];" +
          " el.scrollIntoView({ block: 'center' });" +
          " const r = el.getBoundingClientRect();" +
          " return { x: r.x + r.width / 2, y: r.y + r.height / 2 };" +
        " })()",
      );
      if (!box) {
        if (opts.optional) return false;
        throw new Error("找不到可点击文本: " + label);
      }
      for (const type of ["mousePressed", "mouseReleased"]) {
        await page("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: "left", clickCount: 1 });
      }
      await sleep(150);
      return true;
    },
    async typeInto(withinText, value) {
      const scope = await findRegion(withinText);
      if (!scope) return false;
      const box = await api.eval(
        "(() => {" +
          " const marker = " + JSON.stringify(scope.marker) + ";" +
          " const region = document.querySelector('[data-review-region=\"' + marker + '\"]');" +
          " const field = region && region.querySelector('textarea, input[type=text], [contenteditable=true]');" +
          " const any = field || document.querySelector('textarea, input[type=text], [contenteditable=true]');" +
          " if (!any) return null;" +
          " any.scrollIntoView({ block: 'center' }); any.focus();" +
          " const r = any.getBoundingClientRect();" +
          " return { x: r.x + r.width / 2, y: r.y + r.height / 2 };" +
        " })()",
      );
      if (!box) return false;
      for (const type of ["mousePressed", "mouseReleased"]) {
        await page("Input.dispatchMouseEvent", { type, x: box.x, y: box.y, button: "left", clickCount: 1 });
      }
      await page("Input.insertText", { text: value });
      await sleep(120);
      return true;
    },
    async hasActionableInside(withinText) {
      const scope = await findRegion(withinText, "tight");
      if (!scope) return null;
      return api.eval(
        "(() => {" +
          " const marker = " + JSON.stringify(scope.marker) + ";" +
          " const root = document.querySelector('[data-review-region=\"' + marker + '\"]');" +
          " if (!root) return null;" +
          " const nodes = [...root.querySelectorAll('button:not([disabled]), input[type=submit], [role=button]')];" +
          " return nodes.filter((el) => !el.disabled && el.offsetParent !== null).length > 0;" +
        " })()",
      );
    },
    async countDisabledButtons() {
      return api.eval(
        "(() => [...document.querySelectorAll('button, input[type=submit], [role=button]')].filter((el) => el.disabled || el.getAttribute('aria-disabled') === 'true').length)()",
      );
    },
    /** 只让匹配的请求失败，并统计页面重试了几次。 */
    async failRequests(pattern, options = {}) {
      const state = { attempts: 0, urls: [], errors: [] };
      const ws = base.ws;
      const onEvent = async (event) => {
        const data = JSON.parse(String(event.data));
        if (data.sessionId !== base.sessionId || data.method !== "Fetch.requestPaused") return;
        const url = data.params.request.url;
        try {
          if (url.includes(pattern)) {
            state.attempts += 1;
            state.urls.push(url);
            await page("Fetch.failRequest", { requestId: data.params.requestId, errorReason: "Failed" });
          } else {
            await page("Fetch.continueRequest", { requestId: data.params.requestId });
          }
        } catch (error) {
          state.errors.push(String(error).slice(0, 120));
        }
      };
      ws.addEventListener("message", onEvent);
      await page("Fetch.enable", { patterns: [{ urlPattern: "*", requestStage: "Request" }] });
      return {
        state,
        async stop() {
          try { await page("Fetch.disable"); } catch {}
          ws.removeEventListener("message", onEvent);
        },
      };
    },
    async offline(enabled) {
      await page("Network.emulateNetworkConditions", {
        offline: Boolean(enabled),
        latency: 0,
        downloadThroughput: enabled ? 0 : -1,
        uploadThroughput: enabled ? 0 : -1,
      });
    },
    async block(patterns) {
      await page("Network.setBlockedURLs", { urls: patterns });
    },
    async unblock() {
      await page("Network.setBlockedURLs", { urls: [] });
    },
  });
  return api;
}