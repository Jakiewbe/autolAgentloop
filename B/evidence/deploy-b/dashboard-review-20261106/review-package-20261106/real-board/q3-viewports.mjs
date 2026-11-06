// q3-viewports.mjs：两档真实视口（1440x900 / 390x844）实测 innerWidth、scrollWidth、
// 是否横向滚动、devicePixelRatio，并为每档单独截图。不依赖旧 record。
import { mkdirSync, writeFileSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { bootBoard } from "./board.mjs";
import { attachRealPage } from "./page-real.mjs";
import { openBrowser } from "../selftest-v2/cdp.mjs";
import { hub2 } from "../selftest-v2/lib2.mjs";

const EVID = path.join(import.meta.dirname, "..", "evidence");
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");
function pngSize(file) {
  const buf = readFileSync(file);
  if (buf.length < 24 || buf.toString("ascii", 1, 4) !== "PNG") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), bytes: buf.length };
}

async function main() {
  const dir = path.join(EVID, "q3-viewports-" + stamp());
  mkdirSync(dir, { recursive: true });
  const board = await bootBoard();
  const hub = hub2({ publicUrl: board.hub.publicUrl, keys: board.hub.keys, home: board.hub.home });
  const measured = [];
  const checks = [];
  try {
    await hub.ask("Q3 视口探针卡片", ["甲", "乙"]);
    for (const spec of [{ width: 1440, height: 900, dpr: 1 }, { width: 1440, height: 900, dpr: 2 }, { width: 390, height: 844, dpr: 3 }]) {
      const raw = await openBrowser({ width: spec.width, height: spec.height });
      const page = attachRealPage(raw, board.url, { keys: board.hub.keys });
      try {
        await raw.send("Emulation.setDeviceMetricsOverride", {
          width: spec.width, height: spec.height, deviceScaleFactor: spec.dpr, mobile: spec.width < 600,
        });
        if (spec.width < 600) await raw.send("Emulation.setTouchEmulationEnabled", { enabled: true });
        await page.view("attention");
        await page.waitFor("#view-content", 8000);
        const json = await page.raw.eval(
          "JSON.stringify({" +
          " innerWidth: window.innerWidth, innerHeight: window.innerHeight," +
          " scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth," +
          " bodyScrollWidth: document.body.scrollWidth, devicePixelRatio: window.devicePixelRatio," +
          " hasHScroll: (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) || (document.body.scrollWidth > document.documentElement.clientWidth + 1)," +
          " mq: matchMedia('(max-width: 600px)').matches," +
          " visualViewportWidth: window.visualViewport ? window.visualViewport.width : null," +
          " screenWidth: window.screen.width, outerWidth: window.outerWidth" +
          "})",
        );
        const box = JSON.parse(json);
        const shot = path.join(dir, "viewport-" + spec.width + "x" + spec.height + "-dpr" + spec.dpr + ".png");
        await page.screenshot(shot);
        measured.push({ requested: { width: spec.width, height: spec.height, deviceScaleFactor: spec.dpr }, ...box, shot: path.basename(shot), shotSize: pngSize(shot) });
      } finally {
        await page.close().catch(() => {});
      }
    }
    const wide = measured.filter((m) => m.requested.width === 1440);
    const narrow = measured.filter((m) => m.requested.width === 390);
    checks.push({ name: "1440x900 视口按请求生效", ok: wide.every((m) => m.innerWidth === 1440 && m.innerHeight === 900), detail: JSON.stringify(wide.map((m) => [m.innerWidth, m.innerHeight])) });
    checks.push({ name: "390x844 视口按请求生效", ok: narrow.every((m) => m.innerWidth === 390 && m.innerHeight === 844), detail: JSON.stringify(narrow.map((m) => [m.innerWidth, m.innerHeight])) });
    checks.push({ name: "两档均无横向滚动", ok: measured.every((m) => m.hasHScroll === false), detail: JSON.stringify(measured.map((m) => [m.requested.width, m.scrollWidth, m.clientWidth, m.hasHScroll])) });
    checks.push({ name: "DPR 真实生效（请求 1/2/3 全部命中）", ok: measured.map((m) => m.devicePixelRatio).join(",") === "1,2,3", detail: JSON.stringify(measured.map((m) => [m.requested.width, m.requested.deviceScaleFactor, m.devicePixelRatio])) });
    checks.push({ name: "截图按设备像素落盘（宽=CSS宽×DPR）", ok: measured.every((m) => m.shotSize && m.shotSize.width === m.requested.width * m.requested.deviceScaleFactor), detail: JSON.stringify(measured.map((m) => [m.shot, m.shotSize && m.shotSize.width, m.shotSize && m.shotSize.height])) });
    const record = { case: "q3-viewports", at: new Date().toISOString(), measured, checks };
    writeFileSync(path.join(dir, "record.json"), JSON.stringify(record, null, 2));
    console.log("Q3 " + JSON.stringify({ checks: checks.map((c) => [c.name, c.ok]), measured: measured.map((m) => ({ vp: m.requested, inner: [m.innerWidth, m.innerHeight], scroll: [m.scrollWidth, m.clientWidth], hscroll: m.hasHScroll, dpr: m.devicePixelRatio, shot: m.shotSize })) }, null, 1));
    console.log("Q3_DIR " + dir);
  } finally {
    for (const child of board.children || []) { try { child.kill(); } catch {} }
  }
}
main().catch((error) => { console.error("Q3_FAIL " + (error && error.stack || error)); process.exit(1); });
