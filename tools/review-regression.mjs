// Exercise saved worlds, custom fonts and model replacement in the built editor.
import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { browser, serve } from "./serve.mjs"

const server = await serve()
let chromium
try {
  chromium = await browser()
  const page = await chromium.newPage({ viewport: { width: 1180, height: 780 } })
  const errors = []
  page.on("pageerror", error => errors.push(error.message))
  await page.goto(server.url)
  await page.waitForFunction(() => window.__app?.engine?.ok)

  const shelf = () => page.evaluate(() => window.__app.get().saved.map(({ id, code }) => ({ id, code })))
  const add = page.getByTestId("shelf-add")
  await add.click()
  await page.waitForFunction(() => window.__app.get().saved.length === 1)
  const [first] = await shelf()
  await page.evaluate(() => window.__app.edit("variant", w => { w.cam.dist += 2 }))
  await add.click()
  await page.waitForFunction(() => window.__app.get().saved.length === 2)
  const [second, original] = await shelf()
  assert.deepEqual(original, first)
  assert.notEqual(second.id, first.id)
  assert.notEqual(second.code, first.code)
  await page.getByRole("button", { name: /^Replace .* with the current world$/ }).nth(1).click()
  await page.waitForFunction(() => {
    const [a, b] = window.__app.get().saved
    return a.code === b.code
  })
  await page.reload()
  await page.waitForFunction(() => window.__app?.engine?.ok)
  assert.deepEqual(await shelf(), [second, { id: first.id, code: second.code }])

  const bytes = await readFile(new URL("../node_modules/@fontsource/anton/files/anton-latin-400-normal.woff2", import.meta.url))
  const fontChecks = await page.evaluate(async bytes => {
    const font = new File([new Uint8Array(bytes)], "letters.woff2", { type: "font/woff2" })
    const first = await window.__text.loadCustomFont(font)
    const depth = window.__app.get().past.length
    const again = await window.__text.loadCustomFont(font)
    return [first, again, window.__app.get().past.length === depth]
  }, Array.from(bytes))
  assert.deepEqual(fontChecks, [true, true, true])

  const modelChecks = await page.evaluate(async () => {
    const store = window.__app
    const snapshot = () => JSON.stringify(store.get().world)
    const load = (name, height) => window.__io.importModel(new File([
      'v 0 0 0\nv 1 0 0\nv 0 ' + height + ' 0\nv 0 0 1\nf 1 3 2\nf 1 2 4\nf 2 3 4\nf 3 1 4'
    ], name + ".obj"))
    const first = await load("First", 1)
    const before = snapshot()
    const second = await load("Second", 2)
    const after = snapshot()
    store.undo()
    const restored = snapshot() === before
    store.redo()
    return [first, second, after !== before, restored, snapshot() === after]
  })
  assert.deepEqual(modelChecks, [true, true, true, true, true])
  assert.deepEqual(errors, [])
  console.log("Passed shelf add, targeted replace and reload, repeat font selection, model undo and redo.")
} finally {
  try { await chromium?.close() } finally { server.close() }
}
