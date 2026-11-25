# Agent instructions — src/engine (calculation domain)

Loaded via pointer from the root `AGENTS.md` — read it before working here; on
conflict the root file's always-apply rules win.

## Purity rules

- **No imports of UI, DOM, window, document, or React.** Both `App.tsx` and
  `src/mc-worker.ts` import this folder; anything impure here breaks the worker.
- Functions are deterministic where possible; the Monte-Carlo module takes an
  explicit seeded RNG — never reach for `Math.random()` in this folder.
- No `localStorage` here either: persistence lives in `state-io.ts` only.

## Module map

| File | Responsibility |
|---|---|
| `params.ts` | Parameter registry (`PARAM_DEFS`, groups, kinds, defaults) + `ParamState` |
| `state-io.ts` | Save/autosave/share-link encode & decode; merges saved state onto `defaultState()` |
| `mortgage.ts` | German mortgage mechanics: payment profile, `totalInterest` (horizon total!), `ltvSurchargePct()` |
| `simulate.ts` | Year-by-year simulation (`runScenario(state, shocks?)`) producing `ScenarioResult` |
| `invest.ts` | Portfolio growth with Abgeltungsteuer, Teilfreistellung, Sparerpauschbetrag |
| `monte-carlo.ts` | Correlated shocks + ensemble loop (also run inside `src/mc-worker.ts`) |
| `sensitivity.ts` | One-at-a-time sensitivity around the nominal scenario |

## Worker boundary (`src/mc-worker.ts` — not in this folder, same rules apply)

The Web Worker imports this folder and runs the Monte-Carlo ensemble. Keep the
contract intact: the worker receives the `ParamState` (+ seed), draws the
shocks itself, and posts results/progress back — it must not touch the DOM,
`localStorage`, or React state. Any impurity added to `src/engine/` breaks
both the worker and the synchronous fallback in `App.tsx`; keep both paths
working when you change `monte-carlo.ts` or `simulate.ts` signatures.

## Domain invariants (tests exist; keep them true)

- Repayment can be defined by **initial amortization % (Anfangstilgung)** or by
  **desired monthly payment** (`tilgung_mode`); the payment mode derives and
  clamps tilgung ≥ 0. Payment below initial interest = no amortization = the
  loan never shrinks (App warns; engine just simulates honestly).
- `Sondertilgung` above 5 %/year of the original loan is legal in the model but
  flagged by App as unlikely to be granted — the engine must not silently cap it.
- LTV pricing: +0.25 % points above 60 % LTV, +0.6 % points above 80 %
  (`ltvSurchargePct()`), applied to fixed and follow-up rate.
- Inflation/real-terms handling: recurring costs are indexed; the real-terms
  toggle in the UI only *deflates presentation*, it must not change the
  simulation.
- Owner-occupied capital gains are tax-free after 10 years (§ 23 EStG); the
  toggle only relaxes this. Equity funds: 30 % Teilfreistellung × fund share.

## Testing

- One `__tests__` file per module; when you fix a bug, first write the test
  that reproduces it.
- Values are Germany-realistic: test with 3.5 % rates, 2 % Anfangstilgung,
  26.375 % capital-gains tax — not round US-style numbers.
- A new parameter must appear in `params.ts` with `help` text and, if
  simulation-relevant, `mcable: true`; `state-io` merging means old saved
  states (and share links) without that key must decode to the default.
