// Headless JS planet game for differential testing against planet-core.
// Loads world.js + shenron.js + game.js from the repo root into a vm with a seeded Math.random (the same LCG planet-core uses),
// switches off the timeline systems named in `off` (the ones planet-core doesn't have yet), and never draws.
const fs = require('fs'), vm = require('vm'), path = require('path')
const ROOT = path.join(__dirname, '..', '..')

// the timeline's spawn points, by system. Each is an anchored `if (` that a gate prefixes with `!off.has(system) &&`
const GATES = {
  pods: 'if (session > 12) { if (!star', orbs: 'if (session > 30 && orbs.length < 3', meteors: 'if (session > 50) { if ((nextShower', greg: 'if (!greg && session > 60',
  roshi: 'if (!roshi && S.world !== 6', krillin: 'if (!kril && !S.krillinDead', kai: 'if (!kai && session > 45', androids: 'if (!ginyu && !tour && !boss && !shen && S.world !== 8',
  date: 'if (!date && session > 160', gero: 'if (!gero && session > 140', a16: 'if (!a16 && session > 100', ship: 'if (!ship && session > 150', yamcha: 'if (!yam && session > 100',
  dance: 'if (!dance && !(fused', cling: 'if (!cling && session > 150', car: 'if (!car && carRoad', door: 'if (S.chamber > 0 && !door',
  ginyu: 'if (!ginyu && !tour && !boss && !shen && session > 150', saiba: 'if (!tour && session > 80 && (nextSaiba', trips: 'if (S.world === home() && (S.runBest >=',
  fuse: 'if (S.partner >= 3 && S.best >= 50000', tour: 'if (!tour && !shen && !boss && S.world === home() && session > 75', movie: 'if (!movie && S.world === home()',
  multi: 'if (!S.multi && (S.saga >= VILLAINS.length', saga: 'if (!tour && session > 110 && !boss && !shen && (S.multi ?', uni: 'if (!tour && session > 110 && !boss && !shen && S.multi && (nextBoss',
  storm: 'if (!storm && session > 120', moon: 'if ((session > 40 || S.world === 2) && S.world !== 3 && !moon', bean: 'if (S.senzu > 0 && !bean', zeno: 'if (!zen && zenoReady()',
}
// the one spawn condition that isn't a plain && chain
const GATE_TO = { nimbus: ['if (session > 75 || S.cloud > 0) {', "if (!globalThis.__off.has('nimbus') && (session > 75 || S.cloud > 0)) {"] }
const SYSTEMS = [...Object.keys(GATES), ...Object.keys(GATE_TO)]

function patch(src, from, to) { if (!src.includes(from)) throw new Error('harness anchor missing: ' + from.slice(0, 60)); return src.replace(from, to) }

function mount({ seed = 1, W = 600, H = 400, off = [], traceRng = false } = {}) {
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
  const ctx = { WIDGET: false, document: doc, addEventListener: (k, f) => { win[k] = f }, location: { hash: '', hostname: 'localhost', protocol: 'http:' }, localStorage: { getItem: () => null, setItem: noop, removeItem: noop }, setTimeout: (f, ms = 0) => pending.push([T + ms / 1000, f]), clearTimeout: noop, console, Math: M, Date, JSON, performance: { now: () => T * 1000 } }
  ctx.window = ctx; vm.createContext(ctx)
  let src = ['world.js', 'shenron.js', 'game.js'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n')
  src = patch(src, '    return { menu, learn, respec,', '    globalThis.__ev = s => eval(s);\n    return { menu, learn, respec,')
  src = patch(src, 'st.clear(); zb.fill(-1e9); ib.fill(0);', 'if (globalThis.__skip) return; st.clear(); zb.fill(-1e9); ib.fill(0);')
  for (const k of off) {
    if (GATE_TO[k]) { src = patch(src, ...GATE_TO[k]); continue }
    const g = GATES[k]; if (!g) throw new Error('no gate ' + k)
    src = patch(src, g, `if (!globalThis.__off.has('${k}') && ` + g.slice(4))
  }
  ctx.__off = new Set(off); ctx.__skip = true
  vm.runInContext(src + '\n;globalThis.__G = GAMES; globalThis.__makeStage = makeStage;', ctx)
  const ui = new Proxy({}, { get: (_, k) => k === 'event' ? (s => events.push([T, s])) : k === 'onBuy' ? (f => { ctx.BUY = f }) : k === 'confirm' ? ((a, f) => f && f()) : k === 'wish' ? ((offer, pick) => { wish = { offer, pick } }) : noop })
  const st = ctx.__makeStage({ querySelector: () => el }); st.resize()
  const game = ctx.__G.find(g => g.id === 'planet').mount(st, ui); game.start()
  const ev = s => ctx.__ev(s)
  const runPending = () => { pending.sort((a, b) => a[0] - b[0]); while (pending.length && pending[0][0] <= T) { const [, f] = pending.shift(); f() } }
  const step = (dt = 1 / 30) => { T += dt; st.t = T; game.frame(T, dt); runPending() }
  return { game, ev, step, buy: k => ctx.BUY(k), train: () => game.train(), offer: () => wish.offer, pick: k => wish.pick(k), events, errors, sites, get draws() { return draws }, get T() { return T } }
}
mount.SYSTEMS = SYSTEMS
module.exports = mount
