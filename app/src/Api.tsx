// The app without its interface: opened as "?api=1" by the MCP server (work/mcp), which lets an
// agent build worlds and have them ray traced. Everything goes in and out as plain data.
import * as React from "react"

import { Engine } from "./engine/engine"
import { FONTS, loadFonts, textAspect } from "./engine/lettering"
import {
  type Kind, type LockKey, type Material, type Thing, type Vec3, type World,
  FRAMES, KINDS, LANDS, MATERIALS, SEAS, SKIES, TEXTURES, applySky, blankWorld, clone, decodeWorld, encodeWorld, landFrom, mat, newId, roll, seaFrom, textSpec, thing,
} from "./engine/scene"
import { WORLDS } from "./engine/worlds"

const v3 = (v: unknown, d: Vec3): Vec3 => (Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number" && isFinite(n)) ? (v as Vec3) : typeof v === "number" ? [v, v, v] : d)
function material(m: unknown): Material {
  if (typeof m === "string") return mat(m)
  const o = (m ?? {}) as Partial<Material> & { base?: string }
  return { ...mat(o.base ?? o.name ?? "Chrome"), ...o, name: o.name ?? o.base ?? "Custom" }
}
function makeThing(o: any): Thing {
  const kind: Kind = KINDS.includes(o.kind) && o.kind !== "model" ? o.kind : "sphere"
  if (kind === "text") { const str = String(o.text ?? "HELLO").toUpperCase().slice(0, 120), spec = textSpec(str, { font: o.font, style: o.style, edge: o.edge, bend: o.bend, arch: o.arch, motion: o.motion }), h = (typeof o.height === "number" ? o.height : 2.5) / 2
    Object.keys(spec).forEach((k) => (spec as any)[k] === undefined && delete (spec as any)[k]); const full = textSpec(str, spec)
    return { ...thing("text", v3(o.position, [0, h + 0.3, 4]), [h * textAspect(str, full.font), h, typeof o.depth === "number" ? o.depth / 2 : Math.max(0.08, h * 0.28)], material(o.material), { name: String(o.name ?? str).slice(0, 40), round: 0, text: full }), rot: v3(o.rotation, [0, 0, 0]), role: o.role ?? "solid", group: o.group ?? 0, id: newId() } }
  const t = thing(kind, v3(o.position, [0, 2, 0]), v3(o.size, [1, 1, 1]), material(o.material), { name: String(o.name ?? kind).slice(0, 40) })
  if (o.rotation) t.rot = v3(o.rotation, [0, 0, 0]); if (o.role) t.role = o.role; if (typeof o.group === "number") t.group = o.group
  for (const k of ["round", "bob", "spin", "beam", "eq"] as const) if (typeof o[k] === "number") (t as any)[k] = o[k]
  return t
}
/** Keep a world inside what the renderer can draw, whatever was sent. */
function tidy(w: World): World {
  const base = blankWorld(), out = { ...base, ...w, v: 2 as const }
  out.sky = { ...base.sky, ...w.sky, sun: { ...base.sky.sun, ...w.sky?.sun } }; out.sea = { ...base.sea, ...w.sea }; out.land = { ...base.land, ...w.land }; out.cam = { ...base.cam, ...w.cam }; out.frame = { ...base.frame, ...w.frame }
  out.things = (Array.isArray(w.things) ? w.things : []).filter((t) => t && KINDS.includes(t.kind)).slice(0, 20).map((t) => ({ ...makeThing({ kind: t.kind }), ...t, mat: { ...mat("Chrome"), ...t.mat }, id: t.id || newId() }))
  out.things.forEach((t) => { if (t.kind === "text" && t.text) t.size[0] = t.size[1] * textAspect(t.text.str, t.text.font) })
  return out
}

export function Api() {
  const ref = React.useRef<HTMLCanvasElement>(null)
  React.useEffect(() => {
    const e = new Engine(ref.current!); e.pause(true)
    const api = {
      ok: e.ok, error: e.error,
      presets: () => ({ worlds: WORLDS.map((w) => ({ name: w.name, group: w.group })), skies: SKIES.map((s) => s.name), seas: SEAS.map((s) => `${s.name} (${s.kind})`), lands: LANDS.map((l) => l.name), materials: MATERIALS.map((m) => m.name),
        shapes: KINDS.filter((k) => k !== "model"), patterns: [...TEXTURES], fonts: FONTS.filter((f) => f.id !== "custom").map((f) => f.id), frames: FRAMES.map((f) => `${f.name}`) }),
      starter: (name: string) => { const w = WORLDS.find((x) => x.name.toLowerCase() === String(name).toLowerCase()); return w ? w.make() : null },
      blank: () => blankWorld(), tidy,
      decode: async (code: string) => { const w = await decodeWorld(code.replace(/^.*#w=/, "")); return w ? tidy(w) : null },
      encode: (w: World) => encodeWorld(tidy(w)),
      sky: (w: World, look: string, over: object) => { const n = clone(tidy(w)), l = SKIES.find((s) => s.name.toLowerCase() === String(look).toLowerCase()); if (!l) return null; applySky(n.sky, l); Object.assign(n.sky, over ?? {}); return n },
      sea: (w: World, look: string, over: object) => { const n = clone(tidy(w)), l = SEAS.find((s) => s.name.toLowerCase() === String(look).toLowerCase()); if (!l) return null; n.sea = { ...seaFrom(l, { wave: n.sea.wave, grain: n.sea.grain, scale: n.sea.scale }), ...(over ?? {}) }; return n },
      land: (w: World, look: string, over: object) => { const n = clone(tidy(w)), l = LANDS.find((s) => s.name.toLowerCase() === String(look).toLowerCase()); if (!l) return null; n.land = { ...landFrom(l, { ...n.land, c1: l.c1, c2: l.c2, c3: l.c3, snow: l.snow, on: true }), ...(over ?? {}) }; return n },
      thing: makeThing, material,
      roll: (w: World, keep: LockKey[]) => roll(tidy(w), new Set(keep ?? [])),
      render: async (w: World, width: number, height: number, samples: number) => (await e.still(tidy(w), width, height, samples)).toDataURL("image/png"),
    }
    void loadFonts().then(() => { (window as any).__api = api })
    return () => e.dispose()
  }, [])
  return <canvas ref={ref} width={16} height={16} />
}
