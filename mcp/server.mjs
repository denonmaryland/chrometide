#!/usr/bin/env node
// An MCP server for Untitled Worlds. An agent connected to it can start from a ready-made world or
// a blank one, change the sky, sea, land and things, add 3D lettering, roll the dice, and get the
// ray-traced picture back. The renderer is the web app itself, run in a hidden browser.
//
// Settings (environment):
//   WORLDS_APP     folder of the built app (default: ../dist next to this file)
//   WORLDS_CHROME  path to a Chrome or Chromium program (default: looked for in the usual places)
//   WORLDS_OUT     folder that pictures may be saved into (default: the folder the server was started in)
import fs from "node:fs"; import path from "node:path"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

import { createRenderer } from "./renderer.mjs"

const OUT = path.resolve(process.env.WORLDS_OUT || process.cwd())

// ---------- the hidden browser that does the ray tracing (renderer.mjs) ----------
const { call } = createRenderer()

// ---------- the world being worked on ----------
let world = null
const need = async () => (world ??= await call("starter", "Red Moons"))
const text = (s) => ({ content: [{ type: "text", text: typeof s === "string" ? s : JSON.stringify(s) }] })
const fail = (s) => ({ content: [{ type: "text", text: s }], isError: true })
const brief = (w) => ({ name: w.name, sky: `${w.sky.zenith} over ${w.sky.horizon}, sun height ${w.sky.sun.el.toFixed(2)}`, sea: w.sea.kind, land: w.land.on ? `${w.land.mode}, height ${w.land.height}` : "none",
  things: w.things.map((t) => ({ id: t.id, name: t.name, kind: t.kind, position: t.pos.map((n) => +n.toFixed(2)), size: t.size.map((n) => +n.toFixed(2)), material: t.mat.name, role: t.role, ...(t.text ? { text: t.text.str } : {}) })), camera: { yaw: +w.cam.yaw.toFixed(2), pitch: +w.cam.pitch.toFixed(2), distance: +w.cam.dist.toFixed(1), target: w.cam.target } })
/** RFC 7396 merge patch: objects merge, null removes, everything else replaces. */
const merge = (a, b) => { if (b === null || typeof b !== "object" || Array.isArray(b)) return b; const o = a && typeof a === "object" && !Array.isArray(a) ? { ...a } : {}; for (const [k, v] of Object.entries(b)) { if (v === null) delete o[k]; else o[k] = merge(o[k], v) } return o }
const find = (w, key) => w.things.find((t) => t.id === key) ?? w.things.find((t) => t.name.toLowerCase() === String(key).toLowerCase())

// Shapes: the built-in kinds, then any in the app's shape folder (src/engine/shapes, one file each).
const SHAPES_DIR = path.join(here, "..", "src", "engine", "shapes")
const MORE_SHAPES = fs.existsSync(SHAPES_DIR) ? fs.readdirSync(SHAPES_DIR).filter((f) => /^[a-z0-9]+\.ts$/.test(f) && f !== "index.ts").sort()
  .map((f) => { const src = fs.readFileSync(path.join(SHAPES_DIR, f), "utf8"); return { id: /\bid:\s*"([a-z][a-z0-9]*)"/.exec(src)?.[1], label: /\blabel:\s*"([^"]+)"/.exec(src)?.[1] } }).filter((s) => s.id) : []
const SHAPE_KINDS = ["sphere", "box", "pyramid", "cylinder", "cone", "torus", "disc", "stone", "blob", "tree", "pine", "crag", ...MORE_SHAPES.map((s) => s.id)]

const GUIDE = `Untitled Worlds makes surreal ray-traced pictures: chrome spheres over endless seas, hazy two-colour skies, craggy islands, 3D lettering.

HOW TO WORK
1. start_world from a ready-made world (see list_presets) or "blank".
2. Change it: set_sky, set_sea, set_land, add_thing, add_lettering, update_thing, set_camera, roll_dice, or update_world for any field.
3. render to see it. Look at the picture, adjust, render again. Use quality "draft" while exploring and "fine" for the keeper.
4. share_code gives a code that opens the same world in the web app.

SPACE
Units are metres, roughly. The sea is the plane y = 0. x is right, y is up, z is towards the default camera. A good scene sits within about 10 units of the middle and rises 1 to 8 units. A world holds at most 20 things.

THE CAMERA circles a target: yaw (radians, turn around), pitch (0.02 = at the water, 1.5 = straight down), distance (3 to 120), target [x,y,z], fov (degrees, default 55), lens (0 = all sharp; 0.1 = soft focus) with focus distance.

THINGS
kind: sphere, box, pyramid, cylinder, cone, torus, disc, stone, blob, tree, pine, crag (a floating rock), ${MORE_SHAPES.map((s) => `${s.id}${s.label.toLowerCase() !== s.id ? ` (${s.label.toLowerCase()})` : ""}, `).join("")}text.
size is [half-width, half-height, half-depth]; a single number makes all three equal. rotation is [turn, tilt, roll] in degrees.
material: a name from list_presets, or an object such as {"base":"Chrome","color":"#ff5a2a","reflect":0.9}. Material fields (0 to 1 unless said): color, color2 (hex), texture (pattern), texScale, diffuse, reflect, metal, shine, gloss, clear (see-through), ior (1 to 2.4), bump, glow (0 to 4; a glowing thing lights the scene), cloud (the shape becomes cloud).
role: "solid", "cut" (carves a hole in the solid things that share its group number) or "keep" (only the overlap stays). group is 0 to 3. Blobs in one group melt together.
beam: for a glowing thing, a spotlight this many degrees wide, pointing down its own axis.

SKY fields: zenith, horizon, haze, sunColor, cloudColor (hex); sun {az, el} in radians (el 0.05 = sunset, 1.2 = high noon); hazeAmt, cloud, streak, cloud2, fog, stars (0 to 2), moon (0 or 1) with moonAz, moonEl, moonSize, moonPhase; rainbow, halo, rays, comet; ambient (fill light).
SEA: kind water | checker | lava | sand | mirror | none; c1, c2 (hex); wave, grain, reflect, scale.
LAND: on, mode island | range, height, radius, freq (detail), ridge, seed, sharp, terrace, plateau, snow, c1 (shore), c2 (slope), c3 (rock).
PICTURE: frame {w, h}; bloom (0 to 1.2: bright things spill light).

TASTE
The look comes from few, simple shapes, strong reflections, an unnatural sky and a low camera. Put the sun low for long shadows and a path of light on the water. One accent colour reads better than five.`

const server = new McpServer({ name: "untitled-worlds", version: "0.1.0" }, { instructions: GUIDE.split("\n\nSPACE")[0] + "\n\nCall get_guide once for the coordinate system and every field." })
const tool = (name, description, shape, fn) => server.registerTool(name, { description, inputSchema: shape }, async (args) => { try { return await fn(args) } catch (e) { return fail(String(e?.message ?? e)) } })
const vec = z.union([z.number(), z.array(z.number()).length(3)])

tool("get_guide", "Read this first. Explains the coordinate system, every kind of thing, materials, sky, sea, land and camera fields, and what makes these pictures look good.", {}, async () => text(GUIDE))
tool("list_presets", "List what is built in: the ready-made worlds (with their groups), sky looks, sea looks, land looks, materials, shapes, patterns, fonts and picture sizes.", {}, async () => text(await call("presets")))
tool("start_world", "Begin with a ready-made world by name (see list_presets), with \"blank\" (sea and sky only), or with a share code from the web app. Replaces the world being worked on.",
  { from: z.string().describe('A world name such as "Crag Lagoon", or "blank", or a share code beginning "w2."') }, async ({ from }) => {
    const w = from.toLowerCase() === "blank" ? await call("blank") : /w2\./.test(from) ? await call("decode", from) : await call("starter", from)
    if (!w) return fail(`No world called "${from}". Use list_presets to see the names.`); world = w; return text(brief(w)) })
tool("get_world", "Return the world being worked on. \"brief\" lists the things with their ids; \"full\" is the whole document, every field, ready to change with update_world.",
  { detail: z.enum(["brief", "full"]).default("brief") }, async ({ detail }) => text(detail === "full" ? await need() : brief(await need())))
tool("update_world", "Change any fields of the world with a JSON merge patch: objects merge, null removes a field, arrays and values replace. Example: {\"sky\":{\"sun\":{\"el\":0.1}},\"sea\":{\"kind\":\"mirror\"},\"bloom\":0.4}. To change things, prefer update_thing.",
  { patch: z.record(z.string(), z.any()) }, async ({ patch }) => { world = await call("tidy", merge(await need(), patch)); return text(brief(world)) })
tool("set_sky", "Put a sky look on the world (colours plus any weather it brings: stars, moon, fog, rainbow…), then apply your own changes on top. The sun stays where it is unless you move it.",
  { look: z.string().optional().describe("A sky name from list_presets"), changes: z.record(z.string(), z.any()).optional().describe('Sky fields to set, e.g. {"sun":{"az":2.8,"el":0.12},"cloud":0.3}') }, async ({ look, changes }) => {
    let w = await need(); if (look) { w = await call("sky", w, look, {}); if (!w) return fail(`No sky called "${look}".`) } world = changes ? await call("tidy", merge(w, { sky: changes })) : w; return text(brief(world)) })
tool("set_sea", "Choose the sea or floor: a look from list_presets (Ocean, Lagoon, Mercury, Checker, Lava, Dunes, Mirror, Open sky…) and/or your own field changes.",
  { look: z.string().optional(), changes: z.record(z.string(), z.any()).optional() }, async ({ look, changes }) => { let w = await need(); if (look) { w = await call("sea", w, look.replace(/ \(.*$/, ""), {}); if (!w) return fail(`No sea called "${look}".`) } world = changes ? await call("tidy", merge(w, { sea: changes })) : w; return text(brief(world)) })
tool("set_land", "Grow land: a look from list_presets and/or field changes (height, radius, ridge, seed, terrace, plateau, sharp, snow, mode). Pass {\"on\":false} in changes to remove the land.",
  { look: z.string().optional(), changes: z.record(z.string(), z.any()).optional() }, async ({ look, changes }) => { let w = await need(); if (look) { w = await call("land", w, look, {}); if (!w) return fail(`No land called "${look}".`) } world = changes ? await call("tidy", merge(w, { land: changes })) : w; return text(brief(world)) })
tool("set_camera", "Move the camera. It circles a target point.", { yaw: z.number().optional(), pitch: z.number().optional(), distance: z.number().optional(), target: z.array(z.number()).length(3).optional(), fov: z.number().optional(), lens: z.number().optional(), focus: z.number().optional() },
  async (a) => { const c = {}; for (const k of ["yaw", "pitch", "target", "fov", "lens", "focus"]) if (a[k] !== undefined) c[k] = a[k]; if (a.distance !== undefined) c.dist = a.distance; world = await call("tidy", merge(await need(), { cam: c })); return text(brief(world).camera) })
tool("add_thing", "Add a shape to the world. Returns its id.", { kind: z.enum(SHAPE_KINDS), name: z.string().optional(), position: z.array(z.number()).length(3).describe("[x, y, z]; y is the height of its middle above the sea"),
  size: vec.optional().describe("half-sizes [x, y, z], or one number"), rotation: z.array(z.number()).length(3).optional().describe("[turn, tilt, roll] in degrees"), material: z.union([z.string(), z.record(z.string(), z.any())]).optional().describe('A material name, or {"base":"Gold","color":"#…", …}'),
  role: z.enum(["solid", "cut", "keep"]).optional(), group: z.number().int().min(0).max(3).optional(), round: z.number().optional().describe("box: round edges 0–0.5; torus: thickness 0.05–1; star: sharpness 0–1; twist: how far it is twisted 0–1"), bob: z.number().optional(), spin: z.number().optional(), beam: z.number().optional() },
  async (a) => { const w = await need(); if (w.things.length >= 20) return fail("This world already holds 20 things, the most it can. Remove one first."); const t = await call("thing", a); world = { ...w, things: [...w.things, t] }; return text({ id: t.id, name: t.name, things: world.things.length }) })
tool("add_lettering", "Stand real 3D letters in the world. They reflect, cast shadows, and with role \"cut\" carve their words through a solid thing in the same group.", { text: z.string().max(120), font: z.enum(["sans", "poster", "serif", "slab", "rounded", "mono", "script"]).optional(), style: z.enum(["solid", "outline", "tube"]).optional().describe('"tube" with a glowing material is a neon sign'),
  edge: z.enum(["round", "chisel", "sharp"]).optional(), height: z.number().optional().describe("letter height, default 2.5"), depth: z.number().optional(), position: z.array(z.number()).length(3).optional(), rotation: z.array(z.number()).length(3).optional(), bend: z.number().optional().describe("degrees around a ring; -360 is a full ring facing out"), arch: z.number().optional(),
  material: z.union([z.string(), z.record(z.string(), z.any())]).optional(), role: z.enum(["solid", "cut", "keep"]).optional(), group: z.number().int().min(0).max(3).optional(), name: z.string().optional() },
  async (a) => { const w = await need(); if (w.things.length >= 20) return fail("This world already holds 20 things, the most it can."); const t = await call("thing", { ...a, kind: "text" }); world = { ...w, things: [...w.things, t] }; return text({ id: t.id, name: t.name, size: t.size.map((n) => +n.toFixed(2)) }) })
tool("update_thing", "Change one thing, found by id or by name. Give only what changes. Material may be a name or an object of fields to merge into the current material.", { thing: z.string().describe("id or name"), position: z.array(z.number()).length(3).optional(), size: vec.optional(), rotation: z.array(z.number()).length(3).optional(),
  material: z.union([z.string(), z.record(z.string(), z.any())]).optional(), role: z.enum(["solid", "cut", "keep"]).optional(), group: z.number().int().min(0).max(3).optional(), name: z.string().optional(), hidden: z.boolean().optional(), round: z.number().optional(), bob: z.number().optional(), spin: z.number().optional(), beam: z.number().optional(), text: z.string().optional() },
  async (a) => { const w = await need(), t = find(w, a.thing); if (!t) return fail(`No thing with id or name "${a.thing}". Call get_world to see them.`)
    const n = { ...t }; if (a.position) n.pos = a.position; if (a.size !== undefined) n.size = typeof a.size === "number" ? [a.size, a.size, a.size] : a.size; if (a.rotation) n.rot = a.rotation
    if (a.material !== undefined) n.mat = typeof a.material === "string" ? await call("material", a.material) : { ...t.mat, ...a.material, name: a.material.name ?? "Custom" }
    for (const k of ["role", "group", "name", "hidden", "round", "bob", "spin", "beam"]) if (a[k] !== undefined) n[k] = a[k]; if (a.text !== undefined && n.text) n.text = { ...n.text, str: a.text.toUpperCase() }
    world = await call("tidy", { ...w, things: w.things.map((x) => (x.id === t.id ? n : x)) }); return text(brief(world).things.find((x) => x.id === t.id)) })
tool("remove_thing", "Remove one thing by id or name, or every thing with \"all\".", { thing: z.string() }, async ({ thing }) => { const w = await need(); if (thing === "all") { world = { ...w, things: [] }; return text("Removed every thing.") } const t = find(w, thing); if (!t) return fail(`No thing with id or name "${thing}".`); world = { ...w, things: w.things.filter((x) => x.id !== t.id) }; return text(`Removed ${t.name}. ${world.things.length} left.`) })
tool("roll_dice", "Roll a new random world. Parts named in keep stay as they are: lock what you love, roll the rest.", { keep: z.array(z.enum(["sky", "sea", "land", "things", "camera"])).default([]) }, async ({ keep }) => { world = await call("roll", await need(), keep); return text(brief(world)) })
tool("render", "Ray trace the world and return the picture. Look at it, then adjust and render again. Sizes up to 2400 on a side; larger and finer take longer.", { width: z.number().int().min(64).max(2400).default(960), height: z.number().int().min(64).max(2400).default(720), quality: z.enum(["draft", "good", "fine"]).default("good").describe("draft 4 passes, good 16, fine 48"),
  save_as: z.string().optional().describe("Optional file name (.png) to also save the picture under, inside the server's output folder") }, async ({ width, height, quality, save_as }) => {
    const url = await call("render", await need(), width, height, { draft: 4, good: 16, fine: 48 }[quality]), data = url.slice(url.indexOf(",") + 1), out = [{ type: "image", data, mimeType: "image/png" }]
    if (save_as) { const f = path.resolve(OUT, path.basename(save_as).replace(/\.png$/i, "") + ".png"); fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(f, Buffer.from(data, "base64")); out.push({ type: "text", text: `Saved ${f}` }) }
    return { content: out } })
tool("share_code", "Get a code that opens this exact world in the Untitled Worlds web app: add it to the app's address as #w=<code>. Imported pictures and fonts are not included.", {}, async () => { const code = await call("encode", await need()); return text({ code, how: "Open the web app and add #w=" + code.slice(0, 12) + "… (the whole code) to its address." }) })

await server.connect(new StdioServerTransport())
