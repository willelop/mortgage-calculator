// @vitest-environment jsdom
/**
 * i18n tests — DE/EN toggle: English stays the default (tests & legacy users),
 * switching to German localizes labels, tabs and toolbar; choice persists.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import App from '../../App';
import { defaultState } from '../../engine/params';
import { setLang } from '../../i18n';

afterEach(cleanup);

beforeAll(() => {
  // Plotly's module init needs APIs jsdom lacks; stub the URL blob layer.
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

describe('language toggle', () => {
  it('defaults to English and localizes on click', () => {
    localStorage.removeItem('buyvsrent.lang');
    const { container } = render(
      <MantineProvider>
        <App />
      </MantineProvider>,
    );
    // English default (jsdom navigator.language is en-US)
    expect(screen.queryAllByText(/Kaufpreis/).length).toBe(0);
    expect(screen.getAllByText(/Property price/).length).toBeGreaterThan(0);

    // switch to German
    fireEvent.click(screen.getByLabelText(/Zu Deutsch wechseln/));
    expect(document.documentElement.lang).toBe('de');
    expect(localStorage.getItem('buyvsrent.lang')).toBe('de');
    expect(screen.getAllByText('Kaufpreis').length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/Property price/).length).toBe(0);

    // tabs localized too
    expect(screen.getAllByText(/Kaufnebenkosten/).length).toBeGreaterThan(0);

    // and back
    fireEvent.click(screen.getByLabelText(/Switch to English/));
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getAllByText(/Property price/).length).toBeGreaterThan(0);
    localStorage.removeItem('buyvsrent.lang');
  });

  it('param-form tabs keep working in German (panels stay mounted)', () => {
    setLang('de');
    render(
      <MantineProvider>
        <App />
      </MantineProvider>,
    );
    fireEvent.click(screen.getByRole('tab', { name: /Kaufnebenkosten/ }));
    expect(screen.getAllByText('Kaufpreis').length).toBeGreaterThan(0);
    setLang('en');
  });

  it('defaults come from the parameter registry (unchanged)', () => {
    const s = defaultState();
    expect(s.values['property_price']).toBe(500_000);
  });
});
