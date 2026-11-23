// The timeline: keys along a line. A key remembers the whole pose of the world at that moment;
// between keys everything glides.
import * as React from "react"
import { Diamond, Pause, Play, Repeat, Spline, Trash2, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { keyAt } from "@/engine/anim"
import { addKey, edit, get, patch, removeKey, seek, useApp } from "@/store"

import { Tip } from "./Viewport"

export function Timeline() {
  const anim = useApp((s) => s.world.anim), t = useApp((s) => s.playhead), playing = useApp((s) => s.playing)
  const track = React.useRef<HTMLDivElement>(null)
  const seconds = anim?.seconds ?? 6, keys = anim?.keys ?? [], on = keyAt(anim, t)
  React.useEffect(() => {
    if (!playing) return; let raf = 0, last = performance.now()
    const tick = (now: number) => { const s = get(), an = s.world.anim; if (!an || an.keys.length < 2) { patch({ playing: false }); return }
      let n = s.playhead + (now - last) / 1000 / an.seconds; last = now
      if (n >= 1) { if (an.loop) n -= 1; else { seek(1); patch({ playing: false }); return } } seek(n); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf)
  }, [playing])
  const drag = (e: React.PointerEvent) => { const r = track.current!.getBoundingClientRect(); let x = (e.clientX - r.left) / r.width
    const near = keys.find((k) => Math.abs(k.t - x) < 0.012); if (near) x = near.t; seek(x) }
  return (
    <div className="glass-panel mx-2 mb-2 flex h-12 shrink-0 items-center gap-1 rounded-lg px-1.5 sm:gap-2 sm:px-2" data-testid="timeline" role="region" aria-label="Timeline">
      <Tip label={playing ? "Pause" : keys.length < 2 ? "Add two keys to play" : "Play"}><Button variant="ghost" size="icon-sm" disabled={keys.length < 2} onClick={() => patch({ playing: !playing })} aria-label="Play" data-testid="tl-play">{playing ? <Pause /> : <Play />}</Button></Tip>
      <span className="w-10 shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums sm:w-12">{(t * seconds).toFixed(1)}s</span>
      <div ref={track} className="relative h-7 min-w-0 flex-1 cursor-ew-resize touch-none rounded-md bg-muted/50" data-testid="tl-track"
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); patch({ playing: false }); drag(e) }} onPointerMove={(e) => e.buttons && drag(e)}>
        {Array.from({ length: Math.round(seconds) + 1 }, (_, i) => <span key={i} className="absolute top-0 h-1.5 w-px bg-border" style={{ left: `${(i / seconds) * 100}%` }} />)}
        {keys.map((k, i) => <span key={i} className={cn("absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px] bg-foreground/70", i === on && "bg-foreground ring-2 ring-foreground/30")} style={{ left: `${k.t * 100}%` }} />)}
        <span className="pointer-events-none absolute inset-y-0 w-px bg-foreground" style={{ left: `${t * 100}%` }}><span className="absolute -top-0.5 -left-1 size-2 rounded-full bg-foreground" /></span>
        {keys.length === 0 && <span className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden px-3 text-[11.5px] whitespace-nowrap text-muted-foreground"><span className="truncate"><span className="sm:hidden">Press Key, move along, change, Key again</span><span className="max-sm:hidden">Set the world how you like it, then press Key. Move along, change something, press Key again.</span></span></span>}
      </div>
      <Tip label={on >= 0 ? "Remember the world as it is now, at this key" : "Remember the world as it is now, at this moment"}><Button variant={on >= 0 ? "glass" : "ghost"} size="sm" className="shrink-0" onClick={addKey} data-testid="tl-key"><Diamond /> {on >= 0 ? <><span className="max-sm:hidden">Update key</span><span className="sm:hidden">Key</span></> : "Key"}</Button></Tip>
      {on >= 0 && <Tip label="Remove this key"><Button variant="ghost" size="icon-sm" onClick={() => removeKey(on)} aria-label="Remove key"><Trash2 /></Button></Tip>}
      <Tip label="Loop back to the start"><Button variant={anim?.loop ?? true ? "glass" : "ghost"} size="icon-sm" disabled={!anim} onClick={() => edit("anim-loop", (w) => { if (w.anim) w.anim.loop = !w.anim.loop })} aria-label="Loop back to the start" className="max-sm:hidden"><Repeat /></Button></Tip>
      <Tip label="Ease in and out of each key"><Button variant={anim?.ease ?? true ? "glass" : "ghost"} size="icon-sm" disabled={!anim} onClick={() => edit("anim-ease", (w) => { if (w.anim) w.anim.ease = !w.anim.ease })} aria-label="Ease in and out" className="max-sm:hidden"><Spline /></Button></Tip>
      <select value={seconds} disabled={!anim} onChange={(e) => edit("anim-secs", (w) => { if (w.anim) w.anim.seconds = +e.target.value })} aria-label="Length" title="How long the animation lasts" className="h-7 shrink-0 rounded-sm bg-muted/60 px-1 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-ring">{[2, 4, 6, 8, 10, 15, 20, 30].map((n) => <option key={n} value={n}>{n}s</option>)}</select>
      <Tip label="Close the timeline"><Button variant="ghost" size="icon-sm" onClick={() => patch({ timeline: false, playing: false })} aria-label="Close timeline"><X /></Button></Tip>
    </div>
  )
}
