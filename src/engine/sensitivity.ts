/**
 * Deterministic one-at-a-time sensitivity ("tornado") analysis.
 *
 * For every MC-enrollable, currently-enabled parameter, the nominal scenario is
 * re-run with the parameter set to the low and then the high end of its range
 * (its MC range when enrolled, otherwise ± 10 %), keeping everything else at
 * nominal. Rows are ranked by total impact on the terminal buy−rent difference.
 *
 * This is more informative than in-MC correlations when year-to-year stochastic
 * noise dominates theterminal distribution (the usual case).
 */

import { ParamState, PARAM_DEFS } from './params';
import { runScenario } from './simulate';

export interface SensitivityRow {
  key: string;
  label: string;
  lowValue: number; // parameter value used for the low run
  highValue: number; // … for the high run
  diffAtLow: number; // terminalDiff (buy − rent)
  diffAtHigh: number;
  impact: number; // |diffAtHigh − diffAtLow|
}

export interface SensitivityResult {
  baseDiff: number; // terminalDiff at nominal
  rows: SensitivityRow[];
}

export function sensitivityAnalysis(state: ParamState): SensitivityResult {
  const baseDiff = runScenario(state).terminalDiff;
  const rows: SensitivityRow[] = [];

  for (const d of PARAM_DEFS) {
    if (!d.mcable || d.kind === 'switch') continue;
    // disabled parameters don't influence the model — a range around 0 is meaningless
    if (d.toggleable !== false && !(state.on[d.key] ?? d.defaultOn ?? true)) continue;
    if (state.values[d.key] === 0) continue;

    const nominal = state.values[d.key];
    const mc = state.mc[d.key];
    let lo: number;
    let hi: number;
    if (mc?.enabled && mc.min < mc.max && mc.min <= nominal && mc.max >= nominal) {
      lo = mc.min;
      hi = mc.max;
    } else {
      const spread = Math.max(Math.abs(nominal) * 0.1, d.step ?? 1);
      lo = Math.max(d.min ?? -Infinity, nominal - spread);
      hi = Math.min(d.max ?? Infinity, nominal + spread);
    }
    if (lo === hi) continue;

    const values = { ...state.values, [d.key]: lo };
    const diffLow = runScenario({ ...state, values }).terminalDiff;
    const values2 = { ...state.values, [d.key]: hi };
    const diffHigh = runScenario({ ...state, values: values2 }).terminalDiff;

    rows.push({
      key: d.key,
      label: d.label,
      lowValue: lo,
      highValue: hi,
      diffAtLow: diffLow,
      diffAtHigh: diffHigh,
      impact: Math.abs(diffHigh - diffLow),
    });
  }

  rows.sort((a, b) => b.impact - a.impact);
  return { baseDiff, rows };
}
