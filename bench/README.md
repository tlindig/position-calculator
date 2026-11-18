# Benchmark

Scripts that anyone can run to repeat the measurements behind the comparison of `@tlindig/position-calculator` with Floating UI, Popper, Tether and Tippy. The folder is not part of the published package, not in CI, and has its own `package.json` so that the comparison libraries are not dependencies of the project.

The numbers depend on the machine, the load and the Chrome version. Run it on your machine before you quote a number. The files in `reference/` are the run that the documentation quotes (Chrome version and date are inside each file).

## What it measures

| Script  | Question                                                                          | Result file     |
| ------- | --------------------------------------------------------------------------------- | --------------- |
| `count` | How many layout reads and style writes does one call of this library cause?       | `count.json`    |
| `size`  | How large is the bundle of each library (minified, gzip, brotli)?                 | `size.json`     |
| `bench` | How long does one round for N elements take, in the same scene for every library? | `results*.json` |
| `chart` | A chart of the `bench` result of the scene without overflow.                      | `chart.svg`     |

`count` and `size` are exact: the same input gives the same numbers. `bench` is a timing and varies from run to run.

What it does **not** measure: real application code, memory, start-up cost, other browsers, touch devices, or the quality of the placement. A tool that does more (see Limits) is not wrong for being slower in a scene that does not need the extra work.

## Run it

```sh
npm run build          # in the project root: the benchmark uses dist/position-calculator.js
cd bench
npm ci                 # installs the comparison libraries into bench/node_modules
npm run count          # about 1 s
npm run size           # about 1 s
npm run bench -- 100   # up to 100 elements, about 20 s
npm run bench -- 500   # up to 500 elements, about 40 s
npm run bench -- 500 overflow   # scene with overflow, about 35 s
npm run bench -- 500 extra      # Floating UI counter check, about 25 s
npm run chart          # needs the result of `npm run bench`, writes results/chart.svg
```

Durations were measured on the reference machine (12 threads) with Chrome 157. Results go to `bench/results/`, which git ignores. Each `bench` run overwrites the result file of its scene, so keep a copy if you want to compare two runs.

Chrome is found like `test/run.js` finds it: the environment variable `CHROME`, then `google-chrome`, `chromium`, `chromium-browser`. It runs headless through Playwright, which the project root provides (`npm ci` in the root).

## The scenes of `bench`

**Scene without overflow** (default). Every element is an item of 80 x 30 px with its own target of 60 x 24 px. The targets sit in a grid of 20 columns, 100 x 80 px per cell, in a window of 2300 x 2300 px. Every library places the item at the bottom left of its target. After each run the script checks the position: the largest deviation between item and wanted position is 0 px for every library.

This library runs with `flip: "both"` and `stick: "all"`. No item overflows in this scene, so both options are enabled but idle. Floating UI runs with the `flip` and `shift` middleware, which check for overflow on every call. Popper runs with its defaults. Tether runs with a constraint to the window (`together`, `pin`).

**Scene with overflow** (`overflow`). Targets with an even index sit 70 px from the right edge of the window, targets with an odd index sit 34 px from the bottom edge. The item has to flip or shift. The control `pc-noflip` is this library with `flip: "none"` and `stick: "none"`. The check after the last round is the largest distance by which an item sticks out of the window: 0 px for the libraries that handle it, more for `pc-noflip`.

**Counter check** (`extra`). Floating UI in the scene without overflow, once without middleware and once with `Promise.all` instead of awaiting the calls one after the other. It tests whether the time gap to Floating UI comes from the middleware. Compare the rows within this result only.

## Variants A and B

- **A, calculate only.** Nothing moves, nothing is written. Only this library (`calculate()`) and Floating UI (`computePosition`) can compute without writing.
- **B, apply.** In every round the targets move by a few pixels, all positions are calculated, written as a `transform`, and one layout read follows. The row `baseline` is moving the targets and the layout read alone, so it is part of every B number.

Popper (`forceUpdate` per instance) and Tether (`Tether.position()`) calculate and write by themselves. They cannot compute without writing, so they appear in variant B only.

## The order of reads and writes

The rows `pc` and `fui` in variant B read all positions first and write afterwards. The rows `pc-interleaved` and `fui-interleaved` read and write per item. Reads after a write force a new layout, so the second order is much slower: in the reference run, 500 elements take 5.4 ms for this library with all reads first and 46.5 ms with a read and a write per item. Popper and Tether decide the order themselves. This is a fact about how the caller uses the library, not about the library code.

## Method

- Per point (variant, library, N): 3 passes, each with a fresh DOM and a rotated library order, 10 samples per pass, so 30 samples. Each pass first runs 3 rounds as a warm-up. One sample is the mean of `round(300 / N)` rounds (at least 1).
- The result is the median in ms per round with p10, p90, min and max.
- Instances are created before the timing starts.
- The viewport is 2300 x 2300 px.

`count` wraps the layout getters and `getBoundingClientRect`, `getComputedStyle` and counts inline writes of `position`, `visibility` and `display`. It runs in the same Chrome and measures no time. Scene S3 (hidden item) shows the 12 style writes that measuring a hidden item needs; S9 shows that the reads add up per instance: 100 instances with one shared target cause 3200 reads in the constructors.

`size` bundles one entry file per library from `entries/` with esbuild (ESM, es2020, minified, `NODE_ENV=production`) and measures the output with `node:zlib`. The entry decides the result: for example `fui-min` is `computePosition` alone, `fui-typical` adds `flip`, `shift`, `limitShift`, `offset` and `autoUpdate`. The row `pc` bundles `dist/position-calculator.js`. The row `pc-iife-as-shipped` is the shipped minified file without bundling, as a second check. Tippy's CSS is not counted.

## Limits

- One browser (headless Chrome), one machine per run. No Firefox, no Safari, no mobile.
- Two scenes with one target per item, no scroll above 0 and no scroll containers. Whether an item overflows decides how much work `flip` and `shift` of Floating UI do.
- Other tools do more. Floating UI checks clipping ancestors and offers `autoUpdate`. Popper and Tether listen to scroll and resize and know scroll parents. This library has none of it: the caller calls `calculate()` again. A time comparison does not compare equal work.
- Popper and Tether write the styles themselves, so only variant B compares them. Tippy is a complete UI on top of Popper and is only in `size`, not timed.
- No real game or application code. The call pattern of your code can change the numbers by a factor, see the order of reads and writes.
- Sizes depend on the entry point and the bundler. Other entries or other bundlers give other numbers.
- The libraries are pinned in `package.json` (exact versions). Newer versions can give other numbers.
