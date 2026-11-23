// Sound: bring a song (or the microphone), choose how the world moves to it, watch it live, and
// film the whole thing with its sound.
import * as React from "react"
import { AudioLines, Clapperboard, Download, Mic, MicOff, Pause, Play, Upload, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { BANDS, audioEl, currentSong, loadSong, micOn, nowLevels, startMic, stopMic, unloadSong } from "@/audio"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { type SoundSet, soundSet } from "@/engine/scene"
import { pickFile } from "@/io"
import { FILM_SIZES, type FilmOpts, VIBES, addMeters, filmSong, removeMeters } from "@/sound"
import { edit, get, patch, useApp } from "@/store"

import { Dial, Row, Section, Segmented } from "./fields"
import { fileName } from "./TopBar"

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`

/** The song drawn as its own loudness, with the beats as ticks. Tap or drag to move through it. */
function Wave() {
  const song = useApp((s) => s.song); const ref = React.useRef<HTMLCanvasElement>(null), head = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => { const c = ref.current, sg = currentSong(); if (!c || !sg) return; const W = (c.width = 560), H = (c.height = 96), x = c.getContext("2d")!, sc = sg.score
    x.clearRect(0, 0, W, H)
    for (let i = 0; i < W; i++) { const f = Math.floor((i / W) * sc.frames), n = Math.max(1, Math.floor(sc.frames / W)); let lo = 0, hi = 0; for (let k = 0; k < n; k++) { lo = Math.max(lo, sc.bass[f + k] || 0); hi = Math.max(hi, sc.high[f + k] || 0) }
      x.fillStyle = "rgba(255,255,255,.75)"; const h = Math.max(1, lo * H * 0.46); x.fillRect(i, H / 2 - h, 1, h * 2); x.fillStyle = "rgba(255,255,255,.28)"; const h2 = Math.max(1, hi * H * 0.46); x.fillRect(i, H / 2 - h2, 1, h2 * 2) }
    x.fillStyle = "rgba(255,180,90,.9)"; for (const b of sc.beatTimes) x.fillRect(Math.floor((b / sc.duration) * W), H - 4, 1, 4) }, [song])
  React.useEffect(() => { let raf = 0; const tick = () => { const a = audioEl(), sg = currentSong(); if (head.current && a && sg) head.current.style.left = `${(a.currentTime / sg.score.duration) * 100}%`; raf = requestAnimationFrame(tick) }; raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf) }, [])
  const seek = (e: React.PointerEvent) => { const a = audioEl(), sg = currentSong(); if (!a || !sg) return; const r = e.currentTarget.getBoundingClientRect(); a.currentTime = Math.min(sg.score.duration - 0.05, Math.max(0, ((e.clientX - r.left) / r.width) * sg.score.duration)) }
  return (
    <div className="relative h-14 cursor-ew-resize touch-none overflow-hidden rounded-md bg-muted/50 ring-1 ring-border" data-testid="wave" onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); seek(e) }} onPointerMove={(e) => e.buttons && seek(e)}>
      <canvas ref={ref} className="size-full" /><div ref={head} className="pointer-events-none absolute inset-y-0 w-px bg-white shadow-[0_0_6px_1px_rgba(255,255,255,.7)]" />
    </div>
  )
}
/** Sixteen small bars showing what is being heard right now. */
function Spectrum() {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => { let raf = 0; const tick = () => { const L = nowLevels(), el = ref.current; if (el) { for (let i = 0; i < BANDS; i++) (el.children[i] as HTMLElement).style.transform = `scaleY(${0.06 + L.bands[i] * 0.94})`; el.style.setProperty("--beat", String(L.beat)) } raf = requestAnimationFrame(tick) }; raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf) }, [])
  return <div ref={ref} className="flex h-8 items-end gap-[3px]" aria-hidden>{Array.from({ length: BANDS }, (_, i) => <span key={i} className="flex-1 origin-bottom rounded-[2px] bg-foreground/80" style={{ height: "100%", opacity: 0.45 + (i / BANDS) * 0.5 }} />)}</div>
}

export function SoundPanel() {
  const song = useApp((s) => s.song), sounding = useApp((s) => s.sounding), mic = useApp((s) => s.mic), set = useApp((s) => s.world.sound) ?? soundSet(), meters = useApp((s) => s.world.things.filter((t) => t.eq !== undefined).length)
  const [neon, setNeon] = React.useState(true); const [busy, setBusy] = React.useState(""); const [film, setFilm] = React.useState<FilmOpts>({ size: "square", seconds: 30, start: 0, fps: 30, samples: 2 })
  const [prog, setProg] = React.useState<number | null>(null); const [out, setOut] = React.useState<{ url: string; ext: string; bytes: number } | null>(null); const run = React.useRef(0); const preview = React.useRef<HTMLCanvasElement>(null)
  const change = (label: string, fn: (k: SoundSet) => void) => edit("sound:" + label, (w) => { w.sound = w.sound ?? soundSet(); fn(w.sound) })
  const d = (label: string, key: keyof SoundSet) => <Dial label={label} value={set[key] as number} onChange={(v) => change(key, (k) => { (k as any)[key] = v })} />
  const stop = () => { audioEl()?.pause(); patch({ sounding: micOn() }) }
  const choose = async (file?: Blob, name?: string) => { const f = file ?? (await pickFile("audio/*,.mp3,.wav,.m4a,.ogg,.flac")); if (!f) return; setBusy("Listening to the whole song…"); setOut(null)
    try { stopMic(); const sg = await loadSong(f, name ?? (f as File).name ?? "song"); const a = audioEl()!; a.onended = () => patch({ sounding: false }); patch({ song: { name: sg.name.replace(/\.[^.]+$/, ""), duration: sg.score.duration, bpm: sg.score.bpm, beats: sg.score.beatTimes.length }, mic: false, sounding: false })
      setFilm((x) => ({ ...x, start: 0, seconds: Math.min(30, Math.floor(sg.score.duration)) })); if (!get().world.sound) change("init", () => {}); setBusy("") } catch { setBusy("That file could not be read as sound.") } }
  ;(window as any).__chooseSong = choose
  const play = async () => { const a = audioEl(); if (!a) return; if (sounding && !a.paused) { stop(); return } try { await a.play() } catch { /* the browser refused to start sound; the picture still follows the playhead */ } patch({ sounding: true }) }
  const toggleMic = async () => { if (mic) { stopMic(); patch({ mic: false, sounding: false }); return } audioEl()?.pause(); const ok = await startMic(); setBusy(ok ? "" : "The microphone was not allowed."); patch({ mic: ok, sounding: ok }) }
  const go = async () => { const sg = currentSong(); if (!sg) return; const id = ++run.current; stop(); setOut(null); setProg(0); setBusy("")
    const r = await filmSong(get().world, sg, film, (f, frame) => { if (run.current !== id) return; setProg(f); const c = preview.current; if (c) { c.width = frame.width; c.height = frame.height; c.getContext("2d")!.drawImage(frame, 0, 0) } }, () => run.current === id)
    if (run.current !== id) return; setProg(null); if (!r) { setBusy("This browser cannot write video with sound here. Try a current Chrome or Edge."); return }
    setOut({ url: URL.createObjectURL(r.blob), ext: r.ext, bytes: r.blob.size }); (window as any).__filmBytes = r.blob.size; (window as any).__filmBlob = r.blob }
  return (<>
    <Section title="Music" action={song ? <Button variant="ghost" size="xs" onClick={() => { stop(); unloadSong(); patch({ song: null, sounding: false }) }}><X /> Remove</Button> : undefined}>
      {!song ? <div className="flex flex-col gap-2">
        <Button className="glass-primary" onClick={() => void choose()} data-testid="choose-song"><Upload /> Choose a song…</Button>
        <p className="text-[11.5px] text-muted-foreground">The song stays on this device. It is read once, start to finish, so the picture knows every beat before it plays.</p>
      </div> : <>
        <div className="flex items-center gap-2"><Button variant="glass" size="icon" onClick={() => void play()} aria-label={sounding ? "Pause" : "Play"} data-testid="song-play">{sounding && !mic ? <Pause /> : <Play />}</Button>
          <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-medium">{song.name}</p><p className="font-mono text-[11px] text-muted-foreground">{clock(song.duration)} · {song.bpm ? `${song.bpm} bpm` : "free time"} · {song.beats} beats</p></div></div>
        <Wave />
      </>}
      <Row label="Or listen to the room"><Button variant={mic ? "glass" : "ghost"} size="xs" onClick={() => void toggleMic()} data-testid="mic">{mic ? <Mic /> : <MicOff />} {mic ? "Listening" : "Microphone"}</Button></Row>
      {(song || mic) && <Spectrum />}
      {busy && <p className="text-[11.5px] text-muted-foreground" data-testid="sound-note">{busy}</p>}
    </Section>
    <Section title="Feel">
      <div className="grid grid-cols-5 gap-1">{VIBES.map((v) => { const on = JSON.stringify(v.set) === JSON.stringify(set); return (
        <button key={v.name} title={v.about} onClick={() => change("vibe", (k) => Object.assign(k, v.set))} aria-pressed={on} data-testid={`vibe-${v.name}`}
          className={cn("h-8 rounded-md text-[12px] text-muted-foreground ring-1 ring-border transition-transform hover:scale-[1.04] active:scale-95", on && "glass-control bg-(--glass-control) text-foreground")}>{v.name}</button>) })}</div>
      <p className="text-[11.5px] text-muted-foreground">{VIBES.find((v) => JSON.stringify(v.set) === JSON.stringify(set))?.about ?? "Your own mix."}</p>
    </Section>
    <Section title="Things"><Dial label="Swell" value={set.pulse} onChange={(v) => change("pulse", (k) => { k.pulse = v })} />
      <Row label="Swell with"><Segmented label="Swell with" value={set.pulseTo} options={[{ value: "bass", label: "Bass" }, { value: "mid", label: "Middle" }, { value: "high", label: "Top" }, { value: "beat", label: "Beat" }]} onChange={(v) => change("pulseTo", (k) => { k.pulseTo = v })} /></Row>
      {d("Ride", "float")}{d("Glow", "glow")}</Section>
    <Section title="World">{d("Water", "ripple")}{d("Stars", "twinkle")}{d("Air & clouds", "breathe")}
      <Row label="Sky colours"><select value={set.journey} onChange={(e) => change("journey", (k) => { k.journey = e.target.value as SoundSet["journey"] })} aria-label="Sky colours" className="h-6 rounded-sm bg-muted/60 px-1.5 text-[12px] outline-none">
        <option value="off">Hold still</option><option value="sunset">Sunset to night</option><option value="candy">Candy</option><option value="night">Night lights</option><option value="surprise">Surprise</option></select></Row>
      {set.journey !== "off" && <Dial label="Change every" value={set.every} min={2} max={64} step={2} unit=" b" onChange={(v) => change("every", (k) => { k.every = v })} />}</Section>
    <Section title="Camera">{d("Circle", "orbit")}{d("Step on beat", "kick")}{d("Lean in", "punch")}</Section>
    <Section title="Meters" action={meters ? <Button variant="ghost" size="xs" onClick={removeMeters}><X /> Remove</Button> : undefined}>
      <div className="flex gap-1.5"><Button variant="glass" size="xs" onClick={() => addMeters("row", neon)} data-testid="meters-row"><AudioLines /> A row of bars</Button><Button variant="glass" size="xs" onClick={() => addMeters("ring", neon)} data-testid="meters-ring">A ring of bars</Button></div>
      <Row label="Neon bars, in rainbow order"><Switch checked={neon} onCheckedChange={setNeon} aria-label="Neon bars" /></Row>
      {d("Jump", "meters")}<p className="text-[11.5px] text-muted-foreground">Bars are ordinary things: give them any material, even neon. Single letters jump too; split a word in Lettering first.</p></Section>
    <Section title="Film it">
      {!song ? <p className="text-[12px] text-muted-foreground">Choose a song to film it. The microphone can only be watched live.</p> : <>
        <Segmented label="Shape" value={film.size} options={[{ value: "square", label: "Square" }, { value: "wide", label: "Wide" }, { value: "story", label: "Story" }, { value: "small", label: "Small" }]} onChange={(v) => setFilm({ ...film, size: v })} />
        <Dial label="Start at" value={film.start} min={0} max={Math.max(0, Math.floor(song.duration - 2))} step={1} unit="s" onChange={(v) => setFilm({ ...film, start: v, seconds: Math.min(film.seconds, Math.floor(song.duration - v)) })} />
        <Dial label="Length" value={film.seconds} min={2} max={Math.max(2, Math.floor(song.duration - film.start))} step={1} unit="s" onChange={(v) => setFilm({ ...film, seconds: v })} />
        <Row label="Finish"><Segmented label="Finish" value={String(film.samples)} options={[{ value: "1", label: "Quick" }, { value: "2", label: "Good" }, { value: "4", label: "Fine" }]} onChange={(v) => setFilm({ ...film, samples: +v })} /></Row>
        <p className="font-mono text-[11px] text-muted-foreground">{FILM_SIZES[film.size][0]} × {FILM_SIZES[film.size][1]} · {film.fps} frames a second · {Math.round(film.seconds * film.fps)} pictures to trace</p>
        <canvas ref={preview} className={cn("w-full rounded-md ring-1 ring-border", prog === null && "hidden")} />
        {prog !== null && <div className="h-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-foreground/70 transition-[width]" style={{ width: `${prog * 100}%` }} /></div>}
        {out && <video src={out.url} controls loop playsInline className="w-full rounded-md ring-1 ring-border" data-testid="film-video" />}
        <div className="flex gap-1.5">
          <Button className="glass-primary flex-1" onClick={() => (prog === null ? void go() : (run.current++, setProg(null)))} data-testid="film-go"><Clapperboard /> {prog === null ? (out ? "Film it again" : "Film it with the song") : `Stop · ${Math.round(prog * 100)}%`}</Button>
          {out && <a href={out.url} download={`${fileName(get().world.name)}-${fileName(song.name)}.${out.ext}`} data-testid="film-save"><Button variant="glass"><Download /> Save</Button></a>}
        </div>
      </>}
    </Section>
  </>)
}
