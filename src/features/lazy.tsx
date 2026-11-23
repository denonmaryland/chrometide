// A feature whose code arrives the first time it is wanted: picked in a menu, started from a link,
// or fetched quietly once the page is up. The menu entry (name, sentence, icon) is here from the
// start; the mode itself (its overlay, what picking it does) is in its own file and loads later.
import * as React from "react"

import type { Feature } from "./index"

/** The part of a feature that lives in its own, later-loaded file. */
export type FeatureCode = Pick<Feature, "run" | "Overlay" | "boot">
export type LazyFeature = Feature & { load: () => Promise<FeatureCode> }

export function lazy(meta: Omit<Feature, "run" | "Overlay" | "boot">, load: () => Promise<FeatureCode>, o: { startsFrom?: (q: URLSearchParams) => boolean; inMenu?: boolean } = {}): LazyFeature {
  let pending: Promise<FeatureCode> | null = null, code: FeatureCode | null = null
  const subs = new Set<() => void>()
  const get = () => (pending ??= load().then((c) => { code = c; subs.forEach((f) => f()); return c }, (e) => { pending = null; throw e }))
  const fail = (e: unknown) => console.error(`${meta.label} could not load.`, e)
  // nothing is mounted until the code has arrived; then the feature's own overlay takes over
  function Overlay() {
    const c = React.useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f) } }, () => code)
    return c?.Overlay ? <c.Overlay /> : null
  }
  return {
    ...meta, Overlay, load: get,
    run: o.inMenu === false ? undefined : () => { get().then((c) => c.run?.(), fail) },
    boot: o.startsFrom ? (q) => { if (o.startsFrom!(q)) get().then((c) => c.boot?.(q), fail) } : undefined,
  }
}
