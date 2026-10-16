# @tooldroid/pixel-field

An animated pixel-noise background for React, rendered with a regular `<canvas>`. It creates soft, drifting fields of glowing squares with varying brightness and opacity, giving hero sections, landing pages, and app backgrounds a sense of depth.

The effect is generated at runtime using procedural noise — no images, shaders, or external assets required.

## Features

- **Animated, organic motion** with softly warped noise patterns
- **Pixel-grid depth** from per-cell brightness, opacity, and subtle highlights
- **Easy to customize** with colors, grid size, animation speed, and more
- **Canvas-based rendering** with cell and frame-rate limits to help control workload
- **Reduced-motion support** that respects the operating system preference by default
- **Server Component friendly** — the entry ships a `'use client'` directive, so
  Next.js App Router Server Components can import it directly
- **TypeScript support** with exported prop and configuration types

## Requirements

- React 18 or React 19
- A React app using a modern JavaScript/TypeScript bundler

## Install

Using pnpm:

```sh
pnpm add @tooldroid/pixel-field
```

Using npm:

```sh
npm install @tooldroid/pixel-field
```

## Quick start

Import `PixelField` and place it inside a container that defines the area for the background.

```tsx
import { PixelField } from '@tooldroid/pixel-field';

export function Hero() {
  return (
    <section className='hero'>
      <PixelField running seed={1} />

      <div className='hero__content'>
        <h1>Your next idea, in motion.</h1>
        <p>A subtle animated pixel field for your interface.</p>
      </div>
    </section>
  );
}
```

The component renders a canvas positioned behind your content. Make the section a positioning context and isolate its stacking order:

```css
.hero {
  position: relative;
  isolation: isolate;
  min-height: 24rem;
  overflow: hidden;
  display: grid;
  place-content: center;
}

.hero__content {
  position: relative;
  z-index: 1;
}
```

> **Using Tailwind CSS?** The canvas includes utility classes for sizing and positioning. Make sure your Tailwind setup scans the package so those utilities are generated. See [Styling with Tailwind](#styling-with-tailwind).

## Component props

| Prop        | Type                     | Description                                                                               |
| ----------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| `running`   | `boolean`                | Enables or pauses animation. Required.                                                    |
| `seed`      | `number`                 | Determines the generated pattern. Change it to generate a different field. Required.      |
| `config`    | `PixelFieldConfig`       | Optional animation, grid, color, and rendering settings. Unspecified values use defaults. |
| `className` | `string`                 | Additional classes for the canvas. Merged with the built-in classes.                      |
| `ref`       | `Ref<HTMLCanvasElement>` | Ref to the underlying canvas element.                                                     |

## Customize the look

Pass a `config` object to adjust the field. You only need to specify the options you want to change.

```tsx
import { PixelField, type PixelFieldConfig } from '@tooldroid/pixel-field';

const fieldConfig: PixelFieldConfig = {
  spacing: 22,
  pixelSize: 14,
  speed: 0.7,
  colorBase: [12, 18, 32],
  colorRange: [65, 120, 210],
  glint: false,
};

export function Background() {
  return <PixelField running seed={42} config={fieldConfig} />;
}
```

### Common configuration options

| Option                 | What it changes                                                                           |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `spacing`              | Distance between pixel-cell origins. Larger values produce a more open grid.              |
| `pixelSize`            | Nominal square size. Larger values create chunkier pixels.                                |
| `sizeJitter`           | Variation in cell size; set to `0` for uniform squares.                                   |
| `speed`                | Overall animation speed. Use `0` to freeze the animation.                                 |
| `colorBase`            | Base RGB color as `[red, green, blue]`, with each channel from `0` to `255`.              |
| `colorRange`           | RGB color variation as `[red, green, blue]`.                                              |
| `glint`                | Enables or disables subtle highlights on some bright cells.                               |
| `maxFps`               | Maximum canvas repaint rate. The default is `30`.                                         |
| `maxCells`             | Maximum number of cells to render. The default is `20_000`. Set to `0` to remove the cap. |
| `respectReducedMotion` | Automatically pause animation when the OS requests reduced motion. Defaults to `true`.    |

See the exported `PixelFieldConfig` type in your editor for all available options, including noise, contour, brightness, alpha, and device-pixel-ratio controls. Values that need bounds are normalized by the package.

## Styling with Tailwind

The canvas uses these default utility classes:

```text
h-dvh w-full pointer-events-none absolute inset-0 z-[-1] opacity-[0.95]
```

Add your own classes to override defaults:

```tsx
<PixelField running seed={1} className='opacity-40 mix-blend-screen' />
```

The classes must exist in your generated CSS for Tailwind to apply them.

**Tailwind CSS v4** — explicitly include the package in source detection if it is not scanned automatically. Adjust the relative path for your project's CSS file:

```css
@import 'tailwindcss';
@source '../node_modules/@tooldroid/pixel-field';
```

**Tailwind CSS v3** — add the package's built files to your `content` configuration:

```js
content: [
  './src/**/*.{js,ts,jsx,tsx}',
  './node_modules/@tooldroid/pixel-field/dist/**/*.{js,cjs}',
],
```

**Not using Tailwind?** Utility class names will not produce styles unless you provide matching CSS. You can still use your own classes:

```tsx
<PixelField running seed={1} className='pixel-field-background' />
```

For example:

```css
.pixel-field-background {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0.4;
  pointer-events: none;
}
```

## Animation controls

Use `running` to control playback from React:

```tsx
<PixelField running={isPlaying} seed={1} />
```

Change `seed` when you want a different pattern. Config changes are applied while the component is mounted, so you can connect options to state or controls.

The field automatically pauses when the page is hidden or the canvas is off-screen. It also respects the operating system's reduced-motion preference by default. Set `respectReducedMotion: false` only when you explicitly want to override that behavior.

## Performance tips

- Start with the default `maxCells` and `maxFps` values. Raise them only if you need more detail or smoother updates.
- Use a lower `speed` for a calm background; use `speed: 0` for a static field.
- Keep the field decorative. Its canvas ignores pointer events by default, so it will not block links or buttons layered above it.
- Put the component inside the section it should cover, rather than using a full-page canvas when only one section needs the effect.

## Other exports

Most apps only need `PixelField` and `PixelFieldConfig`. The package also exports:

- `usePixelField(running, seed, config?)` — hook for integrating the field with your own canvas.
- `DEFAULT_PIXEL_FIELD_CONFIG` and `resolvePixelFieldConfig` — default settings and configuration normalization.
- `ResolvedPixelFieldConfig`, `PixelFieldProps`, `RGB`, and `Range` — TypeScript types.

Additional low-level rendering and noise utilities are exported for advanced use cases.

## License

MIT
