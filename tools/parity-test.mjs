// Checks the features brought over from the original: timeline, picture land, erosion, cloud things,
// layered and picture textures, spotlights, rays, comet, floating rock, arranging, 3D export and import.
import { checkResults } from "./check-results.mjs"
import path from "path"; import fs from "fs"; import { serve, browser, root } from "./serve.mjs"
const s = await serve(), b = await browser(); const logs = [], res = {}
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true }); const p = await ctx.newPage()
p.on("console", (m) => (m.type() === "error" || m.text().includes("SHADER")) && logs.push(m.text().slice(0, 400))); p.on("pageerror", (e) => logs.push("PAGEERROR " + e.message.slice(0, 300)))
const done = async () => { await p.waitForTimeout(350); await p.waitForFunction(() => window.__engine && window.__engine.done, null, { timeout: 90000 }).catch(() => logs.push("not done")); await p.waitForTimeout(150) }
const pix = () => p.evaluate(() => { const c = document.querySelector("canvas"), t = document.createElement("canvas"); t.width = 48; t.height = 36; const x = t.getContext("2d"); x.drawImage(c, 0, 0, 48, 36); return Array.from(x.getImageData(0, 0, 48, 36).data).join(",") })
const shot = (n) => p.screenshot({ path: path.join(root, "shots", n) })
const changed = async (name, act) => { try { const a = await pix(); await act(); await done(); res[name] = (await pix()) !== a } catch (e) { res[name] = "FAILED " + String(e.message).slice(0, 160) } }
const world = () => p.evaluate(() => window.__app.get().world)
const ed = (fn) => p.evaluate(`window.__app.edit("test" + Math.random(), ${fn})`)
await p.goto(s.url); await done()

// --- timeline ---
await p.click('[data-testid="starter-0"]'); await done(); await p.click('[data-testid="open-timeline"]'); await p.click('[data-testid="tl-key"]')
const tr = await p.locator('[data-testid="tl-track"]').boundingBox(); await p.mouse.click(tr.x + tr.width * 0.5, tr.y + tr.height / 2)
await ed(`(w) => { w.cam.yaw += 1.2; w.sky.zenith = "#4a22b0"; w.things[0].pos[1] += 3 }`); await p.click('[data-testid="tl-key"]'); res.keys = (await world()).anim.keys.length
const yawA = (await world()).anim.keys[0].pose.cam.yaw, yawB = (await world()).anim.keys[1].pose.cam.yaw
await changed("scrub", () => p.mouse.click(tr.x + tr.width * 0.25, tr.y + tr.height / 2)); const mid = (await world()).cam.yaw; res.between = mid > Math.min(yawA, yawB) + 0.05 && mid < Math.max(yawA, yawB) - 0.05; res.colourBetween = (await world()).sky.zenith
await shot("p1-timeline.png")
await p.click('[data-testid="tl-play"]'); await p.waitForTimeout(900); const t1 = await p.evaluate(() => window.__app.get().playhead); await p.waitForTimeout(700); const t2 = await p.evaluate(() => window.__app.get().playhead); res.plays = t1 !== t2; await p.click('[data-testid="tl-play"]')
// editing on a key updates the key
await p.evaluate(() => window.__app.seek(0)); await ed(`(w) => { w.sky.hazeAmt = 0.77 }`); res.autoKey = (await world()).anim.keys[0].pose.sky.hazeAmt === 0.77
// film the timeline
await p.click('[data-testid="open-loop"]'); await p.waitForTimeout(500); await p.click('role=radio[name="4:3"]'); await p.click('[data-testid="loop-go"]')
await p.waitForSelector('[data-testid="loop-video"]', { timeout: 300000 }).catch(() => logs.push("timeline film never finished")); res.timelineFilmBytes = await p.evaluate(() => window.__loopBytes || 0); await p.keyboard.press("Escape"); await p.waitForTimeout(300)
await p.click('[data-testid="open-timeline"]')

// --- land: picture, erosion, ground height ---
await p.click('[data-testid="starter-2"]'); await done()
res.groundAtPeak = await p.evaluate(() => window.__engine.groundAt(0, 0)); res.groundAtSea = await p.evaluate(() => window.__engine.groundAt(60, 60))
await p.click('[data-testid="part-land"]'); await p.click('role=radio[name="Erode"]'); const cv = await p.locator("canvas").boundingBox()
await changed("erode", async () => { for (let k = 0; k < 3; k++) { await p.mouse.move(cv.x + cv.width * 0.5, cv.y + cv.height * 0.5); await p.mouse.down(); for (let i = 0; i < 10; i++) await p.mouse.move(cv.x + cv.width * (0.45 + i * 0.012), cv.y + cv.height * (0.5 + k * 0.04)); await p.mouse.up() } })
await p.click('role=radio[name="Off"]'); await shot("p2-erode.png")
await changed("photoLand", () => p.evaluate(async () => { const c = document.createElement("canvas"); c.width = c.height = 256; const x = c.getContext("2d"); x.fillStyle = "#000"; x.fillRect(0, 0, 256, 256)
  x.font = "900 150px sans-serif"; x.fillStyle = "#fff"; x.textAlign = "center"; x.filter = "blur(5px)"; x.fillText("OK", 128, 180); const blob = await new Promise((ok) => c.toBlob(ok)); await window.__io.photoToLand(blob)
  window.__app.edit("cam", (w) => { w.cam.pitch = 0.75; w.cam.dist = 34; w.cam.yaw = 0; w.land.height = 4 }) }))
res.flat = (await world()).land.flat === true; await shot("p3-photo-land.png")

// --- things: floating rock, cloud, layers, picture, spotlight, arrange ---
await p.click('[data-testid="starter-3"]'); await done()
await p.click('button:has-text("Add")'); await changed("crag", () => p.click('role=menuitem[name="Floating rock"]'))
await ed(`(w) => { const t = w.things.at(-1); t.pos = [0, 4.2, 2]; t.size = [3, 2.4, 3] }`); await done()
await p.click('button:has-text("Add")'); await p.click('role=menuitem[name="Sphere"]'); await done()
await ed(`(w) => { const t = w.things.at(-1); t.pos = [-4, 3.2, 3]; t.size = [2.2, 1.5, 2.2]; t.name = "Cloud" }`); await done()
await changed("cloudThing", () => ed(`(w) => { const t = w.things.at(-1); t.mat.cloud = 0.85; t.mat.color = "#ffffff"; t.mat.reflect = 0; t.mat.diffuse = 1 }`))
await changed("layer", () => ed(`(w) => { const t = w.things[0]; t.mat.layer = "stripes"; t.mat.layerMix = 0.8; t.mat.layerColor = "#ff2a6a"; t.mat.reflect = 0.1; t.mat.diffuse = 1 }`))
await changed("pictureTexture", () => p.evaluate(async () => { const c = document.createElement("canvas"); c.width = c.height = 128; const x = c.getContext("2d"); const g = x.createLinearGradient(0, 0, 128, 128); g.addColorStop(0, "#00e0ff"); g.addColorStop(1, "#ff00c8"); x.fillStyle = g; x.fillRect(0, 0, 128, 128); x.fillStyle = "#fff"; x.font = "900 60px sans-serif"; x.fillText("HI", 22, 86)
  const blob = await new Promise((ok) => c.toBlob(ok)); await window.__io.setPicture(blob); window.__app.edit("pic", (w) => { const t = w.things[1]; t.mat.texture = "picture"; t.mat.reflect = 0.05; t.mat.diffuse = 1; t.mat.color = "#ffffff" }); await new Promise((ok) => setTimeout(ok, 600)) }))
await p.click('button:has-text("Add")'); await p.click('role=menuitem[name="Cone"]'); await done()
await ed(`(w) => { const t = w.things.at(-1); t.pos = [3.5, 5.5, 3.5]; t.size = [0.5, 0.5, 0.5]; t.name = "Spot"; t.mat = { ...t.mat, color: "#fff0c0", glow: 3, reflect: 0, diffuse: 0.2 }; w.sky.sun.el = 0.08; w.sky.ambient = 0.25 }`); await done()
await changed("spotlight", () => ed(`(w) => { w.things.at(-1).beam = 50 }`)); await shot("p4-things.png")
await changed("rays", () => ed(`(w) => { w.sky.rays = 1.2; w.sky.sun.el = 0.35 }`)); await changed("comet", () => ed(`(w) => { w.sky.comet = 1.3; w.sky.zenith = "#03051c"; w.sky.horizon = "#1b2f6e"; w.sky.stars = 1.4; w.sky.cloud = 0.1 }`)); await shot("p5-rays-comet.png")
await p.evaluate(() => { const s = window.__app.get(); window.__app.patch({ sel: { type: "thing", id: s.world.things[0].id } }) }); await p.waitForTimeout(300)
const n0 = (await world()).things.length; await p.click('[data-testid="scatter"]'); await done(); res.scattered = (await world()).things.length - n0
await p.click('[data-testid="line-up"]'); await done(); const xs = (await world()).things.filter((t) => t.role === "solid"); res.linedUp = xs.every((t) => t.pos[2] === 0) && xs.every((t, i) => i === 0 || t.pos[0] > xs[i - 1].pos[0]); await shot("p6-lined-up.png")

// --- 3D out and back in ---
await p.click('[data-testid="starter-6"]'); await done()
await p.click('[data-testid="file-menu"]'); const [d1] = await Promise.all([p.waitForEvent("download"), p.click('[data-testid="export-glb"]')]); const glb = path.join(root, "shots", "out-world.glb"); await d1.saveAs(glb); res.glbBytes = fs.statSync(glb).size
await p.click('[data-testid="file-menu"]'); const [d2] = await Promise.all([p.waitForEvent("download"), p.click('[data-testid="export-obj"]')]); const obj = path.join(root, "shots", "out-world.obj"); await d2.saveAs(obj); res.objBytes = fs.statSync(obj).size; res.objVerts = fs.readFileSync(obj, "utf8").split("\n").filter((l) => l.startsWith("v ")).length
// a small model of our own to bring in: a ring and a ball, saved as glb by the page, read back through the file picker
const model = path.join(root, "shots", "out-model.glb")
await p.evaluate(() => window.__app.replaceWorld({ ...window.__app.get().world, land: { ...window.__app.get().world.land, on: false }, sea: { ...window.__app.get().world.sea, kind: "none" }, things: window.__app.get().world.things.filter((t) => t.name === "Orbit" || t.name === "Lens") }))
await done(); await p.click('[data-testid="file-menu"]'); const [d3] = await Promise.all([p.waitForEvent("download"), p.click('[data-testid="export-glb"]')]); await d3.saveAs(model)
await p.click('[data-testid="starter-0"]'); await done(); await p.click('[data-testid="file-menu"]')
const a0 = await pix(); const [fc] = await Promise.all([p.waitForEvent("filechooser"), p.click('[data-testid="import-model"]')]); await fc.setFiles(model)
await p.waitForFunction(() => window.__app.get().world.model, null, { timeout: 120000 }).catch(() => logs.push("model never arrived")); await done()
const w = await world(); res.modelGrid = w.model ? w.model.n : 0; res.modelThing = w.things.some((t) => t.kind === "model"); res.modelShows = (await pix()) !== a0
await ed(`(w) => { w.cam.yaw = 0.9; w.cam.dist = 13; const t = w.things.find((t) => t.kind === "model"); t.pos = [3, 3.6, 5]; t.size = [3, 3, 3] }`); await done(); await shot("p7-imported.png")
await b.close(); s.close()
checkResults(res, logs)
