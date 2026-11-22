// A bare page for testing the engine alone: ?w=<index of a starting world>
import * as React from "react"

import { Engine } from "./engine/engine"
import { STARTERS } from "./engine/scene"

export function EngineTest() {
  const ref = React.useRef<HTMLCanvasElement>(null)
  React.useEffect(() => {
    const e = new Engine(ref.current!); (window as any).__engine = e; (window as any).__starters = STARTERS
    if (!e.ok) { document.title = "ERR " + e.error; return }
    const q = new URLSearchParams(location.search)
    e.setSize(960, 720); e.setQuality(+(q.get("s") ?? 12)); e.setWorld(STARTERS[+(q.get("w") ?? 0)]())
    return () => e.dispose()
  }, [])
  return <canvas ref={ref} style={{ width: 960, height: 720, display: "block" }} />
}
