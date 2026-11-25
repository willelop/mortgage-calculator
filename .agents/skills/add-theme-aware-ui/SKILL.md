---
name: add-theme-aware-ui
description: Use when adding or changing any UI element with colors, charts,
  logos, or icons — anything that must look right in both light and dark
  theme. Covers the CSS-variable system, Plotly coloring, currentColor logos,
  and the applyTheme-before-setTheme ordering.
---

# Adding theme-aware UI

This app has selectable light/dark themes (`html[data-theme='dark']` override
block in `src/styles.css`). Four invariants, all battle-tested:

## 1. Colors come from CSS variables

- Never hard-code a hex value that exists as a variable — check
  `src/styles.css` `:root` block first (`--accent`, `--card`, `--box-bg`,
  `--border`, `--muted`, `--info`, …).
- New semantic colors get a new variable, defined in `:root` and overridden in
  the `[data-theme='dark']` block — never a `color-scheme`-conditional rule
  scattered through the sheet.

## 2. Plotly needs explicit, per-render colors

Plotly takes no CSS. `src/ui/Plot.tsx` injects transparent paper background
plus theme font/grid colors keyed on `dataset.theme`. When adding a chart:
- Reuse the existing injection mechanism rather than passing literal colors.
- Transparent backgrounds let the card color show through in both themes.

## 3. DOM state before React state

The Plotly recolor must happen on the first frame of the new theme: in
`App.tsx`'s toggle, `applyTheme(next)` runs **before** `setTheme(next)` so
`document.documentElement.dataset.theme` is already updated when the re-render
reaches `Plot.tsx`. Reversing the order makes charts lag one render (the bug
this fixed is why the order looks backwards).

## 4. Icons and logos use currentColor

SVG logos/icons inherit the text color (`color`/`currentColor`), so they work
in both themes with zero extra code. Never `fill="#000"`.

## Verification

- `npx vitest run` (the theme-toggle smoke test asserts both directions and
  its persistence), `npx tsc --noEmit`, `npm run build`.
- Manual check worth asking the user for: toggle twice, look at every chart
  and tooltip in both themes.
