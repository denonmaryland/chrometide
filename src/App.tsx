import * as React from "react"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { duplicateThing, edit, editThing, get, loadFromHash, patch, redo, removeThing, rollDice, undo, useApp } from "@/store"

import { FEATURES } from "./features"
import { AppSidebar } from "./ui/AppSidebar"
import { CommandBar } from "./ui/CommandBar"
import { DesignDialog } from "./ui/Design"
import { Inspector } from "./ui/Inspector"
import { LoopDialog } from "./ui/Loop"
import { Timeline } from "./ui/Timeline"
import { useSheet } from "./ui/sheet"
import { TopBar } from "./ui/TopBar"
import { Viewport } from "./ui/Viewport"

export function App() {
  const sky = useApp((s) => s.world.sky), timeline = useApp((s) => s.timeline); const sheet = useSheet()
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
            <div className="flex min-h-0 min-w-0 flex-1 flex-col"><Viewport />{timeline && <Timeline />}</div>
            {/* beside the picture on a wide screen; on a phone, a sheet under it that the dock's Edit button opens */}
            <div className={cn("shrink-0 p-2 pt-0 md:h-full md:w-[19.5rem] md:pl-0", sheet ? "h-[48dvh]" : "h-0 overflow-hidden p-0 md:overflow-visible md:p-2 md:pt-0")}><Inspector /></div>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <CommandBar /><DesignDialog /><LoopDialog />
      {FEATURES.map((f) => (f.Overlay ? <f.Overlay key={f.id} /> : null))}
    </TooltipProvider>
  )
}
