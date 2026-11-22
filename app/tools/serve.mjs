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
export async function browser() {
  const { createRequire } = await import("module"); const require = createRequire(import.meta.url)
  const { chromium } = require(process.env.PW_PATH || "/home/denon/.hermes/hermes-agent/node_modules/playwright")
  return chromium.launch({ executablePath: "/usr/bin/chromium", headless: true, args: ["--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=gl", "--enable-unsafe-swiftshader"] })
}
