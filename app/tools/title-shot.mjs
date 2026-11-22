import path from "path"; import { serve, browser, root } from "./serve.mjs"
const s = await serve(), b = await browser(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
await p.goto(s.url); await p.waitForFunction(() => window.__engine && window.__engine.done, null, { timeout: 60000 })
await p.click('[data-testid="starter-2"]'); await p.click('[data-testid="part-title"]'); await p.fill('[data-testid="title-input"]', "LOW TIDE")
await p.evaluate(() => window.__app.edit("t", (w) => { w.cam.yaw = 0.12; w.sky.zenith = "#4a22b0"; w.sky.horizon = "#ff8a4a"; w.sky.haze = "#ffb27a"; w.sea.reflect = 0.9; w.sea.wave = 0.06 }))
await p.waitForTimeout(600); await p.waitForFunction(() => window.__engine.done, null, { timeout: 60000 }); await p.waitForTimeout(300)
await p.screenshot({ path: path.join(root, "shots", "t4-lettering.png") }); await b.close(); s.close()
