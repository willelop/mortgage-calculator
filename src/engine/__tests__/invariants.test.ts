/**
 * Engine invariant tests (roadmap #18).
 *
 * Property-style checks that hold for *every* valid parameter combination,
 * not just the example scenarios: series shape, loan mechanics (full
 * amortization, principal conservation, monotone balance), internal
 * consistency of the result series, and the freed-cash-flow invariant.
 * All runs are deterministic (no shocks).
 */
import { describe, it, expect } from 'vitest';
import { defaultState, ParamState, num } from '../params';
import { runScenario } from '../simulate';
import { mortgageSchedule } from '../mortgage';

/** Mutate a fresh default state (keeps every test independent). */
function withParams(over: Record<string, number>): ParamState {
  const s = defaultState();
  for (const [k, value] of Object.entries(over)) {
    s.values[k] = value;
    s.on[k] = true; // a switch the user turned on via the UI is "on"
  }
  return s;
}

const LOAN_CASES: { name: string; over: Record<string, number> }[] = [
  { name: 'classic 2% tilgung', over: {} },
  { name: 'minimum tilgung', over: { initial_tilgung: 0.5 } },
  { name: 'aggressive tilgung + sonder', over: { initial_tilgung: 3, sondertilgung_pct: 4, sondertilgung_eur: 5000 } },
  { name: 'payment mode', over: { tilgung_mode: 1, monthly_payment: 3000 } },
  { name: 'short horizon vs term', over: { horizon_years: 8 } },
  { name: 'follow-up rate higher', over: { followup_rate: 5.5, fixed_years: 10 } },
  { name: 'low equity, high LTV', over: { equity: 25_000 } },
];

const EPS = 1e-6;
const close = (a: number, b: number, eps = 1e-4) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(a), Math.abs(b));

describe('scenario result shape', () => {
  it('every series has H+1 rows with year labels 0..H', () => {
    for (const c of LOAN_CASES) {
      const r = runScenario(withParams(c.over));
      const H = r.horizon;
      expect(r.years).toEqual(Array.from({ length: H + 1 }, (_, i) => i));
      for (const series of [r.nwBuy, r.nwRent, r.buyPortfolio, r.rentPortfolio, r.propertyValue, r.loanBalance, r.kautionValue, r.buyCumCost, r.rentCumCost]) {
        expect(series.length, c.name).toBe(H + 1);
        for (const x of series) expect(Number.isFinite(x), c.name).toBe(true);
      }
    }
  });
});

describe('mortgage invariants', () => {
  it('loan fully amortizes by term end whenever amortization > 0', () => {
    for (const c of LOAN_CASES) {
      const st = withParams(c.over);
      const loan = runScenario(st).loanAmount;
      if (loan <= 0) continue;
      const termMonths = Math.round(num(st, 'loan_term_years')) * 12;
      const months = num(st, 'horizon_years') * 12;
      if (months < termMonths) continue;
      const m = mortgageSchedule({
        loan,
        fixedRatePct: num(st, 'fixed_rate'),
        fixedYears: Math.round(num(st, 'fixed_years')),
        followupRatePct: num(st, 'followup_rate'),
        tilgungPct: num(st, 'tilgung_mode') === 1 ? 0 : num(st, 'initial_tilgung'),
        termYears: Math.round(num(st, 'loan_term_years')),
        sondertilgungPct: num(st, 'sondertilgung_pct'),
        sondertilgungEur: num(st, 'sondertilgung_eur'),
        months,
      });
      expect(m.balance[termMonths], c.name).toBeLessThanOrEqual(0.01);
    }
  });

  it('principal is conserved: loan0 − balance_end == Σ principal (incl. Sonder)', () => {
    for (const c of LOAN_CASES) {
      const st = withParams(c.over);
      const loan = runScenario(st).loanAmount;
      if (loan <= 0) continue;
      const months = num(st, 'horizon_years') * 12;
      const m = mortgageSchedule({
        loan,
        fixedRatePct: num(st, 'fixed_rate'),
        fixedYears: Math.round(num(st, 'fixed_years')),
        followupRatePct: num(st, 'followup_rate'),
        tilgungPct: num(st, 'tilgung_mode') === 1 ? 0 : num(st, 'initial_tilgung'),
        termYears: Math.round(num(st, 'loan_term_years')),
        sondertilgungPct: num(st, 'sondertilgung_pct'),
        sondertilgungEur: num(st, 'sondertilgung_eur'),
        months,
      });
      const repaid = m.principal.reduce((a, b) => a + b, 0);
      expect(close(loan - m.balance[months], repaid), c.name).toBe(true);
    }
  });

  it('monthly payment == interest + principal, and the balance never increases', () => {
    const st = withParams({});
    const loan = runScenario(st).loanAmount;
    const months = num(st, 'horizon_years') * 12;
    const m = mortgageSchedule({
      loan,
      fixedRatePct: num(st, 'fixed_rate'),
      fixedYears: Math.round(num(st, 'fixed_years')),
      followupRatePct: num(st, 'followup_rate'),
      tilgungPct: num(st, 'initial_tilgung'),
      termYears: Math.round(num(st, 'loan_term_years')),
      sondertilgungPct: num(st, 'sondertilgung_pct'),
      sondertilgungEur: num(st, 'sondertilgung_eur'),
      months,
    });
    for (let i = 0; i < months; i++) {
      expect(close(m.payment[i], m.interest[i] + m.principal[i])).toBe(true);
      expect(m.balance[i + 1], 'balance monotone').toBeLessThanOrEqual(m.balance[i] + EPS);
      expect(m.balance[i + 1]).toBeGreaterThanOrEqual(-EPS);
    }
  });
});

describe('result-series invariants', () => {
  it('break-even and terminalDiff are consistent with the series', () => {
    for (const c of LOAN_CASES) {
      const r = runScenario(withParams(c.over));
      const last = r.nwBuy.length - 1;
      expect(close(r.terminalDiff, r.nwBuy[last] - r.nwRent[last]), c.name).toBe(true);
      if (r.breakEvenYear !== null) {
        const i = r.years.indexOf(r.breakEvenYear);
        expect(i).toBeGreaterThan(0);
        expect(r.nwBuy[i]).toBeGreaterThanOrEqual(r.nwRent[i] - EPS);
        // strict crossover only when there IS a history: at i == 1 the year
        // before is the start row (year 0), where the buy branch may already
        // be ahead (rent locks up kaution + moving costs) without any
        // crossover having happened.
        if (i > 1) expect(r.nwBuy[i - 1]).toBeLessThan(r.nwRent[i - 1]);
      }
    }
  });

  it('no negative reserves: loan balance, kaution and property stay >= 0', () => {
    for (const c of LOAN_CASES) {
      const r = runScenario(withParams(c.over));
      for (const x of r.loanBalance) expect(x, c.name).toBeGreaterThanOrEqual(-EPS);
      for (const x of r.kautionValue) expect(x, c.name).toBeGreaterThanOrEqual(-EPS);
      for (const x of r.propertyValue) expect(x, c.name).toBeGreaterThanOrEqual(-EPS);
    }
  });

  it('kaution equals 3× the cold rent at the start and never shrinks', () => {
    const st = withParams({ rent_cold: 1500 });
    const r = runScenario(st);
    expect(close(r.kautionValue[0], 4500)).toBe(true);
    for (let y = 1; y <= r.horizon; y++) {
      expect(r.kautionValue[y]).toBeGreaterThanOrEqual(r.kautionValue[y - 1] - EPS);
    }
  });

  it('more equity never increases the loan', () => {
    const eq = [0, 25_000, 100_000, 250_000, 1_000_000];
    const loans = eq.map((e) => runScenario(withParams({ equity: e })).loanAmount);
    for (let i = 1; i < loans.length; i++) {
      expect(loans[i], 'equity ' + eq[i]).toBeLessThanOrEqual(loans[i - 1] + EPS);
    }
    expect(loans[loans.length - 1]).toBe(0); // full cash purchase
  });

  it('transaction costs and loan amount follow their definitions', () => {
    const st = withParams({ property_price: 500_000, equity: 120_000, renovation_budget: 20_000, grunderwerbsteuer_rate: 6, notary_rate: 1.5, grundbuch_rate: 0.5, makler_rate: 3.57 });
    const r = runScenario(st);
    const tc = 500_000 * (6 + 1.5 + 0.5 + 3.57) / 100 + 20_000;
    expect(close(r.transactionCosts, tc)).toBe(true);
    expect(close(r.loanAmount, Math.max(0, 500_000 + tc - 120_000))).toBe(true);
  });
});

describe('freed-cash-flow invariant', () => {
  it('when renting is cheaper, investing the difference never hurts the rent branch', () => {
    // deterministic, positive portfolio return: the rent branch receives the
    // monthly cost difference as deposits, so its terminal wealth can only
    // improve relative to the mechanism being switched off.
    const base = withParams({ rent_cold: 1200, expected_return_stocks: 5, expected_return_bonds: 3, horizon_years: 20 });
    const off = runScenario({ ...base, on: { ...base.on, freed_cash_invested: false } });
    const onn = runScenario(base);
    if (off.rentCumCost[off.rentCumCost.length - 1] < off.buyCumCost[off.buyCumCost.length - 1]) {
      expect(onn.nwRent[onn.nwRent.length - 1]).toBeGreaterThanOrEqual(off.nwRent[off.nwRent.length - 1] - 1);
    }
  });
});
