// Opens the built app in headless Chromium and takes a first look: desktop and phone.
import path from "path"; import { serve, browser, root } from "./serve.mjs"
const s = await serve(), b = await browser(); const logs = []
const open = async (vp, mobile) => { const p = await b.newPage({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1 })
  p.on("console", (m) => (m.type() === "error" || m.text().includes("SHADER")) && logs.push(m.text().slice(0, 400))); p.on("pageerror", (e) => logs.push("PAGEERROR " + e.message.slice(0, 400)))
  await p.goto(s.url); await p.waitForFunction(() => window.__engine && window.__engine.done, null, { timeout: 60000 }).catch(() => logs.push("never done")); await p.waitForTimeout(2500); return p }
const d = await open({ width: 1440, height: 900 }, false); await d.screenshot({ path: path.join(root, "shots", "app-1-home.png") })
const m = await open({ width: 390, height: 844 }, true); await m.screenshot({ path: path.join(root, "shots", "app-phone.png") })
console.log(logs.slice(0, 8).join("\n") || "no errors"); await b.close(); s.close()
