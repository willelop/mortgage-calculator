// @vitest-environment jsdom
/**
 * UI smoke test — mounts the real App in jsdom and asserts the results render.
 * Catches blank-page regressions (hook-order violations, render crashes…).
 */
import { describe, expect, it } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../../App';

describe('App smoke', () => {
  it('renders parameters and nominal results without crashing', () => {
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
