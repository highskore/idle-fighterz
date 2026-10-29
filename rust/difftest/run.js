// Runs one scenario on the headless JS game and prints a JSON trace: the inputs it applied (frame by frame) and a
// state sample every simulated second. planet-core's difftest replays the inputs and compares its samples to these.
// Usage: node rust/difftest/run.js <scenario>      (scenarios below; `fmt` prints number-formatting cases instead)
const fs = require('fs'), path = require('path')
const mount = require('./harness')


const DT = 1 / 30
const POLICY = ['boots', 'partner', 'gravity', 'scouter', 'house', 'piccolo', 'cloud', 'armor', 'kaio', 'galick', 'senzu', 'chamber', 'bigbang']
const LEVELS = ['boots', 'partner', 'gravity', 'cloud', 'scouter', 'galick', 'senzu', 'house', 'armor', 'kaio', 'bigbang', 'piccolo', 'chamber', 'tail', 'itx']

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
      // the characters tab (goku opens with super saiyan, gohan stays locked) and the angels' tab after the god ki
      if (f === 30 * 40) { act({ a: 'hero', k: 'gohan' }); act({ a: 'hero', k: 'goku' }) }
      if (f === 30 * 200) act({ a: 'hero', k: 'vegeta' })
      if (f === 30 * 332) { act({ a: 'angel', k: 'auto' }); act({ a: 'angel', k: 'divine' }); act({ a: 'auto' }); act({ a: 'auto' }) }
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
  // eight minutes that tap whatever is up: drawn, that's the visitors, saibamen, the boss and the ginyu force too
  taps: {
    seed: 13, minutes: 8,
    script(g, f, act) {
      if (f === 0) for (const [k, v] of [['pl', 3e4], ['best', 3e4], ['partner', 4], ['piccolo', 1], ['galick', 1]]) act({ a: 'set', k, v })
      if (f % 6 === 0 && f % 300 < 150) act({ a: 'train' })
      if (f % 3 === 0) clickTargets(g, act)
      if (f % 30 === 0) buyAll(g, act)
    },
  },
  // kami's lookout turns only round korin's tower; back home, a vertical drag tilts the planet again
  lookout: {
    seed: 23, minutes: 2,
    script(g, f, act) {
      const pole = () => g.ev('(a => Math.hypot(a[0] - N[0], a[1] - N[1], a[2] - N[2]))(M3.ap(M, N))'), fail = m => { throw new Error('lookout: ' + m) }
      if (f === 0) for (const [k, v] of [['pl', 5e6], ['best', 5e6], ['trips', 8]]) act({ a: 'set', k, v })
      // on the lookout: a sideways drag turns it round the tower, a vertical one does nothing
      if (f === 30 * 20) press(g, act, 'down', 300, 300)
      if (f > 30 * 20 && f <= 30 * 20 + 10) press(g, act, 'move', 300 + 15 * (f - 30 * 20), 300 + 10 * (f - 30 * 20))
      if (f === 30 * 20 + 11) press(g, act, 'up', 450, 400)
      if (f === 30 * 40 && !(g.ev('S.world') === 10 && pole() < 1e-9 && g.ev('vrx') === 0)) fail('it tilted')
      // home again: the idle spin keeps the screen's up row, and a vertical drag tilts it
      if (f === 30 * 60) this.m4 = g.ev('M[4]')
      if (f === 30 * 69 && !(g.ev('S.world') === 0 && Math.abs(g.ev('M[4]') - this.m4) < 1e-9)) fail('home still turns round the pole')
      if (f === 30 * 70) press(g, act, 'down', 300, 200)
      if (f > 30 * 70 && f <= 30 * 70 + 10) press(g, act, 'move', 300, 200 + 15 * (f - 30 * 70))
      if (f === 30 * 70 + 11) press(g, act, 'up', 300, 350)
      if (f === 30 * 72 && !(Math.abs(g.ev('M[4]') - this.m4) > .05 && pole() > .05)) fail('a vertical drag at home did not tilt it')
    },
  },
  // instant transmission: 30M of power and no unlock until the first trip reaches yardrat (a right-click before then is
  // a tap); then it's bought and every second a gesture is tried (a two-thumb tap, a right-click, two thumbs too far
  // apart in time, two thumbs with one sliding) and a jump picked from the last picker, home or away, in a fight or not.
  // It checks that jumps land and leave the natural trips alone, the cooldown at lv 1 and its 90s floor at lv 40, the
  // refusals, that a natural trip due during a jump waits 84s at home, and that two thumbs in a struggle stay taps
  itx: {
    seed: 13, minutes: 20,
    script(g, f, act) {
      const fail = m => { throw new Error('itx: ' + m) }, k = this.k || (this.k = { jumps: 0, end1: 0, end40: 0, away: 0, fight: 0, opened: 0, clicked: 0, slid: 0, sloppy: 0, struggle: 0, deferred: 0, back: -1e9, trip: 0, trips: 0 })
      const cd = lv => Math.max(90, 300 / (1 + .1 * (lv - 1))), FLOOR = 120 * .7
      const picks = () => g.cues.filter(c => c[1] === 'itxPick').length, itxToasts = () => g.events.filter(e => /^instant transmission/.test(e[1])).length
      const thumbs = (x, y) => { press(g, act, 'down', x - 6, y, { id: 2, touch: true }); press(g, act, 'down', x + 6, y, { id: 3, touch: true }); press(g, act, 'up', x - 6, y, { id: 2 }); press(g, act, 'up', x + 6, y, { id: 3 }) }
      // what the last step did: a jumped trip home starts the cooldown, exactly; a natural trip leaves 84s after one
      const trip = g.ev('+itxTrip'), trips = g.ev('S.trips')
      if (k.trip && !trip) {
        const lv = g.ev('S.itx'), late = g.ev('st.t + ' + cd(lv)), due = g.ev('session - homeSince > TRIP_WAIT * soon() || S.runBest >= (S.namekAt || PLANET_EVERY)')
        if (g.ev('itxReady') !== late) fail(`cooldown at lv ${lv}: ${g.ev('itxReady - st.t')}s, not ${cd(lv)}s`)
        if (g.ev('homeSince') !== k.hs || g.ev('S.namekAt') !== k.na) fail('a jump moved the natural trips\' timer or power mark')
        if (lv === 1) k.end1++; if (lv === 40) k.end40++; if (due) k.deferred++
        k.back = g.ev('session')
      }
      if (trips !== k.trips && f > 30 * 12) { if (g.ev('session') - k.back < FLOOR) fail(`a natural trip ${g.ev('session') - k.back}s after a jump`) }
      k.trip = trip; k.trips = trips
      if (f === 0) { for (const [k, v] of [['pl', 3e7], ['best', 3e7], ['trips', 10]]) act({ a: 'set', k, v }); if (g.ev("SHOP.itx.unlock()")) fail('open before yardrat') }
      if (f === 30 * 3) { const b = g.cues.length; press(g, act, 'down', 300, 300, { button: 2 }); press(g, act, 'up', 300, 300); if (picks() || itxToasts() || !g.cues.slice(b).some(c => c[1] === 'bump')) fail('a right-click before instant transmission was not a tap') }
      if (f === 30 * 10 && !(g.ev('S.world') === 12 && g.ev("SHOP.itx.unlock()"))) fail('yardrat did not open it')
      if (f === 30 * 10) act({ a: 'buy', k: 'itx' })
      if (f === 30 * 600) act({ a: 'set', k: 'itx', v: 40 })
      if (f % 300 < 150 && f % 6 === 0) act({ a: 'train' })
      if (f % 3 === 0) clickTargets(g, act)
      if (f % 30 === 0 && f > 30 * 10) { buyAll(g, act, POLICY); if (g.ev('S.kaio > 0 && st.t >= kaioReady')) act({ a: 'kaio' }) }
      if (g.ev('S.itx > 0')) {
        // may: what itxCan() should say, written out here so a broken itxCan can't vouch for itself
        const n = f / 30 | 0, p = f % 30, n0 = picks(), t0 = itxToasts(), sp = g.ev('struggle ? struggle.p : null')
        const may = g.ev('playing && st.t >= itxReady && S.world === home() && !tour && !shen && !boss && !dance && !struggle && !(ginyu && !ginyu.done) && !movie')
        if (p === 15) k.step = may ? (k.step || 0) + 1 : 0
        const step = k.step || 0, hold = f >= 30 * 700 && f < 30 * 880   // a while without jumping, so fights find it recharged
        if (p === 15 && !may && !g.ev('S.world === 3 && !!snk')) {   // snake way takes every press itself
          if (n % 2) { thumbs(300, 300); if (picks() !== n0 || itxToasts() !== t0) fail('a two-thumb tap that can\'t go opened or said something') }
          else { press(g, act, 'down', 300, 300, { button: 2 }); press(g, act, 'up', 300, 300); if (picks() !== n0 || itxToasts() !== t0 + 1) fail('a right-click that can\'t go opened or said nothing') }
          if (n % 2 && sp !== null) { if (!(g.ev('struggle.p') > sp)) fail('two thumbs in a beam struggle were not taps'); k.struggle++ }
        }
        // ready: first one thumb slides, then the second lands 0.2s late, then a real two-thumb tap (or a right-click) opens it
        if (step === 1 && p === 15) { press(g, act, 'down', 294, 300, { id: 2, touch: true }); press(g, act, 'down', 306, 300, { id: 3, touch: true }); k.slid++ }
        if (step === 1 && p === 16) press(g, act, 'move', 294, 312, { id: 2 })
        if (step === 1 && p === 17) { press(g, act, 'up', 294, 312, { id: 2 }); press(g, act, 'up', 306, 300, { id: 3 }) }
        if (step === 2 && p === 15) { press(g, act, 'down', 294, 300, { id: 2, touch: true }); k.sloppy++ }
        if (step === 2 && p === 21) press(g, act, 'down', 306, 300, { id: 3, touch: true })
        if (step === 2 && p === 22) { press(g, act, 'up', 294, 300, { id: 2 }); press(g, act, 'up', 306, 300, { id: 3 }) }
        if ((step === 1 || step === 2) && p >= 15 && p <= 22 && picks() !== n0) fail('two thumbs that weren\'t a two-finger tap opened the picker')
        if (step >= 3 && p === 15 && !hold) {
          if (k.jumps % 2) { press(g, act, 'down', 300, 300, { button: 2 }); press(g, act, 'up', 300, 300) } else thumbs(300, 300)
          if (picks() !== n0 + 1) fail(`a ${k.jumps % 2 ? 'right-click' : 'two-thumb tap'} at home did not open the picker`)
          k[k.jumps % 2 ? 'clicked' : 'opened']++
        }
        // a jump from the last picker: right after it opens, and every second from a stale one, wherever we are
        if (p === 15 && g.itx && (step >= 3 && !hold || !may)) {
          const ws = g.itx.worlds.map(w => w.key), w = ws[(n / 7 | 0) % ws.length], home = g.ev('S.world === home()'), was = g.ev('S.world')
          act({ a: 'jump', k: w })
          if (may) { k.hs = g.ev('homeSince'); k.na = g.ev('S.namekAt'); if (g.ev('S.world') !== w || g.ev('S.trips') !== trips || !g.ev('itxTrip')) fail('a jump did not land, or counted as a natural trip'); k.jumps++; k.trip = 1 }
          else { if (g.ev('S.world') !== was) fail('jumped when it could not'); if (itxToasts() === t0) fail('a refused jump said nothing'); if (!home) k.away++; else if (g.ev('st.t >= itxReady')) k.fight++ }
        }
      }
      if (f === 30 * 60 * 20 - 1) {
        const want = { jumps: 4, end1: 1, end40: 2, away: 1, fight: 1, opened: 2, clicked: 2, slid: 4, sloppy: 4, struggle: 1, deferred: 1 }
        for (const [key, n] of Object.entries(want)) if (k[key] < n) fail(`only ${k[key]} ${key} (want ${n}): ${JSON.stringify(k)}`)
        console.error('itx: ' + JSON.stringify(k))
      }
    },
  },
  // pointer attacks (see attack()) at whatever is up (a villain, the ginyu force), with and without kaioken and the great ape;
  // kaioken and the moon wait for a target, so the buffs land on villains
  attacks: {
    seed: 3, minutes: 14,
    script(g, f, act) {
      if (f === 0) for (const [k, v] of [['pl', 4e5], ['best', 4e5], ['partner', 30], ['house', 15], ['piccolo', 5], ['boots', 4], ['scouter', 3], ['kaio', 3], ['galick', 5], ['bigbang', 1], ['zeno', 1], ['world', 2]]) act({ a: 'set', k, v })
      const p = g.ev(`boss && !boss.dead ? [boss.x, boss.y - boss.spr.h / 2 * boss.k] : ginyu && !ginyu.done ? (m => m && [m.x, m.y - m.spr.h / 2 * m.k])(ginyu.members.find(m => !m.dead)) : null`)
      if (f % 6 === 0 && f % 600 < 300) act({ a: 'train' })
      if (f % 3 === 0 && (p || !g.ev('!!moon'))) clickTargets(g, act)
      if (f % 30 === 0 && p && g.ev('S.kaio > 0 && st.t >= kaioReady')) act({ a: 'kaio' })
      attack(g, act, f, ...(p || [300, 60]))
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
      attack(g, act, f, ...(p || [300, 60]))
    },
  },
  // the pointer and the keyboard: drags that spin the planet and coast, held presses that charge and fire beams (full ones
  // at beam lv 5 are final flashes), double taps that throw big bangs, single taps, cancels, and space to train; aimed at
  // whatever is up (bosses, the ginyu force and the androids sit at (0, 0) headless, where game.js leaves them undrawn)
  input: {
    seed: 13, minutes: 15,
    script(g, f, act) {
      if (f === 0) for (const [k, v] of [['pl', 4e6], ['best', 4e6], ['galick', 5], ['bigbang', 3], ['scouter', 3], ['kaio', 1], ['partner', 10], ['house', 5], ['boots', 20]]) act({ a: 'set', k, v })
      const p = f % 300, [tx, ty] = target(g)
      if (p < 60 && f % 8 === 0) act({ a: 'key', k: ' ' })
      if (p === 60) press(g, act, 'down', 900, 600)
      if (p > 60 && p < 67) press(g, act, 'move', 900 + 12 * (p - 60), 600 + 4 * (p - 60))
      if (p === 67) press(g, act, 'up', 972, 624)
      if (p === 100) press(g, act, 'down', tx * 3, ty * 3)
      if (p === 130) press(g, act, 'move', tx * 3 + 1, ty * 3)
      if (p === 150) press(g, act, 'move', tx * 3 + 20, ty * 3 - 9)
      if (p === 185) press(g, act, 'up', tx * 3, ty * 3)
      if (p === 200) press(g, act, 'down', tx * 3, ty * 3)
      if (p === 215) press(g, act, 'up', tx * 3, ty * 3)
      if (p === 240 || p === 243) { press(g, act, 'down', tx * 3 + (p - 240), ty * 3); press(g, act, 'up', tx * 3 + (p - 240), ty * 3) }
      if (p === 280) { press(g, act, 'down', 450, 300); press(g, act, 'up', 450, 300) }
      if (f % 600 === 290) press(g, act, 'down', 300, 300)
      if (f % 600 === 291) act({ a: 'cancel' })
      if (f % 30 === 0) { buyAll(g, act, [...POLICY, 'tail']); if (g.ev('S.kaio > 0 && st.t >= kaioReady')) act({ a: 'kaio' }) }
      if (f % 3 === 1 && p > 280) clickTargets(g, act)
      // while a fight is on, more of both: a big bang and a short beam at it every two seconds
      if (g.ev('!!(boss && !boss.dead || ginyu && !ginyu.done)')) {
        if (f % 60 === 35 || f % 60 === 38) { press(g, act, 'down', tx * 3, ty * 3); press(g, act, 'up', tx * 3, ty * 3) }
        if (f % 60 === 5) press(g, act, 'down', tx * 3, ty * 3)
        if (f % 60 === 25) press(g, act, 'up', tx * 3, ty * 3)
      }
    },
  },
  // a pod to snake way: presses act on the way down (no drag, charge or double tap), keys hop and dash, and an unhandled key falls through
  snake: {
    seed: 17, minutes: 5,
    script(g, f, act) {
      if (f === 0) for (const [k, v] of [['pl', 2e6], ['best', 2e6], ['trips', 2], ['boots', 10], ['galick', 2], ['bigbang', 1]]) act({ a: 'set', k, v })
      if (f % 10 === 3) { press(g, act, 'down', 300 + (f % 7), 200); press(g, act, 'up', 300 + (f % 7), 200) }
      if (f % 25 === 0) act({ a: 'key', k: [' ', 'arrowup', 'arrowright', 'w', 'd', 'f', 'x'][(f / 25) % 7] })
      if (f % 90 === 45) press(g, act, 'down', 500, 120)
      if (f % 90 === 75) press(g, act, 'up', 500, 120)
      if (f % 30 === 0) buyAll(g, act)
    },
  },
  // a returning player: yesterday's save (the bonus: ×1.25 for five minutes and a dragon ball), training through it
  daily: {
    seed: 4, minutes: 6, saved: JSON.stringify({ pl: 812, best: 9000, boots: 3, daily: 'Tue Oct 27 2026', ach: { lap1: 1793100000000 }, hero: 'vegeta', goal: { id: 'laps', p: 2 } }),
    script(g, f, act) { if (f % 6 === 0 && f % 300 < 200) act({ a: 'train' }); if (f % 30 === 0) buyAll(g, act) },
  },
  // prefers-reduced-motion: the screen doesn't shake, and game.js skips the shake's random draw (kaioken, over 9000,
  // trips and villains all shake it)
  calm: {
    seed: 19, minutes: 8, calm: true,
    script(g, f, act) {
      if (f === 0) for (const [k, v] of [['pl', 2e4], ['best', 2e4], ['kaio', 1], ['galick', 2], ['bigbang', 1], ['partner', 8]]) act({ a: 'set', k, v })
      if (f % 5 === 0 && f % 300 < 200) act({ a: 'train' })
      if (f % 3 === 0) clickTargets(g, act)
      if (f % 30 === 0) { buyAll(g, act); if (g.ev('S.kaio > 0 && st.t >= kaioReady')) act({ a: 'kaio' }) }
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

// taps the things game.js can hit-test without drawing: the space pod, a falling meteor, the full moon, dr. gero; drawn,
// also gregory, king kai, his car, a saibaman, the boss and the ginyu force, the door, a senzu bean, yamcha
let DRAWN = false
const PLACED = `greg && greg.sx !== undefined ? [greg.sx, greg.sy - 4] : kai && kai.sx !== undefined && !kai.laughed ? [kai.sx, kai.sy - 8] : car && car.sx !== undefined ? [car.sx, car.sy - 6]
  : saibas.find(s => !s.dead && s.sx !== undefined) ? (s => [s.sx, s.sy - 5])(saibas.find(s => !s.dead && s.sx !== undefined))
  : boss && !boss.dead && boss.x ? [boss.x, boss.y - boss.spr.h / 2 * boss.k] : ginyu && ginyu.members.find(m => !m.dead && m.x) ? (m => [m.x, m.y - m.spr.h / 2 * m.k])(ginyu.members.find(m => !m.dead && m.x))
  : door && door.sx !== undefined ? [door.sx, door.sy - 8] : bean && bean.sx !== undefined ? [bean.sx, bean.sy - 4] : yam && yam.sx !== undefined ? [yam.sx, yam.sy] : null`
function clickTargets(g, act) {
  if (DRAWN) { const q = g.ev(PLACED); if (q) return act({ a: 'click', x: q[0], y: q[1] }) }
  const p = g.ev(`star ? [star.x, star.y] : meteors.find(m => !m.dead && m.delay <= 0 && m.y > 0) ? (m => [m.x, m.y])(meteors.find(m => !m.dead && m.delay <= 0 && m.y > 0))
    : moon && moon.a > .5 && !moon.leaving ? [moon.x, moon.y] : gero && st.t - gero.t0 > 2 ? [gero.x, gero.y - gero.spr.h / 2] : null`)
  if (p) act({ a: 'click', x: p[0], y: p[1] })
}

// where to aim a beam or a big bang, in buffer pixels: the boss, a ginyu fighter, the space pod, a meteor, or open sky
function target(g) {
  return g.ev(`boss && !boss.dead ? [boss.x, boss.y - boss.spr.h / 2 * boss.k] : ginyu && !ginyu.done ? (m => [m.x, m.y - m.spr.h / 2 * m.k])(ginyu.members.find(m => !m.dead))
    : star ? [star.x, star.y] : meteors.find(m => !m.dead && m.delay <= 0) ? (m => [m.x, m.y])(meteors.find(m => !m.dead && m.delay <= 0)) : [150, 30]`)
}

// every ten seconds at (x, y) buffer pixels: four short beams, a full one and two big bangs (double taps)
function attack(g, act, f, x, y) {
  const p = f % 300, at = a => press(g, act, a, x * 3, y * 3)
  if ([0, 60, 100, 200, 240].includes(p)) at('down')
  if ([18, 78, 190, 218, 258].includes(p)) at('up')
  if (p === 40 || p === 43 || p === 270 || p === 273) { at('down'); at('up') }
}

// a pointer event at (x, y) CSS pixels; the trace carries the buffer pixels st.toBuf maps it to, so the replay needn't know the canvas
function press(g, act, a, x, y, more) { const [bx, by] = g.input.toBuf(x, y); act({ a, x, y, bx, by, ...more }) }

function buyAll(g, act, policy = POLICY) {
  for (;;) {
    const ok = policy.filter(k => g.ev(`(!SHOP['${k}'].unlock || SHOP['${k}'].unlock()) && S.pl >= cost('${k}')`))
    if (!ok.length) return
    ok.sort((a, b) => g.ev(`cost('${a}')`) - g.ev(`cost('${b}')`))
    act({ a: 'buy', k: ok[0] })
  }
}

// what page.html asks the game for: the menu, the angels, the three confirm boxes and the share card (less its pictures)
function menus(g) {
  const card = g.game.card(); delete card.spr; delete card.scene
  return JSON.parse(JSON.stringify({ menu: g.game.menu(), angels: g.game.angels(), ascendInfo: g.game.ascendInfo(), godInfo: g.game.godInfo(), zenoInfo: g.game.zenoInfo(), card }))
}

function apply(g, i) {
  if (i.a === 'train') g.train()
  else if (i.a === 'buy') g.buy(i.k)
  else if (i.a === 'kaio') g.game.kaioken()
  else if (i.a === 'learn') g.game.learn(i.k)
  else if (i.a === 'angel') g.game.learnAngel(i.k)
  else if (i.a === 'auto') g.game.autoNext()
  else if (i.a === 'hero') g.game.pick(i.k)
  // a poked world is where the page opened: game.js's mount hands it to ui.world
  else if (i.a === 'set') { g.ev(`S.${i.k} = ${JSON.stringify(i.v)}`); if (i.k === 'world') g.ev('ui.world(S.world)') }
  else if (i.a === 'click') g.ev(`onClick(${i.x}, ${i.y})`)
  else if (i.a === 'summon') g.ev('summon()')
  else if (i.a === 'pick') g.pick(i.k)
  // a world from the last picker game.js opened (the harness keeps its callback)
  else if (i.a === 'jump') { if (!g.itx || !g.itx.worlds.some(w => w.key === i.k)) throw new Error('no picker with world ' + i.k); g.itx.jump(i.k) }
  else if (i.a === 'down') g.input.down(i.x, i.y, i.id, i.button, i.touch)
  else if (i.a === 'move') g.input.move(i.x, i.y, i.id)
  else if (i.a === 'up') g.input.up(i.x, i.y, i.id)
  else if (i.a === 'cancel') g.input.cancel()
  else if (i.a === 'key') g.input.key(i.k)
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
    ['struggle', struggle ? struggle.p : null], ['m0', M[0]], ['m2', M[2]], ['bob', st.bob], ['namekUntil', namekUntil], ['nextBoss', nextBoss], ['fused', fused ? fused.x : null], ['preview', preview ? preview.until : null], ['jumpH', jumpH],
    ['charging', charging], ['dragged', drag ? drag.moved : null], ['vrx', vrx], ['vry', vry], ['m4', M[4]], ['beam', beam ? beam.c : null], ['beamDx', beam ? beam.dx : null],
    ['bang', bang ? bang.x1 : null], ['bangReady', bangReady], ['lastTap', lastTap.t], ['daily', dailyUntil], ['pole', (a => Math.hypot(a[0] - N[0], a[1] - N[1], a[2] - N[2]))(M3.ap(M, N))], ['itxReady', itxReady], ['itxTrip', +itxTrip], ['itxBack', isFinite(itxBack) ? itxBack : null], ['two', two ? two.moved[0] + two.moved[1] + (two.lift ? 100 : 0) : null], ['been', S.been], ['nextStar', nextStar], ['nextCloud', nextCloud],
    ['floats', floats.length], ['floatXY', floats.reduce((a, f) => a + f.x * 3 + f.y, 0)], ['floatLife', floats.reduce((a, f) => a + f.life, 0)],
    ['floatS', floats.length ? [...floats[floats.length - 1].s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0) : null],
    ['floatTone', floats.length ? (f => f.red ? 2 : f.gold ? 1 : 0)(floats[floats.length - 1]) : null], ['sceneryHouse', __sceneryHouse]] })`

// name+draw: game.js draws every frame (planet-render's drawn difftest), so the screen spots it writes while drawing are
// set, and the script also taps what only the drawing places (the visitors, the boss, the ginyu force)
function run(name) {
  const drawn = name.endsWith('+draw'), base = drawn ? name.slice(0, -5) : name
  const sc = SCENARIOS[base]; if (!sc) throw new Error('no scenario ' + name)
  const g = mount({ seed: sc.seed, saved: sc.saved, calm: !!sc.calm })
  // drawn, a hash of every frame game.js draws (FNV-1a over its pixels), for planet-render to match
  const hashes = [], fnv = b => { let h = 0x811c9dc5; for (let k = 0; k < b.length; k++) h = Math.imul(h ^ b[k], 16777619) >>> 0; return h }
  if (drawn) { g.ctx.__skip = false; g.ctx.BARE = false; DRAWN = true }
  const frames = Math.round(sc.minutes * 60 / DT); const inputs = [], samples = []
  for (let f = 0; f < frames; f++) {
    sc.script(g, f, i => { inputs.push({ f, ...i }); apply(g, i) })
    g.step(DT)
    if (drawn) hashes.push(fnv(g.ev('st.buf')))
    // every tenth second also the save, as JSON.stringify(S) writes it to localStorage
    // and the HUD: what ui.update and ui.shop last got, every second; the menus and confirm boxes every tenth
    if ((f + 1) % 30 === 0) samples.push({ f, draws: g.draws, ...g.ev(SAMPLE), hud: g.update, side: g.side, shop: g.shop, offer: g.ev("!!shen && shen.phase === 'wish'") ? g.offer() : null, ...((f + 1) % 300 === 0 ? { save: JSON.parse(g.ev('JSON.stringify(S)')), menus: menus(g) } : {}) })
  }
  if (g.errors.length) throw new Error(g.errors.join('\n'))
  const kept = t => t <= frames * DT + 1e-6
  return { name, seed: sc.seed, calm: !!sc.calm, dt: DT, frames, today: g.today, epoch: g.ev('Date.now()') - Math.floor(g.T * 1000), saved: sc.saved || null, stored: g.store['hs-power'], inputs, samples, events: g.events.filter(([t]) => kept(t)).map(([t, e, ms]) => [+t.toFixed(2), e, ms]), cues: g.cues.filter(([t]) => kept(t)).map(([t, ...c]) => [+t.toFixed(2), ...c]), ...(drawn ? { hashes: hashes.slice(0, frames) } : {}) }
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

// a save written elsewhere (planet-core's, in the round-trip test) loaded by game.js: what the new visit kept
function load(file) {
  const g = mount({ seed: 1, saved: fs.readFileSync(file, 'utf8') })
  return { daily: g.ev('S.daily'), dailyUntil: g.ev('dailyUntil'), orbs7: g.ev('S.orbs7'), pl: g.ev('S.pl'), today: g.today, stored: g.store['hs-power'] }
}

const which = process.argv[2]
process.stdout.write(JSON.stringify(which === 'fmt' ? fmtCases() : which === 'load' ? load(process.argv[3]) : run(which)))
