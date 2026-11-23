// Embed: put this world on someone else's page. A small dialog that writes two snippets — a plain
// frame that works anywhere, and a tag for pages that allow scripts — both pointing at embed.html,
// the light viewer that ships next to the app.
import * as React from "react"
import { Check, Code2, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { encodeWorld } from "@/engine/scene"
import { engine, get, useApp } from "@/store"
import { Row, Segmented } from "@/ui/fields"

import type { Feature } from "./index"

// the dialog keeps its own little switch, so the app's store does not need to know about it
let open = false; const subs = new Set<() => void>()
const setOpen = (v: boolean) => { open = v; subs.forEach((f) => f()) }
export const openEmbed = () => setOpen(true)
const useOpen = () => React.useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => open)

const SIZES = { small: [480, 300], medium: [640, 400], large: [960, 600], fill: [0, 0] } as const
type Size = keyof typeof SIZES
const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")

/** The two snippets for a world's code. Exported for the tests. */
export function snippets(code: string, o: { size: Size; turn: boolean; name: string }, base = location.href) {
  const page = new URL("embed.html", base), script = new URL("embed.js", base)
  page.search = o.turn ? "?autorotate" : ""; page.hash = `w=${code}`
  const [w, h] = SIZES[o.size], title = attr(`${o.name || "A world"}, made with Untitled Worlds`)
  const box = o.size === "fill" ? ` style="width:100%;aspect-ratio:8/5;border:0;border-radius:10px"` : ` width="${w}" height="${h}" style="border:0;border-radius:10px;max-width:100%"`
  const frame = `<iframe src="${attr(page.href)}"${box} allow="fullscreen" loading="lazy" title="${title}"></iframe>`
  const size = o.size === "fill" ? "" : ` width="${w}" height="${h}"`
  const tag = `<script src="${attr(script.href)}" async></script>\n<untitled-world code="${attr(code)}"${size}${o.turn ? " autorotate" : ""} name="${title}"></untitled-world>`
  return { frame, tag, page: page.href }
}

function Snippet({ label, about, text, id }: { label: string; about: string; text: string; id: string }) {
  const [done, setDone] = React.useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(text) } catch { const t = document.getElementById(`snip-${id}`) as HTMLTextAreaElement | null; t?.select(); document.execCommand?.("copy") }
    setDone(true); setTimeout(() => setDone(false), 1600)
  }
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end justify-between gap-2">
        <div><p className="text-[12.5px] font-medium">{label}</p><p className="text-[11.5px] text-muted-foreground">{about}</p></div>
        <Button variant="glass" size="sm" onClick={() => void copy()} data-testid={`copy-${id}`}>{done ? <Check /> : <Copy />}{done ? "Copied" : "Copy"}</Button>
      </div>
      <textarea id={`snip-${id}`} readOnly value={text} rows={3} spellCheck={false} onFocus={(e) => e.target.select()} data-testid={`snippet-${id}`}
        className="w-full resize-none rounded-md bg-black/30 p-2 font-mono text-[11px] leading-relaxed text-foreground/85 ring-1 ring-border outline-none focus:ring-ring" />
    </div>
  )
}

function EmbedDialog() {
  const isOpen = useOpen()
  const [code, setCode] = React.useState(""); const [size, setSize] = React.useState<Size>("medium"); const [turn, setTurn] = React.useState(false)
  const [thumb, setThumb] = React.useState<string>(); const name = useApp((x) => x.world.name)
  React.useEffect(() => {
    if (!isOpen) return; let live = true; const w = get().world
    void encodeWorld(w).then((c) => { if (live) setCode(c) })
    if (engine) setThumb(engine.thumb(w, 384, 240))
    return () => { live = false }
  }, [isOpen])
  const s = code ? snippets(code, { size, turn, name }) : null
  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92dvh] w-[min(560px,96vw)] max-w-none overflow-y-auto sm:max-w-none" data-testid="embed-dialog">
        <DialogHeader>
          <DialogTitle>Put this world on a page</DialogTitle>
          <DialogDescription>Paste one of these into a website or blog. People can drag to look around, and open it here to remix.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <div className="relative aspect-[8/5] overflow-hidden rounded-lg bg-black/40 ring-1 ring-border">
            {thumb && <img src={thumb} alt="" className="size-full object-cover" />}
            <span className="absolute right-1.5 bottom-1.5 rounded-full bg-black/45 px-2 py-0.5 text-[9.5px] text-white/90 backdrop-blur">Open in Untitled Worlds</span>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-col gap-1.5 text-[12.5px]"><span className="text-foreground/80">Size</span>
              <Segmented label="Size" value={size} onChange={setSize} options={[{ value: "small", label: "Small" }, { value: "medium", label: "Medium" }, { value: "large", label: "Large" }, { value: "fill", label: "Full width" }]} />
            </div>
            <Row label="Turn slowly"><Switch checked={turn} onCheckedChange={setTurn} aria-label="Turn slowly" /></Row>
            {s && <a href={s.page} target="_blank" rel="noopener" className="text-[12px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">See how it looks</a>}
          </div>
        </div>
        {s ? <div className="flex flex-col gap-3">
          <Snippet id="frame" label="Frame" about="Works almost anywhere." text={s.frame} />
          <Snippet id="tag" label="Tag" about="Shorter, for pages that allow scripts." text={s.tag} />
        </div> : <p className="text-[12px] text-muted-foreground">Writing the code…</p>}
        <p className="text-[11.5px] text-muted-foreground">The world travels inside the code, so changes you make later will not show. Change it, then copy again.</p>
      </DialogContent>
    </Dialog>
  )
}

export const embed: Feature = { id: "embed", label: "Embed on a page", about: "Put this world, live, on your own website.", icon: Code2, Overlay: EmbedDialog }
