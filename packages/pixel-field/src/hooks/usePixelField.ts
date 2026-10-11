import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import { clamp01, fbm, random01, smoothstep } from '../lib/noise';
import {
  pixelFieldLayoutKey,
  resolvePixelFieldConfig,
  type PixelFieldConfig,
} from '../lib/pixelFieldConfig';

/** One square of the fixed grid. `n` is a stable per-cell random in [0, 1). */
type Cell = {
  x: number;
  y: number;
  n: number;
  size: number;
};

/** Base clock step per millisecond; `speed` scales it (`1` = the original rate). */
const TIME_STEP = 0.00136;

/**
 * Drives the animated pixel field on a `<canvas>` element.
 *
 * Everything that must not trigger a re-render (time, cells, dpr, RAF handle,
 * resolved config) lives in refs; `running`, `seed` and `config` are plain
 * props. Config changes are picked up live: color and behavior tweaks
 * repaint on the next frame (or immediately while paused), and grid-affecting
 * values rebuild the cells.
 *
 * @returns the ref to attach to the canvas element.
 */
export function usePixelField(
  running: boolean,
  seed: number,
  config?: PixelFieldConfig,
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

  // The resolved config feeds the RAF/observer callbacks through a ref so
  // config tweaks never re-subscribe those effects. The ref is kept fresh in
  // an effect (declared before the ones that read it) rather than during
  // render; parents may pass an inline object literal every render, so the
  // serialized form below is what actually triggers config updates.
  const resolvedConfig = useMemo(
    () => resolvePixelFieldConfig(config),
    [config],
  );
  const configRef = useRef(resolvedConfig);

  useEffect(() => {
    configRef.current = resolvedConfig;
  }, [resolvedConfig]);

  const configKey = useMemo(
    () => JSON.stringify(resolvedConfig),
    [resolvedConfig],
  );

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d', { alpha: true });
  }, []);

  const paint = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;

    const cfg = configRef.current;
    const width = widthRef.current;
    const height = heightRef.current;
    const seed = seedRef.current;
    const noiseScale = noiseScaleRef.current;
    // `speed` is baked into the clock by the frame loop, not here.
    const t = timeRef.current;
    const flow = cfg.flowSpeed;
    const warp = t * cfg.warpSpeed;

    ctx.clearRect(0, 0, width, height);

    for (const cell of cellsRef.current) {
      // A shared moving noise field is sampled at every fixed grid position.
      // Domain warping bends it into soft, lava-lamp-like continents.
      const x = cell.x / noiseScale;
      const y = cell.y / noiseScale;

      const warpX = fbm(
        x + 5.7 + warp * 0.12,
        y - 2.4 - warp * 0.075,
        seed,
        cfg.octaves,
      );
      const warpY = fbm(
        x - 8.1 - warp * 0.082,
        y + 11.3 + warp * 0.105,
        seed,
        cfg.octaves,
      );
      const warpedX = x + (warpX - 0.5) * cfg.warpAmount;
      const warpedY = y + (warpY - 0.5) * cfg.warpAmount;

      const broad = fbm(
        warpedX + t * 0.025 * flow,
        warpedY - t * 0.018 * flow,
        seed,
        cfg.octaves,
      );
      const detail = fbm(
        x * cfg.detailScale + 19.2 - t * 0.045 * flow,
        y * cfg.detailScale - 7.8 + t * 0.032 * flow,
        seed,
        cfg.octaves,
      );
      const field = clamp01(
        broad * (1 - cfg.detailWeight) + detail * cfg.detailWeight,
      );

      // Field height controls brightness. The inner core is brighter, while
      // the soft contour band suggests a raised edge and gives the field depth.
      // Large areas below the threshold are genuinely black (0% brightness),
      // creating breathing room instead of a wall of always-visible squares.
      const visibility = smoothstep(
        cfg.visibilityRange[0],
        cfg.visibilityRange[1],
        field,
      );
      const body = smoothstep(cfg.bodyRange[0], cfg.bodyRange[1], field);
      const core = smoothstep(cfg.coreRange[0], cfg.coreRange[1], field);
      const contour = Math.exp(
        -Math.pow((field - cfg.contourCenter) / cfg.contourWidth, 2),
      );
      const fineLight = smoothstep(cfg.fineRange[0], cfg.fineRange[1], detail);

      const brightness = clamp01(
        body * cfg.bodyBrightness +
          core * cfg.coreBrightness +
          fineLight * cfg.fineBrightness,
      );
      const alpha =
        visibility *
        Math.min(
          cfg.alphaCap,
          cfg.alphaBase +
            body * cfg.bodyAlpha +
            core * cfg.coreAlpha +
            contour * cfg.contourAlpha,
        );
      if (alpha < cfg.minAlpha) continue;

      // Intensity is encoded in both opacity and luminance for a stronger depth cue.
      const r = Math.round(cfg.colorBase[0] + brightness * cfg.colorRange[0]);
      const g = Math.round(cfg.colorBase[1] + brightness * cfg.colorRange[1]);
      const b = Math.round(cfg.colorBase[2] + brightness * cfg.colorRange[2]);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
      ctx.fillRect(cell.x, cell.y, cell.size, cell.size);

      // Only the brightest cells receive a subtle top-edge glint.
      if (
        cfg.glint &&
        brightness > cfg.glintMinBrightness &&
        cell.n > 1 - cfg.glintChance
      ) {
        const glintAlpha = Math.min(
          cfg.glintAlpha,
          (brightness - cfg.glintMinBrightness) * cfg.glintFalloff,
        );
        ctx.fillStyle = `rgba(${cfg.glintColor[0]}, ${cfg.glintColor[1]}, ${cfg.glintColor[2]}, ${glintAlpha})`;
        ctx.fillRect(
          cell.x,
          cell.y,
          cell.size,
          Math.max(1, cell.size * cfg.glintHeightRatio),
        );
      }
    }
  }, [getCtx]);

  const buildCells = useCallback(() => {
    const cfg = configRef.current;
    // Guard against a degenerate pitch, which would loop forever.
    const spacing = Math.max(1, cfg.spacing);
    const cells: Cell[] = [];
    const seed = seedRef.current;
    const cols = Math.ceil(widthRef.current / spacing) + 2;
    const rows = Math.ceil(heightRef.current / spacing) + 2;
    for (let row = -1; row < rows; row++) {
      for (let col = -1; col < cols; col++) {
        const id = (row + 1) * 10007 + col + 1;
        cells.push({
          x: col * spacing,
          y: row * spacing,
          n: random01(id, seed),
          size:
            cfg.pixelSize *
            (1 - cfg.sizeJitter / 2 + random01(id + 31, seed) * cfg.sizeJitter),
        });
      }
    }
    cellsRef.current = cells;
  }, []);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cfg = configRef.current;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, Math.max(1, cfg.maxDpr));
    widthRef.current = rect.width;
    heightRef.current = rect.height;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    getCtx()?.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Scale blob size gently with the canvas, while keeping mobile shapes visible.
    noiseScaleRef.current =
      typeof cfg.noiseScale === 'number'
        ? Math.max(1e-6, cfg.noiseScale)
        : Math.max(
            cfg.autoScaleMin,
            Math.min(cfg.autoScaleMax, rect.width * cfg.autoScaleFactor),
          );
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
      const cfg = configRef.current;
      const last = lastTimeRef.current;
      const dt = last ? Math.min(now - last, cfg.maxFrameDelta) : 16;
      lastTimeRef.current = now;
      timeRef.current += dt * TIME_STEP * cfg.speed;
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

  // Config changes repaint immediately (essential while paused) and rebuild
  // the grid when a layout value changes. Keyed on the serialized config so
  // inline object literals don't churn this effect every render.
  const appliedLayoutRef = useRef(pixelFieldLayoutKey(resolvedConfig));
  const isFirstConfigRef = useRef(true);

  useEffect(() => {
    // The initial pass already happened via `resize()` above.
    if (isFirstConfigRef.current) {
      isFirstConfigRef.current = false;
      return;
    }
    const layoutKey = pixelFieldLayoutKey(configRef.current);
    if (appliedLayoutRef.current === layoutKey) {
      paint();
      return;
    }
    appliedLayoutRef.current = layoutKey;
    resize();
  }, [configKey, paint, resize]);

  return canvasRef;
}
