// @vitest-environment jsdom
/**
 * UI smoke test — mounts the real App in jsdom and asserts the results render.
 * Catches blank-page regressions (hook-order violations, render crashes…).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../../App';
import { defaultState } from '../../engine/params';
import { autosaveState, loadAutosave, clearAutosave } from '../../engine/state-io';

// vitest globals are off → testing-library's auto-cleanup doesn't register;
// unmount every render after each test so queries don't match stale DOM.
afterEach(cleanup);
afterAll(() => { vi.restoreAllMocks(); });

// Plotly's module init needs APIs jsdom lacks; stub the URL blob layer.
beforeAll(() => {
  if (!window.URL.createObjectURL) {
    (window.URL as unknown as Record<string, unknown>).createObjectURL = vi.fn(() => 'blob:mock');
    (window.URL as unknown as Record<string, unknown>).revokeObjectURL = vi.fn();
  }
});

describe('App smoke', () => {
  it('renders parameters and nominal results without crashing', () => {
    clearAutosave();
    const { container } = render(<App />);
    // header + form are present
    expect(screen.getByText(/Buy vs\. Rent/)).toBeTruthy();
    expect(container.querySelector('.param-box')).toBeTruthy();
    // the useEffect filled in the nominal scenario → key numbers visible
    expect(screen.getAllByText(/Buy − rent/i).length).toBeGreaterThan(0);
    // amortization card exists (loan > 0 in defaults)
    expect(screen.getByText(/Restschuld after fixed period/)).toBeTruthy();
    // no error boundary / blank output
    expect(container.textContent!.length).toBeGreaterThan(500);
  });
});

describe('autosave — values survive a reload', () => {
  it('round-trips state through the autosave slot', () => {
    clearAutosave();
    expect(loadAutosave()).toBeNull();
    const s = defaultState();
    s.values['property_price'] = 432_100;
    autosaveState(s);
    const restored = loadAutosave();
    expect(restored?.values['property_price']).toBe(432_100);
    expect(restored?.values['fixed_rate']).toBe(s.values['fixed_rate']);
  });

  it('restores the last session on mount (price visible in the form + toast)', () => {
    clearAutosave();
    const s = defaultState();
    s.values['property_price'] = 432_100;
    autosaveState(s);
    render(<App />);
    expect(screen.getByText('Restored your last session.')).toBeTruthy();
    expect(screen.getByDisplayValue('432100')).toBeTruthy();
  });
});

describe('repayment mode UI', () => {
  it('help tooltips ("?" marks) are present on parameter fields', () => {
    clearAutosave();
    const { container } = render(<App />);
    expect(container.querySelectorAll('.help-tip').length).toBeGreaterThan(20);
    expect(container.querySelector('.help-tooltip')).toBeTruthy();
  });

  it('switching to "Monthly payment" swaps Anfangstilgung for the payment input', () => {
    clearAutosave();
    const { container } = render(<App />);
    // default mode: Anfangstilgung visible…
    expect(screen.getAllByText(/Initial amortization \(Anfangstilgung\)/).length).toBeGreaterThan(0);
    // …the mode select is the only param-kind select (MC dist selects hidden by default)
    const modeSelect = container.querySelector('.param-input select') as HTMLSelectElement;
    expect(modeSelect.value).toBe('0');
    fireEvent.change(modeSelect, { target: { value: '1' } });
    expect(screen.getAllByText(/Desired monthly payment/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Initial amortization \(Anfangstilgung\)/)).toBeNull();
    expect((container.querySelector('.param-input select') as HTMLSelectElement).value).toBe('1');
  });
});
