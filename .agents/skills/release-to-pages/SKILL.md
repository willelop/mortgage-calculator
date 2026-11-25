---
name: release-to-pages
description: Use when the user wants to publish, deploy, or release the
  calculator to GitHub Pages, or asks to verify that what is on the live site
  matches the repo. Covers the local gate, who pushes (the user, not the
  sandbox), CI expectations on Node 24, and post-deploy verification.
---

# Releasing to GitHub Pages

Deployment is: GitHub Actions builds and publishes on every push to `main`
(`.github/workflows/deploy.yml`). There is nothing to "deploy" by hand.

## Division of labor

- **This sandbox has no GitHub SSH key.** It can commit locally and inspect
  the repo via the GitHub connector, but it cannot push. Tell the user to run
  `git push` themselves — after any history rewrite it must be
  `git push --force-with-lease`.

## Pre-push checklist (agent does this)

1. Full gate green: `npx tsc --noEmit`, `npx vitest run`, `npm run build`.
2. Working tree clean; everything intended is committed (check `git status`).
3. If history was rewritten this session, warn the user that a normal
   `git push` will be rejected — they need `--force-with-lease`.
4. Version bump only if the user asked for one: edit `version` in
   `package.json` in its own commit.

## After the user pushes (agent can verify)

1. CI runs tests + deploy on **Node 24** — that pin matters because jsdom 31
   pulls undici 8, which needs ≥ 22.19 (`node:zlib` zstd). A Node-version
   failure looks like `TypeError: Cannot read properties of undefined
   (reading 'bind')` from undici's decompress interceptor.
2. Check the Actions run (ask the user to paste the result if the GitHub
   connector cannot list runs, or use the connector's run tools).
3. Verify the live site: open the Pages URL and confirm it renders (a blank
   page means i) new code crashed at mount — historically a hooks-order
   violation — or ii) a stale/staging path issue; check `base` in
   `vite.config.ts` matches the repo name `mortgate-calculator`).
4. The site is fully client-side; if results "hang", suspect the Monte-Carlo
   worker path (there is a synchronous fallback) before suspecting Pages.

## First-time setup notes (repo history — do not repeat)

- Pages source must be **GitHub Actions** (Settings → Pages), not a branch.
- For public repos, Actions minutes and Pages hosting are free.
