// Shapes plug in here. Every other file in this folder is one shape: it exports a Shape as its
// default, and at build time the app gathers them, adds their distance functions to the ray tracer,
// and lists them in the Add menu, the kind picker, the agent API and the MCP server.
// See CONTRIBUTING.md, "Add a shape".
import type * as React from "react"
import type * as THREE from "three"

export interface Shape {
  /** Stored in worlds and share links. Lowercase letters and digits. Never change it once shipped. */
  id: string
  /** Plain words for menus: "Gem", "Twisted column". */
  label: string
  /**
   * The body of a GLSL function `float f(vec3 p, float r)` that returns the distance from p to the
   * shape. The shape must fit inside the box from -1 to 1 on every axis (y is up). r is the thing's
   * dial value (0 to 1). If the number can be too big (twists, bends), multiply it down: a distance
   * that is too small only costs speed, one that is too big makes holes.
   */
  glsl: string
  /** Outline drawn round the shape when it is selected, in the same -1 to 1 box. r is the dial value. */
  wire: (r: number) => THREE.BufferGeometry
  /** A lucide icon for the menus. */
  icon: React.ComponentType<{ className?: string }>
  /** A mesh for 3D export (.glb, .obj). Without one the shape is left out of exports. */
  mesh?: (r: number) => THREE.BufferGeometry
  /** Extra GLSL functions the body uses. Name them after the shape so they do not clash. */
  helpers?: string
  /** Half-sizes a new one starts with (default 1.2 on every side). */
  size?: [number, number, number]
  /** A material name a new one starts with (default Chrome). */
  material?: string
  /** One slider in the inspector that sets r. */
  dial?: { label: string; value: number }
}

const BUILT_IN = ["sphere", "box", "pyramid", "cylinder", "cone", "torus", "disc", "stone", "blob", "tree", "pine", "crag", "model", "text", "cutout"]
const files = import.meta.glob<{ default: Shape }>(["./*.ts", "!./index.ts"], { eager: true })
export const SHAPES: Shape[] = []
for (const [file, m] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
  const s = m.default
  if (!s || !/^[a-z][a-z0-9]{0,23}$/.test(s.id) || BUILT_IN.includes(s.id) || SHAPES.some((x) => x.id === s.id)) { console.warn(`Shape in ${file} was skipped: its id must be new, lowercase letters and digits.`); continue }
  SHAPES.push(s)
}
export const SHAPE_BY_ID: Record<string, Shape | undefined> = Object.fromEntries(SHAPES.map((s) => [s.id, s]))

/** The GLSL the shapes add to the ray tracer: their functions, and one branch each in sdThing. */
export const shapeFunctions = () => SHAPES.map((s) => `${s.helpers ?? ""}\nfloat shape_${s.id}(vec3 p, float r){\n${s.glsl}\n}`).join("\n")
export const shapeBranches = (kindNumber: (id: string) => number) => SHAPES.map((s) => `else if (k == ${kindNumber(s.id)}) d = shape_${s.id}(u, r);`).join("\n  ")
