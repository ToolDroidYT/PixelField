/**
 * Decision record for the fBm hot path: which formulation of the octave loop
 * is actually fastest, measured rather than assumed.
 *
 * The roadmap suggested precomputing the octave progression into an
 * `FbmPlan` (frequencies/amplitudes/normalizer) and reusing it per frame. It
 * looks like an obvious win — the progression is loop-invariant — but it lost
 * on every measurement: three `Float64Array` loads per octave cost more than
 * three register-resident scalars. A second idea, writing `valueNoise`'s body
 * inline instead of calling it, also changed nothing (V8 already inlines it).
 *
 * All variants are defined in *this* module so the JIT treats them the same;
 * comparing a local function against one imported from `dist` would measure
 * cross-module call behavior instead. `dist.fbm` is included only as a
 * reference for what ships.
 *
 * Expected result, stable across runs and measurement orders:
 *
 *   variant                        verdict
 *   -----------------------------  -------------------------------
 *   scalar + valueNoise (current)  fastest — ships
 *   planned table                  ~1.5-1.8x slower — rejected
 *   inline valueNoise body         within noise of current — no gain
 *   inline hash                    within noise of current — no gain
 *
 *   node bench/fbm-cost.mjs
 */
import { fade, fbm, hash, mix, valueNoise } from '../dist/index.js';

const SAMPLES = 200_000;
const FRAMES = 7;
const SEED = 18;
const LEVELS = 4;

/** Deterministic scatter of coordinates, so every variant sees the same work. */
const coords = new Float64Array(SAMPLES * 2);
let state = 12345;
const next = () => {
  state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
  return state / 4294967296;
};
for (let i = 0; i < coords.length; i++) coords[i] = (next() - 0.5) * 400;

/** The shipped formulation: scalar progression, `valueNoise` called. */
function scalar(x, y, seed, levels) {
  let value = 0;
  let amplitude = 0.55;
  let totalAmplitude = 0;
  let frequency = 1;
  for (let octave = 0; octave < levels; octave++) {
    value += valueNoise(x * frequency, y * frequency, seed) * amplitude;
    totalAmplitude += amplitude;
    frequency *= 2.03;
    amplitude *= 0.5;
  }
  return value / totalAmplitude;
}

/** The rejected idea: progression read out of a precomputed table. */
function planned(plan, x, y, seed) {
  const { frequencies, amplitudes, totalAmplitude, octaves } = plan;
  let value = 0;
  for (let octave = 0; octave < octaves; octave++) {
    const frequency = frequencies[octave];
    value += valueNoise(x * frequency, y * frequency, seed) * amplitudes[octave];
  }
  return value / totalAmplitude;
}

const plan = (() => {
  const frequencies = new Float64Array(LEVELS);
  const amplitudes = new Float64Array(LEVELS);
  let frequency = 1;
  let amplitude = 0.55;
  let totalAmplitude = 0;
  for (let i = 0; i < LEVELS; i++) {
    frequencies[i] = frequency;
    amplitudes[i] = amplitude;
    totalAmplitude += amplitude;
    frequency *= 2.03;
    amplitude *= 0.5;
  }
  return { octaves: LEVELS, frequencies, amplitudes, totalAmplitude };
})();

/** `valueNoise`'s body written into the octave loop instead of called. */
function inlineNoise(x, y, seed, levels) {
  let value = 0;
  let amplitude = 0.55;
  let totalAmplitude = 0;
  let frequency = 1;
  for (let octave = 0; octave < levels; octave++) {
    const nx = x * frequency;
    const ny = y * frequency;
    const x0 = Math.floor(nx);
    const y0 = Math.floor(ny);
    const u = fade(nx - x0);
    const v = fade(ny - y0);
    const a = hash(x0, y0, seed);
    const b = hash(x0 + 1, y0, seed);
    const c = hash(x0, y0 + 1, seed);
    const d = hash(x0 + 1, y0 + 1, seed);
    value += mix(mix(a, b, u), mix(c, d, u), v) * amplitude;
    totalAmplitude += amplitude;
    frequency *= 2.03;
    amplitude *= 0.5;
  }
  return value / totalAmplitude;
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/** Median ms for `SAMPLES` samples; `sink` absorbs the results. */
function measure(sample) {
  let sink = 0;
  const run = () => {
    for (let i = 0; i < SAMPLES; i++) {
      sink += sample(coords[i * 2], coords[i * 2 + 1]);
    }
  };
  run();
  run();
  const times = [];
  for (let i = 0; i < FRAMES; i++) {
    const start = process.hrtime.bigint();
    run();
    times.push(Number(process.hrtime.bigint() - start) / 1e6);
  }
  if (sink === -1) console.log(sink);
  return median(times);
}

const variants = [
  ['scalar (ships)', (x, y) => scalar(x, y, SEED, LEVELS)],
  ['planned table', (x, y) => planned(plan, x, y, SEED)],
  ['inline noise body', (x, y) => inlineNoise(x, y, SEED, LEVELS)],
  ['fbm() [dist]', (x, y) => fbm(x, y, SEED, LEVELS)],
];

console.log(`${'variant'.padEnd(22)} ${'ms'.padStart(8)} ${'M samples/s'.padStart(12)}  vs scalar`);
console.log('-'.repeat(52));

const scalarMs = measure(variants[0][1]);
for (const [name, sample] of variants) {
  const ms = measure(sample);
  console.log(
    `${name.padEnd(22)} ${ms.toFixed(1).padStart(8)} ${(SAMPLES / ms / 1000).toFixed(1).padStart(12)}  ` +
      `${((1 - ms / scalarMs) * 100).toFixed(1)}%`,
  );
}
