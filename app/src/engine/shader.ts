// The whole picture is ray traced by this one fragment shader, one sample per pixel per pass.
// Passes are averaged in a float target, so soft shadows, blurry reflections, depth of field and
// anti-aliasing all come from the same thing: many slightly different samples.

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
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  bool acc = uHave == 2 || (uHave == 1 && gl_FragCoord.y >= uRes.y - uScanY);
  vec3 c = acc ? (uAccLDR == 1 ? texture(tAcc, uv).rgb : tone(texture(tAcc, uv).rgb)) : texture(tLow, uv).rgb;
  if (uHave == 1) { float d = abs(gl_FragCoord.y - (uRes.y - uScanY)); c += vec3(.35) * smoothstep(1.5, 0., d); }
  outCol = vec4(c, 1.);
}
`

export const TRACE_FRAG = /* glsl */ `
precision highp float; precision highp int; precision highp sampler2D; precision highp sampler3D;
out vec4 outCol;
#define MAXO ${MAXO}
#define MAXG 4
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
float fbm(vec2 p){ float a = .5, s = 0.; for (int i = 0; i < 5; i++) { s += a * noise(p); p = M2 * p * 2.02; a *= .5; } return s; }
float n3(vec3 p){ return (noise(p.xy) + noise(p.yz + 7.3) + noise(p.zx + 3.1)) / 3.; }

// ---------- land ----------
float terr(vec2 p, int oct){
  vec2 q = p * uTerrFreq + uTerrSeed * vec2(1., -.73);
  float a = .5, s = 0., w = 1.;
  for (int i = 0; i < 9; i++) { if (i >= oct) break;
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
float marchTerr(vec3 ro, vec3 rd, float tmax){
  float top = terrTop(); float t = 0.;
  if (ro.y > top) { if (rd.y >= 0.) return -1.; t = (ro.y - top) / (-rd.y); }
  float rr = uTerrMode < .5 ? uTerrR * (1. + uSculptOn * 1.3) : uTerrR * 9.;
  float a = dot(rd.xz, rd.xz), b = dot(ro.xz, rd.xz), c = dot(ro.xz, ro.xz) - rr * rr;
  float tEnd = tmax;
  if (a > 1e-6) { float h = b * b - a * c; if (h < 0.) return -1.; h = sqrt(h); t = max(t, (-b - h) / a); tEnd = min(tEnd, (-b + h) / a); }
  else if (c > 0.) return -1.;
  if (t > tEnd) return -1.;
  for (int i = 0; i < 150; i++) {
    vec3 p = ro + rd * t; float h = p.y - terr(p.xz, 6);
    if (h < .0015 * t + .002) return t;
    t += h * .42 + .002 * t; if (t > tEnd) break; if (rd.y > 0. && p.y > top) break;
  }
  return -1.;
}
vec3 terrN(vec3 p, float t){ float e = max(.012, .0025 * t);
  return normalize(vec3(terr(p.xz - vec2(e, 0.), 9) - terr(p.xz + vec2(e, 0.), 9), 2. * e, terr(p.xz - vec2(0., e), 9) - terr(p.xz + vec2(0., e), 9))); }
float terrShadow(vec3 p, vec3 L){ float res = 1., t = .08; float top = terrTop();
  for (int i = 0; i < 28; i++) { vec3 q = p + L * t; float h = q.y - terr(q.xz, 5); res = min(res, 10. * h / t); if (res < .02 || q.y > top) break; t += clamp(h * .6, .06, 1.2); }
  return clamp(res, 0., 1.); }

// ---------- things: signed distances, so shapes can be cut out of each other and melted together ----------
vec3 toLocal(int i, vec3 p){ vec3 q = p - uOP[i].xyz; return vec3(dot(uR0[i].xyz, q), dot(uR1[i].xyz, q), dot(uR2[i].xyz, q)); }
float capped(vec2 w){ return min(max(w.x, w.y), 0.) + length(max(w, 0.)); }
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
  else {
    d = capped(vec2(length(u.xz) - .08, abs(u.y + .7) - .3)); float rr = length(u.xz);
    for (int j = 0; j < 3; j++) { float fj = float(j); float top = 1. - fj * .36, h = .78, rad = .4 + fj * .2;
      vec2 nrm = normalize(vec2(h, rad)); d = min(d, max(dot(vec2(rr, u.y - top), nrm), top - h - u.y)); }
  }
  return d * m;
}
float smin(float a, float b, float k){ float h = clamp(.5 + .5 * (b - a) / k, 0., 1.); return mix(b, a, h) - k * h * (1. - h); }
int gMask;
float map(vec3 p, out int id){
  float dp[MAXG]; float dn[MAXG]; float dk[MAXG]; float db[MAXG]; int ip[MAXG]; int ic[MAXG]; int ik[MAXG]; int ib[MAXG]; float bn[MAXG];
  for (int g = 0; g < MAXG; g++) { dp[g] = 1e9; dn[g] = 1e9; dk[g] = -1e9; db[g] = 1e9; bn[g] = 1e9; ip[g] = 0; ic[g] = 0; ik[g] = 0; ib[g] = 0; }
  for (int i = 0; i < MAXO; i++) { if (i >= uNObj) break; if (((gMask >> i) & 1) == 0) continue;
    float d = sdThing(i, p); int g = int(uR1[i].w + .5); int role = int(uR0[i].w + .5);
    if (role == 1) { if (d < dn[g]) { dn[g] = d; ic[g] = i; } }
    else if (role == 2) { if (d > dk[g]) { dk[g] = d; ik[g] = i; } }
    else if (int(uOP[i].w + .5) == 8) { db[g] = smin(db[g], d, .9); if (d < bn[g]) { bn[g] = d; ib[g] = i; } }
    else if (d < dp[g]) { dp[g] = d; ip[g] = i; }
  }
  float res = 1e9; id = 0;
  for (int g = 0; g < MAXG; g++) {
    float d = dp[g]; int j = ip[g];
    if (db[g] < d) { d = db[g]; j = ib[g]; }
    if (d > 1e8) continue;
    if (-dn[g] > d) { d = -dn[g]; j = ic[g]; }
    if (dk[g] > -1e8 && dk[g] > d) { d = dk[g]; j = ik[g]; }
    if (d < res) { res = d; id = j; }
  }
  return res;
}
float marchThings(vec3 ro, vec3 rd, float tmax, out int id){
  int mask = 0; float t0 = 1e9, t1 = -1.; id = 0;
  for (int i = 0; i < MAXO; i++) { if (i >= uNObj) break;
    int role = int(uR0[i].w + .5);
    if (role == 2) { mask |= 1 << i; continue; }
    vec3 oc = ro - uOP[i].xyz; float R = uR2[i].w; float b = dot(oc, rd), c = dot(oc, oc) - R * R, h = b * b - c;
    if (h < 0.) continue; h = sqrt(h); float tb = -b + h; if (tb < 0.) continue;
    mask |= 1 << i; if (role == 0) { t0 = min(t0, max(-b - h, 0.)); t1 = max(t1, tb); }
  }
  gMask = mask; if (t1 < 0.) return -1.;
  float t = max(t0, 1e-3); t1 = min(t1, tmax);
  for (int s = 0; s < 120; s++) { if (t > t1) break; float d = map(ro + rd * t, id); if (d < .0005 * t + .0004) return t; t += d; }
  return -1.;
}
vec3 thingN(vec3 p){ int id; const vec2 e = vec2(.0012, -.0012);
  return normalize(e.xyy * map(p + e.xyy, id) + e.yyx * map(p + e.yyx, id) + e.yxy * map(p + e.yxy, id) + e.xxx * map(p + e.xxx, id)); }

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
  for (int i = 0; i < 100; i++) {
    if (t > end + .0002) break;
    vec3 p = o + t * d;
    float h = letterDistance(p);
    if (h < .001) {
      vec2 e = vec2(.0015, 0.);
      normal = rotY(normalize(vec3(letterDistance(p + e.xyy) - letterDistance(p - e.xyy),
        letterDistance(p + e.yxy) - letterDistance(p - e.yxy), letterDistance(p + e.yyx) - letterDistance(p - e.yyx))), uTitlePose.w);
      return t;
    }
    t += max(.0008, h * .88);
  }
  return -1.;
}

// ---------- shadows and lamps ----------
float thingShadow(vec3 p, vec3 L, float maxd){
  int id; float t = marchThings(p, L, maxd, id); float s = 1.;
  if (t > 0.) { vec4 m3 = texelFetch(uMat, ivec2(3, id), 0); vec4 m4 = texelFetch(uMat, ivec2(4, id), 0); s = m4.x > 0. ? 1. : m4.y > 0. ? 1. - .6 * m4.y : m3.y * .7; }
  vec3 n; if (s > 0. && hitLetters(p, L, maxd, n) > 0.) s = 0.;
  return s;
}
float sunShadow(vec3 p){
  vec3 L = uSunDir; if (uPreview == 0 && uSunSoft > 0.) L = normalize(L + rndBall() * uSunSoft);
  float s = thingShadow(p, L, 600.); if (s > 0. && uTerrOn > .5) s = min(s, terrShadow(p + vec3(0., .01, 0.), L));
  return s;
}
vec3 lamps(vec3 p, vec3 n){
  vec3 sum = vec3(0.);
  for (int l = 0; l < 4; l++) { if (l >= uNLight) break;
    vec3 Lv = uLP[l].xyz - p; float d2 = dot(Lv, Lv), d = sqrt(d2); vec3 L = Lv / d; float nl = dot(n, L);
    if (nl <= 0.) continue;
    float spot = uLD[l].w > -1.5 ? smoothstep(uLD[l].w, uLD[l].w + .06, dot(-L, uLD[l].xyz)) : 1.; if (spot <= 0.) continue;
    float reach = d - uLP[l].w - .02; if (reach < 0.) { sum += uLC[l] * nl * spot; continue; }
    sum += uLC[l] * nl * spot * thingShadow(p + n * .006, L, reach) / (1. + d2 * .06);
  }
  return sum;
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

// ---------- what a ray meets ----------
// kind: 0 sky, 1 sea or floor, 2 land, 3 a thing, 4 lettering
float meet(vec3 ro, vec3 rd, out int kind, out int id, out vec3 n){
  float t = 1e9; kind = 0; id = -1; n = vec3(0., 1., 0.);
  if (uGround != 5 && rd.y < -1e-5) { float tw = -ro.y / rd.y; if (tw > 1e-3) { t = tw; kind = 1; } }
  int oid; float to = marchThings(ro, rd, min(t, 900.), oid);
  if (to > 0. && to < t) { t = to; kind = 3; id = oid; n = thingN(ro + rd * to); }
  if (uTerrOn > .5) { float tt = marchTerr(ro, rd, min(t, 600.)); if (tt > 0. && tt < t) { t = tt; kind = 2; } }
  vec3 nn; float tl = hitLetters(ro, rd, t, nn);
  if (tl > 0.) { t = tl; kind = 4; n = nn; id = MAXO; }
  return t;
}

void groundFog(inout vec3 col, inout vec3 thr, vec3 ro, vec3 rd, float t){
  if (uFog <= 0.) return; float k = 1. / uFogH; float a = exp(-max(ro.y, 0.) * k);
  float od = uFog * .22 * a * (abs(rd.y) < 1e-4 ? t : (1. - exp(-rd.y * k * t)) / (rd.y * k));
  float T = exp(-max(od, 0.)); col += thr * (1. - T) * uFogCol; thr *= T;
}

vec3 trace(vec3 ro, vec3 rd){
  vec3 col = vec3(0.), thr = vec3(1.);
  float sunOn = 1.;
  for (int b = 0; b < 6; b++) { if (b >= uBounces) break;
    int kind, id; vec3 n; float t = meet(ro, rd, kind, id, n); int primMask = gMask;
    if (b == 0 && uRays > 0. && uPreview == 0) { float reach = min(t, 70.); vec3 q = ro + rd * reach * rnd();
      float vis = thingShadow(q, uSunDir, 600.); if (vis > 0. && uTerrOn > .5) vis = min(vis, terrShadow(q, uSunDir));
      col += thr * uRays * uSunCol * vis * (.22 + 1.6 * pow(max(dot(rd, uSunDir), 0.), 6.)) * .55 * (1. - exp(-reach * .04)); gMask = primMask; }
    if (kind == 0) { groundFog(col, thr, ro, rd, 2000.); col += thr * sky(rd, sunOn); return col; }
    vec3 p = ro + rd * t;
    float T = exp(-t * uHaze * uHaze * .02);
    col += thr * (1. - T) * fogCol(); thr *= T;
    groundFog(col, thr, ro, rd, t);
    vec3 amb = (mix(uHorizon, uZenith, .5) * .55 + .12) * uAmbient * 2.;
    float refl = 0.; vec3 tint = vec3(1.); vec3 lc = vec3(0.); float gloss = 1.;
    if (kind == 1) {
      float depth = 1e3; if (uTerrOn > .5) depth = -terr(p.xz, 5);
      float sh = sunShadow(p + vec3(0., .003, 0.));
      vec3 lamp = uNLight > 0 ? lamps(p, vec3(0., 1., 0.)) : vec3(0.);
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
      n = terrN(p, t);
      float hh = clamp(p.y / (uTerrH * 1.1), 0., 1.);
      float sp = n3(p * vec3(5., 5., 5.));
      vec3 alb = mix(uT1, uT2, smoothstep(.03, .2, hh + (sp - .5) * .08));
      float rock = smoothstep(.82, .55, n.y);
      alb = mix(alb, uT3, max(smoothstep(.42, .8, hh + (sp - .5) * .25), rock * .85));
      alb = mix(alb, vec3(.95, .96, 1.), uSnow * smoothstep(.62, .75, hh + (sp - .5) * .2) * smoothstep(.5, .8, n.y));
      alb *= .72 + .56 * sp;
      if (uGround == 2) alb = mix(alb, uG1 * 2., smoothstep(.06, 0., hh) * .8);
      vec3 L = uSunDir; if (uPreview == 0 && uSunSoft > 0.) L = normalize(L + rndBall() * uSunSoft);
      float sh = min(thingShadow(p + n * .01, L, 600.), terrShadow(p + n * .02, L));
      lc = alb * (amb * (.6 + .4 * n.y) + uSunCol * max(dot(n, uSunDir), 0.) * sh + (uNLight > 0 ? lamps(p, n) : vec3(0.)));
    } else {
      vec4 m0 = texelFetch(uMat, ivec2(0, id), 0), m1 = texelFetch(uMat, ivec2(1, id), 0), m2 = texelFetch(uMat, ivec2(2, id), 0), m3 = texelFetch(uMat, ivec2(3, id), 0);
      vec4 m4 = texelFetch(uMat, ivec2(4, id), 0); float glow = m4.x;
      vec3 lp = kind == 3 ? toLocal(id, p) : rotY(p - uTitlePose.xyz, -uTitlePose.w);
      int tex = int(m0.w + .5); vec3 alb;
      if (tex == 8) { vec3 u = kind == 3 ? lp / uOS[id].xyz : lp / uTitleBox; int k = kind == 3 ? int(uOP[id].w + .5) : 1;
        vec2 uv = (k == 1 || k == 2 || k == 6 || k == 13) ? u.xy * .5 + .5 : vec2(atan(u.x, u.z) / 6.2831853 + .5, u.y * .5 + .5);
        alb = pow(texture(uPic, fract(uv * m1.w)).rgb, vec3(2.2)) * m0.rgb * 1.6; }
      else alb = pattern(tex, lp * m1.w, m0.rgb, m1.rgb);
      if (m4.w > 0.) alb = mix(alb, pattern(int(m4.z + .5), lp * m1.w * 2.3 + 5., alb, texelFetch(uMat, ivec2(5, id), 0).rgb), m4.w);
      if (kind == 3) { int k = int(uOP[id].w + .5); vec3 u = lp / uOS[id].xyz;
        if (k == 9 && u.y < -.12 && length(u.xz) < .16) alb = vec3(.13, .07, .035);
        if (k == 10 && u.y < -.42 && length(u.xz) < .12) alb = vec3(.11, .06, .03); }
      if (m3.w > 0.) { vec3 q = lp * m1.w * 6.; float e = .02; float b0 = n3(q);
        n = normalize(n + m3.w * 1.6 * (vec3(n3(q + vec3(e, 0., 0.)), n3(q + vec3(0., e, 0.)), n3(q + vec3(0., 0., e))) - b0) / e * .06); }
      gloss = m3.x; float clear = kind == 3 ? m3.y : 0.;
      if (kind == 3 && m4.y > 0.) { // a thing made of cloud: walk through it, gathering light
        vec3 sz = uOS[id].xyz; float span = max(sz.x, max(sz.y, sz.z)), stp = span * 2.2 / 22., soft = min(sz.x, min(sz.y, sz.z)) * .45;
        float sunVis = sunShadow(p + n * .02); gMask = primMask;
        vec3 pin = p + rd * .01; float ti = stp * (uPreview == 1 ? .5 : rnd()), Tr = 1.; vec3 acc = vec3(0.); int tmp;
        for (int s = 0; s < 26; s++) { vec3 q = pin + rd * ti; float d = -map(q, tmp); if (d < 0.) break;
          float den = m4.y * smoothstep(0., soft, d) * (.25 + 1.5 * n3(q * 1.4 + 3.) * n3(q * 4.1));
          float a = 1. - exp(-den * stp * 3.2); float lit = .5 + .5 * smoothstep(-.3, .7, dot(normalize(q - uOP[id].xyz), uSunDir));
          acc += Tr * a * alb * (amb * 1.5 + uSunCol * lit * (.35 + .65 * sunVis)); Tr *= 1. - a; ti += stp; if (Tr < .03) break; }
        col += thr * acc; thr *= Tr; if (max(thr.r, max(thr.g, thr.b)) < .012) return col;
        ro = pin + rd * (ti + .02); continue; }
      float sh = sunShadow(p + n * .004);
      float nl = max(dot(n, uSunDir), 0.) * sh;
      vec3 rf = reflect(rd, n);
      float fr = pow(1. - max(dot(-rd, n), 0.), 5.);
      vec3 spec = uSunCol * pow(max(dot(rf, uSunDir), 0.), mix(6., 420., gloss * gloss)) * sh * m2.w * (.25 + 1.6 * gloss);
      vec3 dif = alb * m2.x * (amb * (.85 + .3 * n.y) + uSunCol * nl * 1.1 + (uNLight > 0 && glow <= 0. ? lamps(p, n) : vec3(0.)));
      refl = clamp(m2.y + (1. - m2.y) * fr * (.25 + .5 * m2.w), 0., 1.);
      tint = mix(vec3(1.), alb, m2.z);
      col += thr * (spec + alb * glow);
      if (clear > .001) {
        col += thr * (1. - refl) * (1. - clear) * dif;
        bool through;
        if (uPreview == 1) { col += thr * refl * tint * sky(rf, 0.) * .9; thr *= (1. - refl) * clear * mix(vec3(1.), alb, .5); through = true; }
        else { float w = (1. - refl) * clear + refl; through = rnd() * w < (1. - refl) * clear; thr *= w * (through ? mix(vec3(1.), alb, .5) : tint); }
        if (max(thr.r, max(thr.g, thr.b)) < .012) return col;
        if (through) {
          vec3 r1 = refract(rd, n, 1. / m3.z); if (dot(r1, r1) < .01) r1 = rf;
          vec3 pin = p - n * .008; float ti = 0.; int tmp; gMask = primMask;
          for (int s = 0; s < 48; s++) { float d = -map(pin + r1 * ti, tmp); if (d < .0015) break; ti += max(d, .004); if (ti > 40.) break; }
          vec3 p2 = pin + r1 * ti; vec3 n2 = thingN(p2);
          vec3 r2 = refract(r1, -n2, m3.z); if (dot(r2, r2) < .01) r2 = r1;
          ro = p2 + n2 * .01; rd = normalize(r2); sunOn = 1.; continue;
        }
        ro = p + n * .004; rd = rf; sunOn = .6; continue;
      }
      lc = dif;
    }
    col += thr * (1. - refl) * lc;
    thr *= refl * tint;
    if (max(thr.r, max(thr.g, thr.b)) < .012) return col;
    ro = p + n * .004; rd = reflect(rd, n);
    if (uPreview == 0 && gloss < .98) { float rough = (1. - gloss) * (1. - gloss) * .6; rd = normalize(rd + rndBall() * rough); if (dot(rd, n) < 0.) rd = reflect(rd, n); }
    if (kind == 1 && rd.y < .002) { rd.y = .002; rd = normalize(rd); }
    sunOn = .6;
  }
  col += thr * sky(rd, 0.);
  return col;
}

void main(){
  vec2 fc = gl_FragCoord.xy;
  rs = (uint(fc.x) * 1973u + uint(fc.y) * 9277u + uint(uSample) * 26699u) | 1u; rnd();
  vec2 jit = uPreview == 1 ? vec2(.5) : vec2(rnd(), rnd());
  vec2 uv = (floor(fc) + jit - .5 * uRes) / min(uRes.x, uRes.y) * 2.;
  if (uMode == 9) uv = uPickUV;
  if (uMode == 11) { vec2 g = (fc / uRes - .5) * 2. * uGridHalf; float h = 0.; if (uTerrOn > .5) { float tt = marchTerr(vec3(g.x, 200., g.y), vec3(0., -1., 0.), 400.); if (tt > 0.) h = 200. - tt; } outCol = vec4(max(h, 0.), 0., 0., 1.); return; }
  vec3 ro = uCamPos, rd;
  if (uProj == 1) { vec2 a = (floor(fc) + jit) / uRes; float lon = (a.x - .5) * 6.2831853 + uPanoYaw, lat = (a.y - .5) * 3.14159265;
    rd = vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon)); }
  else {
    rd = normalize(uCamFw * uFocal + uCamRt * uv.x + uCamUp * uv.y);
    if (uLens > 0. && uPreview == 0 && uMode == 0) { float a = rnd() * 6.2831853, r = sqrt(rnd()) * uLens;
      vec3 fp = ro + rd * (uFocus / max(dot(rd, uCamFw), .05)); ro += (uCamRt * cos(a) + uCamUp * sin(a)) * r; rd = normalize(fp - ro); }
  }
  if (uMode != 0) {
    if (uMode == 10) { ro = uPRo; rd = uPRd; }
    int kind, id; vec3 n; float t = meet(ro, rd, kind, id, n);
    if (uMode == 9 || uMode == 10) { outCol = vec4(float(kind), float(id), t, 1.); return; }
    vec3 m = vec3(0.);
    if (uMode == 1) m = vec3(kind == 0 ? 0. : exp(-t * .035));
    else if (uMode == 2) m = vec3(kind >= 3 ? 1. : 0.);
    else m = vec3(kind == 0 ? 0. : clamp((ro + rd * t).y / 12., 0., 1.));
    outCol = vec4(uLDR == 1 ? m : pow(m, vec3(2.2)) * 1.2, uBlend); return;
  }
  vec3 c = min(trace(ro, rd), vec3(6.));
  if (uLDR == 1) { c = c / (1. + .18 * c) * 1.12; float l = dot(c, vec3(.3, .59, .11)); c = mix(vec3(l), c, 1.12); c = pow(clamp(c, 0., 1.), vec3(1. / 2.2)); }
  outCol = vec4(c, uBlend);
}
`
