# Agent instructions — src/ui (React components)

Extends the root `AGENTS.md`. The closest file wins on conflict.

## Component map

| File | Responsibility |
|---|---|
| `App.tsx` | State owner. All `ParamState` changes flow through `setState`; warnings, toolbar, runs-bar, share/save/presets |
| `ParamForm.tsx` | Tabbed value form: one tab per parameter group + Monte Carlo (enrollment, distributions, correlations) |
| `OptionsMenu.tsx` | Top-bar dropdown: every enable/disable (features + switches) — the *only* place with on/off controls |
| `Results.tsx` | Result cards, amortization table/chart, MC/sensitivity sections, CSV export |
| `Plot.tsx` | Plotly wrapper; injects transparent paper bg + theme colors keyed on `dataset.theme` |
| `Logo.tsx` | Inline SVG logo; use `currentColor` so it follows the theme |
| `csv.ts` | `;`-separated CSV with BOM (German Excel opens it correctly) |

## Hard invariants (each of these broke the page once — do not reintroduce)

1. **Hooks above early returns.** In `Results.tsx`, every `useCallback`/`useMemo`
   must run before any `return null` (that was the blank-page bug).
2. **Tooltip clipping.** The "?" tooltips extend outside their box: never add
   `overflow: hidden` to `.param-box` or ancestors of `.help-tip`.
3. **Theme before render.** When toggling dark mode, call `applyTheme(next)`
   *before* `setTheme(next)` so Plotly picks up the new colors on the first
   frame (`Plot.tsx` keys off `dataset.theme`).
4. **Single source of truth.** Labels/defaults/groups come from
   `engine/params.ts` — never hard-code a parameter key twice.
5. **State compatibility.** The UI may render fields for keys absent from an
   old saved state; always read through `defaultState()`-merged state.

## Layout model (current, deliberate)

- Form = tabs (values only) + top-bar Options menu (on/off only) + Monte-Carlo
  tab (randomness only). Keep each kind of control in exactly one place.
- All tab panels stay mounted; inactive panels are `hidden` — this preserves
  edits and MC enrollment across switches and keeps tests simple.

## Testing (jsdom)

- `src/ui/__tests__/app-smoke.test.tsx` mounts the real App. Vitest globals are
  off: register `afterEach(cleanup)` manually.
- jsdom lacks `window.URL.createObjectURL` — the suite stubs it in
  `beforeAll` (needed by Plotly module init).
- All panels are mounted (hidden tabs included), so `getByDisplayValue` /
  `getAllByText` find inputs of *any* tab without clicking.
- CI runs on **Node 24**: jsdom 31 → undici 8 needs ≥ 22.19 (`node:zlib`
  zstd). Do not lower the Node pin.
- Assert on visible text/roles, not on internal class names, except the three
  classes the CSS coupling makes contractual: `.help-tip`, `.param-box`,
  `.param-input select`.
