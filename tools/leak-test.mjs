// A long session in a few minutes: 200 edits, then every dialog and mode opened and closed 20 times.
// Measures the JS heap (after garbage collection), the page's listeners, canvases and history
// lengths, and fails if they keep growing.   node tools/leak-test.mjs   (after a build)
import { serve, browser } from "./serve.mjs"

const s = await serve(), b = await browser(); const res = {}, log = []
try {
  const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } }), p = await ctx.newPage(), cdp = await ctx.newCDPSession(p)
  ctx.on("page", (x) => { if (x !== p) void x.close() }) // the gallery opens in a tab of its own: not part of this page
  p.on("pageerror", (e) => log.push("PAGEERROR " + e.message.slice(0, 200))); p.on("console", (m) => m.type() === "error" && log.push(m.text().slice(0, 200)))
  const done = (what = "") => p.waitForFunction(() => window.__engine?.done, null, { timeout: 30000 }).catch(() => log.push("not done " + what))
  const mb = async () => { for (let i = 0; i < 3; i++) await cdp.send("HeapProfiler.collectGarbage"); const h = await cdp.send("Runtime.getHeapUsage"); return +(h.usedSize / 1048576).toFixed(1) }
  const listeners = async () => { let n = 0; for (const expr of ["window", "document"]) { const { result } = await cdp.send("Runtime.evaluate", { expression: expr }); n += (await cdp.send("DOMDebugger.getEventListeners", { objectId: result.objectId })).listeners.length } return n }
  const counts = () => p.evaluate(() => ({ canvases: document.querySelectorAll("canvas").length, nodes: document.getElementsByTagName("*").length, past: window.__app.get().past.length, tape: window.__tape?.steps().length ?? 0 }))
  await p.goto(s.url); await done(); res.start = { heapMB: await mb(), listeners: await listeners(), ...(await counts()) }

  // ---------- 200 edits of every sort ----------
  await p.evaluate(async () => {
    const a = window.__app, pause = () => new Promise((ok) => setTimeout(ok, 20))
    for (let i = 0; i < 200; i++) {
      const k = i % 8
      if (k === 0) a.rollDice()
      else if (k === 1) a.edit("sun" + i, (w) => { w.sky.sun.az += 0.1 })
      else if (k === 2 && a.get().world.things[0]) a.editThing(a.get().world.things[0].id, "move" + i, (t) => { t.pos[0] += 0.2 })
      else if (k === 3) a.edit("name" + i, (w) => { w.name = "Edit " + i })
      else if (k === 4) a.undo()
      else if (k === 5) a.redo()
      else if (k === 6) a.edit("sea" + i, (w) => { w.sea.wave = (i % 10) / 10 })
      else a.edit("cam" + i, (w) => { w.cam.yaw += 0.05 })
      await pause()
    }
  })
  await done(); res.after200edits = { heapMB: await mb(), listeners: await listeners(), ...(await counts()) }

  // ---------- every dialog and mode, opened and closed ----------
  const OPEN = {
    design: () => p.click('[data-testid="open-cover"]'), loop: () => p.click('[data-testid="open-loop"]'), find: () => p.keyboard.press("/"), embed: () => p.click('[data-testid="embed"]'),
    timeline: () => p.click('[data-testid="open-timeline"]'), add: () => p.click('button:has-text("Add")'), keep: () => p.click('button:has-text("Keep")'), file: () => p.click('[data-testid="file-menu"]'),
    ...Object.fromEntries(["1994", "screensaver", "fly", "look", "timelapse", "word", "github-island"].map((id) => [id, async () => { await p.click('[data-testid="modes-menu"]'); await p.click(`[data-testid="mode-${id}"]`) }])),
  }
  const close = async (name) => { if (name === "timeline") { await p.click('[data-testid="open-timeline"]'); return } for (let i = 0; i < 3; i++) { await p.keyboard.press("Escape"); await p.waitForTimeout(120) } }
  for (const [name, open] of Object.entries(OPEN)) {
    let warm = null
    for (let i = 0; i < 20; i++) {
      try { await open() } catch (e) { log.push(`${name}: could not open (${String(e.message).split("\n")[0].slice(0, 80)})`); break }
      await p.waitForTimeout(name === "screensaver" || name === "1994" || name === "look" ? 700 : 300); await close(name); await p.waitForTimeout(150)
      if (i === 4) { await done(name); warm = { heapMB: await mb(), listeners: await listeners(), ...(await counts()) } }
    }
    await done(name); const end = { heapMB: await mb(), listeners: await listeners(), ...(await counts()) }
    process.stderr.write(`${name} `); res[name] = warm ? { growthMB: +(end.heapMB - warm.heapMB).toFixed(1), listeners: end.listeners - warm.listeners, canvases: end.canvases - warm.canvases, nodes: end.nodes - warm.nodes, heapMB: end.heapMB } : "skipped"
  }
  res.end = { heapMB: await mb(), listeners: await listeners(), ...(await counts()) }
} finally { await b.close(); s.close() }
console.log(JSON.stringify(res, null, 1)); if (log.length) console.log("notes:\n  " + log.slice(0, 12).join("\n  "))
const grew = Object.entries(res).filter(([, v]) => typeof v === "object" && "growthMB" in v && (v.growthMB > 3 || v.listeners > 0 || v.canvases > 0))
const ok = !grew.length && res.end.past <= 81 && res.end.tape <= 600 && !log.some((l) => /PAGEERROR|not done/.test(l))
console.log(ok ? "no growth" : "GROWTH in " + grew.map(([k]) => k).join(", ")); process.exit(ok ? 0 : 1)
