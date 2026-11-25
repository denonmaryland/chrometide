// The worlds you can start from. All original.
import { makeRelief } from "./relief-world"
import { tidyWorld } from "./scene"
import galleryStudy from "./studies/ribs.json"
import lunarStudy from "./studies/lunar.json"
import mineralStudy from "./studies/mineral.json"
import { textAspect } from "./lettering"

/** A colour along the rainbow: low notes warm, high notes cool. */
const hue = (k: number) => { const h = 330 - k * 190, f = (n: number) => { const a = (n + h / 30) % 12; return Math.round(255 * (0.58 - 0.42 * Math.max(-1, Math.min(a - 3, 9 - a, 1)))).toString(16).padStart(2, "0") }; return `#${f(0)}${f(8)}${f(4)}` }
import {
  type Material, type Sea, type Sky, type Land, type TextSpec, type Thing, type Vec3, type World,
  LANDS, SEAS, SKIES, STARTERS, arrange, camFrom, landFrom, mat, off, seaFrom, skyFrom, soundSet, textSpec, thing, world,
} from "./scene"

const sky = (name: string, o: Partial<Sky> = {}) => { const l = SKIES.find((x) => x.name === name) ?? SKIES[0]; return skyFrom(l, { ...l.extra, ...o }) }
const sea = (name: string, o: Partial<Sea> = {}) => seaFrom(SEAS.find((x) => x.name === name) ?? SEAS[0], o)
const land = (name: string, o: Partial<Land> = {}) => landFrom(LANDS.find((x) => x.name === name) ?? LANDS[0], o)
const m = (name: string, o: Partial<Material> = {}): Material => ({ ...mat(name), ...o })
const word = (str: string, height: number, pos: Vec3, spec: Partial<TextSpec>, more: Partial<Thing> = {}): Thing => {
  const t = textSpec(str, spec), h = height / 2
  return thing("text", pos, [h * textAspect(str, t.font), h, Math.max(0.08, height * 0.14)], mat("Chrome"), { name: str, round: 0, text: t, ...more })
}
const lift = (ts: Thing[], y: number) => ts.map((t) => ({ ...t, pos: [t.pos[0], t.pos[1] + y, t.pos[2]] as Vec3 }))
const alt = (ts: Thing[], second: Material) => ts.map((t, i) => (i % 2 ? { ...t, mat: { ...second } } : t))

export interface Starter { name: string; group: string; make: () => World }
const CLASSIC = ["Red Moons", "Monolith", "Crag Lagoon", "Checker Dream", "Chrome Moon", "Lava Teeth", "Carved Sun", "Night Garden"]
const S = (group: string, name: string, make: () => World): Starter => ({ name, group, make })

export const WORLDS: Starter[] = [
  ...STARTERS.map((make, i) => S("Classics", CLASSIC[i], make)),

  // ---------- shapes over water ----------
  S("Shapes", "Glass Orchard", () => world("Glass Orchard", sky("Morning", { sun: { az: -0.8, el: 0.7 }, cloud: 0.35 }), sea("Teal", { wave: 0.25 }), off(),
    alt(arrange("cluster", 7, 44, m("Glass")), m("Amber glass")), camFrom({ yaw: 0.4, pitch: 0.12, dist: 12.5, target: [0, 3.2, 0] }))),
  S("Shapes", "Gold Stack", () => world("Gold Stack", sky("Golden hour", { sun: { az: -2.3, el: 0.3 }, cloud: 0.45, streak: 0.7 }), sea("Mirror"), off(),
    arrange("stack", 5, 7, m("Gold")), camFrom({ yaw: 0.5, pitch: 0.1, dist: 30, target: [0, 6.5, 0] }))),
  S("Shapes", "Halo Ring", () => world("Halo Ring", sky("Lilac", { sun: { az: 0.6, el: 0.6 }, cloud: 0.5, streak: 0.5 }), sea("Mercury", { wave: 0.15 }), off(),
    arrange("ring", 8, 3, m("Chrome")), camFrom({ yaw: 0.3, pitch: 0.2, dist: 13.5, target: [0, 3.2, 0] }))),
  S("Shapes", "Marble Hall", () => world("Marble Hall", sky("Rosewater", { sun: { az: -1.2, el: 0.55 }, cloud: 0.3, streak: 0.8 }), sea("Candy floor", { c1: "#f4e6e0", c2: "#c98a96", reflect: 0.35 }), off(),
    [...[-6, -3, 3, 6].map((x, i) => thing("cylinder", [x, 3, -1], [0.55, 3, 0.55], m("Marble"), { name: `Column ${i + 1}` })), thing("box", [0, 6.25, -1], [7, 0.25, 0.9], m("Marble"), { name: "Lintel" }),
      thing("sphere", [0, 2.6, 2.2], 1.3, m("Gold"), { name: "Orb" })], camFrom({ yaw: 0.25, pitch: 0.1, dist: 19, target: [0, 3.2, 0] }))),
  S("Shapes", "Monolith Row", () => world("Monolith Row", sky("Ember dusk", { sun: { az: 2.9, el: 0.16 }, cloud: 0.4, streak: 0.9 }), sea("Mirror", { reflect: 0.9 }), off(),
    [0, 1, 2, 3, 4].map((i) => thing("box", [-7 + i * 3.4, 4.2 - i * 0.55, -i * 1.6], [0.9, 4.2 - i * 0.55, 0.28], m("Black pearl"), { name: `Slab ${i + 1}`, round: 0.02 })),
    camFrom({ yaw: 0.2, pitch: 0.07, dist: 22, target: [0, 3.5, 0] }))),
  S("Shapes", "Carved Moon", () => world("Carved Moon", sky("Blue hour", { sun: { az: -1, el: 0.5 }, cloud: 0.35, ambient: 0.7, stars: 1 }), sea("Mercury", { wave: 0.1 }), off(),
    [thing("sphere", [0, 4.4, 0], 3.3, m("Chrome"), { group: 1, name: "Moon" }), thing("sphere", [2.2, 5.6, 2.2], 2, m("Gold"), { group: 1, role: "cut", name: "Bite" }),
      thing("sphere", [-2.6, 2.6, 2.4], 1.4, m("Gold"), { group: 1, role: "cut", name: "Second bite" }), thing("sphere", [5.6, 1.4, 3], 0.8, m("Gold"), { name: "Crumb" })],
    camFrom({ yaw: 0.45, pitch: 0.1, dist: 17, target: [0, 3.8, 0] }))),
  S("Shapes", "Harlequin", () => world("Harlequin", sky("Grape", { sun: { az: -2.4, el: 0.5 }, cloud: 0.45, streak: 0.6 }), sea("Checker", { reflect: 0.4 }), off(),
    alt(arrange("floor", 8, 61, m("Harlequin")), m("Candy stripe")), camFrom({ yaw: 0.7, pitch: 0.14, dist: 16, target: [0, 2.4, 0] }))),
  S("Shapes", "Paper World", () => world("Paper World", sky("Paper", { sun: { az: -0.9, el: 0.8 }, sunSoft: 0.05 }), sea("Dunes", { c1: "#f2efe6", c2: "#dcd6c8", wave: 0.15, grain: 0 }), off(),
    arrange("floor", 8, 17, m("Clay", { color: "#f4f1ea" })), camFrom({ yaw: 0.5, pitch: 0.2, dist: 16, target: [0, 2, 0] }))),
  S("Shapes", "Bubble Bath", () => world("Bubble Bath", sky("Bubblegum", { sun: { az: 0.7, el: 0.8 }, cloud: 0.4 }), sea("Candy floor", { reflect: 0.3 }), off(),
    [...[[0, 2.2, 0, 2], [2.4, 3.2, 0.6, 1.5], [-2.2, 3.4, 0.8, 1.6], [0.6, 4.8, -0.4, 1.4], [-1, 1.4, 2.2, 1.1], [3.4, 1.3, 2, 1]].map(([x, y, z, r], i) => thing("blob", [x, y, z], r, m("Bubblegum"), { group: 1, name: `Bubble ${i + 1}` })),
      thing("sphere", [-5, 4, 1], 1.1, m("Glass"), { name: "Stray" }), thing("sphere", [5.2, 5.4, -1], 0.7, m("Glass"), { name: "Stray 2" })], camFrom({ yaw: 0.35, pitch: 0.16, dist: 16, target: [0, 3, 0] }))),

  // ---------- islands and land ----------
  S("Islands", "Terraces", () => world("Terraces", sky("Mint", { sun: { az: 1.1, el: 0.6 }, cloud: 0.35 }), sea("Lagoon"), land("Island", { height: 6.5, radius: 11, freq: 0.24, ridge: 0.5, seed: 12, terrace: 1 }),
    [], camFrom({ yaw: -0.4, pitch: 0.2, dist: 24, target: [0, 2.6, 0] }))),
  S("Islands", "Atoll", () => world("Atoll", sky("Seafoam", { sun: { az: 0.5, el: 0.9 }, cloud: 0.3 }), sea("Lagoon", { wave: 0.2 }),
    land("Island", { height: 2.4, radius: 13, freq: 0.3, ridge: 0.3, seed: 21, plateau: 0.55, channel: { offset: 0.05, angle: 30, width: 0.2, bend: 0.5 } }),
    lift(arrange("garden", 6, 77, m("Leaf")), 0.6), camFrom({ yaw: 0.6, pitch: 0.36, dist: 26, target: [0, 1.5, 0] }))),
  S("Islands", "Ice Shelf", () => world("Ice Shelf", sky("Arctic", { sun: { az: -0.7, el: 0.35 }, cloud: 0.25, streak: 0.9 }), sea("Teal", { c1: "#0a3a5a", c2: "#7fd8e8", reflect: 0.3, wave: 0.18 }),
    land("Alpine", { height: 4.2, radius: 12, freq: 0.2, ridge: 0.6, seed: 5.5, plateau: 0.7, terrace: 0.35, c1: "#dfeef6", c2: "#c8dcea", c3: "#9ab4c8", snow: 1 }),
    [thing("box", [7.5, 1.1, 6], [1.6, 1.3, 1.2], m("Frosted"), { rot: [24, 8, 0], name: "Berg" })], camFrom({ yaw: 0.5, pitch: 0.13, dist: 25, target: [0, 2.2, 0] }))),
  S("Islands", "Red Canyon", () => world("Red Canyon", sky("Mars", { sun: { az: -0.9, el: 0.38 }, cloud: 0.3, hazeAmt: 0.55 }), sea("Dunes", { c1: "#e0a060", c2: "#b86a3a", wave: 0.5 }),
    land("Red rock", { mode: "range", height: 9, radius: 7, freq: 0.24, ridge: 0.9, seed: 8.8, sharp: 0.5, terrace: 0.4 }), [thing("sphere", [0, 3.4, 0], 1.6, m("Copper"), { name: "Sun stone" })],
    camFrom({ yaw: 0.9, pitch: 0.12, dist: 21, target: [0, 3, 0] }))),
  S("Islands", "Mountain Ring", () => world("Mountain Ring", sky("Blue hour", { sun: { az: 2.4, el: 0.25 }, cloud: 0.3 }), sea("Ink", { reflect: 0.45, wave: 0.15 }),
    land("Slate", { mode: "range", height: 11, radius: 8, freq: 0.2, ridge: 1, seed: 14, snow: 0.8 }), [thing("sphere", [0, 4.5, 0], 2.6, m("Chrome"), { name: "Moon" })],
    camFrom({ yaw: -0.3, pitch: 0.1, dist: 20, target: [0, 4, 0] }))),
  S("Islands", "Rainbow Falls", () => world("Rainbow Falls", sky("Rainbow day", { sun: { az: 3.0, el: 0.55 }, cloud: 0.45 }), sea("Lagoon"), land("Island", { height: 9, radius: 10, freq: 0.22, ridge: 0.9, seed: 31, sharp: 0.3 }),
    [], camFrom({ yaw: 0.2, pitch: 0.12, dist: 25, target: [0, 3.6, 0] }))),
  S("Islands", "Floating Isles", () => world("Floating Isles", sky("Cotton candy", { sun: { az: -1, el: 0.7 }, cloud: 0.55 }), sea("Open sky"), off(),
    [thing("crag", [0, 3.4, 0], [4.2, 3, 4.2], m("Stone", { color: "#7a8a5a", color2: "#4a3f38" }), { name: "Big isle", round: 0.2 }), thing("crag", [-7.5, 5.4, -3], [2.4, 1.8, 2.4], m("Stone", { color: "#7a8a5a", color2: "#4a3f38" }), { name: "Small isle", round: 0.6 }),
      thing("crag", [6.8, 1.6, 2.5], [2, 1.6, 2], m("Stone", { color: "#7a8a5a", color2: "#4a3f38" }), { name: "Low isle", round: 0.9 }), thing("tree", [0.6, 6.6, 0.4], [1.2, 1.6, 1.2], m("Leaf"), { name: "Tree" }),
      thing("pine", [-1.6, 6.1, 1], [0.9, 1.3, 0.9], m("Leaf"), { name: "Pine" }), thing("tree", [-7.4, 7.2, -3], [0.8, 1.1, 0.8], m("Leaf"), { name: "Small tree" })],
    camFrom({ yaw: 0.35, pitch: 0.08, dist: 22, target: [0, 4, 0] }))),
  S("Islands", "Jade Garden", () => world("Jade Garden", sky("Mint", { sun: { az: -1.6, el: 0.75 }, cloud: 0.4, fog: 0.3 }), sea("Teal", { wave: 0.18 }), land("Island", { height: 2, radius: 12, freq: 0.3, ridge: 0.2, seed: 9, plateau: 0.4 }),
    [...lift(arrange("garden", 7, 13, m("Leaf")), 0.9), thing("stone", [1.5, 2.2, 3], 1.1, m("Jade"), { name: "Jade stone" }), thing("sphere", [-2, 4.6, 0], 0.9, m("Jade"), { name: "Jade orb" })],
    camFrom({ yaw: 0.5, pitch: 0.2, dist: 22, target: [0, 2, 0] }))),
  S("Islands", "Pyramid Dunes", () => world("Pyramid Dunes", sky("Tangerine", { sun: { az: -2.2, el: 0.3 }, cloud: 0.2, hazeAmt: 0.6 }), sea("Dunes", { wave: 0.6 }), off(),
    [thing("pyramid", [0, 3.5, 0], [4.2, 3.5, 4.2], m("Clay", { color: "#d8b070" }), { name: "Great pyramid", rot: [30, 0, 0] }), thing("pyramid", [7, 2.2, -4], [2.6, 2.2, 2.6], m("Clay", { color: "#d8b070" }), { name: "Second", rot: [30, 0, 0] }),
      thing("pyramid", [-6.5, 1.4, 3], [1.7, 1.4, 1.7], m("Gold"), { name: "Gold cap", rot: [30, 0, 0] })], camFrom({ yaw: 0.55, pitch: 0.09, dist: 21, target: [0, 2.8, 0] }))),
  S("Islands", "Toxic Shore", () => world("Toxic Shore", sky("Toxic", { sun: { az: 0.8, el: 0.4 }, cloud: 0.45, fog: 0.35 }), sea("Teal", { c1: "#0a3a0a", c2: "#7aff2a", wave: 0.3 }),
    land("Alien", { mode: "range", height: 7, radius: 8, freq: 0.26, ridge: 1, seed: 19, c1: "#2a3a1a", c2: "#1a2a14", c3: "#0c140a" }), [thing("sphere", [0, 2.4, 0], 1.2, m("Neon", { color: "#b0ff3a" }), { name: "Glow" })],
    camFrom({ yaw: 1.3, pitch: 0.12, dist: 20, target: [0, 2.6, 0] }))),

  // ---------- night ----------
  S("Night", "Lantern Lake", () => world("Lantern Lake", sky("Moonlit", { sun: { az: 2.2, el: 0.3 }, moonAz: 0.4, moonEl: 0.5, moonSize: 0.07, cloud: 0.2 }), sea("Ink", { reflect: 0.5, wave: 0.12 }), off(),
    [[-4, 2.2, 1], [0, 3.6, -1], [3.6, 1.8, 2], [6.5, 4.4, -3], [-7, 4.8, -2]].map(([x, y, z], i) => thing("sphere", [x, y, z], 0.55, m("Lamp"), { name: `Lantern ${i + 1}`, bob: 0.25 })),
    camFrom({ yaw: 0.3, pitch: 0.12, dist: 18, target: [0, 2.6, 0] }))),
  S("Night", "Aurora Bay", () => world("Aurora Bay", sky("Aurora", { sun: { az: 2.6, el: 0.2 }, cloud: 0.15, ambient: 0.4 }), sea("Ink", { reflect: 0.6, wave: 0.1 }), land("Slate", { height: 2.6, radius: 10, freq: 0.3, ridge: 0.6, seed: 3, snow: 0.6 }),
    lift(arrange("garden", 5, 5, m("Leaf")).map((t) => ({ ...t, kind: "pine" as const })), 1), camFrom({ yaw: -0.5, pitch: 0.1, dist: 22, target: [0, 3, 0] }))),
  S("Night", "Comet Watch", () => world("Comet Watch", sky("Comet night", { sun: { az: 2.8, el: 0.3 }, cloud: 0.1 }), sea("Mirror", { reflect: 0.9 }), off(),
    [thing("torus", [0, 3.6, 0], [3.6, 1.6, 3.6], m("Chrome"), { round: 0.14, rot: [20, 68, 0], name: "Dish" }), thing("sphere", [0, 3.6, 0], 1.1, m("Lamp", { color: "#bcd6ff", glow: 1.4 }), { name: "Eye" })],
    camFrom({ yaw: 0.2, pitch: 0.08, dist: 17, target: [0, 4.2, 0] }))),
  S("Night", "Blood Moon", () => world("Blood Moon", sky("Blood moon", { sun: { az: 2.5, el: 0.3 }, moonAz: 0.2, moonEl: 0.4, moonSize: 0.11, moonPhase: 0.5, cloud: 0.3 }), sea("Lava"),
    land("Ember", { mode: "range", height: 8, radius: 9, freq: 0.22, ridge: 1, seed: 6.1 }), arrange("cluster", 4, 9, m("Black pearl")), camFrom({ yaw: 0.2, pitch: 0.1, dist: 22, target: [0, 3.4, 0] }))),
  S("Night", "Eclipse", () => world("Eclipse", sky("Eclipse", { sun: { az: 3.34, el: 0.36 }, cloud: 0.1, sunSize: 0.05 }), sea("Mirror", { reflect: 0.85 }), off(),
    [thing("sphere", [0, 4.4, 0], 2.7, m("Black pearl"), { name: "Dark moon" }), thing("torus", [0, 4.4, 0], [4.6, 1, 4.6], m("Gold"), { round: 0.06, rot: [0, 78, 8], name: "Ring" })],
    camFrom({ yaw: 0.2, pitch: 0.06, dist: 19, target: [0, 4.4, 0] }))),
  S("Night", "Spotlight Stage", () => world("Spotlight Stage", sky("Midnight", { sun: { az: 2.4, el: 0.12 }, cloud: 0.1, ambient: 0.22 }), sea("Checker", { reflect: 0.35 }), off(),
    [thing("sphere", [-1.8, 1.6, 0], 1.6, m("Chrome"), { name: "Star" }), thing("box", [2.4, 1.2, 0.6], 1.2, m("Gold"), { rot: [28, 0, 0], name: "Prop" }),
      thing("cone", [-3, 7.5, 2], 0.45, m("Lamp", { glow: 3.2 }), { beam: 46, rot: [0, -14, -12], name: "Warm spot" }), thing("cone", [4, 7.5, 2.5], 0.45, m("Lamp", { color: "#9ad0ff", glow: 3.2 }), { beam: 46, rot: [0, -12, 16], name: "Cool spot" })],
    camFrom({ yaw: 0.3, pitch: 0.16, dist: 15, target: [0, 2.4, 0] }))),
  S("Night", "Nebula Drift", () => world("Nebula Drift", sky("Nebula", { sun: { az: -0.6, el: 0.5 } }), sea("Open sky"), off(),
    alt(arrange("cluster", 8, 23, m("Chrome")), m("Glass")), camFrom({ yaw: 0.6, pitch: 0.05, dist: 18, target: [0, 3.4, 0] }))),

  // ---------- words and light ----------
  S("Words & light", "Neon Harbour", () => world("Neon Harbour", sky("Synth", { sun: { az: 2.9, el: 0.14 }, cloud: 0.25, streak: 0.9, ambient: 0.3 }), sea("Ink", { reflect: 0.6, wave: 0.14 }), off(),
    [word("OPEN LATE", 2.6, [0, 2.4, 7], { font: "script", style: "tube", stroke: 0.028 }, { mat: m("Neon", { glow: 2.6 }) }), ...arrange("cluster", 3, 5, m("Black pearl")).map((t) => ({ ...t, pos: [t.pos[0] * 1.6, t.pos[1] + 2.5, t.pos[2] - 4] as Vec3 }))],
    camFrom({ yaw: 0.12, pitch: 0.1, dist: 17, target: [0, 3, 0] }), { bloom: 0.6 })),
  S("Words & light", "Low Tide", () => world("Low Tide", sky("Dusk", { sun: { az: 2.7, el: 0.2 }, cloud: 0.45, streak: 0.6 }), sea("Mercury", { wave: 0.08 }), land("Island", { height: 6, radius: 9, freq: 0.26, ridge: 1, seed: 7.7 }),
    [word("LOW TIDE", 3, [0, 1.8, 10.5], { font: "poster" })], camFrom({ yaw: 0.1, pitch: 0.12, dist: 24, target: [0, 2.8, 0] }))),
  S("Words & light", "Orbit Words", () => world("Orbit Words", sky("Lilac", { sun: { az: 0.9, el: 0.55 }, cloud: 0.55, streak: 0.5 }), sea("Mercury", { wave: 0.16 }), off(),
    [thing("sphere", [0, 4, 0], 3, m("Chrome"), { name: "Moon" }), word("SLOW ORBIT · SLOW ORBIT · ", 2.2, [0, 4, 0], { bend: -360 }, { spin: 1 })], camFrom({ yaw: 0.2, pitch: 0.14, dist: 18, target: [0, 3.6, 0] }))),
  S("Words & light", "Gold Record", () => world("Gold Record", sky("Golden hour", { sun: { az: -2.5, el: 0.35 }, cloud: 0.4 }), sea("Checker", { c1: "#f6efe0", c2: "#3a2a1a", reflect: 0.3 }), off(),
    [thing("box", [0, 2.6, 0], [5.4, 2.6, 0.55], m("Gold"), { group: 1, name: "Slab", round: 0.03 }), word("GOLD", 3.6, [0, 2.6, 0], { font: "poster", edge: "sharp" }, { group: 1, role: "cut", mat: m("Red gloss"), size: [3.6 * 0.5 * 2.1, 1.8, 0.9] })],
    camFrom({ yaw: 0.35, pitch: 0.12, dist: 15, target: [0, 2.6, 0] }))),
  S("Words & light", "Cathedral Light", () => world("Cathedral Light", sky("Cathedral", { sun: { az: 3.0, el: 0.42 }, cloud: 0.55 }), sea("Ocean", { wave: 0.3 }), off(),
    [-5.4, -1.8, 1.8, 5.4].map((x, i) => thing("box", [x, 4.6, 0], [0.7, 4.6, 0.7], m("Stone"), { name: `Pillar ${i + 1}`, round: 0.02 })), camFrom({ yaw: 0.15, pitch: 0.09, dist: 21, target: [0, 4, 0] }))),

  // ---------- strange ----------
  S("Strange", "Cloud Factory", () => world("Cloud Factory", sky("Postcard", { sun: { az: -0.9, el: 0.8 }, cloud: 0.15 }), sea("Ocean", { wave: 0.35 }), off(),
    [thing("cylinder", [0, 2.2, 0], [1, 2.2, 1], m("Stone"), { name: "Chimney" }), ...[[0.3, 5.6, 0, 1.5], [1.6, 7.4, 0.4, 2], [3.6, 8.8, 0, 2.4], [6.4, 9.6, -0.4, 2.8]].map(([x, y, z, r], i) =>
      thing("sphere", [x, y, z], [r * 1.2, r * 0.8, r], m("Clay", { color: "#ffffff", cloud: 0.85, reflect: 0 }), { name: `Puff ${i + 1}` }))], camFrom({ yaw: 0.25, pitch: 0.08, dist: 21, target: [2, 5, 0] }))),
  S("Strange", "Vapor Grid", () => world("Vapor Grid", sky("Vapor", { sun: { az: 3.14, el: 0.16 }, cloud: 0.15, sunSize: 0.11, sunGlow: 1.6 }), sea("Checker", { c1: "#ff4fa8", c2: "#1a0540", scale: 0.7, reflect: 0.5 }), off(),
    [thing("pyramid", [-3, 2, 0], [2, 2, 2], m("Chrome"), { rot: [30, 0, 0], name: "Pyramid" }), thing("torus", [3.4, 2.8, -1], [2.2, 1, 2.2], m("Chrome"), { round: 0.2, rot: [0, 90, 0], name: "Hoop" }), thing("sphere", [0.4, 1.1, 3], 1.1, m("Glass"), { name: "Bubble" })],
    camFrom({ yaw: 0, pitch: 0.1, dist: 16, target: [0, 2.6, 0] }))),
  S("Strange", "Storm Buoy", () => world("Storm Buoy", sky("Storm", { sun: { az: 1.2, el: 0.5 }, hazeAmt: 0.7 }), sea("Ocean", { c1: "#0a1a2a", c2: "#3a5a6a", wave: 1.1, grain: 0.2 }), off(),
    [thing("sphere", [0, 1.1, 0], 1.3, m("Red gloss"), { name: "Buoy", bob: 0.35 }), thing("cylinder", [0, 2.9, 0], [0.12, 0.7, 0.12], m("Brushed steel"), { name: "Mast", bob: 0.35 }), thing("sphere", [0, 3.8, 0], 0.28, m("Lamp", { glow: 3 }), { name: "Light", bob: 0.35 })],
    camFrom({ yaw: 0.5, pitch: 0.07, dist: 13, target: [0, 1.8, 0] }))),
  S("Strange", "Sunken Letters", () => world("Sunken Letters", sky("Deep teal", { sun: { az: -0.7, el: 0.7 }, cloud: 0.35, fog: 0.25 }), sea("Teal", { wave: 0.22 }), off(),
    ["D", "R", "I", "F", "T"].map((ch, i) => word(ch, 4.6, [-7 + i * 3.5, 0.6 + ((i * 7) % 3) * 0.5, (i % 2) * 1.6 - 0.8], { font: "serif", order: i }, { rot: [(i - 2) * 9, (i % 2 ? 1 : -1) * 14, (i - 2) * 6], bob: 0.2, mat: m(i === 2 ? "Gold" : "Chrome") })),
    camFrom({ yaw: 0.15, pitch: 0.14, dist: 15, target: [0, 1.8, 0] }))),

  // ---------- made for music: open Sound and choose a song ----------
  S("Sound", "Equalizer Bay", () => world("Equalizer Bay", sky("Midnight", { sun: { az: 2.6, el: 0.1 }, cloud: 0.12, ambient: 0.3, stars: 1.2, moon: 1, moonAz: 3.5, moonEl: 0.42, moonSize: 0.08, moonPhase: 0.5 }), sea("Mirror", { c1: "#05060c", c2: "#28304a", reflect: 0.8 }), off(),
    [...Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2 + 0.26; return thing("box", [Math.cos(a) * 6, 1.5, Math.sin(a) * 6], [0.42, 1.5, 0.42], m("Neon", { color: hue(i / 11), glow: 1.1 }), { name: `Meter ${i + 1}`, eq: Math.round((i / 11) * 14), rot: [(-a * 180) / Math.PI, 0, 0], round: 0.08 }) }),
      thing("sphere", [0, 2.6, 0], 2, m("Chrome"), { name: "Mirror ball" })],
    camFrom({ yaw: 0.3, pitch: 0.2, dist: 20, target: [0, 2.2, 0] }), { bloom: 0.55, sound: soundSet({ pulse: 0.5, float: 0.25, glow: 1, ripple: 0.2, twinkle: 0.9, orbit: 0.4, punch: 0.3, journey: "off" }) })),
  S("Sound", "Loud Letters", () => world("Loud Letters", sky("Dusk", { sun: { az: 2.8, el: 0.2 }, cloud: 0.45, streak: 0.7 }), sea("Mercury", { wave: 0.1 }), off(),
    [..."LOUDER"].map((ch, i) => word(ch, 3.2, [-6.5 + i * 2.6, 1.9, 2], { font: "poster", order: i }, { mat: m(i % 2 ? "Gold" : "Chrome") })),
    camFrom({ yaw: 0.1, pitch: 0.1, dist: 16, target: [0, 2.6, 0] }), { bloom: 0.55, sound: soundSet({ pulse: 0.2, float: 0.1, meters: 1, glow: 0.6, orbit: 0.2, punch: 0.4, journey: "sunset", every: 32 }) })),
  S("Sound", "Bass Moons", () => world("Bass Moons", sky("Deep teal", { sun: { az: -0.9, el: 0.7 }, cloud: 0.35 }), sea("Teal", { wave: 0.3 }), off(),
    arrange("trail", 7, 11, m("Chrome")), camFrom({ yaw: 0.3, pitch: 0.19, dist: 15.5, target: [0, 3.1, 0] }), { bloom: 0.55, sound: soundSet({ pulse: 0.9, float: 0.6, ripple: 0.9, glow: 0.5, orbit: 0.3, punch: 0.3 }) })),
  ...[galleryStudy, lunarStudy, mineralStudy].map(study => S("Artist studies", study.name, () => tidyWorld(study))),
  S("Artist studies", "Tidal Tablet", makeRelief),
]
export const WORLD_GROUPS = [...new Set(WORLDS.map((w) => w.group))]
