// On a phone the dials live in a sheet under the picture. Whether it is open is shared here, so
// the sidebar, the dock and the sheet itself can all open and close it.
import * as React from "react"

let open = false
const subs = new Set<() => void>()
export const setSheet = (v: boolean) => { if (v === open) return; open = v; subs.forEach((f) => f()) }
export const toggleSheet = () => setSheet(!open)
export const useSheet = () => React.useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => open)

/** The first visit's hint: shown once, until it is closed or the dice are rolled. */
export const WELCOME_KEY = "uw-welcome-seen"
