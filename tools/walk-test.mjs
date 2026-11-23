// Walk inside and time-lapse, driven in headless Chromium: fly with keys and leave again, look
// around a 360° picture and drag it, then make ~15 edits and film them as a time-lapse.
// Usage: node tools/walk-test.mjs [fly] [look] [phone] [lapse]   (no names: all of them)
import path from "path"; import fs from "fs"; import { execFileSync } from "child_process"; import { serve, browser, root } from "./serve.mjs"
const want = new Set(process.argv.slice(2)), on = (k) => !want.size || want.has(k)
fs.mkdirSync(path.join(root, "shots"), { recursive: true })
// software video decoding: the GPU video decoder of headless Chromium here takes WebGL down with it
const s = await serve(), b = await browser(["--disable-domain-blocking-for-3d-apis", "--disable-accelerated-video-decode"]); const logs = [], res = {}
const page = async (o) => { const ctx = await b.newContext({ acceptDownloads: true, ...o }); const p = await ctx.newPage()
  p.on("console", (m) => (m.type() === "error" || m.text().includes("SHADER")) && logs.push(m.text().slice(0, 300))); p.on("pageerror", (e) => logs.push("PAGEERROR " + e.message.slice(0, 300))); return { ctx, p } }
const done = (p, t = 90000) => p.waitForTimeout(350).then(() => p.waitForFunction(() => window.__engine && window.__engine.done, null, { timeout: t }).catch(() => logs.push("not done")))
const pix = (p, sel = '[data-testid="viewport"] canvas') => p.evaluate((sel) => { const c = document.querySelector(sel), t = document.createElement("canvas"); t.width = 48; t.height = 32; const x = t.getContext("2d"); x.drawImage(c, 0, 0, 48, 32); return Array.from(x.getImageData(0, 0, 48, 32).data) }, sel)
const diff = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) d += Math.abs(a[i] - b[i]); return d / a.length }
const shot = (p, n) => p.screenshot({ path: path.join(root, "shots", n) })
const world = (p) => p.evaluate(() => window.__app.get().world)
const mode = async (p, id) => { await p.click('[data-testid="modes-menu"]'); await p.click(`[data-testid="mode-${id}"]`) }
const hold = async (p, key, ms) => { await p.keyboard.down(key); await p.waitForTimeout(ms); await p.keyboard.up(key); await p.waitForTimeout(250) }
const fly = (p) => p.evaluate(() => window.__fly)
const r2 = (v) => Math.round(v * 100) / 100

try {
  if (on("fly") || on("look")) {
    const { ctx, p } = await page({ viewport: { width: 1280, height: 800 } })
    await p.goto(s.url); await done(p)
    // a word on the world, so a mirrored picture would show
    await p.click('[data-testid="part-title"]'); await p.fill('[data-testid="title-input"]', "LOW TIDE"); await p.click('[data-testid="add-word"]'); await done(p)
    await p.click('[data-testid="part-sky"]'); await done(p); await shot(p, "w0-editor.png")
    const past0 = await p.evaluate(() => window.__app.get().past.length), cam0 = JSON.stringify((await world(p)).cam), rolls0 = await p.evaluate(() => window.__app.get().rolls), px0 = await pix(p)

    if (on("fly")) {
      await mode(p, "fly"); await p.waitForSelector('[data-testid="fly-layer"]'); await p.waitForTimeout(600)
      const a = await fly(p); res.flyStart = a.pos.map(r2)
      await hold(p, "w", 1400); const b1 = await fly(p)
      const f = [Math.sin(a.heading), Math.cos(a.heading)], moved = [b1.pos[0] - a.pos[0], b1.pos[2] - a.pos[2]]
      res.flyForward = r2(moved[0] * f[0] + moved[1] * f[1]); res.flyForwardOk = res.flyForward > 0.5
      await hold(p, "d", 900); const c = await fly(p); res.flyStrafe = r2(Math.hypot(c.pos[0] - b1.pos[0], c.pos[2] - b1.pos[2]))
      await hold(p, " ", 900); const d = await fly(p); res.flyUp = r2(d.pos[1] - c.pos[1]); res.spaceDidNotRoll = (await p.evaluate(() => window.__app.get().rolls)) === rolls0
      await p.mouse.move(640, 420); await p.mouse.down(); await p.mouse.move(760, 380, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(500)
      const e = await fly(p); res.flyTurned = r2(e.heading - d.heading); res.flyPitched = r2(e.pitch - d.pitch)
      await p.waitForTimeout(800); await shot(p, "w1-fly.png")
      // dive: hold sink and forward while looking down, for a long time
      await p.mouse.move(640, 420); await p.mouse.down(); await p.mouse.move(640, 700, { steps: 8 }); await p.mouse.up()
      await p.keyboard.down("q"); await p.keyboard.down("w"); let low = 1e9
      for (let i = 0; i < 12; i++) { await p.waitForTimeout(300); low = Math.min(low, (await fly(p)).pos[1]) }
      await p.keyboard.up("q"); await p.keyboard.up("w"); res.flyLowest = r2(low); res.neverUnderSea = low >= 0.5
      await p.waitForTimeout(700); await shot(p, "w2-fly-low.png")
      res.editorCamUntouchedWhileFlying = JSON.stringify((await world(p)).cam) === cam0
      await p.keyboard.press("Escape"); await p.waitForTimeout(300)
      res.flyLeft = (await p.locator('[data-testid="fly-layer"]').count()) === 0
      res.camRestored = JSON.stringify((await world(p)).cam) === cam0
      await done(p); res.pictureRestoredDiff = r2(diff(px0, await pix(p))); res.pictureRestored = res.pictureRestoredDiff < 2
      res.flyLeftNoUndoSteps = (await p.evaluate(() => window.__app.get().past.length)) === past0
      await shot(p, "w3-after-fly.png")
    }

    if (on("look")) {
      // the app's default quality (Good): a 4096 x 2048 picture
      const t0 = Date.now(); await mode(p, "look"); await p.waitForSelector('[data-testid="look-painting"]', { timeout: 5000 }).then(() => (res.lookPaintingCard = true)).catch(() => (res.lookPaintingCard = false))
      await p.waitForTimeout(500); await shot(p, "w4-look-painting.png")
      await p.waitForSelector('[data-testid="look-canvas"]', { timeout: 240000 }); res.lookPaintSeconds = Math.round((Date.now() - t0) / 1000)
      await p.waitForTimeout(900); await shot(p, "w5-look.png")
      const l0 = await pix(p, '[data-testid="look-canvas"]'), v0 = await p.evaluate(() => window.__look)
      res.lookNotBlank = l0.some((v, i) => i % 4 !== 3 && v > 30)
      await p.mouse.move(700, 450); await p.mouse.down(); await p.mouse.move(420, 520, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(500)
      const l1 = await pix(p, '[data-testid="look-canvas"]'), v1 = await p.evaluate(() => window.__look)
      res.lookDragDiff = r2(diff(l0, l1)); res.lookDragChanged = res.lookDragDiff > 3; res.lookTurned = r2(v1.lon - v0.lon)
      await shot(p, "w6-look-dragged.png")
      await p.mouse.move(640, 400); await p.mouse.wheel(0, -500); await p.waitForTimeout(600); res.lookZoomFov = r2((await p.evaluate(() => window.__look)).fov)
      res.lookVrButton = await p.locator('[data-testid="look-vr"]').count() // headless has no WebXR: the button stays hidden
      const [dl] = await Promise.all([p.waitForEvent("download"), p.click('[data-testid="look-save"]')]); const f360 = path.join(root, "shots", "out-360.png"); await dl.saveAs(f360); res.look360Bytes = fs.statSync(f360).size
      await p.keyboard.press("Escape"); await p.waitForTimeout(400); res.lookClosed = (await p.locator('[data-testid="look-layer"]').count()) === 0
      await done(p); res.editorRunsAgain = await p.evaluate(() => window.__engine.done)
      // from inside a flight: look around right where you are
      await mode(p, "fly"); await p.waitForSelector('[data-testid="fly-layer"]'); await hold(p, "w", 800); await p.click('[data-testid="fly-look"]')
      await p.waitForSelector('[data-testid="look-canvas"]', { timeout: 240000 }); await p.waitForTimeout(800); await shot(p, "w7-look-from-flight.png"); await p.click('[data-testid="look-close"]')
      res.camStillSame = JSON.stringify((await world(p)).cam) === cam0
    }
    await ctx.close()
  }

  if (on("phone")) {
    const { ctx, p } = await page({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 })
    await p.goto(s.url); await done(p); await mode(p, "fly"); await p.waitForSelector('[data-testid="fly-stick"]', { timeout: 5000 }).then(() => (res.phoneStick = true)).catch(() => (res.phoneStick = false))
    const a = await fly(p), st = await p.locator('[data-testid="fly-stick"]').boundingBox()
    if (st) { const cx = st.x + st.width / 2, cy = st.y + st.height / 2, c = await p.context().newCDPSession(p)
      await c.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: cx, y: cy }] }); await c.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: cx, y: cy - 40 }] })
      await p.waitForTimeout(1200); await shot(p, "w8-phone-fly.png"); await c.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await p.waitForTimeout(300)
      const b2 = await fly(p); res.phoneStickMoved = r2(Math.hypot(b2.pos[0] - a.pos[0], b2.pos[2] - a.pos[2])) }
    await p.click('[data-testid="fly-done"]'); await p.waitForTimeout(300)
    await p.evaluate(() => window.__app.patch({ quality: 0 })); await mode(p, "look"); await p.waitForSelector('[data-testid="look-canvas"]', { timeout: 240000 }); await p.waitForTimeout(800); await shot(p, "w9-phone-look.png")
    await ctx.close()
  }

  if (on("lapse")) {
    const { ctx, p } = await page({ viewport: { width: 1280, height: 800 } })
    await p.goto(s.url); await done(p)
    await p.evaluate(() => window.__tape.clear())
    // fifteen meaningful changes, a little apart, plus a few that should merge away
    await p.evaluate(async () => {
      const A = window.__app, wait = (ms) => new Promise((ok) => setTimeout(ok, ms))
      const steps = [
        (w) => { w.sky.zenith = "#203a8a" }, (w) => { w.sky.horizon = "#f2a65a" }, (w) => { w.sky.sun.el = 0.12 },
        (w) => { w.sea.kind = "checker" }, (w) => { w.land.on = true }, (w) => { w.land.height = 6 },
        (w) => { w.things[0] && (w.things[0].pos[1] += 1.5) }, (w) => { w.things[0] && (w.things[0].mat.color = "#e2261a") },
        (w) => { w.sky.cloud = 0.6 }, (w) => { w.sky.hazeAmt = 0.7 }, (w) => { w.sea.c1 = "#0b2a4a" },
        (w) => { w.cam.yaw += 0.5 }, (w) => { w.sky.stars = 1 }, (w) => { w.land.snow = 0.6 }, (w) => { w.bloom = 0.6 },
      ]
      for (let i = 0; i < steps.length; i++) { A.edit("test-" + i, steps[i]); await wait(40) }
      A.edit("name", (w) => { w.name = "Renamed" }) // nothing to see: merged away
      for (let i = 0; i < 5; i++) A.edit("orbit", (w) => { w.cam.yaw += 0.02 }) // a drag: one step
    })
    res.tapeSteps = await p.evaluate(() => window.__tape.steps().length)
    await mode(p, "timelapse"); await p.waitForSelector('[data-testid="lapse-go"]'); await p.waitForTimeout(800)
    await p.click('role=radio[name="Quick"]'); await p.click('role=radio[name="Small"]')
    const len = p.locator('[aria-label="Length value"]'); await len.click(); await p.waitForTimeout(150); await len.fill("12"); await p.keyboard.press("Enter"); res.lapseLength = await len.inputValue()
    await shot(p, "w10-lapse-dialog.png")
    const t0 = Date.now(); await p.click('[data-testid="lapse-go"]')
    await p.waitForTimeout(4000); await shot(p, "w11-lapse-filming.png")
    await p.waitForSelector('[data-testid="lapse-save"]', { timeout: 600000 }); res.lapseSeconds = Math.round((Date.now() - t0) / 1000)
    await p.waitForTimeout(2500); await shot(p, "w12-lapse-done.png")
    res.lapsePreview = await p.evaluate(() => { const v = document.querySelector('[data-testid="lapse-video"]'); return v ? { time: Math.round(v.currentTime * 10) / 10, error: v.error?.code ?? 0 } : "still (this browser cannot decode video)" })
    const [dl] = await Promise.all([p.waitForEvent("download"), p.click('[data-testid="lapse-save"]')]); const ext = (dl.suggestedFilename().split(".").pop()); const fv = path.join(root, "shots", "out-timelapse." + ext); await dl.saveAs(fv)
    res.lapseFile = path.basename(fv); res.lapseBytes = fs.statSync(fv).size
    try {
      const pr = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height,nb_read_frames,r_frame_rate:format=duration", "-of", "json", fv]).toString())
      const st = pr.streams[0]; res.ffprobe = { codec: st.codec_name, size: `${st.width}x${st.height}`, frames: +st.nb_read_frames, rate: st.r_frame_rate, duration: r2(+pr.format.duration) }
      res.lapseLengthOk = Math.abs(res.ffprobe.duration - 12) < 0.6 && res.ffprobe.frames >= 12 * 24
      execFileSync("ffmpeg", ["-v", "error", "-y", "-i", fv, "-vf", "fps=1.5,scale=320:-1,tile=6x3", "-frames:v", "1", path.join(root, "shots", "w13-lapse-contact.png")])
    } catch (e) { res.ffprobe = "FAILED " + String(e.message).slice(0, 200) }
    await ctx.close()
    // the WebM way, as in browsers that cannot play MP4: the preview must play and the file must be whole
    const w2 = await page({ viewport: { width: 1280, height: 800 } }); const q = w2.p
    await q.addInitScript(() => { const can = HTMLMediaElement.prototype.canPlayType; HTMLMediaElement.prototype.canPlayType = function (t) { return /mp4/.test(t) ? "" : can.call(this, t) } })
    await q.goto(s.url); await done(q)
    await q.evaluate(async () => { const A = window.__app; for (let i = 0; i < 8; i++) { A.edit("w" + i, (w) => { w.sky.sun.el = 0.08 + i * 0.06; w.cam.yaw += 0.08 }); await new Promise((ok) => setTimeout(ok, 30)) } })
    await mode(q, "timelapse"); await q.waitForSelector('[data-testid="lapse-go"]'); await q.click('role=radio[name="Quick"]'); await q.click('role=radio[name="Small"]')
    await q.click('[data-testid="lapse-go"]'); await q.waitForSelector('[data-testid="lapse-save"]', { timeout: 600000 }); await q.waitForTimeout(2500)
    await shot(q, "w14-lapse-webm.png")
    const [dl2] = await Promise.all([q.waitForEvent("download"), q.click('[data-testid="lapse-save"]')]); const fw = path.join(root, "shots", "out-timelapse-2." + dl2.suggestedFilename().split(".").pop()); await dl2.saveAs(fw)
    try { const pr = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=codec_name,nb_read_frames:format=duration", "-of", "json", fw]).toString())
      res.ffprobeWebm = { file: path.basename(fw), codec: pr.streams[0].codec_name, frames: +pr.streams[0].nb_read_frames, duration: r2(+pr.format.duration) } } catch (e) { res.ffprobeWebm = "FAILED " + String(e.message).slice(0, 200) }
    await w2.ctx.close()
  }
} catch (e) { logs.push("TEST FAILED " + String(e.stack || e).slice(0, 600)) }
console.log(JSON.stringify(res, null, 1)); console.log(logs.slice(0, 12).join("\n") || "no errors"); await b.close(); s.close()
