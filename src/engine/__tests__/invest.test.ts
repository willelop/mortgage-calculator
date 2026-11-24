import { describe, expect, it } from 'vitest';
import {
  newPortfolio, growMonth, deposit, withdrawGross, payableTax, resetYearAllowance,
} from '../invest';

const tp = { taxRate: 0.26375, teilfreistellung: 0.15, allowance: 1000 };

describe('invest — tax-aware portfolio', () => {
  it('grows monthly at the given rate', () => {
    const p = newPortfolio(10_000);
    growMonth(p, 0.01);
    expect(p.value).toBeCloseTo(10_100, 6);
  });

  it('deposits raise value and basis 1:1', () => {
    const p = newPortfolio(10_000);
    deposit(p, 2500);
    expect(p.value).toBe(12_500);
    expect(p.basis).toBe(12_500);
  });

  it('withdraws proportional-gain tax — hand-computed case', () => {
    // value 20 000, basis 10 000 → gain share 0.5.
    // Withdraw 10 000 gross: gain realized 5 000.
    // tax = 5000 * 0.26375 * (1 - 0.15) = 5000*0.26375*0.85 = 1120.9375
    // allowance 1000 applies: tax = 120.9375
    // net received = 10000 - 120.9375 = 9879.0625
    const p = newPortfolio(20_000);
    p.basis = 10_000;
    const net = withdrawGross(p, 10_000, tp);
    expect(net).toBeCloseTo(10_000 - 120.9375, 4);
    expect(p.allowanceUsed).toBeCloseTo(1000, 4);
    expect(p.value).toBeCloseTo(10_000, 4);
  });

  it('allowance is consumed only once per year', () => {
    const p = newPortfolio(20_000);
    p.basis = 10_000;
    withdrawGross(p, 10_000, tp);
    // second withdrawal in same year gets no allowance:
    // value now 10 000, basis = 10000 - 10000*0.5 = 5000 → gain share 0.5
    const net2 = withdrawGross(p, 5000, tp);
    const tax2 = 2500 * 0.26375 * 0.85; // 561.890625
    expect(net2).toBeCloseTo(5000 - tax2, 4);
  });

  it('allowance resets each year', () => {
    const p = newPortfolio(20_000);
    p.basis = 10_000;
    resetYearAllowance(p); // noop on used=0 but checks the API
    growMonth(p, 0);
    resetYearAllowance(p);
    p.allowanceUsed = 1000;
    resetYearAllowance(p);
    expect(p.allowanceUsed).toBe(0);
  });

  it('payableTax computes liquidation tax', () => {
    const p = newPortfolio(20_000);
    p.basis = 10_000;
    // gain 10000, tax = 10000*0.26375*0.85 = 2241.875, allowance leaves 1000 → 1241.875
    expect(payableTax(p, tp)).toBeCloseTo(2241.875 - 1000, 4);
  });

  it('withdraw more than basis has no negative-gain weirdness', () => {
    const p = newPortfolio(5_000); // no gains
    const net = withdrawGross(p, 5_000, tp);
    expect(net).toBeCloseTo(5_000, 4);
  });
});
