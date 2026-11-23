// The one place short messages appear (see src/notice.ts), and the calm page shown if the
// interface itself falls over.
import * as React from "react"
import { X } from "lucide-react"

import { type Notice, dismiss, notices, onNotices } from "@/notice"

function Item({ n }: { n: Notice }) {
  React.useEffect(() => { if (!n.ms) return; const t = setTimeout(() => dismiss(n.id), n.ms); return () => clearTimeout(t) }, [n.id, n.ms])
  return (
    <div role="status" className="glass-panel pointer-events-auto flex max-w-[min(92vw,30rem)] items-center gap-2 rounded-lg py-1.5 pr-1.5 pl-3.5 text-[13px]" data-testid="notice">
      <span className="min-w-0 flex-1 break-words">{n.text}</span>
      {n.action && <button className="shrink-0 rounded-md bg-foreground/10 px-2 py-1 text-[12.5px] font-medium hover:bg-foreground/20" onClick={() => { dismiss(n.id); n.action!.run() }}>{n.action.label}</button>}
      <button className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-foreground/10" onClick={() => dismiss(n.id)} aria-label="Close message"><X className="size-3.5" /></button>
    </div>
  )
}
export function Notices() {
  const list = React.useSyncExternalStore(onNotices, notices)
  if (!list.length) return null
  return <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-1.5 px-3" aria-live="polite">{list.map((n) => <Item key={n.id} n={n} />)}</div>
}

/** A whole page saying what happened and what to try, for when the app cannot carry on. */
export function Trouble({ title, children, actions }: { title: string; children?: React.ReactNode; actions?: { label: string; run: () => void }[] }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-background p-6 text-foreground" data-testid="trouble">
      <div className="glass-panel flex max-w-md flex-col gap-3 rounded-xl p-6 text-[14px] leading-relaxed">
        <h1 className="text-[17px] font-semibold">{title}</h1>
        <div className="text-muted-foreground">{children}</div>
        {actions && <div className="flex flex-wrap gap-2 pt-1">{actions.map((a, i) => <button key={a.label} onClick={a.run} className={i === 0 ? "glass-primary rounded-md px-3 py-1.5 text-[13px] font-medium text-primary-foreground" : "rounded-md bg-foreground/10 px-3 py-1.5 text-[13px] hover:bg-foreground/20"}>{a.label}</button>)}</div>}
      </div>
    </div>
  )
}
const startFresh = () => { try { history.replaceState(null, "", location.pathname) } catch { /* ignore */ } location.reload() }
/** Catches a fall in the interface, so the page never goes blank. */
export class Safety extends React.Component<{ children: React.ReactNode }, { err: string | null }> {
  state = { err: null as string | null }
  static getDerivedStateFromError(e: unknown) { return { err: String((e as Error)?.message ?? e).slice(0, 200) } }
  componentDidCatch(e: unknown) { console.warn("The interface stopped:", e) }
  render() {
    if (!this.state.err) return this.props.children
    return <Trouble title="Something went wrong on this page" actions={[{ label: "Try again", run: () => this.setState({ err: null }) }, { label: "Start fresh", run: startFresh }]}>
      <p>Part of the app stopped working. Your saved worlds are safe. Try again, or start fresh with a new world.</p>
      <p className="mt-2 text-[12px] opacity-70">Details: {this.state.err}</p>
    </Trouble>
  }
}
