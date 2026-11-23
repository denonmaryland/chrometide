// Short, kind messages for when something did not work (or worked in a way worth knowing): a file
// that could not be read, a link that was cut short, storage that is full. Anything can call
// notify(); the app shows the newest few in one place (src/ui/Notice.tsx). Text only, never HTML.
export interface Notice { id: number; text: string; action?: { label: string; run: () => void }; ms: number }
let list: Notice[] = [], n = 0
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
export const notices = () => list
export const onNotices = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }
export function dismiss(id: number) { list = list.filter((x) => x.id !== id); emit() }
/** Show a message. The same text again only moves it to the front. ms 0 keeps it until closed. */
export function notify(text: string, o: { action?: Notice["action"]; ms?: number } = {}) {
  const item = { id: ++n, text: String(text).slice(0, 300), action: o.action, ms: o.ms ?? (o.action ? 9000 : 5200) }
  list = [...list.filter((x) => x.text !== item.text), item].slice(-3); emit()
  const log: string[] = ((window as any).__noticeLog ??= []); log.push(item.text); if (log.length > 40) log.shift() // for the test scripts
  return item.id
}
