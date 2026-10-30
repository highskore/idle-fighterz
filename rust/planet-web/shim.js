// The Rust engine behind page.html's HUD, the site page's engine. planet-core runs the game and planet-render draws it;
// this shim hands page.html a `game` object with game.js's API, puts the frames on the canvas and drives page.html's
// `ui` callbacks from planet-core's HUD messages, so the HUD's markup and code are unchanged. See rust/HUD.md.
// The page's loader (loader.js) calls planetRust once this file has loaded, and mounts the game when it resolves.
self.planetRust = async ({ GAMES, HASH, wasm }) => {
  const RUST = wasm_bindgen, { memory } = await RUST({ module_or_path: wasm });
  let planet = GAMES.find(g => g.id === 'planet');
  if (!planet) GAMES.push(planet = { id: 'planet' });
  planet.mount = (st, ui) => {
    // seeded so the game's first random draw is the one Math.random just gave, as game.js would have drawn it (the
    // LCG step backwards): with the test harness's seeded Math.random both engines play the same game
    const s = (Math.random() * 4294967296) >>> 0, seed = Math.imul(s - 1013904223, 4276115653) >>> 0;
    const P = new RUST.Planet(seed, st.W, st.H, st.scale);
    Object.assign(self.planetRust, { game: P, memory });   // for the console and the benchmark
    try { P.load(localStorage.getItem('hs-power') || ''); } catch (_) {}
    P.set_calm(!!st.calm);
    const fcx = st.el.closest('[data-cx]')?.dataset.cx;
    if (fcx) P.set_cx(+fcx);
    P.preview(HASH);
    P.draw_with_rust(false, '', 2);

    // the frame, straight from the module's memory onto the canvas (a new view when the buffer moves or memory grows)
    const ctx = st.cv.getContext('2d');
    let img = null;
    const put = () => {
      const p = P.pixels_ptr(), buf = memory.buffer;
      if (!img || img.data.buffer !== buf || img.data.byteOffset !== p || img.width !== st.W || img.height !== st.H) img = new ImageData(new Uint8ClampedArray(buf, p, st.W * st.H * 4), st.W, st.H);
      ctx.putImageData(img, 0, 0);
    };

    // a transformation darkens the sky behind the desktop HUD: its text goes light until the form lands
    const xs = document.createElement('style');
    xs.textContent = '@media (min-width: 761px) { body.xdark .hud, body.xdark .hint, body.xdark .hud b { color: #f2f2f2; } body.xdark .hud .label, body.xdark .hud .meta, body.xdark .goal { color: #b4b4c4; } }';
    document.head.appendChild(xs);

    // planet-core's messages, onto page.html's ui
    let night = false, shen = false, look = '', itxOwn = false;
    // every input first runs the timeouts that would have fired before it, as game.js's setTimeouts do
    const due = () => P.timeouts_now(Date.now());
    // the calls that hand the page a callback: what picking does
    const back = { wish: k => { due(); P.pick_wish(k); }, itxPick: w => { due(); P.itx_jump(w); } };
    // shenron's storm over the page: its colours, and the pillar from the card's top edge up (page.html's body.dusk)
    const dusk = s => {
      const bs = document.body.style;
      document.body.classList.toggle('dusk', !!s);
      // the dim-slate dip: the page text turns light while the page is dark
      const c = s ? parseInt(s.page.slice(1), 16) : 0xffffff;
      document.body.classList.toggle('dusk-dark', (c >> 16) * .3 + (c >> 8 & 255) * .59 + (c & 255) * .11 < 110);
      if (!s) return;
      const r = st.cv.getBoundingClientRect(), k = r.width / st.W;
      bs.setProperty('--dusk-page', s.page); bs.setProperty('--dusk-top', s.top); bs.setProperty('--dusk-bot', s.bot); bs.setProperty('--dusk-foot', s.foot);
      bs.setProperty('--dusk-pil', s.pil); bs.setProperty('--dusk-pil-x', (r.left + s.x * k) + 'px'); bs.setProperty('--dusk-pil-w', (s.w * k) + 'px'); bs.setProperty('--dusk-pil-h', Math.max(0, r.top) + 'px');
    };
    const deliver = () => {
      const m = JSON.parse(P.frame());
      if ('world' in m) { ui.hell && ui.hell(false); ui.world && ui.world(m.world); }
      if (m.hud) {
        ui.update(m.hud); itxOwn = m.hud.itx.own;
        if (m.hud.night !== night) { night = m.hud.night; ui.night && ui.night(night); }
        if (m.hud.shen !== shen) document.body.classList.toggle('shen', shen = m.hud.shen);
        if (m.hud.look !== look) { document.body.classList.remove('jelly', 'earth'); look = m.hud.look; if (look) document.body.classList.add(look); }
      }
      if ('sky' in m) dusk(m.sky);
      if (m.shop) ui.shop(m.shop);
      for (const [text, ms] of m.events) ui.event(text, ms);
      if (m.undo) { const id = m.undo.id; if (m.undo.off) ui.eventOff && ui.eventOff(id); else ui.event(m.undo.text, m.undo.ms, { id, label: 'undo', go: () => { due(); P.undo(id); deliver(); } }); }
      for (const [call, ...args] of m.cues) if (call === 'xform') document.body.classList.toggle('xdark', args[0]); else if (back[call]) ui[call](args[0], v => { back[call](v); deliver(); }); else if (typeof ui[call] === 'function') ui[call](...args);
    };
    // n: how many (shift-click 10, alt-click 0 for max); a plain click is one buy
    ui.onBuy((k, n = 1) => { due(); if (n === 1) P.buy(k); else P.buy_n(k, n); deliver(); });

    const cv = st.cv;
    cv.addEventListener('pointerdown', e => { const [bx, by] = st.toBuf(e); due(); P.pointer_down(e.clientX, e.clientY, bx, by, e.pointerId, e.button, e.pointerType === 'touch'); deliver(); });
    cv.addEventListener('pointermove', e => { const [bx, by] = st.toBuf(e); due(); P.pointer_move(e.clientX, e.clientY, bx, by, e.pointerId); });
    cv.addEventListener('pointerup', e => { const [bx, by] = st.toBuf(e); due(); P.pointer_up(bx, by, e.pointerId); deliver(); });
    cv.addEventListener('pointercancel', () => { due(); P.pointer_cancel(); });
    cv.addEventListener('contextmenu', e => { if (itxOwn) e.preventDefault(); });   // right-click is instant transmission's once it's owned
    addEventListener('keydown', e => {
      if (!P.playing() || e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea, [contenteditable]')) return;
      due();
      if (P.key(e.key.toLowerCase())) e.preventDefault();
      deliver();
    });

    // saved every 3s of play, as game.js does, and when the page goes away
    let lastSave = 0;
    const save = () => { try { localStorage.setItem('hs-power', P.save()); } catch (_) {} };
    addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
    // while the dragon is out, his pixels where they cross the title go again on page.html's #front, above the title, so
    // he flies in front of it while the storm (the rest of the frame) stays behind
    const front = document.getElementById('front'), logo = document.getElementById('logo'), fctx = front && front.getContext('2d');
    let fimg = null;
    const putFront = () => {
      const box = shen && logo && logo.box;
      if (!fctx || !box) { if (front && !front.hidden) front.hidden = true; return; }
      const W = st.W, H = st.H, r = st.cv.getBoundingClientRect(), sx = r.width / W, sy = r.height / H, buf = memory.buffer;
      if (!fimg || fimg.width !== W || fimg.height !== H) { fimg = new ImageData(W, H); front.width = W; front.height = H; }
      const out = new Uint32Array(fimg.data.buffer), px = new Uint32Array(buf, P.pixels_ptr(), W * H), dm = new Uint8Array(buf, P.dragon_ptr(), W * H);
      out.fill(0);
      const x0 = Math.max(0, Math.floor((box[0] - r.left) / sx)), x1 = Math.min(W, Math.ceil((box[2] - r.left) / sx));
      const y0 = Math.max(0, Math.floor((box[1] - r.top) / sy)), y1 = Math.min(H, Math.ceil((box[3] - r.top) / sy));
      for (let y = y0; y < y1; y++) for (let i = y * W + x0, e = y * W + x1; i < e; i++) if (dm[i]) out[i] = px[i];
      fctx.putImageData(fimg, 0, 0);
      const pr = front.parentElement.getBoundingClientRect();
      Object.assign(front.style, { left: r.left - pr.left + 'px', top: r.top - pr.top + 'px', width: r.width + 'px', height: r.height + 'px' });
      front.hidden = false;
    };
    const frame = (t, dt) => {
      P.frame_drawn(t, dt, Date.now());
      put();
      deliver();
      putFront();
      if (P.playing() && t - lastSave >= 3) { lastSave = t; save(); }
    };
    deliver();

    const menu = () => { const m = JSON.parse(P.menu()); for (const n of m.tree) if (n.max === null) n.max = Infinity; return m; };
    // the hero sprites, from planet-core: [w, h, ...col] as { w, h, col }, game.js's shape
    const sprite = v => ({ w: v[0], h: v[1], col: v.subarray(2) });
    // game.js's sprite thumbnail
    const thumb = (id, k = 4) => {
      const spr = sprite(P.hero_sprite(id)), c = document.createElement('canvas'); c.width = spr.w * k; c.height = spr.h * k;
      const x = c.getContext('2d');
      for (let j = 0; j < spr.h; j++) for (let i = 0; i < spr.w; i++) { const v = spr.col[j * spr.w + i]; if (v < 0) continue; x.fillStyle = '#' + v.toString(16).padStart(6, '0'); x.fillRect(i * k, j * k, k, k); }
      return c;
    };
    const card = () => {
      const c = JSON.parse(P.card());
      c.spr = sprite(P.card_sprite()); c.scene = cv;
      return c;
    };
    document.documentElement.dataset.engine = 'rust';
    return {
      menu, card, frame, thumb,
      info: k => JSON.parse(P.shop_info(k)), bulk: n => JSON.parse(P.bulk(n)),
      ascendInfo: () => JSON.parse(P.ascend_info()), angels: () => JSON.parse(P.angels()), godInfo: () => JSON.parse(P.god_info()), zenoInfo: () => JSON.parse(P.zeno_info()),
      learn: id => { due(); P.learn(id); deliver(); },
      respec: () => { due(); P.respec(); deliver(); },
      learnAngel: id => { due(); P.learn_angel(id); deliver(); },
      autoNext: () => { due(); P.auto_next(); },
      wear: (kind, id) => { due(); P.wear(kind, id); },
      pick: id => { due(); return P.pick_hero(id); },
      kaioken: () => { due(); P.kaioken(); deliver(); },
      itx: () => { due(); P.itx(); deliver(); },
      train: () => { due(); P.train(); deliver(); },
      start: () => { const now = Date.now(); P.timeouts_now(now); P.start(new Date(now).toDateString(), now); deliver(); save(); },
      resize: () => { P.resize(st.W, st.H, st.scale); img = null; },
    };
  };
};
