// Connects to the server the way an agent would and makes a picture.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
const here = path.dirname(fileURLToPath(import.meta.url)), out = path.join(here, "test-out"); fs.mkdirSync(out, { recursive: true })
const client = new Client({ name: "test", version: "0" }); await client.connect(new StdioClientTransport({ command: "node", args: [path.join(here, "server.mjs")], env: { ...process.env, WORLDS_OUT: out } }))
const res = {}, say = (r) => r.content.find((c) => c.type === "text")?.text ?? "", use = (name, args = {}) => client.callTool({ name, arguments: args })
res.tools = (await client.listTools()).tools.map((t) => t.name)
res.guide = say(await use("get_guide")).length; const presets = JSON.parse(say(await use("list_presets"))); res.presets = { worlds: presets.worlds.length, skies: presets.skies.length, materials: presets.materials.length }
res.badName = (await use("start_world", { from: "No Such Place" })).isError === true
await use("start_world", { from: "blank" }); await use("set_sky", { look: "Ember dusk", changes: { sun: { az: 2.9, el: 0.14 }, cloud: 0.35, streak: 0.8 } }); await use("set_sea", { look: "Mirror" })
const a = JSON.parse(say(await use("add_thing", { kind: "sphere", name: "Moon", position: [0, 3.4, 0], size: 2.6, material: "Chrome" })))
await use("add_thing", { kind: "torus", name: "Ring", position: [0, 3.4, 0], size: [4.4, 1.2, 4.4], rotation: [0, 74, 10], round: 0.08, material: { base: "Gold" } })
await use("add_thing", { kind: "sphere", name: "Bite", position: [1.8, 4.6, 1.8], size: 1.5, material: "Red gloss", role: "cut" })
const l = JSON.parse(say(await use("add_lettering", { text: "made by an agent", font: "poster", height: 1.6, position: [0, 1.1, 6.5], material: "Chrome" })))
await use("update_thing", { thing: "Moon", material: { color: "#dfe8ff" } }); await use("set_camera", { yaw: 0.25, pitch: 0.1, distance: 17, target: [0, 3, 0] }); await use("update_world", { patch: { bloom: 0.3, name: "Agent Moon" } })
const brief = JSON.parse(say(await use("get_world"))); res.things = brief.things.map((t) => `${t.name}:${t.kind}:${t.role}`); res.ids = !!a.id && !!l.id
const t0 = Date.now(), r = await use("render", { width: 960, height: 720, quality: "good", save_as: "agent-moon" }); res.renderSeconds = +((Date.now() - t0) / 1000).toFixed(1)
const img = r.content.find((c) => c.type === "image"); res.image = img ? `${img.mimeType} ${Math.round(img.data.length * 0.75 / 1024)} KB` : "none"; res.saved = fs.existsSync(path.join(out, "agent-moon.png"))
const code = JSON.parse(say(await use("share_code"))).code; res.code = code.slice(0, 3) + "… " + code.length + " chars"
await use("start_world", { from: code }); res.codeRoundTrip = JSON.parse(say(await use("get_world"))).things.length === brief.things.length
await use("start_world", { from: "Crag Lagoon" }); await use("roll_dice", { keep: ["land", "sea"] }); res.rollKeptLand = JSON.parse(say(await use("get_world"))).land.includes("island")
for (const kind of ["gem", "star", "twist", "capsule"]) { const r = await use("add_thing", { kind, position: [0, 2, 0], material: "Chrome" }); res[`shape_${kind}`] = !r.isError }
res.guideHasShapes = /gem/.test(say(await use("get_guide"))) && JSON.parse(say(await use("list_presets"))).shapes?.includes("twist")
res.fullLimit = 0; await use("remove_thing", { thing: "all" }); for (let i = 0; i < 21; i++) { const x = await use("add_thing", { kind: "sphere", position: [i - 10, 1, 0], size: 0.4 }); if (x.isError) res.fullLimit++ }
const r2 = await use("render", { width: 480, height: 360, quality: "draft", save_as: "../../escape" }); res.savePathKept = fs.existsSync(path.join(out, "escape.png")) && !fs.existsSync(path.join(out, "..", "..", "escape.png")); void r2
console.log(JSON.stringify(res, null, 1)); await client.close(); process.exit(0)
