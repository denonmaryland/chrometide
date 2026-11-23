// Listening. A song is read once, start to finish, into a score: for every 60th of a second, how
// loud the bass, the middle and the top are, sixteen bands across, and where the beats fall.
// The picture then follows the score, live or when a video is filmed, and both agree exactly.
// The microphone has no score, so it is listened to as it comes.

export const BANDS = 16, RATE = 60, SR = 48000
export interface Levels { bass: number; mid: number; high: number; level: number; beat: number; beats: number; bands: number[]; t: number }
export interface Score { duration: number; frames: number; bands: Float32Array; bass: Float32Array; mid: Float32Array; high: Float32Array; level: Float32Array; beatTimes: number[]; bpm: number }
export const SILENT: Levels = { bass: 0, mid: 0, high: 0, level: 0, beat: 0, beats: 0, bands: new Array(BANDS).fill(0), t: 0 }

// ---------- a small FFT ----------
function fft(re: Float32Array, im: Float32Array) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { const a = re[i]; re[i] = re[j]; re[j] = a; const b = im[i]; im[i] = im[j]; im[j] = b } }
  for (let len = 2; len <= n; len <<= 1) { const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0
      for (let k = 0; k < len / 2; k++) { const a = i + k, b = a + len / 2, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t } } }
}
/** Sixteen bands from 40 Hz to 14 kHz, spaced the way ears hear: evenly by pitch. */
const edges = (bins: number, sr: number) => Array.from({ length: BANDS + 1 }, (_, i) => Math.min(bins - 1, Math.max(1, Math.round(((40 * Math.pow(14000 / 40, i / BANDS)) / (sr / 2)) * bins))))

/** Find the beats from how suddenly the low end jumps. */
function findBeats(flux: Float32Array): number[] {
  const out: number[] = [], win = Math.round(RATE * 0.6)
  for (let i = 2; i < flux.length - 2; i++) {
    if (!(flux[i] > flux[i - 1] && flux[i] >= flux[i + 1])) continue
    let sum = 0, n = 0; for (let k = Math.max(0, i - win); k < Math.min(flux.length, i + win); k++) { sum += flux[k]; n++ }
    if (flux[i] > (sum / n) * 1.7 + 0.012 && (out.length === 0 || i / RATE - out[out.length - 1] > 0.24)) out.push(i / RATE)
  }
  return out.map((t) => t + 0.021) // a beat is heard at the middle of the slice of sound that found it
}

/** Read a whole song into its score. */
export function scoreOf(mono: Float32Array, sr: number): Score {
  const N = 2048, hop = sr / RATE, frames = Math.max(1, Math.floor((mono.length - N) / hop)), ed = edges(N / 2, sr)
  const win = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1))), re = new Float32Array(N), im = new Float32Array(N)
  const raw = new Float32Array(frames * BANDS), top = new Float32Array(BANDS).fill(1e-6)
  for (let f = 0; f < frames; f++) { const at = Math.floor(f * hop); for (let i = 0; i < N; i++) { re[i] = (mono[at + i] || 0) * win[i]; im[i] = 0 } fft(re, im)
    for (let b = 0; b < BANDS; b++) { let s = 0; const lo = ed[b], hi = Math.max(lo + 1, ed[b + 1]); for (let k = lo; k < hi; k++) s += Math.hypot(re[k], im[k]); const v = Math.sqrt(s / (hi - lo)); raw[f * BANDS + b] = v; if (v > top[b]) top[b] = v } }
  // each band measured against its own loudest moment, then given a quick rise and a slow fall
  const bands = new Float32Array(frames * BANDS), bass = new Float32Array(frames), mid = new Float32Array(frames), high = new Float32Array(frames), level = new Float32Array(frames), flux = new Float32Array(frames)
  const sorted = (b: number) => { const a: number[] = []; for (let f = 0; f < frames; f += 3) a.push(raw[f * BANDS + b]); a.sort((x, y) => x - y); return a[Math.floor(a.length * 0.97)] || top[b] }
  const ref = Array.from({ length: BANDS }, (_, b) => Math.max(1e-6, sorted(b)))
  const hold = new Float32Array(BANDS); let prevLow = 0
  for (let f = 0; f < frames; f++) { let lo = 0
    for (let b = 0; b < BANDS; b++) { const v = Math.min(1, Math.pow(raw[f * BANDS + b] / ref[b], 0.85)); hold[b] = v > hold[b] ? v : hold[b] * 0.88 + v * 0.12; bands[f * BANDS + b] = hold[b]; if (b < 3) lo += raw[f * BANDS + b] / ref[b] }
    const g = (a: number, z: number) => { let s = 0; for (let b = a; b <= z; b++) s += hold[b]; return s / (z - a + 1) }
    bass[f] = g(0, 2); mid[f] = g(5, 9); high[f] = g(11, 15); level[f] = g(0, 15); flux[f] = Math.max(0, lo / 3 - prevLow); prevLow = lo / 3 }
  const beatTimes = findBeats(flux), gaps = beatTimes.slice(1).map((t, i) => t - beatTimes[i]).filter((g) => g > 0.25 && g < 1.5).sort((a, b) => a - b)
  return { duration: mono.length / sr, frames, bands, bass, mid, high, level, beatTimes, bpm: gaps.length ? Math.round(60 / gaps[Math.floor(gaps.length / 2)]) : 0 }
}
/** What the song is doing at a moment. */
export function levelsAt(s: Score, t: number): Levels {
  const x = Math.min(s.frames - 1, Math.max(0, (t - 0.021) * RATE)), i = Math.floor(x), j = Math.min(s.frames - 1, i + 1), k = x - i, at = (a: Float32Array) => a[i] * (1 - k) + a[j] * k
  let beats = 0; while (beats < s.beatTimes.length && s.beatTimes[beats] <= t) beats++
  const since = beats ? t - s.beatTimes[beats - 1] : 9
  return { bass: at(s.bass), mid: at(s.mid), high: at(s.high), level: at(s.level), beat: Math.exp(-since * 7), beats, t, bands: Array.from({ length: BANDS }, (_, b) => s.bands[i * BANDS + b] * (1 - k) + s.bands[j * BANDS + b] * k) }
}

// ---------- the song that is loaded, or the microphone ----------
export interface Song { name: string; score: Score; pcm: [Float32Array, Float32Array]; url: string }
let song: Song | null = null, player: HTMLAudioElement | null = null
let micCtx: AudioContext | null = null, micNode: AnalyserNode | null = null, micStream: MediaStream | null = null
const mic = { hold: new Float32Array(BANDS), peak: new Float32Array(BANDS).fill(0.25), prevLow: 0, avg: 0, beat: 0, beats: 0, t0: 0, last: 0 }
export const currentSong = () => song
export const audioEl = () => player

/** Decode a music file, bring it to one sample rate, and read its score. */
export async function loadSong(file: Blob, name: string): Promise<Song> {
  stopMic(); const Ctx = window.AudioContext || (window as any).webkitAudioContext, ctx: AudioContext = new Ctx()
  const first = await ctx.decodeAudioData(await file.arrayBuffer()); void ctx.close()
  const off = new OfflineAudioContext(2, Math.ceil(first.duration * SR), SR), src = off.createBufferSource(); src.buffer = first; src.connect(off.destination); src.start()
  const buf = await off.startRendering(), L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L
  const mono = new Float32Array(L.length); for (let i = 0; i < L.length; i++) mono[i] = (L[i] + R[i]) * 0.5
  if (song) URL.revokeObjectURL(song.url); player?.pause()
  song = { name, score: scoreOf(mono, SR), pcm: [L, R], url: URL.createObjectURL(file) }
  player = new Audio(song.url); player.preload = "auto"
  return song
}
export function unloadSong() { player?.pause(); if (song) URL.revokeObjectURL(song.url); song = null; player = null }
export async function startMic(): Promise<boolean> {
  try { micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }) } catch { return false }
  player?.pause(); const Ctx = window.AudioContext || (window as any).webkitAudioContext; micCtx = new Ctx(); micNode = micCtx!.createAnalyser(); micNode.fftSize = 2048; micNode.smoothingTimeConstant = 0.5
  micCtx!.createMediaStreamSource(micStream).connect(micNode); mic.t0 = performance.now(); mic.beats = 0; return true
}
export function stopMic() { micStream?.getTracks().forEach((t) => t.stop()); void micCtx?.close(); micStream = null; micCtx = null; micNode = null }
export const micOn = () => !!micNode

/** What is sounding right now: the song at its playhead, or the microphone. */
export function nowLevels(): Levels {
  if (micNode && micCtx) {
    const bins = new Uint8Array(micNode.frequencyBinCount); micNode.getByteFrequencyData(bins); const ed = edges(bins.length, micCtx.sampleRate), bands: number[] = []; let lo = 0
    for (let b = 0; b < BANDS; b++) { let s = 0; const a = ed[b], z = Math.max(a + 1, ed[b + 1]); for (let k = a; k < z; k++) s += bins[k]; let v = s / (z - a) / 255
      mic.peak[b] = Math.max(mic.peak[b] * 0.9995, v, 0.12); v = Math.min(1, v / mic.peak[b]); v = v * v; mic.hold[b] = v > mic.hold[b] ? v : mic.hold[b] * 0.88 + v * 0.12; bands.push(mic.hold[b]); if (b < 3) lo += v / 3 }
    const now = performance.now(), flux = Math.max(0, lo - mic.prevLow); mic.prevLow = lo; mic.avg = mic.avg * 0.95 + flux * 0.05
    if (flux > mic.avg * 2.2 + 0.04 && now - mic.last > 240) { mic.last = now; mic.beats++ }
    const g = (a: number, z: number) => { let s = 0; for (let b = a; b <= z; b++) s += bands[b]; return s / (z - a + 1) }
    return { bass: g(0, 2), mid: g(5, 9), high: g(11, 15), level: g(0, 15), beat: Math.exp(-((now - mic.last) / 1000) * 7), beats: mic.beats, bands, t: (now - mic.t0) / 1000 }
  }
  if (song && player) return levelsAt(song.score, player.currentTime)
  return SILENT
}
