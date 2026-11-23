// A tiny static server for the built app, shared by the test scripts.
import fs from "fs"; import path from "path"; import http from "http"
export const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..")
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".woff2": "font/woff2", ".svg": "image/svg+xml" }
export async function serve(dir = "dist") {
  const base = path.join(root, dir)
  const srv = http.createServer((q, r) => { const f = path.join(base, decodeURIComponent(q.url.split("?")[0].split("#")[0]).replace(/^\/+/, "") || "index.html")
    if (!f.startsWith(base) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return }
    r.writeHead(200, { "content-type": types[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r) })
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok))
  return { url: `http://127.0.0.1:${srv.address().port}/`, close: () => srv.close() }
}
/** The Chrome or Chromium to test in: set CHROME to its path, or it is looked for in the usual places. */
export const CHROME = process.env.CHROME || ["/usr/bin/chromium", "/usr/bin/chromium-browser", "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"].find((p) => fs.existsSync(p))
export const FLAGS = ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=gl", "--enable-unsafe-swiftshader"]
export async function browser(extra = []) {
  const { chromium } = await import("playwright-core")
  return chromium.launch({ executablePath: CHROME, headless: true, args: [...FLAGS, ...extra] })
}
