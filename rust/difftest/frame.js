// Draws one scene with game.js for the framebuffer diff: mounts the headless game with a preview hook, runs it
// headless, then clears the cosmetic state headless game.js never steps (particles, floating numbers, the flash,
// the chamber's afterimage) and draws the last few frames. Writes the pixels (RGBA, as ImageData holds them) and a
// JSON line of the state the Rust side checks before comparing.
// Usage: node rust/difftest/frame.js <out-prefix> [--hook '#namek'] [--w 1200 --h 700] [--seed 1] [--frames 300]
//        [--draw 1] [--widget [--clouds c --amt 2]] [--px]
const fs = require('fs')
const mount = require('./harness')
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1] }
const flag = k => process.argv.includes('--' + k)
const out = process.argv[2]
const o = { hash: arg('hook', ''), W: +arg('w', 1200), H: +arg('h', 700), seed: +arg('seed', 1), frames: +arg('frames', 300), draw: +arg('draw', 1), widget: flag('widget'), px: flag('px') }
const g = mount({ seed: o.seed, W: o.W, H: o.H, hash: o.hash, widget: o.widget, px: o.px })
if (o.widget) { const st = g.ev('st'); st.clouds = arg('clouds', '') || false; st.cloudAmt = +arg('amt', 2) }
for (let f = 0; f < o.frames; f++) {
  if (f === o.frames - o.draw) { g.ev('fx.list.length = 0; floats.length = 0; flashT = 0; echo = null'); g.ctx.__skip = false }
  g.step()
}
const st = g.ev('st'), buf = new Uint32Array(st.buf)
// the floating widget's rim, as widget.js's flush draws it (its JS path; px.wasm's rim() draws the same)
if (o.widget) { const b = buf, W = st.W, H = st.H, solid = k => b[k] >>> 24 >= 0xf0; for (let y = 0; y < H; y++) for (let x = 0, k = y * W; x < W; x++, k++) if (!(b[k] >>> 24) && ((x > 0 && solid(k - 1)) || (x < W - 1 && solid(k + 1)) || (y > 0 && solid(k - W)) || (y < H - 1 && solid(k + W)))) b[k] = 0xd8140f0c }
fs.writeFileSync(out + '.rgba', Buffer.from(buf.buffer))
const state = g.ev('({ world: S.world, session, phi, pl: S.pl, form: S.form, hero: S.hero || "vegeta", bob: st.bob, M, R, cx, cy })')
console.log(JSON.stringify({ W: st.W, H: st.H, draws: g.draws, errors: g.errors.length, ...state }))
