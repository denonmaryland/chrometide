// Tests for the three retro-branch features, in headless Chromium:
//   node tools/retro-test.mjs [words|sheet|retro|saver|phone|all]
// words: word -> world is the same every time and differs between words; ?seed= boots it.
// sheet: a contact sheet of worlds grown from words (shots/words-sheet*.png) to look at.
// retro: 1994 mode crawls line by line, dithers to 256 colours, saves a PNG and films a clip.
// saver: the screensaver starts from ?screensaver, moves, cross-fades to a new world, exits on a key.
import path from "path"; import fs from "fs"; import { execFileSync } from "child_process"; import { serve, browser, root } from "./serve.mjs"
const what = process.argv[2] || "all", want = (k) => what === "all" || what === k
const s = await serve(), b = await browser(["--autoplay-policy=no-user-gesture-required"]); const logs = [], res = {}
fs.mkdirSync(path.join(root, "shots"), { recursive: true })
const out = (n) => path.join(root, "shots", n)
async function page(q = "", vp = { width: 1440, height: 900 }) {
  const ctx = await b.newContext({ viewport: vp, acceptDownloads: true }); const p = await ctx.newPage()
  p.on("console", (m) => (m.type() === "error" || m.text().includes("SHADER")) && logs.push(m.text().slice(0, 300))); p.on("pageerror", (e) => logs.push("PAGEERROR " + e.message.slice(0, 300)))
  await p.goto(s.url + q); await p.waitForFunction(() => window.__engine && window.__app, null, { timeout: 60000 })
  return { p, ctx }
}
const done = (p, t = 90000) => p.waitForFunction(() => window.__engine && window.__engine.done, null, { timeout: t }).catch(() => logs.push("not done"))
const savePng = (dataUrl, n) => fs.writeFileSync(out(n), Buffer.from(dataUrl.split(",")[1], "base64"))
const WORDS = ["Velvet", "Tokyo", "Marigold", "Radiohead", "Lighthouse", "Juniper", "Neptune", "Brian Eno", "Glasgow", "Static", "Amelia", "Harbour", "Kyoto", "Sunday", "Moth", "Saturn", "Lisbon", "Orchid", "Prism", "Ocean Drive", "Denver", "Hazel", "Jupiter", "Fog", "Bowie", "Reykjavik", "Pixel", "Grandma", "Mango", "Nirvana", "Cairo", "Blue", "Oslo", "Tuesday", "Kraftwerk", "Daisy"]

try {
  if (want("words")) {
    const { p, ctx } = await page("?seed=Velvet%20Harbour"); await done(p)
    const w = await p.evaluate(() => window.__app.get().world); res.bootName = w.name; res.bootThings = w.things.length
    res.sameTwice = await p.evaluate(() => JSON.stringify(window.__words.wordWorld("Tokyo")) === JSON.stringify(window.__words.wordWorld("Tokyo")))
    res.caseSpace = await p.evaluate(() => JSON.stringify({ ...window.__words.wordWorld("  tokyo "), name: 0 }) === JSON.stringify({ ...window.__words.wordWorld("Tokyo"), name: 0 }))
    res.bootMatches = await p.evaluate(() => JSON.stringify(window.__words.wordWorld("Velvet Harbour")) === JSON.stringify(window.__app.get().world))
    const all = await p.evaluate((ws) => ws.map((x) => JSON.stringify({ ...window.__words.wordWorld(x), name: 0 })), WORDS); res.allDifferent = new Set(all).size === all.length
    fs.writeFileSync(out("words-tokyo.json"), await p.evaluate(() => JSON.stringify(window.__words.wordWorld("Tokyo"))))
    // the same word in a fresh page (another "computer") gives the same JSON
    const { p: p2, ctx: c2 } = await page(); res.sameInFreshPage = (await p2.evaluate(() => JSON.stringify(window.__words.wordWorld("Tokyo")))) === fs.readFileSync(out("words-tokyo.json"), "utf8"); await c2.close()
    // the dice still roll freely
    res.diceStillRandom = await p.evaluate(() => { window.__app.rollDice(); const a = JSON.stringify(window.__app.get().world.sky); window.__app.rollDice(); return a !== JSON.stringify(window.__app.get().world.sky) })
    // the box in the Keep popover
    await p.click('button:has-text("Keep")'); await p.fill('[data-testid="word-input"]', "Glasgow"); await p.screenshot({ path: out("words-popover.png") }); await p.click('[data-testid="word-go"]'); await p.waitForTimeout(300)
    res.popoverName = await p.evaluate(() => window.__app.get().world.name); await p.keyboard.press("Escape"); await done(p); await p.screenshot({ path: out("words-glasgow.png") })
    await ctx.close()
  }
  if (want("sheet")) {
    const { p, ctx } = await page(); await done(p)
    for (let k = 0; k < WORDS.length; k += 12) {
      const url = await p.evaluate((ws) => {
        const W = 360, H = 270, cols = 4, sheet = document.createElement("canvas"); sheet.width = W * cols; sheet.height = (H + 22) * Math.ceil(ws.length / cols); const x = sheet.getContext("2d"); x.fillStyle = "#111"; x.fillRect(0, 0, sheet.width, sheet.height)
        ws.forEach((word, i) => { const w = window.__words.wordWorld(word), c = window.__engine.frame(w, W, H, 6), cx = (i % cols) * W, cy = Math.floor(i / cols) * (H + 22)
          x.drawImage(c, cx, cy); x.fillStyle = "#eee"; x.font = "13px sans-serif"; x.fillText(`${word}  ·  ${w.sky.zenith} ${w.sea.kind} ${w.land.on ? w.land.mode : "-"} ${w.things.length}`, cx + 6, cy + H + 15) })
        return sheet.toDataURL("image/png") }, WORDS.slice(k, k + 12))
      savePng(url, `words-sheet${k / 12 + 1}.png`)
    }
    await ctx.close()
  }
  if (want("retro")) {
    const { p, ctx } = await page("?1994"); await p.waitForFunction(() => window.__retro, null, { timeout: 30000 })
    const cvPix = () => p.evaluate(() => { const c = document.querySelector('[data-testid="retro-canvas"]'), t = document.createElement("canvas"); t.width = 64; t.height = 48; const x = t.getContext("2d"); x.drawImage(c, 0, 0, 64, 48); return Array.from(x.getImageData(0, 0, 64, 48).data).join(",") })
    await p.waitForTimeout(1500); await p.screenshot({ path: out("retro-1-boot.png") })
    await p.waitForFunction(() => window.__retro.phase() === "crawl", null, { timeout: 60000 })
    const t0 = Date.now(); res.colours = await p.evaluate(() => window.__retro.colours())
    await p.waitForFunction(() => window.__retro.progress() > 0.4, null, { timeout: 60000 }); await p.screenshot({ path: out("retro-2-crawl.png") })
    const a = await cvPix(), p1 = await p.evaluate(() => window.__retro.progress()); await p.waitForTimeout(1500); const p2 = await p.evaluate(() => window.__retro.progress())
    res.crawlMoves = p2 > p1 && (await cvPix()) !== a; res.secsFor10pct = +((1.5 / (p2 - p1)) / 10).toFixed(1)
    await p.waitForFunction(() => window.__retro.phase() === "done", null, { timeout: 90000 }); res.crawlSeconds = Math.round((Date.now() - t0) / 100) / 10
    await p.screenshot({ path: out("retro-3-done.png") }); await p.waitForTimeout(3800); await p.screenshot({ path: out("retro-4-clean.png") })
    const cv = await p.locator('[data-testid="retro-canvas"]').boundingBox(); await p.screenshot({ path: out("retro-5-closeup.png"), clip: { x: cv.x + cv.width * 0.35, y: cv.y + cv.height * 0.3, width: 360, height: 270 } })
    for (const k of ["glow", "lines", "curve"]) await p.click(`[aria-label="${k}"]`); await p.waitForTimeout(300); await p.screenshot({ path: out("retro-6-plain.png"), clip: { x: cv.x + cv.width * 0.35, y: cv.y + cv.height * 0.3, width: 360, height: 270 } })
    for (const k of ["glow", "lines", "curve"]) await p.click(`[aria-label="${k}"]`)
    const [dl] = await Promise.all([p.waitForEvent("download"), p.click('[data-testid="retro-png"]')]); const f = out("retro-out.png"); await dl.saveAs(f)
    const png = fs.readFileSync(f); res.pngBytes = png.length; res.pngSize = `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`
    await p.click('[data-testid="retro-film"]'); await p.waitForTimeout(6000); await p.screenshot({ path: out("retro-7-filming.png") })
    await p.waitForSelector('[data-testid="retro-clip"]', { timeout: 60000 })
    const [dl2] = await Promise.all([p.waitForEvent("download"), p.click('[data-testid="retro-clip"]')]); const fv = out("retro-out.webm"); await dl2.saveAs(fv); res.clipBytes = fs.statSync(fv).size
    try { const pr = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-count_frames", "-show_entries", "stream=codec_name,width,height,nb_read_frames:format=duration", "-of", "json", fv]).toString()); res.clip = { codec: pr.streams[0].codec_name, size: `${pr.streams[0].width}x${pr.streams[0].height}`, frames: +pr.streams[0].nb_read_frames, seconds: +(+pr.format.duration).toFixed(1) } } catch (e) { res.clip = "ffprobe failed " + e.message.slice(0, 100) }
    // a new world while open crawls again; Escape goes back to the normal app, which renders as before
    await p.keyboard.press(" "); await p.waitForFunction(() => window.__retro.phase() === "warm", null, { timeout: 5000 }).then(() => (res.spaceRerolls = true)).catch(() => (res.spaceRerolls = false))
    await p.keyboard.press("Escape"); await p.waitForTimeout(300); res.closed = (await p.locator('[data-testid="retro"]').count()) === 0
    await done(p); res.normalDone = await p.evaluate(() => window.__engine.done); await p.screenshot({ path: out("retro-8-back.png") })
    await ctx.close()
  }
  if (want("phone")) {
    const { p, ctx } = await page("?1994", { width: 390, height: 844 }); await p.waitForFunction(() => window.__retro && window.__retro.progress() > 0.3, null, { timeout: 90000 }); await p.screenshot({ path: out("retro-phone.png") }); await ctx.close()
  }
  if (want("saver")) {
    const { p, ctx } = await page("?screensaver"); await p.waitForFunction(() => window.__saver && window.__saver.stat.name, null, { timeout: 60000 })
    const sv = () => p.evaluate(() => ({ ...window.__saver.stat }))
    const cvPix = (sel) => p.evaluate((sel) => { const c = document.querySelector(sel), t = document.createElement("canvas"); t.width = 64; t.height = 40; const x = t.getContext("2d"); x.drawImage(c, 0, 0, 64, 40); return Array.from(x.getImageData(0, 0, 64, 40).data) }, sel)
    const diff = (a, b) => a.reduce((n, v, i) => n + Math.abs(v - b[i]), 0) / a.length
    await p.waitForTimeout(1500); await p.screenshot({ path: out("saver-1-start.png") })
    res.cursorHidden = await p.evaluate(() => getComputedStyle(document.querySelector('[data-testid="screensaver"]')).cursor === "none")
    res.hintShown = await p.locator('[data-testid="saver-hint"]').isVisible()
    await p.waitForTimeout(5000); const a = await cvPix('[data-testid="screensaver"] canvas'); await p.waitForTimeout(4000); const b2 = await cvPix('[data-testid="screensaver"] canvas')
    res.liveMoves = +diff(a, b2).toFixed(2); const s1 = await sv(); res.fps = s1.fps; res.first = s1.name; await p.screenshot({ path: out("saver-2-drift.png") })
    res.liveDiv = await p.evaluate(() => window.__saver.engine.liveDiv)
    // the next world: traced offscreen, then faded in
    await p.evaluate(() => window.__saver.next())
    await p.waitForFunction(() => { const o = document.querySelectorAll('[data-testid="screensaver"] canvas')[1]; return +o.style.opacity > 0.3 && +o.style.opacity < 0.8 }, null, { timeout: 60000 }).catch(() => logs.push("no fade seen"))
    await p.screenshot({ path: out("saver-3-fade.png") })
    await p.waitForFunction((n) => window.__saver.stat.worlds > n, s1.worlds, { timeout: 60000 }); res.second = (await sv()).name; res.changed = res.second !== res.first
    await p.waitForTimeout(5000); await p.screenshot({ path: out("saver-4-second.png") })
    // the worlds move to music when a song plays
    await p.evaluate(async () => { const sr = 44100, n = sr * 8, d = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / sr, bt = t % 0.5; d[i] = Math.sin(2 * Math.PI * 50 * bt) * Math.exp(-bt * 9) * 0.9 }
      const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
      w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true)
      for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, d[i] * 32767, true)
      await window.__audio.loadSong(new Blob([buf], { type: "audio/wav" }), "beat.wav"); await window.__audio.audioEl().play(); window.__app.patch({ sounding: true }) })
    await p.waitForTimeout(1500); res.musical = (await sv()).musical
    await p.evaluate(() => { window.__audio.audioEl().pause(); window.__app.patch({ sounding: false }) })
    // a small mouse move does nothing, a real one goes back
    await p.mouse.move(700, 450); await p.mouse.move(703, 451); await p.waitForTimeout(200); res.smallMoveStays = (await p.locator('[data-testid="screensaver"]').count()) === 1
    await p.mouse.move(900, 600, { steps: 4 }); await p.waitForTimeout(300); res.moveExits = (await p.locator('[data-testid="screensaver"]').count()) === 0
    await done(p); res.appBack = await p.evaluate(() => window.__engine.done); await p.screenshot({ path: out("saver-5-back.png") })
    // from the menu, and a key goes back
    await p.click('[data-testid="modes-menu"]'); await p.click('[data-testid="mode-screensaver"]'); await p.waitForFunction(() => window.__saver && window.__saver.stat.name, null, { timeout: 60000 })
    await p.waitForTimeout(1200); await p.keyboard.press("k"); await p.waitForTimeout(300); res.keyExits = (await p.locator('[data-testid="screensaver"]').count()) === 0
    await ctx.close()
    const ph = await page("?screensaver", { width: 390, height: 844 }); await ph.p.waitForFunction(() => window.__saver && window.__saver.stat.name, null, { timeout: 60000 }); await ph.p.waitForTimeout(7000); await ph.p.screenshot({ path: out("saver-phone.png") }); await ph.ctx.close()
  }
} catch (e) { logs.push("TEST ERROR " + String(e.stack || e).slice(0, 600)) }
console.log(JSON.stringify(res, null, 1)); console.log(logs.slice(0, 12).join("\n") || "no errors")
await b.close(); s.close()
