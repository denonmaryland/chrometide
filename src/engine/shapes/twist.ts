// A square column with soft corners, wrung like a towel, on a base and under a cap.
// The dial sets how far it is twisted.
import { Tornado } from "lucide-react"
import * as THREE from "three"
import type { Shape } from "."

function column(turn = 0.5 + 3 * 0.4, rows = 24) {
  const shaft = new THREE.BoxGeometry(1.2, 1.64, 1.2, 1, rows, 1), p = shaft.attributes.position
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), a = y * turn, x = p.getX(i), z = p.getZ(i); p.setXYZ(i, x * Math.cos(a) - z * Math.sin(a), y, x * Math.sin(a) + z * Math.cos(a)) }
  shaft.computeVertexNormals()
  const plate = (y: number) => new THREE.BoxGeometry(1.58, 0.2, 1.58).translate(0, y, 0)
  return [shaft, plate(0.9), plate(-0.9)]
}
const merge = (gs: THREE.BufferGeometry[]) => { const out = new THREE.BufferGeometry(), pos: number[] = []; for (const g of gs) { const n = g.index ? g.toNonIndexed() : g; pos.push(...(n.attributes.position.array as Float32Array)) } out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); out.computeVertexNormals(); return out }

export default {
  id: "twist", label: "Twisted column", icon: Tornado, size: [0.8, 2.2, 0.8], dial: { label: "Twist", value: 0.4 },
  glsl: `
  float tw = mix(.5, 3.5, r), c = cos(p.y * tw), s = sin(p.y * tw);
  vec2 q = mat2(c, -s, s, c) * p.xz, b = abs(q) - .46;
  float shaft = max(length(max(b, 0.)) + min(max(b.x, b.y), 0.) - .14, abs(p.y) - .84);
  shaft /= sqrt(1. + tw * tw * .65);                       // wringing stretches space: step carefully
  vec3 e = vec3(abs(p.x), abs(abs(p.y) - .9), abs(p.z)) - vec3(.76, .07, .76);
  return min(shaft, length(max(e, 0.)) + min(max(e.x, max(e.y, e.z)), 0.) - .03);`,
  wire: () => new THREE.EdgesGeometry(merge(column()), 20),
  mesh: () => merge(column()),
} satisfies Shape
