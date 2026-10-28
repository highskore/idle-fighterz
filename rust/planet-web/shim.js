// The Rust core behind page.html's HUD (`node build.mjs --rust`). planet-core runs the game; this shim hands page.html
// a `game` object with game.js's API and drives page.html's `ui` callbacks from planet-core's HUD messages, so the
// HUD's markup and code are unchanged. See rust/HUD.md.
//
// Until stage 1 draws the planet in Rust, game.js draws it: a second copy (the "twin") runs in lockstep, fed the same
// fixed steps, the same inputs and the same seeded randomness, with its own UI calls, storage and timers muted. It
// reports where it drew things (planet-core's spots), and every second the two are checked against each other.
const RUST = (() => {
  const b = atob('__RUST_WASM__'), u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  wasm_bindgen.initSync({ module: u });
  return wasm_bindgen;
})();

// the twin's world: its randomness (planet-core's LCG while it simulates, Math.random while it draws), timers on
// simulated time, a save that is never written, no preview hooks, no body classes, and its listeners kept for us
const TWIN = (() => {
  const real = Math.random, M = Object.create(Math);
  let state = 1, sim = false, draws = 0, T = 0;
  M.random = () => sim ? (draws++, (state = (state * 1664525 + 1013904223) >>> 0) / 4294967296) : real();
  const pending = [], listeners = {};
  const env = {
    Math: M,
    setTimeout: (f, ms = 0) => { pending.push([T + ms / 1000, f]); return 0; },
    clearTimeout: () => {},
    localStorage: { getItem: k => { try { return localStorage.getItem(k); } catch (_) { return null; } }, setItem: () => {}, removeItem: () => {} },
    location: { protocol: 'https:', hostname: 'highskore.com', hash: '' },
    document: { body: { classList: { add() {}, remove() {}, toggle() {}, contains: () => false } }, createElement: t => document.createElement(t) },
    addEventListener: (k, f) => { listeners[k] = f; },
    rs: { skip: false, draw() { sim = false; }, ev: null },
  };
  return {
    env, listeners,
    seed(s) { state = s >>> 0 || 1; draws = 0; },
    get draws() { return draws; },
    // runs f as the twin's simulation: its randomness is the LCG until it starts drawing
    run(f) { sim = true; try { return f(); } finally { sim = false; } },
    // the frame's time, then the timers due by it (game.js's setTimeouts, as the difftest harness runs them)
    at(t) { T = t; },
    due() { pending.sort((a, b) => a[0] - b[0]); while (pending.length && pending[0][0] <= T) pending.shift()[1](); },
  };
})();
__TWIN__

(() => {
  const DT = 1 / 30;
  const planet = GAMES.find(g => g.id === 'planet'), twinMount = planet.mount;
  planet.mount = (st, ui) => {
    const seed = (Math.random() * 4294967296) >>> 0 || 1;
    const P = TWIN.planet = new RUST.Planet(seed, st.W, st.H, st.scale);   // TWIN.planet: a handle for the console
    try { P.load(localStorage.getItem('hs-power') || ''); } catch (_) {}

    // the twin, mounted on the same stage with its canvas listeners kept back, and a ui that only remembers its buy and wish callbacks
    let twinBuy = null, twinPick = null, twinJump = null;
    const twinUi = new Proxy({}, { get: (_, k) => k === 'onBuy' ? (f => { twinBuy = f; }) : k === 'wish' ? ((_o, pick) => { twinPick = pick; }) : k === 'itxPick' ? ((_l, jump) => { twinJump = jump; }) : () => {} });
    const cv = st.cv, held = {};
    st.cv = new Proxy(cv, { get: (o, k) => k === 'addEventListener' ? ((type, f) => { held[type] = f; }) : typeof o[k] === 'function' ? o[k].bind(o) : o[k], set: (o, k, v) => { o[k] = v; return true; } });
    TWIN.seed(seed);
    const twin = TWIN.run(() => twinMount(st, twinUi));
    st.cv = cv;
    const spotsOf = TWIN.env.rs.ev(`() => {
      const p = o => o && o.sx !== undefined ? [o.sx, o.sy] : null;
      return JSON.stringify({ lift: liftNow, flip: flipNow, seen: __heroSeen, picc: piccoloAt ? [piccoloAt.x, piccoloAt.y] : null, monkey: monkeyAt ? [monkeyAt.x, monkeyAt.y, monkeyAt.k] : null,
        boss: boss ? [boss.x, boss.y, boss.k] : null, ginyu: ginyu ? ginyu.members.map(m => [m.x, m.y, m.k]) : [],
        movie: movie ? movie.minions.map(h => h.x !== undefined ? [h.x, h.y, h.k] : null) : [],
        npc: { greg: p(greg), kai: p(kai), roshi: p(roshi), satan: p(satan), door: p(door), bean: p(bean), pud: p(pud), zen: p(zen), kril: p(kril), car: p(car), yam: p(yam) },
        date: date && date.sx2 !== undefined ? [date.sx2, date.sy2] : null, saibas: saibas.map(p), birds: a16 ? a16.birds.map(p) : [], gadgets: gadgets.map(p),
        ghosts: snk ? snk.ghosts.map(g => g.sx !== undefined ? [g.sx, g.sy, g.r] : null) : [] });
    }`);
    const twinPl = TWIN.env.rs.ev('() => S.pl');
    const both = (rust, js) => { rust(); TWIN.run(js); };

    // planet-core's messages, onto page.html's ui
    let night = false, shen = false, look = '';
    const deliver = () => {
      const m = JSON.parse(P.frame());
      if ('world' in m) { ui.hell && ui.hell(false); ui.world && ui.world(m.world); }
      if (m.hud) {
        ui.update(m.hud);
        if (m.hud.night !== night) { night = m.hud.night; ui.night && ui.night(night); }
        if (m.hud.shen !== shen) document.body.classList.toggle('shen', shen = m.hud.shen);
        if (m.hud.look !== look) { document.body.classList.remove('jelly', 'earth'); look = m.hud.look; if (look) document.body.classList.add(look); }
      }
      if (m.shop) ui.shop(m.shop);
      for (const [text, ms] of m.events) ui.event(text, ms);
      for (const [call, ...args] of m.cues) if (call === 'itxPick') ui.itxPick(args[0], w => { both(() => P.itx_jump(w), () => twinJump && twinJump(w)); deliver(); }); else if (typeof ui[call] === 'function') ui[call](...args);
      if (m.wish) ui.wish(m.wish, k => { both(() => P.pick_wish(k), () => twinPick && twinPick(k)); deliver(); });
    };
    ui.onBuy(k => { both(() => P.buy(k), () => twinBuy && twinBuy(k)); deliver(); });

    // input: planet-core and the twin get every event at the same point of simulated time
    cv.addEventListener('pointerdown', e => { const [bx, by] = st.toBuf(e); both(() => P.pointer_down(e.clientX, e.clientY, bx, by, e.pointerId, e.button), () => held.pointerdown(e)); deliver(); });
    cv.addEventListener('pointermove', e => { const [bx, by] = st.toBuf(e); both(() => P.pointer_move(e.clientX, e.clientY, bx, by), () => held.pointermove(e)); });
    cv.addEventListener('pointerup', e => { const [bx, by] = st.toBuf(e); both(() => P.pointer_up(bx, by), () => held.pointerup(e)); deliver(); });
    cv.addEventListener('pointercancel', e => both(() => P.pointer_cancel(), () => held.pointercancel(e)));
    addEventListener('keydown', e => {
      if (!P.playing() || e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea, [contenteditable]')) return;
      both(() => P.key(e.key.toLowerCase()), () => TWIN.listeners.keydown && TWIN.listeners.keydown(e));
      deliver();
    });

    // fixed steps: planet-core first, then the twin at the same time (drawing only the last), then where it drew things
    let bank = 0, t = 0, steps = 0, warned = false;
    const save = () => { try { localStorage.setItem('hs-power', P.save()); } catch (_) {} };
    addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
    const frame = (_T, gdt) => {
      bank += gdt; let n = 0;
      while (bank >= DT && n < 8) { bank -= DT; n++; }
      if (n === 8) bank = 0;
      for (let i = 0; i < n; i++) {
        t = P.step_one(Date.now());
        st.t = t; TWIN.at(t); TWIN.env.rs.skip = i < n - 1;
        TWIN.run(() => twin.frame(t, DT)); TWIN.run(() => TWIN.due());
        P.spots(spotsOf());
        if (++steps % 30 === 0) {
          const p = JSON.parse(P.probe());
          if (!warned && (p.draws !== TWIN.draws || p.pl !== twinPl())) { warned = true; console.warn(`planet: the drawing drifted from the game at t=${t.toFixed(2)}s (power ${p.pl} vs ${twinPl()}, draws ${p.draws} vs ${TWIN.draws})`); }
        }
        if (steps % 90 === 0 && P.playing()) save();
      }
      TWIN.env.rs.skip = false; st.t = t;
      if (n) deliver();
    };
    deliver();

    const menu = () => { const m = JSON.parse(P.menu()); for (const n of m.tree) if (n.max === null) n.max = Infinity; return m; };
    const card = () => { const c = JSON.parse(P.card()), tc = twin.card(); c.spr = tc.spr; c.scene = tc.scene; return c; };
    return {
      menu, card, frame,
      ascendInfo: () => JSON.parse(P.ascend_info()), angels: () => JSON.parse(P.angels()), godInfo: () => JSON.parse(P.god_info()), zenoInfo: () => JSON.parse(P.zeno_info()),
      learn: id => { both(() => P.learn(id), () => twin.learn(id)); deliver(); },
      respec: () => { both(() => P.respec(), () => twin.respec()); deliver(); },
      learnAngel: id => { both(() => P.learn_angel(id), () => twin.learnAngel(id)); deliver(); },
      autoNext: () => both(() => P.auto_next(), () => twin.autoNext()),
      pick: id => { let ok = false; both(() => { ok = P.pick_hero(id); }, () => twin.pick(id)); return ok; },
      thumb: (id, k) => twin.thumb(id, k),
      kaioken: () => { both(() => P.kaioken(), () => twin.kaioken()); deliver(); },
      itx: () => { both(() => P.itx(), () => twin.itx()); deliver(); },
      train: () => { both(() => P.train(), () => twin.train()); deliver(); },
      start: () => { both(() => P.start(new Date().toDateString(), Date.now()), () => twin.start()); deliver(); save(); },
      resize: () => { twin.resize(); P.resize(st.W, st.H, st.scale); },
    };
  };
})();
