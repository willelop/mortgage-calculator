import { expect, test } from '@playwright/test';

/**
 * Smoke test (roadmap 3a): the app loads, computes, and stays console-clean.
 * English is the default language. No Plotly-heavy assertions (canvas
 * rendering is flaky in CI); we check that stat cards are filled in.
 */
test('app loads, runs, and produces results without console errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  await page.goto('/');

  // Header (EN default), visible without scrolling
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Buy vs. Rent');

  // The deterministic "Run" button inside the runs bar (first run group)
  const runGroup = page.locator('.run-group', { hasText: 'Deterministic scenario' });
  const runButton = runGroup.getByRole('button', { name: /Run/ });
  await expect(runButton).toBeEnabled();

  // The app auto-runs on load: stat cards are already filled.
  // Force a fresh run and wait for the button to return to idle.
  // (The nominal run is fast — don't assert the transient "Running…" label.)
  await runButton.click();
  await expect(runGroup.getByRole('button', { name: /Run/ })).toBeEnabled({ timeout: 20_000 });

  // Results: the net-worth stat cards exist and contain a formatted number.
  const statValues = page.locator('.stat-value');
  const count = await statValues.count();
  expect(count).toBeGreaterThanOrEqual(5);
  const first = (await statValues.first().textContent()) ?? '';
  expect(first).toMatch(/€|EUR|\d/);

  // No console errors during the whole flow (ignore favicon 404s).
  const realErrors = consoleErrors.filter((e) => !/favicon|404/.test(e));
  expect(realErrors).toEqual([]);
});
