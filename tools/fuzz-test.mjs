// Mashes the app like a curious stranger: random real clicks on buttons and menu items, drags on the
// picture and the sun, typing in fields, dice, undo and redo, dialogs and modes opened and closed,
// files of every kind (and junk) offered to every file picker. The same seed makes the same run.
// It fails on any page error or console error, a blank picture, or a picture that stops sharpening.
//
//   node tools/fuzz-test.mjs                       (seeds 1 2 3, one minute each)
//   node tools/fuzz-test.mjs --seeds 7,8 --minutes 3
// After a build. The last steps before a failure are printed, so a failure can be replayed.
import fs from "fs"; import path from "path"; import zlib from "zlib"; import { serve, browser, root } from "./serve.mjs"

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d }
const SEEDS = arg("--seeds", "1,2,3").split(",").map(Number), MINUTES = +arg("--minutes", "1")
const rngOf = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }

// files to offer when the app asks for one: real ones, and ones that only pretend
function png(w, h, rgb) { const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1 } return ~c >>> 0 }
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 2; const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3, k = y / h; raw[o] = rgb[0] * (1 - k); raw[o + 1] = rgb[1]; raw[o + 2] = rgb[2] * k + 40 }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]) }
const OBJ = "v 0 0 0\nv 1 0 0\nv 0 1 0\nv 0 0 1\nf 1 2 3\nf 1 2 4\nf 1 3 4\nf 2 3 4\n"
const wav = () => { const n = 8000, b = Buffer.alloc(44 + n * 2); b.write("RIFF", 0); b.writeUInt32LE(36 + n * 2, 4); b.write("WAVEfmt ", 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n * 2, 40); for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(i / 6) * 8000 * (i % 2000 < 300 ? 1 : 0.1)), 44 + i * 2); return b }
const FILES = [
  { name: "sunset.png", mimeType: "image/png", buffer: png(48, 32, [250, 120, 60]) },
  { name: "sea.png", mimeType: "image/png", buffer: png(40, 40, [20, 80, 200]) },
  { name: "shape.obj", mimeType: "text/plain", buffer: Buffer.from(OBJ) },
  { name: "beep.wav", mimeType: "audio/wav", buffer: wav() },
  { name: "lies.png", mimeType: "image/png", buffer: Buffer.from("not a picture at all") },
  { name: "empty.woff2", mimeType: "font/woff2", buffer: Buffer.alloc(0) },
  { name: "broken.glb", mimeType: "model/gltf-binary", buffer: Buffer.concat([Buffer.from("glTF"), Buffer.alloc(30, 3)]) },
  { name: "song.mp3", mimeType: "audio/mpeg", buffer: Buffer.from("this is not music") },
  { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") },
]
const WORDS = ["moon", "", " ", "Ünïcødé ☀", "<img src=x onerror=alert(1)>", "a".repeat(300), "12345", "-1e309", "NaN", "\n\n", "🌊🌊🌊", "Sunset Harbour", "'; DROP TABLE", "%00", "../../etc"]
const KEYS = [" ", " ", "Control+z", "Control+z", "Control+Shift+z", "Escape", "Escape", "ArrowLeft", "ArrowUp", "Delete", "1", "Shift+2", "2", "/", "Control+d", "Tab", "Enter", "Control+k"]

let MS = 60000
async function run(seed, ms) { MS = ms
  const r = rngOf(seed), pick = (a) => a[Math.floor(r() * a.length)]
  const s = await serve(), b = await browser()
  try { return await body(seed, r, pick, s, b) } finally { await b.close().catch(() => {}); s.close() }
}
async function body(seed, r, pick, s, b) {
  const ms = MS; const log = [], trail = [], seen = new Set(), stats = { actions: 0, clicks: 0, drags: 0, keys: 0, typed: 0, files: 0, settles: 0, reloads: 0 }
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true })
  const p = await ctx.newPage()
  if (process.env.FUZZ_DEBUG) await p.addInitScript(() => { const ge = WebGL2RenderingContext.prototype.getExtension; WebGL2RenderingContext.prototype.getExtension = function (n) { const x = ge.call(this, n); if (x && n === "WEBGL_lose_context" && !x.__w) { const o = x.loseContext; x.loseContext = function () { console.log("webgl loseContext called " + new Error().stack.split("\n").slice(1, 6).join(" <- ")); return o.call(this) }; x.__w = 1 } return x }
    addEventListener("webglcontextlost", (e) => console.log("webgl context lost on " + (e.target.closest?.("[data-testid]")?.getAttribute("data-testid") ?? e.target.tagName)), true) })
  if (process.env.FUZZ_SELFTEST) await p.addInitScript(() => setTimeout(() => { throw new Error("planted to check the fuzz test notices") }, 15000))
  ctx.on("page", (pg) => { if (pg !== p) void pg.close().catch(() => {}) }) // links that open new tabs
  p.on("console", (m) => { if (m.type() === "error") log.push(m.text().slice(0, 300)); else if (/context|webgl/i.test(m.text())) trail.push(`  (says: ${m.text().slice(0, 400)})`) }); p.on("pageerror", (e) => log.push("PAGEERROR " + (e.stack ?? e.message).slice(0, 500)))
  p.on("dialog", (d) => void d.dismiss()); p.on("download", (d) => void d.cancel().catch(() => {}))
  p.on("filechooser", (fc) => { stats.files++; const f = r() < 0.15 ? [] : [pick(FILES)]; trail.push(`  file ${f[0]?.name ?? "(none)"}`); void fc.setFiles(f).catch(() => {}) })
  const home = async () => { await p.goto(s.url); await p.waitForFunction(() => window.__engine && window.__app, null, { timeout: 30000 }) }
  await home()
  const fail = async (why) => {
    const shot = path.join(root, "shots", `fuzz-fail-${seed}.png`)
    try { await p.screenshot({ path: shot }); fs.writeFileSync(shot.replace(/\.png$/, ".json"), await p.evaluate(() => JSON.stringify({ world: window.__app.get().world, mask: window.__app.get().mask, size: window.__engine?.size }, null, 1))) } catch { /* the page may be gone */ }
    throw new Error(`${why}\n  picture: ${shot}\n  last steps (seed ${seed}):\n${trail.slice(-25).join("\n")}`) }
  const viewportCanvas = () => p.evaluate(() => { const c = document.querySelector('[data-testid="viewport"] canvas'); if (!c) return null; const b = c.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height } })

  /** Everything a person could press, with where it is. */
  const targets = () => p.evaluate(() => {
    const sel = 'button, [role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"], [role="tab"], [role="radio"], [role="option"], [role="switch"], [role="checkbox"], a[href], [data-testid^="starter-"], summary'
    const out = []
    for (const el of document.querySelectorAll(sel)) {
      if (el.closest("[inert]") || el.matches(":disabled, [aria-disabled='true']")) continue
      const b = el.getBoundingClientRect(); if (b.width < 3 || b.height < 3 || b.bottom < 0 || b.right < 0 || b.top > innerHeight || b.left > innerWidth) continue
      const x = b.left + b.width / 2, y = b.top + b.height / 2, top = document.elementFromPoint(x, y); if (!top || !(el === top || el.contains(top))) continue
      const href = el.getAttribute("href"); if (href && /^(https?:|mailto:)/.test(href) && !href.startsWith(location.origin)) continue // leave the site alone
      const label = (el.getAttribute("aria-label") || el.textContent || el.getAttribute("data-testid") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40)
      out.push({ x, y, label, menu: el.matches('[role^="menuitem"]') })
    }
    return out
  })
  const fields = () => p.evaluate(() => [...document.querySelectorAll('input:not([type="file"]):not([type="range"]):not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable="true"]')]
    .map((el) => { const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height, label: (el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.name || el.tagName).slice(0, 30) } })
    .filter((f) => f.w > 4 && f.h > 4 && f.x > 0 && f.y > 0 && f.x < innerWidth && f.y < innerHeight))
  const sliders = () => p.evaluate(() => [...document.querySelectorAll('[role="slider"], input[type="range"]')].map((el) => { const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height } }).filter((f) => f.w > 4 && f.x > 0 && f.y > 0 && f.x < innerWidth && f.y < innerHeight))

  /** Close everything, wait, and check the picture is there and finishes. */
  async function settle() {
    stats.settles++
    for (let i = 0; i < 3; i++) { await p.keyboard.press("Escape").catch(() => {}); await p.waitForTimeout(120) }
    if (!p.url().startsWith(s.url) || /gallery|embed/.test(p.url()) || !(await p.evaluate(() => !!window.__app).catch(() => false))) { trail.push("  (went to another page: back home)"); stats.reloads++; await home() }
    const live = await p.evaluate(() => { const a = window.__app.get(); return a.sounding || a.playing || document.querySelector('[data-testid$="-overlay"], [data-mode-live]') !== null })
    const stays = await p.evaluate(() => [...document.querySelectorAll('[role="dialog"], [role="menu"], [role="alertdialog"]')].filter((d) => { const b = d.getBoundingClientRect(); return b.width > 0 && b.height > 0 && getComputedStyle(d).visibility !== "hidden" }).map((d) => (d.getAttribute("aria-label") || d.textContent || "").trim().slice(0, 50)))
    if (stays.length) { await p.waitForTimeout(800); for (let i = 0; i < 2; i++) await p.keyboard.press("Escape"); await p.waitForTimeout(400)
      const still = await p.evaluate(() => [...document.querySelectorAll('[role="dialog"], [role="menu"], [role="alertdialog"]')].filter((d) => d.getBoundingClientRect().width > 0).length)
      if (still) await fail(`Escape did not close: ${stays.join(" / ")}`) }
    if (await p.locator('[data-testid="trouble"]').count()) await fail("the safety page appeared: " + (await p.locator('[data-testid="trouble"]').textContent()))
    if (live) { stats.live = (stats.live ?? 0) + 1; trail.push("  (a live mode is on: not waiting for sharp)"); return }
    let last = "", same = 0
    for (let t = 0; t < 120; t++) {
      const st = await p.evaluate(() => { const e = window.__engine, a = window.__app.get(); return { done: !!e?.done, s: JSON.stringify(a.status), lost: e?.lost, paused: e?.paused, hidden: !document.querySelector('[data-testid="viewport"] canvas'),
        why: JSON.stringify({ lost: e?.lost, live: e?.live, dirty: e?.dirty, sinceChange: Math.round(performance.now() - e?.lastChange), sinceTick: Math.round(performance.now() - e?.lastTick), livePhase: e?.livePhase, phase: a.phase, playing: a.playing, sounding: a.sounding, dialog: a.dialog, overlay: document.querySelector('[data-testid="context-lost"]')?.textContent?.slice(0, 40) }) } })
      if (st.done || st.hidden) break
      same = st.s === last ? same + 1 : 0; last = st.s
      if (same > 40) await fail(`the picture stopped sharpening: ${st.s} ${st.why}`)
      await p.waitForTimeout(500)
    }
    const measure = () => p.evaluate(() => { const c = document.querySelector('[data-testid="viewport"] canvas'); if (!c) return 99; const t = document.createElement("canvas"); t.width = 32; t.height = 20; const x = t.getContext("2d"); x.drawImage(c, 0, 0, 32, 20); const d = x.getImageData(0, 0, 32, 20).data; let lo = 255, hi = 0; for (let i = 0; i < d.length; i += 4) { const v = d[i] + d[i + 1] + d[i + 2]; lo = Math.min(lo, v); hi = Math.max(hi, v) } return hi - lo })
    let spread = await measure()
    if (spread < 3) { await p.waitForTimeout(1500); await p.waitForFunction(() => window.__engine?.done, null, { timeout: 30000 }).catch(() => {}); spread = await measure() } // a canvas just resized is clear for a frame
    if (spread < 3) await fail(`the picture is blank (spread ${spread})`)
  }

  const t0 = Date.now(); let next = 30
  while (Date.now() - t0 < ms) {
    if (log.length) await fail("error on the page:\n    " + log.slice(0, 3).join("\n    "))
    const roll = r(); stats.actions++
    try {
      if (roll < 0.12) { // open a mode, a dialog or a menu on purpose, then carry on from there
        const opener = pick(['[data-testid="modes-menu"]', '[data-testid="modes-menu"]', '[data-testid="file-menu"]', '[data-testid="open-cover"]', '[data-testid="open-loop"]', '[data-testid="open-timeline"]', '[data-testid="embed"]', '[data-testid="share"]', '[data-testid="save"]'])
        const el = p.locator(opener).first(); if (!(await el.isVisible().catch(() => false))) continue
        trail.push(`open ${opener}`); await el.click({ timeout: 2000 }).catch(() => {})
        await p.waitForTimeout(250); const items = (await targets()).filter((t) => t.menu); if (items.length) { const t = pick(items); trail.push(`  then "${t.label}"`); seen.add(t.label); await p.mouse.click(t.x, t.y) }
      } else if (roll < 0.16) { // mash: the same thing many times, no pause
        const all = await targets(); if (!all.length) continue; const t = pick(all), n = 3 + Math.floor(r() * 8)
        trail.push(`mash "${t.label}" x${n}`); for (let i = 0; i < n; i++) await p.mouse.click(t.x, t.y, { delay: 0 })
      } else if (roll < 0.17) { // a different screen: phone, tablet, wide
        const v = pick([[390, 844], [844, 390], [768, 1024], [1280, 800], [1920, 1080], [320, 560]]); trail.push(`screen ${v.join("x")}`); await p.setViewportSize({ width: v[0], height: v[1] })
      } else if (roll < 0.42) { // press something
        const all = await targets(); if (!all.length) continue
        const menu = all.filter((t) => t.menu), t = menu.length && r() < 0.7 ? pick(menu) : pick(all)
        trail.push(`click "${t.label}"`); seen.add(t.label); await p.mouse.click(t.x, t.y); stats.clicks++
      } else if (roll < 0.6) { // drag the picture (look around, move a thing, the sun near the top, sculpt)
        const c = await viewportCanvas(); if (!c) continue
        const x0 = c.x + c.w * (0.1 + r() * 0.8), y0 = c.y + c.h * (r() < 0.3 ? 0.05 + r() * 0.25 : 0.2 + r() * 0.7), dx = (r() - 0.5) * c.w * 0.6, dy = (r() - 0.5) * c.h * 0.5
        trail.push(`drag ${Math.round(x0)},${Math.round(y0)} by ${Math.round(dx)},${Math.round(dy)}`)
        if (r() < 0.2) await p.keyboard.down("Shift")
        await p.mouse.move(x0, y0); await p.mouse.down(); for (let i = 1; i <= 6; i++) await p.mouse.move(x0 + (dx * i) / 6, y0 + (dy * i) / 6); await p.mouse.up(); await p.keyboard.up("Shift"); stats.drags++
        if (r() < 0.15) { trail.push("  double-click"); await p.mouse.dblclick(x0, y0) }
      } else if (roll < 0.66) { // a little zoom
        const c = await viewportCanvas(); if (!c) continue; trail.push("wheel"); await p.mouse.move(c.x + c.w / 2, c.y + c.h / 2); await p.mouse.wheel(0, (r() - 0.5) * 900)
      } else if (roll < 0.76) { // type into a field
        const f = await fields(); if (!f.length) continue; const t = pick(f), w = pick(WORDS)
        trail.push(`type ${JSON.stringify(w.slice(0, 20))} into "${t.label}"`); await p.mouse.click(t.x, t.y); await p.keyboard.press("Control+a"); await p.keyboard.type(w.slice(0, 80), { delay: 0 }); if (r() < 0.5) await p.keyboard.press("Enter"); stats.typed++
        if (r() < 0.6) { await p.mouse.click(5, 795) } // click away
      } else if (roll < 0.83) { // a slider, by keys
        const sl = await sliders(); if (!sl.length) continue; const t = pick(sl); trail.push("slider"); await p.mouse.click(t.x - t.w * 0.4 + r() * t.w * 0.8, t.y); for (let i = 0; i < 3; i++) await p.keyboard.press(pick(["ArrowRight", "ArrowLeft", "End", "Home", "PageUp"]))
      } else { // keys
        const k = pick(KEYS); trail.push(`key ${k}`); await p.keyboard.press(k); stats.keys++
      }
    } catch (e) { if (/Target (page|closed)|Execution context was destroyed|navigation/i.test(String(e.message))) { trail.push("  (page changed)"); await p.waitForTimeout(500) } else throw e }
    await p.waitForTimeout(40 + r() * 160)
    if (stats.actions >= next) { next += 30 + Math.floor(r() * 20); trail.push("-- settle"); await settle() }
  }
  await settle()
  if (log.length) await fail("error on the page:\n    " + log.slice(0, 3).join("\n    "))
  stats.distinct = seen.size; if (process.env.FUZZ_LABELS) console.log([...seen].join(" | "))
  return stats
}

let failed = false
for (const seed of SEEDS) {
  const t0 = Date.now()
  try { const st = await run(seed, MINUTES * 60000); console.log(`seed ${seed}: calm after ${((Date.now() - t0) / 60000).toFixed(1)} min`, JSON.stringify(st)) }
  catch (e) { failed = true; console.log(`seed ${seed}: FAILED after ${((Date.now() - t0) / 60000).toFixed(1)} min\n${e.message}`) }
}
process.exit(failed ? 1 : 0)
