// Walk inside: two ways into the world. Fly through it live, or look all around one spot (on a
// screen, by tilting a phone, or in a VR headset).
import { Bird, Orbit } from "lucide-react"

import { engine } from "@/store"

import type { Feature } from "./index"
import { FlyOverlay, startFly } from "./fly"
import { LookOverlay, openLook } from "./look"

/** Start when the page is opened as ?fly or ?look, once the picture is running. */
const whenReady = (go: () => void) => { let n = 0; const t = setInterval(() => { if (engine?.ok || ++n > 60) { clearInterval(t); if (engine?.ok) setTimeout(go, 400) } }, 250) }

export const WALK: Feature[] = [
  { id: "fly", label: "Fly", about: "Move through the world yourself: keys or a thumbstick, drag to look.", icon: Bird, run: startFly, Overlay: FlyOverlay, boot: (q) => { if (q.has("fly")) whenReady(startFly) } },
  { id: "look", label: "Look around", about: "Stand in the world and look all around. Tilt a phone, or use VR.", icon: Orbit, run: () => void openLook(), Overlay: LookOverlay, boot: (q) => { if (q.has("look")) whenReady(() => void openLook()) } },
]
