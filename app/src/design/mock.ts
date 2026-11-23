// A cover placed inside an object: a jewel case, a cassette, a vinyl sleeve. All drawn by hand here.
import type { DesignOpts } from "./layouts"

const rr = (x: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, r: number) => { x.beginPath(); x.roundRect(X, Y, W, H, r) }
/** The front placed in an object, on a soft backdrop taken from the picture's own colours. */
export function drawMock(front: HTMLCanvasElement, o: DesignOpts, bg: [string, string]): HTMLCanvasElement {
  if (o.format === "flat") return front
  const W = 1600, H = 1200, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d")!
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]); x.fillStyle = g; x.fillRect(0, 0, W, H)
  x.fillStyle = "rgba(10,10,16,.35)"; x.fillRect(0, 0, W, H)
  const shadow = (blur: number, y: number) => { x.shadowColor = "rgba(0,0,0,.55)"; x.shadowBlur = blur; x.shadowOffsetY = y }, noShadow = () => { x.shadowColor = "transparent"; x.shadowBlur = 0; x.shadowOffsetY = 0 }
  const shine = (X: number, Y: number, S: number, T: number) => { const s = x.createLinearGradient(X, Y, X + S, Y + T); s.addColorStop(0, "rgba(255,255,255,.28)"); s.addColorStop(0.28, "rgba(255,255,255,.03)"); s.addColorStop(0.6, "rgba(255,255,255,0)"); s.addColorStop(1, "rgba(255,255,255,.12)"); return s }
  if (o.format === "cd") {
    const S = 820, X = (W - S) / 2 + 30, Y = (H - S) / 2
    shadow(70, 40); x.fillStyle = "#16171c"; rr(x, X - 78, Y - 14, S + 92, S + 28, 10); x.fill(); noShadow()
    x.fillStyle = "#0b0b0f"; x.fillRect(X - 70, Y - 6, 56, S + 12)
    for (let i = 0; i < 22; i++) { x.fillStyle = "rgba(255,255,255,.07)"; x.fillRect(X - 62, Y + 10 + i * ((S - 20) / 22), 40, 3) }
    x.save(); x.translate(X - 34, Y + S - 30); x.rotate(-Math.PI / 2); x.fillStyle = "rgba(255,255,255,.82)"; x.font = `600 22px "Geist Variable", Arial, sans-serif`; x.fillText(`${o.title.slice(0, 30)}  ·  ${o.sub.slice(0, 30)}`.toUpperCase(), 0, 0); x.restore()
    x.drawImage(front, X, Y, S, S); x.fillStyle = shine(X, Y, S, S); x.fillRect(X, Y, S, S)
    x.strokeStyle = "rgba(255,255,255,.28)"; x.lineWidth = 2; rr(x, X - 78, Y - 14, S + 92, S + 28, 10); x.stroke()
  } else if (o.format === "tape") {
    const CW = 640, CH = 1000, X = (W - CW) / 2, Y = (H - CH) / 2, spine = 96
    shadow(70, 40); x.fillStyle = "#17181d"; rr(x, X - spine - 12, Y - 12, CW + spine + 24, CH + 24, 14); x.fill(); noShadow()
    x.fillStyle = "#f3efe6"; x.fillRect(X - spine, Y, spine, CH)
    x.save(); x.translate(X - spine / 2, Y + CH - 40); x.rotate(-Math.PI / 2); x.fillStyle = "#15151a"; x.font = `600 34px "Geist Variable", Arial, sans-serif`; x.fillText(o.title.slice(0, 26), 0, 12)
    x.font = `400 22px "Geist Mono Variable", monospace`; x.globalAlpha = 0.6; x.fillText(o.sub.slice(0, 30).toUpperCase(), 520, 9); x.restore()
    x.drawImage(front, X, Y, CW, CW); x.fillStyle = "#f3efe6"; x.fillRect(X, Y + CW, CW, CH - CW)
    x.fillStyle = "#15151a"; const lines = o.tracks.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 8)
    if (lines.length) { x.font = `500 20px "Geist Mono Variable", monospace`; lines.forEach((l, i) => { x.globalAlpha = 0.9; x.fillText(`${i + 1}  ${l}`.slice(0, 42), X + 36, Y + CW + 62 + i * 34) }) }
    else { x.font = `600 44px "Geist Variable", Arial, sans-serif`; x.fillText(o.title.slice(0, 22), X + 36, Y + CW + 96); x.font = `400 24px "Geist Variable", Arial, sans-serif`; x.globalAlpha = 0.7; x.fillText(o.sub.slice(0, 34), X + 36, Y + CW + 140) }
    x.globalAlpha = 1
    x.fillStyle = shine(X - spine, Y, CW + spine, CH); x.fillRect(X - spine, Y, CW + spine, CH)
    x.strokeStyle = "rgba(255,255,255,.3)"; x.lineWidth = 2; rr(x, X - spine - 12, Y - 12, CW + spine + 24, CH + 24, 14); x.stroke()
  } else {
    const S = 860, X = 170, Y = (H - S) / 2, cx = X + S + 60, cy = H / 2, R = S * 0.48
    shadow(50, 30); x.fillStyle = "#0c0c0f"; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fill(); noShadow()
    for (let r = R * 0.38; r < R * 0.97; r += 5) { x.strokeStyle = `rgba(255,255,255,${0.03 + 0.04 * Math.abs(Math.sin(r))})`; x.lineWidth = 1; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke() }
    const sg = x.createConicGradient(0.6, cx, cy); sg.addColorStop(0, "rgba(255,255,255,0)"); sg.addColorStop(0.07, "rgba(255,255,255,.16)"); sg.addColorStop(0.14, "rgba(255,255,255,0)"); sg.addColorStop(0.5, "rgba(255,255,255,0)"); sg.addColorStop(0.57, "rgba(255,255,255,.12)"); sg.addColorStop(0.64, "rgba(255,255,255,0)")
    x.fillStyle = sg; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fill()
    x.save(); x.beginPath(); x.arc(cx, cy, R * 0.33, 0, 7); x.clip(); x.drawImage(front, cx - R * 0.33, cy - R * 0.33, R * 0.66, R * 0.66); x.restore()
    x.fillStyle = "#0c0c0f"; x.beginPath(); x.arc(cx, cy, 9, 0, 7); x.fill()
    shadow(70, 40); x.fillStyle = "#111"; x.fillRect(X, Y, S, S); noShadow(); x.drawImage(front, X, Y, S, S)
    x.fillStyle = shine(X, Y, S, S); x.globalAlpha = 0.5; x.fillRect(X, Y, S, S); x.globalAlpha = 1
  }
  return c
}

