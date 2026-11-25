// Checks the music features with a made-up song: a 120 bpm kick, off-beat hats and a slow pad.
import { checkResults } from "./check-results.mjs"
import path from "path"; import fs from "fs"; import { execFileSync } from "child_process"; import { serve, browser, root } from "./serve.mjs"
const s = await serve(), b = await browser(["--autoplay-policy=no-user-gesture-required", "--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"])
const logs = [], res = {}; const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, permissions: ["microphone"] }); const p = await ctx.newPage()
p.on("console", (m) => (m.type() === "error" || m.text().includes("SHADER")) && logs.push(m.text().slice(0, 400))); p.on("pageerror", (e) => logs.push("PAGEERROR " + e.message.slice(0, 300)))
const pix = () => p.evaluate(() => { const c = document.querySelector("canvas"), t = document.createElement("canvas"); t.width = 64; t.height = 48; const x = t.getContext("2d"); x.drawImage(c, 0, 0, 64, 48); return Array.from(x.getImageData(0, 0, 64, 48).data).join(",") })
const shot = (n) => p.screenshot({ path: path.join(root, "shots", n) })
await p.goto(s.url); await p.waitForFunction(() => window.__engine && window.__engine.done, null, { timeout: 60000 }); await p.waitForTimeout(800)
const N = await p.locator('[data-testid^="starter-"]').count(); res.worlds = N
await p.getByRole("button", { name: "Equalizer Bay", exact: true }).click(); await p.waitForTimeout(500); await p.click('[data-testid="part-sound"]')
// a 12 second song, made here
res.song = await p.evaluate(async () => { const sr = 44100, secs = 12, n = sr * secs, d = new Float32Array(n)
  for (let i = 0; i < n; i++) { const t = i / sr, bt = t % 0.5, kick = Math.sin(2 * Math.PI * (45 * bt + 55 * (1 - Math.exp(-bt * 30)) / 30)) * Math.exp(-bt * 9) * 0.9
    const ht = (t + 0.25) % 0.5, hat = (Math.random() * 2 - 1) * Math.exp(-ht * 60) * 0.25, pad = (Math.sin(2 * Math.PI * 220 * t) + Math.sin(2 * Math.PI * 277 * t) + Math.sin(2 * Math.PI * 330 * t)) * 0.06 * (0.5 + 0.5 * Math.sin(t * 0.8))
    d[i] = (t > 6 && t < 7 ? 0 : kick) + hat + pad }
  const buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf), w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true)
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true)
  await window.__chooseSong(new Blob([buf], { type: "audio/wav" }), "test beat.wav"); const sg = window.__audio.currentSong().score
  const L1 = window.__audio.levelsAt(sg, 2.02), L2 = window.__audio.levelsAt(sg, 6.5)
  return { bpm: sg.bpm, beats: sg.beatTimes.length, duration: +sg.duration.toFixed(2), firstBeats: sg.beatTimes.slice(0, 4).map((x) => +x.toFixed(2)), bassOnKick: +L1.bass.toFixed(2), bassInGap: +L2.bass.toFixed(2), beatsAt6: window.__audio.levelsAt(sg, 6).beats } })
await p.waitForTimeout(400); await shot("s1-sound-panel.png")
// the reaction itself: loud and quiet moments give different worlds
res.react = await p.evaluate(() => { const sg = window.__audio.currentSong().score, w = window.__app.get().world, a = window.__sound.react(w, window.__audio.levelsAt(sg, 2.02)).world, q = window.__sound.react(w, window.__audio.levelsAt(sg, 6.6)).world
  const bar = (x) => Math.max(...x.things.filter((t) => t.eq !== undefined).map((t) => t.size[1])); return { barLoud: +bar(a).toFixed(2), barQuiet: +bar(q).toFixed(2), baseUntouched: w.things[0].size[1] === 1.5, camMoves: a.cam.yaw !== q.cam.yaw } })
// live
const still = await pix(); await p.click('[data-testid="song-play"]'); await p.waitForTimeout(1500)
res.sounding = await p.evaluate(() => window.__app.get().sounding); res.live = await p.evaluate(() => window.__engine.live); const t1 = await p.evaluate(() => window.__audio.audioEl().currentTime)
const a1 = await pix(); await p.waitForTimeout(600); const a2 = await pix(); const t2 = await p.evaluate(() => window.__audio.audioEl().currentTime)
res.audioAdvances = t2 > t1; res.pictureMoves = a1 !== a2 && a1 !== still; await shot("s2-live.png")
res.fps = await p.evaluate(() => new Promise((ok) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 > 1500) ok(Math.round(n / 1.5)); else requestAnimationFrame(f) }; requestAnimationFrame(f) }))
await p.click('[data-testid="vibe-Club"]'); await p.waitForTimeout(300); res.vibe = await p.evaluate(() => window.__app.get().world.sound.kick > 0)
await p.click('[data-testid="song-play"]'); await p.waitForTimeout(500); res.pauses = !(await p.evaluate(() => window.__app.get().sounding)); res.liveOff = !(await p.evaluate(() => window.__engine.live))
await p.waitForFunction(() => window.__engine.done, null, { timeout: 60000 }); res.sharpAgain = true
// meters on another world
await p.click('[data-testid="starter-0"]'); await p.click('[data-testid="part-sound"]'); const n0 = await p.evaluate(() => window.__app.get().world.things.length); await p.click('[data-testid="meters-row"]'); await p.waitForTimeout(400)
res.metersAdded = (await p.evaluate(() => window.__app.get().world.things.filter((t) => t.eq !== undefined).length)); res.metersFit = (await p.evaluate(() => window.__app.get().world.things.length)) <= 20 && n0 < 20
// microphone (a fake one in this browser)
await p.click('[data-testid="mic"]'); await p.waitForTimeout(1200); res.mic = await p.evaluate(() => window.__app.get().mic && window.__app.get().sounding); res.micHears = await p.evaluate(() => window.__audio.nowLevels().level > 0); await p.click('[data-testid="mic"]'); await p.waitForTimeout(300)
// film three seconds with the sound
await p.getByRole("button", { name: "Equalizer Bay", exact: true }).click(); await p.waitForTimeout(400); await p.click('[data-testid="part-sound"]')
await p.evaluate(() => { const set = (label, v) => { const el = document.querySelector(`input[aria-label="${label} value"]`); el.focus(); const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; d.call(el, String(v)); el.dispatchEvent(new Event("input", { bubbles: true })); el.blur() }; set("Length", 3) })
await p.click('role=radio[name="Small"]'); await p.click('[data-testid="film-go"]'); const t0 = Date.now()
await p.waitForSelector('[data-testid="film-video"]', { timeout: 300000 }).catch(() => logs.push("film never finished: " + "")); res.filmSeconds = +((Date.now() - t0) / 1000).toFixed(1)
res.note = await p.locator('[data-testid="sound-note"]').textContent().catch(() => "")
res.filmBytes = await p.evaluate(() => window.__filmBytes || 0)
if (res.filmBytes) { const [dl] = await Promise.all([p.waitForEvent("download"), p.click('[data-testid="film-save"]')]); const out = path.join(root, "shots", "out-film" + path.extname(dl.suggestedFilename())); await dl.saveAs(out); res.file = path.basename(out)
  try { const j = JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,codec_name,width,height,nb_read_frames,duration:format=duration", "-count_frames", "-of", "json", out]).toString()); res.streams = j.streams.map((x) => `${x.codec_type}:${x.codec_name}${x.width ? ` ${x.width}x${x.height} ${x.nb_read_frames}f` : ""}`); res.fileSeconds = +(+j.format.duration).toFixed(2) } catch (e) { res.probe = "FAILED " + String(e.message).slice(0, 200) }
  execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", out, "-vf", "select='eq(n,16)+eq(n,23)+eq(n,52)',tile=3x1", "-frames:v", "1", "-q:v", "3", path.join(root, "shots", "s3-film-frames.jpg")]) }
await shot("s4-filmed.png")
await b.close(); s.close()
checkResults(res, logs)
