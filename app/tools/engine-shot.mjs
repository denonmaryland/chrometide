// Usage: node tools/engine-shot.mjs worlds [from] [to]   |   node tools/engine-shot.mjs skies [from] [to]
// Renders starting worlds, or one world under each sky look, on the bare engine page, and tiles them.
import path from "path"; import fs from "fs"; import { execFileSync } from "child_process"; import { serve, browser, root } from "./serve.mjs"
const [what = "worlds", a = "0", z = "999"] = process.argv.slice(2)
const s = await serve(), b = await browser(); const page = await b.newPage({ viewport: { width: 640, height: 480 } })
const logs = []; page.on("console", (m) => (m.type() === "error" || m.text().includes("SHADER")) && logs.push(m.text().slice(0, 600))); page.on("pageerror", (e) => logs.push("PAGEERROR " + e.message))
await page.goto(`${s.url}?test=engine&w=0&s=4`); await page.waitForFunction(() => /\d+\/\d+/.test(document.title), null, { timeout: 60000 })
const [nw, ns] = (await page.title()).split("/").map(Number), n = what === "skies" ? ns : nw
const dir = path.join(root, "shots", "sheet-" + what); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true }); let count = 0
for (let i = +a; i < Math.min(n, +z + 1); i++) { await page.goto(`${s.url}?test=engine&s=${process.env.S || 8}&${what === "skies" ? `w=2&sky=${i}` : `w=${i}`}`)
  try { await page.waitForFunction(() => window.__engine && window.__engine.done, null, { timeout: 90000 }) } catch { logs.push("timeout " + i) }
  await page.locator("canvas").screenshot({ path: path.join(dir, `${String(i).padStart(3, "0")}.png`) }); count++ }
const cols = 6, rows = Math.ceil(count / cols)
execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-pattern_type", "glob", "-i", path.join(dir, "*.png"), "-vf", `scale=400:300,tile=${cols}x${rows}`, "-frames:v", "1", "-q:v", "3", path.join(root, "shots", `sheet-${what}.jpg`)])
fs.rmSync(dir, { recursive: true, force: true })
console.log(what, count, "of", n, logs.slice(0, 6).join("\n") || "no errors"); await b.close(); s.close()
