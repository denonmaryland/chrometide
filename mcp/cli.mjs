#!/usr/bin/env node
// Chrometide from the terminal: ray trace a world to a PNG without opening the app.
//
//   node cli.mjs render "Red Moons" -o red-moons.png --size 1200x1200 --quality fine
//   node cli.mjs render w2.xxxxx -o shared.png            (a share code, or a whole #w= link)
//   node cli.mjs render my-world.json -o mine.png          (a world saved as JSON)
//   node cli.mjs render calendar.json -o island.png        (a GitHub contribution calendar becomes an island)
//   node cli.mjs list                                      (the ready-made worlds)
//   node cli.mjs code "Red Moons"                          (print a share code for the web app)
//
// Uses the same hidden-Chrome renderer as the MCP server (renderer.mjs), with the same settings:
// WORLDS_APP (the built app) and WORLDS_CHROME (the browser).
import fs from "node:fs"; import path from "node:path"

import { QUALITY, createRenderer, missing } from "./renderer.mjs"

const HELP = `Chrometide: ray trace a world to a picture.

Usage
  chrometide render <world> -o out.png [--size 1200x1200] [--quality draft|good|fine]
  chrometide list
  chrometide code <world>

<world> is one of
  "World Name"     a ready-made world (see: list), or "blank"
  w2.…             a share code from the web app (a whole link with #w= works too)
  file.json        a world saved as JSON, or a GitHub contribution calendar (it becomes an island)

Options
  -o, --out        where to save the PNG (default: the world's name, in this folder)
  --size WxH       picture size in pixels, up to 4096 a side (default: the world's own frame)
  --quality        draft (4 passes, quick), good (16, the default) or fine (48, for keeps)
  --user NAME      the name to stand on a calendar island, if the file does not say it
  -h, --help       this help

Settings: WORLDS_APP (folder of the built app), WORLDS_CHROME (path to Chrome or Chromium).`

class Usage extends Error {}
function parse(argv) {
  const o = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i], val = () => { const v = argv[++i]; if (v === undefined) throw new Usage(`${a} needs a value.`); return v }
    if (a === "-h" || a === "--help") o.help = true
    else if (a === "-o" || a === "--out") o.out = val()
    else if (a === "--size") o.size = val()
    else if (a === "--quality") o.quality = val()
    else if (a === "--user") o.user = val()
    else if (a.startsWith("--") && a.includes("=")) { const [k, v] = [a.slice(2, a.indexOf("=")), a.slice(a.indexOf("=") + 1)]; if (!["out", "size", "quality", "user"].includes(k)) throw new Usage(`Unknown option --${k}.`); o[k] = v }
    else if (a.startsWith("-") && a.length > 1) throw new Usage(`Unknown option ${a}.`)
    else o._.push(a)
  }
  return o
}
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "world"
const say = (s) => process.stderr.write(s + "\n")

/** Turn whatever was given into a world, using the app itself to read it. */
async function worldFrom(src, r, o, aspect) {
  if (/(^|#w=)w2\.|#w=/.test(src.trim())) { const w = await r.call("decode", src.trim()); if (!w) throw new Error(await r.call("why", src.trim())); return w }
  if (/\.json$/i.test(src) || fs.existsSync(src)) {
    if (!fs.existsSync(src)) throw new Error(`No file at ${path.resolve(src)}.`)
    if (fs.statSync(src).isDirectory()) throw new Error(`${src} is a folder, not a world file.`)
    if (fs.statSync(src).size > 50_000_000) throw new Error(`${src} is too large to be a world (over 50 MB).`)
    let data; try { data = JSON.parse(fs.readFileSync(src, "utf8")) } catch { throw new Error(fs.statSync(src).size ? `${src} is not a world file: it is not readable JSON.` : `${src} is empty.`) }
    if (data && data.v === 2 && data.sky && data.sea) return r.call("tidy", data)
    const w = await r.call("island", data, { user: o.user, aspect })
    if (w) return w
    throw new Error(`${src} is neither a world (a JSON file with "v": 2) nor a contribution calendar.`)
  }
  if (src.toLowerCase() === "blank") return r.call("blank")
  const w = await r.call("starter", src); if (w) return w
  const names = (await r.call("presets")).worlds.map((x) => x.name), near = names.filter((n) => n.toLowerCase().includes(src.toLowerCase().split(/\s+/)[0] ?? ""))
  throw new Error(`No ready-made world called "${src}".${near.length ? ` Did you mean: ${near.slice(0, 5).join(", ")}?` : ""} Run "list" to see them all.`)
}

async function main() {
  let o; try { o = parse(process.argv.slice(2)) } catch (e) { say(e.message + "\n\n" + HELP); return 2 }
  const [cmd, src, extra] = o._
  if (o.help || !cmd) { console.log(HELP); return o.help ? 0 : 2 }
  if (!["render", "list", "code"].includes(cmd)) { say(`Unknown command "${cmd}".\n\n${HELP}`); return 2 }
  if (cmd !== "list" && !src) { say(`"${cmd}" needs a world: a name, a share code or a .json file.\n\n${HELP}`); return 2 }
  if (extra) { say(`Only one world at a time. If the name has spaces, put it in quotes: "${src} ${extra}".`); return 2 }
  let size = null
  if (o.size) { const m = /^(\d+)\s*[x×*]\s*(\d+)$/i.exec(o.size); if (!m) { say(`--size should look like 1200x1200, not "${o.size}".`); return 2 }
    size = [+m[1], +m[2]]; if (size.some((n) => n < 16 || n > 4096)) { say("--size: each side must be between 16 and 4096 pixels."); return 2 } }
  const quality = o.quality ?? "good"; if (!(quality in QUALITY)) { say(`--quality should be draft, good or fine, not "${quality}".`); return 2 }
  const why = missing(); if (why) { say(why); return 1 }

  const r = createRenderer()
  try {
    if (cmd === "list") { const p = await r.call("presets"); let group = ""
      for (const w of p.worlds) { if (w.group && w.group !== group) { group = w.group; console.log(`\n${group}`) } console.log(`  ${w.name}`) }
      return 0 }
    const w = await worldFrom(src, r, o, size ? size[0] / size[1] : undefined)
    if (cmd === "code") { console.log(await r.call("encode", w)); return 0 }
    const [W, H] = size ?? [w.frame?.w ?? 1024, w.frame?.h ?? 768]
    const out = path.resolve(o.out ?? `${slug(w.name)}.png`), file = /\.png$/i.test(out) ? out : out + ".png"
    say(`Rendering "${w.name}" at ${W}×${H}, ${quality} quality…`); const t0 = Date.now()
    const png = await r.render({ ...w, frame: { ...w.frame, w: W, h: H } }, W, H, quality)
    fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, png)
    say(`Saved ${file} (${Math.round(png.length / 1024)} KB, ${((Date.now() - t0) / 1000).toFixed(1)} s)`)
    return 0
  } catch (e) { say(String(e?.message ?? e).replace(/^page\.evaluate: (Error: )?/, "")); return 1 }
  finally { await r.close() }
}
process.exitCode = await main()
