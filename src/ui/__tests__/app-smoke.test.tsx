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
import { ErrorBoundary } from '../ErrorBoundary';

// vitest globals are off → testing-library's auto-cleanup doesn't register;
// unmount every render after each test so queries don't match stale DOM.
afterEach(cleanup);
afterAll(() => { vi.restoreAllMocks(); });

// Plotly's module init needs APIs jsdom lacks; stub the URL blob layer.
// Mantine needs window.matchMedia (color scheme) and ResizeObserver (indicators).
beforeAll(() => {
  if (!window.URL.createObjectURL) {
    (window.URL as unknown as Record<string, unknown>).createObjectURL = vi.fn(() => 'blob:mock');
    (window.URL as unknown as Record<string, unknown>).revokeObjectURL = vi.fn();
  }
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (q: string) => ({
        matches: false, media: q, onchange: null,
        addListener() {}, removeListener() {},
        addEventListener() {}, removeEventListener() {},
        dispatchEvent: () => false,
      }),
    });
  }
  if (!window.ResizeObserver) {
    class ResizeObserverStub {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    window.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  }
});

// All form panels stay mounted (inactive tabs are only hidden), so queries
// reach every input without switching tabs.

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
    // print one-pager repeats this label — the print section is display:none on
    // screen but jsdom doesn't load CSS, so match all occurrences
    expect(screen.getAllByText(/Restschuld after fixed period/).length).toBeGreaterThan(0);
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
    // slider params render a second (hidden) input with the same value
    expect(screen.getAllByDisplayValue('432100').length).toBeGreaterThan(0);
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
    // …find the repayment-mode select among all param selects (energy class etc. exist too)
    const allSelects = Array.from(container.querySelectorAll('.param-input select')) as HTMLSelectElement[];
    const isModeSelect = (sel: HTMLSelectElement) =>
      Array.from(sel.options).some((o) => /Monthly payment/.test(o.textContent ?? ''));
    const modeSelect = allSelects.find(isModeSelect);
    expect(modeSelect).toBeTruthy();
    expect(modeSelect!.value).toBe('0');
    fireEvent.change(modeSelect!, { target: { value: '1' } });
    expect(screen.getAllByText(/Desired monthly payment/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/Initial amortization \(Anfangstilgung\)/)).toBeNull();
    expect((allSelects.find(isModeSelect) as HTMLSelectElement).value).toBe('1');
  });
});

describe('dark theme toggle', () => {
  it('toggles data-theme on <html> and persists the choice', () => {
    clearAutosave();
    localStorage.removeItem('buyvsrent.theme');
    const { unmount } = render(<App />);
    const toggle = screen.getByTitle(/Switch to dark theme/);
    expect(document.documentElement.dataset.theme === 'dark' || document.documentElement.dataset.theme === 'light').toBe(true);

    fireEvent.click(toggle);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('buyvsrent.theme')).toBe('dark');
    expect(screen.getByTitle('Switch to light theme')).toBeTruthy();

    fireEvent.click(toggle);
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('buyvsrent.theme')).toBe('light');
    unmount();
    localStorage.removeItem('buyvsrent.theme');
  });
});

describe('ErrorBoundary', () => {
  it('renders the recovery card instead of crashing the tree', () => {
    function Boom(): JSX.Element {
      throw new Error('boom');
    }
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText('Reload')).toBeTruthy();
    expect(screen.getByText('Reset parameters & reload')).toBeTruthy();
    spy.mockRestore();
  });
});
