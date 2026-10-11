# PixelGrid-Noise

A living field of smooth, drifting noise rendered as a grid of animated pixels.
Each pixel carries its own intensity, so the pattern feels layered instead of
flat. Pure fBm value noise + a canvas — no shaders, no assets.

## Structure

This is a pnpm workspace:

```
packages/pixel-field/   → @tooldroid/pixel-field (the reusable library)
src/                    → the demo app (a Vite + React landing page)
prototype/              → the original standalone HTML prototype
```

## Getting started

```sh
pnpm install
pnpm dev
```

The demo app imports `@tooldroid/pixel-field` straight from the package
**source** via a Vite alias, so there is no build step during development and
hot module replacement works across the package boundary.

## Scripts

| Script                | Description                                         |
| --------------------- | --------------------------------------------------- |
| `pnpm dev`            | Start the demo app with HMR.                        |
| `pnpm build`          | Typecheck and build the demo app for production.    |
| `pnpm build:packages` | Build the library into `packages/pixel-field/dist`. |
| `pnpm typecheck`      | Typecheck every project in the workspace.           |
| `pnpm lint`           | Run Oxlint.                                         |
| `pnpm format`         | Format the whole workspace with Prettier.           |
| `pnpm format:check`   | Check formatting without writing.                   |
| `pnpm preview`        | Preview the production build.                       |

## @tooldroid/pixel-field

The library. See [`packages/pixel-field/README.md`](./packages/pixel-field/README.md)
for full API documentation.

```tsx
import { PixelField } from '@tooldroid/pixel-field';

<section className='relative isolate'>
  <PixelField running seed={1} />
</section>;
```

The component renders only a `<canvas>` sized to its nearest positioned
ancestor, so place it inside a `position: relative` container.

### Publishing

The package ships ESM, CJS and type declarations. To publish a new version:

```sh
pnpm --filter @tooldroid/pixel-field build
pnpm --filter @tooldroid/pixel-field publish --access public
```

`files` in `packages/pixel-field/package.json` already limits the tarball to
`dist` and the README, and `dist` is gitignored.

## Configuration

Every knob is optional and merged over hand-tuned defaults, so passing a
partial config — or none at all — is always safe:

```tsx
<PixelField
  running
  seed={1}
  config={{
    spacing: 24,
    pixelSize: 16,
    speed: 0.5,
    colorBase: [20, 28, 44],
    colorRange: [90, 130, 190],
    glint: false,
  }}
/>
```

Declare the config object at module scope so its identity is stable and the
field can skip re-resolving it on every render.

## Reduced motion

The field animates whenever `running` is true, which keeps animation under the
caller's control. The demo app mirrors the prototype: `prefers-reduced-motion`
decides the initial state and takes over whenever the OS preference changes,
while a manual toggle wins in between.

## Tooling

- [Vite](https://vite.dev/) + [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Oxlint](https://oxc.rs/docs/guide/usage/linter.html) for linting
- [Prettier](https://prettier.io/) with import sorting and Tailwind class sorting
- [tsup](https://tsup.egoist.dev/) for building the library
