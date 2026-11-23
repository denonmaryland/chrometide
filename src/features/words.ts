// Word -> world: any word (a name, a band, a city) grows the same world on every computer.
// The word is folded into a number, that number seeds the dice, and the roll is then tidied so
// the picture is always a good one: the things are in frame, above the water and the land.
import { type Thing, type Vec3, type World, ARRANGEMENTS, MATERIALS, arrange, blankWorld, roll, rng, withLuck } from "@/engine/scene"

/** The same letters give the same world: spaces and capitals do not matter. */
export const normalWord = (word: string) => word.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase()

/** A 32-bit number from a word (cyrb53, folded). Plain arithmetic, so every browser agrees. */
export function wordSeed(word: string): number {
  const s = normalWord(word); let h1 = 0xdeadbeef ^ s.length, h2 = 0x41c6ce57 ^ s.length
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677) }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h1 ^ h2) >>> 0
}

const r3 = (n: number) => Math.round(n * 1000) / 1000

/** The world a word grows. Pure: the same word always gives the same JSON. */
export function wordWorld(word: string): World {
  const seed = wordSeed(word), r = rng(seed)
  const w = withLuck(r, () => roll(blankWorld(), new Set()))
  tidy(w, r)
  w.name = word.trim().replace(/\s+/g, " ").slice(0, 60) || "Untitled world"
  const tag = seed.toString(36)
  w.things.forEach((t, i) => { t.id = `w${tag}-${i}`; t.pos = t.pos.map(r3) as Vec3; t.size = t.size.map(r3) as Vec3 })
  return w
}

const ROUND = ["sphere", "blob", "stone"]
const extent = (t: Thing) => (ROUND.includes(t.kind) ? Math.max(...t.size) * 1.05 : t.kind === "torus" ? Math.max(t.size[0], t.size[2]) : Math.hypot(...t.size))
/** The smallest ball (roughly) holding every thing: its middle and radius. */
function bounds(things: Thing[]) {
  const all = things.map((t) => ({ p: t.pos, r: extent(t) }))
  const lo = [0, 1, 2].map((k) => Math.min(...all.map((a) => a.p[k] - a.r))), hi = [0, 1, 2].map((k) => Math.max(...all.map((a) => a.p[k] + a.r)))
  const c = [0, 1, 2].map((k) => (lo[k] + hi[k]) / 2) as Vec3
  return { c, r: Math.max(1, ...all.map((a) => Math.hypot(a.p[0] - c[0], a.p[1] - c[1], a.p[2] - c[2]) + a.r)), bottom: lo[1] }
}
const move = (things: Thing[], d: Vec3) => things.forEach((t) => { t.pos = [t.pos[0] + d[0], t.pos[1] + d[1], t.pos[2] + d[2]] })

/** Make a rolled world reliably a good picture: its own things, placed clear of the land, and a
 *  camera that holds all of them in frame. */
function tidy(w: World, r: () => number) {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)]
  const style = pick(ARRANGEMENTS.filter((a) => a !== "garden")), m = pick(MATERIALS.filter((x) => x.glow === 0 && x.name !== "Leaf"))
  const things = withLuck(r, () => arrange(style, 3 + Math.floor(r() * 6), Math.floor(r() * 9999), { ...m }))
  if (r() < 0.4) { const m2 = pick(MATERIALS.filter((x) => x.glow === 0 && x.name !== "Leaf")); things.forEach((t, i) => { if (i % 2) t.mat = { ...m2 } }) }
  w.things = things
  // a trail reads best seen from the side it was laid out for; a clear sky reads better than a washed-out one
  if (style === "trail") w.cam.yaw = 0.3 + (r() - 0.5) * 0.7
  clearer(w)
  const cam = w.cam, yaw = cam.yaw, toCam: Vec3 = [Math.sin(yaw), 0, Math.cos(yaw)], side: Vec3 = [Math.cos(yaw), 0, -Math.sin(yaw)]
  const isle = w.land.on && w.land.mode === "island"
  let g = bounds(things)
  if (isle) {
    // the things stand in the water in front of the island, a little to one side, so both are seen
    const d = w.land.radius * 1.2 + g.r * 0.85, s = (r() < 0.5 ? -1 : 1) * g.r * 0.55
    move(things, [toCam[0] * d + side[0] * s - g.c[0], 0, toCam[2] * d + side[2] * s - g.c[2]])
  }
  // nothing under the water
  g = bounds(things); if (g.bottom < -0.05) move(things, [0, -g.bottom, 0])
  // the camera holds every thing with a margin, looking a little down
  g = bounds(things); cam.pitch = 0.06 + r() * 0.2; cam.target = [g.c[0], Math.max(1.2, g.c[1]), g.c[2]]
  let lo = 5, hi = 70; for (let k = 0; k < 24; k++) { const mid = (lo + hi) / 2; if (fits(things, { ...cam, dist: mid })) hi = mid; else lo = mid }
  cam.dist = Math.max(9, hi)
}

/** A colour as 0..1 channels, and back. */
const rgb = (h: string) => { const m = /^#?([0-9a-f]{6})$/i.exec(h); const s = m ? m[1] : "888888"; return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255) }
const hexOf = (c: number[]) => "#" + c.map((x) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, "0")).join("")
const lum = (c: number[]) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
/** Darker by `dark` (0..1) and more coloured by `more` (1 keeps it), around its own grey. */
function deepen(h: string, dark: number, more: number) {
  const c = rgb(h), l = lum(c)
  return hexOf(c.map((x) => (l + (x - l) * more) * (1 - dark)))
}

/** A word's world should have contrast and colour: pale haze and fog over a pale sky wash it out
 *  to milk, so the haze is held back the paler it is, fog stays a hint, and a pale top of the sky
 *  is deepened, light rays stay soft. Uses no dice, so the word's things and layout stay as they were. */
function clearer(w: World) {
  const s = w.sky, hz = lum(rgb(s.haze)), top = lum(rgb(s.zenith)), low = lum(rgb(s.horizon))
  s.hazeAmt = Math.min(s.hazeAmt, 0.55 - 0.3 * hz) // a white haze no more than 0.25, a dark one up to 0.55
  s.fog = s.fog > 0 ? Math.min(s.fog, 0.12) : 0
  if (s.rays) s.rays = Math.min(s.rays, 0.4) // light rays add the sun's colour over everything
  if (top > 0.45) s.zenith = deepen(s.zenith, Math.min(0.4, (top - 0.45) * 1.1), 1.35) // a pale sky gets a deeper top
  if (low > 0.85 && top > 0.35) s.horizon = deepen(s.horizon, 0.06, 1.5) // and a horizon with a little colour
}

/** Do all the things show inside a 4:3 picture, with a margin, from this camera? */
function fits(things: Thing[], c: World["cam"], margin = 0.86, aspect = 4 / 3) {
  const cp = Math.cos(c.pitch), pos = [c.target[0] + c.dist * cp * Math.sin(c.yaw), Math.max(0.25, c.target[1] + c.dist * Math.sin(c.pitch)), c.target[2] + c.dist * cp * Math.cos(c.yaw)]
  const n = (v: number[]) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return v.map((x) => x / l) }
  const fw = n([c.target[0] - pos[0], c.target[1] - pos[1], c.target[2] - pos[2]]), rt = n([-fw[2], 0, fw[0]]), up = [rt[1] * fw[2] - rt[2] * fw[1], rt[2] * fw[0] - rt[0] * fw[2], rt[0] * fw[1] - rt[1] * fw[0]]
  const focal = 1 / Math.tan(((c.fov || 55) * Math.PI) / 360), dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  return things.every((t) => { const v = [t.pos[0] - pos[0], t.pos[1] - pos[1], t.pos[2] - pos[2]], z = dot(v, fw), e = extent(t); if (z < e + 1) return false
    const x = (dot(v, rt) / z) * focal, y = (dot(v, up) / z) * focal, rr = (e / Math.sqrt(z * z - e * e)) * focal * 1.05
    return Math.abs(x) + rr <= aspect * margin && Math.abs(y) + rr <= margin })
}
