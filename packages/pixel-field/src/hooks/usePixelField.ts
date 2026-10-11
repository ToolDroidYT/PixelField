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

/** Quiet period a burst of resize notifications must reach before syncing. */
const SYNC_SETTLE_MS = 300;
/** Hard cap on how long a gesture can keep deferring the sync. */
const SYNC_MAX_WAIT_MS = 750;

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
  // Deferred sync, if one is waiting out a burst of resize notifications.
  const syncPendingRef = useRef<{ timer: number; since: number } | null>(null);
  const syncLastRef = useRef(0);
  // True while riding out a resize burst: the loop holds its frames instead of
  // repainting a canvas the browser is already stretching for free.
  const settlingRef = useRef(false);
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
      // If `maxCells` coarsened the grid, coarsen the field with it: the
      // pattern then stays the same size on screen rather than swelling.
      noiseScaleRef.current = baseNoiseScale * (cellsRef.current?.scale ?? 1);

      paint();
    },
    [buildCells, getCtx, paint],
  );

  /** Runs a deferred sync, cancelling whichever timer was waiting to. */
  const runSync = useCallback(() => {
    const pending = syncPendingRef.current;
    if (pending) clearTimeout(pending.timer);
    syncPendingRef.current = null;
    settlingRef.current = false;
    syncLastRef.current = performance.now();
    syncSize();
  }, [syncSize]);

  /**
   * Resize notifications arrive in bursts: browser zoom changes the element
   * size and `devicePixelRatio` at once, so the ResizeObserver and a
   * media-query change fire together, then again on every step of a Ctrl+scroll
   * or window drag. Each sync measures the layout, may rebuild the whole grid,
   * and reallocates the backing store — one per notification freezes the page
   * for as long as the gesture lasts, and the canvas bitmap is only stretched
   * by CSS in the meantime anyway.
   *
   * So a lone notification runs immediately (a single resize stays crisp and
   * instant), while a burst is debounced: every new notification pushes the
   * trailing sync out and cancels the older pending one, so the work is never
   * queued up behind itself — and the loop holds its frames for the duration,
   * which is what actually pays off, since the paint dwarfs the measurement.
   * `SYNC_MAX_WAIT_MS` bounds how long a gesture that never settles can defer
   * it, so a long window drag still tracks rather than freezing.
   */
  const scheduleSync = useCallback(() => {
    const now = performance.now();
    const pending = syncPendingRef.current;
    // "Burst" is a notification arriving either while a trailing sync is still
    // armed or right on the heels of one that just ran — the pair of
    // notifications a single zoom step produces is exactly that shape.
    if (!pending && now - syncLastRef.current >= SYNC_SETTLE_MS) {
      runSync();
      return;
    }
    const since = pending?.since ?? syncLastRef.current;
    if (now - since >= SYNC_MAX_WAIT_MS) {
      runSync();
      return;
    }
    if (pending) clearTimeout(pending.timer);
    settlingRef.current = true;
    syncPendingRef.current = {
      since,
      timer: window.setTimeout(runSync, SYNC_SETTLE_MS),
    };
  }, [runSync]);

  // Size tracking: ResizeObserver also catches container-only layout changes
  // that a window resize listener would miss. Measuring only when notified
  // keeps `getBoundingClientRect` (which can force layout) off the render path.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    syncSize(undefined, undefined, true);
    const observer = new ResizeObserver(() => scheduleSync());
    observer.observe(canvas);
    return () => {
      observer.disconnect();
      const pending = syncPendingRef.current;
      if (pending) clearTimeout(pending.timer);
      syncPendingRef.current = null;
      settlingRef.current = false;
    };
  }, [scheduleSync, syncSize]);

  // Moving between displays (or zooming) changes `devicePixelRatio` without
  // changing the element's size, which the ResizeObserver never sees.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const watch = () =>
      window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    let media = watch();
    const onChange = () => {
      // The measurement is deferred; re-subscribing is not, so a second zoom
      // step in the same frame is still caught.
      scheduleSync();
      media = watch();
      media.addEventListener('change', onChange);
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [scheduleSync]);

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
      // Hold the frame when the clock is frozen (`speed: 0` — it would repaint
      // an identical frame) or while a resize burst is in flight: the browser
      // is already stretching the last bitmap for free, and the trailing sync
      // repaints once it settles. Time pauses rather than skipping ahead, so
      // the motion resumes from where it left off.
      if (next !== timeRef.current && !settlingRef.current) {
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
