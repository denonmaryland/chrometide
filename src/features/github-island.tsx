// "Your GitHub year as an island": type a GitHub username and the last year of that person's public
// contribution calendar becomes the land. Opens from the Modes menu, or straight away from a link
// such as ?github=sample-coder. The world itself is built in ./island.ts.
import * as React from "react"
import { ClipboardPaste, Download, Link, Loader2, MountainSnow } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { engine, patch as patchApp, replaceWorld, shareLink } from "@/store"
import { Segmented } from "@/ui/fields"
import { download, fileName } from "@/ui/TopBar"

import type { FeatureCode } from "./lazy"
import { type Calendar, cleanUser, islandWorld, moodOf, parseCalendar, stats, validUser } from "./island"

/** The free, open service that reads public contribution calendars (it allows any website to ask). */
export const SERVICE = "github-contributions-api.jogruber.de"
const serviceUrl = (user: string) => `https://${SERVICE}/v4/${encodeURIComponent(user)}?y=last`

// ---- a little state of its own, so the shared store stays as it is ----
interface S { open: boolean; user: string; busy: boolean; note: string; cal: Calendar | null; from: "service" | "pasted" | null; shape: "banner" | "square" }
let s: S = { open: false, user: "", busy: false, note: "", cal: null, from: null, shape: "banner" }
const subs = new Set<() => void>()
const set = (p: Partial<S>) => { s = { ...s, ...p }; subs.forEach((f) => f()) }
const useS = () => React.useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => s)

const SHAPES = { banner: { w: 1500, h: 500, label: "Banner 1500 × 500" }, square: { w: 1200, h: 1200, label: "Square 1200 × 1200" } } as const
function build(cal: Calendar, shape = s.shape) { const sz = SHAPES[shape]; replaceWorld(islandWorld(cal, { aspect: sz.w / sz.h }), "github-island"); patchApp({ sel: { type: "land" } }) }

/** Ask the service for a public calendar. Only the username leaves this device. */
export async function fetchYear(raw: string) {
  const user = cleanUser(raw)
  if (!validUser(user)) { set({ note: "That does not look like a GitHub username: letters, numbers and single dashes, up to 39." }); return }
  set({ user, busy: true, note: "" })
  try {
    const r = await fetch(serviceUrl(user), { headers: { accept: "application/json" } })
    if (r.status === 429) throw new Error("The calendar service is busy. Wait ten seconds and try again.")
    const data = await r.json().catch(() => null)
    if (!r.ok || !data || data.error) throw new Error(r.status === 404 || /not found|no.*user/i.test(String(data?.error)) ? `No GitHub user called "${user}".` : `The calendar service said: ${data?.error ?? r.status}.`)
    const cal = parseCalendar(data, user); if (!cal) throw new Error("The calendar came back empty.")
    set({ cal, from: "service", busy: false }); build(cal)
  } catch (e) { set({ busy: false, note: e instanceof TypeError ? `Could not reach ${SERVICE}. You can paste the data instead.` : String((e as Error).message) }) }
}
export function fromPasted(text: string, user: string) {
  const cal = parseCalendar(text, cleanUser(user)); if (!cal) { set({ note: "I could not find any dated days in that. Paste the JSON, or lines like 2026-03-14 7." }); return false }
  set({ cal, from: "pasted", user: cal.user || s.user, note: "" }); build(cal); return true
}

function Island() {
  const st = useS(); const [name, setName] = React.useState(st.user); const [paste, setPaste] = React.useState(false); const [text, setText] = React.useState("")
  const [saving, setSaving] = React.useState<number | null>(null); const [copied, setCopied] = React.useState(false)
  React.useEffect(() => { if (st.user) setName(st.user) }, [st.user])
  const info = st.cal ? stats(st.cal) : null, mood = info ? moodOf(info.total) : null
  const fmt = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
  const save = async () => { if (!engine || !st.cal || saving !== null) return; const sz = SHAPES[st.shape], w = islandWorld(st.cal, { aspect: sz.w / sz.h }); setSaving(0)
    try { const c = await engine.still(w, sz.w, sz.h, 24, setSaving); download(c, `${fileName(st.cal.user || "my")}-year-island.png`) } finally { setSaving(null) } }
  const copy = async () => { const url = st.from === "service" && st.user ? `${location.origin}${location.pathname}?github=${encodeURIComponent(st.user)}` : await shareLink()
    try { await navigator.clipboard.writeText(url) } catch { /* clipboard blocked: show it instead */ } ;(window as any).__islandLink = url; setCopied(true); setTimeout(() => setCopied(false), 1800) }
  return (
    <Dialog open={st.open} onOpenChange={(v) => set({ open: v })}>
      <DialogContent className="max-h-[92dvh] w-[min(560px,96vw)] max-w-none overflow-y-auto sm:max-w-none" data-testid="island-dialog">
        <DialogHeader>
          <DialogTitle>Your GitHub year as an island</DialogTitle>
          <DialogDescription>Weeks run along the shore, days run inland. Busy days rise as peaks, the busiest get snow, and quiet days stay sea.</DialogDescription>
        </DialogHeader>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void fetchYear(name) }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="GitHub username" aria-label="GitHub username" autoComplete="off" spellCheck={false} autoCapitalize="none" data-testid="island-user" className="min-w-0 flex-1" />
          <Button type="submit" className="glass-primary" disabled={st.busy || !name.trim()} data-testid="island-go">{st.busy ? <Loader2 className="animate-spin" /> : <MountainSnow />}{st.busy ? "Reading…" : "Make my island"}</Button>
        </form>
        <p className="text-[12px] leading-relaxed text-muted-foreground" data-testid="island-privacy">
          Your username is sent to <a className="underline underline-offset-2" href="https://github.com/grubersjoe/github-contributions-api" target="_blank" rel="noreferrer">{SERVICE}</a>, a free service run by Jonathan Gruber, to read your public contribution calendar. Nothing else is sent, and only when you press the button.
        </p>
        {st.note && <p className="text-[12.5px] text-destructive" role="alert" data-testid="island-note">{st.note}</p>}
        {paste ? (
          <div className="flex flex-col gap-2">
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder={'{"contributions":[{"date":"2026-03-14","count":7}, …]}'} aria-label="Calendar data" className="font-mono text-[11px]" data-testid="island-paste" />
            <p className="text-[11.5px] text-muted-foreground">Paste the JSON from that service, the answer to GitHub's GraphQL contribution calendar, or lines like <code>2026-03-14 7</code>. Nothing is sent anywhere.</p>
            <div className="flex gap-2"><Button variant="glass" size="sm" onClick={() => { if (fromPasted(text, name)) setPaste(false) }} disabled={!text.trim()} data-testid="island-use">Use this</Button><Button variant="ghost" size="sm" onClick={() => setPaste(false)}>Cancel</Button></div>
          </div>
        ) : <Button variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={() => setPaste(true)} data-testid="island-paste-open"><ClipboardPaste /> Paste the data instead</Button>}
        {info && mood && (
          <div className="flex flex-col gap-3 border-t border-border/60 pt-3" data-testid="island-result">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px] sm:grid-cols-4">
              <Stat label="Contributions" value={info.total.toLocaleString("en-GB")} />
              <Stat label="Busy days" value={`${info.active} of ${st.cal!.days.length}`} />
              <Stat label="Longest run" value={`${info.streak} day${info.streak === 1 ? "" : "s"}`} />
              <Stat label="Busiest day" value={info.busiest ? `${info.busiest.count} · ${fmt(info.busiest.date)}` : "none"} />
            </div>
            <p className="text-[12.5px]"><span className="font-medium">{mood.name}.</span> <span className="text-muted-foreground">{fmt(info.from)} to {fmt(info.to)}, read from {st.from === "service" ? SERVICE : "the data you pasted"}.</span></p>
            <Segmented label="Shape" value={st.shape} options={[{ value: "banner", label: "Banner" }, { value: "square", label: "Square" }]} onChange={(v) => { set({ shape: v }); build(st.cal!, v) }} />
            <div className="flex flex-wrap gap-2">
              <Button className="glass-primary" onClick={() => void save()} disabled={saving !== null} data-testid="island-save"><Download />{saving === null ? `Save ${SHAPES[st.shape].label}` : `${Math.round(saving * 100)}%`}</Button>
              <Button variant="glass" onClick={() => void copy()} data-testid="island-link"><Link />{copied ? "Copied" : "Copy link"}</Button>
              <Button variant="ghost" onClick={() => set({ open: false })}>Edit the world</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
const Stat = ({ label, value }: { label: string; value: string }) => <div className="flex flex-col"><span className="text-[10.5px] tracking-wide text-muted-foreground uppercase">{label}</span><span className="font-medium tabular-nums">{value}</span></div>

export const githubIsland: FeatureCode = {
  run: () => set({ open: true, note: "" }),
  Overlay: Island,
  boot: (q) => { const u = q.get("github"); if (u !== null) { set({ open: true }); if (u.trim()) void fetchYear(u) } },
}
// test handle
;(window as any).__island = { get: () => s, set, fetchYear, fromPasted }
