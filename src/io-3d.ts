// 3D files in and out: the world as ordinary meshes for .glb and .obj, and imported models turned
// into a grid of distances the ray tracer can draw. Loaded on first use (see ./io).
import * as THREE from "three"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js"
import { OBJExporter } from "three/examples/jsm/exporters/OBJExporter.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js"
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js"
import { MeshBVH } from "three-mesh-bvh"

import { type Thing, type World, MAX_THINGS, mat, thing } from "./engine/scene"
import { SHAPE_BY_ID } from "./engine/shapes"
import { Said, save, told } from "./io"
import { edit, engine, get, patch } from "./store"
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
    default: return SHAPE_BY_ID[t.kind]?.mesh?.(t.round ?? SHAPE_BY_ID[t.kind]?.dial?.value ?? 0.5) ?? null // a shape without a mesh is left out of exports
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
export async function exportGLB(): Promise<number> {
  const w = get().world, buf = (await new GLTFExporter().parseAsync(toMeshes(w), { binary: true })) as ArrayBuffer
  save(new Blob([buf], { type: "model/gltf-binary" }), `${fileName(w.name)}.glb`); return buf.byteLength
}
export function exportOBJ(): number { const w = get().world, text = new OBJExporter().parse(toMeshes(w)); save(new Blob([text], { type: "text/plain" }), `${fileName(w.name)}.obj`); return text.length }
/** An imported mesh becomes a grid of distances to its surface, which the ray tracer can draw, cut and reflect like any other thing. */
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
    // A thin wall can sit entirely between samples. Give new imports half a
    // cell of surface thickness so the interpolated field still crosses zero.
    const surfaceDistance = (inside ? -dist : dist) - 1 / n
    d[(z * n + y) * n + x] = Math.round(Math.max(0, Math.min(1, surfaceDistance + 0.5)) * 255)
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
    const world = get().world
    const remaining = world.things.filter((t) => t.kind !== "model")
    if (remaining.length >= MAX_THINGS) throw new Said(`A world holds up to ${MAX_THINGS} things. Remove one to make room for the model.`)
    const [x, y, z] = world.cam.target
    const name = file.name.replace(/\.[^.]+$/, "").slice(0, 30) || "Imported model"
    const imported = thing("model", [x, Math.max(2.4, y), z], 2.4, mat("Chrome"), { name })
    edit(`import-model:${imported.id}`, (w) => {
      w.model = { n, data }
      w.things = [...w.things.filter((t) => t.kind !== "model"), imported]
    })
    patch({ sel: { type: "thing", id: imported.id } })
    return true
  } catch (e) { return told(e, "That file had no shape that could be read. Try a .glb or .obj model.") }
}
