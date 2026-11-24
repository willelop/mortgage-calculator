/**
 * Scenario & Monte-Carlo simulation engine.
 *
 * Core model (monthly resolution, yearly aggregation):
 *
 *  BUY branch
 *    - Equity pays price + transaction costs; any residual equity is invested.
 *    - Mortgage amortizes per mortgageSchedule.
 *    - Recurring costs (Grundsteuer, insurance, maintenance, Hausgeld) are
 *      indexed to inflation.
 *    - Net worth = property value − loan balance + invested portfolio (after
 *      liquidation tax) [− selling costs & §23 tax at horizon if selling].
 *
 *  RENT branch
 *    - Pays rent + Nebenkosten; rent growth per parameter (or CPI-linked).
 *    - The monthly cost difference (own − rent) flows into / out of the
 *      portfolio (if 'invest freed cash flow' is enabled).
 *    - Kaution (3× cold rent) is held as a refundable asset.
 *    - Net worth = portfolio (after liquidation tax) + kaution.
 */

import { ParamState, num, switchOn } from './params';
import { mortgageSchedule, yearlyAmortization, AmortYear } from './mortgage';
import {
  Portfolio, TaxParams, newPortfolio, growMonth, deposit, withdrawGross,
  resetYearAllowance, payableTax,
} from './invest';

export interface YearlyShocks {
  /** per-year gaussian shocks driving lognormal return paths */
  stocks: number[];
  property: number[];
  inflation: number[];
}

export interface ScenarioResult {
  horizon: number;
  /** year labels 0..H */
  years: number[];
  nwBuy: number[];
  nwRent: number[];
  buyPortfolio: number[]; // after liquidation tax
  rentPortfolio: number[]; // after liquidation tax
  propertyValue: number[]; // gross market value
  loanBalance: number[]; // year-end
  kautionValue: number[];
  buyCumCost: number[]; // cumulative money out of pocket
  rentCumCost: number[];
  transactionCosts: number;
  loanAmount: number;
  totalInterest: number;
  /** yearly amortization rows (payment split into interest / principal / Sondertilgung) */
  amortization: AmortYear[];
  terminalDiff: number;
  breakEvenYear: number | null; // first year (label) with nwBuy >= nwRent
  liquidationTaxBuy: number;
  liquidationTaxRent: number;
}

export function runScenario(state: ParamState, shocks?: YearlyShocks): ScenarioResult {
  const v = (k: string) => num(state, k);
  const sw = (k: string) => switchOn(state, k);

  const H = Math.max(1, Math.round(v('horizon_years')));
  const months = H * 12;
  const inflation = v('inflation') / 100;

  // --- Purchase side -------------------------------------------------------
  const price = v('property_price');
  const transactionRate =
    v('grunderwerbsteuer_rate') + v('notary_rate') + v('grundbuch_rate') + v('makler_rate');
  const transactionCosts = (price * transactionRate) / 100 + v('renovation_budget');
  const equity = v('equity');
  const loanAmount = Math.max(0, price + transactionCosts - equity);
  const residualEquity = Math.max(0, equity - price - transactionCosts);

  const mortgage = mortgageSchedule({
    loan: loanAmount,
    fixedRatePct: v('fixed_rate'),
    fixedYears: Math.round(v('fixed_years')),
    followupRatePct: v('followup_rate'),
    tilgungPct: v('initial_tilgung'),
    termYears: Math.round(v('loan_term_years')),
    sondertilgungPct: v('sondertilgung_pct'),
    sondertilgungEur: v('sondertilgung_eur'),
    months,
  });

  // --- Portfolio setup -----------------------------------------------------
  const taxP: TaxParams = {
    taxRate: v('capital_gains_tax_rate') / 100,
    teilfreistellung: v('teilfreistellung_rate') / 100,
    allowance: v('sparerpauschbetrag'),
  };

  const capStocks = num(state, 'capital_stocks');
  const capBonds = num(state, 'capital_bonds');
  const totalCapital = capStocks + capBonds;
  const wStocks = totalCapital > 0 ? capStocks / totalCapital : 1;

  const muStocks = v('expected_return_stocks') / 100;
  const muBonds = v('expected_return_bonds') / 100;
  const sigmaStocks = v('vol_stocks') / 100;
  const sigmaBonds = v('vol_bonds') / 100;

  const gApprec = sw('appreciation_linked_to_inflation') ? inflation : v('property_appreciation') / 100;
  const gRent = sw('rent_increase_linked_to_inflation') ? inflation : v('rent_increase') / 100;
  const sigmaProp = v('vol_property') / 100;
  const sigmaInfl = v('vol_inflation') / 100;

  const kaution0 = 3 * num(state, 'rent_cold');
  const buyPortfolio = newPortfolio(residualEquity);
  const rentPortfolio = newPortfolio(Math.max(0, totalCapital - v('rent_upfront_costs') - kaution0));

  const freedCash = sw('freed_cash_invested');

  // per-year scratch context shared with the month loop below
  const yctx = { rentCostM: 0, recurringM: 0, rBlendM: 0, kaution: 0 };

  /** Deposit or withdraw from a portfolio so the investor's pocket changes by d. */
  const flow = (p: Portfolio, d: number): void => {
    if (d >= 0) {
      deposit(p, d);
    } else {
      const need = -d;
      const gainShare = p.value > 0 ? Math.max(0, 1 - p.basis / p.value) : 0;
      const tEff = gainShare * taxP.taxRate * (1 - taxP.teilfreistellung);
      const gross = tEff < 1 ? need / (1 - tEff) : need;
      withdrawGross(p, gross, taxP);
    }
  };

  // --- Yearly series (row 0 = today, then labels 1..H) ----------------------
  const years: number[] = [0];
  const nwBuy: number[] = [price - loanAmount + (buyPortfolio.value - payableTax(buyPortfolio, taxP))];
  const nwRent: number[] = [rentPortfolio.value - payableTax(rentPortfolio, taxP) + kaution0];
  const buyPortfolioSeries: number[] = [nwBuy[0] - (price - loanAmount)];
  const rentPortfolioSeries: number[] = [nwRent[0] - kaution0];
  const propertyValueSeries: number[] = [price];
  const loanSeries: number[] = [loanAmount];
  const kautionSeries: number[] = [kaution0];
  const buyCumCost: number[] = [0];
  const rentCumCost: number[] = [0];

  let propValue = price;
  let cumBuy = 0;
  let cumRent = 0;

  // --- Monthly loop --------------------------------------------------------
  for (let m = 0; m < months; m++) {
    const y = Math.floor(m / 12);

    if (m % 12 === 0) {
      resetYearAllowance(buyPortfolio);
      resetYearAllowance(rentPortfolio);

      const zs = shocks ? shocks.stocks[y] : 0;
      const zp = shocks ? shocks.property[y] : 0;
      const zi = shocks ? shocks.inflation[y] : 0;

      const annualInfl = (1 + inflation) * shockFactor(sigmaInfl, zi) - 1;
      const propGrow = (1 + gApprec) * shockFactor(sigmaProp, zp) - 1;
      const annualRentGrow = sw('rent_increase_linked_to_inflation')
        ? annualInfl
        : (1 + gRent) * shockFactor(0.01, zi * 0.5) - 1;

      propValue *= 1 + propGrow;

      const costIdx = Math.pow(1 + annualInfl, y);
      // In the deterministic (no-shocks) run use raw expected values; in MC the
      // lognormal factor makes E[wealth growth] ≈ nominal expectation.
      const annualStockRet = (1 + muStocks) * shockFactor(sigmaStocks, zs) - 1;
      const annualBondRet = (1 + muBonds) * shockFactor(sigmaBonds, zs) - 1;
      const rStocksM = Math.pow(1 + annualStockRet, 1 / 12) - 1;
      const rBondsM = Math.pow(1 + annualBondRet, 1 / 12) - 1;
      const rBlendM = wStocks * rStocksM + (1 - wStocks) * rBondsM;

      const rentColdY = num(state, 'rent_cold') * Math.pow(1 + annualRentGrow, y);
      const nebenkostenY = num(state, 'nebenkosten_monthly') * costIdx;
      const recurringMonthly =
        (num(state, 'grundsteuer_annual') * costIdx +
          num(state, 'building_insurance_annual') * costIdx +
          num(state, 'hausgeld_annual') * costIdx +
          (num(state, 'maintenance_rate') / 100) * price * costIdx) / 12;
      const kaution = 3 * rentColdY;

      // stash per-year values for the 12 months of this year (closure vars)
      yctx.rentCostM = rentColdY + nebenkostenY;
      yctx.recurringM = recurringMonthly;
      yctx.rBlendM = rBlendM;
      yctx.kaution = kaution;

      // run 12 months
      for (let mm = m; mm < m + 12 && mm < months; mm++) {
        growMonth(buyPortfolio, yctx.rBlendM);
        growMonth(rentPortfolio, yctx.rBlendM);

        const ownCostM = mortgage.payment[mm] + yctx.recurringM;
        const rentCostM = yctx.rentCostM;
        cumBuy += ownCostM;
        cumRent += rentCostM;

        const d = ownCostM - rentCostM;
        if (freedCash) flow(rentPortfolio, d);
      }

      // year-end row
      const yEnd = y + 1;
      const propAfterSaleReady = propValue;
      const lqBuy = payableTax(buyPortfolio, taxP);
      const lqRent = payableTax(rentPortfolio, taxP);

      years.push(yEnd);
      nwBuy.push(propAfterSaleReady - mortgage.balance[m + 12] + (buyPortfolio.value - lqBuy));
      nwRent.push(rentPortfolio.value - lqRent + yctx.kaution);
      buyPortfolioSeries.push(buyPortfolio.value - lqBuy);
      rentPortfolioSeries.push(rentPortfolio.value - lqRent);
      propertyValueSeries.push(propAfterSaleReady);
      loanSeries.push(mortgage.balance[m + 12]);
      kautionSeries.push(yctx.kaution);
      buyCumCost.push(cumBuy);
      rentCumCost.push(cumRent);
    }
  }

  // Terminal adjustment: sell the property at the horizon
  const last = nwBuy.length - 1;
  if (sw('sell_at_horizon') && H >= 1) {
    const saleValue = propValue;
    const sellingCosts = (saleValue * v('selling_costs_rate')) / 100;
    const gain = saleValue - price;
    const exempt = H >= 10 || !sw('capital_gains_tax_before_10y') || gain <= 0;
    const tax = exempt ? 0 : gain * taxP.taxRate;
    const proceeds = saleValue - sellingCosts - tax;
    nwBuy[last] = nwBuy[last] - saleValue + proceeds;
  }

  let breakEvenYear: number | null = null;
  for (let i = 1; i < years.length; i++) {
    if (nwBuy[i] >= nwRent[i]) {
      breakEvenYear = years[i];
      break;
    }
  }

  return {
    horizon: H,
    years,
    nwBuy,
    nwRent,
    buyPortfolio: buyPortfolioSeries,
    rentPortfolio: rentPortfolioSeries,
    propertyValue: propertyValueSeries,
    loanBalance: loanSeries,
    kautionValue: kautionSeries,
    buyCumCost,
    rentCumCost,
    transactionCosts,
    loanAmount,
    totalInterest: mortgage.totalInterest,
    amortization: yearlyAmortization(mortgage, H),
    terminalDiff: nwBuy[last] - nwRent[last],
    breakEvenYear,
    liquidationTaxBuy: payableTax(buyPortfolio, taxP),
    liquidationTaxRent: payableTax(rentPortfolio, taxP),
  };
}

/** Normal(0,1) shock → lognormal multiplier with E[factor] = 1 per year.
 *  With z = 0 (deterministic run) the factor is 1, so the nominal path uses
 *  the raw expected return — not the median of the stochastic path. */
export function shockFactor(sigma: number, z: number): number {
  if (z === 0 || sigma <= 0) return 1;
  return Math.exp(sigma * z - (sigma * sigma) / 2);
}
