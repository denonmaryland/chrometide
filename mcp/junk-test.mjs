// Feeds the MCP server junk the way a confused agent might, and checks it always answers calmly.
// Run after a build:  cd mcp && node junk-test.mjs
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
const here = path.dirname(fileURLToPath(import.meta.url)), mcp = here
const client = new Client({ name: "junk", version: "0" }); await client.connect(new StdioClientTransport({ command: "node", args: [path.join(mcp, "server.mjs")], cwd: mcp, env: { ...process.env, WORLDS_OUT: path.join(here, "test-out") } }))
const say = (r) => r.content?.find((c) => c.type === "text")?.text ?? "", out = []
const use = async (name, args) => { const t0 = Date.now(); try { const r = await client.callTool({ name, arguments: args }); out.push([name, JSON.stringify(args).slice(0, 60), r.isError ? "ERR" : "ok", say(r).slice(0, 110).replace(/\n/g, " "), Date.now() - t0]) } catch (e) { out.push([name, JSON.stringify(args).slice(0, 60), "THREW", String(e.message).slice(0, 110), Date.now() - t0]) } }
await use("start_world", { from: "w2.garbage!!" }); await use("start_world", { from: "#w=" }); await use("start_world", { from: "" }); await use("start_world", { from: 5 })
await use("start_world", { from: "blank" })
await use("update_world", { patch: { sky: "x", sea: 7, land: [1], things: "y", cam: { dist: -1, fov: 1e300 }, name: "<script>alert(1)</script>".repeat(100) } })
await use("update_world", { patch: { things: [{ kind: "sphere", pos: "here" }, { kind: "nope" }, null, 4] } })
await use("update_world", { patch: { __proto__: { x: 1 }, anim: { keys: [{ t: 0.5, pose: "x" }] }, sound: { pulseTo: "nowhere" }, frame: { w: 1e9, h: 0 } } })
await use("update_world", { patch: "not an object" })
await use("set_sky", { look: "No such sky" }); await use("set_sky", { changes: { sun: "up", zenith: 12, cloud: "lots" } })
await use("set_camera", { distance: 1e308, pitch: -1e308, target: [1e308, -1e308, 0] })
await use("add_thing", { kind: "sphere", position: [1e308, 0, 0], size: -5, material: { color: 5, reflect: "very", base: "Nope" } })
await use("add_thing", { kind: "teapot", position: [0, 0, 0] }); await use("add_thing", {})
await use("add_lettering", { text: "<img src=x onerror=alert(1)>", font: "sans" }); await use("add_lettering", { text: "" })
await use("update_thing", { thing: "nothing here" }); await use("update_thing", { thing: "Sphere", size: [0, 0, 0], material: "Nope" })
await use("remove_thing", { thing: "" }); await use("roll_dice", { keep: ["sky", "everything"] })
await use("render", { width: 64, height: 64, quality: "draft" }); await use("render", { width: 99999, height: 1 }); await use("render", { width: 64, height: 64, quality: "draft", save_as: "../../../etc/passwd" }); await use("render", { width: 64, height: 64, quality: "draft", save_as: "" })
await use("share_code", {}); await use("no_such_tool", {}); await use("get_world", { detail: "everything" }); await use("get_world", { detail: "brief" })
for (const r of out) console.log(r.join(" | "))
// every call answered (an error is an answer), quickly, the server still works, and nothing was written outside its folder
const fine = out.every((r) => r[2] !== "THREW" && r[4] < 60000) && out.at(-1)[2] === "ok" && out.filter((r) => r[0] === "render" && r[2] === "ok").length === 3 && !fs.existsSync(path.join(here, "..", "..", "etc", "passwd.png"))
console.log(fine ? "all answered calmly" : "FAILED"); await client.close(); process.exit(fine ? 0 : 1)
