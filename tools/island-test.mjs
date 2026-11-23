// Tests "Your GitHub year as an island" in headless Chromium. Makes no requests to the internet:
// the calendar service is answered from tools/fixtures/github-sample.json (a made-up year in the
// same shape as github-contributions-api.jogruber.de/v4/<user>?y=last), and every outside request is recorded.
import fs from "fs"; import path from "path"; import { serve, browser, root } from "./serve.mjs"
const s = await serve(), b = await browser(); const logs = [], res = {}, fails = []
const fixture = fs.readFileSync(path.join(root, "tools/fixtures/github-sample.json"), "utf8"), F = JSON.parse(fixture)
const check = (name, ok, got) => { res[name] = ok ? true : `FAILED${got !== undefined ? " (" + JSON.stringify(got).slice(0, 160) + ")" : ""}`; if (!ok) fails.push(name) }
const outside = [], served = []
async function page(ctx, url) {
  const p = await ctx.newPage()
  p.on("console", (m) => (m.type() === "error" || m.text().includes("SHADER")) && !m.text().includes("404") && logs.push(m.text().slice(0, 300))); p.on("pageerror", (e) => logs.push("PAGEERROR " + e.message.slice(0, 300)))
  p.on("request", (q) => { if (!q.url().startsWith(s.url) && !q.url().startsWith("data:") && !q.url().startsWith("blob:")) outside.push(q.url()) })
  await p.route("https://github-contributions-api.jogruber.de/**", (route) => { const u = route.request().url(); served.push(u)
    if (/\/v4\/sample-coder\?y=last$/.test(u)) return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: fixture })
    return route.fulfill({ status: 404, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ error: "GitHub user not found" }) }) })
  await p.goto(url); return p
}
const done = async (p, t = 90000) => { await p.waitForTimeout(400); await p.waitForFunction(() => window.__engine && window.__engine.done, null, { timeout: t }).catch(() => logs.push("not done")); await p.waitForTimeout(150) }
const shot = (p, n) => p.screenshot({ path: path.join(root, "shots", n) })
const world = (p) => p.evaluate(() => window.__app.get().world)

const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] })
const p = await page(ctx, s.url); await done(p)

// ---- reading calendars, in the page ----
const parsed = await p.evaluate(async (fx) => {
  const { parse, stats } = window.__islandLib
  const d = JSON.parse(fx), gql = { data: { user: { login: "sample-coder", contributionsCollection: { contributionCalendar: { totalContributions: 0, weeks: [{ contributionDays: d.contributions.slice(0, 7).map((c) => ({ date: c.date, contributionCount: c.count })) }, { contributionDays: d.contributions.slice(7).map((c) => ({ date: c.date, contributionCount: c.count })) }] } } } } }
  const a = parse(d, "sample-coder"), g = parse(gql), t = parse("2026-01-05 3\n2026-01-06, 0\n2026-01-07\t12"), bad = parse({ hello: 1 }), junk = parse("nothing here"), many = parse({ contributions: Array.from({ length: 900 }, (_, i) => ({ date: new Date(Date.UTC(2024, 0, 1) + i * 864e5).toISOString().slice(0, 10), count: 1 })) })
  return { days: a.days.length, total: stats(a).total, gqlUser: g.user, gqlSame: JSON.stringify(g.days) === JSON.stringify(a.days), text: t && t.days.map((x) => x.count).join(","), bad, junk, manyDays: many.days.length, streak: stats(a).streak, busiest: stats(a).busiest }
}, fixture)
check("parseService", parsed.days === F.contributions.length && parsed.total === F.total.lastYear, parsed)
check("parseGraphQL", parsed.gqlUser === "sample-coder" && parsed.gqlSame)
check("parseText", parsed.text === "3,0,12", parsed.text)
check("parseRejectsJunk", parsed.bad === null && parsed.junk === null)
check("keepsLast53Weeks", parsed.manyDays === 371, parsed.manyDays)
res.sample-coder = { total: parsed.total, busiest: parsed.busiest, longestRun: parsed.streak }

// ---- the Modes menu opens it, and it says what is sent where ----
await p.click('[data-testid="modes-menu"]'); await p.click('[data-testid="mode-github-island"]'); await p.waitForSelector('[data-testid="island-dialog"]', { timeout: 5000 })
const privacy = await p.textContent('[data-testid="island-privacy"]'); check("privacyNote", /username is sent to github-contributions-api\.jogruber\.de/.test(privacy) && /public contribution calendar/.test(privacy), privacy)
check("nothingSentOnOpen", outside.length === 0, outside)
await shot(p, "island-1-open.png")

// ---- a bad name is caught before anything is sent; an unknown one is reported ----
await p.fill('[data-testid="island-user"]', "not a name!"); await p.click('[data-testid="island-go"]'); await p.waitForTimeout(200)
check("badNameCaught", /does not look like a GitHub username/.test(await p.textContent('[data-testid="island-note"]').catch(() => "")) && served.length === 0)
await p.fill('[data-testid="island-user"]', "no-such-person-xyz"); await p.click('[data-testid="island-go"]'); await p.waitForSelector('[data-testid="island-note"]:has-text("No GitHub user")', { timeout: 10000 }).catch(() => {})
check("unknownUser", /No GitHub user called "no-such-person-xyz"/.test(await p.textContent('[data-testid="island-note"]').catch(() => "")))

// ---- the real thing ----
await p.fill('[data-testid="island-user"]', "https://github.com/sample-coder"); const t0 = Date.now(); await p.click('[data-testid="island-go"]')
await p.waitForSelector('[data-testid="island-result"]', { timeout: 15000 }); await done(p); res.buildSeconds = +((Date.now() - t0) / 1000).toFixed(1)
const w = await world(p)
check("onlyUsernameSent", served.at(-1) === "https://github-contributions-api.jogruber.de/v4/sample-coder?y=last", served)
check("landFromGrid", w.land.on && w.land.flat && typeof w.land.sculpt === "string" && w.land.sculpt.length > 20000)
check("nameInLetters", w.things.some((t) => t.kind === "text" && t.text.str === "TORVALDS"), w.things.map((t) => t.name))
check("countInLetters", w.things.some((t) => t.kind === "text" && t.text.str === `${F.total.lastYear} CONTRIBUTIONS`))
check("withinThingLimit", w.things.length <= 20, w.things.length)
check("bannerFrame", w.frame.w === 1500 && w.frame.h === 500, w.frame)
check("skyFromYear", w.sky.zenith === "#170840", w.sky.zenith) // 4039 a year: the blazing sky
const summary = await p.textContent('[data-testid="island-result"]'); check("statsShown", summary.includes("4,039") && /A blazing year/.test(summary), summary.slice(0, 200))
// busy days are high ground, quiet water stays water: the busiest day's peak stands tall
const ground = await p.evaluate(() => { const w = window.__app.get().world, e = window.__engine, top = w.things.find((t) => t.name.startsWith("Busiest day")); return { busiest: e.groundAt(top.pos[0], top.pos[2]), farSea: e.groundAt(0, -18), name: top.name } })
check("busiestDayIsAPeak", ground.busiest > 3.5 && ground.farSea <= 0.01, ground)
await p.keyboard.press("Escape"); await p.waitForTimeout(300); await shot(p, "island-2-app.png")

// ---- one busy day in a quiet year: the peak stands where that day is, and the rest is sea ----
await p.click('[data-testid="modes-menu"]'); await p.click('[data-testid="mode-github-island"]'); await p.click('[data-testid="island-paste-open"]')
const lone = Array.from({ length: 365 }, (_, i) => `${new Date(Date.UTC(2025, 10, 23) + i * 864e5).toISOString().slice(0, 10)} ${i === 180 ? 30 : 0}`).join("\n")
await p.fill('[data-testid="island-paste"]', lone); await p.fill('[data-testid="island-user"]', "lone-day"); await p.click('[data-testid="island-use"]'); await done(p)
const lw = await world(p), lg = await p.evaluate(() => { const w = window.__app.get().world, e = window.__engine, top = w.things.find((t) => t.name.startsWith("Busiest day")); return { at: top.name, peak: e.groundAt(top.pos[0], top.pos[2]), left: e.groundAt(top.pos[0] - 6, top.pos[2]), right: e.groundAt(top.pos[0] + 6, top.pos[2]) } })
check("loneDayPeak", lg.at.endsWith("2026-05-22") && lg.peak > 2.5 && lg.left <= 0.01 && lg.right <= 0.01, lg)
check("quietSky", lw.sky.zenith === "#040822" && lw.sky.stars > 1, lw.sky.zenith)
check("pastedSendsNothing", served.length === 2, served) // the unknown name and sample-coder; the bad name never left
await shot(p, "island-3-lone.png")

// ---- GitHub's own GraphQL answer, pasted ----
const gql = JSON.stringify({ data: { user: { login: "sample-coder", contributionsCollection: { contributionCalendar: { weeks: [{ contributionDays: F.contributions.map((c) => ({ date: c.date, contributionCount: c.count })) }] } } } } })
await p.click('[data-testid="island-paste-open"]'); await p.fill('[data-testid="island-paste"]', gql); await p.click('[data-testid="island-use"]'); await done(p)
check("pastedGraphQL", (await world(p)).things.some((t) => t.text?.str === "TORVALDS"))

// ---- square, save, link ----
await p.click('role=radio[name="Square"]'); await done(p); const sq = await world(p); check("squareFrame", sq.frame.w === 1200 && sq.frame.h === 1200 && sq.cam.yaw > 0.2, sq.frame)
await p.click('role=radio[name="Banner"]'); await done(p)
const [dl] = await Promise.all([p.waitForEvent("download", { timeout: 240000 }), p.click('[data-testid="island-save"]')]); const out = path.join(root, "shots", "island-saved-banner.png"); await dl.saveAs(out)
const png = fs.readFileSync(out); check("savedBanner", png.readUInt32BE(16) === 1500 && png.readUInt32BE(20) === 500, [png.readUInt32BE(16), png.readUInt32BE(20)]); res.savedName = dl.suggestedFilename(); res.savedKB = Math.round(png.length / 1024)
// a world built from pasted data is shared whole (the link holds the world)
await p.click('[data-testid="island-link"]'); await p.waitForTimeout(400); check("pastedLinkIsWorld", /#w=w2\./.test(await p.evaluate(() => window.__islandLink)))
await p.close()

// ---- ?github= in the address builds it at start-up ----
const p2 = await page(ctx, s.url + "?github=sample-coder"); await p2.waitForSelector('[data-testid="island-result"]', { timeout: 30000 }).catch(() => {}); await done(p2)
check("bootFromAddress", (await world(p2)).things.some((t) => t.text?.str === "TORVALDS"))
await p2.click('[data-testid="island-link"]'); await p2.waitForTimeout(300); check("linkIsShort", (await p2.evaluate(() => window.__islandLink)).endsWith("/?github=sample-coder"))
await shot(p2, "island-4-boot.png"); await p2.close()

// ---- on a phone ----
const phone = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const p3 = await page(phone, s.url + "?github=sample-coder"); await p3.waitForSelector('[data-testid="island-result"]', { timeout: 30000 }).catch(() => {}); await done(p3)
const fits = await p3.evaluate(() => { const r = document.querySelector('[data-testid="island-dialog"]').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.width > 300 })
check("phoneFits", fits); await shot(p3, "island-5-phone.png")
await p3.keyboard.press("Escape"); await p3.waitForTimeout(400); await shot(p3, "island-6-phone-world.png"); await phone.close()

check("noOutsideRequests", outside.every((u) => u.startsWith("https://github-contributions-api.jogruber.de/v4/")), [...new Set(outside)])
check("noErrors", logs.length === 0, logs)
console.log(JSON.stringify(res, null, 1)); console.log(fails.length ? `${fails.length} FAILED: ${fails.join(", ")}` : `all ${Object.values(res).filter((v) => v === true).length} checks passed`)
await b.close(); s.close(); process.exit(fails.length ? 1 : 0)
