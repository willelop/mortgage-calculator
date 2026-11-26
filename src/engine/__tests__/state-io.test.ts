import { describe, expect, it } from 'vitest';
import {
  encodeState, decodeState, encodeStateAsync, decodeStateAsync,
} from '../state-io';
import { defaultState } from '../params';

describe('state-io — share codes (roadmap 3b)', () => {
  it('plain codes round-trip values, switches and MC specs', () => {
    const s = defaultState();
    s.values.property_price = 777_777;
    s.on['freed_cash_invested'] = false;
    s.mc['fixed_rate'] = { enabled: true, dist: 'normal', min: 2, max: 6 };
    const back = decodeState(encodeState(s));
    expect(back).toBeTruthy();
    expect(back!.values.property_price).toBe(777_777);
    expect(back!.on['freed_cash_invested']).toBe(false);
    expect(back!.mc['fixed_rate']?.enabled).toBe(true);
    expect(back!.mc['fixed_rate']?.dist).toBe('normal');
  });

  it('long states are compressed (z. prefix) and round-trip through the async path', async () => {
    const s = defaultState();
    // inflate the payload: enable MC specs for every parameter
    for (const key of Object.keys(s.values)) {
      s.mc[key] = { enabled: true, dist: 'uniform', min: 0, max: 100 };
    }
    const plain = encodeState(s);
    const compact = await encodeStateAsync(s);
    expect(compact.startsWith('z.')).toBe(true);      // > 1500 chars → compressed
    expect(compact.length).toBeLessThan(plain.length); // deflate pays off
    const back = await decodeStateAsync(compact);
    expect(back).toBeTruthy();
    expect(back!.values.property_price).toBe(s.values.property_price);
    expect(back!.mc['fixed_rate']?.enabled).toBe(true);
  });

  it('short states stay plain and load through both decoders', async () => {
    // a minimal payload — the full default state is already beyond the threshold
    const s = defaultState();
    s.values = { equity: 123_456 };
    s.on = {};
    s.mc = {};
    const code = await encodeStateAsync(s);
    expect(code.startsWith('z.')).toBe(false); // below threshold → plain
    expect(decodeState(code)!.values.equity).toBe(123_456);
    expect((await decodeStateAsync(code))!.values.equity).toBe(123_456);
  });

  it('old plain links keep loading (backward compatibility)', () => {
    const s = defaultState();
    s.values.fixed_rate = 4.25;
    expect(decodeState(encodeState(s))!.values.fixed_rate).toBe(4.25);
    // garbage → null, never a throw
    expect(decodeState('!!!not-base64!!!')).toBeNull();
    expect(decodeState('z.!!!not-base64!!!')).toBeNull();
  });
});
