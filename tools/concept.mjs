// Usage: PW_PATH=<playwright> node tools/concept.mjs  — drives concept.html in headless Chromium and saves shots/concept-*.png
import { createRequire } from 'module';
import fs from 'fs'; import path from 'path'; import http from 'http';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const types = { '.html':'text/html', '.js':'text/javascript', '.png':'image/png' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0].split('#')[0]).replace(/^\/+/, ''));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${srv.address().port}/concept.html`;
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=gl', '--enable-unsafe-swiftshader'] });
const logs = [];
async function open(vp, mobile) { const page = await browser.newPage({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 });
  page.on('console', m => m.type() === 'error' && logs.push(m.text())); page.on('pageerror', e => logs.push('PAGEERROR ' + e.message));
  await page.goto(url); await settle(page); return page; }
const frame = p => p.frames().find(f => f.url().includes('index.html'));
const settle = async p => { await p.waitForTimeout(700); await frame(p).waitForFunction(() => window.__done === true, null, { timeout: 120000 }); await p.waitForTimeout(500); };
const pix = p => frame(p).evaluate(() => { const c = document.getElementById('cv'), t = document.createElement('canvas'); t.width = 32; t.height = 18; const x = t.getContext('2d'); x.drawImage(c, 0, 0, 32, 18); return Array.from(x.getImageData(0, 0, 32, 18).data).join(','); });
const shot = (p, n) => p.screenshot({ path: path.join(root, 'shots', n) });
const res = {};
const d = await open({ width: 1440, height: 900 }, false);
res.size = await frame(d).evaluate(() => [cv.width, cv.height]);
await shot(d, 'concept-1-home.png');
let a = await pix(d);
await d.click('.room:has-text("Worlds")'); await d.click('.card:has-text("Crag Lagoon")'); await settle(d); let b = await pix(d); res.world = a !== b;
await d.click('.room:has-text("Sky")'); await d.click('.card:has-text("Sherbet")'); await settle(d); a = await pix(d); res.sky = a !== b;
const arc = await d.locator('#arc').boundingBox(); await d.mouse.move(arc.x + arc.width * .3, arc.y + 30); await d.mouse.down(); await d.mouse.move(arc.x + arc.width * .72, arc.y + 30, { steps: 6 }); await d.mouse.up(); await settle(d); b = await pix(d); res.sun = a !== b;
await shot(d, 'concept-2-sky.png');
await d.click('#lk'); res.lockShown = await d.locator('.room.locked').count();
const skyBefore = await d.evaluate(() => window.__concept.st().sky);
await d.click('.dice'); await settle(d); await d.waitForTimeout(600); a = await pix(d); res.dice = a !== b; res.skyKept = (await d.evaluate(() => window.__concept.st().sky)) === skyBefore;
await d.click('.room:has-text("Things")'); await d.click('.card:has-text("Chrome")'); await settle(d); await shot(d, 'concept-3-things.png');
await d.keyboard.press('Escape'); await d.keyboard.press('/'); await d.keyboard.type('dusk'); await d.waitForTimeout(200); await shot(d, 'concept-4-find.png');
b = await pix(d); await d.keyboard.press('Enter'); await settle(d); a = await pix(d); res.command = a !== b;
await d.click('.room:has-text("Worlds")'); await d.click('.card:has-text("Red Moons")'); await settle(d);
await d.click('.room:has-text("Cover")'); await d.fill('#ct', 'Slow Orbit'); await d.waitForTimeout(300); await shot(d, 'concept-5-cover.png'); res.cover = await d.locator('#coverT').textContent();
await d.click('.room:has-text("New")'); await d.waitForTimeout(300); await shot(d, 'concept-6-new.png');
res.history = await d.locator('#hist button').count();
// drag on the picture orbits the camera
await d.keyboard.press('Escape'); a = await pix(d); await d.mouse.move(700, 380); await d.mouse.down(); await d.mouse.move(900, 400, { steps: 8 }); await d.mouse.up(); await settle(d); b = await pix(d); res.orbit = a !== b;
const m = await open({ width: 390, height: 844 }, true);
res.phoneSize = await frame(m).evaluate(() => [cv.width, cv.height]);
res.phoneSideScroll = await m.evaluate(() => document.documentElement.scrollWidth > innerWidth);
await shot(m, 'concept-7-phone.png');
await m.tap('.room:has-text("Sky")'); await m.waitForTimeout(400); await shot(m, 'concept-8-phone-sky.png');
console.log(JSON.stringify(res)); console.log('errors:', logs.slice(0, 10));
await browser.close(); srv.close();
