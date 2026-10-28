// Headless JS planet game for differential testing against planet-core.
// Loads world.js + shenron.js + game.js from the repo root into a vm with a seeded Math.random (the same LCG planet-core uses)
// and never draws, so screen spots game.js sets while drawing (sx/sy, a boss's x/y) stay unset, as in a headless planet-core.
const fs = require('fs'), vm = require('vm'), path = require('path')
const ROOT = path.join(__dirname, '..', '..')

function patch(src, from, to) { if (!src.includes(from)) throw new Error('harness anchor missing: ' + from.slice(0, 60)); return src.replace(from, to) }

// the wall clock the game reads (Date.now() stamps achievements, toDateString() decides the daily bonus): fixed, then simulated time
const EPOCH = 1793188800000   // 2026-10-28 12:00 UTC

function mount({ seed = 1, W = 600, H = 400, traceRng = false, saved = null } = {}) {
  let rs = seed >>> 0 || 1, draws = 0
  const sites = new Map()
  const rnd = () => {
    draws++
    if (traceRng) { const s = new Error().stack.split('\n')[2].trim(); sites.set(s, (sites.get(s) || 0) + 1) }
    return (rs = (rs * 1664525 + 1013904223) >>> 0) / 4294967296
  }
  const M = Object.create(Math); M.random = rnd
  const noop = () => {}, handlers = {}, win = {}, events = [], pending = [], errors = []
  let wish = null, update = null, shop = null
  const rect = () => ({ left: 0, top: 0, width: W, height: H })
  const ctx2d = { createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), putImageData: noop }
  const cv = { width: 0, height: 0, style: {}, addEventListener: (k, f) => { handlers[k] = f }, setPointerCapture: noop, releasePointerCapture: noop, getBoundingClientRect: rect, getContext: () => ctx2d }
  const el = { getBoundingClientRect: rect, querySelector: () => cv, closest: () => null, dataset: {} }
  const body = { classList: { toggle: noop, add: noop, remove: noop, contains: () => false } }
  const doc = { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: () => ({ getContext: () => ctx2d, style: {} }), addEventListener: noop, body }
  let T = 0
  const now = () => EPOCH + Math.floor(T * 1000)
  class FakeDate extends Date { constructor(...a) { if (a.length) super(...a); else super(now()) } static now() { return now() } }
  const store = { 'hs-power': saved }
  const localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v) }, removeItem: k => { delete store[k] } }
  const ctx = { WIDGET: false, document: doc, addEventListener: (k, f) => { win[k] = f }, location: { hash: '', hostname: 'localhost', protocol: 'http:' }, localStorage, setTimeout: (f, ms = 0) => pending.push([T + ms / 1000, f]), clearTimeout: noop, console, Math: M, Date: FakeDate, JSON, performance: { now: () => T * 1000 } }
  ctx.window = ctx; vm.createContext(ctx)
  let src = ['world.js', 'shenron.js', 'game.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n')
  src = patch(src, '    return { menu, learn, respec,', '    globalThis.__ev = s => eval(s);\n    return { menu, learn, respec,')
  // headless, the frame stops before drawing; the big bang still lands, as it does while its ball is drawn (snake way draws the road instead)
  src = patch(src, 'st.clear(); zb.fill(-1e9); ib.fill(0);', 'if (globalThis.__skip) { if (bang && !(S.world === 3 && snk) && Math.min(1, (t - bang.t0) / bang.dur) >= 1) { explode(bang.x1, bang.y1); bang = null; } return; } st.clear(); zb.fill(-1e9); ib.fill(0);')
  ctx.__skip = true
  vm.runInContext(src + '\n;globalThis.__G = GAMES; globalThis.__makeStage = makeStage;', ctx)
  // what the HUD gets: toasts with their time and duration, and the last ui.update / ui.shop arguments
  const ui = new Proxy({}, { get: (_, k) => k === 'event' ? ((s, ms = 2600) => events.push([T, s, ms])) : k === 'update' ? (u => { update = u }) : k === 'shop' ? (s => { shop = s }) : k === 'onBuy' ? (f => { ctx.BUY = f }) : k === 'confirm' ? ((a, f) => f && f()) : k === 'wish' ? ((offer, pick) => { wish = { offer, pick } }) : noop })
  const st = ctx.__makeStage({ querySelector: () => el }); st.resize()
  const game = ctx.__G.find(g => g.id === 'planet').mount(st, ui); game.start()
  const ev = s => ctx.__ev(s)
  const runPending = () => { pending.sort((a, b) => a[0] - b[0]); while (pending.length && pending[0][0] <= T) { const [, f] = pending.shift(); f() } }
  const step = (dt = 1 / 30) => { T += dt; st.t = T; game.frame(T, dt); runPending() }
  // the canvas's pointer listeners and the window's keydown, called the way a browser would (clientX/Y in CSS pixels)
  const ptr = (k, x, y) => handlers[k]({ clientX: x, clientY: y, pointerId: 1 })
  const input = {
    toBuf: (x, y) => st.toBuf({ clientX: x, clientY: y }),
    down: (x, y) => ptr('pointerdown', x, y), move: (x, y) => ptr('pointermove', x, y), up: (x, y) => ptr('pointerup', x, y), cancel: () => handlers.pointercancel({}),
    key: k => win.keydown({ key: k, repeat: false, target: { closest: () => null, blur: noop }, preventDefault: noop }),
  }
  return { game, ev, step, buy: k => ctx.BUY(k), train: () => game.train(), offer: () => wish.offer, pick: k => wish.pick(k), input, store, get update() { return update }, get shop() { return shop }, today: new FakeDate().toDateString(), events, errors, sites, get draws() { return draws }, get T() { return T } }
}
module.exports = mount
