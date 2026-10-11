import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PIXEL_FIELD_CONFIG as DEFAULTS,
  fbm,
  pixelFieldConfigEquals,
  pixelFieldLayoutKey,
  random01,
  resolvePixelFieldConfig,
  smoothstep,
  valueNoise,
} from '../dist/index.js';

test('smoothstep stays finite across degenerate and extreme ranges', () => {
  assert.equal(smoothstep(0.5, 0.5, 0.49), 0);
  assert.equal(smoothstep(0.5, 0.5, 0.5), 1);
  assert.equal(smoothstep(0, 1, -10), 0);
  assert.equal(smoothstep(0, 1, 10), 1);
  assert.equal(smoothstep(0, 1, 0.5), 0.5);
  // Inverted ranges still resolve instead of returning NaN.
  assert.equal(smoothstep(1, 0, 2), 0);
});

test('noise stays in [0, 1] and is deterministic in (x, y, seed)', () => {
  for (const seed of [0, 1, -17, 1234.5]) {
    for (let i = 0; i < 200; i++) {
      const x = Math.sin(i * 1.7) * 30;
      const y = Math.cos(i * 0.9) * 30;
      const value = valueNoise(x, y, seed);
      assert.ok(value >= 0 && value <= 1, `valueNoise ${value}`);
      assert.equal(value, valueNoise(x, y, seed), 'not deterministic');
      const fractal = fbm(x, y, seed, 4);
      assert.ok(fractal >= 0 && fractal <= 1, `fbm ${fractal}`);
    }
  }
  assert.equal(random01(42, 7), random01(42, 7));
  assert.notEqual(random01(42, 7), random01(43, 7));
});

test('resolution ignores unknown keys and lets undefined fall back', () => {
  const resolved = resolvePixelFieldConfig({
    spacing: 40,
    spacingTypo: 99,
    colorBase: undefined,
  });
  assert.equal(resolved.spacing, 40);
  assert.deepEqual([...resolved.colorBase], [...DEFAULTS.colorBase]);
  assert.equal('spacingTypo' in resolved, false);

  // The fps cap normalizes like the other scalars: finite values clamp into
  // the documented span, `0` uncaps, and junk falls back to the default.
  assert.equal(resolvePixelFieldConfig().maxFps, 30);
  assert.equal(resolvePixelFieldConfig({ maxFps: 0 }).maxFps, 0);
  assert.equal(resolvePixelFieldConfig({ maxFps: -5 }).maxFps, 0);
  assert.equal(resolvePixelFieldConfig({ maxFps: 1e9 }).maxFps, 240);
  assert.equal(resolvePixelFieldConfig({ maxFps: 59.4 }).maxFps, 59);
  assert.equal(resolvePixelFieldConfig({ maxFps: 59.5 }).maxFps, 60);
  assert.equal(resolvePixelFieldConfig({ maxFps: Number.NaN }).maxFps, 30);

  // And it takes part in value equality like every other key.
  assert.equal(
    pixelFieldConfigEquals(
      resolvePixelFieldConfig({ maxFps: 30 }),
      resolvePixelFieldConfig({ maxFps: 60 }),
    ),
    false,
  );
});

test('config equality compares tuples by value, not identity', () => {
  const a = resolvePixelFieldConfig({ colorBase: [1, 2, 3] });
  const b = resolvePixelFieldConfig({ colorBase: [1, 2, 3] });
  assert.notEqual(a, b);
  assert.ok(pixelFieldConfigEquals(a, b));

  const c = resolvePixelFieldConfig({ colorBase: [1, 2, 4] });
  assert.equal(pixelFieldConfigEquals(a, c), false);

  const d = resolvePixelFieldConfig({ speed: 2 });
  assert.equal(pixelFieldConfigEquals(a, d), false);

  // Only a layout value should invalidate the grid; color and speed do not.
  assert.equal(
    pixelFieldLayoutKey(a),
    pixelFieldLayoutKey(resolvePixelFieldConfig({ speed: 2 })),
  );
  assert.notEqual(
    pixelFieldLayoutKey(a),
    pixelFieldLayoutKey(resolvePixelFieldConfig({ spacing: 32 })),
  );
});
