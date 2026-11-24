/**
 * Parameter registry — the single source of truth for every input of the model.
 *
 * Every parameter is:
 *  - toggleable (contributes 0 to the model when disabled), unless `toggleable: false`
 *  - enrollable into the Monte Carlo simulation with a variability range + distribution
 *
 * Kinds:
 *  - 'eur'   : Euro amounts
 *  - 'mrate' : EUR/month
 *  - 'pct'   : percent per year (stored as e.g. 5.0 meaning 5.0 %)
 *  - 'count' : plain number
 *  - 'switch': 0/1 checkbox
 *  - 'ratio' : correlation coefficient in [-1, 1]
 */

export type Group =
  | 'global'
  | 'purchase'
  | 'mortgage'
  | 'rent'
  | 'invest'
  | 'appreciation'
  | 'correlations';

export type Kind = 'eur' | 'mrate' | 'pct' | 'count' | 'switch' | 'ratio';

export type CorrTag = 'stocks' | 'property' | 'inflation';

export interface ParamDef {
  key: string;
  label: string;
  group: Group;
  kind: Kind;
  default: number;
  min?: number;
  max?: number;
  step?: number;
  /** false => always part of the model (no enable/disable switch in the UI) */
  toggleable?: boolean;
  /** default state of the toggle */
  defaultOn?: boolean;
  /** Monte-Carlo correlation tag: shares a risk factor with other tagged params */
  corr?: CorrTag;
  /** Monte-Carlo-enrollable */
  mcable?: boolean;
  help?: string;
}

export const GROUP_LABELS: Record<Group, string> = {
  global: 'Global',
  purchase: 'Purchase costs (Germany)',
  mortgage: 'Financing / mortgage',
  rent: 'Renting',
  invest: 'Current capital & alternative investment',
  appreciation: 'Property value & sale',
  correlations: 'Monte-Carlo correlations',
};

export const GROUP_ORDER: Group[] = [
  'global',
  'purchase',
  'mortgage',
  'rent',
  'invest',
  'appreciation',
  'correlations',
];

export const PARAM_DEFS: ParamDef[] = [
  // ---------- Global ----------
  { key: 'horizon_years', label: 'Time horizon', group: 'global', kind: 'count', default: 25, min: 1, max: 50, step: 1, toggleable: false, help: 'Years to simulate.' },
  { key: 'inflation', label: 'Inflation rate', group: 'global', kind: 'pct', default: 2.0, min: 0, max: 10, step: 0.1, corr: 'inflation', mcable: true, help: 'Used to index recurring costs and, where toggled, rent and prices.' },
  { key: 'vol_inflation', label: 'Volatility — inflation (σ)', group: 'global', kind: 'pct', default: 1.0, min: 0, max: 10, step: 0.25, toggleable: false, help: 'Annual standard deviation of inflation in the Monte Carlo.' },

  // ---------- Purchase ----------
  { key: 'property_price', label: 'Property price', group: 'purchase', kind: 'eur', default: 500_000, min: 50_000, max: 5_000_000, step: 5000, toggleable: false },
  { key: 'grunderwerbsteuer_rate', label: 'Grunderwerbsteuer (transfer tax)', group: 'purchase', kind: 'pct', default: 5.0, min: 3.5, max: 6.5, step: 0.5, mcable: true, help: 'Depends on Bundesland (3.5 %–6.5 %). % of price, one-off.' },
  { key: 'notary_rate', label: 'Notary & contract', group: 'purchase', kind: 'pct', default: 1.5, min: 0, max: 3, step: 0.1, mcable: true, help: '% of price, one-off.' },
  { key: 'grundbuch_rate', label: 'Grundbuch (land register)', group: 'purchase', kind: 'pct', default: 0.5, min: 0, max: 1.5, step: 0.1, mcable: true, help: '% of price, one-off.' },
  { key: 'makler_rate', label: 'Makler (agent) commission', group: 'purchase', kind: 'pct', default: 3.57, min: 0, max: 7.14, step: 0.01, mcable: true, help: '% of price; varies by region (buyer-only since 2020).', },
  { key: 'renovation_budget', label: 'Renovation / modernization budget', group: 'purchase', kind: 'eur', default: 10_000, min: 0, max: 200_000, step: 1000, mcable: true, help: 'One-off spend right after purchase (kitchen, bathroom…).' },
  { key: 'grundsteuer_annual', label: 'Grundsteuer (property tax)', group: 'purchase', kind: 'eur', default: 700, min: 0, max: 5000, step: 50, mcable: true, help: 'EUR/year, indexed to inflation.' },
  { key: 'building_insurance_annual', label: 'Building insurance (Wohngebäudevers.)', group: 'purchase', kind: 'eur', default: 350, min: 0, max: 3000, step: 25, mcable: true, help: 'EUR/year, indexed to inflation.' },
  { key: 'maintenance_rate', label: 'Maintenance reserve', group: 'purchase', kind: 'pct', default: 1.0, min: 0, max: 3, step: 0.1, mcable: true, help: '% of purchase price per year, indexed to inflation.' },
  { key: 'hausgeld_annual', label: 'Hausgeld / WEG (condo fees)', group: 'purchase', kind: 'eur', default: 0, min: 0, max: 24_000, step: 100, mcable: true, help: 'EUR/year if buying a condo; set 0 for a house.' },

  // ---------- Mortgage ----------
  { key: 'equity', label: 'Equity / down payment available', group: 'mortgage', kind: 'eur', default: 150_000, min: 0, max: 5_000_000, step: 5000, toggleable: false, help: 'All liquid capital committed to the purchase (covers costs + part of price). Unused remainder stays invested.' },
  { key: 'fixed_rate', label: 'Fixed interest rate', group: 'mortgage', kind: 'pct', default: 3.5, min: 0, max: 15, step: 0.05, mcable: true, help: 'Nominal annual rate during the Zinsbindung (fixed-rate) period.' },
  { key: 'fixed_years', label: 'Fixed-rate period (Zinsbindung)', group: 'mortgage', kind: 'count', default: 10, min: 1, max: 30, step: 1, mcable: true, help: 'Years the fixed rate is guaranteed.' },
  { key: 'followup_rate', label: 'Follow-up rate after fixed period', group: 'mortgage', kind: 'pct', default: 5.0, min: 0, max: 15, step: 0.25, toggleable: false, mcable: true, help: 'Assumed rate when re-fixing (or going variable) after Zinsbindung.' },
  { key: 'initial_tilgung', label: 'Initial amortization (Anfangstilgung)', group: 'mortgage', kind: 'pct', default: 2.0, min: 0.5, max: 10, step: 0.25, toggleable: false, mcable: true, help: '% of the original loan repaid per year at the start.' },
  { key: 'loan_term_years', label: 'Full loan term', group: 'mortgage', kind: 'count', default: 30, min: 5, max: 40, step: 1, toggleable: false, help: 'Total life of the loan; follow-up payment amortizes over the remaining term.' },
  { key: 'sondertilgung_pct', label: 'Sondertilgung — % of loan / year', group: 'mortgage', kind: 'pct', default: 0, min: 0, max: 10, step: 0.5, mcable: true, help: 'Extra repayment as % of the *original* loan per year.' },
  { key: 'sondertilgung_eur', label: 'Sondertilgung — fixed amount / year', group: 'mortgage', kind: 'eur', default: 0, min: 0, max: 100_000, step: 1000, mcable: true, help: 'Extra repayment in EUR per year.' },

  // ---------- Rent ----------
  { key: 'rent_cold', label: 'Cold rent (Kaltmiete)', group: 'rent', kind: 'mrate', default: 1650, min: 200, max: 15_000, step: 50, mcable: true, help: 'Monthly, for a comparable property.' },
  { key: 'nebenkosten_monthly', label: 'Nebenkosten / utilities', group: 'rent', kind: 'mrate', default: 250, min: 0, max: 3000, step: 25, mcable: true, help: 'Monthly warm-monthly surcharge (Heizung, Wasser…).' },
  { key: 'rent_increase', label: 'Rent growth', group: 'rent', kind: 'pct', default: 2.0, min: 0, max: 10, step: 0.1, corr: 'inflation', mcable: true, help: 'Nominal annual rent increase.' },
  { key: 'rent_increase_linked_to_inflation', label: 'Rent growth tracks inflation', group: 'rent', kind: 'switch', default: 0, help: 'When on, rent growth follows the inflation parameter instead.' },
  { key: 'rent_upfront_costs', label: 'Relocation costs (kitchen, deposit provision…)', group: 'rent', kind: 'eur', default: 3000, min: 0, max: 50_000, step: 500, mcable: true, help: 'One-off cost when moving into the rental.' },

  // ---------- Investment ----------
  { key: 'capital_stocks', label: 'Current capital — stocks / equity funds', group: 'invest', kind: 'eur', default: 40_000, min: 0, max: 10_000_000, step: 1000, toggleable: false },
  { key: 'capital_bonds', label: 'Current capital — bonds / savings', group: 'invest', kind: 'eur', default: 15_000, min: 0, max: 10_000_000, step: 1000, toggleable: false, help: 'Fixed income & cash-like holdings.' },
  { key: 'expected_return_stocks', label: 'Expected return — stocks', group: 'invest', kind: 'pct', default: 7.0, min: 0, max: 20, step: 0.25, corr: 'stocks', mcable: true, help: 'Nominal p.a., before taxes.' },
  { key: 'vol_stocks', label: 'Volatility — stocks (σ)', group: 'invest', kind: 'pct', default: 15.0, min: 0, max: 40, step: 1, toggleable: false, help: 'Annual standard deviation used in the Monte Carlo.' },
  { key: 'expected_return_bonds', label: 'Expected return — bonds/savings', group: 'invest', kind: 'pct', default: 2.5, min: 0, max: 15, step: 0.25, toggleable: false, mcable: true, help: 'Nominal p.a., before taxes. Use rate 0 to model cash.' },
  { key: 'vol_bonds', label: 'Volatility — bonds (σ)', group: 'invest', kind: 'pct', default: 5.0, min: 0, max: 30, step: 1, toggleable: false, help: 'Annual standard deviation used in the Monte Carlo.' },
  { key: 'freed_cash_invested', label: 'Invest freed cash flow while renting', group: 'invest', kind: 'switch', default: 1, help: 'If the monthly cost of renting is lower than owning, invest the difference in the portfolio. Switching this off strongly biases the result — a warning is shown.' },
  { key: 'capital_gains_tax_rate', label: 'Capital gains tax (Abgeltungsteuer+Soli)', group: 'invest', kind: 'pct', default: 26.375, min: 0, max: 50, step: 0.025, toggleable: false, mcable: true, help: '25 % + 5.5 % Soli = 26.375 %.' },
  { key: 'teilfreistellung_rate', label: 'Teilfreistellung (equity fund exemption)', group: 'invest', kind: 'pct', default: 15.0, min: 0, max: 30, step: 1, mcable: true, help: 'Exemption applied to gains. 30 % for equity funds × fund share (e.g. 50 %) = 15 %.' },
  { key: 'sparerpauschbetrag', label: 'Sparerpauschbetrag (saver’s allowance)', group: 'invest', kind: 'eur', default: 1000, min: 0, max: 10_000, step: 100, toggleable: false, mcable: true, help: 'Tax-free gains per year (1000 € single / 2000 € couples).' },

  // ---------- Appreciation ----------
  { key: 'property_appreciation', label: 'Property value growth', group: 'appreciation', kind: 'pct', default: 2.0, min: -5, max: 10, step: 0.25, corr: 'property', mcable: true, help: 'Nominal annual growth of the property value.' },
  { key: 'vol_property', label: 'Volatility — property growth (σ)', group: 'appreciation', kind: 'pct', default: 4.0, min: 0, max: 30, step: 1, toggleable: false, help: 'Annual standard deviation of property value growth in the Monte Carlo.' },
  { key: 'appreciation_linked_to_inflation', label: 'Property growth tracks inflation', group: 'appreciation', kind: 'switch', default: 0, help: 'When on, property growth equals the inflation parameter.' },
  { key: 'sell_at_horizon', label: 'Sell property at end of horizon', group: 'appreciation', kind: 'switch', default: 1, help: 'Converts the property into cash (minus costs & taxes) in the final net worth.' },
  { key: 'selling_costs_rate', label: 'Selling costs (Makler+Notar on resale)', group: 'appreciation', kind: 'pct', default: 4.5, min: 0, max: 10, step: 0.5, toggleable: false, mcable: true, help: '% of the resale price, deducted if you sell.' },
  { key: 'capital_gains_tax_before_10y', label: 'Apply §23 EStG gains tax if sold before 10 y', group: 'appreciation', kind: 'switch', default: 1, help: 'Owner-occupied property: capital gains are tax-free after 10 years. Off = assume always exempt.' },

  // ---------- Correlations (MC only) ----------
  { key: 'corr_stocks_property', label: 'ρ(stocks, property)', group: 'correlations', kind: 'ratio', default: 0.3, min: -1, max: 1, step: 0.1, toggleable: false, help: 'Correlation of stock returns and property growth shocks.' },
  { key: 'corr_stocks_inflation', label: 'ρ(stocks, inflation)', group: 'correlations', kind: 'ratio', default: 0.2, min: -1, max: 1, step: 0.1, toggleable: false },
  { key: 'corr_rent_inflation', label: 'ρ(rent growth, inflation)', group: 'correlations', kind: 'ratio', default: 0.9, min: -1, max: 1, step: 0.1, toggleable: false },
];

export const PARAM_MAP: Record<string, ParamDef> = Object.fromEntries(
  PARAM_DEFS.map((d) => [d.key, d]),
);

/** Monte-Carlo distribution choices for an enrolled parameter. */
export type Dist = 'normal' | 'uniform' | 'triangular' | 'lognormal';

export interface McSpec {
  enabled: boolean;
  dist: Dist;
  min: number;
  max: number;
}

export interface ParamState {
  values: Record<string, number>;
  /** enable/disable switch per key (absent => def.defaultOn ?? true) */
  on: Record<string, boolean>;
  mc: Record<string, McSpec>;
}

export function defaultState(): ParamState {
  const values: Record<string, number> = {};
  const on: Record<string, boolean> = {};
  const mc: Record<string, McSpec> = {};
  for (const d of PARAM_DEFS) {
    values[d.key] = d.default;
    if (d.toggleable !== false) on[d.key] = d.defaultOn ?? true;
    if (d.mcable) {
      const spread = mcSpread(d);
      mc[d.key] = { enabled: false, dist: defaultDist(d), min: round(d.default - spread), max: round(d.default + spread) };
    }
    if (d.kind === 'switch') values[d.key] = d.default;
  }
  return { values, on, mc };
}

function round(x: number): number {
  return Math.round(x * 100) / 100;
}

function mcSpread(d: ParamDef): number {
  // A sensible default variability range: ±15 % of the default, at least one step.
  const s = Math.max(Math.abs(d.default) * 0.15, d.step ?? 1);
  if (d.kind === 'pct' || d.kind === 'ratio' || d.kind === 'count') return round(s);
  return round(s);
}

function defaultDist(d: ParamDef): Dist {
  // Strictly-positive multiplicative quantities → lognormal; correlations/bounds → uniform.
  if (d.kind === 'ratio') return 'uniform';
  if (d.default > 0 && (d.kind === 'pct' || d.kind === 'eur' || d.kind === 'mrate')) return 'lognormal';
  return 'normal';
}

/** Effective value of a parameter: 0 when the toggle is off. */
export function num(state: ParamState, key: string): number {
  const d = PARAM_MAP[key];
  if (!d) throw new Error(`Unknown parameter: ${key}`);
  if (d.toggleable !== false && !(state.on[key] ?? d.defaultOn ?? true)) return 0;
  return state.values[key];
}

/** Same as num() but interpolated from Monte-Carlo draws already applied over state.values. */
export function numRaw(state: ParamState, key: string): number {
  const d = PARAM_MAP[key];
  if (!d) throw new Error(`Unknown parameter: ${key}`);
  if (d.toggleable !== false && !(state.on[key] ?? d.defaultOn ?? true)) return 0;
  return state.values[key];
}

/** Switch helper: on = value flag with ON default */
export function switchOn(state: ParamState, key: string): boolean {
  return num(state, key) !== 0;
}
