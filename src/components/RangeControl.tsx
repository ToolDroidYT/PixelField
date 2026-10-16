import { type CSSProperties } from 'react';
import { formatNumber } from '../lib/format';

type RangeControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Formats the value readout; defaults to a trimmed number. */
  format?: (value: number) => string;
};

/**
 * A range input restyled for the page's dark palette: a 5px track with the
 * filled portion tinted through a `--range-fill` custom property, and a light
 * thumb that grows a soft halo on hover and focus.
 */
const RANGE = [
  'h-5 w-full cursor-pointer appearance-none bg-transparent',
  'bg-[length:100%_5px] bg-[position:center] bg-no-repeat',
  '[background-image:linear-gradient(to_right,#e8e2dc_var(--range-fill),rgba(255,255,255,0.16)_var(--range-fill))]',
  '[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#f5f2ef] [&::-webkit-slider-thumb]:transition-shadow',
  'hover:[&::-webkit-slider-thumb]:shadow-[0_0_0_5px_rgba(245,242,239,0.14)]',
  'focus-visible:outline-none focus-visible:[&::-webkit-slider-thumb]:shadow-[0_0_0_5px_rgba(245,242,239,0.26)]',
  '[&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-[#f5f2ef]',
].join(' ');

/** Labelled slider row: name and value above, the input underneath. */
export function RangeControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = formatNumber,
}: RangeControlProps) {
  const fill = ((value - min) / (max - min)) * 100;

  return (
    <label className='flex flex-col gap-2.5'>
      <span className='flex items-baseline justify-between gap-3'>
        <span className='text-sm text-[#a19b96]'>{label}</span>
        <span className='text-sm text-[#eee9e4] tabular-nums'>
          {format(value)}
        </span>
      </span>
      <input
        type='range'
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.valueAsNumber)}
        className={RANGE}
        style={{ '--range-fill': `${fill}%` } as CSSProperties}
      />
    </label>
  );
}
