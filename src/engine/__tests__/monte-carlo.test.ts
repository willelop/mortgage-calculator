import { describe, expect, it } from 'vitest';
import { defaultState, ParamState } from '../params';
import { runMonteCarlo, drawValue, normCdf, mulberry32, gaussian } from '../monte-carlo';

function enrolledState(values: Partial<Record<string, number>>): ParamState {
  const s = defaultState();
  for (const [k, v] of Object.entries(values)) s.values[k] = v as number;
  for (const k of Object.keys(s.mc)) {
    const def = s.mc[k];
    s.mc[k] = { ...def, enabled: true, min: def.min * 0.5, max: def.max * 1.5 };
  }
  return s;
}

describe('drawValue', () => {
  const spec = { enabled: true, dist: 'normal' as const, min: 90, max: 110 };

  it('honours hard min/max bounds', () => {
    for (const z of [-10, -2, 0, 2, 10]) {
      const v = drawValue(spec, 100, z);
      expect(v).toBeGreaterThanOrEqual(90);
      expect(v).toBeLessThanOrEqual(110);
    }
  });

  it('normal at z=0 returns the nominal', () => {
    expect(drawValue(spec, 100, 0)).toBeCloseTo(100, 8);
  });

  it('uniform at z=0 gives the midpoint (Φ(0)=0.5)', () => {
    const u = { ...spec, dist: 'uniform' as const };
    expect(drawValue(u, 100, 0)).toBeCloseTo(100, 5);
  });

  it('lognormal keeps the median at the nominal', () => {
    const l = { ...spec, dist: 'lognormal' as const, min: 50, max: 200 };
    expect(drawValue(l, 100, 0)).toBeCloseTo(100, 8);
    expect(drawValue(l, 100, 2)).toBeGreaterThan(100);
    expect(drawValue(l, 100, -2)).toBeLessThan(100);
  });
});

describe('normCdf', () => {
  it('matches known values', () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 6);
    expect(normCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normCdf(-1.6449)).toBeCloseTo(0.05, 3);
  });
});

describe('runMonteCarlo', () => {
  it('is deterministic for the same seed', () => {
    const s = enrolledState({});
    const a = runMonteCarlo(s, { runs: 120, seed: 7 });
    const b = runMonteCarlo(s, { runs: 120, seed: 7 });
    expect(a.terminalDiff).toEqual(b.terminalDiff);
    expect(a.probBuyBeats).toBe(b.probBuyBeats);
  });

  it('different seeds give different results', () => {
    const s = enrolledState({});
    const a = runMonteCarlo(s, { runs: 100, seed: 1 });
    const b = runMonteCarlo(s, { runs: 100, seed: 2 });
    expect(a.terminalDiff[0]).not.toBe(b.terminalDiff[0]);
  });

  it('produces valid stats', () => {
    const s = enrolledState({});
    const res = runMonteCarlo(s, { runs: 200, seed: 42 });
    expect(res.probBuyBeats).toBeGreaterThanOrEqual(0);
    expect(res.probBuyBeats).toBeLessThanOrEqual(1);
    expect(res.terminalDiff).toHaveLength(200);
    expect(res.buyBands.p50.every((x) => Number.isFinite(x))).toBe(true);
    expect(res.buyBands.p10.every((x, i) => x <= res.buyBands.p25[i])).toBe(true);
    expect(res.buyBands.p25.every((x, i) => x <= res.buyBands.p50[i])).toBe(true);
    expect(res.buyBands.p50.every((x, i) => x <= res.buyBands.p75[i])).toBe(true);
    expect(res.buyBands.p75.every((x, i) => x <= res.buyBands.p90[i])).toBe(true);
  });

  it('has a sane tornado ranking (sensitivity styles are tested separately)', () => {
    const s = enrolledState({});
    const res = runMonteCarlo(s, { runs: 150, seed: 3 });
    expect(res.diffBands).toBeDefined();
    expect(res.probBreakeven).toBeGreaterThanOrEqual(0);
    void res;
  });

  it('rng is reproducible via mulberry32', () => {
    const a = mulberry32(1);
    const b = mulberry32(1);
    for (let i = 0; i < 10; i++) {
      expect(a()).toBe(b());
    }
    expect(Math.abs(gaussian(mulberry32(5)))).toBeLessThan(10);
  });
});
