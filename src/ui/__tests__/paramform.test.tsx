// @vitest-environment jsdom
/**
 * Unit tests for the tabbed ParamForm and the Options dropdown menu.
 * Complements app-smoke (which mounts the whole App) by testing the
 * settings interactions directly.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import React, { useState } from 'react';
import { cleanup, fireEvent, getByTestId, render, screen, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { ParamForm } from '../ParamForm';
import { OptionsMenu } from '../OptionsMenu';
import { defaultState, ParamState } from '../../engine/params';

afterEach(cleanup);

// jsdom lacks window.matchMedia (needed by Mantine's color-scheme manager)
beforeAll(() => {
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
});

/** Wraps ParamForm + OptionsMenu over one shared ParamState, like App does. */
function Harness({ initial, onState }: { initial: ParamState; onState?: (s: ParamState) => void }) {
  const [state, setState] = useState(initial);
  return (
    <MantineProvider>
      <ParamForm state={state} onChange={(s) => { setState(s); onState?.(s); }} />
      <OptionsMenu state={state} onChange={(s) => { setState(s); onState?.(s); }} />
    </MantineProvider>
  );
}

describe('tabbed ParamForm', () => {
  it('has one tab per group plus Monte Carlo, Global active by default', () => {
    const { container } = render(<ParamForm state={defaultState()} onChange={() => {}} />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(7);
    expect((tabs[0].textContent ?? '').includes('Global')).toBe(true);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect((tabs[tabs.length - 1].textContent ?? '').includes('Monte Carlo')).toBe(true);
    // all panels stay mounted; inactive ones are hidden
    expect(container.querySelectorAll('[role="tabpanel"]').length).toBe(7);
  });

  it('edits survive switching tabs (panels stay mounted, hidden ones inactive)', () => {
    render(<ParamForm state={defaultState()} onChange={() => {}} />);
    // Global tab is active: change the time horizon 25 → 30
    fireEvent.change(screen.getByDisplayValue('25'), { target: { value: '30' } });
    // switch away and back
    fireEvent.click(screen.getByRole('tab', { name: /Purchase/ }));
    expect((visibleTabPanel(document.body).textContent ?? '').includes('Property price')).toBe(true);
    fireEvent.click(screen.getByRole('tab', { name: /Global/ }));
    expect(screen.getByDisplayValue('30')).toBeTruthy();
  });

  it('Monte-Carlo tab enrolls a parameter and expands distribution + min/max', () => {
    const { container } = render(<Harness initial={defaultState()} />);
    const panelOf = () => getByTestId(container, 'tab-panel-mc');
    // all panels mounted; the MC one starts hidden
    expect(panelOf().hasAttribute('hidden')).toBe(true);
    fireEvent.click(screen.getByRole('tab', { name: /Monte Carlo/ }));
    const panel = panelOf();
    expect(panel.hasAttribute('hidden')).toBe(false);
    // correlations are editable here (their boxes are present with a number input)
    const corr = within(panel).getAllByText('ρ(stocks, property)')[0].closest('.param-box') as HTMLElement;
    expect(corr.querySelector('input[type="number"]')).toBeTruthy();
    // enroll the stocks return (mcable)
    expect(panel.querySelector('.param-mc select')).toBeNull();
    fireEvent.click(within(panel).getByLabelText(/Enroll Expected return — stocks in Monte Carlo/));
    const mc = container.querySelector('.param-mc') as HTMLElement;
    expect(mc).toBeTruthy();
    expect((mc.querySelector('select') as HTMLSelectElement).value).toBe('lognormal');
    // min/max seeded from the nominal spec
    const nums = Array.from(mc.querySelectorAll('input[type="number"]')).map((i) => (i as HTMLInputElement).value);
    expect(nums.length).toBe(2);
    expect(nums.map(Number)).toEqual([5.95, 8.05]);
  });
});

describe('OptionsMenu (feature toggles)', () => {
  it('toggling an optional feature flips it on and undims its value box', () => {
    const last = { current: null as ParamState | null };
    const { container } = render(<Harness initial={defaultState()} onState={(s) => (last.current = s)} />);

    // every panel is in the DOM: hausgeld box exists but dimmed (off by default)
    const box = findParamBox(container, 'Hausgeld');
    expect(box.className).toContain('off');

    fireEvent.click(screen.getByRole('button', { name: /Options/ }));
    const panel = document.querySelector('.opt-panel') as HTMLElement;
    fireEvent.click(within(panel).getByLabelText('Enable Hausgeld / WEG (condo fees)'));

    expect(last.current!.on['hausgeld_annual']).toBe(true);
    expect(box.className).not.toContain('off');
    expect(last.current!.values['hausgeld_annual']).toBe(0); // value untouched by the toggle
  });

  it('switch-kind features flip their value 0/1', () => {
    const last = { current: null as ParamState | null };
    render(<Harness initial={defaultState()} onState={(s) => (last.current = s)} />);

    fireEvent.click(screen.getByRole('button', { name: /Options/ }));
    const panel = document.querySelector('.opt-panel') as HTMLElement;
    fireEvent.click(within(panel).getByLabelText('Rent growth tracks inflation'));

    expect(last.current!.values['rent_increase_linked_to_inflation']).toBe(1);
  });

  it('disabled features are dimmed, never removed', () => {
    const { container } = render(<Harness initial={defaultState()} />);
    expect(findParamBox(container, 'Hausgeld').className).toContain('off');
    expect(findParamBox(container, 'Maintenance reserve').className).not.toContain('off');
  });
});

// --- helpers ----------------------------------------------------------------

function visibleTabPanel(root: HTMLElement): HTMLElement {
  const panels = Array.from(root.querySelectorAll('[role="tabpanel"]'));
  const visible = panels.find((p) => !(p as HTMLElement).hidden)!;
  expect(panels.filter((p) => !(p as HTMLElement).hidden).length).toBe(1);
  return visible as HTMLElement;
}

function findParamBox(root: HTMLElement, labelFragment: string): HTMLElement {
  const box = Array.from(root.querySelectorAll('.param-box')).find((b) =>
    b.textContent!.includes(labelFragment),
  );
  expect(box, `param box for "${labelFragment}" not found`).toBeTruthy();
  return box as HTMLElement;
}
