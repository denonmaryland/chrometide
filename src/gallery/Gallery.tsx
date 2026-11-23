// The community gallery: worlds people made and shared, read from gallery/worlds.json. Each card's
// picture is ray traced right here from the world's code; a click opens the world in the app,
// ready to change.
import * as React from "react"
import { Aperture, ArrowUpRight, Plus } from "lucide-react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { type World, decodeWorld } from "@/engine/scene"

import raw from "../../gallery/worlds.json"
import { thumb } from "./thumbs"

export interface Entry { name: string; author: string; github?: string; code: string; date: string; tags: string[] }
const ENTRIES = (raw as Entry[]).filter((e) => e && typeof e.code === "string" && typeof e.name === "string").sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name))
const SHARE_FORM = "https://github.com/denonmaryland/untitled-worlds/issues/new?template=share_a_world.yml"
const appLink = (code: string) => `./#w=${code}`
const when = (d: string) => { const t = new Date(`${d}T12:00:00`); return isNaN(+t) ? "" : t.toLocaleDateString("en", { month: "short", year: "numeric" }) }
/** Until its picture arrives, a card shows its world's own sky over its own sea. */
const wash = (w?: World | null) => w ? `linear-gradient(to bottom, ${w.sky.zenith}, ${w.sky.horizon} 60%, ${w.sea.c2} 60%, ${w.sea.c1})` : "linear-gradient(#2a2f45, #15151c)"

function Card({ e, world, i }: { e: Entry; world: World | null | undefined; i: number }) {
  const box = React.useRef<HTMLDivElement>(null); const [src, setSrc] = React.useState<string | null>()
  React.useEffect(() => {
    if (!world || !box.current) return; let live = true
    const io = new IntersectionObserver((xs) => { if (!xs.some((x) => x.isIntersecting)) return; io.disconnect(); void thumb(e.code, world).then((u) => { if (live) setSrc(u) }) }, { rootMargin: "240px 0px" })
    io.observe(box.current); return () => { live = false; io.disconnect() }
  }, [e.code, world])
  return (
    <article className="group/card relative flex flex-col overflow-hidden rounded-xl glass-panel transition-transform duration-300 hover:-translate-y-0.5 animate-in fade-in slide-in-from-bottom-2 fill-mode-both" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }} data-testid="gallery-card">
      <div ref={box} className="relative aspect-[4/3] overflow-hidden" style={{ background: wash(world) }}>
        {src ? <img src={src} alt={`${e.name}, a world by ${e.author}`} className="size-full object-cover transition-transform duration-700 ease-out animate-in fade-in group-hover/card:scale-[1.035]" data-testid="gallery-thumb" />
          : world !== null && <div className="absolute inset-0 animate-pulse bg-gradient-to-t from-black/25 to-transparent" />}
        {world === null && <p className="absolute inset-0 grid place-items-center text-[12px] text-white/80">This code could not be read.</p>}
        <span className="pointer-events-none absolute right-2.5 bottom-2.5 flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[11.5px] text-white opacity-0 backdrop-blur-md transition-opacity duration-200 group-hover/card:opacity-100 group-focus-within/card:opacity-100">Open and remix <ArrowUpRight className="size-3.5" /></span>
      </div>
      <div className="flex flex-col gap-1.5 px-3.5 pt-3 pb-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="truncate text-[14.5px] font-medium">
            <a href={appLink(e.code)} className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-ring" data-testid="gallery-open">{e.name}</a>
          </h2>
          <time dateTime={e.date} className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{when(e.date)}</time>
        </div>
        <p className="truncate text-[12px] text-muted-foreground">by {e.github
          ? <a href={`https://github.com/${e.github}`} target="_blank" rel="noopener noreferrer" className="relative z-10 text-foreground/80 underline-offset-2 hover:text-foreground hover:underline">{e.author}</a>
          : <span className="text-foreground/80">{e.author}</span>}</p>
        {e.tags.length > 0 && <div className="flex flex-wrap gap-1 pt-0.5">{e.tags.map((t) => <span key={t} className="rounded-full bg-muted/70 px-2 py-0.5 text-[10.5px] text-muted-foreground">{t}</span>)}</div>}
      </div>
    </article>
  )
}

export function Gallery() {
  const [tag, setTag] = React.useState(() => new URLSearchParams(location.search).get("tag") ?? "")
  const [worlds, setWorlds] = React.useState<Record<string, World | null>>({})
  React.useEffect(() => { void Promise.all(ENTRIES.map(async (e) => [e.code, await decodeWorld(e.code)] as const)).then((xs) => setWorlds(Object.fromEntries(xs))) }, [])
  React.useEffect(() => { const u = new URL(location.href); if (tag) u.searchParams.set("tag", tag); else u.searchParams.delete("tag"); history.replaceState(null, "", u) }, [tag])
  const tags = React.useMemo(() => { const n = new Map<string, number>(); ENTRIES.forEach((e) => e.tags.forEach((t) => n.set(t, (n.get(t) ?? 0) + 1))); return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])) }, [])
  const shown = ENTRIES.filter((e) => !tag || e.tags.includes(tag))
  const lead = worlds[ENTRIES[0]?.code]
  const bg = lead ? { background: `radial-gradient(1100px 520px at 75% -12%, color-mix(in oklch, ${lead.sky.horizon} 18%, transparent), transparent 70%), radial-gradient(900px 600px at -10% 30%, color-mix(in oklch, ${lead.sky.zenith} 16%, transparent), transparent 70%)` } : undefined
  const chip = (on: boolean) => cn("h-7 shrink-0 rounded-full px-3 text-[12.5px] transition-colors", on ? "glass-control bg-(--glass-control) text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground")
  return (
    <div className="min-h-dvh" style={bg}>
      <div className="mx-auto flex max-w-6xl flex-col px-4 pb-16 sm:px-6">
        <header className="flex h-14 items-center gap-2">
          <a href="./" className="flex items-center gap-2 rounded-md pr-2 outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="grid size-6 place-items-center rounded-md" style={{ background: lead ? `linear-gradient(${lead.sky.zenith}, ${lead.sky.horizon})` : "linear-gradient(#6a8ad8, #f4c7a1)" }}><Aperture className="size-3.5 text-white mix-blend-overlay" /></span>
            <span className="font-mark text-[17px] leading-none whitespace-nowrap">Untitled Worlds</span>
          </a>
          <div className="ml-auto flex items-center gap-1.5">
            <a href="./" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "max-[400px]:hidden")}>Open the app</a>
            <a href={SHARE_FORM} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ size: "sm" }), "glass-primary")}><Plus /> Share yours</a>
          </div>
        </header>

        <section className="pt-10 pb-7 sm:pt-16 sm:pb-9">
          <h1 className="font-mark text-[44px] leading-[1.02] tracking-tight sm:text-[64px]">Community gallery</h1>
          <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-muted-foreground">Worlds people made and shared. Open one to look around, change anything, and make it your own.</p>
        </section>

        {tags.length > 0 && <nav aria-label="Filter by tag" className="-mx-4 mb-5 flex gap-1 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
          <button className={chip(!tag)} onClick={() => setTag("")} aria-pressed={!tag}>All <span className="ml-0.5 font-mono text-[10.5px] opacity-60">{ENTRIES.length}</span></button>
          {tags.map(([t, n]) => <button key={t} className={chip(tag === t)} onClick={() => setTag(tag === t ? "" : t)} aria-pressed={tag === t} data-testid={`tag-${t}`}>{t} <span className="ml-0.5 font-mono text-[10.5px] opacity-60">{n}</span></button>)}
        </nav>}

        {ENTRIES.length === 0 ? <p className="py-20 text-center text-muted-foreground">No worlds here yet. Be the first to share one.</p> : (
          <main className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="gallery-grid">
            {shown.map((e, i) => <Card key={e.code} e={e} world={worlds[e.code]} i={i} />)}
          </main>)}

        <footer className="mt-14 flex flex-col items-start gap-3 rounded-xl glass-panel p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[14px] font-medium">Made something you love?</p>
            <p className="mt-0.5 max-w-[60ch] text-[13px] text-muted-foreground">Press Share in the app to copy its link, then send it with the “Share a world” form. Worlds that fit are added here, with your name.</p>
          </div>
          <a href={SHARE_FORM} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "glass" })}>Share a world <ArrowUpRight /></a>
        </footer>
      </div>
    </div>
  )
}
