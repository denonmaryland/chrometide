// Things the app keeps on this device (saved worlds, hints already seen, preferences). Storage can be
// blocked (a private window, a strict browser), full, or hold something spoiled: reading then gives
// the fallback, and writing says whether it worked. Never throws.
export function recall<T>(key: string, fallback: T, valid: (v: unknown) => boolean = () => true): T {
  try { const raw = localStorage.getItem(key); if (raw === null) return fallback; const v: unknown = JSON.parse(raw); return valid(v) ? (v as T) : fallback } catch { return fallback }
}
/** Keep a value; false if the browser would not (full or blocked). */
export function keep(key: string, value: unknown): boolean {
  try { localStorage.setItem(key, JSON.stringify(value)); return true } catch { return false }
}
