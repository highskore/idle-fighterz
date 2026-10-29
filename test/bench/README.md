# JS against Rust in the browser

`npm run bench` builds the site page with its Rust engine (it needs `npm run wasm:rust` first) and plays every scene
below on `planet.html` and `planet.html?rust`, headless, over a local server, in Chromium and WebKit, as a desktop
(1280×800) and as a phone (390×844 at 3×, touch). In Chromium the phone also gets a 4× CPU slowdown
(`Emulation.setCPUThrottlingRate`, `--throttle`); WebKit has no CPU throttling in Playwright, so its phone is only the
viewport, the pixel ratio and touch. It writes `results.json` (ignored by git) and prints the tables.
`PLANET_BENCH_WEBKIT=<playwright-core package>` runs WebKit from another Playwright whose WebKit is installed.

Scenes, by preview hook, each played for 6 s after 2 s of warm-up past the intro: home (no hook, nobody touching it),
a raid (`#raid`), big bangs thrown at it (`#raid` and a double tap every 3 s), a beam struggle (`#struggle`), snake way
(`#snake`), Shenron (`#shenron`), a late form (`#mui`) and the multiverse arena (`#top`).

**Real time, seeded randomness.** Frame pacing is what's measured, so time is the browser's own: Playwright's fake clock
(what `test/browser` uses) turns animation frames into timers. `Math.random` is the tests' seeded LCG, so both engines
start the same game and play close to the same one. The 3D title is left out of the page: it's WebGL, the same for
both engines, and in headless software rendering it would swamp the game.

What's measured:

- **ms/frame**: how long the animation-frame callback that drew the game took (page.html's tick: the game's frame,
  the HUD update and `putImageData`), mean, 95th and 99th percentile and the mean of the worst 1%. The page draws the
  game at 30 fps.
- **dropped %**: display frames missed, from the gaps between animation frames (a gap of n intervals drops n − 1).
- **busy %**: the time spent in those callbacks per second of wall time.
- **load**: `DOMContentLoaded`, and the first frame of the game on the canvas, which is when the page answers input
  (with `?rust` the page's code starts once the wasm is in, so the wasm's fetch and compile land in it).
- **idle CPU %**: Chromium's main-thread task time per second of wall time in the home scene (WebKit: busy %).
- **memory**: Chromium's JS heap after a GC, and the Rust engine's wasm memory.

## Results

Measured 2026-10-29 on an Apple M1 Pro (10 cores), Chromium 1248 (Playwright 1.64.1) and WebKit 2215 (Playwright
1.56.1), with the wasm build this branch ships. The machine was busy with other work throughout: load average 8.3
before and 13.1 after, on 10 cores. The numbers are good for comparing the two engines run back to back, scene by
scene, not as absolutes; repeat runs moved them by about 10%. WebKit's clock is coarse (whole milliseconds), hence its
round percentiles. No scene dropped a meaningful number of frames on either engine (headless, 60 Hz).

ms per drawn frame, JS / Rust:

| browser | profile | scene | ms/frame mean JS / Rust | p95 | p99 | worst 1% | dropped % | busy % |
|---|---|---|---|---|---|---|---|---|
| chromium | desktop | home | 2.14 / 1.57 | 4.00 / 2.80 | 4.60 / 3.60 | 5.00 / 3.60 | 0.0 / 0.0 | 6.4 / 4.7 |
| chromium | desktop | raid | 2.10 / 1.98 | 3.70 / 3.40 | 4.80 / 4.10 | 4.90 / 4.40 | 0.0 / 0.0 | 6.3 / 6.0 |
| chromium | desktop | big bang | 2.16 / 2.00 | 3.80 / 3.40 | 4.20 / 5.10 | 4.55 / 5.60 | 0.0 / 0.0 | 6.5 / 6.0 |
| chromium | desktop | struggle | 2.16 / 1.71 | 3.60 / 3.00 | 4.20 / 3.20 | 4.45 / 3.25 | 0.0 / 0.0 | 6.5 / 5.1 |
| chromium | desktop | snake way | 3.57 / 4.13 | 5.30 / 6.30 | 7.00 / 7.60 | 7.70 / 7.80 | 0.0 / 0.0 | 10.7 / 12.4 |
| chromium | desktop | shenron | 3.08 / 3.19 | 5.20 / 5.60 | 6.10 / 6.60 | 6.10 / 6.65 | 0.0 / 0.0 | 9.3 / 9.6 |
| chromium | desktop | late form | 2.35 / 1.83 | 4.30 / 3.20 | 5.00 / 5.80 | 5.05 / 6.60 | 0.0 / 0.0 | 7.1 / 5.5 |
| chromium | desktop | multiverse | 2.67 / 3.80 | 4.50 / 6.80 | 5.30 / 7.20 | 5.45 / 7.25 | 0.0 / 0.0 | 8.1 / 11.4 |
| chromium | phone | home | 5.27 / 4.20 | 5.90 / 5.00 | 6.10 / 5.20 | 6.15 / 5.45 | 0.0 / 0.0 | 15.8 / 12.6 |
| chromium | phone | raid | 6.18 / 4.55 | 6.80 / 5.30 | 7.20 / 5.80 | 7.40 / 6.50 | 0.0 / 0.0 | 18.5 / 13.6 |
| chromium | phone | big bang | 6.23 / 4.50 | 6.80 / 5.30 | 7.90 / 5.90 | 7.95 / 5.90 | 0.0 / 0.0 | 18.7 / 13.5 |
| chromium | phone | struggle | 6.57 / 4.65 | 7.60 / 5.40 | 8.10 / 5.60 | 9.20 / 6.65 | 0.0 / 0.0 | 19.7 / 13.9 |
| chromium | phone | snake way | 10.26 / 11.76 | 13.00 / 22.40 | 14.50 / 27.80 | 14.75 / 27.95 | 0.0 / 0.3 | 30.8 / 35.2 |
| chromium | phone | shenron | 8.94 / 8.35 | 9.60 / 9.20 | 10.30 / 9.80 | 11.45 / 11.40 | 0.0 / 0.0 | 26.9 / 25.0 |
| chromium | phone | late form | 5.95 / 4.37 | 6.60 / 5.10 | 6.90 / 5.80 | 7.00 / 5.95 | 0.0 / 0.0 | 17.8 / 13.1 |
| chromium | phone | multiverse | 8.81 / 13.67 | 9.60 / 14.40 | 10.00 / 14.90 | 10.20 / 14.90 | 0.0 / 0.8 | 26.5 / 41.0 |
| webkit | desktop | home | 2.59 / 2.65 | 4.00 / 4.00 | 5.00 / 6.00 | 5.50 / 7.00 | 0.0 / 0.3 | 7.5 / 7.3 |
| webkit | desktop | raid | 2.66 / 2.48 | 4.00 / 4.00 | 4.00 / 5.00 | 5.00 / 5.00 | 0.0 / 0.0 | 7.6 / 6.8 |
| webkit | desktop | big bang | 2.46 / 2.11 | 4.00 / 4.00 | 5.00 / 4.00 | 5.50 / 4.00 | 0.0 / 0.0 | 7.1 / 5.9 |
| webkit | desktop | struggle | 2.78 / 2.32 | 4.00 / 4.00 | 5.00 / 5.00 | 6.00 / 6.00 | 0.0 / 0.0 | 7.9 / 6.5 |
| webkit | desktop | snake way | 7.57 / 5.09 | 9.00 / 9.00 | 10.00 / 10.00 | 10.00 / 10.50 | 0.0 / 0.0 | 22.2 / 14.9 |
| webkit | desktop | shenron | 4.57 / 3.71 | 9.00 / 6.00 | 11.00 / 7.00 | 11.50 / 7.00 | 0.3 / 0.3 | 12.6 / 10.4 |
| webkit | desktop | late form | 3.52 / 2.68 | 6.00 / 4.00 | 7.00 / 5.00 | 7.50 / 6.00 | 0.0 / 0.0 | 10.0 / 7.2 |
| webkit | desktop | multiverse | 3.73 / 5.82 | 6.00 / 9.00 | 8.00 / 10.00 | 8.00 / 11.00 | 0.0 / 0.0 | 10.3 / 16.3 |
| webkit | phone | home | 3.75 / 2.95 | 6.00 / 5.00 | 6.00 / 6.00 | 6.50 / 7.00 | 0.0 / 0.0 | 10.4 / 8.2 |
| webkit | phone | raid | 3.84 / 2.53 | 6.00 / 5.00 | 7.00 / 6.00 | 7.00 / 6.00 | 0.0 / 1.1 | 10.9 / 7.0 |
| webkit | phone | big bang | 3.71 / 3.08 | 6.00 / 5.00 | 7.00 / 6.00 | 7.00 / 6.00 | 0.0 / 0.0 | 10.4 / 8.5 |
| webkit | phone | struggle | 4.09 / 2.61 | 7.00 / 5.00 | 7.00 / 5.00 | 7.50 / 5.50 | 0.0 / 0.3 | 11.7 / 7.4 |
| webkit | phone | snake way | 6.28 / 5.91 | 9.00 / 10.00 | 10.00 / 11.00 | 10.50 / 11.50 | 0.0 / 0.0 | 18.6 / 16.8 |
| webkit | phone | shenron | 4.74 / 4.46 | 8.00 / 7.00 | 10.00 / 8.00 | 10.50 / 8.00 | 0.3 / 0.6 | 13.2 / 12.5 |
| webkit | phone | late form | 3.16 / 2.84 | 5.00 / 4.00 | 7.00 / 8.00 | 8.00 / 8.50 | 0.0 / 0.0 | 9.0 / 7.7 |
| webkit | phone | multiverse | 3.82 / 6.08 | 6.00 / 10.00 | 9.00 / 11.00 | 9.00 / 11.00 | 0.0 / 0.0 | 10.5 / 17.2 |

| browser | profile | load: DCL ms JS / Rust | first frame (TTI) ms | idle CPU % (home) | JS heap MB | array buffers MB | wasm memory MB |
|---|---|---|---|---|---|---|---|
| chromium | desktop | 157 / 98 | 152 / 148 | 10.6 / 7.5 | 3.7 / 2.6 | 2.3 / 2.3 | 7.0 |
| chromium | phone | 518 / 431 | 600 / 589 | 26.3 / 19.0 | 3.4 / 2.7 | 2.3 / 2.3 | 7.3 |
| webkit | desktop | 130 / 87 | 151 / 150 | 7.5 / 7.3 | n/a / n/a | n/a / n/a | 7.0 |
| webkit | phone | 108 / 81 | 126 / 144 | 10.4 / 8.2 | n/a / n/a | n/a / n/a | 7.3 |

load average 8.3 8.8 9.5 before, 13.1 11.1 10.3 after (10 cpus)

The page is served from localhost, so these load times leave the download out: the extra bytes `?rust` fetches are
below. "array buffers" is V8's backing-store total, which doesn't count the wasm memory; that has its own column.

## Download size

Brotli at quality 11, as a CDN serves it; raw and gzip -9 for reference.

| | raw | gzip | brotli |
|---|---|---|---|
| `planet.html` (the default page, both engines' loader) | 984,057 | 342,767 | 297,949 |
| `planet.html` before this branch | 983,604 | 342,507 | 297,570 |
| `planet-rust.js` (wasm-bindgen glue and the shim, minified) | 11,343 | 3,699 | 3,319 |
| `planet-rust.wasm` | 772,353 | 310,369 | 253,544 |
| the old `--rust` page (one file, wasm inlined as base64, game.js twin, not minified) | 2,446,423 | 832,422 | 679,197 |
| the old wasm, release profile (opt-level 3, thin LTO, no wasm-opt) | 1,069,471 | 343,280 | 272,165 |
| the old glue | 20,325 | 3,983 | 3,489 |

So `?rust` downloads 298 + 257 = 555 KB against the JS page's 298 KB. Of the wasm, about 75 KB (brotli) is data, 31 KB
of it the baked sprites (`planet-core/data/sprites.bin`), which game.js paints from code at load instead.

## The wasm build's opt-level

The `wasm` profile builds everything at `opt-level = "z"` except planet-render, at 3: the per-pixel drawing is where
the frame time goes. All variants with fat LTO, one codegen unit, `panic = "abort"`, stripped, then `wasm-opt -Oz`.
Frame time is Chromium's phone profile (4× throttle), JS / Rust, from back-to-back runs of the same build of the page.

| opt-level | wasm brotli | home | raid | snake way | multiverse |
|---|---|---|---|---|---|
| `"z"` | 235,510 | 5.41 / 7.58 | 6.16 / 8.04 | 10.17 / 13.95 | 8.84 / 16.67 |
| `"s"` | 246,585 | 5.37 / 5.35 | 6.10 / 5.45 | 10.08 / 12.22 | 8.61 / 14.53 |
| 3 | 270,729 | 5.56 / 4.12 | 6.26 / 4.35 | 10.20 / 7.81 | 8.85 / 13.34 |
| `"z"`, planet-render 3 (shipped) | 253,544 | 5.27 / 4.20 | 6.18 / 4.55 | 10.26 / 11.76 | 8.81 / 13.67 |

The shipped row is from the full run above; the others from a shorter run of those four scenes each. The multiverse
arena is slower in Rust at every opt-level. It isn't profiled yet; a likely cause is that its stands and pillars are
shaded per pixel with `sin` and noise, which the port's `jsmath` computes bit for bit as V8 does, in wasm, where
game.js calls V8's built-in.
