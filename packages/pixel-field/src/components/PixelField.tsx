import { forwardRef, useCallback, type CSSProperties } from 'react';
import { usePixelField } from '../hooks/usePixelField';
import type { PixelFieldConfig } from '../lib/pixelFieldConfig';

export type PixelFieldProps = {
  /** Whether the field is animating. Controlled by the parent. */
  running: boolean;
  /** Bump to regenerate the pattern with a new seed. Controlled by the parent. */
  seed: number;
  /**
   * Optional overrides for the field's look and behavior. Every key is
   * optional and merged over the defaults, so partial configs are safe and
   * omitting it entirely reproduces the stock field.
   *
   * @example
   * <PixelField
   *   running
   *   seed={1}
   *   config={{
   *     spacing: 24,
   *     pixelSize: 16,
   *     speed: 0.5,
   *     colorBase: [20, 28, 44],
   *     colorRange: [90, 130, 190],
   *     glint: false,
   *   }}
   * />
   */
  config?: PixelFieldConfig;
  /** Extra class names merged onto the canvas element. */
  className?: string;
  /**
   * Overrides merged over the built-in positioning styles. Use this (or
   * `className`) to change the layer, opacity, or blend of the field.
   */
  style?: CSSProperties;
};

/**
 * Defaults live inline rather than in utility classes so the component works
 * in any stack — a consumer without Tailwind would otherwise get a canvas with
 * no size and no positioning at all.
 */
const BASE_STYLE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: -1,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
  opacity: 0.95,
};

/**
 * Full-bleed animated noise field. Renders only a canvas; all animation
 * lifecycle (resize, RAF, visibility, cleanup) lives in `usePixelField`.
 *
 * Forwards a ref to the underlying `<canvas>` for React 18 and 19 alike.
 */
export const PixelField = forwardRef<HTMLCanvasElement, PixelFieldProps>(
  function PixelField(
    { running, seed, config, className = '', style },
    forwardedRef,
  ) {
    const canvasRef = usePixelField(running, seed, config);

    const setRef = useCallback(
      (node: HTMLCanvasElement | null) => {
        canvasRef.current = node;
        if (typeof forwardedRef === 'function') forwardedRef(node);
        else if (forwardedRef) forwardedRef.current = node;
      },
      [canvasRef, forwardedRef],
    );

    return (
      <canvas
        ref={setRef}
        aria-hidden='true'
        className={className}
        style={style ? { ...BASE_STYLE, ...style } : BASE_STYLE}
      />
    );
  },
);
