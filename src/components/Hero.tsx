import { Pause, Play } from 'lucide-react';
import { BUTTON_PRIMARY, ICON } from '../lib/classes';

const MARK_BAR =
  'block h-[9px] w-[26px] rounded-[2px] bg-[#f5f2ef] max-[560px]:w-5';

type HeroProps = {
  running: boolean;
  onToggleRunning: () => void;
};

export function Hero({ running, onToggleRunning }: HeroProps) {
  return (
    <section className='relative flex min-h-svh flex-col items-start justify-center p-[clamp(28px,7vw,88px)] max-[560px]:justify-start max-[560px]:pt-[34svh]'>
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

      <div className='w-[min(760px,100%)] pt-10.5 max-[560px]:pt-0'>
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
            onClick={onToggleRunning}
          >
            {running ? (
              <Pause className={ICON} aria-hidden='true' />
            ) : (
              <Play className={ICON} aria-hidden='true' />
            )}
            {running ? 'Pause animation' : 'Resume animation'}
          </button>
        </div>
      </div>
    </section>
  );
}
