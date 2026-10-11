import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { buildFieldCells, type FieldCells } from '../lib/cells';
import {
  pixelFieldConfigEquals,
  pixelFieldLayoutKey,
  resolvePixelFieldConfig,
  type PixelFieldConfig,
} from '../lib/pixelFieldConfig';
import {
  createFieldRenderBuffers,
  paintField,
  type FieldRenderBuffers,
  type FieldView,
} from '../lib/renderField';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Base clock step per millisecond; `speed` scales it (`1` = the original rate). */
const TIME_STEP = 0.00136;

/**
 * Drives the animated pixel field on a `<canvas>` element.
 *
 * Everything that must not trigger a re-render (time, cells, dpr, RAF handle,
 * resolved config, render buffers) lives in refs; `running`, `seed` and
 * `config` are plain props. Config changes are picked up live: color and
 * behavior tweaks repaint on the next frame (or immediately while paused), and
 * grid-affecting values rebuild the cells.
 *
 * The loop also idles aggressively: it stops while the canvas is off-screen,
 * while the document is hidden, while the OS asks for reduced motion, and
 * whenever the clock is frozen (a no-op repaint is skipped entirely).
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
  const cellsRef = useRef<FieldCells | null>(null);
  const buffersRef = useRef<FieldRenderBuffers | null>(null);
  const seedRef = useRef(seed);
  // Reused per frame so painting allocates nothing.
  const viewRef = useRef<FieldView>({
    width: 0,
    height: 0,
    noiseScale: 50,
    time: 0,
    seed: 0,
  });

  const resolvedConfig = useMemo(
    () => resolvePixelFieldConfig(config),
    [config],
  );
  const configRef = useRef(resolvedConfig);

  // The resolved config feeds the RAF/observer callbacks through a ref so
  // config tweaks never re-subscribe those effects. Parents may pass an inline
  // object literal every render, so identity alone is not a change signal:
  // compare by value and only bump an epoch when something actually differs.
  // This effect is declared first — the ones below read the ref in the same
  // commit.
  const [configEpoch, setConfigEpoch] = useState(0);
  const appliedConfigRef = useRef(resolvedConfig);
  useEffect(() => {
    const previous = appliedConfigRef.current;
    if (previous === resolvedConfig) return;
    appliedConfigRef.current = resolvedConfig;
    configRef.current = resolvedConfig;
    if (pixelFieldConfigEquals(previous, resolvedConfig)) return;
    setConfigEpoch((epoch) => epoch + 1);
  }, [resolvedConfig]);

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext('2d', { alpha: true });
  }, []);

  const paint = useCallback(() => {
    const ctx = getCtx();
    const cells = cellsRef.current;
    if (!ctx || !cells) return;
    const width = widthRef.current;
    const height = heightRef.current;
    if (width <= 0 || height <= 0) return;

    let buffers = buffersRef.current;
    if (!buffers) {
      buffers = createFieldRenderBuffers(cells.count);
      buffersRef.current = buffers;
    }

    const view = viewRef.current;
    view.width = width;
    view.height = height;
    view.noiseScale = noiseScaleRef.current;
    view.time = timeRef.current;
    view.seed = seedRef.current;
    paintField(ctx, cells, buffers, view, configRef.current);
  }, [getCtx]);

  const buildCells = useCallback(() => {
    cellsRef.current = buildFieldCells(
      widthRef.current,
      heightRef.current,
      configRef.current,
      seedRef.current,
    );
  }, []);

  /**
   * Measures the canvas (unless a size is supplied), sizes the backing store
   * to the device pixel ratio, and rebuilds the grid only when something it
   * depends on actually changed.
   */
  const syncSize = useCallback(
    (width?: number, height?: number, forceCells = false) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const cfg = configRef.current;

      let w = width;
      let h = height;
      if (w === undefined || h === undefined) {
        const rect = canvas.getBoundingClientRect();
        w = rect.width;
        h = rect.height;
      }

      const dpr = Math.min(
        window.devicePixelRatio || 1,
        Math.max(1, cfg.maxDpr),
      );
      const backingWidth = Math.round(w * dpr);
      const backingHeight = Math.round(h * dpr);
      const sizeChanged = w !== widthRef.current || h !== heightRef.current;
      widthRef.current = w;
      heightRef.current = h;

      // Assigning the backing store clears it and resets the transform, so
      // only touch it when the target differs — a DPR-only change then costs
      // one repaint instead of a rebuild.
      if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
        canvas.width = backingWidth;
        canvas.height = backingHeight;
        getCtx()?.setTransform(dpr, 0, 0, dpr, 0, 0);
      }

      if (sizeChanged || forceCells || !cellsRef.current) buildCells();

      // Scale blob size gently with the canvas, while keeping mobile shapes visible.
      const baseNoiseScale =
        cfg.noiseScale === 'auto'
          ? Math.max(
              cfg.autoScaleMin,
              Math.min(cfg.autoScaleMax, w * cfg.autoScaleFactor),
            )
          : cfg.noiseScale;
      noiseScaleRef.current = baseNoiseScale;

      paint();
    },
    [buildCells, getCtx, paint],
  );

  // Size tracking: ResizeObserver also catches container-only layout changes
  // that a window resize listener would miss. Measuring only when notified
  // keeps `getBoundingClientRect` (which can force layout) off the render path.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    syncSize(undefined, undefined, true);
    const observer = new ResizeObserver(() => syncSize());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [syncSize]);

  // Moving between displays (or zooming) changes `devicePixelRatio` without
  // changing the element's size, which the ResizeObserver never sees.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const watch = () =>
      window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    let media = watch();
    const onChange = () => {
      syncSize();
      media = watch();
      media.addEventListener('change', onChange);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [syncSize]);

  // Off-screen fields keep running for free otherwise; scrolling one back into
  // view resumes the loop, which repaints on its first frame.
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) =>
      setInView(entries[entries.length - 1].isIntersecting),
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const respectReducedMotion = resolvedConfig.respectReducedMotion;
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia(REDUCED_MOTION_QUERY).matches,
  );
  // Track the preference unconditionally and gate on `respectReducedMotion`
  // at the point of use, so flipping that flag never needs a re-subscribe (or
  // a state reset inside an effect).
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = () => setPrefersReducedMotion(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const active =
    running && inView && !(respectReducedMotion && prefersReducedMotion);

  // Animation loop. `active` gates it; cleanup keeps StrictMode's
  // double-invoked effects from leaking a second RAF loop.
  useEffect(() => {
    if (!canvasRef.current) return;

    const frame = (now: number) => {
      const cfg = configRef.current;
      const last = lastTimeRef.current;
      const dt = last ? Math.min(now - last, cfg.maxFrameDelta) : 16;
      lastTimeRef.current = now;
      const next = timeRef.current + dt * TIME_STEP * cfg.speed;
      // A frozen clock (`speed: 0`) would repaint an identical frame.
      if (next !== timeRef.current) {
        timeRef.current = next;
        paint();
      }
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
      } else if (active && !rafRef.current) {
        lastTimeRef.current = 0;
        rafRef.current = requestAnimationFrame(frame);
      }
    };

    if (!active) {
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
  }, [paint, active]);

  // A new seed rebuilds the cell randoms — the equivalent of the prototype's
  // regenerate handler. Skipped on mount, where `syncSize()` already built them.
  useEffect(() => {
    if (seedRef.current === seed) return;
    seedRef.current = seed;
    buildCells();
    paint();
  }, [buildCells, paint, seed]);

  // Config changes repaint immediately (essential while paused) and rebuild
  // the grid when a layout value changes. Runs only when a value really
  // changed, so inline object literals don't churn it every render.
  const appliedLayoutRef = useRef<string | null>(null);

  useEffect(() => {
    const layoutKey = pixelFieldLayoutKey(configRef.current);
    if (appliedLayoutRef.current === null) {
      // The initial pass already happened via `syncSize()` above.
      appliedLayoutRef.current = layoutKey;
      return;
    }
    if (appliedLayoutRef.current === layoutKey) {
      paint();
      return;
    }
    appliedLayoutRef.current = layoutKey;
    syncSize();
  }, [configEpoch, paint, syncSize]);

  return canvasRef;
}
