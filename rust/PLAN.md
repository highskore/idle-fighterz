# Rust port of the power planet

One Rust codebase built two ways:

- **Web:** compiled to WebAssembly. It draws into the existing canvas on highskore.com, and the HTML HUD stays.
- **Widget:** compiled natively inside the Powerrr Tauri app. It draws through wgpu (or softbuffer) instead of a web view's canvas.

The JS game (`game.js`, `world.js`, `shenron.js`, `page.html`) stays the live game until the port reaches parity. Nothing under `rust/` is wired into `build.mjs` yet.

## Workspace

```
rust/
  Cargo.toml          workspace
  planet-core/        game state, simulation, economy, events, sprite/DSL data, deterministic fixed step
  planet-render/      software framebuffer raster shared by both targets (pixel-identical to world.js/game.js)
  planet-web/         wasm-bindgen entry: canvas putImageData, input, HUD bridge to page.html
  planet-native/      wgpu/softbuffer surface for the Tauri widget
  difftest/           headless JS harness + scenarios the Rust tests diff against
```

Dependencies only point downward: `web` and `native` depend on `render`, and `render` depends on `core`. `planet-core` has no dependencies and never touches pixels. It can run headless in tests, on a server, or in a worker.

### planet-core

- `Game` holds `Save` (game.js's `S`) plus the runtime closure state from `mount()`: `phi`, `laps`, `sprint`, `combo`, the timed buffs, `session` and so on.
- `Game::frame(t, dt)` mirrors `frame(t, dt)` statement for statement. Expressions keep JS operand order, so floats round the same way, and the diff test shows they come out bit-identical.
- **Fixed step.** game.js runs a variable step (`gdt <= 0.05`, at about 30 fps). The port runs a fixed `DT = 1/30`, with `Clock::advance` banking real time. That makes runs replayable and lets the web and native builds agree. In play the difference can't be seen, and the diff harness drives JS at the same fixed step.
- **RNG.** `Lcg` is the harness's `Math.random` stand-in. game.js spends random draws on cosmetic particles (180 for a transform, 20 for a crit, 80 for kaioken, and one per frame of screen-shake jitter). The core burns the same number of draws (`Lcg::skip`) so the gameplay stream stays aligned. Once JS parity no longer matters (after cut-over), cosmetic draws can move to a separate render-side generator.
- `num`: JS `Math.round`, `toFixed`, `toExponential` and `toLocaleString`, plus `fmtShort` and page.html's `fmt` and `short`. They are exact, including round-half-up ties.
- `data`: tables (shop, forms and hero ladders, the training tree, angels, goals) and tuning constants. Stage 1 adds the sprite DSL data (`makeHero`, `shapeSprite` and the palettes) here as plain data, so `planet-render` only rasterises.
- Outputs to the UI are data, not callbacks: `Game::events` (`ui.event` text) and `summon_due`. Stage 4 adds a `HudState` snapshot (what `ui.update` builds today) and the shop rows (`syncShop`).

### planet-render and the perf pass

Another agent is moving the per-pixel loops (sphere and depth raster, `blitZ` sprite compositing, clouds, the widget rim pass) into a Rust/WASM crate in highskore/planet, probably `wasm/`. To avoid doing that work twice:

- `planet-render` has the buffers and primitives game.js shares: `Framebuffer`, with `buf` (packed ABGR, the same layout as ImageData), `zb`, `ib` and `dm`; `st.px` blending; `PK`; `bayer`; and `h2` with exact JS `|0` and `Math.imul` semantics. These are covered by unit tests against world.js values.
- The kernels sit behind `trait Raster` (`sphere`, `blit_z`, with clouds and rim to follow), with signatures that mirror game.js.
- When the perf crate lands, either it implements `Raster` over `Framebuffer`, or its code moves into `planet-render` (preferred: one crate, one owner). In both cases scene building, which turns `Game` into a list of draw calls, stays above the trait and is the part this port writes.
- The perf crate is `wasm/`: a dependency-free `cdylib` with C-ABI exports (`alloc`, `planet`, `outline`, `rim`, `bbox`, `params`, `palette`) over buffers in its own linear memory, which the page's typed arrays view directly. It has the planet on plain grass worlds, `outline()` and the rim. `blitZ` and the clouds stayed in JS: about 2% of a frame each in the profile. The kernels are statement-for-statement ports of the JS, so folding them into `planet-render` behind `Raster` is a move, not a rewrite.

### planet-web

- At first it is a thin wasm-bindgen layer: `step(elapsed)`, `tap()`, `buy(key)`, `pixels()` (a view into the framebuffer for `putImageData`), and `hud()`.
- page.html keeps its HUD, menus and shop. Its `tick()` calls `step` and then copies the pixels, instead of calling `game.frame`. A small JS shim maps today's `ui.*` callbacks (`update`, `event`, `shop`, `fx`, `sfx`, `wish`, `confirm`) onto the snapshot and event queue the core exposes.
- Saves stay in `localStorage` under the same `hs-power` key and JSON shape (serde, stage 4), so a returning player keeps their daily-bonus date.

### planet-native

- `Widget<S: Surface>` runs the fixed-step clock and presents the framebuffer. The surface is wgpu, with softbuffer as a fallback; in either case it's a texture upload of the same RGBA buffer.
- HUD: Tauri overlays a small transparent web view carrying page.html's HUD markup and the same JS shim, talking to Rust over Tauri commands and events instead of wasm calls. Once the game runs natively, we can decide whether the HUD moves to Rust too (immediate-mode text with the 3×5 pixel font that's already in world.js) or stays HTML.

## Testing

**Differential testing is the main safety net.** `rust/difftest/harness.js` mounts world.js, shenron.js and game.js headless in a `vm`, using the same LCG `Math.random`, and never draws. `run.js <scenario>` runs a scripted policy: training taps, a cheapest-first buy loop, kaioken, tree learning, ascending, and test-only state pokes for late-game setups. It prints:

- the inputs it actually applied, frame by frame
- a state sample every simulated second

`planet-core/tests/difftest.rs` replays the inputs in Rust and compares each sample. The sample covers power, best, `rate()`, `wrate()`, `mult()` with and without timed buffs, laps, phi, sprint, combo, form, mastery, seeds, the goal and its progress, every upgrade level and cost, every tree rank, and the RNG draw count. Counts must match exactly; floats are allowed a relative error of 1e-9. `cargo test` runs node; without node, those tests skip.

While the core and timeline are being ported, the harness patches out the stage-3 timeline when `coreOnly` is set: events, trips, bosses, the moon and senzu beans. The patches are anchored string replacements that throw if game.js drifts. Each stage removes its patch as it lands, so by stage 3 the whole of `frame()` is diffed.

Framebuffer diffing (stages 1 and 5): the same harness can draw (`__skip = false`), so tests compare `st.buf` against `Framebuffer::buf` byte for byte at sampled frames, for fixed camera matrices and a set of scenes.

## Stages and estimates

Estimates are in focused working days for one person or agent, assuming the perf crate lands as described.

| Stage | Scope | Estimate |
|---|---|---|
| 1. Renderer and world | Sprite DSL data (`makeSprite`, `shapeSprite`, palettes, heroes and villains) into core. Scene building per world (`scenery`, the 13 worlds' props). Sea, clouds, planet shading. Framebuffer diff harness. The kernels come from the perf crate through `Raster`. | 4–6 days (7–9 if the perf crate doesn't land) |
| 2. Hero, laps and economy | **Done on this branch** (below). Still to do: the save/load JSON (serde, `hs-power` shape), the daily bonus, the wish-preview form path. | 1 day remaining |
| 3. Events and bosses | The `frame()` timeline: pods, orbs, meteors, nimbus, saibamen, villains, sagas, the tournament, the ginyu force, androids, movies, the multiverse, snake way, beerus, the time chamber, beams, the spirit bomb, the fusion dance, the great ape, shenron and porunga wishes, and trips. Remove the harness patches one by one and diff each. | 7–10 days |
| 4. HUD bridge and menus | wasm-bindgen exports, the page.html shim for `ui.*`, the shop, tree, angels and confirm boxes, saves, input (taps, drag, beam charge, double-tap). A flag in `build.mjs` to ship the wasm build behind a query param, then cut over. | 3–4 days |
| 5. Native wgpu widget | `planet-native` on wgpu (softbuffer fallback) in Powerrr, the overlay web view for the HUD, the widget rim pass and menubar power. Pixel-diff it against the web build. | 3–5 days |

That's about 18–26 days in all. Stages 1 and 3 can run in parallel once the core API has settled (it has now).

## Stage 2: what's ported

- The state (`Save`) and runtime closure state.
- `frame()`: laps (pace, sprint, stride, nimbus, the pose stop), per-second income, the tree's auto taps, transforms (one a frame), mastery stars, angels' self-ascension, combo decay, time-chamber slow motion, and screen-shake jitter.
- Inputs: the training tap (combo, crits, sprint), the shop (`buy` with game.js costs and unlocks), kaioken, `learn` and `respec` for the tree, ascending, god ki, and the zeno erase.
- Economy: `mult` (the full additive buff sum, tiredness, and beerus), `core`, the ki ceiling (`ceiling` and `capped`), `lateBoost`, seed boost with its soft cap, `seedsNow` (divine too), milestones, `lapValue`, `passive`, `rate`, `wrate`, costs (including bulma's discount), `godNow`.
- Goals: the full table; the prize, the dragon ball every fifth goal, and `nextGoal` with `need` checks.
- Number formatting and the seeded RNG.

## Next

1. Recheck the perf crate. Agree on `Raster` with its author, or fold it into `planet-render`.
2. Stage 1: sprite data, then scenery and planet shading, with the framebuffer diff.
3. Stage 3: the timeline, one harness patch at a time.
