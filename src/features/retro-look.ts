// The look of a 1994 home computer: a fixed 256-colour palette with ordered dithering, a tiny
// bitmap font for the status line, and a small WebGL picture tube (glow, scanlines, a gently
// curved glass). All original.

export const SW = 640, SH = 480

// ---------- 256 colours ----------
// A 6 x 7 x 6 colour cube (252 colours: green gets one more step, as eyes see it best) and four greys.
const LR = 6, LG = 7, LB = 6
export const GREYS = [64, 128, 192, 224]
export const PALETTE: [number, number, number][] = []
for (let r = 0; r < LR; r++) for (let g = 0; g < LG; g++) for (let b = 0; b < LB; b++) PALETTE.push([Math.round((r * 255) / (LR - 1)), Math.round((g * 255) / (LG - 1)), Math.round((b * 255) / (LB - 1))])
for (const v of GREYS) PALETTE.push([v, v, v])
/** The nearest palette colour, as CSS: the status line only ever uses colours the palette has. */
export function pal(r: number, g: number, b: number) {
  let best = 0, bd = 1e9; PALETTE.forEach((p, i) => { const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2; if (d < bd) { bd = d; best = i } })
  const p = PALETTE[best]; return `rgb(${p[0]},${p[1]},${p[2]})`
}

// an 8 x 8 ordered-dither threshold map, built by the usual recursive rule
const BAYER = (() => { let m = [[0]]; for (let n = 1; n < 8; n *= 2) m = [...m.map((row) => [...row.map((v) => v * 4), ...row.map((v) => v * 4 + 2)]), ...m.map((row) => [...row.map((v) => v * 4 + 3), ...row.map((v) => v * 4 + 1)])]; return m.flat().map((v) => (v + 0.5) / 64) })()

/** Snap a picture to the palette with an ordered dither, in place. */
export function dither(img: ImageData) {
  const d = img.data, w = img.width
  for (let i = 0, n = d.length / 4; i < n; i++) {
    const t = BAYER[((Math.floor(i / w) & 7) << 3) | (i % w & 7)], o = i * 4
    d[o] = Math.min(LR - 1, Math.floor((d[o] / 255) * (LR - 1) + t)) * (255 / (LR - 1))
    d[o + 1] = Math.min(LG - 1, Math.floor((d[o + 1] / 255) * (LG - 1) + t)) * (255 / (LG - 1))
    d[o + 2] = Math.min(LB - 1, Math.floor((d[o + 2] / 255) * (LB - 1) + t)) * (255 / (LB - 1))
    d[o + 3] = 255
  }
  return img
}
/** How many different colours a picture uses (for the tests). */
export function countColours(img: ImageData) { const s = new Set<number>(), d = img.data; for (let o = 0; o < d.length; o += 4) s.add((d[o] << 16) | (d[o + 1] << 8) | d[o + 2]); return s.size }

// ---------- a 5 x 7 bitmap font ----------
const F: Record<string, string> = {
  A: "01110 10001 10001 11111 10001 10001 10001", B: "11110 10001 10001 11110 10001 10001 11110", C: "01110 10001 10000 10000 10000 10001 01110",
  D: "11100 10010 10001 10001 10001 10010 11100", E: "11111 10000 10000 11110 10000 10000 11111", F: "11111 10000 10000 11110 10000 10000 10000",
  G: "01110 10001 10000 10111 10001 10001 01111", H: "10001 10001 10001 11111 10001 10001 10001", I: "01110 00100 00100 00100 00100 00100 01110",
  J: "00111 00010 00010 00010 00010 10010 01100", K: "10001 10010 10100 11000 10100 10010 10001", L: "10000 10000 10000 10000 10000 10000 11111",
  M: "10001 11011 10101 10101 10001 10001 10001", N: "10001 10001 11001 10101 10011 10001 10001", O: "01110 10001 10001 10001 10001 10001 01110",
  P: "11110 10001 10001 11110 10000 10000 10000", Q: "01110 10001 10001 10001 10101 10010 01101", R: "11110 10001 10001 11110 10100 10010 10001",
  S: "01111 10000 10000 01110 00001 00001 11110", T: "11111 00100 00100 00100 00100 00100 00100", U: "10001 10001 10001 10001 10001 10001 01110",
  V: "10001 10001 10001 10001 10001 01010 00100", W: "10001 10001 10001 10101 10101 10101 01010", X: "10001 10001 01010 00100 01010 10001 10001",
  Y: "10001 10001 10001 01010 00100 00100 00100", Z: "11111 00001 00010 00100 01000 10000 11111",
  0: "01110 10001 10011 10101 11001 10001 01110", 1: "00100 01100 00100 00100 00100 00100 01110", 2: "01110 10001 00001 00010 00100 01000 11111",
  3: "11111 00010 00100 00010 00001 10001 01110", 4: "00010 00110 01010 10010 11111 00010 00010", 5: "11111 10000 11110 00001 00001 10001 01110",
  6: "00110 01000 10000 11110 10001 10001 01110", 7: "11111 00001 00010 00100 01000 01000 01000", 8: "01110 10001 10001 01110 10001 10001 01110",
  9: "01110 10001 10001 01111 00001 00010 01100",
  ".": "00000 00000 00000 00000 00000 01100 01100", ",": "00000 00000 00000 00000 01100 00100 01000", ":": "00000 01100 01100 00000 01100 01100 00000",
  "%": "11000 11001 00010 00100 01000 10011 00011", "/": "00000 00001 00010 00100 01000 10000 00000", "-": "00000 00000 00000 11111 00000 00000 00000",
  "+": "00000 00100 00100 11111 00100 00100 00000", "(": "00010 00100 01000 01000 01000 00100 00010", ")": "01000 00100 00010 00010 00010 00100 01000",
  "[": "01110 01000 01000 01000 01000 01000 01110", "]": "01110 00010 00010 00010 00010 00010 01110", "'": "00100 00100 01000 00000 00000 00000 00000",
  "!": "00100 00100 00100 00100 00100 00000 00100", "?": "01110 10001 00001 00010 00100 00000 00100", ">": "01000 00100 00010 00001 00010 00100 01000",
  "<": "00010 00100 01000 10000 01000 00100 00010", "=": "00000 00000 11111 00000 11111 00000 00000", _: "00000 00000 00000 00000 00000 00000 11111",
  "*": "00000 00100 10101 01110 10101 00100 00000", "#": "01010 01010 11111 01010 11111 01010 01010", "\"": "01010 01010 01010 00000 00000 00000 00000", "&": "01100 10010 10100 01000 10101 10010 01101",
}
const GLYPHS = new Map(Object.entries(F).map(([k, v]) => [k, v.split(" ").map((row) => parseInt(row, 2))]))
/** Write in the bitmap font. Returns where the text ends. */
export function write(x: CanvasRenderingContext2D, text: string, left: number, top: number, color: string, s = 1) {
  x.fillStyle = color; let at = left
  for (const ch of text.toUpperCase()) { const g = GLYPHS.get(ch)
    if (g) g.forEach((bits, row) => { for (let col = 0; col < 5; col++) if (bits & (16 >> col)) x.fillRect(at + col * s, top + row * s, s, s) })
    at += 6 * s }
  return at
}
export const textWidth = (text: string, s = 1) => text.length * 6 * s

// ---------- the picture tube ----------
const VS = `#version 300 es
in vec2 p; out vec2 uv; void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`
const FS = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform sampler2D uSharp; uniform sampler2D uSoft; uniform vec2 uRes; uniform float uGlow, uLines, uCurve;
const vec2 SCREEN = vec2(${SW}.0, ${SH}.0);
vec3 lin(vec3 c) { return c * c; }
void main() {
  vec2 c = uv * 2.0 - 1.0;
  c *= 1.0 + uCurve * vec2(0.028, 0.04) * (c.yx * c.yx);            // the glass bulges a little
  vec2 q = vec2(c.x, -c.y) * 0.5 + 0.5;                                // screen texture runs top down
  vec2 edge = smoothstep(vec2(0.0), vec2(0.004 + 0.006 * uCurve), q) * smoothstep(vec2(0.0), vec2(0.004 + 0.006 * uCurve), 1.0 - q);
  if (q.x < 0.0 || q.y < 0.0 || q.x > 1.0 || q.y > 1.0) { o = vec4(0.012, 0.012, 0.016, 1.0); return; }
  // on a screen smaller than 640 x 480 the dots are averaged rather than skipped, so the dither does not shimmer
  float line = q.y * SCREEN.y, d = max(fwidth(line), 1e-4);
  vec3 sharp = lin(mix(texture(uSoft, q).rgb, texture(uSharp, q).rgb, smoothstep(0.8, 1.2, 1.0 / d)));
  // a beam is a little soft side to side, and bright things spill light around them
  vec2 h = vec2(0.45 / SCREEN.x, 0.0);
  vec3 soft = 0.5 * (lin(textureLod(uSoft, q - h, 0.0).rgb) + lin(textureLod(uSoft, q + h, 0.0).rgb));
  vec3 col = mix(sharp, soft, 0.45 * uGlow);
  vec3 halo = lin(textureLod(uSoft, q, 2.5).rgb) * 0.6 + lin(textureLod(uSoft, q, 4.0).rgb) * 0.4;
  col += halo * uGlow * 0.32;
  // scanlines: the beam is thin on dark lines and swells on bright ones. Each pixel averages the
  // beam over its own height, and the lines fade out when the screen is too small to show them.
  float lum = dot(col, vec3(0.3, 0.55, 0.15));
  float w = mix(0.3, 0.5, clamp(lum, 0.0, 1.0)), beam = 0.0;
  for (int i = 0; i < 4; i++) { float y = fract(line + (float(i) - 1.5) * 0.25 * d) - 0.5; beam += exp(-(y * y) / (2.0 * w * w)); }
  beam = beam * 0.25 / (w * 2.5066);                                   // the beam carries the same light, just in lines
  col *= mix(1.0, beam, uLines * 0.8 * smoothstep(1.3, 2.2, 1.0 / d));
  col *= 1.0 - uCurve * 0.22 * dot(c * c, vec2(0.5, 0.6));          // darker toward the corners
  col *= mix(1.0, edge.x * edge.y, uCurve);
  o = vec4(sqrt(max(col, 0.0)), 1.0);
}`

export interface Tube { draw(screen: HTMLCanvasElement, o: { glow: boolean; lines: boolean; curve: boolean }): void; dispose(): void; ok: boolean }
/** A small WebGL program that shows the 640 x 480 screen on a canvas the way a monitor would. */
export function tube(canvas: HTMLCanvasElement): Tube {
  const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: true, antialias: false, alpha: false, premultipliedAlpha: false })
  if (!gl) return { draw: () => {}, dispose: () => {}, ok: false }
  const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error("SHADER tube", gl.getShaderInfoLog(s)); return s }
  const prog = gl.createProgram()!; gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog)
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao); const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texStorage2D(gl.TEXTURE_2D, 6, gl.RGBA8, SW, SH)
  const near = gl.createSampler()!, smooth = gl.createSampler()!
  for (const [s, mag, min] of [[near, gl.NEAREST, gl.NEAREST], [smooth, gl.LINEAR, gl.LINEAR_MIPMAP_LINEAR]] as const) { gl.samplerParameteri(s, gl.TEXTURE_MAG_FILTER, mag); gl.samplerParameteri(s, gl.TEXTURE_MIN_FILTER, min); gl.samplerParameteri(s, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.samplerParameteri(s, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE) }
  const u = (n: string) => gl.getUniformLocation(prog, n)
  return {
    ok: true,
    draw(screen, o) {
      gl.bindTexture(gl.TEXTURE_2D, tex); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, screen); gl.generateMipmap(gl.TEXTURE_2D)
      gl.viewport(0, 0, canvas.width, canvas.height); gl.useProgram(prog); gl.bindVertexArray(vao)
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.bindSampler(0, near)
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tex); gl.bindSampler(1, smooth)
      gl.uniform1i(u("uSharp"), 0); gl.uniform1i(u("uSoft"), 1); gl.uniform2f(u("uRes"), canvas.width, canvas.height)
      gl.uniform1f(u("uGlow"), o.glow ? 1 : 0); gl.uniform1f(u("uLines"), o.lines ? 1 : 0); gl.uniform1f(u("uCurve"), o.curve ? 1 : 0)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    },
    dispose() { gl.getExtension("WEBGL_lose_context")?.loseContext() },
  }
}
