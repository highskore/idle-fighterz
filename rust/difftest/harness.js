// Headless JS planet game for differential testing against planet-core.
// Loads world.js + shenron.js + game.js from the repo root into a vm with a seeded Math.random (the same LCG planet-core uses),
// patches out the stage-3 timeline (events, trips, bosses, moon, senzu beans) when coreOnly is set, and never draws.
const fs = require('fs'), vm = require('vm'), path = require('path')
const ROOT = path.join(__dirname, '..', '..')

function patch(src, from, to) { if (!src.includes(from)) throw new Error('harness anchor missing: ' + from.slice(0, 60)); return src.replace(from, to) }

module.exports = function mount({ seed = 1, W = 600, H = 400, coreOnly = true, traceRng = false } = {}) {
  let rs = seed >>> 0 || 1, draws = 0
  const sites = new Map()
  const rnd = () => {
    draws++
    if (traceRng) { const s = new Error().stack.split('\n')[2].trim(); sites.set(s, (sites.get(s) || 0) + 1) }
    return (rs = (rs * 1664525 + 1013904223) >>> 0) / 4294967296
  }
  const M = Object.create(Math); M.random = rnd
  const noop = () => {}, handlers = {}, win = {}, events = [], pending = [], errors = []
  const rect = () => ({ left: 0, top: 0, width: W, height: H })
  const ctx2d = { createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), putImageData: noop }
  const cv = { width: 0, height: 0, style: {}, addEventListener: (k, f) => { handlers[k] = f }, setPointerCapture: noop, releasePointerCapture: noop, getBoundingClientRect: rect, getContext: () => ctx2d }
  const el = { getBoundingClientRect: rect, querySelector: () => cv, closest: () => null, dataset: {} }
  const body = { classList: { toggle: noop, add: noop, remove: noop, contains: () => false } }
  const doc = { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: () => ({ getContext: () => ctx2d, style: {} }), addEventListener: noop, body }
  let T = 0
  const ctx = { WIDGET: false, document: doc, addEventListener: (k, f) => { win[k] = f }, location: { hash: '', hostname: 'localhost', protocol: 'http:' }, localStorage: { getItem: () => null, setItem: noop, removeItem: noop }, setTimeout: (f, ms = 0) => pending.push([T + ms / 1000, f]), clearTimeout: noop, console, Math: M, Date, JSON, performance: { now: () => T * 1000 } }
  ctx.window = ctx; vm.createContext(ctx)
  let src = ['world.js', 'shenron.js', 'game.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n')
  src = patch(src, '    return { menu, learn, respec,', '    globalThis.__ev = s => eval(s);\n    return { menu, learn, respec,')
  src = patch(src, 'st.clear(); zb.fill(-1e9); ib.fill(0);', 'if (globalThis.__skip) return; st.clear(); zb.fill(-1e9); ib.fill(0);')
  if (coreOnly) {
    src = patch(src, 'if (S.world === 3) updateSnake(t, dt); else {', 'if (S.world === 3) updateSnake(t, dt); else if (!globalThis.__coreOnly) {')
    // the tree's auto taps sit inside the timeline block but are core economy: close the block before them, reopen it after
    src = patch(src, "      if (lvl('auto') && playing) {", "      } if (lvl('auto') && playing) {")
    src = patch(src, '      if (robotUntil > t) {', '      if (!globalThis.__coreOnly) { if (robotUntil > t) {')
    src = patch(src, 'if (S.world === home() && (S.runBest >=', 'if (!globalThis.__coreOnly && S.world === home() && (S.runBest >=')
    src = patch(src, '      if (S.world !== 3) {\n      if (S.partner >= 3', '      if (S.world !== 3 && !globalThis.__coreOnly) {\n      if (S.partner >= 3')
    src = patch(src, 'if ((session > 40 || S.world === 2) && S.world !== 3 && !moon', 'if (!globalThis.__coreOnly && (session > 40 || S.world === 2) && S.world !== 3 && !moon')
    src = patch(src, 'if (S.senzu > 0 && !bean', 'if (!globalThis.__coreOnly && S.senzu > 0 && !bean')
  }
  ctx.__coreOnly = coreOnly; ctx.__skip = true
  vm.runInContext(src + '\n;globalThis.__G = GAMES; globalThis.__makeStage = makeStage;', ctx)
  const ui = new Proxy({}, { get: (_, k) => k === 'event' ? (s => events.push([T, s])) : k === 'onBuy' ? (f => { ctx.BUY = f }) : k === 'confirm' ? ((a, f) => f && f()) : noop })
  const st = ctx.__makeStage({ querySelector: () => el }); st.resize()
  const game = ctx.__G.find(g => g.id === 'planet').mount(st, ui); game.start()
  const ev = s => ctx.__ev(s)
  const runPending = () => { pending.sort((a, b) => a[0] - b[0]); while (pending.length && pending[0][0] <= T) { const [, f] = pending.shift(); f() } }
  const step = (dt = 1 / 30) => { T += dt; st.t = T; game.frame(T, dt); runPending() }
  return { game, ev, step, buy: k => ctx.BUY(k), train: () => game.train(), events, errors, sites, get draws() { return draws }, get T() { return T } }
}
