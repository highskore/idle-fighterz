# The HUD bridge

page.html's HUD (power, rate, forms, the shop, the training tree and the angels, achievements and characters, wishes,
the share card, the ascend, god ki and zeno boxes, toasts) stays HTML. The game behind it is planet-core. They talk
through one API, `planet_core::bridge::Bridge`, with plain calls in and JSON strings out:

- **Web** (the site page's engine, [below](#the-web-page)): `planet-web` exports `Bridge` to wasm-bindgen as `Planet`.
  `rust/planet-web/shim.js` hands page.html a `game` object with game.js's API and turns the bridge's messages into
  page.html's `ui.*` calls. page.html's markup and code are unchanged.
- **Native widget** (stage 5): the same `Bridge` behind Tauri commands, with a transparent web view that loads only
  the HUD. That view uses the same shim, with the `Planet` calls swapped for `invoke`. Every argument and result is a
  number, a bool or a JSON string, so the messages are identical.

Everything planet-core sends the HUD was checked against game.js, in every scenario, and the golden traces
(`rust/golden`) now hold it to what it sent then; the JS difftest stays runnable while the behaviour is game.js's. Every second the difftest compares
the snapshot (with `night`, `world`, `shen` and `look` against `ui.night`, `ui.world` and the body classes as they stood
when game.js called `ui.update`) and the shop (`Game::shop`, the same string the bridge ships). It compares the dragon's
offer while it waits, and the menu, angels, confirm boxes and share card every ten seconds. Every toast (text, time,
duration) and every cue (call, time, arguments) is compared in order. The pictures the HUD shows (`thumb` and the card's
`spr`) are planet-core's hero sprites (`make_hero`, checked against game.js's), and the card's `scene` is the canvas.

## Calls

Coordinates come in twice. `x, y` are CSS pixels (`clientX/Y`); a drag turns the planet by these. `bx, by` are buffer
pixels (`st.toBuf(e)`); taps and beams are hit-tested in these.

| `Planet` (wasm) / `Bridge` (Rust) | game.js / page.html |
|---|---|
| `new(seed, w, h, scale)` | `mount(st, ui)`: `w`×`h` is `st.W`×`st.H`, `scale` is `st.scale` |
| `load(text)` | the stored `localStorage['hs-power']`. A new visit keeps only the daily bonus's date, as game.js does. Text over 1 MB, nested deeper than 64 or with a number past a double's range is ignored |
| `set_calm(on)` | page.html's `st.calm` (prefers-reduced-motion): no screen shake, and no random draw for it, as in game.js. Set it before `start` |
| `start(today, now_ms)` | `start()`: `today` is `new Date().toDateString()` (the daily bonus), `now_ms` is `Date.now()` |
| `set_cx(fcx)` | the page's `data-cx`: where across the canvas the planet sits, as `layout()` reads it |
| `preview(hash)` | game.js's preview hooks, from `location.hash` on dev hosts. Call it before `start` |
| `draw_with_rust(widget, clouds, amount)` | draw with planet-render from now on, into a framebuffer of the game's size; the drawing shares the game's random numbers, as game.js does |
| `frame_drawn(t, dt, now_ms)` | `frame(t, dt)` as page.html calls it, every animation frame with its own `t` and `dt`, drawn. The timeouts due by `t` run first, as a page's `setTimeout`s fire between frames |
| `timeouts_now(now_ms)` | the timeouts due by `Date.now()`, counted from the last `frame_drawn`. The shim calls it before every input, since a page's `setTimeout`s fire in time order with its events |
| `pixels_ptr() → ptr` | where the frame's RGBA bytes are in the module's memory (`w`×`h`×4), for an `ImageData` over them |
| `step(elapsed_s, now_ms) → steps`, `step_drawn(elapsed_s, now_ms) → steps` | fixed 1/30 s steps, at most 8 a call, undrawn or drawn. For the native widget (stage 5) |
| `frame() → message` | see below; call it after stepping and after every command |
| `resize(w, h, scale)` | `resize()` (`layout()`) |
| `pointer_down(x, y, bx, by, id, button, touch)`, `pointer_move(x, y, bx, by, id)`, `pointer_up(bx, by, id)`, `pointer_cancel()` | the canvas's pointer listeners, with `pointerId`, `button` and `pointerType === 'touch'`: tap, double tap (big bang), drag (spin, with inertia), hold (beam charge); on snake way the press acts. Once instant transmission is owned, a right-click opens it, and so does a two-finger tap at home with nothing on (two touches landing within 0.12 s and lifting within 0.25 s, unmoved) |
| `key(k) → bool` | the window's `keydown`, `k` = `e.key.toLowerCase()`; true: call `preventDefault`. The page filters repeats, modifiers and typing in fields first |
| `train()`, `kaioken()`, `itx()` | the train tab, the kaioken button, the transmission button |
| `buy(key) → bool` | `ui.onBuy`'s callback: shop rows, `ascend`, `godki`, `zeno` |
| `learn(id)`, `respec()` | the training tree |
| `learn_angel(id)`, `auto_next()` | the angels' tab |
| `pick_wish(key)`, `itx_jump(w)` | the wish box's and the transmission picker's callbacks |
| `pick_hero(id) → bool` | the characters tab |
| `menu()`, `angels()`, `ascend_info()`, `god_info()`, `zeno_info()`, `card()` | the same-named game.js calls, as JSON in their shapes. Exceptions: in `menu().tree`, an uncapped node's `max` is `null` (the shim turns it back into `Infinity`); `card()` has no `spr` or `scene`, which are pictures: `card_sprite()` is the sprite |
| `hero_sprite(id)`, `card_sprite()` | `thumb(id)`'s sprite (`HEROES[id].idle`) and `card().spr` (the hero's form as drawn in play, `HERO().forms[FORMS[S.form].i]`, or fused; game.js's `card()` indexes by ladder position, a different sprite past the shared nine forms), as an `Int32Array` `[w, h, ...col]` (`col` 0xRRGGBB a pixel, -1 for none); the shim makes game.js's `{ w, h, col }` of it |
| `save() → text` | what to store under `hs-power`: `JSON.stringify(S)`, key for key |
| `playing() → bool` | |

## The frame message

`frame()` returns only what changed since the last call:

```json
{ "hud": {...}, "shop": {...}, "world": 3, "events": [["text", 2600]], "cues": [["sfx", "tap"], ["bump"]] }
```

- `hud`, while playing, when anything on it has changed. This is `ui.update`'s argument: `goal {text, p, n}`,
  `kaio {own, ready, left}`, `pl`, `best`, `rate`, `laps`, `time`, `effects` (the buffs line), `extra` (the run's
  standing), `combo`, `form {name, x, next, p}`, `balls`, `wishes`, `ascend`, `snake`, `busy`. Four fields that
  game.js sets elsewhere ride along: `night` (`ui.night`), `world`, `shen` and `look` (game.js's `shen`, `jelly` and
  `earth` body classes), as they stand at that point of the frame. It's planet-core's `Hud` struct, built where game.js
  calls `ui.update`, and once more at `start`, so the first message already has a goal. `time` and the timers are whole
  seconds, but `pl`, `combo` and the form's progress are the raw numbers, so in play the snapshot changes on most steps.
  The struct is `PartialEq`, so checking for a change costs one comparison.
- `shop`, when a row changed: `ui.shop`'s argument, `{key: {cost, level, label, what, can, open, special}}` in shop
  order. It's `Game::shop`, rebuilt wherever game.js calls `syncShop` (the HUD point of a frame, mounting, `start`, buys,
  the tree and the angels), so it can come before play starts, as game.js's does.
- `world`: the world, when it changed. The page calls `ui.hell(false)` and then `ui.world(w)`.
- `sky`: shenron's storm over the page (planet-core's `dusk`), every frame it changes while he's out, then `null`:
  `{page, top, bot, foot, pil, x, w}`, the page's background, the sky's top and bottom (`#rrggbb`), the footer's
  opacity, and the pillar of light above the card (its opacity, centre and width in buffer pixels). The shim sets
  `body.dusk` and page.html's `--dusk-*` properties from it. game.js has no storm, so this is new to the Rust engine;
  porunga has none. The widget has no page or sky behind its canvas, so its HUD can ignore `sky`: the storm's clouds,
  lightning, pillar and ring of balls are drawn on the canvas.
- `events`: toasts for `ui.event(text, ms)`, oldest first. They include game.js's delayed ones (achievements 0.9 s
  later, the daily bonus, mr. satan, a universe cleared), which planet-core schedules on simulated time.
- `cues`: the other one-shot `ui` calls, as `[name, ...args]`: `sfx(kind)`, `fx(kind)` and `fx('form', i)`, `bump`,
  `achieved`, `zeno`, `treeGift(text)`, `wishDone`, and `notify(kind, arg)` (the widget's desktop notifications for a
  pod, a trip, a raid and the dragon; the site has no `ui.notify`, so the shim skips it). Two hand the page a list to
  pick from, and the page calls back: `wish(list)`, the dragon's offer `[{key, label, what, tier}]`, once for each
  offer (its words fixed when it's made, as in game.js), calls back `pick_wish(key)`; `itxPick(list)`, instant
  transmission's worlds `[{key, label}]`, calls back `itx_jump(w)`. `resend()` sends the dragon's offer again while it
  waits. One cue is the Rust engine's own: `xform(on)`, a transformation's power-up darkening the sky (`true`) and its
  form landing (`false`); the shim toggles `body.xdark`, which lightens the desktop HUD's text over the dark sky.

Every cue game.js emits is ported, at the same point of the same call (90 sites). None is draw-only: the one site in
game.js's drawing code, `explode`'s `boom` when a big bang lands, runs in the block both sides hoist out of the drawing.
The difftest can't reach the cues on taps at things only the renderer places (king kai, gregory, yamcha, the car, the
door, satan, roshi, pudding, zeno, krillin's date, gadgets, ginyu members and movie henchmen); those are ported but not
diffed until stage 1 writes the screen spots back.

## The save

`localStorage['hs-power']` holds `JSON.stringify(S)`. `save()` writes the same object: flags as 0/1, the tree, the
angels and the bosses beaten as `{id: n}`, achievements as `{id: Date.now()}`. Keys game.js only creates once
they're first set are always written, at the value game.js reads for a missing one. A new visit keeps only `daily`,
as game.js's `KEEP` does. The difftest compares the save with game.js's `S` every ten seconds, and round-trips a save
through game.js both ways. The shim saves every 3 s of play (as game.js does) and on `pagehide`. Natively, put the
same text in a file in the app's data directory.

## The web page

The site page runs on the Rust engine. `node build.mjs` writes `dist/planet-rust.js` (wasm-bindgen's glue and `shim.js`)
and `dist/planet-rust.wasm` next to `planet.html` when there's a wasm build (`sh rust/planet-web/build.sh`; `--rust`
fails without one), and `dist/planet-game.js`, game.js and shenron.js minified, the fallback. The page doesn't carry
game.js. `preload.js`, at the top of its `<head>`, starts the engine's two files (each asked for with a hash of the
build in its URL); `loader.js` hands them to the shim, which adds the planet's `mount` to `GAMES`, and page.html's game
mounts once they're in. Where WebAssembly can't run, with `?js` (or `#js`), in a build without the wasm, or if the
engine fails to load, the loader runs `planet-game.js` instead, as a script of its own after the page's (the page's
script isn't wrapped in a function, so game.js sees world.js's names). `<html data-engine>` says which one runs.

- The shim's `frame(t, dt)` is `frame_drawn(t, dt, Date.now())`, then `putImageData` of an `ImageData` over the module's
  memory, then `frame()`'s message onto `ui`. page.html's own loop decides when to call it, as it does for game.js.
- The game's seed continues the page's `Math.random`: the shim draws once and steps the LCG back, so planet-core's first
  draw is the one game.js would have made. Under the browser tests' seeded `Math.random` and fake clock both engines
  play the same game: every state in `test/browser/visual.spec.mjs` draws the baselines game.js drew, canvas and page,
  and the `@js` smoke tests play game.js's fallback against the same baselines.
- planet-render places what taps and beams aim at (planet-core's `spots`) as it draws, and draws with the game's random
  numbers, as game.js does.

## What stage 5 needs

- **Tauri commands**: one for each row of the calls table, on a `Mutex<Bridge>`. Return the same strings. Push
  `frame()`'s message to the HUD web view as a Tauri event after each tick, rather than having the view poll.
- **The HUD-only web view**: page.html's HUD markup with the shim. Swap the `Planet` calls for `invoke`, and drop
  the frame loop and `putImageData` (the native side steps and draws). Pointer events on the native window go to
  `pointer_*` with both coordinate pairs. The widget's own `ui.notify` handles the `notify` cues.
- **Pictures the HUD shows**: `thumb(id)` (the characters tab) and the card's `spr` come from planet-core's hero sprites
  (`hero_sprite`, `card_sprite`; the widget's `planet_sprite`), the card's `scene` from the framebuffer.
- **Time**: pass the wall clock (`Date.now()`, or the system clock in ms) with `start` and `step`, and today's date as
  `toDateString()` would print it (`Wed Oct 28 2026`).
- **The save**: the `save()` text in a file, read back with `load()`.
