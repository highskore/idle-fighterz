# Rust port of the power planet

One Rust codebase built two ways:

- **Web:** compiled to WebAssembly. It draws into the existing canvas on highskore.com, and the HTML HUD stays.
- **Widget:** compiled natively inside the Idle FighterZ widget (Tauri). It draws through wgpu (or softbuffer) instead of a web view's canvas.

The JS game (`game.js`, `world.js`, `shenron.js`, `page.html`) stays the live game until the port reaches parity. `node build.mjs --rust` builds a page where planet-core runs the game behind the HTML HUD (stage 4, [HUD.md](HUD.md)); the default build doesn't touch `rust/`.

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
- **RNG.** `Lcg` is the harness's `Math.random` stand-in. game.js spends random draws on cosmetic particles (180 for a transform, 20 for a crit, 80 for kaioken, two a particle for every `burst`, one or two a frame for the space pod's trail). The core burns the same number of draws (`Lcg::skip`) so the gameplay stream stays aligned; the screen-shake jitter is drawn for real, since it moves the hero's screen spot. Once JS parity no longer matters (after cut-over), cosmetic draws can move to a separate render-side generator.
- `jsmath`: V8's `Math.sin`, `cos`, `atan2` (fdlibm) and `hypot` (Kahan), bit for bit. V8 for arm64 is built with clang's FP contraction, so the fdlibm port fuses multiply-adds in the same places; it matches node on arm64 over 400k random arguments. On an x86-64 node the geometry may come out one ulp off (the samples log it as inexact).
- `geom`: the view matrix with its auto spin, the road and cap points, `layout()`, and where the hero lands on screen (`kidScreen`, `handPos`).
- `num`: JS `Math.round`, `toFixed`, `toExponential` and `toLocaleString`, plus `fmtShort` and page.html's `fmt` and `short`. They are exact, including round-half-up ties.
- `data`: tables (shop, forms and hero ladders, the training tree, angels, goals) and tuning constants. Stage 1 adds the sprite DSL data (`makeHero`, `shapeSprite` and the palettes) here as plain data, so `planet-render` only rasterises.
- Outputs to the UI are data, not callbacks: `Game::events` (`ui.event` text) and the timeline's state in `Game::tl` (the dragon's offer in `tl.shen`, what's in the sky, the boss). Stage 4 adds a `HudState` snapshot (what `ui.update` builds today) and the shop rows (`syncShop`).

### planet-render and the perf pass

Another agent is moving the per-pixel loops (sphere and depth raster, `blitZ` sprite compositing, clouds, the widget rim pass) into a Rust/WASM crate in highskore/planet, probably `wasm/`. To avoid doing that work twice:

- `planet-render` has the buffers and primitives game.js shares: `Framebuffer`, with `buf` (packed ABGR, the same layout as ImageData), `zb`, `ib` and `dm`; `st.px` blending; `PK`; `bayer`; and `h2` with exact JS `|0` and `Math.imul` semantics. These are covered by unit tests against world.js values.
- The kernels sit behind `trait Raster` (`sphere`, `blit_z`, with clouds and rim to follow), with signatures that mirror game.js.
- When the perf crate lands, either it implements `Raster` over `Framebuffer`, or its code moves into `planet-render` (preferred: one crate, one owner). In both cases scene building, which turns `Game` into a list of draw calls, stays above the trait and is the part this port writes.
- The perf crate is `wasm/`: a dependency-free `cdylib` with C-ABI exports (`alloc`, `planet`, `outline`, `rim`, `bbox`, `params`, `palette`) over buffers in its own linear memory, which the page's typed arrays view directly. It has the planet on plain grass worlds, `outline()` and the rim. `blitZ` and the clouds stayed in JS: about 2% of a frame each in the profile. The kernels are statement-for-statement ports of the JS, so folding them into `planet-render` behind `Raster` is a move, not a rewrite.

### planet-web

- `Planet` is planet-core's `Bridge` exported with wasm-bindgen: inputs, the shop, tree and angels in; the HUD's per-frame delta message and the menus out, as JSON in game.js's shapes. [HUD.md](HUD.md) has the API; the native widget uses the same one over Tauri IPC.
- page.html keeps its HUD, menus and shop. `rust/planet-web/shim.js` hands it a `game` object with game.js's API and maps the bridge's messages onto its `ui.*` callbacks. Until stage 1, game.js draws, running in lockstep with the Rust game (HUD.md); afterwards the shim's frame becomes `step()` and `putImageData` of `pixels()`.
- Saves stay in `localStorage` under the same `hs-power` key and JSON shape, so a returning player keeps their daily-bonus date.

### planet-native

- `Widget<S: Surface>` runs the fixed-step clock and presents the framebuffer. The surface is wgpu, with softbuffer as a fallback; in either case it's a texture upload of the same RGBA buffer.
- HUD: Tauri overlays a small transparent web view carrying page.html's HUD markup and the same JS shim, talking to Rust over Tauri commands and events instead of wasm calls. Once the game runs natively, we can decide whether the HUD moves to Rust too (immediate-mode text with the 3×5 pixel font that's already in world.js) or stays HTML.

## Testing

**Differential testing is the main safety net.** `rust/difftest/harness.js` mounts world.js, shenron.js and game.js headless in a `vm`, using the same LCG `Math.random`, and never draws. `run.js <scenario>` runs a scripted policy: training taps, a cheapest-first buy loop, kaioken, tree learning, ascending, and test-only state pokes for late-game setups. It prints:

- the inputs it actually applied, frame by frame
- a state sample every simulated second

`planet-core/tests/difftest.rs` replays the inputs in Rust and compares each sample. The sample covers power, best, `rate()`, `wrate()`, `mult()` with and without timed buffs, laps, phi, sprint, combo, form, mastery, seeds, the goal and its progress, every upgrade level and cost, every tree rank, and the RNG draw count. Counts must match exactly; floats are allowed a relative error of 1e-9. `cargo test` runs node; without node, those tests skip.

Stage 3 split the harness's timeline patch into a gate per system (31 spawn points), mirrored them in planet-core, and removed them one commit at a time, each diffing bit-identical. Now the whole of `frame()` is diffed with no patches. The sample also covers the timeline: the world, sagas, universes, wishes, bosses, trips, the boss's and the ginyu force's hp, the dragon's phase, how many orbs, meteors, saibamen and ki blasts are out, the space pod, the nimbus, the moon, the great ape, the tournament, movies, the storm, snake way, gregory, dr. gero, the dance, the struggle, the view matrix and the screen shake.

Scenarios: `idle`, `active`, `ascend` and `late` from stage 2, and three that drive the timeline. `events` is 45 minutes of active play that also taps whatever game.js can hit-test without drawing (the space pod, meteors, the moon, dr. gero) and trains its tail. `multiverse` opens the tournament of power through ultra instinct, clears universe 9, takes god ki to bring zeno, and erases. `wishes` summons the dragon every 50 seconds (porunga on namek), wishes krillin back, and picks every other offer by hand, leaving the rest to the 20-second auto-pick. Stage 4 added three: `input` drags the planet (and lets it coast), charges and fires beams (final flashes at beam lv 5) and throws big bangs at whatever fights, taps, cancels and trains with space; `snake` takes a pod to snake way and presses and keys through it; `daily` starts from yesterday's save; `calm` plays with reduced motion (no screen shake, no draw for it). `attacks` and `walls` fire the same pointer beams and big bangs at villains, the ginyu force and universe walls, with and without kaioken and the great ape. `itx` buys instant transmission at yardrat and tries its gestures (two-thumb taps, right-clicks, thumbs too far apart or sliding) and jumps from its picker every second, home or away, in a fight or not; it fails on its own if a jump doesn't land or moves the natural trips, if the cooldown from a jumped trip's end isn't exactly 300 s at lv 1 and the 90 s floor at lv 40, if a jump goes when it can't or is refused silently, if a natural trip comes within 84 s of a jumped one getting home, or if two thumbs in a beam struggle aren't taps. `toptaste` reaches the top form while the dragon offers a taste of the next one, then picks it by hand and leaves it to the auto-pick; it fails on its own if the form runs past the top or the game stops. `sides` plays the side upgrades past their old caps: crits past 100% chance, senzu past full uptime, high-level beams and big bangs, tail training past lv 10. Inputs: `train`, `buy`, `kaio`, `learn`, `set`, `click` (x, y), `summon`, `pick` (a wish key), `down`/`move`/`up` (CSS and buffer pixels, the pointer, a touch), `jump` (a world from the last transmission picker), `cancel`, `key`, `angel`, `auto`, `hero` (the angels' and characters' tabs, in `multiverse`).

Every scenario also checks what reaches the HUD: the `ui.update` snapshot (with `ui.night`, `ui.world` and the body classes) and the shop every second, the dragon's offer while it waits, the menu, angels, confirm boxes and share card every ten seconds, every toast (text, time and duration) and every cue (`ui.sfx`, `ui.fx`, `bump`, `achieved`, `zeno`, `treeGift`, `wish`, `wishDone`, `itxPick`, `notify`: call, time and arguments) in order, and the save (`JSON.stringify(S)`) every ten seconds. `save_round_trip` writes a save from planet-core, loads it in game.js and back.

The harness never draws, so the screen spots game.js writes while drawing stay unset: npcs' `sx`/`sy`, a boss's `x`/`y`/`k`, movie henchmen, the capsule's fall, `piccoloAt`, `monkeyAt`, `liftNow`/`flipNow`. planet-core keeps them as fields the renderer fills (`Seen`, `Boss::x`, `Game::lift_now` and so on), unset headless, so the two agree. game.js also changes the game in five places while drawing: the big bang lands, a great ape's stomp shakes the screen, a full beam charge makes it tremble while the hero is in view, and a boss's capsule falls and opens itself after 8s. The harness runs those headless too, and planet-core runs them in `Game::draw_step` after the frame, so they're diffed. The renderer should leave them there. The flip side: taps on things only the renderer places (king kai, gregory, yamcha, the car, the door, senzu beans, satan, roshi, pudding, gadgets, the birds, zeno, saibamen, bosses, ginyu members, movie henchmen) are ported but not diffed, and a boss's ki blasts fly at (0, 0) as they do in a headless game.js.

Framebuffer diffing (stages 1 and 5): the same harness can draw (`__skip = false`), so tests compare `st.buf` against `Framebuffer::buf` byte for byte at sampled frames, for fixed camera matrices and a set of scenes.

## Stages and estimates

Estimates are in focused working days for one person or agent, assuming the perf crate lands as described.

| Stage | Scope | Estimate |
|---|---|---|
| 1. Renderer and world | Sprite DSL data (`makeSprite`, `shapeSprite`, palettes, heroes and villains) into core. Scene building per world (`scenery`, the 13 worlds' props). Sea, clouds, planet shading. Framebuffer diff harness. The kernels come from the perf crate through `Raster`. | 4–6 days (7–9 if the perf crate doesn't land) |
| 2. Hero, laps and economy | **Done** (below), the save and the daily bonus with stage 4. | |
| 3. Events and bosses | **Done** (below), the beam and big bang inputs with stage 4. Still to do: diffing the renderer-placed taps once stage 1 writes the screen spots back. | |
| 4. HUD bridge and menus | **Done** (below): input, the save, the HUD as data, wasm-bindgen exports, the shim, `build.mjs --rust`. Still to do: cut over (after stage 1). | |
| 5. Native wgpu widget | `planet-native` on wgpu (softbuffer fallback) in Powerrr, the overlay web view for the HUD, the widget rim pass and menubar power. Pixel-diff it against the web build. | 3–5 days |

That's about 18–26 days in all. Stages 1 and 3 can run in parallel once the core API has settled (it has now).

## Stage 2: what's ported

- The state (`Save`) and runtime closure state.
- `frame()`: laps (pace, sprint, stride, nimbus, the pose stop), per-second income, the tree's auto taps, transforms (one a frame), mastery stars, angels' self-ascension, combo decay, time-chamber slow motion, and screen-shake jitter.
- Inputs: the training tap (combo, crits, sprint), the shop (`buy` with game.js costs and unlocks), kaioken, `learn` and `respec` for the tree, ascending, god ki, and the zeno erase.
- Economy: `mult` (the full additive buff sum, tiredness, and beerus), `core`, the ki ceiling (`ceiling` and `capped`), `lateBoost`, seed boost with its soft cap, `seedsNow` (divine too), milestones, `lapValue`, `passive`, `rate`, `wrate`, costs (including bulma's discount), `godNow`.
- Goals: the full table; the prize, the dragon ball every fifth goal, and `nextGoal` with `need` checks.
- Number formatting and the seeded RNG.

## Stage 3: what's ported

All of `frame()`'s timeline, in game.js order and with its short-circuits (a countdown only ticks when the condition chain reaches it), in `planet-core/src/timeline.rs`:

- The sky and the road: space pods, ki orbs and dragon balls, meteor showers and the meteor storm, the flying nimbus, piccolo's zaps.
- Visitors: gregory, master roshi, krillin (and his deaths, rage and the ally), king kai and his car, the time chamber door, android 16 and the birds, android 18's visit, dr. gero and android 19 draining power, yamcha, the clinging saibaman, saibamen, frieza's ship, bubbles' fusion offer and the fusion dance, zeno.
- Trips: the world rotation (at the power mark, after two minutes at home, or a wished pod), the visit timer and its watchdog, planet vegeta's moon and nappa, beerus' noise and pudding, west city's gadgets (robot, gravity machine, hover bike, radar), and snake way's auto-runner (orbs, sky orbs and streaks, ghosts drifting off, dashes on straights, the win and the arrival); its drawing is stage 1's.
- The moon and the great ape: the moon's rise and set, transforming (the stare when you have a tail), tail training's rage and roar, the giant wish.
- The dragon: shenron and porunga, `openWish`'s rarity draw over the `WISHES` table (plus krillin while he's dead), `pick`, the 20s auto-pick of the rarest, follow-up wishes after 1.4s, every grant, and `summonLater` (on snake way or mid-fight). Senzu beans.
- Bosses: sagas in story order, the tournament (saibamen waves, its villain, KO prizes), the ginyu force and androids 17 and 18, the movie villains (cooler's squadron and supernova, janemba's split and mirrored taps, bojack's gang and bujin's web), nappa, beam struggles, ki blasts and krillin's discs, `hitBoss` prizes, the capsule, satan's prize.
- The multiverse: opening it (sagas done or ultra instinct), the universe ladder with each universe's fighters and their takes, fleeing and coming back, universe stars, god ki dropping a universe fight, the zeno erase (it now also ends the fight, empties the trips and goes home).
- `onClick` in full, in game.js's order of what takes a tap; `train()` taps just off the hero, like game.js's.
- `setTimeout`s that change state (the summon after a goal's seventh ball, follow-up wishes) run after the frame, as the harness runs them.

## Stage 4: what's ported

- Input (`input.rs`): pointer down, move, up and cancel, in CSS and buffer pixels; drag to spin with inertia, paused while pressed; the hold that charges a beam and `fireBeam` (struggles, beerus' noise, 16's birds, the space pod, saibamen, the ginyu force, movie henchmen and bujin's web, bosses, meteors; the final flash); `tap` with the double tap that throws a big bang (2.5s cooldown) and `explode`; snake way's presses; the keyboard (space trains; on snake way space, arrows, w and d hop, f blasts a ghost).
- The save (`save.rs`, `json.rs`): `JSON.stringify(S)` key for key, numbers as JS prints them; `load_json` keeps what game.js keeps; `start_on(today)` gives the daily bonus. Achievements carry their time (`epoch_ms`, from the host).
- The HUD (`hud.rs`): the `ui.update` snapshot (`Hud`, rebuilt where game.js calls it), the buffs line and the run's standing, the shop rows, the dragon's offer, the menu, the angels (`learn_angel`, `auto_next`), the hero pick, the confirm boxes and the share card; toasts with their durations, game.js's delayed ones included; cues for `ui.sfx`, `ui.fx`, `bump`, `achieved`, `zeno`, `treeGift`, `wishDone` and the widget's `notify`.
- The bridge (`bridge.rs`): the fixed-step owner the web and native hosts drive, with a delta message per frame. `spots.rs` takes screen spots from a renderer that isn't planet-render.
- The web build (`planet-web`, `shim.js`, `assemble.mjs`, `build.sh`) and `node build.mjs --rust`; the default build is byte-identical. `node rust/planet-web/test.mjs` plays the shipped code with drawing on and checks the Rust game against the drawing every frame.

## Next

1. Recheck the perf crate. Agree on `Raster` with its author, or fold it into `planet-render`.
2. Stage 1: sprite data, then scenery and planet shading, with the framebuffer diff. Have the scene builder write the screen spots back (see Testing), then diff taps on the renderer-placed npcs.
3. Stage 5 on the bridge (HUD.md, "What stage 5 needs"); the cut-over once planet-render draws the web page.
