// One small store for the whole app: the world, what is selected, undo history, saved worlds.
import * as React from "react"

import type { Engine, Status } from "./engine/engine"
import { type DesignOpts, designOpts } from "./design/layouts"
import { at, keyAt, newAnim, pose } from "./engine/anim"
import { type LockKey, type Thing, type World, STARTERS, clone, decodeWorld, encodeWorld, newId, roll } from "./engine/scene"

export type Sel = { type: "sky" | "sea" | "land" | "title" | "camera" | "picture" | "sound" } | { type: "thing"; id: string }
export interface Saved { id: string; name: string; code: string; thumb: string; at: number }
export interface State {
  world: World; sel: Sel; locks: LockKey[]; past: World[]; future: World[]
  quality: number; status: Status; saved: Saved[]; sculpt: { tool: "off" | "raise" | "lower" | "smooth" | "erode"; size: number }
  wires: boolean; mask: number; dialog: null | "cover" | "loop" | "find" | "gallery"; rolls: number
  playhead: number; playing: boolean; timeline: boolean; phase: number | null
  /** the music: what is loaded, whether it is sounding, and whether the picture is following it */
  /** the words and layout of the design being made (cover, flyer, …) */
  design: DesignOpts
  song: { name: string; duration: number; bpm: number; beats: number } | null; sounding: boolean; mic: boolean
}
const KEY = "untitled-worlds:saved"
const loadSaved = (): Saved[] => { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]") } catch { return [] } }

let state: State = {
  world: STARTERS[0](), sel: { type: "sky" }, locks: [], past: [], future: [], quality: 1,
  status: { phase: "blocks", samples: 0, target: 16 }, saved: loadSaved(), sculpt: { tool: "off", size: 0.12 },
  wires: true, mask: 0, dialog: null, rolls: 0, playhead: 0, playing: false, timeline: false, phase: null, song: null, sounding: false, mic: false, design: designOpts({ format: "cd" }),
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
/** Told of every change to the world, with its label (the time-lapse keeps a record this way). */
export const worldTaps = new Set<(w: World, label: string) => void>()
const tap = (label: string) => worldTaps.forEach((f) => f(state.world, label))
/** Change the world. Changes with the same label within a moment count as one step of undo. */
export function edit(label: string, fn: (w: World) => void) {
  const now = Date.now(), fresh = label !== lastLabel || now - lastAt > 700
  const next = clone(state.world); fn(next)
  // editing while the playhead sits on a key changes that key
  const ki = keyAt(next.anim, state.playhead); if (ki >= 0 && !label.startsWith("anim")) next.anim!.keys[ki].pose = pose(next)
  state = { ...state, world: next, past: fresh ? [...state.past.slice(-80), state.world] : state.past, future: [] }
  lastLabel = label; lastAt = now; emit(); tap(label)
}
export function replaceWorld(w: World, label = "replace") { lastLabel = label; lastAt = 0; state = { ...state, world: w, past: [...state.past.slice(-80), state.world], future: [], sel: { type: "sky" } }; emit(); tap(label) }
export function undo() { const p = state.past.at(-1); if (!p) return; lastAt = 0; state = { ...state, world: p, past: state.past.slice(0, -1), future: [state.world, ...state.future] }; emit(); tap("undo") }
export function redo() { const f = state.future[0]; if (!f) return; lastAt = 0; state = { ...state, world: f, past: [...state.past, state.world], future: state.future.slice(1) }; emit(); tap("redo") }

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
  state = { ...state, world: w, past: [...state.past.slice(-80), state.world], future: [], rolls: state.rolls + 1, sel: state.sel.type === "thing" ? { type: "sky" } : state.sel }; emit(); tap("dice")
}

// ---------- links and the shelf of saved worlds ----------
export async function shareLink(): Promise<string> { return `${location.origin}${location.pathname}#w=${await encodeWorld(state.world)}` }
export async function loadFromHash(): Promise<boolean> {
  const m = /^#w=(.+)$/.exec(location.hash); if (!m) return false
  const w0 = await decodeWorld(m[1]); if (!w0) return false
  const w = await (await import("./text")).prepare(w0)
  w.remixOf = w.remixOf ?? w.name; state = { ...state, world: w, past: [], future: [] }; emit(); tap("open"); history.replaceState(null, "", location.pathname + location.search); return true
}
// ---------- the timeline ----------
export function seek(t: number) { t = Math.min(1, Math.max(0, t)); const w = state.world; state = { ...state, playhead: t, world: w.anim && w.anim.keys.length ? at(w, t) : w }; emit() }
export function addKey() { const t = state.playhead; edit("anim-key", (w) => { const an = (w.anim ??= newAnim()); const i = keyAt(an, t); const k = { t, pose: pose(w) }; if (i >= 0) an.keys[i] = k; else an.keys.push(k); an.keys.sort((a, b) => a.t - b.t) }) }
export function removeKey(i: number) { edit("anim-unkey", (w) => { w.anim?.keys.splice(i, 1) }) }

/** Play the loop moves (rise, wave, bob, spin) once in the picture, then put everything back. */
let movesRun = 0
export function previewMoves(seconds = 4) { const id = ++movesRun, t0 = performance.now(); const tick = (now: number) => { if (id !== movesRun) return; const k = (now - t0) / 1000 / seconds; if (k >= 1) { patch({ phase: null }); return } patch({ phase: k }); requestAnimationFrame(tick) }; requestAnimationFrame(tick) }

export async function saveToShelf() {
  if (!engine) return
  const w = state.world, item: Saved = { id: newId(), name: w.name, code: await encodeWorld(w, true), thumb: engine.thumb(w, 192, 144), at: Date.now() }
  const saved = [item, ...state.saved.filter((s) => s.name !== w.name)].slice(0, 40)
  try { localStorage.setItem(KEY, JSON.stringify(saved)) } catch { /* storage full or blocked: keep it for this visit only */ }
  patch({ saved })
}
export function dropFromShelf(id: string) { const saved = state.saved.filter((s) => s.id !== id); try { localStorage.setItem(KEY, JSON.stringify(saved)) } catch { /* ignore */ } patch({ saved }) }
export async function openSaved(s: Saved) { const w = await decodeWorld(s.code); if (w) replaceWorld(await (await import("./text")).prepare(w), "open") }
