// Runs one scenario on the headless JS game and prints a JSON trace: the inputs it applied (frame by frame) and a
// state sample every simulated second. planet-core's difftest replays the inputs and compares its samples to these.
// Usage: node rust/difftest/run.js <scenario>      (scenarios below; `fmt` prints number-formatting cases instead)
const fs = require('fs'), path = require('path')
const mount = require('./harness')


const DT = 1 / 30
const POLICY = ['boots', 'partner', 'gravity', 'scouter', 'house', 'piccolo', 'cloud', 'armor', 'kaio', 'galick', 'senzu', 'chamber', 'bigbang']
const LEVELS = ['boots', 'partner', 'gravity', 'cloud', 'scouter', 'galick', 'senzu', 'house', 'armor', 'kaio', 'bigbang', 'piccolo', 'chamber', 'tail']

// each scenario: seed, minutes, and a per-frame script (g: the game, f: frame index, act: records + applies an input)
const SCENARIOS = {
  // a long active run with the timeline on: it taps whatever game.js can hit-test headless (space pods, meteors, the moon,
  // dr. gero) and buys tail training, so the great ape, androids, the fusion dance and the movie villains all turn up
  events: {
    seed: 21, minutes: 45,
    script(g, f, act) {
      if (f % 300 < 180 && f % 5 === 0) act({ a: 'train' })
      if (f % 3 === 0) clickTargets(g, act)
      if (f % 30 === 0) { buyAll(g, act, [...POLICY, 'tail']); if (g.ev('S.kaio > 0 && st.t >= kaioReady')) act({ a: 'kaio' }) }
    },
  },
  // ultra instinct opens the multiverse: universe fights, then god ki (a second reset brings zeno) and the zeno erase
  multiverse: {
    seed: 5, minutes: 14,
    script(g, f, act) {
      if (f === 0) for (const [k, v] of [['pl', 5e19], ['best', 5e19], ['gravity', 60], ['wishes', 12], ['ascend', 400], ['seeds', 30], ['house', 40], ['partner', 60], ['piccolo', 25], ['boots', 70], ['scouter', 4], ['kaio', 3], ['galick', 5], ['armor', 12], ['gods', 1], ['zeno', 1], ['godTotal', 3], ['ustars', 2]]) act({ a: 'set', k, v })
      if (f % 4 === 0 && f % 600 < 400) act({ a: 'train' })
      if (f % 3 === 0) clickTargets(g, act)
      if (f % 30 === 0 && f >= 60) { buyAll(g, act); if (g.ev('S.kaio > 0 && st.t >= kaioReady')) act({ a: 'kaio' }) }
      if (f === 30 * 330) { act({ a: 'set', k: 'uni', v: Math.max(1, g.ev('S.uni')) }); act({ a: 'set', k: 'pl', v: 3e14 }) }
      if (f === 30 * 331) act({ a: 'buy', k: 'godki' })
      if (f === 30 * 420) act({ a: 'buy', k: 'zeno' })
    },
  },
  // the dragon over and over: shenron at home, porunga on namek, krillin to wish back, picks by hand and the 20s auto-pick
  wishes: {
    seed: 9, minutes: 16,
    script(g, f, act) {
      if (f === 0) for (const [k, v] of [['pl', 6e4], ['best', 6e4], ['partner', 6], ['scouter', 3], ['kaio', 1], ['tail', 3], ['house', 2], ['krillinDead', 1]]) act({ a: 'set', k, v })
      if (f % 6 === 0 && f % 600 < 300) act({ a: 'train' })
      if (f % 3 === 0) clickTargets(g, act)
      if (f % 30 === 0) { buyAll(g, act, [...POLICY, 'tail']); if (g.ev('S.kaio > 0 && st.t >= kaioReady')) act({ a: 'kaio' }) }
      if (f % (30 * 50) === 30 * 25) act({ a: 'summon' })
      // every other offer is picked by hand (its last wish), the rest wait out the 20s auto-pick
      if (g.ev("!!shen && shen.phase === 'wish' && st.t - shen.phaseT > 3 && st.t - shen.phaseT < 3.04") && g.ev("S.granted % 2 === 0")) { const o = g.offer(); act({ a: 'pick', k: o[o.length - 1].key }) }
    },
  },
  // beams and the big bang at whatever is up (a villain, the ginyu force, meteors), with and without kaioken and the great ape;
  // kaioken and the moon wait for a target, so the buffs land on villains
  attacks: {
    seed: 13, minutes: 14,
    script(g, f, act) {
      if (f === 0) for (const [k, v] of [['pl', 4e5], ['best', 4e5], ['partner', 30], ['house', 15], ['piccolo', 5], ['boots', 4], ['scouter', 3], ['kaio', 3], ['galick', 5], ['bigbang', 1], ['zeno', 1], ['world', 2]]) act({ a: 'set', k, v })
      const p = g.ev(`boss && !boss.dead ? [boss.x, boss.y - boss.spr.h / 2 * boss.k] : ginyu && !ginyu.done ? (m => m && [m.x, m.y - m.spr.h / 2 * m.k])(ginyu.members.find(m => !m.dead)) : null`)
      if (f % 6 === 0 && f % 600 < 300) act({ a: 'train' })
      if (f % 3 === 0 && (p || !g.ev('!!moon'))) clickTargets(g, act)
      if (f % 30 === 0 && p && g.ev('S.kaio > 0 && st.t >= kaioReady')) act({ a: 'kaio' })
      const [x, y] = p || [300, 60]
      if (f % 30 === 0) act({ a: 'beam', c: f % 300 ? .3 : 2.5, x, y })
      if (f % 200 === 50) act({ a: 'bang', x, y })
    },
  },
  // the same against the multiverse's walls, where a buff adds at most a quarter of a wall a hit
  walls: {
    seed: 17, minutes: 8,
    script(g, f, act) {
      if (f === 0) for (const [k, v] of [['pl', 5e20], ['best', 5e20], ['gravity', 60], ['wishes', 12], ['ascend', 400], ['seeds', 30], ['multi', 1], ['multiT', 0], ['world', 9], ['uniBest', 2], ['ustars', 3], ['godTotal', 2], ['zeno', 1], ['house', 40], ['partner', 60], ['piccolo', 25], ['boots', 70], ['scouter', 4], ['kaio', 8], ['galick', 20], ['bigbang', 3]]) act({ a: 'set', k, v })
      const p = g.ev('boss && !boss.dead ? [boss.x, boss.y - boss.spr.h / 2 * boss.k] : null')
      if (f % 5 === 0 && f % 600 < 300) act({ a: 'train' })
      if (f % 3 === 0 && (p || !g.ev('!!moon'))) clickTargets(g, act)
      if (f % 30 === 0 && p && g.ev('st.t >= kaioReady')) act({ a: 'kaio' })
      const [x, y] = p || [300, 60]
      if (f % 30 === 0) act({ a: 'beam', c: f % 300 ? .3 : 2.5, x, y })
      if (f % 200 === 50) act({ a: 'bang', x, y })
    },
  },
  idle: { seed: 1, minutes: 20, script(g, f, act) { if (f % 30 === 0) buyAll(g, act) } },
  active: {
    seed: 7, minutes: 20,
    script(g, f, act) {
      if (f % 300 < 150 && f % 6 === 0) act({ a: 'train' })
      if (f % 30 === 0) { buyAll(g, act); if (g.ev('S.kaio > 0 && st.t >= kaioReady')) act({ a: 'kaio' }) }
    },
  },
  ascend: {
    seed: 3, minutes: 12,
    script(g, f, act) {
      if (f === 0) { act({ a: 'set', k: 'pl', v: 3e6 }); act({ a: 'set', k: 'best', v: 3e6 }) }
      if (f % 4 === 0 && f % 900 < 450) act({ a: 'train' })
      if (f === 30 * 150) act({ a: 'buy', k: 'ascend' })
      if (f > 30 * 150 && f % 30 === 1) for (const id of ['fist', 'crit', 'idle', 'legs', 'stride', 'auto', 'critx', 'seedx', 'deal', 'head']) act({ a: 'learn', k: id })
      if (f % 30 === 0 && f > 30 * 150 && f < 30 * 590) buyAll(g, act)
      if (f === 30 * 590) act({ a: 'set', k: 'pl', v: 5e7 })
      if (f === 30 * 600) act({ a: 'buy', k: 'ascend' })
    },
  },
  late: {
    seed: 11, minutes: 8,
    script(g, f, act) {
      if (f === 0) for (const [k, v] of [['pl', 5e20], ['best', 5e20], ['gravity', 60], ['wishes', 12], ['ascend', 400], ['seeds', 30], ['multi', 1], ['multiT', 0], ['world', 9], ['uniBest', 2], ['ustars', 3], ['godTotal', 2], ['zeno', 1], ['house', 40], ['partner', 60], ['piccolo', 25], ['boots', 70], ['scouter', 4], ['kaio', 3]]) act({ a: 'set', k, v })
      if (f % 5 === 0 && f % 600 < 300) act({ a: 'train' })
      if (f % 30 === 0 && f >= 60) { buyAll(g, act); if (g.ev('S.kaio > 0 && st.t >= kaioReady')) act({ a: 'kaio' }) }
      if (f === 30 * 240) { act({ a: 'set', k: 'angel.auto', v: 1 }); act({ a: 'set', k: 'autoAt', v: 1 }) }
    },
  },
}

// taps the things game.js can hit-test without drawing: the space pod, a falling meteor, the full moon, dr. gero
function clickTargets(g, act) {
  const p = g.ev(`star ? [star.x, star.y] : meteors.find(m => !m.dead && m.delay <= 0 && m.y > 0) ? (m => [m.x, m.y])(meteors.find(m => !m.dead && m.delay <= 0 && m.y > 0))
    : moon && moon.a > .5 && !moon.leaving ? [moon.x, moon.y] : gero && st.t - gero.t0 > 2 ? [gero.x, gero.y - gero.spr.h / 2] : null`)
  if (p) act({ a: 'click', x: p[0], y: p[1] })
}

function buyAll(g, act, policy = POLICY) {
  for (;;) {
    const ok = policy.filter(k => g.ev(`(!SHOP['${k}'].unlock || SHOP['${k}'].unlock()) && S.pl >= cost('${k}')`))
    if (!ok.length) return
    ok.sort((a, b) => g.ev(`cost('${a}')`) - g.ev(`cost('${b}')`))
    act({ a: 'buy', k: ok[0] })
  }
}

function apply(g, i) {
  if (i.a === 'train') g.train()
  else if (i.a === 'buy') g.buy(i.k)
  else if (i.a === 'kaio') g.game.kaioken()
  else if (i.a === 'learn') g.game.learn(i.k)
  else if (i.a === 'set') g.ev(`S.${i.k} = ${JSON.stringify(i.v)}`)
  else if (i.a === 'click') g.ev(`onClick(${i.x}, ${i.y})`)
  else if (i.a === 'summon') g.ev('summon()')
  else if (i.a === 'pick') g.pick(i.k)
  else if (i.a === 'beam') g.ev(`fireBeam(${i.c}, ${i.x}, ${i.y})`)
  else if (i.a === 'bang') g.ev(`explode(${i.x}, ${i.y})`)
  else throw new Error('unknown input ' + i.a)
}

const SAMPLE = `({ t: st.t, session, pl: S.pl, best: S.best, runBest: S.runBest, rate: rate(), wrate: wrate(), mult: mult(), multBare: mult(true),
  laps, lapsTotal: S.lapsTotal || 0, phi, sprint, combo, form: S.form, mastery: S.mastery, seeds: S.seeds, ascend: S.ascend,
  tree: { ...S.tree }, goal: S.goal.id, goalP: S.goal.p, goalsDone: S.goalsDone || 0, orbs7: S.orbs7, cost: Object.fromEntries(${JSON.stringify(LEVELS)}.map(k => [k, cost(k)])),
  levels: Object.fromEntries(${JSON.stringify(LEVELS)}.map(k => [k, S[k]])),
  tl: [['world', S.world], ['saga', S.saga], ['uni', S.uni], ['uniStage', S.uniStage], ['ustars', S.ustars], ['multi', +!!S.multi], ['granted', S.granted], ['wishes', S.wishes],
    ['bosses', S.bosses || 0], ['trips', S.trips || 0], ['tourBest', S.tourBest || 0], ['stars', S.stars || 0], ['krillinDead', +!!S.krillinDead], ['geros', S.geros || 0], ['movies', S.movies || 0],
    ['boss', boss ? boss.hp : null], ['bossDead', boss ? +!!boss.dead : null], ['ginyu', ginyu ? ginyu.members.reduce((a, m) => a + Math.max(0, m.hp), 0) : null],
    ['shen', shen ? ['rise', 'wish', 'granting', 'leave'].indexOf(shen.phase) : null], ['orbs', orbs.length], ['meteors', meteors.length], ['saibas', saibas.length], ['kis', kis.length],
    ['star', star ? star.x : null], ['cloud', cloudFly ? cloudFly.x : null], ['moon', moon ? moon.a : null], ['apeUntil', apeUntil], ['riding', riding], ['tour', tour ? tour.ko : null],
    ['movie', movie ? movie.boss.hp : null], ['storm', storm ? storm.hit : null], ['snake', snk ? snk.p : null], ['greg', greg ? greg.c[0] : null], ['gero', gero ? gero.x : null], ['dance', dance ? dance.hits : null],
    ['struggle', struggle ? struggle.p : null], ['m0', M[0]], ['m2', M[2]], ['bob', st.bob], ['namekUntil', namekUntil], ['nextBoss', nextBoss], ['fused', fused ? fused.x : null], ['preview', preview ? preview.until : null], ['jumpH', jumpH]] })`

function run(name) {
  const sc = SCENARIOS[name]; if (!sc) throw new Error('no scenario ' + name)
  const g = mount({ seed: sc.seed })
  const frames = Math.round(sc.minutes * 60 / DT), inputs = [], samples = []
  for (let f = 0; f < frames; f++) {
    sc.script(g, f, i => { inputs.push({ f, ...i }); apply(g, i) })
    g.step(DT)
    if ((f + 1) % 30 === 0) samples.push({ f, draws: g.draws, ...g.ev(SAMPLE) })
  }
  if (g.errors.length) throw new Error(g.errors.join('\n'))
  return { name, seed: sc.seed, dt: DT, frames, inputs, samples, events: g.events.map(([t, e]) => [+t.toFixed(2), e]) }
}

// number formatting: the game's fmtShort, and the HUD's big/short from page.html
function fmtCases() {
  const g = mount({ seed: 1 })
  const page = fs.readFileSync(path.join(__dirname, '..', '..', 'page.html'), 'utf8')
  const grab = re => { const m = page.match(re); if (!m) throw new Error('page.html anchor ' + re); return m[0] }
  const hud = new Function(grab(/const SUF = \[.*\];/) + '\n' + grab(/const big = n => .*/) + '\n' + grab(/const fmt = n => .*/) + '\n' + grab(/const short = n => .*/) + '\nreturn { fmt, short };')()
  const ns = [0, 1, 7, 42, 999, 1000, 9999, 10000, 12345, 99949, 99950, 99999, 123456, 999499, 999500, 999999, 1e6, 1234567, 9995000, 99950000,
    999999999, 1e9, 1.5e9, 9.995e9, 1e12, 3.21e15, 1e18, 4.56e21, 7.89e24, 1e27, 2.5e30, 9.99e32, 1e33, 1e35, 1e36, 4.2e40, 1.7976931348623157e308]
  for (let k = 0; k < 200; k++) ns.push(Math.floor(Math.exp(k * 0.35)) + k)
  return ns.map(n => ({ n, short: g.ev(`fmtShort(${n})`), fmt: hud.fmt(n), shop: hud.short(n) }))
}

const which = process.argv[2]
process.stdout.write(JSON.stringify(which === 'fmt' ? fmtCases() : run(which)))
