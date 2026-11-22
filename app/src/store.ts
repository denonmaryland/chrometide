// One small store for the whole app: the world, what is selected, undo history, saved worlds.
import * as React from "react"

import type { Engine, Status } from "./engine/engine"
import { type LockKey, type Thing, type World, STARTERS, clone, decodeWorld, encodeWorld, newId, roll } from "./engine/scene"

export type Sel = { type: "sky" | "sea" | "land" | "title" | "camera" | "picture" } | { type: "thing"; id: string }
export interface Saved { id: string; name: string; code: string; thumb: string; at: number }
export interface State {
  world: World; sel: Sel; locks: LockKey[]; past: World[]; future: World[]
  quality: number; status: Status; saved: Saved[]; sculpt: { tool: "off" | "raise" | "lower" | "smooth"; size: number }
  wires: boolean; mask: number; dialog: null | "cover" | "loop" | "find" | "gallery"; rolls: number
}
const KEY = "untitled-worlds:saved"
const loadSaved = (): Saved[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") } catch { return [] } }

let state: State = {
  world: STARTERS[0](), sel: { type: "sky" }, locks: [], past: [], future: [], quality: 1,
  status: { phase: "blocks", samples: 0, target: 16 }, saved: loadSaved(), sculpt: { tool: "off", size: 0.12 },
  wires: true, mask: 0, dialog: null, rolls: 0,
}
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
export const get = () => state
export function patch(p: Partial<State>) { state = { ...state, ...p }; emit() }
export function useApp<T>(pick: (s: State) => T): T {
  return React.useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => pick(state))
}

export let engine: Engine | null = null
export const setEngine = (e: Engine | null) => { engine = e }

let lastLabel = "", lastAt = 0
/** Change the world. Changes with the same label within a moment count as one step of undo. */
export function edit(label: string, fn: (w: World) => void) {
  const now = Date.now(), fresh = label !== lastLabel || now - lastAt > 700
  const next = clone(state.world); fn(next)
  state = { ...state, world: next, past: fresh ? [...state.past.slice(-80), state.world] : state.past, future: [] }
  lastLabel = label; lastAt = now; emit()
}
export function replaceWorld(w: World, label = "replace") { lastLabel = label; lastAt = 0; state = { ...state, world: w, past: [...state.past.slice(-80), state.world], future: [], sel: { type: "sky" } }; emit() }
export function undo() { const p = state.past.at(-1); if (!p) return; lastAt = 0; state = { ...state, world: p, past: state.past.slice(0, -1), future: [state.world, ...state.future] }; emit() }
export function redo() { const f = state.future[0]; if (!f) return; lastAt = 0; state = { ...state, world: f, past: [...state.past, state.world], future: state.future.slice(1) }; emit() }

export const selectedThing = (s: State): Thing | undefined => (s.sel.type === "thing" ? s.world.things.find((t) => t.id === (s.sel as { id: string }).id) : undefined)
export function editThing(id: string, label: string, fn: (t: Thing) => void) { edit(`${label}:${id}`, (w) => { const t = w.things.find((x) => x.id === id); if (t) fn(t) }) }
export function addThing(t: Thing) { edit("add" + t.id, (w) => { w.things.push(t) }); patch({ sel: { type: "thing", id: t.id } }) }
export function removeThing(id: string) { edit("remove" + id, (w) => { w.things = w.things.filter((t) => t.id !== id) }); patch({ sel: { type: "sky" } }) }
export function duplicateThing(id: string) {
  const src = state.world.things.find((t) => t.id === id); if (!src) return
  const copy = { ...clone(src), id: newId(), name: src.name.replace(/( copy)?$/, " copy"), pos: [src.pos[0] + src.size[0] * 1.4, src.pos[1], src.pos[2] + src.size[2] * 0.6] as Thing["pos"] }
  addThing(copy)
}
export function toggleLock(k: LockKey) { patch({ locks: state.locks.includes(k) ? state.locks.filter((x) => x !== k) : [...state.locks, k] }) }
export function rollDice(only?: LockKey) {
  const w = roll(state.world, new Set(state.locks), only); lastAt = 0
  state = { ...state, world: w, past: [...state.past.slice(-80), state.world], future: [], rolls: state.rolls + 1, sel: state.sel.type === "thing" ? { type: "sky" } : state.sel }; emit()
}

// ---------- links and the shelf of saved worlds ----------
export async function shareLink(): Promise<string> { return `${location.origin}${location.pathname}#w=${await encodeWorld(state.world)}` }
export async function loadFromHash(): Promise<boolean> {
  const m = /^#w=(.+)$/.exec(location.hash); if (!m) return false
  const w = await decodeWorld(m[1]); if (!w) return false
  w.remixOf = w.remixOf ?? w.name; state = { ...state, world: w, past: [], future: [] }; emit(); history.replaceState(null, "", location.pathname + location.search); return true
}
export async function saveToShelf() {
  if (!engine) return
  const w = state.world, item: Saved = { id: newId(), name: w.name, code: await encodeWorld(w), thumb: engine.thumb(w, 192, 144), at: Date.now() }
  const saved = [item, ...state.saved.filter((s) => s.name !== w.name)].slice(0, 40)
  try { localStorage.setItem(KEY, JSON.stringify(saved)) } catch { /* storage full or blocked: keep it for this visit only */ }
  patch({ saved })
}
export function dropFromShelf(id: string) { const saved = state.saved.filter((s) => s.id !== id); try { localStorage.setItem(KEY, JSON.stringify(saved)) } catch { /* ignore */ } patch({ saved }) }
export async function openSaved(s: Saved) { const w = await decodeWorld(s.code); if (w) replaceWorld(w, "open") }
