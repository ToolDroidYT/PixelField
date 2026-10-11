/**
 * The fixed scenarios behind `golden.json`.
 *
 * Kept in their own module so the test and the updater agree by construction.
 * Adding a case here without regenerating is a failure, not a silent skip.
 */
export const GOLDEN_CASES = [
  { name: '1080p t=0', width: 1920, height: 1080, time: 0, seed: 18 },
  { name: '1080p t=7.3', width: 1920, height: 1080, time: 7.3, seed: 1 },
  { name: '720p t=123', width: 1280, height: 720, time: 123.456, seed: -4 },
  { name: 'mobile t=42', width: 390, height: 844, time: 42, seed: 90210 },
  { name: 'small t=0', width: 800, height: 400, time: 0.001, seed: 0 },
  {
    // Overlapping squares take the `drawInOrder` path instead of batching.
    name: 'overlap',
    width: 1280,
    height: 720,
    time: 17.5,
    seed: 3,
    config: { spacing: 16, pixelSize: 15, sizeJitter: 0.5 },
  },
  {
    // Warp off, fewer octaves, no glints: exercises the shortcut branches.
    name: 'no warp, 3 octaves',
    width: 1280,
    height: 720,
    time: 55.25,
    seed: -11,
    config: { warpAmount: 0, octaves: 3, glint: false },
  },
  {
    // Past `maxCells`, so the grid is coarsened by `scale`.
    name: '4K capped',
    width: 3840,
    height: 2160,
    time: 9,
    seed: 42,
  },
];
