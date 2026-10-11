import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { clamp01, fbm, random01, smoothstep } from '../lib/noise';

/** One square of the fixed grid. `n` is a stable per-cell random in [0, 1). */
type Cell = {
  x: number;
  y: number;
  n: number;
  size: number;
};

// Tweak these to control density and movement speed.
const SPACING = 16;
const PIXEL_SIZE = 10;
const ANIMATION_SPEED = 4; // 1 = original speed; 1.5 = 1.5x faster

/**
 * Drives the animated pixel field on a `<canvas>` element.
 *
 * Everything that must not trigger a re-render (time, cells, dpr, RAF handle)
 * lives in refs; `running` and `seed` are plain props.
 *
 * @returns the ref to attach to the canvas element.
 */
export function usePixelField(
  running: boolean,
  seed: number,
): RefObject<HTMLCanvasElement | null> {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const widthRef = useRef(0);
  const heightRef = useRef(0);
  const timeRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef(0);
  const noiseScaleRef = useRef(50);
  const cellsRef = useRef<Cell[]>([]);
  const seedRef = useRef(seed);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d', { alpha: true });
  }, []);

  const paint = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;

    const width = widthRef.current;
    const height = heightRef.current;
    const seed = seedRef.current;
    const noiseScale = noiseScaleRef.current;
    const t = timeRef.current;

    ctx.clearRect(0, 0, width, height);

    for (const cell of cellsRef.current) {
      // A shared moving noise field is sampled at every fixed grid position.
      // Domain warping bends it into soft, lava-lamp-like continents.
      const x = cell.x / noiseScale;
      const y = cell.y / noiseScale;

      const warpX = fbm(x + 5.7 + t * 0.12, y - 2.4 - t * 0.075, seed);
      const warpY = fbm(x - 8.1 - t * 0.082, y + 11.3 + t * 0.105, seed);
      const warpedX = x + (warpX - 0.5) * 2.15;
      const warpedY = y + (warpY - 0.5) * 2.15;

      const broad = fbm(warpedX + t * 0.025, warpedY - t * 0.018, seed);
      const detail = fbm(
        x * 1.72 + 19.2 - t * 0.045,
        y * 1.72 - 7.8 + t * 0.032,
        seed,
      );
      const field = clamp01(broad * 0.82 + detail * 0.18);

      // Field height controls brightness. The inner core is brighter, while
      // the soft contour band suggests a raised edge and gives the field depth.
      // Large areas below the threshold are genuinely black (0% brightness),
      // creating breathing room instead of a wall of always-visible squares.
      const visibility = smoothstep(0.43, 0.56, field);
      const body = smoothstep(0.48, 0.72, field);
      const core = smoothstep(0.64, 0.84, field);
      const contour = Math.exp(-Math.pow((field - 0.59) / 0.075, 2));
      const fineLight = smoothstep(0.48, 0.88, detail);

      const brightness = clamp01(body * 0.48 + core * 0.4 + fineLight * 0.12);
      const alpha =
        visibility *
        Math.min(0.3, 0.018 + body * 0.075 + core * 0.085 + contour * 0.025);
      if (alpha < 0.004) continue;

      // Intensity is encoded in both opacity and luminance for a stronger depth cue.
      const r = Math.round(54 + brightness * 132);
      const g = Math.round(51 + brightness * 124);
      const b = Math.round(48 + brightness * 116);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.fillRect(cell.x, cell.y, cell.size, cell.size);

      // Only the brightest cells receive a subtle top-edge glint.
      if (brightness > 0.78 && cell.n > 0.48) {
        ctx.fillStyle = `rgba(235, 225, 213, ${Math.min(0.075, (brightness - 0.78) * 0.22)})`;
        ctx.fillRect(cell.x, cell.y, cell.size, Math.max(1, cell.size * 0.1));
      }
    }
  }, [getCtx]);

  const buildCells = useCallback(() => {
    const cells: Cell[] = [];
    const seed = seedRef.current;
    const cols = Math.ceil(widthRef.current / SPACING) + 2;
    const rows = Math.ceil(heightRef.current / SPACING) + 2;
    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        const id = (row + 1) * 10007 + col + 1;
        cells.push({
          x: col * SPACING,
          y: row * SPACING,
          n: random01(id, seed),
          size: PIXEL_SIZE * (0.94 + random01(id + 31, seed) * 0.12),
        });
      }
    }
    cellsRef.current = cells;
  }, []);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    widthRef.current = rect.width;
    heightRef.current = rect.height;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    getCtx()?.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Scale blob size gently with the canvas, while keeping mobile shapes visible.
    noiseScaleRef.current = Math.max(125, Math.min(270, rect.width * 0.38));
    buildCells();
    paint();
  }, [buildCells, getCtx, paint]);

  // Size tracking: ResizeObserver also catches container-only layout changes
  // that a window resize listener would miss.
  useEffect(() => {
    if (!canvasRef.current) return;
    resize();
    const observer = new ResizeObserver(() => resize());
    observer.observe(canvasRef.current);
    return () => observer.disconnect();
  }, [resize]);

  // Animation loop. `running` toggles it; cleanup keeps StrictMode's
  // double-invoked effects from leaking a second RAF loop.
  useEffect(() => {
    if (!canvasRef.current) return;

    const frame = (now: number) => {
      const last = lastTimeRef.current;
      const dt = last ? Math.min(now - last, 40) : 16;
      lastTimeRef.current = now;
      timeRef.current += dt * 0.00034 * ANIMATION_SPEED;
      paint();
      rafRef.current = requestAnimationFrame(frame);
    };

    const cancelFrame = () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      lastTimeRef.current = 0;
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        cancelFrame();
      } else if (running && !rafRef.current) {
        lastTimeRef.current = 0;
        rafRef.current = requestAnimationFrame(frame);
      }
    };

    if (!running) {
      // Frozen frame: cancel, then repaint so the last state stays visible.
      cancelFrame();
      paint();
      return;
    }

    document.addEventListener('visibilitychange', onVisibilityChange);
    rafRef.current = requestAnimationFrame(frame);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      cancelFrame();
    };
  }, [paint, running]);

  // A new seed rebuilds the cell randoms — the equivalent of the prototype's
  // regenerate handler. Skipped on mount, where `resize()` already built them.
  useEffect(() => {
    if (seedRef.current === seed) return;
    seedRef.current = seed;
    buildCells();
    paint();
  }, [buildCells, paint, seed]);

  return canvasRef;
}
