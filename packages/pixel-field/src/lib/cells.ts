import { random01 } from './noise';
import type { ResolvedPixelFieldConfig } from './pixelFieldConfig';

/**
 * The grid of cell origins, stored as parallel typed arrays so a frame can
 * stream through them without chasing object pointers.
 *
 * Cells are generated row-major over a padded range (`-1 .. cols`/`rows`) so a
 * square wider than the pitch still bleeds across the canvas edge. Cells that
 * end up entirely off-canvas are culled at paint time, before any noise is
 * sampled.
 */
export type FieldCells = {
  /** Columns in the generated (padded) grid — used to recover a cell's index. */
  readonly cols: number;
  readonly rows: number;
  readonly count: number;
  /** Grid pitch, echoed back so the renderer can reason about overlap. */
  readonly spacing: number;
  /**
   * How much the pitch was coarsened to stay under `maxCells` — `1` unless the
   * canvas grew past the cap. Callers should scale the noise field by it too,
   * so the pattern keeps its on-screen size while the cell count stays bound.
   */
  readonly scale: number;
  /**
   * Whether any square can reach beyond its own slot, i.e. `pixelSize` with
   * jitter exceeds `spacing`. Overlapping cells must be drawn in generation
   * order; otherwise the renderer may batch them by color.
   */
  readonly overlap: boolean;
  /** Origin x in CSS pixels. */
  readonly x: Float64Array;
  /** Origin y in CSS pixels. */
  readonly y: Float64Array;
  /** Drawn square side in CSS pixels (after per-cell jitter). */
  readonly size: Float64Array;
  /** Stable per-cell random in `[0, 1)` — drives glint selection. */
  readonly n: Float64Array;
};

/**
 * Builds the grid for the current canvas size, config, and seed.
 *
 * `cols`/`rows` keep the original padded extents, so the pattern a given
 * (size, seed) pair produces is unchanged from earlier releases — as is the
 * output whenever `maxCells` has not been exceeded, because a scale of `1`
 * multiplies by exactly `1`.
 */
/** Cells a canvas of this size generates at a given pitch, padding included. */
function gridCount(width: number, height: number, spacing: number): number {
  return (Math.ceil(width / spacing) + 3) * (Math.ceil(height / spacing) + 3);
}

export type GridGeometry = {
  cols: number;
  rows: number;
  count: number;
  spacing: number;
  scale: number;
};

export function computeGridGeometry(
  width: number,
  height: number,
  config: ResolvedPixelFieldConfig,
): GridGeometry {
  const pitch = Math.max(1, config.spacing);

  let scale = 1;
  const maxCells = config.maxCells;
  if (maxCells > 0 && gridCount(width, height, pitch) > maxCells) {
    let lo = 1;
    let hi = 2;
    let guard = 0;
    while (gridCount(width, height, pitch * hi) > maxCells && guard++ < 40) {
      lo = hi;
      hi *= 2;
    }
    for (let pass = 0; pass < 20; pass++) {
      const mid = (lo + hi) / 2;
      if (gridCount(width, height, pitch * mid) <= maxCells) hi = mid;
      else lo = mid;
    }
    scale = hi;
  }

  const spacing = Math.max(1, pitch * scale);
  const cols = Math.ceil(width / spacing) + 2;
  const rows = Math.ceil(height / spacing) + 2;
  const count = (cols + 1) * (rows + 1);

  return { cols, rows, count, spacing, scale };
}

export function isGridGeometryEqual(
  cells: FieldCells,
  width: number,
  height: number,
  config: ResolvedPixelFieldConfig,
): boolean {
  const geom = computeGridGeometry(width, height, config);
  return (
    cells.cols === geom.cols &&
    cells.rows === geom.rows &&
    cells.scale === geom.scale &&
    cells.spacing === geom.spacing
  );
}

/**
 * Builds the grid for the current canvas size, config, and seed.
 *
 * `cols`/`rows` keep the original padded extents, so the pattern a given
 * (size, seed) pair produces is unchanged from earlier releases — as is the
 * output whenever `maxCells` has not been exceeded, because a scale of `1`
 * multiplies by exactly `1`.
 */
export function buildFieldCells(
  width: number,
  height: number,
  config: ResolvedPixelFieldConfig,
  seed: number,
): FieldCells {
  const { cols, rows, count, spacing, scale } = computeGridGeometry(
    width,
    height,
    config,
  );

  const x = new Float64Array(count);
  const y = new Float64Array(count);
  const size = new Float64Array(count);
  const n = new Float64Array(count);

  const jitter = config.sizeJitter;
  const pixelSize = config.pixelSize * scale;

  let i = 0;
  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++, i++) {
      const id = (row + 1) * 10007 + col + 1;
      x[i] = col * spacing;
      y[i] = row * spacing;
      n[i] = random01(id, seed);
      // Kept bit-identical to the original single-multiplication form: a
      // redistributed form rounds to a different double and would make the
      // same (size, seed) pair draw rects in different sub-pixel positions.
      size[i] = pixelSize * (1 - jitter / 2 + random01(id + 31, seed) * jitter);
    }
  }

  return {
    cols,
    rows,
    count,
    spacing,
    scale,
    // Worst case is `sizeJitter` at its maximum: `pixelSize * (1 + jitter / 2)`.
    overlap: pixelSize * (1 + jitter / 2) > spacing,
    x,
    y,
    size,
    n,
  };
}
