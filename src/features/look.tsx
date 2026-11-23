// Look around: the world is painted once all the way round you (a 360° picture), then hung on the
// inside of a sphere that three.js shows. Drag to look, tilt a phone, or step in with a VR headset.
import * as React from "react"
import * as THREE from "three"
import { Glasses, ImageDown, Orbit, Smartphone, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { Vec3, World } from "@/engine/scene"
import { engine, get, patch } from "@/store"

import { SEA_CLEAR, clamp, eyeOf } from "./eye"
import { fileName } from "@/ui/TopBar"

export interface LookFrom { pos: Vec3; heading: number }
/** How big the painted picture is, by the quality chosen in the app: wide, tall, samples. */
const SIZES: [number, number, number][] = [[2048, 1024, 3], [4096, 2048, 8], [4096, 2048, 24], [4096, 2048, 64]]

type Look = { from: LookFrom; world: World; pic?: HTMLCanvasElement; progress: number }
let look: Look | null = null, run = 0
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
const useLook = () => React.useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => look)

/** Paint the world all around a spot (by default where the camera is) and step inside. */
export async function openLook(from?: LookFrom) {
  if (!engine || !engine.ok || look) return
  const w = get().world, e = from ?? eyeOf(w.cam)
  const pos: Vec3 = [e.pos[0], Math.max(e.pos[1], SEA_CLEAR, engine.groundAt(e.pos[0], e.pos[2]) + 0.7), e.pos[2]]
  // the pano faces `heading` in the middle of the picture; the shader puts yaw + 180° there
  const world: World = { ...w, cam: { ...w.cam, pano: true, target: pos, dist: 0.001, yaw: e.heading - Math.PI, pitch: 0, roll: 0, lens: 0 } }
  const id = ++run; look = { from: { pos, heading: e.heading }, world, progress: 0 }; patch({ dialog: null }); emit()
  const [W, H, S] = SIZES[clamp(get().quality, 0, 3)] ?? SIZES[1]
  await new Promise((ok) => setTimeout(ok, 60)) // let the painting card show first
  const pic = await engine.still(world, W, H, S, (f) => { if (id === run && look) { look = { ...look, progress: f }; emit() } })
  if (id !== run || !look) return
  look = { ...look, pic, progress: 1 }; emit()
}
export function closeLook() { run++; look = null; emit(); engine?.touch() }

export function LookOverlay() {
  const l = useLook()
  React.useEffect(() => {
    if (!l) return
    const key = (e: KeyboardEvent) => { e.stopPropagation(); if (e.key === "Escape") { e.preventDefault(); closeLook() } }
    addEventListener("keydown", key, true); return () => removeEventListener("keydown", key, true)
  }, [!!l])
  if (!l) return null
  return (
    <div className="fixed inset-0 z-50 bg-black" data-testid="look-layer">
      {l.pic ? <Viewer pic={l.pic} heading={l.from.heading} />
        : <div className="grid size-full place-items-center bg-black/80">
            <div className="glass-panel flex w-[min(340px,88vw)] flex-col gap-3 rounded-xl p-4" data-testid="look-painting">
              <div className="flex items-center gap-2 text-[13.5px] font-medium"><Orbit className="size-4" /> Painting the world all around you</div>
              <div className="h-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-foreground/70 transition-[width]" style={{ width: `${l.progress * 100}%` }} /></div>
              <div className="flex items-center justify-between text-[12px] text-muted-foreground"><span>{Math.round(l.progress * 100)}%</span><Button variant="ghost" size="xs" onClick={closeLook}>Cancel</Button></div>
            </div>
          </div>}
    </div>
  )
}

// The picture's middle looks along `heading`; each point of the sphere finds its own pixel, so the
// seam and the poles need no special care beyond picking the right side of the wrap.
const VERT = `varying vec3 vDir; void main() { vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const FRAG = `uniform sampler2D tPic; uniform float uHeading; varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float x = 0.5 - (atan(d.x, d.z) - uHeading) / 6.2831853;
  float u1 = fract(x), u2 = fract(x + 0.5) - 0.5, u = fwidth(u1) <= fwidth(u2) + 1e-5 ? u1 : u2;
  float v = asin(clamp(d.y, -1.0, 1.0)) / 3.14159265 + 0.5;
  gl_FragColor = vec4(texture2D(tPic, vec2(u, v)).rgb, 1.0);
}`

// Turning a phone into a view: the device's angles become a rotation, then the screen's own turn
// is taken off. The order of turns (Z-X'-Y'' from the W3C DeviceOrientation spec) is the same
// method three.js's former DeviceOrientationControls used (MIT licence), written afresh here.
const zee = new THREE.Vector3(0, 0, 1), qScreen = new THREE.Quaternion(), qLevel = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)), eu = new THREE.Euler()
function deviceQuat(q: THREE.Quaternion, a: number, b: number, g: number, screen: number) {
  eu.set(b, a, -g, "YXZ"); q.setFromEuler(eu); q.multiply(qLevel); q.multiply(qScreen.setFromAxisAngle(zee, -screen)); return q
}
const headingOf = (q: THREE.Quaternion) => { const f = new THREE.Vector3(0, 0, -1).applyQuaternion(q); return Math.atan2(f.x, f.z) }

function Viewer({ pic, heading }: { pic: HTMLCanvasElement; heading: number }) {
  const box = React.useRef<HTMLCanvasElement>(null)
  const view = React.useRef({ lon: heading, lat: 0, fov: 75, tilt: false, offset: 0, dev: null as null | [number, number, number] })
  const [tilt, setTilt] = React.useState(false), [vr, setVr] = React.useState(false), [inVr, setInVr] = React.useState(false), [note, setNote] = React.useState("")
  const canTilt = typeof window !== "undefined" && "DeviceOrientationEvent" in window && matchMedia("(pointer: coarse)").matches
  const xrRef = React.useRef<THREE.WebGLRenderer | null>(null)

  React.useEffect(() => {
    const canvas = box.current!
    let r: THREE.WebGLRenderer
    try { r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true }) } catch { setNote("This browser could not show the 360° view."); return }
    xrRef.current = r; r.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); r.outputColorSpace = THREE.LinearSRGBColorSpace
    const tex = new THREE.CanvasTexture(pic); tex.colorSpace = THREE.NoColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = r.capabilities.getMaxAnisotropy(); tex.minFilter = THREE.LinearMipmapLinearFilter
    const mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { tPic: { value: tex }, uHeading: { value: heading } }, side: THREE.BackSide, depthWrite: false })
    const geo = new THREE.SphereGeometry(50, 96, 48), scene = new THREE.Scene(); scene.add(new THREE.Mesh(geo, mat))
    const cam = new THREE.PerspectiveCamera(75, 1, 0.1, 200), q = new THREE.Quaternion(), yawQ = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0)
    const fit = () => { r.setSize(innerWidth, innerHeight, false); cam.aspect = innerWidth / innerHeight; cam.updateProjectionMatrix() }; fit(); addEventListener("resize", fit)
    r.setAnimationLoop(() => {
      const v = view.current
      if (v.tilt && v.dev) {
        const scr = ((screen.orientation?.angle ?? (window as any).orientation ?? 0) * Math.PI) / 180
        deviceQuat(q, v.dev[0], v.dev[1], v.dev[2], scr); cam.quaternion.copy(yawQ.setFromAxisAngle(up, v.offset)).multiply(q)
        const f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion); v.lon = Math.atan2(f.x, f.z); v.lat = Math.asin(clamp(f.y, -1, 1))
      } else cam.lookAt(Math.cos(v.lat) * Math.sin(v.lon), Math.sin(v.lat), Math.cos(v.lat) * Math.cos(v.lon))
      if (Math.abs(cam.fov - v.fov) > 0.01) { cam.fov += (v.fov - cam.fov) * 0.25; cam.updateProjectionMatrix() }
      r.render(scene, cam)
      ;(window as any).__look = { lon: v.lon, lat: v.lat, fov: v.fov }
    })
    ;(navigator as any).xr?.isSessionSupported?.("immersive-vr").then((ok: boolean) => setVr(!!ok)).catch(() => setVr(false))
    engine?.pause(true) // the editor's picture rests while you look around
    return () => {
      removeEventListener("resize", fit); r.setAnimationLoop(null); void r.xr.getSession()?.end().catch(() => {})
      tex.dispose(); mat.dispose(); geo.dispose(); r.dispose(); r.forceContextLoss(); xrRef.current = null; (window as any).__look = null
      engine?.pause(false); engine?.touch()
    }
  }, [pic, heading])

  // phone tilt: asked for on iOS, simply listened to elsewhere
  React.useEffect(() => {
    if (!tilt) { view.current.tilt = false; return }
    const v = view.current; v.dev = null; let first = true
    const on = (e: DeviceOrientationEvent) => {
      if (e.alpha === null || e.beta === null || e.gamma === null) return
      v.dev = [(e.alpha * Math.PI) / 180, (e.beta * Math.PI) / 180, (e.gamma * Math.PI) / 180]
      if (first) { first = false; const scr = ((screen.orientation?.angle ?? 0) * Math.PI) / 180; v.offset = v.lon - headingOf(deviceQuat(new THREE.Quaternion(), v.dev[0], v.dev[1], v.dev[2], scr)); v.tilt = true }
    }
    addEventListener("deviceorientation", on)
    const quiet = setTimeout(() => { if (first) { setTilt(false); setNote("This device did not report any tilt.") } }, 2000)
    return () => { removeEventListener("deviceorientation", on); clearTimeout(quiet); v.tilt = false }
  }, [tilt])
  const toggleTilt = async () => {
    if (tilt) { setTilt(false); return }
    setNote("")
    const DOE = (window as any).DeviceOrientationEvent
    if (typeof DOE?.requestPermission === "function") { try { if ((await DOE.requestPermission()) !== "granted") { setNote("Tilt was not allowed. You can still drag to look."); return } } catch { setNote("Tilt was not allowed. You can still drag to look."); return } }
    setTilt(true)
  }
  const enterVr = async () => {
    const r = xrRef.current, xr = (navigator as any).xr; if (!r || !xr) return
    try {
      const s = await xr.requestSession("immersive-vr", { optionalFeatures: ["local-floor"] })
      r.xr.enabled = true; r.xr.setReferenceSpaceType("local"); await r.xr.setSession(s); setInVr(true)
      s.addEventListener("end", () => { r.xr.enabled = false; setInVr(false) })
    } catch { setNote("VR could not start here. Drag to look instead.") }
  }
  const save = () => {
    // the engine paints it the usual way round for 360° players (turning right runs left to right)
    pic.toBlob((b) => { if (!b) return; const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = `${fileName(get().world.name)}-360.png`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000) }, "image/png")
  }

  // drag (or one finger) to look, wheel or two fingers to zoom, arrows to turn
  const pts = React.useRef(new Map<number, [number, number]>()), pinch = React.useRef(0)
  const down = (e: React.PointerEvent) => { e.currentTarget.setPointerCapture(e.pointerId); pts.current.set(e.pointerId, [e.clientX, e.clientY]); pinch.current = 0 }
  const move = (e: React.PointerEvent) => {
    const p = pts.current.get(e.pointerId); if (!p) return; const v = view.current
    const dx = e.clientX - p[0], dy = e.clientY - p[1]; pts.current.set(e.pointerId, [e.clientX, e.clientY])
    if (pts.current.size === 2) { const [a, b] = [...pts.current.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]); if (pinch.current) v.fov = clamp(v.fov * (pinch.current / d), 30, 100); pinch.current = d; return }
    const k = ((v.fov / 75) * 1.6) / Math.max(400, innerHeight)
    if (v.tilt) v.offset += dx * k
    else { v.lon += dx * k; v.lat = clamp(v.lat + dy * k, -1.5, 1.5) }
  }
  const up = (e: React.PointerEvent) => { pts.current.delete(e.pointerId); pinch.current = 0 }
  React.useEffect(() => {
    const key = (e: KeyboardEvent) => { const v = view.current, s = 0.08
      if (e.key === "ArrowLeft") v.lon += s; else if (e.key === "ArrowRight") v.lon -= s; else if (e.key === "ArrowUp") v.lat = clamp(v.lat + s, -1.5, 1.5); else if (e.key === "ArrowDown") v.lat = clamp(v.lat - s, -1.5, 1.5) }
    addEventListener("keydown", key); return () => removeEventListener("keydown", key)
  }, [])

  return (
    <>
      <canvas ref={box} className="absolute inset-0 block size-full cursor-grab touch-none active:cursor-grabbing" data-testid="look-canvas" aria-label="The world all around you. Drag to look."
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={(e) => { view.current.fov = clamp(view.current.fov * Math.exp(e.deltaY * 0.001), 30, 100) }} />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <div className="bg-popover pointer-events-auto flex flex-col gap-0.5 rounded-xl px-3 py-2 text-[12.5px] text-popover-foreground max-sm:hidden">
          <span className="flex items-center gap-1.5 font-medium"><Orbit className="size-4" /> Look around</span>
          <span className="text-muted-foreground">{tilt ? "Turn your phone to look. Drag to turn round." : "Drag to look all around. Scroll to zoom."}</span>
        </div>
        <div className="bg-popover pointer-events-auto ml-auto flex items-center gap-0.5 rounded-xl p-1">
          {canTilt && <Button variant={tilt ? "glass" : "ghost"} size="sm" onClick={() => void toggleTilt()} aria-pressed={tilt} data-testid="look-tilt"><Smartphone />Tilt</Button>}
          {vr && <Button variant="ghost" size="sm" onClick={() => void enterVr()} disabled={inVr} data-testid="look-vr"><Glasses />Enter VR</Button>}
          <Button variant="ghost" size="sm" onClick={save} data-testid="look-save"><ImageDown /><span className="max-sm:hidden">Save 360° picture</span></Button>
          <Button variant="glass" size="sm" onClick={closeLook} data-testid="look-close"><X />Done</Button>
        </div>
      </div>
      {note && <div className="glass-panel absolute bottom-6 left-1/2 -translate-x-1/2 rounded-lg px-3 py-2 text-[12.5px]">{note}</div>}
    </>
  )
}
