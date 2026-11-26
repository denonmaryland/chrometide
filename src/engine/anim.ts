// Keyframes: a key is the whole pose of the world at a moment. Between two keys every number and
// colour glides from one to the other.
import { type Anim, type Pose, type Thing, type World, clone } from "./scene"

export const pose = (w: World): Pose => { const p = clone({ sky: w.sky, sea: w.sea, land: w.land, cam: w.cam, things: w.things, title: w.title }) as Pose; delete p.land.sculpt; return p }
const HEX = /^#[0-9a-f]{6}$/i
const mixHex = (a: string, b: string, k: number) => "#" + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - k) + parseInt(b.slice(i, i + 2), 16) * k).toString(16).padStart(2, "0")).join("")
function mix(a: any, b: any, k: number): any {
  if (typeof a === "number" && typeof b === "number") return a + (b - a) * k
  if (typeof a === "string" && typeof b === "string") return HEX.test(a) && HEX.test(b) ? mixHex(a, b, k) : k < 0.5 ? a : b
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length && typeof a[0] === "object" && a[0] && "id" in a[0]) return (a as Thing[]).map((t) => { const u = (b as Thing[]).find((x) => x.id === t.id); return u ? mix(t, u, k) : t })
    return a.length === b.length ? a.map((x, i) => mix(x, b[i], k)) : k < 0.5 ? a : b
  }
  if (a && b && typeof a === "object" && typeof b === "object") { const o: any = {}; for (const key of Object.keys(a)) o[key] = key in b ? mix(a[key], b[key], k) : a[key]; return o }
  return k < 0.5 ? a : b
}
/** The world at a moment of its timeline, t from 0 to 1. */
export function at(w: World, t: number): World {
  const an = w.anim; if (!an || an.keys.length === 0) return w
  const keys = [...an.keys].sort((x, y) => x.t - y.t); let p: Pose
  if (keys.length === 1) p = keys[0].pose
  else {
    const ring = an.loop ? [...keys, { t: 1 + keys[0].t, pose: keys[0].pose }] : keys
    let tt = t; if (an.loop && tt < keys[0].t) tt += 1
    let i = ring.findIndex((k) => k.t > tt); if (i === -1) i = ring.length; const a = ring[Math.max(0, i - 1)], b = ring[Math.min(ring.length - 1, i)]
    const progress = a.t === b.t ? 0 : Math.min(1, Math.max(0, (tt - a.t) / (b.t - a.t)))
    const smooth = progress * progress * (3 - 2 * progress)
    p = a === b ? a.pose : mix(a.pose, b.pose, an.ease ? smooth : progress)
    if (a !== b && an.zoomCurve) {
      const zoom = an.zoomCurve === "smooth" ? smooth : progress
      p.cam.dist = a.pose.cam.dist + (b.pose.cam.dist - a.pose.cam.dist) * zoom
    }
  }
  const q = clone(p)
  return { ...w, sky: q.sky, sea: q.sea, cam: q.cam, things: q.things, title: q.title, land: { ...q.land, sculpt: w.land.sculpt } }
}
export const newAnim = (): Anim => ({ seconds: 6, loop: true, ease: true, keys: [] })
export const keyAt = (an: Anim | undefined, t: number) => (an ? an.keys.findIndex((k) => Math.abs(k.t - t) < 0.006) : -1)
