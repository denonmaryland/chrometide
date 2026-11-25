function carving() {
  const n = 48
  const slices = Array<string>(n)
  const heights = new Float32Array(n * n)
  const coord = (i: number) => (i + 0.5) * 2 / n - 1
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const x = coord(col), y = coord(row)
      // Contours around two offshore banks join into one ridge at low water.
      const a = Math.hypot((x + 0.29) * 1.08, (y - 0.15) * 0.81)
      const b = Math.hypot((x - 0.32) * 1.29, (y + 0.27) * 1.08)
      const contour = Math.min(a, b) + 0.048 * Math.sin(5 * y + 2 * x)
      const wave = 0.5 + 0.5 * Math.cos(25 * contour)
      const border = Math.max(Math.abs(x) / 0.87, Math.abs(y) / 0.9)
      const inset = Math.min(1, Math.max(0, (0.94 - border) * 12))
      heights[row * n + col] = 0.08 + 0.23 * wave * wave * inset
    }
  }
  for (let z = 0; z < n; z++) {
    const bytes = new Uint8Array(n * n)
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const face = (coord(z) - heights[y * n + x]) * 0.40
      const edge = Math.max(Math.abs(coord(x)) - 0.87, Math.abs(coord(y)) - 0.9)
      const distance = Math.max(edge, -0.14 - coord(z), face)
      bytes[y * n + x] = Math.round(Math.max(0, Math.min(1, distance + 0.5)) * 255)
    }
    slices[z] = String.fromCharCode(...bytes)
  }
  return { n, data: btoa(slices.join("")) }
}

let cached: ReturnType<typeof carving> | undefined

export function tidalCarving() {
  cached ??= carving()
  return { ...cached }
}
