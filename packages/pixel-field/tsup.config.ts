import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', bench: 'src/benchEntry.ts' },
  format: ['esm', 'cjs'],
  target: 'es2022',
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // `react` is a peer dependency and must stay external so consumers share
  // their own copy (hooks would break otherwise).
  external: ['react'],
});
