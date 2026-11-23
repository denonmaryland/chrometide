// In and out: 3D files, pictures that become land, pictures for materials.
import * as THREE from "three"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js"
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { MeshBVH } from "three-mesh-bvh"

import { GRID } from "./engine/engine"
import { type Thing, type World, mat, thing } from "./engine/scene"
import { addThing, edit, engine, get } from "./store"
import { fileName } from "./ui/TopBar"
import { writeGrid } from "./ui/Viewport"

const rad = THREE.MathUtils.degToRad
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
    case "tree": return mergeGeometries([new THREE.CylinderGeometry(0.1, 0.1, 0.9, 10).translate(0, -0.55, 0), new THREE.IcosahedronGeometry(0.62, 2).translate(0, 0.3, 0)])
    case "pine": return mergeGeometries([new THREE.CylinderGeometry(0.08, 0.08, 0.6, 10).translate(0, -0.7, 0), ...[0, 1, 2].map((j) => new THREE.ConeGeometry(0.4 + j * 0.2, 0.78, 16).translate(0, 1 - j * 0.36 - 0.39, 0))])
    default: return null
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

/** An imported mesh becomes a grid of distances to its surface, which the ray tracer can draw, cut and reflect like any other thing. */
export function meshToGrid(geo: THREE.BufferGeometry, n = 44): string {
  const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.computeBoundingBox(); const bb = g.boundingBox!, c = bb.getCenter(new THREE.Vector3()), size = bb.getSize(new THREE.Vector3())
  const k = 1.7 / Math.max(size.x, size.y, size.z, 1e-6); g.translate(-c.x, -c.y, -c.z); g.scale(k, k, k)
  const bvh = new MeshBVH(g), d = new Uint8Array(n * n * n), p = new THREE.Vector3(), hit = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 }
  const ray = new THREE.Ray(new THREE.Vector3(), new THREE.Vector3(0.577, 0.577, 0.577).normalize())
  for (let z = 0; z < n; z++) for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    p.set(((x + 0.5) / n) * 2 - 1, ((y + 0.5) / n) * 2 - 1, ((z + 0.5) / n) * 2 - 1)
    const dist = bvh.closestPointToPoint(p, hit as any)?.distance ?? 1
    ray.origin.copy(p); const inside = bvh.raycast(ray, THREE.DoubleSide).length % 2 === 1
    d[(z * n + y) * n + x] = Math.round(Math.max(0, Math.min(1, (inside ? -dist : dist) + 0.5)) * 255)
  }
  return writeGrid(d)
}
export async function importModel(file: File): Promise<boolean> {
  const geos: THREE.BufferGeometry[] = []; let root: THREE.Object3D
  if (/\.obj$/i.test(file.name)) root = new OBJLoader().parse(await file.text())
  else root = (await new GLTFLoader().parseAsync(await file.arrayBuffer(), "")).scene
  root.updateMatrixWorld(true)
  root.traverse((o) => { const m = o as THREE.Mesh; if (!m.isMesh || !m.geometry?.attributes.position) return; const g = new THREE.BufferGeometry(); const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry
    g.setAttribute("position", src.attributes.position.clone()); g.applyMatrix4(m.matrixWorld); geos.push(g) })
  if (!geos.length) return false
  const merged = mergeGeometries(geos); if (!merged) return false
  const n = 60, data = meshToGrid(merged, n)
  edit("import-model", (w) => { w.model = { n, data }; w.things = w.things.filter((t) => t.kind !== "model") })
  const w = get().world; addThing(thing("model", [w.cam.target[0], Math.max(2.4, w.cam.target[1]), w.cam.target[2]], 2.4, mat("Chrome"), { name: file.name.replace(/\.[^.]+$/, "").slice(0, 30) || "Imported model" }))
  return true
}
export const pickFile = (accept: string) => new Promise<File | null>((ok) => { const i = document.createElement("input"); i.type = "file"; i.accept = accept; i.onchange = () => ok(i.files?.[0] ?? null); i.click() })
