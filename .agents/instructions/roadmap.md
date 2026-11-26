# Roadmap v2 — working plan, in priority order

Regenerated 2026-11 after the i18n / realism / robustness batch (items 4, 5,
6, 17, 18, 19, 21 done — see the archive at the bottom). Every open item now
carries ordered implementation steps, target files and a "Done when" block so
a low-depth model can execute it without re-deriving context. Read the
referenced `.agents/instructions/*.md` before touching those areas.

## How to execute an item (applies to every item below)

1. Read the item's steps. If a step conflicts with a **Hard invariant** in
   `.agents/instructions/ui.md` or `engine.md`, the invariant wins.
2. Implement the steps in order; later steps assume earlier ones.
3. Full gate before any commit: `npx tsc --noEmit`, `npx vitest run`,
   `npm run build` — all green.
4. One roadmap item per commit (or per PR-sized change); never mix unrelated
   items.
5. On completion, mark the item `(Done YYYY-MM: summary + numbers)` **in the
   same commit**, and re-point anything that referenced it.
6. Never commit personal data; `plan/` stays gitignored; commit footer per
   root `AGENTS.md`; pushes happen from the user's machine
   (`--force-with-lease` after any history rewrite).
7. i18n note (applies everywhere): every new user-visible string must be
   added to `src/i18n.ts` as a DE/EN pair (labels/help in
   `src/engine/params.ts` + `src/engine/params-de.ts` for parameters).
   English is the test language — never break the English assertions.

---

## Priority 1 — Mobile-first UI redesign

(Done 2026-11: docked bottom run bar with safe-area padding, compact header
with hidden subtitle under 480 px, horizontally swipeable parameter tabs,
phone-capped chart heights in `Plot.tsx` (≤ 300 px under 720 px viewport),
44 px touch targets, 320 px sweep clean, and the two drifting HelpTip copies
consolidated into `src/ui/HelpTip.tsx` — the Options menu copy was still the
old hover-only one. English test suite unchanged and green; 74/74 tests.)

The layout is still desktop-first: on a 390×844 phone the header wraps into a
tall block, the sticky runs bar eats vertical space, 8 parameter tabs cramp
into two rows, charts are taller than the viewport, and the options panel is
scrolled out of reach. Goal: a phone user can go inputs → run → read results
without pinch-zoom or horizontal scrolling at 320 px.

**Baseline measurement first (before any edit, report in the commit body):**
Chrome DevTools device mode at 390×844 and 320×700: (a) horizontal overflow
yes/no at 320 px, (b) scroll distance from top to the first Run button,
(c) Lighthouse mobile performance + accessibility scores. Re-measure the same
three at the end.

### Steps

1. **Compact header on phones** (`src/App.tsx`, `src/styles.css`):
   - Under 480 px: `header h1 { font-size: 1.05rem }`, `.brand .logo`
     36×36 (the mobile media block already has rules — tighten them), and
     hide the `.subtitle` (`display: none`) — its content is duplicated in
     the README and the footer.
   - Under 720 px: give the Preset `<select>` in the toolbar
     `max-width: 150px` inside the existing `.toolbar` media block so it
     stops forcing the other toolbar buttons onto extra rows.
2. **Docked run bar on phones** (`src/styles.css`):
   - Under 720 px: `.runs-bar { position: fixed; left: 0; right: 0; bottom: 0;
     top: auto; margin: 0; border-radius: 12px 12px 0 0; z-index: 30;
     padding: 8px 10px calc(8px + env(safe-area-inset-bottom)); }`
   - Hide under 720 px: `.runs-bar .hint`, `.run-group-label` (the labels
     reappear ≥ 720 px); the two Run buttons become the whole bar
     (`flex: 1 1 auto` rule already exists).
   - `.app { padding-bottom: 96px }` under 720 px so the dock never covers
     the footer.
   - The deterministic run button keeps its markup/text; no test changes.
3. **Swipeable parameter tabs** (`src/styles.css`):
   - Under 720 px: `.param-tabs .mantine-Tabs-tabList { flex-wrap: nowrap;
     overflow-x: auto; scrollbar-width: none; }` plus
     `.param-tabs .mantine-Tabs-tabList::-webkit-scrollbar { display: none; }`
     so the 8 tabs swipe horizontally instead of wrapping. Keep the `.count`
     badges visible.
4. **Phone-sized charts** (`src/ui/Plot.tsx`, `src/ui/Results.tsx`):
   - In `Plot.tsx`, inside the component add a guarded width check:
     `const compact = typeof window !== 'undefined' && window.innerWidth < 720;`
     then use `style={{ height: compact && height < 300 ? 240 : height }}` on
     the returned div (and only the div — do NOT touch the `key` computation
     or the Plotly config).
   - In `Results.tsx`, set the large chart `<Plot height={380}>` calls to
     `340`; keep the amortization overview at 380.
5. **Key numbers on phones** (`src/styles.css`): the 2-column
   `.keynumbers` rule under 720 px already exists — verify it still applies;
   if a stat overflows at 320 px, drop `.stat .stat-value` to `1rem` in the
   mobile block.
6. **Touch-friendly tooltips** (`src/ui/ParamForm.tsx`, `src/ui/OptionsMenu.tsx`):
   - HelpTip already toggles on tap/Enter and closes on Escape/outside-tap
     (item 6 done). What remains is placement: on narrow screens the tooltip
     can still leave the viewport when the trigger sits near the edge. Under
     720 px keep the existing right-aligned rule
     (`.help-tip .help-tooltip { right: 0; left: auto; transform: none }`)
     and verify it applies to BOTH HelpTip copies (ParamForm + OptionsMenu);
     if the two implementations drifted, extract one shared component to
     `src/ui/HelpTip.tsx` and import it in both files (pure refactor, no
     behavior change).
7. **Touch targets** (`src/styles.css`, mobile block):
   `button, select, .mc-toggle, .opt-item { min-height: 44px; }` and exempt
   the inline mark with `.help-tip { min-height: 0; }`.
8. **320 px overflow sweep**: the known suspects are `.amort-table`
   (already scrolls inside `.amort-table-wrap` — keep) and `.param-mc` rows
   (wrap — fine). For anything else that overflows, constrain the offending
   selector with `max-width: 100%` inside the media block. Do not introduce
   page-level `overflow-x: hidden` — hide the cause, not the symptom.

**Done when**: (a) no horizontal scroll at 320×700; (b) run buttons usable
while docked without scrolling past the first card; (c) all 8 tabs reachable
by swipe; (d) tooltips usable by tap; (e) baseline vs. final measurements in
the commit body; (f) full gate green; (g) smoke + paramform tests pass
without changing their assertions (viewport-only CSS must not affect them).

---

## Priority 2 — Engine realism (one sub-item per commit, ordered)

Each sub-item: parameter first (`src/engine/params.ts` + `params-de.ts`, per
`.agents/skills/add-new-parameter/`), engine second (`src/engine/mortgage.ts`
/ `invest.ts`), UI third, tests last. Follows the pattern set by item 5.

- **2a. Repayment shapes** (was 11)
  (Done 2026-11: `tilgung_shape` select — annuity (default, unchanged) /
  linear / grace years with `grace_years` / bullet — implemented in
  `mortgageSchedule` (`shape` + `graceYears` inputs) with re-anchoring at the
  grace end and the fixed-period end, guarded so grace can outlast the fixed
  period. `monthly_payment` mode now applies to the annuity shape only, and
  the payment warning is suppressed for non-annuity shapes; effective
  Anfangstilgung shown as 100/term for linear, 0 for bullet. 9 new shape
  tests in `mortgage.test.ts` incl. backward compatibility; DE strings in
  `params-de.ts`.)
- **2b. `Disagio`** (was 12): `disagio_pct` 0–5 (step 0.25). Payment loading:
  loan × (1 − disagio/100). Show effective vs. nominal rate in Results
  (`src/format.ts` helpers only). Test: 2 % Disagio on the default state
  yields the exact expected loan delta.
  (Done 2025-08: `disagio_pct` in the mortgage group (default 0, icon 🧾,
  DE strings). Loan is grossed up: `loanAmount = base / (1 − d/100)` — the
  shortfall vs the payout is financed within the loan, so the t=0 buy net
  worth drops exactly by the fee. `effectiveRatePct` in `mortgage.ts`
  computes the IRR of disbursement vs payments + Restschuld at the end of
  the fixed period (annuity shape only); Results shows "effective vs
  nominal" Stat whenever they differ. Test asserts the exact loan
  gross-up, t=0 consistency, effective > nominal, and the IRR NPV ≈
  disbursed amount; suite 83/83.)
- **2c. `Vorabpauschale`** (was 16): in `invest.ts`, annual prepayment tax on
  the ETF path for horizons > 1 y (Basiszins as a named constant + comment;
  Teilfreistellung respected; Sparerpauschbetrag still only at liquidation).
  Test: tax > 0 and grows sub-linearly; exact value asserted for one
  hand-computed year.
  (Done 2025-08: `BASISZINS = 0.0255` named constant + `vorabpauschaleTax()`
  in `invest.ts` — Basisertrag = start-of-year value × Basiszins × 70 %,
  capped by the actual year's gain (0 on losses), taxed with
  Teilfreistellung; Sparerpauschbetrag stays reserved for liquidation; tax
  deducted from the portfolio value. Assessed each January from the second
  year on, both branches, behind the always-on `vorabpauschale` switch
  (Options menu). 5 tests incl. hand-computed year, loss year, and a
  runScenario comparison; suite 88/88.)
- **2d. `Bereitstellungszinsen`** (was 14): commitment interest on the
  undrawn share (default 3 % p.a.), only when the loan is disbursed in
  stages (a new boolean + draw schedule may be needed — keep it a simple
  two-phase draw if the full schedule is out of proportion).
  (Done 2025-08: simple two-phase draw as recommended — `draw_months`
  (default 0) + `bereitstellung_pct` (default 3 %, visible only when the
  draw period > 0). Half the loan drawn at t0, the rest after
  `draw_months`; during the draw phase interest accrues only on the drawn
  half, the undrawn share costs commitment interest monthly, no
  amortization; at full draw the annuity re-anchors over the remaining
  term. Only implemented for the annuity shape (documented);
  `MortgageResult` gained `commitment[]`/`totalCommitment`. 4 tests;
  suite 92/92.)
- **2e. Energy classes** (was 15): efficiency-class select (A–H) driving
  different maintenance-reserve and retrofit defaults (class G vs. A/B).
  (Done 2025-08: `energy_class` select A–H (default D, icon ⚡, EN labels +
  `labelDe`, DE help) and `energy_upkeep` switch (default on). When on, the
  maintenance reserve gains a class-dependent surcharge of 0–0.6 pp of the
  purchase price per year (A/B 0 → H 0.6); renovation-budget help now names
  typical retrofit budgets for F/G/H. Test asserts exact cost deltas and
  switch-off equivalence; the app-smoke test no longer assumes
  `tilgung_mode` is the only select. Suite 93/93.)
- **2f. Couple mode** (was 13) — last, only behind an explicit toggle:
  second Sparerpauschbetrag (2 000 € instead of 1 000 €), optional second
  equity pool. The single-income/pool assumption is intentional; do not
  widen silently.
  (Done 2025-08: `couple_mode` switch (default off, Options menu, icon 👥)
  doubles the Sparerpauschbetrag and reveals the `equity_second` pool
  (added to equity in `runScenario` and `loanAmountFor`); the shared-pool /
  single-income simplification stays — stated in the help text. Test
  covers the loan delta and the lower liquidation tax; suite 94/94.)

---

## Priority 3 — Quality infrastructure

- **3a. E2E smoke in CI** (was 7): Playwright, single spec `e2e/smoke.spec.ts`:
  load `/`, expect the header text (EN — default test language), click
  "Run", assert a `.stat` value changes, no console errors. CI: job after
  `build` in `deploy.yml`, against `vite preview`, main branch only. Keep
  Plotly-heavy assertions out (canvas rendering is flaky in CI).
  (Done 2025-08: `e2e/smoke.spec.ts` — header assertion, deterministic Run
  click (scoped to the run group; the run is too fast to observe the
  "Running…" label), ≥5 filled `.stat-value` cards, console/pageerror-free.
  `playwright.config.ts` webServer = `vite preview` on 4173; vitest
  excludes `e2e/**`. `deploy.yml` gained an `e2e` job (chromium install +
  test, main only) and deploy now `needs: [build, e2e]`. Locally:
  `npm run test:e2e`.)
- **3b. Share-link compression** (was 20): in `src/engine/state-io.ts`, when
  `toShareUrl` exceeds ~1500 chars, deflate-raw + base64 via
  `CompressionStream` with a plain fallback; round-trip unit test for both
  paths.
  (Done 2025-08: `encodeStateAsync`/`toShareUrlAsync` compress codes > 1500
  chars via CompressionStream('deflate-raw') + base64url with the `z.`
  prefix ('.' never occurs in plain codes); graceful plain fallback when
  streams are unavailable; `decodeStateAsync` handles both, `decodeState`
  stays sync for plain codes. The share button and the URL restore (an
  async effect for compressed links, sync path untouched) use the async
  variants; old plain links keep loading. 4 round-trip tests incl. the
  "default state is already long" reality; suite 98/98 + e2e.)
  paths; old plain links must still load (versioned prefix or try/catch).
- **3c. Chart a11y** (new, small): Plotly figures get a `title`/`aria-label`
  and the `Plot` wrapper a `role="img"` + short description from the card
  heading; export/download buttons stay keyboard reachable.
  (Done 2025-08: `Plot` takes `ariaLabel`/`ariaDescription` — renders
  `role="img"` with the label, description as a visually-hidden paragraph
  linked via `aria-describedby`; all six charts in Results pass DE/EN
  labels + one-sentence descriptions. Suite 98/98.)

---

## Priority 4 — Product & UX

- **4a. Printable one-pager "Entscheidungsvorlage"** (was 22): a dedicated
  print layout — headline numbers, decision-relevant deltas, top-3
  sensitivities — as a hidden-on-screen section rendered only under
  `@media print`. The print CSS base already exists.
  (Done 2025-08: `src/ui/PrintOnePager.tsx` — print-only section prepended
  to the printed page: date/assumptions line, key-number table (terminal
  net worths, difference, break-even, monthly payment, total interest,
  transaction costs, Restschuld) and the top-3 sensitivity levers. Styled
  title is a `<p>` (no second `<h1>`); screen tests use `getAllByText`
  where the print block repeats a label (jsdom loads no CSS). Suite 98/98
  + e2e.)
- **4b. Unit-aware steppers/sliders** (was 23): value+slider pairs for the
  headline inputs (price, equity, rate, fixed period) in Global/Purchase;
  Mantine `Slider` + `NumberInput` linked both ways; keyboard reachable;
  tests keep using the NumberInput (getByDisplayValue) so the slider needs
  no test coverage beyond one interaction test.
  (Done 2025-08: `SLIDER_PARAMS` = property_price, equity, fixed_rate,
  fixed_years — Mantine `Slider` (size xs) rendered under the existing
  number input inside the same param box, linked both ways via
  `state.values`; keyboard-operable thumb. Tests: slider-count + one
  ArrowRight interaction; display-value assertions switched to
  `getAllByDisplayValue` (the slider renders a second hidden input).
  Suite 99/99 + e2e.)
- **4c. Scenario comparison** (was 8): two saved scenarios side by side —
  reuse `localStorageSave/Load`; render a second Results column in a
  dedicated comparison mode reachable from the toolbar.
  (Done 2025-08: toolbar "⚖ Compare" select lists saved scenarios; picking
  one switches to Results and renders a second `.col-compare` column with
  its own full nominal Results (`mc`/`sens` null → nominal parts only),
  headed "Compared with: <name>" with an "End comparison" button; grid
  becomes two columns on wide screens, stacked on narrow. Outdated
  "no Vorabpauschale" assumption lines corrected. Test covers the flow;
  suite 100/100.)
- **4d. PWA/offline** (was 9): service worker + manifest; fits the "all data
  stays in your browser" promise; add only after the Pages deploy flow is
  verified to keep working (stale-worker handling: skip-waiting + a toast
  "updated, reload").
  (Done 2025-08: `public/sw.js` — network-first navigations (new deploys
  arrive immediately; cached shell = offline fallback), cache-first assets
  with background refresh; install → skipWaiting, activate → clients.claim.
  `public/manifest.webmanifest` + SVG icon (also the favicon) + theme-color
  meta. Registered in App's mount effect, production only and never under
  webdriver automation; `controllerchange` fires the "new version installed
  — please reload" toast. Verified: `node --check sw.js`, manifest JSON,
  full gate, e2e against `vite preview` — the real Pages check happens on
  the user's next push.)

## Priority 5 — Long-term

- **5a. Split `App.tsx`** (was 10): 426 lines and growing — extract
  `Toolbar`, `RunsBar`, `Warnings` when touched next; do not split for its
  own sake.
  (Done 2025-08: after the toolbar/compare/print/PWA work grew App.tsx to
  508 lines, the three blocks were extracted as planned: `src/ui/Toolbar.tsx`
  (language/theme/presets/share/save/reset/Options/print/compare — compare
  select now doubles as "end comparison" via its value), `src/ui/RunsBar.tsx`
  (deterministic + MC run controls, pure presentational) and
  `src/ui/Warnings.tsx` (the three guardrail divs). App.tsx back to 426
  lines owning state, effects and computation only. Full gate + e2e green.)
- **5b. Replace Plotly** (was 16b): the ~4.6 MB lazy chunk is inherent to
  Plotly; revisit after Priority 1's mobile measurements. Weigh losing
  zoom/variants against mobile load; the chart calls are already isolated in
  `src/ui/Plot.tsx`, which keeps this swappable.

## Explicit non-goals (do not implement; they would break the product promise)

- No backend, accounts, or telemetry/analytics — everything stays in the
  browser.
- No "you should buy" recommendation: the app presents scenarios and leaves
  the decision to the user (the not-financial-advice disclaimer exists).
- No foreign-market tax models: German-law specific by design
  (Abgeltungsteuer, § 23 EStG, Grunderwerbsteuer) — generalize only if the
  tax model becomes parameterized, never by special-casing.

---

## Archive (done — context only, do not re-open)

1. Formatting helpers in `src/format.ts`; always-apply gate discipline.
2. `src/ui/__tests__/paramform.test.tsx` — 6 unit tests (tabs, edits, MC
   enrollment, Options toggles, dimming rule).
3. `manualChunks` React vendor split. (Entry is ~60 kB gzip since the
   Mantine merge — accepted tradeoff, revisit only via 5b.)
4. DE/EN toggle (`src/i18n.ts`, `src/engine/params-de.ts`); English stays the
   default/test language.
5. `sondertilgung_cap_pct` parameter (default 5 %) + `hausgeld_indexation`
   select with custom rate.
6. Accessible HelpTip: tap/Enter toggle, Escape close with focus restore,
   outside-tap dismiss; hover behavior preserved on desktop.
17. `src/ui/ErrorBoundary.tsx` in `main.tsx`: recoverable card, bilingual,
   with a "reset parameters & reload" path that clears `buyvsrent.*`
   localStorage when the persisted state itself is the trigger.
18. `src/engine/__tests__/invariants.test.ts`: property-style engine checks
   (series shape, amortization, principal conservation, payment identity,
   monotone balance, break-even consistency, kaution, no negatives, equity
   monotonicity, freed-cash invariant).
19. `deploy.yml`: separate `test` job gates the deploy; concurrency
   cancel-in-progress + npm caching in place.
21. City presets (Munich/Berlin/Leipzig/Hamburg) with correct Bundesland
   Grunderwerbsteuer (3.5/6.0/5.5/4.5 %) and preset description tooltips.
- 2026-11: Mantine 8 + "modern sleek" design system merged to main
  (`src/ui/mantine-theme.ts`, purple primary per commit a88e554); fully
  GitHub Pages compatible.

Audit this roadmap whenever you complete or invalidate an item; keep it honest
instead of aspirational.
