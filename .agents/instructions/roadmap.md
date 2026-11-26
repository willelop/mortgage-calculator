# Roadmap — working plan, in priority order

Loaded via pointer from the root `AGENTS.md` for planning work.

**Correctness / hygiene**
1. Keep the full gate green on every commit; CI covers it, but never push
   expecting CI to catch what tsc can.
   (Done 2026-11: shared formatting helpers live in `src/format.ts` — keep
   using them instead of inlining formats.)

**Near term**
2. (Done 2026-11: `src/ui/__tests__/paramform.test.tsx` — 6 unit tests over
   tab switching, edit persistence, MC enrollment/min-max seeding, Options
   toggling incl. switch-kind features and the dimming rule.)
3. (Done 2026-11: `manualChunks` in `vite.config.ts` — React in its own
   `react-vendor` chunk, app entry down 195.87 → 54.06 k (gzip 64 → 19 k);
   Plotly still lazy. Remaining: swap Plotly for a lighter chart layer —
   moved to long-term item 16b.)
4. (Done 2026-11: DE/EN toggle in the toolbar — branch `i18n-de-en`. English
   stays the default/test language (`buyvsrent.lang`); German covers every
   label, help text, warning, chart axis, CSV header and preset name. The
   switch lives in `src/i18n.ts`; German strings in `src/engine/params-de.ts`
   and as inline DE/EN pairs in the components.)

**Mid term**
5. (Done 2026-11: `sondertilgung_cap_pct` — the contract cap behind the
   Sondertilgung warning is now an editable parameter (default 5 %) instead
   of a hard-coded value; `hausgeld_indexation` select (inflation / fixed /
   custom rate) with `hausgeld_index_rate` for the custom case.)
6. (Done 2026-11: HelpTip is a real toggle button — tap/Enter opens the
   tooltip, Escape closes it and restores focus, a tap outside dismisses it;
   desktop hover/focus behavior unchanged via CSS focus-within/.open rules.)
7. End-to-end smoke (Playwright) run in CI against the built bundle, so Pages
   deploys never receive a blank page.

**Long term / consider**
8. Scenario comparison view (two saved scenarios side by side).
9. Service worker + installable PWA for offline use (fits the "all data stays
   in your browser" promise).
10. Split the monolithic `App.tsx` (state + warnings + toolbar) into smaller
    components if it keeps growing.
16b. Replace Plotly with a lighter chart layer (the 4.6 MB chunk is inherent
    to Plotly; losing zoom/variants must be weighed against mobile load).

**Model depth — German mortgage realism (domain features, roughly in order of
being asked for / cheapest-first)**

11. Repayment shapes beyond annuity: `Tilgungsfreijahre` (repayment-free
    grace period, common with new builds), `endfälliges Darlehen` (bullet
    repayment — relevant when pairing with Bauspar/KfW), linear amortization.
    The engine's mortgage module is already year-stepped; each is a
    `tilgung_shape` extension of the repayment derivation.
12. `Disagio` (Abgeld): up-front discount paid from equity, effective vs
    nominal rate display. Cheap: one parameter + a payment-loading change.
13. Couple mode: second `Sparerpauschbetrag` (2 000 € instead of 1 000 €)
    and, if asked for, combining two equity pools. The model intentionally
    assumes one income and one pool — widen only with an explicit toggle.
14. `Bereitstellungszinsen` (commitment interest on drawn-but-not-used loan
    for staged new-build disbursement) — often 3 %+ on the undrawn part.
15. Energy-related costs: the lump-sum maintenance event can model a GEG
    (heating) retrofit already; make it first-class with an efficiency-class
    parameter so the reserve and retrofit defaults differ (class G vs A/B).
16. `Vorabpauschale` for buy-and-hold ETFs in `invest.ts` (currently skipped):
    small annual prepayment tax on gains; matters for horizons > 10 y.

**Robustness & engineering**

17. (Done 2026-11: `src/ui/ErrorBoundary.tsx` wraps the app in `main.tsx` —
    a render exception now shows a recoverable card with "Reload" and
    "Reset parameters & reload" (clears the `buyvsrent.*` localStorage
    entries when the persisted state itself is the trigger); bilingual via
    browser language, with a boundary unit test.)
18. Engine invariant tests (property-style): money conservation (rent branch
    cash + invested == buy branch cash + property + invested up to the flows
    under test), loan fully amortizes by term end whenever amortization > 0,
    no negative reserves. These catch whole classes that example tests miss.
19. (Done 2026-11: `deploy.yml` — tests run in their own `test` job and
    build/deploy depend on it, so a red test can never reach Pages;
    `concurrency` cancel-in-progress and npm caching were already in place.)
20. Share links compress state (URL currently grows with every parameter —
    deflate + base64 when it exceeds ~1 500 chars, with a graceful fallback).

**UX polish**

21. Preset library: city/land-specific presets (Munich vs Leipzig economics,
    the `Grunderwerbsteuer` rate differs by Bundesland) with a short "why" in
    the preset list.
22. Printable one-page "Entscheidungsvorlage": the headline numbers, the
    decision, and the top sensitivities — the print CSS exists, add a layout
    that deserves it.
23. Number inputs get unit-aware steppers/sliders (value + slider pairs) for
    the few headline inputs (price, equity, rate) in the Global/Purchase tabs.

**Explicit non-goals (do not implement; they would break the product promise)**

- No backend, accounts, or telemetry/analytics — everything stays in the
  browser.
- No "you should buy" recommendation: the app presents scenarios and leaves
  the decision to the user (the not-financial-advice disclaimer exists for
  this).
- No foreign-market tax models: the engine is German-law specific by design
  (Abgeltungsteuer, § 23 EStG, Grunderwerbsteuer) — generalize only if the
  tax model becomes parameterized, never by special-casing.

Audit this roadmap whenever you complete or invalidate an item; keep it honest
instead of aspirational.
