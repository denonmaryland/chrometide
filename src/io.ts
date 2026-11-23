// In and out: 3D files, pictures that become land, pictures for materials.
import * as THREE from "three"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js"
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { MeshBVH } from "three-mesh-bvh"

import { GRID } from "./engine/engine"
import { type Thing, type World, MAX_THINGS, mat, thing } from "./engine/scene"
import { notify } from "./notice"
import { SHAPE_BY_ID } from "./engine/shapes"
import { addThing, edit, engine, get } from "./store"
import { fileName } from "./ui/TopBar"
import { writeGrid } from "./ui/Viewport"

const rad = THREE.MathUtils.degToRad
/** One shape from several: they must agree on having an index, so none keeps one. */
const join = (gs: THREE.BufferGeometry[]) => mergeGeometries(gs.map((g) => (g.index ? g.toNonIndexed() : g)))
function shapeOf(t: Thing): THREE.BufferGeometry | null {
  switch (t.kind) {
    case "sphere": case "blob": return new THREE.SphereGeometry(1, 40, 24)
    case "box": return new THREE.BoxGeometry(2, 2, 2)
    case "pyramid": return new THREE.ConeGeometry(Math.SQRT2, 2, 4).rotateY(Math.PI / 4)
    case "cylinder": case "disc": return new THREE.CylinderGeometry(1, 1, 2, 40)
    case "cone": return new THREE.ConeGeometry(1, 2, 40)
    case "torus": { const tube = Math.min(0.95, Math.max(0.05, t.round)) * 0.5; return new THREE.TorusGeometry(1 - tube, tube, 20, 48).rotateX(Math.PI / 2) }
    case "stone": return new THREE.IcosahedronGeometry(0.82, 2)
    case "crag": return new THREE.ConeGeometry(1, 1.4, 14).rotateX(Math.PI).translate(0, -0.3, 0)
    case "tree": return join([new THREE.CylinderGeometry(0.1, 0.1, 0.9, 10).translate(0, -0.55, 0), new THREE.IcosahedronGeometry(0.62, 2).translate(0, 0.3, 0)])
    case "pine": return join([new THREE.CylinderGeometry(0.08, 0.08, 0.6, 10).translate(0, -0.7, 0), ...[0, 1, 2].map((j) => new THREE.ConeGeometry(0.4 + j * 0.2, 0.78, 16).translate(0, 1 - j * 0.36 - 0.39, 0))])
    default: return SHAPE_BY_ID[t.kind]?.mesh?.() ?? null // a shape without a mesh is left out of exports
  }
}
/** The world as ordinary meshes: every solid thing, the land and the sea level. Cut shapes are left out. */
export function toMeshes(w: World): THREE.Scene {
  const scene = new THREE.Scene(); scene.name = w.name
  for (const t of w.things) { if (t.hidden || t.role !== "solid") continue; const g = shapeOf(t); if (!g) continue
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: t.mat.color, metalness: Math.min(1, t.mat.reflect * 0.9 + t.mat.metal * 0.3), roughness: Math.max(0.03, 1 - t.mat.gloss * (0.4 + 0.6 * t.mat.reflect)), transparent: t.mat.clear > 0.2, opacity: 1 - t.mat.clear * 0.75,
      emissive: t.mat.glow > 0 ? t.mat.color : "#000000", emissiveIntensity: t.mat.glow }))
    m.name = t.name; m.position.set(...t.pos); m.scale.set(...t.size); m.rotation.set(rad(t.rot[1]), rad(t.rot[0]), rad(t.rot[2]), "YXZ"); scene.add(m) }
  if (w.land.on && engine) { const n = 160, half = w.land.radius * (w.land.mode === "range" ? 9 : 1.7), h = engine.heights(n, half)
    const g = new THREE.PlaneGeometry(half * 2, half * 2, n - 1, n - 1).rotateX(-Math.PI / 2), p = g.attributes.position
    for (let k = 0; k < n * n; k++) p.setY(k, h[k] > 0 ? h[k] : -0.05) // row 0 of both the plane and the grid is the far edge (z = -half)
    g.computeVertexNormals()
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: w.land.c2, roughness: 0.95 })); m.name = "Land"; scene.add(m) }
  if (w.sea.kind !== "none") { const m = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: w.sea.c2, roughness: 0.15, metalness: 0.2 })); m.name = "Sea"; scene.add(m) }
  return scene
}
const save = (blob: Blob, name: string) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000) }
export async function exportGLB(): Promise<number> {
  const w = get().world, buf = (await new GLTFExporter().parseAsync(toMeshes(w), { binary: true })) as ArrayBuffer
  save(new Blob([buf], { type: "model/gltf-binary" }), `${fileName(w.name)}.glb`); return buf.byteLength
}
export function exportOBJ(): number { const w = get().world, text = new OBJExporter().parse(toMeshes(w)); save(new Blob([text], { type: "text/plain" }), `${fileName(w.name)}.obj`); return text.length }
/** The land's heights as a grey picture: white is high. Other terrain tools can read it. */
export function exportHeightmap() {
  if (!engine) return; const w = get().world, n = 512, h = engine.heights(n, w.land.radius * 1.7); let top = 0.001; for (const v of h) top = Math.max(top, v)
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
const told = (e: unknown, fallback: string) => { if (!(e instanceof Said)) console.warn(e); notify(e instanceof Said ? e.message : fallback); return false }
/** A picture becomes land: bright is high, dark is under water. False (and a message) if it could not be read. */
export async function photoToLand(file: Blob): Promise<boolean> {
  try {
    const im = await readImage(file), c = document.createElement("canvas"); c.width = c.height = GRID; const x = c.getContext("2d", { willReadFrequently: true })!
    const s = Math.min(im.width, im.height); x.filter = "blur(0.6px)"; x.drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, GRID, GRID)
    const px = x.getImageData(0, 0, GRID, GRID).data, d = new Uint8Array(GRID * GRID)
    for (let j = 0; j < GRID; j++) for (let i = 0; i < GRID; i++) { const o = (j * GRID + i) * 4, v = (px[o] * 0.3 + px[o + 1] * 0.59 + px[o + 2] * 0.11) / 255
      const e = Math.min(1, Math.min(i, j, GRID - 1 - i, GRID - 1 - j) / 10); d[j * GRID + i] = Math.round(118 + v * e * 137) }
    edit("photo-land", (w) => { w.land.on = true; w.land.mode = "island"; w.land.flat = true; w.land.sculpt = writeGrid(d); delete w.land.channel; if (w.land.height < 3) w.land.height = 5 })
    return true
  } catch (e) { return told(e, "That picture could not be made into land. Try a JPG or PNG.") }
}
/** A picture that materials can wear. Kept small so the world stays light. */
export async function setPicture(file: Blob): Promise<boolean> {
  try {
    const im = await readImage(file), c = document.createElement("canvas"), k = Math.min(1, 384 / Math.max(im.width, im.height)); c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k))
    c.getContext("2d")!.drawImage(im, 0, 0, c.width, c.height); const url = c.toDataURL("image/jpeg", 0.82); edit("picture", (w) => { w.picture = url }); return true
  } catch (e) { return told(e, "That picture could not be read. Try a JPG or PNG.") }
}

/** An imported mesh becomes a grid of distances to its surface, which the ray tracer can draw, cut and reflect like any other thing. */
export async function meshToGrid(geo: THREE.BufferGeometry, n = 44): Promise<string> {
  const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.computeBoundingBox(); const bb = g.boundingBox!, c = bb.getCenter(new THREE.Vector3()), size = bb.getSize(new THREE.Vector3())
  const k = 1.7 / Math.max(size.x, size.y, size.z, 1e-6); g.translate(-c.x, -c.y, -c.z); g.scale(k, k, k)
  const bvh = new MeshBVH(g), d = new Uint8Array(n * n * n), p = new THREE.Vector3(), hit = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 }
  const ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0.577, 0.577, 0.577).normalize())
  let rest = performance.now()
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (x === 0 && performance.now() - rest > 40) { await new Promise((ok) => setTimeout(ok)); rest = performance.now() } // let the page breathe
    p.set(((x + 0.5) / n) * 2 - 1, ((y + 0.5) / n) * 2 - 1, ((z + 0.5) / n) * 2 - 1)
    const dist = bvh.closestPointToPoint(p, hit as any)?.distance ?? 1
    ray.origin.copy(p); const inside = bvh.raycast(ray, THREE.DoubleSide).length % 2 === 1
    d[(z * n + y) * n + x] = Math.round(Math.max(0, Math.min(1, (inside ? -dist : dist) + 0.5)) * 255)
  }
  return writeGrid(d)
}
/** A 3D model becomes a thing. False (and a message) if the file holds no shape that can be read. */
export async function importModel(file: File): Promise<boolean> {
  try {
    if (!file.size) throw new Said("That model file is empty.")
    if (file.size > 80_000_000) throw new Said("That model is too large to bring in here (over 80 MB). Try a lighter version.")
    const geos: THREE.BufferGeometry[] = []; let root: THREE.Object3D, tris = 0
    if (/\.obj$/i.test(file.name)) root = new OBJLoader().parse(await file.text())
    else { const buf = await file.arrayBuffer(), head = new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(4, buf.byteLength)))
      if (head !== "glTF" && !/^\s*\{/.test(new TextDecoder().decode(new Uint8Array(buf, 0, Math.min(64, buf.byteLength))))) throw new Said("That file is not a .glb or .gltf model. Try exporting it again.")
      root = (await new GLTFLoader().parseAsync(buf, "")).scene }
    root.updateMatrixWorld(true)
    root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh || !m.geometry?.attributes.position) return; const g = new THREE.BufferGeometry(); const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry
      tris += src.attributes.position.count / 3; if (tris > 3_000_000) throw new Said("That model has too many triangles to bring in here. Try a lighter version.")
      g.setAttribute("position", src.attributes.position.clone()); g.applyMatrix4(m.matrixWorld); geos.push(g) })
    if (!geos.length) throw new Said("That file has no shape in it that could be read.")
    const merged = mergeGeometries(geos); if (!merged) throw new Said("That model's pieces could not be joined into one shape.")
    merged.computeBoundingBox(); const bb = merged.boundingBox!; if (![bb.min.x, bb.min.y, bb.min.z, bb.max.x, bb.max.y, bb.max.z].every(isFinite)) throw new Said("That model's shape is broken. Try exporting it again.")
    const n = 60, data = await meshToGrid(merged, n)
    if (get().world.things.filter((t) => t.kind !== "model").length >= MAX_THINGS) throw new Said(`A world holds up to ${MAX_THINGS} things. Remove one to make room for the model.`)
    edit("import-model", (w) => { w.model = { n, data }; w.things = w.things.filter((t) => t.kind !== "model") })
    const w = get().world; addThing(thing("model", [w.cam.target[0], Math.max(2.4, w.cam.target[1]), w.cam.target[2]], 2.4, mat("Chrome"), { name: file.name.replace(/\.[^.]+$/, "").slice(0, 30) || "Imported model" }))
    return true
  } catch (e) { return told(e, "That file had no shape that could be read. Try a .glb or .obj model.") }
}
/** Any file someone drops or picks: sent to whatever can use it, or a kind word saying what can. */
export async function openFile(file: File): Promise<boolean> {
  const name = file.name.toLowerCase()
  if (/\.(glb|gltf|obj)$/.test(name)) { notify("Reading the model…", { ms: 2500 }); const ok = await importModel(file); if (ok) notify("The model is in the world. Undo to take it out."); return ok }
  if (/\.(ttf|otf|woff2?)$/.test(name)) { const { loadCustomFont } = await import("./text"); const ok = await loadCustomFont(file); notify(ok ? "Your font is ready: pick \u201cMy font\u201d for any lettering." : "That font file could not be read. Try a .ttf, .otf or .woff file."); return ok }
  notify("That kind of file cannot be used here. Drop a photo, a 3D model (.glb, .obj) or a font (.ttf, .otf, .woff).")
  return false
}
export const pickFile = (accept: string) => new Promise<File | null>((ok) => { const i = document.createElement("input"); i.type = "file"; i.accept = accept; i.onchange = () => ok(i.files?.[0] ?? null); i.click() })
