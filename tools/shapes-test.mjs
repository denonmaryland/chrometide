// Checks the pluggable shapes and Photo to world in headless Chromium, with pictures in shots/.
//   - an old share link renders exactly as it did before shapes were pluggable (if shots/ref-base.png,
//     rendered from this link at the earlier commit, is there),
//   - every shape from src/engine/shapes renders, cuts, can be picked, added from the menu, exported,
//   - a photo dropped on the picture changes the sky, sea, land and materials.
import path from "path"; import fs from "fs"; import { serve, browser, root } from "./serve.mjs"
const OLD_LINK = fs.readFileSync(path.join(root, "tools", "shapes-ref-link.txt"), "utf8").trim()
const s = await serve(), b = await browser(); const logs = [], res = {}
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } }); const p = await ctx.newPage()
p.on("console", (m) => (m.type() === "error" || m.text().includes("SHADER")) && logs.push(m.text().slice(0, 400))); p.on("pageerror", (e) => logs.push("PAGEERROR " + e.message.slice(0, 300)))
const done = async () => { await p.waitForTimeout(350); await p.waitForFunction(() => window.__engine && window.__engine.done, null, { timeout: 90000 }).catch(() => logs.push("not done")); await p.waitForTimeout(150) }
const shot = (n) => p.screenshot({ path: path.join(root, "shots", n) })
const world = () => p.evaluate(() => window.__app.get().world)
const savePng = (n, url) => fs.writeFileSync(path.join(root, "shots", n), Buffer.from(url.split(",")[1], "base64"))
fs.mkdirSync(path.join(root, "shots"), { recursive: true })
// helpers that live in the page: render a world to a PNG, compare two PNGs pixel by pixel
const helpers = () => p.evaluate(() => {
  window.__t = {
    render: async (w, W = 360, H = 270, n = 4) => (await window.__engine.still(w, W, H, n)).toDataURL("image/png"),
    diff: async (a, b2) => { const load = (u) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = u })
      const [A, B] = await Promise.all([load(a), load(b2)]); if (A.width !== B.width || A.height !== B.height) return { size: false }
      const px = (im) => { const c = document.createElement("canvas"); c.width = im.width; c.height = im.height; const x = c.getContext("2d"); x.drawImage(im, 0, 0); return x.getImageData(0, 0, im.width, im.height).data }
      const da = px(A), db = px(B); let changed = 0, max = 0, sum = 0
      for (let i = 0; i < da.length; i += 4) { const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])); if (d) changed++; max = Math.max(max, d); sum += d }
      return { pixels: da.length / 4, changed, max, mean: +(sum / (da.length / 4)).toFixed(3) } },
  }
})

const ONLY = process.env.ONLY // "shapes" or "photo" to run just one half
if (ONLY !== "photo") {
// ---------- 1. an old share link still renders the same ----------
await p.goto(s.url + "#w=" + OLD_LINK); await p.waitForFunction(() => window.__app && window.__app.get().world.remixOf, null, { timeout: 30000 }).catch(() => logs.push("old link did not load")); await done(); await helpers()
const oldPic = await p.evaluate(() => window.__t.render(window.__app.get().world, 480, 360, 6)); savePng("ref-after.png", oldPic)
res.oldLinkKinds = await p.evaluate(() => window.__app.get().world.things.map((t) => t.kind).join(","))
const refFile = path.join(root, "shots", "ref-base.png")
if (fs.existsSync(refFile)) res.oldLinkVsBase = await p.evaluate(([a, b2]) => window.__t.diff(a, b2), ["data:image/png;base64," + fs.readFileSync(refFile).toString("base64"), oldPic])
else res.oldLinkVsBase = "no shots/ref-base.png to compare with"

// ---------- 2. every pluggable shape ----------
await p.click('[data-testid="starter-0"]'); await done()
const shapes = await p.evaluate(() => window.__api_shapes ?? null) ?? ["capsule", "gem", "star", "twist"]
res.shapes = {}
for (const id of shapes) {
  const r = {}
  // alone, in chrome, in the middle of an empty sea
  await p.evaluate((id) => { const a = window.__app, w = JSON.parse(JSON.stringify(a.get().world))
    w.things = [{ id: "s1", name: id, kind: id, pos: [0, 2.4, 0], size: [1.6, 1.6, 1.6], rot: [25, 8, 0], round: 0.45, role: "solid", group: 0, mat: { name: "Chrome", color: "#eef2f6", color2: "#222222", texture: "none", texScale: 1, diffuse: 0.06, reflect: 0.9, metal: 0.75, shine: 0.7, gloss: 1, clear: 0, ior: 1.33, bump: 0, glow: 0 } }]
    w.cam = { ...w.cam, yaw: 0.3, pitch: 0.12, dist: 9, target: [0, 2.4, 0] }; a.replaceWorld(w) }, id); await done()
  const pic = await p.evaluate(() => window.__t.render(window.__app.get().world)); savePng(`shape-${id}.png`, pic)
  const empty = await p.evaluate(() => { const w = JSON.parse(JSON.stringify(window.__app.get().world)); w.things = []; return window.__t.render(w) })
  r.renders = (await p.evaluate(([a, b2]) => window.__t.diff(a, b2), [pic, empty])).changed > 2000
  // pick it in the middle of the view, and select it so its outline shows
  const hit = await p.evaluate(() => window.__engine.pick(0.5, 0.5)); r.picked = hit?.kind === "thing" && hit.id === "s1"
  await p.evaluate(() => window.__app.patch({ sel: { type: "thing", id: "s1" } })); await done(); await shot(`shape-${id}-selected.png`)
  r.selectedInInspector = await p.locator('select').filter({ hasText: "Sphere" }).first().inputValue().catch(() => "?")
  // cut a sphere out of it
  await p.evaluate(() => window.__app.edit("cut", (w) => { w.things.push({ ...JSON.parse(JSON.stringify(w.things[0])), id: "c1", name: "Bite", kind: "sphere", role: "cut", pos: [0.6, 3.0, 0.45], size: [0.9, 0.9, 0.9] }) })); await done()
  const cutPic = await p.evaluate(() => window.__t.render(window.__app.get().world)); savePng(`shape-${id}-cut.png`, cutPic)
  r.cuts = (await p.evaluate(([a, b2]) => window.__t.diff(a, b2), [pic, cutPic])).changed > 800
  const cutHit = await p.evaluate(() => window.__engine.pick(0.5, 0.5)); r.cutStillPicks = cutHit?.kind === "thing"
  res.shapes[id] = r
}
// the Add menu lists them; adding one selects it; the kind picker offers them
await p.click('[data-testid="starter-0"]'); await done()
await p.click('button:has-text("Add")'); await p.waitForTimeout(300); await shot("shapes-add-menu.png")
const labels = await p.locator('[role="menuitem"]').allInnerTexts(); res.addMenu = labels.map((l) => l.trim())
await p.click('role=menuitem[name="Gem"]'); await done()
res.addedGem = await p.evaluate(() => { const s = window.__app.get(); const t = s.world.things.find((x) => x.id === s.sel.id); return t?.kind })
res.kindPicker = await p.evaluate(() => [...document.querySelectorAll("select option")].map((o) => o.value).filter((v) => ["capsule", "gem", "star", "twist"].includes(v)))
await shot("shapes-inspector.png")
// 3D export has a mesh for each
res.exportMeshes = await p.evaluate(() => { const w = JSON.parse(JSON.stringify(window.__app.get().world)); const base = w.things[0]
  w.things = ["capsule", "gem", "star", "twist"].map((k, i) => ({ ...base, id: "e" + i, name: k, kind: k, role: "solid" })); return window.__io.toMeshes(w).children.filter((c) => c.isMesh && c.name !== "Sea" && c.name !== "Land").length })
// a showcase: all four in chrome and glass over a mirror sea
await p.evaluate(() => { const a = window.__app, w = JSON.parse(JSON.stringify(a.get().world)), m = w.things[0].mat
  const chrome = { ...m, name: "Chrome", color: "#eef2f6", diffuse: 0.06, reflect: 0.9, metal: 0.75, gloss: 1, clear: 0 }, gold = { ...chrome, name: "Gold", color: "#f5b83a", metal: 0.8 }, glass = { ...chrome, name: "Glass", color: "#bfe8ff", diffuse: 0.05, reflect: 0.05, metal: 0, clear: 0.95 }
  const T = (id, kind, pos, size, rot, mat, round = 0.45) => ({ id, name: kind, kind, pos, size, rot, round, role: "solid", group: 0, mat })
  w.things = [T("a", "twist", [-4.2, 2.6, -1.5], [0.8, 2.6, 0.8], [0, 0, 0], chrome, 0.45), T("b", "gem", [-0.6, 1.6, 1.4], [1.5, 1.5, 1.5], [20, 0, 0], glass), T("c", "star", [2.6, 3.4, -0.6], [1.7, 1.7, 1.7], [-18, 0, 8], gold, 0.5), T("d", "capsule", [4.8, 1.6, 2.2], [0.8, 1.4, 0.8], [0, 0, -24], chrome)]
  w.sea = { ...w.sea, kind: "mirror", c1: "#20242c", c2: "#8aa0c0", reflect: 0.8 }; w.cam = { ...w.cam, yaw: 0.15, pitch: 0.1, dist: 15, target: [0.2, 2.4, 0] }; a.replaceWorld(w) }); await done()
savePng("shapes-showcase.png", await p.evaluate(() => window.__t.render(window.__app.get().world, 960, 720, 24)))

}

// ---------- 3. photo to world ----------
if (ONLY !== "shapes") {
if (ONLY === "photo") { await p.goto(s.url); await done(); await helpers() }
// three made-up photos, drawn in the page
const makePhoto = (kind) => p.evaluate(async (kind) => {
  const W = 480, H = 360, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"); let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const grad = (y0, y1, stops) => { const g = x.createLinearGradient(0, y0, 0, y1); stops.forEach(([t, col]) => g.addColorStop(t, col)); x.fillStyle = g; x.fillRect(0, y0, W, y1 - y0) }
  if (kind === "sunset") {
    grad(0, H * 0.55, [[0, "#2a1052"], [0.45, "#b0306a"], [0.8, "#ff7a3a"], [1, "#ffc070"]])
    const sun = x.createRadialGradient(W * 0.62, H * 0.47, 0, W * 0.62, H * 0.47, 90); sun.addColorStop(0, "#fff6d0"); sun.addColorStop(0.25, "#ffe090"); sun.addColorStop(1, "rgba(255,160,80,0)"); x.fillStyle = sun; x.fillRect(0, 0, W, H * 0.55)
    grad(H * 0.55, H, [[0, "#6a2050"], [1, "#1a0828"]]); for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(255,${150 + rnd() * 80},90,${0.25 + rnd() * 0.4})`; x.fillRect(W * 0.62 - 50 + rnd() * 100 - (i % 7) * 4, H * 0.56 + rnd() * H * 0.42, 10 + rnd() * 30, 2) }
  } else if (kind === "field") {
    grad(0, H * 0.48, [[0, "#2f74d0"], [0.7, "#8cc0f0"], [1, "#d8ecff"]])
    for (let i = 0; i < 6; i++) { x.fillStyle = "rgba(255,255,255,0.75)"; x.beginPath(); x.ellipse(60 + i * 80 + rnd() * 30, 50 + rnd() * 60, 40 + rnd() * 30, 14 + rnd() * 8, 0, 0, 7); x.fill() }
    grad(H * 0.48, H, [[0, "#7aa83a"], [0.4, "#4f8a2a"], [1, "#2a5a18"]])
    for (let i = 0; i < 900; i++) { x.fillStyle = rnd() < 0.08 ? "#f0d040" : `rgba(${30 + rnd() * 50},${90 + rnd() * 80},${20 + rnd() * 30},0.7)`; const yy = H * 0.5 + rnd() * H * 0.5; x.fillRect(rnd() * W, yy, 2 + (yy / H) * 3, 4 + (yy / H) * 8) }
  } else {
    grad(0, H, [[0, "#07071a"], [0.6, "#140a2a"], [1, "#05050c"]])
    const cols = ["#ff2a9a", "#20e0ff", "#ffd020", "#9a40ff", "#ff5a2a"]
    for (let i = 0; i < 14; i++) { const w = 30 + rnd() * 50, h = 80 + rnd() * 160, X = rnd() * (W - w), col = cols[i % 5]; x.shadowColor = col; x.shadowBlur = 24; x.fillStyle = col; x.fillRect(X, H * 0.62 - h, w, h); x.shadowBlur = 0
      x.fillStyle = "rgba(0,0,0,0.55)"; for (let k = 0; k < 6; k++) x.fillRect(X + 4, H * 0.62 - h + 8 + k * h / 7, w - 8, h / 14)
      const g = x.createLinearGradient(0, H * 0.62, 0, H); g.addColorStop(0, col + "aa"); g.addColorStop(1, col + "00"); x.fillStyle = g; x.fillRect(X, H * 0.62, w, H * 0.38) }
  }
  return c.toDataURL("image/png")
}, kind)
const drop = (url, name) => p.evaluate(async ([url, name]) => {
  const blob = await (await fetch(url)).blob(), dt = new DataTransfer(); dt.items.add(new File([blob], name, { type: "image/png" }))
  const vp = document.querySelector('[data-testid="viewport"] canvas'); for (const type of ["dragenter", "dragover"]) vp.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }))
  await new Promise((ok) => setTimeout(ok, 250)); const shown = !!document.querySelector('[data-testid="photo-drop"]')
  vp.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt })); return shown }, [url, name])
const sideBySide = (photo, render, n) => p.evaluate(async ([a, b2]) => { const load = (u) => new Promise((ok) => { const im = new Image(); im.onload = () => ok(im); im.src = u })
  const [A, B] = await Promise.all([load(a), load(b2)]), c = document.createElement("canvas"); c.width = 1300; c.height = 480; const x = c.getContext("2d"); x.fillStyle = "#111"; x.fillRect(0, 0, 1300, 480)
  x.drawImage(A, 0, 60, 480, 360); x.drawImage(B, 660, 0, 640, 480); return c.toDataURL("image/png") }, [photo, render]).then((u) => savePng(n, u))
const summary = (w) => ({ zenith: w.sky.zenith, horizon: w.sky.horizon, haze: w.sky.haze, sun: w.sky.sunColor, sunAt: [+w.sky.sun.az.toFixed(2), +w.sky.sun.el.toFixed(2)], sea: [w.sea.c1, w.sea.c2], land: w.land.on ? [w.land.c1, w.land.c2, w.land.c3, !!w.land.sculpt] : "off", things: w.things.map((t) => t.mat.color) })
res.photo = {}
// dragging a file over the picture shows where to drop it
await p.evaluate(() => { const dt = new DataTransfer(); dt.items.add(new File(["x"], "a.png", { type: "image/png" })); document.querySelector('[data-testid="viewport"] canvas').dispatchEvent(new DragEvent("dragenter", { bubbles: true, cancelable: true, dataTransfer: dt })) })
await p.waitForTimeout(250); res.photo.hint = await p.locator('[data-testid="photo-drop"]').isVisible(); await shot("photo-drop-hint.png")
await p.evaluate(() => { const dt = new DataTransfer(); dt.items.add(new File(["x"], "a.png", { type: "image/png" })); window.dispatchEvent(new DragEvent("dragleave", { bubbles: true, cancelable: true, dataTransfer: dt })) })
await p.waitForTimeout(150); res.photo.hintGoesAway = !(await p.locator('[data-testid="photo-drop"]').isVisible())
const cases = [["sunset", 4], ["field", 6], ["neon", 0]]
for (const [kind, starter] of cases) {
  await p.click(`[data-testid="starter-${starter}"]`); await done()
  const before = await world(), url = await makePhoto(kind), r = {}
  if (kind === "field") { // the File menu way
    await p.click('[data-testid="file-menu"]'); await p.waitForTimeout(200)
    const [chooser] = await Promise.all([p.waitForEvent("filechooser"), p.click('[data-testid="photo-world"]')])
    fs.writeFileSync(path.join(root, "shots", "photo-field-input.png"), Buffer.from(url.split(",")[1], "base64")); await chooser.setFiles(path.join(root, "shots", "photo-field-input.png")); r.via = "file menu"
  } else { r.dropHint = await drop(url, `${kind}.png`); r.via = "drop" }
  await p.waitForFunction((z) => window.__app.get().world.sky.zenith !== z, before.sky.zenith, { timeout: 15000 }).catch(() => logs.push(kind + ": sky did not change")); await done()
  const after = await world()
  r.sky = after.sky.zenith !== before.sky.zenith && after.sky.horizon !== before.sky.horizon; r.sea = after.sea.c1 !== before.sea.c1 || after.sea.c2 !== before.sea.c2
  r.land = after.land.on && !!after.land.sculpt && after.land.sculpt !== before.land.sculpt; r.materials = after.things.length > 0 && after.things.every((t, i) => t.mat.color !== before.things[i].mat.color)
  r.noteShown = await p.locator('[data-testid="photo-note"]').isVisible().catch(() => false); r.look = summary(after)
  if (kind === "sunset") await shot("photo-sunset-ui.png")
  const pic = await p.evaluate(() => window.__t.render(window.__app.get().world, 640, 480, 16)); await sideBySide(url, pic, `photo-${kind}.png`)
  // one undo takes it all back
  await p.keyboard.press("Control+z"); await done(); r.undo = (await world()).sky.zenith === before.sky.zenith && (await world()).sea.c1 === before.sea.c1
  res.photo[kind] = r
}
// the Modes menu has it
await p.click('[data-testid="modes-menu"]'); await p.waitForTimeout(250); res.photo.modesMenu = await p.locator('[data-testid="mode-photo-world"]').isVisible(); await shot("photo-modes-menu.png"); await p.keyboard.press("Escape")
// a file that is not a picture is turned away kindly
await p.evaluate(() => { const dt = new DataTransfer(); dt.items.add(new File(["hello"], "notes.txt", { type: "text/plain" })); window.dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: dt })) }); await p.waitForTimeout(300)
res.photo.notAPhoto = await p.locator('[data-testid="photo-note"]').innerText().catch(() => "")
// phone size
await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(400); await drop(await makePhoto("sunset"), "sunset.png"); await done(); await shot("photo-phone.png")
}

console.log(JSON.stringify(res, null, 1)); console.log(logs.slice(0, 10).join("\n") || "no errors"); await b.close(); s.close()
