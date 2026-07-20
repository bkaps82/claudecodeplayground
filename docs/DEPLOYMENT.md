# How the arcade deployment works

This repo hosts several independent browser games, each living on its own
branch, all published together as **one** GitHub Pages site. This document
explains the constraint that shaped the setup, how the pieces fit together,
and how to add another game.

## The constraint

GitHub gives each repository exactly **one** Pages site. Originally each game
branch had its own deploy workflow that published *its* game as the entire
site — so every deploy from one branch wiped out the other game. Last push
won.

## The solution: one combined deploy

A single workflow, `.github/workflows/deploy-pages.yml`, builds the whole
arcade on every run:

1. **Check out every game branch** (each into its own directory), always at
   its latest commit.
2. **Build what needs building** — Paint Duel and Sword Quest are Vite
   apps, so each gets `npm ci && npm run build`; Ink Battle is plain static
   files and is copied as-is.
3. **Assemble one site folder:**

   ```
   site/
   ├── index.html      ← landing page (lives in landing/ on the ink-battle branch)
   ├── ink-battle/     ← copied from the ink-battle branch
   ├── paint-duel/     ← Vite build output (dist/) from the paint-duel branch
   └── sword-quest/    ← Vite build output (dist/) from the sword-quest branch
   ```

4. **Deploy** the folder to GitHub Pages via the official
   `upload-pages-artifact` / `deploy-pages` actions.

Because the build always pulls the newest commit of *every* game branch, a
deploy triggered from any branch publishes the latest version of all games —
deploys can't clobber each other anymore.

## Why the same workflow file exists on several branches

GitHub only runs a push-triggered workflow if the workflow file exists **on
the branch being pushed**. Listing a branch under `on.push.branches` is not
enough by itself.

So an **identical copy** of `deploy-pages.yml` lives on:

- `main`
- `claude/ink-battle-game-prototype-kcdqk7`
- `claude/anime-sword-paint-game-8jz1jx`
- `claude/third-game-implementation-yx5cuq` (Sword Quest)

That way a push to any of them triggers a redeploy. The copies must stay
identical — if you change the workflow, change it on every branch that
carries it. (The `concurrency: pages` group ensures that even simultaneous
pushes to several branches can't produce overlapping deploys.)

## Other details worth knowing

- **Subpath-friendly builds:** anything served under a subpath (like
  `/paint-duel/`) must use relative asset URLs. For Vite that's
  `base: './'` in `vite.config.js`. Plain static sites with relative paths
  (like Ink Battle) work under any subpath automatically.
- **Pages auto-enablement:** the workflow passes `enablement: true` to
  `configure-pages`, so the first successful run switched Pages on for the
  repo without any manual settings changes.
- **Manual deploys:** the workflow also has `workflow_dispatch`, so you can
  redeploy any time from the **Actions** tab → "Deploy to GitHub Pages" →
  *Run workflow*.
- **The landing page** is `landing/index.html` on the ink-battle branch. Edit
  it there; the workflow copies it to the site root on every deploy.

## Adding a new game to the arcade

Say the new game lives on branch `claude/my-new-game`:

1. In `deploy-pages.yml` (on **all** branches that carry it):
   - add the branch to the `on.push.branches` list;
   - add a checkout step for it (`ref: claude/my-new-game`, `path: my-new-game`);
   - if it needs a build, add a build step (and make sure its bundler uses
     relative URLs, e.g. Vite's `base: './'`);
   - in the "Assemble combined site" step, copy its files (or build output)
     into `site/my-new-game/`.
2. Put a copy of the updated workflow on the new game's branch too, so pushes
   to it auto-deploy.
3. Add a card for it to `landing/index.html` on the ink-battle branch,
   linking to `./my-new-game/`.

Push any of the branches (or run the workflow manually) and the new game
appears at `https://bkaps82.github.io/claudecodeplayground/my-new-game/`.
