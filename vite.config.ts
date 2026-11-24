import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the app works at https://<user>.github.io/<repo>/ without config changes.
export default defineConfig({
  plugins: [react()],
  base: './',
});
