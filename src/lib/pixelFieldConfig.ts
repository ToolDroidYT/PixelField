/**
 * Settings for the animated pixel field.
 *
 * `PixelFieldConfig` is the partial shape callers pass; every field is optional
 * and is merged over `DEFAULT_PIXEL_FIELD_CONFIG`. The defaults reproduce the
 * original hand-tuned field exactly, so passing no config (or a handful of
 * keys) is always safe.
 */

/** An 8-bit RGB triple, e.g. `[255, 240, 220]`. */
export type RGB = readonly [number, number, number];

/** An inclusive `[min, max]` pair used by the smoothstep thresholds. */
export type Range = readonly [number, number];

export type PixelFieldConfig = {
  // --- Grid -------------------------------------------------------------
  /** Grid pitch in CSS pixels — the distance between cell origins. */
  spacing?: number;
  /** Nominal square size in CSS pixels, before per-cell jitter. */
  pixelSize?: number;
  /** Relative per-cell size jitter in `[0, 1]`; `0` makes every square identical. */
  sizeJitter?: number;

  // --- Motion -----------------------------------------------------------
  /** Playback rate of the whole animation; `1` = default, `0` freezes the clock. */
  speed?: number;
  /** Multiplier on how fast the broad and detail noise layers drift. */
  flowSpeed?: number;
  /** Multiplier on how fast the domain warp bends the field. */
  warpSpeed?: number;
  /** Cap (ms) on the per-frame time delta, smoothing out tab-switch jumps. */
  maxFrameDelta?: number;

  // --- Noise field ------------------------------------------------------
  /** Fixed noise scale, or `'auto'` to derive it from the canvas width. */
  noiseScale?: number | 'auto';
  /** Lower bound of the auto noise scale. */
  autoScaleMin?: number;
  /** Upper bound of the auto noise scale. */
  autoScaleMax?: number;
  /** `width * autoScaleFactor` is clamped into `[autoScaleMin, autoScaleMax]`. */
  autoScaleFactor?: number;
  /** How strongly the warp bends coordinates; `0` gives smooth straight blobs. */
  warpAmount?: number;
  /** Frequency multiplier of the detail layer relative to the broad layer. */
  detailScale?: number;
  /** Blend of the detail layer into the field in `[0, 1]`; broad keeps the rest. */
  detailWeight?: number;
  /** fbm octaves per noise sample; higher means finer detail at more cost. */
  octaves?: number;

  // --- Shape thresholds -------------------------------------------------
  /** Field values where a cell starts becoming visible (soft edges). */
  visibilityRange?: Range;
  /** Field values mapped to the base body brightness and alpha. */
  bodyRange?: Range;
  /** Field values mapped to the bright inner core. */
  coreRange?: Range;
  /** Detail values mapped to the fine surface light. */
  fineRange?: Range;
  /** Field value at the center of the contour highlight band. */
  contourCenter?: number;
  /** Width (sigma) of the contour highlight band; smaller = tighter rim. */
  contourWidth?: number;

  // --- Brightness -------------------------------------------------------
  /** Brightness contributed by the body. */
  bodyBrightness?: number;
  /** Brightness contributed by the inner core. */
  coreBrightness?: number;
  /** Brightness contributed by the fine detail layer. */
  fineBrightness?: number;

  // --- Alpha ------------------------------------------------------------
  /** Hard upper bound on a cell's alpha. */
  alphaCap?: number;
  /** Constant alpha floor added to every visible cell. */
  alphaBase?: number;
  /** Alpha contributed by the body. */
  bodyAlpha?: number;
  /** Alpha contributed by the inner core. */
  coreAlpha?: number;
  /** Alpha contributed by the contour rim. */
  contourAlpha?: number;
  /** Cells whose alpha falls below this are skipped entirely. */
  minAlpha?: number;

  // --- Color ------------------------------------------------------------
  /** Darkest cell color, used at brightness 0. */
  colorBase?: RGB;
  /** Brightness-driven color swing added on top of `colorBase`. */
  colorRange?: RGB;
  /** Top-edge glint color. */
  glintColor?: RGB;

  // --- Glint ------------------------------------------------------------
  /** Whether the brightest cells receive a subtle top-edge glint. */
  glint?: boolean;
  /** Brightness a cell needs before it can glint. */
  glintMinBrightness?: number;
  /** Fraction of eligible cells that glint, in `[0, 1]`. */
  glintChance?: number;
  /** Maximum glint alpha. */
  glintAlpha?: number;
  /** Rate at which glint alpha ramps up above `glintMinBrightness`. */
  glintFalloff?: number;
  /** Glint thickness as a fraction of the cell size. */
  glintHeightRatio?: number;

  // --- Rendering --------------------------------------------------------
  /** Device-pixel-ratio cap used when sizing the canvas backing store. */
  maxDpr?: number;
};

/** `PixelFieldConfig` with every field required and defined. */
export type ResolvedPixelFieldConfig = {
  [K in keyof PixelFieldConfig]-?: NonNullable<PixelFieldConfig[K]>;
};

/**
 * The hand-tuned baseline: the field rendered before config existed.
 * `speed: 1` corresponds to the original `0.00034 * 4` time step.
 */
export const DEFAULT_PIXEL_FIELD_CONFIG: ResolvedPixelFieldConfig = {
  spacing: 16,
  pixelSize: 10,
  sizeJitter: 0.12,

  speed: 1,
  flowSpeed: 1,
  warpSpeed: 1,
  maxFrameDelta: 40,

  noiseScale: 'auto',
  autoScaleMin: 125,
  autoScaleMax: 270,
  autoScaleFactor: 0.38,
  warpAmount: 2.15,
  detailScale: 1.72,
  detailWeight: 0.18,
  octaves: 4,

  visibilityRange: [0.43, 0.56],
  bodyRange: [0.48, 0.72],
  coreRange: [0.64, 0.84],
  fineRange: [0.48, 0.88],
  contourCenter: 0.59,
  contourWidth: 0.075,

  bodyBrightness: 0.48,
  coreBrightness: 0.4,
  fineBrightness: 0.12,

  alphaCap: 0.3,
  alphaBase: 0.018,
  bodyAlpha: 0.075,
  coreAlpha: 0.085,
  contourAlpha: 0.025,
  minAlpha: 0.004,

  colorBase: [54, 51, 48],
  colorRange: [132, 124, 116],
  glintColor: [235, 225, 213],

  glint: true,
  glintMinBrightness: 0.78,
  glintChance: 0.52,
  glintAlpha: 0.075,
  glintFalloff: 0.22,
  glintHeightRatio: 0.1,

  maxDpr: 2,
};

/**
 * Merges a partial config over the defaults. Explicit `undefined` values fall
 * back to the default instead of clobbering it.
 */
export function resolvePixelFieldConfig(
  config?: PixelFieldConfig,
): ResolvedPixelFieldConfig {
  if (!config) return DEFAULT_PIXEL_FIELD_CONFIG;
  const resolved: ResolvedPixelFieldConfig = { ...DEFAULT_PIXEL_FIELD_CONFIG };
  for (const key of Object.keys(config) as (keyof PixelFieldConfig)[]) {
    const value = config[key];
    if (value !== undefined) {
      Object.assign(resolved, { [key]: value });
    }
  }
  return resolved;
}

/**
 * Values that reshape the grid or the backing store (rather than just the
 * paint) and therefore need a resize/rebuild when they change.
 */
export function pixelFieldLayoutKey(config: ResolvedPixelFieldConfig): string {
  return [
    config.spacing,
    config.pixelSize,
    config.sizeJitter,
    config.maxDpr,
    config.noiseScale,
    config.autoScaleMin,
    config.autoScaleMax,
    config.autoScaleFactor,
  ].join('|');
}
