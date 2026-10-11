/**
 * Pure noise math, ported 1:1 from prototype/animated-pixel-grid.html.
 * No React, no DOM, no module-level mutable state — `seed` is always a parameter.
 */

/** Stable pseudo-random value per id: no per-frame flicker. */
export function random01(n: number, seed: number): number {
  const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453123
  return x - Math.floor(x)
}

/**
 * Integer hashing is cheaper than Math.sin for the many noise samples per frame.
 */
export function hash(ix: number, iy: number, seed: number): number {
  let n =
    (Math.imul(ix, 374761393) +
      Math.imul(iy, 668265263) +
      Math.imul(seed, 2246822519)) |
    0
  n = Math.imul(n ^ (n >>> 13), 1274126177)
  n ^= n >>> 16
  return (n >>> 0) / 4294967295
}

export const mix = (a: number, b: number, t: number): number => a + (b - a) * t

export const fade = (t: number): number => t * t * t * (t * (t * 6 - 15) + 10)

export const clamp01 = (n: number): number => Math.max(0, Math.min(1, n))

/**
 * Smooth, continuous value noise. Adjacent cells sample the same field,
 * so shapes flow organically rather than appearing as random twinkles.
 */
export function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = x0 + 1
  const y1 = y0 + 1
  const u = fade(x - x0)
  const v = fade(y - y0)
  const a = hash(x0, y0, seed)
  const b = hash(x1, y0, seed)
  const c = hash(x0, y1, seed)
  const d = hash(x1, y1, seed)
  return mix(mix(a, b, u), mix(c, d, u), v)
}

/** Fractal Brownian motion combines broad blobs with finer details. */
export function fbm(x: number, y: number, seed: number): number {
  let value = 0
  let amplitude = 0.55
  let totalAmplitude = 0
  let frequency = 1
  for (let octave = 0; octave < 4; octave++) {
    value += valueNoise(x * frequency, y * frequency, seed) * amplitude
    totalAmplitude += amplitude
    frequency *= 2.03
    amplitude *= 0.5
  }
  return value / totalAmplitude
}

export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
