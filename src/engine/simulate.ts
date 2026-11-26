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
 *    - Kaution (3× cold rent) is held as a refundable asset; increases are
 *      funded out of pocket each January (like the owner's maintenance).
 *    - Net worth = portfolio (after liquidation tax) + kaution.
 */

import { ParamState, num, switchOn } from './params';
import { mortgageSchedule, yearlyAmortization, AmortYear, ltvSurchargePct, effectiveRatePct } from './mortgage';
import {
  Portfolio, TaxParams, newPortfolio, growMonth, deposit, withdrawGross,
  resetYearAllowance, payableTax, vorabpauschaleTax,
} from './invest';

export interface YearlyShocks {
  /** per-year gaussian shocks driving lognormal return paths */
  stocks: number[];
  property: number[];
  inflation: number[];
  /** per-year independent gaussian shock for bonds/savings; defaults to 0
   *  (deterministic) when absent — intentionally *not* the stock shock */
  bonds: number[];
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
  /** loan-to-price ratio (Beleihungsauslauf ≈ loan / purchase price) */
  ltv: number;
  /** rate surcharge applied (percentage points on fixed + follow-up rate) */
  ltvSurcharge: number;
  /** outstanding balance at the end of the Zinsbindung (or horizon if shorter) */
  restschuldAtFixation: number;
  /** year index of the fixed-rate period end used for restschuldAtFixation */
  fixationYear: number;
  /** true when repayment was defined via a desired monthly payment */
  paymentMode: boolean;
  /** effective Anfangstilgung actually used (% of original loan p.a.; derived in payment mode) */
  effectiveTilgungPct: number;
  /** effective initial monthly payment to the bank during the fixed period */
  effectiveMonthlyPayment: number;
  /** effective annual fixed rate incl. LTV surcharge and Disagio (equals the nominal rate when no Disagio) */
  effectiveFixedRatePct: number;
  /** contractual (nominal) annual fixed rate incl. LTV surcharge, before Disagio */
  nominalFixedRatePct: number;
  totalInterest: number;
  /** yearly amortization rows (payment split into interest / principal / Sondertilgung) */
  amortization: AmortYear[];
  terminalDiff: number;
  breakEvenYear: number | null; // first year (label) with nwBuy >= nwRent
  liquidationTaxBuy: number;
  liquidationTaxRent: number;
}

// Energy-class maintenance surcharge (roadmap 2e): pp of price per year, classes A..H
const ENERGY_SURCHARGE_PP = [0, 0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6];

/** One-off purchase transaction costs (Grunderwerbsteuer, Notar, Grundbuch, Makler, renovation). */
export function transactionCostsFor(state: ParamState): number {
  const price = num(state, 'property_price');
  const rate =
    num(state, 'grunderwerbsteuer_rate') + num(state, 'notary_rate') +
    num(state, 'grundbuch_rate') + num(state, 'makler_rate');
  return (price * rate) / 100 + num(state, 'renovation_budget');
}

/** Loan needed for the purchase (price + transaction costs − equity), grossed up
 *  by the Disagio: the bank disburses only (1 − Disagio) of the nominal loan, so
 *  the shortfall is financed within the loan itself. */
export function loanAmountFor(state: ParamState): number {
  const base = Math.max(0, num(state, 'property_price') + transactionCostsFor(state) - num(state, 'equity'));
  const disagio = Math.min(Math.max(num(state, 'disagio_pct'), 0), 95) / 100;
  return disagio > 0 ? base / (1 - disagio) : base;
}

export function runScenario(state: ParamState, shocks?: YearlyShocks): ScenarioResult {
  const v = (k: string) => num(state, k);
  const sw = (k: string) => switchOn(state, k);

  const H = Math.max(1, Math.round(v('horizon_years')));
  const months = H * 12;
  const inflation = v('inflation') / 100;

  // --- Purchase side -------------------------------------------------------
  const price = v('property_price');
  const transactionCosts = transactionCostsFor(state);
  const equity = v('equity');
  const loanBase = Math.max(0, price + transactionCosts - equity);
  // Disagio: bank pays out only (1 − d) of the nominal loan; the shortfall is
  // financed within the loan (borrower owes and pays interest on the full amount).
  const disagioPct = Math.min(Math.max(v('disagio_pct'), 0), 95);
  const loanAmount = disagioPct > 0 ? loanBase / (1 - disagioPct / 100) : loanBase;
  const residualEquity = Math.max(0, equity - price - transactionCosts);

  // LTV-based rate surcharge (Beleihungsauslauf pricing)
  const ltv = loanAmount / Math.max(1, price);
  const ltvSurcharge = sw('ltv_rate_surcharge') ? ltvSurchargePct(ltv) : 0;

  const effFixedRatePct = v('fixed_rate') + ltvSurcharge;

  // Initial repayment: directly as % p.a., or derived from a desired monthly payment
  const shapeNum = Math.round(v('tilgung_shape') ?? 0);
  const shape = (['annuity', 'linear', 'grace', 'bullet'] as const)[shapeNum] ?? 'annuity';
  const paymentMode = shapeNum === 0 && Math.round(v('tilgung_mode')) === 1;
  let tilgungPct = v('initial_tilgung');
  if (paymentMode && loanAmount > 0) {
    const mp = v('monthly_payment');
    const interestOnly = (loanAmount * effFixedRatePct) / 100 / 12;
    // payment − interest = amortization; expressed as % of the original loan p.a.
    tilgungPct = mp > interestOnly ? ((mp - interestOnly) * 12) / loanAmount * 100 : 0;
  }
  // Display value of the effective Anfangstilgung for non-annuity shapes
  const termYears = Math.round(v('loan_term_years'));
  if (shapeNum === 1) tilgungPct = termYears > 0 ? 100 / termYears : 0; // linear: constant principal
  if (shapeNum === 3) tilgungPct = 0; // bullet: no amortization

  const mortgage = mortgageSchedule({
    loan: loanAmount,
    fixedRatePct: effFixedRatePct,
    fixedYears: Math.round(v('fixed_years')),
    followupRatePct: v('followup_rate') + ltvSurcharge,
    tilgungPct,
    termYears,
    sondertilgungPct: v('sondertilgung_pct'),
    sondertilgungEur: v('sondertilgung_eur'),
    months,
    shape,
    graceYears: Math.round(v('grace_years') ?? 5),
    drawMonths: Math.round(v('draw_months') ?? 0),
    commitmentRatePct: v('bereitstellung_pct'),
  });

  const fixedMonths = Math.max(0, Math.round(v('fixed_years')) * 12);
  const fixationYear = Math.min(Math.round(v('fixed_years')), H);
  const restschuldAtFixation = mortgage.balance[Math.min(fixedMonths, months)];
  // Effective fixed rate incl. Disagio (IRR: disbursement vs payments + Restschuld
  // at the end of the fixed period; only computed for the annuity shape).
  const effectiveFixedRatePct =
    shapeNum === 0 && loanAmount > 0 && disagioPct > 0
      ? effectiveRatePct(loanAmount * (1 - disagioPct / 100), mortgage.payment[0], restschuldAtFixation, fixedMonths)
      : effFixedRatePct;

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
  const yctx = { rentCostM: 0, recurringM: 0, rBlendM: 0, kaution: kaution0 };

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

  // cumulative index factors (correct compounding across shocked years)
  let costIdx = 1;
  let rentIdx = 1;
  let hausgeldIdx = 1; // cumulative Hausgeld index (mode-dependent)
  // portfolio values at the start of the previous calendar year (for the Vorabpauschale)
  let prevYearStartVal: { buy: number; rent: number } | null = null;

  // --- Monthly loop --------------------------------------------------------
  for (let m = 0; m < months; m++) {
    const y = Math.floor(m / 12);

    if (m % 12 === 0) {
      // Vorabpauschale for the previous calendar year (assessed each January):
      // only from the second year on — a fund sold within its first year pays
      // no prepayment tax. Sparerpauschbetrag stays reserved for liquidation.
      if (sw('vorabpauschale') && y >= 1 && prevYearStartVal !== null) {
        vorabpauschaleTax(buyPortfolio, taxP, prevYearStartVal.buy);
        vorabpauschaleTax(rentPortfolio, taxP, prevYearStartVal.rent);
      }
      resetYearAllowance(buyPortfolio);
      resetYearAllowance(rentPortfolio);

      const zs = shocks ? shocks.stocks[y] : 0;
      const zp = shocks ? shocks.property[y] : 0;
      const zi = shocks ? shocks.inflation[y] : 0;
      const zb = shocks ? (shocks.bonds?.[y] ?? 0) : 0;

      const annualInfl = (1 + inflation) * shockFactor(sigmaInfl, zi) - 1;
      const propGrow = (1 + gApprec) * shockFactor(sigmaProp, zp) - 1;
      const annualRentGrow = sw('rent_increase_linked_to_inflation')
        ? annualInfl
        : (1 + gRent) * shockFactor(0.01, zi * 0.5) - 1;

      propValue *= 1 + propGrow;

      // Yearly cumulative index factors: costs and rent are indexed by the
      // *product* of each year's grown factor, so a one-year shock moves only
      // that year's level forward (not `pow(current rate, years passed)`).
      costIdx *= 1 + annualInfl;
      rentIdx *= 1 + annualRentGrow;
      // In the deterministic (no-shocks) run use raw expected values; in MC the
      // lognormal factor makes E[wealth growth] ≈ nominal expectation.
      const annualStockRet = (1 + muStocks) * shockFactor(sigmaStocks, zs) - 1;
      const annualBondRet = (1 + muBonds) * shockFactor(sigmaBonds, zb) - 1;
      const rStocksM = Math.pow(1 + annualStockRet, 1 / 12) - 1;
      const rBondsM = Math.pow(1 + annualBondRet, 1 / 12) - 1;
      const rBlendM = wStocks * rStocksM + (1 - wStocks) * rBondsM;

      const rentColdY = num(state, 'rent_cold') * rentIdx;
      const nebenkostenY = num(state, 'nebenkosten_monthly') * costIdx;
      const hgMode = Math.round(num(state, 'hausgeld_indexation'));
      if (hgMode === 0) hausgeldIdx = costIdx;             // tracks inflation (incl. shocks)
      else if (hgMode === 2) hausgeldIdx *= 1 + num(state, 'hausgeld_index_rate') / 100;
      // Energy-class maintenance surcharge (roadmap 2e): A/B 0 → H +0.6 pp of price
      const energySurchargePct =
        sw('energy_upkeep') ? (ENERGY_SURCHARGE_PP[Math.round(v('energy_class'))] ?? 0) : 0;
      const recurringMonthly =
        (num(state, 'grundsteuer_annual') * costIdx +
          num(state, 'building_insurance_annual') * costIdx +
          num(state, 'hausgeld_annual') * (hgMode === 1 ? 1 : hausgeldIdx) +
          (num(state, 'maintenance_rate') / 100) * price * costIdx +
          (energySurchargePct / 100) * price * costIdx) / 12;
      const kaution = 3 * rentColdY;

      // Kaution top-up: when rent grows, the deposit must be topped up to
      // 3× the new cold rent — funded out of pocket, exactly like the buy
      // branch funds its lump-sum maintenance (and refunded if it shrinks).
      const kautionDelta = kaution - yctx.kaution;
      if (kautionDelta !== 0) {
        cumRent += kautionDelta;
        flow(rentPortfolio, -kautionDelta);
      }

      // lump-sum maintenance event (roof, heating…) — paid by the owner
      const lumpYear = Math.round(num(state, 'maintenance_lump_year'));
      const lumpAmount = num(state, 'maintenance_lump_amount');
      const lumpNow = lumpAmount > 0 && y + 1 === lumpYear;
      if (lumpNow) {
        cumBuy += lumpAmount;
        flow(buyPortfolio, -lumpAmount);
      }

      // stash per-year values for the 12 months of this year (closure vars)
      yctx.rentCostM = rentColdY + nebenkostenY;
      yctx.recurringM = recurringMonthly;
      yctx.rBlendM = rBlendM;
      yctx.kaution = kaution;

      // year-start portfolio values — the Vorabpauschale base for this year,
      // applied at the start of the *next* year's block
      prevYearStartVal = { buy: buyPortfolio.value, rent: rentPortfolio.value };

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
    ltv,
    ltvSurcharge,
    restschuldAtFixation,
    fixationYear,
    paymentMode,
    effectiveTilgungPct: tilgungPct,
    effectiveMonthlyPayment: mortgage.payment[0],
    effectiveFixedRatePct,
    nominalFixedRatePct: effFixedRatePct,
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
