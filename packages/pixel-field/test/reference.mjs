/**
 * Verbatim port of the renderer as it existed before the batched rewrite,
 * kept here as the behavioral baseline: `paintField` must produce the same
 * visible cells (and the same colors, up to palette quantization) as this.
 *
 * Plain JS so the suite needs no build step beyond `dist/`.
 */
import { clamp01, fbm, random01, smoothstep } from '../dist/index.js';

/** The original object-per-cell grid. */
export function buildCellsReference(width, height, config, seed) {
  const spacing = Math.max(1, config.spacing);
  const cells = [];
  const cols = Math.ceil(width / spacing) + 2;
  const rows = Math.ceil(height / spacing) + 2;
  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      const id = (row + 1) * 10007 + col + 1;
      cells.push({
        x: col * spacing,
        y: row * spacing,
        n: random01(id, seed),
        size:
          config.pixelSize *
          (1 -
            config.sizeJitter / 2 +
            random01(id + 31, seed) * config.sizeJitter),
      });
    }
  }
  return cells;
}

/** The original per-frame paint: one `fillStyle` + `fillRect` per visible cell. */
export function paintReference(ctx, cells, view, config) {
  const { width, height, noiseScale, time: t, seed } = view;
  const flow = config.flowSpeed;
  const warp = t * config.warpSpeed;

  ctx.clearRect(0, 0, width, height);

  for (const cell of cells) {
    const x = cell.x / noiseScale;
    const y = cell.y / noiseScale;

    const warpX = fbm(
      x + 5.7 + warp * 0.12,
      y - 2.4 - warp * 0.075,
      seed,
      config.octaves,
    );
    const warpY = fbm(
      x - 8.1 - warp * 0.082,
      y + 11.3 + warp * 0.105,
      seed,
      config.octaves,
    );
    const warpedX = x + (warpX - 0.5) * config.warpAmount;
    const warpedY = y + (warpY - 0.5) * config.warpAmount;

    const broad = fbm(
      warpedX + t * 0.025 * flow,
      warpedY - t * 0.018 * flow,
      seed,
      config.octaves,
    );
    const detail = fbm(
      x * config.detailScale + 19.2 - t * 0.045 * flow,
      y * config.detailScale - 7.8 + t * 0.032 * flow,
      seed,
      config.octaves,
    );
    const field = clamp01(
      broad * (1 - config.detailWeight) + detail * config.detailWeight,
    );

    const visibility = smoothstep(
      config.visibilityRange[0],
      config.visibilityRange[1],
      field,
    );
    const body = smoothstep(config.bodyRange[0], config.bodyRange[1], field);
    const core = smoothstep(config.coreRange[0], config.coreRange[1], field);
    const contour = Math.exp(
      -Math.pow((field - config.contourCenter) / config.contourWidth, 2),
    );
    const fineLight = smoothstep(
      config.fineRange[0],
      config.fineRange[1],
      detail,
    );

    const brightness = clamp01(
      body * config.bodyBrightness +
        core * config.coreBrightness +
        fineLight * config.fineBrightness,
    );
    const alpha =
      visibility *
      Math.min(
        config.alphaCap,
        config.alphaBase +
          body * config.bodyAlpha +
          core * config.coreAlpha +
          contour * config.contourAlpha,
      );
    if (alpha < config.minAlpha) continue;

    const r = Math.round(
      config.colorBase[0] + brightness * config.colorRange[0],
    );
    const g = Math.round(
      config.colorBase[1] + brightness * config.colorRange[1],
    );
    const b = Math.round(
      config.colorBase[2] + brightness * config.colorRange[2],
    );
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    ctx.fillRect(cell.x, cell.y, cell.size, cell.size);

    if (
      config.glint &&
      brightness > config.glintMinBrightness &&
      cell.n > 1 - config.glintChance
    ) {
      const glintAlpha = Math.min(
        config.glintAlpha,
        (brightness - config.glintMinBrightness) * config.glintFalloff,
      );
      ctx.fillStyle = `rgba(${config.glintColor[0]}, ${config.glintColor[1]}, ${config.glintColor[2]}, ${glintAlpha})`;
      ctx.fillRect(
        cell.x,
        cell.y,
        cell.size,
        Math.max(1, cell.size * config.glintHeightRatio),
      );
    }
  }
}

/** Records `fillStyle` assignments and rects instead of drawing them. */
export function createRecorder() {
  const ops = [];
  let fillStyle = 'rgba(0, 0, 0, 1)';
  let styleWrites = 0;
  return {
    ops,
    get styleWrites() {
      return styleWrites;
    },
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value) {
      fillStyle = value;
      styleWrites++;
    },
    clearRect() {
      ops.push({ kind: 'clear' });
    },
    fillRect(x, y, w, h) {
      ops.push({ kind: 'rect', x, y, w, h, style: fillStyle });
    },
  };
}

export const parseStyle = (style) => {
  const match = /^rgba\((\d+), (\d+), (\d+), (-?[\d.eE+-]+)\)$/.exec(style);
  if (!match) throw new Error(`unparseable style: ${style}`);
  return {
    r: Number(match[1]),
    g: Number(match[2]),
    b: Number(match[3]),
    a: Number(match[4]),
  };
};

/** Rects that intersect the canvas — everything else is invisible either way. */
export const intersectsViewport = (rect, width, height) =>
  rect.x < width &&
  rect.y < height &&
  rect.x + rect.w > 0 &&
  rect.y + rect.h > 0;

/** Geometry key; floats are identical across renderers because cells are. */
export const rectKey = (rect) => `${rect.x}|${rect.y}|${rect.w}|${rect.h}`;

export const groupByGeometry = (ops, width, height) => {
  const groups = new Map();
  for (const op of ops) {
    if (op.kind !== 'rect') continue;
    if (!intersectsViewport(op, width, height)) continue;
    const key = rectKey(op);
    const bucket = groups.get(key);
    if (bucket) bucket.push(op.style);
    else groups.set(key, [op.style]);
  }
  for (const styles of groups.values()) styles.sort();
  return groups;
};
