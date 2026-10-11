# PixelField performance results

Numbers come from `bench/browser.html`, which runs the real renderer on a real
`<canvas>` (unlike `bench/frame-cost.mjs`, whose mock draw calls are free).

## How to read this

Run the harness, then read `window.__result`:

```sh
python3 -m http.server 4173 --directory packages/pixel-field
# open http://localhost:4173/bench/browser.html?w=1920&h=1080&dpr=1
```

| Field | Meaning |
| --- | --- |
| `paintP50/P95` | ms inside `paintField` — scripting only (noise, keys, sort, draw calls) |
| `rafP50/P95` | RAF-to-RAF interval — includes rasterization, compositing, everything |
| `periodMs` | Display refresh period, probed with empty callbacks before the run |
| `droppedPct` | Frames longer than `1.5 × periodMs` |
| `severePct` | Frames longer than `2.5 × periodMs` |

## Caveats — read before drawing conclusions

- **This machine is a shared desktop** (load average ~3.7 with a browser and an
  editor open), so absolute numbers are inflated and run-to-run variance is
  high. Compare variants *interleaved* and prefer the best (lowest) of ≥3 runs;
  treat deltas under ~10% as noise.
- **It is not a phone.** The `CPU 4x` rows emulate a slower device via Chrome's
  CPU throttling and are the closest thing to mobile here.
- Rasterization cost scales with the backing store (`dpr` × `renderScale`),
  while `paintP50` does not. A variant can win on one and lose on the other.

## Baseline (commit `7219887`, before any change in this branch)

3 interleaved rounds, 200 measured frames after 40 warm-up frames, default
config (`octaves: 4`, `spacing: 16`, no render scale).

| Case | Cells | paint p50 min / med / max (ms) | raf p50 | dropped |
| --- | ---: | ---: | ---: | ---: |
| mobile 390×844 @2x | 1 568 | **1.5** / 1.7 / 2.1 | 16.7 ms | 0 % |
| hd 1280×720 @1x | 3 984 | **3.2** / 3.3 / 3.3 | 16.7 ms | 0 % |
| fhd 1920×1080 @1x | 8 733 | **6.8** / 8.4 / 10.4 | 16.7 ms | 0 % |
| fhd 1920×1080 @1x, static clock | 8 733 | **7.7** / 10.3 / 10.7 | 16.7 ms | ~0 % |
| uhd 2560×1440 @2x | 15 159 | **16.2** / 17.1 / 20.9 | 16.7 ms | 15–40 % |
| fhd, CPU throttled 4× | 8 733 | **34.6** / 34.6 / 36.6 | 33.4 ms | 100 % |

### What the baseline says

1. **Scripting, not compositing, is the cost at 1080p.** Static and animated
   runs paint in ~7–11 ms while `rafP50` stays pinned at 16.7 ms, so the
   rasterizer is not the limiter — the per-cell noise work is.
2. **1080p is already near budget on a busy desktop** (6.8 ms of a 16.7 ms
   frame for the effect alone; React, layout and compositing share the rest).
3. **A slower device cannot hold the frame rate at all.** Under 4× CPU
   throttling a single frame's paint is 34.6 ms — 100 % of frames miss the
   budget and half take more than two periods. This is the case adaptive
   quality exists for.
4. **High-DPI large displays are the other failure mode.** 2560×1440 @2x is
   15 159 cells and 16–21 ms of paint, dropping 15–40 % of frames.
5. Mobile is comfortable today (1.5 ms), because `maxCells` coarsens the grid
   on small viewports.

## Change log

Each entry: what changed, and the interleaved delta against the row above it.

<!-- append results below -->
