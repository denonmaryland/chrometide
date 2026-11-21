// Usage: node tools/ui.mjs <outdir> — UI screenshots: desktop, phone, mid-render (blocky), mid-drag (wireframe), after randomize, share-link reload.
import { createRequire } from 'module'; import fs from 'fs'; import path from 'path'; import http from 'http';
const require = createRequire(import.meta.url); const { chromium } = require(process.env.PW_PATH);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const types = { '.html':'text/html', '.js':'text/javascript' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise(ok => srv.listen(0, '127.0.0.1', ok)); const base = `http://127.0.0.1:${srv.address().port}/index.html`;
const out = process.argv[2] || 'shots'; fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=gl'] });
const done = p => p.waitForFunction(() => window.__done === true, null, { timeout: 120000 });
const res = {};
{ const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }); await ctx.grantPermissions(['clipboard-read', 'clipboard-write']); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errs.push(m.text()); });
  await page.goto(base); await page.waitForTimeout(260); await page.screenshot({ path: path.join(out, 'ui-blocky.png') });
  await page.waitForTimeout(900); await page.screenshot({ path: path.join(out, 'ui-sweep.png') });
  await done(page); await page.screenshot({ path: path.join(out, 'ui-desktop.png') });
  // drag to orbit -> wireframe preview
  await page.evaluate(() => window.__setPreset(3)); await done(page);
  const b = await page.locator('#cv').boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down(); await page.mouse.move(b.x + b.width / 2 + 90, b.y + b.height / 2 + 20, { steps: 5 });
  await page.waitForTimeout(60); await page.screenshot({ path: path.join(out, 'ui-wire.png') }); await page.mouse.up(); await done(page);
  // controls
  await page.locator('#sunpad').click({ position: { x: 90, y: 40 } }); await done(page); res.sun = await page.evaluate(() => location.hash.length > 10);
  await page.locator('#skies .chip').nth(1).click(); await done(page);
  await page.locator('#haze').fill('0.8'); await page.locator('#mats .chip').nth(0).click(); await done(page);
  await page.locator('#newland').click(); await done(page); await page.screenshot({ path: path.join(out, 'ui-edited.png') });
  for (let i = 0; i < 6; i++) { await page.locator('#dice').click(); await done(page); const d = await page.evaluate(() => document.getElementById('cv').toDataURL('image/png')); fs.writeFileSync(path.join(out, `rand-${i}.png`), Buffer.from(d.split(',')[1], 'base64')); }
  // share link round trip
  await page.locator('#share').click(); const link = await page.evaluate(() => navigator.clipboard.readText()); const a = await page.evaluate(() => document.getElementById('cv').toDataURL('image/png'));
  const p2 = await ctx.newPage(); await p2.goto(link); await done(p2); const b2 = await p2.evaluate(() => document.getElementById('cv').toDataURL('image/png')); res.shareSame = a === b2; res.linkLen = link.length;
  // export
  const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('#save').click()]); const f = path.join(out, 'export-test.png'); await dl.saveAs(f); res.exportBytes = fs.statSync(f).size;
  // sizes
  for (const s of [0, 2, 3, 4]) { const t = Date.now(); await page.evaluate(s => { window.__setPreset(2); window.__setSize(s); }, s); await done(page); res['size' + s] = (await page.evaluate(() => cv.width + 'x' + cv.height)) + ' ' + (Date.now() - t) + 'ms'; }
  res.errors = errs; await ctx.close(); }
{ const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); const page = await ctx.newPage();
  await page.goto(base); await done(page); await page.screenshot({ path: path.join(out, 'ui-phone.png') }); await page.screenshot({ path: path.join(out, 'ui-phone-full.png'), fullPage: true });
  res.phoneOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth); await ctx.close(); }
console.log(JSON.stringify(res, null, 1)); await browser.close(); srv.close();
