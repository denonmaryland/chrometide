// Checks the lettering features: words as things, fonts, styles, edges, bends, splitting, neon,
// carving, writing on land, moves, a font file of your own, old titles, and the cover maker's type.
import { checkResults } from "./check-results.mjs"
import path from "path"; import fs from "fs"; import { serve, browser, root } from "./serve.mjs"
const s = await serve(), b = await browser(); const logs = [], res = {}
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }); const p = await ctx.newPage()
p.on("console", (m) => (m.type() === "error" || m.text().includes("SHADER")) && logs.push(m.text().slice(0, 500))); p.on("pageerror", (e) => logs.push("PAGEERROR " + e.message.slice(0, 300)))
const done = async () => { await p.waitForTimeout(350); await p.waitForFunction(() => window.__engine && window.__engine.done, null, { timeout: 90000 }).catch(() => logs.push("not done")); await p.waitForTimeout(150) }
const pix = () => p.evaluate(() => { const c = document.querySelector("canvas"), t = document.createElement("canvas"); t.width = 64; t.height = 48; const x = t.getContext("2d"); x.drawImage(c, 0, 0, 64, 48); return Array.from(x.getImageData(0, 0, 64, 48).data).join(",") })
const shot = (n) => p.screenshot({ path: path.join(root, "shots", n) })
const changed = async (name, act) => { try { const a = await pix(); await act(); await done(); res[name] = (await pix()) !== a } catch (e) { res[name] = "FAILED " + String(e.message).slice(0, 160) } }
const world = () => p.evaluate(() => window.__app.get().world)
const sel = () => p.evaluate(() => { const s = window.__app.get(); return s.sel.type === "thing" ? s.world.things.find((t) => t.id === s.sel.id) : null })
const edSel = (fn) => p.evaluate(`(() => { const s = window.__app.get(); window.__app.editThing(s.sel.id, "t" + Math.random(), ${fn}) })()`)
await p.goto(s.url); await done(); await p.waitForTimeout(800)
const fresh = async (i = 2) => { await p.click(`[data-testid="starter-${i}"]`); await p.evaluate(() => window.__app.edit("cam", (w) => { w.cam.yaw = 0.12; w.cam.pitch = 0.16 })); await done(); await p.click('[data-testid="part-title"]') }

// a word, as a thing
await fresh(); await changed("word", async () => { await p.fill('[data-testid="title-input"]', "low tide"); await p.click('[data-testid="add-word"]') })
let t = await sel(); res.isThing = t?.kind === "text" && t.text.str === "LOW TIDE"; const wSans = t.size[0]
await changed("font", () => p.selectOption('[data-testid="font-select"] >> nth=-1', "script")); t = await sel(); res.fontRefit = Math.abs(t.size[0] - wSans) > 0.05; await shot("y1-script.png")
await p.selectOption('[data-testid="font-select"] >> nth=-1', "poster"); await done()
await changed("outline", () => p.click('role=radio[name="Outline"]')); await changed("chisel", async () => { await p.click('role=radio[name="Solid"]'); await p.click('role=radio[name="Chisel"]') })
await changed("sharp", () => p.click('role=radio[name="Sharp"]')); await p.click('role=radio[name="Round"]')
await changed("arch", () => edSel(`(t) => { t.text.arch = 110 }`)); await shot("y2-arch.png"); await edSel(`(t) => { t.text.arch = 0 }`)
await changed("twoLines", () => p.fill('[data-testid="text-str"]', "LOW\nTIDE")); await p.fill('[data-testid="text-str"]', "LOW TIDE"); await done()
// split into letters, float apart
const n0 = (await world()).things.length; await changed("split", () => p.click('[data-testid="split"]')); let w = await world(); const L = w.things.filter((x) => x.kind === "text")
res.letters = L.map((x) => x.text.str).join(""); res.splitCount = w.things.length - n0 + 1
await p.evaluate(() => { const s = window.__app.get(), a = s.world.things.find((t) => t.text?.str === "O"); window.__app.editThing(a.id, "m", (t) => { t.mat = { ...t.mat, color: "#e2261a", reflect: 0.08, metal: 0, diffuse: 1 } }) }); await done(); await shot("y3-split.png")
await p.click('[data-testid="part-title"]'); await changed("floatApart", () => p.click('[data-testid="float-apart"]')); await shot("y4-float.png")
// moves
await p.evaluate(() => window.__text.setMotion("rise")); await done(); const up = await pix(); await p.evaluate(() => window.__app.patch({ phase: 0.02 })); await done(); res.riseSinks = (await pix()) !== up
await p.evaluate(() => window.__app.patch({ phase: 0.4 })); await done(); await shot("y5-rising.png"); await p.evaluate(() => window.__app.patch({ phase: null })); await done(); res.riseReturns = (await pix()) === up
await p.click('[data-testid="move-rise"]'); await p.waitForTimeout(1200); res.previewRuns = (await p.evaluate(() => window.__app.get().phase)) !== null; await p.waitForTimeout(4500); res.previewEnds = (await p.evaluate(() => window.__app.get().phase)) === null
// neon, ring, carved slab
await fresh(0); await p.evaluate(() => window.__app.edit("night", (w) => { Object.assign(w.sky, { zenith: "#03051c", horizon: "#1b2f6e", haze: "#28407f", stars: 1.4, ambient: 0.3 }); w.sky.sun.el = 0.1; w.things = w.things.slice(0, 3); w.sea.reflect = 0.5; w.sea.wave = 0.12 })); await done()
await changed("neon", async () => { await p.fill('[data-testid="title-input"]', "open late"); await p.selectOption('[data-testid="font-select"]', "script"); await p.click('[data-testid="add-neon"]') }); t = await sel(); res.neonGlows = t.text.style === "tube" && t.mat.glow > 0; await shot("y6-neon.png")
await fresh(4); await changed("ring", async () => { await p.fill('[data-testid="title-input"]', "slow orbit"); await p.click('[data-testid="add-ring"]') }); t = await sel(); res.ringBend = Math.abs(t.text.bend); await shot("y7-ring.png")
await fresh(3); await changed("carved", async () => { await p.fill('[data-testid="title-input"]', "gold"); await p.selectOption('[data-testid="font-select"]', "poster"); await p.click('[data-testid="add-carved"]') }); w = await world(); res.carvedRoles = w.things.slice(-2).map((x) => x.role).join("+"); await shot("y8-carved.png")
// into the land
await fresh(2); await changed("carveLand", async () => { await p.fill('[data-testid="title-input"]', "sea"); await p.click('[data-testid="write-carve"]'); await p.evaluate(() => window.__app.edit("c", (w) => { w.cam.pitch = 0.9; w.cam.dist = 30; w.cam.yaw = 0 })) }); await shot("y9-carve-land.png")
await fresh(2); await changed("raiseLand", async () => { await p.fill('[data-testid="title-input"]', "isle"); await p.click('[data-testid="write-raise"]') }); res.raisedFlat = (await world()).land.flat === true; await shot("y10-raise-land.png")
// a font file of your own (one of the bundled faces, handed over as a file)
await fresh(2); const fontFile = fs.readdirSync(path.join(root, "dist/assets")).find((f) => f.startsWith("pacifico") && f.endsWith(".woff2")); const bytes = fs.readFileSync(path.join(root, "dist/assets", fontFile)).toString("base64")
await p.fill('[data-testid="title-input"]', "mine"); await p.click('[data-testid="add-word"]'); await done()
res.customLoaded = await p.evaluate(async (b64) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return window.__text.loadCustomFont(new File([u], "my.woff2", { type: "font/woff2" })) }, bytes)
await changed("customFont", () => edSel(`(t) => { t.text.font = "custom" }`)); res.customKept = !!(await world()).customFont
// a title from the first version still opens
res.oldTitle = await p.evaluate(async () => { const w = { ...window.__app.get().world, things: [], title: { text: "OLD LINK", x: 0, z: 8.5, yaw: -0.09, width: 14, lift: 0.85, depth: 0.5, mat: window.__app.get().world.things[0].mat } }; const n = await window.__text.prepare(w); return !n.title && n.things.length === 1 && n.things[0].text.str === "OLD LINK" && Math.abs(n.things[0].size[0] - 7) < 0.01 })
// cover maker type
await p.click('[data-testid="starter-0"]'); await done(); await p.click('[data-testid="open-cover"]'); await p.waitForSelector('[data-testid="cover-canvas"]', { state: "visible", timeout: 90000 })
await p.fill('[data-testid="cover-title"]', "Slow Orbit"); await p.click('role=radio[name="Band"]'); await p.click('[data-testid="cover-obi"]'); await p.waitForTimeout(300); await shot("y11-cover-obi.png")
await p.click('role=radio[name="Tape"]'); await p.fill('[data-testid="cover-tracks"]', "First light\nGlass harbour\nSlow orbit"); await p.click('role=radio[name="Poster"]'); await p.waitForTimeout(300); await shot("y12-cover-tape.png")
const [dl] = await Promise.all([p.waitForEvent("download"), p.click('[data-testid="cover-save"]')]); const f1 = path.join(root, "shots", "out-cover.png"); await dl.saveAs(f1); res.coverBytes = fs.statSync(f1).size; fs.unlinkSync(f1)
await b.close(); s.close()
checkResults(res, logs)
