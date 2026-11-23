// The design maker: this world with words set on it, as an album cover, a flyer, a poster, a
// postcard, a wallpaper, a banner, a ticket or a trading card. And the shelf of ready-made
// designs to start from.
import * as React from "react"
import { Download, LayoutGrid } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { DESIGN_KINDS, type DesignKind, type DesignOpts, LAYOUTS, LAYOUT_LABEL, designOpts, drawDesign } from "@/design/layouts"
import { drawMock } from "@/design/mock"
import { DESIGNS, type DesignPreset, worldFor } from "@/design/presets"
import { engine, get, patch, replaceWorld, useApp } from "@/store"

import { Color, Row, Segmented } from "./fields"
import { download, fileName } from "./TopBar"

const thumbs = new Map<string, string>()
function PresetThumb({ p, order, onPick }: { p: DesignPreset; order: number; onPick: () => void }) {
  const [src, setSrc] = React.useState(thumbs.get(p.kind + p.name)); const k = DESIGN_KINDS[p.kind]
  React.useEffect(() => { if (src) return; let live = true
    const id = setTimeout(() => { if (!live || !engine) return; const h = 200, w = Math.round((h * k.w) / k.h), art = engine.frame(worldFor(p), w * 2, h * 2, 2), url = drawDesign(art, p.opts).toDataURL("image/jpeg", 0.85); thumbs.set(p.kind + p.name, url); setSrc(url) }, 120 + order * 90)
    return () => { live = false; clearTimeout(id) } }, [p, src, order, k])
  return (
    <button onClick={onPick} className="group/pt text-left" data-testid={`design-${p.kind}-${order}`} title={`${p.name}, on ${p.world}`}>
      <span className="block overflow-hidden rounded-md bg-muted ring-1 ring-border transition-transform group-hover/pt:scale-[1.03] group-active/pt:scale-[.98]" style={{ aspectRatio: `${k.w} / ${k.h}` }}>{src && <img src={src} alt="" className="size-full object-cover" />}</span>
      <span className="mt-1 block truncate text-[11.5px] text-muted-foreground group-hover/pt:text-foreground">{p.name}</span>
    </button>
  )
}

export function DesignDialog() {
  const open = useApp((s) => s.dialog === "cover"), world = useApp((s) => s.world), o = useApp((s) => s.design)
  const [tab, setTab] = React.useState<"make" | "shelf">("make"); const [shelfKind, setShelfKind] = React.useState<DesignKind>("cover")
  const [art, setArt] = React.useState<HTMLCanvasElement | null>(null); const [progress, setProgress] = React.useState(0)
  const view = React.useRef<HTMLCanvasElement>(null), out = React.useRef<HTMLCanvasElement | null>(null), k = DESIGN_KINDS[o.kind]
  const set = (p: Partial<DesignOpts>) => patch({ design: { ...get().design, ...p } })
  React.useEffect(() => { if (open && !get().design.title) set({ title: get().world.name }) }, [open])
  // develop the picture at the design's own shape whenever the dialog opens, the world changes or the kind changes
  React.useEffect(() => { if (!open || tab !== "make") return; setArt(null); setProgress(0); let live = true
    const id = setTimeout(async () => { if (!engine) return; const w = get().world, c = await engine.still({ ...w, cam: { ...w.cam, pano: false } }, k.w, k.h, 24, (f) => live && setProgress(f)); if (live) setArt(c) }, 80)
    return () => { live = false; clearTimeout(id) } }, [open, tab, o.kind, world, k.w, k.h])
  React.useEffect(() => { if (!art || !view.current) return
    const front = drawDesign(art, o), m = o.kind === "cover" ? drawMock(front, o, [world.sky.zenith, world.sky.horizon]) : front; out.current = m
    const v = view.current; v.width = m.width; v.height = m.height; v.getContext("2d")!.drawImage(m, 0, 0) }, [art, o, world.sky.zenith, world.sky.horizon])
  const pick = (p: DesignPreset) => { replaceWorld(worldFor(p), "design"); patch({ design: { ...p.opts } }); setTab("make") }
  const words = k.words as Record<string, string>, field = (key: "title" | "sub" | "line1" | "line2" | "small", testid?: string) => words[key] === undefined ? null :
    <label className="flex flex-col gap-1"><span className="text-[11px] text-muted-foreground">{words[key]}</span><Input value={o[key]} onChange={(e) => set({ [key]: e.target.value.slice(0, 60) })} placeholder={words[key]} aria-label={words[key]} data-testid={testid} /></label>
  return (
    <Dialog open={open} onOpenChange={(v) => patch({ dialog: v ? "cover" : null })}>
      <DialogContent className="max-h-[94dvh] w-[min(1000px,96vw)] max-w-none overflow-y-auto sm:max-w-none">
        <DialogHeader><DialogTitle>Design</DialogTitle><DialogDescription>Your world with words on it: a cover, a flyer, a poster, a postcard and more.</DialogDescription></DialogHeader>
        <div className="flex gap-1"><Button variant={tab === "make" ? "glass" : "ghost"} size="sm" onClick={() => setTab("make")}>This world</Button><Button variant={tab === "shelf" ? "glass" : "ghost"} size="sm" onClick={() => setTab("shelf")} data-testid="design-shelf"><LayoutGrid /> Ready-made designs <span className="font-mono text-[10px] text-muted-foreground">{DESIGNS.length}</span></Button></div>
        {tab === "shelf" ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-1">{(Object.keys(DESIGN_KINDS) as DesignKind[]).map((kd) => <button key={kd} onClick={() => setShelfKind(kd)} aria-pressed={kd === shelfKind} data-testid={`shelf-${kd}`}
              className={cn("h-7 rounded-md px-2.5 text-[12px] text-muted-foreground ring-1 ring-border", kd === shelfKind && "glass-control bg-(--glass-control) text-foreground")}>{DESIGN_KINDS[kd].label}s <span className="font-mono text-[10px]">{DESIGNS.filter((d) => d.kind === kd).length}</span></button>)}</div>
            <div className={cn("grid gap-3", shelfKind === "banner" || shelfKind === "ticket" ? "grid-cols-2" : shelfKind === "postcard" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-3 sm:grid-cols-5")}>
              {DESIGNS.filter((d) => d.kind === shelfKind).map((p, i) => <PresetThumb key={p.kind + p.name} p={p} order={i} onPick={() => pick(p)} />)}</div>
            <p className="text-[11.5px] text-muted-foreground">Every name, artist, place and date here is a made-up example. Pick one, then change the words and the world.</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-[1fr_280px]">
            <div className="relative grid min-h-64 place-items-center overflow-hidden rounded-lg bg-black/40 ring-1 ring-border">
              <canvas ref={view} className="max-h-[66dvh] w-full object-contain" data-testid="cover-canvas" style={{ display: art ? "block" : "none" }} />
              {!art && <div className="flex flex-col items-center gap-2 py-24 text-[12.5px] text-muted-foreground"><div className="h-1 w-40 overflow-hidden rounded-full bg-muted"><div className="h-full bg-foreground/70" style={{ width: `${progress * 100}%` }} /></div>Developing the picture…</div>}
            </div>
            <div className="flex flex-col gap-2.5">
              <Row label="Make a"><select value={o.kind} title="What to make" onChange={(e) => set({ kind: e.target.value as DesignKind, format: "flat" })} aria-label="Kind of design" data-testid="design-kind" className="h-7 rounded-sm bg-muted/60 px-1.5 text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-ring">{(Object.keys(DESIGN_KINDS) as DesignKind[]).map((kd) => <option key={kd} value={kd}>{DESIGN_KINDS[kd].label}</option>)}</select></Row>
              {field("title", "cover-title")}{field("sub")}{field("line1")}{field("line2")}
              {words.list !== undefined && <label className="flex flex-col gap-1"><span className="text-[11px] text-muted-foreground">{words.list}</span><textarea value={o.list} onChange={(e) => set({ list: e.target.value.slice(0, 500) })} rows={3} placeholder={words.list} aria-label={words.list} className="w-full resize-none rounded-md bg-muted/60 px-2 py-1.5 text-[12.5px] outline-none focus:ring-1 focus:ring-ring" /></label>}
              {field("small")}
              <div><p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Type</p>
                <div role="radiogroup" aria-label="Type layout" className="grid grid-cols-4 gap-1">{LAYOUTS.map((l) => <button key={l} role="radio" aria-checked={l === o.layout} onClick={() => set({ layout: l })}
                  className={cn("h-6 rounded-[5px] text-[11.5px] text-muted-foreground ring-1 ring-border/60", l === o.layout && "glass-control bg-(--glass-control) text-foreground")}>{LAYOUT_LABEL[l]}</button>)}</div></div>
              {o.kind === "cover" && <div><p className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">As a</p>
                <Segmented label="Format" value={o.format} options={[{ value: "flat", label: "Square" }, { value: "cd", label: "CD" }, { value: "tape", label: "Tape" }, { value: "vinyl", label: "Vinyl" }]} onChange={(v) => set({ format: v })} /></div>}
              <Color label="Ink" value={o.ink} onChange={(v) => set({ ink: v })} /><Color label="Paper" value={o.paper} onChange={(v) => set({ paper: v })} />
              <Row label="Paper strip down the side"><Switch checked={o.obi} onCheckedChange={(v) => set({ obi: v })} aria-label="Paper strip" data-testid="cover-obi" /></Row>
              {o.obi && <><Input value={o.obiText} onChange={(e) => set({ obiText: e.target.value.slice(0, 34) })} placeholder="Words on the strip" aria-label="Words on the strip" /><Color label="Strip colour" value={o.obiColor} onChange={(v) => set({ obiColor: v })} /></>}
              {o.kind === "cover" && o.format === "tape" && <textarea value={o.tracks} onChange={(e) => set({ tracks: e.target.value.slice(0, 400) })} rows={4} placeholder={"Track names, one per line"} aria-label="Track names" data-testid="cover-tracks" className="w-full resize-none rounded-md bg-muted/60 px-2 py-1.5 text-[12.5px] outline-none focus:ring-1 focus:ring-ring" />}
              <p className="font-mono text-[11px] text-muted-foreground" title="Size in pixels">{k.w} × {k.h} pixels</p>
              <Button className="glass-primary mt-auto" disabled={!art} onClick={() => out.current && download(out.current, `${fileName(o.title || world.name)}-${o.kind}${o.kind === "cover" && o.format !== "flat" ? "-" + o.format : ""}.png`)} data-testid="cover-save"><Download /> Save {k.label.toLowerCase()}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
export { designOpts }
