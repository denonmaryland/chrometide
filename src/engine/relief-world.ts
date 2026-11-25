// An original tidal chart carved in low relief. The front of the slab faces +Z.
// Use the same editable distance volume as a model import so orbit, shadows,
// reflections and saved worlds all see the actual depth of the carving.
import { camFrom, mat, off, seaFrom, SEAS, skyFrom, SKIES, thing, world } from "./scene"

function carving() {
  const n = 48
  const slices = Array<string>(n)
  const heights = new Float32Array(n * n)
  const coord = (i: number) => (i + 0.5) * 2 / n - 1
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const x = coord(col), y = coord(row)
      // Contours around two offshore banks join into one ridge at low water.
      const a = Math.hypot((x + 0.29) * 1.08, (y - 0.15) * 0.81)
      const b = Math.hypot((x - 0.32) * 1.29, (y + 0.27) * 1.08)
      const contour = Math.min(a, b) + 0.048 * Math.sin(5 * y + 2 * x)
      const wave = 0.5 + 0.5 * Math.cos(25 * contour)
      const border = Math.max(Math.abs(x) / 0.87, Math.abs(y) / 0.9)
      const inset = Math.min(1, Math.max(0, (0.94 - border) * 12))
      heights[row * n + col] = 0.08 + 0.23 * wave * wave * inset
    }
  }
  for (let z = 0; z < n; z++) {
    const bytes = new Uint8Array(n * n)
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const face = (coord(z) - heights[y * n + x]) * 0.40
      const edge = Math.max(Math.abs(coord(x)) - 0.87, Math.abs(coord(y)) - 0.9)
      const distance = Math.max(edge, -0.14 - coord(z), face)
      bytes[y * n + x] = Math.round(Math.max(0, Math.min(1, distance + 0.5)) * 255)
    }
    slices[z] = String.fromCharCode(...bytes)
  }
  return { n, data: btoa(slices.join("")) }
}

export function makeRelief() {
  const sky = skyFrom(SKIES[0], { zenith: "#283843", horizon: "#8e9287", haze: "#989284",
    cloud: 0.12, ambient: 0.35, sun: { az: -1.21, el: 0.31 }, sunColor: "#ffe0ae" })
  const floor = seaFrom(SEAS[0], { kind: "checker", c1: "#3a3939", c2: "#3d3b38", reflect: 0.12 })
  const clay = { ...mat("Clay"), color: "#b98153", color2: "#694b3a", reflect: 0.08, shine: 0.22 }
  const slab = thing("model", [0, 3.22, 0], [3.7, 3.25, 3.05], clay, { name: "Tidal carving" })
  const base = thing("box", [0, 0.19, 0], [3.58, 0.19, 0.98], { ...mat("Stone"), color: "#554a45", color2: "#514844", bump: 0.12 }, { name: "Plinth", round: 0.04 })
  return world("Tidal Tablet", sky, floor, off(), [slab, base],
    camFrom({ target: [0, 3.0, 0], dist: 12.6, fov: 43, yaw: 0.22, pitch: 0.12 }), { model: carving() })
}
