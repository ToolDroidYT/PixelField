import { useState } from 'react';
import type { PixelFieldConfig } from '@tooldroid/pixel-field';
import { buildUsageSnippet } from '../lib/snippets';
import { CodeBlock } from './CodeBlock';

type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun';

const PACKAGE_MANAGERS: PackageManager[] = ['pnpm', 'npm', 'yarn', 'bun'];

const INSTALL_COMMANDS: Record<PackageManager, string> = {
  pnpm: 'pnpm add @tooldroid/pixel-field',
  npm: 'npm install @tooldroid/pixel-field',
  yarn: 'yarn add @tooldroid/pixel-field',
  bun: 'bun add @tooldroid/pixel-field',
};

type UsageSectionProps = {
  config: PixelFieldConfig;
  seed: number;
};

export function UsageSection({ config, seed }: UsageSectionProps) {
  const [manager, setManager] = useState<PackageManager>('pnpm');

  return (
    <section className='relative px-[clamp(28px,7vw,88px)] pb-[clamp(72px,10vw,140px)]'>
      <div className='max-w-[980px]'>
        <h2 className='text-[clamp(32px,4.5vw,52px)] leading-[1.05] font-medium tracking-[-0.05em]'>
          Drop it <em className='font-serif font-normal text-[#bcb4ac]'>in.</em>
        </h2>
        <p className='text-muted mt-4 max-w-140 text-[15px] leading-[1.65]'>
          Install the package and hand it the settings you tuned above. The
          example below tracks the current seed and config.
        </p>
        <div className='mt-9 flex flex-col gap-7'>
          <div>
            <div className='flex flex-wrap items-center justify-between gap-3'>
              <h3 className='text-sm font-[550] text-[#eee9e4]'>Install</h3>
              <div
                className='inline-flex items-center gap-0.5 rounded-[10px] border border-white/[0.17] bg-white/[0.04] p-0.5'
                role='group'
                aria-label='Package manager'
              >
                {PACKAGE_MANAGERS.map((id) => (
                  <button
                    key={id}
                    type='button'
                    aria-pressed={manager === id}
                    onClick={() => setManager(id)}
                    className={`cursor-pointer rounded-[8px] px-3.5 py-1.5 text-[13px] font-[550] transition-colors ${
                      manager === id
                        ? 'bg-white/[0.12] text-[#f6f4f1]'
                        : 'text-[#a19b96] hover:text-[#f6f4f1]'
                    }`}
                  >
                    {id}
                  </button>
                ))}
              </div>
            </div>
            <CodeBlock className='mt-3' code={INSTALL_COMMANDS[manager]} />
          </div>
          <div>
            <h3 className='text-sm font-[550] text-[#eee9e4]'>Use</h3>
            <CodeBlock
              className='mt-3'
              code={buildUsageSnippet(config, seed)}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
