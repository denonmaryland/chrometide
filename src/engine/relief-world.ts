// An original tidal chart carved in low relief. The front of the slab faces +Z.
// Use the same editable distance volume as a model import so orbit, shadows,
// reflections and saved worlds all see the actual depth of the carving.
import { camFrom, mat, off, seaFrom, SEAS, skyFrom, SKIES, thing, world } from "./scene"

import { tidalCarving } from "./tidal-carving"

export function makeRelief() {
  const sky = skyFrom(SKIES[0], { zenith: "#283843", horizon: "#8e9287", haze: "#989284",
    cloud: 0.12, ambient: 0.35, sun: { az: -1.21, el: 0.31 }, sunColor: "#ffe0ae" })
  const floor = seaFrom(SEAS[0], { kind: "checker", c1: "#3a3939", c2: "#3d3b38", reflect: 0.12 })
  const clay = { ...mat("Clay"), color: "#b98153", color2: "#694b3a", reflect: 0.08, shine: 0.22 }
  const slab = thing("model", [0, 3.22, 0], [3.7, 3.25, 3.05], clay, { name: "Tidal carving" })
  const base = thing("box", [0, 0.19, 0], [3.58, 0.19, 0.98], { ...mat("Stone"), color: "#554a45", color2: "#514844", bump: 0.12 }, { name: "Plinth", round: 0.04 })
  return world("Tidal Tablet", sky, floor, off(), [slab, base],
    camFrom({ target: [0, 3.0, 0], dist: 12.6, fov: 43, yaw: 0.22, pitch: 0.12 }), { model: tidalCarving() })
}
