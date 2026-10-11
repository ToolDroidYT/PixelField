/**
 * Settings for the animated pixel field.
 *
 * `PixelFieldConfig` is the partial shape callers pass; every field is optional
 * and is merged over `DEFAULT_PIXEL_FIELD_CONFIG`. The defaults reproduce the
 * original hand-tuned field exactly, so passing no config (or a handful of
 * keys) is always safe.
 *
 * Resolution also *normalizes*: non-finite values fall back to the default and
 * values that would break rendering (an unbounded `octaves`, a zero-width
 * contour, an out-of-range blend weight) are clamped into their valid span.
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
  /**
   * Upper bound on generated cells. Past it, the pitch, square size, and noise
   * scale are coarsened together, so the pattern keeps its on-screen size
   * while per-frame cost stops tracking viewport area. `0` disables the cap.
   */
  maxCells?: number;

  // --- Motion -----------------------------------------------------------
  /** Playback rate of the whole animation; `1` = default, `0` freezes the clock. */
  speed?: number;
  /** Multiplier on how fast the broad and detail noise layers drift. */
  flowSpeed?: number;
  /** Multiplier on how fast the domain warp bends the field. */
  warpSpeed?: number;
  /** Cap (ms) on the per-frame time delta, smoothing out tab-switch jumps. */
  maxFrameDelta?: number;
  /**
   * Pause automatically while the OS reports a reduced-motion preference, and
   * follow it live. Defaults to `true`; set `false` to animate regardless.
   */
  respectReducedMotion?: boolean;

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
  /**
   * fbm octaves per noise sample, clamped to `[1, 8]` (rounded to an integer);
   * higher means finer detail at more cost.
   */
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

/** `PixelFieldConfig` with every field required, defined, and immutable. */
export type ResolvedPixelFieldConfig = {
  readonly [K in keyof PixelFieldConfig]-?: NonNullable<PixelFieldConfig[K]>;
};

/** The same shape, but writable — only used while merging and normalizing. */
type MutablePixelFieldConfig = {
  -readonly [K in keyof PixelFieldConfig]-?: NonNullable<PixelFieldConfig[K]>;
};

/** Inclusive span a value is clamped into; `integer` rounds before clamping. */
type Span = { min?: number; max?: number; integer?: boolean };

/**
 * Where a bad value would actually break rendering, rather than merely look
 * different. Fields absent from this table only get the finite-number check.
 */
const SPANS: Partial<Record<keyof ResolvedPixelFieldConfig, Span>> = {
  spacing: { min: 1 },
  pixelSize: { min: 0 },
  sizeJitter: { min: 0, max: 1 },
  maxCells: { min: 0, integer: true },

  speed: { min: 0 },
  flowSpeed: { min: 0 },
  warpSpeed: { min: 0 },
  maxFrameDelta: { min: 0 },

  noiseScale: { min: 1e-6 },
  autoScaleMin: { min: 1 },
  autoScaleMax: { min: 1 },
  autoScaleFactor: { min: 0 },
  warpAmount: { min: 0 },
  detailScale: { min: 0 },
  detailWeight: { min: 0, max: 1 },
  // Unbounded octaves is a hang: `fbm` loops once per octave per sample.
  octaves: { min: 1, max: 8, integer: true },

  // A zero-width band divides by zero in the contour term.
  contourWidth: { min: 1e-4 },
  contourCenter: { min: 0, max: 1 },

  alphaCap: { min: 0, max: 1 },
  minAlpha: { min: 0, max: 1 },

  glintMinBrightness: { min: 0, max: 1 },
  glintChance: { min: 0, max: 1 },
  glintAlpha: { min: 0, max: 1 },
  glintFalloff: { min: 0 },
  glintHeightRatio: { min: 0, max: 1 },

  maxDpr: { min: 1 },
};

const COLOR_KEYS = ['colorBase', 'colorRange', 'glintColor'] as const;
const RANGE_KEYS = [
  'visibilityRange',
  'bodyRange',
  'coreRange',
  'fineRange',
] as const;
const BOOLEAN_KEYS = ['glint', 'respectReducedMotion'] as const;

/**
 * The hand-tuned baseline: the field rendered before config existed.
 * `speed: 1` corresponds to the original `0.00034 * 4` time step.
 *
 * Frozen so a consumer cannot mutate the shared instance that
 * `resolvePixelFieldConfig()` returns for an omitted config.
 */
export const DEFAULT_PIXEL_FIELD_CONFIG: ResolvedPixelFieldConfig =
  Object.freeze({
    spacing: 16,
    pixelSize: 10,
    sizeJitter: 0.12,
    // Comfortably above a 3440x1440 ultrawide, and low enough that a zoomed-out
    // browser tab stays interactive.
    maxCells: 20_000,

    speed: 1,
    flowSpeed: 1,
    warpSpeed: 1,
    maxFrameDelta: 40,
    respectReducedMotion: true,

    noiseScale: 'auto',
    autoScaleMin: 125,
    autoScaleMax: 270,
    autoScaleFactor: 0.38,
    warpAmount: 2.15,
    detailScale: 1.72,
    detailWeight: 0.18,
    octaves: 4,

    visibilityRange: Object.freeze([0.43, 0.56]) as Range,
    bodyRange: Object.freeze([0.48, 0.72]) as Range,
    coreRange: Object.freeze([0.64, 0.84]) as Range,
    fineRange: Object.freeze([0.48, 0.88]) as Range,
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

    colorBase: Object.freeze([54, 51, 48]) as RGB,
    colorRange: Object.freeze([132, 124, 116]) as RGB,
    glintColor: Object.freeze([235, 225, 213]) as RGB,

    glint: true,
    glintMinBrightness: 0.78,
    glintChance: 0.52,
    glintAlpha: 0.075,
    glintFalloff: 0.22,
    glintHeightRatio: 0.1,

    maxDpr: 2,
  } satisfies MutablePixelFieldConfig);

/** A missing or non-finite entry falls back to the baseline value. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function clamp(value: number, span: Span | undefined): number {
  if (!span) return value;
  if (span.integer) value = Math.round(value);
  if (span.min !== undefined && value < span.min) return span.min;
  if (span.max !== undefined && value > span.max) return span.max;
  return value;
}

/**
 * Merges a partial config over the defaults and normalizes the result.
 * Explicit `undefined` values fall back to the default instead of clobbering
 * it, and unknown keys are ignored.
 *
 * The returned object (and its tuples) are frozen: it is safe to share, and
 * mutating it cannot leak into other consumers.
 */
export function resolvePixelFieldConfig(
  config?: PixelFieldConfig,
): ResolvedPixelFieldConfig {
  if (!config) return DEFAULT_PIXEL_FIELD_CONFIG;

  const resolved: MutablePixelFieldConfig = {
    ...DEFAULT_PIXEL_FIELD_CONFIG,
  };
  // Only known keys are copied, so a typo can't smuggle an unvalidated value
  // into the resolved config.
  for (const key of Object.keys(
    DEFAULT_PIXEL_FIELD_CONFIG,
  ) as (keyof PixelFieldConfig)[]) {
    const value = config[key];
    if (value !== undefined) {
      Object.assign(resolved, { [key]: value });
    }
  }

  for (const key of Object.keys(
    resolved,
  ) as (keyof ResolvedPixelFieldConfig)[]) {
    const value = resolved[key] as unknown;
    const fallback = DEFAULT_PIXEL_FIELD_CONFIG[key] as unknown;
    let next: unknown;

    if (BOOLEAN_KEYS.includes(key as (typeof BOOLEAN_KEYS)[number])) {
      // Accept `0`/`1` from dynamically built configs; anything else falls
      // back to the baseline rather than reading an arbitrary value's truth.
      next =
        typeof value === 'boolean'
          ? value
          : value === 0 || value === 1
            ? value === 1
            : Boolean(fallback);
    } else if (COLOR_KEYS.includes(key as (typeof COLOR_KEYS)[number])) {
      next = triple(value, fallback, 0, 255);
    } else if (RANGE_KEYS.includes(key as (typeof RANGE_KEYS)[number])) {
      next = pair(value, fallback);
    } else if (key === 'noiseScale') {
      // The only config field with a non-numeric branch.
      next =
        value === 'auto'
          ? 'auto'
          : typeof value === 'number'
            ? clamp(finite(value, 0), SPANS.noiseScale)
            : fallback;
    } else if (typeof value === 'number') {
      next = clamp(finite(value, finite(fallback, 0)), SPANS[key]);
    } else {
      // Unrecognized shape (a stray object, string, or NaN-typed value).
      next = fallback;
    }

    Object.assign(resolved, { [key]: next });
  }

  return Object.freeze(resolved);
}

/** Clamps each channel into `[lo, hi]`, falling back per channel. */
function triple(value: unknown, fallback: unknown, lo: number, hi: number) {
  const out = [lo, lo, lo];
  for (let i = 0; i < 3; i++) {
    const candidate = (value as number[] | undefined)?.[i];
    const base = (fallback as readonly number[])[i];
    const v = finite(candidate, finite(base, lo));
    out[i] = Math.min(hi, Math.max(lo, v));
  }
  return Object.freeze(out) as RGB;
}

/** Keeps both thresholds finite, falling back per element. */
function pair(value: unknown, fallback: unknown) {
  const source = value as readonly number[] | undefined;
  const base = fallback as readonly number[];
  const a = finite(source?.[0], finite(base[0], 0));
  const b = finite(source?.[1], finite(base[1], 0));
  return Object.freeze([a, b]) as Range;
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
    config.maxCells,
    config.maxDpr,
    config.noiseScale,
    config.autoScaleMin,
    config.autoScaleMax,
    config.autoScaleFactor,
  ].join('|');
}

/**
 * Value equality for two resolved configs, comparing one level deep so freshly
 * built tuples (`colorBase: [1, 2, 3]` typed inline) are not treated as a
 * change. Cheaper than serializing the whole config on every render.
 */
export function pixelFieldConfigEquals(
  a: ResolvedPixelFieldConfig,
  b: ResolvedPixelFieldConfig,
): boolean {
  if (a === b) return true;
  for (const key of Object.keys(
    DEFAULT_PIXEL_FIELD_CONFIG,
  ) as (keyof ResolvedPixelFieldConfig)[]) {
    const left = a[key] as unknown;
    const right = b[key] as unknown;
    if (left === right) continue;
    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) return false;
      for (let i = 0; i < left.length; i++) {
        if (!Object.is(left[i], right[i])) return false;
      }
      continue;
    }
    return false;
  }
  return true;
}
