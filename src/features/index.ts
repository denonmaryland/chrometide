// Features plug in here. Each one lives in its own file in this folder and adds ONE line to the
// list at the bottom. The app then:
//   - mounts its Overlay (full-screen modes, dialogs, floating panels) once, always,
//   - lists it in the "Modes" menu in the top bar and in Find anything (if it has run),
//   - calls boot(params) once at start-up with the page's address parameters, so a feature can
//     start itself from a link such as ?screensaver or ?seed=moon.
import type * as React from "react"
import { photoWorld } from "./photo-world"

import { embed } from "./share"
import { retroFeature } from "./retro"
import { screensaverFeature } from "./screensaver"
import { wordWorldFeature } from "./word-world"

import { TIMELAPSE } from "./timelapse"
import { WALK } from "./walk"

export interface Feature {
  id: string
  label: string // short, plain words: "Screensaver", "1994 mode"
  about: string // one sentence for the menu and Find anything
  icon?: React.ComponentType<{ className?: string }>
  run?: () => void // what picking it in the menu does
  Overlay?: React.ComponentType
  boot?: (params: URLSearchParams) => void
}

import { githubIsland } from "./github-island"

// ---- one line per feature below this ----
export const FEATURES: Feature[] = [
  wordWorldFeature,
  retroFeature,
  screensaverFeature,
  embed,
  photoWorld,
  githubIsland,
  ...WALK,
  TIMELAPSE,
]
