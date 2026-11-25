// Runs the ray tracer: a blocky picture at once, then full passes that sweep down the frame and
// are averaged, so the image sharpens the longer you leave it. three.js owns the canvas, targets,
// camera maths and the wireframes.
import * as THREE from "three"

import { LH, LW, glyphLayer, titleField } from "./lettering"
import { type Land, type Camera, MAX_TERRAINS, type Material, type Thing, type World, KINDS, ROLES, SEA_KINDS, TEXTURES } from "./scene"
import { DISPLAY_FRAG, MAT_COLS, MAXO, TRACE_FRAG, VERT } from "./shader"
import { SHAPES, SHAPE_BY_ID } from "./shapes"

export type Phase = "moving" | "blocks" | "refining" | "done"
export interface Status { phase: Phase; samples: number; target: number }
export interface Hit { kind: "sky" | "sea" | "land" | "thing" | "title"; id?: string; point: [number, number, number]; dist: number }
const GLYPHS = 24 // pieces of lettering that can be on screen at once
export const GRID = 128 // the hand-sculpted land is a grid this many cells across
export const QUALITY = [
  { name: "Draft", samples: 4 }, { name: "Good", samples: 16 }, { name: "Fine", samples: 48 }, { name: "Premium", samples: 160 },
]

const hex = (h: string): [number, number, number] => {
  const m = /^#?([0-9a-f]{6})$/i.exec(h ?? ""); const s = m ? m[1] : "888888"
  return [0, 2, 4].map((i) => Math.pow(parseInt(s.slice(i, i + 2), 16) / 255, 2.2)) as [number, number, number]
}
const num = (v: unknown, d: number, lo = -1e4, hi = 1e4) => (typeof v === "number" && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d)
const dir = (az: number, el: number) => new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az))

export function camBasis(c: Camera, aspectMin = 1) {
  const tgt = new THREE.Vector3(...c.target)
  const pos = new THREE.Vector3().setFromSphericalCoords(c.dist, Math.PI / 2 - c.pitch, c.yaw).add(tgt)
  const fw = tgt.clone().sub(pos).normalize()
  let rt = new THREE.Vector3().crossVectors(fw, new THREE.Vector3(0, 1, 0)).normalize()
  let up = new THREE.Vector3().crossVectors(rt, fw)
  if (c.roll) { const a = THREE.MathUtils.degToRad(c.roll); const r2 = rt.clone().multiplyScalar(Math.cos(a)).addScaledVector(up, Math.sin(a)); up = up.clone().multiplyScalar(Math.cos(a)).addScaledVector(rt, -Math.sin(a)); rt = r2 }
  const focal = 1 / Math.tan(THREE.MathUtils.degToRad(Math.min(170, Math.max(5, c.fov))) / 2) / aspectMin
  return { pos, fw, rt, up, focal }
}

const WIRE: Record<string, (r: number) => THREE.BufferGeometry> = {
  sphere: () => new THREE.WireframeGeometry(new THREE.SphereGeometry(1, 12, 8)),
  box: () => new THREE.EdgesGeometry(new THREE.BoxGeometry(2, 2, 2)),
  pyramid: () => new THREE.EdgesGeometry(new THREE.ConeGeometry(Math.SQRT2, 2, 4).rotateY(Math.PI / 4)),
  cylinder: () => new THREE.EdgesGeometry(new THREE.CylinderGeometry(1, 1, 2, 16), 20),
  cone: () => new THREE.EdgesGeometry(new THREE.ConeGeometry(1, 2, 16), 20),
  torus: () => new THREE.WireframeGeometry(new THREE.TorusGeometry(0.75, 0.25, 6, 20).rotateX(Math.PI / 2)),
  disc: () => new THREE.EdgesGeometry(new THREE.CylinderGeometry(1, 1, 2, 20), 20),
  stone: () => new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.85, 1)),
  blob: () => new THREE.WireframeGeometry(new THREE.SphereGeometry(1, 10, 6)),
  tree: () => new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.7, 1).translate(0, 0.3, 0)),
  pine: () => new THREE.EdgesGeometry(new THREE.ConeGeometry(0.8, 1.8, 8).translate(0, 0.1, 0), 20),
  crag: () => new THREE.EdgesGeometry(new THREE.CylinderGeometry(1, 0.2, 1.6, 10), 20),
  cutout: () => new THREE.EdgesGeometry(new THREE.PlaneGeometry(2, 2)),
  model: () => new THREE.EdgesGeometry(new THREE.BoxGeometry(2, 2, 2)),
  text: () => new THREE.EdgesGeometry(new THREE.BoxGeometry(2, 2, 2)),
  ...Object.fromEntries(SHAPES.map((s) => [s.id, s.wire])),
}

export class Engine {
  readonly canvas: HTMLCanvasElement
  readonly ok: boolean
  error = ""
  private r!: THREE.WebGLRenderer
  private u: Record<string, { value: any }> = {}
  private traceScene = new THREE.Scene(); private showScene = new THREE.Scene(); private cam = new THREE.Camera()
  private traceMat!: THREE.RawShaderMaterial; private showMat!: THREE.RawShaderMaterial
  private low!: THREE.WebGLRenderTarget; private acc!: THREE.WebGLRenderTarget; private pickRT: THREE.WebGLRenderTarget | null = null
  private matTex!: THREE.DataTexture; private matData = new Float32Array(MAT_COLS * (MAXO + 1) * 4)
  private letterTex: THREE.DataTexture | null = null; private letterKey = ""
  private sculptTex!: THREE.DataArrayTexture; private sculptKeys: (string | undefined)[] = []
  private terrainIds: (string | undefined)[] = []
  private glyphTex!: THREE.DataArrayTexture; private glyphs = new Map<string, { layer: number; uw: number; uh: number }>()
  /** when set, things with a move (rise, wave) and bobbing things follow this moment of the loop, 0 to 1 */
  livePhase: number | null = null
  /** live mode, for music: every frame is a quick whole picture, as large as the graphics chip can keep smooth */
  live = false; private liveDiv = 3
  private cutoutTex?: THREE.DataTexture
  private cutoutKey?: World["cutout"]
  private picTex!: THREE.Texture; private picKey = ""; private modelTex!: THREE.Data3DTexture; private modelKey = ""
  private wireScene = new THREE.Scene(); private wireCam = new THREE.PerspectiveCamera(); private wires = new Map<string, THREE.LineSegments>()
  private float = false
  private world: World | null = null; private ids: string[] = []
  private w = 2; private h = 2
  private dirty = true; private lastChange = 0; private moving = false
  private stage = 0; private sample = 0; private scan = 0; private rows = 48; private target = 16
  private raf = 0; private lastTick = 0; private paused = false
  private selected: string | null = null; private showWires = true
  time = 0
  onStatus: (s: Status) => void = () => {}
  private lastStatus = ""

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    try {
      this.r = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: "high-performance" })
    } catch {
      this.ok = false; this.error = "This browser could not start 3D graphics (WebGL2). Try a current Chrome, Firefox, Edge or Safari, or turn on hardware acceleration in the browser's settings."; return
    }
    canvas.addEventListener("webglcontextlost", this.onLost); canvas.addEventListener("webglcontextrestored", this.onRestored)
    const r = this.r; r.setPixelRatio(1); r.autoClear = false; r.outputColorSpace = THREE.LinearSRGBColorSpace
    this.float = !!r.getContext().getExtension("EXT_color_buffer_float")
    const V3 = ["uCamPos", "uCamFw", "uCamRt", "uCamUp", "uZenith", "uHorizon", "uHazeCol", "uSunCol", "uSunDir", "uCloudCol", "uCloud2Col", "uFogCol", "uMoonDir", "uG1", "uG2", "uTitleBox", "uCometDir", "uPRo", "uPRd"]
    const F1 = ["uSample", "uPreview", "uMode", "uLDR", "uBounces", "uBlend", "uTime", "uFocal", "uLens", "uFocus", "uPanoYaw", "uProj", "uHaze", "uHazeStart", "uCloud", "uStreak", "uCloudScale", "uCloud2", "uStars", "uSkySeed", "uSunSize", "uSunGlow", "uSunSoft", "uAmbient",
      "uFog", "uFogH", "uMoon", "uMoonSize", "uMoonPhase", "uRainbow", "uHalo", "uGround", "uWave", "uCalmPatches", "uRippleWidth", "uRippleAngle", "uGrain", "uGRefl", "uGScale", "uTerrainCount", "uNObj", "uNLight", "uRays", "uComet", "uGridHalf"]
    V3.forEach((n) => (this.u[n] = { value: new THREE.Vector3() })); F1.forEach((n) => (this.u[n] = { value: 0 }))
    this.u.uRes = { value: new THREE.Vector2(2, 2) }; this.u.uPickUV = { value: new THREE.Vector2() }
    this.u.uGridCenter = { value: new THREE.Vector2() }
    this.u.uTerrains = { value: Array.from({ length: MAX_TERRAINS }, () => ({
      centerRadius: new THREE.Vector4(), shape: new THREE.Vector4(), carve: new THREE.Vector4(),
      snow: new THREE.Vector4(), channel: new THREE.Vector4(), flags: new THREE.Vector4(),
      sand: new THREE.Vector3(), grass: new THREE.Vector3(), rock: new THREE.Vector3(),
    })) }
    this.u.uTitlePose = { value: new THREE.Vector4() }
    for (const n of ["uOP", "uOS", "uR0", "uR1", "uR2"]) this.u[n] = { value: Array.from({ length: MAXO }, () => new THREE.Vector4()) }
    this.u.uLP = { value: Array.from({ length: 4 }, () => new THREE.Vector4()) }; this.u.uLC = { value: Array.from({ length: 4 }, () => new THREE.Vector3()) }; this.u.uLD = { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, -1, 0, -2)) }
    this.matTex = new THREE.DataTexture(this.matData, MAT_COLS, MAXO + 1, THREE.RGBAFormat, THREE.FloatType); this.matTex.needsUpdate = true
    this.u.uMat = { value: this.matTex }
    const blank = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat); blank.needsUpdate = true
    this.u.uLetters = { value: blank }
    this.glyphTex = new THREE.DataArrayTexture(new Uint8Array(LW * LH * GLYPHS).fill(255), LW, LH, GLYPHS); this.glyphTex.format = THREE.RedFormat; this.glyphTex.minFilter = this.glyphTex.magFilter = THREE.LinearFilter; this.glyphTex.unpackAlignment = 1; this.glyphTex.needsUpdate = true; this.u.uGlyph = { value: this.glyphTex }
    this.u.uCutout = { value: null }; this.picTex = blank; this.u.uPic = { value: blank }
    this.modelTex = new THREE.Data3DTexture(new Uint8Array([255]), 1, 1, 1); this.modelTex.format = THREE.RedFormat; this.modelTex.unpackAlignment = 1; this.modelTex.needsUpdate = true; this.u.uModel = { value: this.modelTex }
    this.sculptTex = new THREE.DataArrayTexture(new Uint8Array(GRID * GRID * MAX_TERRAINS).fill(128), GRID, GRID, MAX_TERRAINS)
    this.sculptTex.format = THREE.RedFormat
    this.sculptTex.magFilter = this.sculptTex.minFilter = THREE.LinearFilter; this.sculptTex.needsUpdate = true
    this.u.uSculpt = { value: this.sculptTex }
    const tri = new THREE.BufferGeometry(); tri.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3))
    this.traceMat = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: TRACE_FRAG, uniforms: this.u, depthTest: false, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.ZeroFactor, transparent: true })
    const tm = new THREE.Mesh(tri, this.traceMat); tm.frustumCulled = false; this.traceScene.add(tm)
    const opt = { depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false }
    this.low = new THREE.WebGLRenderTarget(2, 2, opt)
    this.acc = new THREE.WebGLRenderTarget(2, 2, { ...opt, type: this.float ? THREE.HalfFloatType : THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter })
    if (this.float) this.pickRT = new THREE.WebGLRenderTarget(1, 1, { ...opt, type: THREE.FloatType })
    this.showMat = new THREE.RawShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: DISPLAY_FRAG, depthTest: false, depthWrite: false,
      uniforms: { tLow: { value: this.low.texture }, tAcc: { value: this.acc.texture }, uRes: { value: new THREE.Vector2(2, 2) }, uScanY: { value: 0 }, uHave: { value: 0 }, uAccLDR: { value: this.float ? 0 : 1 }, uBloom: { value: 0 } } })
    const sm = new THREE.Mesh(tri, this.showMat); sm.frustumCulled = false; this.showScene.add(sm)
    let bad = ""
    r.debug.onShaderError = (gl, _p, _vs, fs) => { bad = gl.getShaderInfoLog(fs) || "shader error"; console.error("SHADER", bad) }
    r.compile(this.traceScene, this.cam)
    this.ok = !bad; this.error = bad ? "The renderer could not start on this graphics chip." : ""
    this.raf = requestAnimationFrame(this.tick)
  }

  dispose() {
    cancelAnimationFrame(this.raf); clearTimeout(this.lostTimer); this.canvas.removeEventListener("webglcontextlost", this.onLost); this.canvas.removeEventListener("webglcontextrestored", this.onRestored)
    this.cutoutTex?.dispose()
    this.low?.dispose(); this.acc?.dispose(); this.pickRT?.dispose(); this.matTex?.dispose(); this.glyphTex?.dispose(); this.sculptTex?.dispose(); this.modelTex?.dispose(); this.letterTex?.dispose()
    if (this.picTex !== this.u.uPic?.value) (this.u.uPic?.value as THREE.Texture | undefined)?.dispose()
    for (const l of this.wires.values()) { l.geometry.dispose(); (l.material as THREE.Material).dispose() } this.wires.clear()
    this.r?.dispose(); this.r?.forceContextLoss() // give the context back now: a browser allows only a few, and takes the oldest (the editor's) when there are too many
  }
  // ---------- when the graphics chip lets go ----------
  // A browser may take the 3D context away (a driver reset, too many tabs, a sleeping laptop). three.js
  // forgets its textures and targets and makes them again from what it keeps; the picture starts over.
  /** "lost" while waiting, "back" once drawing again, "gone" if it has not come back after a while. */
  onContext: (s: "lost" | "back" | "gone") => void = () => {}
  /** true while there is no 3D context to draw with */
  lost = false
  private lostTimer = 0
  private onLost = (e: Event) => {
    e.preventDefault(); this.lost = true; this.onContext("lost"); clearTimeout(this.lostTimer)
    this.lostTimer = window.setTimeout(() => { if (this.lost) this.onContext("gone") }, 5000)
  }
  private onRestored = () => {
    this.lost = false; clearTimeout(this.lostTimer)
    this.lastStatus = ""; this.touch(); this.onContext("back")
  }
  pause(p: boolean) { this.paused = p }
  get size() { return { w: this.w, h: this.h } }

  setSize(w: number, h: number) {
    w = Math.max(2, Math.round(w)); h = Math.max(2, Math.round(h))
    if (w === this.w && h === this.h) return
    this.w = w; this.h = h; this.r.setSize(w, h, false); this.acc.setSize(w, h); this.touch()
  }
  setQuality(samples: number) { this.target = samples; this.status() }
  setWorld(w: World, opts: { soft?: boolean } = {}) { this.world = w; this.touch(opts.soft) }
  setSelected(id: string | null) { this.selected = id }
  setWires(on: boolean) { this.showWires = on }
  /** Something changed: go back to the quick picture and start sharpening again once it is still. */
  touch(soft = false) { this.dirty = true; if (!soft) this.lastChange = performance.now() }

  // ---------- world -> uniforms ----------
  /** Forget every drawn letter (after a font arrives), so they are drawn again. */
  resetGlyphs() { this.glyphs.clear(); this.touch() }
  private glyphFor(str: string, font: string) {
    const key = font + "|" + str; let g = this.glyphs.get(key)
    if (!g) { if (this.glyphs.size >= GLYPHS) this.glyphs.clear()
      const made = glyphLayer(str, font), layer = this.glyphs.size; (this.glyphTex.image.data as Uint8Array).set(made.data, layer * LW * LH); this.glyphTex.needsUpdate = true
      g = { layer, uw: made.uw, uh: made.uh }; this.glyphs.set(key, g) }
    return g
  }
  private upload(w: World, vw: number, vh: number, time = this.time, moment: number | null = this.livePhase) {
    const phase = moment ?? time
    const u = this.u, v3 = (n: string, c: [number, number, number] | THREE.Vector3) => (c instanceof THREE.Vector3 ? u[n].value.copy(c) : u[n].value.set(c[0], c[1], c[2]))
    const s = w.sky, night = s.stars > 0.5 ? 0.6 : 1.25
    const b = camBasis(w.cam); v3("uCamPos", b.pos); b.pos.y = Math.max(b.pos.y, 0.25); u.uCamPos.value.y = b.pos.y
    v3("uCamFw", b.fw); v3("uCamRt", b.rt); v3("uCamUp", b.up); u.uFocal.value = b.focal
    u.uLens.value = num(w.cam.lens, 0, 0, 2); u.uFocus.value = num(w.cam.focus, 16, 0.5, 500); u.uProj.value = w.cam.pano ? 1 : 0; u.uPanoYaw.value = w.cam.yaw + Math.PI
    v3("uZenith", hex(s.zenith)); v3("uHorizon", hex(s.horizon)); v3("uHazeCol", hex(s.haze)); v3("uSunCol", hex(s.sunColor).map((x) => x * night) as [number, number, number])
    v3("uSunDir", dir(s.sun.az, Math.max(0.02, s.sun.el))); v3("uCloudCol", hex(s.cloudColor)); v3("uCloud2Col", hex(s.cloud2Color)); v3("uFogCol", hex(s.fogColor)); v3("uMoonDir", dir(s.moonAz, s.moonEl))
    u.uHazeStart.value = num(s.hazeStart, 0, 0, 200)
    u.uHaze.value = num(s.hazeAmt, 0.4, 0, 1); u.uCloud.value = num(s.cloud, 0, 0, 1); u.uStreak.value = num(s.streak, 0, 0, 1); u.uCloudScale.value = num(s.cloudScale, 1, 0.2, 4); u.uCloud2.value = num(s.cloud2, 0, 0, 1)
    u.uStars.value = num(s.stars, 0, 0, 3); u.uSkySeed.value = num(s.seed, 0); u.uSunSize.value = num(s.sunSize, 0.0245, 0.004, 0.3); u.uSunGlow.value = num(s.sunGlow, 1, 0, 4); u.uSunSoft.value = num(s.sunSoft, 0, 0, 0.2)
    u.uAmbient.value = num(s.ambient, 0.5, 0, 1.5); u.uFog.value = num(s.fog, 0, 0, 1); u.uFogH.value = num(s.fogHeight, 1.2, 0.1, 20); u.uMoon.value = num(s.moon, 0, 0, 2); u.uMoonSize.value = num(s.moonSize, 0.06, 0.01, 0.4)
    u.uMoonPhase.value = num(s.moonPhase, 0.5, 0, 1); u.uRainbow.value = num(s.rainbow, 0, 0, 1); u.uHalo.value = num(s.halo, 0, 0, 1); u.uTime.value = time
    const g = w.sea; u.uGround.value = Math.max(0, SEA_KINDS.indexOf(g.kind)); v3("uG1", hex(g.c1)); v3("uG2", hex(g.c2))
    u.uCalmPatches.value = num(g.calmPatches, 0, 0, 1)
    u.uRippleWidth.value = num(g.rippleWidth, 1, 1, 10)
    u.uRippleAngle.value = num(g.rippleAngle, 0, -180, 180) * Math.PI / 180
    u.uWave.value = num(g.wave, 0.3, 0, 2); u.uGrain.value = num(g.grain, 0, 0, 1); u.uGRefl.value = num(g.reflect, 0, 0, 1); u.uGScale.value = num(g.scale, 1, 0.05, 20)
    const lands = [w.land, ...(w.terrains ?? [])].slice(0, MAX_TERRAINS).filter(t => t.on && t.height > 0.05)
    this.terrainIds = lands.map(t => "id" in t ? t.id as string : undefined)
    u.uTerrainCount.value = lands.length
    lands.forEach((t, i) => {
      const row = u.uTerrains.value[i], radius = num(t.radius, 8, 1, 60)
      row.centerRadius.set(...(t.pos ?? [0, 0, 0]), radius)
      row.shape.set(num(t.height, 4, 0.05, 40), num(t.freq, .22, .02, 3) * 8 / Math.max(radius, 2) * (t.mode === "range" ? 1.2 : 1), num(t.ridge, .8, 0, 1), num(t.seed, 1) * 13.7)
      row.carve.set(num(t.terrace, 0, 0, 1), num(t.plateau, 0, 0, 1), num(t.sharp, 0, 0, 1), t.channel?.bend ?? 0)
      row.snow.set(num(t.snow, 0, 0, 1), num(t.cliffSnow, 0, 0, 1), THREE.MathUtils.degToRad(num(t.snowFacing, 0, -180, 180)), 0)
      row.flags.set(t.mode === "range" ? 1 : 0, t.flat ? 1 : 0, t.sculpt ? 1 : 0, i)
      const cut = t.channel
      if (cut && t.mode !== "range") { const a = THREE.MathUtils.degToRad(cut.angle); row.channel.set(Math.cos(a), Math.sin(a), cut.offset, cut.width) }
      else row.channel.set(0, 0, 0, 0)
      row.sand.set(...hex(t.c1)); row.grass.set(...hex(t.c2)); row.rock.set(...hex(t.c3))
      if (this.sculptKeys[i] !== t.sculpt) {
        this.sculptKeys[i] = t.sculpt
        const n = GRID * GRID, data = this.sculptTex.image.data as Uint8Array
        let raw = ""
        try { raw = t.sculpt ? atob(t.sculpt) : "" } catch { /* use a flat grid */ }
        for (let j = 0; j < n; j++) data[i * n + j] = j < raw.length ? raw.charCodeAt(j) : 128
        this.sculptTex.needsUpdate = true
      }
    })
    u.uRays.value = num(s.rays, 0, 0, 2); u.uComet.value = num(s.comet, 0, 0, 2); v3("uCometDir", dir(s.seed * 1.3 + 0.7, 0.42 + 0.25 * Math.sin(s.seed * 2.1)))
    this.pictures(w)
    // things
    const things = w.things.filter((x) => !x.hidden && (x.kind !== "cutout" || !!w.cutout)).slice(0, MAXO); this.ids = things.map((x) => x.id)
    const m4 = new THREE.Matrix4(), e = new THREE.Euler(); let nl = 0; const risers = things.filter((x) => x.text?.motion && x.text.motion !== "none")
    things.forEach((o, i) => {
      const ki = Math.max(0, KINDS.indexOf(o.kind)); const sz = o.size.map((x) => Math.max(0.02, num(x, 1, 0, 200))) as [number, number, number]
      let bob = o.bob ? Math.sin(phase * Math.PI * 2 + i * 1.7) * o.bob : 0
      if (moment !== null && o.text?.motion && o.text.motion !== "none") { const order = o.text.order ?? risers.indexOf(o), n = Math.max(1, risers.length)
        if (o.text.motion === "wave") bob += Math.sin((moment - order * 0.11) * Math.PI * 2) * sz[1] * 0.45
        else { const sm = (x: number) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x) }, delay = n > 1 ? (order / (n - 1)) * 0.45 : 0
          bob -= (1 - sm((moment - delay) / 0.22) * (1 - sm((moment - 0.86) / 0.12))) * (Math.max(0, o.pos[1]) + sz[1] + 0.4) } }
      u.uOP.value[i].set(num(o.pos[0], 0), num(o.pos[1], 0) + bob, num(o.pos[2], 0), ki); u.uOS.value[i].set(sz[0], sz[1], sz[2], num(o.round, 0.1, 0, 1))
      e.set(THREE.MathUtils.degToRad(o.rot[1]), THREE.MathUtils.degToRad(o.rot[0] + Math.round(o.spin ?? 0) * phase * 360), THREE.MathUtils.degToRad(o.rot[2]), "YXZ"); m4.makeRotationFromEuler(e)
      const el = m4.elements // columns of the rotation = rows of its inverse
      const bent = o.kind === "text" && o.text && (o.text.bend || o.text.arch)
      const bound = Math.hypot(sz[0], sz[1], sz[2]) * (o.kind === "blob" ? 1.6 : bent ? 1.9 : 1.02) + (o.kind === "blob" ? 0.5 : 0)
      u.uR0.value[i].set(el[0], el[1], el[2], Math.max(0, ROLES.indexOf(o.role))); u.uR1.value[i].set(el[4], el[5], el[6], Math.min(3, Math.max(0, Math.round(o.group || 0)))); u.uR2.value[i].set(el[8], el[9], el[10], bound)
      this.putMat(i, o.mat)
      if (o.kind === "text") { const t = o.text ?? { str: o.name, font: "sans", style: "solid", edge: "round", bevel: 0.03, stroke: 0.035, bend: 0, arch: 0 }, g = this.glyphFor(t.str || " ", t.font), hgt = sz[1] * 2
        this.matData.set([g.layer, g.uw, g.uh, ["solid", "outline", "tube"].indexOf(t.style) + 10 * ["round", "chisel", "sharp"].indexOf(t.edge), num(t.bevel, 0.03, 0, 0.2) * hgt, num(t.stroke, 0.035, 0.005, 0.2) * hgt, THREE.MathUtils.degToRad(num(t.bend, 0, -360, 360)), THREE.MathUtils.degToRad(num(t.arch, 0, -180, 180))], i * MAT_COLS * 4 + 24) }
      if (o.kind !== "cutout" && o.mat.glow > 0 && nl < 4 && o.role === "solid") { const c = hex(o.mat.color), p = o.mat.glow * Math.min(40, 2.5 + sz[0] * sz[0] * 4)
        u.uLP.value[nl].set(o.pos[0], o.pos[1] + bob, o.pos[2], Math.max(...sz)); const beam = num(o.beam, 0, 0, 170), k = beam > 0 ? 2.2 : 1; u.uLC.value[nl].set(c[0] * p * k, c[1] * p * k, c[2] * p * k)
        u.uLD.value[nl].set(-el[4], -el[5], -el[6], beam > 0 ? Math.cos(THREE.MathUtils.degToRad(beam / 2)) : -2); nl++ }
    })
    u.uNObj.value = things.length; u.uNLight.value = nl
    // lettering
    const ti = w.title
    if (ti && ti.text.trim()) {
      const key = ti.text.slice(0, 40)
      if (key !== this.letterKey) { const f = titleField(key); this.letterTex?.dispose(); const tx = new THREE.DataTexture(f.data, f.w, f.h, THREE.RedFormat); tx.magFilter = tx.minFilter = THREE.LinearFilter; tx.unpackAlignment = 1; tx.needsUpdate = true
        this.letterTex = tx; this.letterKey = key; (tx as any).aspect = f.w / f.h }
      const aspect = (this.letterTex as any).aspect as number, hw = num(ti.width, 14, 1, 80) / 2, hh = hw / aspect
      u.uLetters.value = this.letterTex; u.uTitleBox.value.set(hw, hh, num(ti.depth, 0.5, 0.05, 6)); u.uTitlePose.value.set(num(ti.x, 0), hh + num(ti.lift, 0.8, -5, 60), num(ti.z, 0), num(ti.yaw, 0))
      this.putMat(MAXO, ti.mat)
    } else u.uTitleBox.value.set(0, 0, 0)
    this.matTex.needsUpdate = true
    u.uRes.value.set(vw, vh); this.showMat.uniforms.uBloom.value = num(w.bloom, 0, 0, 1.5)
  }
  /** The world's picture (for materials) and imported shape, loaded into textures when they change. */
  private pictures(w: World) {
    const img = w.cutout, old = this.cutoutKey
    if (img?.rgba !== old?.rgba || img?.width !== old?.width || img?.height !== old?.height) {
      this.cutoutTex?.dispose()
      this.cutoutTex = undefined
      this.cutoutKey = img
      if (img) {
        const data = Uint8Array.from(atob(img.rgba), c => c.charCodeAt(0))
        this.cutoutTex = new THREE.DataTexture(data, img.width, img.height)
        this.cutoutTex.needsUpdate = true
      }
      this.u.uCutout.value = this.cutoutTex ?? null
      if (Boolean(img) !== Boolean(old)) {
        this.traceMat.defines = img ? { PNG_CUTOUT: 1 } : {}
        this.traceMat.needsUpdate = true
      }
    }
    const pic = w.picture ?? ""
    if (pic !== this.picKey) { this.picKey = pic
      const was = this.u.uPic.value as THREE.Texture; if (was !== this.picTex) { this.u.uPic.value = this.picTex; was.dispose() } // the last picture's texture is let go
      if (pic.startsWith("data:image/")) { const im = new Image(); im.onload = () => { if (this.picKey !== pic) return; const tx = new THREE.Texture(im); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.minFilter = tx.magFilter = THREE.LinearFilter; tx.generateMipmaps = false; tx.needsUpdate = true; this.u.uPic.value = tx; this.touch() }; im.src = pic } }
    const md = w.model, key = md ? `${md.n}:${md.data.length}:${md.data.slice(0, 64)}` : ""
    if (key !== this.modelKey) { this.modelKey = key
      if (md && md.n >= 4 && md.n <= 64) { try { const raw = atob(md.data), n = md.n, d = new Uint8Array(n * n * n).fill(255); for (let i = 0; i < Math.min(raw.length, d.length); i++) d[i] = raw.charCodeAt(i)
        this.modelTex.dispose(); const tx = new THREE.Data3DTexture(d, n, n, n); tx.format = THREE.RedFormat; tx.minFilter = tx.magFilter = THREE.LinearFilter; tx.unpackAlignment = 1; tx.needsUpdate = true; this.modelTex = tx; this.u.uModel.value = tx } catch { /* a bad model leaves a box */ } } }
  }
  private putMat(row: number, m: Material) {
    const d = this.matData, o = row * MAT_COLS * 4, c = hex(m.color), c2 = hex(m.color2)
    d.set([c[0], c[1], c[2], Math.max(0, TEXTURES.indexOf(m.texture)), c2[0], c2[1], c2[2], num(m.texScale, 1, 0.05, 20),
      num(m.diffuse, 1, 0, 1), num(m.reflect, 0, 0, 1), num(m.metal, 0, 0, 1), num(m.shine, 0.5, 0, 1), num(m.gloss, 0.8, 0, 1), num(m.clear, 0, 0, 1), num(m.ior, 1.33, 1, 2.6), num(m.bump, 0, 0, 1), num(m.glow, 0, 0, 5), num(m.cloud, 0, 0, 1), Math.max(0, TEXTURES.indexOf(m.layer ?? "none")), m.layer && m.layer !== "none" ? num(m.layerMix, 0.5, 0, 1) : 0, ...hex(m.layerColor ?? "#ffffff"), 0], o)
  }

  // ---------- drawing ----------
  private pass(target: THREE.WebGLRenderTarget | null, w: number, h: number, o: { sample: number; preview: boolean; ldr: boolean; blend: number; y?: number; rows?: number; mode?: number }) {
    const u = this.u, r = this.r
    u.uRes.value.set(w, h); u.uSample.value = o.sample; u.uPreview.value = o.preview ? 1 : 0; u.uLDR.value = o.ldr ? 1 : 0; u.uBlend.value = o.blend; u.uMode.value = o.mode ?? this.mode
    u.uBounces.value = o.preview ? 3 : this.bounces
    r.setRenderTarget(target); r.setViewport(0, 0, w, h)
    if (o.rows !== undefined) { r.setScissor(0, o.y!, w, o.rows); r.setScissorTest(true) }
    r.render(this.traceScene, this.cam); r.setScissorTest(false)
  }
  mode = 0 // 0 picture, 1 distance mask, 2 object mask, 3 height mask
  bounces = 4
  private lowPass(div: number) {
    // Keep a large viewport from submitting an entire expensive preview in one draw.
    const scale = Math.max(div, Math.sqrt(this.w * this.h / 40_000))
    const lw = Math.max(2, Math.ceil(this.w / scale)), lh = Math.max(2, Math.ceil(this.h / scale))
    this.low.setSize(lw, lh); this.pass(this.low, lw, lh, { sample: 0, preview: true, ldr: true, blend: 1 })
  }
  private show() {
    const r = this.r, m = this.showMat.uniforms
    m.uRes.value.set(this.w, this.h); m.uScanY.value = this.scan; m.uHave.value = this.sample > 0 ? 2 : this.stage >= 3 && this.scan > 0 ? 1 : 0
    r.setRenderTarget(null); r.setViewport(0, 0, this.w, this.h); r.render(this.showScene, this.cam)
    this.drawWires()
  }
  private drawWires() {
    const w = this.world; if (!w || w.cam.pano || this.live) return
    const all = this.showWires && this.stage < 3 && this.sample === 0 && this.moving
    const want = new Set<string>()
    for (const t of w.things) { if (t.hidden) continue; if (!(all || t.id === this.selected)) continue; want.add(t.id)
      let l = this.wires.get(t.id); const dial = SHAPE_BY_ID[t.kind]?.dial ? Math.round(num(t.round, 0.5, 0, 1) * 50) / 50 : 0, key = `${t.kind}:${dial}` // a shape with a dial is outlined as dialled
      if (!l || l.userData.key !== key) { if (l) { this.wireScene.remove(l); l.geometry.dispose(); (l.material as THREE.Material).dispose() }
        l = new THREE.LineSegments((WIRE[t.kind] ?? WIRE.sphere)(dial), new THREE.LineBasicMaterial({ transparent: true, depthTest: false })); l.userData.key = key; this.wires.set(t.id, l); this.wireScene.add(l) }
      l.position.set(...t.pos); l.scale.set(...t.size); l.rotation.set(THREE.MathUtils.degToRad(t.rot[1]), THREE.MathUtils.degToRad(t.rot[0]), THREE.MathUtils.degToRad(t.rot[2]), "YXZ")
      const mat = l.material as THREE.LineBasicMaterial; const sel = t.id === this.selected
      mat.color.set(sel ? (t.role === "cut" ? 0xff7a5c : 0xffffff) : 0x9fe8ff); mat.opacity = sel ? 0.95 : 0.45; l.visible = true }
    for (const [id, l] of this.wires) if (!want.has(id)) { l.visible = false; if (!w.things.some((t) => t.id === id)) { this.wireScene.remove(l); l.geometry.dispose(); (l.material as THREE.Material).dispose(); this.wires.delete(id) } }
    if (!want.size) return
    const b = camBasis(w.cam), mn = Math.min(this.w, this.h); b.pos.y = Math.max(b.pos.y, 0.25)
    const c = this.wireCam; c.fov = THREE.MathUtils.radToDeg(2 * Math.atan(this.h / mn / b.focal)); c.aspect = this.w / this.h; c.near = 0.05; c.far = 4000
    c.position.copy(b.pos); c.up.copy(b.up); c.lookAt(b.pos.clone().add(b.fw)); c.updateProjectionMatrix()
    this.r.setRenderTarget(null); this.r.render(this.wireScene, c)
  }
  private status() {
    const phase: Phase = this.moving ? "moving" : this.sample >= this.target ? "done" : this.stage < 3 ? "blocks" : "refining"
    const key = `${phase}:${this.sample}:${this.target}`; if (key === this.lastStatus) return
    this.lastStatus = key; this.onStatus({ phase, samples: this.sample, target: this.target })
  }
  get done() { return !this.dirty && !this.moving && this.sample >= this.target }

  private tick = (now: number) => {
    this.raf = requestAnimationFrame(this.tick)
    if (!this.ok || !this.world || this.paused || this.lost) return
    const dt = now - this.lastTick; this.lastTick = now
    const still = now - this.lastChange > 130
    if (this.dirty) {
      this.dirty = false; this.upload(this.world, this.w, this.h); this.stage = 0; this.sample = 0; this.scan = 0; this.moving = !still
      if (this.live) { this.moving = true; if (dt > 44) this.liveDiv = Math.min(8, this.liveDiv + 0.5); else if (dt < 26) this.liveDiv = Math.max(1.25, this.liveDiv - 0.08) }
      const linear = this.live ? THREE.LinearFilter : THREE.NearestFilter; if (this.low.texture.magFilter !== linear) { this.low.dispose(); this.low.texture.magFilter = this.low.texture.minFilter = linear }
      this.lowPass(this.live ? this.liveDiv : this.moving ? Math.max(3, Math.round(Math.sqrt((this.w * this.h) / 90000))) : 12); if (!this.moving) this.stage = 1
      this.show(); this.status(); return
    }
    if (this.moving) { if (!still) return; this.moving = false }
    if (this.sample >= this.target) { this.status(); return }
    if (this.stage < 3) { this.lowPass([12, 6, 3][this.stage]); this.stage++; this.scan = 0; this.show(); this.status(); return }
    // one strip of the current full pass; the strip grows or shrinks to keep the page responsive
    if (dt > 42) this.rows = Math.max(8, Math.round(this.rows * 0.7)); else if (dt < 24) this.rows = Math.min(this.h, Math.round(this.rows * 1.25) + 1)
    // Frame timing measures submission, which can run ahead of the graphics chip.
    const rows = Math.min(this.rows, Math.max(1, Math.floor(32_768 / this.w)), this.h - this.scan)
    this.pass(this.acc, this.w, this.h, { sample: this.sample, preview: false, ldr: !this.float, blend: 1 / (this.sample + 1), y: this.h - this.scan - rows, rows })
    this.scan += rows
    if (this.scan >= this.h) { this.scan = 0; this.sample++ }
    this.show(); this.status()
  }

  // ---------- questions about the picture ----------
  /** The camera ray through a point of the view (0..1 from the top left). */
  ray(nx: number, ny: number, cam = this.world!.cam) {
    const b = camBasis(cam), mn = Math.min(this.w, this.h); b.pos.y = Math.max(b.pos.y, 0.25)
    const ux = ((nx - 0.5) * this.w) / mn * 2, uy = ((0.5 - ny) * this.h) / mn * 2
    return { ro: b.pos, rd: b.fw.clone().multiplyScalar(b.focal).addScaledVector(b.rt, ux).addScaledVector(b.up, uy).normalize(), basis: b }
  }
  /** What is under a point of the view. */
  pick(nx: number, ny: number): Hit | null {
    if (!this.pickRT || !this.world) return null
    const mn = Math.min(this.w, this.h)
    this.upload(this.world, this.w, this.h); this.u.uPickUV.value.set(((nx - 0.5) * this.w) / mn * 2, ((0.5 - ny) * this.h) / mn * 2)
    const keep = this.traceMat.blending; this.traceMat.blending = THREE.NoBlending
    this.pass(this.pickRT, 1, 1, { sample: 0, preview: true, ldr: false, blend: 1, mode: 9 })
    this.traceMat.blending = keep; this.u.uRes.value.set(this.w, this.h)
    const px = new Float32Array(4); this.r.readRenderTargetPixels(this.pickRT, 0, 0, 1, 1, px); this.r.setRenderTarget(null)
    const kind = (["sky", "sea", "land", "thing", "title"] as const)[Math.round(px[0])] ?? "sky"
    const { ro, rd } = this.ray(nx, ny); const d = kind === "sky" ? 0 : px[2]; const p = ro.clone().addScaledVector(rd, d)
    return { kind, id: kind === "thing" ? this.ids[Math.round(px[1])] : kind === "land" ? this.terrainIds[Math.round(px[1])] : undefined, point: [p.x, p.y, p.z], dist: d }
  }

  /** What a ray from anywhere meets: used to rest things on the land and to scatter copies. */
  probe(ro: [number, number, number], rd: [number, number, number]): { kind: Hit["kind"]; dist: number } | null {
    if (!this.pickRT || !this.world) return null
    this.upload(this.world, this.w, this.h); this.u.uPRo.value.set(...ro); this.u.uPRd.value.set(...rd)
    this.pass(this.pickRT, 1, 1, { sample: 0, preview: true, ldr: false, blend: 1, mode: 10 }); this.u.uRes.value.set(this.w, this.h)
    const px = new Float32Array(4); this.r.readRenderTargetPixels(this.pickRT, 0, 0, 1, 1, px); this.r.setRenderTarget(null)
    return { kind: (["sky", "sea", "land", "thing", "title"] as const)[Math.round(px[0])] ?? "sky", dist: px[2] }
  }
  /** The land as a square grid of heights, n by n, covering half-width `half` around the middle. */
  heights(n: number, half: number, piece?: Land): Float32Array {
    const out = new Float32Array(n * n); if (!this.float || !this.world) return out
    const rt = new THREE.WebGLRenderTarget(n, n, { depthBuffer: false, type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false })
    this.upload(piece ? { ...this.world, land: piece, terrains: [] } : this.world, this.w, this.h); this.u.uGridHalf.value = half
    this.u.uGridCenter.value.set(piece?.pos?.[0] ?? 0, piece?.pos?.[2] ?? 0)
    const keep = this.traceMat.blending; this.traceMat.blending = THREE.NoBlending
    this.pass(rt, n, n, { sample: 0, preview: true, ldr: false, blend: 1, mode: 11 }); this.traceMat.blending = keep; this.u.uRes.value.set(this.w, this.h)
    const px = new Float32Array(n * n * 4); this.r.readRenderTargetPixels(rt, 0, 0, n, n, px); this.r.setRenderTarget(null); rt.dispose(); this.dirty = true
    for (let i = 0; i < n * n; i++) out[i] = px[i * 4]
    return out
  }
  /** The height of the ground (land, or sea level) under a point. */
  groundAt(x: number, z: number): number { return this.probeDown(x, z) }
  private probeDown(x: number, z: number): number {
    if (!this.pickRT || !this.world) return 0
    const w = this.world, bare = { ...w, things: [], title: undefined }
    this.upload(bare, this.w, this.h); this.u.uPRo.value.set(x, 200, z); this.u.uPRd.value.set(0, -1, 0)
    this.pass(this.pickRT, 1, 1, { sample: 0, preview: true, ldr: false, blend: 1, mode: 10 }); this.u.uRes.value.set(this.w, this.h)
    const px = new Float32Array(4); this.r.readRenderTargetPixels(this.pickRT, 0, 0, 1, 1, px); this.r.setRenderTarget(null); this.dirty = true
    return Math.round(px[0]) === 2 ? Math.max(0, 200 - px[2]) : 0
  }

  /** Render a world to its own pixels, away from the screen: for saved pictures, thumbnails and loop frames. */
  private offscreen(w: World, width: number, height: number, samples: number, time: number, preview: boolean, phase: number | null = null): Uint8Array {
    const opt = { depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false }
    const hdr = new THREE.WebGLRenderTarget(width, height, { ...opt, type: this.float ? THREE.HalfFloatType : THREE.UnsignedByteType })
    this.upload(w, width, height, time, phase)
    for (let s = 0; s < samples; s++) this.pass(hdr, width, height, { sample: s, preview: preview && samples === 1, ldr: !this.float, blend: 1 / (s + 1) })
    const px = this.develop(hdr, width, height); hdr.dispose()
    this.dirty = true // the screen's uniforms were overwritten
    return px
  }
  /** Tone-map an averaged picture into plain pixels. */
  private develop(hdr: THREE.WebGLRenderTarget, width: number, height: number): Uint8Array {
    const out = this.developTo(hdr, width, height), px = new Uint8Array(width * height * 4)
    this.r.readRenderTargetPixels(out, 0, 0, width, height, px); out.dispose()
    return px
  }
  private developTo(hdr: THREE.WebGLRenderTarget, width: number, height: number) {
    const out = new THREE.WebGLRenderTarget(width, height, { depthBuffer: false, generateMipmaps: false }), m = this.showMat.uniforms
    m.tAcc.value = hdr.texture; m.uRes.value.set(width, height); m.uHave.value = 2
    this.r.setRenderTarget(out); this.r.setViewport(0, 0, width, height); this.r.render(this.showScene, this.cam)
    m.tAcc.value = this.acc.texture; this.r.setRenderTarget(null)
    return out
  }
  private toCanvas(px: Uint8Array, width: number, height: number, into?: HTMLCanvasElement) {
    const c = into ?? document.createElement("canvas"); c.width = width; c.height = height
    const x = c.getContext("2d")!, im = x.createImageData(width, height)
    for (let y = 0; y < height; y++) im.data.set(px.subarray((height - 1 - y) * width * 4, (height - y) * width * 4), y * width * 4)
    x.putImageData(im, 0, 0); return c
  }
  frame(w: World, width: number, height: number, samples = 2, time = 0, into?: HTMLCanvasElement, phase: number | null = null) { return this.toCanvas(this.offscreen(w, width, height, samples, time, false, phase), width, height, into) }
  thumb(w: World, width = 160, height = 120): string { return this.toCanvas(this.offscreen(w, width, height, 2, 0, false), width, height).toDataURL("image/jpeg", 0.82) }
  /** A finished picture at any size, in slices so the page stays alive and can show progress. onProgress
   *  may return false to stop early (the promise then rejects with an AbortError). Slices grow or shrink
   *  so no single one keeps the graphics chip busy for long: a slow chip that is kept busy too long is
   *  reset by the system, and every picture on the page is lost with it. */
  async still(w: World, width: number, height: number, samples: number, onProgress?: (f: number) => void | boolean): Promise<HTMLCanvasElement> {
    const opt = { depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false }
    if (this.lost || !this.ok) throw new Error("The picture cannot be made while the graphics chip is resting. Try again in a moment.")
    const hdr = new THREE.WebGLRenderTarget(width, height, { ...opt, type: this.float ? THREE.HalfFloatType : THREE.UnsignedByteType })
    this.paused = true
    try {
      let strip = Math.max(8, Math.round(60000 / width)), n = 0, since = performance.now()
      for (let s = 0; s < samples; s++) for (let y = 0; y < height;) {
        const rows = Math.min(strip, height - y)
        this.upload(w, width, height)
        this.pass(hdr, width, height, { sample: s, preview: false, ldr: !this.float, blend: 1 / (s + 1), y: height - y - rows, rows })
        y += rows
        if (++n % 4 === 0) {
          if (onProgress?.((s + y / height) / samples) === false) { const e = new Error("stopped"); e.name = "AbortError"; throw e }
          await new Promise((ok) => setTimeout(ok)); if (this.lost) throw new Error("The graphics chip took a break while making the picture. Try again in a moment.")
          const each = (performance.now() - since) / 4; since = performance.now()
          if (each > 70) strip = Math.max(4, Math.round(strip * 0.6)); else if (each < 20) strip = Math.min(height, Math.round(strip * 1.3) + 1)
        }
      }
      const px = this.develop(hdr, width, height); onProgress?.(1)
      return this.toCanvas(px, width, height)
    } finally { hdr.dispose(); this.paused = false; this.dirty = true } // whatever happened, the live picture carries on
  }
  /** A finished picture made a few strips per frame while the screen keeps moving (the screensaver's next
   *  world): each frame traces only as many rows as keep it smooth. Resolves to null if `alive` turns false. */
  async stillBetweenFrames(w: World, width: number, height: number, samples: number, o: { time?: number; alive?: () => boolean } = {}): Promise<HTMLCanvasElement | null> {
    const hdr = new THREE.WebGLRenderTarget(width, height, { depthBuffer: false, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, type: this.float ? THREE.HalfFloatType : THREE.UnsignedByteType })
    let budget = width * 16, last = performance.now() // pixels traced per frame, grown or shrunk by how long frames take
    try {
      for (let s = 0; s < samples; s++) for (let y = 0; y < height;) {
        const now = await new Promise<number>((ok) => requestAnimationFrame(ok))
        if (o.alive && !o.alive()) return null
        const dt = now - last; last = now
        if (dt > 22) budget = Math.max(width * 4, Math.round(budget * 0.6)); else if (dt < 19) budget = Math.min(width * height, Math.round(budget * 1.15))
        const rows = Math.min(height - y, Math.max(4, Math.round(budget / width)))
        this.upload(w, width, height, o.time ?? 0, null)
        this.pass(hdr, width, height, { sample: s, preview: false, ldr: !this.float, blend: 1 / (s + 1), y: height - y - rows, rows })
        y += rows
        if (this.world) this.upload(this.world, this.w, this.h) // the screen's own world back in the uniforms
      }
      // read back without waiting on the graphics chip, so this frame is not held up either
      const out = this.developTo(hdr, width, height), px = new Uint8Array(width * height * 4)
      try { await this.r.readRenderTargetPixelsAsync(out, 0, 0, width, height, px) } finally { out.dispose() }
      return o.alive && !o.alive() ? null : this.toCanvas(px, width, height)
    } finally { hdr.dispose() }
  }
}

export type { Thing }
