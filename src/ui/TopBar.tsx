// The bar across the top: the world's name, undo, how the render is going, and the ways out
// (share, design, loop, save). It measures its own width, not the window's: with the sidebar
// open or shut the same bar has more or less room. What does not fit folds into "More".
import * as React from "react"
import { Check, Clapperboard, Code2, Copy, Disc3, Download, Ellipsis, FolderOpen, GanttChart, LayoutGrid, Link, Redo2, Search, Share2, Sparkles, Undo2 } from "lucide-react"

import { FEATURES, openEmbed } from "@/features"
import { pickPhoto } from "@/features/photo-world"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { exportGLB, exportHeightmap, exportOBJ, importModel, photoToLand, pickFile, setPicture } from "@/io"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { StatusGlyph } from "@/components/ui/status-glyph"
import { QUALITY } from "@/engine/engine"
import { edit, engine, get, patch, redo, shareLink, undo, useApp } from "@/store"

import { Tip } from "./Viewport"

export function download(canvas: HTMLCanvasElement, name: string) {
  canvas.toBlob((b) => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000) }, "image/png")
}
export const fileName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "world"

/** Bring things in, take things out: the File menu's items, also folded into "More" on a phone. */
function FileItems({ say }: { say: (s: string) => void }) {
  return <>
    <DropdownMenuGroup><DropdownMenuLabel>Bring in</DropdownMenuLabel>
      <DropdownMenuItem data-testid="import-model" onClick={async () => { const f = await pickFile(".glb,.gltf,.obj"); if (f) { say("Reading the model…"); const ok = await importModel(f).catch(() => false); say(ok ? "" : "That file had no shape I could read."); if (!ok) setTimeout(() => say(""), 4000) } }}>A 3D model (.glb, .obj)…</DropdownMenuItem>
      <DropdownMenuItem data-testid="photo-world" onClick={() => void pickPhoto()}>A photo, to make a whole world…</DropdownMenuItem>
      <DropdownMenuItem onClick={async () => { const f = await pickFile("image/*"); if (f) { await photoToLand(f); patch({ sel: { type: "land" } }) } }}>A picture, to make land…</DropdownMenuItem>
      <DropdownMenuItem onClick={async () => { const f = await pickFile("image/*"); if (f) await setPicture(f) }}>A picture, to paint things with…</DropdownMenuItem>
    </DropdownMenuGroup><DropdownMenuSeparator />
    <DropdownMenuGroup><DropdownMenuLabel>Take out</DropdownMenuLabel>
      <DropdownMenuItem data-testid="export-glb" onClick={() => void exportGLB()}>This world as 3D (.glb)</DropdownMenuItem>
      <DropdownMenuItem data-testid="export-obj" onClick={() => exportOBJ()}>This world as 3D (.obj)</DropdownMenuItem>
      <DropdownMenuItem onClick={exportHeightmap}>The land as a height picture</DropdownMenuItem>
    </DropdownMenuGroup>
  </>
}

/** Share: one press copies the link, and the little window that opens offers the other ways. */
function ShareButton() {
  const [open, setOpen] = React.useState(false); const [url, setUrl] = React.useState(""); const [copied, setCopied] = React.useState(false)
  const copy = async () => { const u = await shareLink(); setUrl(u); try { await navigator.clipboard.writeText(u) } catch { /* clipboard blocked: the link is shown, and in the address bar */ } history.replaceState(null, "", u); setCopied(true); setTimeout(() => setCopied(false), 1800) }
  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) void copy() }}>
      <PopoverTrigger render={<Button title="Copy a link to this world" variant="ghost" size="sm" data-testid="share" aria-label="Share" />}>{copied ? <Check /> : <Share2 />}<span className="hidden @min-[900px]:inline">{copied ? "Copied" : "Share"}</span></PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-2 p-3" data-testid="share-popover">
        <p className="flex items-center gap-1.5 text-[13px] font-medium">{copied ? <Check className="size-4 text-emerald-400" /> : <Link className="size-4" />}{copied ? "Link copied" : "Link to this world"}</p>
        <p className="text-[12px] leading-snug text-muted-foreground">Whoever opens it gets this exact world, and can change it into their own.</p>
        <div className="flex gap-1.5">
          <input readOnly value={url} onFocus={(e) => e.target.select()} aria-label="Link to this world" className="h-8 min-w-0 flex-1 truncate rounded-md bg-black/30 px-2 font-mono text-[11px] text-foreground/85 ring-1 ring-border outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          <Button variant="glass" size="sm" className="h-8" onClick={() => void copy()} aria-label="Copy the link again"><Copy /></Button>
        </div>
        <div className="mt-1 flex flex-col gap-0.5 border-t border-border/60 pt-2">
          <Button variant="ghost" size="sm" className="justify-start" onClick={() => { setOpen(false); openEmbed() }} data-testid="embed"><Code2 /> Put it on a web page</Button>
          <Button variant="ghost" size="sm" className="justify-start" render={<a href="./gallery.html" target="_blank" rel="noopener" />}><LayoutGrid /> See the community gallery</Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function TopBar() {
  const name = useApp((s) => s.world.name), remix = useApp((s) => s.world.remixOf), status = useApp((s) => s.status), canUndo = useApp((s) => s.past.length > 0), canRedo = useApp((s) => s.future.length > 0)
  const timeline = useApp((s) => s.timeline); const [note, setNote] = React.useState("")
  const [saving, setSaving] = React.useState<number | null>(null)
  const save = async () => { if (!engine || saving !== null) return; const w = get().world; setSaving(0)
    const c = await engine.still(w, w.frame.w, w.frame.h, Math.max(16, QUALITY[get().quality].samples), setSaving); download(c, `${fileName(w.name)}.png`); setSaving(null) }
  const label = status.phase === "done" ? "Sharp" : status.phase === "moving" ? "Moving" : status.phase === "blocks" ? "Blocking in" : `Sharpening ${status.samples}/${status.target}`
  const toggleTimeline = () => patch({ timeline: !timeline, playing: false })
  // the widths, measured on the bar itself: <560 a phone, 560–900 icons, 900+ words, 1150+ everything
  return (
    <header className="@container shrink-0">
      <div className="flex h-12 items-center gap-1 px-2 @min-[560px]:gap-1.5">
        <SidebarTrigger aria-label="Show or hide the list of parts" />
        <div className="mx-0.5 h-4 w-px shrink-0 bg-border" />
        <input value={name} onChange={(e) => edit("name", (w) => { w.name = e.target.value.slice(0, 60) })} aria-label="World name" title="The world's name: click to change it" spellCheck={false}
          className="h-7 w-24 min-w-0 shrink truncate rounded-md bg-transparent px-1.5 text-[13.5px] font-medium outline-none hover:bg-muted/60 focus:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/60 @min-[400px]:w-36 @min-[900px]:w-44 @min-[1150px]:w-52" />
        {remix && <span className="hidden shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground @min-[1250px]:inline" title={`This world started as ${remix}`}>remix of {remix}</span>}
        <div className="hidden items-center @min-[560px]:flex">
          <Tip label="Undo (Ctrl Z)"><Button variant="ghost" size="icon-sm" onClick={undo} disabled={!canUndo} aria-label="Undo"><Undo2 /></Button></Tip>
          <Tip label="Redo (Ctrl Shift Z)"><Button variant="ghost" size="icon-sm" onClick={redo} disabled={!canRedo} aria-label="Redo"><Redo2 /></Button></Tip>
        </div>
        <div className="hidden items-center gap-0.5 @min-[560px]:flex">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button title="Bring in a model or a picture, take the world out as 3D" variant="ghost" size="sm" data-testid="file-menu" aria-label="File" />}><FolderOpen /><span className="hidden @min-[900px]:inline">File</span></DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64"><FileItems say={setNote} /></DropdownMenuContent>
          </DropdownMenu>
        </div>
        {FEATURES.some((f) => f.run) && <DropdownMenu>
          <DropdownMenuTrigger render={<Button title="Other ways to play: screensaver, 1994 mode, fly, and more" variant="ghost" size="sm" data-testid="modes-menu" aria-label="Modes" />}><Sparkles /><span className="hidden @min-[700px]:inline">Modes</span></DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-[min(34rem,80dvh)] w-[min(20rem,calc(100vw-1rem))]"><DropdownMenuGroup>
            {FEATURES.filter((f) => f.run).map((f) => <DropdownMenuItem key={f.id} onClick={() => f.run!()} data-testid={`mode-${f.id}`} className="items-start gap-2.5 py-1.5">{f.icon && <f.icon className="mt-0.5 size-4 shrink-0" />}<span className="flex flex-col gap-0.5"><span className="font-medium">{f.label}</span><span className="text-[11.5px] leading-snug text-muted-foreground">{f.about}</span></span></DropdownMenuItem>)}
          </DropdownMenuGroup></DropdownMenuContent>
        </DropdownMenu>}
        <Tip label={timeline ? "Hide the timeline" : "Animate: set keys on a timeline and the world glides between them"}><Button variant={timeline ? "glass" : "ghost"} size="sm" className="hidden @min-[560px]:inline-flex" onClick={toggleTimeline} aria-pressed={timeline} aria-label="Timeline" data-testid="open-timeline"><GanttChart /><span className="hidden @min-[1000px]:inline">Timeline</span></Button></Tip>
        {note && <span className="hidden truncate text-[12px] text-muted-foreground @min-[700px]:inline" role="status">{note}</span>}
        <div className="ml-auto flex shrink-0 items-center gap-1 @min-[560px]:gap-1.5">
          <Tip label={`The picture: ${label.toLowerCase()}`}>
            <span className="hidden items-center gap-1.5 pr-1 text-[12px] text-muted-foreground tabular-nums @min-[560px]:flex" data-testid="status" aria-live="polite">
              {status.phase === "done" ? <Check className="size-3.5" /> : <StatusGlyph activity="running" className="size-4" />}<span className="hidden @min-[1100px]:inline">{label}</span>
            </span>
          </Tip>
          <Tip label="Find any look, shape, world or action (/)"><Button variant="glass" size="sm" className="hidden text-muted-foreground @min-[560px]:inline-flex" onClick={() => patch({ dialog: "find" })} aria-label="Find anything" data-testid="open-find"><Search /><span className="hidden @min-[1150px]:inline">Find anything</span><Kbd className="hidden @min-[1150px]:inline-flex">/</Kbd></Button></Tip>
          <ShareButton />
          <Tip label="Make a cover, flyer, poster, postcard…"><Button variant="ghost" size="sm" onClick={() => patch({ dialog: "cover" })} aria-label="Design" data-testid="open-cover"><Disc3 /><span className="hidden @min-[900px]:inline">Design</span></Button></Tip>
          <Tip label="Make a short video that loops"><Button variant="ghost" size="sm" className="hidden @min-[560px]:inline-flex" onClick={() => patch({ dialog: "loop" })} aria-label="Loop" data-testid="open-loop"><Clapperboard /><span className="hidden @min-[900px]:inline">Loop</span></Button></Tip>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button title="More" variant="ghost" size="icon-sm" className="@min-[560px]:hidden" aria-label="More" data-testid="more-menu" />}><Ellipsis /></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-[80dvh] w-64">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={undo} disabled={!canUndo}><Undo2 /> Undo</DropdownMenuItem>
                <DropdownMenuItem onClick={redo} disabled={!canRedo}><Redo2 /> Redo</DropdownMenuItem>
                <DropdownMenuItem onClick={() => patch({ dialog: "find" })}><Search /> Find anything</DropdownMenuItem>
                <DropdownMenuItem onClick={toggleTimeline} data-testid="more-timeline"><GanttChart /> {timeline ? "Hide the timeline" : "Timeline"}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => patch({ dialog: "loop" })} data-testid="more-loop"><Clapperboard /> Loop video</DropdownMenuItem>
                <DropdownMenuItem onClick={openEmbed} data-testid="more-embed"><Code2 /> Put it on a web page</DropdownMenuItem>
              </DropdownMenuGroup><DropdownMenuSeparator />
              <FileItems say={setNote} />
            </DropdownMenuContent>
          </DropdownMenu>
          <Tip label="Save the picture, full size"><Button size="sm" className="glass-primary min-w-[4.5rem]" onClick={() => void save()} aria-label="Save the picture" data-testid="save"><Download />{saving === null ? "Save" : `${Math.round(saving * 100)}%`}</Button></Tip>
        </div>
      </div>
    </header>
  )
}
