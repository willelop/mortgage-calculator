import { defineConfig } from '@playwright/test';

/**
 * E2E smoke tests (roadmap 3a). Runs against `vite preview` (the built dist),
 * matching what GitHub Pages serves. Keep Plotly-heavy assertions out —
 * canvas rendering is flaky in CI.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  projects: [
    { name: 'desktop', use: { viewport: { width: 1280, height: 720 } } },
    // phone-sized run: exercises the mobile layout guards in e2e/mobile.spec.ts.
    // Plain 390×844 viewport (no device emulation): device emulation + Chromium
    // misreports the layout viewport (innerWidth ≠ CSS px), which breaks clicks.
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
  ],
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
