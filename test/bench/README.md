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
  (with `?rust` the game mounts once the wasm is in, so its fetch and compile land in it).
- **idle CPU %**: Chromium's main-thread task time per second of wall time in the home scene (WebKit: busy %).
- **memory**: Chromium's JS heap after a GC, and the Rust engine's wasm memory.

## Results

Measured 2026-10-29 on an Apple M1 Pro (10 cores), Chromium 1248 (Playwright 1.64.1) and WebKit 2215 (Playwright
1.56.1), with the wasm build this branch ships. The machine was busy with other work throughout (another agent's
builds): load average 12.9 before and 9.6 after, on 10 cores. The numbers are good for comparing the two engines run
back to back, scene by scene, not as absolutes; repeat runs moved them by about 10%, WebKit's by more (three repeats of
its multiverse arena on the phone gave Rust 4.4, 4.1 and 5.4 against JS's 3.4, 3.0 and 4.3). WebKit's clock is coarse
(whole milliseconds), hence its round percentiles. No scene dropped a meaningful number of frames on either engine
(headless, 60 Hz).

ms per drawn frame, JS / Rust:

| browser | profile | scene | ms/frame mean JS / Rust | p95 | p99 | worst 1% | dropped % | busy % |
|---|---|---|---|---|---|---|---|---|
| chromium | desktop | home | 1.76 / 1.87 | 4.00 / 3.60 | 5.30 / 4.70 | 5.55 / 4.95 | 0.0 / 0.0 | 5.3 / 5.6 |
| chromium | desktop | raid | 2.59 / 1.58 | 4.50 / 3.50 | 6.10 / 6.80 | 6.15 / 7.35 | 0.0 / 0.0 | 7.8 / 4.8 |
| chromium | desktop | big bang | 2.48 / 1.35 | 4.80 / 3.50 | 5.80 / 5.90 | 6.25 / 6.75 | 0.0 / 0.0 | 7.4 / 4.0 |
| chromium | desktop | struggle | 2.50 / 1.01 | 4.90 / 1.30 | 6.30 / 2.80 | 6.70 / 2.80 | 0.0 / 0.0 | 7.5 / 3.0 |
| chromium | desktop | snake way | 2.99 / 1.28 | 4.10 / 1.80 | 5.20 / 2.10 | 5.25 / 2.15 | 0.0 / 0.0 | 8.9 / 3.8 |
| chromium | desktop | shenron | 1.85 / 1.38 | 2.00 / 1.60 | 2.10 / 1.70 | 2.50 / 2.00 | 0.0 / 0.0 | 5.6 / 4.1 |
| chromium | desktop | late form | 1.28 / 0.89 | 1.40 / 1.10 | 1.40 / 1.20 | 1.45 / 1.25 | 0.0 / 0.0 | 3.9 / 2.7 |
| chromium | desktop | multiverse | 1.66 / 1.70 | 1.80 / 2.80 | 1.90 / 3.20 | 1.90 / 3.25 | 0.0 / 0.0 | 5.0 / 5.1 |
| chromium | phone | home | 5.34 / 4.14 | 6.10 / 4.80 | 6.30 / 5.40 | 6.30 / 5.45 | 0.0 / 0.0 | 16.0 / 12.5 |
| chromium | phone | raid | 6.19 / 4.34 | 6.90 / 5.10 | 7.60 / 5.40 | 7.60 / 5.80 | 0.0 / 0.0 | 18.5 / 13.0 |
| chromium | phone | big bang | 6.24 / 4.43 | 6.90 / 5.30 | 7.20 / 5.70 | 7.25 / 5.80 | 0.0 / 0.0 | 18.8 / 13.3 |
| chromium | phone | struggle | 6.33 / 4.51 | 7.00 / 5.20 | 7.30 / 5.60 | 8.25 / 6.75 | 0.0 / 0.0 | 19.1 / 13.5 |
| chromium | phone | snake way | 10.65 / 4.77 | 13.10 / 7.90 | 15.40 / 9.80 | 15.45 / 9.80 | 0.0 / 0.0 | 31.8 / 14.3 |
| chromium | phone | shenron | 9.24 / 6.98 | 9.90 / 7.60 | 10.30 / 8.60 | 11.75 / 10.10 | 0.0 / 0.3 | 27.6 / 20.9 |
| chromium | phone | late form | 5.98 / 4.36 | 6.60 / 5.30 | 6.80 / 5.90 | 6.95 / 6.10 | 0.0 / 0.0 | 17.9 / 13.1 |
| chromium | phone | multiverse | 8.81 / 6.39 | 9.50 / 7.10 | 10.00 / 7.50 | 10.05 / 7.50 | 0.0 / 0.0 | 26.5 / 19.2 |
| webkit | desktop | home | 2.46 / 2.10 | 5.00 / 4.00 | 7.00 / 5.00 | 10.00 / 5.00 | 0.0 / 0.0 | 7.1 / 6.0 |
| webkit | desktop | raid | 2.67 / 1.88 | 5.00 / 4.00 | 7.00 / 5.00 | 7.50 / 5.00 | 0.0 / 0.0 | 7.6 / 5.2 |
| webkit | desktop | big bang | 2.46 / 1.96 | 4.00 / 4.00 | 4.00 / 5.00 | 10.00 / 6.00 | 0.0 / 0.0 | 7.1 / 5.4 |
| webkit | desktop | struggle | 2.74 / 2.29 | 4.00 / 4.00 | 6.00 / 5.00 | 6.00 / 5.50 | 0.0 / 0.0 | 7.9 / 6.3 |
| webkit | desktop | snake way | 7.10 / 3.45 | 9.00 / 6.00 | 10.00 / 7.00 | 10.00 / 8.00 | 0.0 / 0.0 | 20.8 / 10.0 |
| webkit | desktop | shenron | 3.84 / 3.12 | 6.00 / 5.00 | 7.00 / 7.00 | 7.00 / 7.00 | 0.0 / 0.0 | 11.1 / 8.7 |
| webkit | desktop | late form | 2.61 / 2.15 | 4.00 / 4.00 | 5.00 / 5.00 | 5.00 / 5.50 | 0.0 / 0.0 | 7.7 / 6.2 |
| webkit | desktop | multiverse | 2.79 / 3.21 | 4.00 / 5.00 | 5.00 / 6.00 | 5.00 / 6.00 | 0.0 / 0.0 | 8.1 / 9.2 |
| webkit | phone | home | 2.94 / 2.33 | 5.00 / 4.00 | 6.00 / 4.00 | 6.00 / 4.50 | 0.0 / 0.6 | 8.5 / 6.4 |
| webkit | phone | raid | 3.37 / 2.51 | 6.00 / 4.00 | 7.00 / 5.00 | 7.50 / 5.00 | 0.0 / 0.0 | 9.6 / 7.2 |
| webkit | phone | big bang | 3.16 / 2.66 | 5.00 / 5.00 | 6.00 / 6.00 | 6.00 / 6.00 | 0.0 / 0.0 | 9.2 / 7.5 |
| webkit | phone | struggle | 3.46 / 2.57 | 5.00 / 4.00 | 5.00 / 5.00 | 5.50 / 5.00 | 0.0 / 0.0 | 10.1 / 7.5 |
| webkit | phone | snake way | 7.60 / 3.45 | 10.00 / 6.00 | 11.00 / 8.00 | 11.00 / 10.00 | 0.0 / 0.0 | 22.5 / 9.9 |
| webkit | phone | shenron | 4.22 / 4.05 | 7.00 / 6.00 | 8.00 / 7.00 | 8.00 / 7.50 | 0.3 / 0.0 | 12.0 / 11.2 |
| webkit | phone | late form | 3.31 / 2.78 | 5.00 / 4.00 | 6.00 / 5.00 | 6.00 / 5.00 | 0.0 / 0.0 | 9.5 / 7.8 |
| webkit | phone | multiverse | 3.79 / 4.35 | 6.00 / 7.00 | 7.00 / 7.00 | 7.00 / 8.00 | 0.0 / 0.0 | 10.7 / 12.1 |

| browser | profile | load: DCL ms JS / Rust | first frame (TTI) ms | idle CPU % (home) | JS heap MB | array buffers MB | wasm memory MB |
|---|---|---|---|---|---|---|---|
| chromium | desktop | 139 / 116 | 134 / 188 | 9.5 / 9.6 | 3.7 / 2.6 | 2.3 / 2.3 | 6.3 |
| chromium | phone | 506 / 529 | 545 / 591 | 26.3 / 18.2 | 3.4 / 2.6 | 2.3 / 2.3 | 7.3 |
| webkit | desktop | 137 / 121 | 153 / 195 | 7.1 / 6.0 | n/a / n/a | n/a / n/a | 6.3 |
| webkit | phone | 108 / 97 | 126 / 171 | 8.5 / 6.4 | n/a / n/a | n/a / n/a | 6.4 |

The page is served from localhost here, so these load times leave the download out; `load.mjs` below adds it.
"array buffers" is V8's backing-store total, which doesn't count the wasm memory; that has its own column.

### Before and after the wasm's profiling pass

The two scenes Rust lost, Chromium's phone at 4×, JS / Rust, ms per drawn frame (mean, p95), main's build against this
branch's, run back to back (load average 9.5 to 12.5):

| scene | before | after |
|---|---|---|
| snake way | 9.89 / 11.47, p95 11.9 / 21.7 | 10.65 / 4.77, p95 13.1 / 7.9 |
| multiverse | 8.45 / 13.45, p95 9.2 / 14.2 | 8.81 / 6.39, p95 9.5 / 7.1 |
| WebKit desktop multiverse | 4.29 / 7.25 | 2.79 / 3.21 |
| WebKit phone multiverse | 2.04 / 4.14 | 3.79 / 4.35 |

What the profile showed (`node --cpu-prof` on a build that keeps its names, and planet-render's native `drawbench`
example): half the arena's frame in software `fma` (wasm has no fused multiply-add, and `jsmath` fuses where V8 on
arm64 does), `pow` for every planet pixel, `fmod` inside `ToInt32` and snake way's `x % 2`, and `js_round`, `sin`
and `cos` left out of line at planet-core's opt-level z. The fixes keep every bit: `fma` emulated exactly, the
helpers inlined, `pow(1 - n.z, 3)` remembered by its argument, ToInt32 without `fmod`, an exact `rem2`, and snake
way's sky and floor mixing four colours a row instead of one a pixel. What's left in the arena is `sin` and `acos`
for every pixel of its floor, which JavaScriptCore's built-ins still do faster.

### Load: title and first game frame

`node test/bench/load.mjs` loads the page in Chromium as a phone, over a local server that sends brotli, with DevTools'
Fast 4G and 4× CPU and without throttling, and times navigation to the 3D title's first draw on screen and to the game's
first frame on the card (median of 5, cache off). `?rust` used to hold the whole page until its wasm was in; now the
head starts the glue and a streaming compile of the wasm, the page runs at once, and only the game's mount waits.

| network, CPU | engine | DCL ms (before / after) | title visible ms | first game frame ms |
|---|---|---|---|---|
| Fast 4G, 4× CPU | JS | 1783 / 1700 | 1811 / 1727 | 771 / 750 |
| Fast 4G, 4× CPU | Rust | 772 / 1643 | 2321 / 1668 | 2374 / 1728 |
| no throttling | JS | 959 / 952 | 966 / 959 | 134 / 134 |
| no throttling | Rust | 123 / 951 | 920 / 958 | 932 / 989 |

(Load average 13.5 to 19 during these.) The title now shows as soon as on the JS page. The game's first frame still
comes later: game.js draws while the page is still parsing, and the Rust engine needs its 260 KB in and compiled, and
then the main thread free (headless WebGL takes most of a second to build the title). If the card is on screen, or
start is pressed, before the engine is in, the card shows a pixel dragon ball charging ki (static with reduced motion,
no text), gone the moment the game mounts; `load.mjs --shot` holds the wasm back to capture it:

![the card while the engine loads](../../docs/ki-charging.png)

## Download size

Brotli at quality 11, as a CDN serves it; raw and gzip -9 for reference.

| | raw | gzip | brotli |
|---|---|---|---|
| `planet.html` (the default page, both engines' loader) | 985,588 | 345,351 | 298,285 |
| `planet.html` on main | 984,057 | 344,471 | 297,807 |
| `planet-rust.js` (wasm-bindgen glue and the shim, minified) | 11,524 | 3,731 | 3,354 |
| `planet-rust.wasm` | 822,150 | 321,428 | 260,302 |
| `planet-rust.wasm` on main | 772,677 | 312,280 | 253,866 |
| `planet.html` without game.js and shenron.js | 643,546 | | 187,956 |

So `?rust` downloads 298 + 264 = 562 KB against the JS page's 298 KB; the inlining above cost the wasm 6.4 KB. Of the
wasm, about 75 KB (brotli) is data, 31 KB of it the baked sprites (`planet-core/data/sprites.bin`). By crate the code is
about half planet-render's drawing (one function at opt-level 3 once everything is inlined into it), a third
planet-core's game, and the rest core's formatting and float parsing, alloc and dlmalloc.

**Rust as the default.** The page would stop inlining game.js and shenron.js (110 KB of its 298): 188 KB of page (HUD,
menus, fonts, three.js and the title, world.js) plus 264 KB of engine, about 452 KB brotli, against 298 KB for today's
JS page. game.js would become a third file fetched only where WebAssembly can't run (none of the browsers the site
targets), and the shim's two uses of it, the heroes' thumbnails in the menu and the share card, would take their pixels
from planet-core's `make_hero` instead. Painting the 184 baked sprites from a Rust port of their paint programs would
trade 31 KB of data for the Rust of hundreds of lines of game.js's drawing code: likely 10 KB saved at most, so it
isn't done here.

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

Those rows are main's build, before the profiling pass; the shipped row is from main's full run, the others from a
shorter run of those four scenes each. After the pass, the draw alone (node, unthrottled, a 195×422 buffer, ms per
frame) at planet-render's three candidate levels:

| planet-render at | wasm brotli | home | snake way | multiverse | shenron |
|---|---|---|---|---|---|
| `"z"` | 239,235 | 1.85 | 1.93 | 2.64 | 2.65 |
| `"s"` | 243,467 | 1.12 | 1.69 | 1.69 | 1.80 |
| 3 (shipped) | 260,302 | 0.86 | 1.05 | 1.51 | 1.53 |

so planet-render stays at 3.
