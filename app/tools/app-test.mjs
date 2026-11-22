// Drives the whole app in headless Chromium: every main feature once, with pictures.
import path from "path"; import fs from "fs"; import { serve, browser, root } from "./serve.mjs"
const s = await serve(), b = await browser(); const logs = [], res = {}
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] })
const p = await ctx.newPage()
p.on("console", (m) => (m.type() === "error" || m.text().includes("SHADER")) && logs.push(m.text().slice(0, 300))); p.on("pageerror", (e) => logs.push("PAGEERROR " + e.message.slice(0, 300)))
const done = async (t = 60000) => { await p.waitForTimeout(350); await p.waitForFunction(() => window.__engine && window.__engine.done, null, { timeout: t }).catch(() => logs.push("not done")); await p.waitForTimeout(150) }
const pix = () => p.evaluate(() => { const c = document.querySelector("canvas"), t = document.createElement("canvas"); t.width = 32; t.height = 24; const x = t.getContext("2d"); x.drawImage(c, 0, 0, 32, 24); return Array.from(x.getImageData(0, 0, 32, 24).data).join(",") })
const shot = (n) => p.screenshot({ path: path.join(root, "shots", n) })
const changed = async (name, act) => { try { const a = await pix(); await act(); await done(); res[name] = (await pix()) !== a } catch (e) { res[name] = "FAILED " + String(e.message).slice(0, 120); console.log(name, "failed; canvases:", await p.locator("canvas").count(), logs.slice(-3)) } }
const world = () => p.evaluate(() => window.__app.get().world)
await p.goto(s.url); await done()
// starters and parts
await changed("starter", () => p.click('[data-testid="starter-6"]')); await shot("t1-carved.png")
await changed("skyLook", () => p.click('[aria-label="Dusk"]'))
await p.click('[data-testid="part-sea"]'); await changed("seaLook", () => p.click('[aria-label="Checker"]'))
await p.click('[data-testid="part-land"]'); await changed("landLook", () => p.click('[aria-label="Red rock"]')); await shot("t2-land.png")
// sculpt by hand
await p.click('role=radio[name="Raise"]'); const cv = await p.locator("canvas").boundingBox()
await changed("sculpt", async () => { await p.mouse.move(cv.x + cv.width * 0.5, cv.y + cv.height * 0.62); await p.mouse.down(); for (let i = 0; i < 12; i++) await p.mouse.move(cv.x + cv.width * (0.5 + i * 0.01), cv.y + cv.height * 0.62); await p.mouse.up() })
res.sculptSaved = !!(await world()).land.sculpt; await p.click('role=radio[name="Off"]')
// undo / redo
const before = JSON.stringify(await world()); await p.keyboard.press("Control+z"); await done(); res.undo = JSON.stringify(await world()) !== before; await p.keyboard.press("Control+Shift+z"); await done(); res.redo = JSON.stringify(await world()) === before
// add a thing, change its material, cut with it, drag it
await p.click('[data-testid="starter-0"]'); await done()
await p.click('button:has-text("Add")'); await changed("addRing", () => p.click('role=menuitem[name="Ring"]'))
res.things = (await world()).things.length; res.selected = (await p.evaluate(() => window.__app.get().sel.type))
await p.waitForTimeout(1500); await changed("material", () => p.click('[aria-label="Gold"]'))
const t0 = (await world()).things.at(-1).pos
// find the new ring on screen by picking, then drag it
const spot = await p.evaluate(() => { const e = window.__engine, id = window.__app.get().sel.id; for (let y = 0.1; y < 0.9; y += 0.04) for (let x = 0.1; x < 0.9; x += 0.04) { const h = e.pick(x, y); if (h && h.id === id) return [x, y] } return null })
res.pickFound = !!spot
if (spot) { await changed("dragThing", async () => { const X = cv.x + cv.width * spot[0], Y = cv.y + cv.height * spot[1]; await p.mouse.move(X, Y); await p.mouse.down(); await p.mouse.move(X + 60, Y + 10, { steps: 6 }); await p.mouse.up() }); const t1 = (await world()).things.at(-1).pos; res.moved = Math.hypot(t1[0] - t0[0], t1[2] - t0[2]) > 0.2 }
await shot("t3-thing.png")
// orbit by dragging empty sky
await changed("orbit", async () => { await p.mouse.move(cv.x + cv.width * 0.9, cv.y + cv.height * 0.08); await p.mouse.down(); await p.mouse.move(cv.x + cv.width * 0.7, cv.y + cv.height * 0.12, { steps: 6 }); await p.mouse.up() })
// lettering
await p.click('[data-testid="part-title"]'); await changed("lettering", () => p.fill('[data-testid="title-input"]', "LOW TIDE")); await shot("t4-lettering.png")
// dice with a lock
await p.click('[data-testid="part-sky"]'); const sky0 = JSON.stringify((await world()).sky)
await p.evaluate(() => window.__app.toggleLock("sky")); await changed("dice", () => p.click('[data-testid="dice"]')); res.lockKept = JSON.stringify((await world()).sky) === sky0; await p.evaluate(() => window.__app.toggleLock("sky")); await shot("t5-rolled.png")
// find anything
await p.keyboard.press("/"); await p.keyboard.type("lagoon"); await p.waitForTimeout(300); await shot("t6-find.png"); await changed("find", () => p.keyboard.press("Enter"))
// share link round trip
await p.click('[data-testid="share"]'); await p.waitForTimeout(500); const link = await p.evaluate(() => location.href); res.linkLength = link.length
const w1 = await world(); const p2 = await ctx.newPage(); await p2.goto(link); await p2.waitForFunction(() => window.__app && window.__app.get().world.remixOf, null, { timeout: 20000 }).catch(() => logs.push("link did not load"))
const w2 = await p2.evaluate(() => window.__app.get().world); res.linkSameThings = w2.things.length === w1.things.length && w2.sky.zenith === w1.sky.zenith; res.remixOf = w2.remixOf; await p2.close()
// cover maker
await p.click('[data-testid="part-sky"]'); await p.click('[data-testid="starter-0"]'); await done()
await p.click('[data-testid="open-cover"]'); await p.waitForSelector('[data-testid="cover-canvas"]', { state: "visible", timeout: 90000 }); await p.fill('[data-testid="cover-title"]', "Slow Orbit"); await p.waitForTimeout(400); await shot("t7-cover-cd.png")
for (const f of ["Vinyl", "Tape"]) { await p.click(`role=radio[name="${f}"]`); await p.waitForTimeout(300); await shot(`t7-cover-${f.toLowerCase()}.png`) }
const [dl] = await Promise.all([p.waitForEvent("download"), p.click('[data-testid="cover-save"]')]); const f1 = path.join(root, "shots", "out-cover.png"); await dl.saveAs(f1); res.coverBytes = fs.statSync(f1).size
await p.keyboard.press("Escape"); await p.waitForTimeout(300)
// loop
await p.click('[data-testid="open-loop"]'); await p.waitForTimeout(600); await p.click('role=radio[name="4:3"]'); await p.click('[data-testid="loop-go"]')
await p.waitForSelector('[data-testid="loop-video"]', { timeout: 240000 }).catch(() => logs.push("loop never finished")); res.loopBytes = await p.evaluate(() => window.__loopBytes || 0); await shot("t8-loop.png")
await p.keyboard.press("Escape"); await p.waitForTimeout(300)
// save the picture at full size
const [dl2] = await Promise.all([p.waitForEvent("download", { timeout: 120000 }), p.click('[data-testid="save"]')]); const f2 = path.join(root, "shots", "out-save.png"); await dl2.saveAs(f2); res.saveBytes = fs.statSync(f2).size
console.log(JSON.stringify(res, null, 1)); console.log(logs.slice(0, 10).join("\n") || "no errors"); await b.close(); s.close()
