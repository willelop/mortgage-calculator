import { describe, expect, it } from 'vitest';
import { mortgageSchedule, germanAnnuityPayment, yearlyAmortization, annuityPayment } from '../mortgage';

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

describe('mortgageSchedule — repayment shapes (roadmap 2a)', () => {
  const base = {
    loan: 100_000,
    fixedRatePct: 3.6,
    fixedYears: 10,
    followupRatePct: 3.6,
    tilgungPct: 2,
    termYears: 30,
    sondertilgungPct: 0,
    sondertilgungEur: 0,
    months: 360,
  };

  describe('linear (constant principal)', () => {
    it('amortizes loan/term per month; payment declines; fully repaid at term end', () => {
      const res = mortgageSchedule({ ...base, shape: 'linear', tilgungPct: 0 });
      const expectedPrincipal = 100_000 / 360;
      // constant principal in the first months…
      expect(res.principal[0]).toBeCloseTo(expectedPrincipal, 4);
      expect(res.principal[59]).toBeCloseTo(expectedPrincipal, 4);
      // …payment = interest (declining) + constant principal
      expect(res.payment[0]).toBeCloseTo(300 + expectedPrincipal, 4);
      expect(res.payment[1]).toBeLessThan(res.payment[0]);
      expect(res.balance[360]).toBeCloseTo(0, 2);
    });

    it('keeps the constant principal across the fixed-period boundary (no re-anchor)', () => {
      const res = mortgageSchedule({ ...base, shape: 'linear', tilgungPct: 0, followupRatePct: 5.0 });
      expect(res.principal[119]).toBeCloseTo(res.principal[120], 6);
      expect(res.principal[121]).toBeCloseTo(100_000 / 360, 4);
    });
  });

  describe('grace years (Tilgungsfreijahre)', () => {
    it('pays interest only during grace; balance unchanged; re-annuitizes afterwards', () => {
      const res = mortgageSchedule({ ...base, shape: 'grace', graceYears: 5, tilgungPct: 2 });
      // months 0..59: payment == interest, no principal
      expect(res.payment[0]).toBeCloseTo(300, 4);
      expect(res.principal[0]).toBeCloseTo(0, 6);
      expect(res.balance[60]).toBeCloseTo(100_000, 4);
      // month 60 = first amortizing month: annuity over the remaining 25 years
      const expected = (100_000 * (0.036 / 12)) / (1 - Math.pow(1 + 0.036 / 12, -(360 - 60)));
      expect(res.payment[60]).toBeCloseTo(expected, 4);
      expect(res.principal[60]).toBeGreaterThan(0);
      expect(res.balance[360]).toBeCloseTo(0, 2);
    });

    it('grace longer than the fixed period: amortization starts only after grace ends', () => {
      const res = mortgageSchedule({ ...base, shape: 'grace', graceYears: 12, fixedYears: 10, followupRatePct: 5.0, tilgungPct: 3 });
      expect(res.balance[120]).toBeCloseTo(100_000, 4); // still interest-only after the re-fix
      expect(res.payment[120]).toBeGreaterThan(300); // re-annuitized at 5 % over 18y
      expect(res.balance[360]).toBeCloseTo(0, 2);
    });
  });

  describe('bullet (endfällig, interest only)', () => {
    it('balance never shrinks and payment equals interest', () => {
      const res = mortgageSchedule({ ...base, shape: 'bullet', tilgungPct: 0 });
      expect(res.balance[0]).toBeCloseTo(100_000, 4);
      expect(res.balance[360]).toBeCloseTo(100_000, 4);
      for (const m of [0, 119, 120, 359]) {
        expect(res.principal[m]).toBeCloseTo(0, 6);
        expect(res.payment[m]).toBeCloseTo(res.interest[m], 6);
      }
    });

    it('ignores the annuity re-anchor at the fixed-period end', () => {
      const res = mortgageSchedule({ ...base, shape: 'bullet', followupRatePct: 5.0 });
      expect(res.payment[119]).toBeCloseTo(300, 4);
      expect(res.payment[120]).toBeCloseTo(100_000 * (0.05 / 12), 4); // interest at the new rate only
    });

    it('total interest exceeds the annuity shape (compounding drag of no repayment)', () => {
      const annuity = mortgageSchedule(base);
      const bullet = mortgageSchedule({ ...base, shape: 'bullet', tilgungPct: 0 });
      expect(bullet.totalInterest).toBeGreaterThan(annuity.totalInterest);
    });
  });

  it('omitted shape behaves exactly like the annuity default (backward compatibility)', () => {
    const implicit = mortgageSchedule(base);
    const explicit = mortgageSchedule({ ...base, shape: 'annuity' });
    expect(implicit.balance).toEqual(explicit.balance);
    expect(implicit.payment).toEqual(explicit.payment);
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

describe('mortgageSchedule — staged draw / Bereitstellungszinsen (roadmap 2d)', () => {
  const base = {
    loan: 100_000,
    fixedRatePct: 3.6,
    fixedYears: 10,
    followupRatePct: 3.6,
    tilgungPct: 2,
    termYears: 30,
    sondertilgungPct: 0,
    sondertilgungEur: 0,
    months: 360,
  };

  it('draw phase: half the loan accrues interest, undrawn half costs commitment interest', () => {
    const res = mortgageSchedule({ ...base, drawMonths: 12, commitmentRatePct: 3 });
    // balance stays at the drawn half during the draw phase
    expect(res.balance[0]).toBeCloseTo(50_000, 4);
    expect(res.balance[11]).toBeCloseTo(50_000, 4);
    // second half arrives at month 12
    expect(res.balance[12]).toBeCloseTo(100_000, 4);
    // monthly draw-phase payment = interest on drawn half + commitment on undrawn half
    const intM = 50_000 * 0.036 / 12;               // 150
    const commM = 50_000 * 0.03 / 12;               // 125
    expect(res.payment[0]).toBeCloseTo(intM + commM, 4);
    expect(res.interest[0]).toBeCloseTo(intM, 4);
    expect(res.commitment[0]).toBeCloseTo(commM, 4);
    expect(res.principal[0]).toBe(0);               // no amortization during the draw
    // totals: 12 draw-phase months
    expect(res.totalCommitment).toBeCloseTo(12 * commM, 4);
    // after the draw, a normal annuity over the remaining 29 years
    expect(res.payment[13]).toBeCloseTo(annuityPayment(100_000, 0.036 / 12, 348), 4);
    // the loan still amortizes fully over the term
    expect(res.balance[360]).toBeLessThan(1);
  });

  it('draw phase raises total cost vs drawing at once', () => {
    const once = mortgageSchedule(base);
    const staged = mortgageSchedule({ ...base, drawMonths: 12, commitmentRatePct: 3 });
    // interest itself is lower during the draw (smaller balance), but the
    // commitment cost plus the slower post-draw amortization dominate
    const onceCost = once.totalInterest;
    const stagedCost = staged.totalInterest + staged.totalCommitment;
    expect(stagedCost).toBeGreaterThan(onceCost);
  });

  it('commitment rate 0 = no commitment interest, plain interest-only draw phase', () => {
    const res = mortgageSchedule({ ...base, drawMonths: 12, commitmentRatePct: 0 });
    expect(res.commitment[0]).toBe(0);
    expect(res.totalCommitment).toBe(0);
    expect(res.payment[0]).toBeCloseTo(50_000 * 0.036 / 12, 4);
  });

  it('staged draw is ignored for non-annuity shapes (documented behaviour)', () => {
    const lin = mortgageSchedule({ ...base, shape: 'linear', drawMonths: 12, commitmentRatePct: 3 });
    expect(lin.balance[0]).toBeCloseTo(100_000, 4);
    expect(lin.totalCommitment).toBe(0);
  });
});
