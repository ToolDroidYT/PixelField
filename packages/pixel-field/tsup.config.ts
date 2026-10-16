import { defineConfig, type Options } from 'tsup';

/**
 * Shared options: both entries build ESM + CJS with source maps.
 *
 * `treeshake` (tsup's Rollup post-pass) is deliberately off: esbuild already
 * tree-shakes the bundle, and the Rollup pass **strips module-level
 * directives** — including the `'use client'` that `src/index.ts` declares
 * for React Server Components. Keep it off unless the directive moves.
 */
const base = {
  format: ['esm', 'cjs'],
  target: 'es2022',
  treeshake: false,
  sourcemap: true,
  // `react` is a peer dependency and must stay external so consumers share
  // their own copy (hooks would break otherwise).
  external: ['react'],
} satisfies Options;

export default defineConfig([
  {
    ...base,
    entry: { index: 'src/index.ts' },
    outDir: 'dist',
    dts: true,
    clean: true,
  },
  {
    ...base,
    // React-free entry loaded by `bench/browser.html` only. Built into
    // `bench/dist` so the published `dist` ships the public entry alone.
    entry: { bench: 'src/benchEntry.ts' },
    outDir: 'bench/dist',
    dts: false,
    clean: true,
  },
]);
