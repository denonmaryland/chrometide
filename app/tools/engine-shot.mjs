// Usage: node tools/engine-shot.mjs [world indexes...] : renders starting worlds on the bare engine page.
import path from "path"; import { serve, browser, root } from "./serve.mjs"
const s = await serve(), b = await browser(); const page = await b.newPage({ viewport: { width: 960, height: 720 } })
const logs = []; page.on("console", (m) => (m.type() === "error" || m.text().includes("SHADER")) && logs.push(m.text().slice(0, 1500))); page.on("pageerror", (e) => logs.push("PAGEERROR " + e.message))
const list = process.argv.slice(2).map(Number); const which = list.length ? list : [0, 1, 2, 3, 4, 5, 6, 7]
for (const i of which) { const t0 = Date.now(); await page.goto(`${s.url}?test=engine&w=${i}&s=${process.env.S || 12}`)
  try { await page.waitForFunction(() => window.__engine && window.__engine.done, null, { timeout: 90000 }) } catch { logs.push("timeout world " + i) }
  await page.locator("canvas").screenshot({ path: path.join(root, "shots", `engine-${i}.png`) }); console.log("world", i, Date.now() - t0, "ms") }
console.log(logs.slice(0, 6).join("\n") || "no errors"); await b.close(); s.close()
