# Developing planet

How the page is put together, how to build it, the preview hooks, the Rust port and where the game is used. For what the game is, see the [README](../README.md).

## The game

- **The title**: "highskore" in 3D pearl (three.js, Bagel Fat One). Letters wave, pop on hover, bounce when tapped, and sweep through each transformation's colour.
- **The scroll intro**: the page opens on the title alone. Scrolling settles it into place and brings up the game card. On phones the page doesn't scroll: the cue reads "press for fun" and plays the same intro (a swipe up works too), the title starts stacked as high / skore and the letters collide on their way into one line.
- **The game**: Vegeta runs laps around a draggable planet over a sea of golden clouds. Tap to train, hold to charge a galick gun, drag to spin.
  - 15 upgrades, from weighted boots to Piccolo, the time chamber, instant transmission and ascension.
  - Forms from super saiyan to ultra instinct.
  - Events: dragon balls and Shenron, great ape mode, villain raids (Frieza, Cell, Kid Buu, Beerus), the Ginyu Force, the Tournament of Power, the fusion dance, Gregory, King Kai's jokes, Saibamen and meteor showers.
  - Other worlds: the first trip comes at 1M power and each later one further out (`PLANET_EVERY` in `game.js`): a 45-second visit to Namek (where Porunga grants wishes), Planet Vegeta, Snake Way (a 75-second run), Beerus' planet, West City, Kame House, Mount Paozu, the future, Kami's lookout, the Kais' world and Yardrat, in turn.

Every visit starts from zero: power, upgrades, achievements and characters all reset on refresh. Only the date of the last daily bonus is kept in `localStorage` (`hs-power`).

## Building

The game is one self-contained HTML page, stitched together from these sources:

| file | what it is |
| --- | --- |
| `page.html` | layout, styles, HUD and the three.js title; `__WORLD__`, `__PLANET__` and `__BAGEL__` are filled in by the build |
| `world.js` | the pixel stage: buffer, sprites, text, particles |
| `game.js` | the game: planet renderer, Vegeta, upgrades, events, villains |
| `shenron.js` | Shenron and Porunga |
| `wasm/` | the per-pixel hot loops in Rust (the planet on plain grass worlds, outlines, the widget's rim), built into `wasm/px.wasm` |
| `bagel.typeface.json` | the title font as a three.js typeface |
| `widget.js`, `widget.css` | the desktop widget's extras, only in the `--widget` build |
| `build.mjs` | stitches them into one page |

```sh
npm ci                    # once: esbuild, subset-font and the fonts (@fontsource)
node build.mjs            # → dist/planet.html, the highskore.com homepage
node build.mjs --widget   # → dist/index.html under the current directory, the powerrr widget's page
```

The site page fetches nothing: the build inlines its fonts, cut down to the characters the page has (`subset-font`), and three.js, bundled by esbuild with just what the title uses and placed after the game's script, so the game is playable before the title is built; then it minifies the scripts. Only the shipped page is minified: the sources the Rust difftest reads stay as they are. `wasm/px.wasm` is committed and inlined as base64, so the page stays one file. After changing `wasm/src/lib.rs`, rebuild it with `npm run wasm` (Rust and `rustup target add wasm32-unknown-unknown`). The module has no dependencies and imports only `Math.pow`; each function is a line-for-line port of a JS loop that stays as the fallback (no WebAssembly, or a CSP without `wasm-unsafe-eval`), and both draw the same pixels. Code fenced by `/*widget*/…/*/widget*/` in `page.html`, `game.js` and `world.js` is kept only in the widget build; the site build drops it whole, so its output doesn't change. The widget build leaves out three.js and inlines the full fonts from `@fontsource` in the `node_modules` of the directory it runs from.

Open `dist/planet.html` in a browser to play it locally.

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

## The Rust port

`rust/` is a port of the game to Rust, built two ways: to WebAssembly for the site, and natively for the powerrr widget. The JS game stays the live game until the port reaches parity; the default build doesn't touch `rust/`. The plan and its stages are in [rust/PLAN.md](../rust/PLAN.md), and the HUD bridge in [rust/HUD.md](../rust/HUD.md).

```sh
npm run wasm:rust    # sh rust/planet-web/build.sh
npm run build:rust   # node build.mjs --rust: planet-core runs the game behind the HTML HUD
npm run test:rust    # node rust/planet-web/test.mjs
```

## Tests

CI (`.github/workflows/ci.yml`) runs on every pull request and push to main: both page builds; rustfmt, clippy and the JS-vs-Rust difftest; the wasm builds (`wasm/px.wasm` must match its source) and `rust/planet-web/test.mjs`; every preview hook in headless Chromium; and the pixel baselines.

```sh
npm test             # both builds, rustfmt and the difftest
npm run test:hooks   # every preview hook (each "// preview hook" in game.js) at 1280×800 and 390×844: no page or console errors
npm run test:visual  # the pixel baselines in test/browser/__screenshots__ (Linux only: they're rendered on CI)
npm run shots        # the same screenshots into shots/, without comparing
```

The browser tests (`test/browser/`, Playwright) serve the page from disk, run the game on Playwright's fake clock and seed `Math.random` with the difftest's LCG, so a state draws the same pixels every run. The 3D title is stubbed out (software WebGL takes seconds a frame) except in one hooks test. A visual state's canvas must match its baseline exactly; the whole page may differ by a shade where Chromium anti-aliases text and rounded corners. Every CI run uploads its screenshots as the `screenshots` artifact and links them on the pull request. To take new baselines, run the workflow by hand with *update baselines* (it commits them to the branch), or copy a run's `screenshots` artifact over `test/browser/__screenshots__`.

## Where it's used

- **highskore.com** has this repo as a submodule at `games/planet`; its `pnpm build:planet` runs `npm ci` here, then `node build.mjs`, and copies `dist/planet.html` to `public/planet.html`.
- **[powerrr](https://github.com/highskore/powerrr)** has it as a submodule at `game/`, and builds the widget page with `node game/build.mjs --widget`.
