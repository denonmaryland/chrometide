import { createRoot } from "react-dom/client"

import "./index.css"
import { Api } from "./Api"
import { App } from "./App"
import { loadFonts } from "./engine/lettering"
import { EngineTest } from "./EngineTest"
import * as audio from "./audio"
import * as layouts from "./design/layouts"
import * as presets from "./design/presets"
import * as io from "./io"
import * as sound from "./sound"
import * as store from "./store"
import * as text from "./text"
import { notify } from "./notice"
import { Notices, Safety, Trouble } from "./ui/Notice"

// a handle for the test scripts
;(window as any).__app = store
;(window as any).__io = io
;(window as any).__text = text
;(window as any).__audio = audio
;(window as any).__sound = sound
;(window as any).__designs = { ...layouts, ...presets }

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
createRoot(document.getElementById("root")!).render(q.has("api") ? <Api /> : bare ? <EngineTest /> : canDraw() ? <Safety><App /><Notices /></Safety> : noGraphics)
