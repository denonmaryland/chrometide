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

## Add a design

Open `src/design/presets.ts` and add a line to `DESIGNS`: the kind, the world it sits on, a layout and
the words. Use made-up names, never a real artist, venue or brand.

## Gallery

The community gallery (`gallery.html` on the live site) shows worlds people made. Each one is a few lines in
`gallery/worlds.json`:

```json
{ "name": "Glass Orchard", "author": "Your name", "github": "your-github-name", "code": "w2.…", "date": "2026-11-22", "tags": ["shapes", "glass"] }
```

The code is the part of a share link after `#w=`. `github` is optional. Keep names under 40
characters and use up to five lower-case tags. Then check the list:

```bash
node tools/gallery-check.mjs
```

Or skip the editing: send the link with the **Share a world** form. When a maintainer adds the
`add-to-gallery` label, a pull request adding it is opened for them to review.

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
