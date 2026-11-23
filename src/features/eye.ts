// Where you stand and which way you look, and how that maps onto the editor's orbit camera.
import { camBasis } from "@/engine/engine"
import type { Camera, Vec3 } from "@/engine/scene"

/** Where you are and which way you look. Heading 0 looks along +z; pitch above 0 looks up. */
export interface Eye { pos: Vec3; heading: number; pitch: number }
export const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
export const fwdOf = (e: { heading: number; pitch: number }): Vec3 => [Math.cos(e.pitch) * Math.sin(e.heading), Math.sin(e.pitch), Math.cos(e.pitch) * Math.cos(e.heading)]
export const SEA_CLEAR = 0.55 // the lowest the eye goes over water

/** The eye of an orbit camera: where it is and where it looks. */
export function eyeOf(c: Camera): Eye {
  const b = camBasis(c)
  return { pos: [b.pos.x, Math.max(b.pos.y, SEA_CLEAR), b.pos.z], heading: Math.atan2(b.fw.x, b.fw.z), pitch: Math.asin(clamp(b.fw.y, -1, 1)) }
}
/** An orbit camera that sits exactly at the eye: a tiny distance, with the target just in front. */
export function camAt(e: Eye, base: Camera, fov = base.fov): Camera {
  const D = 0.02, f = fwdOf(e)
  return { ...base, yaw: e.heading + Math.PI, pitch: -e.pitch, dist: D, target: [e.pos[0] + f[0] * D, e.pos[1] + f[1] * D, e.pos[2] + f[2] * D], fov, roll: 0, lens: 0, pano: false }
}
