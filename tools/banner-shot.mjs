// node tools/banner-shot.mjs <W> <H> <samples> [only]  -> shots/banner/<id>.png
import fs from "fs"; import path from "path"; import { serve, browser, root } from "../tools/serve.mjs"
const [W, H, S] = process.argv.slice(2, 5).map(Number), only = process.argv[5]
const V = JSON.parse(fs.readFileSync(path.join(root, "tools/banner.json"), "utf8")).filter((v) => !only || only.split(",").includes(v.id))
const dir = path.join(root, "shots/banner"); fs.mkdirSync(dir, { recursive: true })
const s = await serve(), b = await browser(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
try {
await p.goto(s.url); await p.waitForFunction(() => window.__engine && window.__engine.done, null, { timeout: 60000 }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(500)
for (const v of V) { const t0 = Date.now()
  const url = await p.evaluate(async ([v, W, H, S]) => {
    const D = window.__designs, T = window.__text, w = D.worldFor({ world: v.base, tweak: {}, name: "Chrometide" })
    if (v.skyFrom) w.sky = D.worldFor({ world: v.skyFrom, tweak: {}, name: "x" }).sky
    if (v.seaFrom) w.sea = D.worldFor({ world: v.seaFrom, tweak: {}, name: "x" }).sea
    Object.assign(w.sky, v.sky || {}); if (v.sun) w.sky.sun = v.sun; Object.assign(w.sea, v.sea || {})
    const proto = JSON.parse(JSON.stringify(D.worldFor({ world: "Red Moons", tweak: {}, name: "x" }).things[0])), chrome = T.wordThing("A", 1, [0, 0, 0]).mat
    const mats = { chrome, gold: { ...chrome, name: "Gold", color: "#f5b83a", metal: 0.8 }, red: proto.mat }
    const things = v.keep ? w.things.slice(0, v.keep) : []
    const word = T.wordThing(v.text || "CHROMETIDE", v.h, v.pos, { font: v.font, ...(v.spec || {}) }, { rot: v.rot || [0, 0, 0] })
    word.mat = { ...mats[v.mat || "chrome"], ...(v.matx || {}) }; if (v.depth) word.size[2] = v.depth; things.push(word)
    for (const [x, y, z, r, m] of v.balls || []) things.push({ ...proto, id: "b" + things.length, name: "Ball", pos: [x, y, z], size: [r, r, r], round: 0, mat: { ...mats[m] } })
    w.things = things; w.cam = { ...w.cam, ...v.cam }; if (v.bloom !== undefined) w.bloom = v.bloom; if (v.land === false) w.land.on = false
    window.__last = w
    return (await window.__engine.still(w, W, H, S)).toDataURL("image/png") }, [v, W, H, S])
  fs.writeFileSync(path.join(dir, `${v.id}-${W}.png`), Buffer.from(url.split(",")[1], "base64")); console.log(v.id, Date.now() - t0, "ms") }
} finally { await b.close(); s.close() }
