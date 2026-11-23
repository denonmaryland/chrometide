import * as React from "react"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { duplicateThing, edit, editThing, get, loadFromHash, patch, redo, removeThing, rollDice, undo, useApp } from "@/store"

import { FEATURES, preloadFeatures } from "./features"
import { AppSidebar } from "./ui/AppSidebar"
import { Inspector } from "./ui/Inspector"
import { useSheet } from "./ui/sheet"
import { TopBar } from "./ui/TopBar"
import { Viewport } from "./ui/Viewport"

// not needed for the first picture: these load when first opened, or quietly once the page is up
const later = {
  find: () => import("./ui/CommandBar"), cover: () => import("./ui/Design"), loop: () => import("./ui/Loop"), timeline: () => import("./ui/Timeline"),
}
const CommandBar = React.lazy(() => later.find().then((m) => ({ default: m.CommandBar })))
const DesignDialog = React.lazy(() => later.cover().then((m) => ({ default: m.DesignDialog })))
const LoopDialog = React.lazy(() => later.loop().then((m) => ({ default: m.LoopDialog })))
const Timeline = React.lazy(() => later.timeline().then((m) => ({ default: m.Timeline })))
/** Mounted from the first time it is wanted (or once its code has quietly arrived), and kept mounted
 *  after, so a dialog opens at once and can animate shut. */
function Later({ when, children }: { when: boolean; children: React.ReactNode }) {
  const [seen, setSeen] = React.useState(when); if (when && !seen) setSeen(true)
  return seen ? <React.Suspense fallback={null}>{children}</React.Suspense> : null
}

export function App() {
  const sky = useApp((s) => s.world.sky), timeline = useApp((s) => s.timeline), dialog = useApp((s) => s.dialog); const sheet = useSheet(), [warm, setWarm] = React.useState(false)
  React.useEffect(() => { // once the page is up and quiet, fetch the rest so nothing waits later
    const go = () => { void preloadFeatures(); void Promise.all(Object.values(later).map((f) => f())).then(() => setWarm(true), () => {}) }
    const id = "requestIdleCallback" in window ? requestIdleCallback(go, { timeout: 4000 }) : setTimeout(go, 2500)
    return () => { if ("cancelIdleCallback" in window) cancelIdleCallback(id as number); else clearTimeout(id as number) }
  }, [])
  React.useEffect(() => { void loadFromHash(); const q = new URLSearchParams(location.search); for (const f of FEATURES) f.boot?.(q) }, [])
  React.useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null; const typing = !!el && (/INPUT|TEXTAREA|SELECT/.test(el.tagName) || el.isContentEditable)
      const mod = e.metaKey || e.ctrlKey, s = get()
      if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); patch({ dialog: "find" }); return }
      if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return }
      if (typing || s.dialog) return
      if (e.key === "/") { e.preventDefault(); patch({ dialog: "find" }) }
      else if (e.key === " ") { e.preventDefault(); rollDice() }
      else if (s.sel.type === "thing") { const id = s.sel.id
        if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeThing(id) }
        else if (mod && e.key.toLowerCase() === "d") { e.preventDefault(); duplicateThing(id) }
        else if (e.key.startsWith("Arrow")) { e.preventDefault(); const k = e.shiftKey ? 1 : 0.25; editThing(id, "nudge", (t) => { if (e.key === "ArrowLeft") t.pos[0] -= k; if (e.key === "ArrowRight") t.pos[0] += k; if (e.key === "ArrowUp") t.pos[e.altKey ? 1 : 2] += e.altKey ? k : -k; if (e.key === "ArrowDown") t.pos[e.altKey ? 1 : 2] += e.altKey ? -k : k }) }
        else if (e.key === "Escape") patch({ sel: { type: "sky" } }) }
      else if (/^[1-7]$/.test(e.key)) { const i = +e.key - 1, v = s.world.views[i]; if (e.shiftKey || !v) edit("view-save" + i, (w) => { w.views[i] = { ...w.cam } }); else edit("view-go" + i, (w) => { w.cam = { ...v } }) }
    }
    addEventListener("keydown", key); return () => removeEventListener("keydown", key)
  }, [])
  // the room takes a breath of the world's own sky: a faint wash behind the glass
  const wash = { background: `radial-gradient(1200px 700px at 70% -10%, color-mix(in oklch, ${sky.horizon} 16%, transparent), transparent 70%), radial-gradient(900px 600px at 0% 100%, color-mix(in oklch, ${sky.zenith} 14%, transparent), transparent 70%)` }
  return (
    <TooltipProvider delay={350}>
      <SidebarProvider style={{ "--sidebar-width": "17rem" } as React.CSSProperties}>
        <AppSidebar />
        <SidebarInset className="h-dvh min-w-0 overflow-hidden" style={wash}>
          <TopBar />
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <div className="flex min-h-0 min-w-0 flex-1 flex-col"><Viewport />{timeline && <React.Suspense fallback={null}><Timeline /></React.Suspense>}</div>
            {/* beside the picture on a wide screen; on a phone, a sheet under it that the dock's Edit button opens */}
            <div className={cn("shrink-0 p-2 pt-0 md:h-full md:w-[19.5rem] md:pl-0", sheet ? "h-[48dvh]" : "h-0 overflow-hidden p-0 md:overflow-visible md:p-2 md:pt-0")}><Inspector /></div>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Later when={warm || dialog === "find"}><CommandBar /></Later><Later when={warm || dialog === "cover"}><DesignDialog /></Later><Later when={warm || dialog === "loop"}><LoopDialog /></Later>
      {FEATURES.map((f) => (f.Overlay ? <f.Overlay key={f.id} /> : null))}
    </TooltipProvider>
  )
}
