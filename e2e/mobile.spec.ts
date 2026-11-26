import { test, expect } from '@playwright/test';

/** Mobile UX guards (viewport 390×844 from playwright.config projects/devices).
 *  Regression guards for the 2025-08 phone rework:
 *  - the parameter tabs must stay on ONE horizontally scrollable line
 *    (the orphaned `.param-tabs` class bug made them wrap into 3–4 ragged rows);
 *  - the Inputs/Results switch must span the full width and be sticky;
 *  - toolbar buttons collapse to icons (no label text) on phones. */

test.describe('mobile layout', () => {
  test.skip(({ viewport }) => !viewport || viewport.width >= 720, 'phone-only checks');

  test('parameter tabs are a single swipeable line', async ({ page }) => {
    await page.goto('/');
    const list = page.locator('.param-tabs .mantine-Tabs-list');
    await expect(list).toBeVisible();
    const metrics = await page.evaluate(() => {
      const el = document.querySelector('.param-tabs .mantine-Tabs-list') as HTMLElement;
      return {
        flexWrap: getComputedStyle(el).flexWrap,
        overflowX: getComputedStyle(el).overflowX,
        clientHeight: el.clientHeight,
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      };
    });
    expect(metrics.flexWrap).toBe('nowrap');
    expect(metrics.overflowX).toBe('auto');
    // content wider than the box ⇒ it actually scrolls instead of wrapping
    expect(metrics.scrollWidth).toBeGreaterThanOrEqual(metrics.clientWidth);
    // single line: roughly one tab high (a wrapped list would be ≥ 2 rows)
    expect(metrics.clientHeight).toBeLessThan(90);
  });

  test('Inputs/Results switch is full-width and sticky', async ({ page }) => {
    await page.goto('/');
    const seg = page.locator('.main-tabs .mantine-SegmentedControl-root');
    await expect(seg).toBeVisible();
    const m = await seg.evaluate((el) => {
      const sticky = getComputedStyle(el.closest('.main-tabs') as Element).position;
      return { width: el.getBoundingClientRect().width, viewport: window.innerWidth, sticky };
    });
    expect(m.sticky).toBe('sticky');
    expect(m.width).toBeGreaterThan(m.viewport * 0.9);
  });

  test('toolbar buttons hide their text labels on phones', async ({ page }) => {
    await page.goto('/');
    const label = page.locator('.toolbar .btn-text').first();
    await expect(label).toBeHidden();
  });

  test('run buttons are docked at the bottom and reachable', async ({ page }) => {
    await page.goto('/');
    const bar = page.locator('.runs-bar');
    await expect(bar).toBeVisible();
    const m = await bar.evaluate((el) => {
      const s = getComputedStyle(el);
      return { position: s.position, bottom: el.getBoundingClientRect().bottom, viewport: window.innerHeight };
    });
    expect(m.position).toBe('fixed');
    expect(Math.abs(m.bottom - m.viewport)).toBeLessThan(2);
  });
});
