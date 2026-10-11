/**
 * Pure noise math, ported 1:1 from the original animated pixel grid prototype.
 * No React, no DOM, no module-level mutable state — `seed` is always a parameter.
 */

/** Stable pseudo-random value per id: no per-frame flicker. */
export function random01(n: number, seed: number): number {
  const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

/**
 * Integer hashing is cheaper than Math.sin for the many noise samples per frame.
 */
export function hash(ix: number, iy: number, seed: number): number {
  let n =
    (Math.imul(ix, 374761393) +
      Math.imul(iy, 668265263) +
      Math.imul(seed, 2246822519)) |
    0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967295;
}

export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

export const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10);

export const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));

/**
 * Smooth, continuous value noise. Adjacent cells sample the same field,
 * so shapes flow organically rather than appearing as random twinkles.
 */
export function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const u = fade(x - x0);
  const v = fade(y - y0);
  const a = hash(x0, y0, seed);
  const b = hash(x1, y0, seed);
  const c = hash(x0, y1, seed);
  const d = hash(x1, y1, seed);
  return mix(mix(a, b, u), mix(c, d, u), v);
}

/**
 * Fractal Brownian motion combines broad blobs with finer details.
 * `octaves` defaults to the prototype's 4; lower is cheaper and softer.
 */
export function fbm(x: number, y: number, seed: number, octaves = 4): number {
  let value = 0;
  let amplitude = 0.55;
  let totalAmplitude = 0;
  let frequency = 1;
  const levels = Math.max(1, Math.floor(octaves));
  for (let octave = 0; octave < levels; octave++) {
    value += valueNoise(x * frequency, y * frequency, seed) * amplitude;
    totalAmplitude += amplitude;
    frequency *= 2.03;
    amplitude *= 0.5;
  }
  return value / totalAmplitude;
}

export function smoothstep(a: number, b: number, x: number): number {
  const span = b - a;
  // A degenerate range would divide by zero and leak NaN into colors and
  // alphas; treat it as a hard step at the shared threshold instead.
  if (span === 0) return x < a ? 0 : 1;
  const t = clamp01((x - a) / span);
  return t * t * (3 - 2 * t);
}
