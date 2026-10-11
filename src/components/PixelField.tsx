import { usePixelField } from '../hooks/usePixelField';

export type PixelFieldProps = {
  /** Whether the field is animating. Controlled by the parent. */
  running: boolean;
  /** Bump to regenerate the pattern with a new seed. Controlled by the parent. */
  seed: number;
  className?: string;
};

/**
 * Full-bleed animated noise field. Renders only a canvas; all animation
 * lifecycle (resize, RAF, visibility, cleanup) lives in `usePixelField`.
 */
export default function PixelField({
  running,
  seed,
  className = '',
}: PixelFieldProps) {
  const canvasRef = usePixelField(running, seed);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden='true'
      className={`pointer-events-none absolute inset-0 z-[-1] h-full w-full opacity-95 motion-reduce:opacity-80 ${className}`}
    />
  );
}
