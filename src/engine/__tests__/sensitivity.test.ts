import { describe, expect, it } from 'vitest';
import { defaultState } from '../params';
import { sensitivityAnalysis } from '../sensitivity';

describe('sensitivityAnalysis — one-at-a-time tornado', () => {
  const base = defaultState();

  it('enables ~all toggled MC-able params, sorted by impact', () => {
    const res = sensitivityAnalysis(base);
    expect(res.rows.length).toBeGreaterThan(10);
    for (let i = 1; i < res.rows.length; i++) {
      expect(res.rows[i - 1].impact).toBeGreaterThanOrEqual(res.rows[i].impact);
    }
  });

  it('property appreciation and rent strongly move the outcome; zero params are skipped', () => {
    const res = sensitivityAnalysis(base);
    const keys = res.rows.map((r) => r.key);
    expect(keys).toContain('property_appreciation');
    expect(keys).toContain('rent_cold');
    expect(keys).not.toContain('sondertilgung_pct'); // value 0 → skipped
    const prop = res.rows.find((r) => r.key === 'property_appreciation')!;
    expect(prop.diffAtHigh).toBeGreaterThan(prop.diffAtLow); // higher appreciation favours buying
    const rent = res.rows.find((r) => r.key === 'rent_cold')!;
    expect(rent.diffAtHigh).toBeGreaterThan(rent.diffAtLow); // higher rent → freed cash flow shrinks → buying wins more
  });

  it('disabled parameters are excluded', () => {
    const s = defaultState();
    s.on.maintenance_rate = false;
    const res = sensitivityAnalysis(s);
    expect(res.rows.map((r) => r.key)).not.toContain('maintenance_rate');
  });

  it('uses the MC range for enrolled parameters', () => {
    const s = defaultState();
    s.mc['rent_cold'] = { enabled: true, dist: 'normal', min: 1000, max: 2400 };
    const res = sensitivityAnalysis(s);
    const rent = res.rows.find((r) => r.key === 'rent_cold')!;
    expect(rent.lowValue).toBe(1000);
    expect(rent.highValue).toBe(2400);
    expect(Math.abs(rent.diffAtHigh - rent.diffAtLow)).toBeGreaterThan(100_000);
  });
});
