// Run after building when a starter changes. Bake its sidebar preview once.
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { browser, root, serve } from "./serve.mjs"

const directory = path.join(root, "public", "presets")
await mkdir(directory, { recursive: true })
const server = await serve()
const chromium = await browser()
try {
  const page = await chromium.newPage()
  await page.goto(server.url + "?api=1")
  await page.waitForFunction(() => window.__api?.ok)
  const names = await page.evaluate(() => window.__api.presets().worlds.map(world => world.name))
  for (const name of names) {
    const jpeg = await page.evaluate(async name => {
      const api = window.__api
      const image = new Image()
      image.src = await api.render(api.starter(name), 192, 144, 8)
      await image.decode()
      const canvas = document.createElement("canvas")
      canvas.width = image.width
      canvas.height = image.height
      canvas.getContext("2d").drawImage(image, 0, 0)
      return canvas.toDataURL("image/jpeg", 0.85).split(",")[1]
    }, name)
    await writeFile(path.join(directory, name + ".jpg"), Buffer.from(jpeg, "base64"))
  }
} finally {
  await chromium.close()
  server.close()
}
