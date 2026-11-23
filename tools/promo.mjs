// Makes the Chrometide promo video with the app itself: a 16:9 film and a 9:16 reel, with an
// original soundtrack synthesized here in code. Run after a build (npx tsc -b && npx vite build):
//
//   node tools/promo.mjs                 everything: music, the interface recordings, both cuts
//   node tools/promo.mjs --cut reel      one cut only (film | reel)
//   node tools/promo.mjs --skip-ui       reuse the interface recordings from the last run
//   node tools/promo.mjs --preview 1,6,20 --scale 0.5    a few moments only, as a contact sheet in scratch/promo/
//   node tools/promo.mjs --keep          leave the frames in scratch/promo-frames/
//
// How: tools/promo/music.mjs writes the music; the app's own scoreOf() listens to it; tools/promo/ui.mjs
// films the real interface frame by frame; tools/promo/stage.js (run inside the app's page) traces
// every other picture with the app's engine and sets the words; ffmpeg joins frames and sound.
// Frames go to scratch/promo-frames/ and are deleted at the end; the videos, posters, contact sheets
// and music go to docs/promo/. Nothing leaves this computer.
import fs from "fs"; import path from "path"; import { execFileSync, spawnSync } from "child_process"
import { serve, browser, root } from "./serve.mjs"
import { synth, wav, monoOf, BEAT } from "./promo/music.mjs"
import { studio } from "./promo/ui.mjs"

const arg = (name, d) => { const i = process.argv.indexOf("--" + name); return i < 0 ? d : process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : true }
const FPS = 30, OUT = path.join(root, "docs/promo"), FR = path.join(root, "scratch/promo-frames"), TMP = path.join(root, "scratch/promo")
const SCALE = +arg("scale", 1), PREVIEW = arg("preview"), ONLY = arg("cut"), SPP = +arg("spp", 20)
const ff = (...a) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...a], { stdio: ["ignore", "pipe", "pipe"] })
const bf = (beat) => Math.round(beat * BEAT * FPS) // the film frame a beat falls on
const URL_LINE = "github.com/denonmaryland/chrometide"

// ---------- the two cuts ----------
// Each part: what is shown (a shot from stage.js), for how many beats, and the words over it.
const W = (name, o = {}) => ({ shot: "world", args: { name, ...o } })
const CLASSICS = [
  { ...W("Red Moons", { move: { yaw0: -0.06, yaw: 0.14, dist0: 1.04, dist: 0.9 }, tallMove: { dist0: 1.45, up: -0.3 } }) },
  { ...W("Monolith", { move: { yaw0: -0.1, yaw: 0.2, dist0: 0.95, dist: 0.9 }, tallMove: { dist0: 1.0 } }) },
  { ...W("Crag Lagoon", { move: { yaw0: 0, yaw: 0.2, dist0: 1, dist: 0.9, pitch0: 0.03 }, tallMove: { dist0: 1.35 } }) },
  { ...W("Checker Dream", { move: { yaw0: 0.05, yaw: -0.2, dist0: 1.02, dist: 0.9 }, tallMove: { dist0: 1.3 } }) },
]
const NEON = W("Neon Harbour", { tweak: "Object.assign(w.sky, { zenith: '#04061e', horizon: '#3a1466', haze: '#5a1a7a', hazeAmt: 0.25, stars: 1.2, cloud: 0.15, ambient: 0.25, sunGlow: 0.3, sunSize: 0.02 }); w.sky.sun.az = 2.5; w.bloom = 0.42", move: { yaw0: -0.16, yaw: 0.26, dist0: 1.0, dist: 0.92, up: -0.2 }, tallMove: { dist0: 1.3, yaw0: -0.12, yaw: 0.22 } })
const LAND = W("Terraces", { tweak: "w.sky.sun = { az: 2.3, el: 0.4 }", move: { yaw0: -0.3, yaw: 0.5, pitch0: -0.04, dist0: 0.78, dist: 0.85 }, tallMove: { dist0: 1.3 }, linear: true })
const FLY = W("Mountain Ring", { tweak: "w.cam.target = [0, 3.2, 26]; w.cam.dist = 6; w.cam.yaw = 0.0; w.cam.pitch = 0.06; w.sky.sun = { az: 2.9, el: 0.2 }; w.cam.fov = 70", move: { yaw: 0.22, dist: 1, fly0: 5, fly: 11 }, linear: true })
const ISLAND = W("island", { move: { yaw0: -0.14, yaw: 0.26, pitch0: 0.1, dist0: 1.2, dist: 0.92, up: -2.4 }, tallMove: { dist0: 1.75, up: 0 } })
const VIZ1 = { shot: "viz", args: { name: "Equalizer Bay", tweak: "w.cam.dist = tall ? 23 : 17; w.cam.pitch = 0.17; if (tall) w.sky.moonEl = 0.14; w.sound.orbit = 0.9; w.sound.punch = 0.5; w.sound.pulse = 0.7" } }
const VIZ2 = { shot: "viz", args: { name: "Bass Moons", t0: 3, tweak: "w.sky.sun = { az: 2.6, el: 0.3 }; w.cam.dist = tall ? 24 : 15.5; w.sound.orbit = 0.9; w.sound.punch = 0.6; w.sound.pulse = 1; w.sound.glow = 1" } }
const PICKS = [20, 0, 24, 1, 66, 15, 21, 5, 41, 3, 67, 14, 46, 4, 23, 9] // flyers, covers, cards, a poster and a postcard from the design maker's shelf
const ui = (rec, from, crop, tallCrop, o = {}) => ({ shot: "ui", args: { rec, crop, tallCrop, ...o }, pre: from })

function cut(name) {
  const tall = name === "reel"
  const big = (text, o = {}) => ({ text, font: "serif", size: 86, tallSize: 92, pos: [0.055, 0.9], tallPos: [0.5, 0.2], tallAlign: "center", ...o })
  const under = (text, o = {}) => ({ text, font: "serif", size: 62, tallSize: 92, pos: [0.5, 0.955], align: "center", tallPos: [0.5, 0.235], tallAlign: "center", ...o }) // under the window of the interface
  const parts = tall ? [
    { id: "title", shot: "title", beats: 8, args: { riseAt: 0.16, riseLen: 0.5 }, caps: [{ text: "Surreal 3D worlds,\nmade in your browser.", font: "serif", size: 80, pos: [0.5, 0.17], tallAlign: "center", from: 0.15, to: 7.4, tallLh: 1.2 }] },
    ...CLASSICS.map((c, i) => ({ id: "classic" + i, ...c, beats: 2, caps: i ? [] : [{ ...big("A love letter to the\n3D worlds of the 90s."), tallSize: 78, from: 0, to: 8 }] })),
    { id: "ui-dice", ...ui("main", 0, null, [[0, 0.49, 0.5, 1], [1, 0.49, 0.52, 1.06]]), beats: 4, xin: 6, caps: [{ ...under("Roll a world."), from: 0, to: 4 }] },
    { id: "ui-sky", ...ui("main", bf(4), null, [[0, 0.49, 0.52, 1.06], [0.2, 0.715, 0.5, 1.0], [1, 0.715, 0.5, 1.04]]), beats: 4, caps: [{ ...under("45 skies. Drag the sun."), from: 0, to: 4 }] },
    { id: "ui-word", ...ui("main", bf(12), null, [[0, 0.715, 0.5, 1.04], [0.25, 0.72, 0.45, 1.1], [0.62, 0.72, 0.45, 1.1], [0.84, 0.49, 0.55, 1.05], [1, 0.49, 0.57, 1.1]]), beats: 4, caps: [{ ...under("Chrome lettering."), from: 0, to: 4 }] },
    { id: "neon", ...NEON, beats: 2, xin: 5, caps: [{ ...big("Neon signs."), from: 0, to: 2 }] },
    { id: "land", ...LAND, beats: 2, caps: [{ ...big("Sculpted land."), from: 0, to: 2 }] },
    { id: "designs", shot: "designs", args: { picks: PICKS }, beats: 4, caps: [{ ...big("Album covers, flyers,\nposters, tickets."), tallPos: [0.5, 0.115], tallSize: 76, from: 0, to: 4 }] },
    { id: "viz1", ...VIZ1, beats: 4, caps: [{ ...big("It moves to your music."), tallSize: 84, from: 0, to: 8 }] },
    { id: "viz2", ...VIZ2, beats: 4 },
    { id: "fly", ...FLY, beats: 2, caps: [{ ...big("Fly inside.\nYour GitHub year, an island.\nEmbed anywhere.\nAI agents, over MCP."), tallSize: 66, tallPos: [0.5, 0.15], lh: 1.3, stagger: bf(1), from: 0, to: 4 }] },
    { id: "island", ...ISLAND, beats: 2 },
    { id: "retro", ...ui("retro", 0, null, [[0, 0.5, 0.5, 1], [0.2, 0.5, 0.5, 1], [0.42, 0.5, 0.49, 1.5], [1, 0.5, 0.49, 1.6]], { tallAspect: 1.2 }), beats: 8, xin: 5, caps: [{ ...big("1994 mode."), tallPos: [0.5, 0.255], from: 1.6, to: 8 }, { text: "640 × 480. 256 colours. Line by line.", font: "mono", size: 30, tallSize: 34, tallPos: [0.5, 0.29], tallAlign: "center", pos: [0.5, 0.3], from: 2.6, to: 8, color: "#ffd566" }] },
    { id: "end", shot: "end", beats: 8, xin: 12, tail: true, caps: END(true) },
  ] : [
    { id: "title", shot: "title", beats: 12, args: { riseAt: 0.3, riseLen: 0.46 }, caps: [{ ...big("Surreal 3D worlds,\nmade in your browser."), pos: [0.055, 0.83], from: 0.15, to: 4.2 }] },
    ...CLASSICS.map((c, i) => ({ id: "classic" + i, ...c, beats: 2, caps: i ? [] : [{ ...big("A love letter to the 3D worlds of the 90s."), size: 74, from: 0, to: 8 }] })),
    { id: "ui-dice", ...ui("main", 0, [[0, 0.5, 0.5, 1], [1, 0.49, 0.56, 1.14]]), beats: 4, xin: 6, caps: [{ ...under("Roll a world."), from: 0, to: 4 }] },
    { id: "ui-sky", ...ui("main", bf(4), [[0, 0.49, 0.56, 1.14], [0.25, 0.7, 0.42, 1.3], [1, 0.72, 0.44, 1.36]]), beats: 4, caps: [{ ...under("45 skies. Drag the sun."), from: 0, to: 4 }] },
    { id: "ui-shape", ...ui("main", bf(8), [[0, 0.72, 0.44, 1.36], [0.2, 0.5, 0.6, 1.2], [0.5, 0.62, 0.55, 1.2], [1, 0.66, 0.56, 1.26]]), beats: 4, caps: [{ ...under("Shapes and materials."), from: 0, to: 4 }] },
    { id: "ui-word", ...ui("main", bf(12), [[0, 0.66, 0.56, 1.26], [0.25, 0.6, 0.45, 1.16], [0.7, 0.6, 0.45, 1.16], [1, 0.5, 0.6, 1.3]]), beats: 4, caps: [{ ...under("Chrome lettering."), from: 0, to: 4 }] },
    { id: "neon", ...NEON, beats: 4, xin: 5, caps: [{ ...big("Neon signs."), from: 0, to: 4 }] },
    { id: "land", ...LAND, beats: 4, caps: [{ ...big("Sculpted land."), from: 0, to: 4 }] },
    { id: "ui-design", ...ui("design", 0, [[0, 0.5, 0.45, 1.1], [0.3, 0.5, 0.4, 1.4], [1, 0.5, 0.48, 1.45]]), beats: 4, xin: 5, caps: [{ ...under("Album covers, flyers, posters, tickets."), from: 0, to: 4 }] },
    { id: "designs", shot: "designs", args: { picks: PICKS }, beats: 4, caps: [{ ...under("70 ready-made designs."), pos: [0.5, 0.94], from: 0, to: 4 }] },
    { id: "viz1", ...VIZ1, beats: 4, caps: [{ ...big("It moves to your music."), from: 0, to: 8 }] },
    { id: "viz2", ...VIZ2, beats: 4 },
    { id: "fly", ...FLY, beats: 2, caps: [{ ...big("Fly inside."), from: 0, to: 2 }] },
    { id: "island", ...ISLAND, beats: 2, caps: [{ ...big("Your GitHub year, as an island."), from: 0, to: 2 }] },
    { id: "ui-embed", ...ui("embed", 0, [[0, 0.5, 0.5, 1.75], [1, 0.5, 0.5, 1.95]]), beats: 2, caps: [{ ...under("Embed anywhere."), from: 0, to: 2 }] },
    { id: "agent", shot: "agent", beats: 2, caps: [{ ...big("AI agents, over MCP."), from: 0, to: 2 }, { text: 'add_thing { kind: "sphere", material: "Chrome" }\nadd_thing { kind: "torus", material: "Gold" }\nset_camera { yaw: 0.25, distance: 17 }', font: "mono", size: 27, pos: [0.057, 0.1], lh: 1.6, stagger: 9, from: 0.1, to: 2, color: "#d8ffe9" }] },
    { id: "retro", ...ui("retro", 0, [[0, 0.5, 0.5, 1], [0.2, 0.5, 0.5, 1], [0.42, 0.5, 0.478, 1.42], [1, 0.5, 0.478, 1.52]]), beats: 8, xin: 5, caps: [{ ...under("1994 mode. 640 × 480, 256 colours, line by line."), from: 1.6, to: 8 }] },
    { id: "end", shot: "end", beats: 8, xin: 12, tail: true, caps: END(false) },
  ]
  // beats -> frames
  let beat = 0; const segs = [], caps = []
  for (const p of parts) { const f0 = bf(beat), f1 = bf(beat + p.beats); segs.push({ ...p, beat, f0, f1 })
    for (const c of p.caps || []) caps.push({ ...c, from: bf(beat + c.from) + (c.from === 0 ? 2 : 0), to: bf(beat + c.to) - (c.hold ? 0 : 1) + (c.late ?? 0) })
    beat += p.beats }
  void tall; const bars = beat / 4, at = (id) => segs.find((s) => s.id === id).beat / 4
  const music = { bars, build: at("classic0"), main: at("ui-dice"), viz: [at("viz1"), at("viz1") + 2], retro: at("retro"), end: at("end") }
  return { name, tall, W: tall ? 1080 : 1920, H: tall ? 1920 : 1080, segs, caps, music, beats: beat }
}
function END(tall) { return [
  { text: "Surreal 3D worlds in your browser.", tallText: "Surreal 3D worlds\nin your browser.", font: "serif", size: 66, tallSize: 84, pos: [0.5, 0.735], align: "center", tallPos: [0.5, 0.7], tallAlign: "center", from: 1.2, to: 99, hold: true, fade: 14 },
  { text: "Free and open source.", font: "sans", size: 34, tallSize: 44, track: 0.02, pos: [0.5, 0.8], align: "center", tallPos: [0.5, 0.79], tallAlign: "center", from: 2.2, to: 99, hold: true, fade: 14, color: "#ffe9d6" },
  { text: URL_LINE, font: "mono", size: 30, tallSize: 36, pos: [0.5, 0.9], align: "center", tallPos: [0.5, 0.845], tallAlign: "center", from: 3.2, to: 99, hold: true, fade: 14 },
] }

// ---------- the interface recordings ----------
// Frames are counted from the start of each recording; b(k) is the frame of its k-th beat.
const SCENES = {
  /** dice, skies and the sun, a shape and its material, chrome lettering: sixteen beats in one take */
  async main(S, b) {
    const p = S.page
    await p.click('[data-testid="starter-4"]'); await p.clock.runFor(900); S.x = 1240; S.y = 560
    await p.evaluate(() => { window.__engine.setSelected(null); window.__engine.setSelected = () => {} }) // the wire outline round whatever is selected is left out, so the picture stays clean
    // roll a world, three times, on the beat
    await S.hold(3); await S.tap('[data-testid="dice"]', b(1)); await S.click(b(2)); await S.click(b(3))
    // sky looks, then the sun pulled down to the horizon
    await S.tap('[data-testid="inspector"] button[aria-label="Lilac"]', b(4), { rest: 1 }); await S.tap('[data-testid="inspector"] button[aria-label="Dusk"]', b(5)); await S.tap('[data-testid="inspector"] button[aria-label="Golden hour"]', b(6))
    const arc = await p.locator('[aria-label^="Sun position"]').boundingBox(), sun = await p.evaluate(() => window.__app.get().world.sky.sun), yaw = await p.evaluate(() => window.__app.get().world.cam.yaw)
    const sx = (az) => arc.x + ((((az / (Math.PI * 2) + 0.5) % 1) + 1) % 1) * arc.width, sy = (el) => arc.y + arc.height * (1 - (el - 0.02) / 1.33), back = Math.atan2(Math.sin(yaw + Math.PI - 0.32), Math.cos(yaw + Math.PI - 0.32))
    await S.glide([sx(sun.az), sy(Math.min(1.3, sun.el))], b(6.6)); await S.drag([[sx(back), sy(0.5)], [sx(back), sy(0.13)]], b(8) - 2)
    // a shape, and three materials
    await S.tap('[data-testid="dock-add"]', b(8.6)); await S.tap(p.getByRole("menuitem", { name: "Ring", exact: true }), b(9.4))
    // the new ring is put round the moon (as one would drag it), so its material is seen
    await p.evaluate(() => { const st = window.__app.get(), id = st.sel.id; window.__app.edit("promo-place", (w) => { const t = w.things.find((x) => x.id === id), m = w.things[0]; if (t && m) { const r = m.size[0]; t.pos = [...m.pos]; t.size = [r * 1.75, r * 0.5, r * 1.75]; t.round = 0.1; t.rot = [0, 74, 10] } }) })
    await S.tap('[data-testid="inspector"] button[aria-label="Gold"]', b(10.25)); await S.tap('[data-testid="inspector"] button[aria-label="Glass"]', b(11)); await S.tap('[data-testid="inspector"] button[aria-label="Chrome"]', b(11.7))
    // lettering
    await S.tap('[data-testid="part-title"]', b(12.5)); await S.tap('[data-testid="title-input"]', b(13.2)); await S.type("LOW TIDE", 2); await S.tap('[data-testid="add-word"]', b(15))
    await S.until(b(16) + 14)
  },
  /** the design maker: this world as a CD, then the shelf of ready-made designs */
  async design(S, b) {
    const p = S.page
    await p.click('[data-testid="starter-4"]'); await p.clock.runFor(900); S.x = 1050; S.y = 420
    await S.hold(2); await S.tap('[data-testid="open-cover"]', b(0.55)); await S.frame(4000)
    await S.tap('[data-testid="design-shelf"]', b(1.7)); await S.frame(9000)
    await S.tap('[data-testid="shelf-flyer"]', b(2.6)); await S.frame(9000)
    await S.tap('[data-testid="design-flyer-0"]', b(3.3)); await S.frame(5000); await S.until(b(4) + 14)
  },
  /** Modes > 1994 mode: red moons over a blue sea, arriving line by line on the tube */
  async retro(S, b) {
    const p = S.page; S.x = 760; S.y = 420
    await S.hold(2); await S.tap('[data-testid="modes-menu"]', b(0.6)); await S.tap('[data-testid="mode-1994"]', b(1.5), { rest: 3 })
    await S.frame(400); await p.waitForFunction(() => window.__retro, null, { timeout: 20000 })
    // the boot text takes 2.6 s of the page's time: step through it in one frame, then let the picture crawl
    for (let i = 0; i < 40 && (await p.evaluate(() => window.__retro.phase())) === "warm"; i++) { await p.clock.runFor(300); await new Promise((ok) => setTimeout(ok, 30)) }
    S.x = 1700; S.y = 900
    const left = b(7.2) - S.n; await S.hold(left, Math.round(30000 / left)); await S.until(b(8) + 16, 60)
  },
  /** the embed dialog, already open */
  async embed(S, b) {
    const p = S.page
    await p.click('[data-testid="starter-6"]'); await p.clock.runFor(900); await p.click('[data-testid="share"]'); await p.clock.runFor(400); await p.click('[data-testid="embed"]')
    for (let i = 0; i < 20; i++) { await p.clock.runFor(300); if (await p.locator('[data-testid="embed-dialog"]').count()) break; await new Promise((ok) => setTimeout(ok, 100)) }
    await p.clock.runFor(4000); S.x = 1250; S.y = 700; await S.hold(2); await S.glide('[data-testid="embed-dialog"] [data-testid^="copy-"]', b(1.2)); await S.click(b(1.3)); await S.until(b(2) + 14)
  },
}
const beatsOf = { main: 16, design: 4, retro: 8, embed: 2 }, SEEDS = { main: +arg("seed", 14), design: 3, retro: 5, embed: 2 }

async function recordUI(b, url, which) {
  for (const name of which) { const dir = path.join(FR, "ui", name), t0 = Date.now()
    const S = await studio(b, url, { seed: SEEDS[name], dir }); try { await SCENES[name](S, bf) } finally { await S.close() }
    fs.writeFileSync(path.join(dir, "n.txt"), String(fs.readdirSync(dir).filter((f) => f.endsWith(".jpg")).length)); console.log("ui", name, fs.readFileSync(path.join(dir, "n.txt"), "utf8"), "frames", Math.round((Date.now() - t0) / 1000) + " s") }
  // the GitHub-year island, made by the app's own mode from the sample calendar in tools/fixtures (nothing is fetched)
  const fixture = fs.readFileSync(path.join(root, "tools/fixtures/github-sample.json"), "utf8")
  const S = await studio(b, url, { seed: 1, routes: (p) => p.route(/github-contributions-api/, (r) => r.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: fixture.replace(/sample-coder/g, "chrometide") })) })
  try { const p = S.page; await p.click('[data-testid="modes-menu"]'); await p.clock.runFor(400); await p.click('[data-testid="mode-github-island"]')
    for (let i = 0; i < 30 && !(await p.locator('[data-testid="island-user"]').count()); i++) { await p.clock.runFor(200); await new Promise((ok) => setTimeout(ok, 100)) }
    await p.fill('[data-testid="island-user"]', "chrometide"); await p.click('[data-testid="island-go"]')
    for (let i = 0; i < 50 && !(await p.locator('[data-testid="island-result"]').count()); i++) { await p.clock.runFor(200); await new Promise((ok) => setTimeout(ok, 100)) }
    fs.writeFileSync(path.join(FR, "ui", "island.json"), JSON.stringify(await p.evaluate(() => window.__app.get().world))) } finally { await S.close() }
}

// ---------- music ----------
function music(c) {
  fs.mkdirSync(TMP, { recursive: true }); fs.mkdirSync(OUT, { recursive: true })
  const raw = path.join(TMP, `music-${c.name}-raw.wav`), out = path.join(TMP, `music-${c.name}.wav`), s = synth(c.music); fs.writeFileSync(raw, wav(s))
  // bring it to -14 LUFS with one plain change of level (measured first), peaks under -1.5 dB
  const m = JSON.parse(/\{[\s\S]*\}/.exec(spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", raw, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" }).stderr)[0])
  // the kick's tips are held under -1.5 dB by a gentle limiter (it works on about 2 dB of them); 4x oversampled so no peak slips between samples
  ff("-i", raw, "-af", `volume=${(-14 - +m.input_i + 0.35).toFixed(2)}dB,aresample=192000,alimiter=limit=0.82:attack=2:release=50:level=disabled,aresample=48000`, "-c:a", "pcm_s16le", out)
  return { file: out, seconds: s.seconds, frames: Math.round(s.seconds * FPS) }
}
const measure = (file) => { const t = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", file, "-map", "0:a", "-af", "ebur128=peak=true", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 28 }).stderr.slice(-900)
  return { lufs: +(/I:\s+(-?[\d.]+) LUFS/.exec(t) || [])[1], peak: +(/Peak:\s+(-?[\d.]+) dBFS/.exec(t) || [])[1] } }

// ---------- a cut, frame by frame ----------
async function render(b, url, c, snd) {
  const Wd = Math.round(c.W * SCALE / 2) * 2, Hd = Math.round(c.H * SCALE / 2) * 2, total = snd.frames, dir = path.join(FR, c.name)
  const page = await b.newPage({ viewport: { width: 1280, height: 720 } }); page.setDefaultTimeout(0)
  page.on("pageerror", (e) => console.log("PAGE", e.message.slice(0, 300))); page.on("console", (m) => m.type() === "error" && console.log("PAGE", m.text().slice(0, 300)))
  await page.addInitScript(() => { try { localStorage.setItem("uw-welcome-seen", "1") } catch {} })
  await page.route("**/__promo/**", (r) => { const f = path.join(FR, decodeURIComponent(new URL(r.request().url()).pathname.replace(/^\/__promo\//, ""))); return fs.existsSync(f) ? r.fulfill({ status: 200, contentType: f.endsWith(".jpg") ? "image/jpeg" : "application/json", body: fs.readFileSync(f) }) : r.fulfill({ status: 404, body: "" }) })
  await page.goto(url); await page.waitForFunction(() => window.__engine && window.__engine.done, null, { timeout: 60000 })
  await page.evaluate(async () => { window.__engine.pause(true); await document.fonts.ready; await Promise.all(['italic 500 80px "Playfair Display Variable"', '600 40px "Geist Variable"', '400 40px "Geist Variable"', '500 30px "Geist Mono Variable"', '400 40px "Anton"', '900 100px "Geist Variable"'].map((f) => document.fonts.load(f, "Ag"))) })
  await page.addScriptTag({ path: path.join(root, "tools/promo/stage.js") })
  const island = path.join(FR, "ui", "island.json"); if (fs.existsSync(island)) await page.evaluate((w) => { window.__promo.worlds.island = w }, JSON.parse(fs.readFileSync(island, "utf8")))
  const mono = monoOf(fs.readFileSync(snd.file)), heard = await page.evaluate((b64) => window.__promo.setScore(b64), Buffer.from(mono.buffer).toString("base64"))
  const grid = heard.beats.map((t) => Math.abs(t / BEAT - Math.round(t / BEAT)) * BEAT), onGrid = grid.filter((d) => d < 0.045).length
  console.log(c.name, `the app hears ${heard.bpm} bpm, ${heard.beats.length} beats, ${onGrid} of them within 45 ms of the cutting grid`)
  for (const s of c.segs) if (s.shot === "ui") { const f = path.join(FR, "ui", s.args.rec, "n.txt"); s.args.n = fs.existsSync(f) ? +fs.readFileSync(f, "utf8") : 0 }
  const list = PREVIEW ? String(PREVIEW).split(",").map((t) => Math.min(total - 1, Math.round(+t * FPS))) : Array.from({ length: total }, (_, i) => i)
  if (!PREVIEW) { fs.rmSync(dir, { recursive: true, force: true }) } fs.mkdirSync(dir, { recursive: true }); const t0 = Date.now()
  for (const [i, f] of list.entries()) {
    const k = c.segs.findIndex((s, j) => f >= s.f0 && (f < s.f1 || j === c.segs.length - 1)), cur = c.segs[k], prev = k > 0 && cur.xin && f < cur.f0 + cur.xin ? c.segs[k - 1] : null, on = prev ? [prev, cur] : [cur]
    for (const s of on) if (s.shot === "ui" && s.args.n) { const idx = Math.min(s.args.n - 1, f - s.f0 + (s.pre ?? 0)); await page.evaluate(([key, u]) => window.__promo.loadImage(key, u), [`${s.args.rec}:${idx}`, `/__promo/ui/${s.args.rec}/${String(idx).padStart(4, "0")}.jpg`]) }
    const url = await page.evaluate((job) => window.__promo.frame(job), { W: Wd, H: Hd, tall: c.tall, f, fps: FPS, segs: on, caps: c.caps, spp: SPP, total, type: PREVIEW ? "image/jpeg" : "image/png" })
    fs.writeFileSync(path.join(dir, PREVIEW ? `p${String(i).padStart(3, "0")}.jpg` : `f${String(f).padStart(5, "0")}.png`), Buffer.from(url.split(",")[1], "base64"))
    if (!PREVIEW && i % 100 === 99) console.log(c.name, i + 1, "/", total, Math.round((Date.now() - t0) / 1000) + " s")
  }
  await page.close()
  return { dir, total, list }
}

function sheet(inputs, out, cols, w) { const args = []; for (const f of inputs) args.push("-i", f)
  const n = inputs.length, rows = Math.ceil(n / cols)
  ff(...args, "-filter_complex", inputs.map((_, i) => `[${i}:v]scale=${w}:-2[s${i}]`).join(";") + ";" + inputs.map((_, i) => `[s${i}]`).join("") + `xstack=inputs=${n}:layout=${inputs.map((_, i) => `${i % cols ? Array.from({ length: i % cols }, (_, k) => "w" + k).join("+") : 0}_${Math.floor(i / cols) ? Array.from({ length: Math.floor(i / cols) }, (_, k) => "h" + k * cols).join("+") : 0}`).join("|")}:fill=0x0d0d11`, "-frames:v", "1", "-q:v", "3", out); void rows }

function encode(c, snd, r) {
  const mp4 = path.join(OUT, `chrometide-${c.name}.mp4`), src = path.join(r.dir, "f%05d.png")
  const v = ["-c:v", "libx264", "-preset", "slow", "-pix_fmt", "yuv420p", "-profile:v", "high", "-level", "4.2", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-vf", "scale=out_color_matrix=bt709:out_range=tv"]
  const a = ["-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-movflags", "+faststart", "-frames:v", String(r.total), "-shortest"], pics = ["-framerate", String(FPS), "-i", src]
  ff(...pics, "-i", snd.file, ...v, "-crf", "16", ...a, mp4)
  if (fs.statSync(mp4).size > 38e6) { // too heavy to post: two passes at the bitrate that lands just under 38 MB
    const kbps = Math.floor((37.2e6 * 8) / snd.seconds / 1000 - 262), log = path.join(TMP, "x264-" + c.name)
    ff(...pics, ...v, "-b:v", kbps + "k", "-pass", "1", "-passlogfile", log, "-an", "-f", "null", "-"); ff(...pics, "-i", snd.file, ...v, "-b:v", kbps + "k", "-pass", "2", "-passlogfile", log, ...a, mp4) }
  const poster = c.segs.find((s) => s.id === "end").f0 + bf(5.5), pj = path.join(OUT, `chrometide-${c.name}-poster.jpg`)
  ff("-i", path.join(r.dir, `f${String(poster).padStart(5, "0")}.png`), "-q:v", "2", pj)
  const picks = Array.from({ length: 16 }, (_, i) => Math.round(((i + 0.5) / 16) * (r.total - 1)))
  sheet(picks.map((f) => path.join(r.dir, `f${String(f).padStart(5, "0")}.png`)), path.join(OUT, `chrometide-${c.name}-contact.jpg`), c.tall ? 8 : 4, c.tall ? 300 : 640)
  ff("-i", snd.file, "-c:a", "flac", path.join(OUT, `chrometide-${c.name}-music.flac`))
  return mp4
}

// ---------- go ----------
const cuts = ["film", "reel"].filter((n) => !ONLY || ONLY === n).map(cut)
const s = await serve(), b = await browser()
try {
  fs.mkdirSync(FR, { recursive: true })
  const need = [...new Set(cuts.flatMap((c) => c.segs.filter((x) => x.shot === "ui").map((x) => x.args.rec)))]
  const want = arg("ui") && arg("ui") !== true ? String(arg("ui")).split(",") : need
  if (!arg("skip-ui")) await recordUI(b, s.url, want)
  if (!arg("ui-only")) for (const c of cuts) {
    const snd = music(c); console.log(c.name, c.beats, "beats", snd.seconds.toFixed(2), "s", snd.frames, "frames", JSON.stringify(c.music))
    const r = await render(b, s.url, c, snd)
    if (PREVIEW) { const out = path.join(TMP, `preview-${c.name}.jpg`); sheet(r.list.map((_, i) => path.join(r.dir, `p${String(i).padStart(3, "0")}.jpg`)), out, c.tall ? Math.min(6, r.list.length) : Math.min(3, r.list.length), c.tall ? 360 : 640); console.log("preview", out); continue }
    const mp4 = encode(c, snd, r), m = measure(mp4); console.log(c.name, mp4, (fs.statSync(mp4).size / 1e6).toFixed(1) + " MB", m.lufs + " LUFS", m.peak + " dBTP")
    if (!arg("keep")) fs.rmSync(r.dir, { recursive: true, force: true })
  }
  if (!arg("keep") && !PREVIEW && !arg("ui-only") && !ONLY) fs.rmSync(FR, { recursive: true, force: true })
} finally { await b.close(); s.close() }
