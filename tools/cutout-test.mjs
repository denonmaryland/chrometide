// Run after npm run build. Exercises the file chooser, GPU picking, fractional opacity and saved worlds.
import assert from "node:assert/strict"
import { browser, serve } from "./serve.mjs"

const server = await serve()
const chromium = await browser()
try {
  const page = await chromium.newPage({ viewport: { width: 840, height: 600 } })
  const errors = []
  page.on("pageerror", e => errors.push(e.message))
  page.on("console", m => { if (m.type() === "error" && /SHADER|shader error|VALIDATE_STATUS/i.test(m.text())) errors.push(m.text()) })
  await page.goto(server.url)
  await page.waitForFunction(() => window.__engine?.ok)

  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas")
    canvas.width = 4
    canvas.height = 2
    const ctx = canvas.getContext("2d")
    ctx.fillStyle = "#ff3c14"
    ctx.fillRect(0, 0, 1, 2)
    ctx.fillStyle = "rgb(40 200 100 / .5)"
    ctx.fillRect(1, 0, 1, 2)
    return canvas.toDataURL().split(",")[1]
  })
  async function upload() {
    await page.getByTestId("dock-add").click()
    const chooser = page.waitForEvent("filechooser")
    await page.getByTestId("add-cutout").click()
    await (await chooser).setFiles({ name: "mask.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") })
  }
  await upload()
  await page.waitForFunction(() => window.__app.get().world.cutout?.width === 4)
  assert.equal(await page.getByRole("textbox", { name: "Name", exact: true }).inputValue(), "mask")
  await upload()
  await page.getByText("One cutout image per world.", { exact: false }).waitFor()

  const results = await page.evaluate(async () => {
    const app = window.__app, engine = window.__engine
    const rgba = app.get().world.cutout.rgba
    app.undo()
    const undone = !app.get().world.cutout
    app.redo()
    const redone = app.get().world.cutout.rgba === rgba
    app.edit("test placement", w => {
      const card = w.things.find(t => t.kind === "cutout")
      Object.assign(card, { pos: [0, 2, 0], size: [2, 1, .02], rot: [0, 0, 0] })
      Object.assign(w, { things: [card], title: undefined, terrains: [] })
      w.land.on = false
      w.sea.kind = "none"
    })
    engine.setWorld(app.get().world)
    const hits = [-1.5, -.5, .5, 1.5].map(x => engine.probe([x, 2, 5], [0, 0, -1]).kind)
    function meanRed(alpha) {
      // A red card completely fills the frame against a black sky. Only opacity changes.
      const w = structuredClone(app.get().world)
      Object.assign(w.sky, { zenith: "#000000", horizon: "#000000", haze: "#000000", sunGlow: 0, sunSize: 0, cloud: 0, cloud2: 0, hazeAmt: 0, fog: 0, stars: 0 })
      Object.assign(w.cam, { dist: 5, pitch: 0, yaw: 0, target: [0, 2, 0], fov: 45, lens: 0 })
      w.things[0].size = [20, 20, .02]
      w.cutout = { width: 1, height: 1, rgba: btoa(String.fromCharCode(255, 0, 0, alpha)) }
      const frame = engine.frame(w, 16, 16, 24)
      const pixels = frame.getContext("2d").getImageData(0, 0, 16, 16).data
      let sum = 0
      for (let i = 0; i < pixels.length; i += 4) sum += pixels[i]
      return sum / 256
    }
    const opacity = [0, 64, 128, 255].map(meanRed)
    history.replaceState(null, "", await app.shareLink())
    await app.loadFromHash()
    const shared = app.get().world.cutout.rgba === rgba
    await app.saveToShelf()
    app.removeThing(app.get().world.things[0].id)
    const removed = !app.get().world.cutout
    await app.openSaved(app.get().saved[0])
    const saved = app.get().world.cutout.rgba === rgba
    return { hits, opacity, undone, redone, shared, removed, saved }
  })
  assert.deepEqual(results.hits, ["thing", "thing", "sky", "sky"])
  assert.ok(results.opacity.every((v, i, a) => !i || v > a[i - 1] + 12))
  for (const check of ["undone", "redone", "shared", "removed", "saved"]) assert.equal(results[check], true, check)
  assert.deepEqual(errors, [])
  console.log("Cutout import, undo, picking, fractional alpha, sharing and shelf checks passed.")
} finally {
  await chromium.close()
  server.close()
}
