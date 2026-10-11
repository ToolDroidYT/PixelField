# @tooldroid/pixel-field

Full-bleed animated pixel noise field for React, rendered on a `<canvas>`.

A single shared noise field is sampled at every cell of a fixed grid. Domain
warping bends it into soft, drifting continents, and each cell's opacity and
luminance encode the local field intensity — so the pattern reads as layered
depth rather than flat twinkling. Pure fBm value noise, no shaders, no assets.

## Install

```sh
npm install @tooldroid/pixel-field
```

Or with the package manager of your choice:

```sh
pnpm add @tooldroid/pixel-field
yarn add @tooldroid/pixel-field
bun add @tooldroid/pixel-field
```

React 18 or 19 is required as a peer dependency. The package ships ESM
(`dist/index.js`), CJS (`dist/index.cjs`) and matching type declarations, with
`sideEffects: false` so unused exports tree-shake away.

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

The component renders only a `<canvas>`, so place it inside a positioned
container (`position: relative`, or any positioned ancestor) and layer your
content over it — `isolate` keeps the field's negative `z-index` from escaping
the section.

## Props

| Prop        | Type                     | Description                                                             |
| ----------- | ------------------------ | ----------------------------------------------------------------------- |
| `running`   | `boolean`                | Whether the field is animating. Controlled by the parent. **Required.** |
| `seed`      | `number`                 | Bump to regenerate the pattern with a new seed. **Required.**           |
| `config`    | `PixelFieldConfig`       | Optional overrides. Every key is optional and merged over the defaults. |
| `className` | `string`                 | Extra class names merged onto the canvas (Tailwind-aware).              |
| `ref`       | `Ref<HTMLCanvasElement>` | Forwards to the underlying `<canvas>`.                                  |

## Styling the canvas

The canvas carries its positioning as utility class names, merged with your
`className` via `clsx` + `tailwind-merge`:

```
h-dvh w-full pointer-events-none absolute inset-0 z-[-1] opacity-[0.95]
```

Later classes win, so `<PixelField className='opacity-40 z-0' />` overrides the
defaults without fighting them:

```tsx
<PixelField running seed={1} className='opacity-40 mix-blend-screen' />
```

Those classes only take effect if your CSS setup generates them:

- **Tailwind v4** ignores `node_modules` during automatic source detection, so
  opt the package in once:

  ```css
  @import 'tailwindcss';
  @source '../node_modules/@tooldroid/pixel-field';
  ```

- **Tailwind v3** — add the package to your `content` globs:

  ```js
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    './node_modules/@tooldroid/pixel-field/dist/**/*.{js,cjs}',
  ];
  ```

- **No Tailwind** — the built-in names are inert, so size and position the
  canvas yourself with `className` (or your own CSS):

  ```tsx
  <PixelField
    running
    seed={1}
    className='absolute inset-0 h-full w-full opacity-40'
  />
  ```

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
cells. Configs are compared by value, so an inline object literal is fine.

Values are normalized on resolve: non-finite numbers fall back to the default,
`octaves` is clamped to `[1, 8]` (an unbounded value is a hang — it is one fbm
loop per octave per cell), blend weights and probabilities are clamped to
`[0, 1]`, `maxCells` is floored at 0 (`0` disables the cap), `maxFps` is
rounded and clamped to at most `240` (a value below `1` falls back to the
default and warns outside production), a zero-width
`contourWidth` is lifted off zero, and a degenerate threshold pair renders as a
hard step instead of `NaN`. The resolved config is frozen, so nothing you pass
can be mutated out from under another consumer.

See the doc comments in [`src/lib/pixelFieldConfig.ts`](./src/lib/pixelFieldConfig.ts)
for every available key, and `DEFAULT_PIXEL_FIELD_CONFIG` for the baseline
values.

Declaring your config at module scope is still nicest — it keeps one object
identity for the whole session — but an inline literal works too.

## Performance

The frame loop is built to stay well inside a 60 fps budget at 1080p:

- **Colors are quantized into a palette.** Brightness and alpha are bucketed
  into 64 steps each (about one RGB level and 0.002 alpha of error), so a frame
  needs a few hundred `rgba(...)` strings instead of one per cell, and the
  strings are cached across frames.
- **Draws are batched by palette key**, so each color is assigned once per
  frame rather than thousands of times. On a non-overlapping grid this is a
  pure reordering and is visually identical; grids where `pixelSize` exceeds
  `spacing` fall back to generation order.
- **Cells fully off-canvas are culled before any noise is sampled**, and the
  detail layer is skipped wherever an upper bound proves the cell invisible.
- **The loop idles**: it stops while the canvas is off-screen (Intersection
  Observer), while the document is hidden, and whenever the clock is frozen
  (`speed: 0`), and it never repaints an unchanged frame.
- **Repaints are capped.** `maxFps` (30 by default) bounds how often the field
  reaches the canvas, which suits a slow drift and roughly halves the paint
  work against a 60 Hz display. The clock still advances on every tick, so the
  motion is the same speed at any cap — 240 is effectively uncapped.
- **The grid is capped.** `maxCells` (20,000 by default) bounds the number of
  cells, which is what makes cost track viewport _area_. Past the cap the pitch,
  square size, and noise scale are coarsened by the same factor, so the pattern
  keeps its on-screen size and just covers a larger slice of the page — a
  7680x4320 canvas (25 % browser zoom) costs the same as a 4K one instead of
  nine times as much. Set `maxCells: 0` for an unbounded grid.
- **Resize storms settle instead of queueing.** Browser zoom changes the element
  size and `devicePixelRatio` at once, and every step of a Ctrl+scroll does it
  again. A lone notification still measures and repaints immediately, but once
  they arrive in a burst each one only pushes a single trailing sync out (and
  cancels the older pending one), and the loop holds its frames while the
  browser stretches the existing bitmap for free. Measured on a 20-step
  zoom-out over 1.7 s: 20 syncs and 3.9 s of blocked main thread before, 3
  syncs and 57 ms after.

`pnpm bench` (at the repo root) prints per-frame cost against the original
per-cell renderer for three viewports.

## Exports

- `PixelField` — the component.
- `usePixelField(running, seed, config?)` — the hook, if you want to drive your
  own `<canvas>`.
- `DEFAULT_PIXEL_FIELD_CONFIG`, `resolvePixelFieldConfig`,
  `pixelFieldLayoutKey`, `pixelFieldConfigEquals` — config helpers.
- `buildFieldCells`, `paintField`, `createFieldRenderBuffers`,
  `isGridGeometryEqual` — the render pipeline the hook runs, exposed so it can
  be driven (or benchmarked) outside React.
- `PixelFieldConfig`, `ResolvedPixelFieldConfig`, `PixelFieldProps`, `RGB`,
  `Range`, `FieldCells`, `FieldView`, `FieldRenderBuffers` — types.
- `random01`, `hash`, `mix`, `fade`, `clamp01`, `valueNoise`, `fbm`,
  `smoothstep` — the pure noise math.

## Reduced motion

The field honors the OS preference automatically: while `prefers-reduced-motion`
is set, the loop stops and the last frame stays on screen. Set
`config.respectReducedMotion = false` to animate regardless. `running` is
unchanged, so gating on both (as the demo does) is harmless.

## Development

This package lives in the `PixelGrid-Noise` monorepo.

```sh
pnpm --filter @tooldroid/pixel-field build       # emit dist/ (ESM + CJS + .d.ts)
pnpm --filter @tooldroid/pixel-field dev         # rebuild on change
pnpm --filter @tooldroid/pixel-field typecheck
pnpm --filter @tooldroid/pixel-field test        # build, then run node --test
pnpm --filter @tooldroid/pixel-field bench       # per-frame cost, old vs new
pnpm --filter @tooldroid/pixel-field bench:noise # fBm octave-loop bake-off
```

The tests rebuild `dist/` first and then check the batched renderer against a
verbatim copy of the original per-cell renderer: the same cells must be drawn,
in the same places, with the same colors within palette quantization — plus
config normalization and noise edge cases. Treat a red equivalence test as a
visual regression, not a tolerance to widen.

The demo app at the repo root consumes this package straight from source via a
Vite alias, so `pnpm dev` at the root needs no build step.
