import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the app works at https://<user>.github.io/<repo>/ without config changes.
export default defineConfig({
  plugins: [react()],
  base: './',
  // vitest: keep the Playwright e2e specs out of the unit-test run (roadmap 3a)
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
  build: {
    rollupOptions: {
      output: {
        // React itself in a separate vendor chunk: app code changes don't
        // invalidate it, so returns visitors reuse the cached download.
        // Plotly stays its own lazy chunk (dynamically imported by Plot.tsx),
        // so it load-blocks nothing; its size is inherent to the library.
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) {
            return 'react-vendor';
          }
        },
      },
    },
  },
});
