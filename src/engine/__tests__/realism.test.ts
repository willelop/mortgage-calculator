import { describe, expect, it } from 'vitest';
import { ltvSurchargePct } from '../mortgage';
import { loanAmountFor, runScenario, transactionCostsFor } from '../simulate';
import { runMonteCarlo, McCancelled } from '../monte-carlo';
import { defaultState } from '../params';

describe('ltvSurchargePct — Beleihungsauslauf bands', () => {
  it('charges nothing at low LTV', () => {
    expect(ltvSurchargePct(0.5)).toBe(0);
    expect(ltvSurchargePct(0.6)).toBe(0);
  });
  it('charges +0.25 pp between 60 % and 80 %', () => {
    expect(ltvSurchargePct(0.7)).toBeCloseTo(0.25, 6);
    expect(ltvSurchargePct(0.8)).toBeCloseTo(0.25, 6);
  });
  it('charges +0.6 pp above 80 %', () => {
    expect(ltvSurchargePct(0.9001)).toBeCloseTo(0.6, 6);
  });
});

describe('purchase cost helpers', () => {
  it('transactionCostsFor matches the rate sum + renovation', () => {
    const state = defaultState();
    const price = state.values['property_price'];
    expect(transactionCostsFor(state)).toBeCloseTo(
      price * (5 + 1.5 + 0.5 + 3.57) / 100 + state.values['renovation_budget'],
      4,
    );
  });

  it('loanAmountFor = price + transaction costs − equity (floored at 0)', () => {
    const state = defaultState(); // 500 k€ + ~62.85 k€ costs − 150 k€ equity
    const expected = state.values['property_price'] + transactionCostsFor(state) - state.values['equity'];
    expect(loanAmountFor(state)).toBeCloseTo(expected, 2);
    state.values['equity'] = 2_000_000;
    expect(loanAmountFor(state)).toBe(0);
  });
});

describe('scenario realism features', () => {
  const state = defaultState();

  it('reports Restschuld at the end of the Zinsbindung (LTV surcharge defaults ON)', () => {
    const res = runScenario(state);
    expect(res.ltvSurcharge).toBeGreaterThan(0); // default 500k/150k-equity → LTV > 80 %
    expect(res.fixationYear).toBe(10);
    // Year-end loan balance at year 10 must equal the reported Restschuld
    expect(res.restschuldAtFixation).toBeCloseTo(res.loanBalance[10], 2);
    expect(res.restschuldAtFixation).toBeGreaterThan(0);
    expect(res.restschuldAtFixation).toBeLessThan(res.loanAmount);
  });

  it('LTV surcharge raises monthly cost when switched on, off when disabled', () => {
    const on = runScenario(state);
    const off = runScenario({ ...state, values: { ...state.values, ltv_rate_surcharge: 0 } });
    expect(on.ltvSurcharge).toBeGreaterThan(off.ltvSurcharge);
    expect(on.totalInterest).toBeGreaterThan(off.totalInterest);
    expect(off.ltvSurcharge).toBe(0);
  });

  it('applies the lump-sum maintenance event to the buy branch only', () => {
    const plain = runScenario(state);
    const withLump = runScenario({
      ...state,
      values: { ...state.values, maintenance_lump_amount: 20_000, maintenance_lump_year: 5 },
      on: { ...state.on, maintenance_lump_amount: true },
    });
    // cumulative buy cost in year 5 jumps by exactly the lump amount vs year 4
    expect(withLump.buyCumCost[5] - withLump.buyCumCost[4]).toBeCloseTo(
      plain.buyCumCost[5] - plain.buyCumCost[4] + 20_000,
      4,
    );
    // rent branch untouched
    expect(withLump.rentCumCost).toEqual(plain.rentCumCost);
    // total buy cost at horizon is exactly 20 k€ higher
    const H = plain.horizon;
    expect(withLump.buyCumCost[H] - plain.buyCumCost[H]).toBeCloseTo(20_000, 4);
  });

  it('applies no lump event when the event year is beyond the horizon', () => {
    const plain = runScenario(state);
    const withLump = runScenario({
      ...state,
      values: { ...state.values, maintenance_lump_amount: 20_000, maintenance_lump_year: 50 },
      on: { ...state.on, maintenance_lump_amount: true },
    });
    expect(withLump.buyCumCost).toEqual(plain.buyCumCost);
  });
});

describe('repayment mode — Anfangstilgung vs desired monthly payment', () => {
  const state = defaultState();
  const loan = loanAmountFor(state);
  const surcharge = state.values['ltv_rate_surcharge'] ? ltvSurchargePct(loan / state.values['property_price']) : 0;
  const ratePct = state.values['fixed_rate'] + surcharge;
  // monthly payment equivalent to 2 % Anfangstilgung
  const mp2 = (loan * ratePct) / 100 / 12 + (loan * 2) / 100 / 12;

  it('payment mode with the equivalent payment reproduces the tilgung-mode schedule', () => {
    const viaTilgung = runScenario(state);
    const viaPayment = runScenario({
      ...state,
      values: { ...state.values, tilgung_mode: 1, monthly_payment: mp2 },
    });
    expect(viaPayment.paymentMode).toBe(true);
    expect(viaPayment.effectiveTilgungPct).toBeCloseTo(2, 6);
    expect(viaPayment.effectiveMonthlyPayment).toBeCloseTo(mp2, 4);
    // same loan path → same interest and end balance
    expect(Math.abs(viaPayment.totalInterest - viaTilgung.totalInterest)).toBeLessThan(1);
    expect(Math.abs(
      viaPayment.loanBalance[viaPayment.loanBalance.length - 1] -
      viaTilgung.loanBalance[viaTilgung.loanBalance.length - 1],
    )).toBeLessThan(50);
  });

  it('a payment below the initial interest yields zero amortization during the fixed period', () => {
    const res = runScenario({
      ...state,
      values: { ...state.values, tilgung_mode: 1, monthly_payment: 1_000 },
    });
    expect(res.effectiveTilgungPct).toBe(0);
    // balance stays flat through the whole Zinsbindung…
    expect(res.loanBalance[1]).toBeCloseTo(res.loanBalance[10], 2);
    expect(res.loanBalance[10]).toBeCloseTo(loan, 2);
    // …the payment is capped at interest-only…
    expect(res.effectiveMonthlyPayment).toBeCloseTo((loan * ratePct) / 100 / 12, 2);
    // …and afterwards the follow-up annuity amortizes over the remaining term.
    expect(res.loanBalance[res.loanBalance.length - 1]).toBeLessThan(loan);
  });
});

describe('Monte Carlo cancellation', () => {
  it('aborts when shouldCancel returns true', () => {
    const state = defaultState();
    expect(() =>
      runMonteCarlo(state, { runs: 100, seed: 1, shouldCancel: () => true }),
    ).toThrow(McCancelled);
  });

  it('completes normally when never cancelled', () => {
    const state = defaultState();
    const res = runMonteCarlo(state, { runs: 50, seed: 1 });
    expect(res.runs).toBe(50);
  });
});
