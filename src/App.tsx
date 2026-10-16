import { useCallback, useEffect, useState } from 'react';
import { PixelField, type PixelFieldConfig } from '@tooldroid/pixel-field';
import { Hero } from './components/Hero';
import { PlaygroundSection } from './components/PlaygroundSection';
import { UsageSection } from './components/UsageSection';
import { DEMO_PIXEL_FIELD_CONFIG } from './lib/demoConfig';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// Keeps the center text readable while pixels remain visible at the edges.
// Scrolls away with the hero — the field itself stays fixed behind the page.
const VIGNETTE =
  'pointer-events-none absolute inset-x-0 top-0 z-[-1] h-svh bg-[linear-gradient(0deg,rgba(10,9,8,0.18),rgba(10,9,8,0.04)_48%,rgba(10,9,8,0.12))] max-[560px]:bg-[linear-gradient(180deg,rgba(10,9,8,0.1),rgba(10,9,8,0.16)_45%,rgba(10,9,8,0.08))]';

function App() {
  // Mirrors the prototype: reduced motion decides the initial state and takes
  // over whenever the OS preference changes; between those events a manual
  // toggle wins.
  const [running, setRunning] = useState(
    () => !window.matchMedia(REDUCED_MOTION_QUERY).matches,
  );
  const [seed, setSeed] = useState(18);
  const [config, setConfig] = useState<PixelFieldConfig>(() => ({
    ...DEMO_PIXEL_FIELD_CONFIG,
  }));

  useEffect(() => {
    const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = (event: MediaQueryListEvent) => setRunning(!event.matches);
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  const toggleRunning = useCallback(() => {
    setRunning((value) => !value);
  }, []);

  const changeConfig = useCallback((patch: PixelFieldConfig) => {
    setConfig((prev) => ({ ...prev, ...patch }));
  }, []);

  return (
    <main className='relative isolate'>
      <PixelField
        className='fixed h-svh opacity-100'
        running={running}
        seed={seed}
        config={config}
      />
      <div aria-hidden='true' className={VIGNETTE} />
      <Hero running={running} onToggleRunning={toggleRunning} />
      <PlaygroundSection
        config={config}
        seed={seed}
        onSeedChange={setSeed}
        onConfigChange={changeConfig}
      />
      <UsageSection config={config} seed={seed} />
    </main>
  );
}

export default App;
