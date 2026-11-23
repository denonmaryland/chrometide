// Renders every ready-made design and tiles them by kind: shots/designs-<kind>.jpg
import path from "path"; import fs from "fs"; import { execFileSync } from "child_process"; import { serve, browser, root } from "./serve.mjs"
const s = await serve(), b = await browser(); const p = await b.newPage({ viewport: { width: 1200, height: 800 } }); const logs = []
p.on("console", (m) => (m.type() === "error" || m.text().includes("SHADER")) && logs.push(m.text().slice(0, 300))); p.on("pageerror", (e) => logs.push("PAGEERROR " + e.message.slice(0, 300)))
await p.goto(s.url); await p.waitForFunction(() => window.__engine && window.__engine.done, null, { timeout: 60000 }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(800)
const kinds = await p.evaluate(() => Object.keys(window.__designs.DESIGN_KINDS)), only = process.argv[2]
for (const kind of kinds) { if (only && only !== kind) continue
  const dir = path.join(root, "shots", "ds-" + kind); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true })
  const n = await p.evaluate((k) => window.__designs.DESIGNS.filter((d) => d.kind === k).length, kind); let size = [0, 0]
  for (let i = 0; i < n; i++) { const r = await p.evaluate(([k, i]) => { const D = window.__designs, d = D.DESIGNS.filter((x) => x.kind === k)[i], K = D.DESIGN_KINDS[k], sc = 520 / Math.max(K.w, K.h), w = Math.round(K.w * sc), h = Math.round(K.h * sc)
      const art = window.__engine.frame(D.worldFor(d), w, h, 6); return { url: D.drawDesign(art, d.opts).toDataURL("image/png"), w, h } }, [kind, i])
    size = [r.w, r.h]; fs.writeFileSync(path.join(dir, String(i).padStart(2, "0") + ".png"), Buffer.from(r.url.split(",")[1], "base64")) }
  const cols = size[0] > size[1] * 1.6 ? 2 : size[0] > size[1] ? 3 : 5, rows = Math.ceil(n / cols)
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-pattern_type", "glob", "-i", path.join(dir, "*.png"), "-vf", `tile=${cols}x${rows}:padding=6:margin=6:color=0x101014`, "-frames:v", "1", "-q:v", "3", path.join(root, "shots", `designs-${kind}.jpg`)])
  fs.rmSync(dir, { recursive: true, force: true }); console.log(kind, n) }
console.log(logs.slice(0, 6).join("\n") || "no errors"); await b.close(); s.close()
