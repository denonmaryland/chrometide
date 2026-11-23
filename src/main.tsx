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
createRoot(document.getElementById("root")!).render(q.has("api") ? <Api /> : bare ? <EngineTest /> : <App />)
