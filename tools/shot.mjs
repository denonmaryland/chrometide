// Usage: node tools/shot.mjs <outdir> [preset indexes...]  — renders presets in headless Chromium and saves canvas PNGs + one full-page shot.
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import fs from 'fs'; import path from 'path'; import http from 'http';
const require = createRequire(import.meta.url);
const pwPath = process.env.PW_PATH;
const { chromium } = require(pwPath);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const types = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.png':'image/png', '.css':'text/css' };
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0].split('#')[0]).replace(/^\/+/, '') || 'index.html');
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${srv.address().port}/index.html`;
const out = process.argv[2] || 'shots'; fs.mkdirSync(out, { recursive: true });
const which = process.argv.slice(3).map(Number);
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true,
  args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=' + (process.env.ANGLE || 'gl'), '--enable-unsafe-swiftshader'] });
const vw = +(process.env.VW || 1400), vh = +(process.env.VH || 900);
const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: +(process.env.DPR || 1), isMobile: !!process.env.MOBILE, hasTouch: !!process.env.MOBILE });
const logs = []; page.on('console', m => logs.push(m.type() + ': ' + m.text())); page.on('pageerror', e => logs.push('PAGEERROR: ' + e.message));
await page.goto(base); await page.waitForTimeout(500);
const err = await page.evaluate(() => window.__error || null); if (err) { console.log('ERROR', err); }
const info = await page.evaluate(() => { const c = document.createElement('canvas').getContext('webgl2'); const e = c && c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a'; });
console.log('GPU:', info);
const n = await page.evaluate(() => document.querySelectorAll('#thumbs .thumb').length);
const list = which.length ? which : [...Array(n).keys()];
for (const i of list) {
  const t0 = Date.now();
  await page.evaluate(i => window.__setPreset(i), i);
  if (process.env.SIZE) await page.evaluate(s => window.__setSize(s), +process.env.SIZE);
  await page.waitForFunction(() => window.__done === true, null, { timeout: 180000 });
  const data = await page.evaluate(() => document.getElementById('cv').toDataURL('image/png'));
  fs.writeFileSync(path.join(out, `scene-${i}.png`), Buffer.from(data.split(',')[1], 'base64'));
  console.log('scene', i, 'ms', Date.now() - t0);
}
await page.screenshot({ path: path.join(out, process.env.MOBILE ? 'ui-phone.png' : 'ui-desktop.png'), fullPage: !!process.env.FULL });
if (logs.length) console.log(logs.slice(0, 20).join('\n'));
await browser.close(); srv.close();
