import { createRoot } from "react-dom/client"

import "./index.css"
import { App } from "./App"
import { loadFonts } from "./engine/lettering"
import { EngineTest } from "./EngineTest"
import * as audio from "./audio"
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

// letters are drawn with real fonts: once they have arrived, draw them again
void loadFonts().then(() => store.engine?.resetGlyphs())

const bare = new URLSearchParams(location.search).get("test") === "engine"
createRoot(document.getElementById("root")!).render(bare ? <EngineTest /> : <App />)
