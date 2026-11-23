// The hidden browser that does the ray tracing, shared by the MCP server (server.mjs) and the
// command line (cli.mjs). It serves the built app on a private port, opens its interface-free page
// "?api=1" in a headless Chrome, and calls the functions that page puts on window.__api.
//
// Settings (environment):
//   WORLDS_APP     folder of the built app (default: ../dist next to this file)
//   WORLDS_CHROME  path to a Chrome or Chromium program (default: looked for in the usual places)
import fs from "node:fs"; import http from "node:http"; import path from "node:path"; import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
export const APP = path.resolve(process.env.WORLDS_APP || path.join(here, "..", "dist"))
const PLACES = ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"]
export const CHROME = process.env.WORLDS_CHROME || PLACES.find((p) => fs.existsSync(p))

export const NO_APP = `The built app was not found at ${APP}. Run "npm install" and "npm run build" in the project folder, or set WORLDS_APP.`
export const NO_CHROME = "No Chrome or Chromium was found. Install one, or set WORLDS_CHROME to its path."
/** Samples per pixel for each named quality. */
export const QUALITY = { draft: 4, good: 16, fine: 48 }

/** Why the renderer cannot start here, or null if it looks ready. Checks files only; opens nothing. */
export function missing() {
  if (!fs.existsSync(path.join(APP, "index.html"))) return NO_APP
  if (!CHROME) return NO_CHROME
  if (!fs.existsSync(CHROME)) return `WORLDS_CHROME is set to ${CHROME}, but there is no program there.`
  return null
}

/** A renderer that starts the browser the first time it is used. call(name, ...args) runs window.__api[name](...args) in the page. */
export function createRenderer() {
  let page = null, starting = null, browser = null, server = null
  async function boot() {
    const why = missing(); if (why) throw new Error(why)
    const { chromium } = await import("playwright-core")
    const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".woff": "font/woff", ".png": "image/png", ".svg": "image/svg+xml" }
    const srv = http.createServer((q, r) => { const f = path.join(APP, decodeURIComponent(q.url.split("?")[0].split("#")[0]).replace(/^\/+/, "") || "index.html")
      if (!f.startsWith(APP) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return }
      r.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r) })
    await new Promise((ok) => srv.listen(0, "127.0.0.1", ok)); srv.unref(); server = srv
    browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=gl", "--enable-unsafe-swiftshader"] })
    const p = await browser.newPage({ viewport: { width: 320, height: 240 } })
    await p.goto(`http://127.0.0.1:${srv.address().port}/index.html?api=1`); await p.waitForFunction(() => window.__api, null, { timeout: 60000 })
    const state = await p.evaluate(() => ({ ok: window.__api.ok, error: window.__api.error })); if (!state.ok) throw new Error(state.error || "The renderer could not start in this browser.")
    process.on("exit", () => { void browser?.close() }); page = p
  }
  const call = async (fn, ...args) => {
    if (!page) await (starting ??= boot().catch((e) => { starting = null; throw e }))
    return page.evaluate(([f, a]) => window.__api[f](...a), [fn, args])
  }
  /** Ray trace a world and return the PNG as bytes. */
  const render = async (world, width, height, quality = "good") => {
    const url = await call("render", world, width, height, typeof quality === "number" ? quality : QUALITY[quality] ?? QUALITY.good)
    return Buffer.from(url.slice(url.indexOf(",") + 1), "base64")
  }
  const close = async () => { await browser?.close().catch(() => {}); server?.close(); page = null; starting = null; browser = null }
  return { call, render, close }
}
