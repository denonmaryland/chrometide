// Strangers will open odd links, drop odd files and use odd browsers. This drives the built app in
// headless Chromium through the worst of it and checks that every case ends calmly: no page error,
// a picture on screen (or a clear page saying why not), and a short message saying what happened.
//   node tools/sturdy-test.mjs        (after a build; pictures of the messages go to shots/)
import fs from "fs"; import path from "path"; import zlib from "zlib"; import { serve, browser, root } from "./serve.mjs"

const s = await serve(), b = await browser(); const res = {}, bad = []
const gallery = JSON.parse(fs.readFileSync(path.join(root, "gallery/worlds.json"), "utf8")), good = gallery[0].code
const b64u = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
const code = (text) => "w2." + b64u(zlib.deflateRawSync(Buffer.from(text)))
const world = (o) => code(JSON.stringify({ ...JSON.parse(zlib.inflateRawSync(Buffer.from(good.slice(3).replace(/-/g, "+").replace(/_/g, "/"), "base64")).toString()), ...o }))
const shot = (p, n) => p.screenshot({ path: path.join(root, "shots", n) })

/** A fresh page, watched for errors, requests to other hosts, and pop-up dialogs. */
async function page(init, viewport = { width: 1280, height: 800 }) {
  const ctx = await b.newContext({ viewport }); const p = await ctx.newPage(), log = []
  if (init) await p.addInitScript(init)
  p.on("console", (m) => m.type() === "error" && log.push(m.text().slice(0, 200))); p.on("pageerror", (e) => log.push("PAGEERROR " + e.message.slice(0, 200)))
  p.on("dialog", (d) => { log.push("DIALOG " + d.message()); void d.dismiss() })
  p.on("request", (r) => { const u = r.url(); if (!u.startsWith(s.url) && !u.startsWith("data:") && !u.startsWith("blob:")) log.push("OUTSIDE " + u.slice(0, 80)) })
  return { p, log, close: () => ctx.close() }
}
const done = (p, t = 60000) => p.waitForFunction(() => window.__engine?.done, null, { timeout: t }).then(() => true, () => false)
const spread = (p) => p.evaluate(() => { const c = document.querySelector('[data-testid="viewport"] canvas') ?? document.querySelector("canvas"); if (!c) return 0; const t = document.createElement("canvas"); t.width = 32; t.height = 20; const x = t.getContext("2d"); x.drawImage(c, 0, 0, 32, 20); const d = x.getImageData(0, 0, 32, 20).data; let lo = 255, hi = 0; for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; lo = Math.min(lo, v); hi = Math.max(hi, v) } return Math.round(hi - lo) })
const notices = (p) => p.evaluate(() => [...(window.__noticeLog ?? [])])
const check = (name, ok, why) => { res[name] = ok; if (!ok) bad.push(`${name}: ${why ?? ""}`) }

// ---------- links that are cut short, garbage, huge, hostile or old ----------
const LINKS = {
  truncated: good.slice(0, Math.floor(good.length / 2)),
  garbage: "w2.!!!not*a*world%%%",
  notAWorld: "hello-there",
  empty: "",
  oldFormat: Buffer.from(JSON.stringify({ zenith: "#123456", horizon: "#abcdef", spheres: 7 })).toString("base64"),
  notJson: code("this is not json"),
  wrongVersion: code(JSON.stringify({ v: 9, things: [] })),
  absurdNumbers: world({ cam: { yaw: 1e308, pitch: -1e308, dist: 0, target: [1e300, null, "x"], fov: 1e9, roll: 0, lens: 99, focus: -5 }, sky: { sun: { az: "NaN", el: 1e999 }, zenith: "red; background:url(https://evil.example/x)", hazeAmt: -1e30 }, bloom: 1e40, frame: { w: 1e9, h: -4, name: 7 } }),
  tenThousand: world({ things: Array.from({ length: 10000 }, (_, i) => ({ id: "a", kind: i % 3 ? "sphere" : "nonsense", pos: [i, 1, 0], size: [1, 1, 1], rot: [0, 0, 0], round: 0, role: "solid", group: 0, mat: {} })) }),
  hugeName: world({ name: "N".repeat(5_000_000) }),
  bomb: "w2." + b64u(zlib.deflateRawSync(Buffer.alloc(60_000_000, 32))),
  hostile: world({ name: '<img src=x onerror="alert(1)">', remixOf: "<script>alert(2)</script>", picture: "https://evil.example/track.png", customFont: "data:font/woff2;base64,AAAA) , url(https://evil.example/f", things: [{ kind: "text", name: "<b>x</b>", text: { str: "<svg onload=alert(3)>" }, pos: [0, 2, 0], size: [2, 1, 0.2], mat: { color: "javascript:alert(4)" } }], anim: { keys: [{ t: "x", pose: null }, { t: 0.5, pose: { things: "no" } }] } }),
  proto: code('{"v":2,"__proto__":{"polluted":1},"sky":{"__proto__":{"polluted":1}},"things":[{"kind":"sphere","__proto__":{"polluted":1}}]}'),
  wrongTypes: world({ sky: "blue", sea: [1, 2], land: null, things: { 0: 1 }, views: "x", anim: 5, sound: "loud", model: { n: 1e6, data: "!!" } }),
}
for (const [name, c] of Object.entries(LINKS)) {
  const { p, log, close } = await page(); const t0 = Date.now()
  await p.goto(`${s.url}#w=${c}`)
  if (name === "truncated" || name === "oldFormat") { await p.waitForSelector('[data-testid="notice"]', { timeout: 10000 }).catch(() => {}); await shot(p, `sturdy-link-${name}.png`) }
  const finished = await done(p); await p.waitForTimeout(400)
  const n = await notices(p), sp = await spread(p), ms = Date.now() - t0
  const injected = await p.evaluate(() => !!document.querySelector('img[src="x"], script:not([src]):not([type]), svg[onload]') || [...document.querySelectorAll("b")].some((b) => b.textContent === "x")) // nothing from the link may become an element (the app's own bold words are fine)
  const w = await p.evaluate(() => { const w = window.__app.get().world; return { name: w.name.length, things: w.things.length, polluted: ({}).polluted === 1 } })
  res[`link_${name}`] = { ms, notice: n[0]?.slice(0, 70) ?? "", spread: sp, things: w.things }
  check(`link_${name}_calm`, finished && sp > 8 && !log.length && !injected && !w.polluted && w.name <= 60 && ms < 20000, JSON.stringify({ finished, sp, log, injected, w, ms }))
  if (!["absurdNumbers", "hostile", "hugeName", "proto", "wrongTypes"].includes(name)) check(`link_${name}_said`, n.length > 0, "no message")
  await close()
}
// the light viewer says why too
{ const { p, log, close } = await page(); await p.goto(`${s.url}embed.html#w=${LINKS.truncated}`); await p.waitForTimeout(800)
  const t = await p.evaluate(() => document.querySelector(".uw-message")?.textContent ?? ""); check("embed_truncated", /cut short/.test(t) && !log.length, t + log); await shot(p, "sturdy-embed-truncated.png"); await close() }
// a link pasted into the address bar of the open app opens too
{ const { p, log, close } = await page(); await p.goto(s.url); await done(p)
  await p.evaluate((c) => { location.hash = "w=" + c }, gallery[1].code); await p.waitForTimeout(800); await done(p)
  check("hashchange_opens", (await p.evaluate(() => window.__app.get().world.name)) === gallery[1].name && !log.length, log.join()); await close() }

// ---------- the graphics chip goes away, and comes back (or not) ----------
{ const { p, log, close } = await page(); await p.goto(s.url); await done(p)
  await p.evaluate(() => { window.__lose = window.__engine.canvas.getContext("webgl2").getExtension("WEBGL_lose_context"); window.__lose.loseContext() })
  await p.waitForTimeout(500); check("lost_says_so", await p.locator('[data-testid="context-lost"]').isVisible()); await shot(p, "sturdy-context-lost.png")
  await p.evaluate(() => window.__lose.restoreContext()); await p.waitForTimeout(300)
  const back = await done(p); await p.waitForTimeout(300); const sp = await spread(p)
  check("restored_draws", back && sp > 8 && !(await p.locator('[data-testid="context-lost"]').count()), JSON.stringify({ back, sp, log }))
  // and the picture still changes after it came back
  await p.evaluate(() => window.__app.rollDice()); check("restored_still_works", await done(p) && (await spread(p)) > 8)
  // lost for good: a calm message and a way forward
  await p.evaluate(() => window.__engine.canvas.getContext("webgl2").getExtension("WEBGL_lose_context").loseContext())
  await p.waitForTimeout(5800); const gone = await p.locator('[data-testid="context-lost"]').textContent()
  check("gone_offers_reload", /reload/i.test(gone ?? ""), gone); await shot(p, "sturdy-context-gone.png")
  check("context_no_errors", !log.filter((l) => !/CONTEXT_LOST/.test(l)).length, log.join(" | ")); await close() }

// ---------- browsers without WebGL2, or without float targets ----------
{ const { p, log, close } = await page(() => { const get = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (k, ...a) { return k === "webgl2" ? null : get.call(this, k, ...a) } })
  await p.goto(s.url); await p.waitForTimeout(800)
  const t = await p.locator('[data-testid="trouble"]').textContent().catch(() => ""); check("noWebgl2_page", /WebGL2/.test(t) && !log.length, t + log.join()); await shot(p, "sturdy-no-webgl2.png"); await close() }
{ const { p, log, close } = await page(() => { const get = WebGL2RenderingContext.prototype.getExtension; WebGL2RenderingContext.prototype.getExtension = function (n) { return /color_buffer_float|color_buffer_half_float|float_blend/i.test(n) ? null : get.call(this, n) } })
  await p.goto(s.url); const ok = await done(p, 90000); const sp = await spread(p)
  await p.evaluate(() => window.__app.rollDice()); const ok2 = await done(p, 90000)
  check("noFloat_draws", ok && ok2 && sp > 8 && !log.length, JSON.stringify({ ok, ok2, sp, log })); await shot(p, "sturdy-no-float.png"); await close() }
{ const { p, log, close } = await page(); await p.goto(`${s.url}?api=1`); await p.waitForFunction(() => window.__api, null, { timeout: 30000 })
  const out = await p.evaluate(async () => { const a = window.__api, r = []; for (const x of [null, 5, "w2.zzz", { v: 2 }, { v: 2, things: [{ kind: "x" }] }]) { try { const w = a.tidy(x ?? {}); r.push(!!w.sky) } catch (e) { r.push("threw " + e.message) } } r.push(await a.why("w2.abc")); r.push((await a.render({ v: 2 }, NaN, 1e9, -3)).length > 100); return r })
  check("api_junk", out.slice(0, 5).every((x) => x === true) && /cut short/.test(out[5]) && out[6] === true && !log.length, JSON.stringify(out) + log); await close() }

// ---------- files that are not what they claim ----------
function bigPng(w, h) { // a one-bit picture with a great many pixels, small on disk
  const crc = (buf) => { let c = ~0; for (const x of buf) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1 } return ~c >>> 0 }
  const chunk = (t, d) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]), c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]) }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 1; ih[9] = 0
  const row = Buffer.alloc(1 + Math.ceil(w / 8)), raw = Buffer.alloc(row.length * h)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ih), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))])
}
const FILES = {
  textAsPng: { name: "photo.png", type: "image/png", b64: Buffer.from("just some words, not a picture").toString("base64"), via: "setPicture" },
  textAsPngLand: { name: "land.png", type: "image/png", b64: Buffer.from("not a picture either").toString("base64"), via: "photoToLand" },
  zeroFont: { name: "empty.woff2", type: "font/woff2", b64: "", via: "drop" },
  corruptGlb: { name: "broken.glb", type: "model/gltf-binary", b64: Buffer.concat([Buffer.from("glTF"), Buffer.alloc(40, 7)]).toString("base64"), via: "drop" },
  textAsGlb: { name: "notes.glb", type: "", b64: Buffer.from("hello").toString("base64"), via: "drop" },
  emptyObj: { name: "nothing.obj", type: "", b64: Buffer.from("# no faces here\n").toString("base64"), via: "drop" },
  hugePhoto: { name: "huge.png", type: "image/png", b64: bigPng(12000, 11000).toString("base64"), via: "drop" },
  textAsJpgDrop: { name: "holiday.jpg", type: "image/jpeg", b64: Buffer.from("<html><script>alert(1)</script>").toString("base64"), via: "drop" },
  someText: { name: "readme.txt", type: "text/plain", b64: Buffer.from("hi").toString("base64"), via: "drop" },
}
{ const { p, log, close } = await page(); await p.goto(s.url); await done(p)
  for (const [name, f] of Object.entries(FILES)) {
    const t0 = Date.now(), before = await p.evaluate(() => JSON.stringify(window.__app.get().world).length)
    await p.evaluate(async (f) => {
      const bin = atob(f.b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); const file = new File([u], f.name, { type: f.type })
      if (f.via === "drop") { const dt = new DataTransfer(); dt.items.add(file); for (const t of ["dragenter", "dragover", "drop"]) window.dispatchEvent(new DragEvent(t, { dataTransfer: dt, bubbles: true, cancelable: true })) }
      else await window.__io[f.via](file)
    }, f)
    await p.waitForTimeout(1500); const n = [...(await notices(p)), ...(await p.locator('[data-testid="photo-note"]').allTextContents())]
    const ms = Date.now() - t0, after = await p.evaluate(() => JSON.stringify(window.__app.get().world).length), sp = await spread(p)
    res[`file_${name}`] = n.at(-1)?.slice(0, 70) ?? ""
    check(`file_${name}`, n.length > 0 && !log.length && ms < 15000 && sp > 8 && (name === "hugePhoto" || after === before), JSON.stringify({ n, log, ms, sp, before, after }))
    if (name === "corruptGlb") await shot(p, "sturdy-file-corrupt-glb.png")
    if (name === "hugePhoto") await shot(p, "sturdy-file-huge-photo.png")
    await p.evaluate(() => document.querySelectorAll('[aria-label="Close message"]').forEach((b) => b.click())); await p.waitForTimeout(100)
  }
  // more than a world can hold: the 21st thing is refused kindly
  await p.evaluate(() => { const a = window.__app; a.edit("clear", (w) => { w.things = [] }) })
  for (let i = 0; i < 21; i++) { await p.click('button:has-text("Add")'); await p.click('role=menuitem[name="Sphere"]') }
  const count = await p.evaluate(() => window.__app.get().world.things.length), n = await notices(p)
  check("thing_limit", count === 20 && n.some((x) => /up to 20/.test(x)) && !log.length, JSON.stringify({ count, n, log })); await shot(p, "sturdy-thing-limit.png"); await close() }

// ---------- storage blocked (a private window) or full ----------
{ const { p, log, close } = await page(() => { Object.defineProperty(window, "localStorage", { get() { throw new DOMException("The page is not allowed to keep things", "SecurityError") } }) })
  await p.goto(s.url); const ok = await done(p); await p.evaluate(() => window.__app.saveToShelf()); await p.waitForTimeout(300)
  const n = await notices(p), kept = await p.evaluate(() => window.__app.get().saved.length)
  check("storage_blocked", ok && kept === 1 && n.some((x) => /this visit only/.test(x)) && !log.length, JSON.stringify({ ok, n, kept, log })); await shot(p, "sturdy-storage-blocked.png"); await close() }
{ const { p, log, close } = await page(() => { localStorage.setItem("untitled-worlds:saved", "{\"not\":\"a list\"}"); Storage.prototype.setItem = function () { throw new DOMException("full", "QuotaExceededError") } })
  await p.goto(s.url); const ok = await done(p); await p.evaluate(() => window.__app.saveToShelf()); await p.waitForTimeout(300)
  const n = await notices(p); check("storage_full_and_spoiled", ok && n.some((x) => /this visit only/.test(x)) && !log.length, JSON.stringify({ ok, n, log })); await close() }

// ---------- a fall inside the interface shows a calm page, not a blank one ----------
{ const { p, log, close } = await page(); await p.goto(s.url); await done(p)
  await p.evaluate(() => window.__app.patch({ world: { ...window.__app.get().world, sky: null } })); await p.waitForTimeout(500)
  const t = await p.locator('[data-testid="trouble"]').textContent().catch(() => ""); check("safety_page", /went wrong/.test(t), t); await shot(p, "sturdy-safety.png"); void log; await close() }

await b.close(); s.close()
console.log(JSON.stringify(res, null, 1))
if (bad.length) { console.log("FAILED\n  " + bad.join("\n  ")); process.exit(1) } else console.log("all calm")
