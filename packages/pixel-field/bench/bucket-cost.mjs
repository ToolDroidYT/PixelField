/**
 * Should `drawGrouped` iterate only the palette buckets that are occupied?
 *
 * `renderField` currently touches all 4,096 body buckets every frame three
 * times — `counts.fill`, the prefix sum, and the draw scan — even though a
 * typical frame fills only a few hundred of them. That reads like obvious
 * waste, but noise sampling takes milliseconds while a bucket loop is a
 * handful of microseconds, so the question is whether the saving survives
 * measurement.
 *
 * Both strategies are implemented here against the *same* key arrays, taken
 * from a real `paintField` frame, so the comparison is like-for-like:
 *
 *   scan-all    what ships today
 *   occupied    track used keys, zero only stale ones, iterate sorted used keys
 *
 *   node bench/bucket-cost.mjs
 */
import {
  buildFieldCells,
  createFieldRenderBuffers,
  paintField,
  resolvePixelFieldConfig,
} from '../dist/index.js';

const COLOR_BUCKETS = 64;
const ALPHA_BUCKETS = 64;
const BODY_KEYS = COLOR_BUCKETS * ALPHA_BUCKETS;
const TOTAL_KEYS = BODY_KEYS + ALPHA_BUCKETS;

const WIDTH = 1920;
const HEIGHT = 1080;
const FRAMES = 400;
const SEED = 18;

// --- Realistic inputs -------------------------------------------------------

const config = resolvePixelFieldConfig();
const cells = buildFieldCells(WIDTH, HEIGHT, config, SEED);
const buffers = createFieldRenderBuffers(cells.count);
paintField(
  {
    clearRect() {},
    set fillStyle(_) {},
    fillRect() {},
  },
  cells,
  buffers,
  {
    width: WIDTH,
    height: HEIGHT,
    noiseScale: WIDTH * config.autoScaleFactor,
    time: 7.3,
    seed: SEED,
  },
  config,
);

const bodyKeys = buffers.bodyKeys.slice();
const glintKeys = buffers.glintKeys.slice();
const count = cells.count;
const { x: cellX, y: cellY, size: cellSize } = cells;

const seen = new Set();
for (let i = 0; i < count; i++) {
  if (bodyKeys[i] >= 0) seen.add(bodyKeys[i]);
}
const occupied = seen.size;

const order = new Int32Array(count);
const counts = new Int32Array(TOTAL_KEYS);
const offsets = new Int32Array(TOTAL_KEYS + 1);
let sink = 0;

// --- Strategy A: what ships -------------------------------------------------

function groupAll(keys, buckets, keyOffset) {
  counts.fill(0, keyOffset, keyOffset + buckets);
  for (let i = 0; i < count; i++) {
    const key = keys[i] - keyOffset;
    if (key >= 0 && key < buckets) counts[key + keyOffset]++;
  }
  let total = 0;
  for (let k = 0; k < buckets; k++) {
    offsets[k + keyOffset] = total;
    total += counts[k + keyOffset];
  }
  for (let i = 0; i < count; i++) {
    const key = keys[i] - keyOffset;
    if (key >= 0 && key < buckets) order[offsets[key + keyOffset]++] = i;
  }
}

function scanAll() {
  groupAll(bodyKeys, BODY_KEYS, 0);
  for (let key = 0; key < BODY_KEYS; key++) {
    const total = counts[key];
    if (total === 0) continue;
    const start = offsets[key] - total;
    for (let j = start; j < offsets[key]; j++) {
      sink += cellX[order[j]] + cellSize[order[j]];
    }
  }
}

// --- Strategy B: occupied buckets only -------------------------------------

/** Keys touched by the previous frame, so only they need clearing. */
const stale = new Int32Array(BODY_KEYS);
let staleCount = 0;

function groupOccupied(keys, buckets, keyOffset) {
  for (let i = 0; i < staleCount; i++) counts[stale[i]] = 0;
  staleCount = 0;

  for (let i = 0; i < count; i++) {
    const key = keys[i];
    if (key < keyOffset || key >= keyOffset + buckets) continue;
    if (counts[key]++ === 0) stale[staleCount++] = key;
  }

  // Ascending order reproduces the scan-all draw order exactly.
  const usedKeys = stale.subarray(0, staleCount);
  usedKeys.sort();
  let total = 0;
  for (let i = 0; i < staleCount; i++) {
    const key = usedKeys[i];
    offsets[key] = total;
    total += counts[key];
  }
  for (let i = 0; i < count; i++) {
    const key = keys[i];
    if (key < keyOffset || key >= keyOffset + buckets) continue;
    order[offsets[key]++] = i;
  }
}

function scanOccupied() {
  groupOccupied(bodyKeys, BODY_KEYS, 0);
  const usedKeys = stale.subarray(0, staleCount);
  for (let i = 0; i < usedKeys.length; i++) {
    const key = usedKeys[i];
    const end = offsets[key];
    const start = end - counts[key];
    for (let j = start; j < end; j++) {
      sink += cellX[order[j]] + cellSize[order[j]];
    }
  }
}

// --- Measurement ------------------------------------------------------------

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function measure(fn) {
  fn();
  fn();
  const times = [];
  for (let i = 0; i < FRAMES; i++) {
    const start = process.hrtime.bigint();
    fn();
    times.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  return median(times);
}

const scanAllMs = measure(scanAll);
const occupiedMs = measure(scanOccupied);

console.log(
  `${count} cells, ${occupied} of ${BODY_KEYS} body buckets occupied`,
);
console.log(`  scan-all    ${scanAllMs.toFixed(3)} ms/frame`);
console.log(`  occupied    ${occupiedMs.toFixed(3)} ms/frame`);
console.log(
  `  delta       ${((occupiedMs - scanAllMs) * 1000).toFixed(1)} µs/frame ` +
    `(${(((occupiedMs - scanAllMs) / scanAllMs) * 100).toFixed(1)}%)`,
);
if (sink === -1) console.log(sink);
