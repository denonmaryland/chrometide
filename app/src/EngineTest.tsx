// A bare page for testing the engine alone: ?w=<index of a starting world>
import * as React from "react"

import { Engine } from "./engine/engine"
import { loadFonts } from "./engine/lettering"
import { SKIES, applySky } from "./engine/scene"
import { WORLDS } from "./engine/worlds"

export function EngineTest() {
  const ref = React.useRef<HTMLCanvasElement>(null)
  React.useEffect(() => {
    const e = new Engine(ref.current!); (window as any).__engine = e; 
    if (!e.ok) { document.title = "ERR " + e.error; return }
    const q = new URLSearchParams(location.search)
    e.setSize(960, 720); e.setQuality(+(q.get("s") ?? 12)); void loadFonts().then(() => { const w = WORLDS[+(q.get("w") ?? 0)].make(); if (q.get("sky")) applySky(w.sky, SKIES[+q.get("sky")!]); e.setWorld(w); document.title = String(WORLDS.length) + "/" + SKIES.length })
    return () => e.dispose()
  }, [])
  return <canvas ref={ref} style={{ width: 960, height: 720, display: "block" }} />
}
