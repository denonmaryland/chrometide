// Lettering. A piece of text is drawn once into a small grey picture where every dot holds its
// distance to the nearest letter edge. The ray tracer reads that picture to build real 3D letters:
// solid, outlined or as glowing tubes, bent, bevelled, cut out of other shapes.

export const LW = 768, LH = 256 // one layer of the glyph texture
export const FONTS = [
  { id: "sans", name: "Sans", css: '900 100px "Geist Variable"' },
  { id: "poster", name: "Poster", css: '400 100px "Anton"' },
  { id: "serif", name: "Serif", css: '800 100px "Playfair Display Variable"' },
  { id: "slab", name: "Slab", css: '800 100px "Roboto Slab Variable"' },
  { id: "rounded", name: "Rounded", css: '900 100px "Nunito Variable"' },
  { id: "mono", name: "Mono", css: '700 100px "Geist Mono Variable"' },
  { id: "script", name: "Script", css: '400 100px "Pacifico"' },
  { id: "custom", name: "My font", css: '400 100px "WorldCustomFont"' },
] as const
export type FontId = (typeof FONTS)[number]["id"]
const FALLBACK = ', "Helvetica Neue", "DejaVu Sans", Arial, sans-serif'
export const fontCss = (id: string, px: number) => (FONTS.find((f) => f.id === id) ?? FONTS[0]).css.replace("100px", `${px}px`) + FALLBACK

/** Ask the browser to have every built-in face ready, so the first letters are drawn in the right one. */
export async function loadFonts() { await Promise.all(FONTS.filter((f) => f.id !== "custom").map((f) => document.fonts.load(f.css, "Ag").catch(() => []))) }
let customKey = ""
export async function useCustomFont(dataUrl?: string): Promise<boolean> {
  if (!dataUrl) return false
  if (dataUrl === customKey) return true
  try { const face = new FontFace("WorldCustomFont", `url(${dataUrl})`); await face.load(); for (const f of [...document.fonts]) if (f.family === "WorldCustomFont") document.fonts.delete(f); document.fonts.add(face); customKey = dataUrl; return true } catch { return false }
}

export interface Layout { lines: string[]; px: number; lineH: number; w: number; h: number; widths: number[] }
const measurer = () => { const c = document.createElement("canvas"); return c.getContext("2d", { willReadFrequently: true })! }
/** How the text sits in a layer: size of type, and how much of the layer it uses. */
export function layout(text: string, font: string): Layout {
  const lines = (text || " ").split("\n").slice(0, 3).map((l) => l.slice(0, 40) || " "), ctx = measurer()
  let px = Math.floor((LH / lines.length) * 0.72), widths: number[] = []
  for (let pass = 0; pass < 2; pass++) { ctx.font = fontCss(font, px); widths = lines.map((l) => ctx.measureText(l).width + px * 0.24); const widest = Math.max(...widths); if (widest > LW) px = Math.floor((px * LW) / widest) - 1 }
  const lineH = px / 0.72
  return { lines, px, lineH, w: Math.min(LW, Math.max(...widths)), h: Math.min(LH, lineH * lines.length), widths }
}
/** Width over height of a text as it will stand in the world. */
export const textAspect = (text: string, font: string) => { const l = layout(text, font); return l.w / l.h }
/** Where each character of a one-line text starts and how wide it is, as fractions of the whole width. */
export function charSpans(text: string, font: string): { ch: string; mid: number; width: number }[] {
  const l = layout(text.split("\n")[0], font), ctx = measurer(); ctx.font = fontCss(font, l.px); const pad = l.px * 0.12, out: { ch: string; mid: number; width: number }[] = []
  const chars = [...l.lines[0]]; let acc = ""
  for (const ch of chars) { const a = ctx.measureText(acc).width, b = ctx.measureText(acc + ch).width; acc += ch; if (ch.trim()) out.push({ ch, mid: (pad + (a + b) / 2) / l.w, width: (b - a) / l.w }) }
  return out
}

/** The distance picture for a text: one layer, with how much of it is used. */
export function glyphLayer(text: string, font: string): { data: Uint8Array; uw: number; uh: number } {
  const l = layout(text, font), canvas = document.createElement("canvas"); canvas.width = LW; canvas.height = LH
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!
  ctx.font = fontCss(font, l.px); ctx.fillStyle = "white"; ctx.textBaseline = "alphabetic"; ctx.textAlign = "center"
  const x0 = (LW - l.w) / 2, y0 = (LH - l.h) / 2
  l.lines.forEach((line, i) => ctx.fillText(line, x0 + l.w / 2, y0 + i * l.lineH + l.lineH * 0.76))
  const w = LW, h = LH, pixels = ctx.getImageData(0, 0, w, h).data, distance = new Float32Array(w * h)
  const inside = (i: number) => pixels[i * 4 + 3] >= 128
  for (let i = 0; i < distance.length; i++) {
    const alpha = pixels[i * 4 + 3] / 255
    distance[i] = alpha > 0 && alpha < 1 ? Math.abs(alpha - 0.5) : inside(i) !== inside(i - 1) || inside(i) !== inside(i - w) || inside(i) !== inside(i + 1) || inside(i) !== inside(i + w) ? 0.5 : 64
  }
  for (const step of [1, -1]) for (let k = 0; k < w * h; k++) {
    const i = step === 1 ? k : w * h - 1 - k, x = i % w, row = i - step * w
    if (x > 0 && x < w - 1 && row >= 0 && row < w * h) distance[i] = Math.min(distance[i], distance[i - step] + 1, distance[row] + 1, distance[row - 1] + Math.SQRT2, distance[row + 1] + Math.SQRT2)
  }
  // rows are stored bottom-up, so the texture's v runs the same way as height in the world
  const data = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; data[(h - 1 - y) * w + x] = Math.round(128 + (inside(i) ? -1 : 1) * Math.min(31.75, distance[i]) * 4) }
  return { data, uw: l.w / LW, uh: l.h / LH }
}

// The first version's single title, kept so old links still open.
export function titleField(text: string) {
  const canvas = document.createElement("canvas"), ctx = canvas.getContext("2d", { willReadFrequently: true })!, font = fontCss("sans", 88)
  ctx.font = font; const metrics = ctx.measureText(text); canvas.width = Math.min(2048, Math.ceil(metrics.width) + 28); canvas.height = 132
  ctx.font = font; ctx.fillStyle = "white"; ctx.fillText(text, 14, 94, canvas.width - 28)
  const { width: w, height: h } = canvas, pixels = ctx.getImageData(0, 0, w, h).data, distance = new Float32Array(w * h), inside = (i: number) => pixels[i * 4 + 3] >= 128
  for (let i = 0; i < distance.length; i++) { const alpha = pixels[i * 4 + 3] / 255
    distance[i] = alpha > 0 && alpha < 1 ? Math.abs(alpha - 0.5) : inside(i) !== inside(i - 1) || inside(i) !== inside(i - w) || inside(i) !== inside(i + 1) || inside(i) !== inside(i + w) ? 0.5 : 64 }
  for (const step of [1, -1]) for (let k = 0; k < w * h; k++) { const i = step === 1 ? k : w * h - 1 - k, x = i % w, row = i - step * w
    if (x > 0 && x < w - 1 && row >= 0 && row < w * h) distance[i] = Math.min(distance[i], distance[i - step] + 1, distance[row] + 1, distance[row - 1] + Math.SQRT2, distance[row + 1] + Math.SQRT2) }
  const data = new Uint8Array(w * h); for (let i = 0; i < data.length; i++) data[i] = Math.round(128 + (inside(i) ? -1 : 1) * Math.min(31.75, distance[i]) * 4)
  return { data, w, h }
}
