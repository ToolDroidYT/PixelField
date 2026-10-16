import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Copies text to the clipboard and reports success for `resetDelay` ms, so a
 * button can flash a "copied" state before settling back.
 */
export function useCopyToClipboard(resetDelay = 2000) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Clipboard writes can be denied (permissions, insecure context);
        // leaving the button unchanged beats claiming a copy that did not
        // happen.
        return;
      }
      setCopied(true);
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), resetDelay);
    },
    [resetDelay],
  );

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return { copied, copy };
}
