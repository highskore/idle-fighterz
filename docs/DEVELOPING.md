# Developing planet

How the page is put together, how to build it, the preview hooks, the Rust engine and where the game is used. For what the game is, see the [README](../README.md).

**Where to build: `rust/`.** The game is the Rust engine (`rust/planet-core` plays it, `rust/planet-render` draws it), and the site runs it by default. `game.js` and `shenron.js` are frozen: the legacy fallback for browsers without WebAssembly, and the widget's web-view build until the widget draws natively by default. New features go in Rust only; the HUD stays in `page.html`. CI fails a pull request that changes game.js or shenron.js unless it has the `legacy-js` label or a commit with a `Legacy-JS: <why>` trailer (`.github/workflows/legacy-js.yml`), so a fix to the fallback is always on purpose.

## The game

- **The title**: "highskore" in 3D pearl (three.js, Bagel Fat One). Letters wave, pop on hover, bounce when tapped, and sweep through each transformation's colour.
- **The scroll intro**: the page opens on the title alone. Scrolling settles it into place and brings up the game card. On phones the page doesn't scroll: the cue reads "press for fun" and plays the same intro (a swipe up works too), the title starts stacked as high / skore and the letters collide on their way into one line.
- **The game**: Vegeta runs laps around a draggable planet over a sea of golden clouds. Tap to train, hold to charge a galick gun, drag to spin.
  - 15 upgrades, from weighted boots to Piccolo, the time chamber, instant transmission and ascension.
  - Forms from super saiyan to ultra instinct.
  - Events: dragon balls and Shenron, great ape mode, villain raids (Frieza, Cell, Kid Buu, Beerus), the Ginyu Force, the Tournament of Power, the fusion dance, Gregory, King Kai's jokes, Saibamen and meteor showers.
  - Other worlds: the first trip comes at 1M power and each later one further out (`PLANET_EVERY` in `game.js`): a 45-second visit to Namek (where Porunga grants wishes), Planet Vegeta, Beerus' planet, West City, Kame House, Mount Paozu, the future, Kami's lookout, the Kais' world and Yardrat, in turn. Snake Way (a 75-second run) is parked: out of the rotation, `#snake` still shows it.

Every visit starts from zero: power, upgrades, achievements and characters all reset on refresh. Only the date of the last daily bonus is kept in `localStorage` (`hs-power`).

## Building

The site page is one HTML page plus its engine, stitched together from these sources:

| file | what it is |
| --- | --- |
| `page.html` | layout, styles, HUD and the three.js title; `__WORLD__`, `__PLANET__` and `__BAGEL__` are filled in by the build |
| `rust/` | the game: planet-core, planet-render and the web build (`rust/planet-web`), [below](#the-rust-engine) |
| `world.js` | the pixel stage: buffer, sprites, text, particles |
| `game.js` | **frozen**: the legacy JS engine (planet renderer, Vegeta, upgrades, events, villains), the fallback |
| `shenron.js` | **frozen**: Shenron and Porunga for game.js |
| `wasm/` | the per-pixel hot loops in Rust (the planet on plain grass worlds, outlines, the widget's rim), built into `wasm/px.wasm` |
| `bagel.typeface.json` | the title font as a three.js typeface |
| `widget.js`, `widget.css` | the desktop widget's extras, only in the `--widget` build |
| `build.mjs` | stitches them into the page |

```sh
npm ci                    # once: esbuild, subset-font and the fonts (@fontsource)
npm run wasm:rust        # once, and after a Rust change: the engine's wasm build (rust/planet-web/build.sh)
node build.mjs --rust     # → dist/planet.html, the highskore.com homepage, with planet-rust.js, planet-rust.wasm and planet-game.js
node build.mjs --widget   # → dist/index.html under the current directory, the widget's page
```

The site page fetches only its engine: `planet-rust.js` and `planet-rust.wasm` (or, where WebAssembly can't run, `planet-game.js`), which the build writes next to `planet.html`, each asked for with a hash of the build in its URL. `node build.mjs` without `--rust` and without a wasm build writes a page that always runs `planet-game.js`. The build inlines the page's fonts, cut down to the characters the page has (`subset-font`), and three.js, bundled by esbuild with just what the title uses and placed after the game's script, so the game is playable before the title is built; then it minifies the scripts. Only the shipped page is minified: the sources the Rust difftest reads stay as they are. `wasm/px.wasm` is committed and inlined as base64, so the page stays one file. After changing `wasm/src/lib.rs`, rebuild it with `npm run wasm` (Rust and `rustup target add wasm32-unknown-unknown`). The module has no dependencies and imports only `Math.pow`; each function is a line-for-line port of a JS loop that stays as the fallback (no WebAssembly, or a CSP without `wasm-unsafe-eval`), and both draw the same pixels. Code fenced by `/*widget*/…/*/widget*/` in `page.html`, `game.js` and `world.js` is kept only in the widget build; the site build drops it whole, so its output doesn't change. The widget build leaves out three.js and inlines the full fonts from `@fontsource` in the `node_modules` of the directory it runs from.

Serve `dist/` (or open `dist/planet.html`) to play it locally; add `?js` (or `#js`) to the URL to play on game.js instead, for comparison.

### Preview hooks

Add these to the URL to jump straight to something. They only work off the live site (local files, localhost and Vercel previews); on highskore.com they're ignored so nobody can cheat with them:

| hook | what it shows |
| --- | --- |
| `#raid` | a villain raid |
| `#ginyu` | the Ginyu Force |
| `#tournament` | the Tournament of Power |
| `#fusion` | the fusion dance |
| `#visitors` | Gregory and King Kai |
| `#namek` | a Namek visit |
| `#porunga` | a Namek visit, then summon Porunga |
| `#shenron` | summon Shenron |
| `#ape` | the full moon |
| `#frieza` | Frieza's ship lands |
| `#yamcha` | Yamcha in his crater |
| `#gregory` | the Gregory race |
| `#vegeta` | a planet vegeta visit, then nappa |
| `#hero-goku` | play as goku (or `gohan`, `trunks`) |
| `#snake` | snake way |
| `#car` | king kai's car |
| `#kaio` | kaioken already owned |
| `#itx` | instant transmission owned, every world visited, and its picker open |
| `#door` | the time chamber door |
| `#pod` | a saiyan space pod |
| `#storm` | a meteor storm |
| `#spirit` | a nearly full spirit bomb |
| `#struggle` | a villain who starts a beam struggle |
| `#chamber` | the time chamber |

`game.js` has more (`#lookout`, `#beerus`, `#form12`, `#saga3`, `#universe3`, `#godki`…), each marked with a `// preview hook` comment, and hooks combine (`#form2#raid`):

```sh
grep -n 'preview hook' game.js
```

## The Rust engine

`rust/` is the game in Rust, built two ways: to WebAssembly for the site, and natively for the Idle FighterZ widget. The site page runs it: the top of the page starts `planet-rust.js` and `planet-rust.wasm` (streaming compile) while the page, its title and intro start, and the game mounts once they're in; if it's late, the card shows a ki-charging dragon ball. Where WebAssembly is missing, or if the engine fails to load, the page fetches `planet-game.js` (game.js and shenron.js, minified) and runs that; `?js` forces it. Deploying means copying all three files beside `planet.html`. The plan and its stages are in [rust/PLAN.md](../rust/PLAN.md), and the HUD bridge in [rust/HUD.md](../rust/HUD.md).

```sh
npm run wasm:rust       # sh rust/planet-web/build.sh
npm run build:rust      # node build.mjs --rust: the site build, failing without the wasm build
npm run bench           # Rust against ?js in Chromium and WebKit, desktop and a throttled phone (test/bench/README.md)
npm run bench:load      # how soon the title and the first game frame show (test/bench/README.md)
```

**The widget.** `node build.mjs --widget` still inlines game.js: its web-view build plays on it. Its `rust-core` build (in the widget repo) runs planet-core in the app and swaps game.js in that page for its own `hud.js` (`scripts/hud.mjs`), so it needs nothing of game.js. Making native the widget's default means: `rust-core` (and `native-renderer` on macOS) on in its release build, the window loading `hud.html`, `hud.mjs` folded into this build (a `--widget --hud` page with `hud.js` in place of game.js), and `--widget` then no longer reading game.js at all.

## Tests

CI (`.github/workflows/ci.yml`) runs on every pull request and push to main: both page builds; rustfmt, clippy, the tests and the golden traces; the wasm builds (`wasm/px.wasm` must match its source), whose engine the browser jobs use; every preview hook in headless Chromium on the Rust engine; and the pixel baselines on the Rust engine, with game.js's fallback smoke-tested (`@js`: home with `?js` and without WebAssembly). The JS-vs-Rust difftest runs too, but doesn't fail the run (below). `.github/workflows/legacy-js.yml` guards game.js.

```sh
npm test             # both builds, rustfmt, the tests and the golden traces
npm run golden       # the golden traces only (rust/golden)
npm run golden:update  # re-record them, when a change means to change what the game does or draws
npm run difftest:js  # optional: planet-core against game.js (JS_PARITY=1), for behaviour game.js still has
npm run test:hooks   # every preview hook (each "// preview hook" in game.js) at 1280×800 and 390×844: no page or console errors
npm run test:visual  # the pixel baselines in test/browser/__screenshots__ (Linux only: they're rendered on CI), on the engine dist has
npm run shots        # the same screenshots into shots/, without comparing
```

**Golden traces.** game.js is frozen and the Rust engine will move past it, so the test that must pass checks Rust against its own recording: `rust/planet-render/tests/golden.rs` replays 18 scripted scenarios (`rust/golden/<name>.inputs.json`) with drawing on and compares, per simulated second, the state sample's hash and every frame's hash with `rust/golden/<name>.trace`. A pull request that changes what the game does or draws runs `npm run golden:update` and commits the new traces; the diff of each `.trace` file shows from which second each scenario moved, which is what review checks against the change's intent. The first recording's frames were game.js's, frame for frame. The JS-vs-Rust difftest (`rust/difftest`, `JS_PARITY=1`) and the framebuffer and drawn diffs stay runnable, expected to pass only for behaviour game.js still has; CI's `js-parity` job runs the headless one and reports without failing.

The browser tests (`test/browser/`, Playwright) serve the page from disk, run the game on Playwright's fake clock and seed `Math.random` with the difftest's LCG, so a state draws the same pixels every run. The 3D title is stubbed out (software WebGL takes seconds a frame) except in one hooks test. A visual state's canvas must match its baseline exactly; the whole page may differ by a shade where Chromium anti-aliases text and rounded corners. Every CI run uploads its screenshots as the `screenshots` artifact and links them on the pull request. To take new baselines, run the workflow by hand with *update baselines* (it commits them to the branch), or copy a run's `screenshots` artifact over `test/browser/__screenshots__`.

## Where it's used

- **highskore.com** has this repo as a submodule at `games/planet`; its `pnpm build:planet` runs `npm ci` here, `sh rust/planet-web/build.sh` and `node build.mjs --rust`, and copies `dist/planet.html`, `planet-rust.js`, `planet-rust.wasm` and `planet-game.js` to `public/`.
- **[the Idle FighterZ widget](https://github.com/highskore/idle-fighterz-widget)** has it as a submodule at `game/`, and builds the widget page with `node game/build.mjs --widget`.
