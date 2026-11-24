# Buy vs. Rent — German Mortgage Calculator

A fully client-side analysis tool for the **buy vs. rent** decision in Germany:
deterministic nominal scenario plus Monte-Carlo simulation over every parameter
you enroll, with percentile fan charts, break-even statistics and a sensitivity
(tornado) analysis.

**100 % browser-based — no backend, no server, no data leaves your machine.**
Published as a static site on GitHub Pages.

## Run locally

```bash
npm install
npm run dev       # dev server
npm test          # engine unit tests (Vitest)
npm run build     # production build to dist/
```

After pushing to `main`, the GitHub Action in `.github/workflows/deploy.yml`
builds, tests and deploys to Pages (enable *Settings → Pages → GitHub Actions*).

## Features

- **Parameter model** built around the German market (defaults for a 500 k€ house):
  Grunderwerbsteuer by Bundesland, Notar/Grundbuch/Makler costs, Wohngebäudeversicherung,
  Grundsteuer, maintenance reserve, Hausgeld/WEG.
- **Mortgage modelling** in German terms: Zinsbindung (fixed period), Anfangstilgung
  (initial amortization) with German-style annuity, follow-up re-fixing over the
  remaining term, Sondertilgung (extra repayments).
- **Rent branch**: Kaltmiete + Nebenkosten, rent growth (optionally CPI-linked),
  Kaution (refundable), relocation costs.
- **Alternative investment**: current capital in stocks/bonds, editable expected
  returns and volatilities, Abgeltungsteuer (26.375 %) with Teilfreistellung and
  Sparerpauschbetrag, proportional-gain tax on withdrawals.
- **§23 EStG**: owner-occupied capital gains are tax-free after 10 years (toggleable),
  selling costs applied on resale if sold at the horizon.
- **Every parameter** can be individually enabled/disabled, and every parameter can
  be enrolled into the Monte Carlo with a variability range and distribution
  (normal / uniform / triangular / lognormal).
- **Correlated Monte Carlo**: ρ(stocks, property), ρ(stocks, inflation), ρ(rent, inflation);
  per-year lognormal return paths; seeded and therefore reproducible.
- **Outputs**: nominal net worth & cumulative cost charts, MC percentile fan charts,
  probability buy ends richer, break-even year distribution, terminal-wealth
  difference histogram, sensitivity tornado chart.
- **Shareable scenarios**: full state encoded in the URL; named scenarios in localStorage.

## Model assumptions & limits (see `plan/app-plan.md` for the full plan)

- Both branches are assumed to have equal income; the *difference* in monthly
  cost of buying vs. renting is invested (or withdrawn) in the renting branch.
  That "invested freed cash flow" mechanism is the single largest driver of the
  result and is on by default — disabling it biases the outcome towards buying.
- Investment gains are taxed at withdrawal/liquidation (proportional-gain rule),
  not yearly (no Vorabpauschale / Teilfreistellung-Vorabpauschale / allowance can apply),
  which slightly under/overstates exact German taxation.
- No income-tax side of ownership (no depreciation; self-use only).
- Property growth is drawn lognormally per year around the nominal rate;
  maintenance, insurance and taxes of ownership are indexed to inflation.
- This is a planning aid, **not tax or financial advice**.

## Layout

```
src/engine/          pure TypeScript, no DOM — unit tested
  params.ts          parameter registry (single source of truth)
  mortgage.ts        mortgage schedule
  invest.ts          tax-aware portfolio
  simulate.ts        monthly core scenario
  monte-carlo.ts     RNG, draws, correlated MC runner
src/ui/              React components + Plotly charts
.github/workflows/   CI + Pages deployment
```
