// The tape: a record of how this world was made, one step per meaningful change, kept for the
// time-lapse. It listens at the store's one door for changes, keeps at most the last 600 steps,
// folds a drag or a run of the same change into one step, and skips changes nothing shows.
import type { World } from "@/engine/scene"
import { get, worldTaps } from "@/store"

export interface Step { at: number; since: number; label: string; world: World; look: string }
export const MAX_STEPS = 600
const CAMERA = /^(orbit|zoom|pan|focus|cam|view-go\d*)$/ // moves of the camera alone: a run of them is one step
const HOLD = 2500, LONGEST = 6000 // the same change again within 2.5 s joins the step, up to 6 s long

let tape: Step[] = []
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
export const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export const steps = () => tape

// big pieces of text (sculpted land, pictures, fonts, models) are kept once however many steps share them
let big = new Map<string, string>()
const one = (s: string | undefined) => { if (!s || s.length < 256) return s; const k = big.get(s); if (k !== undefined) return k; big.set(s, s); return s }
function keep(w: World): World {
  return { ...w, anim: undefined, views: [], sound: undefined, land: { ...w.land, sculpt: one(w.land.sculpt) }, picture: one(w.picture), customFont: one(w.customFont), model: w.model ? { ...w.model, data: one(w.model.data)! } : undefined }
}
/** What the picture shows, as text: two steps that look the same have the same text. */
function lookOf(w: World) {
  const ids = (s?: string) => (s ? `${s.length}:${s.slice(0, 24)}:${s.slice(-24)}` : "")
  return JSON.stringify([w.sky, w.sea, { ...w.land, sculpt: ids(w.land.sculpt) }, w.things, w.title, { ...w.cam, focus: 0 }, w.bloom ?? 0, ids(w.picture), ids(w.model?.data), ids(w.customFont)])
}
function trim() {
  if (tape.length <= MAX_STEPS) return
  tape = tape.slice(-MAX_STEPS)
  const live = new Set<string>(); for (const s of tape) for (const v of [s.world.land.sculpt, s.world.picture, s.world.customFont, s.world.model?.data]) if (v && v.length >= 256) live.add(v)
  big = new Map([...live].map((v) => [v, v]))
}

export function record(w: World, label: string) {
  const now = Date.now(), last = tape.at(-1), x = keep(w), look = lookOf(x)
  if (last && last.look === look) return // nothing to see: a new name, a saved view
  const same = last && ((label === last.label && now - last.at < HOLD && now - last.since < LONGEST) || (CAMERA.test(label) && CAMERA.test(last.label)))
  if (same && tape.length > 1) tape[tape.length - 1] = { ...last!, at: now, world: x, look }
  else { tape.push({ at: now, since: now, label, world: x, look }); trim() }
  emit()
}
/** Start a fresh tape from the world as it is now. */
export function clear() { tape = []; big = new Map(); record(get().world, "start") }

record(get().world, "start")
worldTaps.add(record)
;(window as any).__tape = { steps, clear, record }
