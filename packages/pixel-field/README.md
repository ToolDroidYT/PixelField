# @tooldroid/pixel-field

Full-bleed animated pixel noise field for React, rendered on a `<canvas>`.

A single shared noise field is sampled at every cell of a fixed grid. Domain
warping bends it into soft, drifting continents, and each cell's opacity and
luminance encode the local field intensity — so the pattern reads as layered
depth rather than flat twinkling. Pure fBm value noise, no shaders, no assets.

## Install

```sh
pnpm add @tooldroid/pixel-field
```

React 18 or 19 is required as a peer dependency.

## Usage

```tsx
import { PixelField } from '@tooldroid/pixel-field';

export function Hero() {
  return (
    <section className='relative isolate'>
      <PixelField running seed={1} />
      {/* content */}
    </section>
  );
}
```

The component renders only a `<canvas>` sized to its nearest positioned
ancestor, so place it inside a `position: relative` container.

## Props

| Prop        | Type               | Description                                                               |
| ----------- | ------------------ | ------------------------------------------------------------------------- |
| `running`   | `boolean`          | Whether the field is animating. Controlled by the parent.                 |
| `seed`      | `number`           | Bump to regenerate the pattern with a new seed. Controlled by the parent. |
| `config`    | `PixelFieldConfig` | Optional overrides. Every key is optional and merged over the defaults.   |
| `className` | `string`           | Extra class names merged onto the canvas element.                         |

## Config

Passing no `config` (or any subset of keys) is always safe — omitted values fall
back to the hand-tuned defaults.

```tsx
import { PixelField, type PixelFieldConfig } from '@tooldroid/pixel-field';

const CONFIG: PixelFieldConfig = {
  spacing: 24,
  pixelSize: 16,
  speed: 0.5,
  colorBase: [20, 28, 44],
  colorRange: [90, 130, 190],
  glint: false,
};

<PixelField running seed={1} config={CONFIG} />;
```

Config changes are picked up live: color and behavior tweaks repaint on the
next frame (or immediately while paused), and grid-affecting values rebuild the
cells.

See the doc comments in [`src/lib/pixelFieldConfig.ts`](./src/lib/pixelFieldConfig.ts)
for every available key, and `DEFAULT_PIXEL_FIELD_CONFIG` for the baseline
values.

Declare your config at module scope so its identity is stable and the field can
skip re-resolving it on every render.

## Exports

- `PixelField` — the component.
- `usePixelField(running, seed, config?)` — the hook, if you want to drive your
  own `<canvas>`.
- `DEFAULT_PIXEL_FIELD_CONFIG`, `resolvePixelFieldConfig`, `pixelFieldLayoutKey`
  — config helpers.
- `PixelFieldConfig`, `ResolvedPixelFieldConfig`, `PixelFieldProps`, `RGB`,
  `Range` — types.
- `random01`, `hash`, `mix`, `fade`, `clamp01`, `valueNoise`, `fbm`,
  `smoothstep` — the pure noise math.

## Reduced motion

The field animates whenever `running` is true. Honor the user's OS preference in
the parent:

```tsx
const [running, setRunning] = useState(
  () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
);
```

## Development

This package lives in the `PixelGrid-Noise` monorepo.

```sh
pnpm --filter @tooldroid/pixel-field build    # emit dist/ (ESM + CJS + .d.ts)
pnpm --filter @tooldroid/pixel-field dev      # rebuild on change
pnpm --filter @tooldroid/pixel-field typecheck
```

The demo app at the repo root consumes this package straight from source via a
Vite alias, so `pnpm dev` at the root needs no build step.
