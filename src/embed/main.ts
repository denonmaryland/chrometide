// The light viewer: one world from #w=<share code>, filling its frame, for putting inside other
// people's pages. Drag to look around; it sharpens when still. Only the ray tracer comes along,
// none of the editor, so it loads fast.
//   ?autorotate        turn slowly (?autorotate=2 turns twice as fast)
//   ?quality=fine      draft, good, fine or premium (or 0 to 3): how sharp it gets when still
import "./embed.css"

import { Engine, QUALITY } from "@/engine/engine"
import { loadFonts, useCustomFont } from "@/engine/lettering"
import { type World, clone, decodeWorld } from "@/engine/scene"

const q = new URLSearchParams(location.search)
const NAMES = ["draft", "good", "fine", "premium"]
function readQuality(v: string | null) {
  if (v == null || v === "") return 1
  const named = NAMES.indexOf(v.toLowerCase()); if (named >= 0) return named
  const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= 3 ? n : 1
}
function readSpin(v: string | null) {
  if (v == null || /^(0|false|no|off)$/i.test(v)) return 0
  const n = Number(v); return v === "" || !isFinite(n) ? 1 : Math.min(5, Math.max(0.1, n))
}
const quality = readQuality(q.get("quality"))
const spin = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : readSpin(q.get("autorotate"))
const code = (/[#&]w=([^&]+)/.exec(location.hash)?.[1] ?? q.get("w") ?? "").trim()
const appUrl = new URL("./", location.href).href + (code ? `#w=${code}` : "")

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement = document.body) => { const e = document.createElement(tag); e.className = cls; parent.appendChild(e); return e }

/** The corner link back to the full app, with this world in it. */
function openLink(sky?: World["sky"]) {
  const a = el("a", "uw-open"); a.href = appUrl; a.target = "_blank"; a.rel = "noopener"; a.title = "Open this world in Untitled Worlds, where you can change it"
  const dot = el("span", "uw-dot", a); if (sky) dot.style.background = `linear-gradient(${sky.zenith}, ${sky.horizon})`
  el("span", "uw-long", a).textContent = "Open in Untitled Worlds"; el("span", "uw-short", a).textContent = "Open"
  return a
}
function message(text: string) {
  const box = el("div", "uw-message"); el("p", "", box).textContent = text; box.appendChild(openLink()).classList.add("uw-inline")
}

async function start() {
  const world = code ? await decodeWorld(code) : null
  if (!world) { message(code ? "This world could not be read. The code may have been cut short." : "No world here yet. Add #w= and a share code to the address."); return }
  const home = clone(world.cam)
  document.title = `${world.name || "A world"} · Untitled Worlds`
  document.body.style.background = `linear-gradient(${world.sky.zenith}, ${world.sky.horizon})`

  const canvas = el("canvas", "uw-canvas"); canvas.tabIndex = 0
  canvas.setAttribute("aria-label", `${world.name || "A world"}, ray traced. Drag or use the arrow keys to look around.`)
  const engine = new Engine(canvas); (window as any).__engine = engine; (window as any).__world = world
  if (!engine.ok) { canvas.remove(); message(engine.error); return }
  engine.setWires(false); engine.setQuality(QUALITY[quality].samples)

  const bar = el("div", "uw-bar"), fill = el("i", "", bar)
  engine.onStatus = (s) => { const k = s.phase === "done" ? 1 : s.samples / Math.max(1, s.target); fill.style.width = `${k * 100}%`; bar.classList.toggle("uw-gone", s.phase === "done") }
  if (world.name) el("div", "uw-name").textContent = world.name
  const hint = el("div", "uw-hint"); hint.textContent = "Drag to look around"
  setTimeout(() => hint.classList.add("uw-gone"), 3200)
  openLink(world.sky)

  // as many pixels as the screen has, up to a budget that keeps sharpening quick
  const fit = () => { const dpr = Math.min(devicePixelRatio || 1, 1.5), budget = [450_000, 900_000, 1_300_000, 1_800_000][quality]
    let w = innerWidth * dpr, h = innerHeight * dpr; const k = Math.sqrt(budget / Math.max(1, w * h)); if (k < 1) { w *= k; h *= k } engine.setSize(w, h) }
  fit(); addEventListener("resize", fit)
  engine.setWorld(world)

  // letters are drawn with real fonts: fetch them only when this world has letters
  const lettered = world.things.some((t) => t.kind === "text") || !!world.title?.text.trim()
  if (lettered || world.customFont) void (async () => {
    if (lettered) { await import("./fonts.css"); await loadFonts() }
    if (world.customFont) await useCustomFont(world.customFont)
    engine.resetGlyphs()
  })()

  // ---------- looking around ----------
  const changed = () => engine.setWorld(world)
  let spinning = spin > 0, idleSince = 0, visible = true
  const hold = () => { spinning = false; idleSince = 0; hint.classList.add("uw-gone") }
  const turn = (dx: number, dy: number) => { world.cam.yaw -= dx; world.cam.pitch = Math.max(0.01, Math.min(1.5, world.cam.pitch + dy)); changed() }
  const zoom = (k: number) => { world.cam.dist = Math.max(3, Math.min(120, world.cam.dist * k)); changed() }
  const pts = new Map<number, [number, number]>(); let pinch = 0
  canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); pinch = 0; hold() })
  canvas.addEventListener("pointermove", (e) => {
    const p = pts.get(e.pointerId); if (!p) return
    const dx = e.clientX - p[0], dy = e.clientY - p[1]; pts.set(e.pointerId, [e.clientX, e.clientY])
    if (pts.size === 2) { const v = [...pts.values()], d = Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1]); if (pinch) zoom(pinch / d); pinch = d; return }
    turn(dx * 0.006, dy * 0.004)
  })
  const up = (e: PointerEvent) => { pts.delete(e.pointerId); pinch = 0; if (!pts.size) idleSince = performance.now() }
  canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up)
  // a plain wheel scrolls the page around the frame; a pinch on a trackpad (or Ctrl + wheel) zooms
  canvas.addEventListener("wheel", (e) => { if (!e.ctrlKey) return; e.preventDefault(); hold(); idleSince = performance.now(); zoom(Math.exp(e.deltaY * 0.01)) }, { passive: false })
  canvas.addEventListener("dblclick", () => { Object.assign(world.cam, clone(home)); changed() })
  canvas.addEventListener("keydown", (e) => {
    const k = e.key, step = e.shiftKey ? 0.25 : 0.08
    if (k === "ArrowLeft") turn(-step, 0); else if (k === "ArrowRight") turn(step, 0); else if (k === "ArrowUp") turn(0, step * 0.6); else if (k === "ArrowDown") turn(0, -step * 0.6)
    else if (k === "+" || k === "=") zoom(0.9); else if (k === "-") zoom(1.1); else if (k === "0" || k === "Home") { Object.assign(world.cam, clone(home)); changed() } else return
    e.preventDefault(); hold(); idleSince = performance.now()
  })

  // rest when nobody can see it: scrolled away, or in a hidden tab
  const rest = () => { const on = visible && !document.hidden; engine.pause(!on); if (on) engine.touch(true) }
  new IntersectionObserver((es) => { visible = es.some((x) => x.isIntersecting); rest() }).observe(canvas)
  document.addEventListener("visibilitychange", rest)

  // turning: a quick whole picture every frame; it sharpens again as soon as it stops
  let last = 0
  const tick = (now: number) => {
    requestAnimationFrame(tick); const dt = last ? Math.min(100, now - last) : 16; last = now
    if (spin && !spinning && idleSince && !pts.size && now - idleSince > 8000) spinning = true
    const live = spinning && visible && !document.hidden
    if (engine.live !== live) { engine.live = live; changed() }
    if (live) { world.cam.yaw += dt * 0.00011 * spin; changed() }
  }
  requestAnimationFrame(tick)
}
// a page that swaps the code in its frame changes only the address's end: start again with the new world
addEventListener("hashchange", () => location.reload())
void start()
