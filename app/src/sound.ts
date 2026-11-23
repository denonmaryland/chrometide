// Moving to music: how the levels of a song become motion in the world, and how a whole song is
// filmed with its sound into one video file.
import { type Levels, type Song, BANDS, SR, levelsAt } from "./audio"
import { type Band, type SoundSet, type Thing, type Vec3, type World, SKIES, clone, mat, soundSet, thing } from "./engine/scene"
import { edit, engine, get, patch } from "./store"

export const VIBES: { name: string; about: string; set: SoundSet }[] = [
  { name: "Float", about: "Gentle. Things ride the bass, water ripples, clouds breathe.", set: soundSet({ pulse: 0.25, float: 0.7, ripple: 0.6, glow: 0.3, twinkle: 0.4, breathe: 0.5, orbit: 0.25, kick: 0, punch: 0.05, journey: "off" }) },
  { name: "Pulse", about: "Everything swells on the bass and glows with the melody.", set: soundSet({ pulse: 0.8, float: 0.3, ripple: 0.7, glow: 0.9, twinkle: 0.6, breathe: 0.3, orbit: 0.3, kick: 0, punch: 0.35, journey: "sunset", every: 32 }) },
  { name: "Club", about: "The camera steps on every beat and the sky changes colour.", set: soundSet({ pulse: 0.7, pulseTo: "beat", float: 0.2, ripple: 0.9, glow: 1, twinkle: 1, breathe: 0.4, orbit: 0.2, kick: 0.6, punch: 0.6, journey: "night", every: 8 }) },
  { name: "Meters", about: "Bars and letters jump like level meters. The rest holds still.", set: soundSet({ pulse: 0, float: 0, ripple: 0.4, glow: 0.5, twinkle: 0.4, breathe: 0.2, meters: 1, orbit: 0.35, kick: 0, punch: 0.1, journey: "off" }) },
  { name: "Dream", about: "Slow and wide: a long orbit, soft glow, colours drifting like candy.", set: soundSet({ pulse: 0.2, pulseTo: "mid", float: 0.5, ripple: 0.3, glow: 0.6, twinkle: 0.8, breathe: 0.8, orbit: 0.5, kick: 0, punch: 0, journey: "candy", every: 16 }) },
]
const JOURNEYS: Record<string, string[]> = {
  sunset: ["Golden hour", "Dusk", "Ember dusk", "Blue hour", "Moonlit", "Blue hour", "Morning"],
  candy: ["Bubblegum", "Cotton candy", "Lilac", "Vapor", "Rosewater", "Mint"],
  night: ["Synth", "Nebula", "Aurora", "Comet night", "Grape", "Midnight"],
  surprise: SKIES.map((s) => s.name),
}
const mixHex = (a: string, b: string, k: number) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - k) + parseInt(b.slice(i, i + 2), 16) * k).toString(16).padStart(2, "0")).join("")
const pickBand = (L: Levels, b: Band) => (b === "bass" ? L.bass : b === "mid" ? L.mid : b === "high" ? L.high : L.beat)
const soft = (x: number) => x * x * (3 - 2 * x)

/** The world as it looks at this moment of the music. The world you edit is never changed. */
export function react(base: World, L: Levels): { world: World; time: number } {
  const s = base.sound ?? soundSet(), w = clone(base), t = L.t
  const p = pickBand(L, s.pulseTo)
  w.things.forEach((th, i) => {
    if (th.eq !== undefined) { const v = L.bands[Math.max(0, Math.min(BANDS - 1, th.eq))], hh = th.size[1] * (0.14 + 1.45 * v * s.meters), bottom = th.pos[1] - th.size[1]; th.size[1] = hh; th.pos[1] = bottom + hh; th.mat.glow = th.mat.glow > 0 ? th.mat.glow * (0.35 + v * 1.4) : 0; return }
    const single = th.kind === "text" && th.text && [...th.text.str].length === 1
    if (single && s.meters > 0) { const v = L.bands[(3 + (th.text!.order ?? i) * 2) % BANDS]; th.pos[1] += v * s.meters * th.size[1] * 1.3 }
    const own = 0.7 * p + 0.3 * L.bands[(i * 5 + 1) % BANDS], k = 1 + s.pulse * own * 0.38
    if (th.kind !== "text" || !th.text || single) th.size = th.size.map((v) => v * k) as Vec3; else th.size = [th.size[0] * (1 + (k - 1) * 0.4), th.size[1] * (1 + (k - 1) * 0.4), th.size[2] * k]
    th.pos[1] += s.float * (Math.sin(t * 1.1 + i * 1.9) * 0.28 + L.bass * 0.55 * Math.sin(i * 2.4 + 1) ) * Math.min(2, 0.6 + th.size[1] * 0.4)
    if (th.mat.glow > 0) th.mat.glow *= 0.55 + s.glow * (L.mid * 1.2 + L.beat * 0.9) + (1 - s.glow) * 0.45
  })
  w.sea.wave *= 1 + s.ripple * L.bass * 1.6; w.sea.grain = Math.min(1, w.sea.grain + s.ripple * L.high * 0.12)
  w.sky.sunGlow *= 1 + s.glow * (L.mid * 0.9 + L.beat * 0.7); w.sky.sunSize *= 1 + s.glow * L.beat * 0.22
  if (w.sky.stars > 0) w.sky.stars *= 1 - s.twinkle * 0.5 + s.twinkle * L.high * 1.6
  w.sky.hazeAmt = Math.min(1, w.sky.hazeAmt + s.breathe * (L.mid - 0.3) * 0.22); if (w.sky.rays) w.sky.rays *= 0.6 + L.mid * 0.9
  if (w.sky.moon > 0) w.sky.moon *= 1 + s.glow * L.beat * 0.3
  if (s.journey !== "off") { // every so many beats the sky glides on to the next colours of its journey
    const names = JOURNEYS[s.journey] ?? JOURNEYS.sunset, every = Math.max(1, s.every), step = Math.floor(L.beats / every)
    if (step > 0) { const look = (n: number) => SKIES.find((x) => x.name === names[n % names.length]) ?? SKIES[0], from = step === 1 ? { zenith: base.sky.zenith, horizon: base.sky.horizon, haze: base.sky.haze, sunColor: base.sky.sunColor, cloudColor: base.sky.cloudColor } : look(step - 2), to = look(step - 1)
      const k = soft(Math.min(1, ((L.beats % every) + (1 - L.beat)) / Math.min(2, every)))
      w.sky.zenith = mixHex(from.zenith, to.zenith, k); w.sky.horizon = mixHex(from.horizon, to.horizon, k); w.sky.haze = mixHex(from.haze, to.haze, k); w.sky.fogColor = w.sky.haze; w.sky.sunColor = mixHex(from.sunColor, to.sunColor, k); w.sky.cloudColor = mixHex(from.cloudColor, to.cloudColor, k) } }
  w.cam.yaw += s.orbit * t * 0.12 + s.kick * 0.16 * (L.beats - L.beat * L.beat)
  w.cam.dist *= 1 - s.punch * L.beat * 0.07; w.cam.roll += s.kick * L.beat * 1.2 * (L.beats % 2 ? 1 : -1)
  return { world: w, time: t * (0.25 + s.breathe * 1.2) + L.mid * s.breathe * 0.6 }
}

// ---------- meter bars ----------
/** A colour along the rainbow, for neon bars: low notes warm, high notes cool. */
export function hue(k: number) { const h = 330 - k * 190, f = (n: number) => { const a = (n + h / 30) % 12; return Math.round(255 * (0.58 - 0.42 * Math.max(-1, Math.min(a - 3, 9 - a, 1)))).toString(16).padStart(2, "0") }; return `#${f(0)}${f(8)}${f(4)}` }
export function addMeters(shape: "row" | "ring", neon = false) {
  const w = get().world, room = 20 - w.things.length, n = Math.min(12, room); if (n < 4) return false
  const c = w.cam.target, R = Math.max(4.5, w.cam.dist * 0.3), yaw = w.cam.yaw, bars: Thing[] = []
  for (let i = 0; i < n; i++) { const band = Math.round((i / (n - 1)) * (BANDS - 2)), wd = shape === "row" ? Math.min(0.6, (R * 2.2) / n / 2.6) : 0.5
    let x: number, z: number, turn = (yaw * 180) / Math.PI
    if (shape === "row") { const off = (i - (n - 1) / 2) * wd * 2.6; x = c[0] + Math.cos(yaw) * off; z = c[2] - Math.sin(yaw) * off } else { const a = (i / n) * Math.PI * 2; x = c[0] + Math.cos(a) * R; z = c[2] + Math.sin(a) * R; turn = (-a * 180) / Math.PI }
    const g = engine?.groundAt(x, z) ?? 0, hh = 2.2
    bars.push(thing("box", [x, g + hh, z], [wd, hh, wd], neon ? { ...mat("Neon"), color: hue(i / (n - 1)), glow: 1.5 } : mat("Chrome"), { name: `Meter ${i + 1}`, eq: band, rot: [turn, 0, 0], round: 0.06 })) }
  edit("meters", (x) => { x.things.push(...bars); x.sound = x.sound ?? soundSet() }); return true
}
export function removeMeters() { edit("meters-off", (w) => { w.things = w.things.filter((t) => t.eq === undefined) }) }

// ---------- film a song ----------
export const FILM_SIZES = { square: [720, 720], wide: [1280, 720], story: [720, 1280], small: [640, 360] } as const
export interface FilmOpts { size: keyof typeof FILM_SIZES; seconds: number; start: number; fps: number; samples: number }
async function pickCodecs(W: number, H: number, fps: number) {
  const VE = (window as any).VideoEncoder, AE = (window as any).AudioEncoder; if (!VE || !AE) return null
  const ok = async (E: any, cfg: any) => { try { return (await E.isConfigSupported(cfg)).supported } catch { return false } }
  const v = { width: W, height: H, bitrate: Math.round(W * H * fps * 0.11), framerate: fps }, a = { numberOfChannels: 2, sampleRate: SR, bitrate: 160000 }
  if ((await ok(VE, { ...v, codec: "avc1.640028" })) && (await ok(AE, { ...a, codec: "mp4a.40.2" }))) return { kind: "mp4" as const, v: { ...v, codec: "avc1.640028" }, a: { ...a, codec: "mp4a.40.2" } }
  if ((await ok(VE, { ...v, codec: "vp09.00.31.08" })) && (await ok(AE, { ...a, codec: "opus" }))) return { kind: "webm" as const, v: { ...v, codec: "vp09.00.31.08" }, a: { ...a, codec: "opus" } }
  if ((await ok(VE, { ...v, codec: "vp8" })) && (await ok(AE, { ...a, codec: "opus" }))) return { kind: "webm8" as const, v: { ...v, codec: "vp8" }, a: { ...a, codec: "opus" } }
  return null
}
/** Ray trace every frame of the song and write them, with the sound, into one video file. */
export async function filmSong(base: World, song: Song, o: FilmOpts, onProgress: (f: number, frame: HTMLCanvasElement) => void, alive: () => boolean): Promise<{ blob: Blob; ext: string } | null> {
  if (!engine) return null
  const [W, H] = FILM_SIZES[o.size], fps = o.fps, start = Math.max(0, Math.min(o.start, song.score.duration - 0.5)), secs = Math.min(o.seconds, song.score.duration - start), n = Math.max(1, Math.round(secs * fps))
  const c = await pickCodecs(W, H, fps); if (!c) return null
  const mp4 = c.kind === "mp4", lib: any = mp4 ? await import("mp4-muxer") : await import("webm-muxer")
  const muxer = new lib.Muxer({ target: new lib.ArrayBufferTarget(), video: { codec: mp4 ? "avc" : c.kind === "webm" ? "V_VP9" : "V_VP8", width: W, height: H, frameRate: fps }, audio: { codec: mp4 ? "aac" : "A_OPUS", numberOfChannels: 2, sampleRate: SR }, ...(mp4 ? { fastStart: "in-memory" } : {}), firstTimestampBehavior: "offset" })
  let failed = ""
  const VE = (window as any).VideoEncoder, AE = (window as any).AudioEncoder, AD = (window as any).AudioData, VF = (window as any).VideoFrame
  const ve = new VE({ output: (ch: any, meta: any) => muxer.addVideoChunk(ch, meta), error: (e: any) => { failed = String(e) } }); ve.configure(c.v)
  const ae = new AE({ output: (ch: any, meta: any) => muxer.addAudioChunk(ch, meta), error: (e: any) => { failed = String(e) } }); ae.configure(c.a)
  // the sound: the same stretch of the song, with a short fade at each end so it does not click
  const a0 = Math.floor(start * SR), len = Math.floor(secs * SR), block = 4800, fade = Math.min(len / 4, SR * 0.4)
  for (let at = 0; at < len; at += block) { const m = Math.min(block, len - at), data = new Float32Array(m * 2)
    for (let ch = 0; ch < 2; ch++) for (let i = 0; i < m; i++) { const k = at + i, g = Math.min(1, k / fade, (len - k) / fade); data[ch * m + i] = (song.pcm[ch][a0 + k] || 0) * g }
    const ad = new AD({ format: "f32-planar", sampleRate: SR, numberOfFrames: m, numberOfChannels: 2, timestamp: Math.round((at / SR) * 1e6), data }); ae.encode(ad); ad.close() }
  const stage = document.createElement("canvas")
  for (let i = 0; i < n; i++) {
    if (!alive() || failed) { try { ve.close(); ae.close() } catch { /* already closed */ } return null }
    const t = start + i / fps, L = levelsAt(song.score, t), r = react(base, { ...L, t: i / fps })
    engine.frame(r.world, W, H, o.samples, r.time, stage, (i / fps) % 1)
    const frame = new VF(stage, { timestamp: Math.round((i / fps) * 1e6), duration: Math.round(1e6 / fps) }); ve.encode(frame, { keyFrame: i % (fps * 2) === 0 }); frame.close()
    if (ve.encodeQueueSize > 6) await new Promise((ok) => setTimeout(ok, 20))
    if (i % 3 === 0) { onProgress((i + 1) / n, stage); await new Promise((ok) => setTimeout(ok)) }
  }
  await ve.flush(); await ae.flush(); ve.close(); ae.close(); muxer.finalize(); if (failed) return null
  onProgress(1, stage)
  return { blob: new Blob([muxer.target.buffer], { type: mp4 ? "video/mp4" : "video/webm" }), ext: mp4 ? "mp4" : "webm" }
}
export { patch }
