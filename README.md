# PixelField

A living field of smooth, drifting noise rendered as a grid of animated pixels.
Each pixel carries its own intensity, so the pattern feels layered instead of
flat. Pure fBm value noise + a canvas — no shaders, no assets.

This repository is a pnpm workspace holding two things:

- **`@tooldroid/pixel-field`** — the reusable React component, published to npm.
- **The demo app** — a Vite + React landing page that consumes the package
  straight from source.

## Installation

```sh
npm install @tooldroid/pixel-field
```

Or with the package manager of your choice:

```sh
pnpm add @tooldroid/pixel-field
yarn add @tooldroid/pixel-field
bun add @tooldroid/pixel-field
```

Requirements:

- **React 18 or 19** — a peer dependency, so your app's own copy is used.
- A bundler that resolves ESM or CJS. The package ships `dist/index.js` (ESM),
  `dist/index.cjs` (CJS) and matching type declarations, with `sideEffects: false`
  so unused exports tree-shake away.

## Usage

```tsx
import { PixelField } from '@tooldroid/pixel-field';

export function Hero() {
  return (
    <section className='relative isolate'>
      <PixelField running seed={1} />
      {/* content sits above the field */}
    </section>
  );
}
```

The component renders only a `<canvas>`, sized to its nearest positioned
ancestor — place it inside a `position: relative` (or any positioned) container
and layer your content over it (`isolate` keeps the field's negative
`z-index` from escaping the section).

### Props

| Prop        | Type                     | Description                                                             |
| ----------- | ------------------------ | ----------------------------------------------------------------------- |
| `running`   | `boolean`                | Whether the field is animating. Controlled by the parent. **Required.** |
| `seed`      | `number`                 | Bump to regenerate the pattern with a new seed. **Required.**           |
| `config`    | `PixelFieldConfig`       | Optional overrides. Every key is optional and merged over the defaults. |
| `className` | `string`                 | Extra class names merged onto the canvas (Tailwind-aware).              |
| `ref`       | `Ref<HTMLCanvasElement>` | Forwards to the underlying `<canvas>`.                                  |

### Styling the canvas

The canvas carries its positioning as utility class names merged with your
`className` via `clsx` + `tailwind-merge`:

```
h-dvh w-full pointer-events-none absolute inset-0 z-[-1] opacity-[0.95]
```

Later classes win, so `<PixelField className='opacity-40 z-0' />` overrides the
defaults without fighting them.

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

## Configuration

Every knob is optional and merged over hand-tuned defaults, so passing a
partial config — or none at all — is always safe:

```tsx
import { PixelField, type PixelFieldConfig } from '@tooldroid/pixel-field';

const CONFIG = {
  spacing: 24,
  pixelSize: 16,
  speed: 0.5,
  colorBase: [20, 28, 44],
  colorRange: [90, 130, 190],
  glint: false,
} satisfies PixelFieldConfig;

<PixelField running seed={1} config={CONFIG} />;
```

Declare the config object at module scope so its identity is stable; configs
are compared by value, though, so an inline literal works too. Config changes
are picked up live — color and behavior tweaks repaint on the next frame, and
grid-affecting values rebuild the cells.

Values are normalized on resolve: non-finite numbers fall back to the default,
`octaves` is clamped to `[1, 8]`, blend weights and probabilities to `[0, 1]`,
`maxFps` to at most `240`, and the resolved config is frozen. See
[`packages/pixel-field/README.md`](./packages/pixel-field/README.md) for the
full key list, `DEFAULT_PIXEL_FIELD_CONFIG` for the baseline values, and the
doc comments in
[`packages/pixel-field/src/lib/pixelFieldConfig.ts`](./packages/pixel-field/src/lib/pixelFieldConfig.ts)
for what each key does.

### Exports

The package is more than the component:

- `PixelField` — the component.
- `usePixelField(running, seed, config?)` — the hook, to drive your own canvas.
- `buildFieldCells`, `paintField`, `createFieldRenderBuffers` — the render
  pipeline, usable outside React.
- `DEFAULT_PIXEL_FIELD_CONFIG`, `resolvePixelFieldConfig`,
  `pixelFieldLayoutKey`, `pixelFieldConfigEquals` — config helpers.
- `random01`, `hash`, `mix`, `fade`, `clamp01`, `valueNoise`, `fbm`,
  `smoothstep` — the pure noise math.
- Types: `PixelFieldConfig`, `ResolvedPixelFieldConfig`, `PixelFieldProps`,
  `RGB`, `Range`, `FieldCells`, `FieldView`, `FieldRenderBuffers`.

## Reduced motion

The field honors `prefers-reduced-motion` itself: while the OS preference is
set, the loop stops and the last frame stays on screen. Set
`config.respectReducedMotion = false` to animate regardless.

`running` is the caller's override on top of that. The demo app mirrors the
original prototype: the media query decides the initial `running` state and
takes over whenever the OS preference changes, while a manual pause/resume
toggle wins in between.

## Development

### Requirements

- Node `^20.19.0 || >=22.12.0` (what Vite 8 requires)
- pnpm 9 or newer

### Getting started

```sh
pnpm install
pnpm dev
```

The demo app imports `@tooldroid/pixel-field` straight from the package
**source** via a Vite alias (`vite.config.ts`), so there is no build step during
development and hot module replacement works across the package boundary. Swap
the alias to `packages/pixel-field/dist` to test the package exactly as
published.

### Structure

```
packages/pixel-field/   → @tooldroid/pixel-field (the reusable library)
  src/                  → component, hook, noise/render/config modules
  test/                 → node --test suites (build + golden/paint equivalence)
  bench/                → per-frame benchmarks and RESULTS.md
src/                    → the demo app (a Vite + React landing page)
dist/                   → demo production build output (gitignored)
```

### Scripts

| Script                     | Description                                          |
| -------------------------- | ---------------------------------------------------- |
| `pnpm dev`                 | Start the demo app with HMR.                         |
| `pnpm build`               | Typecheck and build the demo app for production.     |
| `pnpm preview`             | Preview the production build.                        |
| `pnpm build:packages`      | Build the library into `packages/pixel-field/dist`.  |
| `pnpm test`                | Build the library, then run its `node --test` suite. |
| `pnpm bench`               | Per-frame cost of the renderer, old vs new.          |
| `pnpm typecheck`           | Typecheck every project in the workspace.            |
| `pnpm lint`                | Run Oxlint.                                          |
| `pnpm format`              | Format the whole workspace with Prettier.            |
| `pnpm format:check`        | Check formatting without writing.                    |
| `pnpm run publish`         | Publish the library to npm (builds first).           |
| `pnpm run publish:dry-run` | Print what would be published, without uploading.    |

Library-scoped equivalents (`pnpm --filter @tooldroid/pixel-field …`) are
listed in [`packages/pixel-field/README.md`](./packages/pixel-field/README.md).

## Publishing

The package ships ESM, CJS and type declarations. To publish a new version:

```sh
# bump the version first (in packages/pixel-field)
pnpm --filter @tooldroid/pixel-field version patch

# see exactly what would go into the tarball
pnpm run publish:dry-run

# publish
pnpm run publish
```

`publish` is a thin alias for
`pnpm --filter @tooldroid/pixel-field publish --access public`. The package's
`prepublishOnly` hook typechecks and runs the test suite — which rebuilds
`dist` first — so a stale or missing `dist` can never be uploaded.

Notes:

- Authenticate once with `npm login` (or export `NPM_TOKEN`); pnpm reuses npm's
  credentials.
- `pnpm version` and `pnpm publish` both refuse to run on a dirty checkout.
  Commit first; add `--no-git-tag-version` (version) or `--no-git-checks`
  (publish) to skip the git bookkeeping.
- `files` in `packages/pixel-field/package.json` already limits the tarball to
  `dist` and the README, and `dist` is gitignored.
- The package name is scoped, so `access: public` is set in `publishConfig`
  (and passed via `--access public`) — scoped packages default to restricted
  and would otherwise fail without a paid npm org.

## Tooling

- [Vite](https://vite.dev/) + [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Oxlint](https://oxc.rs/docs/guide/usage/linter.html) for linting
- [Prettier](https://prettier.io/) with import sorting and Tailwind class sorting
- [tsup](https://tsup.egoist.dev/) for building the library
- Plain `node --test` for tests, run against the built `dist` with golden cases
  guarding the renderer

## License

MIT — see [`packages/pixel-field/package.json`](./packages/pixel-field/package.json).
