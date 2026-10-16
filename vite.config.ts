import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Resolve the workspace package to its source so the demo app gets HMR
      // across the package boundary without a build step. Swap this alias for
      // `dist` output to test the package exactly as published.
      '@tooldroid/pixel-field': fileURLToPath(
        new URL('./packages/pixel-field/src/index.ts', import.meta.url),
      ),
    },
  },
});
