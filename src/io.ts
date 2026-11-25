// In and out: 3D files, pictures that become land, pictures for materials.
// The 3D file half (three.js loaders and exporters, the mesh search tree) is in ./io-3d and loads
// the first time it is used, so the app starts without it.
import { CUTOUT_EDGE, MAX_THINGS, mat, thing, usesCutout, type Vec3 } from "./engine/scene"
import { GRID } from "./engine/engine"
import { dismiss, notify } from "./notice"
import { editTerrain, terrainById, edit, engine, get, patch } from "./store"
import { fileName } from "./ui/TopBar"
import { writeGrid } from "./ui/Viewport"

export const save = (blob: Blob, name: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000) }
const heavy = () => import("./io-3d")
/** The world as a .glb file, downloaded. Resolves to its size in bytes. */
export const exportGLB = async () => (await heavy()).exportGLB()
/** The world as an .obj file, downloaded. Resolves to its size in characters. */
export const exportOBJ = async () => (await heavy()).exportOBJ()
/** A .glb, .gltf or .obj model becomes a thing in the world. */
export const importModel = async (file: File) => (await heavy()).importModel(file)
/** The land's heights as a grey picture: white is high. Other terrain tools can read it. */
export function exportHeightmap(id?: string) {
  if (!engine) return; const w = get().world, land = terrainById(w, id) ?? w.land, n = 512, h = engine.heights(n, land.radius * (land.mode === "range" ? 9 : 1.7), land); let top = 0.001; for (const v of h) top = Math.max(top, v)
  const c = document.createElement("canvas"); c.width = c.height = n; const x = c.getContext("2d")!, im = x.createImageData(n, n)
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const v = Math.round((h[j * n + i] / top) * 255), o = ((n - 1 - j) * n + i) * 4; im.data[o] = im.data[o + 1] = im.data[o + 2] = v; im.data[o + 3] = 255 }
  x.putImageData(im, 0, 0); c.toBlob((b) => b && save(b, `${fileName(w.name)}-land.png`), "image/png")
}

/** A problem worth telling people about, in words they can use. */
export class Said extends Error {}
/** A picture file, read and checked. Throws an Error whose message can be shown to people as it is. */
export async function readImage(file: Blob): Promise<HTMLImageElement> {
  if (!file.size) throw new Said("That picture file is empty.")
  if (file.size > 40_000_000) throw new Said("That picture is too large to read here (over 40 MB). Try a smaller copy.")
  const url = URL.createObjectURL(file)
  try {
    const im = await new Promise<HTMLImageElement>((ok, no) => { const im = new Image(), t = setTimeout(() => no(new Said("That picture took too long to read. Try a smaller one.")), 20000)
      im.onload = () => { clearTimeout(t); ok(im) }; im.onerror = () => { clearTimeout(t); no(new Said("That file is not a picture this browser can read. Try a JPG or PNG.")) }; im.src = url })
    if (!im.width || !im.height) throw new Said("That picture has no size. Try another one.")
    if (im.width * im.height > 120_000_000) throw new Said("That picture has too many pixels to read here. Try a smaller copy.")
    return im
  } finally { URL.revokeObjectURL(url) }
}
export const told = (e: unknown, fallback: string) => { if (!(e instanceof Said)) console.warn(e); notify(e instanceof Said ? e.message : fallback); return false }
/** A picture becomes land: bright is high, dark is under water. False (and a message) if it could not be read. */
export async function photoToLand(file: Blob, id?: string): Promise<boolean> {
  try {
    const im = await readImage(file), c = document.createElement("canvas"); c.width = c.height = GRID; const x = c.getContext("2d", { willReadFrequently: true })!
    const s = Math.min(im.width, im.height); x.filter = "blur(0.6px)"; x.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, GRID, GRID)
    const px = x.getImageData(0, 0, GRID, GRID).data, d = new Uint8Array(GRID * GRID)
    for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) { const o = (j * GRID + i) * 4, v = (px[o] * 0.3 + px[o + 1] * 0.59 + px[o + 2] * 0.11) / 255
      const e = Math.min(1, Math.min(i, j, GRID - 1 - i, GRID - 1 - j) / 10); d[j * GRID + i] = Math.round(118 + v * e * 137) }
    editTerrain(id, "photo-land", (land) => { land.on = true; land.mode = "island"; land.flat = true; land.sculpt = writeGrid(d); delete land.channel; if (land.height < 3) land.height = 5 })
    return true
  } catch (e) { return told(e, "That picture could not be made into land. Try a JPG or PNG.") }
}
/** Bring the image and its placement into undo history together. Copies use the same image. */
export async function importCutout(file: File): Promise<boolean> {
  try {
    const signature = new Uint8Array(await file.slice(0, 8).arrayBuffer())
    if (![137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => signature[i] === b)) throw new Said("Choose a PNG with a transparent background.")
    const image = await readImage(file)
    const scale = Math.min(1, CUTOUT_EDGE / Math.max(image.width, image.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    const ctx = canvas.getContext("2d")!
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let visible = false, transparent = false
    for (let i = 3; i < pixels.length; i += 4) {
      visible ||= pixels[i] > 0
      transparent ||= pixels[i] < 255
    }
    if (!visible) throw new Said("This PNG is entirely transparent. Choose one with a visible subject.")
    if (!transparent) throw new Said("This PNG has an opaque background. Choose one with a transparent background.")
    const world = get().world
    if (usesCutout(world)) throw new Said("One cutout image per world. Remove its copies and any loop keys that use it before adding a different PNG.")
    if (world.things.length >= MAX_THINGS) throw new Said("This world is full. Remove a thing to make room for the cutout.")
    const cam = world.cam, distance = cam.dist * .18
    const x = cam.target[0] + distance * Math.sin(cam.yaw), z = cam.target[2] + distance * Math.cos(cam.yaw)
    const half = Math.min(5, Math.max(1, distance))
    const longest = Math.max(canvas.width, canvas.height)
    const size: Vec3 = [half * canvas.width / longest, half * canvas.height / longest, .02]
    const y = (engine?.groundAt(x, z) ?? 0) + size[1]
    const card = thing("cutout", [x, y, z], size, mat("Clay"), {
      name: file.name.replace(/\.png$/i, "").slice(0, 40) || "PNG cutout",
      rot: [Math.atan2(Math.sin(cam.yaw), Math.cos(cam.yaw)) * 180 / Math.PI, 0, 0],
    })
    const rgba = writeGrid(new Uint8Array(pixels.buffer))
    edit("add-cutout:" + card.id, w => {
      w.cutout = { width: canvas.width, height: canvas.height, rgba }
      w.things.push(card)
    })
    patch({ sel: { type: "thing", id: card.id } })
    return true
  } catch (e) { return told(e, "This cutout could not be read. Choose a transparent PNG.") }
}
export async function pickCutout() {
  const file = await pickFile("image/png")
  if (file) await importCutout(file)
}

/** A picture that materials can wear. Kept small so the world stays light. */
export async function setPicture(file: Blob): Promise<boolean> {
  try {
    const im = await readImage(file), c = document.createElement("canvas"), k = Math.min(1, 384 / Math.max(im.width, im.height)); c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k))
    c.getContext("2d")!.drawImage(im, 0, 0, c.width, c.height); const url = c.toDataURL("image/jpeg", 0.82); edit("picture", (w) => { w.picture = url }); return true
  } catch (e) { return told(e, "That picture could not be read. Try a JPG or PNG.") }
}

/** Any file someone drops or picks: sent to whatever can use it, or a kind word saying what can. */
export async function openFile(file: File): Promise<boolean> {
  const name = file.name.toLowerCase()
  if (/\.(glb|gltf|obj)$/.test(name)) { const busy = notify("Reading the model…", { ms: 0 }); const ok = await importModel(file); dismiss(busy); if (ok) notify("The model is in the world. Undo to take it out."); return ok }
  if (/\.(ttf|otf|woff2?)$/.test(name)) { const { loadCustomFont } = await import("./text"); const ok = await loadCustomFont(file); notify(ok ? "Your font is ready: pick \u201cMy font\u201d for any lettering." : "That font file could not be read. Try a .ttf, .otf or .woff file."); return ok }
  notify("That kind of file cannot be used here. Drop a photo, a 3D model (.glb, .obj) or a font (.ttf, .otf, .woff).")
  return false
}
export const pickFile = (accept: string) => new Promise<File | null>((ok) => { const i = document.createElement("input"); i.type = "file"; i.accept = accept; i.onchange = () => ok(i.files?.[0] ?? null); i.click() })
