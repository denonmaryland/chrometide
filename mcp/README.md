# Untitled Worlds MCP

Lets an AI agent make pictures with Untitled Worlds: start from a ready-made world or a blank one,
change the sky, sea, land and things, add 3D lettering, roll the dice, and get the ray-traced
picture back to look at. Works with any agent that speaks MCP (Claude Code, Claude Desktop, Cursor,
Codex and others).

It runs on your own computer. The renderer is the web app itself, opened in a hidden Chrome.

## Needs
- Node 20 or newer
- Chrome, Chromium or Edge installed
- The app built once: in the project folder (one up from here), run `npm install` and `npm run build`

## Set up
In this folder: `npm install`

Then tell your agent about it. For Claude Code:

```bash
claude mcp add untitled-worlds -- node /full/path/to/mcp/server.mjs
```

For apps that use a settings file (Claude Desktop, Cursor and others):

```json
{
  "mcpServers": {
    "untitled-worlds": { "command": "node", "args": ["/full/path/to/mcp/server.mjs"] }
  }
}
```

Optional settings, as environment variables: `WORLDS_CHROME` (path to the browser), `WORLDS_APP`
(folder of the built app), `WORLDS_OUT` (folder that `render` may save pictures into; it never
writes anywhere else).

## Try it
Ask your agent: *"Make me an album cover: a chrome moon over a mirror sea at dusk, with the word
SLOW in gold. Show me, then make it better."*

## Tools
| Tool | What it does |
|---|---|
| `get_guide` | The coordinate system, every field, and what makes these pictures look good |
| `list_presets` | Ready-made worlds, sky / sea / land looks, materials, shapes, fonts |
| `start_world` | Begin from a world by name, from `blank`, or from a share code |
| `get_world` | The world so far: brief (things with ids) or full (every field) |
| `update_world` | Change any field with a JSON merge patch |
| `set_sky`, `set_sea`, `set_land`, `set_camera` | A look by name and/or your own changes |
| `add_thing`, `update_thing`, `remove_thing` | Shapes: 12 kinds, any material, cut and combine |
| `add_lettering` | 3D words: 7 fonts, solid / outline / neon tube, rings and arches |
| `roll_dice` | A random world, keeping the parts you name |
| `render` | The ray-traced picture, up to 2400 px; can also save a PNG |
| `share_code` | A code that opens the same world in the web app |

## Check it works
`npm test` connects the way an agent would, builds a small world, renders it and saves
`test-out/agent-moon.png`.

## Render from the terminal
The same hidden renderer also works without an agent. In this folder (after `npm install`, and
with the app built once):

```bash
node cli.mjs render "Red Moons" -o red-moons.png --size 1200x1200 --quality fine
node cli.mjs render w2.pVVNj9ow… -o shared.png        # a share code, or a whole link with #w=
node cli.mjs render my-world.json -o mine.png         # a world saved as JSON
node cli.mjs render calendar.json -o island.png --size 1500x500   # a GitHub year becomes an island
node cli.mjs list                                     # the ready-made worlds, by group
node cli.mjs code "Red Moons"                         # a share code to open in the web app
```

| Option | What it does |
|---|---|
| `-o`, `--out` | Where to save the PNG. Default: the world's name, in the current folder |
| `--size WxH` | Picture size, up to 4096 a side. Default: the world's own frame |
| `--quality` | `draft` (4 passes, quick), `good` (16, the default) or `fine` (48, for keeps) |
| `--user NAME` | The name to stand on a calendar island, if the file does not say it |

A calendar file can be the JSON from the free contributions service
(`https://github-contributions-api.jogruber.de/v4/NAME?y=last`), GitHub's own GraphQL answer
(`contributionsCollection { contributionCalendar { weeks { contributionDays { date contributionCount } } } }`),
or a plain list of `{ "date": "2026-03-14", "count": 7 }`.

Installed with `npm install -g` (or `npm link`) in this folder, the command is `untitled-worlds`.
It reads the same `WORLDS_APP` and `WORLDS_CHROME` settings as the server, and says plainly what
is missing if the app is not built or no Chrome is found. It exits with 0 when the picture is
saved, 1 when something went wrong, 2 when the command was mistyped.

## Not in this version
Timeline animation, loops, the cover maker, music, hand-sculpted land and imported models are in
the web app but not yet reachable from here. One world is worked on at a time.
