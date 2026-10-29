// Headless JS planet game for differential testing against planet-core.
// Loads world.js + shenron.js + game.js from the repo root into a vm with a seeded Math.random (the same LCG planet-core uses)
// and never draws, so screen spots game.js sets while drawing (sx/sy, a boss's x/y) stay unset, as in a headless planet-core.
const fs = require('fs'), vm = require('vm'), path = require('path')
const ROOT = path.join(__dirname, '..', '..')

function patch(src, from, to) { if (!src.includes(from)) throw new Error('harness anchor missing: ' + from.slice(0, 60)); return src.replace(from, to) }

// the wall clock the game reads (Date.now() stamps achievements, toDateString() decides the daily bonus): fixed, then simulated time
const EPOCH = 1793188800000   // 2026-10-28 12:00 UTC

function mount({ seed = 1, W = 600, H = 400, traceRng = false, saved = null, calm = false, hash = '', widget = false, px = false } = {}) {
  let rs = seed >>> 0 || 1, draws = 0
  const sites = new Map()
  const rnd = () => {
    draws++
    if (traceRng) { const s = new Error().stack.split('\n')[2].trim(); sites.set(s, (sites.get(s) || 0) + 1) }
    return (rs = (rs * 1664525 + 1013904223) >>> 0) / 4294967296
  }
  const M = Object.create(Math); M.random = rnd
  const noop = () => {}, handlers = {}, win = {}, events = [], cues = [], pending = [], errors = []
  let wish = null, itx = null, update = null, shop = null, side = null, night = false, world = null
  const rect = () => ({ left: 0, top: 0, width: W, height: H })
  const ctx2d = { createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), putImageData: noop }
  const cv = { width: 0, height: 0, style: {}, addEventListener: (k, f) => { handlers[k] = f }, setPointerCapture: noop, releasePointerCapture: noop, getBoundingClientRect: rect, getContext: () => ctx2d }
  const el = { getBoundingClientRect: rect, querySelector: () => cv, closest: () => null, dataset: {} }
  const classes = new Set()
  const body = { classList: { toggle: (c, on) => (on ?? !classes.has(c)) ? classes.add(c) : classes.delete(c), add: (...c) => c.forEach(x => classes.add(x)), remove: (...c) => c.forEach(x => classes.delete(x)), contains: c => classes.has(c) } }
  const doc = { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: () => ({ getContext: () => ctx2d, style: {} }), addEventListener: noop, body }
  let T = 0
  const now = () => EPOCH + Math.floor(T * 1000)
  class FakeDate extends Date { constructor(...a) { if (a.length) super(...a); else super(now()) } static now() { return now() } }
  const store = { 'hs-power': saved }
  const localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v) }, removeItem: k => { delete store[k] } }
  const ctx = { WIDGET: widget, BARE: widget, document: doc, addEventListener: (k, f) => { win[k] = f }, location: { hash, hostname: 'localhost', protocol: 'http:' }, localStorage, setTimeout: (f, ms = 0) => pending.push([T + ms / 1000, f]), clearTimeout: noop, console, Math: M, Date: FakeDate, JSON, performance: { now: () => T * 1000 } }
  if (px) { ctx.atob = atob; ctx.ImageData = function (data, w, h) { this.data = data; this.width = w; this.height = h } }
  ctx.window = ctx; vm.createContext(ctx)
  let src = ['world.js', 'shenron.js', 'game.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n')
  // px: inline px.wasm the way build.mjs does, so world.js loads it. Widget-only code stays in, as WIDGET and BARE turn it off
  if (px) src = patch(src, "atob('__PX__')", "atob('" + fs.readFileSync(path.join(ROOT, 'wasm', 'px.wasm')).toString('base64') + "')")
  src = patch(src, '    return { menu, learn, respec,', '    globalThis.__ev = s => eval(s);\n    return { menu, learn, respec,')
  // the houses scenery() last built: a wish's free levels don't rebuild it, so the drawing keeps the old ones
  src = patch(src, '    function scenery() {', '    function scenery() { globalThis.__sceneryHouse = S.house;')
  // what game.js does to the game while drawing happens just before the drawing, headless or not (snake way draws the road
  // instead, so none of it there): the big bang lands, a great ape's stomp shakes the screen (so does a full beam charge,
  // if the hero is in view: never, headless), the capsule falls and opens itself after 8s. planet-core runs the same after
  // the frame's logic (Game::draw_step), and planet-render draws after that. Drawn, the drawing keeps the stomp's dust and
  // the capsule but no longer changes them. Headless, the frame stops there
  src = patch(src, 'st.clear(); zb.fill(-1e9); ib.fill(0);', 'let __stomp = false, __heroSeen = false; if (!(S.world === 3 && snk)) { if (bang && Math.min(1, (t - bang.t0) / bang.dur) >= 1) { explode(bang.x1, bang.y1); bang = null; } if (apeUntil > t && Math.floor(t * 3.2) !== apeStep) { apeStep = Math.floor(t * 3.2); shake = Math.max(shake, .35); __stomp = true; } if (charging >= 2.4 && __heroSeen) shake = Math.max(shake, .06); if (capsule) { const c = capsule; if (c.y < c.land) { c.vy += 160 * dt; c.y = Math.min(c.land, c.y + c.vy * dt); } else c.y = c.land + Math.sin((t - c.t0) * 4) * 1.5; if (t - c.t0 > 8) openCapsule(); } } if (globalThis.__skip) return; st.clear(); zb.fill(-1e9); ib.fill(0);')
  src = patch(src, 'const step = Math.floor(t * 3.2); if (step !== apeStep) { apeStep = step; shake = Math.max(shake, .35); for', 'const step = Math.floor(t * 3.2); if (__stomp) { for')
  src = patch(src, 'const c = capsule; if (c.y < c.land) { c.vy += 160 * dt; c.y = Math.min(c.land, c.y + c.vy * dt); } else c.y = c.land + Math.sin((t - c.t0) * 4) * 1.5;\n        if (t - c.t0 > 8) openCapsule();\n        else {', 'const c = capsule; {')
  ctx.__skip = true
  vm.runInContext(src + '\n;globalThis.__G = GAMES; globalThis.__makeStage = makeStage;', ctx)
  // what the HUD gets: toasts and the other one-shot calls (cues) with their time and arguments, the last ui.update /
  // ui.shop arguments, and beside each ui.update what game.js has set elsewhere by then: ui.night, ui.world and the body classes
  const CUES = ['sfx', 'fx', 'bump', 'achieved', 'zeno', 'treeGift', 'wishDone', 'notify']
  const look = () => classes.has('jelly') ? 'jelly' : classes.has('earth') ? 'earth' : ''
  const ui = new Proxy({}, { get: (_, k) => k === 'event' ? ((s, ms = 2600) => events.push([T, s, ms])) : CUES.includes(k) ? ((...a) => cues.push([T, k, ...a.filter(x => typeof x !== 'function')]))
    : k === 'update' ? (u => { update = u; side = { night, world, shen: classes.has('shen'), look: look() } }) : k === 'night' ? (n => { night = n }) : k === 'world' ? (w => { world = w })
    : k === 'shop' ? (s => { shop = s }) : k === 'onBuy' ? (f => { ctx.BUY = f }) : k === 'confirm' ? ((a, f) => f && f()) : k === 'wish' ? ((offer, pick) => { wish = { offer, pick }; cues.push([T, k, offer]) })
    : k === 'itxPick' ? ((worlds, jump) => { itx = { worlds, jump }; cues.push([T, k, worlds]) }) : noop })
  const st = ctx.__makeStage({ querySelector: () => el }); st.resize(); st.calm = calm
  const game = ctx.__G.find(g => g.id === 'planet').mount(st, ui); game.start()
  const ev = s => ctx.__ev(s)
  const runPending = () => { pending.sort((a, b) => a[0] - b[0]); while (pending.length && pending[0][0] <= T) { const [, f] = pending.shift(); f() } }
  const step = (dt = 1 / 30) => { T += dt; st.t = T; game.frame(T, dt); runPending() }
  // the canvas's pointer listeners and the window's keydown, called the way a browser would (clientX/Y in CSS pixels)
  const ptr = (k, x, y, pointerId = 1, button = 0, touch = false) => handlers[k]({ clientX: x, clientY: y, pointerId, button, pointerType: touch ? 'touch' : 'mouse' })
  const input = {
    toBuf: (x, y) => st.toBuf({ clientX: x, clientY: y }),
    down: (x, y, id, button, touch) => ptr('pointerdown', x, y, id, button, touch), move: (x, y, id) => ptr('pointermove', x, y, id), up: (x, y, id) => ptr('pointerup', x, y, id), cancel: () => handlers.pointercancel({}),
    key: k => win.keydown({ key: k, repeat: false, target: { closest: () => null, blur: noop }, preventDefault: noop }),
  }
  return { ctx, game, ev, step, buy: k => ctx.BUY(k), train: () => game.train(), offer: () => wish.offer, pick: k => wish.pick(k), get itx() { return itx }, input, store, get update() { return update }, get side() { return side }, get shop() { return shop }, today: new FakeDate().toDateString(), events, cues, errors, sites, get draws() { return draws }, get T() { return T } }
}
module.exports = mount
