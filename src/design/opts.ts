// What a design is made of: its kind (cover, flyer, ...), its layout and its words. Kept apart from
// the drawing code in ./layouts so the app can start without loading every layout.

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
export const designOpts = (o: Partial<DesignOpts> = {}): DesignOpts => ({ kind: "cover", layout: "wide", title: "", sub: "Chrometide", line1: "", line2: "", list: "", small: "", ink: "#ffffff", paper: "#f3efe6", format: "flat", tracks: "", obi: false, obiText: "", obiColor: "#f3efe6", ...o })
