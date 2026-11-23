// In and out: 3D files, pictures that become land, pictures for materials.
// The 3D file half (three.js loaders and exporters, the mesh search tree) is in ./io-3d and loads
// the first time it is used, so the app starts without it.
import { GRID } from "./engine/engine"
import { edit, engine, get } from "./store"
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
export function exportHeightmap() {
  if (!engine) return; const w = get().world, n = 512, h = engine.heights(n, w.land.radius * 1.7); let top = 0.001; for (const v of h) top = Math.max(top, v)
  const c = document.createElement("canvas"); c.width = c.height = n; const x = c.getContext("2d")!, im = x.createImageData(n, n)
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const v = Math.round((h[j * n + i] / top) * 255), o = ((n - 1 - j) * n + i) * 4; im.data[o] = im.data[o + 1] = im.data[o + 2] = v; im.data[o + 3] = 255 }
  x.putImageData(im, 0, 0); c.toBlob((b) => b && save(b, `${fileName(w.name)}-land.png`), "image/png")
}

const readImage = (file: Blob) => new Promise<HTMLImageElement>((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = URL.createObjectURL(file) })
/** A picture becomes land: bright is high, dark is under water. */
export async function photoToLand(file: Blob) {
  const im = await readImage(file), c = document.createElement("canvas"); c.width = c.height = GRID; const x = c.getContext("2d", { willReadFrequently: true })!
  const s = Math.min(im.width, im.height); x.filter = "blur(0.6px)"; x.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, GRID, GRID)
  const px = x.getImageData(0, 0, GRID, GRID).data, d = new Uint8Array(GRID * GRID)
  for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) { const o = (j * GRID + i) * 4, v = (px[o] * 0.3 + px[o + 1] * 0.59 + px[o + 2] * 0.11) / 255
    const e = Math.min(1, Math.min(i, j, GRID - 1 - i, GRID - 1 - j) / 10); d[j * GRID + i] = Math.round(118 + v * e * 137) }
  edit("photo-land", (w) => { w.land.on = true; w.land.mode = "island"; w.land.flat = true; w.land.sculpt = writeGrid(d); delete w.land.channel; if (w.land.height < 3) w.land.height = 5 })
}
/** A picture that materials can wear. Kept small so the world stays light. */
export async function setPicture(file: Blob) {
  const im = await readImage(file), c = document.createElement("canvas"), k = Math.min(1, 384 / Math.max(im.width, im.height)); c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k))
  c.getContext("2d")!.drawImage(im, 0, 0, c.width, c.height); const url = c.toDataURL("image/jpeg", 0.82); edit("picture", (w) => { w.picture = url })
}

export const pickFile = (accept: string) => new Promise<File | null>((ok) => { const i = document.createElement("input"); i.type = "file"; i.accept = accept; i.onchange = () => ok(i.files?.[0] ?? null); i.click() })
