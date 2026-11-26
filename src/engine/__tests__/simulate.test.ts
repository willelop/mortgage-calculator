import { describe, expect, it } from 'vitest';
import { defaultState } from '../params';
import { runScenario, loanAmountFor } from '../simulate';

describe('runScenario — smoke & invariants', () => {
  it('returns H+1 yearly rows labelled 0..H', () => {
    const res = runScenario(defaultState()); // H=25
    expect(res.nwBuy).toHaveLength(26);
    expect(res.years[0]).toBe(0);
    expect(res.years[25]).toBe(25);
  });

  it('buying outright with a free home beats paying high rent forever', () => {
    // equity = price → no loan; recurring costs off; rent very high
    const s = defaultState();
    s.values.equity = 500_000;
    s.values.grunderwerbsteuer_rate = 0;
    s.values.notary_rate = 0;
    s.values.grundbuch_rate = 0;
    s.values.makler_rate = 0;
    s.values.renovation_budget = 0;
    s.on.grunderwerbsteuer_rate = false;
    s.on.notary_rate = false;
    s.on.grundbuch_rate = false;
    s.on.makler_rate = false;
    s.on.renovation_budget = false;
    s.values.rent_cold = 30_000;
    s.values.capital_stocks = 40_000;
    s.values.capital_bonds = 15_000;
    const res = runScenario(s);
    expect(res.terminalDiff).toBeGreaterThan(0);
    expect(res.loanAmount).toBe(0);
  });

  it('free housing beats any investment for the tenant of a 0-rent flat', () => {
    const s = defaultState();
    s.values.equity = 0; // can still "buy" with 100 % loan? no: loan = price+costs
    // keep defaults except rent = 0 and capital small:
    s.values.rent_cold = 200; // cheap
    s.values.expected_return_stocks = 30; // absurd stock returns
    const res = runScenario(s);
    // renting should comfortably win at the horizon
    expect(res.terminalDiff).toBeLessThan(0);
  });

  it('t=0 rows are consistent: buy net worth = equity − transaction costs', () => {
    const s = defaultState();
    s.values.equity = 200_000;
    const res = runScenario(s);
    expect(res.nwBuy[0]).toBeCloseTo(200_000 - res.transactionCosts, 0);
  });

  it('2 % Disagio grosses up the loan and raises the effective rate', () => {
    const s = defaultState();
    s.values.disagio_pct = 2;
    const base = defaultState();
    const baseLoan = loanAmountFor(base); // no Disagio
    const loan = loanAmountFor(s);
    // bank disburses loan × (1 − 0.02) = exactly the no-Disagio loan amount
    expect(loan).toBeCloseTo(baseLoan / (1 - 0.02), 4);
    const res = runScenario(s);
    expect(res.loanAmount).toBeCloseTo(loan, 4);
    // t=0 buy net worth = equity − costs − the Disagio fee (borrower owes the grossed-up loan)
    expect(res.nwBuy[0]).toBeCloseTo(defaultState().values.equity - res.transactionCosts - loan * 0.02, 0);
    // effective rate strictly above the nominal rate (annuity, fixed 10y)
    expect(res.effectiveFixedRatePct).toBeGreaterThan(res.nominalFixedRatePct);
    // IRR check: payments + Restschuld discounted at the effective rate = disbursed amount
    const n = Math.round(defaultState().values.fixed_years) * 12;
    const rm = res.effectiveFixedRatePct / 100 / 12;
    const disbursed = loan * (1 - 0.02);
    let npv = 0;
    for (let k = 1; k <= n; k++) npv += res.effectiveMonthlyPayment / Math.pow(1 + rm, k);
    npv += res.restschuldAtFixation / Math.pow(1 + rm, n);
    expect(npv).toBeCloseTo(disbursed, -1);
    // no Disagio → rates coincide
    const noD = runScenario(base);
    expect(noD.effectiveFixedRatePct).toBeCloseTo(noD.nominalFixedRatePct, 9);
  });

  it('kaution is included in the rent branch at t=0', () => {
    const s = defaultState();
    const res = runScenario(s);
    const kaution = 3 * s.values.rent_cold;
    const expected =
      s.values.capital_stocks + s.values.capital_bonds - s.values.rent_upfront_costs;
    expect(res.nwRent[0]).toBeCloseTo(expected, 4);
    expect(res.kautionValue[0]).toBeCloseTo(kaution, 4);
  });

  it('§23: sale within 10 years applies gains tax when enabled', () => {
    const base = () => {
      const s = defaultState();
      s.values.horizon_years = 5;
      s.values.property_appreciation = 10; // big gain
      s.values.equity = 1_000_000; // no loan
      s.values.rent_cold = 30_000; // renting loses → property branch dominates anyway
      return s;
    };
    const withTax = base();
    withTax.values.capital_gains_tax_before_10y = 1;
    const withoutTax = base();
    withoutTax.values.capital_gains_tax_before_10y = 0;

    const r1 = runScenario(withTax);
    const r2 = runScenario(withoutTax);
    // with tax, the final sell reduces terminal value more
    expect(r1.nwBuy[r1.nwBuy.length - 1]).toBeLessThan(r2.nwBuy[r2.nwBuy.length - 1]);
  });
});
