/**
 * Per-frame cost of the render pipeline, old vs new, on a mock canvas.
 *
 * The mock makes drawing free, so what is measured is the part that actually
 * dominated the frame budget on real hardware: noise sampling plus color
 * handling (string building, `fillStyle` assignment, rect issuing).
 *
 *   node bench/frame-cost.mjs
 */
import {
  buildFieldCells,
  createFieldRenderBuffers,
  paintField,
  resolvePixelFieldConfig,
} from '../dist/index.js';
import { buildCellsReference, paintReference } from '../test/reference.mjs';

const SIZES = [
  [1920, 1080],
  [1280, 720],
  [390, 844],
];
const FRAMES = 40;
const SEED = 18;

function createCounter() {
  const state = { styles: 0, rects: 0, last: '' };
  return {
    state,
    // An accessor, so every `fillStyle` write is counted — on real hardware
    // each one costs the browser a color parse.
    get fillStyle() {
      return state.last;
    },
    set fillStyle(value) {
      state.last = value;
      state.styles++;
    },
    clearRect() {},
    fillRect() {
      state.rects++;
    },
  };
}

function median(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function measure(fn) {
  fn();
  fn();
  const samples = [];
  for (let i = 0; i < FRAMES; i++) {
    const start = process.hrtime.bigint();
    fn();
    samples.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  return median(samples);
}

const config = resolvePixelFieldConfig();

console.log(
  `${'viewport'.padEnd(12)} ${'cells'.padStart(6)}  ${'renderer'.padEnd(10)} ` +
    `${'ms/frame'.padStart(8)}  ${'fillStyle writes'.padStart(17)}  ${'rects'.padStart(6)}`,
);

for (const [width, height] of SIZES) {
  const view = {
    width,
    height,
    noiseScale: Math.max(
      config.autoScaleMin,
      Math.min(config.autoScaleMax, width * config.autoScaleFactor),
    ),
    time: 7.3,
    seed: SEED,
  };

  const referenceCells = buildCellsReference(width, height, config, SEED);
  const referenceCtx = createCounter();
  const referenceTime = measure(() =>
    paintReference(referenceCtx, referenceCells, view, config),
  );

  const cells = buildFieldCells(width, height, config, SEED);
  const buffers = createFieldRenderBuffers(cells.count);
  const ctx = createCounter();
  const nextTime = measure(() => paintField(ctx, cells, buffers, view, config));

  const label = `${width}x${height}`;
  // 40 measured frames plus the 2 warm-up calls counted above.
  const calls = FRAMES + 2;
  const styles = Math.round(referenceCtx.state.styles / calls);
  const rects = Math.round(referenceCtx.state.rects / calls);
  const nextStyles = Math.round(ctx.state.styles / calls);
  const nextRects = Math.round(ctx.state.rects / calls);

  console.log(
    `${label.padEnd(12)} ${String(cells.count).padStart(6)}  ${'original'.padEnd(10)} ` +
      `${referenceTime.toFixed(2).padStart(8)}  ${String(styles).padStart(17)}  ` +
      `${String(rects).padStart(6)}`,
  );
  console.log(
    `${''.padEnd(12)} ${''.padStart(6)}  ${'batched'.padEnd(10)} ` +
      `${nextTime.toFixed(2).padStart(8)}  ${String(nextStyles).padStart(17)}  ` +
      `${String(nextRects).padStart(6)}`,
  );
  console.log(
    `${''.padEnd(12)} ${''.padStart(6)}  ${'speedup'.padEnd(10)} ` +
      `${(referenceTime / nextTime).toFixed(2).padStart(7)}x` +
      `     ${Math.round((1 - nextStyles / styles) * 100)}% fewer color writes`,
  );
  console.log('');
}
