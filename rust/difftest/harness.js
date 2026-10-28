// Headless JS planet game for differential testing against planet-core.
// Loads world.js + shenron.js + game.js from the repo root into a vm with a seeded Math.random (the same LCG planet-core uses)
// and never draws, so screen spots game.js sets while drawing (sx/sy, a boss's x/y) stay unset, as in a headless planet-core.
const fs = require('fs'), vm = require('vm'), path = require('path')
const ROOT = path.join(__dirname, '..', '..')

function patch(src, from, to) { if (!src.includes(from)) throw new Error('harness anchor missing: ' + from.slice(0, 60)); return src.replace(from, to) }

function mount({ seed = 1, W = 600, H = 400, traceRng = false, hash = '', widget = false, px = false } = {}) {
  let rs = seed >>> 0 || 1, draws = 0
  const sites = new Map()
  const rnd = () => {
    draws++
    if (traceRng) { const s = new Error().stack.split('\n')[2].trim(); sites.set(s, (sites.get(s) || 0) + 1) }
    return (rs = (rs * 1664525 + 1013904223) >>> 0) / 4294967296
  }
  const M = Object.create(Math); M.random = rnd
  const noop = () => {}, handlers = {}, win = {}, events = [], pending = [], errors = []
  let wish = null
  const rect = () => ({ left: 0, top: 0, width: W, height: H })
  const ctx2d = { createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), putImageData: noop }
  const cv = { width: 0, height: 0, style: {}, addEventListener: (k, f) => { handlers[k] = f }, setPointerCapture: noop, releasePointerCapture: noop, getBoundingClientRect: rect, getContext: () => ctx2d }
  const el = { getBoundingClientRect: rect, querySelector: () => cv, closest: () => null, dataset: {} }
  const body = { classList: { toggle: noop, add: noop, remove: noop, contains: () => false } }
  const doc = { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: () => ({ getContext: () => ctx2d, style: {} }), addEventListener: noop, body }
  let T = 0
  const ctx = { WIDGET: widget, BARE: widget, document: doc, addEventListener: (k, f) => { win[k] = f }, location: { hash, hostname: 'localhost', protocol: 'http:' }, localStorage: { getItem: () => null, setItem: noop, removeItem: noop }, setTimeout: (f, ms = 0) => pending.push([T + ms / 1000, f]), clearTimeout: noop, console, Math: M, Date, JSON, performance: { now: () => T * 1000 } }
  if (px) { ctx.atob = atob; ctx.ImageData = function (data, w, h) { this.data = data; this.width = w; this.height = h } }
  ctx.window = ctx; vm.createContext(ctx)
  let src = ['world.js', 'shenron.js', 'game.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n')
  // the site build drops widget-only code (build.mjs's fence); px: inline px.wasm the way build.mjs does, so world.js loads it
  if (!widget) src = src.replace(/\/\*widget\*\/([\s\S]*?)\/\*\/widget\*\//g, '')
  if (px) src = patch(src, "atob('__PX__')", "atob('" + fs.readFileSync(path.join(ROOT, 'wasm', 'px.wasm')).toString('base64') + "')")
  src = patch(src, '    return { menu, learn, respec,', '    globalThis.__ev = s => eval(s);\n    return { menu, learn, respec,')
  src = patch(src, 'st.clear(); zb.fill(-1e9); ib.fill(0);', 'if (globalThis.__skip) return; st.clear(); zb.fill(-1e9); ib.fill(0);')
  ctx.__skip = true
  vm.runInContext(src + '\n;globalThis.__G = GAMES; globalThis.__makeStage = makeStage;', ctx)
  const ui = new Proxy({}, { get: (_, k) => k === 'event' ? (s => events.push([T, s])) : k === 'onBuy' ? (f => { ctx.BUY = f }) : k === 'confirm' ? ((a, f) => f && f()) : k === 'wish' ? ((offer, pick) => { wish = { offer, pick } }) : noop })
  const st = ctx.__makeStage({ querySelector: () => el }); st.resize()
  const game = ctx.__G.find(g => g.id === 'planet').mount(st, ui); game.start()
  const ev = s => ctx.__ev(s)
  const runPending = () => { pending.sort((a, b) => a[0] - b[0]); while (pending.length && pending[0][0] <= T) { const [, f] = pending.shift(); f() } }
  const step = (dt = 1 / 30) => { T += dt; st.t = T; game.frame(T, dt); runPending() }
  return { ctx, game, ev, step, buy: k => ctx.BUY(k), train: () => game.train(), offer: () => wish.offer, pick: k => wish.pick(k), events, errors, sites, get draws() { return draws }, get T() { return T } }
}
module.exports = mount
