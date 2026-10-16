/**
 * React-free entry point used only by `bench/browser.html`.
 *
 * `src/index.ts` exports the component and hook, so its bundle has a bare
 * `import 'react'` that a plain browser page cannot resolve. The benchmark
 * measures the rendering core — cells, config, noise, paint — none of which
 * touches React, so it loads this entry instead of the public one.
 *
 * Not part of the published API surface (`exports` only maps `.`), so it can
 * change freely.
 */
export { buildFieldCells, type FieldCells } from './lib/cells';
export {
  DEFAULT_PIXEL_FIELD_CONFIG,
  pixelFieldConfigEquals,
  pixelFieldLayoutKey,
  resolvePixelFieldConfig,
} from './lib/pixelFieldConfig';
export type {
  PixelFieldConfig,
  Range,
  ResolvedPixelFieldConfig,
  RGB,
} from './lib/pixelFieldConfig';
export {
  createFieldRenderBuffers,
  paintField,
  type FieldRenderBuffers,
  type FieldView,
} from './lib/renderField';
export {
  clamp01,
  fade,
  fbm,
  hash,
  mix,
  random01,
  smoothstep,
  valueNoise,
} from './lib/noise';
