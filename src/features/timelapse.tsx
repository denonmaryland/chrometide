// Time-lapse: the making of this world as a short video. Every step on the tape is painted once;
// the video dissolves from each to the next while the view drifts slowly, and ends by resting on
// the world as it is now. Written with WebCodecs where the browser has it, MediaRecorder if not.
import * as React from "react"
import { Clapperboard, Download, RotateCcw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import type { World } from "@/engine/scene"
import { engine, get } from "@/store"
import { Dial, Row, Segmented } from "@/ui/fields"
import { fileName } from "@/ui/TopBar"

import type { FeatureCode } from "./lazy"
import { type Step, clear, steps, subscribe } from "./tape"

export interface LapseOpts { seconds: number; shape: "small" | "wide" | "square" | "tall"; detail: "quick" | "good" | "fine"; caption: boolean; drift: boolean }
const SHAPES = { small: [640, 360], wide: [1280, 720], square: [720, 720], tall: [720, 1280] } as const
const SAMPLES = { quick: 3, good: 10, fine: 28 }
const FPS = 30, OVER = 1.1 // pictures are painted a little larger than the video, so the drift stays sharp
const smooth = (x: number) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x) }

/** Which steps the video shows, and for how long each. Long tapes are thinned evenly; the last step is always the end. */
export function plan(n: number, seconds: number) {
  const end = Math.min(3, Math.max(1.6, seconds * 0.12)), run = seconds - end
  const k = Math.max(2, Math.min(n, Math.floor(run / 0.4) + 1))
  const picks = Array.from({ length: k }, (_, i) => Math.round((i * (n - 1)) / (k - 1)))
  return { picks, slot: run / (k - 1), end }
}
const clock = (ms: number) => { const s = Math.max(0, Math.round(ms / 1000)); return s < 3600 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` }

async function pickVideo(W: number, H: number) {
  const VE = (window as any).VideoEncoder; if (!VE) return null
  const base = { width: W, height: H, bitrate: Math.round(W * H * FPS * 0.12), framerate: FPS }
  const plays = (t: string) => document.createElement("video").canPlayType(t) !== "" // only write what this browser can play back
  for (const [kind, codec] of [["mp4", "avc1.640028"], ["webm", "vp09.00.31.08"], ["webm8", "vp8"]] as const) {
    if (!plays(kind === "mp4" ? 'video/mp4; codecs="avc1.640028"' : `video/webm; codecs="${kind === "webm" ? "vp9" : "vp8"}"`)) continue
    try { if ((await VE.isConfigSupported({ ...base, codec })).supported) return { kind, cfg: { ...base, codec } } } catch { /* try the next */ }
  }
  return null
}

/** Paint the steps and write the video. */
export async function filmLapse(tape: Step[], o: LapseOpts, onProgress: (f: number, frame: HTMLCanvasElement) => void, alive: () => boolean): Promise<{ blob: Blob; ext: string; poster: HTMLCanvasElement } | null> {
  if (!engine || tape.length < 2) return null
  const e = engine, [W, H] = SHAPES[o.shape], RW = Math.round(W * OVER), RH = Math.round(H * OVER)
  const { picks, slot, end } = plan(tape.length, o.seconds), K = picks.length, total = slot * (K - 1) + end, N = Math.round(total * FPS)
  const stage = document.createElement("canvas"); stage.width = W; stage.height = H; const g = stage.getContext("2d")!
  g.imageSmoothingQuality = "high"
  const t0 = tape[0].since, name = (s: Step) => s.world.name || "Untitled world"

  // the pictures: painted as the video reaches them, two kept at a time
  const painted = new Map<number, HTMLCanvasElement>()
  const picture = async (i: number) => {
    let c = painted.get(i); if (c) return c
    const w: World = { ...tape[picks[i]].world, cam: { ...tape[picks[i]].world.cam, pano: false } }
    c = await e.still(w, RW, RH, SAMPLES[o.detail]); e.pause(true)
    for (const k of painted.keys()) if (k < i - 1) painted.delete(k)
    painted.set(i, c); return c
  }
  const draw = (c: HTMLCanvasElement, alpha: number, t: number) => {
    const u = t / total, zoom = o.drift ? 1.035 + 0.075 * smooth(u) : 1, room = (1 - 1 / zoom) / 2
    const cx = 0.5 + (o.drift ? room * 0.85 * Math.sin(u * Math.PI * 1.25 - 0.6) : 0), cy = 0.5 + (o.drift ? room * 0.5 * Math.sin(u * Math.PI * 0.9 + 0.4) : 0)
    const sw = c.width / zoom, sh = c.height / zoom
    g.globalAlpha = alpha; g.drawImage(c, (cx * c.width) - sw / 2, (cy * c.height) - sh / 2, sw, sh, 0, 0, W, H); g.globalAlpha = 1
  }
  const caption = (s: Step, alpha: number) => {
    if (!o.caption || alpha <= 0.01) return
    const px = Math.round(Math.min(W, H) * 0.034), pad = Math.round(px * 1.1), y = H - pad
    g.save(); g.globalAlpha = alpha; g.font = `600 ${px}px Inter, system-ui, sans-serif`; g.textBaseline = "alphabetic"
    g.shadowColor = "rgba(0,0,0,.55)"; g.shadowBlur = px * 0.5; g.fillStyle = "rgba(255,255,255,.94)"; g.fillText(name(s), pad, y)
    const left = g.measureText(name(s)).width; g.font = `500 ${Math.round(px * 0.8)}px Inter, system-ui, sans-serif`; g.fillStyle = "rgba(255,255,255,.7)"
    g.fillText(clock(s.at - t0), pad + left + px * 0.6, y); g.restore()
  }
  const compose = async (f: number) => {
    const t = f / FPS, i = Math.min(K - 1, Math.floor(t / slot)), fade = Math.min(0.9, slot * 0.6)
    const mix = i < K - 1 ? smooth((t - i * slot - (slot - fade)) / fade) : 0
    const a = await picture(i); g.fillStyle = "#000"; g.fillRect(0, 0, W, H); draw(a, 1, t)
    if (mix > 0) draw(await picture(i + 1), mix, t)
    caption(tape[picks[i]], 1 - mix); if (mix > 0) caption(tape[picks[i + 1]], mix)
    const dark = Math.max(1 - t / 0.5, 1 - (total - t) / 0.6, 0); if (dark > 0) { g.fillStyle = `rgba(0,0,0,${Math.min(1, dark)})`; g.fillRect(0, 0, W, H) }
  }

  // the last picture before the fade, to show if this browser cannot play the video back
  const poster = document.createElement("canvas"), posterAt = Math.max(0, N - Math.round(0.8 * FPS))
  const frameAt = async (f: number) => { await compose(f); if (f === posterAt) {  poster.width = W; poster.height = H; poster.getContext("2d")!.drawImage(stage, 0, 0) } }
  e.pause(true)
  try {
    const c = await pickVideo(W, H)
    if (c) {
      const mp4 = c.kind === "mp4", lib: any = mp4 ? await import("mp4-muxer") : await import("webm-muxer")
      const muxer = new lib.Muxer({ target: new lib.ArrayBufferTarget(), video: { codec: mp4 ? "avc" : c.kind === "webm" ? "V_VP9" : "V_VP8", width: W, height: H, frameRate: FPS }, ...(mp4 ? { fastStart: "in-memory" } : {}), firstTimestampBehavior: "offset" })
      let failed = ""; const VE = (window as any).VideoEncoder, VF = (window as any).VideoFrame
      const ve = new VE({ output: (ch: any, meta: any) => muxer.addVideoChunk(ch, meta), error: (er: any) => { failed = String(er) } }); ve.configure(c.cfg)
      for (let f = 0; f < N; f++) {
        if (!alive() || failed) { try { ve.close() } catch { /* already closed */ } return null }
        await frameAt(f)
        const vf = new VF(stage, { timestamp: Math.round((f / FPS) * 1e6), duration: Math.round(1e6 / FPS) }); ve.encode(vf, { keyFrame: f % (FPS * 2) === 0 }); vf.close()
        if (ve.encodeQueueSize > 8) await new Promise((ok) => setTimeout(ok, 15))
        if (f % 4 === 0) { onProgress((f + 1) / N, stage); await new Promise((ok) => setTimeout(ok)) }
      }
      await ve.flush(); ve.close(); muxer.finalize(); if (failed) return null
      onProgress(1, stage); return { blob: new Blob([muxer.target.buffer], { type: mp4 ? "video/mp4" : "video/webm" }), ext: mp4 ? "mp4" : "webm", poster }
    }
    // no WebCodecs: record the canvas in real time instead
    const type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)); if (!type) return null
    const stream = stage.captureStream(0), track = stream.getVideoTracks()[0] as MediaStreamTrack & { requestFrame?: () => void }
    const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8_000_000 }), chunks: Blob[] = []; rec.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data) }
    const stopped = new Promise<void>((ok) => (rec.onstop = () => ok())); rec.start(); rec.pause()
    for (let f = 0; f < N; f++) {
      if (!alive()) { rec.stop(); return null }
      await frameAt(f); rec.resume(); track.requestFrame?.(); await new Promise((ok) => setTimeout(ok, 1000 / FPS)); rec.pause()
      if (f % 4 === 0) onProgress((f + 1) / N, stage)
    }
    rec.stop(); await stopped; const mp4 = type.includes("mp4")
    return { blob: new Blob(chunks, { type: type.split(";")[0] }), ext: mp4 ? "mp4" : "webm", poster }
  } finally { e.pause(false); e.touch() }
}

// ---------- the dialog ----------
let open = false
const openSubs = new Set<() => void>()
const setOpen = (v: boolean) => { open = v; openSubs.forEach((f) => f()) }
const useOpen = () => React.useSyncExternalStore((f) => { openSubs.add(f); return () => openSubs.delete(f) }, () => open)
const useTape = () => React.useSyncExternalStore(subscribe, steps)

function TimelapseDialog() {
  const isOpen = useOpen(), tape = useTape()
  const [o, setO] = React.useState<LapseOpts>({ seconds: 20, shape: "wide", detail: "good", caption: true, drift: true })
  const [busy, setBusy] = React.useState<number | null>(null), [video, setVideo] = React.useState<{ url: string; ext: string; broken?: boolean }>(), [note, setNote] = React.useState(""), [info, setInfo] = React.useState("")
  const [thumbs, setThumbs] = React.useState<string[]>([])
  const view = React.useRef<HTMLCanvasElement>(null), run = React.useRef(0), poster = React.useRef<HTMLCanvasElement | null>(null)
  const set = (p: Partial<LapseOpts>) => { setO((x) => ({ ...x, ...p })); setVideo(undefined); setInfo("") }
  React.useEffect(() => { if (!isOpen) { run.current++; setBusy(null) } }, [isOpen])
  React.useEffect(() => () => { if (video) URL.revokeObjectURL(video.url) }, [video?.url])

  // a strip of moments from the tape, so you can see what will be in it
  const n = tape.length
  React.useEffect(() => {
    if (!isOpen || !engine || n < 1) { setThumbs([]); return }
    const k = Math.min(6, n), at = Array.from({ length: k }, (_, i) => (k === 1 ? 0 : Math.round((i * (n - 1)) / (k - 1))))
    const t = setTimeout(() => setThumbs(at.map((i) => engine!.thumb({ ...tape[i].world, cam: { ...tape[i].world.cam, pano: false } }, 160, 90))), 120)
    return () => clearTimeout(t)
  }, [isOpen, n === 0 ? 0 : tape[n - 1].at, n])
  // before filming, the preview shows the world as it is now
  React.useEffect(() => {
    if (!isOpen || busy !== null || video || !engine) return
    const t = setTimeout(() => { if (view.current && engine) { const [W, H] = SHAPES[o.shape]; engine.frame({ ...get().world, cam: { ...get().world.cam, pano: false } }, Math.round(W / 2), Math.round(H / 2), 3, 0, view.current) } }, 60)
    return () => clearTimeout(t)
  }, [isOpen, o.shape, busy, video])

  const go = async () => {
    const id = ++run.current; setBusy(0); setVideo(undefined); setNote(""); setInfo("")
    const out = await filmLapse(steps(), o, (f, frame) => { if (run.current !== id) return; setBusy(f); const v = view.current; if (v) { v.width = frame.width; v.height = frame.height; v.getContext("2d")!.drawImage(frame, 0, 0) } }, () => run.current === id)
    if (run.current !== id) return; setBusy(null)
    if (!out) { setNote("This browser cannot make video here. Try a current Chrome, Edge or Firefox."); return }
    poster.current = out.poster; setVideo({ url: URL.createObjectURL(out.blob), ext: out.ext }); (window as any).__lapseBytes = out.blob.size
  }
  const span = n > 1 ? tape[n - 1].at - tape[0].since : 0, p = n > 1 ? plan(n, o.seconds) : null
  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92dvh] w-[min(900px,96vw)] max-w-none overflow-y-auto sm:max-w-none">
        <DialogHeader><DialogTitle>Time-lapse</DialogTitle><DialogDescription>Watch this world being made, as a short video.</DialogDescription></DialogHeader>
        <div className="grid gap-4 md:grid-cols-[1fr_260px]">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="grid min-h-56 place-items-center overflow-hidden rounded-lg bg-black/40 ring-1 ring-border">
              {video && !video.broken && <video src={video.url} autoPlay loop muted playsInline controls className="max-h-[56dvh] w-full object-contain" data-testid="lapse-video"
                onError={() => { setVideo({ ...video, broken: true }); setInfo(`This browser cannot play the preview, but the saved ${video.ext.toUpperCase()} file plays in most video players.`); const v = view.current, ps = poster.current; if (v && ps) { v.width = ps.width; v.height = ps.height; v.getContext("2d")!.drawImage(ps, 0, 0) } }} />}
              <canvas ref={view} className={video && !video.broken ? "hidden" : "max-h-[56dvh] w-full object-contain"} />
            </div>
            {thumbs.length > 1 && (
              <div className="grid grid-cols-6 gap-1.5" aria-label="Moments from the recording">
                {thumbs.map((t, i) => <img key={i} src={t} alt="" className="aspect-video w-full rounded-[4px] object-cover ring-1 ring-border" />)}
              </div>)}
          </div>
          <div className="flex flex-col gap-2.5">
            <p className="text-[12.5px] text-muted-foreground" data-testid="lapse-summary">
              {n > 1 ? <>{n} {n === 1 ? "step" : "steps"} recorded over {clock(span)}{p && p.picks.length < n ? `; the video shows ${p.picks.length} of them` : ""}.</> : "Nothing recorded yet. Change the world a few times, then come back."}
            </p>
            <Dial label="Length" value={o.seconds} min={10} max={60} step={1} unit=" s" onChange={(v) => set({ seconds: v })} />
            <Segmented label="Shape" value={o.shape} options={[{ value: "small", label: "Small" }, { value: "wide", label: "Wide" }, { value: "square", label: "Square" }, { value: "tall", label: "Story" }]} onChange={(v) => set({ shape: v })} />
            <Segmented label="Detail" value={o.detail} options={[{ value: "quick", label: "Quick" }, { value: "good", label: "Good" }, { value: "fine", label: "Fine" }]} onChange={(v) => set({ detail: v })} />
            <Row label="Name and time in the corner"><Switch checked={o.caption} onCheckedChange={(v) => set({ caption: v })} aria-label="Caption" /></Row>
            <Row label="Camera drifts slowly"><Switch checked={o.drift} onCheckedChange={(v) => set({ drift: v })} aria-label="Drift" /></Row>
            {note && <p className="text-[12px] text-destructive">{note}</p>}
            {info && <p className="text-[12px] text-muted-foreground">{info}</p>}
            <div className="mt-auto flex flex-col gap-2 pt-2">
              {busy !== null && <div className="h-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-foreground/70 transition-[width]" style={{ width: `${busy * 100}%` }} /></div>}
              <Button className="glass-primary" onClick={() => void go()} disabled={busy !== null || n < 2} data-testid="lapse-go"><Clapperboard /> {busy !== null ? `Filming ${Math.round(busy * 100)}%` : video ? "Film it again" : "Make the time-lapse"}</Button>
              {video && <a href={video.url} download={`${fileName(get().world.name)}-time-lapse.${video.ext}`} data-testid="lapse-save"><Button variant="glass" className="w-full"><Download /> Save video</Button></a>}
              <Button variant="ghost" size="sm" onClick={() => { clear(); setVideo(undefined) }} disabled={busy !== null} data-testid="lapse-clear"><RotateCcw /> Start recording again from here</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export const TIMELAPSE: FeatureCode = { run: () => setOpen(true), Overlay: TimelapseDialog }
