import { type ChangeEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { ICON, ICON_BUTTON } from '../lib/classes';

const SEED_INPUT =
  'h-9 w-14 border-0 bg-transparent p-0 text-center text-sm text-[#eee9e4] tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

type SeedControlProps = {
  seed: number;
  onChange: (seed: number) => void;
};

/** Stepper for the pattern seed, restyled to sit with the config controls. */
export function SeedControl({ seed, onChange }: SeedControlProps) {
  const handleInput = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.valueAsNumber;
    // Mid-edit values (an empty field, a lone minus sign) are not finite;
    // keep the last good seed instead of breaking the pattern.
    if (Number.isFinite(next)) onChange(next);
  };

  return (
    <div className='flex flex-col gap-2.5'>
      <span className='text-sm text-[#a19b96]'>Seed</span>
      <div
        className='inline-flex items-center gap-0.5 self-start rounded-[10px] border border-white/[0.17] bg-white/[0.055] px-1.5'
        role='group'
        aria-label='Pattern seed'
      >
        <button
          type='button'
          className={ICON_BUTTON}
          aria-label='Previous seed'
          onClick={() => onChange(seed - 1)}
        >
          <Minus className={ICON} aria-hidden='true' />
        </button>
        <input
          type='number'
          value={seed}
          aria-label='Seed value'
          onChange={handleInput}
          className={SEED_INPUT}
        />
        <button
          type='button'
          className={ICON_BUTTON}
          aria-label='Next seed'
          onClick={() => onChange(seed + 1)}
        >
          <Plus className={ICON} aria-hidden='true' />
        </button>
      </div>
    </div>
  );
}
