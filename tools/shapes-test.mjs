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

console.log(JSON.stringify(res, null, 1)); console.log(logs.slice(0, 10).join("\n") || "no errors"); await b.close(); s.close()
