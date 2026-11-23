// Lets the app open with no connection once it has been opened before. Fresh files are always
// preferred: the saved copy is only used when the network cannot be reached.
const CACHE = "untitled-worlds-1"
self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()))
self.addEventListener("fetch", (e) => {
  const r = e.request
  if (r.method !== "GET" || new URL(r.url).origin !== location.origin) return
  e.respondWith(fetch(r).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(r, copy)) } return res }).catch(() => caches.match(r, { ignoreSearch: r.mode === "navigate" }).then((hit) => hit || Response.error())))
})
