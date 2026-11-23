// Ready-made designs: a world, a kind, a layout and some words. Every name, artist, place and
// date here is made up as an example; change the words and the picture to make it yours.
import { type World, SKIES, applySky } from "../engine/scene"
import { WORLDS } from "../engine/worlds"
import { type DesignKind, type DesignOpts, type Layout, designOpts } from "./layouts"

interface Tweak { sky?: string; yaw?: number; pitch?: number; dist?: number; up?: number; sunEl?: number; sunAz?: number; bloom?: number }
export interface DesignPreset { name: string; kind: DesignKind; world: string; tweak: Tweak; opts: DesignOpts }
const P = (kind: DesignKind, world: string, layout: Layout, title: string, sub: string, o: Partial<DesignOpts> = {}, tweak: Tweak = {}): DesignPreset => ({ name: title, kind, world, tweak, opts: designOpts({ kind, layout, title, sub, ...o }) })

/** The world a design starts from, with its small changes applied. */
export function worldFor(p: DesignPreset): World {
  const w = (WORLDS.find((x) => x.name === p.world) ?? WORLDS[0]).make(), t = p.tweak
  if (t.sky) { const l = SKIES.find((s) => s.name === t.sky); if (l) applySky(w.sky, l) }
  if (t.yaw !== undefined) w.cam.yaw = t.yaw; if (t.pitch !== undefined) w.cam.pitch = t.pitch; if (t.dist !== undefined) w.cam.dist = t.dist; if (t.up !== undefined) w.cam.target = [w.cam.target[0], w.cam.target[1] + t.up, w.cam.target[2]]
  if (t.sunEl !== undefined) w.sky.sun.el = t.sunEl; if (t.sunAz !== undefined) w.sky.sun.az = t.sunAz; if (t.bloom !== undefined) w.bloom = t.bloom
  w.name = p.name; return w
}

export const DESIGNS: DesignPreset[] = [
  // ---------- album covers ----------
  P("cover", "Red Moons", "wide", "Slow Orbit", "The Tide Machines"),
  P("cover", "Chrome Moon", "serif", "Second Moon", "Lune Harbour"),
  P("cover", "Crag Lagoon", "label", "Low Water", "Soft Engine", { small: "Side A · 33⅓" }),
  P("cover", "Monolith", "stack", "Stone Signal", "Paper Meridian"),
  P("cover", "Checker Dream", "band", "Mirror Hours", "Glass Orchard Ensemble", { ink: "#f6f1e6" }),
  P("cover", "Lava Teeth", "poster", "Ember Season", "Hollow Atlas", { ink: "#ffd9a0" }),
  P("cover", "Carved Sun", "frame", "A Slower Light", "Marble Weather"),
  P("cover", "Night Garden", "minimal", "Night Garden", "Quiet Archive"),
  P("cover", "Glass Orchard", "bar", "Glasshouse", "Velvet Static"),
  P("cover", "Halo Ring", "arch", "Halo", "The Second Summer", { line1: "Volume Two" }),
  P("cover", "Monolith Row", "side", "Five Doors", "Distant Engine", { line1: "Stereo" }),
  P("cover", "Floating Isles", "serif", "Small Islands", "Paper Lagoon", { ink: "#3a2a5a" }),
  P("cover", "Lantern Lake", "wide", "Lanterns", "Amber Signal", {}, { bloom: 0.5 }),
  P("cover", "Aurora Bay", "label", "Northern Tape", "Salt Meridian", { small: "Mono · 45" }),
  P("cover", "Neon Harbour", "minimal", "Open Late", "Neon Harbour", {}, { bloom: 0.6 }),
  P("cover", "Vapor Grid", "stack", "Soft Grid", "Chrome Summer", { ink: "#ffffff" }),
  P("cover", "Eclipse", "label", "Totality", "Lunar Archive", { small: "Side B" }),
  P("cover", "Pyramid Dunes", "band", "Dune Radio", "Tidal Monument", { ink: "#2a1a10" }),
  P("cover", "Cloud Factory", "badge", "Weather Works", "limited pressing", { line1: "No. 7", paper: "#f6f1e6" }),
  P("cover", "Equalizer Bay", "poster", "Loud Colours", "Static Garden", { ink: "#ffffff" }, { bloom: 0.6 }),

  // ---------- flyers ----------
  P("flyer", "Neon Harbour", "lineup", "Open Late", "a night of slow machines", { line1: "Sat 14 June · 10 pm", line2: "The Boiler Room, Pier 9", list: "Lune Harbour\nSoft Engine\nVelvet Static\nDJ Paper Moon", small: "21+ · tickets at the door" }, { bloom: 0.6, up: -1 }),
  P("flyer", "Equalizer Bay", "date", "Colour Field", "all night, all neon", { line1: "08.23", line2: "Warehouse Twelve", list: "Static Garden\nThe Tide Machines\nHollow Atlas", small: "doors 9 pm" }, { bloom: 0.6 }),
  P("flyer", "Red Moons", "split", "Ambient Sunday", "music for doing nothing", { line1: "Every Sunday · 4 pm", line2: "The Glass Room", list: "Tape loops\nModular sets\nTea and vinyl\nBring a cushion", small: "free entry", paper: "#f3efe6" }),
  P("flyer", "Checker Dream", "poster", "Chess Club Disco", "your move", { line1: "Friday 9 pm · Hall B" }),
  P("flyer", "Lava Teeth", "lineup", "Heat Wave", "three stages by the shore", { line1: "July 19–21", line2: "Ember Beach", list: "Hollow Atlas\nAmber Signal\nSalt Meridian\nDistant Engine\nMarble Weather", small: "all ages · rain or shine", ink: "#fff0d0" }),
  P("flyer", "Crag Lagoon", "arch", "Island Record Fair", "crates, coffee, sea air", { line1: "Sun 2 March · 10–5", line2: "Harbour Hall" }),
  P("flyer", "Monolith", "side", "Listening Room", "one album, lights off", { line1: "First Thursdays", line2: "Stone Hall", list: "Doors 7:30\nNeedle drop 8:00\nNo phones\nNo talking" }),
  P("flyer", "Chrome Moon", "date", "Full Moon Sessions", "live ambient under the dome", { line1: "10.17", line2: "City Planetarium", list: "Lune Harbour\nQuiet Archive", small: "seated · 8 pm" }),
  P("flyer", "Vapor Grid", "band", "Mall Soft", "a vaporwave afternoon", { line1: "Sat 3 pm", ink: "#ff4fa8" }),
  P("flyer", "Night Garden", "frame", "Night Garden Party", "lanterns, long tables, late music", { line1: "June 21", line2: "The Walled Garden" }),
  P("flyer", "Marble Hall", "masthead", "Open Studio", "spring edition", { line1: "April 12–13", list: "Forty artists\nfree and open to all\nPrints from $10\nmeet the makers", small: "Hall 3", ink: "#4a1f33" }),
  P("flyer", "Spotlight Stage", "lineup", "Open Mic", "five minutes each", { line1: "Tuesdays · 8 pm", line2: "The Checker Room", list: "Poets\nSongwriters\nComics\nFirst-timers welcome", small: "sign up at 7:30" }),
  P("flyer", "Lantern Lake", "serif", "Lantern Walk", "bring a light", { line1: "Dusk, Saturday" }, { bloom: 0.5 }),
  P("flyer", "Aurora Bay", "wide", "Cold Water Club", "winter swims and hot soup", { line1: "Sundays 8 am", line2: "North Pier" }),
  P("flyer", "Gold Record", "split", "Record Release", "side A and side B, start to finish", { line1: "Fri 6 Sept · 8 pm", line2: "Meridian Records", list: "Live set\nSigned copies\nFree poster\nDJ till late", small: "limited to 100", paper: "#141418" }),
  P("flyer", "Floating Isles", "badge", "Kite Day", "every wind welcome", { line1: "May 4", paper: "#fff2d0" }),
  P("flyer", "Storm Buoy", "stack", "Storm Season", "a night of heavy weather", { line1: "Nov 8", line2: "The Lighthouse" }),
  P("flyer", "Pyramid Dunes", "postcard", "Desert Film Night", "under the stars", { small: "Sat 9 pm · bring a blanket" }),
  P("flyer", "Bubble Bath", "poster", "Soda Pop Social", "all-ages dance party", { line1: "Sat 2 pm · Community Hall", ink: "#ffffff" }),
  P("flyer", "Loud Letters", "date", "Turn It Up", "battle of the bands", { line1: "FRI 7PM", line2: "Main Hall", small: "finals" }, { sky: "Synth", yaw: 0.5, sunEl: 0.5, bloom: 0.3 }),

  // ---------- posters ----------
  P("poster", "Monolith", "poster", "The Quiet Door", "a film about waiting", { line1: "Coming this autumn" }, { up: 1.5 }),
  P("poster", "Carved Moon", "serif", "Half a Moon", "now showing", { line1: "A Meridian picture" }),
  P("poster", "Crag Lagoon", "masthead", "Island", "issue nine · the water issue", { line1: "Summer", list: "Low tide walks\nwhere the maps end\nA lagoon at noon\nfour photographers", small: "No. 009" }),
  P("poster", "Cathedral Light", "frame", "Light Studies", "an exhibition", { line1: "March – June", line2: "North Gallery" }),
  P("poster", "Floating Isles", "arch", "Visit the Sky", "daily departures", { line1: "Gate 7" }, { up: 1 }),
  P("poster", "Sunken Letters", "minimal", "Drift", "typeface specimen"),

  // ---------- postcards ----------
  P("postcard", "Crag Lagoon", "postcard", "Crag Lagoon", "Greetings from", { small: "wish you were here" }),
  P("postcard", "Lava Teeth", "postcard", "Ember Coast", "Hot regards from", { small: "bring sunscreen" }),
  P("postcard", "Floating Isles", "postcard", "The Isles", "Postcard from", { small: "mind the gap" }),
  P("postcard", "Atoll", "postcard", "Atoll", "Sunny days in", { small: "back never" }),
  P("postcard", "Mountain Ring", "postcard", "Blue Hour", "Good night from", { small: "it is very quiet" }),
  P("postcard", "Pyramid Dunes", "label", "Dune Sea", "Kilometre zero", { small: "Air mail" }),

  // ---------- phone wallpapers ----------
  P("wallpaper", "Red Moons", "quiet", "Red Moons", "", {}, { up: -2.5 }),
  P("wallpaper", "Chrome Moon", "quiet", "Chrome Moon", "", {}, { up: -2.5 }),
  P("wallpaper", "Lantern Lake", "quiet", "Lantern Lake", "", {}, { up: -2.5, bloom: 0.5 }),
  P("wallpaper", "Floating Isles", "quiet", "Floating Isles", "", {}, { up: -2 }),
  P("wallpaper", "Equalizer Bay", "minimal", "stay loud", "", {}, { up: -3, bloom: 0.6 }),
  P("wallpaper", "Aurora Bay", "minimal", "breathe", "", {}, { up: -3 }),

  // ---------- banners ----------
  P("banner", "Red Moons", "label", "Slow Orbit Radio", "ambient, all day", { small: "est. this morning" }, { pitch: 0.12 }),
  P("banner", "Vapor Grid", "bar", "Soft Grid", "new uploads every Friday"),
  P("banner", "Monolith Row", "wide", "Five Doors Studio", "sound and picture"),
  P("banner", "Crag Lagoon", "serif", "Low Tide Journal", "notes from the shore"),

  // ---------- tickets ----------
  P("ticket", "Neon Harbour", "ticket", "Open Late", "Neon Harbour presents", { line1: "Sat 14 June", line2: "Pier 9 · 10 pm", small: "No. 000128", paper: "#f3efe6" }, { bloom: 0.6 }),
  P("ticket", "Chrome Moon", "ticket", "Full Moon", "City Planetarium", { line1: "17 Oct", line2: "Dome · 8 pm", small: "Row F · 12", paper: "#e8e0ff" }),
  P("ticket", "Lava Teeth", "ticket", "Heat Wave", "Ember Beach festival", { line1: "3-day pass", line2: "July 19–21", small: "No. 004410", paper: "#ffd9a0" }),
  P("ticket", "Spotlight Stage", "ticket", "Open Mic", "The Checker Room", { line1: "Admit one", line2: "Tuesday 8 pm", small: "No. 000042", paper: "#f3efe6" }),

  // ---------- trading cards ----------
  P("card", "Chrome Moon", "card", "Chrome Moon", "Mirror type · rare", { list: "Shine      98\nWeight     12\nMystery    77", small: "007 / 100", paper: "#e8e0ff" }),
  P("card", "Monolith", "card", "The Monolith", "Stone type · common", { list: "Patience   99\nSpeed       0\nShadow     84", small: "001 / 100", paper: "#e6e2d6" }),
  P("card", "Lava Teeth", "card", "Lava Teeth", "Fire type · uncommon", { list: "Heat       95\nBite       70\nCalm        3", small: "023 / 100", paper: "#ffd9a0" }),
  P("card", "Floating Isles", "card", "Sky Isle", "Air type · rare", { list: "Lift       88\nTrees       3\nGravity     1", small: "041 / 100", paper: "#ffe6f4" }),
]
