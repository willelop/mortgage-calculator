/**
 * German-style mortgage schedule.
 *
 * - Phase 1 (Zinsbindung): annuity with payment = interest on balance + Anfangstilgung
 *   (% of the ORIGINAL loan per year), constant monthly payment.
 * - Phase 2: remaining balance is amortized over the remaining loan term at the
 *   follow-up rate (standard re-fixing behaviour after the fixed period).
 * - Sondertilgung: extra annual repayment (% of original loan + fixed EUR), applied
 *   in December of each year. Payments stop when the balance is repaid.
 */

export interface MortgageResult {
  /** month-end outstanding balance, index = month (index 0 = start) */
  balance: number[];
  /** interest paid in each month */
  interest: number[];
  /** principal repaid in each month (incl. Sondertilgung) */
  principal: number[];
  /** effective money to the bank in each month */
  payment: number[];
  /** Sondertilgung (extra repayment) per month; a slice of `principal` */
  sonder: number[];
  totalInterest: number;
  /** months (0-based) in which scheduled payments occurred */
  paidUntil: number;
}

export interface MortgageInput {
  loan: number;
  fixedRatePct: number;
  fixedYears: number;
  followupRatePct: number;
  tilgungPct: number;
  termYears: number;
  sondertilgungPct: number; // of original loan, per year
  sondertilgungEur: number; // per year
  months: number;
}

export function mortgageSchedule(input: MortgageInput): MortgageResult {
  const {
    loan, fixedRatePct, fixedYears, followupRatePct,
    tilgungPct, termYears, sondertilgungPct, sondertilgungEur, months,
  } = input;

  const balance: number[] = new Array(months + 1);
  const interest: number[] = new Array(months);
  const principal: number[] = new Array(months);
  const payment: number[] = new Array(months);
  const sonder: number[] = new Array(months).fill(0);
  balance[0] = Math.max(0, loan);

  const rFixed = fixedRatePct / 100 / 12;
  const r2 = followupRatePct / 100 / 12;
  const fixedMonths = Math.max(0, Math.round(fixedYears * 12));
  const extraPerYear = (loan * sondertilgungPct) / 100 + sondertilgungEur;

  // German style: payment = monthly interest + monthly share of tilgung on the ORIGINAL loan
  let pay = balance[0] > 0 ? balance[0] * rFixed + (loan * tilgungPct) / 100 / 12 : 0;

  let totalInterest = 0;
  let paidUntil = -1;

  for (let m = 0; m < months; m++) {
    const b = balance[m];
    if (b <= 0.005) {
      balance[m + 1] = 0;
      interest[m] = 0;
      principal[m] = 0;
      payment[m] = 0;
      continue;
    }
    paidUntil = m;

    // Phase transition at the end of the fixed-rate period
    if (m > 0 && m === fixedMonths) {
      const remainingMonths = Math.max(1, termYears * 12 - m);
      pay = annuityPayment(b, r2, remainingMonths);
    }

    const r = m < fixedMonths ? rFixed : r2;
    const int = b * r;
    const princip = Math.min(Math.max(0, pay - int), b);

    interest[m] = int;
    principal[m] = princip;
    payment[m] = princip + int;
    balance[m + 1] = Math.max(0, b - princip);
    totalInterest += int;

    // Sondertilgung in December
    if ((m + 1) % 12 === 0 && extraPerYear > 0 && balance[m + 1] > 0) {
      const e = Math.min(extraPerYear, balance[m + 1]);
      balance[m + 1] -= e;
      principal[m] += e;
      payment[m] += e;
      sonder[m] = e;
    }
  }

  return { balance, interest, principal, payment, sonder, totalInterest, paidUntil };
}

export function annuityPayment(B: number, rm: number, n: number): number {
  if (B <= 0) return 0;
  if (rm <= 0) return B / n;
  return (B * rm) / (1 - Math.pow(1 + rm, -n));
}

/** German convention: monthly payment = interest + tilgung % of the original loan / 12. */
export function germanAnnuityPayment(loan: number, ratePct: number, tilgungPct: number): number {
  return loan * (ratePct / 100 / 12) + (loan * tilgungPct) / 100 / 12;
}

/**
 * Rate surcharge (percentage points) for high loan-to-value, following typical
 * German bank pricing (Beleihungsauslauf):
 *   ≤ 60 % → best rate;  60–80 % → +0.25 pp;  > 80 % → +0.6 pp
 */
export function ltvSurchargePct(ltv: number): number {
  if (ltv > 0.8) return 0.6;
  if (ltv > 0.6) return 0.25;
  return 0;
}

export interface AmortYear {
  /** calendar year index (1-based) */
  year: number;
  /** total effective payments to the bank during the year */
  payment: number;
  interest: number;
  /** regular annuity principal (excl. Sondertilgung) */
  principal: number;
  sondertilgung: number;
  /** outstanding balance at year end */
  balanceEnd: number;
}

/** Aggregate a monthly mortgage schedule into per-year amortization rows. */
export function yearlyAmortization(res: MortgageResult, years: number): AmortYear[] {
  const rows: AmortYear[] = [];
  for (let y = 1; y <= years; y++) {
    const s = (y - 1) * 12;
    const e = Math.min(y * 12, res.interest.length);
    let payment = 0;
    let interest = 0;
    let principal = 0;
    let sondertilgung = 0;
    for (let m = s; m < e; m++) {
      payment += res.payment[m];
      interest += res.interest[m];
      principal += res.principal[m] - res.sonder[m];
      sondertilgung += res.sonder[m];
    }
    rows.push({ year: y, payment, interest, principal, sondertilgung, balanceEnd: res.balance[y * 12] ?? 0 });
  }
  return rows;
}
