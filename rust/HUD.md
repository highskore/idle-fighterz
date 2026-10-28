# The HUD bridge

page.html's HUD (power, rate, forms, the shop, the training tree and the angels, achievements and characters, wishes,
the share card, the ascend, god ki and zeno boxes, toasts) stays HTML. The game behind it is planet-core. They talk
through one API, `planet_core::bridge::Bridge`, with plain calls in and JSON strings out:

- **Web** (`node build.mjs --rust`): `planet-web` exports `Bridge` to wasm-bindgen as `Planet`.
  `rust/planet-web/shim.js` hands page.html a `game` object with game.js's API and turns the bridge's messages into
  page.html's `ui.*` calls. page.html's markup and code are unchanged.
- **Native widget** (stage 5): the same `Bridge` behind Tauri commands, with a transparent web view that loads only
  the HUD. That view uses the same shim, with the `Planet` calls swapped for `invoke`. Every argument and result is a
  number, a bool or a JSON string, so the messages are identical.

Everything that reaches the HUD is checked against game.js. The difftest compares the snapshot and the shop every
second, the dragon's offer while it waits, the menu, angels, confirm boxes and share card every ten seconds, and every
toast (its text, time and duration) in order, in all ten scenarios.

## Calls

Coordinates come in twice. `x, y` are CSS pixels (`clientX/Y`); a drag turns the planet by these. `bx, by` are buffer
pixels (`st.toBuf(e)`); taps and beams are hit-tested in these.

| `Planet` (wasm) / `Bridge` (Rust) | game.js / page.html |
|---|---|
| `new(seed, w, h, scale)` | `mount(st, ui)`: `w`×`h` is `st.W`×`st.H`, `scale` is `st.scale` |
| `load(text)` | the stored `localStorage['hs-power']`. A new visit keeps only the daily bonus's date, as game.js does |
| `start(today, now_ms)` | `start()`: `today` is `new Date().toDateString()` (the daily bonus), `now_ms` is `Date.now()` |
| `step(elapsed_s, now_ms) → steps` | `frame(t, dt)`. Fixed 1/30 s steps, at most 8 a call |
| `step_one(now_ms) → t` | one fixed step (the lockstep renderer below steps one at a time) |
| `frame() → message` | see below; call it after stepping and after every command |
| `resize(w, h, scale)` | `resize()` (`layout()`) |
| `pointer_down(x, y, bx, by)`, `pointer_move(x, y, bx, by)`, `pointer_up(bx, by)`, `pointer_cancel()` | the canvas's pointer listeners: tap, double tap (big bang), drag (spin, with inertia), hold (beam charge); on snake way the press acts |
| `key(k) → bool` | the window's `keydown`, `k` = `e.key.toLowerCase()`; true: call `preventDefault`. The page filters repeats, modifiers and typing in fields first |
| `train()`, `kaioken()` | the train tab, the kaioken button |
| `buy(key) → bool` | `ui.onBuy`'s callback: shop rows, `ascend`, `godki`, `zeno` |
| `learn(id)`, `respec()` | the training tree |
| `learn_angel(id)`, `auto_next()` | the angels' tab |
| `pick_wish(key)` | the wish box's callback |
| `pick_hero(id) → bool` | the characters tab |
| `menu()`, `angels()`, `ascend_info()`, `god_info()`, `zeno_info()`, `card()` | the same-named game.js calls, as JSON in their shapes. Exceptions: in `menu().tree`, an uncapped node's `max` is `null` (the shim turns it back into `Infinity`); `card()` has no `spr` or `scene`, which are pictures (see stage 5) |
| `save() → text` | what to store under `hs-power`: `JSON.stringify(S)`, key for key |
| `playing() → bool` | |
| `spots(json)`, `probe() → json` | the temporary renderer bridge (below) |

## The frame message

`frame()` returns only what changed since the last call:

```json
{ "hud": {...}, "shop": {...}, "wish": [...], "world": 3, "events": [["text", 2600]], "cues": [["sfx", "tap"], ["bump"]] }
```

- `hud`, while playing, when anything the HUD shows has changed. This is `ui.update`'s argument: `goal {text, p, n}`,
  `kaio {own, ready, left}`, `pl`, `best`, `rate`, `laps`, `time`, `effects` (the buffs line), `extra` (the run's
  standing), `combo`, `form {name, x, next, p}`, `balls`, `wishes`, `ascend`, `snake`, `busy`. Four fields that
  game.js sets elsewhere ride along: `night` (`ui.night`), `world`, `shen` and `look` (game.js's `shen`, `jelly` and
  `earth` body classes). It's planet-core's `Hud` struct, built where game.js calls `ui.update`. Values are kept to
  what the page shows (`time` in whole seconds, timers in whole seconds), so idle play changes it about once a second.
  The struct is `PartialEq`, so checking for a change costs one comparison.
- `shop`, while playing, when a row changed: `ui.shop`'s argument, `{key: {cost, level, label, what, can, open, special}}`
  in shop order.
- `wish`: `ui.wish`'s list, `[{key, label, what, tier}]`, once for each offer the dragon makes. The words are fixed
  when the offer is made, as in game.js. The callback is `pick_wish(key)`.
- `world`: the world, when it changed. The page calls `ui.hell(false)` and then `ui.world(w)`.
- `events`: toasts for `ui.event(text, ms)`, oldest first. They include game.js's delayed ones (achievements 0.9 s
  later, the daily bonus, mr. satan, a universe cleared), which planet-core schedules on simulated time.
- `cues`: the other one-shot `ui` calls, as `[name, ...args]`: `sfx(kind)`, `fx(kind)` and `fx('form', i)`, `bump`,
  `achieved`, `zeno`, `treeGift(text)`, `wishDone`, and `notify(kind, arg)` (the widget's desktop notifications for a
  pod, a trip, a raid and the dragon; the site has no `ui.notify`, so the shim skips it).

Cues come from the main call sites: taps, buys, laps, forms, ascending, god ki, the zeno erase, achievements, beams, the
big bang, boss hits, the dragon, pods, mastery stars and wishes. game.js has about 70 more `ui.sfx`/`ui.fx` sites, for
smaller moments (a gregory catch's coin, a struggle tap). They're sounds and title effects only, nothing on the HUD,
and can be added one line at a time (`self.cue(Cue::Sfx("coin"))`).

## The save

`localStorage['hs-power']` holds `JSON.stringify(S)`. `save()` writes the same object: flags as 0/1, the tree, the
angels and the bosses beaten as `{id: n}`, achievements as `{id: Date.now()}`. Keys game.js only creates once
they're first set are always written, at the value game.js reads for a missing one. A new visit keeps only `daily`,
as game.js's `KEEP` does. The difftest compares the save with game.js's `S` every ten seconds, and round-trips a save
through game.js both ways. The shim saves every 3 s of play (as game.js does) and on `pagehide`. Natively, put the
same text in a file in the app's data directory.

## The temporary renderer bridge (web, until stage 1)

planet-render can't draw the game yet, so the `--rust` page keeps game.js as its renderer. It runs a second copy of
game.js (the twin) in lockstep with the Rust game:

- Same fixed steps (the shim steps both: planet-core first, then the twin at the same `t`), the same inputs at the same
  moments, and the same seeded LCG while simulating. While drawing, the twin's randomness is `Math.random`, so drawing
  doesn't move the game's random stream.
- Its `ui`, storage, timers, preview hooks, body classes and listeners are its own. `assemble.mjs` wraps game.js in a
  function that shadows `Math`, `setTimeout`, `localStorage`, `location`, `document` and `addEventListener`. Its timers
  run on simulated time, the way the difftest harness runs them.
- game.js changes the game in four places while drawing: the big bang lands, a great ape's stomp shakes the screen,
  and the capsule a boss drops falls and opens itself after 8 s. planet-core does these in `Game::draw_step` after
  the frame. The difftest harness and the twin both run them just before drawing, so drawing a frame or skipping it
  changes nothing.
- It reports where it drew what taps and beams aim at, after every step: `spots(json)` (planet-core's `spots.rs`),
  giving the hero's lift and facing, piccolo, bubbles, the boss, the ginyu force, movie henchmen, the visitors,
  saibamen, birds, gadgets and snake way's ghosts.
- Once a second the shim compares planet-core's power and random draws (`probe()`) with the twin's. On a mismatch it
  logs `planet: the drawing drifted from the game` once.

`node rust/planet-web/test.mjs [minutes] [seed]` runs exactly what `build.mjs --rust` ships, in a vm with a stub DOM and
drawing on. It plays through the page's entry points (taps on whatever the twin drew, drags, held beams, double taps,
keys, the shop, wishes, the tree) and checks power and draws every frame.

When stage 1 lands, `spots` becomes planet-render writing the same fields, and `draw_step` stays in planet-core. The
twin, `assemble.mjs`'s wrapping and the shim's lockstep loop go away. The shim's frame becomes `step()` and a
`putImageData` of planet-web's framebuffer.

## What stage 5 needs

- **Tauri commands**: one for each row of the calls table, on a `Mutex<Bridge>`. Return the same strings. Push
  `frame()`'s message to the HUD web view as a Tauri event after each tick, rather than having the view poll.
- **The HUD-only web view**: page.html's HUD markup with the shim. Swap the `RUST.Planet` calls for `invoke`, and drop
  the twin and the lockstep loop (the native side steps and draws). Pointer events on the native window go to
  `pointer_*` with both coordinate pairs. The widget's own `ui.notify` handles the `notify` cues.
- **Pictures the HUD shows that come from game.js today**: `thumb(id)` (the characters tab) and the card's `spr` and
  `scene`. These need stage 1's sprite data in planet-core: an RGBA hero sprite per form and a copy of the framebuffer.
  Until then the native HUD can leave the thumbnails blank.
- **Time**: pass the wall clock (`Date.now()`, or the system clock in ms) with `start` and `step`, and today's date as
  `toDateString()` would print it (`Wed Oct 28 2026`).
- **The save**: the `save()` text in a file, read back with `load()`.
