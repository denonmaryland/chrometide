// Designs: a picture of a world with words set on it. An album cover, a flyer, a poster, a
// postcard, a ticket… Each kind has a size and the words it usually carries; each layout is one
// way of setting those words. Everything is drawn here, on a canvas; no stock art.

export const DESIGN_KINDS = {
  cover: { label: "Album cover", w: 1200, h: 1200, words: { title: "Album title", sub: "Artist" } },
  flyer: { label: "Flyer", w: 1080, h: 1350, words: { title: "Event name", sub: "Tagline", line1: "Date and time", line2: "Place", list: "Line-up, one per line", small: "Small print" } },
  poster: { label: "Poster", w: 1200, h: 1800, words: { title: "Title", sub: "Second line", line1: "Top line", small: "Small print" } },
  postcard: { label: "Postcard", w: 1500, h: 1000, words: { title: "Place name", sub: "Greeting", small: "Small print" } },
  wallpaper: { label: "Phone wallpaper", w: 1080, h: 1920, words: { title: "A word, or nothing", sub: "Second line" } },
  banner: { label: "Banner", w: 1500, h: 500, words: { title: "Name", sub: "Line under it", small: "Small print" } },
  ticket: { label: "Ticket", w: 1500, h: 600, words: { title: "Event", sub: "Presented by", line1: "Date", line2: "Place", small: "Seat or number" } },
  card: { label: "Trading card", w: 1000, h: 1400, words: { title: "Name", sub: "Kind", list: "Facts, one per line", small: "Number" } },
} as const
export type DesignKind = keyof typeof DESIGN_KINDS
export const LAYOUTS = ["wide", "label", "serif", "stack", "band", "poster", "frame", "side", "split", "date", "lineup", "postcard", "minimal", "bar", "arch", "masthead", "ticket", "card", "badge", "quiet"] as const
export type Layout = (typeof LAYOUTS)[number]
export const LAYOUT_LABEL: Record<Layout, string> = { wide: "Wide", label: "Label", serif: "Serif", stack: "Stack", band: "Band", poster: "Poster", frame: "Frame", side: "Side", split: "Split", date: "Big date", lineup: "Line-up", postcard: "Greetings", minimal: "Tiny", bar: "Bar", arch: "Arch", masthead: "Magazine", ticket: "Stub", card: "Card", badge: "Seal", quiet: "No words" }
export interface DesignOpts {
  kind: DesignKind; layout: Layout
  title: string; sub: string; line1: string; line2: string; list: string; small: string
  ink: string; paper: string
  format: "flat" | "cd" | "tape" | "vinyl"; tracks: string
  obi: boolean; obiText: string; obiColor: string
}
export const designOpts = (o: Partial<DesignOpts> = {}): DesignOpts => ({ kind: "cover", layout: "wide", title: "", sub: "Untitled Worlds", line1: "", line2: "", list: "", small: "", ink: "#ffffff", paper: "#f3efe6", format: "flat", tracks: "", obi: false, obiText: "", obiColor: "#f3efe6", ...o })

type X = CanvasRenderingContext2D
const TAIL = ', "Helvetica Neue", Arial, sans-serif'
const sans = (wt: number) => (p: number) => `${wt} ${p}px "Geist Variable"${TAIL}`
const mono = (p: number) => `500 ${p}px "Geist Mono Variable", ui-monospace, monospace`
const serif = (p: number) => `italic 500 ${p}px "Playfair Display Variable", Georgia, serif`
const roman = (p: number) => `800 ${p}px "Playfair Display Variable", Georgia, serif`
const anton = (p: number) => `400 ${p}px "Anton", "Geist Variable"${TAIL}`
const script = (p: number) => `400 ${p}px "Pacifico", Georgia, serif`
const slab = (p: number) => `800 ${p}px "Roboto Slab Variable", Georgia, serif`
const sp = (x: X, px: number) => { (x as any).letterSpacing = `${px}px` }
/** Shrink the type until the words fit the width. Leaves the font set. */
function fit(x: X, text: string, font: (p: number) => string, max: number, start: number, em = 0) { let px = start; x.font = font(px); sp(x, px * em); while (x.measureText(text).width > max && px > 7) { px -= Math.max(1, px * 0.04); x.font = font(px); sp(x, px * em) } return px }
const lum = (h: string) => parseInt(h.slice(1, 3), 16) * 0.3 + parseInt(h.slice(3, 5), 16) * 0.59 + parseInt(h.slice(5, 7), 16) * 0.11
const on = (h: string) => (lum(h) > 140 ? "#121216" : "#faf7f0")
const glow = (x: X, u: number, a = 0.3) => { x.shadowColor = `rgba(0,0,0,${a})`; x.shadowBlur = u * 0.014 }
const flat = (x: X) => { x.shadowColor = "transparent"; x.shadowBlur = 0 }
function arcText(x: X, text: string, cx: number, cy: number, r: number, mid: number, up = true) {
  const widths = [...text].map((c) => x.measureText(c).width), total = widths.reduce((a, b) => a + b, 0); let a = mid - ((up ? 1 : -1) * total) / r / 2
  ;[...text].forEach((c, i) => { const half = ((up ? 1 : -1) * widths[i]) / r / 2; a += half; x.save(); x.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r); x.rotate(a + (up ? Math.PI / 2 : -Math.PI / 2)); x.textAlign = "center"; x.fillText(c, 0, 0); x.restore(); a += half })
}

interface C { x: X; W: number; H: number; u: number; pad: number; L: number; T: string; S: string; D1: string; D2: string; LIST: string[]; SM: string; ink: string; paper: string }
const DRAW: Record<Layout, (c: C) => void> = {
  wide: ({ x, W, H, u, pad, L, T, S, D1, D2 }) => { glow(x, u); const px = fit(x, T.toUpperCase(), sans(300), W - L - pad * 2, u * 0.07, 0.42); x.fillText(T.toUpperCase(), L + pad, pad + px)
    const a = u * 0.018; x.font = mono(a); sp(x, a * 0.3); x.fillText(S.toUpperCase(), L + pad, H - pad); if (D1 || D2) { x.textAlign = "right"; x.fillText([D1, D2].filter(Boolean).join("  ·  ").toUpperCase(), W - pad, H - pad) } },
  label: ({ x, W, H, u, pad, L, T, S, SM, D1 }) => { glow(x, u); const px = fit(x, T, sans(600), (W - L) * 0.7, u * 0.05); x.fillText(T, L + pad, H - pad - u * 0.038); x.font = sans(400)(u * 0.024); x.globalAlpha = 0.85; x.fillText([S, D1].filter(Boolean).join(" · "), L + pad, H - pad); x.globalAlpha = 1; void px
    x.font = mono(u * 0.016); x.textAlign = "right"; x.fillText((SM || "STEREO · 33⅓").toUpperCase(), W - pad, pad + u * 0.016) },
  serif: ({ x, W, H, u, pad, L, T, S, D1 }) => { glow(x, u); x.textAlign = "center"; const px = fit(x, T, serif, W - L - pad * 2, u * 0.14); x.fillText(T, (W + L) / 2, H * 0.5 + px * 0.3)
    const a = u * 0.02; x.font = sans(500)(a); sp(x, a * 0.35); x.fillText(S.toUpperCase(), (W + L) / 2, H - pad); if (D1) x.fillText(D1.toUpperCase(), (W + L) / 2, pad + a) },
  stack: ({ x, W, H, u, pad, L, T, S, D1, D2 }) => { glow(x, u); let y = pad; for (const w of T.toUpperCase().split(/\s+/).filter(Boolean).slice(0, 5)) { const px = fit(x, w, sans(900), W - L - pad * 2, u * 0.26, -0.02); y += px * 0.86; x.fillText(w, L + pad, y) }
    const a = u * 0.02; x.font = mono(a); sp(x, a * 0.25); x.fillText(S.toUpperCase(), L + pad, H - pad); if (D1 || D2) { x.textAlign = "right"; x.fillText([D1, D2].filter(Boolean).join(" · ").toUpperCase(), W - pad, H - pad) } },
  band: ({ x, W, H, u, pad, L, T, S, D1, ink }) => { flat(x); const bh = u * 0.2; x.fillStyle = ink; x.fillRect(0, H - bh, W, bh); x.fillStyle = on(ink)
    const px = fit(x, T.toUpperCase(), anton, W - L - pad * 2, bh * 0.56); x.fillText(T.toUpperCase(), L + pad, H - bh * 0.42 + px * 0.2); const a = u * 0.02; x.font = mono(a); sp(x, a * 0.25); x.fillText(S.toUpperCase(), L + pad, H - bh * 0.14)
    if (D1) { x.textAlign = "right"; x.fillText(D1.toUpperCase(), W - pad, H - bh * 0.14) } },
  poster: ({ x, W, H, u, pad, L, T, S, D1 }) => { glow(x, u); x.textAlign = "center"; const words = T.toUpperCase().split(/\s+/).filter(Boolean).slice(0, 5); let y = H * 0.5 - (words.length - 1) * u * 0.09
    for (const w of words) { const px = fit(x, w, anton, W - L - pad * 2, u * 0.2); x.fillText(w, (W + L) / 2, y + px * 0.36); y += px * 0.98 }
    x.font = script(u * 0.036); sp(x, 0); x.fillText(S, (W + L) / 2, H - pad); if (D1) { const a = u * 0.02; x.font = mono(a); sp(x, a * 0.3); x.fillText(D1.toUpperCase(), (W + L) / 2, pad + a) } },
  frame: ({ x, W, H, u, pad, T, S, D1, D2, ink }) => { flat(x); x.strokeStyle = ink; x.lineWidth = Math.max(1.5, u * 0.003); const m = pad * 0.55; x.strokeRect(m, m, W - m * 2, H - m * 2); glow(x, u); x.textAlign = "center"
    const a = u * 0.028; x.font = sans(500)(a); sp(x, a * 0.5); x.fillText(T.toUpperCase(), W / 2, m + pad * 0.9 + a * 0.4); const b = u * 0.018; x.font = mono(b); sp(x, b * 0.3); x.fillText(S.toUpperCase(), W / 2, H - m - pad * 0.7)
    x.textAlign = "left"; if (D1) x.fillText(D1.toUpperCase(), m + pad * 0.5, H - m - pad * 0.25); x.textAlign = "right"; if (D2) x.fillText(D2.toUpperCase(), W - m - pad * 0.5, H - m - pad * 0.25) },
  side: ({ x, W, H, u, pad, T, S, D1, D2, LIST }) => { glow(x, u); x.save(); x.translate(pad + u * 0.1, H - pad); x.rotate(-Math.PI / 2); const px = fit(x, T.toUpperCase(), anton, H - pad * 2, u * 0.17); x.fillText(T.toUpperCase(), 0, 0); x.restore(); void px
    x.textAlign = "right"; const a = u * 0.026; x.font = sans(600)(a); sp(x, 0); let y = pad + a; for (const l of [S, D1, D2].filter(Boolean)) { x.fillText(l, W - pad, y); y += a * 1.45 }
    x.font = mono(u * 0.019); y = H - pad - (LIST.length - 1) * u * 0.03; for (const l of LIST.slice(0, 10)) { x.fillText(l.toUpperCase(), W - pad, y); y += u * 0.03 } },
  split: ({ x, W, H, u, pad, T, S, D1, D2, LIST, SM, paper }) => { flat(x); const bh = H * 0.36, y0 = H - bh; x.fillStyle = paper; x.fillRect(0, y0, W, bh); x.fillStyle = on(paper)
    const px = fit(x, T.toUpperCase(), sans(900), W - pad * 2, bh * 0.3, -0.02); x.fillText(T.toUpperCase(), pad, y0 + pad * 0.7 + px * 0.8); let y = y0 + pad * 0.7 + px * 0.8 + u * 0.045; x.font = sans(500)(u * 0.026); sp(x, 0)
    x.fillText([S, D1, D2].filter(Boolean).join("  ·  "), pad, y); y += u * 0.05; x.font = mono(u * 0.018); const cols = 2, per = Math.ceil(Math.min(LIST.length, 8) / cols)
    LIST.slice(0, 8).forEach((l, i) => x.fillText(l.toUpperCase(), pad + Math.floor(i / per) * ((W - pad * 2) / cols), y + (i % per) * u * 0.028)); if (SM) { x.textAlign = "right"; x.globalAlpha = 0.6; x.fillText(SM.toUpperCase(), W - pad, H - pad * 0.5) } },
  date: ({ x, W, H, u, pad, T, S, D1, D2, LIST, SM }) => { glow(x, u, 0.35); x.textAlign = "center"; const px = fit(x, (D1 || "00.00").toUpperCase(), anton, W - pad * 2, u * 0.34); x.fillText((D1 || "00.00").toUpperCase(), W / 2, pad + px * 0.86)
    const a = fit(x, T.toUpperCase(), sans(700), W - pad * 2, u * 0.05, 0.3); x.fillText(T.toUpperCase(), W / 2, pad + px * 0.86 + a * 1.7); x.font = sans(400)(u * 0.026); sp(x, 0); x.fillText(S, W / 2, pad + px * 0.86 + a * 1.7 + u * 0.045)
    x.font = sans(600)(u * 0.03); let y = H - pad - u * 0.07 - (LIST.length - 1) * u * 0.04; for (const l of LIST.slice(0, 8)) { x.fillText(l, W / 2, y); y += u * 0.04 }
    x.font = mono(u * 0.019); sp(x, u * 0.005); x.fillText([D2, SM].filter(Boolean).join("  ·  ").toUpperCase(), W / 2, H - pad) },
  lineup: ({ x, W, H, u, pad, T, S, D1, D2, LIST, SM }) => { glow(x, u, 0.35); x.textAlign = "center"; const px = fit(x, T.toUpperCase(), anton, W - pad * 2, u * 0.2); x.fillText(T.toUpperCase(), W / 2, pad + px * 0.84); x.font = script(u * 0.036); sp(x, 0); x.fillText(S, W / 2, pad + px * 0.84 + u * 0.055)
    const n = Math.min(LIST.length, 9), lh = Math.min(u * 0.072, (H * 0.42) / Math.max(1, n)); let y = H * 0.56 - ((n - 1) * lh) / 2
    LIST.slice(0, 9).forEach((l, i) => { fit(x, l.toUpperCase(), sans(i === 0 ? 800 : 600), W - pad * 2, lh * (i === 0 ? 0.9 : 0.66), 0.04); x.fillText(l.toUpperCase(), W / 2, y); y += lh })
    const a = u * 0.028; x.font = sans(700)(a); sp(x, a * 0.12); x.fillText([D1, D2].filter(Boolean).join("   ·   ").toUpperCase(), W / 2, H - pad - u * 0.04); x.font = mono(u * 0.017); x.globalAlpha = 0.8; x.fillText(SM.toUpperCase(), W / 2, H - pad) },
  postcard: ({ x, W, H, u, pad, T, S, SM }) => { glow(x, u, 0.4); x.textAlign = "center"; const px = fit(x, T.toUpperCase(), anton, W - pad * 2.4, u * 0.42); x.lineJoin = "round"; x.lineWidth = px * 0.07; x.strokeStyle = "rgba(10,10,20,.85)"; x.strokeText(T.toUpperCase(), W / 2, H * 0.56 + px * 0.34); x.fillText(T.toUpperCase(), W / 2, H * 0.56 + px * 0.34)
    x.font = script(u * 0.085); sp(x, 0); x.lineWidth = u * 0.012; x.strokeText(S, W / 2, H * 0.56 - px * 0.5); x.fillText(S, W / 2, H * 0.56 - px * 0.5); x.font = mono(u * 0.022); x.textAlign = "right"; x.fillText(SM.toUpperCase(), W - pad, H - pad * 0.8) },
  minimal: ({ x, H, u, pad, L, T, S }) => { glow(x, u); const a = u * 0.017; x.font = mono(a); sp(x, a * 0.3); x.fillText([T, S].filter(Boolean).join("  /  ").toUpperCase(), L + pad, H - pad) },
  bar: ({ x, W, H, u, pad, T, S, D1 }) => { flat(x); const bh = u * 0.13; x.fillStyle = "rgba(8,8,14,.62)"; x.fillRect(0, H / 2 - bh / 2, W, bh); x.fillStyle = "#faf7f0"; x.textAlign = "center"; const px = fit(x, T.toUpperCase(), sans(300), W - pad * 2, bh * 0.42, 0.5); x.fillText(T.toUpperCase(), W / 2, H / 2 + px * 0.36)
    glow(x, u); const a = u * 0.019; x.font = mono(a); sp(x, a * 0.3); x.fillText([S, D1].filter(Boolean).join("  ·  ").toUpperCase(), W / 2, H / 2 + bh / 2 + a * 2.2) },
  arch: ({ x, W, H, u, pad, T, S, D1, D2 }) => { glow(x, u, 0.35); const r = W * 0.62, px = Math.min(u * 0.09, (r * 2.0) / Math.max(4, T.length) / 0.62); x.font = anton(px); sp(x, 0); arcText(x, T.toUpperCase(), W / 2, pad + px + r, r, -Math.PI / 2)
    x.textAlign = "center"; x.font = script(u * 0.04); x.fillText(S, W / 2, pad + px * 2.7); const a = u * 0.02; x.font = mono(a); sp(x, a * 0.3); x.fillText([D1, D2].filter(Boolean).join("  ·  ").toUpperCase(), W / 2, H - pad) },
  masthead: ({ x, W, H, u, pad, T, S, D1, LIST, SM, ink }) => { glow(x, u, 0.35); x.textAlign = "center"; const px = fit(x, T.toUpperCase(), roman, W - pad * 2, u * 0.24, -0.01); x.fillText(T.toUpperCase(), W / 2, pad + px * 0.8); flat(x); x.fillStyle = ink; x.fillRect(pad, pad + px * 0.8 + u * 0.022, W - pad * 2, Math.max(1.5, u * 0.003)); glow(x, u, 0.35)
    const a = u * 0.019; x.font = mono(a); sp(x, a * 0.25); x.textAlign = "left"; x.fillText(S.toUpperCase(), pad, pad + px * 0.8 + u * 0.058); x.textAlign = "right"; x.fillText(D1.toUpperCase(), W - pad, pad + px * 0.8 + u * 0.058)
    x.textAlign = "left"; let y = H * 0.52; LIST.slice(0, 5).forEach((l, i) => { x.font = i % 2 ? sans(400)(u * 0.028) : serif(u * 0.05); sp(x, 0); x.fillText(l, pad, y); y += u * (i % 2 ? 0.07 : 0.05) })
    flat(x); const bw = u * 0.16, bh = u * 0.07, bx = W - pad - bw, by = H - pad - bh; x.fillStyle = "#faf7f0"; x.fillRect(bx, by, bw, bh); x.fillStyle = "#111"; for (let i = 0; i < 26; i++) { const w = (((i * 7) % 3) + 1) * bw * 0.008; x.fillRect(bx + bw * 0.06 + i * bw * 0.034, by + bh * 0.12, w, bh * 0.6) }
    x.font = mono(u * 0.012); x.textAlign = "center"; x.fillText((SM || "No. 001").toUpperCase(), bx + bw / 2, by + bh * 0.92) },
  ticket: ({ x, W, H, u, pad, T, S, D1, D2, SM, paper }) => { flat(x); const sw = W * 0.24, sx = W - sw; x.fillStyle = paper; x.fillRect(sx, 0, sw, H); x.fillStyle = "rgba(0,0,0,.55)"; for (let y = u * 0.03; y < H; y += u * 0.045) { x.beginPath(); x.arc(sx, y, u * 0.009, 0, 7); x.fill() }
    x.fillStyle = on(paper); x.save(); x.translate(sx + sw * 0.3, H - pad * 0.7); x.rotate(-Math.PI / 2); fit(x, (D1 || "ADMIT ONE").toUpperCase(), anton, H - pad * 1.4, sw * 0.3); x.fillText((D1 || "ADMIT ONE").toUpperCase(), 0, 0); x.font = mono(u * 0.032); sp(x, u * 0.004); x.fillText(D2.toUpperCase(), 0, sw * 0.2); x.globalAlpha = 0.7; x.fillText((SM || "No. 000001").toUpperCase(), 0, sw * 0.4); x.restore()
    x.fillStyle = "#faf7f0"; glow(x, u, 0.4); const a = u * 0.04; x.font = mono(a); sp(x, a * 0.25); x.fillText(S.toUpperCase(), pad, pad + a); const px = fit(x, T.toUpperCase(), anton, sx - pad * 2, u * 0.36); x.fillText(T.toUpperCase(), pad, H - pad) },
  card: ({ x, W, H, u, pad, T, S, LIST, SM, paper, ink }) => { flat(x); const m = u * 0.035; x.strokeStyle = paper; x.lineWidth = m * 2; x.strokeRect(m, m, W - m * 2, H - m * 2); const ph = H * 0.3, py = H - ph - m * 2; x.fillStyle = paper; x.beginPath(); x.roundRect(m * 2.4, py, W - m * 4.8, ph, u * 0.02); x.fill()
    x.fillStyle = on(paper); const px = fit(x, T.toUpperCase(), slab, W - m * 8, u * 0.075); x.fillText(T.toUpperCase(), m * 3.6, py + px * 1.25); x.font = serif(u * 0.034); sp(x, 0); x.globalAlpha = 0.75; x.fillText(S, m * 3.6, py + px * 1.25 + u * 0.048); x.globalAlpha = 1
    x.font = mono(u * 0.024); let y = py + px * 1.25 + u * 0.11; for (const l of LIST.slice(0, 4)) { x.fillText(l, m * 3.6, y); y += u * 0.037 } x.fillStyle = ink; glow(x, u, 0.4); x.font = mono(u * 0.026); x.textAlign = "right"; x.fillText((SM || "001 / 100").toUpperCase(), W - m * 3, m * 3.4) },
  badge: ({ x, W, H, u, pad, L, T, S, D1, paper }) => { glow(x, u); const px = fit(x, T.toUpperCase(), sans(900), (W - L) * 0.72, u * 0.11, -0.02); x.fillText(T.toUpperCase(), L + pad, pad + px * 0.9); flat(x); const r = u * 0.13, cx = W - pad - r, cy = H - pad - r; x.fillStyle = paper; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill()
    x.fillStyle = on(paper); x.font = mono(r * 0.17); sp(x, r * 0.03); const ring = ((S || "limited") + "  ·  ").toUpperCase().repeat(6).slice(0, Math.floor((2 * Math.PI * r * 0.8) / (r * 0.135))); arcText(x, ring, cx, cy, r * 0.78, -Math.PI / 2)
    x.textAlign = "center"; fit(x, (D1 || "No. 1").toUpperCase(), anton, r * 1.15, r * 0.5); x.fillText((D1 || "No. 1").toUpperCase(), cx, cy + r * 0.16) },
  quiet: () => {},
}

/** The picture with its words, at the picture's own size. */
export function drawDesign(art: HTMLCanvasElement | HTMLImageElement, o: DesignOpts, W = art.width, H = art.height): HTMLCanvasElement {
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d")!, u = Math.min(W, H)
  x.drawImage(art, 0, 0, W, H); x.fillStyle = o.ink; x.textBaseline = "alphabetic"; x.textAlign = "left"
  const ctx: C = { x, W, H, u, pad: u * 0.07, L: o.obi ? u * 0.15 : 0, T: o.title.trim(), S: o.sub.trim(), D1: o.line1.trim(), D2: o.line2.trim(), LIST: o.list.split("\n").map((l) => l.trim()).filter(Boolean), SM: o.small.trim(), ink: o.ink, paper: o.paper }
  x.save(); (DRAW[o.layout] ?? DRAW.wide)(ctx); x.restore(); sp(x, 0); flat(x); x.globalAlpha = 1; x.textAlign = "left"
  if (o.obi) { // a paper strip down the left side, as on Japanese releases
    const ow = u * 0.15; x.fillStyle = o.obiColor; x.fillRect(0, 0, ow, H); x.fillStyle = "rgba(0,0,0,.18)"; x.fillRect(ow - 2, 0, 2, H); x.fillStyle = on(o.obiColor)
    x.save(); x.translate(ow * 0.62, u * 0.06); x.rotate(Math.PI / 2); x.font = sans(700)(ow * 0.36); x.fillText((o.obiText || ctx.T).slice(0, 34), 0, 0); x.font = mono(ow * 0.13); x.globalAlpha = 0.75; x.fillText(ctx.S.toUpperCase().slice(0, 44), 0, ow * 0.3); x.restore()
    x.font = mono(ow * 0.12); x.textAlign = "center"; x.fillText("STEREO", ow / 2, H - u * 0.045) }
  return c
}
