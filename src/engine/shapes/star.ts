// A five-pointed star with a sharp ridge running to every point, like a pressed metal badge.
// The dial makes the points longer and thinner.
import { Star } from "lucide-react"
import * as THREE from "three"
import type { Shape } from "."

const RIM = 0.05, SLOPE = 1.1
function starMesh(r = 0.5) {
  const ri = 0.62 + (0.3 - 0.62) * r, step = Math.PI / 5, e = [ri * Math.sin(step) - 0, ri * Math.cos(step) - 1]
  const peak = RIM + SLOPE * Math.abs(e[0]) / Math.hypot(e[0], e[1]) // the middle is as thick as it is far from an edge
  const rim = Array.from({ length: 10 }, (_, k) => { const rad = k % 2 ? ri : 1; return [rad * Math.sin(k * step), rad * Math.cos(k * step)] })
  const v: number[] = [], tri = (...p: number[][]) => p.forEach((q) => v.push(...q))
  for (let k = 0; k < 10; k++) { const [a, b] = [rim[k], rim[(k + 1) % 10]]
    tri([0, 0, peak], [a[0], a[1], RIM], [b[0], b[1], RIM]); tri([0, 0, -peak], [b[0], b[1], -RIM], [a[0], a[1], -RIM])
    tri([a[0], a[1], -RIM], [b[0], b[1], -RIM], [b[0], b[1], RIM]); tri([a[0], a[1], -RIM], [b[0], b[1], RIM], [a[0], a[1], RIM]) }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals(); return g
}

export default {
  id: "star", label: "Star", icon: Star, size: [1.4, 1.4, 1.4], dial: { label: "Sharpness", value: 0.5 },
  glsl: `
  float s = 1.2566371, ri = mix(.62, .3, r);           // a fifth of a turn; how far in the notches are
  float a = abs(mod(atan(p.x, p.y) + s * .5, s) - s * .5);
  vec2 q = length(p.xy) * vec2(cos(a), sin(a));
  vec2 A = vec2(1., 0.), e = ri * vec2(cos(s * .5), sin(s * .5)) - A, w = q - A;
  float h = clamp(dot(w, e) / dot(e, e), 0., 1.);
  float edge = length(w - e * h) * (e.x * w.y - e.y * w.x > 0. ? -1. : 1.);
  return max(edge, (abs(p.z) + edge * ${SLOPE.toFixed(2)} - ${RIM.toFixed(2)}) * .67);`,
  wire: () => new THREE.EdgesGeometry(starMesh(), 1),
  mesh: () => starMesh(),
} satisfies Shape
