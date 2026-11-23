// Features plug in here. Each one lives in its own file in this folder and adds ONE line to the
// list at the bottom. The app then:
//   - mounts its Overlay (full-screen modes, dialogs, floating panels) once, always,
//   - lists it in the "Modes" menu in the top bar and in Find anything (if it has run),
//   - calls boot(params) once at start-up with the page's address parameters, so a feature can
//     start itself from a link such as ?screensaver or ?seed=moon.
import type * as React from "react"

import { retroFeature } from "./retro"
import { wordWorldFeature } from "./word-world"

export interface Feature {
  id: string
  label: string // short, plain words: "Screensaver", "1994 mode"
  about: string // one sentence for the menu and Find anything
  icon?: React.ComponentType<{ className?: string }>
  run?: () => void // what picking it in the menu does
  Overlay?: React.ComponentType
  boot?: (params: URLSearchParams) => void
}

// ---- one line per feature below this ----
export const FEATURES: Feature[] = [
  wordWorldFeature,
  retroFeature,
]
