// Fly: move through the live, ray traced world yourself. The editor camera is never touched: the
// picture is drawn from a camera of our own (an orbit camera with a tiny distance, sitting exactly
// at your eye), and leaving hands the world back to the picture just as it was.
import * as React from "react"
import { Bird, ChevronDown, ChevronUp, Orbit, Pin, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { audioEl, stopMic } from "@/audio"
import type { Vec3 } from "@/engine/scene"
import { edit, engine, get, patch } from "@/store"

import { type Eye, SEA_CLEAR, camAt, clamp, eyeOf, fwdOf } from "./eye"
import { openLook } from "./look"

// ---------- on or off ----------
let flying = false
const subs = new Set<() => void>()
const set = (v: boolean) => { flying = v; subs.forEach((f) => f()) }
const useFlying = () => React.useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => flying)
export const isFlying = () => flying

export function startFly() {
  if (flying || !engine || !engine.ok) return
  // music moves the camera too: one driver at a time
  if (get().sounding) { audioEl()?.pause(); if (get().mic) stopMic(); patch({ sounding: false, mic: false }) }
  patch({ dialog: null }); set(true)
}
export const stopFly = () => set(false)

export function FlyOverlay() { return useFlying() ? <FlyLayer /> : null }

const KEYS: Record<string, [number, number, number]> = { // strafe, up, forward
  KeyW: [0, 0, 1], ArrowUp: [0, 0, 1], KeyS: [0, 0, -1], ArrowDown: [0, 0, -1],
  KeyA: [-1, 0, 0], ArrowLeft: [-1, 0, 0], KeyD: [1, 0, 0], ArrowRight: [1, 0, 0],
  KeyE: [0, 1, 0], Space: [0, 1, 0], KeyQ: [0, -1, 0], ShiftLeft: [0, -1, 0], ShiftRight: [0, -1, 0],
}

function FlyLayer() {
  const base = React.useRef(get().world).current
  const eye = React.useRef<Eye>(eyeOf(base.cam))
  const look = React.useRef({ heading: eye.current.heading, pitch: eye.current.pitch })
  const keys = React.useRef(new Set<string>()), stick = React.useRef({ x: 0, y: 0 }), lift = React.useRef(0)
  const [speed, setSpeed] = React.useState(() => Math.round(clamp(base.cam.dist * 0.22, 1.5, 12) * 10) / 10); const speedRef = React.useRef(speed); speedRef.current = speed
  const [touch, setTouch] = React.useState(() => typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches)
  const [rect, setRect] = React.useState<DOMRect | null>(null)
  const [fresh, setFresh] = React.useState(true)

  // the frame of the picture, so the rest of the room can dim around it
  React.useEffect(() => {
    const c = document.querySelector<HTMLCanvasElement>('[data-testid="viewport"] canvas'); if (!c) return
    const fit = () => setRect(c.getBoundingClientRect()); fit()
    const ro = new ResizeObserver(fit); ro.observe(c); addEventListener("resize", fit); return () => { ro.disconnect(); removeEventListener("resize", fit) }
  }, [])
  React.useEffect(() => { const t = setTimeout(() => setFresh(false), 9000); return () => clearTimeout(t) }, [])

  // keys: caught before the editor's own shortcuts, so Space flies up instead of rolling the dice
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      e.stopPropagation()
      if (e.key === "Escape") { e.preventDefault(); stopFly(); return }
      if (e.code in KEYS) { e.preventDefault(); keys.current.add(e.code) }
      if (e.key === "+" || e.key === "=") setSpeed((s) => clamp(s * 1.25, 0.3, 60)); if (e.key === "-") setSpeed((s) => clamp(s / 1.25, 0.3, 60))
    }
    const upk = (e: KeyboardEvent) => { e.stopPropagation(); keys.current.delete(e.code) }
    const blur = () => keys.current.clear()
    addEventListener("keydown", down, true); addEventListener("keyup", upk, true); addEventListener("blur", blur)
    return () => { removeEventListener("keydown", down, true); removeEventListener("keyup", upk, true); removeEventListener("blur", blur) }
  }, [])

  // the flight itself: every frame a whole quick picture from where you are
  React.useEffect(() => {
    const e = engine; if (!e) return
    const fov0 = base.cam.fov, fovTo = clamp(fov0, 55, 80); let fov = fov0
    const vel = [0, 0, 0]; let floorTo = SEA_CLEAR, floor = SEA_CLEAR, probed: Vec3 = [1e9, 0, 0], last = performance.now(), raf = 0
    e.live = true; e.setWorld({ ...base, cam: camAt(eye.current, base.cam, fov) })
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min(0.05, (now - last) / 1000); last = now
      const ey = eye.current, lk = look.current
      let sx = stick.current.x, sy = lift.current, sz = stick.current.y
      for (const k of keys.current) { const v = KEYS[k]; if (v) { sx += v[0]; sy += v[1]; sz += v[2] } }
      // turn and move with a little weight, so it glides rather than jerks
      const h0 = ey.heading, p0 = ey.pitch
      const kl = 1 - Math.exp(-dt * 16); ey.heading += (lk.heading - ey.heading) * kl; ey.pitch += (lk.pitch - ey.pitch) * kl
      const f = fwdOf(ey), rt = [-Math.cos(ey.heading), 0, Math.sin(ey.heading)]
      const want = [f[0] * sz + rt[0] * sx, f[1] * sz + sy, f[2] * sz + rt[2] * sx], n = Math.hypot(...want), sp = speedRef.current * (n > 1 ? 1 / n : 1)
      const kv = 1 - Math.exp(-dt * 5); for (let i = 0; i < 3; i++) vel[i] += (want[i] * sp - vel[i]) * kv
      const p = ey.pos; p[0] = clamp(p[0] + vel[0] * dt, -1500, 1500); p[1] = Math.min(400, p[1] + vel[1] * dt); p[2] = clamp(p[2] + vel[2] * dt, -1500, 1500)
      // never under the sea or into the land: look down at the ground now and then as you go
      if (Math.hypot(p[0] - probed[0], p[2] - probed[2]) > 0.12) { probed = [p[0], p[1], p[2]]; floorTo = Math.max(SEA_CLEAR, e.groundAt(p[0], p[2]) + 0.7) }
      floor += (floorTo - floor) * (1 - Math.exp(-dt * 10)); if (floorTo < floor) floor = Math.max(floorTo, floor - dt * 4)
      if (p[1] < floor) { p[1] = floor; vel[1] = Math.max(0, vel[1]) }
      if (p[1] < SEA_CLEAR) p[1] = SEA_CLEAR
      const fovWas = fov; fov += (fovTo - fov) * (1 - Math.exp(-dt * 4)); if (Math.abs(fovTo - fov) < 0.01) fov = fovTo
      const moved = Math.hypot(...vel) * dt > 1e-5 || Math.abs(ey.heading - h0) + Math.abs(ey.pitch - p0) > 1e-6 || fov !== fovWas
      if (moved) e.setWorld({ ...base, cam: camAt(ey, base.cam, fov) })
      ;(window as any).__fly = { pos: [...p], heading: ey.heading, pitch: ey.pitch, speed: speedRef.current }
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); e.live = false; e.setWorld(get().world); (window as any).__fly = null }
  }, [base])

  // drag anywhere to look; on touch screens the stick moves you
  const drag = React.useRef(new Map<number, [number, number]>())
  const down = (ev: React.PointerEvent) => { if (ev.pointerType === "touch") setTouch(true); (ev.target as HTMLElement).setPointerCapture(ev.pointerId); drag.current.set(ev.pointerId, [ev.clientX, ev.clientY]); setFresh(false) }
  const move = (ev: React.PointerEvent) => {
    const p = drag.current.get(ev.pointerId); if (!p) return
    const dx = ev.clientX - p[0], dy = ev.clientY - p[1]; drag.current.set(ev.pointerId, [ev.clientX, ev.clientY])
    const k = 0.0036 * (clamp(base.cam.fov, 30, 90) / 60) * (ev.pointerType === "touch" ? 1.25 : 1)
    look.current.heading -= dx * k; look.current.pitch = clamp(look.current.pitch - dy * k, -1.45, 1.45)
  }
  const up = (ev: React.PointerEvent) => { drag.current.delete(ev.pointerId) }
  const wheel = (ev: React.WheelEvent) => setSpeed((s) => Math.round(clamp(s * Math.exp(-ev.deltaY * 0.0015), 0.3, 60) * 10) / 10)

  const keep = () => {
    const ey = eye.current, f = fwdOf(ey), hit = engine?.pick(0.5, 0.5)
    let D = hit && hit.kind !== "sky" ? clamp(hit.dist, 2, 60) : clamp(base.cam.dist, 4, 30); if (f[1] < -0.02) D = Math.min(D, ey.pos[1] / -f[1])
    D = Math.max(0.5, D)
    edit("cam", (w) => { w.cam = { ...w.cam, yaw: ey.heading + Math.PI, pitch: -ey.pitch, dist: D, target: [ey.pos[0] + f[0] * D, Math.max(0, ey.pos[1] + f[1] * D), ey.pos[2] + f[2] * D], roll: 0, pano: false } })
    stopFly()
  }
  const lookHere = () => { const ey = eye.current; stopFly(); openLook({ pos: [...ey.pos] as Vec3, heading: ey.heading }) }

  const r = rect
  return (
    <div className="fixed inset-0 z-50 cursor-grab touch-none select-none active:cursor-grabbing" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel} onContextMenu={(e) => e.preventDefault()} data-testid="fly-layer" aria-label="Flying. Drag to look around.">
      {/* the room dims; the picture stays lit */}
      {r ? <div className="pointer-events-none absolute rounded-[3px] ring-1 ring-white/15 transition-[box-shadow] duration-500" style={{ left: r.left, top: r.top, width: r.width, height: r.height, boxShadow: "0 0 0 200vmax rgba(6,7,12,.8)" }} />
        : <div className="pointer-events-none absolute inset-0 bg-black/70" />}

      {/* the hint card */}
      <div className="bg-popover absolute flex max-w-[calc(100vw-1.5rem)] flex-col gap-1.5 rounded-xl p-2 pl-3 text-[12.5px] text-popover-foreground"
        style={r && r.top > 96 ? { left: r.left + r.width / 2, top: r.top - 10, transform: "translate(-50%, -100%)" } : { left: r ? r.left + r.width / 2 : "50%", top: Math.max(10, (r?.top ?? 0) + 10), transform: "translateX(-50%)" }}
        onPointerDown={(e) => e.stopPropagation()} data-testid="fly-hint">
        <div className="flex items-center gap-1.5">
          <Bird className="size-4 shrink-0" /><span className="font-medium">Flying</span>
          <span className="ml-1 text-muted-foreground tabular-nums max-sm:hidden">speed {speed}</span>
          <div className="ml-auto flex items-center gap-0.5 pl-2">
            <Button variant="ghost" size="sm" onClick={lookHere} data-testid="fly-look"><Orbit /><span className="max-sm:hidden">Look around here</span></Button>
            <Button variant="ghost" size="sm" onClick={keep} data-testid="fly-keep"><Pin /><span className="max-sm:hidden">Keep this view</span></Button>
            <Button variant="glass" size="sm" onClick={stopFly} data-testid="fly-done"><X />Done</Button>
          </div>
        </div>
        {(fresh || !touch) && (touch
          ? <p className="pr-1 text-muted-foreground">Left stick to move, drag to look, arrows on the right to rise and sink.</p>
          : <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 pr-1 text-muted-foreground">
              <span className="flex items-center gap-1"><Kbd>W</Kbd><Kbd>A</Kbd><Kbd>S</Kbd><Kbd>D</Kbd> move</span>
              <span>drag to look</span>
              <span className="flex items-center gap-1"><Kbd>E</Kbd><Kbd>Q</Kbd> up, down</span>
              <span>scroll for speed</span>
              <span className="flex items-center gap-1"><Kbd>Esc</Kbd> back to editing</span>
            </p>)}
      </div>

      {touch && <Stick onMove={(x, y) => (stick.current = { x, y })} />}
      {touch && (
        <div className="absolute right-5 bottom-8 flex flex-col gap-3" onPointerDown={(e) => e.stopPropagation()}>
          {([["Rise", 1, ChevronUp], ["Sink", -1, ChevronDown]] as const).map(([name, v, I]) => (
            <button key={name} aria-label={name} className="glass-panel grid size-14 place-items-center rounded-full active:scale-95"
              onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); lift.current = v }} onPointerUp={() => (lift.current = 0)} onPointerCancel={() => (lift.current = 0)}>
              <I className="size-6" />
            </button>))}
        </div>)}
    </div>
  )
}

/** An on-screen thumbstick: push it to move. */
function Stick({ onMove }: { onMove: (x: number, y: number) => void }) {
  const R = 46; const [k, setK] = React.useState<[number, number]>([0, 0]); const home = React.useRef<[number, number] | null>(null)
  const set = (e: React.PointerEvent) => {
    const h = home.current!; let dx = e.clientX - h[0], dy = e.clientY - h[1]; const l = Math.hypot(dx, dy); if (l > R) { dx *= R / l; dy *= R / l }
    setK([dx, dy]); const dead = (v: number) => (Math.abs(v) < 0.12 ? 0 : v); onMove(dead(dx / R), dead(-dy / R))
  }
  const end = () => { home.current = null; setK([0, 0]); onMove(0, 0) }
  return (
    <div className="glass-panel absolute bottom-8 left-5 size-32 rounded-full" data-testid="fly-stick"
      onPointerDown={(e) => { e.stopPropagation(); e.currentTarget.setPointerCapture(e.pointerId); const b = e.currentTarget.getBoundingClientRect(); home.current = [b.left + b.width / 2, b.top + b.height / 2]; set(e) }}
      onPointerMove={(e) => { e.stopPropagation(); if (home.current) set(e) }} onPointerUp={end} onPointerCancel={end}>
      <div className="absolute top-1/2 left-1/2 size-14 rounded-full bg-white/80 shadow-lg ring-1 ring-black/10 transition-transform duration-75" style={{ transform: `translate(calc(-50% + ${k[0]}px), calc(-50% + ${k[1]}px))` }} />
    </div>
  )
}
