// The picture, and everything you do by touching it: look around, move things, drag the sun,
// push the land up and down.
import * as React from "react"
import * as THREE from "three"
import { Box, Boxes, Type, Circle, Cone, Copy, Cylinder, Dices, Diamond, Donut, Droplet, Lock, LockOpen, Mountain, Plus, Scissors, Trash2, TreeDeciduous, TreePine, Triangle, ArrowDownToLine, Disc } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { nowLevels } from "@/audio"
import { Engine, GRID, QUALITY } from "@/engine/engine"
import { react } from "@/sound"
import { type Kind, type LockKey, type Vec3, KINDS, KIND_LABEL, mat, thing } from "@/engine/scene"
import { WordBox } from "@/features/word-world"
import { SHAPE_BY_ID, SHAPES } from "@/engine/shapes"
import { addThing, duplicateThing, edit, editThing, engine, get, patch, removeThing, rollDice, selectedThing, setEngine, toggleLock, useApp } from "@/store"

export const KIND_ICON: Record<Kind, React.ComponentType<{ className?: string }>> = {
  sphere: Circle, box: Box, pyramid: Triangle, cylinder: Cylinder, cone: Cone, torus: Donut, disc: Disc, stone: Diamond, blob: Droplet, tree: TreeDeciduous, pine: TreePine, crag: Mountain, model: Boxes, text: Type,
  ...Object.fromEntries(SHAPES.map((s) => [s.id, s.icon])),
}
export const ADDABLE = KINDS.filter((k) => k !== "model" && k !== "text")
const LOCKS: { key: LockKey; label: string }[] = [{ key: "sky", label: "Sky" }, { key: "sea", label: "Sea" }, { key: "land", label: "Land" }, { key: "things", label: "Things" }, { key: "camera", label: "Camera" }]

export function newThing(kind: Kind) {
  const w = get().world, c = w.cam.target
  const size: Vec3 = SHAPE_BY_ID[kind]?.size ?? (kind === "disc" ? [1.6, 0.08, 1.6] : kind === "crag" ? [3, 2.2, 3] : kind === "tree" || kind === "pine" ? [1.4, 1.8, 1.4] : [1.2, 1.2, 1.2])
  const m = SHAPE_BY_ID[kind]?.material ? mat(SHAPE_BY_ID[kind]!.material!) : kind === "tree" || kind === "pine" ? mat("Leaf") : kind === "stone" || kind === "crag" ? mat("Stone") : mat("Chrome")
  addThing(thing(kind, [c[0] + (Math.random() - 0.5) * 3, Math.max(size[1] + 0.2, c[1]), c[2] + (Math.random() - 0.5) * 3], size, m, { name: KIND_LABEL[kind] }))
}

/** Push the land up or down around a point: a grid of heights, kept in the world as text. */
export function readGrid(sculpt?: string) { const d = new Uint8Array(GRID * GRID).fill(128); if (sculpt) { try { const raw = atob(sculpt); for (let i = 0; i < Math.min(raw.length, d.length); i++) d[i] = raw.charCodeAt(i) } catch { /* start again from flat */ } } return d }
export function writeGrid(d: Uint8Array) { let s = ""; for (let i = 0; i < d.length; i += 0x4000) s += String.fromCharCode(...d.subarray(i, i + 0x4000)); return btoa(s) }
export type SculptTool = "raise" | "lower" | "smooth" | "erode"
function sculptAt(x: number, z: number, tool: SculptTool, size: number) {
  edit("sculpt", (w) => {
    const N = GRID, d = readGrid(w.land.sculpt)
    const u = x / (w.land.radius * 3.2) + 0.5, v = z / (w.land.radius * 3.2) + 0.5, r = size * N
    const src = d.slice(), cl = (n: number) => Math.max(0, Math.min(N - 1, n))
    if (tool === "erode") {
      // water drops: each lands in the brush, runs downhill and away from the middle, and wears a gully as it goes
      for (let n = 0; n < 26; n++) { const a = Math.random() * 6.283, q = Math.sqrt(Math.random()) * r; let px = u * N + Math.cos(a) * q, py = v * N + Math.sin(a) * q
        for (let step = 0; step < 34; step++) { const i = cl(Math.round(px)), j = cl(Math.round(py)), k = j * N + i
          const gx = d[j * N + cl(i + 1)] - d[j * N + cl(i - 1)], gy = d[cl(j + 1) * N + i] - d[cl(j - 1) * N + i]
          let dx = -gx + (px - N / 2) * 0.05 + (Math.random() - 0.5) * 0.8, dy = -gy + (py - N / 2) * 0.05 + (Math.random() - 0.5) * 0.8; const l = Math.hypot(dx, dy) || 1
          d[k] = Math.max(0, d[k] - (step < 28 ? 2 : 0)); px += dx / l; py += dy / l; if (px < 1 || py < 1 || px > N - 2 || py > N - 2) break } }
    } else for (let j = Math.max(0, Math.floor(v * N - r)); j <= Math.min(N - 1, Math.ceil(v * N + r)); j++)
      for (let i = Math.max(0, Math.floor(u * N - r)); i <= Math.min(N - 1, Math.ceil(u * N + r)); i++) {
        const k = Math.max(0, 1 - Math.hypot(i + 0.5 - u * N, j + 0.5 - v * N) / r); if (k <= 0) continue
        const f = k * k * (3 - 2 * k), at = j * N + i
        if (tool === "smooth") { const a = (src[at] + src[Math.max(0, at - 1)] + src[Math.min(N * N - 1, at + 1)] + src[Math.max(0, at - N)] + src[Math.min(N * N - 1, at + N)]) / 5; d[at] = Math.round(src[at] + (a - src[at]) * f) }
        else d[at] = Math.max(0, Math.min(255, Math.round(src[at] + (tool === "raise" ? 9 : -9) * f)))
      }
    w.land.sculpt = writeGrid(d); w.land.on = true
  })
}

export function Viewport() {
  const world = useApp((s) => s.world), sel = useApp((s) => s.sel), quality = useApp((s) => s.quality), wires = useApp((s) => s.wires), mask = useApp((s) => s.mask)
  const locks = useApp((s) => s.locks), rolls = useApp((s) => s.rolls), status = useApp((s) => s.status), sculpt = useApp((s) => s.sculpt)
  const picked = useApp(selectedThing)
  const box = React.useRef<HTMLDivElement>(null), canvas = React.useRef<HTMLCanvasElement>(null)
  const [css, setCss] = React.useState({ w: 640, h: 480 }); const [err, setErr] = React.useState("")

  React.useEffect(() => {
    const e = new Engine(canvas.current!); setEngine(e); (window as any).__engine = e
    if (!e.ok) { setErr(e.error); return }
    e.onStatus = (s) => patch({ status: s }); e.setWorld(get().world)
    return () => { e.dispose(); setEngine(null) }
  }, [])
  const sounding = useApp((s) => s.sounding)
  React.useEffect(() => { if (!sounding) engine?.setWorld(world) }, [world, sounding])
  // while music sounds, every frame is the world as the music moves it
  React.useEffect(() => {
    if (!engine || !sounding) return; const e = engine; e.live = true; let raf = 0
    const tick = () => { const r = react(get().world, nowLevels()); e.time = r.time; e.setWorld(r.world); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick); return () => { cancelAnimationFrame(raf); e.live = false; e.time = 0; e.setWorld(get().world) }
  }, [sounding])
  React.useEffect(() => { engine?.setQuality(QUALITY[quality].samples) }, [quality])
  React.useEffect(() => { engine?.setSelected(sel.type === "thing" ? sel.id : null); engine?.touch(true) }, [sel])
  React.useEffect(() => { engine?.setWires(wires) }, [wires])
  const phase = useApp((s) => s.phase)
  React.useEffect(() => { if (engine) { engine.livePhase = phase; engine.touch() } }, [phase])
  React.useEffect(() => { if (engine) { engine.mode = mask; engine.touch() } }, [mask])

  // fit the frame inside the space there is
  const aspect = world.frame.w / world.frame.h
  React.useEffect(() => {
    const el = box.current!; const fit = () => { const pw = el.clientWidth - 24, ph = el.clientHeight - 24; const w = Math.max(80, Math.min(pw, ph * aspect)); setCss({ w: Math.round(w), h: Math.round(w / aspect) }) }
    fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect()
  }, [aspect])
  React.useEffect(() => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5); let w = css.w * dpr, h = css.h * dpr; const k = Math.sqrt(1_300_000 / (w * h)); if (k < 1) { w *= k; h *= k }
    engine?.setSize(w, h)
  }, [css])

  // ---------- touching the picture ----------
  const drag = React.useRef<null | { mode: "orbit" | "thing" | "sun" | "sculpt" | "pan"; id?: string; x: number; y: number; moved: boolean; planeY: number; off: [number, number]; hit: string }>(null)
  const pts = React.useRef(new Map<number, [number, number]>()); const pinch = React.useRef(0)
  const at = (e: { clientX: number; clientY: number }) => { const r = canvas.current!.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height] as const }
  const onPlane = (nx: number, ny: number, y: number) => { const { ro, rd } = engine!.ray(nx, ny); if (Math.abs(rd.y) < 1e-4) return null; const t = (y - ro.y) / rd.y; return t > 0 && t < 400 ? ro.clone().addScaledVector(rd, t) : null }

  const down = (e: React.PointerEvent) => {
    if (!engine) return
    canvas.current!.setPointerCapture(e.pointerId); pts.current.set(e.pointerId, [e.clientX, e.clientY]); pinch.current = 0
    if (pts.current.size > 1) { drag.current = null; return }
    const [nx, ny] = at(e), w = get().world, hit = engine.pick(nx, ny)
    const d = { x: e.clientX, y: e.clientY, moved: false, planeY: 0, off: [0, 0] as [number, number], hit: hit?.kind ?? "sky" }
    if (hit?.kind === "thing" && hit.id) {
      const t = w.things.find((x) => x.id === hit.id)!; patch({ sel: { type: "thing", id: t.id } })
      const p = onPlane(nx, ny, t.pos[1]); drag.current = { ...d, mode: "thing", id: t.id, planeY: t.pos[1], off: p ? [t.pos[0] - p.x, t.pos[2] - p.z] : [0, 0] }; return
    }
    if (hit?.kind === "land" && get().sel.type === "land" && get().sculpt.tool !== "off") { drag.current = { ...d, mode: "sculpt" }; sculptAt(hit.point[0], hit.point[2], get().sculpt.tool as SculptTool, get().sculpt.size); return }
    if (hit?.kind === "sky") { const { rd } = engine.ray(nx, ny), s = w.sky.sun
      const sd = new THREE.Vector3(Math.cos(s.el) * Math.sin(s.az), Math.sin(s.el), Math.cos(s.el) * Math.cos(s.az))
      if (rd.dot(sd) > Math.cos(0.09)) { drag.current = { ...d, mode: "sun" }; patch({ sel: { type: "sky" } }); return } }
    drag.current = { ...d, mode: e.shiftKey || e.button === 2 ? "pan" : "orbit" }
  }
  const move = (e: React.PointerEvent) => {
    const p = pts.current.get(e.pointerId); if (!p || !engine) return
    const dx = e.clientX - p[0], dy = e.clientY - p[1]; pts.current.set(e.pointerId, [e.clientX, e.clientY])
    if (pts.current.size === 2) { const v = [...pts.current.values()], dist = Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1])
      if (pinch.current) { const k = pinch.current / dist; edit("zoom", (w) => { w.cam.dist = Math.max(3, Math.min(120, w.cam.dist * k)) }) } pinch.current = dist; return }
    const d = drag.current; if (!d) return
    if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 3) d.moved = true
    const [nx, ny] = at(e)
    if (d.mode === "orbit") edit("orbit", (w) => { w.cam.yaw -= dx * 0.006; w.cam.pitch = Math.max(0.01, Math.min(1.5, w.cam.pitch + dy * 0.004)) })
    else if (d.mode === "pan") edit("pan", (w) => { const b = engine!.ray(0.5, 0.5).basis, k = w.cam.dist * 0.0016; w.cam.target = [w.cam.target[0] - b.rt.x * dx * k + b.up.x * dy * k, Math.max(0, w.cam.target[1] - b.rt.y * dx * k + b.up.y * dy * k), w.cam.target[2] - b.rt.z * dx * k + b.up.z * dy * k] })
    else if (d.mode === "thing" && d.id && d.moved) {
      if (e.altKey || e.shiftKey) editThing(d.id, "lift", (t) => { t.pos[1] = Math.max(-20, t.pos[1] - dy * get().world.cam.dist * 0.0022) })
      else { const q = onPlane(nx, ny, d.planeY); if (q) editThing(d.id, "move", (t) => { t.pos[0] = q.x + d.off[0]; t.pos[2] = q.z + d.off[1] }) }
    }
    else if (d.mode === "sun") { const { rd } = engine.ray(nx, ny); edit("sun", (w) => { w.sky.sun = { az: Math.atan2(rd.x, rd.z), el: Math.max(0.02, Math.asin(Math.max(-1, Math.min(1, rd.y)))) } }) }
    else if (d.mode === "sculpt") { const h = engine.pick(nx, ny); if (h && (h.kind === "land" || h.kind === "sea")) sculptAt(h.point[0], h.point[2], get().sculpt.tool as SculptTool, get().sculpt.size) }
  }
  const up = (e: React.PointerEvent) => {
    pts.current.delete(e.pointerId); pinch.current = 0; const d = drag.current; drag.current = null
    if (d && !d.moved && d.mode === "orbit") { const k = d.hit; if (k === "sky" || k === "sea" || k === "land" || k === "title") patch({ sel: { type: k } }) }
  }
  const wheel = React.useCallback((e: WheelEvent) => { e.preventDefault(); edit("zoom", (w) => { w.cam.dist = Math.max(3, Math.min(120, w.cam.dist * Math.exp(e.deltaY * 0.0012))) }) }, [])
  React.useEffect(() => { const c = canvas.current!; c.addEventListener("wheel", wheel, { passive: false }); return () => c.removeEventListener("wheel", wheel) }, [wheel])
  const dbl = (e: React.MouseEvent) => { if (!engine) return; const [nx, ny] = at(e), h = engine.pick(nx, ny); if (h && h.kind !== "sky") edit("focus", (w) => { w.cam.focus = Math.max(0.5, h.dist) }) }

  const pct = status.phase === "done" ? 1 : status.samples / Math.max(1, status.target)
  return (
    <div ref={box} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden" data-testid="viewport">
      <div className="relative shadow-[0_30px_80px_-30px_rgba(0,0,0,.8)] ring-1 ring-white/10" style={{ width: css.w, height: css.h }}>
        <canvas ref={canvas} className={cn("block size-full touch-none rounded-[3px]", sculpt.tool !== "off" && sel.type === "land" ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing")}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onDoubleClick={dbl} onContextMenu={(e) => e.preventDefault()} aria-label="The world. Drag to look around." />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-b-[3px]">
          <div className="h-full bg-white/70 transition-[width,opacity] duration-300" style={{ width: `${pct * 100}%`, opacity: status.phase === "done" ? 0 : 1 }} />
        </div>
        {err && <div className="absolute inset-0 grid place-items-center bg-background p-6 text-center text-sm text-muted-foreground">{err}</div>}
      </div>

      {/* what you can do to the selected thing, right where it is */}
      {picked && (
        <div className="glass-panel absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-0.5 rounded-lg p-1">
          <span className="px-2 text-[12.5px] font-medium">{picked.name}</span>
          <Tip label={picked.role === "cut" ? "Cutting: make solid" : "Cut this shape out of its set"}><Button variant={picked.role === "cut" ? "glass" : "ghost"} size="icon-sm" onClick={() => editThing(picked.id, "role", (t) => { t.role = t.role === "cut" ? "solid" : "cut" })}><Scissors /></Button></Tip>
          <Tip label="Rest it on the ground"><Button variant="ghost" size="icon-sm" onClick={() => { const g = engine?.groundAt(picked.pos[0], picked.pos[2]) ?? 0; editThing(picked.id, "land", (t) => { t.pos[1] = g + t.size[1] }) }}><ArrowDownToLine /></Button></Tip>
          <Tip label="Duplicate"><Button variant="ghost" size="icon-sm" onClick={() => duplicateThing(picked.id)}><Copy /></Button></Tip>
          <Tip label="Remove"><Button variant="ghost" size="icon-sm" onClick={() => removeThing(picked.id)}><Trash2 /></Button></Tip>
        </div>
      )}

      {/* the dock: add a thing, roll the dice */}
      <div className="glass-panel absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl p-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="h-8" />}><Plus /> Add</DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-44">
            {ADDABLE.map((k) => { const I = KIND_ICON[k]; return <DropdownMenuItem key={k} onClick={() => newThing(k)}><I className="size-4" /> {KIND_LABEL[k]}</DropdownMenuItem> })}
          </DropdownMenuContent>
        </DropdownMenu>
        <div className="mx-0.5 h-5 w-px bg-border" />
        <Tip label="Roll a new world (Space). Locked parts stay.">
          <button onClick={() => rollDice()} aria-label="Roll a new world" data-testid="dice"
            className="glass-primary grid size-10 place-items-center rounded-lg text-primary-foreground transition-transform active:scale-90">
            <Dices key={rolls} className="size-5 animate-[tumble_.5s_cubic-bezier(.3,1.5,.5,1)]" />
          </button>
        </Tip>
        <Popover>
          <PopoverTrigger render={<Button variant="ghost" size="sm" className="h-8" />}>{locks.length ? <Lock /> : <LockOpen />} {locks.length ? `${locks.length} kept` : "Keep"}</PopoverTrigger>
          <PopoverContent side="top" align="end" className="w-60 p-2">
            <p className="px-1 pb-2 text-[12px] text-muted-foreground">Lock what you love. The dice rolls the rest.</p>
            {LOCKS.map((l) => { const on = locks.includes(l.key); return (
              <div key={l.key} className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-muted/60">
                <button className="flex flex-1 items-center gap-2 py-1 text-left text-[13px]" onClick={() => toggleLock(l.key)} aria-pressed={on}>
                  {on ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5 text-muted-foreground" />} {l.label}
                </button>
                <Button variant="ghost" size="xs" onClick={() => rollDice(l.key)}><Dices /> Roll</Button>
              </div>) })}
            <p className="mt-2 border-t border-border/60 px-1 pt-2 pb-1.5 text-[12px] text-muted-foreground">Or grow a world from a word.</p>
            <WordBox className="px-1 pb-1" />
          </PopoverContent>
        </Popover>
        <div className="mx-0.5 h-5 w-px bg-border" />
        <Tip label="Add an island"><Button variant="ghost" size="icon" className="size-8" onClick={() => { edit("land-on", (w) => { w.land.on = !w.land.on }); patch({ sel: { type: "land" } }) }}><Mountain /></Button></Tip>
      </div>
    </div>
  )
}

export function Tip({ label, children }: { label: string; children: React.ReactElement }) {
  return <Tooltip><TooltipTrigger render={children} /><TooltipContent>{label}</TooltipContent></Tooltip>
}
