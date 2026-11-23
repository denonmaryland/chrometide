// Checks the community gallery list: every world's code opens, every field is there and short,
// nothing is listed twice. Runs on pull requests that touch gallery/, and by hand:
//   node tools/gallery-check.mjs [path/to/worlds.json]
// Needs no packages: only Node 20 or newer.
import fs from "fs"; import path from "path"

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const file = path.resolve(process.argv[2] ?? path.join(root, "gallery", "worlds.json"))
const FIELDS = ["name", "author", "github", "code", "date", "tags"]
const problems = []
const say = (where, what) => problems.push(`${where}: ${what}`)

/** Plain short text: no line breaks, no markup, no spaces at the ends. */
function text(where, field, v, max) {
  if (typeof v !== "string" || !v.trim()) return say(where, `"${field}" is missing`)
  if (v !== v.trim()) say(where, `"${field}" has spaces at the start or end`)
  if (v.length > max) say(where, `"${field}" is ${v.length} characters; keep it to ${max}`)
  if (/[\u0000-\u001f\u007f<>`]/.test(v)) say(where, `"${field}" has line breaks, < > or \` in it`)
}

async function decode(code) {
  const b64 = code.slice(3).replace(/-/g, "+").replace(/_/g, "/")
  const bytes = Uint8Array.from(Buffer.from(b64, "base64"))
  const out = new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw")))
  const json = await out.text(); if (json.length > 400_000) throw new Error("it opens into far too much data")
  return JSON.parse(json)
}

let list
try { list = JSON.parse(fs.readFileSync(file, "utf8")) } catch (e) { console.error(`${path.relative(root, file)}: not readable JSON (${e.message})`); process.exit(1) }
if (!Array.isArray(list)) { console.error(`${path.relative(root, file)}: should be a list [ … ] of worlds`); process.exit(1) }
if (list.length > 1000) say("the list", `${list.length} worlds is more than the page can hold (1000)`)

const names = new Map(), codes = new Map(), today = new Date(Date.now() + 36 * 3600_000).toISOString().slice(0, 10)
for (const [i, e] of list.entries()) {
  const where = `world ${i + 1}${e && typeof e.name === "string" ? ` ("${e.name.slice(0, 40)}")` : ""}`
  if (!e || typeof e !== "object" || Array.isArray(e)) { say(where, "should be an object { … }"); continue }
  for (const k of Object.keys(e)) if (!FIELDS.includes(k)) say(where, `unknown field "${k}" (allowed: ${FIELDS.join(", ")})`)
  text(where, "name", e.name, 40)
  text(where, "author", e.author, 40)
  if (e.github !== undefined && (typeof e.github !== "string" || !/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(e.github))) say(where, `"github" should be a GitHub user name, without the @`)
  if (typeof e.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(e.date) || isNaN(Date.parse(e.date + "T00:00:00Z")) || new Date(e.date + "T00:00:00Z").toISOString().slice(0, 10) !== e.date) say(where, `"date" should look like 2026-11-22`)
  else if (e.date > today || e.date < "2024-01-01") say(where, `"date" ${e.date} is in the future or too far back`)
  if (!Array.isArray(e.tags)) say(where, `"tags" should be a list, like ["islands", "night"]`)
  else {
    if (e.tags.length > 5) say(where, `${e.tags.length} tags; keep it to 5`)
    for (const t of e.tags) if (typeof t !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(t) || t.length > 16) say(where, `tag ${JSON.stringify(t)} should be short lower-case words joined by -`)
    if (new Set(e.tags).size !== e.tags.length) say(where, "a tag is listed twice")
  }
  if (typeof e.code !== "string" || !/^w2\.[A-Za-z0-9_-]+$/.test(e.code)) { say(where, `"code" should be a share code starting with w2.`); continue }
  if (e.code.length > 16_000) say(where, `the code is ${e.code.length} characters; worlds with pictures, models or fonts are too big for the gallery`)
  try {
    const w = await decode(e.code)
    if (!w || w.v !== 2 || !w.sky || !w.sea || !w.land || !w.cam || !Array.isArray(w.things)) say(where, "the code opens, but not into a world")
    else if (w.things.length > 20) say(where, `the world has ${w.things.length} things; the app holds 20`)
  } catch { say(where, "the code does not open; it may be cut short or mistyped") }
  const n = typeof e.name === "string" ? e.name.trim().toLowerCase() : ""
  if (n && names.has(n)) say(where, `same name as world ${names.get(n)}`); else names.set(n, i + 1)
  if (codes.has(e.code)) say(where, `same world as world ${codes.get(e.code)}`); else codes.set(e.code, i + 1)
}

if (problems.length) { console.error(`${path.relative(root, file)}: ${problems.length} problem${problems.length > 1 ? "s" : ""}\n  ` + problems.join("\n  ")); process.exit(1) }
console.log(`${path.relative(root, file)}: ${list.length} worlds, all good.`)
