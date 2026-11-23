// The cover maker: this world as a record. A square crop with a title, shown flat or inside a
// jewel case, a cassette or a vinyl sleeve. Everything is drawn here; no stock pictures.
import * as React from "react"
import { Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { engine, get, patch, useApp } from "@/store"

import { Switch } from "@/components/ui/switch"

import { Color, Row, Segmented } from "./fields"
import { download, fileName } from "./TopBar"

type Format = "flat" | "cd" | "tape" | "vinyl"
type Layout = "wide" | "corner" | "serif" | "stack" | "band" | "poster"
export interface CoverOpts { title: string; artist: string; layout: Layout; format: Format; ink: string; tracks: string; obi: boolean; obiText: string; obiColor: string }

function fitText(x: CanvasRenderingContext2D, text: string, font: (px: number) => string, max: number, start: number) { let px = start; x.font = font(px); while (x.measureText(text).width > max && px > 8) { px -= 2; x.font = font(px) } return px }
/** The square front: the picture with its words. */
export function drawFront(art: HTMLCanvasElement, o: CoverOpts, size = 1200): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d")!
  x.drawImage(art, 0, 0, size, size); x.fillStyle = o.ink; x.textBaseline = "alphabetic"
  const T = o.title.trim(), A = o.artist.trim(), pad = size * 0.07, L = o.obi ? size * 0.15 : 0 // the paper strip takes the left edge
  const spaced = (s: string, px: number, em: number) => { (x as any).letterSpacing = `${px * em}px`; return s }
  x.shadowColor = "rgba(0,0,0,.28)"; x.shadowBlur = size * 0.012
  if (o.layout === "wide") {
    let px = size * 0.07; const f = (p: number) => `300 ${p}px "Geist Variable", "Helvetica Neue", Arial, sans-serif`
    x.font = f(px); spaced(T, px, 0.42); while (x.measureText(T.toUpperCase()).width > size - L - pad * 2 && px > 10) { px -= 2; x.font = f(px); spaced(T, px, 0.42) }
    x.fillText(T.toUpperCase(), L + pad, pad + px)
    const ap = size * 0.018; x.font = `500 ${ap}px "Geist Mono Variable", ui-monospace, monospace`; spaced(A, ap, 0.3); x.fillText(A.toUpperCase(), L + pad, size - pad)
  } else if (o.layout === "corner") {
    const px = fitText(x, T, (p) => `600 ${p}px "Geist Variable", "Helvetica Neue", Arial, sans-serif`, (size - L) * 0.6, size * 0.045); (x as any).letterSpacing = "0px"
    x.fillText(T, L + pad, size - pad - size * 0.035); const ap = size * 0.024; x.font = `400 ${ap}px "Geist Variable", Arial, sans-serif`; x.globalAlpha = 0.85; x.fillText(A, L + pad, size - pad); x.globalAlpha = 1
    x.font = `500 ${size * 0.016}px "Geist Mono Variable", ui-monospace, monospace`; x.textAlign = "right"; x.fillText("STEREO · 33⅓", size - pad, pad + size * 0.016); x.textAlign = "left"
  } else if (o.layout === "serif") {
    (x as any).letterSpacing = "0px"; x.textAlign = "center"
    const px = fitText(x, T, (p) => `italic 500 ${p}px "Playfair Display Variable", Georgia, serif`, size - L - pad * 2, size * 0.13); x.fillText(T, (size + L) / 2, size * 0.5 + px * 0.3)
    const ap = size * 0.02; x.font = `500 ${ap}px "Geist Variable", Arial, sans-serif`; spaced(A, ap, 0.35); x.fillText(A.toUpperCase(), (size + L) / 2, size - pad); x.textAlign = "left"
  } else if (o.layout === "band") {
    (x as any).letterSpacing = "0px"; x.shadowColor = "transparent"; const bh = size * 0.2; x.fillStyle = o.ink; x.fillRect(0, size - bh, size, bh)
    const dark = parseInt(o.ink.slice(1, 3), 16) * 0.3 + parseInt(o.ink.slice(3, 5), 16) * 0.59 + parseInt(o.ink.slice(5, 7), 16) * 0.11 > 140; x.fillStyle = dark ? "#111114" : "#f6f3ea"
    const px = fitText(x, T.toUpperCase(), (p) => `400 ${p}px "Anton", "Geist Variable", Arial, sans-serif`, size - L - pad * 2, bh * 0.56); x.fillText(T.toUpperCase(), L + pad, size - bh * 0.42 + px * 0.2)
    const ap = size * 0.02; x.font = `500 ${ap}px "Geist Mono Variable", ui-monospace, monospace`; spaced(A, ap, 0.25); x.fillText(A.toUpperCase(), L + pad, size - bh * 0.14)
  } else if (o.layout === "poster") {
    (x as any).letterSpacing = "0px"; x.textAlign = "center"; const words = T.toUpperCase().split(/\s+/).filter(Boolean); let y = size * 0.5 - (words.length - 1) * size * 0.09
    for (const w of words) { const px = fitText(x, w, (p) => `400 ${p}px "Anton", "Geist Variable", Arial, sans-serif`, size - L - pad * 2, size * 0.2); x.fillText(w, (size + L) / 2, y + px * 0.36); y += px * 0.98 }
    const ap = size * 0.022; x.font = `400 ${ap * 1.6}px "Pacifico", Georgia, serif`; x.fillText(A, (size + L) / 2, size - pad); x.textAlign = "left"
  } else {
    (x as any).letterSpacing = "-2px"; const words = T.toUpperCase().split(/\s+/).filter(Boolean); let y = pad
    for (const w of words) { const px = fitText(x, w, (p) => `900 ${p}px "Geist Variable", "Helvetica Neue", Arial, sans-serif`, size - L - pad * 2, size * 0.26); y += px * 0.86; x.fillText(w, L + pad, y) }
    const ap = size * 0.02; x.font = `500 ${ap}px "Geist Mono Variable", ui-monospace, monospace`; spaced(A, ap, 0.25); x.fillText(A.toUpperCase(), L + pad, size - pad)
  }
  (x as any).letterSpacing = "0px"; x.shadowColor = "transparent"
  if (o.obi) { // a paper strip down the left side, as on Japanese releases
    const ow = size * 0.15; x.fillStyle = o.obiColor; x.fillRect(0, 0, ow, size); x.fillStyle = "rgba(0,0,0,.18)"; x.fillRect(ow - 2, 0, 2, size)
    const light = parseInt(o.obiColor.slice(1, 3), 16) * 0.3 + parseInt(o.obiColor.slice(3, 5), 16) * 0.59 + parseInt(o.obiColor.slice(5, 7), 16) * 0.11 > 140; x.fillStyle = light ? "#141418" : "#faf7f0"
    x.save(); x.translate(ow * 0.62, size * 0.06); x.rotate(Math.PI / 2); x.font = `700 ${ow * 0.36}px "Geist Variable", Arial, sans-serif`; x.fillText((o.obiText || T).slice(0, 34), 0, 0)
    x.font = `500 ${ow * 0.13}px "Geist Mono Variable", ui-monospace, monospace`; x.globalAlpha = 0.75; x.fillText(A.toUpperCase().slice(0, 44), 0, ow * 0.3); x.restore()
    x.font = `600 ${ow * 0.12}px "Geist Mono Variable", ui-monospace, monospace`; x.textAlign = "center"; x.fillText("STEREO", ow / 2, size * 0.955); x.textAlign = "left" }
  return c
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
    x.save(); x.translate(X - 34, Y + S - 30); x.rotate(-Math.PI / 2); x.fillStyle = "rgba(255,255,255,.82)"; x.font = `600 22px "Geist Variable", Arial, sans-serif`; x.fillText(`${o.title.slice(0, 30)}  ·  ${o.artist.slice(0, 30)}`.toUpperCase(), 0, 0); x.restore()
    x.drawImage(front, X, Y, S, S); x.fillStyle = shine(X, Y, S, S); x.fillRect(X, Y, S, S)
    x.strokeStyle = "rgba(255,255,255,.28)"; x.lineWidth = 2; rr(x, X - 78, Y - 14, S + 92, S + 28, 10); x.stroke()
  } else if (o.format === "tape") {
    const CW = 640, CH = 1000, X = (W - CW) / 2, Y = (H - CH) / 2, spine = 96
    shadow(70, 40); x.fillStyle = "#17181d"; rr(x, X - spine - 12, Y - 12, CW + spine + 24, CH + 24, 14); x.fill(); noShadow()
    x.fillStyle = "#f3efe6"; x.fillRect(X - spine, Y, spine, CH)
    x.save(); x.translate(X - spine / 2, Y + CH - 40); x.rotate(-Math.PI / 2); x.fillStyle = "#15151a"; x.font = `600 34px "Geist Variable", Arial, sans-serif`; x.fillText(o.title.slice(0, 26), 0, 12)
    x.font = `400 22px "Geist Mono Variable", monospace`; x.globalAlpha = 0.6; x.fillText(o.artist.slice(0, 30).toUpperCase(), 520, 9); x.restore()
    x.drawImage(front, X, Y, CW, CW); x.fillStyle = "#f3efe6"; x.fillRect(X, Y + CW, CW, CH - CW)
    x.fillStyle = "#15151a"; const lines = o.tracks.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 8)
    if (lines.length) { x.font = `500 20px "Geist Mono Variable", monospace`; lines.forEach((l, i) => { x.globalAlpha = 0.9; x.fillText(`${i + 1}  ${l}`.slice(0, 42), X + 36, Y + CW + 62 + i * 34) }) }
    else { x.font = `600 44px "Geist Variable", Arial, sans-serif`; x.fillText(o.title.slice(0, 22), X + 36, Y + CW + 96); x.font = `400 24px "Geist Variable", Arial, sans-serif`; x.globalAlpha = 0.7; x.fillText(o.artist.slice(0, 34), X + 36, Y + CW + 140) }
    x.globalAlpha = 1
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
  const [o, setO] = React.useState<CoverOpts>({ title: "", artist: "Untitled Worlds", layout: "wide", format: "cd", ink: "#ffffff", tracks: "", obi: false, obiText: "", obiColor: "#f3efe6" })
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
              <Segmented label="Type layout" value={o.layout} options={[{ value: "wide", label: "Wide" }, { value: "corner", label: "Label" }, { value: "serif", label: "Serif" }]} onChange={(v) => set({ layout: v })} />
              <div className="h-1" /><Segmented label="Type layout, more" value={o.layout} options={[{ value: "stack", label: "Stack" }, { value: "band", label: "Band" }, { value: "poster", label: "Poster" }]} onChange={(v) => set({ layout: v })} /></div>
            <div><p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">As a</p>
              <Segmented label="Format" value={o.format} options={[{ value: "flat", label: "Square" }, { value: "cd", label: "CD" }, { value: "tape", label: "Tape" }, { value: "vinyl", label: "Vinyl" }]} onChange={(v) => set({ format: v })} /></div>
            <Color label="Ink" value={o.ink} onChange={(v) => set({ ink: v })} />
            <Row label="Paper strip down the side"><Switch checked={o.obi} onCheckedChange={(v) => set({ obi: v })} aria-label="Paper strip" data-testid="cover-obi" /></Row>
            {o.obi && <><Input value={o.obiText} onChange={(e) => set({ obiText: e.target.value.slice(0, 34) })} placeholder="Words on the strip" aria-label="Words on the strip" /><Color label="Strip colour" value={o.obiColor} onChange={(v) => set({ obiColor: v })} /></>}
            {o.format === "tape" && <textarea value={o.tracks} onChange={(e) => set({ tracks: e.target.value.slice(0, 400) })} rows={4} placeholder={"Track names, one per line"} aria-label="Track names" data-testid="cover-tracks" className="w-full resize-none rounded-md bg-muted/60 px-2 py-1.5 text-[12.5px] outline-none focus:ring-1 focus:ring-ring" />}
            <Button className="glass-primary mt-auto" disabled={!art} onClick={() => out.current && download(out.current, `${fileName(o.title || world.name)}-${o.format}.png`)} data-testid="cover-save"><Download /> Save cover</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
