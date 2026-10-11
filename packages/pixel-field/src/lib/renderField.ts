import type { FieldCells } from './cells';
import { clamp01, fbm, smoothstep } from './noise';
import type { ResolvedPixelFieldConfig } from './pixelFieldConfig';

/**
 * Painting the field costs two things: sampling noise per cell, and issuing one
 * `fillStyle` + `fillRect` per visible cell. The second used to dominate —
 * ~5,000 unique `rgba(...)` strings built and re-parsed every frame.
 *
 * Both are cut down here:
 *
 * - **Colors are quantized into a palette.** Brightness and alpha are bucketed
 *   (64 steps each, i.e. ~1 RGB level and ~0.002 alpha of error), so a frame
 *   only needs a few hundred distinct strings, cached across frames.
 * - **Draws are batched by palette key** with a counting sort, so each string
 *   is assigned once instead of ~5,000 times. Cells never overlap when the
 *   grid is non-degenerate (`overlap === false`), which makes the reordering
 *   visually identical; overlapping grids fall back to generation order.
 * - **Cells fully outside the canvas are skipped** before any noise runs, and
 *   the detail layer is only sampled where it can still affect the result.
 */

const COLOR_BUCKETS = 64;
const ALPHA_BUCKETS = 64;
/** Palette keys for bodies first, then glints (which use their own color). */
const BODY_KEYS = COLOR_BUCKETS * ALPHA_BUCKETS;
const GLINT_KEYS = ALPHA_BUCKETS;
const TOTAL_KEYS = BODY_KEYS + GLINT_KEYS;

/** Reusable per-frame scratch space; one instance lives in the hook's ref. */
export type FieldRenderBuffers = {
  /** Palette key per cell, or `-1` when the cell is skipped. */
  bodyKeys: Int32Array;
  /** Glint palette key per cell, or `-1` when the cell does not glint. */
  glintKeys: Int32Array;
  counts: Int32Array;
  /** Bucket starts, advanced to bucket ends while filling `order`. */
  offsets: Int32Array;
  /** Cell indices grouped by palette key. */
  order: Int32Array;
  /**
   * Palette buckets the previous frame actually painted, so the next frame
   * clears only those counts instead of all 4,096 body buckets. Body and
   * glint keys are disjoint ranges, so they keep separate lists.
   */
  bodyUsed: Int32Array;
  bodyUsedCount: number;
  glintUsed: Int32Array;
  glintUsedCount: number;
  /** Lazily built `rgba(...)` strings, indexed by palette key. */
  palette: Array<string | undefined>;
  /** Inputs behind `palette`, so a color change invalidates it. */
  paletteColorBase: readonly number[] | null;
  paletteColorRange: readonly number[] | null;
  paletteGlintColor: readonly number[] | null;
  paletteAlphaCap: number;
  paletteMinAlpha: number;
};

export function createFieldRenderBuffers(cellCapacity = 0): FieldRenderBuffers {
  return {
    bodyKeys: new Int32Array(cellCapacity),
    glintKeys: new Int32Array(cellCapacity),
    counts: new Int32Array(TOTAL_KEYS),
    offsets: new Int32Array(TOTAL_KEYS + 1),
    order: new Int32Array(cellCapacity),
    // Sized for the whole key space, not the cell count: a frame can use at
    // most one entry per bucket, so these never need to grow.
    bodyUsed: new Int32Array(BODY_KEYS),
    bodyUsedCount: 0,
    glintUsed: new Int32Array(GLINT_KEYS),
    glintUsedCount: 0,
    palette: new Array<string | undefined>(TOTAL_KEYS),
    paletteColorBase: null,
    paletteColorRange: null,
    paletteGlintColor: null,
    paletteAlphaCap: Number.NaN,
    paletteMinAlpha: Number.NaN,
  };
}

/** Everything the per-cell math needs that is not in the config. */
export type FieldView = {
  /** Canvas size in CSS pixels. */
  width: number;
  height: number;
  /** Noise units per CSS pixel — see `noiseScale` in the config. */
  noiseScale: number;
  /** Animation clock; `speed` is baked in by the frame loop, not here. */
  time: number;
  seed: number;
};

function ensureCapacity(buffers: FieldRenderBuffers, count: number) {
  if (buffers.bodyKeys.length < count) {
    buffers.bodyKeys = new Int32Array(count);
    buffers.glintKeys = new Int32Array(count);
    buffers.order = new Int32Array(count);
  }
}

function sameTriple(
  a: readonly number[] | null,
  b: readonly number[],
): boolean {
  return !!a && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/**
 * Renders one frame. Clears the canvas first, so this is the whole paint —
 * nothing else needs to run between frames.
 *
 * Mutates `buffers` (keys, buckets, palette cache); `cells` and `config` are
 * only read.
 */
export function paintField(
  ctx: CanvasRenderingContext2D,
  cells: FieldCells,
  buffers: FieldRenderBuffers,
  view: FieldView,
  config: ResolvedPixelFieldConfig,
): void {
  const { width, height, noiseScale, time: t, seed } = view;

  ctx.clearRect(0, 0, width, height);
  if (width <= 0 || height <= 0 || cells.count === 0) return;
  ensureCapacity(buffers, cells.count);

  // Hoisted out of the per-cell loop: the config is frozen (dictionary-mode
  // property loads) and each of these would otherwise be re-read ~9,000 times.
  const octaves = config.octaves;
  const flow = config.flowSpeed;
  const warpTime = t * config.warpSpeed;
  const warpAmount = config.warpAmount;
  const useWarp = warpAmount !== 0;
  // The warp only bends at low frequency, so it can afford fewer octaves than
  // the broad/detail layers — two full fBm samples per cell otherwise.
  const warpOctaves = config.warpOctaves;
  const detailScale = config.detailScale;
  const detailWeight = config.detailWeight;
  const broadWeight = 1 - detailWeight;
  // The detail layer feeds both the field blend and the fine surface light;
  // when neither can contribute it is skipped outright.
  const useDetail = detailWeight !== 0 || config.fineBrightness !== 0;

  const visibilityLo = config.visibilityRange[0];
  const visibilityHi = config.visibilityRange[1];
  const bodyLo = config.bodyRange[0];
  const bodyHi = config.bodyRange[1];
  const coreLo = config.coreRange[0];
  const coreHi = config.coreRange[1];
  const fineLo = config.fineRange[0];
  const fineHi = config.fineRange[1];
  const contourCenter = config.contourCenter;
  const contourWidth = config.contourWidth;

  const bodyBrightness = config.bodyBrightness;
  const coreBrightness = config.coreBrightness;
  const fineBrightness = config.fineBrightness;
  const alphaCap = config.alphaCap;
  const alphaBase = config.alphaBase;
  const bodyAlpha = config.bodyAlpha;
  const coreAlpha = config.coreAlpha;
  const contourAlpha = config.contourAlpha;
  const minAlpha = config.minAlpha;

  const colorBase = config.colorBase;
  const colorRange = config.colorRange;
  const glintEnabled = config.glint;
  const glintMinBrightness = config.glintMinBrightness;
  const glintChance = config.glintChance;
  const glintAlphaCap = config.glintAlpha;
  const glintFalloff = config.glintFalloff;
  const glintHeightRatio = config.glintHeightRatio;
  const glintColor = config.glintColor;

  // Alpha is quantized across the range that can actually be drawn, so a cell
  // just above `minAlpha` maps to the first bucket rather than to zero.
  const alphaLo = Math.min(minAlpha, alphaCap);
  const alphaSpan = alphaCap - alphaLo;
  const brightnessScale = 1 / COLOR_BUCKETS;
  const alphaScale = alphaSpan > 0 ? alphaSpan / ALPHA_BUCKETS : 0;
  const glintAlphaScale = glintAlphaCap > 0 ? glintAlphaCap / GLINT_KEYS : 0;
  const glintBrightnessFloor = 1 - glintChance;

  const palette = buffers.palette;
  if (
    buffers.paletteAlphaCap !== alphaCap ||
    buffers.paletteMinAlpha !== minAlpha ||
    !sameTriple(buffers.paletteColorBase, colorBase) ||
    !sameTriple(buffers.paletteColorRange, colorRange) ||
    !sameTriple(buffers.paletteGlintColor, glintColor)
  ) {
    palette.fill(undefined);
    buffers.paletteColorBase = colorBase;
    buffers.paletteColorRange = colorRange;
    buffers.paletteGlintColor = glintColor;
    buffers.paletteAlphaCap = alphaCap;
    buffers.paletteMinAlpha = minAlpha;
  }

  const bodyKeys = buffers.bodyKeys;
  const glintKeys = buffers.glintKeys;
  const { x: cellX, y: cellY, size: cellSize, n: cellN, count } = cells;
  let hasGlint = false;

  for (let i = 0; i < count; i++) {
    const size = cellSize[i];
    const x0 = cellX[i];
    const y0 = cellY[i];

    // Cull before sampling: the padded grid deliberately generates cells
    // past each edge (and one full row/column of them is never visible).
    if (x0 >= width || y0 >= height || x0 + size <= 0 || y0 + size <= 0) {
      bodyKeys[i] = -1;
      glintKeys[i] = -1;
      continue;
    }

    const x = x0 / noiseScale;
    const y = y0 / noiseScale;

    // A shared moving noise field is sampled at every fixed grid position.
    // Domain warping bends it into soft, lava-lamp-like continents.
    let warpedX = x;
    let warpedY = y;
    if (useWarp) {
      const warpX = fbm(
        x + 5.7 + warpTime * 0.12,
        y - 2.4 - warpTime * 0.075,
        seed,
        warpOctaves,
      );
      const warpY = fbm(
        x - 8.1 - warpTime * 0.082,
        y + 11.3 + warpTime * 0.105,
        seed,
        warpOctaves,
      );
      warpedX = x + (warpX - 0.5) * warpAmount;
      warpedY = y + (warpY - 0.5) * warpAmount;
    }

    const broad = fbm(
      warpedX + t * 0.025 * flow,
      warpedY - t * 0.018 * flow,
      seed,
      octaves,
    );

    // `field = broad * (1 - w) + detail * w` with `detail <= 1`, so this is an
    // upper bound on the field. Below the visibility floor the cell is
    // guaranteed invisible, which lets us skip its detail sample entirely.
    let detail = 0;
    const fieldCeiling = broad * broadWeight + detailWeight;
    if (useDetail && fieldCeiling >= visibilityLo) {
      detail = fbm(
        x * detailScale + 19.2 - t * 0.045 * flow,
        y * detailScale - 7.8 + t * 0.032 * flow,
        seed,
        octaves,
      );
    }

    const field = clamp01(broad * broadWeight + detail * detailWeight);

    // Field height controls brightness. The inner core is brighter, while the
    // soft contour band suggests a raised edge and gives the field depth.
    // Large areas below the threshold are genuinely black (0% brightness),
    // creating breathing room instead of a wall of always-visible squares.
    const visibility = smoothstep(visibilityLo, visibilityHi, field);
    const body = smoothstep(bodyLo, bodyHi, field);
    const core = smoothstep(coreLo, coreHi, field);
    // Already normalized by `contourWidth`, so the Gaussian is just exp(-t²).
    const contourOffset = (field - contourCenter) / contourWidth;
    // |offset| > ~8 makes the rim contribute less than 1e-28: not worth an exp.
    const contour =
      contourOffset > -8 && contourOffset < 8
        ? Math.exp(-contourOffset * contourOffset)
        : 0;
    const fineLight = smoothstep(fineLo, fineHi, detail);

    const brightness = clamp01(
      body * bodyBrightness +
        core * coreBrightness +
        fineLight * fineBrightness,
    );
    const alpha =
      visibility *
      Math.min(
        alphaCap,
        alphaBase +
          body * bodyAlpha +
          core * coreAlpha +
          contour * contourAlpha,
      );

    if (alpha < minAlpha) {
      bodyKeys[i] = -1;
      glintKeys[i] = -1;
      continue;
    }

    const brightnessBucket = Math.min(
      COLOR_BUCKETS - 1,
      (brightness * COLOR_BUCKETS) | 0,
    );
    const alphaBucket =
      alphaSpan > 0
        ? Math.min(
            ALPHA_BUCKETS - 1,
            (((alpha - alphaLo) / alphaSpan) * ALPHA_BUCKETS) | 0,
          )
        : 0;
    bodyKeys[i] = brightnessBucket * ALPHA_BUCKETS + alphaBucket;

    if (
      glintEnabled &&
      brightness > glintMinBrightness &&
      cellN[i] > glintBrightnessFloor
    ) {
      const glintAlpha = Math.min(
        glintAlphaCap,
        (brightness - glintMinBrightness) * glintFalloff,
      );
      const glintBucket =
        glintAlphaScale > 0
          ? Math.min(GLINT_KEYS - 1, (glintAlpha / glintAlphaScale) | 0)
          : 0;
      glintKeys[i] = BODY_KEYS + glintBucket;
      hasGlint = true;
    } else {
      glintKeys[i] = -1;
    }
  }

  // Palette keys are built lazily and shared by every cell that lands in the
  // bucket, so a whole frame only allocates a few hundred strings.
  const styleFor = (key: number): string => {
    const cached = palette[key];
    if (cached !== undefined) return cached;

    const style =
      key < BODY_KEYS
        ? rgba(
            colorBase,
            colorRange,
            ((key / ALPHA_BUCKETS) | 0) * brightnessScale + brightnessScale / 2,
            alphaLo + (key % ALPHA_BUCKETS) * alphaScale + alphaScale / 2,
          )
        : rgba(
            glintColor,
            ZERO_RANGE,
            0,
            (key - BODY_KEYS) * glintAlphaScale + glintAlphaScale / 2,
          );
    palette[key] = style;
    return style;
  };

  if (cells.overlap) {
    drawInOrder(ctx, cells, buffers, styleFor, glintHeightRatio);
  } else {
    drawGrouped(ctx, cells, buffers, styleFor, glintHeightRatio, hasGlint);
  }
}

const ZERO_RANGE: readonly [number, number, number] = [0, 0, 0];

function rgba(
  colorBase: readonly number[],
  colorRange: readonly number[],
  brightness: number,
  alpha: number,
): string {
  const r = channel(colorBase[0] + brightness * colorRange[0]);
  const g = channel(colorBase[1] + brightness * colorRange[1]);
  const b = channel(colorBase[2] + brightness * colorRange[2]);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function channel(value: number): number {
  return Math.round(Math.min(255, Math.max(0, value)));
}

/** Batched draw: one `fillStyle` per occupied bucket, then its cells. */
function drawGrouped(
  ctx: CanvasRenderingContext2D,
  cells: FieldCells,
  buffers: FieldRenderBuffers,
  styleFor: (key: number) => string,
  glintHeightRatio: number,
  hasGlint: boolean,
): void {
  const { count } = cells;

  clearCounts(buffers, buffers.bodyUsed, buffers.bodyUsedCount);
  buffers.bodyUsedCount = groupBy(
    buffers,
    buffers.bodyKeys,
    count,
    BODY_KEYS,
    0,
    buffers.bodyUsed,
  );
  drawBuckets(
    ctx,
    cells,
    buffers,
    styleFor,
    buffers.bodyUsed,
    buffers.bodyUsedCount,
    0,
    glintHeightRatio,
  );

  // Glint counts are cleared even when this frame has no glints, or they would
  // linger from the last frame that did and corrupt the next one.
  clearCounts(buffers, buffers.glintUsed, buffers.glintUsedCount);
  buffers.glintUsedCount = 0;
  if (!hasGlint) return;

  buffers.glintUsedCount = groupBy(
    buffers,
    buffers.glintKeys,
    count,
    GLINT_KEYS,
    BODY_KEYS,
    buffers.glintUsed,
  );
  drawBuckets(
    ctx,
    cells,
    buffers,
    styleFor,
    buffers.glintUsed,
    buffers.glintUsedCount,
    BODY_KEYS,
    glintHeightRatio,
  );
}

/** Draws every bucket in `used`, cells sharing one `fillStyle`. */
function drawBuckets(
  ctx: CanvasRenderingContext2D,
  cells: FieldCells,
  buffers: FieldRenderBuffers,
  styleFor: (key: number) => string,
  used: Int32Array,
  usedCount: number,
  glintKeyBase: number,
  glintHeightRatio: number,
): void {
  const { x: cellX, y: cellY, size: cellSize } = cells;
  const { counts, offsets, order } = buffers;
  const isGlint = glintKeyBase > 0;

  for (let u = 0; u < usedCount; u++) {
    const key = used[u];
    const end = offsets[key];
    const start = end - counts[key];
    ctx.fillStyle = styleFor(key);
    for (let j = start; j < end; j++) {
      const i = order[j];
      const size = cellSize[i];
      ctx.fillRect(
        cellX[i],
        cellY[i],
        size,
        isGlint ? Math.max(1, size * glintHeightRatio) : size,
      );
    }
  }
}

/** Zero only the buckets the previous frame touched. */
function clearCounts(
  buffers: FieldRenderBuffers,
  used: Int32Array,
  usedCount: number,
): void {
  const { counts } = buffers;
  for (let u = 0; u < usedCount; u++) counts[used[u]] = 0;
}

/**
 * Counting sort of the first `count` entries of `keys` into `order`, bucketed
 * over `[keyOffset, keyOffset + buckets)`. On return `offsets` holds each
 * bucket's end (`end - counts[key]` is its start); `counts` keeps the sizes,
 * and `used[0..return value)` lists the buckets that are actually occupied.
 *
 * Counts must already be zero for this range — `clearCounts` handles that.
 * Occupied keys are recorded on first touch, which is what lets the caller
 * skip the 4,096-bucket scan a full palette would otherwise need.
 */
function groupBy(
  buffers: FieldRenderBuffers,
  keys: Int32Array,
  count: number,
  buckets: number,
  keyOffset: number,
  used: Int32Array,
): number {
  const { counts, offsets, order } = buffers;
  let usedCount = 0;

  for (let i = 0; i < count; i++) {
    const key = keys[i] - keyOffset;
    if (key < 0 || key >= buckets) continue;
    const absolute = key + keyOffset;
    if (counts[absolute]++ === 0) used[usedCount++] = absolute;
  }

  // Sorted so buckets are painted in the same order a full scan would have
  // produced. Cells never overlap on this path, so the order could not change
  // the image — but keeping it identical means a paint is a paint.
  const usedKeys = used.subarray(0, usedCount);
  usedKeys.sort();

  let total = 0;
  for (let u = 0; u < usedCount; u++) {
    const key = usedKeys[u];
    offsets[key] = total;
    total += counts[key];
  }

  for (let i = 0; i < count; i++) {
    const key = keys[i] - keyOffset;
    if (key >= 0 && key < buckets) order[offsets[key + keyOffset]++] = i;
  }

  return usedCount;
}

/** Overlapping grids must keep generation order, so only runs are collapsed. */
function drawInOrder(
  ctx: CanvasRenderingContext2D,
  cells: FieldCells,
  buffers: FieldRenderBuffers,
  styleFor: (key: number) => string,
  glintHeightRatio: number,
): void {
  const { x: cellX, y: cellY, size: cellSize, count } = cells;
  const { bodyKeys, glintKeys } = buffers;

  // One cursor for `fillStyle`: body and glint keys are disjoint namespaces,
  // so a glint drawn between two same-colored bodies invalidates the cache.
  let lastKey = -2;
  for (let i = 0; i < count; i++) {
    const bodyKey = bodyKeys[i];
    if (bodyKey < 0) continue;
    if (bodyKey !== lastKey) {
      ctx.fillStyle = styleFor(bodyKey);
      lastKey = bodyKey;
    }
    const size = cellSize[i];
    ctx.fillRect(cellX[i], cellY[i], size, size);

    const glintKey = glintKeys[i];
    if (glintKey >= 0) {
      if (glintKey !== lastKey) {
        ctx.fillStyle = styleFor(glintKey);
        lastKey = glintKey;
      }
      ctx.fillRect(
        cellX[i],
        cellY[i],
        size,
        Math.max(1, size * glintHeightRatio),
      );
    }
  }
}
