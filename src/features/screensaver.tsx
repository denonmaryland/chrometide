// The screensaver: full screen, drifting slowly through worlds for ever. Each world is shown live
// (quick whole pictures every frame, so the motion stays smooth) while the camera glides; every
// half minute or so the next world is traced offscreen at good quality and faded in over it.
// With a song playing or the microphone on, the worlds move to the music. Any key, click or
// mouse move goes back.
import * as React from "react"

import { micOn, nowLevels } from "@/audio"
import { Engine } from "@/engine/engine"
import { type World, clone } from "@/engine/scene"
import { WORLDS } from "@/engine/worlds"
import { react } from "@/sound"
import { engine as mainEngine, get } from "@/store"
import { prepare } from "@/text"

import type { FeatureCode } from "./lazy"
import { wordWorld } from "./words"

let isOpen = false; const subs = new Set<() => void>()
const setOpen = (v: boolean) => { isOpen = v; subs.forEach((f) => f()) }
const useOpen = () => React.useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => isOpen)
function start() {
  setOpen(true)
  // full screen when the browser allows it (it needs a click or key, so not from a link)
  if (!document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => {})
}
function stop() { setOpen(false); if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {}) }

const WORDS = ["Velvet", "Harbour", "Lighthouse", "Marigold", "Tidal", "Saturn", "Kyoto", "Lisbon", "Moth", "Juniper", "Orchid", "Amber", "Prism", "Daydream", "Halcyon", "Pavilion", "Afterglow", "Seashell", "Satellite", "Cobalt", "Meridian", "Sunday", "Tuesday", "Reykjavik"]
const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] } return b }
/** An endless line of worlds: a ready-made one, then one grown from a word, and so on. */
function playlist() {
  const ready = shuffle(WORLDS.filter((s) => { const w = s.make(); return !w.cam.pano && !(w.anim && w.anim.keys.length) })), words = shuffle(WORDS); let i = 0
  return () => { const k = i++; return k % 2 === 0 ? ready[(k / 2) % ready.length].make() : wordWorld(words[((k - 1) / 2) % words.length]) }
}

const HOLD = [24, 34] // seconds each world is shown, before the next begins to fade in
const FADE_IN = 3.2, FADE_OUT = 3.8 // seconds
const ease = (x: number) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x) }

/** Where a world has drifted to after t seconds: a slow turn, a slow push in, things floating. */
function drift(w: World, t: number, m: { dir: number; push: number }): World {
  const x = clone(w), c = x.cam, s = t * ease(t / 6) // starts from rest, so the still it began from matches
  c.yaw += m.dir * 0.011 * s; c.dist *= 1 - m.push * Math.min(1, s / 40); c.pitch = Math.max(0.02, c.pitch + 0.015 * Math.sin(s * 0.09))
  c.target = [c.target[0], c.target[1] + 0.12 * Math.sin(s * 0.11), c.target[2]]
  x.things.forEach((th, i) => { if (th.kind === "text" || th.eq !== undefined || th.pos[1] - th.size[1] < 0.35) return; th.pos = [th.pos[0], th.pos[1] + Math.sin(s * 0.55 + i * 1.7) * Math.min(0.25, th.size[1] * 0.12) * ease(s / 4), th.pos[2]] })
  return x
}

function Saver() { return useOpen() ? <SaverScreen /> : null }

function SaverScreen() {
  const live = React.useRef<HTMLCanvasElement>(null), fade = React.useRef<HTMLCanvasElement>(null)
  const [hint, setHint] = React.useState(true), [caption, setCaption] = React.useState<{ name: string; key: number } | null>(null), [err, setErr] = React.useState("")

  React.useEffect(() => {
    const e = new Engine(live.current!); if (!e.ok) { setErr(e.error); return }
    mainEngine?.pause(true); e.live = true; e.setWires(false)
    const fit = () => { const k = Math.min(window.devicePixelRatio || 1, 1.5); let w = innerWidth * k, h = innerHeight * k; const s = Math.sqrt(1_600_000 / (w * h)); if (s < 1) { w *= s; h *= s } e.setSize(w, h) }
    fit(); addEventListener("resize", fit)
    const next = playlist(), stat = { frames: 0, since: performance.now(), fps: 0, worlds: 0, name: "", musical: false, fading: 0 }
    let cur = { w: next(), t0: performance.now(), hold: 0, m: { dir: 1, push: 0.1 } }, busy = false, alive = true, raf = 0, nudge = false
    const motion = () => ({ dir: Math.random() < 0.5 ? -1 : 1, push: 0.06 + Math.random() * 0.08 })
    const show = (w: World) => { cur = { w, t0: performance.now(), hold: HOLD[0] + Math.random() * (HOLD[1] - HOLD[0]), m: motion() }; stat.worlds++; stat.name = w.name; setCaption({ name: w.name, key: stat.worlds }) }
    const overlay = fade.current!, ox = overlay.getContext("2d")!
    const fadeTo = (from: number, to: number, secs: number) => new Promise<void>((ok) => { const t0 = performance.now(); const step = (now: number) => { if (!alive) return ok(); const k = ease((now - t0) / 1000 / secs); overlay.style.opacity = String(from + (to - from) * k); stat.fading = k < 1 ? 1 : 0; if (k < 1) requestAnimationFrame(step); else ok() }; requestAnimationFrame(step) })
    /** Trace the next world where it will begin, then fade it in over this one, then let it move. */
    const advance = async () => {
      busy = true
      try {
        // traced a few strips per frame, so the world on screen keeps moving meanwhile
        const w = await prepare(next()), m = motion(), size = e.size
        const pic = await e.stillBetweenFrames(drift(w, 0, m), size.w, size.h, 6, { time: 0, alive: () => alive }); if (!alive || !pic) return
        overlay.width = pic.width; overlay.height = pic.height; ox.drawImage(pic, 0, 0)
        await fadeTo(0, 1, FADE_IN); if (!alive) return
        show(w); cur.m = m; await fadeTo(1, 0, FADE_OUT)
      } finally { busy = false }
    }
    void prepare(cur.w).then((w) => { if (!alive) return; show(w)
      // the very first world also arrives as a finished picture, then dissolves into motion
      void (async () => { busy = true; const pic = await e.still(drift(w, 0, cur.m), e.size.w, e.size.h, 6); if (!alive) return; overlay.width = pic.width; overlay.height = pic.height; ox.drawImage(pic, 0, 0); overlay.style.opacity = "1"; cur.t0 = performance.now(); await fadeTo(1, 0, FADE_OUT); busy = false })() })
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop); if (!stat.name) return
      const t = (now - cur.t0) / 1000; let w = drift(cur.w, t, cur.m), time = t * 0.45
      stat.musical = get().sounding || micOn()
      if (stat.musical) { const r = react(w, nowLevels()); w = r.world; time += r.time * 0.5 }
      e.time = time; e.setWorld(w)
      if (!busy && (t > cur.hold || nudge)) { nudge = false; void advance() }
      stat.frames++; if (now - stat.since > 1000) { stat.fps = Math.round((stat.frames * 1000) / (now - stat.since)); stat.frames = 0; stat.since = now }
    }
    raf = requestAnimationFrame(loop)
    ;(window as any).__saver = { stat, next: () => { nudge = true }, engine: e }
    const hintOff = setTimeout(() => setHint(false), 4500)
    return () => { alive = false; cancelAnimationFrame(raf); clearTimeout(hintOff); removeEventListener("resize", fit); e.dispose(); mainEngine?.pause(false); mainEngine?.touch() }
  }, [])

  // any key, click, touch or real mouse move goes back
  React.useEffect(() => {
    const t0 = performance.now(); let first: [number, number] | null = null
    const key = (ev: KeyboardEvent) => { ev.stopPropagation(); ev.preventDefault(); stop() }
    const click = (ev: Event) => { ev.preventDefault(); stop() }
    const move = (ev: PointerEvent) => { if (performance.now() - t0 < 900) return; if (!first) { first = [ev.clientX, ev.clientY]; return } if (Math.hypot(ev.clientX - first[0], ev.clientY - first[1]) > 12) stop() }
    addEventListener("keydown", key, { capture: true }); addEventListener("pointerdown", click, { capture: true }); addEventListener("pointermove", move, { capture: true })
    // leaving full screen (Escape, or the browser's own way out) also goes back
    let entered = !!document.fullscreenElement; const onFs = () => { if (document.fullscreenElement) entered = true; else if (entered && isOpen) stop() }
    document.addEventListener("fullscreenchange", onFs)
    return () => { removeEventListener("keydown", key, { capture: true }); removeEventListener("pointerdown", click, { capture: true }); removeEventListener("pointermove", move, { capture: true }); document.removeEventListener("fullscreenchange", onFs) }
  }, [])

  return (
    <div className="fixed inset-0 z-[70] cursor-none overflow-hidden bg-black select-none" data-testid="screensaver">
      <canvas ref={live} className="absolute inset-0 block size-full" />
      <canvas ref={fade} className="pointer-events-none absolute inset-0 block size-full" style={{ opacity: 0 }} />
      {caption && <div key={caption.key} className="pointer-events-none absolute bottom-7 left-8 animate-[saver-caption_9s_ease-in-out_forwards] text-[15px] font-light tracking-[0.18em] text-white/0 [text-shadow:0_1px_12px_rgba(0,0,0,.55)] max-sm:bottom-5 max-sm:left-5 max-sm:text-[13px]" data-testid="saver-caption">{caption.name}</div>}
      <div className={`pointer-events-none absolute inset-x-0 top-6 flex justify-center transition-opacity duration-[1400ms] ${hint ? "opacity-100" : "opacity-0"}`}>
        <span className="rounded-full bg-black/45 px-3.5 py-1.5 text-[12px] text-white/85 shadow-lg ring-1 ring-white/10 backdrop-blur-md" data-testid="saver-hint">Move the mouse or press any key to go back</span>
      </div>
      {err && <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-white/70">{err}</div>}
      <style>{"@keyframes saver-caption { 0% { color: rgb(255 255 255 / 0) } 18% { color: rgb(255 255 255 / .82) } 70% { color: rgb(255 255 255 / .82) } 100% { color: rgb(255 255 255 / 0) } }"}</style>
    </div>
  )
}

export const screensaverFeature: FeatureCode = {
  run: start, Overlay: Saver,
  boot: (q) => { if (q.has("screensaver")) setOpen(true) },
}
