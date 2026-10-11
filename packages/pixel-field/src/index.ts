export { PixelField, type PixelFieldProps } from './components/PixelField';
export { usePixelField } from './hooks/usePixelField';

export {
  DEFAULT_PIXEL_FIELD_CONFIG,
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
  clamp01,
  fade,
  fbm,
  hash,
  mix,
  random01,
  smoothstep,
  valueNoise,
} from './lib/noise';
