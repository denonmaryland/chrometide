# Your year as an island, on your GitHub profile

A GitHub Action that turns your last year of contributions into a ray-traced island and saves it
as a 1500 × 500 banner in your profile repository, fresh every day. Weeks run along the shore,
days run inland, busy days rise as peaks (the busiest get snow), quiet days stay sea, and your
name stands over it all. The sky follows how busy the year was, from a quiet moonlit night to a
blazing sunset.

You can try it first in the web app: open **Modes → GitHub year island**, or add
`?github=yourname` to the app's address.

## Set it up

Your profile repository is the one named after you (`yourname/yourname`); its README is shown on
your profile.

1. In that repository, add the file `.github/workflows/island.yml`:

   ```yaml
   name: Year island
   on:
     schedule:
       - cron: "17 4 * * *"   # once a day; pick any minute you like
     workflow_dispatch:        # and a button to run it by hand
   permissions:
     contents: write           # so it can commit the picture
   jobs:
     island:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: denonmaryland/untitled-worlds/.github/actions/profile-island@main
           with:
             path: images/island.png
   ```

2. Put the picture in your README:

   ```markdown
   ![My year as an island](images/island.png)
   ```

3. Run it once by hand: **Actions → Year island → Run workflow**. After that it runs daily.

No secrets to add. The Action reads your public contributions with the workflow's own token
(`GITHUB_TOKEN`), which GitHub creates for each run and throws away afterwards.

## Options

| Input | Default | What it does |
|---|---|---|
| `user` | the repository owner | Whose year to draw |
| `path` | `images/island.png` | Where to save the picture in the repository |
| `size` | `1500x500` | Picture size. Wide pictures are seen from the front; square ones (`1200x1200`) from a corner |
| `quality` | `fine` | `draft`, `good` or `fine` |
| `commit` | `true` | Commit and push the picture when it changed. Set `false` to use the file in later steps yourself |
| `message` | `Update my year as an island` | The commit message |
| `token` | the workflow's own token | Only needs to read public data |

## What it does, step by step

1. Sets up Node, then builds Untitled Worlds and its renderer from the Action's own copy of this
   project (about a minute; nothing is downloaded from anywhere else but npm).
2. Asks GitHub's GraphQL API for `contributionsCollection.contributionCalendar` of the user: the
   date and count of each day of the last year. Nothing else is read.
3. Writes that calendar to a temporary file, renders it with the command line
   (`node mcp/cli.mjs render calendar.json -o … --size 1500x500 --quality fine`) in the
   headless Chrome that GitHub's Ubuntu runners already have, and removes the temporary file.
4. Commits the picture as `github-actions[bot]`, only if it changed, and pushes.

## Try it on your own computer

From the project folder, with the app built (`npm run build`) and `mcp` installed:

```bash
# with a calendar you saved, in any of the formats the app reads
ISLAND_CALENDAR=calendar.json ISLAND_PATH=island.png node .github/actions/profile-island/island.mjs

# or straight from GitHub, with a token of your own that can read public data
ISLAND_USER=yourname GITHUB_TOKEN=… ISLAND_PATH=island.png node .github/actions/profile-island/island.mjs
```

`node tools/profile-island-test.mjs` checks the script end to end without going online: a
stand-in GitHub answers with a saved calendar, and the picture is committed into a throwaway
repository under `shots/`.

## Notes

- Only public contributions are counted, as the token cannot see your private work. If you show
  private contributions on your profile, the island will be a little quieter than your graph.
- Each day's picture is ray traced afresh, so it changes slightly even on a day with no new
  contributions, and so is committed daily.
