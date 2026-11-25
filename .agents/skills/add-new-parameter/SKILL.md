---
name: add-new-parameter
description: Use when adding, renaming, or removing a calculator parameter
  (anything in src/engine/params.ts PARAM_DEFS) or when a new user-facing
  input appears. Covers the registry entry, engine handling, UI implications,
  test requirements, and backward compatibility with saved states and share
  links.
---

# Adding a new parameter

Work through the steps in order; each one exists because it was once missed.

## 1. Registry entry (src/engine/params.ts)

- Pick the right `group` (Global, purchase, mortgage, rent, invest,
  appreciation, correlations) and `kind` (eur, mrate, pct, count, ratio,
  switch, select).
- Required fields: `key`, `label`, `group`, `kind`, `default`, `min`, `max`,
  `step`, `help`. **Every parameter gets `help`** — the "?" tooltip coverage
  is a hard rule, and `src/ui/__tests__/app-smoke.test.tsx` enforces it.
- Set `mcable: true` when Monte-Carlo enrollment makes sense (one-off or
  user-chosen extremes included). Non-simulatable settings (vols, switches)
  are not mcable.
- Remember the UI triage: kind `switch` = simple on/off → Options menu only,
  never in the value tabs. `toggleable === false` = core input, no checkbox.
  Otherwise = optional feature with a checkbox in the Options menu, and the
  value box is dimmed when off.
- Icon: add a case to `iconOf()` if the automatic one is off.
- Semantics live in `help`: say what the value does, units, and its
  interaction with other parameters.

## 2. Engine handling

- Wire the value into the function it affects; write the failing test first in
  the module's `__tests__` file, then fix.
- Watch the known traps (see `.agents/instructions/engine.md`):
  `totalInterest` is a horizon total, not fixed-period; repay through
  `tilgung_mode` derivation; do not silently cap Sondertilgung (App warns).
- Defaults must be Germany-realistic (3.5 % rate, 2 % Anfangstilgung,
  26.375 % tax), not round US-style numbers.

## 3. UI implications (usually none — confirm)

- `ParamForm` and `OptionsMenu` are generic over `PARAM_DEFS`; a plain new
  parameter needs **no UI code**.
- Only touch UI when the parameter needs special presentation (like
  `tilgung_mode`'s select + `visibleWhen` pairing).
- If editing `src/ui/`, respect the invariants in
  `.agents/instructions/ui.md` (hooks above early returns; no
  `overflow: hidden` on `.param-box`).

## 4. Backward compatibility (the step most often skipped)

- `state-io.ts` merges saved state and share links onto `defaultState()`.
  **Decode test**: take a pre-change saved state blob (or build one) without
  the new key and assert decode yields the default, not undefined.
- Never rename an existing key; if unavoidable, add a migration in
  `state-io.ts` decode.
- Share links: URL length grows — check the encoded URL still works.

## 5. Gate

`npx tsc --noEmit` → `npx vitest run` → `npm run build`. All green, one
commit covering registry + engine + test together (they are one change),
commit footer per root AGENTS.md.
