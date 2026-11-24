/**
 * Monte-Carlo runner: draws enrolled parameters + correlated yearly shocks,
 * runs runScenario N times, and aggregates results.
 */

import { ParamState, PARAM_DEFS, McSpec } from './params';
import { runScenario, YearlyShocks } from './simulate';

// ---------------------------------------------------------------------------
// Deterministic RNG (mulberry32) + Gaussian via Box-Muller
// ---------------------------------------------------------------------------

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gaussian(rand: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ---------------------------------------------------------------------------
// Parameter draws
// ---------------------------------------------------------------------------

/** Draw one value for an enrolled parameter given a gaussian shock z. */
export function drawValue(spec: McSpec, nominal: number, z: number): number {
  const lo = Math.min(spec.min, spec.max);
  const hi = Math.max(spec.min, spec.max);
  let value: number;
  switch (spec.dist) {
    case 'uniform': {
      const u = normCdf(z);
      value = lo + u * (hi - lo);
      break;
    }
    case 'triangular': {
      const mode = Math.min(Math.max(nominal, lo), hi);
      value = triangularInv(lo, mode, hi, normCdf(z));
      break;
    }
    case 'lognormal': {
      // median at the nominal value; σ so that hi ≈ 97.5th percentile
      const base = nominal > 0 ? nominal : (lo + hi) / 2 || 1;
      const sigma = hi > base ? Math.log(hi / base) / 2 : Math.abs(hi - lo) / 4 / Math.abs(base);
      value = base * Math.exp(sigma * z);
      break;
    }
    case 'normal':
    default: {
      const sd = (hi - lo) / 4;
      value = nominal + z * sd;
      break;
    }
  }
  return Math.min(hi, Math.max(lo, value));
}

function triangularInv(lo: number, mode: number, hi: number, u: number): number {
  const fc = (mode - lo) / Math.max(hi - lo, 1e-12);
  if (u < fc) {
    return lo + Math.sqrt(u * fc) * (hi - lo);
  }
  return hi - Math.sqrt((1 - u) * (1 - fc)) * (hi - lo);
}

/** Standard normal CDF (Abramowitz & Stegun 7.1.26 via erf). */
export function normCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const poly =
    t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const p = 1 - (Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI)) * poly;
  return z >= 0 ? p : 1 - p;
}

// ---------------------------------------------------------------------------
// Monte Carlo
// ---------------------------------------------------------------------------

export interface McOptions {
  runs: number;
  seed: number;
  /** progress callback (fraction 0..1) */
  onProgress?: (fraction: number) => void;
}

export interface PercentileBands {
  p10: number[];
  p25: number[];
  p50: number[];
  p75: number[];
  p90: number[];
}

export interface McResult {
  runs: number;
  horizon: number;
  years: number[];
  buyBands: PercentileBands;
  rentBands: PercentileBands;
  terminalBuy: number[];
  terminalRent: number[];
  terminalDiff: number[];
  breakevenYears: number[]; // Infinity when never within horizon
  probBuyBeats: number;
  probBreakeven: number;
  medianBreakEven: number | null;
  diffBands: PercentileBands;
}

export function runMonteCarlo(state: ParamState, opts: McOptions): McResult {
  const enrolled = PARAM_DEFS.filter((d) => d.mcable && state.mc[d.key]?.enabled);
  const rand = mulberry32(opts.seed);
  const N = Math.max(1, Math.round(opts.runs));

  const rhoSP = clamp(state.values['corr_stocks_property'] ?? 0.3, -0.99, 0.99);
  const rhoSI = clamp(state.values['corr_stocks_inflation'] ?? 0.2, -0.99, 0.99);
  const rhoRI = clamp(state.values['corr_rent_inflation'] ?? 0.9, -0.99, 0.99);
  const H = Math.max(1, Math.round(state.values['horizon_years'] ?? 25));

  const runningState: ParamState = { values: { ...state.values }, on: { ...state.on }, mc: state.mc };

  const nwBuyAll: number[][] = [];
  const nwRentAll: number[][] = [];
  const terminalBuy: number[] = [];
  const terminalRent: number[] = [];
  const terminalDiff: number[] = [];
  const breakevenYears: number[] = [];

  for (let run = 0; run < N; run++) {
    // 1) draw enrolled deterministic parameters (factor-correlated or independent)
    const zs0 = gaussian(rand); // stock shock anchor for this run's param draws
    const zi0 = rhoSI * zs0 + gaussian(rand) * Math.sqrt(1 - rhoSI * rhoSI);
    for (const d of enrolled) {
      const tag = d.corr;
      let z: number;
      if (tag === 'stocks') z = zs0;
      else if (tag === 'inflation') {
        // rent increase & inflation-linked params: correlated with inflation,
        // extra mixing for rent via ρ(rent, inflation)
        z = d.key === 'rent_increase'
          ? rhoRI * zi0 + gaussian(rand) * Math.sqrt(1 - rhoRI * rhoRI)
          : zi0;
      } else if (tag === 'property') {
        z = rhoSP * zs0 + gaussian(rand) * Math.sqrt(1 - rhoSP * rhoSP);
      } else {
        z = gaussian(rand);
      }
      const val = drawValue(state.mc[d.key], state.values[d.key], z);
      runningState.values[d.key] = val;
    }

    // 2) correlated yearly shocks for the time-series drivers
    const stocks: number[] = [];
    const property: number[] = [];
    const inflation: number[] = [];
    for (let y = 0; y < H; y++) {
      const zs = gaussian(rand);
      const ep = gaussian(rand);
      const ei = gaussian(rand);
      stocks.push(zs);
      property.push(rhoSP * zs + ep * Math.sqrt(1 - rhoSP * rhoSP));
      inflation.push(rhoSI * zs + ei * Math.sqrt(1 - rhoSI * rhoSI));
    }
    const shocks: YearlyShocks = { stocks, property, inflation };

    // 3) run
    const res = runScenario(runningState, shocks);
    nwBuyAll.push(res.nwBuy);
    nwRentAll.push(res.nwRent);
    terminalBuy.push(res.nwBuy[res.nwBuy.length - 1]);
    terminalRent.push(res.nwRent[res.nwRent.length - 1]);
    terminalDiff.push(res.terminalDiff);
    breakevenYears.push(res.breakEvenYear ?? Infinity);

    if (opts.onProgress && (run + 1) % 50 === 0) opts.onProgress((run + 1) / N);
  }

  const years = nwBuyAll[0].map((_, i) => i);
  const buyBands = percentileBands(nwBuyAll);
  const rentBands = percentileBands(nwRentAll);
  const diffAll = nwBuyAll.map((row, i) => row.map((b, j) => b - nwRentAll[i][j]));
  const diffBands = percentileBands(diffAll);

  const definedBE = breakevenYears.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);

  return {
    runs: N,
    horizon: H,
    years,
    buyBands,
    rentBands,
    terminalBuy,
    terminalRent,
    terminalDiff,
    breakevenYears,
    probBuyBeats: fraction(terminalDiff, (x) => x > 0),
    probBreakeven: definedBE.length / N,
    medianBreakEven: definedBE.length > 0 ? definedBE[Math.floor(definedBE.length / 2)] : null,
    diffBands,
  };
}

// --- helpers ---------------------------------------------------------------

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

function fraction(arr: number[], pred: (x: number) => boolean): number {
  let c = 0;
  for (const x of arr) if (pred(x)) c++;
  return c / arr.length;
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function percentileBands(all: number[][]): PercentileBands {
  const T = all[0].length;
  const out: PercentileBands = { p10: [], p25: [], p50: [], p75: [], p90: [] };
  const col: number[] = [];
  const sortedCol: number[] = [];
  for (let t = 0; t < T; t++) {
    col.length = 0;
    for (let r = 0; r < all.length; r++) col.push(all[r][t]);
    sortedCol.length = 0;
    sortedCol.push(...col);
    sortedCol.sort((a, b) => a - b);
    out.p10.push(percentile(sortedCol, 0.1));
    out.p25.push(percentile(sortedCol, 0.25));
    out.p50.push(percentile(sortedCol, 0.5));
    out.p75.push(percentile(sortedCol, 0.75));
    out.p90.push(percentile(sortedCol, 0.9));
  }
  return out;
}

export function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    sx += xs[i];
    sy += ys[i];
  }
  const mx = sx / n;
  const my = sy / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return 0;
  return sxy / Math.sqrt(sxx * syy);
}
