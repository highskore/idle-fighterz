# The Rust engine

One Rust codebase, built two ways: to WebAssembly for highskore.com, where planet-render draws into the page's canvas behind the HTML HUD, and natively inside the Idle FighterZ widget ([highskore/idle-fighterz-widget](https://github.com/highskore/idle-fighterz-widget)), which runs planet-core in the app over Tauri.

**The Rust engine is the game.** The site page runs it by default: the top of the page starts fetching and compiling the wasm build while the page, its 3D title and intro start, and once it is in planet-core runs the game, drawn by planet-render, behind the HTML HUD ([HUD.md](HUD.md)); a card that is on screen (or pressed) before then shows a ki-charging dragon ball.

**game.js is frozen.** It (with `shenron.js`) is the legacy fallback: `dist/planet-game.js`, fetched only where WebAssembly can't run, if the engine fails to load, or with `?js` (for comparison), and still the widget's web-view build. Every new feature is built once, here; CI fails a pull request that touches game.js without the `legacy-js` label or a `Legacy-JS: <why>` commit trailer. page.html (the HUD) and world.js (the stage it hands the engine) stay shared. What Rust has that game.js doesn't is in [FEATURES.md](FEATURES.md).

## Workspace

```
rust/
  planet-core/     game state, simulation, economy, events, sprite data, the fixed step, the HUD bridge; no dependencies
  planet-render/   software framebuffer raster (and px.wasm's kernels), drawing a Game for the site or the widget
  planet-web/      wasm-bindgen exports, the page's shim, loader and build (build.sh)
  difftest/        headless game.js harness and scenarios: the scripts golden/ replays, and the optional JS diff
  golden/          recorded Rust traces (per-second state hashes and per-frame hashes) the regression tests check
```

Dependencies only point downward: planet-web depends on planet-render, which depends on planet-core. planet-core never touches pixels, so it runs headless in tests and in the widget's app.

- **planet-core.** `Game` holds the save (game.js's `S`) and the runtime state of game.js's `mount()`. It runs a fixed `DT = 1/30` step (`Clock::advance` banks real time), so runs replay exactly. `Lcg` is the seeded `Math.random`; cosmetic particles spend their draws where game.js did, into `Game::fx`. `jsmath` is V8's `sin`, `cos`, `atan2`, `hypot`, `pow` and `exp` bit for bit (with an exact `fma` on wasm), `num` JS's number formatting, and `big` the `Big` every unbounded quantity is kept in (a plain f64 below 1e300, m × 10^e past it). Outputs are data: toasts and cues in `Game::events`, the HUD snapshot in `hud`, the timeline in `Game::tl`. `bridge.rs` is the fixed-step owner both hosts drive, with a delta message per frame ([HUD.md](HUD.md)). The preview hooks `Game::preview` takes are listed in `planet-core/src/hooks.txt`.
- **planet-render.** `Framebuffer` (packed ABGR, ImageData's layout) and `scene::Scene::draw(fb, game, view, dt)`, game.js's drawing in its statement order, writing back the screen spots the game reads (where the hero, bosses and visitors stand). `View` says site or widget (`bare`: no backdrop, the widget's clouds and rim). px.wasm's kernels live in `px_kernels.rs`, which `wasm/src/lib.rs` includes, so `px.wasm` still rebuilds byte for byte.
- **planet-web.** `Planet` is the bridge exported with wasm-bindgen. `shim.js` hands page.html a `game` object with game.js's API and maps the bridge's messages onto its `ui.*` callbacks; its frame is `frame_drawn(t, dt)` then `putImageData` straight from the module's memory. Saves stay in `localStorage['hs-power']`, game.js's shape.

## Testing

- **Golden traces** are the regression test: `planet-render/tests/golden.rs` replays each scenario's inputs (`golden/<name>.inputs.json`) with every frame drawn and compares with `golden/<name>.trace`, a line per simulated second (the world, the form, the power, the random draws, a hash of the full state sample, each frame's hash). A change meant to change the game re-records them with `npm run golden:update`, committed with it; a failure names the first second and frame that differ.
- **planet-core's tests** cover the economy, the AFK rule per feature, the save and the bridge (`cargo test -p planet-core -p planet-web --release`).
- **The browser tests** (`test/browser`): pixel baselines of the Rust engine, `@js` smoke tests of the fallback, and every preview hook in `hooks.txt` played for 15 s with no errors ([docs/DEVELOPING.md](../docs/DEVELOPING.md)).
- **Differential testing against game.js** was the port's safety net and stays runnable for frozen behaviour: opt-in with `JS_PARITY=1` (`npm run difftest:js`), and CI runs it without failing the run. `difftest/harness.js` mounts world.js, shenron.js and game.js headless in a `vm` with the same LCG; `run.js <scenario>` plays a scripted policy and samples the state every second, which `planet-core/tests/difftest.rs` compares; `planet-render/tests/framediff.rs` and `drawn.rs` compare the drawing.
