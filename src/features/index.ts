// Features plug in here. Each one lives in its own file in this folder and adds ONE line to the
// list at the bottom. The app then:
//   - mounts its Overlay (full-screen modes, dialogs, floating panels) once, always,
//   - lists it in the "Modes" menu in the top bar and in Find anything (if it has run),
//   - calls boot(params) once at start-up with the page's address parameters, so a feature can
//     start itself from a link such as ?screensaver or ?seed=moon.
// A mode that is not needed when the page opens is wrapped in lazy(): its menu entry is here, and
// its code loads when it is picked, when its link parameter is present, or quietly once the page
// is up (preload).
import type * as React from "react"
import { Bird, Code2, History, Monitor, MonitorPlay, MountainSnow, Orbit } from "lucide-react"

import { type LazyFeature, lazy } from "./lazy"
import { photoWorld } from "./photo-world"
import { wordWorldFeature } from "./word-world"
import "./tape" // the time-lapse's record of changes starts with the page

export interface Feature {
  id: string
  label: string // short, plain words: "Screensaver", "1994 mode"
  about: string // one sentence for the menu and Find anything
  icon?: React.ComponentType<{ className?: string }>
  run?: () => void // what picking it in the menu does
  Overlay?: React.ComponentType
  boot?: (params: URLSearchParams) => void
}

const retro = lazy({ id: "1994", label: "1994 mode", about: "Watch the picture arrive line by line, the way a 1994 computer drew it.", icon: Monitor },
  () => import("./retro").then((m) => m.retroFeature), { startsFrom: (q) => q.has("1994") || q.has("retro") })
const screensaver = lazy({ id: "screensaver", label: "Screensaver", about: "Drift slowly through worlds, full screen. Any key brings you back.", icon: MonitorPlay },
  () => import("./screensaver").then((m) => m.screensaverFeature), { startsFrom: (q) => q.has("screensaver") })
const embed = lazy({ id: "embed", label: "Embed on a page", about: "Put this world, live, on your own website.", icon: Code2 },
  () => import("./share").then((m) => m.embed), { inMenu: false })
const githubIsland = lazy({ id: "github-island", label: "GitHub year island", icon: MountainSnow, about: "A year of GitHub contributions becomes an island, with the name in chrome." },
  () => import("./github-island").then((m) => m.githubIsland), { startsFrom: (q) => q.has("github") })
const fly = lazy({ id: "fly", label: "Fly", about: "Move through the world yourself: keys or a thumbstick, drag to look.", icon: Bird },
  () => import("./walk").then((m) => m.fly), { startsFrom: (q) => q.has("fly") })
const look = lazy({ id: "look", label: "Look around", about: "Stand in the world and look all around. Tilt a phone, or use VR.", icon: Orbit },
  () => import("./walk").then((m) => m.look), { startsFrom: (q) => q.has("look") })
const timelapse = lazy({ id: "timelapse", label: "Time-lapse", about: "Watch how this world was made, as a short video.", icon: History },
  () => import("./timelapse").then((m) => m.TIMELAPSE))

/** Open the embed dialog (from the top bar). */
export const openEmbed = () => { void embed.load().then(() => import("./share")).then((m) => m.openEmbed()) }

// ---- one line per feature below this ----
export const FEATURES: Feature[] = [
  wordWorldFeature,
  retro,
  screensaver,
  embed,
  photoWorld,
  githubIsland,
  fly,
  look,
  timelapse,
]

/** Fetch every later-loaded mode in the background, so picking one later is instant. */
export const preloadFeatures = () => Promise.allSettled(FEATURES.map((f) => (f as Partial<LazyFeature>).load?.()))
