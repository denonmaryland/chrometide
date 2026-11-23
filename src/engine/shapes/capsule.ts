// A pill: a round-ended tube standing up. The smallest example of a shape.
import { Pill } from "lucide-react"
import * as THREE from "three"
import type { Shape } from "."

export default {
  id: "capsule", label: "Capsule", icon: Pill, size: [1, 1.5, 1],
  glsl: "p.y -= clamp(p.y, -.45, .45); return length(p) - .55;",
  wire: () => new THREE.WireframeGeometry(new THREE.CapsuleGeometry(0.55, 0.9, 3, 10)),
  mesh: () => new THREE.CapsuleGeometry(0.55, 0.9, 10, 40),
} satisfies Shape
