// The gallery's little pictures, ray traced in the page from each world's code. One renderer,
// one picture at a time, only for cards that have scrolled into view; each one is kept, so
// filtering back and forth does not draw it twice.
import { Engine } from "@/engine/engine"
import { loadFonts } from "@/engine/lettering"
import type { World } from "@/engine/scene"

export const THUMB = { w: 480, h: 360, samples: 8 }
let engine: Engine | null | undefined
const done = new Map<string, string>(), waiting: { key: string; world: World; ok: (url: string | null) => void }[] = []
let busy = false, fonts: Promise<unknown> | null = null

function renderer() {
  if (engine === undefined) { const e = new Engine(document.createElement("canvas")); engine = e.ok ? e : null; e.setWires(false); (window as any).__thumbs = { engine, done } }
  return engine
}

/** A picture of a world, as an image address, or null if this browser cannot draw it. */
export function thumb(key: string, world: World): Promise<string | null> {
  const have = done.get(key); if (have) return Promise.resolve(have)
  return new Promise((ok) => { waiting.push({ key, world, ok }); void pump() })
}

async function pump() {
  if (busy) return; busy = true
  while (waiting.length) {
    const job = waiting.shift()!, have = done.get(job.key); if (have) { job.ok(have); continue }
    const e = renderer(); if (!e) { job.ok(null); continue }
    if (job.world.things.some((t) => t.kind === "text") || job.world.title?.text.trim()) { fonts ??= loadFonts().then(() => e.resetGlyphs()); await fonts }
    try {
      const c = await e.still(job.world, THUMB.w, THUMB.h, THUMB.samples)
      const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.86))
      const url = blob ? URL.createObjectURL(blob) : null; if (url) done.set(job.key, url); job.ok(url)
    } catch { job.ok(null) }
    await new Promise((ok) => setTimeout(ok, 16)) // let the page breathe between pictures
  }
  busy = false
}
