# Contributing

Thank you for wanting to help. Small things are welcome: a new world, a sky, a design, a bug report
with a picture.

## Set up

```bash
npm install
npm run dev
```

## Add a sky

Open `src/engine/scene.ts` and add one line to `MORE_SKIES`: a name, five colours (top, horizon, haze,
sun, cloud) and any weather it brings.

```ts
["Peach fog", "#ff9a7a", "#ffe2c0", "#fff0dc", "#fff6e6", "#ffffff", { fog: 0.4 }],
```

## Add a world

Open `src/engine/worlds.ts` and add an entry to `WORLDS`. A world is a sky, a sea, some land, a list of
things and a camera:

```ts
S("Shapes", "My World", () => world("My World", sky("Morning"), sea("Mirror"), off(),
  [thing("sphere", [0, 3, 0], 2, m("Chrome"))], camFrom({ yaw: 0.3, pitch: 0.12, dist: 16 }))),
```

## Add a shape

Make one new file in `src/engine/shapes/`, for example `bean.ts`. That is all: the ray tracer, the Add
menu, the kind picker, the agent API and the MCP server pick it up when the app is built.

```ts
import { Bean } from "lucide-react"
import * as THREE from "three"
import type { Shape } from "."

export default {
  id: "bean", label: "Bean", icon: Bean,
  glsl: "p.x += .3 * p.y * p.y; return (length(p * vec3(1., .7, 1.)) - .7) * .7;",
  wire: () => new THREE.WireframeGeometry(new THREE.SphereGeometry(0.7, 10, 6)),
} satisfies Shape
```

- `glsl` is the body of a function that is given a point `p` and returns how far it is from the shape's
  surface (negative inside). The shape must fit in the box from -1 to 1 on every side, y up. If you
  bend or twist space, multiply the answer down (as above) so it never says more than the true distance.
- `wire` is the outline shown when the shape is selected, in the same box.
- `id` is saved in worlds and share links: keep it short and never change it once it is out.
- Optional: `mesh` (a three.js geometry, so 3D export includes it; without one it is left out of
  exports), `size` and `material` for new ones, `dial` (one slider that reaches the shader as `r`),
  `helpers` (extra GLSL functions; start their names with the shape's id).

`capsule.ts` is the smallest example; `gem.ts`, `star.ts` and `twist.ts` show helpers, a dial and a
mesh. Run `node tools/shapes-test.mjs` after a build: it renders, cuts and picks every shape and saves
pictures in `shots/`. Look at them in chrome and in glass.

## Add a design

Open `src/design/presets.ts` and add a line to `DESIGNS`: the kind, the world it sits on, a layout and
the words. Use made-up names, never a real artist, venue or brand.

## Check your work

```bash
npm run typecheck
npm run build
npm run sheets     # renders every world, sky and design into shots/ so you can look at them
npm test           # drives the whole app in a hidden Chrome (needs Chrome or Chromium)
```

Look at the pictures. A preset that passes the tests but looks wrong is not done.

## Rules of the house

- **Original work only.** No names, artwork, icons, presets, file formats or code from Bryce or any
  other product. If you bring code from another project, say where it is from and what its licence is.
- **Pictures in the README and docs are rendered by the tool.**
- **Plain words.** In the interface and in comments, write for someone who has never used 3D software.
- One change per pull request, with a before and after picture when the look changes.

## Reporting a bug

Use the bug form. The most useful thing you can attach is the world's share link (the Share button)
and a screenshot.
