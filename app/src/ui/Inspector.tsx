// The right-hand panel: every dial for whatever is selected.
import * as React from "react"
import { Dices, Eraser, Link2, RotateCcw, Trash2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { QUALITY } from "@/engine/engine"
import {
  type Camera, type Kind, type LockKey, type Material, type Thing, type Vec3, type World, FRAMES, KINDS, KIND_LABEL, LANDS, MATERIALS, SEAS, SEA_KINDS, SKIES, TEXTURES,
  camFrom, clone, mat, newId, seaFrom, skyFrom, thing, titleFrom,
} from "@/engine/scene"
import { edit, editThing, engine, get, patch, removeThing, rollDice, selectedThing, useApp } from "@/store"

import { Color, Colors, Dial, Looks, Row, Section, Segmented } from "./fields"

const grad = (a: string, b: string) => `linear-gradient(${a}, ${b})`
const TITLES = { sky: "Sky", sea: "Sea & floor", land: "Land", title: "Lettering", camera: "Camera", picture: "Picture", thing: "Thing" }

export function Inspector() {
  const sel = useApp((s) => s.sel)
  return (
    <aside className="glass-panel flex h-full min-h-0 w-full flex-col overflow-hidden rounded-lg" aria-label="Inspector" data-testid="inspector">
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-border/60 px-3">
        <h2 className="text-[13px] font-medium">{TITLES[sel.type]}</h2>
        {sel.type !== "thing" && sel.type !== "picture" && sel.type !== "title" && (
          <Button variant="ghost" size="xs" onClick={() => rollDice(sel.type as LockKey)}><Dices /> Roll this</Button>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {sel.type === "sky" && <SkyPanel />}
        {sel.type === "sea" && <SeaPanel />}
        {sel.type === "land" && <LandPanel />}
        {sel.type === "thing" && <ThingPanel />}
        {sel.type === "title" && <TitlePanel />}
        {sel.type === "camera" && <CameraPanel />}
        {sel.type === "picture" && <PicturePanel />}
      </div>
    </aside>
  )
}

// ---------- sky ----------
function DayArc() {
  const sun = useApp((s) => s.world.sky.sun); const ref = React.useRef<HTMLDivElement>(null)
  const t = Math.min(1, Math.max(0, sun.el / 1.35))
  const set = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height))
    edit("sun", (w) => { w.sky.sun = { az: (x - 0.5) * Math.PI * 2, el: 0.02 + y * 1.33 } }) }
  return (
    <div ref={ref} className="relative h-20 cursor-crosshair touch-none overflow-hidden rounded-md ring-1 ring-border" aria-label="Sun position: across for direction, up for height"
      style={{ background: "linear-gradient(#3f7fd8, #9cc8f2 55%, #ffb27a 88%, #5a3a6a)" }}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); set(e) }} onPointerMove={(e) => e.buttons && set(e)}>
      <div className="pointer-events-none absolute size-5 -translate-x-1/2 translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_35%_30%,#fff,#ffe9a0_45%,#f0a020)] shadow-[0_0_14px_4px_rgba(255,240,170,.8)]"
        style={{ left: `${(sun.az / (Math.PI * 2) + 0.5) * 100}%`, bottom: `${t * 100}%` }} />
      <span className="pointer-events-none absolute bottom-1 left-1.5 text-[10px] font-medium text-white/80">drag the sun · or drag it in the picture</span>
    </div>
  )
}
function SkyPanel() {
  const s = useApp((x) => x.world.sky); const set = (label: string, fn: (k: World["sky"]) => void) => edit("sky:" + label, (w) => fn(w.sky))
  const d = (label: string, key: keyof World["sky"], o: { min?: number; max?: number; step?: number } = {}) => <Dial label={label} value={s[key] as number} {...o} onChange={(v) => set(key, (k) => { (k as any)[key] = v })} />
  const look = SKIES.find((l) => l.zenith === s.zenith && l.horizon === s.horizon)?.name
  return (<>
    <Section title="Look"><Looks items={SKIES} active={look} paint={(l) => grad(l.zenith, l.horizon)} onPick={(l) => set("look", (k) => Object.assign(k, { zenith: l.zenith, horizon: l.horizon, haze: l.haze, sunColor: l.sunColor, cloudColor: l.cloudColor, fogColor: l.haze, stars: l.stars ?? 0 }))} /></Section>
    <Section title="Sun"><DayArc />{d("Size", "sunSize", { min: 0.008, max: 0.2, step: 0.001 })}{d("Glow", "sunGlow", { max: 3 })}{d("Soft shadows", "sunSoft", { max: 0.12, step: 0.002 })}{d("Fill light", "ambient", { max: 1.2 })}</Section>
    <Section title="Colours"><Colors items={[{ label: "Top", value: s.zenith, onChange: (v) => set("c1", (k) => { k.zenith = v }) }, { label: "Horizon", value: s.horizon, onChange: (v) => set("c2", (k) => { k.horizon = v }) }, { label: "Haze", value: s.haze, onChange: (v) => set("c3", (k) => { k.haze = v }) }, { label: "Sun", value: s.sunColor, onChange: (v) => set("c4", (k) => { k.sunColor = v }) }]} />{d("Haze", "hazeAmt")}</Section>
    <Section title="Clouds" action={<Button variant="ghost" size="xs" onClick={() => set("seed", (k) => { k.seed = Math.random() * 40 })}><Dices /> Reshape</Button>}>
      {d("Cover", "cloud")}{d("Streaks", "streak")}{d("Size", "cloudScale", { min: 0.3, max: 3 })}{d("High veil", "cloud2")}
      <Colors items={[{ label: "Cloud", value: s.cloudColor, onChange: (v) => set("cc", (k) => { k.cloudColor = v }) }, { label: "Veil", value: s.cloud2Color, onChange: (v) => set("cc2", (k) => { k.cloud2Color = v }) }]} />
    </Section>
    <Section title="Fog">{d("Ground fog", "fog")}{d("Fog height", "fogHeight", { min: 0.2, max: 8, step: 0.1 })}<Color label="Fog colour" value={s.fogColor} onChange={(v) => set("fc", (k) => { k.fogColor = v })} /></Section>
    <Section title="Night & weather">
      {d("Stars", "stars", { max: 2.5 })}{d("Moon", "moon", { max: 1.5 })}
      {s.moon > 0 && <>{d("Moon phase", "moonPhase")}{d("Moon size", "moonSize", { min: 0.02, max: 0.25, step: 0.005 })}{d("Moon turn", "moonAz", { min: -3.14, max: 3.14 })}{d("Moon height", "moonEl", { min: 0.05, max: 1.4 })}</>}
      {d("Rainbow", "rainbow")}{d("Sun ring", "halo")}
    </Section>
  </>)
}

// ---------- sea ----------
function SeaPanel() {
  const s = useApp((x) => x.world.sea); const set = (label: string, fn: (k: World["sea"]) => void) => edit("sea:" + label, (w) => fn(w.sea))
  const look = SEAS.find((l) => l.kind === s.kind && l.c1 === s.c1 && l.c2 === s.c2)?.name
  const paint = (l: (typeof SEAS)[number]) => l.kind === "checker" ? `conic-gradient(${l.c1} 25%, ${l.c2} 0 50%, ${l.c1} 0 75%, ${l.c2} 0)` : l.kind === "lava" ? `radial-gradient(circle at 40% 40%, #ffd060, ${l.c1} 45%, ${l.c2})` : l.kind === "none" ? "repeating-linear-gradient(45deg,#333 0 4px,#222 4px 8px)" : grad(l.c2, l.c1)
  return (<>
    <Section title="Look"><Looks items={SEAS} active={look} paint={paint} onPick={(l) => set("look", (k) => Object.assign(k, seaFrom(l, { wave: k.wave, grain: k.grain, scale: k.scale })))} /></Section>
    <Section title="Kind"><Segmented label="Kind" value={s.kind} options={SEA_KINDS.map((k) => ({ value: k, label: k === "none" ? "sky" : k }))} onChange={(v) => set("kind", (k) => { k.kind = v })} /></Section>
    {s.kind !== "none" && <Section title="Surface">
      <Colors items={[{ label: s.kind === "water" ? "Deep" : "First", value: s.c1, onChange: (v) => set("c1", (k) => { k.c1 = v }) }, { label: s.kind === "water" ? "Shallow" : "Second", value: s.c2, onChange: (v) => set("c2", (k) => { k.c2 = v }) }]} />
      {(s.kind === "water" || s.kind === "sand") && <Dial label={s.kind === "water" ? "Waves" : "Dunes"} value={s.wave} max={1.5} onChange={(v) => set("wave", (k) => { k.wave = v })} />}
      {(s.kind === "water" || s.kind === "sand") && <Dial label="Grain" value={s.grain} onChange={(v) => set("grain", (k) => { k.grain = v })} />}
      <Dial label="Mirror" value={s.reflect} onChange={(v) => set("refl", (k) => { k.reflect = v })} />
      {s.kind !== "water" && s.kind !== "mirror" && <Dial label="Pattern size" value={s.scale} min={0.2} max={4} onChange={(v) => set("scale", (k) => { k.scale = v })} />}
    </Section>}
  </>)
}

// ---------- land ----------
function LandPanel() {
  const l = useApp((x) => x.world.land), sculpt = useApp((x) => x.sculpt); const set = (label: string, fn: (k: World["land"]) => void) => edit("land:" + label, (w) => fn(w.land))
  const d = (label: string, key: keyof World["land"], o: { min?: number; max?: number; step?: number } = {}) => <Dial label={label} value={l[key] as number} {...o} onChange={(v) => set(key, (k) => { (k as any)[key] = v })} />
  const look = LANDS.find((x) => x.c1 === l.c1 && x.c2 === l.c2)?.name
  return (<>
    <Section title="Land" action={<Switch checked={l.on} onCheckedChange={(v) => set("on", (k) => { k.on = v })} aria-label="Show land" />}>
      <Looks items={LANDS} active={look} paint={(x) => grad(x.snow ? "#fff" : x.c3, x.c2 + " 55%, " + x.c1)} onPick={(x) => set("look", (k) => Object.assign(k, { c1: x.c1, c2: x.c2, c3: x.c3, snow: x.snow, on: true }))} />
    </Section>
    <Section title="Shape" action={<Button variant="ghost" size="xs" onClick={() => set("seed", (k) => { k.seed = Math.random() * 50; k.on = true })}><Dices /> New land</Button>}>
      <Segmented label="Shape" value={l.mode} options={[{ value: "island", label: "Island" }, { value: "range", label: "Mountain ring" }]} onChange={(v) => set("mode", (k) => { k.mode = v })} />
      {d("Height", "height", { max: 16, step: 0.1 })}{d("Width", "radius", { min: 2, max: 24, step: 0.1 })}{d("Detail", "freq", { min: 0.05, max: 1.2 })}{d("Ridges", "ridge")}
    </Section>
    <Section title="Carve">
      {d("Sharpen", "sharp")}{d("Terraces", "terrace")}{d("Flat top", "plateau")}{d("Snow", "snow")}
    </Section>
    <Section title="Sculpt by hand" action={l.sculpt ? <Button variant="ghost" size="xs" onClick={() => set("unsculpt", (k) => { delete k.sculpt })}><Eraser /> Clear</Button> : undefined}>
      <Segmented label="Sculpt tool" value={sculpt.tool} options={[{ value: "off", label: "Off" }, { value: "raise", label: "Raise" }, { value: "lower", label: "Lower" }, { value: "smooth", label: "Smooth" }]} onChange={(v) => patch({ sculpt: { ...sculpt, tool: v } })} />
      <Dial label="Brush" value={sculpt.size} min={0.04} max={0.3} onChange={(v) => patch({ sculpt: { ...sculpt, size: v } })} />
      <p className="text-[11.5px] text-muted-foreground">{sculpt.tool === "off" ? "Pick a tool, then drag on the land in the picture." : "Drag on the land or the water near it."}</p>
    </Section>
    {l.mode === "island" && <Section title="Channel" action={<Switch checked={!!l.channel} onCheckedChange={(v) => set("ch", (k) => { if (v) k.channel = { offset: 0, angle: 25, width: 0.27, bend: 0 }; else delete k.channel })} aria-label="Cut a channel" />}>
      {l.channel && <>
        <Dial label="Place" value={l.channel.offset} min={-0.8} max={0.8} onChange={(v) => set("cho", (k) => { k.channel!.offset = v })} />
        <Dial label="Angle" value={l.channel.angle} min={-90} max={90} step={1} unit="°" onChange={(v) => set("cha", (k) => { k.channel!.angle = v })} />
        <Dial label="Width" value={l.channel.width} min={0.05} max={0.6} onChange={(v) => set("chw", (k) => { k.channel!.width = v })} />
        <Dial label="Bend" value={l.channel.bend} min={-0.8} max={0.8} onChange={(v) => set("chb", (k) => { k.channel!.bend = v })} />
      </>}
    </Section>}
    <Section title="Colours"><Colors items={[{ label: "Shore", value: l.c1, onChange: (v) => set("c1", (k) => { k.c1 = v }) }, { label: "Slope", value: l.c2, onChange: (v) => set("c2", (k) => { k.c2 = v }) }, { label: "Rock", value: l.c3, onChange: (v) => set("c3", (k) => { k.c3 = v }) }]} /></Section>
  </>)
}

// ---------- materials ----------
const balls = new Map<string, string>()
function ballWorld(m: Material): World {
  return { v: 2, name: "ball", sky: skyFrom(SKIES[0], { sun: { az: -0.9, el: 0.9 }, cloud: 0.35, hazeAmt: 0.3 }), sea: seaFrom(SEAS[5], { scale: 1.2, reflect: 0.05 }), land: { ...({} as any), on: false, mode: "island", height: 0.1, radius: 8, freq: 0.2, ridge: 0, seed: 1, snow: 0, c1: "#000000", c2: "#000000", c3: "#000000", terrace: 0, plateau: 0, sharp: 0 },
    things: [thing("sphere", [0, 1.05, 0], 1, m)], cam: camFrom({ yaw: 0.5, pitch: 0.2, dist: 3.0, target: [0, 1.02, 0], fov: 44 }), views: [], frame: FRAMES[0] }
}
function Ball({ m, active, onPick }: { m: Material; active: boolean; onPick: () => void }) {
  const [src, setSrc] = React.useState(balls.get(m.name))
  React.useEffect(() => {
    if (src) return; let live = true
    const make = () => { if (!live) return; if (!engine) { setTimeout(make, 200); return } const url = engine.frame(ballWorld(m), 72, 72, 3).toDataURL("image/jpeg", 0.85); balls.set(m.name, url); setSrc(url) }
    const id = setTimeout(make, 30 + MATERIALS.indexOf(m) * 25); return () => { live = false; clearTimeout(id) }
  }, [m, src])
  return (
    <button title={m.name} aria-label={m.name} aria-pressed={active} onClick={onPick}
      className={cn("aspect-square overflow-hidden rounded-md bg-muted ring-1 ring-border transition-transform hover:scale-[1.07] active:scale-95", active && "ring-2 ring-foreground")}>
      {src && <img src={src} alt="" className="size-full object-cover" draggable={false} />}
    </button>
  )
}
function MaterialLab({ m, set }: { m: Material; set: (label: string, fn: (k: Material) => void) => void }) {
  const d = (label: string, key: keyof Material, o: { min?: number; max?: number; step?: number } = {}) => <Dial label={label} value={m[key] as number} {...o} onChange={(v) => set(key, (k) => { (k as any)[key] = v; k.name = "Custom" })} />
  return (<>
    <Section title="Material"><div className="grid grid-cols-6 gap-1.5">{MATERIALS.map((x) => <Ball key={x.name} m={x} active={x.name === m.name} onPick={() => set("pick", (k) => Object.assign(k, clone(x)))} />)}</div>
      <p className="text-[11.5px] text-muted-foreground">{m.name}</p></Section>
    <Section title="Material lab">
      <Colors items={[{ label: "Colour", value: m.color, onChange: (v) => set("col", (k) => { k.color = v; k.name = "Custom" }) }, { label: "Second", value: m.color2, onChange: (v) => set("col2", (k) => { k.color2 = v; k.name = "Custom" }) }]} />
      <Row label="Pattern"><select value={m.texture} onChange={(e) => set("tex", (k) => { k.texture = e.target.value as Material["texture"]; k.name = "Custom" })} className="h-6 rounded-sm bg-muted/60 px-1.5 text-[12px] capitalize outline-none">{TEXTURES.map((t) => <option key={t} value={t}>{t}</option>)}</select></Row>
      {m.texture !== "none" && d("Pattern size", "texScale", { min: 0.2, max: 6 })}
      {d("Colour", "diffuse")}{d("Mirror", "reflect")}{d("Metal", "metal")}{d("Shine", "shine")}{d("Polish", "gloss")}{d("See-through", "clear")}
      {m.clear > 0 && d("Bend light", "ior", { min: 1, max: 2.4 })}{d("Bumps", "bump")}{d("Glow", "glow", { max: 4 })}
    </Section>
  </>)
}

// ---------- a thing ----------
function Vec({ label, value, onChange, step = 0.1, min = -200, max = 200 }: { label: string; value: Vec3; onChange: (v: Vec3) => void; step?: number; min?: number; max?: number }) {
  return (
    <div className="grid grid-cols-[84px_1fr_1fr_1fr] items-center gap-1.5 text-[12.5px]"><span className="text-foreground/80">{label}</span>
      {[0, 1, 2].map((i) => <input key={i} type="number" step={step} min={min} max={max} value={Number(value[i].toFixed(2))} aria-label={`${label} ${"XYZ"[i]}`}
        onChange={(e) => { const n = parseFloat(e.target.value); if (isFinite(n)) { const v = [...value] as Vec3; v[i] = n; onChange(v) } }}
        className="h-6 w-full rounded-sm bg-muted/60 px-1.5 font-mono text-[11px] tabular-nums outline-none focus:ring-1 focus:ring-ring" />)}
    </div>
  )
}
function ThingPanel() {
  const t = useApp(selectedThing); const [linked, setLinked] = React.useState(true)
  if (!t) return <p className="p-4 text-[12.5px] text-muted-foreground">Tap a thing in the picture or in the list.</p>
  const set = (label: string, fn: (k: Thing) => void) => editThing(t.id, label, fn)
  const repeat = (ring: boolean) => edit("repeat" + t.id, (w) => { const n = 5; for (let i = 1; i <= n; i++) { const c = clone(t); c.id = newId(); c.name = `${t.name} ${i + 1}`
    if (ring) { const a = (i / (n + 1)) * Math.PI * 2, r = Math.hypot(t.pos[0], t.pos[2]) || 4, a0 = Math.atan2(t.pos[2], t.pos[0]); c.pos = [Math.cos(a0 + a) * r, t.pos[1], Math.sin(a0 + a) * r]; c.rot = [t.rot[0] - (a * 180) / Math.PI, t.rot[1], t.rot[2]] }
    else { c.pos = [t.pos[0] + i * t.size[0] * 2.4, t.pos[1], t.pos[2]]; c.size = t.size.map((s) => s * Math.pow(0.86, i)) as Vec3 }
    if (w.things.length < 20) w.things.push(c) } })
  return (<>
    <Section title="Shape" action={<Button variant="ghost" size="xs" onClick={() => removeThing(t.id)}><Trash2 /> Remove</Button>}>
      <Input value={t.name} onChange={(e) => set("name", (k) => { k.name = e.target.value.slice(0, 40) })} className="h-7 text-[12.5px]" aria-label="Name" />
      <Row label="Kind"><select value={t.kind} onChange={(e) => set("kind", (k) => { k.kind = e.target.value as Kind })} className="h-6 rounded-sm bg-muted/60 px-1.5 text-[12px] outline-none">{KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></Row>
      {(t.kind === "box" || t.kind === "torus" || t.kind === "stone") && <Dial label={t.kind === "box" ? "Round edges" : t.kind === "torus" ? "Thickness" : "Shape"} value={t.round} min={t.kind === "box" ? 0 : 0.05} max={t.kind === "box" ? 0.5 : 1} onChange={(v) => set("round", (k) => { k.round = v })} />}
    </Section>
    <Section title="Place" action={<Button variant={linked ? "glass" : "ghost"} size="xs" onClick={() => setLinked(!linked)} aria-pressed={linked}><Link2 /> Even size</Button>}>
      <Vec label="Position" value={t.pos} onChange={(v) => set("pos", (k) => { k.pos = v })} />
      {linked ? <Dial label="Size" value={t.size[0]} min={0.1} max={8} onChange={(v) => set("size", (k) => { const f = v / Math.max(0.01, k.size[0]); k.size = k.size.map((s) => Math.max(0.02, s * f)) as Vec3 })} />
        : <Vec label="Size" value={t.size} min={0.02} onChange={(v) => set("size3", (k) => { k.size = v.map((s) => Math.max(0.02, s)) as Vec3 })} />}
      <Dial label="Turn" value={t.rot[0]} min={-180} max={180} step={1} unit="°" onChange={(v) => set("r0", (k) => { k.rot[0] = v })} />
      <Dial label="Tilt" value={t.rot[1]} min={-180} max={180} step={1} unit="°" onChange={(v) => set("r1", (k) => { k.rot[1] = v })} />
      <Dial label="Roll" value={t.rot[2]} min={-180} max={180} step={1} unit="°" onChange={(v) => set("r2", (k) => { k.rot[2] = v })} />
      <div className="flex gap-1.5"><Button variant="glass" size="xs" onClick={() => set("ground", (k) => { k.pos[1] = k.size[1] })}>Rest on ground</Button><Button variant="glass" size="xs" onClick={() => repeat(false)}>Repeat in a row</Button><Button variant="glass" size="xs" onClick={() => repeat(true)}>In a ring</Button></div>
    </Section>
    <Section title="Cut & combine">
      <Segmented label="Role" value={t.role} options={[{ value: "solid", label: "Solid" }, { value: "cut", label: "Cuts" }, { value: "keep", label: "Overlap only" }]} onChange={(v) => set("role", (k) => { k.role = v })} />
      <Row label="Set"><Segmented label="Set" value={String(t.group)} options={[{ value: "0", label: "A" }, { value: "1", label: "B" }, { value: "2", label: "C" }, { value: "3", label: "D" }]} onChange={(v) => set("group", (k) => { k.group = +v })} /></Row>
      <p className="text-[11.5px] text-muted-foreground">A shape that cuts carves a hole in the solid shapes of its own set. Blobs in one set melt together.</p>
    </Section>
    <MaterialLab m={t.mat} set={(label, fn) => set("mat:" + label, (k) => fn(k.mat))} />
    <Section title="In loops"><Dial label="Bob" value={t.bob ?? 0} max={1.5} onChange={(v) => set("bob", (k) => { k.bob = v })} /><Dial label="Spin" value={t.spin ?? 0} min={-2} max={2} step={1} onChange={(v) => set("spin", (k) => { k.spin = v })} /></Section>
  </>)
}

// ---------- lettering ----------
function TitlePanel() {
  const t = useApp((x) => x.world.title); const set = (label: string, fn: (k: NonNullable<World["title"]>) => void) => edit("title:" + label, (w) => { if (!w.title) w.title = titleFrom(""); fn(w.title) })
  const v = t ?? titleFrom("")
  return (<>
    <Section title="Words" action={t ? <Button variant="ghost" size="xs" onClick={() => edit("title-off", (w) => { delete w.title })}><Trash2 /> Remove</Button> : undefined}>
      <Input value={v.text} placeholder="Type a title…" maxLength={40} onChange={(e) => set("text", (k) => { k.text = e.target.value.toUpperCase() })} className="h-8" aria-label="Lettering text" data-testid="title-input" />
      <p className="text-[11.5px] text-muted-foreground">Real 3D letters standing in the world. They reflect, and the world reflects in them.</p>
    </Section>
    {t && <>
      <Section title="Place">
        <Dial label="Width" value={v.width} min={2} max={40} step={0.1} onChange={(x) => set("w", (k) => { k.width = x })} /><Dial label="Lift" value={v.lift} min={-1} max={14} step={0.05} onChange={(x) => set("l", (k) => { k.lift = x })} />
        <Dial label="Depth" value={v.depth} min={0.05} max={3} onChange={(x) => set("d", (k) => { k.depth = x })} /><Dial label="Across" value={v.x} min={-20} max={20} step={0.1} onChange={(x) => set("x", (k) => { k.x = x })} />
        <Dial label="Near / far" value={v.z} min={-20} max={20} step={0.1} onChange={(x) => set("z", (k) => { k.z = x })} /><Dial label="Turn" value={v.yaw} min={-3.14} max={3.14} onChange={(x) => set("y", (k) => { k.yaw = x })} />
      </Section>
      <MaterialLab m={v.mat} set={(label, fn) => set("mat:" + label, (k) => fn(k.mat))} />
    </>}
  </>)
}

// ---------- camera ----------
function ViewDot({ i, view }: { i: number; view: Camera | null }) {
  const [src, setSrc] = React.useState<string>()
  React.useEffect(() => { if (!view || !engine) { setSrc(undefined); return } const id = setTimeout(() => setSrc(engine!.thumb({ ...get().world, cam: view }, 96, 72)), 60); return () => clearTimeout(id) }, [view])
  return (
    <button title={view ? `View ${i + 1}: tap to go, Shift-tap to replace` : `Save this view in slot ${i + 1}`} aria-label={`View ${i + 1}`}
      onClick={(e) => { if (!view || e.shiftKey) edit("view-save" + i, (w) => { w.views[i] = clone(w.cam) }); else edit("view-go" + i, (w) => { w.cam = clone(view) }) }}
      onContextMenu={(e) => { e.preventDefault(); edit("view-clear" + i, (w) => { w.views[i] = null }) }}
      className={cn("grid aspect-[4/3] place-items-center overflow-hidden rounded-md text-[11px] text-muted-foreground ring-1 ring-border transition-transform hover:scale-105", !view && "border border-dashed border-border ring-0")}>
      {src ? <img src={src} alt="" className="size-full object-cover" /> : i + 1}
    </button>
  )
}
function CameraPanel() {
  const c = useApp((x) => x.world.cam), views = useApp((x) => x.world.views); const set = (label: string, fn: (k: Camera) => void) => edit("cam:" + label, (w) => fn(w.cam))
  return (<>
    <Section title="Saved views"><div className="grid grid-cols-7 gap-1">{Array.from({ length: 7 }, (_, i) => <ViewDot key={i} i={i} view={views[i] ?? null} />)}</div>
      <p className="text-[11.5px] text-muted-foreground">Tap an empty slot to keep this view. Right-click a slot to clear it.</p></Section>
    <Section title="Lens" action={<Button variant="ghost" size="xs" onClick={() => set("reset", (k) => Object.assign(k, camFrom({ target: k.target })))}><RotateCcw /> Reset</Button>}>
      <Dial label="Zoom lens" value={c.fov} min={12} max={120} step={0.5} unit="°" onChange={(v) => set("fov", (k) => { k.fov = v })} />
      <Dial label="Distance" value={c.dist} min={3} max={120} step={0.1} onChange={(v) => set("dist", (k) => { k.dist = v })} />
      <Dial label="Height" value={c.pitch} min={0.01} max={1.5} onChange={(v) => set("pitch", (k) => { k.pitch = v })} />
      <Dial label="Tilt horizon" value={c.roll} min={-45} max={45} step={0.5} unit="°" onChange={(v) => set("roll", (k) => { k.roll = v })} />
      <div className="flex gap-1.5"><Button variant="glass" size="xs" onClick={() => set("top", (k) => { k.pitch = 1.5; k.dist = Math.max(k.dist, 26) })}>From above</Button><Button variant="glass" size="xs" onClick={() => set("low", (k) => { k.pitch = 0.03 })}>Water level</Button></div>
    </Section>
    <Section title="Soft focus">
      <Dial label="Blur" value={c.lens} max={0.6} onChange={(v) => set("lens", (k) => { k.lens = v })} /><Dial label="Sharp at" value={c.focus} min={1} max={80} step={0.1} onChange={(v) => set("focus", (k) => { k.focus = v })} />
      <p className="text-[11.5px] text-muted-foreground">Double-tap anything in the picture to make it the sharp point.</p>
    </Section>
    <Section title="360°"><Row label="Look all around"><Switch checked={!!c.pano} onCheckedChange={(v) => edit("pano", (w) => { w.cam.pano = v; w.frame = v ? FRAMES[6] : FRAMES[1] })} aria-label="360 picture" /></Row></Section>
  </>)
}

// ---------- picture ----------
function PicturePanel() {
  const f = useApp((x) => x.world.frame), quality = useApp((x) => x.quality), wires = useApp((x) => x.wires), mask = useApp((x) => x.mask)
  return (<>
    <Section title="Frame"><div className="flex flex-col gap-1">{FRAMES.map((x) => (
      <button key={x.name} onClick={() => edit("frame", (w) => { w.frame = x; w.cam.pano = x.name.startsWith("360") })} aria-pressed={x.name === f.name}
        className={cn("flex h-7 items-center justify-between rounded-md px-2 text-[12.5px] text-muted-foreground hover:bg-muted/60", x.name === f.name && "glass-control bg-(--glass-control) text-foreground")}>
        <span>{x.name.replace(/ \d.*$/, "")}</span><span className="font-mono text-[11px]">{x.w} × {x.h}</span></button>))}</div></Section>
    <Section title="Finish"><Segmented label="Quality" value={String(quality)} options={QUALITY.map((q, i) => ({ value: String(i), label: q.name }))} onChange={(v) => patch({ quality: +v })} />
      <p className="text-[11.5px] text-muted-foreground">More passes make shadows, blur and glass smoother. Premium takes the longest.</p></Section>
    <Section title="Show"><Segmented label="Show" value={String(mask)} options={[{ value: "0", label: "Picture" }, { value: "1", label: "Distance" }, { value: "2", label: "Things" }, { value: "3", label: "Height" }]} onChange={(v) => patch({ mask: +v })} />
      <Row label="Wireframes while moving"><Switch checked={wires} onCheckedChange={(v) => patch({ wires: v })} aria-label="Wireframes while moving" /></Row></Section>
  </>)
}
export { mat }
