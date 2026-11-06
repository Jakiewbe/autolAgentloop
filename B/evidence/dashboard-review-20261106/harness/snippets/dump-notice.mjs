import { launch, openBrowser } from "../cdp.mjs";
const url = process.argv[2] || "http://127.0.0.1:8791/";
const info = await launch({ headless: true });
const browser = await openBrowser(info, url);
await browser.goto(url);
await new Promise((r) => setTimeout(r, 3000));
const out = await browser.eval("(() => { const secs = [...document.querySelectorAll('section')]; const hit = secs.find((s) => (s.querySelector('h2')||{}).textContent && s.querySelector('h2').textContent.indexOf('通知') >= 0); if (!hit) return 'NO_SECTION'; const btns = [...hit.querySelectorAll('button, [role=button], input[type=submit]')].map((b) => b.outerHTML.slice(0,80)); return JSON.stringify({ html: hit.outerHTML.slice(0, 1400), btns }); })()");
console.log(out);
process.exit(0);
