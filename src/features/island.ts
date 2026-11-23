// A year of GitHub contributions as an island. Weeks run left to right, the days of the week run
// from the back (Sunday) to the front (Saturday), busy days rise as peaks with snow on the busiest,
// and quiet days are sea. The person's name stands in chrome letters; the sky is picked from how
// busy the year was. Pure data in, a world out: the app, the agent page (?api=1) and the command
// line all build it the same way.
import { textAspect } from "@/engine/lettering"
import { type Material, type Sky, type TextSpec, type Thing, type Vec3, type World, SEAS, camFrom, landFrom, mat, seaFrom, skyFrom, textSpec, thing, world } from "@/engine/scene"

export interface Day { date: string; count: number }
export interface Calendar { user: string; days: Day[] }
export interface Stats { total: number; active: number; busiest: Day | null; streak: number; weeks: number; from: string; to: string }

const ISO = /^\d{4}-\d{2}-\d{2}$/
const dayNo = (d: string) => Math.floor(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000)
const dateOf = (n: number) => new Date(n * 86400000).toISOString().slice(0, 10)
export const cleanUser = (s: string) => String(s ?? "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?github\.com\//i, "").replace(/[/?#].*$/, "")
export const validUser = (s: string) => /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(s)

/**
 * Read a contribution calendar from whatever was given: the JSON of the free contributions service,
 * GitHub's own GraphQL answer, a plain list of {date, count}, or lines of text such as
 * "2025-03-14 7". Keeps the last 53 weeks. Returns null if there are no dated days in it.
 */
export function parseCalendar(input: unknown, user = ""): Calendar | null {
  let data = input
  if (typeof data === "string") { const s = data.trim(); try { data = JSON.parse(s) } catch { data = [...s.matchAll(/(\d{4}-\d{2}-\d{2})[^\d\n]{1,12}?(\d+)(?![\d-])/g)].map((m) => ({ date: m[1], count: +m[2] })) } }
  const o = data as any; let list: any[] | null = null; let who = "" // the name in the data wins; the one given is for data without one
  const gql = o?.data?.user ?? o?.user ?? o
  const weeks = gql?.contributionsCollection?.contributionCalendar?.weeks ?? gql?.contributionCalendar?.weeks ?? gql?.weeks
  if (Array.isArray(weeks)) { list = weeks.flatMap((w: any) => w?.contributionDays ?? []); who ||= typeof gql?.login === "string" ? gql.login : "" }
  else if (Array.isArray(o?.contributions)) list = o.contributions
  else if (Array.isArray(o)) list = o
  if (!list) return null
  who ||= typeof o?.user === "string" ? o.user : typeof o?.login === "string" ? o.login : ""
  who ||= user
  const seen = new Map<string, number>()
  for (const d of list) { const date = String(d?.date ?? "").slice(0, 10), n = Number(d?.count ?? d?.contributionCount ?? 0); if (ISO.test(date) && isFinite(n)) seen.set(date, Math.max(0, Math.round(n))) }
  if (!seen.size) return null
  // the newest 371 days (53 weeks): the service can send several years, and GitHub sends a few days more
  const dates = [...seen.keys()].sort(), last = dayNo(dates.at(-1)!), first = Math.max(dayNo(dates[0]), last - 370)
  const days: Day[] = []; for (let n = first; n <= last; n++) { const date = dateOf(n); days.push({ date, count: seen.get(date) ?? 0 }) }
  return { user: cleanUser(who).slice(0, 39), days }
}

export function stats(c: Calendar): Stats {
  let total = 0, active = 0, streak = 0, run = 0, busiest: Day | null = null
  for (const d of c.days) { total += d.count; if (d.count > 0) { active++; run++; streak = Math.max(streak, run) } else run = 0; if (d.count > 0 && (!busiest || d.count > busiest.count)) busiest = d }
  const wd = new Date(dayNo(c.days[0].date) * 86400000).getUTCDay()
  return { total, active, busiest, streak, weeks: Math.ceil((c.days.length + wd) / 7), from: c.days[0].date, to: c.days.at(-1)!.date }
}

/** How the year felt, from quiet to blazing. Each has its own sky, sea, land and letters. */
export interface Mood { min: number; name: string; sky: Partial<Sky> & { zenith: string; horizon: string; haze: string; sunColor: string; cloudColor: string }; sea: string; land: { c1: string; c2: string; c3: string }; letters: string; glow: string }
export const MOODS: Mood[] = [
  { min: 0, name: "A quiet year", sea: "Ink", letters: "Chrome", glow: "#9fc4ff", land: { c1: "#cfc8b8", c2: "#55657e", c3: "#343a50" },
    sky: { zenith: "#040822", horizon: "#2a3f86", haze: "#3a5096", sunColor: "#c8d8ff", cloudColor: "#1c2a5a", stars: 1.5, moon: 1, moonAz: 2.5, moonEl: 0.42, moonSize: 0.1, moonPhase: 0.5, ambient: 0.5, sun: { az: 2.78, el: 0.35 } } },
  { min: 100, name: "A gentle year", sea: "Mirror", letters: "Ink", glow: "#ff8ad0", land: { c1: "#f4e0c4", c2: "#8a9f72", c3: "#6a5f80" },
    sky: { zenith: "#5a46c8", horizon: "#ffc6e4", haze: "#ffd8ee", sunColor: "#fff2f6", cloudColor: "#fbe6ff", cloud: 0.35, streak: 0.7, sun: { az: 2.78, el: 0.2 } } },
  { min: 500, name: "A steady year", sea: "Ocean", letters: "Ink", glow: "#ffb050", land: { c1: "#f2dca6", c2: "#4c9a4a", c3: "#5e554a" },
    sky: { zenith: "#2c4fb0", horizon: "#ffb860", haze: "#ffd496", sunColor: "#ffdcaa", cloudColor: "#ffd8b8", cloud: 0.4, streak: 0.8, sun: { az: 2.78, el: 0.16 } } },
  { min: 1500, name: "A busy year", sea: "Lagoon", letters: "Ink", glow: "#ff5fa8", land: { c1: "#fff0cc", c2: "#2ea84a", c3: "#2a5a5a" },
    sky: { zenith: "#00b874", horizon: "#ff96c0", haze: "#ffb0cc", sunColor: "#fff2e2", cloudColor: "#8a90c0", cloud: 0.45, streak: 0.85, sun: { az: 2.78, el: 0.15 } } },
  { min: 4000, name: "A blazing year", sea: "Ink", letters: "Ink", glow: "#ff6a9a", land: { c1: "#ffcf9a", c2: "#8a2f6a", c3: "#24183a" },
    sky: { zenith: "#170840", horizon: "#ff6a38", haze: "#ff9466", sunColor: "#ffc690", cloudColor: "#7a2a5a", stars: 0.6, cloud: 0.35, streak: 0.9, sun: { az: 2.78, el: 0.12 } } },
]
export const moodOf = (total: number) => [...MOODS].reverse().find((m) => total >= m.min)!

/** Letters that stand out against their sky: bright skies get dark glossy letters, dark skies chrome or gold. */
const letters = (name: string): Material => name === "Ink" ? { ...mat("Black pearl"), reflect: 0.16 } : mat(name)
const hash = (s: string) => { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296 }
const N = 128 // the sculpt grid (engine GRID)
const toB64 = (d: Uint8Array) => { let s = ""; for (let i = 0; i < d.length; i += 0x4000) s += String.fromCharCode(...d.subarray(i, i + 0x4000)); return btoa(s) }

export interface IslandOpts { aspect?: number }
/** Build the world. aspect is the picture's width over height: wide banners are seen from the front, squarer pictures from a corner. */
export function islandWorld(c: Calendar, o: IslandOpts = {}): World {
  const st = stats(c), mood = moodOf(st.total), aspect = o.aspect ?? 4 / 3, seed = hash(c.user || "year")
  // ---- the land: one mountain per busy day on the sculpt grid ----
  const R = 13.5, H = 5, Hm = Math.max(H, 2), x0 = 10, x1 = 118, cw = (x1 - x0) / st.weeks, ch = 4.2, y0 = N / 2 - (7 * ch) / 2
  const toV = (y: number) => 127.5 + ((y + 0.12 * Hm) * 255) / (2.4 * Hm) // world height -> grid value (flat land sits 0.12 Hm under the sea)
  const nz = c.days.filter((d) => d.count > 0).map((d) => d.count).sort((a, b) => a - b), ref = Math.max(1, nz[Math.floor(nz.length * 0.93)] ?? 1)
  const wd0 = new Date(dayNo(c.days[0].date) * 86400000).getUTCDay()
  const peaks = c.days.map((d, i) => { const k = Math.min(1, d.count / ref), slot = i + wd0
    return { x: x0 + (Math.floor(slot / 7) + 0.5) * cw, y: y0 + ((slot % 7) + 0.5) * ch, top: d.count > 0 ? 0.45 + 3.9 * Math.pow(k, 0.75) : 0, rx: cw * (0.9 + 1.2 * k), rz: ch * (0.75 + 0.55 * k), on: d.count > 0, d } })
  const g = new Float32Array(N * N).fill(-1)
  for (const p of peaks) { if (!p.on) continue
    for (let j = Math.max(0, Math.floor(p.y - p.rz - 2)); j <= Math.min(N - 1, Math.ceil(p.y + p.rz + 2)); j++) for (let i = Math.max(0, Math.floor(p.x - p.rx - 2)); i <= Math.min(N - 1, Math.ceil(p.x + p.rx + 2)); i++) {
      const dx = i - p.x, dy = j - p.y, d2 = (dx / p.rx) ** 2 + (dy / p.rz) ** 2, s2 = (dx / (cw * 0.95)) ** 2 + (dy / (ch * 0.75)) ** 2 // the mountain, and a round beach under it
      const peak = d2 < 1 ? p.top * (1 - d2) ** 2 : 0, y = Math.max(peak, s2 < 1 ? 0.3 * (1 - s2) : -1), at = j * N + i
      g[at] = Math.max(g[at], y) } }
  const sculpt = new Uint8Array(N * N); for (let i = 0; i < N * N; i++) sculpt[i] = g[i] < 0 ? 128 : Math.max(129, Math.min(255, Math.round(toV(g[i]))))
  const cell = (3.2 * R) / N, wx = (gx: number) => (gx - N / 2) * cell, wz = (gy: number) => (gy - N / 2) * cell // grid cells -> world

  // ---- things: the name in chrome, the year in neon, and small moons over the three busiest days ----
  const things: Thing[] = [], name = (c.user || "MY YEAR").toUpperCase(), wide = aspect >= 2
  const word = (str: string, height: number, pos: Vec3, spec: Partial<TextSpec>, m: Material, rot: Vec3 = [0, 0, 0]) => { const s = textSpec(str, { edge: "round", bevel: 0.035, ...spec }), h = height / 2
    return thing("text", pos, [h * textAspect(str, s.font), h, Math.max(0.12, height * 0.17)], m, { name: str.slice(0, 24), round: 0, text: s, rot }) }
  const span = (x1 - x0) * cell, front = wz(y0 + 7 * ch)
  // the name floats over the middle of the island like a title in the sky; the count stands on the water in front
  const nameH = Math.min(wide ? 4.8 : 5.6, (span * (wide ? 0.55 : 0.62)) / Math.max(1, textAspect(name, "poster")))
  // squarer pictures look from a little to the right, so the letters turn to face that way too
  const yaw = wide ? 0 : 0.32, turn: Vec3 = [(yaw * 180) / Math.PI, 0, 0], along = (d: number): [number, number] => [Math.sin(yaw) * d, d]
  const [nx, nzz] = along(front + 1.2); things.push(word(name, nameH, [nx, (wide ? 4.4 : 5.6) + nameH / 2, nzz], { font: "poster" }, letters(mood.letters), turn))
  const sub = `${st.total} CONTRIBUTIONS`, subH = 1.2
  const [sx, sz] = along(front + 5); things.push(word(sub, subH, [sx, subH / 2 + 0.12, sz], { font: "sans" }, mat("Chrome"), turn))
  const best: typeof peaks = [] // the three busiest days, at least a fortnight apart so their moons do not touch
  for (const p of peaks.filter((p) => p.on).sort((a, b) => b.d.count - a.d.count)) if (best.length < 3 && best.every((q) => Math.abs(q.x - p.x) > cw * 2.5)) best.push(p)
  best.forEach((p, i) => {
    const r = [0.7, 0.5, 0.42][i]
    things.push(thing("sphere", [wx(p.x), p.top + r + 1.4 + i * 0.4, wz(p.y)], r, mat(i === 0 ? "Gold" : "Chrome"), { name: `${i === 0 ? "Busiest" : "Busy"} day ${p.d.date}`, bob: 0.2 })) })

  // ---- sky, sea, camera ----
  const sky = skyFrom({ name: mood.name, ...mood.sky }, { ...mood.sky, sun: { ...mood.sky.sun! }, hazeAmt: 0.18, seed: 2 + seed * 30, cloudScale: 0.9 + seed * 0.4 })
  const sea = seaFrom(SEAS.find((s) => s.name === mood.sea) ?? SEAS[0], { wave: 0.12, grain: 0.03 })
  const land = landFrom({ name: "Year", ...mood.land, snow: 1 }, { on: true, mode: "island", height: H, radius: R, freq: 0.22, ridge: 0.8, seed: 1, flat: true, sculpt: toB64(sculpt) })
  const cam = wide ? camFrom({ yaw: 0, pitch: 0.12, dist: 40, target: [0, 3.4, 1], fov: 33, focus: 40 })
    : camFrom({ yaw, pitch: 0.2, dist: 53, target: [1.2, 4.2, 1.5], fov: 42, focus: 53 })
  return world(`${c.user || "My"} year`, sky, sea, land, things, cam, { bloom: 0.3, frame: wide ? { name: "Banner 1500 × 500", w: 1500, h: 500 } : { name: "Cover 1200 × 1200", w: 1200, h: 1200 } })
}
