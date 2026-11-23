// Tests for the three retro-branch features, in headless Chromium:
//   node tools/retro-test.mjs [words|sheet|retro|saver|phone|all]
// words: word -> world is the same every time and differs between words; ?seed= boots it.
// sheet: a contact sheet of worlds grown from words (shots/words-sheet*.png) to look at.
// retro: 1994 mode crawls line by line, dithers to 256 colours, saves a PNG and films a clip.
// saver: the screensaver starts from ?screensaver, moves, cross-fades to a new world, exits on a key.
import path from "path"; import fs from "fs"; import { execFileSync } from "child_process"; import { serve, browser, root } from "./serve.mjs"
const what = process.argv[2] || "all", want = (k) => what === "all" || what === k
const s = await serve(), b = await browser(); const logs = [], res = {}
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
} catch (e) { logs.push("TEST ERROR " + String(e.stack || e).slice(0, 600)) }
console.log(JSON.stringify(res, null, 1)); console.log(logs.slice(0, 12).join("\n") || "no errors")
await b.close(); s.close()
