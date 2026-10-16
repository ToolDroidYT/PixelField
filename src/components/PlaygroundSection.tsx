import {
  resolvePixelFieldConfig,
  type PixelFieldConfig,
} from '@tooldroid/pixel-field';
import { formatNumber } from '../lib/format';
import { buildConfigSnippet } from '../lib/snippets';
import { CopyButton } from './CopyButton';
import { RangeControl } from './RangeControl';
import { SeedControl } from './SeedControl';
import { ToggleControl } from './ToggleControl';

/** Config keys the panel exposes as sliders. */
type RangeKey =
  'speed' | 'maxFps' | 'spacing' | 'pixelSize' | 'sizeJitter' | 'alphaCap';

type RangeSpec = {
  key: RangeKey;
  label: string;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
};

const RANGES: RangeSpec[] = [
  {
    key: 'speed',
    label: 'Speed',
    min: 0,
    max: 2,
    step: 0.05,
    format: (value) => `${formatNumber(value)}×`,
  },
  {
    key: 'maxFps',
    label: 'Max FPS',
    min: 1,
    max: 120,
    step: 1,
    format: (value) => `${formatNumber(value)} fps`,
  },
  {
    key: 'spacing',
    label: 'Spacing',
    min: 8,
    max: 32,
    step: 1,
    format: (value) => `${formatNumber(value)}px`,
  },
  {
    key: 'pixelSize',
    label: 'Pixel size',
    min: 2,
    max: 24,
    step: 1,
    format: (value) => `${formatNumber(value)}px`,
  },
  {
    key: 'sizeJitter',
    label: 'Size jitter',
    min: 0,
    max: 1,
    step: 0.01,
    format: formatNumber,
  },
  {
    key: 'alphaCap',
    label: 'Alpha cap',
    min: 0,
    max: 1,
    step: 0.01,
    format: formatNumber,
  },
];

type PlaygroundSectionProps = {
  config: PixelFieldConfig;
  seed: number;
  onSeedChange: (seed: number) => void;
  onConfigChange: (patch: PixelFieldConfig) => void;
};

export function PlaygroundSection({
  config,
  seed,
  onSeedChange,
  onConfigChange,
}: PlaygroundSectionProps) {
  // Resolved values fill in whatever the config leaves out, so the controls
  // always show the numbers the field is actually running with.
  const resolved = resolvePixelFieldConfig(config);

  return (
    <section className='relative px-[clamp(28px,7vw,88px)] pb-[clamp(64px,9vw,120px)]'>
      <div className='max-w-[980px]'>
        <h2 className='text-[clamp(32px,4.5vw,52px)] leading-[1.05] font-medium tracking-[-0.05em]'>
          Tune{' '}
          <em className='font-serif font-normal text-[#bcb4ac]'>the field.</em>
        </h2>
        <p className='text-muted mt-4 max-w-140 text-[15px] leading-[1.65]'>
          Every control maps to a <code>PixelFieldConfig</code> key and applies
          live. Settle on a look, then copy the settings straight into your app.
        </p>
        <div className='mt-9 rounded-2xl border border-white/[0.12] bg-[#121010]/80 p-6 backdrop-blur-md sm:p-9'>
          <div className='grid gap-x-10 gap-y-8 sm:grid-cols-2'>
            <SeedControl seed={seed} onChange={onSeedChange} />
            {RANGES.map((spec) => (
              <RangeControl
                key={spec.key}
                label={spec.label}
                min={spec.min}
                max={spec.max}
                step={spec.step}
                format={spec.format}
                value={resolved[spec.key]}
                onChange={(value) => onConfigChange({ [spec.key]: value })}
              />
            ))}
            <ToggleControl
              label='Glint'
              checked={resolved.glint}
              onChange={(glint) => onConfigChange({ glint })}
            />
          </div>
          <div className='mt-9 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-white/[0.08] pt-6'>
            <CopyButton
              text={buildConfigSnippet(config)}
              label='Copy config'
              copiedLabel='Config copied'
              appearance='primary'
            />
            <p className='text-muted text-[13px] leading-[1.6]'>
              Copies the current values as a ready-to-paste{' '}
              <code>PixelFieldConfig</code> object.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
