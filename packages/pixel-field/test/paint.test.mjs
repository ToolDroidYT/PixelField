import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFieldCells,
  createFieldRenderBuffers,
  DEFAULT_PIXEL_FIELD_CONFIG,
  paintField,
  resolvePixelFieldConfig,
} from '../dist/index.js';
import {
  buildCellsReference,
  createRecorder,
  groupByGeometry,
  paintReference,
  parseStyle,
} from './reference.mjs';

const autoNoiseScale = (width, config) =>
  Math.max(
    config.autoScaleMin,
    Math.min(config.autoScaleMax, width * config.autoScaleFactor),
  );

function renderBoth({ width, height, time, seed, config }) {
  const cfg = resolvePixelFieldConfig(config);
  const view = {
    width,
    height,
    noiseScale: autoNoiseScale(width, cfg),
    time,
    seed,
  };

  const reference = createRecorder();
  paintReference(
    reference,
    buildCellsReference(width, height, cfg, seed),
    view,
    cfg,
  );

  const cells = buildFieldCells(width, height, cfg, seed);
  const next = createRecorder();
  paintField(next, cells, createFieldRenderBuffers(cells.count), view, cfg);

  return { cfg, view, reference, next, cells };
}

const SCENARIOS = [
  { width: 1920, height: 1080, time: 0, seed: 18 },
  { width: 1920, height: 1080, time: 7.3, seed: 1 },
  { width: 1280, height: 720, time: 123.456, seed: -4 },
  { width: 390, height: 844, time: 42, seed: 90210 },
  { width: 800, height: 400, time: 0.001, seed: 0 },
];

test('cell grid matches the original generation exactly', () => {
  for (const { width, height, seed } of SCENARIOS) {
    const cfg = resolvePixelFieldConfig();
    const expected = buildCellsReference(width, height, cfg, seed);
    const actual = buildFieldCells(width, height, cfg, seed);

    assert.equal(actual.count, expected.length, `${width}x${height} count`);
    for (let i = 0; i < expected.length; i++) {
      assert.equal(actual.x[i], expected[i].x, `${width}x${height} x[${i}]`);
      assert.equal(actual.y[i], expected[i].y, `${width}x${height} y[${i}]`);
      assert.equal(
        actual.size[i],
        expected[i].size,
        `${width}x${height} size[${i}]`,
      );
      assert.equal(actual.n[i], expected[i].n, `${width}x${height} n[${i}]`);
    }
  }
});

test('draws the same visible cells as the original renderer', () => {
  for (const scenario of SCENARIOS) {
    const { reference, next, view } = renderBoth(scenario);
    const expected = groupByGeometry(reference.ops, view.width, view.height);
    const actual = groupByGeometry(next.ops, view.width, view.height);

    const label = `${scenario.width}x${scenario.height} t=${scenario.time}`;
    assert.deepEqual(
      [...actual.keys()].sort(),
      [...expected.keys()].sort(),
      `${label}: drawn rect set diverged`,
    );
    for (const [key, styles] of expected) {
      assert.equal(
        actual.get(key)?.length,
        styles.length,
        `${label}: ${key} drawn a different number of times`,
      );
    }
  }
});

test('quantized colors stay within a hair of the originals', () => {
  for (const scenario of SCENARIOS) {
    const { cfg, reference, next, view } = renderBoth(scenario);
    const expected = groupByGeometry(reference.ops, view.width, view.height);
    const actual = groupByGeometry(next.ops, view.width, view.height);
    const label = `${scenario.width}x${scenario.height} t=${scenario.time}`;

    // Brightness is bucketed to 1/64 (~1-2 levels of a 132-wide ramp) and
    // alpha to alphaCap/64 (~0.0023); both are far below perceptibility.
    const colorTolerance = Math.ceil(Math.max(...cfg.colorRange) / 64);
    const alphaTolerance = cfg.alphaCap / 64;
    const glintTolerance = cfg.glintAlpha / 32;

    for (const [key, styles] of expected) {
      const got = actual.get(key);
      assert.ok(got, `${label}: ${key} missing`);
      for (let i = 0; i < styles.length; i++) {
        const before = parseStyle(styles[i]);
        const after = parseStyle(got[i]);
        assert.ok(
          Math.abs(before.r - after.r) <= colorTolerance &&
            Math.abs(before.g - after.g) <= colorTolerance &&
            Math.abs(before.b - after.b) <= colorTolerance,
          `${label}: ${key} rgb ${styles[i]} vs ${got[i]}`,
        );
        const isGlint =
          after.b === cfg.glintColor[2] && before.b === cfg.glintColor[2];
        assert.ok(
          Math.abs(before.a - after.a) <=
            (isGlint ? glintTolerance : alphaTolerance),
          `${label}: ${key} alpha ${before.a} vs ${after.a}`,
        );
      }
    }
  }
});

test('culling only ever drops rects that were off-canvas anyway', () => {
  for (const scenario of SCENARIOS) {
    const { reference, next, view } = renderBoth(scenario);
    const drawn = new Set(
      next.ops
        .filter((op) => op.kind === 'rect')
        .map((op) => `${op.x}|${op.y}|${op.w}|${op.h}`),
    );
    for (const op of reference.ops) {
      if (op.kind !== 'rect') continue;
      const onCanvas =
        op.x < view.width &&
        op.y < view.height &&
        op.x + op.w > 0 &&
        op.y + op.h > 0;
      if (!onCanvas) continue;
      assert.ok(
        drawn.has(`${op.x}|${op.y}|${op.w}|${op.h}`),
        `${view.width}x${view.height}: visible cell at ${op.x},${op.y} was dropped`,
      );
    }
  }
});

test('batches color changes instead of assigning one per cell', () => {
  for (const scenario of SCENARIOS) {
    const { reference, next, view } = renderBoth(scenario);
    const visibleRects = next.ops.filter(
      (op) =>
        op.kind === 'rect' &&
        op.x < view.width &&
        op.y < view.height &&
        op.x + op.w > 0 &&
        op.y + op.h > 0,
    ).length;

    // Small viewports have few cells to amortize over, so the floor is
    // deliberately loose; at 1080p the real ratio is an order of magnitude.
    assert.ok(
      next.styleWrites < reference.styleWrites / 3,
      `${scenario.width}x${scenario.height}: ${next.styleWrites} fillStyle writes ` +
        `for ${visibleRects} cells (reference: ${reference.styleWrites})`,
    );
  }
});

test('degenerate configs resolve and render without NaN', () => {
  const cfg = resolvePixelFieldConfig({
    spacing: -3,
    pixelSize: NaN,
    octaves: 1e9,
    detailWeight: 5,
    contourWidth: 0,
    visibilityRange: [0.5, 0.5],
    colorBase: [999, Number.NaN, -5],
    alphaCap: Number.POSITIVE_INFINITY,
    minAlpha: 'nope',
    respectReducedMotion: 0,
  });

  assert.equal(cfg.spacing, 1);
  assert.equal(cfg.pixelSize, DEFAULT_PIXEL_FIELD_CONFIG.pixelSize);
  assert.equal(cfg.octaves, 8);
  assert.equal(cfg.detailWeight, 1);
  assert.equal(cfg.contourWidth, 1e-4);
  assert.deepEqual([...cfg.visibilityRange], [0.5, 0.5]);
  assert.deepEqual([...cfg.colorBase], [255, 51, 0]);
  assert.equal(cfg.alphaCap, DEFAULT_PIXEL_FIELD_CONFIG.alphaCap);
  assert.equal(cfg.minAlpha, DEFAULT_PIXEL_FIELD_CONFIG.minAlpha);
  assert.equal(cfg.respectReducedMotion, false);

  const width = 120;
  const height = 90;
  const view = { width, height, noiseScale: 125, time: 3, seed: 7 };
  const cells = buildFieldCells(width, height, cfg, view.seed);
  const recorder = createRecorder();
  paintField(recorder, cells, createFieldRenderBuffers(cells.count), view, cfg);

  for (const op of recorder.ops) {
    if (op.kind !== 'rect') continue;
    const { r, g, b, a } = parseStyle(op.style);
    assert.ok(
      Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b),
      op.style,
    );
    assert.ok(Number.isFinite(a), op.style);
  }
});

test('defaults are frozen and shared, and never mutated by resolution', () => {
  assert.ok(Object.isFrozen(DEFAULT_PIXEL_FIELD_CONFIG));
  assert.ok(Object.isFrozen(DEFAULT_PIXEL_FIELD_CONFIG.colorBase));

  const first = resolvePixelFieldConfig();
  const second = resolvePixelFieldConfig({ spacing: 20 });
  assert.equal(first, DEFAULT_PIXEL_FIELD_CONFIG);
  assert.notEqual(second, DEFAULT_PIXEL_FIELD_CONFIG);
  assert.equal(second.spacing, 20);
  assert.equal(DEFAULT_PIXEL_FIELD_CONFIG.spacing, 16);
  assert.ok(Object.isFrozen(second));
});
