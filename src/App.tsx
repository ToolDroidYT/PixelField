import { useEffect, useState } from 'react';
import { PixelField, type PixelFieldConfig } from '@tooldroid/pixel-field';
import { Minus, Pause, Play, Plus } from 'lucide-react';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Design tokens for the noise field behind this page. Every key is optional;
 * anything omitted falls back to the package defaults. Declared at module
 * scope so its identity is stable and the field can skip re-resolving it on
 * every render.
 */
const PIXEL_FIELD_CONFIG: PixelFieldConfig = {
  // Grid: distance between cell origins, and the square size drawn in each.
  spacing: 16,
  pixelSize: 10,

  // Motion: 1 = the hand-tuned baseline rate; 0 freezes the drift entirely.
  speed: 1,

  // Shape: field values where cells fade in, and the hard alpha ceiling.
  visibilityRange: [0.43, 0.56],
  alphaCap: 1,

  // Color: warm charcoal → off-white ramp, matching the page's ink/paper tones.
  colorBase: [54, 51, 48],
  colorRange: [132 + 50, 124 + 50, 116 + 50],
  glintColor: [235, 225, 213],
};

const BUTTON =
  'inline-flex min-h-[46px] cursor-pointer items-center justify-center gap-2 rounded-[10px] border px-[17px] text-sm font-[550]';
const BUTTON_SECONDARY = `${BUTTON} border-white/[0.17] bg-white/[0.055] text-[#eee9e4]`;
const BUTTON_PRIMARY = `${BUTTON} border-[#e8e2dc] bg-[#e8e2dc] text-[#181513]`;

// Icon-only controls: 17px glyphs (matching the label's optical weight) inside
// generous 36px hit areas, so the stepper stays tappable on touch screens.
const ICON = 'size-[17px] shrink-0';
const ICON_BUTTON =
  'inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[7px] transition-colors hover:bg-white/[0.1] active:bg-white/[0.16]';
const SEED_INPUT =
  'w-11 border-0 bg-transparent p-0 text-center text-sm text-[#eee9e4] tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

const VIGNETTE =
  'pointer-events-none absolute inset-0 z-[-1] bg-[linear-gradient(0deg,rgba(10,9,8,0.18),rgba(10,9,8,0.04)_48%,rgba(10,9,8,0.12))] max-[560px]:bg-[linear-gradient(180deg,rgba(10,9,8,0.1),rgba(10,9,8,0.16)_45%,rgba(10,9,8,0.08))]';

const MARK_BAR =
  'block h-[9px] w-[26px] rounded-[2px] bg-[#f5f2ef] max-[560px]:w-5';

function App() {
  // Mirrors the prototype: reduced motion decides the initial state and takes
  // over whenever the OS preference changes; between those events a manual
  // toggle wins.
  const [running, setRunning] = useState(
    () => !window.matchMedia(REDUCED_MOTION_QUERY).matches,
  );
  const [seed, setSeed] = useState(18);

  useEffect(() => {
    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = (event: MediaQueryListEvent) => setRunning(!event.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  return (
    <main className='relative isolate flex min-h-svh flex-col items-start justify-center overflow-hidden p-[clamp(28px,7vw,88px)] max-[560px]:justify-start max-[560px]:pt-[34svh]'>
      <PixelField running={running} seed={seed} config={PIXEL_FIELD_CONFIG} />
      {/* Vignette keeps the center text readable while pixels remain visible at the edges. */}
      <div aria-hidden='true' className={VIGNETTE} />

      <header className='absolute top-[clamp(22px,4vw,42px)] right-[clamp(28px,7vw,88px)] left-[clamp(28px,7vw,88px)] flex items-center justify-between gap-4 max-[560px]:items-start'>
        <div
          className='flex skew-y-[-15deg] items-center gap-1.25'
          aria-label='Brand mark'
        >
          <span className={MARK_BAR} />
          <span className={`${MARK_BAR} translate-y-1.5`} />
          <span className={`${MARK_BAR} translate-y-3`} />
        </div>
      </header>

      <section className='w-[min(760px,100%)] pt-10.5 max-[560px]:pt-0'>
        <h1 className='m-0 max-w-205 text-[clamp(48px,8.5vw,104px)] leading-[0.96] font-medium tracking-[-0.075em]'>
          Make pixels{' '}
          <em className='mt-2 block font-serif text-[0.89em] font-normal tracking-[-0.06em] text-[#bcb4ac]'>
            move.
          </em>
        </h1>
        <p className='text-muted mt-7 max-w-127.5 text-[clamp(17px,2vw,22px)] leading-[1.65]'>
          A living field of smooth, drifting noise. Each pixel carries its own
          intensity, so the pattern feels layered instead of flat.
        </p>
        <div className='mt-8.5 flex flex-wrap gap-3'>
          <button
            type='button'
            className={BUTTON_PRIMARY}
            onClick={() => setRunning((value) => !value)}
          >
            {running ? (
              <Pause className={ICON} aria-hidden='true' />
            ) : (
              <Play className={ICON} aria-hidden='true' />
            )}
            {running ? 'Pause animation' : 'Resume animation'}
          </button>
          <div
            className={`${BUTTON_SECONDARY} gap-0.5 px-1.5`}
            role='group'
            aria-label='Pattern seed'
          >
            <span className='text-muted px-2'>Seed</span>
            <button
              type='button'
              className={ICON_BUTTON}
              aria-label='Previous seed'
              onClick={() => setSeed((value) => value - 1)}
            >
              <Minus className={ICON} aria-hidden='true' />
            </button>
            <input
              id='seed'
              type='number'
              value={seed}
              aria-label='Seed value'
              onChange={(e) => setSeed(Number(e.target.value))}
              className={SEED_INPUT}
            />
            <button
              type='button'
              className={ICON_BUTTON}
              aria-label='Next seed'
              onClick={() => setSeed((value) => value + 1)}
            >
              <Plus className={ICON} aria-hidden='true' />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
