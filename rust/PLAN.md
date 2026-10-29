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
- **RNG.** `Lcg` is the harness's `Math.random` stand-in. game.js spends random draws on cosmetic particles (a transform, a crit, kaioken, every `burst`, the space pod's trail). The core spawns those particles itself into `Game::fx`, at game.js's spots and in its order, so the gameplay stream stays aligned and planet-render draws them; a burst at a spot only the drawing places (a ghost, a movie henchman) burns its draws unplaced headless; the screen-shake jitter is drawn for real, since it moves the hero's screen spot. Once JS parity no longer matters (after cut-over), cosmetic draws can move to a separate render-side generator.
- `jsmath`: V8's `Math.sin`, `cos`, `atan2` (fdlibm) and `hypot` (Kahan), bit for bit. V8 for arm64 is built with clang's FP contraction, so the fdlibm port fuses multiply-adds in the same places; it matches node on arm64 over 400k random arguments. On an x86-64 node the geometry may come out one ulp off (the samples log it as inexact).
- `geom`: the view matrix with its auto spin, the road and cap points, `layout()`, and where the hero lands on screen (`kidScreen`, `handPos`).
- `num`: JS `Math.round`, `toFixed`, `toExponential` and `toLocaleString`, plus `fmtShort` and page.html's `fmt` and `short`. They are exact, including round-half-up ties.
- `data`: tables (shop, forms and hero ladders, the training tree, angels, goals) and tuning constants. The sprites are in `sprite` (stage 1), as plain data, so `planet-render` only rasterises.
- Outputs to the UI are data, not callbacks: `Game::events` (`ui.event` text) and the timeline's state in `Game::tl` (the dragon's offer in `tl.shen`, what's in the sky, the boss). Stage 4 adds a `HudState` snapshot (what `ui.update` builds today) and the shop rows (`syncShop`).

### planet-render

- **The perf crate is folded in.** px.wasm's kernels (`planet`, `outline`, `rim`) live in `planet-render/src/px_kernels.rs`; `wasm/src/lib.rs` keeps its exports, statics and `alloc` and `include!`s that file, and `px.wasm` rebuilds byte for byte. `planet-render/src/px.rs` includes the same file over a `Framebuffer` (the kernels keep px.wasm's statics, so calls take a lock). There is no `Raster` trait any more: one source, one owner.
- `Framebuffer`: `buf` (packed ABGR, ImageData's layout), `zb`, `ib`, `dm`, `st.px` blending, `PK`, `bayer`, `h2`.
- `scene::Scene::draw(fb, game, view, dt)` is game.js's `frame()` from `// ── draw` to `st.flush()`, in game.js's statement order, spending `Math.random` draws where game.js does (particles), and writing back the screen spots game.js writes while drawing (the hero's lift and facing, piccolo, bubbles, every visitor's `sx`/`sy`, the boss's and the ginyu force's `x`/`y`/`k`, henchmen, the capsule's fall, `ape.k`, the meteors' spin seed). `View` says site or widget (`BARE`), the widget's cloud shape and amount, and the pixel scale.
- Modules: `tones` (each world's palettes), `scenery` (`scenery()` for every world: spheres, the future's slabs, west city's streets, paozu's river, residents), `shade` (`shadePlanet`, `shadeKame`, `shadeW2`, `shadeTop`, domes, capsule corp, pools), `visitors` (everyone on and over the planet, the boss, the ginyu force, the movies), `effects` (spirit bomb, beam struggle, capsule), `beam` (the charge, its aim line and crackle, and the fired beam), `top` (the arena's void, stands and zeno's box), `snake` (snake way: the road, the cloud rows, orbs, spines and ghosts, king kai's planet and the arrival), `shenron` (shenron.js: the dragon's body and heads, porunga).
- planet-core gained what the drawing needs: `sprite` (`makeSprite`, the `shapeSprite` DSL, `makeHero`, and every other sprite baked by `difftest/sprites.js` into `data/sprites.bin`), `fx` (one particle list both sides add to), `flash_t`, `night_k`, `zap`, hit flashes, the dance's look, the movie wobble, `Game::preview(hash)` (the preview hooks) and `Game::set_view`. `jsmath` gained `pow` and `exp` as V8 computes them.

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

Scenarios: `idle`, `active`, `ascend` and `late` from stage 2, and three that drive the timeline. `events` is 45 minutes of active play that also taps whatever game.js can hit-test without drawing (the space pod, meteors, the moon, dr. gero) and trains its tail. `multiverse` opens the tournament of power through ultra instinct, clears universe 9, takes god ki to bring zeno, and erases. `wishes` summons the dragon every 50 seconds (porunga on namek), wishes krillin back, and picks every other offer by hand, leaving the rest to the 20-second auto-pick. Stage 4 added three: `input` drags the planet (and lets it coast), charges and fires beams (final flashes at beam lv 5) and throws big bangs at whatever fights, taps, cancels and trains with space; `snake` takes a pod to snake way and presses and keys through it; `daily` starts from yesterday's save; `calm` plays with reduced motion (no screen shake, no draw for it). `attacks` and `walls` fire the same pointer beams and big bangs at villains, the ginyu force and universe walls, with and without kaioken and the great ape. `itx` buys instant transmission at yardrat and tries its gestures (two-thumb taps, right-clicks, thumbs too far apart or sliding) and jumps from its picker every second, home or away, in a fight or not; it fails on its own if a jump doesn't land or moves the natural trips, if the cooldown from a jumped trip's end isn't exactly 300 s at lv 1 and the 90 s floor at lv 40, if a jump goes when it can't or is refused silently, if a natural trip comes within 84 s of a jumped one getting home, or if two thumbs in a beam struggle aren't taps. Inputs: `train`, `buy`, `kaio`, `learn`, `set`, `click` (x, y), `summon`, `pick` (a wish key), `down`/`move`/`up` (CSS and buffer pixels, the pointer, a touch), `jump` (a world from the last transmission picker), `cancel`, `key`, `angel`, `auto`, `hero` (the angels' and characters' tabs, in `multiverse`).

Every scenario also checks what reaches the HUD: the `ui.update` snapshot (with `ui.night`, `ui.world` and the body classes) and the shop every second, the dragon's offer while it waits, the menu, angels, confirm boxes and share card every ten seconds, every toast (text, time and duration) and every cue (`ui.sfx`, `ui.fx`, `bump`, `achieved`, `zeno`, `treeGift`, `wish`, `wishDone`, `itxPick`, `notify`: call, time and arguments) in order, and the save (`JSON.stringify(S)`) every ten seconds. `save_round_trip` writes a save from planet-core, loads it in game.js and back.

The harness never draws, so the screen spots game.js writes while drawing stay unset: npcs' `sx`/`sy`, a boss's `x`/`y`/`k`, movie henchmen, the capsule's fall, `piccoloAt`, `monkeyAt`, `liftNow`/`flipNow`. planet-core keeps them as fields the renderer fills (`Seen`, `Boss::x`, `Game::lift_now` and so on), unset headless, so the two agree. game.js also changes the game in five places while drawing: the big bang lands, a great ape's stomp shakes the screen, a full beam charge makes it tremble while the hero is in view, and a boss's capsule falls and opens itself after 8s. The harness runs those headless too, and planet-core runs them in `Game::draw_step` after the frame, so they're diffed. The renderer should leave them there. The flip side: taps on things only the renderer places (king kai, gregory, yamcha, the car, the door, senzu beans, satan, roshi, pudding, gadgets, the birds, zeno, saibamen, bosses, ginyu members, movie henchmen) are ported but not diffed, and a boss's ki blasts fly at (0, 0) as they do in a headless game.js.

Framebuffer diffing (stage 1): `difftest/frame.js` mounts game.js with a preview hook at a canvas size (site or widget, with its cloud shape), runs it headless, clears the cosmetic state headless game.js never steps (particles, the flash), and draws the last frames (`__skip = false`). `planet-render/tests/framediff.rs` does the same in Rust and compares the RGBA bytes; `FRAMEDIFF=<name>` filters cases, `FRAMEDIFF_PNG=1` writes the JS, Rust and diff images of failing ones. `--px` loads px.wasm into the harness, to check its kernels against the JS loops. `planet-render/tests/drawn.rs` runs the state difftest's scenarios with drawing on, on both sides (`run.js <scenario>+draw`); drawn, the script also taps what only drawing places, so the renderer-placed taps are diffed there. The scenarios' replay is shared from `planet-core/tests/replay`.

## Stages and estimates

Estimates are in focused working days for one person or agent, assuming the perf crate lands as described.

| Stage | Scope | Estimate |
|---|---|---|
| 1. Renderer and world | **Mostly done** (below). Still to do: the time chamber's afterimage, the rest of the timeline's bursts as real particles. | 2–3 days remaining |
| 2. Hero, laps and economy | **Done** (below), the save and the daily bonus with stage 4. | |
| 3. Events and bosses | **Done**. The renderer-placed taps are diffed now (planet-render's drawn difftest). | |
| 4. HUD bridge and menus | **Done** (below): input, the save, the HUD as data, wasm-bindgen exports, the shim, `build.mjs --rust`. Still to do: cut over (after stage 1). | |
| 5. Native wgpu widget | `planet-native` on wgpu (softbuffer fallback) in Powerrr, the overlay web view for the HUD and menubar power. The widget's drawing (no backdrop, its five cloud shapes and amount, the rim) is in planet-render and diffed already. Pixel-diff the native build against the web one. | 2–4 days |

That leaves about 5–8 days: the rest of stage 1, the cut-over (the `--rust` page drawing with planet-render through `Planet::draw_with_rust`, `step_drawn` and `pixels`, about a day), and stage 5.

## Stage 1: what's ported

- **Sprites.** `makeSprite`, the `shapeSprite` DSL (shenron.js's `kit.grid`: `set`, `rect`, `ell`, `poly`, `line`, `mirror`, the shading and outline pass) and `makeHero` are ported; `makeHero` builds all four heroes' 472 sprites (every form, fused, from behind) and a test checks each against game.js. The other 184 sprites (villains, NPCs, ToP fighters, movie villains, dinos, residents, shenron's heads, porunga) are baked from game.js by `difftest/sprites.js` into `planet-core/data/sprites.bin` (190 KB, palette-indexed, with aliases like `VILLAINS.0.spr`); their paint programs stay in game.js, and six are repainted in Rust as a DSL test. `sprites.js --check` says if the bake is stale.
- **Worlds.** Every `WORLDS` entry's tones and `scenery()`: king kai's planet, namek, beerus' planet, west city (capsule corp lettering, towers, palms, hover cars, painted streets), kame house (sea, surf, the wake), paozu (karst pillars, forest, river, dinos, the pterodactyl), the future (slabs with window grids and rebar, puddles, smouldering craters, smoke, rain), planet vegeta, the lookout (korin's tower), the kais' world, yardrat (blinking folk), and the tournament of power (the void, nebula, pillars, the stands emptying as universes are erased, the broken floor, zeno's box). The planet uses px.wasm's kernel where game.js does.
- **Sky.** The cloud sea, front and back, the night fade under the full moon, the moon; on the widget no backdrop and its five cloud shapes with the amount slider, then the rim.
- **Characters.** The hero (run cycle, pose, every form, fused, flight with its streak, kaioken's aura, the great ape), his aura and sparks, bubbles, piccolo, krillin, king kai and his car, gregory, roshi and his kamehameha, saibamen, the dance, 16 and his birds, 18's date, gadgets, beerus and whis, the pudding, zeno, satan, frieza's ship, yamcha's crater, dr. gero, the boss (bar, name, universe badge), the ginyu force and androids, movie henchmen and their tricks, shenron's four looks and porunga, the spirit bomb, the beam charge (aim line, ball, crackle) and the beam (galick gun, kamehameha, final flash, kaioken red, the great ape's width), the beam struggle, the capsule, ki blasts, meteors, the pod, the nimbus, particles, the flash, the floating gain numbers (planet-core keeps each one where its gain lands, the renderer ages them).
- **Write-backs.** `liftNow`/`flipNow`, `piccoloAt`, `monkeyAt`, every visitor's `sx`/`sy`, the boss's and the ginyu force's `x`/`y`/`k`, henchmen, `ape.k`, the meteor's spin seed, the capsule's fall, hit flashes.

Drawn difftest: `idle` (9 minutes), `active` (9 minutes) and a new `taps` scenario (8 minutes, 182 taps on pods, king kai, saibamen, the boss and more, all hit-tested on renderer-placed spots) match bit for bit with drawing on, up to the first trip to snake way. `ascend`, `late`, `events`, `multiverse` and `wishes` drawn are `#[ignore]`d for now: game.js takes 10–40 minutes to draw each.

Framebuffer diff results: see the PR. In short, every world, every hero and form, the visitors, raids, sagas, the ginyu force, androids, movies, shenron's looks, the arena, snake way (the run, the nimbus and the arrival) and the widget variants match byte for byte at desktop and phone sizes; `#struggle` doesn't yet.

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

1. Run the drawn difftest through every scenario (snake way is drawn now: `planet-render/src/snake.rs`).
2. The time chamber's afterimage; the remaining bursts as real particles.
3. The cut-over: the `--rust` page draws with planet-render instead of the game.js twin (HUD.md), then stage 5 on the bridge.
