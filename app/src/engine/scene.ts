// The world as plain data. Everything the picture shows is in one of these objects, so a world can
// be saved, shared as a link, undone, randomized and animated by changing numbers.

export type Vec3 = [number, number, number]

export const KINDS = ["sphere", "box", "pyramid", "cylinder", "cone", "torus", "disc", "stone", "blob", "tree", "pine", "crag", "model", "text"] as const
export type Kind = (typeof KINDS)[number]
export const KIND_LABEL: Record<Kind, string> = {
  sphere: "Sphere", box: "Box", pyramid: "Pyramid", cylinder: "Cylinder", cone: "Cone", torus: "Ring",
  disc: "Disc", stone: "Stone", blob: "Blob", tree: "Tree", pine: "Pine", crag: "Floating rock", model: "Imported model", text: "Lettering",
}
export const ROLES = ["solid", "cut", "keep"] as const
export type Role = (typeof ROLES)[number]
export const TEXTURES = ["none", "stone", "marble", "wood", "checker", "stripes", "dots", "clouded", "picture"] as const
export type Texture = (typeof TEXTURES)[number]

export interface Material {
  name: string
  color: string; color2: string
  texture: Texture; texScale: number
  diffuse: number; reflect: number; metal: number; shine: number; gloss: number
  clear: number; ior: number; bump: number; glow: number
  /** a second pattern laid over the first */
  layer?: Texture; layerColor?: string; layerMix?: number
  /** 0 solid; above 0 the shape is made of cloud */
  cloud?: number
}
export interface Thing {
  id: string; name: string; kind: Kind
  pos: Vec3; size: Vec3; rot: Vec3 // rot in degrees: turn, tilt, roll
  round: number; role: Role; group: number
  mat: Material; hidden?: boolean
  bob?: number; spin?: number // used by loops
  text?: TextSpec
  eq?: number // a meter bar: its height follows this band of the music, 0 (lowest) to 15
  beam?: number // for glowing things: 0 lights all around, above 0 is a spotlight this many degrees wide, pointing down its own axis
}
export interface TextSpec {
  str: string; font: string
  style: "solid" | "outline" | "tube"; edge: "round" | "chisel" | "sharp"
  bevel: number; stroke: number // both as a share of the letter height
  bend: number; arch: number // degrees: around a ring, and up into an arch
  motion?: "none" | "rise" | "wave"; order?: number
}
export const textSpec = (str: string, o: Partial<TextSpec> = {}): TextSpec => ({ str, font: "sans", style: "solid", edge: "round", bevel: 0.03, stroke: 0.035, bend: 0, arch: 0, ...o })
export interface Sky {
  zenith: string; horizon: string; haze: string; sunColor: string
  sun: { az: number; el: number }; sunSize: number; sunGlow: number; sunSoft: number
  hazeAmt: number; ambient: number
  fog: number; fogHeight: number; fogColor: string
  cloud: number; streak: number; cloudScale: number; cloudColor: string; seed: number
  cloud2: number; cloud2Color: string
  stars: number
  moon: number; moonAz: number; moonEl: number; moonSize: number; moonPhase: number
  rainbow: number; halo: number
  rays?: number; comet?: number
}
export const SEA_KINDS = ["water", "checker", "lava", "sand", "mirror", "none"] as const
export type SeaKind = (typeof SEA_KINDS)[number]
export interface Sea { kind: SeaKind; c1: string; c2: string; wave: number; grain: number; reflect: number; scale: number }
export interface Land {
  on: boolean; mode: "island" | "range"; height: number; radius: number; freq: number; ridge: number; seed: number
  snow: number; c1: string; c2: string; c3: string
  terrace: number; plateau: number; sharp: number
  channel?: { offset: number; angle: number; width: number; bend: number }
  sculpt?: string // base64 of a 128 x 128 grid of heights, 128 = untouched
  flat?: boolean // no generated land: only what the grid holds (used for land made from a photo)
}
export interface Camera { yaw: number; pitch: number; dist: number; target: Vec3; fov: number; roll: number; lens: number; focus: number; pano?: boolean }
export interface Title { text: string; x: number; z: number; yaw: number; width: number; lift: number; depth: number; mat: Material }
export interface Frame { w: number; h: number; name: string }
export interface World {
  v: 2; name: string
  sky: Sky; sea: Sea; land: Land; things: Thing[]; title?: Title
  cam: Camera; views: (Camera | null)[]
  frame: Frame
  remixOf?: string
  anim?: Anim
  picture?: string // a small picture (data URL) that materials with the "picture" pattern show
  model?: { n: number; data: string } // an imported shape, kept as a grid of distances
  sound?: SoundSet // how this world moves to music
  bloom?: number // bright things spill light around themselves
  customFont?: string // a font file the user brought (data URL); letters set in "My font" use it
}
export type Band = "bass" | "mid" | "high" | "beat"
/** How a world answers music. Every amount runs from 0 (not at all) to 1 (a lot). */
export interface SoundSet {
  pulse: number; pulseTo: Band // things swell
  float: number // things ride up and down
  ripple: number // the water roughens with the bass
  glow: number // lamps, neon and the sun brighten
  twinkle: number // stars flicker with the highs
  breathe: number // haze and clouds move with the middle
  meters: number // meter bars and single letters jump with their own bands
  orbit: number // the camera circles slowly
  kick: number // the camera steps round on each beat
  punch: number // the camera leans in on each beat
  journey: "off" | "sunset" | "candy" | "night" | "surprise" // the sky changes colour as the song goes
  every: number // beats between colour changes
}
export const soundSet = (o: Partial<SoundSet> = {}): SoundSet => ({ pulse: 0.5, pulseTo: "bass", float: 0.4, ripple: 0.5, glow: 0.5, twinkle: 0.5, breathe: 0.3, meters: 0.8, orbit: 0.3, kick: 0, punch: 0.2, journey: "off", every: 16, ...o })
export type Pose = Pick<World, "sky" | "sea" | "land" | "cam" | "things" | "title">
export interface Anim { seconds: number; loop: boolean; ease: boolean; keys: { t: number; pose: Pose }[] }

// ---------- materials (all original) ----------
const M = (name: string, color: string, o: Partial<Material> = {}): Material => ({
  name, color, color2: "#222222", texture: "none", texScale: 1, diffuse: 1, reflect: 0.06, metal: 0, shine: 0.7, gloss: 0.8,
  clear: 0, ior: 1.33, bump: 0, glow: 0, ...o,
})
export const MATERIALS: Material[] = [
  M("Red gloss", "#e2261a", { reflect: 0.08, shine: 1 }),
  M("Chrome", "#eef2f6", { diffuse: 0.06, reflect: 0.9, metal: 0.75, gloss: 1 }),
  M("Gold", "#f5b83a", { diffuse: 0.06, reflect: 0.9, metal: 0.8, gloss: 1 }),
  M("Glass", "#bfe8ff", { diffuse: 0.05, reflect: 0.05, clear: 0.95, shine: 1, gloss: 1 }),
  M("Blue gloss", "#1a48e0", { reflect: 0.08, shine: 1 }),
  M("Black pearl", "#0a0a10", { reflect: 0.12, shine: 1, gloss: 0.95 }),
  M("Stone", "#6a6c74", { color2: "#3b3a40", texture: "stone", reflect: 0, shine: 0.08, gloss: 0.3, bump: 0.5 }),
  M("Bubblegum", "#ff6ab0", { reflect: 0.08, shine: 1 }),
  M("Brushed steel", "#b9c0c8", { diffuse: 0.15, reflect: 0.75, metal: 0.5, gloss: 0.55 }),
  M("Copper", "#e0794a", { diffuse: 0.08, reflect: 0.85, metal: 0.9, gloss: 0.9 }),
  M("Marble", "#f1ece4", { color2: "#57606e", texture: "marble", reflect: 0.12, gloss: 0.9 }),
  M("Walnut", "#8a5a34", { color2: "#3f2412", texture: "wood", reflect: 0.05, gloss: 0.6, texScale: 1.4 }),
  M("Harlequin", "#f4f1e8", { color2: "#16161c", texture: "checker", reflect: 0.15, gloss: 0.95 }),
  M("Candy stripe", "#ffffff", { color2: "#e2261a", texture: "stripes", reflect: 0.1, shine: 1 }),
  M("Ladybird", "#e2261a", { color2: "#0c0c10", texture: "dots", reflect: 0.1, shine: 1 }),
  M("Jade", "#3fae7d", { color2: "#0f4f3c", texture: "clouded", reflect: 0.14, gloss: 0.9 }),
  M("Amber glass", "#ffb040", { diffuse: 0.05, reflect: 0.05, clear: 0.9, ior: 1.5, shine: 1, gloss: 1 }),
  M("Frosted", "#e8f4ff", { diffuse: 0.3, reflect: 0.2, clear: 0.55, gloss: 0.35 }),
  M("Lamp", "#ffe2a8", { diffuse: 0.2, reflect: 0, glow: 2.2, shine: 0 }),
  M("Neon", "#ff3fa0", { diffuse: 0.2, reflect: 0, glow: 1.6, shine: 0 }),
  M("Clay", "#c9b8a4", { reflect: 0, shine: 0.1, gloss: 0.2 }),
  M("Leaf", "#3f7a36", { color2: "#1f4a22", texture: "clouded", texScale: 3, reflect: 0, shine: 0.15, gloss: 0.3, bump: 0.6 }),
]
export const mat = (name: string): Material => ({ ...(MATERIALS.find((m) => m.name === name) ?? MATERIALS[0]) })

// ---------- palettes (all original) ----------
export interface SkyLook { name: string; zenith: string; horizon: string; haze: string; sunColor: string; cloudColor: string; stars?: number; extra?: Partial<Sky> }
type SkyRow = [string, string, string, string, string, string, Partial<Sky>?]
// name, top, horizon, haze, sun, cloud, and any weather that comes with the look
const MORE_SKIES: SkyRow[] = [
  ["Morning", "#3f8fe0", "#ffe9c7", "#fff3dc", "#fff1d0", "#ffffff"],
  ["Noon haze", "#2a6fd6", "#cfe6ff", "#eef6ff", "#ffffff", "#ffffff", { hazeAmt: 0.7 }],
  ["Golden hour", "#3b5bb5", "#ffb45a", "#ffd08a", "#ffd9a0", "#ffd6b0"],
  ["Ember dusk", "#2a1245", "#ff5a2a", "#ff8a4a", "#ffc080", "#7a2a4a"],
  ["Blue hour", "#0b1a4a", "#5a6fd0", "#7a86d8", "#dfe6ff", "#3a4a8a", { stars: 0.5 }],
  ["Moonlit", "#050a24", "#243a7a", "#30488a", "#cfe0ff", "#2a3a6a", { stars: 1.2, moon: 1, ambient: 0.35 }],
  ["Aurora", "#021a1a", "#1fd6a0", "#3fe0b0", "#d0fff0", "#0f5a4a", { stars: 1.3, cloud2: 0.6, cloud2Color: "#5fffd0" }],
  ["Storm", "#2a2f3a", "#7a8088", "#9aa0a8", "#e8e8f0", "#3a3f48", { cloud: 0.85, fog: 0.3 }],
  ["Overcast", "#8a93a0", "#cfd4da", "#e0e3e8", "#ffffff", "#b8bec8", { cloud: 0.9, cloud2: 0.5 }],
  ["Seafoam", "#1fae9a", "#d8fff0", "#eafff6", "#ffffff", "#ffffff"],
  ["Bubblegum", "#ff7ac0", "#ffe0f0", "#fff0f8", "#fff6fa", "#ffffff"],
  ["Cotton candy", "#7ac8ff", "#ffb8e0", "#ffd0ea", "#fff6fa", "#fff0fa"],
  ["Grape", "#3a0f6a", "#c05fe0", "#d88af0", "#ffe0ff", "#8a4ab0"],
  ["Lemon", "#f0d030", "#fff8c0", "#fffbe0", "#ffffff", "#ffffff"],
  ["Tangerine", "#ff7a1a", "#ffd08a", "#ffe0b0", "#fff0d0", "#ffe8c8"],
  ["Rosewater", "#e08aa0", "#ffe6e0", "#fff0ec", "#fff8f0", "#ffffff"],
  ["Mint", "#5fe0b0", "#f0fff0", "#f6fff6", "#ffffff", "#ffffff"],
  ["Vapor", "#ff4fa8", "#4fe0ff", "#9af0ff", "#ffffff", "#ffd0f0"],
  ["Synth", "#1a0540", "#ff2a8a", "#ff6ab0", "#ffd0a0", "#5a1a7a", { stars: 0.6 }],
  ["Toxic", "#0a2a0a", "#a0ff2a", "#c8ff6a", "#f0ffd0", "#2a5a1a"],
  ["Blood moon", "#1a0205", "#8a1a1a", "#a02a20", "#ffb090", "#3a0a0a", { stars: 0.8, moon: 1.2 }],
  ["Sandstorm", "#b08a4a", "#e8c890", "#f0d8a8", "#fff0d0", "#c9a870", { hazeAmt: 0.85, fog: 0.5 }],
  ["Arctic", "#5a8ab0", "#f0f8ff", "#ffffff", "#ffffff", "#ffffff", { halo: 0.8 }],
  ["Monsoon", "#1a3a4a", "#5a8a8a", "#7aa0a0", "#e0f0f0", "#2a4a55", { cloud: 0.8, rainbow: 0.9 }],
  ["Rainbow day", "#1c58c8", "#a8d8f8", "#dcf0fc", "#fff3d6", "#ffffff", { rainbow: 1 }],
  ["Cathedral", "#2a3a6a", "#ffd9a0", "#ffe6c0", "#fff0d0", "#fff0e0", { rays: 1, cloud: 0.6 }],
  ["Comet night", "#02030f", "#101a4a", "#1a2a6a", "#dfe8ff", "#141c40", { stars: 1.6, comet: 1.2 }],
  ["Eclipse", "#05050a", "#3a2a1a", "#5a4020", "#fff0d0", "#1a1410", { stars: 1, halo: 1, sunGlow: 2.5 }],
  ["Nebula", "#0a0220", "#5a1a8a", "#8a2ab0", "#ffd0ff", "#b04ad0", { stars: 1.8, cloud: 0.5, cloud2: 0.5, cloud2Color: "#ff7ad0" }],
  ["Paper", "#e8e2d4", "#f6f1e6", "#fbf8f0", "#ffffff", "#ffffff", { cloud: 0, hazeAmt: 0.2 }],
  ["Ink wash", "#2a2a30", "#c8c8c8", "#dcdcdc", "#ffffff", "#55555c"],
  ["Chrome sky", "#5a6a80", "#e8eef6", "#f4f8fc", "#ffffff", "#ffffff"],
  ["Deep teal", "#022a3a", "#2ab0b0", "#5fd0c8", "#e0fff8", "#0f5a66"],
  ["Coral", "#ff6a5a", "#ffd0b8", "#ffe2d0", "#fff4ea", "#fff0e6"],
  ["Lavender mist", "#8a7ad0", "#e6dcff", "#f2ecff", "#ffffff", "#ffffff", { hazeAmt: 0.75, fog: 0.4 }],
]
export const SKIES: SkyLook[] = [
  { name: "Postcard", zenith: "#1648b8", horizon: "#9fd0f5", haze: "#d8ecfb", sunColor: "#fff3d6", cloudColor: "#ffffff" },
  { name: "Sherbet", zenith: "#00d27a", horizon: "#f58cb8", haze: "#f9a8c6", sunColor: "#fff0e0", cloudColor: "#7f86b0" },
  { name: "Dusk", zenith: "#4a22b0", horizon: "#ff8a4a", haze: "#ffb27a", sunColor: "#ffd9a0", cloudColor: "#b0527a" },
  { name: "Lilac", zenith: "#6b4fd0", horizon: "#f0b8e8", haze: "#f6d6f0", sunColor: "#fff1f6", cloudColor: "#fbe9ff" },
  { name: "Acid", zenith: "#0c6b3a", horizon: "#e8f04a", haze: "#f2f59a", sunColor: "#ffffd0", cloudColor: "#2f8f5a" },
  { name: "Midnight", zenith: "#03051c", horizon: "#1b2f6e", haze: "#28407f", sunColor: "#cfe0ff", cloudColor: "#1a2550", stars: 1.4 },
  { name: "Mars", zenith: "#7a2a1a", horizon: "#f0b070", haze: "#f5c890", sunColor: "#fff0d0", cloudColor: "#c9744a" },
  { name: "Ice", zenith: "#0f6f8f", horizon: "#d8fbff", haze: "#eaffff", sunColor: "#ffffff", cloudColor: "#e8fbff" },
  { name: "Peach", zenith: "#ff7a6a", horizon: "#ffe2a0", haze: "#fff0c8", sunColor: "#fff6e0", cloudColor: "#fff4ea" },
  { name: "Deep space", zenith: "#000004", horizon: "#16062e", haze: "#2a0f4a", sunColor: "#e8e0ff", cloudColor: "#241040", stars: 2 },
  ...MORE_SKIES.map(([name, zenith, horizon, haze, sunColor, cloudColor, extra]) => ({ name, zenith, horizon, haze, sunColor, cloudColor, stars: extra?.stars, extra })),
]
/** Put a look on a sky: its colours, and whatever weather belongs to it. The sun stays where it is. */
export function applySky(sky: Sky, l: SkyLook) {
  Object.assign(sky, { zenith: l.zenith, horizon: l.horizon, haze: l.haze, sunColor: l.sunColor, cloudColor: l.cloudColor, fogColor: l.haze, cloud2Color: "#ffffff",
    stars: l.stars ?? 0, moon: 0, rainbow: 0, halo: 0, rays: 0, comet: 0, cloud2: 0, fog: 0, sunGlow: 1, ambient: 0.5, hazeAmt: Math.min(sky.hazeAmt, 0.6), ...l.extra })
}
export interface SeaLook { name: string; kind: SeaKind; c1: string; c2: string; reflect: number }
export const SEAS: SeaLook[] = [
  { name: "Ocean", kind: "water", c1: "#06257a", c2: "#1f6fd0", reflect: 0 },
  { name: "Teal", kind: "water", c1: "#0a5a5c", c2: "#2fd0b8", reflect: 0 },
  { name: "Lagoon", kind: "water", c1: "#0b3f8a", c2: "#38e0d0", reflect: 0 },
  { name: "Mercury", kind: "water", c1: "#2a2f3a", c2: "#5a6270", reflect: 0.92 },
  { name: "Ink", kind: "water", c1: "#02030a", c2: "#0a1028", reflect: 0.25 },
  { name: "Checker", kind: "checker", c1: "#f2f2f2", c2: "#16161c", reflect: 0.25 },
  { name: "Candy floor", kind: "checker", c1: "#f06aa8", c2: "#fff2d0", reflect: 0.2 },
  { name: "Lava", kind: "lava", c1: "#ff5a10", c2: "#1a0f0c", reflect: 0 },
  { name: "Dunes", kind: "sand", c1: "#e8c890", c2: "#c99a5a", reflect: 0 },
  { name: "Mirror", kind: "mirror", c1: "#20242c", c2: "#8aa0c0", reflect: 0.8 },
  { name: "Open sky", kind: "none", c1: "#000000", c2: "#000000", reflect: 0 },
]
export interface LandLook { name: string; c1: string; c2: string; c3: string; snow: number }
export const LANDS: LandLook[] = [
  { name: "Island", c1: "#e6d3a0", c2: "#5f7a3a", c3: "#6d6258", snow: 0 },
  { name: "Red rock", c1: "#e8b070", c2: "#b8542a", c3: "#6a2f1e", snow: 0 },
  { name: "Slate", c1: "#8a8f88", c2: "#5c625f", c3: "#3c3f44", snow: 0 },
  { name: "Alpine", c1: "#7a8a5a", c2: "#5a5f58", c3: "#777a80", snow: 1 },
  { name: "Alien", c1: "#f0a0d8", c2: "#6a3fb0", c3: "#2a1a5a", snow: 0 },
  { name: "Ember", c1: "#3a2a26", c2: "#2a2020", c3: "#15100f", snow: 0 },
  { name: "Pale rock", c1: "#c9c2b4", c2: "#9a968c", c3: "#77757a", snow: 0 },
]
export const FRAMES: Frame[] = [
  { name: "Classic 640 × 480", w: 640, h: 480 },
  { name: "Standard 1024 × 768", w: 1024, h: 768 },
  { name: "Cover 1200 × 1200", w: 1200, h: 1200 },
  { name: "Wide 1920 × 1080", w: 1920, h: 1080 },
  { name: "Phone 1080 × 1920", w: 1080, h: 1920 },
  { name: "Poster 2400 × 3000", w: 2400, h: 3000 },
  { name: "360° 2048 × 1024", w: 2048, h: 1024 },
]

// ---------- helpers ----------
export function rng(seed: number) {
  let a = seed >>> 0
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
let idn = 0
export const newId = () => `t${Date.now().toString(36)}${(idn++).toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`
export const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x))

export function thing(kind: Kind, pos: Vec3, size: number | Vec3, m: Material, o: Partial<Thing> = {}): Thing {
  const s: Vec3 = typeof size === "number" ? [size, size, size] : size
  return { id: newId(), name: KIND_LABEL[kind], kind, pos, size: s, rot: [0, 0, 0], round: kind === "torus" ? 0.5 : kind === "box" ? 0.04 : Math.random(), role: "solid", group: 0, mat: { ...m }, ...o }
}
export function skyFrom(look: SkyLook, o: Partial<Sky> = {}): Sky {
  return {
    zenith: look.zenith, horizon: look.horizon, haze: look.haze, sunColor: look.sunColor, cloudColor: look.cloudColor,
    sun: { az: -1.1, el: 0.9 }, sunSize: 0.0245, sunGlow: 1, sunSoft: 0.012, hazeAmt: 0.4, ambient: 0.5,
    fog: 0, fogHeight: 1.2, fogColor: look.haze, cloud: 0.5, streak: 0.3, cloudScale: 1, seed: 3, cloud2: 0, cloud2Color: "#ffffff",
    stars: look.stars ?? 0, moon: 0, moonAz: 2.2, moonEl: 0.6, moonSize: 0.06, moonPhase: 0.5, rainbow: 0, halo: 0, ...o,
  }
}
export const seaFrom = (l: SeaLook, o: Partial<Sea> = {}): Sea => ({ kind: l.kind, c1: l.c1, c2: l.c2, reflect: l.reflect, wave: 0.3, grain: 0.05, scale: 1, ...o })
export const landFrom = (l: LandLook, o: Partial<Land> = {}): Land => ({
  on: true, mode: "island", height: 5, radius: 8, freq: 0.22, ridge: 0.8, seed: 1, snow: l.snow, c1: l.c1, c2: l.c2, c3: l.c3, terrace: 0, plateau: 0, sharp: 0, ...o,
})
export const camFrom = (o: Partial<Camera> = {}): Camera => ({ yaw: 0.3, pitch: 0.15, dist: 16, target: [0, 3, 0], fov: 55.5, roll: 0, lens: 0, focus: 16, ...o })
export const titleFrom = (text: string, o: Partial<Title> = {}): Title => ({ text, x: 0, z: 8.5, yaw: -0.09, width: 14, lift: 0.85, depth: 0.5, mat: mat("Chrome"), ...o })

// ---------- arrangements of things ----------
export type Arrangement = "trail" | "cluster" | "monolith" | "floor" | "moon" | "ring" | "stack" | "garden"
export const ARRANGEMENTS: Arrangement[] = ["trail", "cluster", "monolith", "floor", "moon", "ring", "stack", "garden"]
export function arrange(style: Arrangement, count: number, seed: number, m: Material): Thing[] {
  const r = rng(seed), out: Thing[] = []
  const far = (p: Vec3, rad: number, flat = false) => out.every((o) => Math.hypot(o.pos[0] - p[0], flat ? 0 : o.pos[1] - p[1], o.pos[2] - p[2]) > o.size[0] + rad + 0.35)
  if (style === "trail") {
    for (let i = 0; i < count; i++) { const k = Math.pow(0.74, i), rad = 2.3 * k + 0.18
      out.push(thing("sphere", [-5.2 + i * 2.3 + (r() - 0.5) * 0.9, Math.max(rad + 0.5, 6.3 - i * 1.3 + (r() - 0.5) * 0.9) + (i > 3 ? (i - 3) * 0.5 : 0), 3.4 - i * 2.7 - (i > 3 ? (i - 3) * 3 : 0)], rad, m)) }
  } else if (style === "cluster") {
    let tries = 0
    while (out.length < count && tries++ < 400) { const rad = 0.5 + r() * r() * 2.1, a = r() * 6.283, d = r() * 7.5
      const p: Vec3 = [Math.cos(a) * d, rad + 0.3 + r() * 5.5, Math.sin(a) * d]; if (far(p, rad)) out.push(thing("sphere", p, rad, m)) }
  } else if (style === "monolith") {
    if (count > 0) out.push(thing("box", [0, 3.7, 0], [1.0, 3.6, 0.3], m, { rot: [24, 0, 0], name: "Monolith", round: 0.02 }))
    for (let i = 1; i < count; i++) { const a = i * 2.4 + r(), d = 3.2 + r() * 3.5, rad = 0.25 + r() * 0.5; out.push(thing("sphere", [Math.cos(a) * d, 2.2 + r() * 4.2, Math.sin(a) * d], rad, m)) }
  } else if (style === "floor") {
    const kinds: Kind[] = ["sphere", "sphere", "sphere", "pyramid", "box", "cone", "cylinder", "torus"]
    let tries = 0
    while (out.length < count && tries++ < 400) { const kind = kinds[Math.floor(r() * kinds.length)], rad = 0.6 + r() * 1.5, a = r() * 6.283, d = r() * 8
      const p: Vec3 = [Math.cos(a) * d, kind === "sphere" && r() < 0.35 ? rad + 1 + r() * 3 : kind === "torus" ? rad * 0.25 : rad, Math.sin(a) * d]
      if (far(p, rad, true)) out.push(thing(kind, p, rad, m, { rot: [r() * 90, 0, 0] })) }
  } else if (style === "moon") {
    if (count > 0) out.push(thing("sphere", [0, 4.2, 0], 3.2, m, { name: "Moon" }))
    for (let i = 1; i < count; i++) { const a = i * 1.9 + r() * 0.6, d = 5 + r() * 4, rad = 0.3 + r() * 0.7; out.push(thing("sphere", [Math.cos(a) * d, 1 + r() * 7, Math.sin(a) * d], rad, m)) }
  } else if (style === "ring") {
    const n = Math.max(count, 3), R = 5.5
    for (let i = 0; i < n; i++) { const a = (i / n) * 6.283; out.push(thing(i % 2 ? "sphere" : "cone", [Math.cos(a) * R, 3.4 + Math.sin(a * 2) * 0.8, Math.sin(a) * R], 0.75, m)) }
    out.push(thing("torus", [0, 3.4, 0], [3.2, 1.6, 3.2], m, { round: 0.22, rot: [0, 18, 0], name: "Halo" }))
  } else if (style === "stack") {
    let y = 0
    for (let i = 0; i < Math.max(count, 3); i++) { const rad = 1.9 * Math.pow(0.78, i), kind: Kind = (["box", "sphere", "cylinder", "pyramid"] as Kind[])[Math.floor(r() * 4)]
      out.push(thing(kind, [(r() - 0.5) * 0.3, y + rad, (r() - 0.5) * 0.3], rad, m, { rot: [r() * 90, 0, 0] })); y += rad * 2 }
  } else {
    let tries = 0
    while (out.length < Math.max(count, 4) && tries++ < 400) { const a = r() * 6.283, d = 2 + r() * 8, h = 1.2 + r() * 1.6, kind: Kind = r() < 0.5 ? "tree" : r() < 0.6 ? "pine" : "stone"
      const p: Vec3 = [Math.cos(a) * d, kind === "stone" ? h * 0.3 : h, Math.sin(a) * d]
      if (far(p, h * 0.6, true)) out.push(thing(kind, p, kind === "stone" ? h * 0.6 : [h * 0.8, h, h * 0.8], kind === "stone" ? mat("Stone") : mat("Leaf"))) }
  }
  out.forEach((t, i) => (t.name = `${t.name} ${i + 1}`))
  return out
}

// ---------- the starting worlds ----------
export const world = (name: string, sky: Sky, sea: Sea, land: Land, things: Thing[], cam: Camera, o: Partial<World> = {}): World => ({
  v: 2, name, sky, sea, land, things, cam, views: [null, null, null, null, null, null, null], frame: FRAMES[1], ...o,
})
export const off = (o: Partial<Land> = {}) => landFrom(LANDS[0], { on: false, height: 4, ...o })
export const STARTERS: (() => World)[] = [
  () => world("Red Moons", skyFrom(SKIES[0], { sun: { az: -1.1, el: 0.95 }, hazeAmt: 0.42, cloud: 0.5, streak: 0.15, seed: 3.1 }), seaFrom(SEAS[0], { wave: 0.45, grain: 0.08 }), off(),
    arrange("trail", 7, 11, mat("Red gloss")), camFrom({ yaw: 0.3, pitch: 0.19, dist: 15.5, target: [0, 3.1, 0] })),
  () => world("Monolith", skyFrom(SKIES[1], { sun: { az: -2.2, el: 0.75 }, hazeAmt: 0.3, cloud: 0.66, streak: 0.72, seed: 8.4 }), seaFrom(SEAS[1], { wave: 0.25, grain: 0.75 }),
    landFrom(LANDS[6], { height: 1.7, radius: 4.4, freq: 0.9, ridge: 0.9, seed: 4.2 }), arrange("monolith", 1, 5, mat("Stone")), camFrom({ yaw: 0.25, pitch: 0.05, dist: 15, target: [0, 3.6, 0] })),
  () => world("Crag Lagoon", skyFrom(SKIES[0], { sun: { az: 0.9, el: 0.62 }, hazeAmt: 0.5, cloud: 0.4, streak: 0.3, seed: 12.7 }), seaFrom(SEAS[2], { wave: 0.3, grain: 0.05 }),
    landFrom(LANDS[0], { height: 7.5, radius: 12, freq: 0.26, ridge: 1, seed: 7.7 }), [], camFrom({ yaw: -0.5, pitch: 0.13, dist: 23, target: [0, 2.6, 0] })),
  () => world("Checker Dream", skyFrom(SKIES[2], { sun: { az: -2.6, el: 0.4 }, hazeAmt: 0.4, cloud: 0.55, streak: 0.6, seed: 1.3 }), seaFrom(SEAS[5], { grain: 0 }), off(),
    arrange("floor", 7, 21, mat("Chrome")), camFrom({ yaw: 0.6, pitch: 0.13, dist: 15, target: [0, 2.6, 0] })),
  () => world("Chrome Moon", skyFrom(SKIES[3], { sun: { az: 0.9, el: 0.55 }, hazeAmt: 0.35, cloud: 0.62, streak: 0.55, seed: 5.5 }), seaFrom(SEAS[3], { wave: 0.18, grain: 0 }), off(),
    arrange("moon", 7, 8, mat("Chrome")), camFrom({ yaw: -0.2, pitch: 0.07, dist: 17, target: [0, 3.9, 0] })),
  () => world("Lava Teeth", skyFrom(SKIES[6], { sun: { az: -0.6, el: 0.42 }, hazeAmt: 0.6, cloud: 0.35, streak: 0.5, seed: 2.2 }), seaFrom(SEAS[7], { grain: 0 }),
    landFrom(LANDS[5], { mode: "range", height: 9, radius: 9, freq: 0.2, ridge: 1, seed: 3.3 }), arrange("cluster", 3, 14, mat("Black pearl")), camFrom({ yaw: 1.1, pitch: 0.12, dist: 22, target: [0, 3, 0] })),
  () => {
    const g = mat("Gold"), cut = thing("sphere", [0.9, 3.9, 1.1], 1.7, mat("Red gloss"), { role: "cut", group: 1, name: "Bite" })
    return world("Carved Sun", skyFrom(SKIES[8], { sun: { az: -0.7, el: 0.5 }, hazeAmt: 0.5, cloud: 0.3, streak: 0.8, seed: 6.1, halo: 0.8 }), seaFrom(SEAS[9]), off(),
      [thing("box", [0, 3, 0], 2.2, g, { group: 1, rot: [32, 0, 0], name: "Block" }), cut, thing("torus", [0, 3, 0], [4.4, 1.6, 4.4], mat("Chrome"), { round: 0.12, rot: [0, 72, 12], name: "Orbit" }),
        thing("sphere", [-4.6, 1.1, 2.6], 1.1, mat("Glass"), { name: "Lens" })], camFrom({ yaw: 0.55, pitch: 0.12, dist: 15, target: [0, 2.8, 0] }))
  },
  () => world("Night Garden", skyFrom(SKIES[5], { sun: { az: 2.6, el: 0.35 }, hazeAmt: 0.35, cloud: 0.2, streak: 0.4, seed: 4.4, moon: 1, moonAz: 0.5, moonEl: 0.45, moonSize: 0.075, moonPhase: 0.42, fog: 0.5, fogColor: "#3a4f9a", ambient: 0.35 }),
    seaFrom(SEAS[4], { wave: 0.2 }), landFrom(LANDS[2], { height: 2.2, radius: 11, freq: 0.3, ridge: 0.4, seed: 2.2, plateau: 0.5 }),
    [...arrange("garden", 7, 31, mat("Leaf")).map((t) => ({ ...t, pos: [t.pos[0] * 0.6, t.pos[1] + 1.1, t.pos[2] * 0.6] as Vec3 })),
      thing("sphere", [1.5, 4.6, 0.5], 0.55, mat("Lamp"), { name: "Lantern" }), thing("sphere", [-3.5, 3.4, 2.5], 0.3, mat("Neon"), { name: "Firefly" })],
    camFrom({ yaw: 0.4, pitch: 0.14, dist: 20, target: [0, 3, 0] })),
]
export const blankWorld = (): World => world("Untitled world", skyFrom(SKIES[0]), seaFrom(SEAS[0]), off(), [], camFrom())

// ---------- roll the dice ----------
export type LockKey = "sky" | "sea" | "land" | "things" | "camera"
export function roll(w: World, locks: Set<LockKey>, only?: LockKey): World {
  const r = Math.random, pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)]
  const out = clone(w); const does = (k: LockKey) => (only ? only === k : !locks.has(k))
  if (does("sky")) {
    const look = pick(SKIES)
    out.sky = skyFrom(look, { ...look.extra, sun: { az: r() * 6.283 - 3.14, el: 0.12 + r() * 1.05 }, hazeAmt: 0.2 + r() * 0.6, cloud: r() * 0.8, streak: r(), seed: r() * 40, cloudScale: 0.7 + r() * 0.8,
      cloud2: r() < 0.35 ? 0.3 + r() * 0.5 : 0, moon: look.stars || r() < 0.15 ? 1 : 0, moonAz: r() * 6.28, moonEl: 0.25 + r() * 0.7, moonPhase: 0.2 + r() * 0.6, moonSize: 0.04 + r() * 0.07,
      fog: r() < 0.25 ? 0.3 + r() * 0.6 : 0, halo: r() < 0.15 ? 0.8 : 0, rainbow: r() < 0.12 ? 0.9 : 0 })
  }
  if (does("sea")) out.sea = seaFrom(pick(SEAS.filter((s) => s.kind !== "none" || r() < 0.3)), { wave: 0.1 + r() * 0.6, grain: r() < 0.3 ? r() : r() * 0.12, scale: 0.6 + r() * 1.2 })
  if (does("land")) {
    const on = r() < 0.55
    out.land = landFrom(pick(LANDS), { on, mode: r() < 0.2 ? "range" : "island", height: 2 + r() * 7, radius: 5 + r() * 8, freq: 0.18 + r() * 0.3, ridge: 0.4 + r() * 0.6, seed: r() * 50,
      terrace: r() < 0.2 ? 0.5 + r() * 0.5 : 0, plateau: r() < 0.2 ? r() * 0.7 : 0, sharp: r() < 0.25 ? r() : 0 })
  }
  if (does("things")) {
    const style = pick(ARRANGEMENTS.filter((a) => a !== "garden" || out.land.on)), m = pick(MATERIALS.filter((x) => x.glow === 0 && x.name !== "Leaf"))
    out.things = arrange(style, 2 + Math.floor(r() * 7), Math.floor(r() * 9999), { ...m })
    if (r() < 0.4) { const m2 = pick(MATERIALS.filter((x) => x.glow === 0)); out.things.forEach((t, i) => { if (i % 2) t.mat = { ...m2 } }) }
    if (out.land.on && out.land.mode === "island") out.things.forEach((t) => (t.pos[1] += out.land.height * 0.55))
  }
  if (does("camera")) out.cam = { ...out.cam, yaw: r() * 6.283, pitch: 0.04 + r() * 0.3, dist: 13 + r() * 10, target: [0, 2.5 + r() * 1.5, 0] }
  if (!only) out.name = rollName()
  return out
}
const N1 = ["Slow", "Glass", "Chrome", "Soft", "Hollow", "Velvet", "Second", "Quiet", "Lunar", "Tidal", "Pale", "Neon", "Salt", "Amber", "Distant", "Paper"]
const N2 = ["Orbit", "Tide", "Garden", "Signal", "Harbour", "Weather", "Meridian", "Lagoon", "Monument", "Horizon", "Engine", "Archive", "Summer", "Static", "Atlas", "Mirage"]
export const rollName = () => `${N1[Math.floor(Math.random() * N1.length)]} ${N2[Math.floor(Math.random() * N2.length)]}`

// ---------- a world as a link ----------
const b64 = (u: Uint8Array) => { let s = ""; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") }
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0))
async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const w = stream.writable.getWriter(); void w.write(data as BufferSource); void w.close()
  return new Uint8Array(await new Response(stream.readable).arrayBuffer())
}
export async function encodeWorld(w: World, full = false): Promise<string> {
  const lean = clone(w); if (!full) { delete lean.model; delete lean.picture; delete lean.customFont; lean.things = lean.things.filter((t) => t.kind !== "model") } lean.things.forEach((t) => { t.pos = t.pos.map(r3) as Vec3; t.size = t.size.map(r3) as Vec3 })
  return "w2." + b64(await pipe(new TextEncoder().encode(JSON.stringify(lean)), new CompressionStream("deflate-raw")))
}
export async function decodeWorld(code: string): Promise<World | null> {
  try {
    if (!code.startsWith("w2.")) return null
    const w = JSON.parse(new TextDecoder().decode(await pipe(unb64(code.slice(3)), new DecompressionStream("deflate-raw")))) as World
    return w && w.v === 2 && w.sky && w.sea && w.land && Array.isArray(w.things) ? w : null
  } catch { return null }
}
const r3 = (n: number) => Math.round(n * 1000) / 1000
