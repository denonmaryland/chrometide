import * as React from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import { App } from "./App"
import { loadFonts } from "./engine/lettering"
import * as audio from "./audio"
import * as io from "./io"
import * as sound from "./sound"
import * as store from "./store"
import * as text from "./text"
import { notify } from "./notice"
import { Notices, Safety, Trouble } from "./ui/Notice"

// the agent page and the bare engine page are separate, and load only when asked for
const Api = React.lazy(() => import("./Api").then((m) => ({ default: m.Api })))
const EngineTest = React.lazy(() => import("./EngineTest").then((m) => ({ default: m.EngineTest })))

// a handle for the test scripts; the parts that load later join it once they are here
;(window as any).__app = store
;(window as any).__io = { ...io }
;(window as any).__text = text
;(window as any).__audio = audio
;(window as any).__sound = sound
const handles = () => Promise.all([import("./io-3d"), import("./design/layouts"), import("./design/presets"), import("./features/island")]).then(([io3, layouts, presets, island]) => {
  Object.assign((window as any).__io, io3); (window as any).__designs = { ...layouts, ...presets }
  ;(window as any).__islandLib = { parse: island.parseCalendar, stats: island.stats, build: island.islandWorld }
})
if ("requestIdleCallback" in window) requestIdleCallback(() => void handles(), { timeout: 3000 }); else setTimeout(() => void handles(), 1500)

// letters are drawn with real fonts: once they have arrived, draw them again
void loadFonts().then(() => store.engine?.resetGlyphs())

// once opened, the app can be installed and opened again with no connection
if (import.meta.env.PROD && "serviceWorker" in navigator && location.protocol === "https:") void navigator.serviceWorker.register("./sw.js").catch(() => {})

const q = new URLSearchParams(location.search), bare = q.get("test") === "engine"
// a step that fails out of sight still gets a kind word, so nothing just silently does not happen
addEventListener("unhandledrejection", (e) => { console.warn("Unfinished:", e.reason); if ((e.reason as Error)?.name !== "AbortError") notify("That did not work. Your world is unchanged; try again.") })
/** Can this browser draw in 3D at all? Asked once, before the app starts, so it can say so plainly. */
function canDraw() {
  try { const gl = document.createElement("canvas").getContext("webgl2"); if (!gl) return false; gl.getExtension("WEBGL_lose_context")?.loseContext(); return true } catch { return false }
}
const noGraphics = (
  <Trouble title="This browser cannot draw the worlds" actions={[{ label: "Try again", run: () => location.reload() }]}>
    <p>Untitled Worlds ray traces its pictures with WebGL2, and this browser or device is not offering it right now.</p>
    <p className="mt-2">Try a current Chrome, Edge, Firefox or Safari. If you already use one, turn on hardware acceleration (or graphics acceleration) in its settings and restart it, or open the page on another device.</p>
  </Trouble>
)
createRoot(document.getElementById("root")!).render(q.has("api") ? <React.Suspense fallback={null}><Api /></React.Suspense> : bare ? <React.Suspense fallback={null}><EngineTest /></React.Suspense> : canDraw() ? <Safety><App /><Notices /></Safety> : noGraphics)
