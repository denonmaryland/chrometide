// Drives the share features in headless Chromium: the light viewer (embed.html), the <untitled-world>
// tag and the frame snippet in a plain page on another address, the Embed dialog in the app, and
// the community gallery. Pictures go to shots/.  Run after a build:  node tools/share-test.mjs
import fs from "fs"; import path from "path"; import { serve, browser, root } from "./serve.mjs"

const s = await serve(), host = await serve("shots"), b = await browser(); const logs = [], res = {}
const gallery = JSON.parse(fs.readFileSync(path.join(root, "gallery/worlds.json"), "utf8"))
const ctx = await b.newContext({ viewport: { width: 1000, height: 640 }, permissions: ["clipboard-read", "clipboard-write"] })
let p = await ctx.newPage()
const watch = (pg) => { pg.on("console", (m) => (m.type() === "error" || m.text().includes("SHADER")) && logs.push(m.text().slice(0, 300))); pg.on("pageerror", (e) => logs.push("PAGEERROR " + e.message.slice(0, 300))) }
watch(p)
const shot = (n, pg = p) => pg.screenshot({ path: path.join(root, "shots", n) })
const done = async (pg = p, t = 90000) => { await pg.waitForTimeout(300); await pg.waitForFunction(() => window.__engine && window.__engine.done, null, { timeout: t }).catch(() => logs.push("not done")); await pg.waitForTimeout(150) }
/** a small copy of the picture, and how much it varies (a blank or failed picture hardly varies) */
const pix = (pg = p) => pg.evaluate(() => { const c = document.querySelector("canvas"), t = document.createElement("canvas"); t.width = 32; t.height = 20; const x = t.getContext("2d"); x.drawImage(c, 0, 0, 32, 20); const d = x.getImageData(0, 0, 32, 20).data; let m = 0, v = 0; for (let i = 0; i < d.length; i += 4) m += d[i] + d[i + 1] + d[i + 2]; m /= d.length / 4; for (let i = 0; i < d.length; i += 4) v += (d[i] + d[i + 1] + d[i + 2] - m) ** 2; return { key: Array.from(d).join(","), spread: Math.round(Math.sqrt(v / (d.length / 4))) } })
const diff = (a, b) => { const x = a.key.split(","), y = b.key.split(","); let n = 0; for (let i = 0; i < x.length; i++) n += Math.abs(x[i] - y[i]); return Math.round(n / x.length) }
const code = gallery.find((g) => g.name === "Gold Stack").code, lettered = gallery.find((g) => g.name === "Neon Harbour").code

// ---------- the light viewer ----------
await p.goto(`${s.url}embed.html#w=${code}`); await done()
const a = await pix(); res.embedRenders = a.spread > 12; res.embedSpread = a.spread; res.embedName = await p.evaluate(() => window.__world.name)
await shot("s1-embed.png")
const box = await p.locator("canvas").boundingBox()
await p.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5); await p.mouse.down(); await p.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.42, { steps: 8 }); await p.mouse.up(); await done()
const a2 = await pix(); res.dragChangesPicture = diff(a, a2) > 4; res.dragDiff = diff(a, a2); await shot("s2-embed-dragged.png")
res.sharpensWhenStill = await p.evaluate(() => window.__engine.done)
const open = await p.locator(".uw-open").getAttribute("href"); res.openLinkKeepsWorld = open === `${s.url}#w=${code}`
res.openLinkNewTab = (await p.locator(".uw-open").getAttribute("target")) === "_blank"
// quality and autorotate
await p.goto(`${s.url}embed.html?quality=draft#w=${code}`); await done(); res.draftTarget = await p.evaluate(() => window.__engine.target)
await p.goto(`${s.url}embed.html?quality=premium#w=${code}`); await p.waitForTimeout(400); res.premiumTarget = await p.evaluate(() => window.__engine.target)
await p.goto(`${s.url}embed.html?autorotate=3#w=${code}`); await p.waitForTimeout(800)
const y0 = await p.evaluate(() => window.__world.cam.yaw); await p.waitForTimeout(1500); const y1 = await p.evaluate(() => window.__world.cam.yaw)
res.autorotateTurns = y1 > y0; res.autorotateLive = await p.evaluate(() => window.__engine.live); await shot("s3-embed-turning.png")
await p.mouse.move(box.x + 300, box.y + 300); await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(400)
res.touchStopsTurning = !(await p.evaluate(() => window.__engine.live)); await done(); res.stillAfterTurning = await p.evaluate(() => window.__engine.done)
// letters, and codes that are not there or broken
await p.goto(`${s.url}embed.html#w=${lettered}`); await done(); await p.waitForTimeout(1500); await done(); await shot("s4-embed-letters.png"); res.letteredSpread = (await pix()).spread
await p.goto(`${s.url}embed.html#w=w2.notaworld`); await p.waitForTimeout(500); res.badCodeMessage = await p.locator(".uw-message p").textContent().catch(() => null); await shot("s5-embed-bad.png")
await p.goto(`${s.url}embed.html`); await p.waitForTimeout(400); res.noCodeMessage = await p.locator(".uw-message p").textContent().catch(() => null)
// the link opens the full app with the same world
await p.goto(open); await p.waitForFunction(() => window.__app && window.__app.get().world.remixOf, null, { timeout: 30000 }).catch(() => logs.push("app did not load the world"))
res.appOpensSameWorld = await p.evaluate(() => window.__app.get().world.name)

// ---------- the Embed dialog in the app ----------
await p.goto(s.url); await done(p, 120000)
await p.locator('[data-testid^="starter-"]', { hasText: "Halo Ring" }).first().click(); await done()
res.galleryLinkInSidebar = await p.locator('[data-testid="open-gallery"]').getAttribute("href")
// Embed lives in the Share window (one press copies the link, the window offers embed and the gallery)
await p.click('[data-testid="share"]'); await p.click('[data-testid="embed"]'); await p.waitForSelector('[data-testid="snippet-frame"]', { timeout: 15000 })
await p.click('role=radio[name="Small"]'); await p.click('role=switch[name="Turn slowly"]'); await p.waitForTimeout(300); await shot("s6-dialog.png")
const frameSnip = await p.inputValue('[data-testid="snippet-frame"]'), tagSnip = await p.inputValue('[data-testid="snippet-tag"]')
await p.click('[data-testid="copy-frame"]'); await p.waitForTimeout(200); res.copiesFrame = (await p.evaluate(() => navigator.clipboard.readText())) === frameSnip
await p.click('[data-testid="copy-tag"]'); await p.waitForTimeout(200); res.copiesTag = (await p.evaluate(() => navigator.clipboard.readText())) === tagSnip
res.frameSnippet = frameSnip.slice(0, 90) + "…"; res.tagSnippet = tagSnip.split("\n")[0]
res.snippetsHaveTurn = frameSnip.includes("?autorotate#w=w2.") && tagSnip.includes(" autorotate")
const haloCode = /#w=(w2\.[A-Za-z0-9_-]+)/.exec(frameSnip)?.[1]; res.snippetCodeOpens = !!haloCode
await p.keyboard.press("Escape")

// ---------- both snippets in a plain page on another address ----------
fs.writeFileSync(path.join(root, "shots", "host-test.html"), `<!doctype html><meta charset="utf-8"><title>A plain page</title>
<body style="font:15px Georgia,serif;max-width:980px;margin:30px auto;background:#f4efe6;color:#222">
<h1>My blog post</h1><p>Here is a world I made, as a frame:</p>
${frameSnip}
<p>And the same kind of thing as a tag, filling the column:</p>
${tagSnip.replace(/ width="\d+" height="\d+"/, "").replace(" autorotate", "")}
</body>`)
await p.setViewportSize({ width: 1000, height: 1100 })
await p.goto(`${host.url}host-test.html`); await p.waitForTimeout(800)
const frames = () => p.frames().filter((f) => f.url().includes("embed.html"))
await p.waitForFunction(() => document.querySelector("untitled-world")?.shadowRoot?.querySelector("iframe")?.src, null, { timeout: 10000 }).catch(() => logs.push("tag made no frame"))
res.tagFrameSrc = await p.evaluate(() => document.querySelector("untitled-world").shadowRoot.querySelector("iframe").src.split("#")[0])
res.tagSize = await p.evaluate(() => { const r = document.querySelector("untitled-world").getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}` })
for (let i = 0; i < 60 && frames().length < 2; i++) await p.waitForTimeout(250)
res.framesOnHostPage = frames().length
for (const f of frames()) { await f.waitForFunction(() => window.__engine && (window.__engine.done || window.__engine.live), null, { timeout: 90000 }).catch(() => logs.push("frame not done " + f.url().slice(0, 60))) }
res.framesShowWorld = await Promise.all(frames().map((f) => f.evaluate(() => window.__world && window.__world.name)))
await p.waitForTimeout(500); await p.screenshot({ path: path.join(root, "shots", "s7-host-page.png"), fullPage: true })

// ---------- the gallery ----------
await p.setViewportSize({ width: 1440, height: 900 })
await p.goto(`${s.url}gallery.html`); await p.waitForSelector('[data-testid="gallery-card"]')
res.cards = await p.locator('[data-testid="gallery-card"]').count()
const t0 = Date.now(); await p.waitForFunction(() => document.querySelectorAll('[data-testid="gallery-thumb"]').length >= 8, null, { timeout: 120000 }).catch(() => logs.push("thumbs slow"))
res.firstEightThumbsSeconds = Math.round((Date.now() - t0) / 100) / 10
await p.waitForTimeout(1500); await shot("s8-gallery.png")
await p.click('[data-testid="tag-night"]'); await p.waitForTimeout(600)
res.nightCards = await p.locator('[data-testid="gallery-card"]').count(); res.nightExpected = gallery.filter((g) => g.tags.includes("night")).length
res.tagInAddress = new URL(p.url()).searchParams.get("tag")
await p.waitForFunction(() => document.querySelectorAll('[data-testid="gallery-thumb"]').length === document.querySelectorAll('[data-testid="gallery-card"]').length, null, { timeout: 120000 }).catch(() => logs.push("night thumbs slow"))
await p.waitForTimeout(500); await shot("s9-gallery-night.png")
const first = await p.locator('[data-testid="gallery-open"]').first(); const firstName = await first.textContent()
await first.click(); await p.waitForFunction(() => window.__app && window.__app.get().world.remixOf, null, { timeout: 30000 }).catch(() => logs.push("gallery click did not open the world"))
res.galleryOpensWorld = (await p.evaluate(() => window.__app.get().world.name)) === firstName
// phone: only the cards near the screen get pictures
await p.setViewportSize({ width: 390, height: 844 })
await p.goto(`${s.url}gallery.html`); await p.waitForSelector('[data-testid="gallery-thumb"]', { timeout: 60000 }); await p.waitForTimeout(6000)
res.phoneThumbsDrawnOf16 = await p.evaluate(() => window.__thumbs.done.size); await shot("s10-gallery-phone.png")
await p.evaluate(() => scrollTo(0, 1500)); await p.waitForTimeout(5000); await shot("s11-gallery-phone-scrolled.png")
res.phoneThumbsAfterScroll = await p.evaluate(() => window.__thumbs.done.size)
await p.goto(`${s.url}embed.html#w=${code}`); await done(); await shot("s12-embed-phone.png")

console.log(JSON.stringify(res, null, 1)); console.log(logs.slice(0, 12).join("\n") || "no errors")
await b.close(); s.close(); host.close()
