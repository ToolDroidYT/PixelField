/**
 * Golden-fingerprint helpers.
 *
 * The reference renderer in `reference.mjs` imports `fbm` from `dist`, so the
 * equivalence suite shares its noise implementation with the code under test —
 * it cannot see a change in the noise output itself. These digests close that
 * gap: they hash the palette keys and geometry that a frame actually produced,
 * so any change to sampling, warping, culling, or bucketing shows up as a
 * mismatch against the committed values in `golden.json`.
 *
 * Run `node test/golden-update.mjs` after an *intentional* visual change.
 */
import {
  buildFieldCells,
  createFieldRenderBuffers,
  paintField,
  resolvePixelFieldConfig,
} from '../dist/index.js';

/** Matches `usePixelField`'s auto noise scale, including `maxCells` coarsening. */
export function noiseScaleFor(width, config, cells) {
  const base =
    config.noiseScale === 'auto'
      ? Math.max(
          config.autoScaleMin,
          Math.min(config.autoScaleMax, width * config.autoScaleFactor),
        )
      : config.noiseScale;
  return base * (cells.scale ?? 1);
}

/** FNV-1a over a 32-bit stream, four bytes per value. */
function mix(h, value) {
  h ^= value & 0xff;
  h = Math.imul(h, 0x01000193);
  h ^= (value >>> 8) & 0xff;
  h = Math.imul(h, 0x01000193);
  h ^= (value >>> 16) & 0xff;
  h = Math.imul(h, 0x01000193);
  h ^= (value >>> 24) & 0xff;
  return Math.imul(h, 0x01000193);
}

function finish(h) {
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Digests an Int32Array of palette keys (or any integer array). */
export function digestInts(values) {
  let h = 0x811c9dc5;
  for (let i = 0; i < values.length; i++) h = mix(h, values[i] | 0);
  return finish(h ^ values.length);
}

/**
 * Digests a Float64Array by its exact IEEE-754 bit pattern, so a one-ulp
 * change in cell geometry is a mismatch rather than a silent pass.
 */
export function digestFloats(values) {
  const bits = new Int32Array(values.buffer, values.byteOffset, values.length * 2);
  let h = 0x811c9dc5;
  for (let i = 0; i < bits.length; i++) h = mix(h, bits[i]);
  return finish(h ^ values.length);
}

/** Runs one frame of the current renderer and fingerprints what it produced. */
export function fingerprint({ width, height, time, seed, config }) {
  const cfg = resolvePixelFieldConfig(config);
  const cells = buildFieldCells(width, height, cfg, seed);
  const buffers = createFieldRenderBuffers(cells.count);
  const view = {
    width,
    height,
    noiseScale: noiseScaleFor(width, cfg, cells),
    time,
    seed,
  };

  paintField(
    {
      clearRect() {},
      set fillStyle(_) {},
      fillRect() {},
    },
    cells,
    buffers,
    view,
    cfg,
  );

  return {
    count: cells.count,
    body: digestInts(buffers.bodyKeys),
    glint: digestInts(buffers.glintKeys),
    x: digestFloats(cells.x),
    y: digestFloats(cells.y),
    size: digestFloats(cells.size),
  };
}
