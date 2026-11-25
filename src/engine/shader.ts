// The whole picture is ray traced by this one fragment shader, one sample per pixel per pass.
// Passes are averaged in a float target, so soft shadows, blurry reflections, depth of field and
// anti-aliasing all come from the same thing: many slightly different samples.

import { KINDS } from "./scene"
import { shapeBranches, shapeFunctions } from "./shapes"

export const MAXO = 20 // things per world
export const MAT_COLS = 8 // texels of material per thing (row MAXO is the lettering)

export const VERT = /* glsl */ `
in vec3 position;
void main(){ gl_Position = vec4(position.xy, 0., 1.); }
`

export const DISPLAY_FRAG = /* glsl */ `
precision highp float;
out vec4 outCol;
uniform sampler2D tLow, tAcc;
uniform vec2 uRes;       // canvas size
uniform float uScanY;    // rows (from the top) of the first full pass that are done
uniform int uAccLDR;     // 1 when the averaged picture is already tone-mapped (no float targets)
uniform int uHave;       // 0: only the low picture, 1: first pass under way, 2: at least one full pass
vec3 tone(vec3 c){
  c = c / (1. + .18 * c) * 1.12;
  float l = dot(c, vec3(.3, .59, .11)); c = mix(vec3(l), c, 1.12);
  return pow(clamp(c, 0., 1.), vec3(1. / 2.2));
}
uniform float uBloom;    // how much bright things spill light around themselves
vec3 pic(vec2 uv, bool acc){ return acc ? (uAccLDR == 1 ? texture(tAcc, uv).rgb : tone(texture(tAcc, uv).rgb)) : texture(tLow, uv).rgb; }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  bool acc = uHave == 2 || (uHave == 1 && gl_FragCoord.y >= uRes.y - uScanY);
  vec3 c = pic(uv, acc);
  if (uBloom > 0.) { // a ring of looks around each dot: whatever is very bright nearby leaks in
    vec3 g = vec3(0.); float n = 0.; vec2 asp = vec2(uRes.y / uRes.x, 1.);
    for (int i = 0; i < 28; i++) { float fi = float(i) + .5, r = sqrt(fi / 28.) * .055, a = fi * 2.39996; vec2 o = vec2(cos(a), sin(a)) * r * asp;
      vec3 s = pic(clamp(uv + o, 0., 1.), uHave == 2 || (uHave == 1 && (uv.y + o.y) * uRes.y >= uRes.y - uScanY)); float w = 1. - r / .06;
      g += s * smoothstep(.72, 1., max(s.r, max(s.g, s.b))) * w; n += w; }
    c += g / n * uBloom * 2.2; }
  if (uHave == 1) { float d = abs(gl_FragCoord.y - (uRes.y - uScanY)); c += vec3(.35) * smoothstep(1.5, 0., d); }
  outCol = vec4(c, 1.);
}
`

export const TRACE_FRAG = /* glsl */ `
precision highp float; precision highp int; precision highp sampler2D; precision highp sampler3D;
out vec4 outCol;
#define MAXO ${MAXO}
#define MAXG 4
#define ZERO min(uNObj, 0) // 0, but the compiler cannot know: loops from it are not unrolled into copies (every long loop here starts from it)
uniform vec2 uRes; uniform int uSample, uPreview, uMode, uLDR, uBounces; uniform float uBlend, uTime; uniform vec2 uPickUV;
uniform vec3 uCamPos, uCamFw, uCamRt, uCamUp; uniform float uFocal, uLens, uFocus, uPanoYaw; uniform int uProj;
uniform vec3 uZenith, uHorizon, uHazeCol, uSunCol, uSunDir, uCloudCol, uCloud2Col, uFogCol, uMoonDir;
uniform float uHaze, uCloud, uStreak, uCloudScale, uCloud2, uStars, uSkySeed, uSunSize, uSunGlow, uSunSoft, uAmbient;
uniform float uFog, uFogH, uMoon, uMoonSize, uMoonPhase, uRainbow, uHalo;
uniform int uGround; uniform vec3 uG1, uG2; uniform float uWave, uGrain, uGRefl, uGScale;
uniform float uTerrOn, uTerrMode, uTerrH, uTerrR, uTerrFreq, uTerrRidge, uTerrSeed, uSnow, uTerrace, uPlateau, uSharp, uChannelBend, uSculptOn;
uniform vec4 uChannel; uniform vec3 uT1, uT2, uT3; uniform sampler2D uSculpt;
uniform int uNObj; uniform vec4 uOP[MAXO], uOS[MAXO], uR0[MAXO], uR1[MAXO], uR2[MAXO];
uniform sampler2D uMat;
uniform int uNLight; uniform vec4 uLP[4]; uniform vec3 uLC[4];
uniform sampler2D uLetters; uniform vec4 uTitlePose; uniform vec3 uTitleBox;
uniform vec4 uLD[4]; uniform float uRays, uComet, uTerrFlat, uGridHalf; uniform vec3 uCometDir, uPRo, uPRd; uniform sampler2D uPic; uniform sampler3D uModel; uniform highp sampler2DArray uGlyph;

// ---------- random ----------
uint rs;
float rnd(){ rs = rs * 747796405u + 2891336453u; uint w = ((rs >> ((rs >> 28u) + 4u)) ^ rs) * 277803737u; return float((w >> 22u) ^ w) / 4294967296.; }
vec3 rndBall(){ float z = rnd() * 2. - 1., a = rnd() * 6.2831853, r = sqrt(1. - z * z) * pow(rnd(), .3333); return vec3(r * cos(a), r * sin(a), z * pow(rnd(), .3333)); }

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
const mat2 M2 = mat2(.8, .6, -.6, .8);
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = ZERO; i < 5; i++) { s += a * noise(p); p = M2 * p * 2.02; a *= .5; } return s; }
float n3(vec3 p){ return (noise(p.xy) + noise(p.yz + 7.3) + noise(p.zx + 3.1)) / 3.; }

// ---------- land ----------
float terr(vec2 p, int oct){
  vec2 q = p * uTerrFreq + uTerrSeed * vec2(1., -.73);
  float a = .5, s = 0., w = 1.;
  for (int i = ZERO; i < 9; i++) { if (i >= oct) break;
    float n = noise(q); float r = 1. - abs(2. * n - 1.); r *= r;
    float v = mix(n, r, uTerrRidge); s += a * v * w; w = mix(1., clamp(v * 1.7, 0., 1.), uTerrRidge * .85);
    q = M2 * q * 2.03; a *= .5; }
  if (uSharp > 0.) s = mix(s, pow(max(s, 0.), 2.1) * 1.7, uSharp);
  if (uTerrace > 0.) { float f = s * 8., fl = floor(f); s = mix(s, (fl + smoothstep(.7, 1., f - fl)) / 8., uTerrace); }
  if (uPlateau > 0.) { float lv = mix(1.1, .2, uPlateau); s = -log(exp(-s * 28.) + exp(-lv * 28.)) / 28.; }
  float mask;
  if (uTerrMode < .5) { float d = length(p) / uTerrR; mask = smoothstep(1., 0., d); }
  else { float d = length(p); mask = smoothstep(.36, .7, noise(p * (.6 / uTerrR) + uTerrSeed * .37 + 5.)); mask *= smoothstep(uTerrR * 9., uTerrR * 6., d) * smoothstep(uTerrR * 3.1, uTerrR * 4.6, d); }
  if (uChannel.w > 0.) {
    vec2 local = p / uTerrR;
    float along = dot(local, vec2(-uChannel.y, uChannel.x));
    float curve = uChannelBend * exp(-5. * along * along);
    float distanceToCut = abs(dot(local, uChannel.xy) - uChannel.z - curve);
    mask *= smoothstep(uChannel.w * .55, uChannel.w, distanceToCut);
  }
  float h = uTerrH * (s * mask * 1.6 * (.3 + .7 * mask) - .16 * (1. - mask) - .015);
  if (uTerrFlat > .5) h = -.12 * max(uTerrH, 2.);
  if (uSculptOn > .5) { vec2 uv = p / (uTerrR * 3.2) + .5; vec2 e = smoothstep(vec2(0.), vec2(.06), uv) * smoothstep(vec2(1.), vec2(.94), uv);
    h += (texture(uSculpt, uv).r - .5) * 2.4 * max(uTerrH, 2.) * e.x * e.y; }
  return h;
}
float terrTop(){ return uTerrH * 1.45 + uSculptOn * 1.25 * max(uTerrH, 2.); }
// One march over the land for both rays that need one, so the land is written out once (see trace). mode 0: the ray's
// own march, to where it meets the land within tmax, or -1. mode 1: from a point toward the sun, for how much of its
// light the land lets by, 0 to 1.
float marchLand(vec3 ro, vec3 rd, float tmax, int mode){
  float top = terrTop(); float t = .08, tEnd = tmax, res = 1.;
  if (mode == 0) {
    t = 0.;
    if (ro.y > top) { if (rd.y >= 0.) return -1.; t = (ro.y - top) / (-rd.y); }
    float rr = uTerrMode < .5 ? uTerrR * (1. + uSculptOn * 1.3) : uTerrR * 9.;
    float a = dot(rd.xz, rd.xz), b = dot(ro.xz, rd.xz), c = dot(ro.xz, ro.xz) - rr * rr;
    if (a > 1e-6) { float h = b * b - a * c; if (h < 0.) return -1.; h = sqrt(h); t = max(t, (-b - h) / a); tEnd = min(tEnd, (-b + h) / a); }
    else if (c > 0.) return -1.;
    if (t > tEnd) return -1.;
  }
  for (int i = ZERO; i < 150; i++) {
    vec3 p = ro + rd * t; float h = p.y - terr(p.xz, mode == 0 ? 6 : 5);
    if (mode == 0) {
      if (h < .0015 * t + .002) return t;
      t += h * .42 + .002 * t; if (t > tEnd) break; if (rd.y > 0. && p.y > top) break;
    } else {
      res = min(res, 10. * h / t); if (res < .02 || p.y > top || i >= 27) break; t += clamp(h * .6, .06, 1.2);
    }
  }
  return mode == 0 ? -1. : clamp(res, 0., 1.);
}

// ---------- things: signed distances, so shapes can be cut out of each other and melted together ----------
vec3 toLocal(int i, vec3 p){ vec3 q = p - uOP[i].xyz; return vec3(dot(uR0[i].xyz, q), dot(uR1[i].xyz, q), dot(uR2[i].xyz, q)); }
float capped(vec2 w){ return min(max(w.x, w.y), 0.) + length(max(w, 0.)); }
// shapes from src/engine/shapes, each a distance function of the shape in a -1 to 1 box
${shapeFunctions()}
float sdThing(int i, vec3 p){
  vec3 q = toLocal(i, p); vec3 s = uOS[i].xyz; int k = int(uOP[i].w + .5); float r = uOS[i].w;
  float m = min(s.x, min(s.y, s.z));
  if (k == 0 || k == 8) {
    if (s.x == s.y && s.y == s.z) return length(q) - s.x;
    float k0 = length(q / s), k1 = length(q / (s * s)); return k0 < 1e-4 ? -m : k0 * (k0 - 1.) / k1; }
  if (k == 1) { float rr = r * m; vec3 d = abs(q) - s + rr; return length(max(d, 0.)) + min(max(d.x, max(d.y, d.z)), 0.) - rr; }
  vec3 u = q / s; float d;
  if (k == 2) { vec2 a = abs(u.xz); d = max((2. * max(a.x, a.y) + u.y - 1.) * .4472, -u.y - 1.); }
  else if (k == 3 || k == 6) d = capped(vec2(length(u.xz) - 1., abs(u.y) - 1.));
  else if (k == 4) d = max((2. * length(u.xz) + u.y - 1.) * .4472, -u.y - 1.);
  else if (k == 5) { float tube = clamp(r, .05, .95) * .5; d = length(vec2(length(u.xz) - (1. - tube), u.y)) - tube; }
  else if (k == 7) d = (length(u) - .8 + (n3(u * 1.7 + r * 17.) - .5) * .55 + (n3(u * 5. + r * 3.) - .5) * .12) * .55;
  else if (k == 9) {
    float tr = capped(vec2(length(u.xz) - .1, abs(u.y + .55) - .45));
    float cr = (length((u - vec3(0., .3, 0.)) * vec3(1., 1.15, 1.)) - .62 + (n3(u * 4. + r * 9.) - .5) * .3) * .6; d = min(tr, cr); }
  else if (k == 11) {
    float rr = length(u.xz); float edge = smoothstep(1., .12, rr);
    float top = (fbm(u.xz * 2.1 + r * 17.) * .75 + .12) * edge, bot = (pow(edge, 1.6) * (.75 + .5 * fbm(u.xz * 3.3 + r * 5.)));
    d = max((u.y > 0. ? u.y - top : -u.y - bot) * .32, (rr - 1.) * .6); }
  else if (k == 12) {
    vec3 b = abs(u) - 1.; float db = length(max(b, 0.)) + min(max(b.x, max(b.y, b.z)), 0.);
    float v = texture(uModel, clamp(u * .5 + .5, 0., 1.)).r - .5;
    d = (db > 0. ? db + max(v, .02) : v) * .8; }
  else if (k == 13) {
    // lettering: a distance picture of the text, given depth. tx = layer, used width, used height, style + 10 * edge
    vec4 tx = texelFetch(uMat, ivec2(6, i), 0), tb = texelFetch(uMat, ivec2(7, i), 0); vec3 w = q; float slack = .8;
    if (abs(tb.z) > .01) { float sg = sign(tb.z), R = 2. * s.x / abs(tb.z); w.z += sg * R * (1. - cos(min(abs(tb.z), 6.2831853) * .5)) * .5; float a = atan(w.x, R - sg * w.z); w = vec3(a * R, w.y, sg * (R - length(vec2(w.x, R - sg * w.z)))); slack = .6; }
    if (abs(tb.w) > .01) { float sg = sign(tb.w), R = 2. * s.x / abs(tb.w), a = atan(w.x, R + sg * w.y); w = vec3(a * R, sg * (length(vec2(w.x, R + sg * w.y)) - R), w.z); slack = .6; }
    vec2 uv = .5 + w.xy / (2. * s.xy) * tx.yz;
    float px = min(2. * s.x / (tx.y * float(textureSize(uGlyph, 0).x)), 2. * s.y / (tx.z * float(textureSize(uGlyph, 0).y)));
    float e = (texture(uGlyph, vec3(clamp(uv, 0., 1.), tx.x)).r * 255. - 128.) * .25 * px;
    vec2 ob = abs(w.xy) - s.xy; e += length(max(ob, 0.));
    float st = mod(tx.w, 10.), ed = floor(tx.w / 10.), bev = tb.x;
    if (st > 1.5) return (length(vec2(e, w.z)) - tb.y) * slack;
    if (st > .5) e = abs(e) - tb.y;
    vec2 d0 = vec2(e, abs(w.z) - s.z);
    if (ed < .5) { vec2 dd = d0 + bev; d = length(max(dd, 0.)) + min(max(dd.x, dd.y), 0.) - bev; }
    else if (ed < 1.5) d = max(max(d0.x, d0.y), (d0.x + d0.y + bev) * .7071);
    else d = length(max(d0, 0.)) + min(max(d0.x, d0.y), 0.);
    return d * slack; }
  ${shapeBranches((id) => KINDS.indexOf(id))}
  else {
    d = capped(vec2(length(u.xz) - .08, abs(u.y + .7) - .3)); float rr = length(u.xz);
    for (int j = ZERO; j < 3; j++) { float fj = float(j); float top = 1. - fj * .36, h = .78, rad = .4 + fj * .2;
      vec2 nrm = normalize(vec2(h, rad)); d = min(d, max(dot(vec2(rr, u.y - top), nrm), top - h - u.y)); }
  }
  return d * m;
}
float smin(float a, float b, float k){ float h = clamp(.5 + .5 * (b - a) / k, 0., 1.); return mix(b, a, h) - k * h * (1. - h); }
int gMask;
float map(vec3 p, out int id){
  float dp[MAXG]; float dn[MAXG]; float dk[MAXG]; float db[MAXG]; int ip[MAXG]; int ic[MAXG]; int ik[MAXG]; int ib[MAXG]; float bn[MAXG];
  for (int g = ZERO; g < MAXG; g++) { dp[g] = 1e9; dn[g] = 1e9; dk[g] = -1e9; db[g] = 1e9; bn[g] = 1e9; ip[g] = 0; ic[g] = 0; ik[g] = 0; ib[g] = 0; }
  for (int i = ZERO; i < MAXO; i++) { if (i >= uNObj) break; if (((gMask >> i) & 1) == 0) continue;
    float d = sdThing(i, p); int g = int(uR1[i].w + .5); int role = int(uR0[i].w + .5);
    if (role == 1) { if (d < dn[g]) { dn[g] = d; ic[g] = i; } }
    else if (role == 2) { if (d > dk[g]) { dk[g] = d; ik[g] = i; } }
    else if (int(uOP[i].w + .5) == 8) { db[g] = smin(db[g], d, .9); if (d < bn[g]) { bn[g] = d; ib[g] = i; } }
    else if (d < dp[g]) { dp[g] = d; ip[g] = i; }
  }
  float res = 1e9; id = 0;
  for (int g = ZERO; g < MAXG; g++) {
    float d = dp[g]; int j = ip[g];
    if (db[g] < d) { d = db[g]; j = ib[g]; }
    if (d > 1e8) continue;
    if (-dn[g] > d) { d = -dn[g]; j = ic[g]; }
    if (dk[g] > -1e8 && dk[g] > d) { d = dk[g]; j = ik[g]; }
    if (d < res) { res = d; id = j; }
  }
  return res;
}
// One march through the things for every ray there is, so that map(), with every shape's distance in it, is written
// out once: Direct3D's compiler (Chrome and Edge on Windows) copies a function out in full wherever it is called.
//   what 0: a ray from outside, to the first surface within tmax (-1 if it meets none);
//   what 1: a ray inside a thing, as it goes through glass, to where it comes out (among the things in gMask);
//   what 2: a walk through a thing made of cloud from tmax along the ray, gathering its light into gCloud*.
// With wantN, the way the surface faces where the ray stopped is left in gNormal: the four looks about the point that
// find it are taken in this same loop.
vec3 gNormal;
vec3 gCloudAlb, gCloudAmb, gCloudAt, gCloudAcc; float gCloudDen, gCloudSoft, gCloudStep, gCloudSun, gCloudTr;
float marchThings(vec3 ro, vec3 rd, float tmax, int what, bool wantN, out int id){
  id = 0; gNormal = vec3(0., 1., 0.);
  float t = what == 2 ? tmax : 0., t1 = tmax;
  if (what == 0) {
    int mask = 0; float t0 = 1e9; t1 = -1.;
    for (int i = ZERO; i < MAXO; i++) { if (i >= uNObj) break;
      int role = int(uR0[i].w + .5);
      if (role == 2) { mask |= 1 << i; continue; }
      vec3 oc = ro - uOP[i].xyz; float R = uR2[i].w; float b = dot(oc, rd), c = dot(oc, oc) - R * R, h = b * b - c;
      if (h < 0.) continue; h = sqrt(h); float tb = -b + h; if (tb < 0.) continue;
      mask |= 1 << i; if (role == 0) { t0 = min(t0, max(-b - h, 0.)); t1 = max(t1, tb); }
    }
    gMask = mask; if (t1 < 0.) return -1.;
    t = max(t0, 1e-3); t1 = min(t1, tmax);
  }
  const vec2 e = vec2(.0012, -.0012);
  int tap = -1, tmp = 0; float hitT = -1.; vec3 hp = ro, ns = vec3(0.);
  for (int s = ZERO; s < 126; s++) {
    if (tap < 0 && ((what == 0 && t > t1) || (what == 2 && s >= 26))) break;
    vec3 o = tap <= 0 ? e.xyy : tap == 1 ? e.yyx : tap == 2 ? e.yxy : e.xxx;
    vec3 q = tap < 0 ? ro + rd * t : hp + o;
    float d = map(q, tmp);
    if (tap >= 0) { ns += o * d; tap++; if (tap == 4) { gNormal = normalize(ns); break; } continue; }
    bool stop = false;
    if (what == 0) { id = tmp; if (d < .0005 * t + .0004) stop = true; else { if (s >= 119) break; t += d; } }
    else if (what == 1) { d = -d; if (d < .0015) stop = true; else { t += max(d, .004); if (t > 40. || s >= 47) stop = true; } }
    else { d = -d; if (d < 0.) break;
      float den = gCloudDen * smoothstep(0., gCloudSoft, d) * (.25 + 1.5 * n3(q * 1.4 + 3.) * n3(q * 4.1));
      float a = 1. - exp(-den * gCloudStep * 3.2); float lit = .5 + .5 * smoothstep(-.3, .7, dot(normalize(q - gCloudAt), uSunDir));
      gCloudAcc += gCloudTr * a * gCloudAlb * (gCloudAmb * 1.5 + uSunCol * lit * (.35 + .65 * gCloudSun)); gCloudTr *= 1. - a; t += gCloudStep; if (gCloudTr < .03) break; }
    if (stop) { hitT = t; if (!wantN) break; hp = ro + rd * t; tap = 0; }
  }
  return what == 2 ? t : hitT;
}

// ---------- lettering: an extruded distance field read from a texture ----------
vec3 rotY(vec3 v, float a){ float c = cos(a), s = sin(a); return vec3(c * v.x - s * v.z, v.y, s * v.x + c * v.z); }
float letterDistance(vec3 p){
  vec2 uv = clamp(p.xy / (2. * uTitleBox.xy) + .5, 0., 1.);
  float pixel = 2. * uTitleBox.y / float(textureSize(uLetters, 0).y);
  float edge = (texture(uLetters, vec2(uv.x, 1. - uv.y)).r * 255. - 128.) * .25 * pixel;
  float bevel = min(uTitleBox.z * .6, pixel * 2.6);
  vec2 d = vec2(edge + bevel, abs(p.z) - uTitleBox.z + bevel);
  return length(max(d, 0.)) + min(max(d.x, d.y), 0.) - bevel;
}
float hitLetters(vec3 ro, vec3 rd, float limit, out vec3 normal){
  if (uTitleBox.x <= 0.) return -1.;
  vec3 o = rotY(ro - uTitlePose.xyz, -uTitlePose.w), d = rotY(rd, -uTitlePose.w);
  vec3 safe = mix(vec3(1e-8), d, greaterThan(abs(d), vec3(1e-8)));
  vec3 a = (-uTitleBox - o) / safe, b = (uTitleBox - o) / safe;
  vec3 lo = min(a, b), hi = max(a, b);
  float t = max(.002, max(lo.x, max(lo.y, lo.z))), end = min(limit, min(hi.x, min(hi.y, hi.z)));
  for (int i = ZERO; i < 100; i++) {
    if (t > end + .0002) break;
    vec3 p = o + t * d;
    float h = letterDistance(p);
    if (h < .001) {
      vec2 e = vec2(.0015, 0.);
      vec3 g; for (int k = ZERO; k < 3; k++) { vec3 o = k == 0 ? e.xyy : k == 1 ? e.yxy : e.yyx; g[k] = letterDistance(p + o) - letterDistance(p - o); }
      normal = rotY(normalize(g), uTitlePose.w);
      return t;
    }
    t += max(.0008, h * .88);
  }
  return -1.;
}

// ---------- shadows ----------
// how much light gets past the thing a shadow ray met (t under 0: it met none)
float shadowOf(float t, int id){
  if (t <= 0.) return 1.;
  vec4 m3 = texelFetch(uMat, ivec2(3, id), 0); vec4 m4 = texelFetch(uMat, ivec2(4, id), 0); return m4.x > 0. ? 1. : m4.y > 0. ? 1. - .6 * m4.y : m3.y * .7;
}

// ---------- sky ----------
vec3 fogCol(){ return mix(uHorizon, uHazeCol, uHaze); }
vec3 sky(vec3 rd, float sunOn){
  float y = uGround == 5 ? abs(rd.y) : max(rd.y, 0.);
  vec3 c = mix(uHorizon, uZenith, pow(y, .48));
  if (uStars > 0.) { vec2 sp = vec2(atan(rd.z, rd.x), asin(clamp(rd.y, -1., 1.))) * 70.; vec2 ce = floor(sp); float h = hash(ce);
    c += uStars * step(.972, h) * smoothstep(.22, 0., length(fract(sp) - .5)) * (.4 + .6 * hash(ce + 3.)) * smoothstep(0., .2, y); }
  if (uMoon > 0.) { float md = dot(rd, uMoonDir); float cs = cos(uMoonSize);
    if (md > cs) { vec3 mr = normalize(cross(vec3(0., 1., 0.), uMoonDir)), mu = cross(uMoonDir, mr); float sn = sin(uMoonSize);
      vec2 q = vec2(dot(rd, mr), dot(rd, mu)) / sn; float z = sqrt(max(1. - dot(q, q), 0.)); float a = uMoonPhase * 6.2831853;
      float lit = max(dot(vec3(q, z), vec3(sin(a), 0., -cos(a))), 0.); float tex = .72 + .28 * fbm(q * 4. + 3.);
      c = mix(c, vec3(.96, .95, .9) * (lit * 1.5 * tex + .03) * uMoon, smoothstep(0., .06, z)); } }
  float cl = 0.;
  if (rd.y > .004) {
    if (uCloud2 > .01) { vec2 uv = rd.xz / (rd.y + .3) * .7 + uSkySeed * 1.7 + 7. + uTime * vec2(.011, .003);
      float n = fbm(vec2(uv.x * .22, uv.y) * 2.2); float th = mix(.8, .25, uCloud2);
      float a = smoothstep(th, th + .4, n) * smoothstep(0., .2, rd.y) * .75; c = mix(c, uCloud2Col, a); cl = a * .5; }
    if (uCloud > .01) {
      vec2 uv = rd.xz / (rd.y + .14); uv = vec2(uv.x * mix(1., .22, uStreak), uv.y) * 1.15 * uCloudScale + uSkySeed + uTime * vec2(.03, .008);
      float n = fbm(uv) + .18 * fbm(uv * 4.3 + 9.);
      float th = mix(.86, .30, uCloud);
      float a = smoothstep(th, th + .26, n) * smoothstep(0., .16, rd.y);
      float lit = smoothstep(th, th + .5, n);
      vec3 cc = mix(uCloudCol * 1.12, uCloudCol * .72, lit);
      cc = mix(cc, cc + uSunCol * .25, pow(max(dot(rd, uSunDir), 0.), 6.));
      c = mix(c, cc, a * .92); cl = max(cl, a);
    }
  }
  c = mix(c, uHazeCol, uHaze * exp(-y * mix(16., 2.6, uHaze)));
  float sd = max(dot(rd, uSunDir), 0.);
  if (uRainbow > 0. && rd.y > 0.) { float x = (acos(clamp(dot(rd, -uSunDir), -1., 1.)) - .7) / .055;
    if (x > 0. && x < 1.) c += uRainbow * .5 * (.5 + .5 * cos(6.2831853 * (x * .8 + vec3(.5, .83, .17)))) * smoothstep(0., .2, x) * smoothstep(1., .8, x) * smoothstep(0., .15, rd.y) * (1. - cl * .8); }
  if (uHalo > 0.) { float a = acos(min(sd, 1.)); c += uHalo * .3 * uSunCol * exp(-pow((a - .384) / .02, 2.)) * (1. - cl * .5); }
  if (uComet > 0. && rd.y > 0.) { vec3 C = uCometDir; vec3 a = normalize(cross(C, vec3(0., 1., 0.))); vec3 td = normalize(a * .8 + cross(a, C) * .6);
    vec3 v = rd - C * dot(rd, C); float along = dot(v, td), across = length(v - td * along);
    float tail = along > 0. ? exp(-across * across * (2600. / (1. + along * 45.))) * exp(-along * 8.) : 0.;
    c += uComet * (exp(-dot(v, v) * 9000.) * 2.2 + tail * .7) * vec3(.82, .92, 1.) * (1. - cl * .8); }
  float cs = cos(uSunSize);
  c += sunOn * uSunCol * (smoothstep(cs - .0003, cs, sd) * 3. * (1. - cl * .7) + uSunGlow * (pow(sd, 220.) * .55 + pow(sd, 14.) * .16));
  return c;
}

// ---------- surface patterns ----------
vec3 pattern(int kind, vec3 p, vec3 a, vec3 b){
  if (kind == 1) { float n = n3(p * 2.3) * .7 + n3(p * 9.) * .45 + n3(p * 41.) * .4 + .5 * noise(vec2(p.x * 9. + p.z * 7., p.y * .7));
    vec3 g = abs(fract(p * vec3(1.6, 1.1, 1.6)) - .5); float seam = smoothstep(.46, .5, max(g.x, g.y)); return mix(b, a, clamp(n * .8, 0., 1.)) * (.45 + n * .75) * (1. - .3 * seam); }
  if (kind == 2) { float v = sin(p.x * 3. + p.y * 1.3 + 6. * fbm(p.xy * 1.4 + p.z) + 3. * n3(p * 2.)); return mix(a, b, pow(.5 + .5 * v, 3.)); }
  if (kind == 3) { float r = length(p.xz + .35 * vec2(n3(p * 1.3), n3(p * 1.3 + 4.))) * 7. + p.y * .35; return mix(a, b, smoothstep(.25, .75, fract(r)) * .8 + .2 * n3(p * 30.)); }
  if (kind == 4) { vec3 c = floor(p * 2.); return mod(c.x + c.y + c.z, 2.) < .5 ? a : b; }
  if (kind == 5) return mix(a, b, smoothstep(.45, .55, fract(p.y * 2.5)));
  if (kind == 6) { vec3 c = fract(p * 2.2) - .5; return mix(b, a, smoothstep(.28, .33, length(c))); }
  if (kind == 7) return mix(a, b, smoothstep(.35, .65, n3(p * 2.) * .6 + n3(p * 6.) * .4));
  return a;
}

// ---------- the ray ----------
// kind: 0 sky, 1 sea or floor, 2 land, 3 a thing, 4 lettering
void groundFog(inout vec3 col, inout vec3 thr, vec3 ro, vec3 rd, float t){
  if (uFog <= 0.) return; float k = 1. / uFogH; float a = exp(-max(ro.y, 0.) * k);
  float od = uFog * .22 * a * (abs(rd.y) < 1e-4 ? t : (1. - exp(-rd.y * k * t)) / (rd.y * k));
  float T = exp(-max(od, 0.)); col += thr * (1. - T) * uFogCol; thr *= T;
}

vec4 gOut; // what a pick or mask pass writes (uMode != 0)
// The tracer is a loop of steps, and every step has the one march through the things in it (marchThings), the one
// march over the land (marchLand) and the one test of the lettering (hitLetters): the eye's ray and each bounce, the
// ray through a glass, the walk through a cloud, and the shadow rays toward the sun and each lamp all go that way, and
// the sky is looked up in one place after the loop. Each of those is a long function, and Direct3D's compiler (Chrome
// and Edge on Windows) writes a function out in full wherever it is called: called where each was wanted, they took
// over two minutes to compile there. What a step does is its stage:
//   0 what the ray meets (or, inside a glass, where it comes out);   1 the light rays' look toward the sun;
//   2 the sun's shadow on the surface;   3 to 6 a lamp's;   7 the walk through a thing made of cloud;
// then the surface is lit and the ray sent on.
vec3 trace(vec3 ro, vec3 rd){
  vec3 col = vec3(0.), thr = vec3(1.);
  float sunOn = 1.;
  vec3 skyDir[7]; vec3 skyW[7]; float skySun[7]; float skyK[7]; int nSky = 0; // looks at the sky that are owed
  int stage = 0, bounce = 0, primMask = 0; bool inside = false, ended = false;
  // the surface the ray met, kept for the stages after
  int kind = 0, id = -1; float t = 0.; vec3 p = vec3(0.), n = vec3(0., 1., 0.);
  vec3 alb = vec3(0.), lp = vec3(0.), pS = vec3(0.), pT = vec3(0.), lampN = vec3(0., 1., 0.), amb = vec3(0.), lamp = vec3(0.), L = uSunDir;
  vec4 m0 = vec4(0.), m1 = vec4(0.), m2 = vec4(0.), m3 = vec4(0.), m4 = vec4(0.); float glow = 0., sh = 1., depth = 1e3; bool wantLamps = false, cloud = false;
  vec3 rayQ = vec3(0.), cloudPin = vec3(0.); float rayReach = 0., cloudT0 = 0.;
  for (int it = ZERO; it < 56; it++) {
    // ---- this step's march through the things
    vec3 qo = ro, qd = rd; float qmax = 900., tsea = 1e9; int what = 0; bool go = true;
    float lnl = 0., lspot = 0., ld2 = 0.; int l = max(stage - 3, 0);
    if (stage == 0) {
      if (inside) { what = 1; qmax = 40.; gMask = primMask; }
      else { if (uGround != 5 && rd.y < -1e-5) { float tw = -ro.y / rd.y; if (tw > 1e-3) tsea = tw; } qmax = min(tsea, 900.); }
    } else if (stage == 1) { qo = rayQ; qd = uSunDir; qmax = 600.; }
    else if (stage == 2) { qo = pS; qd = L; qmax = 600.; }
    else if (stage == 7) { what = 2; qo = cloudPin; qmax = cloudT0; gMask = primMask; }
    else {
      vec3 Lv = uLP[l].xyz - p; ld2 = dot(Lv, Lv); float d = sqrt(ld2); vec3 Ll = Lv / d; lnl = dot(lampN, Ll);
      lspot = uLD[l].w > -1.5 ? smoothstep(uLD[l].w, uLD[l].w + .06, dot(-Ll, uLD[l].xyz)) : 1.;
      float reach = d - uLP[l].w - .02;
      if (lnl <= 0. || lspot <= 0.) { go = false; lnl = 0.; }
      else if (reach < 0.) { go = false; ld2 = 0.; } // within the lamp itself: lit in full
      else { qo = p + lampN * .006; qd = Ll; qmax = reach; }
    }
    int hid = 0; float th = -1.;
    if (go) th = marchThings(qo, qd, qmax, what, stage == 0, hid);
    bool hitThing = stage == 0 && (inside || (th > 0. && th < tsea));
    float sFar = (stage == 0 || stage == 7) ? 1. : shadowOf(th, hid); // a shadow ray: what the things let by
    // ---- its march over the land: the ray's own, or toward the sun for the land's shadow
    bool landRay = uTerrOn > .5 && stage == 0 && !inside, landShadow = uTerrOn > .5 && (stage == 1 || stage == 2) && sFar > 0.;
    float tl = -1.;
    if (landRay || landShadow) tl = marchLand(landRay ? ro : stage == 1 ? rayQ : pT, qd, min(hitThing ? th : tsea, 600.), landRay ? 0 : 1);
    // ---- and the lettering in its way
    float tNear = tsea; if (hitThing) tNear = th; if (landRay && tl > 0. && tl < tNear) tNear = tl;
    vec3 ln = vec3(0.); float tw = -1.;
    if (go && what == 0 && (stage == 0 || sFar > 0.)) tw = hitLetters(qo, qd, stage == 0 ? tNear : qmax, ln);
    float s = tw > 0. ? 0. : sFar; if (landShadow) s = min(s, tl); // a shadow ray: what gets by all three

    bool met = false; // the ray has met something, and the light rays (if any) are in: the surface comes next
    if (stage == 0) {
      vec3 hp = ro + rd * max(th, 0.); vec3 hn = gNormal;
      if (inside) { // out of the glass again, bent
        vec3 r2 = refract(rd, -hn, m3.z); if (dot(r2, r2) < .01) r2 = rd;
        ro = hp + hn * .01; rd = normalize(r2); sunOn = 1.; inside = false;
        bounce++; if (bounce >= uBounces) break; continue;
      }
      t = tsea; kind = tsea < 1e8 ? 1 : 0; id = -1; n = vec3(0., 1., 0.);
      if (hitThing) { t = th; kind = 3; id = hid; n = hn; }
      if (tl > 0. && tl < t) { t = tl; kind = 2; }
      if (tw > 0.) { t = tw; kind = 4; n = ln; id = MAXO; }
      primMask = gMask;
      if (uMode != 0) { // a pick or a mask: only what the first ray meets
        ended = true;
        if (uMode == 9 || uMode == 10) { gOut = vec4(float(kind), float(id), t, 1.); break; }
        vec3 m = vec3(0.);
        if (uMode == 1) m = vec3(kind == 0 ? 0. : exp(-t * .035));
        else if (uMode == 2) m = vec3(kind >= 3 ? 1. : 0.);
        else m = vec3(kind == 0 ? 0. : clamp((ro + rd * t).y / 12., 0., 1.));
        gOut = vec4(uLDR == 1 ? m : pow(m, vec3(2.2)) * 1.2, uBlend); break; }
      if (bounce == 0 && uRays > 0. && uPreview == 0) { rayReach = min(t, 70.); rayQ = ro + rd * rayReach * rnd(); stage = 1; continue; }
      met = true;
    } else if (stage == 1) {
      col += thr * uRays * uSunCol * s * (.22 + 1.6 * pow(max(dot(rd, uSunDir), 0.), 6.)) * .55 * (1. - exp(-rayReach * .04));
      met = true;
    }
    if (met) {
      if (kind == 0) { groundFog(col, thr, ro, rd, 2000.); skyDir[nSky] = rd; skyW[nSky] = thr; skySun[nSky] = sunOn; skyK[nSky] = 1.; nSky++; ended = true; break; }
      p = ro + rd * t;
      float T = exp(-t * uHaze * uHaze * .02);
      col += thr * (1. - T) * fogCol(); thr *= T;
      groundFog(col, thr, ro, rd, t);
      amb = (mix(uHorizon, uZenith, .5) * .55 + .12) * uAmbient * 2.;
      // the land's height about the point, asked in one place: at four spots for which way it faces there (the ray
      // met land), or at one for how deep the sea is over it (it met the sea)
      float le = max(.012, .0025 * t); float lh[4]; lh[0] = 0.; lh[1] = 0.; lh[2] = 0.; lh[3] = 0.;
      int taps = uTerrOn > .5 ? (kind == 2 ? 4 : kind == 1 ? 1 : 0) : 0;
      for (int i = ZERO; i < taps; i++) lh[i] = terr(p.xz + (kind != 2 ? vec2(0.) : i == 0 ? vec2(-le, 0.) : i == 1 ? vec2(le, 0.) : i == 2 ? vec2(0., -le) : vec2(0., le)), kind == 2 ? 9 : 5);
      depth = taps == 1 ? -lh[0] : 1e3;
      // the surface: which way it faces, what it is made of, and where its shadows are looked for
      alb = vec3(0.); lp = vec3(0.); m0 = vec4(0.); m1 = vec4(0.); m2 = vec4(0.); m3 = vec4(0.); m4 = vec4(0.); glow = 0.;
      pS = p + vec3(0., .003, 0.); pT = pS + vec3(0., .01, 0.); lampN = vec3(0., 1., 0.); wantLamps = uNLight > 0; cloud = false;
      if (kind == 2) {
        n = normalize(vec3(lh[0] - lh[1], 2. * le, lh[2] - lh[3]));
        float hh = clamp(p.y / (uTerrH * 1.1), 0., 1.);
        float sp = n3(p * vec3(5., 5., 5.));
        alb = mix(uT1, uT2, smoothstep(.03, .2, hh + (sp - .5) * .08));
        float rock = smoothstep(.82, .55, n.y);
        alb = mix(alb, uT3, max(smoothstep(.42, .8, hh + (sp - .5) * .25), rock * .85));
        alb = mix(alb, vec3(.95, .96, 1.), uSnow * smoothstep(.62, .75, hh + (sp - .5) * .2) * smoothstep(.5, .8, n.y));
        alb *= .72 + .56 * sp;
        if (uGround == 2) alb = mix(alb, uG1 * 2., smoothstep(.06, 0., hh) * .8);
        pS = p + n * .01; pT = p + n * .02; lampN = n;
      } else if (kind >= 3) {
        m0 = texelFetch(uMat, ivec2(0, id), 0); m1 = texelFetch(uMat, ivec2(1, id), 0); m2 = texelFetch(uMat, ivec2(2, id), 0); m3 = texelFetch(uMat, ivec2(3, id), 0);
        m4 = texelFetch(uMat, ivec2(4, id), 0); glow = m4.x;
        lp = kind == 3 ? toLocal(id, p) : rotY(p - uTitlePose.xyz, -uTitlePose.w);
        int tex = int(m0.w + .5);
        if (tex == 8) { vec3 u = kind == 3 ? lp / uOS[id].xyz : lp / uTitleBox; int k = kind == 3 ? int(uOP[id].w + .5) : 1;
          vec2 uv = (k == 1 || k == 2 || k == 6 || k == 13) ? u.xy * .5 + .5 : vec2(atan(u.x, u.z) / 6.2831853 + .5, u.y * .5 + .5);
          alb = pow(texture(uPic, fract(uv * m1.w)).rgb, vec3(2.2)) * m0.rgb * 1.6; }
        // its pattern (unless it shows a picture), then the second laid over it if it has one: both through one call
        for (int lay = (tex == 8 ? 1 : ZERO); lay < (m4.w > 0. ? 2 : 1); lay++) {
          vec3 c = pattern(lay == 0 ? tex : int(m4.z + .5), lay == 0 ? lp * m1.w : lp * m1.w * 2.3 + 5., lay == 0 ? m0.rgb : alb, lay == 0 ? m1.rgb : texelFetch(uMat, ivec2(5, id), 0).rgb);
          alb = lay == 0 ? c : mix(alb, c, m4.w); }
        if (kind == 3) { int k = int(uOP[id].w + .5); vec3 u = lp / uOS[id].xyz;
          if (k == 9 && u.y < -.12 && length(u.xz) < .16) alb = vec3(.13, .07, .035);
          if (k == 10 && u.y < -.42 && length(u.xz) < .12) alb = vec3(.11, .06, .03); }
        if (m3.w > 0.) { vec3 q = lp * m1.w * 6.; float e = .02; float b0 = n3(q);
          n = normalize(n + m3.w * 1.6 * (vec3(n3(q + vec3(e, 0., 0.)), n3(q + vec3(0., e, 0.)), n3(q + vec3(0., 0., e))) - b0) / e * .06); }
        cloud = kind == 3 && m4.y > 0.; pS = p + n * (cloud ? .02 : .004); pT = pS + vec3(0., .01, 0.); lampN = n; wantLamps = wantLamps && !cloud && glow <= 0.;
      }
      L = uSunDir; if (uPreview == 0 && uSunSoft > 0.) L = normalize(L + rndBall() * uSunSoft);
      stage = 2; continue;
    }
    if (stage == 2) { sh = s; lamp = vec3(0.); stage = wantLamps ? 3 : 9; }
    else if (stage == 7) { // through the cloud: its light is gathered, and the ray goes on from its far side
      col += thr * gCloudAcc; thr *= gCloudTr; if (max(thr.r, max(thr.g, thr.b)) < .012) { ended = true; break; }
      ro = cloudPin + rd * (th + .02); stage = 0;
      bounce++; if (bounce >= uBounces) break; continue;
    } else { lamp += uLC[l] * lnl * lspot * s / (1. + ld2 * .06); stage = l + 1 < uNLight ? stage + 1 : 9; }
    if (stage != 9) continue;

    // ---- the sun's shadow and the lamps are known: light the surface, and send the ray on
    stage = 0;
    float refl = 0.; vec3 tint = vec3(1.); vec3 lc = vec3(0.); float gloss = 1.;
    if (kind == 1) {
      if (uGround == 0) {
        float fade = 1. / (1. + t * .035);
        vec2 w = p.xz + uTime * vec2(.35, .12); float e = .06;
        float h0 = fbm(w * .55) + .35 * fbm(w * 2.3 + 3.);
        float hx = fbm((w + vec2(e, 0.)) * .55) + .35 * fbm((w + vec2(e, 0.)) * 2.3 + 3.);
        float hz = fbm((w + vec2(0., e)) * .55) + .35 * fbm((w + vec2(0., e)) * 2.3 + 3.);
        vec2 g = vec2(hx - h0, hz - h0) / e * uWave * .9 * fade;
        g += (vec2(hash(floor(p.xz * 38.)), hash(floor(p.xz * 38.) + 11.)) - .5) * uGrain * .55;
        n = normalize(vec3(-g.x, 1., -g.y));
        float fr = pow(1. - max(dot(-rd, n), 0.), 5.);
        refl = clamp(mix(.04 + .96 * fr, 1., uGRefl), 0., 1.);
        vec3 body = mix(uG2, uG1, smoothstep(0., uTerrH * .22 + .3, depth));
        float sparkle = 1. + uGrain * (hash(floor(p.xz * 38.) + 5.) - .5) * .9;
        lc = body * sparkle * (amb + uSunCol * .55 * max(uSunDir.y, 0.) * sh + lamp * .6);
        lc += uSunCol * pow(max(dot(reflect(rd, n), uSunDir), 0.), 90.) * .9 * sh * fade;
      } else if (uGround == 1) {
        vec2 ck = floor(p.xz * .5 * uGScale); float c = mod(ck.x + ck.y, 2.);
        refl = mix(.08, .9, uGRefl) * (.35 + .65 * pow(1. - max(-rd.y, 0.), 3.));
        lc = mix(uG1, uG2, c) * (amb + uSunCol * max(uSunDir.y, 0.) * sh + lamp);
      } else if (uGround == 2) {
        vec2 w = p.xz * .35 * uGScale; float f = fbm(w + fbm(w * 2. + 4. + uTime * .2) * 1.3); float crack = smoothstep(.30, .50, f);
        vec3 hot = mix(uG1 * vec3(2.6, 1.9, 1.2), uG1, smoothstep(.56, .8, f));
        lc = mix(hot * 1.5, uG2 * (amb + uSunCol * .5 * sh + lamp), crack);
        refl = .04 * crack;
      } else if (uGround == 3) {
        vec2 w = p.xz * uGScale; float e = .05; float h0 = fbm(w * .3) + .12 * sin(w.x * 3. + 4. * fbm(w * .4));
        float hx = fbm((w + vec2(e, 0.)) * .3) + .12 * sin((w.x + e) * 3. + 4. * fbm((w + vec2(e, 0.)) * .4));
        float hz = fbm((w + vec2(0., e)) * .3) + .12 * sin(w.x * 3. + 4. * fbm((w + vec2(0., e)) * .4));
        n = normalize(vec3(-(hx - h0) / e * uWave, 1., -(hz - h0) / e * uWave));
        vec3 alb = mix(uG1, uG2, smoothstep(.3, .7, h0)) * (.9 + .2 * hash(floor(p.xz * 60.)) * uGrain);
        lc = alb * (amb + uSunCol * max(dot(n, uSunDir), 0.) * sh + lamp); refl = uGRefl * .5;
      } else {
        refl = mix(.6, .96, uGRefl); tint = mix(vec3(1.), uG2 * 2.2, .55); lc = uG1 * (amb + uSunCol * .3 * sh) * .25;
      }
    } else if (kind == 2) {
      lc = alb * (amb * (.6 + .4 * n.y) + uSunCol * max(dot(n, uSunDir), 0.) * sh + lamp);
    } else {
      gloss = m3.x; float clear = kind == 3 ? m3.y : 0.;
      if (cloud) { // a thing made of cloud: walk through it, gathering light (the next step's march)
        vec3 sz = uOS[id].xyz; float span = max(sz.x, max(sz.y, sz.z));
        gCloudStep = span * 2.2 / 22.; gCloudSoft = min(sz.x, min(sz.y, sz.z)) * .45; gCloudDen = m4.y; gCloudAlb = alb; gCloudAmb = amb; gCloudSun = sh; gCloudAt = uOP[id].xyz;
        gCloudAcc = vec3(0.); gCloudTr = 1.;
        cloudPin = p + rd * .01; cloudT0 = gCloudStep * (uPreview == 1 ? .5 : rnd());
        stage = 7; continue; }
      float nl = max(dot(n, uSunDir), 0.) * sh;
      vec3 rf = reflect(rd, n);
      float fr = pow(1. - max(dot(-rd, n), 0.), 5.);
      vec3 spec = uSunCol * pow(max(dot(rf, uSunDir), 0.), mix(6., 420., gloss * gloss)) * sh * m2.w * (.25 + 1.6 * gloss);
      vec3 dif = alb * m2.x * (amb * (.85 + .3 * n.y) + uSunCol * nl * 1.1 + lamp);
      refl = clamp(m2.y + (1. - m2.y) * fr * (.25 + .5 * m2.w), 0., 1.);
      tint = mix(vec3(1.), alb, m2.z);
      col += thr * (spec + alb * glow);
      if (clear > .001) {
        col += thr * (1. - refl) * (1. - clear) * dif;
        bool through;
        if (uPreview == 1) { skyDir[nSky] = rf; skyW[nSky] = thr * refl * tint; skySun[nSky] = 0.; skyK[nSky] = .9; nSky++; thr *= (1. - refl) * clear * mix(vec3(1.), alb, .5); through = true; }
        else { float w = (1. - refl) * clear + refl; through = rnd() * w < (1. - refl) * clear; thr *= w * (through ? mix(vec3(1.), alb, .5) : tint); }
        if (max(thr.r, max(thr.g, thr.b)) < .012) { ended = true; break; }
        if (through) { // into the glass: the next step marches through it and comes out bent
          vec3 r1 = refract(rd, n, 1. / m3.z); if (dot(r1, r1) < .01) r1 = rf;
          ro = p - n * .008; rd = r1; inside = true; continue;
        }
        ro = p + n * .004; rd = rf; sunOn = .6;
        bounce++; if (bounce >= uBounces) break; continue;
      }
      lc = dif;
    }
    col += thr * (1. - refl) * lc;
    thr *= refl * tint;
    if (max(thr.r, max(thr.g, thr.b)) < .012) { ended = true; break; }
    ro = p + n * .004; rd = reflect(rd, n);
    if (uPreview == 0 && gloss < .98) { float rough = (1. - gloss) * (1. - gloss) * .6; rd = normalize(rd + rndBall() * rough); if (dot(rd, n) < 0.) rd = reflect(rd, n); }
    if (kind == 1 && rd.y < .002) { rd.y = .002; rd = normalize(rd); }
    sunOn = .6;
    bounce++; if (bounce >= uBounces) break;
  }
  // a ray out of bounces takes the sky's color, without its sun
  if (!ended) { skyDir[nSky] = rd; skyW[nSky] = thr; skySun[nSky] = 0.; skyK[nSky] = 1.; nSky++; }
  if (uMode == 0) for (int k = ZERO; k < nSky; k++) col += skyW[k] * sky(skyDir[k], skySun[k]) * skyK[k];
  return col;
}

void main(){
  vec2 fc = gl_FragCoord.xy;
  rs = (uint(fc.x) * 1973u + uint(fc.y) * 9277u + uint(uSample) * 26699u) | 1u; rnd();
  vec2 jit = uPreview == 1 ? vec2(.5) : vec2(rnd(), rnd());
  vec2 uv = (floor(fc) + jit - .5 * uRes) / min(uRes.x, uRes.y) * 2.;
  if (uMode == 9) uv = uPickUV;
  if (uMode == 11) { vec2 g = (fc / uRes - .5) * 2. * uGridHalf; float h = 0.; if (uTerrOn > .5) { float tt = marchLand(vec3(g.x, 200., g.y), vec3(0., -1., 0.), 400., 0); if (tt > 0.) h = 200. - tt; } outCol = vec4(max(h, 0.), 0., 0., 1.); return; }
  vec3 ro = uCamPos, rd;
  if (uProj == 1) { vec2 a = (floor(fc) + jit) / uRes; float lon = uPanoYaw - (a.x - .5) * 6.2831853, lat = (a.y - .5) * 3.14159265;
    rd = vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon)); }
  else {
    rd = normalize(uCamFw * uFocal + uCamRt * uv.x + uCamUp * uv.y);
    if (uLens > 0. && uPreview == 0 && uMode == 0) { float a = rnd() * 6.2831853, r = sqrt(rnd()) * uLens;
      vec3 fp = ro + rd * (uFocus / max(dot(rd, uCamFw), .05)); ro += (uCamRt * cos(a) + uCamUp * sin(a)) * r; rd = normalize(fp - ro); }
  }
  if (uMode == 10) { ro = uPRo; rd = uPRd; }
  vec3 c = min(trace(ro, rd), vec3(6.));
  if (uMode != 0) { outCol = gOut; return; }
  if (uLDR == 1) { c = c / (1. + .18 * c) * 1.12; float l = dot(c, vec3(.3, .59, .11)); c = mix(vec3(l), c, 1.12); c = pow(clamp(c, 0., 1.), vec3(1. / 2.2)); }
  outCol = vec4(c, uBlend);
}
`
