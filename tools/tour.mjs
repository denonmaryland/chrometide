// A picture of every screen, at three sizes: a big desktop, a laptop and a phone (touch).
// Run after a build:  node tools/tour.mjs [outdir]   (default shots/tour). Then contact sheets per size.
// Never reaches the internet: the GitHub calendar is answered from tools/fixtures/github-sample.json,
// and every other outside request is refused.
import fs from "fs"; import path from "path"; import { execFileSync } from "child_process"; import { serve, browser, root } from "./serve.mjs"
const out = path.resolve(root, process.argv[2] || "shots/tour"); fs.mkdirSync(out, { recursive: true })
const only = process.env.SIZES ? process.env.SIZES.split(",") : null
const fixture = fs.readFileSync(path.join(root, "tools/fixtures/github-sample.json"), "utf8")
const photo = path.join(root, "docs/images/hero.jpg")
const SIZES = [
  { id: "desk", viewport: { width: 1440, height: 900 } },
  { id: "laptop", viewport: { width: 1280, height: 720 } },
  { id: "phone", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
]
const s = await serve(), b = await browser(); const fails = [], made = {}
try {
  for (const size of SIZES) {
    if (only && !only.includes(size.id)) continue
    const phone = size.id === "phone"; made[size.id] = []
    const ctx = await b.newContext({ viewport: size.viewport, isMobile: !!size.isMobile, hasTouch: !!size.hasTouch, deviceScaleFactor: size.deviceScaleFactor || 1, permissions: ["clipboard-read", "clipboard-write"] })
    const p = await ctx.newPage(); p.setDefaultTimeout(8000); p.setDefaultNavigationTimeout(90000)
    p.on("pageerror", (e) => fails.push(`${size.id}: PAGEERROR ${e.message.slice(0, 200)}`))
    await p.route("**/*", (r) => { const u = r.request().url()
      if (u.startsWith(s.url) || u.startsWith("data:") || u.startsWith("blob:")) return r.continue()
      if (/github-contributions-api\.jogruber\.de\/v4\/sample-coder/.test(u)) return r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: fixture })
      return r.abort() })
    const settle = async (ms = 9000) => { await p.waitForTimeout(300); await p.waitForFunction(() => window.__engine && window.__engine.done, null, { timeout: ms }).catch(() => {}); await p.waitForTimeout(200) }
    const shot = async (name) => { const f = `${size.id}-${String(made[size.id].length + 1).padStart(2, "0")}-${name}.png`; await p.screenshot({ path: path.join(out, f) }); made[size.id].push(f) }
    const step = async (name, act, after) => { try { await act(); await shot(name) } catch (e) { fails.push(`${size.id} ${name}: ${String(e.message).split("\n")[0].slice(0, 160)}`) } finally { try { await after?.() } catch { /* next step starts clean anyway */ } } }
    const esc = async () => { await p.keyboard.press("Escape"); await p.waitForTimeout(250) }
    const fresh = async (firstRun = false) => {
      await p.goto(s.url); await p.evaluate((f) => { localStorage.clear(); if (!f) localStorage.setItem("uw-welcome-seen", "1") }, firstRun)
      await p.goto(s.url); await settle(15000)
    }
    // a click that works on a phone too: menus open on pointer events, so a real tap
    const tap = async (sel) => { const l = p.locator(sel).first(); await l.scrollIntoViewIfNeeded().catch(() => {}); if (phone) await l.tap(); else await l.click() }
    // on a phone the sidebar is a sheet; open it, pick, close it
    const part = async (type) => { if (phone) { await tap('[data-sidebar="trigger"]'); await p.waitForTimeout(350) } await tap(`[data-testid="part-${type}"]`); await p.waitForTimeout(300); if (phone && !(await p.locator('[data-testid="inspector"]:visible').count())) await tap('[data-testid="controls"]').catch(() => {}); await settle(4000) }
    // a top-bar control: on the bar itself, or folded into More (phone), or inside Share (embed)
    const menu = async (id) => {
      if (await p.locator(`[data-testid="${id}"]:visible`).count()) return tap(`[data-testid="${id}"]:visible`)
      if (id === "embed" && await p.locator('[data-testid="share"]:visible').count()) { await tap('[data-testid="share"]:visible'); await p.waitForTimeout(300); if (await p.locator('[data-testid="embed"]:visible').count()) return tap('[data-testid="embed"]:visible'); await esc() }
      await tap('[data-testid="more-menu"]:visible'); await p.waitForTimeout(250); if (id === "file-menu") return // File's items are inside More
      await tap(`[data-testid="more-${id.replace(/^open-/, "")}"]:visible`)
    }
    const mode = async (id) => { await menu("modes-menu"); await p.waitForTimeout(250); await tap(`[data-testid="mode-${id}"]`); await p.waitForTimeout(600) }

    // ---- first look, as a new visitor sees it ----
    await fresh(true); await shot("first-run")
    await fresh()
    await step("home", async () => {})
    if (phone) await step("sidebar-sheet", async () => { await tap('[data-sidebar="trigger"]'); await p.waitForTimeout(500) }, esc)
    for (const t of ["sky", "sea", "land", "title", "camera", "picture", "sound"]) await step(`part-${t}`, () => part(t), async () => { if (phone) await tap('[data-testid="controls"]').catch(() => {}) })
    if (!phone) await step("part-sky-scrolled", async () => { await part("sky"); await p.locator('[data-testid="inspector"]').hover(); await p.mouse.wheel(0, 2000); await p.waitForTimeout(300) })
    await step("thing-selected", async () => {
      await p.evaluate(() => { const s = window.__app.get(), t = s.world.things[0]; if (t) window.__app.patch({ sel: { type: "thing", id: t.id } }) }); await settle(4000)
      if (phone) await tap('[data-testid="controls"]').catch(() => {})
    }, async () => { if (phone) await tap('[data-testid="controls"]').catch(() => {}); await p.evaluate(() => window.__app.patch({ sel: { type: "sky" } })) })
    await step("dock-add", async () => { await tap('[data-testid="dock-add"], [data-testid="viewport"] button:has-text("Add")'); await p.waitForTimeout(350) }, esc)
    await step("dock-keep", async () => { await tap('[data-testid="dock-keep"], [data-testid="viewport"] button:has-text("Keep")'); await p.waitForTimeout(350) }, esc)
    await step("file-menu", async () => { await menu("file-menu"); await p.waitForTimeout(350) }, async () => { await esc(); await esc() })
    await step("modes-menu", async () => { await menu("modes-menu"); await p.waitForTimeout(350) }, async () => { await esc(); await esc() })
    if (await p.locator('[data-testid="more-menu"]:visible').count()) await step("more-menu", async () => { await tap('[data-testid="more-menu"]:visible'); await p.waitForTimeout(350) }, esc)
    await step("find", async () => { await p.evaluate(() => window.__app.patch({ dialog: "find" })); await p.waitForTimeout(300); await p.keyboard.type("gold"); await p.waitForTimeout(300) }, esc)
    await step("find-empty", async () => { await p.evaluate(() => window.__app.patch({ dialog: "find" })); await p.waitForTimeout(300); await p.keyboard.type("zzqx"); await p.waitForTimeout(300) }, esc)
    await step("design-make", async () => { await menu("open-cover"); await p.waitForSelector('[data-testid="cover-canvas"]', { state: "visible", timeout: 90000 }); await p.waitForTimeout(400) })
    await step("design-make-scrolled", async () => { await p.locator('[role="dialog"]').first().evaluate((d) => { d.scrollTop = d.scrollHeight }); await p.waitForTimeout(200) })
    await step("design-shelf", async () => { await tap('[data-testid="design-shelf"]'); await p.waitForTimeout(3500) }, esc)
    await step("loop", async () => { await menu("open-loop"); await p.waitForTimeout(1500) }, esc)
    await step("timeline", async () => { await menu("open-timeline"); await p.waitForTimeout(800) }, async () => { await p.evaluate(() => window.__app.patch({ timeline: false })) })
    await step("embed", async () => { await menu("embed"); await p.waitForSelector('[data-testid="embed-dialog"]', { timeout: 15000 }); await p.waitForTimeout(1500) }, esc)
    await step("share-copied", async () => { await menu("share"); await p.waitForTimeout(300) })
    // ---- the modes ----
    await step("mode-word", async () => { await mode("word"); await p.waitForTimeout(300) }, esc)
    await step("mode-1994", async () => { await mode("1994"); await p.waitForTimeout(5000) }, esc)
    await step("mode-screensaver", async () => { await mode("screensaver"); await p.waitForTimeout(3500) }, async () => { await p.keyboard.press("k"); await p.waitForTimeout(500) })
    await fresh()
    await step("mode-github", async () => { await mode("github-island"); await p.waitForSelector('[data-testid="island-dialog"]') })
    await step("mode-github-result", async () => { await p.fill('[data-testid="island-user"]', "sample-coder"); await tap('[data-testid="island-go"]'); await p.waitForSelector('[data-testid="island-result"]', { timeout: 20000 }); await settle(8000) }, esc)
    await fresh()
    await step("mode-photo", async () => { const [fc] = await Promise.all([p.waitForEvent("filechooser"), mode("photo-world")]); await fc.setFiles(photo); await p.waitForTimeout(800); await settle(8000) })
    await step("mode-fly", async () => { await mode("fly"); await p.waitForTimeout(1500) }, esc)
    await step("mode-look", async () => { await mode("look"); await p.waitForTimeout(5000) }, async () => { await esc(); await p.locator('[data-testid="look-close"]').click({ timeout: 1000 }).catch(() => {}) })
    await step("mode-timelapse", async () => { await mode("timelapse"); await p.waitForTimeout(600) }, esc)
    // ---- the other pages ----
    await step("gallery", async () => { await p.goto(s.url + "gallery.html"); await p.waitForSelector('[data-testid="gallery-card"]'); await p.waitForTimeout(6000) })
    await step("embed-page", async () => { await p.goto(s.url); await settle(); const code = await p.evaluate(async () => (await window.__app.shareLink()).split("#w=")[1]); await p.goto(s.url + "embed.html#w=" + code); await settle(9000) })
    await step("embed-page-empty", async () => { await p.goto(s.url + "embed.html"); await p.waitForTimeout(800) })
    await ctx.close()
    // contact sheet for this size
    const tiles = made[size.id].map((f) => path.join(out, f))
    if (tiles.length) try { execFileSync("montage", ["-label", "%t", ...tiles, "-tile", phone ? "8x" : "4x", "-geometry", phone ? "260x+6+6" : "480x+6+6", "-pointsize", "11", "-background", "#222", "-fill", "#ddd", path.join(out, `sheet-${size.id}.jpg`)]) } catch (e) { fails.push("montage: " + e.message.slice(0, 120)) }
  }
} finally { await b.close(); s.close() }
console.log(Object.entries(made).map(([k, v]) => `${k}: ${v.length} pictures`).join("\n")); console.log(fails.length ? "PROBLEMS\n" + fails.join("\n") : "no problems"); console.log("in", out)
