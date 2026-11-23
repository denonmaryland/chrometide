// What you can do with words: stand them up, split them into letters, bend them into rings, make
// neon of them, carve them through a block, or write them into the land.
import { GRID } from "./engine/engine"
import { FONTS, charSpans, fontCss, textAspect, useCustomFont } from "./engine/lettering"
import { type TextSpec, type Thing, type Vec3, type World, clone, mat, newId, textSpec, thing } from "./engine/scene"
import { addThing, edit, engine, get, patch } from "./store"
import { readGrid, writeGrid } from "./ui/Viewport"

const deg = (r: number) => (r * 180) / Math.PI
/** A text thing of a given letter height, sized so its letters keep their true proportions. */
export function wordThing(str: string, height: number, pos: Vec3, o: Partial<TextSpec> = {}, more: Partial<Thing> = {}): Thing {
  const spec = textSpec(str, o), h = height / 2
  return thing("text", pos, [h * textAspect(str, spec.font), h, Math.max(0.08, height * 0.14)], mat("Chrome"), { name: str.replace(/\n/g, " ").slice(0, 24) || "Lettering", round: 0, text: spec, ...more })
}
/** Keep a text thing's width right after its words or font change. */
export function refit(t: Thing) { if (t.text) t.size[0] = t.size[1] * textAspect(t.text.str, t.text.font) }
/** A good place for new words: between the camera and the middle of the world, standing on whatever ground is there. */
function spot(w: World, share = 0.45) {
  const c = w.cam, d = c.dist * share * Math.cos(c.pitch), x = c.target[0] + Math.sin(c.yaw) * d, z = c.target[2] + Math.cos(c.yaw) * d
  return { x, z, ground: engine?.groundAt(x, z) ?? 0, height: Math.max(1.2, c.dist * 0.13), turn: deg(c.yaw) }
}
const say = (s: string) => (s.trim() || "HELLO").toUpperCase().slice(0, 40)

export function addWord(str: string, font: string) { const p = spot(get().world); addThing(wordThing(say(str), p.height, [p.x, p.ground + p.height / 2 + 0.25, p.z], { font }, { rot: [p.turn, 0, 0] })) }
export function addNeon(str: string, font: string) {
  const p = spot(get().world), t = wordThing(say(str), p.height, [p.x, p.ground + p.height * 1.25, p.z], { font, style: "tube", stroke: 0.028 }, { rot: [p.turn, 0, 0] })
  t.mat = { ...mat("Neon"), glow: 2.6 }; addThing(t)
}
/** Words running all the way round a ring. Short words are repeated so the ring is wide enough to circle what is in the middle. */
export function addRing(str: string, font: string) {
  const w = get().world; let s = say(str) + " · "; while (s.length * 2 <= 40 && textAspect(s, font) < 12) s += s
  const R = Math.max(4.2, w.cam.dist * 0.3), height = (2 * Math.PI * R) / textAspect(s, font)
  addThing(wordThing(s, height, [w.cam.target[0], Math.max(height / 2 + 0.4, w.cam.target[1]), w.cam.target[2]], { font, bend: -360 }, { rot: [deg(w.cam.yaw), 0, 0], spin: 1 }))
}
/** A block with the word cut clean through it. */
export function addCarved(str: string, font: string) {
  const p = spot(get().world, 0.3), s = say(str), h = p.height * 1.3, half = (h / 2) * textAspect(s, font), g = 1 + Math.floor(Math.random() * 3), y = p.ground + h * 0.85
  const slab = thing("box", [p.x, y, p.z], [half + h * 0.3, h * 0.85, h * 0.2], mat("Gold"), { rot: [p.turn, 0, 0], group: g, name: "Slab", round: 0.03 })
  const cut = wordThing(s, h, [p.x, y, p.z], { font, edge: "sharp" }, { rot: [p.turn, 0, 0], group: g, role: "cut", name: s + " (cut)" }); cut.size[2] = h * 0.32; cut.mat = mat("Red gloss")
  edit("carved", (x) => { if (x.things.length <= 18) x.things.push(slab, cut) }); patch({ sel: { type: "thing", id: cut.id } })
}
/** Every letter becomes its own thing, standing exactly where it stood in the word. */
export function splitLetters(id: string) {
  const w = get().world, t = w.things.find((x) => x.id === id); if (!t?.text) return
  const spans = charSpans(t.text.str, t.text.font), yaw = (t.rot[0] * Math.PI) / 180, ax: Vec3 = [Math.cos(yaw), 0, -Math.sin(yaw)]
  const room = 20 - (w.things.length - 1); if (spans.length < 2 || spans.length > room) return false
  const letters = spans.map((s, i) => { const c = clone(t); c.id = newId(); c.name = s.ch; c.text = { ...t.text!, str: s.ch, bend: 0, arch: 0, order: i }
    c.size = [t.size[1] * textAspect(s.ch, t.text!.font), t.size[1], t.size[2]]; const off = (s.mid - 0.5) * 2 * t.size[0]; c.pos = [t.pos[0] + ax[0] * off, t.pos[1], t.pos[2] + ax[2] * off]; return c })
  edit("split" + id, (x) => { x.things = x.things.flatMap((k) => (k.id === id ? letters : [k])) }); patch({ sel: { type: "thing", id: letters[0].id } }); return true
}
const letters = (w: World) => w.things.filter((t) => t.kind === "text" && t.text && [...t.text.str].length === 1)
/** Letters drift out of line, like the spheres do. */
export function floatApart() { edit("float-letters", (w) => letters(w).forEach((t, i) => { t.pos[1] += 0.4 + Math.random() * 2.6; t.pos[2] += (Math.random() - 0.5) * 2.5; t.rot = [t.rot[0] + (Math.random() - 0.5) * 50, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30]; t.bob = 0.2; void i })) }
export function setMotion(motion: TextSpec["motion"], only?: string) { edit("text-motion", (w) => w.things.forEach((t) => { if (t.text && (!only || t.id === only || [...t.text.str].length === 1)) t.text.motion = motion })) }

/** Words pressed into the land: raised as islands of their own, or cut as canals through the land that is there. */
export function writeOnLand(str: string, font: string, mode: "raise" | "carve") {
  const c = document.createElement("canvas"); c.width = c.height = GRID; const x = c.getContext("2d", { willReadFrequently: true })!, s = say(str)
  let px = 60; x.font = fontCss(font, px); const wide = x.measureText(s).width; px = Math.max(8, Math.min(70, Math.floor((px * GRID * (mode === "raise" ? 0.8 : 0.52)) / Math.max(1, wide)))); x.font = fontCss(font, px)
  x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle"; x.filter = "blur(1.1px)"; x.fillText(s, GRID / 2, GRID / 2)
  const a = x.getImageData(0, 0, GRID, GRID).data
  edit("write-land", (w) => { const d = mode === "raise" ? new Uint8Array(GRID * GRID) : readGrid(w.land.sculpt)
    for (let i = 0; i < GRID * GRID; i++) { const v = a[i * 4 + 3] / 255; d[i] = mode === "raise" ? Math.round(116 + v * 60) : Math.max(0, Math.round(d[i] - v * 150)) }
    w.land.sculpt = writeGrid(d); w.land.on = true
    if (mode === "raise") { w.land.flat = true; w.land.mode = "island"; delete w.land.channel; w.land.radius = Math.max(w.land.radius, 9); w.land.height = Math.max(3, Math.min(w.land.height, 5)); w.cam = { ...w.cam, pitch: Math.max(w.cam.pitch, 0.55), dist: Math.max(w.cam.dist, 30), yaw: 0 } } })
  patch({ sel: { type: "land" } })
}

/** A font file of your own. It stays with the world on this device and is not sent in share links. */
export async function loadCustomFont(file: File): Promise<boolean> {
  if (file.size > 3_000_000) return false
  const url = await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(file) })
  if (!(await useCustomFont(url))) return false
  edit("custom-font", (w) => { w.customFont = url }); engine?.resetGlyphs(); return true
}
/** Bring a world's own font to life, and turn a first-version title into a text thing. */
export async function prepare(w: World): Promise<World> {
  if (w.customFont && (await useCustomFont(w.customFont))) engine?.resetGlyphs()
  if (w.title?.text.trim()) { const t = w.title, hgt = t.width / textAspect(t.text, "sans"), n = clone(w); delete n.title
    const th = wordThing(t.text, hgt, [t.x, hgt / 2 + t.lift, t.z], {}, { rot: [deg(t.yaw), 0, 0] }); th.size[2] = t.depth; th.mat = clone(t.mat); n.things = [...n.things, th].slice(0, 20); return n }
  return w
}
export { FONTS }
