// Walk inside: two ways into the world. Fly through it live, or look all around one spot (on a
// screen, by tilting a phone, or in a VR headset).
import { engine } from "@/store"

import type { FeatureCode } from "./lazy"
import { FlyOverlay, startFly } from "./fly"
import { LookOverlay, openLook } from "./look"

/** Start when the page is opened as ?fly or ?look, once the picture is running. */
const whenReady = (go: () => void) => { let n = 0; const t = setInterval(() => { if (engine?.ok || ++n > 60) { clearInterval(t); if (engine?.ok) setTimeout(go, 400) } }, 250) }

export const fly: FeatureCode = { run: startFly, Overlay: FlyOverlay, boot: (q) => { if (q.has("fly")) whenReady(startFly) } }
export const look: FeatureCode = { run: () => void openLook(), Overlay: LookOverlay, boot: (q) => { if (q.has("look")) whenReady(() => void openLook()) } }
