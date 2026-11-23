// A cut jewel: a flat table on top, a ring of facets round the crown, a pointed underside.
// Eight-sided, with a second ring of facets turned half a step so the light breaks up.
import { Gem } from "lucide-react"
import * as THREE from "three"
import type { Shape } from "."

// the outline of half the stone, from the point at the bottom up to the middle of the table
const PROFILE = [[0, -1], [0.92, -0.06], [0.92, 0.06], [0.56, 0.42], [0, 0.42]] as const
const lathe = (sides: number) => new THREE.LatheGeometry(PROFILE.map(([x, y]) => new THREE.Vector2(x / Math.cos(Math.PI / sides), y)), sides, Math.PI / sides)

export default {
  id: "gem", label: "Gem", icon: Gem, size: [1.3, 1.3, 1.3],
  helpers: `vec2 gem_fold(vec2 p){ float a = atan(p.y, p.x); a = mod(a + .3926991, .7853982) - .3926991; return length(p) * vec2(cos(a), sin(a)); }`,
  glsl: `
  vec2 a = gem_fold(p.xz), b = gem_fold(mat2(.9238795, .3826834, -.3826834, .9238795) * p.xz);
  float d = max(a.x - .92, p.y - .42);                                       // girdle and table
  d = max(d, dot(vec2(a.x, p.y) - vec2(.92, .06), normalize(vec2(.36, .36)))); // crown
  d = max(d, dot(vec2(b.x, p.y) - vec2(.96, .06), normalize(vec2(.30, .42)))); // star facets
  d = max(d, dot(vec2(a.x, p.y) - vec2(.92, -.06), normalize(vec2(.94, -.88)))); // underside
  d = max(d, dot(vec2(b.x, p.y) - vec2(.97, -.06), normalize(vec2(.94, -.80))));
  return d;`,
  wire: () => new THREE.EdgesGeometry(lathe(8), 10),
  mesh: () => lathe(8),
} satisfies Shape
