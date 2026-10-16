import type { PixelFieldConfig } from '@tooldroid/pixel-field';

/**
 * The field the demo page ships with: a calmer take on the package defaults,
 * tuned for the page's warm charcoal palette. The playground starts from
 * these values and the export button emits whatever they become.
 */
export const DEMO_PIXEL_FIELD_CONFIG: PixelFieldConfig = {
  // Grid: distance between cell origins, and the square size drawn in each.
  spacing: 16,
  pixelSize: 10,

  // Motion: 1 = the package's baseline rate; 0 freezes the drift entirely.
  speed: 0.5,
  maxFps: 15,

  // Shape: field values where cells fade in, and the hard alpha ceiling.
  visibilityRange: [0.43, 0.56],
  alphaCap: 1,

  // Color: warm charcoal → off-white ramp, matching the page's ink/paper tones.
  colorBase: [54, 51, 48],
  colorRange: [182, 174, 166],
  glintColor: [235, 225, 213],
};
