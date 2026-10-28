// End-to-end check of the --rust page's game: the exact code build.mjs --rust ships (wasm glue, shim, game.js as the
// lockstep renderer) mounted in a vm with a stub DOM, drawing on, played for a while through the page's own entry
// points (pointer events on the canvas, keys, the shop, wishes, the menu). It fails if the drawing drifts from the Rust
// game or the HUD's power differs from game.js's. Needs a wasm build: sh rust/planet-web/build.sh
// Usage: node rust/planet-web/test.mjs [minutes] [seed]
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import { rustPlanet } from './assemble.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const read = f => readFileSync(join(root, f), 'utf8')
const fence = s => s.replace(/\/\*widget\*\/([\s\S]*?)\/\*\/widget\*\//g, '')
const minutes = +(process.argv[2] || 12), seed = +(process.argv[3] || 7)

let rs = seed >>> 0 || 1
const rand = () => (rs = (rs * 1664525 + 1013904223) >>> 0) / 4294967296   // the test's own choices, and the page's Math.random
const W = 600, H = 400, noop = () => {}
const canvasHandlers = {}, winHandlers = {}, warnings = [], store = {}
const ctx2d = { createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), putImageData: noop, fillRect: noop, drawImage: noop }
const rect = () => ({ left: 0, top: 0, width: W, height: H })
const cv = { width: 0, height: 0, style: {}, addEventListener: (k, f) => { canvasHandlers[k] = f }, setPointerCapture: noop, releasePointerCapture: noop, getBoundingClientRect: rect, getContext: () => ctx2d }
const el = { getBoundingClientRect: rect, querySelector: () => cv, closest: () => null, dataset: {} }
const classes = new Set()
const document = {
  currentScript: null, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, addEventListener: noop, hidden: false,
  createElement: () => ({ getContext: () => ctx2d, style: {}, width: 0, height: 0 }),
  body: { classList: { add: (...c) => c.forEach(x => classes.add(x)), remove: (...c) => c.forEach(x => classes.delete(x)), toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)), contains: c => classes.has(c) } },
}
const M = Object.create(Math); M.random = rand
const ctx = {
  WIDGET: false, document, location: { hash: '', hostname: 'localhost', protocol: 'http:', href: 'http://localhost/' }, Math: M, Date, JSON, console: { ...console, warn: (...a) => warnings.push(a.join(' ')) },
  ImageData: class { constructor(data, w, h) { Object.assign(this, { data, width: w, height: h }) } },
  addEventListener: (k, f) => { winHandlers[k] = f }, setTimeout, clearTimeout, performance, atob, WebAssembly, TextEncoder, TextDecoder, URL,
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v) }, removeItem: k => { delete store[k] } },
}
ctx.window = ctx
vm.createContext(ctx)
const world = fence(read('world.js')).replace('__PX__', () => readFileSync(join(root, 'wasm', 'px.wasm')).toString('base64'))
vm.runInContext(world + '\n' + rustPlanet(read, fence) + '\n;globalThis.__G = GAMES; globalThis.__makeStage = makeStage; globalThis.__TWIN = TWIN;', ctx)

// page.html's ui, recording what the Rust side sends it
let buy = null, wish = null, hud = null, shop = null, offers = 0
const events = [], cues = {}
const ui = {
  onBuy: f => { buy = f }, update: s => { hud = s }, shop: s => { shop = s }, event: (s, ms) => events.push([s, ms]), wish: (o, done) => { wish = { o, done }; offers++ },
  wishDone: () => { wish = null }, night: noop, hell: noop, world: noop,
  sfx: k => { cues[k] = (cues[k] || 0) + 1 }, fx: k => { cues['fx:' + k] = (cues['fx:' + k] || 0) + 1 }, bump: noop, achieved: noop, zeno: noop, treeGift: noop,
}
const st = ctx.__makeStage({ querySelector: () => el }); st.resize()
const game = ctx.__G.find(g => g.id === 'planet').mount(st, ui)
const twin = s => ctx.__TWIN.env.rs.ev(s)
game.start()

const ev = (k, x, y) => canvasHandlers[k]({ clientX: x, clientY: y, pointerId: 1, button: 0 })
const tap = (x, y) => { ev('pointerdown', x, y); ev('pointerup', x, y) }
const key = k => winHandlers.keydown({ key: k, repeat: false, target: { closest: () => null, blur: noop }, preventDefault: noop })
// whatever the twin drew that takes a tap, in CSS pixels (buffer × 3)
const target = () => twin(`(() => { const p = o => o && o.sx !== undefined ? [o.sx, o.sy - 6] : null;
  return p(kai) || p(greg) || p(bean) || p(door) || p(yam) || p(car) || p(roshi) || (satan && st.t > satan.t0 ? p(satan) : null) || p(pud)
    || (saibas.find(s => !s.dead && s.sx !== undefined) ? p(saibas.find(s => !s.dead && s.sx !== undefined)) : null)
    || (ginyu && !ginyu.done ? (m => [m.x, m.y - m.spr.h / 2 * m.k])(ginyu.members.find(m => !m.dead)) : null)
    || (boss && !boss.dead ? [boss.x, boss.y - boss.spr.h / 2 * boss.k] : null) || (star ? [star.x, star.y] : null) || null })()`)
const SHOP = ['boots', 'partner', 'gravity', 'scouter', 'house', 'piccolo', 'cloud', 'armor', 'kaio', 'galick', 'senzu', 'chamber', 'bigbang', 'tail']

let T = 0, worst = 0, checks = 0, menus = 0, gap = ''
const frames = Math.round(minutes * 60 * 30)
for (let f = 0; f < frames; f++) {
  const p = f % 300, tg = f % 3 === 0 ? target() : null
  if (tg) tap(tg[0] * 3, tg[1] * 3)
  if (p < 150 && f % 5 === 0) tap(200 + rand() * 300, 100 + rand() * 200)
  if (p === 160) ev('pointerdown', 300, 200)
  if (p > 160 && p < 168) ev('pointermove', 300 + (p - 160) * 9, 200 - (p - 160) * 3)
  if (p === 168) ev('pointerup', 363, 179)
  if (p === 200) ev('pointerdown', 450, 90)
  if (p === 280) ev('pointerup', 450, 90)
  if (p === 285 || p === 288) tap(500 + p - 285, 120)
  if (f % 45 === 7) key(' ')
  if (f % 30 === 0 && shop && buy) for (const k of SHOP) if (shop[k] && shop[k].can) buy(k)
  if (f % 30 === 0 && hud && hud.kaio.own && hud.kaio.ready) game.kaioken()
  if (wish && f % 90 === 0) { wish.done(wish.o[wish.o.length - 1].key); wish = null }
  if (f % 900 === 0) { const m = game.menu(); for (const n of m.tree) if (n.can) game.learn(n.id); game.card(); game.angels(); game.ascendInfo(); menus++ }
  const gdt = f % 7 === 3 ? .05 : 1 / 30   // now and then a slow frame: the shim runs two steps and draws only the second
  T += gdt
  game.frame(T, gdt)
  // every frame: the Rust game's power and random draws against the twin's
  const pr = JSON.parse(ctx.__TWIN.planet.probe()), js = twin('S.pl')
  checks++; worst = Math.max(worst, Math.abs(js - pr.pl) / Math.max(1, js))
  if (pr.draws !== ctx.__TWIN.draws && !gap) gap = `draws ${pr.draws} vs ${ctx.__TWIN.draws} at t=${pr.t.toFixed(2)}`
}
const lockstep = !warnings.length && worst === 0 && !gap
console.log(`${minutes} minutes (seed ${seed}): ${checks} frames checked, worst power gap ${worst}${gap ? ', ' + gap : ''}, ${warnings.length} drift warnings${warnings.length ? ': ' + warnings[0] : ''}`)
console.log(`  hud power ${hud && hud.pl}, form ${hud && hud.form.name}, world ${twin('S.world')}, ${events.length} toasts, ${offers} wish offers, ${menus} menu reads, sounds ${JSON.stringify(cues)}`)
console.log(`  saved: ${(store['hs-power'] || '').length} bytes, daily ${JSON.parse(store['hs-power'] || '{}').daily}`)
if (!lockstep) process.exit(1)
