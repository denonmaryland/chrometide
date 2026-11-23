// Find anything: every look, shape, starting world and action, by typing a word.
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { KIND_LABEL, LANDS, MATERIALS, SEAS, SKIES, applySky, clone, seaFrom } from "@/engine/scene"
import { WORLDS } from "@/engine/worlds"
import { edit, editThing, get, patch, redo, replaceWorld, rollDice, saveToShelf, shareLink, undo, useApp } from "@/store"
import { openEmbed } from "@/features/share"

import { FEATURES } from "@/features"

import { ADDABLE, newThing } from "./Viewport"

export function CommandBar() {
  const open = useApp((s) => s.dialog === "find"); const sel = useApp((s) => s.sel)
  const run = (fn: () => void) => () => { patch({ dialog: null }); fn() }
  return (
    <CommandDialog open={open} onOpenChange={(o) => patch({ dialog: o ? "find" : null })} title="Find anything" description="Search looks, shapes, worlds and actions">
      <Command>
      <CommandInput placeholder="Try dusk, chrome, lagoon, ring, roll…" />
      <CommandList>
        <CommandEmpty>Nothing by that name. Try “dusk” or “chrome”.</CommandEmpty>
        {FEATURES.some((f) => f.run) && <CommandGroup heading="Modes">{FEATURES.filter((f) => f.run).map((f) => <CommandItem key={f.id} onSelect={run(f.run!)}>{f.label}: {f.about}</CommandItem>)}</CommandGroup>}
        <CommandGroup heading="Do">
          <CommandItem onSelect={run(() => rollDice())}>Roll a new world</CommandItem>
          <CommandItem onSelect={run(() => rollDice("sky"))}>Roll only the sky</CommandItem>
          <CommandItem onSelect={run(() => rollDice("things"))}>Roll only the things</CommandItem>
          <CommandItem onSelect={run(() => edit("dusk", (w) => { const l = SKIES[2]; Object.assign(w.sky, { zenith: l.zenith, horizon: l.horizon, haze: l.haze, sunColor: l.sunColor, cloudColor: l.cloudColor, stars: 0 }); w.sky.sun.el = 0.13 }))}>Make it dusk</CommandItem>
          <CommandItem onSelect={run(() => edit("noon", (w) => { w.sky.sun.el = 1.1 }))}>Make it noon</CommandItem>
          <CommandItem onSelect={run(() => patch({ dialog: "cover" }))}>Make a cover, flyer, poster or postcard</CommandItem>
          <CommandItem onSelect={run(() => patch({ dialog: "loop" }))}>Make a loop video</CommandItem>
          <CommandItem onSelect={run(() => patch({ timeline: true }))}>Animate on a timeline</CommandItem>
          <CommandItem onSelect={run(() => void saveToShelf())}>Add this world to My worlds</CommandItem>
          <CommandItem onSelect={run(() => void shareLink().then((u) => { history.replaceState(null, "", u); return navigator.clipboard.writeText(u) }).catch(() => {}))}>Copy a link to this world</CommandItem>
          <CommandItem onSelect={run(openEmbed)}>Put this world on a web page</CommandItem>
          <CommandItem onSelect={run(undo)}>Undo</CommandItem>
          <CommandItem onSelect={run(redo)}>Redo</CommandItem>
        </CommandGroup>
        <CommandGroup heading="Add a thing">{ADDABLE.map((k) => <CommandItem key={k} onSelect={run(() => newThing(k))}>Add a {KIND_LABEL[k].toLowerCase()}</CommandItem>)}</CommandGroup>
        <CommandGroup heading="Sky">{SKIES.map((l) => <CommandItem key={l.name} onSelect={run(() => edit("sky-look", (w) => applySky(w.sky, l)))}>Sky: {l.name}</CommandItem>)}</CommandGroup>
        <CommandGroup heading="Sea & floor">{SEAS.map((l) => <CommandItem key={l.name} onSelect={run(() => edit("sea-look", (w) => { w.sea = seaFrom(l, { wave: w.sea.wave, grain: w.sea.grain }) }))}>Sea: {l.name}</CommandItem>)}</CommandGroup>
        <CommandGroup heading="Land">{LANDS.map((l) => <CommandItem key={l.name} onSelect={run(() => edit("land-look", (w) => Object.assign(w.land, { c1: l.c1, c2: l.c2, c3: l.c3, snow: l.snow, on: true })))}>Land: {l.name}</CommandItem>)}</CommandGroup>
        <CommandGroup heading={sel.type === "thing" ? "Material for the selected thing" : "Material for every thing"}>{MATERIALS.map((m) => <CommandItem key={m.name} onSelect={run(() => { const s = get().sel
          if (s.type === "thing") editThing(s.id, "mat", (t) => { t.mat = clone(m) }); else edit("mat-all", (w) => w.things.forEach((t) => { t.mat = clone(m) })) })}>Material: {m.name}</CommandItem>)}</CommandGroup>
        <CommandGroup heading="Start from">{WORLDS.map((x) => <CommandItem key={x.name} onSelect={run(() => replaceWorld(x.make(), "starter"))}>World: {x.name}</CommandItem>)}</CommandGroup>
      </CommandList>
      </Command>
    </CommandDialog>
  )
}
