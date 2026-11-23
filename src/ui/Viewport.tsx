// The picture, and everything you do by touching it: look around, move things, drag the sun,
// push the land up and down.
import * as React from "react"
import * as THREE from "three"
import { Box, Boxes, Type, Circle, Cone, Copy, Cylinder, Dices, Diamond, Donut, Droplet, Hand, Lock, LockOpen, Mountain, Plus, Scissors, SlidersHorizontal, Sparkles, Trash2, TreeDeciduous, TreePine, Triangle, ArrowDownToLine, Disc, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { nowLevels } from "@/audio"
import { Engine, GRID, QUALITY } from "@/engine/engine"
import { react } from "@/sound"
import { type Kind, type LockKey, type Vec3, KINDS, KIND_LABEL, mat, thing } from "@/engine/scene"
import { WordBox } from "@/features/word-world"
import { SHAPE_BY_ID, SHAPES } from "@/engine/shapes"
import { useIsMobile } from "@/hooks/use-mobile"
import { addThing, duplicateThing, edit, editThing, engine, get, patch, removeThing, rollDice, selectedThing, setEngine, shareLink, toggleLock, useApp } from "@/store"

import { WELCOME_KEY, toggleSheet, useSheet } from "./sheet"

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
  const [css, setCss] = React.useState({ w: 640, h: 480 }); const [err, setErr] = React.useState(""); const [lost, setLost] = React.useState<"" | "lost" | "gone">("")

  React.useEffect(() => {
    const e = new Engine(canvas.current!); (window as any).__engine = e
    if (!e.ok) { setErr(e.error); e.dispose(); return }
    setEngine(e); e.onStatus = (s) => patch({ status: s }); e.setWorld(get().world)
    e.onContext = (s) => setLost(s === "back" ? "" : s)
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
  const aspect = world.frame.w / world.frame.h, narrow = useIsMobile(), sheet = useSheet()
  React.useEffect(() => {
    // on a phone the dock sits in the flow under the picture, so the picture leaves room for it
    const el = box.current!; const fit = () => { const pw = el.clientWidth - (narrow ? 16 : 24), ph = el.clientHeight - (narrow ? 84 : 24); const w = Math.max(80, Math.min(pw, ph * aspect)); setCss({ w: Math.round(w), h: Math.round(w / aspect) }) }
    fit(); const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect()
  }, [aspect, narrow])
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
    <div ref={box} className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-hidden max-md:pb-2" data-testid="viewport">
      <div className="relative shadow-[0_30px_80px_-30px_rgba(0,0,0,.8)] ring-1 ring-white/10" style={{ width: css.w, height: css.h }}>
        <canvas ref={canvas} className={cn("block size-full touch-none rounded-[3px]", sculpt.tool !== "off" && sel.type === "land" ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing")}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onDoubleClick={dbl} onContextMenu={(e) => e.preventDefault()} aria-label="The world. Drag to look around." />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-b-[3px]">
          <div className="h-full bg-white/70 transition-[width,opacity] duration-300" style={{ width: `${pct * 100}%`, opacity: status.phase === "done" ? 0 : 1 }} />
        </div>
        {err && <div className="absolute inset-0 grid place-items-center bg-background p-6 text-center text-sm text-muted-foreground" data-testid="engine-error">{err}</div>}
        {lost && <PictureRest gone={lost === "gone"} />}
      </div>

      {/* what you can do to the selected thing, right where it is */}
      {picked && (
        <div className="glass-panel absolute top-3 left-1/2 z-10 flex max-w-[calc(100%-1rem)] -translate-x-1/2 items-center gap-0.5 rounded-lg p-1" role="toolbar" aria-label={`${picked.name}: quick actions`} data-testid="thing-bar">
          <span className="max-w-40 truncate px-2 text-[12.5px] font-medium">{picked.name}</span>
          <Tip label={picked.role === "cut" ? "It cuts a hole now: make it solid again" : "Cut a hole with it in what it touches"}><Button variant={picked.role === "cut" ? "glass" : "ghost"} size="icon-sm" aria-pressed={picked.role === "cut"} aria-label="Cut a hole with it" onClick={() => editThing(picked.id, "role", (t) => { t.role = t.role === "cut" ? "solid" : "cut" })}><Scissors /></Button></Tip>
          <Tip label="Rest it on the ground"><Button variant="ghost" size="icon-sm" aria-label="Rest it on the ground" onClick={() => { const g = engine?.groundAt(picked.pos[0], picked.pos[2]) ?? 0; editThing(picked.id, "land", (t) => { t.pos[1] = g + t.size[1] }) }}><ArrowDownToLine /></Button></Tip>
          <Tip label="Make a copy (Ctrl D)"><Button variant="ghost" size="icon-sm" aria-label="Make a copy" onClick={() => duplicateThing(picked.id)}><Copy /></Button></Tip>
          <Tip label="Remove it (Delete)"><Button variant="ghost" size="icon-sm" aria-label="Remove it" onClick={() => removeThing(picked.id)}><Trash2 /></Button></Tip>
        </div>
      )}

      {/* the dock: add a thing, roll the dice. Floats on the picture on a wide screen, sits under it on a phone */}
      <div className="relative z-10 shrink-0 md:absolute md:bottom-4 md:left-1/2 md:-translate-x-1/2">
        <Welcome />
        <div className="glass-panel flex items-center gap-1 rounded-xl p-1.5" role="toolbar" aria-label="Dock">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button title="Add a shape to the world" variant="ghost" size="sm" className="h-8" data-testid="dock-add" />}><Plus /> Add</DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="max-h-[min(30rem,70dvh)] w-48">
              {ADDABLE.map((k) => { const I = KIND_ICON[k]; return <DropdownMenuItem key={k} onClick={() => newThing(k)}><I className="size-4" /> {KIND_LABEL[k]}</DropdownMenuItem> })}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={toggleIsland}><Mountain className="size-4" /> {world.land.on ? "Island (take it away)" : "An island"}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="mx-0.5 h-5 w-px bg-border" />
          <Tip label="Roll a new world (Space). Kept parts stay.">
            <button onClick={() => { rollDice(); seenWelcome() }} aria-label="Roll a new world" data-testid="dice"
              className="glass-primary grid size-10 place-items-center rounded-lg text-primary-foreground transition-transform outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-90">
              <Dices key={rolls} className="size-5 animate-[tumble_.5s_cubic-bezier(.3,1.5,.5,1)]" />
            </button>
          </Tip>
          <Popover>
            <PopoverTrigger render={<Button title="Choose what the dice leave alone" variant="ghost" size="sm" className="h-8" data-testid="dock-keep" />}>{locks.length ? <Lock /> : <LockOpen />} {locks.length ? `${locks.length} kept` : "Keep"}</PopoverTrigger>
            <PopoverContent side="top" align="end" className="w-[min(16rem,calc(100vw-1rem))] p-2">
              <p className="px-1 pb-2 text-[12px] leading-snug text-muted-foreground">Keep the parts you love. The dice roll the rest.</p>
              {LOCKS.map((l) => { const on = locks.includes(l.key); return (
                <div key={l.key} className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-muted/60">
                  <button className="flex flex-1 items-center gap-2 rounded-sm py-1 text-left text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => toggleLock(l.key)} aria-pressed={on} aria-label={on ? `${l.label}: kept` : `Keep the ${l.label.toLowerCase()}`}>
                    {on ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5 text-muted-foreground" />} {l.label}{on && <span className="text-[11px] text-muted-foreground">kept</span>}
                  </button>
                  <Button variant="ghost" size="xs" onClick={() => rollDice(l.key)} aria-label={`Roll only the ${l.label.toLowerCase()}`}><Dices /> Roll</Button>
                </div>) })}
              <p className="mt-2 border-t border-border/60 px-1 pt-2 pb-1.5 text-[12px] text-muted-foreground">Or grow a world from a word.</p>
              <WordBox className="px-1 pb-1" />
            </PopoverContent>
          </Popover>
          <div className="mx-0.5 h-5 w-px bg-border max-md:hidden" />
          <Tip label={world.land.on ? "The island: show its dials" : "Add an island"}><Button variant="ghost" size="icon" className="size-8 max-md:hidden" aria-label={world.land.on ? "The island" : "Add an island"} onClick={() => { if (!world.land.on) edit("land-on", (w) => { w.land.on = true }); patch({ sel: { type: "land" } }) }}><Mountain /></Button></Tip>
          {narrow && <>
            <div className="mx-0.5 h-5 w-px bg-border" />
            <Button variant={sheet ? "glass" : "ghost"} size="sm" className="h-8" onClick={toggleSheet} aria-pressed={sheet} aria-label="Edit" data-testid="controls"><SlidersHorizontal /> Edit</Button>
          </>}
        </div>
      </div>
    </div>
  )
}

const toggleIsland = () => { edit("land-on", (w) => { w.land.on = !w.land.on }); patch({ sel: { type: get().world.land.on ? "land" : "sky" } }) }

// ---------- the first visit ----------
const seenWelcome = () => { try { localStorage.setItem(WELCOME_KEY, "1") } catch { /* private window: it shows again next time */ } welcomeSubs.forEach((f) => f()) }
const welcomeSubs = new Set<() => void>()
const readSeen = () => { try { return localStorage.getItem(WELCOME_KEY) === "1" } catch { return true } }

/** A small card over the dock on the very first visit: the three things worth knowing. */
function Welcome() {
  const seen = React.useSyncExternalStore((f) => { welcomeSubs.add(f); return () => welcomeSubs.delete(f) }, readSeen)
  React.useEffect(() => { if (seen) return; const esc = (e: KeyboardEvent) => { if (e.key === "Escape") seenWelcome() }; addEventListener("keydown", esc); return () => removeEventListener("keydown", esc) }, [seen])
  if (seen) return null
  return (
    <div role="dialog" aria-label="Welcome" data-testid="welcome"
      className="glass-panel absolute bottom-full left-1/2 mb-3 w-[min(21rem,calc(100vw-1.5rem))] -translate-x-1/2 animate-in rounded-xl p-3.5 pr-3 text-[12.5px] leading-snug fade-in-0 slide-in-from-bottom-2 duration-500">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-[14px] font-medium">Make a picture in a minute</p>
        <Button variant="ghost" size="icon-xs" className="-mt-0.5" onClick={seenWelcome} aria-label="Close the welcome"><X /></Button>
      </div>
      <ul className="flex flex-col gap-1.5 text-foreground/85">
        <li className="flex gap-2"><Dices className="mt-px size-4 shrink-0" /><span><b className="font-medium text-foreground">Roll the dice</b> below for a whole new world. Press Keep to hold on to the parts you like.</span></li>
        <li className="flex gap-2"><Hand className="mt-px size-4 shrink-0" /><span><b className="font-medium text-foreground">Drag the picture</b> to look around. Drag a thing to move it, or drag the sun.</span></li>
        <li className="flex gap-2"><Sparkles className="mt-px size-4 shrink-0" /><span><b className="font-medium text-foreground">Modes</b>, at the top, has a screensaver, 1994 mode, flying and more.</span></li>
      </ul>
      <div className="mt-3 flex justify-end"><Button variant="glass" size="sm" onClick={seenWelcome} data-testid="welcome-ok">Got it</Button></div>
    </div>
  )
}

// on a touch screen a tooltip only gets in the way (it stays up after the tap), so there are none
const touchOnly = typeof matchMedia !== "undefined" && matchMedia("(hover: none)").matches
/** Shown over the picture while the browser has taken the 3D graphics away. */
function PictureRest({ gone }: { gone: boolean }) {
  const reload = async () => { try { history.replaceState(null, "", await shareLink()) } catch { /* reload as it is */ } location.reload() }
  return <div className="absolute inset-0 grid place-items-center bg-background/85 p-6 text-center text-sm" data-testid="context-lost">
    {gone ? <div className="flex max-w-xs flex-col items-center gap-3"><p>The graphics chip stopped drawing and has not come back. Your world is safe: reload to carry on where you were.</p>
      <Button size="sm" className="glass-primary" onClick={() => void reload()}>Reload the picture</Button></div>
      : <p className="text-muted-foreground">The graphics chip is taking a break. The picture will be back in a moment…</p>}
  </div>
}

export function Tip({ label, children }: { label: string; children: React.ReactElement }) {
  if (touchOnly) return children
  return <Tooltip><TooltipTrigger render={children} /><TooltipContent>{label}</TooltipContent></Tooltip>
}
