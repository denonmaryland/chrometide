// The bar across the top: the world's name, undo, how the render is going, and the ways out
// (share, cover, loop, save).
import * as React from "react"
import { Check, Clapperboard, Disc3, Download, FolderOpen, GanttChart, Link, Redo2, Search, SlidersHorizontal, Undo2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
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

export function TopBar({ onInspector }: { onInspector: () => void }) {
  const name = useApp((s) => s.world.name), remix = useApp((s) => s.world.remixOf), status = useApp((s) => s.status), canUndo = useApp((s) => s.past.length > 0), canRedo = useApp((s) => s.future.length > 0)
  const timeline = useApp((s) => s.timeline); const [note, setNote] = React.useState("")
  const [copied, setCopied] = React.useState(false); const [saving, setSaving] = React.useState<number | null>(null)
  const share = async () => { const url = await shareLink(); try { await navigator.clipboard.writeText(url) } catch { /* clipboard blocked: the link is still in the address bar */ } history.replaceState(null, "", url); setCopied(true); setTimeout(() => setCopied(false), 1800) }
  const save = async () => { if (!engine || saving !== null) return; const w = get().world; setSaving(0)
    const c = await engine.still(w, w.frame.w, w.frame.h, Math.max(16, QUALITY[get().quality].samples), setSaving); download(c, `${fileName(w.name)}.png`); setSaving(null) }
  const label = status.phase === "done" ? "Sharp" : status.phase === "moving" ? "Moving" : status.phase === "blocks" ? "Blocking in" : `Sharpening ${status.samples}/${status.target}`
  return (
    <header className="flex h-12 shrink-0 items-center gap-1.5 px-2">
      <SidebarTrigger />
      <div className="mx-1 h-4 w-px bg-border" />
      <input value={name} onChange={(e) => edit("name", (w) => { w.name = e.target.value.slice(0, 60) })} aria-label="World name" spellCheck={false}
        className="h-7 min-w-0 max-w-56 flex-1 truncate rounded-md bg-transparent px-1.5 text-[13.5px] font-medium outline-none hover:bg-muted/60 focus:bg-muted/60 sm:flex-none sm:w-48" />
      {remix && <span className="hidden rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground md:inline">remix of {remix}</span>}
      <Tip label="Undo (Ctrl Z)"><Button variant="ghost" size="icon-sm" className="max-sm:hidden" onClick={undo} disabled={!canUndo} aria-label="Undo"><Undo2 /></Button></Tip>
      <Tip label="Redo (Ctrl Shift Z)"><Button variant="ghost" size="icon-sm" className="max-sm:hidden" onClick={redo} disabled={!canRedo} aria-label="Redo"><Redo2 /></Button></Tip>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="ghost" size="sm" data-testid="file-menu" />}><FolderOpen /><span className="hidden lg:inline">File</span></DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60">
          <DropdownMenuGroup><DropdownMenuLabel>Bring in</DropdownMenuLabel>
          <DropdownMenuItem data-testid="import-model" onClick={async () => { const f = await pickFile(".glb,.gltf,.obj"); if (f) { setNote("Reading the model…"); const ok = await importModel(f).catch(() => false); setNote(ok ? "" : "That file had no shape I could read."); if (!ok) setTimeout(() => setNote(""), 4000) } }}>A 3D model (.glb, .obj)…</DropdownMenuItem>
          <DropdownMenuItem onClick={async () => { const f = await pickFile("image/*"); if (f) { await photoToLand(f); patch({ sel: { type: "land" } }) } }}>A picture as land…</DropdownMenuItem>
          <DropdownMenuItem onClick={async () => { const f = await pickFile("image/*"); if (f) await setPicture(f) }}>A picture for materials…</DropdownMenuItem>
          </DropdownMenuGroup><DropdownMenuSeparator />
          <DropdownMenuGroup><DropdownMenuLabel>Take out</DropdownMenuLabel>
          <DropdownMenuItem data-testid="export-glb" onClick={() => void exportGLB()}>This world as 3D (.glb)</DropdownMenuItem>
          <DropdownMenuItem data-testid="export-obj" onClick={() => exportOBJ()}>This world as 3D (.obj)</DropdownMenuItem>
          <DropdownMenuItem onClick={exportHeightmap}>The land as a height picture</DropdownMenuItem></DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <Tip label="Animate with keys on a timeline"><Button variant={timeline ? "glass" : "ghost"} size="sm" onClick={() => patch({ timeline: !timeline, playing: false })} data-testid="open-timeline"><GanttChart /><span className="hidden lg:inline">Timeline</span></Button></Tip>
      {note && <span className="text-[12px] text-muted-foreground">{note}</span>}
      <div className="ml-auto flex items-center gap-1.5">
        <span className="hidden items-center gap-1.5 pr-1 text-[12px] text-muted-foreground tabular-nums lg:flex" data-testid="status">
          {status.phase === "done" ? <Check className="size-3.5" /> : <StatusGlyph activity="running" className="size-4" />}{label}
        </span>
        <Button variant="glass" size="sm" className="hidden text-muted-foreground md:inline-flex" onClick={() => patch({ dialog: "find" })}><Search /> Find anything <Kbd>/</Kbd></Button>
        <Tip label="Copy a link to this world"><Button variant="ghost" size="sm" onClick={() => void share()} data-testid="share">{copied ? <Check /> : <Link />}<span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span></Button></Tip>
        <Tip label="Make a cover, flyer, poster, postcard…"><Button variant="ghost" size="sm" onClick={() => patch({ dialog: "cover" })} data-testid="open-cover"><Disc3 /><span className="hidden sm:inline">Design</span></Button></Tip>
        <Tip label="Make a looping video"><Button variant="ghost" size="sm" onClick={() => patch({ dialog: "loop" })} data-testid="open-loop"><Clapperboard /><span className="hidden sm:inline">Loop</span></Button></Tip>
        <Button size="sm" className="glass-primary" onClick={() => void save()} data-testid="save"><Download />{saving === null ? "Save" : `${Math.round(saving * 100)}%`}</Button>
        <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={onInspector} aria-label="Controls"><SlidersHorizontal /></Button>
      </div>
    </header>
  )
}
