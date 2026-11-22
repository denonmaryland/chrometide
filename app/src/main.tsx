import { createRoot } from "react-dom/client"

import "./index.css"
import { App } from "./App"
import { EngineTest } from "./EngineTest"
import * as io from "./io"
import * as store from "./store"

// a handle for the test scripts
;(window as any).__app = store
;(window as any).__io = io

const bare = new URLSearchParams(location.search).get("test") === "engine"
createRoot(document.getElementById("root")!).render(bare ? <EngineTest /> : <App />)
