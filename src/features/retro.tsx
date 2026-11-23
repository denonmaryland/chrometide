// 1994 mode: the picture the way a mid-90s home computer made it. 640 x 480, 256 colours with an
// ordered dither, arriving line by line from the top at period speed, on a softly glowing tube.
// The world is traced once (offscreen, at good quality), then shown crawling down the screen.
// Save the finished picture as a PNG with the look, or film the crawl as a short clip.
import * as React from "react"
import { Clapperboard, Dices, Download, Monitor, RotateCcw, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { engine, get, rollDice, useApp } from "@/store"
import { Dial } from "@/ui/fields"
import { download, fileName } from "@/ui/TopBar"

import type { Feature } from "./index"
import { SH, SW, type Tube, countColours, dither, pal, textWidth, tube, write } from "./retro-look"

// ---------- open or closed, shared with the menu ----------
let isOpen = false; const subs = new Set<() => void>()
const setOpen = (v: boolean) => { isOpen = v; subs.forEach((f) => f()) }
const useOpen = () => React.useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => isOpen)

export interface Look { glow: boolean; lines: boolean; curve: boolean }
const C = { black: pal(0, 0, 0), grey: pal(192, 192, 192), dim: pal(128, 128, 128), white: pal(255, 255, 255), bar: pal(0, 0, 102), barHi: pal(51, 51, 153), amber: pal(255, 213, 102), green: pal(102, 255, 102) }
const BOOT = ["READING THE WORLD", "PLACING THE SHAPES", "MIXING THE SKY", "WARMING THE TUBE"]
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

/** The 640 x 480 screen: boot text while the world is traced, then the picture crawling down. */
class Crawl {
  screen = Object.assign(document.createElement("canvas"), { width: SW, height: SH }); x = this.screen.getContext("2d", { willReadFrequently: false })!
  pic: ImageData | null = null; name = ""; colours = 0
  phase: "warm" | "crawl" | "done" = "warm"; warmAt = 0; t0 = 0; secs = 30; doneAt = 0
  warm(name: string, now: number) { this.phase = "warm"; this.warmAt = now; this.name = name; this.pic = null }
  start(now: number, secs: number) { this.phase = "crawl"; this.t0 = now; this.secs = secs }
  progress(now: number) { return this.phase === "done" ? 1 : this.phase === "crawl" ? Math.min(1, (now - this.t0) / 1000 / this.secs) : 0 }
  /** Draw the screen as it is at this moment. `clean` leaves out the status line (for the PNG). */
  compose(now: number, clean = false) {
    const x = this.x; x.fillStyle = C.black; x.fillRect(0, 0, SW, SH)
    if (this.phase === "warm" || !this.pic) { this.boot(now); return }
    const p = this.progress(now); if (p >= 1 && this.phase === "crawl") { this.phase = "done"; this.doneAt = now }
    const rows = p * SH, full = Math.floor(rows), col = Math.floor((rows - full) * SW)
    if (full > 0) x.putImageData(this.pic, 0, 0, 0, 0, SW, full)
    if (full < SH && col > 0) x.putImageData(this.pic, 0, 0, 0, full, col, 1)
    if (p < 1) { x.fillStyle = C.white; x.fillRect(col, full, 3, 1) } // the beam, mid-line
    const showBar = !clean && (this.phase === "crawl" || now - this.doneAt < 3500)
    if (showBar) this.bar(now, p, full)
  }
  private boot(now: number) {
    const x = this.x, t = (now - this.warmAt) / 1000; let y = 26
    write(x, "UNTITLED WORLDS", 24, y, C.white, 2); write(x, "1994 EDITION", 24 + textWidth("UNTITLED WORLDS ", 2), y + 7, C.amber); y += 30
    write(x, `${SW} X ${SH}   256 COLOURS   1 PICTURE`, 24, y, C.dim); y += 22
    write(x, `SCENE: "${this.name.toUpperCase().slice(0, 60)}"`, 24, y, C.grey); y += 18
    BOOT.forEach((line, i) => { if (t < i * 0.32) return; const ok = t > i * 0.32 + 0.28
      const end = write(x, line + " " + ".".repeat(Math.max(2, 26 - line.length)), 24, y, C.grey); if (ok) write(x, " OK", end, y, C.green); y += 12 })
    y += 8; if (t > BOOT.length * 0.32) { const end = write(x, "TRACING RAYS ", 24, y, C.grey); if (Math.floor(t * 2.5) % 2 === 0) { x.fillStyle = C.grey; x.fillRect(end + 2, y, 5, 7) } }
    write(x, "SPACE: ANOTHER WORLD    ESC: BACK", 24, SH - 22, C.dim)
  }
  private bar(now: number, p: number, line: number) {
    const x = this.x, y = SH - 13
    x.fillStyle = C.bar; x.fillRect(0, y, SW, 13); x.fillStyle = C.barHi; x.fillRect(0, y, SW, 1)
    write(x, "UW/94", 6, y + 3, C.amber)
    if (this.phase === "done") {
      write(x, `DONE IN ${clock(this.secs)}   ${this.colours} COLOURS   ${SW} X ${SH}`, 48, y + 3, C.white); return
    }
    const left = write(x, `TRACING LINE ${String(Math.min(SH, line + 1)).padStart(3, "0")} OF ${SH}`, 48, y + 3, C.white) + 10
    const right = SW - 6 - textWidth("00:00 LEFT"), bw = right - 46 - left
    x.fillStyle = C.black; x.fillRect(left, y + 3, bw, 7)
    const cells = Math.floor(bw / 6); x.fillStyle = C.green; for (let i = 0; i < Math.floor(cells * p); i++) x.fillRect(left + 1 + i * 6, y + 4, 5, 5)
    write(x, `${String(Math.floor(p * 100)).padStart(3, " ")}%`, left + bw + 8, y + 3, C.white)
    write(x, `${clock(Math.max(0, this.secs * (1 - p))).padStart(5, " ")} LEFT`, right, y + 3, C.grey)
  }
}

const pickType = () => ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t))
const CLIP_SECS = 10

function Retro() {
  const open = useOpen(); if (!open) return null
  return <RetroScreen />
}

function RetroScreen() {
  const world = useApp((s) => s.world)
  const view = React.useRef<HTMLCanvasElement>(null), crawl = React.useRef<Crawl | null>(null), tb = React.useRef<Tube | null>(null)
  const [look, setLook] = React.useState<Look>({ glow: true, lines: true, curve: true }); const lookRef = React.useRef(look); lookRef.current = look
  const [secs, setSecs] = React.useState(30); const secsRef = React.useRef(secs); secsRef.current = secs
  const [phase, setPhase] = React.useState<Crawl["phase"]>("warm"); const [film, setFilm] = React.useState<null | "filming" | { url: string; ext: string }>(null)
  const job = React.useRef(0), filming = React.useRef(false)
  /** a fixed 1280 x 960 tube for what is saved (a picture or a clip), so files look the same on every screen */
  const rec = React.useRef<{ canvas: HTMLCanvasElement; tube: Tube } | null>(null)
  const exportTube = () => { if (!rec.current) { const canvas = Object.assign(document.createElement("canvas"), { width: SW * 2, height: SH * 2 }); rec.current = { canvas, tube: tube(canvas) } } return rec.current }

  // the tube, the screen and the drawing loop
  React.useEffect(() => {
    const c = new Crawl(); crawl.current = c; const t = tube(view.current!); tb.current = t
    // the canvas has as many pixels as it shows, so the lines are drawn by the tube, not resampled by the page
    const v = view.current!, fit = () => { const k = Math.min(window.devicePixelRatio || 1, 2), w = Math.min(2560, Math.round(v.clientWidth * k)); if (w > 0 && w !== v.width) { v.width = w; v.height = Math.round((w * 3) / 4) } }
    const ro = new ResizeObserver(fit); ro.observe(v); fit()
    let raf = 0; const loop = (now: number) => { raf = requestAnimationFrame(loop); const before = c.phase; c.compose(now); t.draw(c.screen, lookRef.current); if (filming.current) rec.current?.tube.draw(c.screen, lookRef.current); if (c.phase !== before) setPhase(c.phase) }
    raf = requestAnimationFrame(loop); engine?.pause(true)
    ;(window as any).__retro = { crawl: c, colours: () => (c.pic ? countColours(c.pic) : 0), progress: () => c.progress(performance.now()), phase: () => c.phase }
    return () => { cancelAnimationFrame(raf); ro.disconnect(); job.current++; t.dispose(); rec.current?.tube.dispose(); engine?.pause(false); engine?.touch() }
  }, [])
  // a new or changed world: trace it at 640 x 480, dither it, then let it crawl
  const trace = React.useCallback(async (w = get().world) => {
    const id = ++job.current, c = crawl.current!; c.warm(w.name, performance.now()); setPhase("warm")
    await new Promise((ok) => setTimeout(ok, 350)); if (id !== job.current) return
    while (!engine) { await new Promise((ok) => setTimeout(ok, 100)); if (id !== job.current) return }
    const pic = await engine.still(w, SW, SH, 16); if (id !== job.current) return; engine.pause(true)
    const img = dither(pic.getContext("2d")!.getImageData(0, 0, SW, SH)); const wait = 2600 - (performance.now() - c.warmAt)
    if (wait > 0) await new Promise((ok) => setTimeout(ok, wait)); if (id !== job.current) return
    c.pic = img; c.colours = countColours(img); c.start(performance.now(), filming.current ? Math.min(CLIP_SECS, secsRef.current) : secsRef.current); setPhase("crawl")
  }, [])
  React.useEffect(() => { if (!filming.current) { void trace(world); setFilm(null) } }, [world, trace])
  // keys: Escape goes back, Space rolls a new world; the rest of the app's keys wait
  React.useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); return } if (e.key === " " && !filming.current) return; if ((e.target as HTMLElement)?.tagName === "INPUT") return; e.stopPropagation() }
    addEventListener("keydown", key, { capture: true }); return () => removeEventListener("keydown", key, { capture: true })
  }, [])

  const again = () => { const c = crawl.current!; if (c.pic) { c.start(performance.now(), secsRef.current); setPhase("crawl") } else void trace() }
  const savePng = () => { const c = crawl.current!, x = exportTube(); if (!c.pic) return
    const keep = c.phase; c.phase = "done"; c.compose(performance.now(), true); x.tube.draw(c.screen, look); c.phase = keep
    download(x.canvas, `${fileName(get().world.name)}-1994.png`) }
  const filmIt = async () => {
    const type = pickType(), c = crawl.current!, v = exportTube().canvas; if (!type || !c.pic || filming.current) return
    filming.current = true; setFilm("filming")
    const rec = new MediaRecorder(v.captureStream(30), { mimeType: type, videoBitsPerSecond: 8_000_000 }), chunks: Blob[] = []
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }; const stopped = new Promise<void>((ok) => (rec.onstop = () => ok()))
    const pic = c.pic; c.warm(get().world.name, performance.now()); rec.start(250)
    await new Promise((ok) => setTimeout(ok, 2400)); c.pic = pic; c.start(performance.now(), Math.min(CLIP_SECS, secsRef.current)); setPhase("crawl")
    while (c.phase !== "done") await new Promise((ok) => setTimeout(ok, 100))
    await new Promise((ok) => setTimeout(ok, 2600)); rec.stop(); await stopped; filming.current = false
    const blob = new Blob(chunks, { type: type.split(";")[0] }); (window as any).__retroClip = blob
    setFilm({ url: URL.createObjectURL(blob), ext: type.includes("mp4") ? "mp4" : "webm" })
  }
  React.useEffect(() => () => { if (film && typeof film === "object") URL.revokeObjectURL(film.url) }, [film])

  const busy = phase === "warm"
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 overflow-y-auto bg-[radial-gradient(120%_90%_at_50%_30%,#1b1a22,#08080b_70%)] p-3" data-testid="retro">
      {/* the monitor */}
      <div className="relative shrink-0 rounded-[26px] bg-[linear-gradient(180deg,#2c2b31,#1a191e)] p-[2.2%] pb-[4.2%] shadow-[0_40px_90px_-30px_rgba(0,0,0,.9),inset_0_1px_0_rgba(255,255,255,.08)] ring-1 ring-black/60"
        style={{ width: "min(calc(100vw - 24px), calc((100dvh - 150px) * 4 / 3 * 0.93))" }}>
        <div className="overflow-hidden rounded-[14px] bg-black shadow-[inset_0_0_30px_rgba(0,0,0,.9)] ring-1 ring-black">
          <canvas ref={view} width={SW * 2} height={SH * 2} className="block aspect-[4/3] w-full" aria-label="The picture, as a 1994 computer draws it" data-testid="retro-canvas" />
        </div>
        <div className="absolute inset-x-[4%] bottom-[1.1%] flex items-center justify-between text-[10px] font-medium tracking-[0.25em] text-white/25 uppercase max-sm:text-[8px]">
          <span>Untitled Worlds · 94</span>
          <span className="flex items-center gap-1.5"><span className={cn("size-1.5 rounded-full", busy ? "bg-amber-400 shadow-[0_0_6px_#fbbf24]" : phase === "crawl" ? "animate-pulse bg-amber-300 shadow-[0_0_6px_#fcd34d]" : "bg-emerald-400 shadow-[0_0_6px_#34d399]")} />power</span>
        </div>
      </div>
      {/* the controls */}
      <div className="glass-panel flex max-w-[min(100%,980px)] flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-xl px-2.5 py-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={again} disabled={busy || film === "filming"} data-testid="retro-again"><RotateCcw /> Again</Button>
          <Button variant="ghost" size="sm" onClick={() => rollDice()} disabled={film === "filming"} data-testid="retro-roll"><Dices /> New world</Button>
        </div>
        <div className="w-56 max-sm:w-full"><Dial label="Seconds" value={secs} min={15} max={60} step={5} onChange={setSecs} unit="s" /></div>
        <div className="flex items-center gap-3 text-[12.5px] text-foreground/80">
          {(["glow", "lines", "curve"] as const).map((k) => <label key={k} className="flex items-center gap-1.5"><Switch size="sm" checked={look[k]} onCheckedChange={(v) => setLook((l) => ({ ...l, [k]: v }))} aria-label={k} />{{ glow: "Glow", lines: "Scanlines", curve: "Curved glass" }[k]}</label>)}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="glass" size="sm" onClick={savePng} disabled={busy} data-testid="retro-png"><Download /> Picture</Button>
          {film && typeof film === "object"
            ? <a href={film.url} download={`${fileName(world.name)}-1994.${film.ext}`} data-testid="retro-clip"><Button variant="glass" size="sm" className="glass-primary"><Download /> Save clip</Button></a>
            : <Button variant="glass" size="sm" onClick={() => void filmIt()} disabled={busy || film === "filming"} data-testid="retro-film"><Clapperboard /> {film === "filming" ? "Filming…" : "Film the crawl"}</Button>}
          <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Back to the app" data-testid="retro-close"><X /></Button>
        </div>
      </div>
    </div>
  )
}

export const retroFeature: Feature = {
  id: "1994", label: "1994 mode", about: "Watch the picture arrive line by line, the way a 1994 computer drew it.", icon: Monitor,
  run: () => setOpen(true), Overlay: Retro,
  boot: (q) => { if (q.has("1994") || q.has("retro")) setOpen(true) },
}
