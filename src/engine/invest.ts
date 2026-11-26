/**
 * Tax-aware investment portfolio (German Abgeltungsteuer model, simplified).
 *
 * - Tracks portfolio value and cost basis.
 * - Withdrawals realize a proportional share of gains and pay capital-gains tax
 *   (minus Teilfreistellung and the annual Sparerpauschbetrag).
 * - `payableTax()` computes the liquidation tax due if the whole portfolio were
 *   cashed out — used to report net worth comparable across branches.
 */

export interface Portfolio {
  value: number; // gross market value
  basis: number; // cost basis of remaining units
  allowanceUsed: number; // Sparerpauschbetrag consumed this year
}

export interface TaxParams {
  taxRate: number; // e.g. 0.26375
  teilfreistellung: number; // e.g. 0.15 (share of gains exempt)
  allowance: number; // e.g. 1000 €/year
}

export function newPortfolio(initial: number): Portfolio {
  return { value: Math.max(0, initial), basis: Math.max(0, initial), allowanceUsed: 0 };
}

/** Apply one month of growth at nominal monthly return. */
export function growMonth(p: Portfolio, monthlyReturn: number): void {
  if (p.value > 0 && monthlyReturn !== 0) p.value *= 1 + monthlyReturn;
}

/** Deposit cash; increases value and basis 1:1. */
export function deposit(p: Portfolio, amount: number): void {
  if (amount > 0) {
    p.value += amount;
    p.basis += amount;
  }
}

/**
 * Withdraw a gross amount (reduces value by `gross`). Realizes proportional
 * gains, pays tax (With allowance), and returns the net amount the investor
 * receives: gross − tax.
 */
export function withdrawGross(p: Portfolio, gross: number, tp: TaxParams): number {
  const w = Math.min(gross, p.value);
  if (w <= 0) return 0;
  const gainShare = p.value > 0 ? Math.max(0, 1 - p.basis / p.value) : 0;
  const grossGain = w * gainShare;
  const tax = taxed(grossGain, tp, p);
  p.value -= w;
  p.basis = Math.max(0, p.basis - w * (1 - gainShare));
  return w - tax;
}

/** Tax due on `gain`, applying Teilfreistellung + remaining Sparerpauschbetrag. */
function taxed(gain: number, tp: TaxParams, p: Portfolio): number {
  let tax = gain * tp.taxRate * (1 - tp.teilfreistellung);
  const allowanceLeft = Math.max(0, tp.allowance - p.allowanceUsed);
  const used = Math.min(tax, allowanceLeft);
  p.allowanceUsed += used;
  return Math.max(0, tax - used);
}

/** Reset the yearly allowance (each January). */
export function resetYearAllowance(p: Portfolio): void {
  p.allowanceUsed = 0;
}

/**
 * Basiszins for the Vorabpauschale (§ 2 (4) InvStG): set by the BMF each
 * January, currently ~2.5 % p.a. Update this constant when the BMF publishes
 * a new value — it is a deliberate simplification to keep the engine pure.
 */
export const BASISZINS = 0.0255;

/**
 * Annual Vorabpauschale (prepayment tax, § 18 InvStG, simplified):
 * Basisertrag = start-of-year value × Basiszins × 70 %; the taxable
 * Vorabpauschale is the smaller of that and the actual gain of the year
 * (0 on losses). Tax is levied on the taxable share with Teilfreistellung
 * applied; the Sparerpauschbetrag is NOT consumed here — it stays available
 * for the liquidation tax (conservative simplification). The tax is deducted
 * from the portfolio value and returned for reporting.
 */
export function vorabpauschaleTax(p: Portfolio, tp: TaxParams, startValue: number): number {
  if (startValue <= 0 || p.value <= startValue) return 0;
  const basisertrag = startValue * BASISZINS * 0.7;
  const vorab = Math.min(basisertrag, p.value - startValue);
  const tax = vorab * tp.taxRate * (1 - tp.teilfreistellung);
  p.value = Math.max(0, p.value - tax);
  return tax;
}

/** Final tax if the whole portfolio were liquidated now. */
export function payableTax(p: Portfolio, tp: TaxParams): number {
  const gain = Math.max(0, p.value - p.basis);
  return taxed(gain, tp, { value: 0, basis: 0, allowanceUsed: p.allowanceUsed } as Portfolio);
}
