// Loops: a few seconds of this world moving, saved as a video. Frames are ray traced one at a
// time; the recorder is paused between them so the video plays at the right speed however long
// each frame took.
import * as React from "react"
import { Clapperboard, Download } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { type World, clone } from "@/engine/scene"
import { engine, get, patch, useApp } from "@/store"

import { Dial, Row, Segmented } from "./fields"
import { fileName } from "./TopBar"

export interface LoopOpts { orbit: boolean; float: boolean; day: boolean; drift: boolean; seconds: number; size: "small" | "square" | "wide" | "tall" }
const SIZES = { small: [480, 360], square: [720, 720], wide: [960, 540], tall: [540, 960] } as const

/** The world at a moment of the loop, t from 0 to 1. Everything returns to where it began. */
export function worldAt(w: World, o: LoopOpts, t: number): { world: World; time: number; phase: number } {
  const x = clone(w)
  if (o.orbit) x.cam.yaw += t * Math.PI * 2
  if (o.day) { x.sky.sun.el = Math.max(0.03, w.sky.sun.el + Math.sin(t * Math.PI * 2) * Math.min(0.45, w.sky.sun.el * 0.8)); x.sky.sun.az += Math.sin(t * Math.PI * 2 + 1.2) * 0.35 }
  if (o.float) x.things.forEach((th) => { th.bob = th.bob || 0.22 })
  // clouds and water cannot circle back on their own, so they breathe out and in again
  return { world: x, time: o.drift ? (1 - Math.cos(t * Math.PI * 2)) * 0.5 * o.seconds * 0.6 : 0, phase: t }
}
const pickType = () => ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t))

export async function recordLoop(w: World, o: LoopOpts, onProgress: (f: number, frame: HTMLCanvasElement) => void, alive: () => boolean): Promise<Blob | null> {
  if (!engine) return null; const type = pickType(); if (!type) return null
  const [W, H] = SIZES[o.size], fps = 24, n = Math.round(o.seconds * fps)
  const stage = document.createElement("canvas"); stage.width = W; stage.height = H; const ctx = stage.getContext("2d")!
  const stream = stage.captureStream(0), track = stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void }
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 9_000_000 }); const chunks: Blob[] = []
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
  const stopped = new Promise<void>((ok) => (rec.onstop = () => ok()))
  const sleep = (ms: number) => new Promise((ok) => setTimeout(ok, ms))
  const tmp = document.createElement("canvas"); rec.start(); rec.pause()
  for (let i = 0; i < n; i++) {
    if (!alive()) { rec.stop(); return null }
    const t = i / n, at = worldAt(w, o, t)
    engine.frame(at.world, W, H, 3, at.time, tmp, at.phase)
    ctx.drawImage(tmp, 0, 0); rec.resume(); track.requestFrame?.(); await sleep(1000 / fps); rec.pause()
    onProgress((i + 1) / n, stage)
  }
  rec.stop(); await stopped
  return new Blob(chunks, { type: type.split(";")[0] })
}

export function LoopDialog() {
  const open = useApp((s) => s.dialog === "loop"); const name = useApp((s) => s.world.name)
  const [o, setO] = React.useState<LoopOpts>({ orbit: true, float: true, day: false, drift: false, seconds: 6, size: "square" })
  const [busy, setBusy] = React.useState<number | null>(null); const [url, setUrl] = React.useState<string>(); const [note, setNote] = React.useState("")
  const view = React.useRef<HTMLCanvasElement>(null); const run = React.useRef(0)
  React.useEffect(() => { if (!open) { run.current++; setBusy(null) } }, [open])
  React.useEffect(() => { if (!open || busy !== null || url || !engine || !view.current) return; const [W, H] = SIZES[o.size]; engine.frame(get().world, W, H, 3, 0, view.current) }, [open, o.size, busy, url])
  const set = (p: Partial<LoopOpts>) => { setO((x) => ({ ...x, ...p })); setUrl(undefined) }
  const go = async () => { const id = ++run.current; setBusy(0); setUrl(undefined); setNote("")
    const blob = await recordLoop(get().world, o, (f, frame) => { if (run.current !== id) return; setBusy(f); const v = view.current; if (v) { v.width = frame.width; v.height = frame.height; v.getContext("2d")!.drawImage(frame, 0, 0) } }, () => run.current === id)
    if (run.current !== id) return; setBusy(null)
    if (!blob) { setNote("This browser cannot record video here. Try Chrome, Edge or Firefox."); return } setUrl(URL.createObjectURL(blob)); (window as any).__loopBytes = blob.size }
  const ext = url && pickType()?.includes("mp4") ? "mp4" : "webm"
  return (
    <Dialog open={open} onOpenChange={(v) => patch({ dialog: v ? "loop" : null })}>
      <DialogContent className="max-h-[92dvh] w-[min(860px,96vw)] max-w-none overflow-y-auto sm:max-w-none">
        <DialogHeader><DialogTitle>Loop</DialogTitle><DialogDescription>A few seconds of this world moving, ending where it began.</DialogDescription></DialogHeader>
        <div className="grid gap-4 md:grid-cols-[1fr_260px]">
          <div className="grid min-h-64 place-items-center overflow-hidden rounded-lg bg-black/40 ring-1 ring-border">
            {url ? <video src={url} autoPlay loop muted playsInline controls className="max-h-[62dvh] w-full object-contain" data-testid="loop-video" /> : <canvas ref={view} className="max-h-[62dvh] w-full object-contain" />}
          </div>
          <div className="flex flex-col gap-2.5">
            <Row label="Camera circles the world"><Switch checked={o.orbit} onCheckedChange={(v) => set({ orbit: v })} aria-label="Orbit" /></Row>
            <Row label="Things float up and down"><Switch checked={o.float} onCheckedChange={(v) => set({ float: v })} aria-label="Float" /></Row>
            <Row label="Sun rises and falls"><Switch checked={o.day} onCheckedChange={(v) => set({ day: v })} aria-label="Day" /></Row>
            <Row label="Clouds and water drift"><Switch checked={o.drift} onCheckedChange={(v) => set({ drift: v })} aria-label="Drift" /></Row>
            <Dial label="Seconds" value={o.seconds} min={2} max={12} step={1} onChange={(v) => set({ seconds: v })} />
            <Segmented label="Shape" value={o.size} options={[{ value: "small", label: "4:3" }, { value: "square", label: "Square" }, { value: "wide", label: "Wide" }, { value: "tall", label: "Story" }]} onChange={(v) => set({ size: v })} />
            {note && <p className="text-[12px] text-destructive">{note}</p>}
            <div className="mt-auto flex flex-col gap-2">
              {busy !== null && <div className="h-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-foreground/70 transition-[width]" style={{ width: `${busy * 100}%` }} /></div>}
              <Button className="glass-primary" onClick={() => void go()} disabled={busy !== null} data-testid="loop-go"><Clapperboard /> {busy !== null ? `Filming ${Math.round(busy * 100)}%` : url ? "Film it again" : "Film the loop"}</Button>
              {url && <a href={url} download={`${fileName(name)}-loop.${ext}`} data-testid="loop-save"><Button variant="glass" className="w-full"><Download /> Save video</Button></a>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
