# Roadmap — working plan, in priority order

Loaded via pointer from the root `AGENTS.md` for planning work.

**Correctness / hygiene**
1. Keep the full gate green on every commit; CI covers it, but never push
   expecting CI to catch what tsc can.
2. Extract repeated formatting helpers (EUR/percent formatting) if a fourth
   copy appears in `src/ui/`.

**Near term**
3. Unit tests for the Options-menu toggling paths and the tabbed ParamForm
   (currently only covered indirectly through the smoke tests).
4. The Plotly bundle is a ~4.6 MB lazy chunk — try `manualChunks` and/or a
   lighter chart layer; keep Plotly lazy-loaded either way.
5. German-language UI (the market is German; English texts are a legacy of the
   AI generation).

**Mid term**
6. Contractual realism: `Sondertilgung` cap as a *parameter* (currently a
   hard-coded 5 % warning), indexation options for `Hausgeld`.
7. Accessibility pass on the custom tooltips (focus trap / escape on mobile —
   hover tooltips are unusable on touch).
8. End-to-end smoke (Playwright) run in CI against the built bundle, so Pages
   deploys never receive a blank page.

**Long term / consider**
9. Scenario comparison view (two saved scenarios side by side).
10. Service worker + installable PWA for offline use (fits the "all data stays
    in your browser" promise).
11. Split the monolithic `App.tsx` (state + warnings + toolbar) into smaller
    components if it keeps growing.

Audit this roadmap whenever you complete or invalidate an item; keep it honest
instead of aspirational.
