import { describe, expect, it } from 'vitest';
import { mortgageSchedule, germanAnnuityPayment, yearlyAmortization } from '../mortgage';

describe('mortgageSchedule — hand-computed reference (100 k€, 3.6 %, 2 % Tilgung)', () => {
  // Payment = 100000 * (0.036/12) + 100000 * 0.02/12 = 300 + 166.67 = 466.67 €/month
  const base = {
    loan: 100_000,
    fixedRatePct: 3.6,
    fixedYears: 10,
    followupRatePct: 3.6, // same, so payment stays
    tilgungPct: 2,
    termYears: 30,
    sondertilgungPct: 0,
    sondertilgungEur: 0,
    months: 360,
  };

  it('has the German-convention initial payment (interest + % of original loan)', () => {
    expect(germanAnnuityPayment(100_000, 3.6, 2)).toBeCloseTo(466.6667, 3);
    const res = mortgageSchedule(base);
    expect(res.payment[0]).toBeCloseTo(466.6667, 3);
  });

  it('amortizes interest-first in month 1', () => {
    const res = mortgageSchedule(base);
    expect(res.interest[0]).toBeCloseTo(300, 4); // 100000 * 0.036/12
    expect(res.principal[0]).toBeCloseTo(466.6667 - 300, 4);
    expect(res.balance[1]).toBeCloseTo(100_000 - 166.6667, 4);
  });

  it('is fully repaid by the end of the term', () => {
    const res = mortgageSchedule(base);
    expect(res.balance[360]).toBeCloseTo(0, 2);
  });

  it('re-anchors the payment at the follow-up rate over the remaining term', () => {
    const res = mortgageSchedule({ ...base, fixedYears: 10, followupRatePct: 5.0 });
    // Payment just before the transition:
    expect(res.payment[118]).toBeCloseTo(466.6667, 2);
    // Payment in month 120 = annuity on the remaining balance, 20y remaining, 5 %:
    const b = res.balance[120];
    const expected = (b * (0.05 / 12)) / (1 - Math.pow(1 + 0.05 / 12, -(360 - 120)));
    expect(res.payment[120]).toBeCloseTo(expected, 4);
    // Fully repaid at term end even with the higher follow-up rate:
    expect(res.balance[360]).toBeCloseTo(0, 0);
  });

  it('Sondertilgung shortens the loan and appears in December payments', () => {
    const a = mortgageSchedule(base);
    const b = mortgageSchedule({ ...base, sondertilgungEur: 5000 });
    expect(a.totalInterest).toBeGreaterThan(b.totalInterest);
    expect(b.payment[11]).toBeCloseTo(a.payment[11] + 5000, 2);
  });

  it('loan of 0 yields no payments', () => {
    const res = mortgageSchedule({ ...base, loan: 0 });
    expect(res.totalInterest).toBe(0);
  });
});

describe('yearlyAmortization', () => {
  const base = {
    loan: 100_000,
    fixedRatePct: 3.6,
    fixedYears: 10,
    followupRatePct: 3.6,
    tilgungPct: 2,
    termYears: 30,
    sondertilgungPct: 0,
    sondertilgungEur: 5000, // extra repayment each December
    months: 360,
  };

  it('aggregates monthly sums per year and splits Sondertilgung out', () => {
    const res = mortgageSchedule(base);
    const rows = yearlyAmortization(res, 30);

    expect(rows).toHaveLength(30);
    const year1 = rows[0];
    // Constant German-style payment → interest falls each month, so the
    // regular principal rises slightly above the nominal 12 × 2 %/12 = 2 000 €.
    expect(year1.principal).toBeGreaterThan(2000);
    expect(year1.principal).toBeLessThan(2100);
    expect(year1.sondertilgung).toBeCloseTo(5000, 2);
    expect(year1.payment).toBeCloseTo(year1.interest + year1.principal + year1.sondertilgung, 2);
    // Balance after year 1 reflects regular principal + Sondertilgung
    expect(year1.balanceEnd).toBeCloseTo(100_000 - year1.principal - year1.sondertilgung, 2);
  });

  it('sum over all years matches the monthly schedule totals', () => {
    const res = mortgageSchedule(base);
    const rows = yearlyAmortization(res, 30);
    const totalPayment = rows.reduce((s, r) => s + r.payment, 0);
    const totalInterest = rows.reduce((s, r) => s + r.interest, 0);
    const monthlyInterest = res.interest.reduce((s, v) => s + v, 0);
    const monthlyPayment = res.payment.reduce((s, v) => s + v, 0);
    expect(totalInterest).toBeCloseTo(monthlyInterest, 4);
    expect(totalPayment).toBeCloseTo(monthlyPayment, 4);
    expect(totalInterest).toBeCloseTo(res.totalInterest, 4);
    // Loan is repaid at the end of the term
    expect(rows[29].balanceEnd).toBeCloseTo(0, 2);
  });
});
