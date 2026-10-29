// Touch drag check in a mobile-emulated Chrome (dev only, needs: npm i --no-save puppeteer-core; CHROME=<chrome path>).
// Run with npm run serve on 8131: XOFF=<px> node scripts/touch-check.mjs <url> <selector> [handle] [holdMs] [dx] [dy]
import puppeteer from 'puppeteer-core';

const [url, sel = 'day-rhythm', hi = '1', hold = '400', dx = '0', dy = '60', shot = ''] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new' });
const page = await browser.newPage();
await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36' });
const logs = [];
page.on('console', (m) => logs.push(m.type() + ': ' + m.text()));
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.goto(url, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 800));

const info = await page.evaluate((sel, hi, hsel) => {
  const el = document.querySelector(sel);
  el.scrollIntoView({ block: 'center' });
  const hs = [...el.shadowRoot.querySelectorAll(hsel)];
  const h = hs[+hi] || hs[0];
  h.scrollIntoView({ block: 'center' });
  const r = h.getBoundingClientRect();
  return { n: hs.length, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, hgt: r.height, value: JSON.stringify(el.value), orient: el.shadowRoot.querySelector('.dr-track')?.dataset.orient };
}, sel, hi, process.env.HSEL || '[data-handle]:not([data-alias])');
info.x += +(process.env.XOFF || 0); info.y += +(process.env.YOFF || 0);
const sy0 = await page.evaluate(() => scrollY);
console.log('handles', info.n, 'orient', info.orient, 'at', Math.round(info.x), Math.round(info.y), 'size', info.w, info.hgt);

const c = await page.target().createCDPSession();
const pt = (x, y) => [{ x, y, id: 1, radiusX: 8, radiusY: 8, force: 1 }];
await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(info.x, info.y) });
await new Promise((r) => setTimeout(r, +hold));
const steps = 12;
for (let i = 1; i <= steps; i++) {
  await c.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(info.x + (+dx * i) / steps, info.y + (+dy * i) / steps) });
  await new Promise((r) => setTimeout(r, 16));
}
await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await new Promise((r) => setTimeout(r, 500));
const after = await page.evaluate((sel) => JSON.stringify(document.querySelector(sel).value), sel);
const sy1 = await page.evaluate(() => scrollY);
console.log((after === info.value ? 'NOT MOVED' : 'MOVED') + ' scrolled ' + Math.round(sy1 - sy0));
if (after !== info.value) console.log('before', info.value.slice(0, 160), '\nafter ', after.slice(0, 160));
if (shot) await page.screenshot({ path: shot });
console.log(logs.filter((l) => /error/i.test(l)).slice(0, 5).join('\n'));
await browser.close();
