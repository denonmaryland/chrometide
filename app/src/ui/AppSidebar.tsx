// The left sidebar: the parts of this world, its things, and worlds to start from.
import * as React from "react"
import { Aperture, BookmarkPlus, Camera, Eye, EyeOff, Image, Lock, LockOpen, Mountain, Plus, Sun, Type, Waves, X } from "lucide-react"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupAction, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuAction,
  SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from "@/components/ui/sidebar"
import { type LockKey, type World, KINDS, KIND_LABEL, STARTERS } from "@/engine/scene"
import { type Sel, dropFromShelf, editThing, engine, openSaved, patch, replaceWorld, saveToShelf, toggleLock, useApp } from "@/store"

import { KIND_ICON, newThing } from "./Viewport"

const PARTS: { type: Exclude<Sel["type"], "thing">; label: string; icon: React.ComponentType<{ className?: string }>; lock?: LockKey }[] = [
  { type: "sky", label: "Sky", icon: Sun, lock: "sky" }, { type: "sea", label: "Sea & floor", icon: Waves, lock: "sea" }, { type: "land", label: "Land", icon: Mountain, lock: "land" },
  { type: "title", label: "Lettering", icon: Type }, { type: "camera", label: "Camera", icon: Camera, lock: "camera" }, { type: "picture", label: "Picture", icon: Image },
]
const starters: World[] = STARTERS.map((f) => f())

function Thumb({ world }: { world: World }) {
  const [src, setSrc] = React.useState<string>()
  React.useEffect(() => { let live = true; const go = () => { if (!live) return; if (!engine) { setTimeout(go, 150); return } setSrc(engine.thumb(world, 128, 96)) }; const id = setTimeout(go, 400 + starters.indexOf(world) * 60); return () => { live = false; clearTimeout(id) } }, [world])
  return <span className="block aspect-[4/3] w-full overflow-hidden rounded-md bg-muted ring-1 ring-border">{src && <img src={src} alt="" className="size-full object-cover" />}</span>
}

export function AppSidebar() {
  const sel = useApp((s) => s.sel), things = useApp((s) => s.world.things), locks = useApp((s) => s.locks), saved = useApp((s) => s.saved)
  const sky = useApp((s) => s.world.sky), sea = useApp((s) => s.world.sea)
  const dot = (type: string) => type === "sky" ? `linear-gradient(${sky.zenith}, ${sky.horizon})` : type === "sea" ? `linear-gradient(${sea.c2}, ${sea.c1})` : undefined
  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader>
        <div className="flex h-8 items-center gap-2 px-1.5">
          <span className="grid size-6 shrink-0 place-items-center rounded-md" style={{ background: `linear-gradient(${sky.zenith}, ${sky.horizon})` }}><Aperture className="size-3.5 text-white mix-blend-overlay" /></span>
          <span className="font-mark truncate text-[17px] leading-none group-data-[collapsible=icon]:hidden">Untitled Worlds</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>This world</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>
            {PARTS.map((p) => { const on = p.lock && locks.includes(p.lock); return (
              <SidebarMenuItem key={p.type}>
                <SidebarMenuButton isActive={sel.type === p.type} tooltip={p.label} onClick={() => patch({ sel: { type: p.type } })} data-testid={`part-${p.type}`}>
                  <p.icon /><span>{p.label}</span>
                  {dot(p.type) && <span className="ml-auto mr-6 size-3 rounded-full ring-1 ring-border group-data-[collapsible=icon]:hidden" style={{ background: dot(p.type) }} />}
                </SidebarMenuButton>
                {p.lock && <SidebarMenuAction showOnHover={!on} onClick={() => toggleLock(p.lock!)} aria-label={on ? `Unlock ${p.label}` : `Keep ${p.label} when rolling`} title={on ? "Kept when you roll the dice" : "Keep when you roll the dice"}>{on ? <Lock /> : <LockOpen />}</SidebarMenuAction>}
              </SidebarMenuItem>) })}
          </SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Things <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{things.length}/20</span></SidebarGroupLabel>
          <DropdownMenu>
            <DropdownMenuTrigger render={<SidebarGroupAction aria-label="Add a thing" />}><Plus /></DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-44">{KINDS.map((k) => { const I = KIND_ICON[k]; return <DropdownMenuItem key={k} onClick={() => newThing(k)}><I className="size-4" /> {KIND_LABEL[k]}</DropdownMenuItem> })}</DropdownMenuContent>
          </DropdownMenu>
          <SidebarGroupContent><SidebarMenu>
            {things.length === 0 && <p className="px-2 py-1 text-[12px] text-muted-foreground group-data-[collapsible=icon]:hidden">Nothing floating here yet. Press + to add a shape.</p>}
            {things.map((t) => { const I = KIND_ICON[t.kind]; return (
              <SidebarMenuItem key={t.id}>
                <SidebarMenuButton size="sm" isActive={sel.type === "thing" && sel.id === t.id} tooltip={t.name} onClick={() => patch({ sel: { type: "thing", id: t.id } })} className={t.hidden ? "opacity-50" : ""}>
                  <I /><span className="truncate">{t.name}</span>{t.role !== "solid" && <span className="ml-1 rounded-sm bg-muted px-1 text-[10px] text-muted-foreground">{t.role === "cut" ? "cuts" : "overlap"}</span>}
                  <span className="ml-auto mr-6 size-2.5 shrink-0 rounded-full ring-1 ring-border" style={{ background: t.mat.color }} />
                </SidebarMenuButton>
                <SidebarMenuAction showOnHover={!t.hidden} onClick={() => editThing(t.id, "hide", (k) => { k.hidden = !k.hidden })} aria-label={t.hidden ? `Show ${t.name}` : `Hide ${t.name}`}>{t.hidden ? <EyeOff /> : <Eye />}</SidebarMenuAction>
              </SidebarMenuItem>) })}
          </SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Start from</SidebarGroupLabel>
          <SidebarGroupContent><div className="grid grid-cols-2 gap-2 px-2">
            {starters.map((w, i) => (
              <button key={w.name} onClick={() => replaceWorld(STARTERS[i](), "starter")} className="group/st text-left" data-testid={`starter-${i}`}>
                <span className="block transition-transform group-hover/st:scale-[1.03] group-active/st:scale-[.98]"><Thumb world={w} /></span>
                <span className="mt-1 block truncate text-[11.5px] text-muted-foreground group-hover/st:text-foreground">{w.name}</span>
              </button>))}
          </div></SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>My worlds</SidebarGroupLabel>
          <SidebarGroupAction aria-label="Keep this world" title="Keep this world on this device" onClick={() => void saveToShelf()}><BookmarkPlus /></SidebarGroupAction>
          <SidebarGroupContent>
            {saved.length === 0 ? <p className="px-2 py-1 text-[12px] text-muted-foreground">Worlds you keep show up here. They stay on this device.</p> : (
              <div className="grid grid-cols-2 gap-2 px-2">{saved.map((s) => (
                <div key={s.id} className="group/sv relative">
                  <button onClick={() => void openSaved(s)} className="block w-full text-left"><img src={s.thumb} alt="" className="aspect-[4/3] w-full rounded-md object-cover ring-1 ring-border" /><span className="mt-1 block truncate text-[11.5px] text-muted-foreground">{s.name}</span></button>
                  <button onClick={() => dropFromShelf(s.id)} aria-label={`Remove ${s.name}`} className="absolute top-1 right-1 hidden size-5 place-items-center rounded-full bg-black/60 text-white group-hover/sv:grid"><X className="size-3" /></button>
                </div>))}</div>)}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter><p className="px-2 pb-1 text-[11px] leading-snug text-muted-foreground group-data-[collapsible=icon]:hidden">Drag the picture to look around. Drag a thing to move it. Drag the sun.</p></SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
