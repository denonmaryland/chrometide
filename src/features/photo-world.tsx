// Photo to world: any photo becomes the whole world. The top of the photo gives the sky (top colour,
// horizon, haze, sun), the bottom gives the sea, its light and dark raise a gentle island, and its
// five main colours (found by k-means) go onto the things. One step, so one undo takes it all back.
// Entries: the Modes menu, the File menu, and dropping a photo onto the picture.
import * as React from "react"
import { ImagePlus } from "lucide-react"

import type { Feature } from "."
import { GRID } from "@/engine/engine"
import type { Material, World } from "@/engine/scene"
import { Said, openFile, pickFile, readImage } from "@/io"
import { edit, get } from "@/store"
import { writeGrid } from "@/ui/Viewport"

// ---------- colour ----------
type RGB = [number, number, number] // 0..1
type HSL = [number, number, number] // hue 0..1, saturation 0..1, lightness 0..1
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const lum = (c: RGB) => c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const WHITE: RGB = [1, 1, 1]
const toHex = (c: RGB) => "#" + c.map((v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, "0")).join("")
function toHsl([r, g, b]: RGB): HSL {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn
  if (d < 1e-6) return [0, 0, l]
  const s = d / (1 - Math.abs(2 * l - 1)), h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h / 6, clamp(s, 0, 1), l]
}
function fromHsl([h, s, l]: HSL): RGB {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h * 6) % 2) - 1)), m = l - c / 2, k = Math.floor(h * 6) % 6
  const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][k]
  return [r + m, g + m, b + m]
}
/** The same hue, with its lightness and saturation kept inside a range that reads well. */
const tame = (c: RGB, l: [number, number], s: [number, number] = [0, 1], boost = 1): RGB => { const h = toHsl(c); return fromHsl([h[0], clamp(h[1] * boost, s[0], s[1]), clamp(h[2], l[0], l[1])]) }
const mean = (px: RGB[]): RGB => { const s: RGB = [0, 0, 0]; for (const p of px) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2] } const n = Math.max(1, px.length); return [s[0] / n, s[1] / n, s[2] / n] }

/** The k main colours of a set of pixels, most common first (k-means, started from the lightness spread so it always gives the same answer). */
export function palette(px: RGB[], k = 5): { color: RGB; share: number }[] {
  const pts = px.length > 4000 ? px.filter((_, i) => i % Math.ceil(px.length / 4000) === 0) : px
  const byL = [...pts].sort((a, b) => lum(a) - lum(b))
  let cs: RGB[] = Array.from({ length: k }, (_, i) => byL[Math.min(byL.length - 1, Math.floor(((i + 0.5) / k) * byL.length))] ?? [0.5, 0.5, 0.5])
  const own = new Int32Array(pts.length)
  for (let it = 0; it < 14; it++) {
    for (let i = 0; i < pts.length; i++) { let best = 0, bd = 1e9; for (let j = 0; j < k; j++) { const c = cs[j], d = (pts[i][0] - c[0]) ** 2 * 0.3 + (pts[i][1] - c[1]) ** 2 * 0.59 + (pts[i][2] - c[2]) ** 2 * 0.11; if (d < bd) { bd = d; best = j } } own[i] = best }
    cs = cs.map((c, j) => { const mine = pts.filter((_, i) => own[i] === j); return mine.length ? mean(mine) : c })
  }
  const count = cs.map((_, j) => own.reduce((n, o) => n + (o === j ? 1 : 0), 0))
  return cs.map((color, j) => ({ color, share: count[j] / Math.max(1, pts.length) })).sort((a, b) => b.share - a.share)
}

// ---------- reading the photo ----------
interface Look { sky: Partial<World["sky"]>; sea: Pick<World["sea"], "c1" | "c2">; land: { c1: string; c2: string; c3: string; grid: Uint8Array }; colors: RGB[]; night: boolean }

export async function readPhoto(file: Blob, camYaw: number): Promise<Look> {
  const im = await readImage(file), W = 96, H = clamp(Math.round((96 * im.height) / Math.max(1, im.width)), 40, 192)
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d", { willReadFrequently: true })!
  x.drawImage(im, 0, 0, W, H); const d = x.getImageData(0, 0, W, H).data
  const at = (i: number, j: number): RGB => { const o = (j * W + i) * 4; return [d[o] / 255, d[o + 1] / 255, d[o + 2] / 255] }
  const rows = (a: number, b: number) => { const out: RGB[] = []; for (let j = Math.floor(a * H); j < Math.max(Math.floor(a * H) + 1, Math.floor(b * H)); j++) for (let i = 0; i < W; i++) out.push(at(i, j)); return out }

  // where the sky meets the ground or sea: the sharpest change from one row to the next, a little
  // above or below the middle (the middle if nothing stands out)
  const rowMean = Array.from({ length: H }, (_, j) => mean(rows(j / H, (j + 1) / H)))
  let hz = 0.5, jump = 0.12
  for (let j = Math.ceil(H * 0.3); j < Math.floor(H * 0.75); j++) { const a = rowMean[Math.max(0, j - 2)], b2 = rowMean[Math.min(H - 1, j + 2)], dj = Math.abs(a[0] - b2[0]) + Math.abs(a[1] - b2[1]) + Math.abs(a[2] - b2[2]); if (dj > jump) { jump = dj; hz = j / H } }
  // sky: the top band is the zenith, the middle of the sky the horizon colour, just above the line the haze
  // (the most common colour of each band, not the average, so a few bright signs do not grey it out)
  const main = (px: RGB[]) => palette(px, 3)[0].color
  const zr = main(rows(0, hz * 0.25)), hr = main(rows(hz * 0.38, hz * 0.62)), hzr = main(rows(hz * 0.8, hz)), skyL = rows(0, hz).map(lum), skyMean = skyL.reduce((a, b) => a + b, 0) / skyL.length
  // how busy the sky is across (clouds), as opposed to down (a smooth gradient is not cloud)
  let busy = 0; for (let j = 0; j < H * hz * 0.9; j++) { const row = rows(j / H, (j + 1) / H).map(lum), m = row.reduce((a, b) => a + b, 0) / row.length; busy += row.reduce((a, b) => a + Math.abs(b - m), 0) / row.length }
  busy /= Math.max(1, Math.floor(H * hz * 0.9))
  const night = lum(zr) < 0.1 || (lum(zr) < 0.16 && lum(hr) < 0.22)
  let zen = toHsl(zr), hor = toHsl(hr)
  if (night) { zen = [zen[0], clamp(zen[1] * 1.2, 0.2, 0.9), clamp(zen[2], 0.03, 0.11)]; hor = [hor[0], clamp(hor[1] * 1.2, 0.25, 0.9), clamp(hor[2] * 1.4, 0.2, 0.4)] }
  else {
    hor = [hor[0], clamp(hor[1] * 1.1, 0, 0.9), clamp(hor[2], 0.56, 0.88)]
    zen = [zen[0], clamp(zen[1] * 1.25, 0, 0.95), clamp(zen[2], 0.12, 0.5)]
    // keep the sky a gradient, darker overhead and lighter low down; light mixes towards the brighter
    // colour, so the top needs to be well apart to still show
    if (hor[2] - zen[2] < 0.3) zen[2] = Math.max(0.08, hor[2] - 0.34)
  }
  const zenith = fromHsl(zen), horizon = fromHsl(hor)
  const haze = night ? tame(mix(hzr, horizon, 0.4), [0.25, 0.5], [0.3, 1], 1.2) : tame(mix(hzr, WHITE, 0.2), [Math.max(0.62, hor[2]), 0.93], [0, 0.95], 1.1)

  // the sun: the brightest patch in the top half, if it stands out; it sits where it is in the photo
  let best = -1, bi = W / 2, bj = H * 0.35
  for (let j = 2; j < H * hz - 2; j++) for (let i = 2; i < W - 2; i++) { let s = 0; for (let v = -2; v <= 2; v++) for (let u = -2; u <= 2; u++) s += lum(at(i + u, j + v)); if (s > best) { best = s; bi = i; bj = j } }
  best /= 25; const sunny = best > 0.55 && best - skyMean > 0.1
  const glow = sunny ? mean(rows(0, hz).filter((p) => lum(p) > best - 0.06)) : mix(horizon, WHITE, 0.5)
  // at night there is no sun in the photo: a low disc in the horizon's colour, like a neon sun
  const sunColor = night ? tame(horizon, [0.72, 0.84], [0.6, 1], 1.4) : tame(mix(glow, WHITE, 0.45), [0.84, 0.95], [0, 0.85])
  const fy = clamp(bj / H / hz, 0, 1), sun = { az: camYaw + Math.PI - (bi / W - 0.5) * 1.1, el: night ? 0.1 : sunny ? 0.05 + (1 - fy) * 0.5 : 0.42 }

  // sea: the two main colours of the bottom band, a deep one and a shallow one
  const [s1, s2] = palette(rows(hz + (1 - hz) * 0.15, 1), 2).map((p) => p.color).sort((a, b) => lum(a) - lum(b))
  const deep = tame(s1, [0.05, 0.3], [0, 0.95], 1.15), shallowRaw = tame(s2, [0.28, 0.62], [0, 0.95], 1.1)
  const shallow = toHsl(shallowRaw)[2] - toHsl(deep)[2] < 0.15 ? tame(shallowRaw, [Math.min(0.62, toHsl(deep)[2] + 0.18), 0.66]) : shallowRaw

  // the photo's five colours, and the land's from them: light shore, middle slopes, dark rock
  const all: RGB[] = []; for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) all.push(at(i, j))
  const pal = palette(all, 5), ground = palette(rows(hz, 1), 4).map((p) => p.color).sort((a, b) => lum(a) - lum(b))
  const land = { c1: toHex(tame(ground[3], [0.5, 0.78], [0, 0.75])), c2: toHex(tame(ground[2], [0.26, 0.52], [0.12, 0.85], 1.1)), c3: toHex(tame(ground[1], [0.16, 0.36], [0, 0.6])), grid: landGrid(im, camYaw) }
  // most striking first: saturated, not too dark or pale, and common enough to matter
  const colors = pal.map((p) => { const h = toHsl(p.color); return { c: p.color, score: (h[1] + 0.15) * (1 - Math.abs(h[2] - 0.5) * 1.3) * Math.sqrt(p.share + 0.02) } }).sort((a, b) => b.score - a.score).map((p) => p.c)

  return {
    sky: { zenith: toHex(zenith), horizon: toHex(horizon), haze: toHex(haze), sunColor: toHex(sunColor), cloudColor: toHex(night ? mix(horizon, zenith, 0.4) : mix(horizon, WHITE, 0.62)), fogColor: toHex(haze),
      sun, hazeAmt: night ? 0.35 : 0.55, cloud: night ? 0.12 : clamp(busy * 3.2, 0.1, 0.6), streak: 0.5, cloud2: 0, cloud2Color: "#ffffff", fog: 0, stars: night ? 1.2 : 0, moon: 0, rainbow: 0, halo: 0, rays: 0, comet: 0, ambient: night ? 0.4 : 0.5, sunGlow: 1 },
    sea: { c1: toHex(deep), c2: toHex(shallow) }, land, colors, night,
  }
}

export const LAND_RADIUS = 9, LAND_HEIGHT = 4
/** Light is high, dark is low, but always one island, a little way behind the middle of the view, that
 *  fades into the sea at its edges. The photo is laid over the island's square. */
function landGrid(im: HTMLImageElement, camYaw: number): Uint8Array {
  const N = GRID, c = document.createElement("canvas"); c.width = c.height = N; const x = c.getContext("2d", { willReadFrequently: true })!
  const s = Math.min(im.width, im.height); x.filter = "blur(1.2px)"; x.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, N, N)
  const px = x.getImageData(0, 0, N, N).data, v = new Float32Array(N * N)
  for (let k = 0; k < N * N; k++) v[k] = (px[k * 4] * 0.3 + px[k * 4 + 1] * 0.59 + px[k * 4 + 2] * 0.11) / 255
  const sorted = Float32Array.from(v).sort(), lo = sorted[Math.floor(N * N * 0.05)], hi = Math.max(lo + 0.05, sorted[Math.floor(N * N * 0.95)])
  // where the island sits: 7 units beyond the middle, seen from the camera; about 6.5 units across its middle
  const span = LAND_RADIUS * 3.2, cu = 0.5 - (Math.sin(camYaw) * 7) / span, cv = 0.5 - (Math.cos(camYaw) * 7) / span, ru = 6.5 / span
  const out = new Uint8Array(N * N)
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const du = ((i + 0.5) / N - cu) / ru, dv = ((j + 0.5) / N - cv) / ru, r2 = du * du + dv * dv
    if (r2 >= 1.2) { out[j * N + i] = 112; continue }
    // the photo, turned so its top is the far side of the island
    const pu = clamp(Math.round(((du * Math.cos(camYaw) - dv * Math.sin(camYaw)) * 0.5 + 0.5) * (N - 1)), 0, N - 1), pv = clamp(Math.round(((du * Math.sin(camYaw) + dv * Math.cos(camYaw)) * 0.5 + 0.5) * (N - 1)), 0, N - 1)
    const b = clamp((v[pv * N + pu] - lo) / (hi - lo), 0, 1), dome = Math.max(0, 1 - r2)
    const h = Math.pow(dome, 0.9) * (0.3 + 0.7 * b) + 0.06 * Math.max(0, 1 - r2 * 1.4) * b
    out[j * N + i] = Math.round(clamp(112 + 140 * h, 0, 255))
  }
  return out
}
/** Height of photo land at a point, worked out the way the ray tracer does it. */
function groundAt(grid: Uint8Array, land: World["land"], x: number, z: number) {
  const H = Math.max(land.height, 2), u = x / (land.radius * 3.2) + 0.5, v = z / (land.radius * 3.2) + 0.5
  if (u <= 0 || v <= 0 || u >= 1 || v >= 1) return -0.12 * H
  const sm = (a: number) => { const k = clamp(a / 0.06, 0, 1); return k * k * (3 - 2 * k) }
  const g = grid[clamp(Math.floor(v * GRID), 0, GRID - 1) * GRID + clamp(Math.floor(u * GRID), 0, GRID - 1)] / 255
  return -0.12 * H + (g - 0.5) * 2.4 * H * sm(u) * sm(v) * sm(1 - u) * sm(1 - v)
}

/** Paint a thing's material in a photo colour, keeping what it is made of. */
function repaint(m: Material, c: RGB, second: RGB) {
  const metal = m.metal > 0.4 || m.reflect > 0.6, see = m.clear > 0.3
  m.color = toHex(m.glow > 0 ? tame(c, [0.55, 0.8], [0.5, 1], 1.3) : metal ? tame(c, [0.62, 0.86], [0.2, 0.9], 1.2) : see ? tame(c, [0.6, 0.88], [0.2, 0.8]) : tame(c, [0.3, 0.66], [0.25, 0.95], 1.25))
  m.color2 = toHex(tame(second, [0.12, 0.85]))
  m.name = "From the photo"
}

export async function photoToWorld(file: Blob, name?: string) {
  const look = await readPhoto(file, get().world.cam.yaw)
  edit("photo-world", (w) => {
    Object.assign(w.sky, look.sky)
    w.sea = { ...w.sea, kind: "water", c1: look.sea.c1, c2: look.sea.c2, reflect: 0, wave: clamp(w.sea.wave, 0.2, 0.45), grain: Math.min(w.sea.grain, 0.1) }
    w.land = { ...w.land, on: true, mode: "island", flat: true, height: LAND_HEIGHT, radius: LAND_RADIUS, snow: 0, terrace: 0, plateau: 0, sharp: 0, c1: look.land.c1, c2: look.land.c2, c3: look.land.c3, sculpt: writeGrid(look.land.grid) }
    delete w.land.channel
    // the same material gets the same colour; when every thing wears one, the strongest colours take turns
    const names = [...new Set(w.things.map((t) => t.mat.name))]
    w.things.forEach((t, i) => {
      const n = names.length === 1 && w.things.length > 2 ? i % (w.things.length > 4 ? 3 : 2) : names.indexOf(t.mat.name), c = look.colors[n % look.colors.length]
      repaint(t.mat, c, look.colors[(n + 2) % look.colors.length])
      // a night photo full of strong colour: its colours light up, like signs (a few things, never metal or glass)
      if (look.night && toHsl(c)[1] > 0.35 && t.mat.metal < 0.4 && t.mat.clear < 0.3 && t.mat.reflect < 0.6 && !t.mat.glow && i < 3) { t.mat.glow = 1.1; t.mat.diffuse = 0.3; t.mat.shine = 0.3 }
      if (t.mat.layerColor) t.mat.layerColor = toHex(tame(look.colors[(n + 1) % look.colors.length], [0.2, 0.8]))
      // nothing ends up buried in the new island
      const g = groundAt(look.land.grid, w.land, t.pos[0], t.pos[2]); if (g > 0 && t.pos[1] - t.size[1] < g + 0.1) t.pos[1] = g + t.size[1] + 0.1
    })
    if (w.title) repaint(w.title.mat, look.colors[0], look.colors[1])
    if (name) w.name = name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").replace(/^\w/, (s) => s.toUpperCase()).slice(0, 60) || w.name
  })
}

// ---------- the ways in ----------
let say: ((s: string) => void) | null = null
export async function takePhoto(file: File | null) {
  if (!file) return
  if (!file.type.startsWith("image/")) { if (/\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(file.name)) say?.("That file is not a photo this browser can read. Try a JPG or PNG."); else await openFile(file); return }
  try { await photoToWorld(file, file.name); say?.("Your photo is now the world. Undo to go back.") }
  catch (e) { say?.(e instanceof Said ? e.message : "That photo could not be read. Try another one.") }
}
export const pickPhoto = async () => takePhoto(await pickFile("image/*"))

function Overlay() {
  const [over, setOver] = React.useState<DOMRect | null>(null), [note, setNote] = React.useState("")
  React.useEffect(() => {
    let t = 0; say = (s) => { setNote(s); clearTimeout(t); t = window.setTimeout(() => setNote(""), 4200) }
    const files = (e: DragEvent) => !!e.dataTransfer && [...e.dataTransfer.types].includes("Files")
    const rect = () => document.querySelector('[data-testid="viewport"]')?.getBoundingClientRect() ?? null
    let depth = 0
    const enter = (e: DragEvent) => { if (!files(e)) return; depth++; setOver(rect()) }
    const overFn = (e: DragEvent) => { if (!files(e)) return; e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "copy" }
    const leave = (e: DragEvent) => { if (!files(e)) return; depth = Math.max(0, depth - 1); if (!depth) setOver(null) }
    const drop = (e: DragEvent) => { if (!files(e)) return; e.preventDefault(); depth = 0; setOver(null)
      const f = [...(e.dataTransfer?.files ?? [])]; void takePhoto(f.find((x) => x.type.startsWith("image/")) ?? f[0] ?? null) }
    window.addEventListener("dragenter", enter); window.addEventListener("dragover", overFn); window.addEventListener("dragleave", leave); window.addEventListener("drop", drop)
    return () => { say = null; clearTimeout(t); window.removeEventListener("dragenter", enter); window.removeEventListener("dragover", overFn); window.removeEventListener("dragleave", leave); window.removeEventListener("drop", drop) }
  }, [])
  return <>
    {over && <div className="pointer-events-none fixed z-50 grid place-items-center p-4" style={{ left: over.left, top: over.top, width: over.width, height: over.height }} data-testid="photo-drop">
      <div className="glass-panel flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/40 px-8 py-6 text-center">
        <ImagePlus className="size-7" /><span className="text-[15px] font-medium">Drop a photo to make it a world</span>
        <span className="text-[12px] text-foreground/80">Sky from the top, sea from the bottom, colours from all of it</span>
      </div>
    </div>}
    {note && <div role="status" className="glass-panel fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-lg px-3.5 py-2 text-[13px]" data-testid="photo-note">{note}</div>}
  </>
}

export const photoWorld: Feature = {
  id: "photo-world", label: "Photo to world", icon: ImagePlus,
  about: "Pick or drop any photo: the sky, sea, land and colours follow it.",
  run: () => void pickPhoto(), Overlay,
}
