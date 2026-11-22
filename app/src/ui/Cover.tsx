// The cover maker: this world as a record. A square crop with a title, shown flat or inside a
// jewel case, a cassette or a vinyl sleeve. Everything is drawn here; no stock pictures.
import * as React from "react"
import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { engine, get, patch, useApp } from "@/store"

import { Color, Segmented } from "./fields"
import { download, fileName } from "./TopBar"

type Format = "flat" | "cd" | "tape" | "vinyl"
type Layout = "wide" | "corner" | "serif" | "stack"
export interface CoverOpts { title: string; artist: string; layout: Layout; format: Format; ink: string }

function fitText(x: CanvasRenderingContext2D, text: string, font: (px: number) => string, max: number, start: number) { let px = start; x.font = font(px); while (x.measureText(text).width > max && px > 8) { px -= 2; x.font = font(px) } return px }
/** The square front: the picture with its words. */
export function drawFront(art: HTMLCanvasElement, o: CoverOpts, size = 1200): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d")!
  x.drawImage(art, 0, 0, size, size); x.fillStyle = o.ink; x.textBaseline = "alphabetic"
  const T = o.title.trim(), A = o.artist.trim(), pad = size * 0.07
  const spaced = (s: string, px: number, em: number) => { (x as any).letterSpacing = `${px * em}px`; return s }
  x.shadowColor = "rgba(0,0,0,.28)"; x.shadowBlur = size * 0.012
  if (o.layout === "wide") {
    let px = size * 0.07; const f = (p: number) => `300 ${p}px "Geist Variable", "Helvetica Neue", Arial, sans-serif`
    x.font = f(px); spaced(T, px, 0.42); while (x.measureText(T.toUpperCase()).width > size - pad * 2 && px > 10) { px -= 2; x.font = f(px); spaced(T, px, 0.42) }
    x.fillText(T.toUpperCase(), pad, pad + px)
    const ap = size * 0.018; x.font = `500 ${ap}px "Geist Mono Variable", ui-monospace, monospace`; spaced(A, ap, 0.3); x.fillText(A.toUpperCase(), pad, size - pad)
  } else if (o.layout === "corner") {
    const px = fitText(x, T, (p) => `600 ${p}px "Geist Variable", "Helvetica Neue", Arial, sans-serif`, size * 0.6, size * 0.045); (x as any).letterSpacing = "0px"
    x.fillText(T, pad, size - pad - size * 0.035); const ap = size * 0.024; x.font = `400 ${ap}px "Geist Variable", Arial, sans-serif`; x.globalAlpha = 0.85; x.fillText(A, pad, size - pad); x.globalAlpha = 1
    x.font = `500 ${size * 0.016}px "Geist Mono Variable", ui-monospace, monospace`; x.textAlign = "right"; x.fillText("STEREO · 33⅓", size - pad, pad + size * 0.016); x.textAlign = "left"
  } else if (o.layout === "serif") {
    (x as any).letterSpacing = "0px"; x.textAlign = "center"
    const px = fitText(x, T, (p) => `italic 500 ${p}px "Playfair Display Variable", Georgia, serif`, size - pad * 2, size * 0.13); x.fillText(T, size / 2, size * 0.5 + px * 0.3)
    const ap = size * 0.02; x.font = `500 ${ap}px "Geist Variable", Arial, sans-serif`; spaced(A, ap, 0.35); x.fillText(A.toUpperCase(), size / 2, size - pad); x.textAlign = "left"
  } else {
    (x as any).letterSpacing = "-2px"; const words = T.toUpperCase().split(/\s+/).filter(Boolean); let y = pad
    for (const w of words) { const px = fitText(x, w, (p) => `900 ${p}px "Geist Variable", "Helvetica Neue", Arial, sans-serif`, size - pad * 2, size * 0.26); y += px * 0.86; x.fillText(w, pad, y) }
    const ap = size * 0.02; x.font = `500 ${ap}px "Geist Mono Variable", ui-monospace, monospace`; spaced(A, ap, 0.25); x.fillText(A.toUpperCase(), pad, size - pad)
  }
  (x as any).letterSpacing = "0px"; return c
}
const rr = (x: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, r: number) => { x.beginPath(); x.roundRect(X, Y, W, H, r) }
/** The front placed in an object, on a soft backdrop taken from the picture's own colours. */
export function drawMock(front: HTMLCanvasElement, o: CoverOpts, bg: [string, string]): HTMLCanvasElement {
  if (o.format === "flat") return front
  const W = 1600, H = 1200, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d")!
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]); x.fillStyle = g; x.fillRect(0, 0, W, H)
  x.fillStyle = "rgba(10,10,16,.35)"; x.fillRect(0, 0, W, H)
  const shadow = (blur: number, y: number) => { x.shadowColor = "rgba(0,0,0,.55)"; x.shadowBlur = blur; x.shadowOffsetY = y }, noShadow = () => { x.shadowColor = "transparent"; x.shadowBlur = 0; x.shadowOffsetY = 0 }
  const shine = (X: number, Y: number, S: number, T: number) => { const s = x.createLinearGradient(X, Y, X + S, Y + T); s.addColorStop(0, "rgba(255,255,255,.28)"); s.addColorStop(0.28, "rgba(255,255,255,.03)"); s.addColorStop(0.6, "rgba(255,255,255,0)"); s.addColorStop(1, "rgba(255,255,255,.12)"); return s }
  if (o.format === "cd") {
    const S = 820, X = (W - S) / 2 + 30, Y = (H - S) / 2
    shadow(70, 40); x.fillStyle = "#16171c"; rr(x, X - 78, Y - 14, S + 92, S + 28, 10); x.fill(); noShadow()
    x.fillStyle = "#0b0b0f"; x.fillRect(X - 70, Y - 6, 56, S + 12)
    for (let i = 0; i < 22; i++) { x.fillStyle = "rgba(255,255,255,.07)"; x.fillRect(X - 62, Y + 10 + i * ((S - 20) / 22), 40, 3) }
    x.drawImage(front, X, Y, S, S); x.fillStyle = shine(X, Y, S, S); x.fillRect(X, Y, S, S)
    x.strokeStyle = "rgba(255,255,255,.28)"; x.lineWidth = 2; rr(x, X - 78, Y - 14, S + 92, S + 28, 10); x.stroke()
  } else if (o.format === "tape") {
    const CW = 640, CH = 1000, X = (W - CW) / 2, Y = (H - CH) / 2, spine = 96
    shadow(70, 40); x.fillStyle = "#17181d"; rr(x, X - spine - 12, Y - 12, CW + spine + 24, CH + 24, 14); x.fill(); noShadow()
    x.fillStyle = "#f3efe6"; x.fillRect(X - spine, Y, spine, CH)
    x.save(); x.translate(X - spine / 2, Y + CH - 40); x.rotate(-Math.PI / 2); x.fillStyle = "#15151a"; x.font = `600 34px "Geist Variable", Arial, sans-serif`; x.fillText(o.title.slice(0, 26), 0, 12)
    x.font = `400 22px "Geist Mono Variable", monospace`; x.globalAlpha = 0.6; x.fillText(o.artist.slice(0, 30).toUpperCase(), 520, 9); x.restore()
    x.drawImage(front, X, Y, CW, CW); x.fillStyle = "#f3efe6"; x.fillRect(X, Y + CW, CW, CH - CW)
    x.fillStyle = "#15151a"; x.font = `500 20px "Geist Mono Variable", monospace`; const side = ["SIDE A", "1  " + (o.title || "Untitled"), "2  Low water", "3  A slower light", "", "SIDE B", "4  Mirror hours", "5  " + (o.artist || "Unknown")]
    side.forEach((l, i) => { x.globalAlpha = l.startsWith("SIDE") ? 0.5 : 0.9; x.fillText(l.slice(0, 40), X + 36, Y + CW + 60 + i * 34) }); x.globalAlpha = 1
    x.fillStyle = shine(X - spine, Y, CW + spine, CH); x.fillRect(X - spine, Y, CW + spine, CH)
    x.strokeStyle = "rgba(255,255,255,.3)"; x.lineWidth = 2; rr(x, X - spine - 12, Y - 12, CW + spine + 24, CH + 24, 14); x.stroke()
  } else {
    const S = 860, X = 170, Y = (H - S) / 2, cx = X + S + 60, cy = H / 2, R = S * 0.48
    shadow(50, 30); x.fillStyle = "#0c0c0f"; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fill(); noShadow()
    for (let r = R * 0.38; r < R * 0.97; r += 5) { x.strokeStyle = `rgba(255,255,255,${0.03 + 0.04 * Math.abs(Math.sin(r))})`; x.lineWidth = 1; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke() }
    const sg = x.createConicGradient(0.6, cx, cy); sg.addColorStop(0, "rgba(255,255,255,0)"); sg.addColorStop(0.07, "rgba(255,255,255,.16)"); sg.addColorStop(0.14, "rgba(255,255,255,0)"); sg.addColorStop(0.5, "rgba(255,255,255,0)"); sg.addColorStop(0.57, "rgba(255,255,255,.12)"); sg.addColorStop(0.64, "rgba(255,255,255,0)")
    x.fillStyle = sg; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fill()
    x.save(); x.beginPath(); x.arc(cx, cy, R * 0.33, 0, 7); x.clip(); x.drawImage(front, cx - R * 0.33, cy - R * 0.33, R * 0.66, R * 0.66); x.restore()
    x.fillStyle = "#0c0c0f"; x.beginPath(); x.arc(cx, cy, 9, 0, 7); x.fill()
    shadow(70, 40); x.fillStyle = "#111"; x.fillRect(X, Y, S, S); noShadow(); x.drawImage(front, X, Y, S, S)
    x.fillStyle = shine(X, Y, S, S); x.globalAlpha = 0.5; x.fillRect(X, Y, S, S); x.globalAlpha = 1
  }
  return c
}

export function CoverDialog() {
  const open = useApp((s) => s.dialog === "cover"); const world = useApp((s) => s.world)
  const [o, setO] = React.useState<CoverOpts>({ title: "", artist: "Untitled Worlds", layout: "wide", format: "cd", ink: "#ffffff" })
  const [art, setArt] = React.useState<HTMLCanvasElement | null>(null); const [progress, setProgress] = React.useState(0)
  const view = React.useRef<HTMLCanvasElement>(null); const out = React.useRef<HTMLCanvasElement | null>(null)
  React.useEffect(() => { if (!open) return; setO((p) => ({ ...p, title: p.title || get().world.name })); setArt(null); setProgress(0)
    let live = true; const id = setTimeout(async () => { if (!engine) return; const c = await engine.still({ ...get().world, cam: { ...get().world.cam, pano: false } }, 1200, 1200, 24, (f) => live && setProgress(f)); if (live) setArt(c) }, 80)
    return () => { live = false; clearTimeout(id) } }, [open])
  React.useEffect(() => { if (!art || !view.current) return
    const m = drawMock(drawFront(art, o), o, [world.sky.zenith, world.sky.horizon]); out.current = m
    const v = view.current; v.width = m.width; v.height = m.height; v.getContext("2d")!.drawImage(m, 0, 0) }, [art, o, world.sky.zenith, world.sky.horizon])
  const set = (p: Partial<CoverOpts>) => setO((x) => ({ ...x, ...p }))
  return (
    <Dialog open={open} onOpenChange={(v) => patch({ dialog: v ? "cover" : null })}>
      <DialogContent className="max-h-[92dvh] w-[min(940px,96vw)] max-w-none overflow-y-auto sm:max-w-none">
        <DialogHeader><DialogTitle>Cover maker</DialogTitle><DialogDescription>Your world as a record. Ask the room for a title.</DialogDescription></DialogHeader>
        <div className="grid gap-4 md:grid-cols-[1fr_260px]">
          <div className="relative grid min-h-64 place-items-center overflow-hidden rounded-lg bg-black/40 ring-1 ring-border">
            <canvas ref={view} className="max-h-[62dvh] w-full object-contain" data-testid="cover-canvas" style={{ display: art ? "block" : "none" }} />
            {!art && <div className="flex flex-col items-center gap-2 py-24 text-[12.5px] text-muted-foreground"><div className="h-1 w-40 overflow-hidden rounded-full bg-muted"><div className="h-full bg-foreground/70" style={{ width: `${progress * 100}%` }} /></div>Developing the square picture…</div>}
          </div>
          <div className="flex flex-col gap-3">
            <Input value={o.title} onChange={(e) => set({ title: e.target.value.slice(0, 40) })} placeholder="Album title" aria-label="Album title" data-testid="cover-title" />
            <Input value={o.artist} onChange={(e) => set({ artist: e.target.value.slice(0, 40) })} placeholder="Artist" aria-label="Artist" />
            <div><p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Type</p>
              <Segmented label="Type layout" value={o.layout} options={[{ value: "wide", label: "Wide" }, { value: "corner", label: "Label" }, { value: "serif", label: "Serif" }, { value: "stack", label: "Stack" }]} onChange={(v) => set({ layout: v })} /></div>
            <div><p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">As a</p>
              <Segmented label="Format" value={o.format} options={[{ value: "flat", label: "Square" }, { value: "cd", label: "CD" }, { value: "tape", label: "Tape" }, { value: "vinyl", label: "Vinyl" }]} onChange={(v) => set({ format: v })} /></div>
            <Color label="Ink" value={o.ink} onChange={(v) => set({ ink: v })} />
            <Button className="glass-primary mt-auto" disabled={!art} onClick={() => out.current && download(out.current, `${fileName(o.title || world.name)}-${o.format}.png`)} data-testid="cover-save"><Download /> Save cover</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
