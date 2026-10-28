# planet

A DBZ-inspired pixel-art idle game on King Kai's planet, under a pearl 3D title. It's the homepage of [highskore.com](https://highskore.com), and the [powerrr](https://github.com/highskore/powerrr) desktop widget is built from it too.

## The game

- **The title**: "highskore" in 3D pearl (three.js, Bagel Fat One). Letters wave, pop on hover, bounce when tapped, and sweep through each transformation's colour.
- **The scroll intro**: the page opens on the title alone. Scrolling settles it into place and brings up the game card. On phones the page doesn't scroll: the cue reads "press for fun" and plays the same intro (a swipe up works too), the title starts stacked as high / skore and the letters collide on their way into one line.
- **The game**: Vegeta runs laps around a draggable planet over a sea of golden clouds. Tap to train, hold to charge a galick gun, drag to spin.
  - 14 upgrades, from weighted boots to Piccolo, the time chamber and ascension.
  - Forms from super saiyan to ultra instinct.
  - Events: dragon balls and Shenron, great ape mode, villain raids (Frieza, Cell, Kid Buu, Beerus), the Ginyu Force, the Tournament of Power, the fusion dance, Gregory, King Kai's jokes, Saibamen and meteor showers.
  - Other worlds: every 1M power, a 45-second trip to Namek (where Porunga grants wishes), Planet Vegeta or Snake Way, in turn.

Every visit starts from zero: power, upgrades, achievements and characters all reset on refresh. Only the date of the last daily bonus is kept in `localStorage` (`hs-power`).

## Building

The game is one self-contained HTML page, stitched together from these sources:

| file | what it is |
| --- | --- |
| `page.html` | layout, styles, HUD and the three.js title; `__WORLD__`, `__PLANET__` and `__BAGEL__` are filled in by the build |
| `world.js` | the pixel stage: buffer, sprites, text, particles |
| `game.js` | the game: planet renderer, Vegeta, upgrades, events, villains |
| `shenron.js` | Shenron and Porunga |
| `bagel.typeface.json` | the title font as a three.js typeface |
| `widget.js`, `widget.css` | the desktop widget's extras, only in the `--widget` build |
| `build.mjs` | stitches them into one page |

```sh
node build.mjs            # → dist/planet.html, the highskore.com homepage
npm install               # once, for the widget's inlined fonts (@fontsource)
node build.mjs --widget   # → dist/index.html under the current directory, the powerrr widget's page
```

No dependencies for the site build. Code fenced by `/*widget*/…/*/widget*/` in `page.html`, `game.js` and `world.js` is kept only in the widget build; the site build drops it whole, so its output doesn't change. The widget build also leaves out the CDN three.js and Google Fonts and inlines the fonts from `@fontsource` in the `node_modules` of the directory it runs from.

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
| `#door` | the time chamber door |
| `#pod` | a saiyan space pod |
| `#storm` | a meteor storm |
| `#spirit` | a nearly full spirit bomb |
| `#struggle` | a villain who starts a beam struggle |
| `#chamber` | the time chamber |

## Where it's used

- **highskore.com** has this repo as a submodule at `games/planet`; its `pnpm build:planet` runs `node build.mjs` and copies `dist/planet.html` to `public/planet.html`.
- **[powerrr](https://github.com/highskore/powerrr)** has it as a submodule at `game/`, and builds the widget page with `node game/build.mjs --widget`.

A fan project. Dragon Ball and its characters belong to Akira Toriyama and their rights holders.
