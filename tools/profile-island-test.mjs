// Tries the profile-island Action's script on this computer, without GitHub: a stand-in GraphQL
// server answers with the saved sample-coder fixture, the picture is rendered by mcp/cli.mjs, and it is
// committed into a throwaway git repository in shots/ (nothing is pushed).
import { execFileSync, spawn } from "child_process"; import fs from "fs"; import http from "http"; import path from "path"
import { root } from "./serve.mjs"
const F = JSON.parse(fs.readFileSync(path.join(root, "tools/fixtures/github-sample.json"), "utf8")), res = {}, fails = []
const check = (name, ok, got) => { res[name] = ok ? true : `FAILED${got !== undefined ? " (" + JSON.stringify(got).slice(0, 200) + ")" : ""}`; if (!ok) fails.push(name) }
const TOKEN = "stand-in-token-for-the-test" // not a real token: the stand-in server only checks that one is sent
// GitHub's answer has whole weeks, Sunday first, so cut the fixture into weeks the same way
const weeks = []; for (const d of F.contributions) { const wd = new Date(d.date + "T00:00:00Z").getUTCDay(); if (!weeks.length || wd === 0) weeks.push({ contributionDays: [] }); weeks.at(-1).contributionDays.push({ date: d.date, contributionCount: d.count, weekday: wd }) }
const asked = []
const api = http.createServer((q, r) => { let body = ""; q.on("data", (c) => (body += c)); q.on("end", () => { const b = JSON.parse(body); asked.push({ auth: q.headers.authorization, login: b.variables?.login, query: b.query })
  r.writeHead(200, { "content-type": "application/json" })
  if (b.variables?.login !== "sample-coder") return r.end(JSON.stringify({ data: { user: null }, errors: [{ message: `Could not resolve to a User with the login of '${b.variables?.login}'.` }] }))
  r.end(JSON.stringify({ data: { user: { login: "sample-coder", contributionsCollection: { contributionCalendar: { totalContributions: F.total.lastYear, weeks } } } } })) }) })
await new Promise((ok) => api.listen(0, "127.0.0.1", ok)); const API = `http://127.0.0.1:${api.address().port}/graphql`

const repo = path.join(root, "shots", "profile-repo"); fs.rmSync(repo, { recursive: true, force: true }); fs.mkdirSync(repo, { recursive: true })
const git = (...a) => execFileSync("git", a, { cwd: repo, encoding: "utf8" }).trim()
git("init", "-q"); git("config", "user.name", "Test"); git("config", "user.email", "test@example.invalid"); fs.writeFileSync(path.join(repo, "README.md"), "# Hello\n"); git("add", "."); git("commit", "-q", "-m", "start")
const script = path.join(root, ".github/actions/profile-island/island.mjs")
const run = (env) => new Promise((ok) => { const c = spawn(process.execPath, [script], { cwd: repo, env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env } }); let out = ""; c.stdout.on("data", (d) => (out += d)); c.stderr.on("data", (d) => (out += d)); c.on("close", (code) => ok({ code, out })) })

// 1. the way the workflow runs it
const t0 = Date.now()
const a = await run({ ISLAND_USER: "sample-coder", GITHUB_TOKEN: TOKEN, ISLAND_API: API, ISLAND_PATH: "images/island.png", ISLAND_QUALITY: "good", ISLAND_COMMIT: "true", ISLAND_PUSH: "false" })
res.seconds = +((Date.now() - t0) / 1000).toFixed(1)
check("ran", a.code === 0, a.out.slice(-400))
check("askedOnce", asked.length === 1 && asked[0].auth === `bearer ${TOKEN}` && asked[0].login === "sample-coder" && /contributionCalendar/.test(asked[0].query), asked.map((x) => x.login))
const png = path.join(repo, "images/island.png"), buf = fs.existsSync(png) ? fs.readFileSync(png) : null
check("banner1500x500", !!buf && buf.readUInt32BE(16) === 1500 && buf.readUInt32BE(20) === 500, buf && [buf.readUInt32BE(16), buf.readUInt32BE(20)]); res.kb = buf ? Math.round(buf.length / 1024) : 0
check("counted", a.out.includes(`sample-coder: ${F.total.lastYear} contributions`), a.out.split("\n")[1])
check("committed", git("log", "-1", "--format=%s %an") === "Update my year as an island Test" && git("show", "--stat", "--format=", "HEAD").includes("images/island.png"))
check("noLeftovers", fs.readdirSync(path.join(repo, "images")).join() === "island.png" && git("status", "--porcelain") === "", fs.readdirSync(path.join(repo, "images")))
fs.copyFileSync(png, path.join(root, "shots", "profile-island-banner.png"))

// 2. a name GitHub does not know
const b = await run({ ISLAND_USER: "no-such-person-xyz", GITHUB_TOKEN: TOKEN, ISLAND_API: API, ISLAND_PATH: "images/other.png" })
check("unknownUser", b.code === 1 && /Could not resolve to a User/.test(b.out), b.out)
// 3. no token
const c = await run({ ISLAND_USER: "sample-coder", ISLAND_API: API, ISLAND_PATH: "images/other.png" })
check("noToken", c.code === 1 && /No token/.test(c.out), c.out)
// 4. a calendar file instead of GitHub (the free service's format), square, not committed
const d = await run({ ISLAND_CALENDAR: path.join(root, "tools/fixtures/github-sample.json"), ISLAND_USER: "sample-coder", ISLAND_PATH: path.join(root, "shots", "profile-island-square.png"), ISLAND_SIZE: "1200x1200", ISLAND_QUALITY: "draft" })
check("fromFile", d.code === 0 && fs.existsSync(path.join(root, "shots", "profile-island-square.png")), d.out.slice(-300))
check("onlyOneQuestion", asked.length === 2, asked.length) // runs 1 and 2 asked; 3 stopped before asking; 4 read a file

console.log(JSON.stringify(res, null, 1)); console.log(fails.length ? `${fails.length} FAILED: ${fails.join(", ")}` : `all ${Object.values(res).filter((v) => v === true).length} checks passed`)
api.close(); process.exit(fails.length ? 1 : 0)
