#!/usr/bin/env node
// Profile island: reads a GitHub user's last year of contributions with the Action's own token
// (GitHub's GraphQL API), turns it into an island world and renders it with the Untitled Worlds
// command line (mcp/cli.mjs). Optionally commits the picture.
//
// Settings (environment; action.yml fills them from its inputs):
//   ISLAND_USER      whose year (required unless ISLAND_CALENDAR is given)
//   GITHUB_TOKEN     a token that can read public GitHub data; the Action's own is enough
//   ISLAND_PATH      where to save the picture (default island.png)
//   ISLAND_SIZE      default 1500x500       ISLAND_QUALITY  draft | good | fine (default fine)
//   ISLAND_COMMIT    "true" to commit the picture in the current git repository
//   ISLAND_PUSH      "true" to push that commit (default: same as ISLAND_COMMIT)
//   ISLAND_MESSAGE   the commit message
//   ISLAND_CALENDAR  read the calendar from this JSON file instead of asking GitHub (for trying it out)
//   ISLAND_API       the GraphQL address (default https://api.github.com/graphql)
import { execFileSync, spawnSync } from "node:child_process"
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const CLI = process.env.ISLAND_CLI || path.resolve(here, "..", "..", "..", "mcp", "cli.mjs")
const env = (k, d = "") => (process.env[k] ?? "").trim() || d
const say = (s) => console.log(s)
const QUERY = `query($login: String!) { user(login: $login) { login contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date contributionCount } } } } } }`

/** The calendar in the plain form the command line reads: { user, contributions: [{ date, count }] }. */
export function fromGraphQL(json) {
  const u = json?.data?.user
  if (json?.errors?.length) throw new Error("GitHub said: " + json.errors.map((e) => e.message).join("; "))
  if (!u) throw new Error("GitHub found no such user.")
  const days = (u.contributionsCollection?.contributionCalendar?.weeks ?? []).flatMap((w) => w.contributionDays ?? [])
  return { user: u.login, total: u.contributionsCollection?.contributionCalendar?.totalContributions ?? null, contributions: days.map((d) => ({ date: d.date, count: d.contributionCount })) }
}

export async function readYear(user, token, api = "https://api.github.com/graphql") {
  if (!token) throw new Error("No token. In a workflow, the Action's own GITHUB_TOKEN is used; it is passed in by default.")
  const r = await fetch(api, { method: "POST", headers: { authorization: `bearer ${token}`, "content-type": "application/json", "user-agent": "untitled-worlds-profile-island" }, body: JSON.stringify({ query: QUERY, variables: { login: user } }) })
  if (!r.ok) throw new Error(`GitHub answered ${r.status} ${r.statusText}.`)
  return fromGraphQL(await r.json())
}

async function main() {
  const out = path.resolve(env("ISLAND_PATH", "island.png")), size = env("ISLAND_SIZE", "1500x500"), quality = env("ISLAND_QUALITY", "fine")
  const commit = env("ISLAND_COMMIT") === "true", push = env("ISLAND_PUSH", String(commit)) === "true"
  let cal
  if (env("ISLAND_CALENDAR")) { const raw = JSON.parse(fs.readFileSync(env("ISLAND_CALENDAR"), "utf8")); cal = raw?.data?.user ? fromGraphQL(raw) : raw; if (env("ISLAND_USER")) cal.user ??= env("ISLAND_USER"); say(`Read the calendar from ${env("ISLAND_CALENDAR")}.`) }
  else { const user = env("ISLAND_USER"); if (!user) throw new Error("Say whose year: set the user input (it defaults to the repository owner)."); say(`Reading ${user}'s public contributions from GitHub…`); cal = await readYear(user, env("GITHUB_TOKEN"), env("ISLAND_API", "https://api.github.com/graphql")) }
  const n = (cal.contributions ?? []).length, total = (cal.contributions ?? []).reduce((s, d) => s + (d.count || 0), 0)
  if (!n) throw new Error("The calendar is empty.")
  say(`${cal.user ?? "?"}: ${total} contributions over ${n} days.`)

  // the calendar goes to the command line as a file next to the picture's folder, then is removed
  fs.mkdirSync(path.dirname(out), { recursive: true }); const tmp = path.join(path.dirname(out), `.island-calendar-${process.pid}.json`)
  fs.writeFileSync(tmp, JSON.stringify(cal))
  try {
    const r = spawnSync(process.execPath, [CLI, "render", tmp, "-o", out, "--size", size, "--quality", quality, ...(cal.user ? ["--user", cal.user] : [])], { stdio: "inherit" })
    if (r.status !== 0) throw new Error(`The render did not finish (exit ${r.status}).`)
  } finally { fs.rmSync(tmp, { force: true }) }

  if (commit) {
    const git = (...a) => execFileSync("git", a, { cwd: path.dirname(out), encoding: "utf8" }).trim()
    const set = (k, v) => { try { git("config", k) } catch { git("config", k, v) } }
    set("user.name", "github-actions[bot]"); set("user.email", "41898282+github-actions[bot]@users.noreply.github.com")
    git("add", out)
    if (spawnSync("git", ["diff", "--cached", "--quiet", "--", out], { cwd: path.dirname(out) }).status === 0) { say("The picture has not changed; nothing to commit."); return }
    git("commit", "-m", env("ISLAND_MESSAGE", "Update my year as an island"), "--", out); say(`Committed ${path.basename(out)}.`)
    if (push) { git("push"); say("Pushed.") }
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((e) => { console.error(`::error::${e.message}`); process.exit(1) })
