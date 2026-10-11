export { PixelField, type PixelFieldProps } from './components/PixelField';
export { usePixelField } from './hooks/usePixelField';

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
