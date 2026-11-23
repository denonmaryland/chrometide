// Makes the project's own pictures with the tool itself: app icons, the link-preview image, the
// README pictures and a small looping demo. Run after "npm run build": node tools/brand.mjs
import path from "path"; import fs from "fs"; import { execFileSync } from "child_process"; import { serve, browser, root } from "./serve.mjs"
const s = await serve(), b = await browser(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.goto(s.url); await p.waitForFunction(() => window.__engine && window.__engine.done, null, { timeout: 60000 }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800)
const save = (file, url) => fs.writeFileSync(path.join(root, file), Buffer.from(url.split(",")[1], "base64"))
const still = (name, w, h, samples, tweak = "(w) => w", type = "image/png") => p.evaluate(async ([name, w, h, samples, tweak, type]) => { const D = window.__designs, world = eval(tweak)(D.worldFor({ world: name, tweak: {}, name })); return (await window.__engine.still(world, w, h, samples)).toDataURL(type, 0.9) }, [name, w, h, samples, tweak, type])
// icons: one red moon over the sea
const icon = `(w) => { w.things = [w.things[0]]; w.things[0].pos = [0, 3.2, 0]; w.things[0].size = [2.6, 2.6, 2.6]; w.cam = { ...w.cam, yaw: 0.3, pitch: 0.1, dist: 10.5, target: [0, 2.9, 0] }; w.sky.cloud = 0.35; return w }`
save("public/icon-512.png", await still("Red Moons", 512, 512, 48, icon)); save("public/icon-192.png", await still("Red Moons", 192, 192, 48, icon)); console.log("icons")
// link preview and README pictures
save("public/og.jpg", await still("Red Moons", 1280, 640, 48, `(w) => { w.cam.dist = 14; w.cam.target = [0.5, 3.4, 0]; return w }`, "image/jpeg")); console.log("og")
save("docs/images/hero.jpg", await still("Red Moons", 1760, 880, 64, `(w) => { w.cam.dist = 14; w.cam.target = [0.5, 3.4, 0]; return w }`, "image/jpeg")); console.log("hero")
const dir = path.join(root, "shots", "brand"); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true })
const picks = ["Monolith", "Crag Lagoon", "Checker Dream", "Carved Sun", "Floating Isles", "Lantern Lake", "Neon Harbour", "Vapor Grid", "Marble Hall", "Aurora Bay", "Equalizer Bay", "Gold Stack"]
for (const [i, n] of picks.entries()) save(`shots/brand/w${String(i).padStart(2, "0")}.png`, await still(n, 640, 480, 32))
execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-pattern_type", "glob", "-i", path.join(dir, "w*.png"), "-vf", "tile=4x3:padding=8:margin=8:color=0x0d0d11", "-frames:v", "1", "-q:v", "3", path.join(root, "docs/images/worlds.jpg")]); console.log("worlds")
// a looping demo: the camera circles Carved Sun once
const N = 60; for (let i = 0; i < N; i++) save(`shots/brand/f${String(i).padStart(3, "0")}.png`, await p.evaluate(([i, N]) => { const D = window.__designs, w = D.worldFor({ world: "Carved Sun", tweak: {}, name: "x" }); w.cam.yaw += (i / N) * Math.PI * 2; return window.__engine.frame(w, 560, 420, 6).toDataURL("image/png") }, [i, N]))
execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-framerate", "15", "-i", path.join(dir, "f%03d.png"), "-vf", "split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=bayer:bayer_scale=4", path.join(root, "docs/images/orbit.gif")]); console.log("gif", Math.round(fs.statSync(path.join(root, "docs/images/orbit.gif")).size / 1024), "KB")
fs.rmSync(dir, { recursive: true, force: true }); await b.close(); s.close()
