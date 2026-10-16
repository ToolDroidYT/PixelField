import { Check, Copy } from 'lucide-react';
import { useCopyToClipboard } from '../hooks/useCopyToClipboard';
import { BUTTON_PRIMARY, BUTTON_QUIET } from '../lib/classes';

type CopyButtonProps = {
  /** Text written to the clipboard on click. */
  text: string;
  label?: string;
  copiedLabel?: string;
  appearance?: 'primary' | 'quiet';
};

/** Copies `text` and flashes a confirmation state for a couple of seconds. */
export function CopyButton({
  text,
  label = 'Copy',
  copiedLabel = 'Copied',
  appearance = 'quiet',
}: CopyButtonProps) {
  const { copied, copy } = useCopyToClipboard();
  const base = appearance === 'primary' ? BUTTON_PRIMARY : BUTTON_QUIET;
  const Icon = copied ? Check : Copy;

  return (
    <button
      type='button'
      onClick={() => {
        void copy(text);
      }}
      className={base}
      aria-live='polite'
    >
      <Icon className='size-4 shrink-0' aria-hidden='true' />
      {copied ? copiedLabel : label}
    </button>
  );
}
