  // desktop widget: play at once, with the hud in one of five layouts (a setting) that wakes while the pointer is
  // about. a press on empty sky (or ⌥/⌘-press anywhere) drags the window instead of training. settings live in the
  // app (desktop/src-tauri); notifications for big moments go out through it too
  if (WIDGET) {
    const tauri = window.__TAURI__, invoke = tauri ? tauri.core.invoke : () => Promise.resolve();
    let conf = { layout: 7, hud: 'hover', opacity: 1, notify: {}, quiet: {} };
    // the frame rate setting is the idle rate: 60 (smooth), 30 (balanced, the default) or 15 (battery saver). while the
    // pointer is about it doubles, up to 60
    let idleFps = 30;
    const pace = () => { st.fps = root.classList.contains('awake') ? Math.min(60, idleFps * 2) : idleFps; };
    pace();
    go();

    const ICON = {
      up: '<path d="M6 13.5l6-6 6 6M6 19l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
      kaio: '<path d="M12 2.5c1 4.2 5.5 5.6 5.5 10.6a5.5 5.5 0 0 1-11 0c0-2.8 1.6-4 2.7-5.6.5 1.7 1.3 2.6 2.2 2.8C11 7.6 11.5 5.1 12 2.5z" fill="currentColor"/>',
      share: '<path d="M12 3v12M7.5 7.5L12 3l4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 11H6v9h12v-9h-2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
      snd: '<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path class="on" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path class="off" d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
      gear: '<circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" fill="none" stroke="currentColor" stroke-width="1.8"/>',
      close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>',
    };
    const LABEL = { up: 'upgrades', kaio: 'kaioken', share: 'share', snd: 'sound', gear: 'settings', close: 'hide' };
    const el = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; e.innerHTML = html; return e; };
    const w = el('div', 'w'), pl = el('div', 'w-pl', '<b class="w-n">0</b><span class="w-rate"></span>'), bar = el('span', 'w-bar', '<b></b>'), btns = el('div', 'w-btns'), num = pl.firstChild, rate = pl.lastChild;
    // the dock's middle: the form and a bar to the next one, dragon balls and wishes once there are any
    const info = el('div', 'w-info', '<span class="w-form"></span><span class="w-balls"></span><span class="w-wish"></span><span class="w-next"><b></b></span>'), [iForm, iBalls, iWish, iNext] = info.children;
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); ring.setAttribute('class', 'w-ring'); ring.setAttribute('viewBox', '0 0 100 100');
    ring.innerHTML = '<circle class="track" cx="50" cy="50" r="49"/><circle class="fill" cx="50" cy="50" r="49" pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" transform="rotate(-90 50 50)"/>';
    const B = {};
    for (const k of Object.keys(ICON)) { const b = el('button', '', `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>${k === 'up' ? '<i></i>' : ''}`); b.type = 'button'; b.dataset.w = k; b.title = b.ariaLabel = LABEL[k]; btns.append(b); B[k] = b; }
    B.kaio.hidden = true;
    const ACT = { up: () => $('shopToggle').click(), kaio: () => $('kaio').click(), share: () => $('share').click(), snd: () => { $('snd').click(); B.snd.setAttribute('aria-pressed', $('snd').getAttribute('aria-pressed')); }, gear: () => invoke('open_settings'), close: () => invoke('hide_widget') };
    w.addEventListener('click', e => { const b = e.target.closest('[data-w]'); if (b) ACT[b.dataset.w](); });
    B.snd.setAttribute('aria-pressed', $('snd').getAttribute('aria-pressed'));
    $('game').append(w);

    // each layout is the same pieces in different boxes; the ring goes behind the game canvas, so the action reads on top of it
    const LAYOUTS = [7, 1, 2, 3, 6];
    function arrange(n) {
      n = LAYOUTS.includes(n) ? n : 7;
      root.dataset.layout = n; w.textContent = ''; ring.remove(); for (const b of Object.values(B)) { b.style.left = b.style.top = ''; btns.append(b); }
      const box = cls => el('div', cls);
      if (n === 7) { const b = box('w-dock'); b.append(pl, info, btns); w.append(b); }
      else if (n === 1) { st.el.before(ring); w.append(pl, btns); placeRing(); }
      else if (n === 2) { const b = box('w-bottom'); b.append(pl, btns, bar); w.append(b); }
      else if (n === 3) { pl.append(bar); w.append(pl, btns); }
      else { const t = box('w-top'); t.append(pl, btns, bar); w.append(t); }
      if (n !== 3 && bar.parentNode === pl) pl.after(bar);
    }
    // ring: the power level at the top, settings and close up either side, the rest along the bottom
    const RING = { gear: 208, close: 332, up: 52, kaio: 78, share: 102, snd: 128 };
    function placeRing() { for (const [k, deg] of Object.entries(RING)) { const a = deg * Math.PI / 180; B[k].style.left = `calc(50% + ${(Math.cos(a) * 38).toFixed(2)}vmin)`; B[k].style.top = `calc(55% + ${(Math.sin(a) * 38).toFixed(2)}vmin)`; } }

    // the game's own hud stays hidden; these mirror it. the hud needn't follow every frame: at most 30 times a second
    // while it shows, 4 while it's hidden
    const update = ui.update, shop = ui.shop, due = { u: 0, s: 0 };
    const hudDue = k => { const now = performance.now(); if (now - due[k] < (root.classList.contains('awake') || root.classList.contains('pin') || keep() ? 30 : 250)) return false; due[k] = now; return true; };
    // the app shows the power level beside its menu-bar icon: about once a second, and only when the short form changes
    const SHORT = ['', 'K', 'M', 'B'];
    const short = n => { n = Math.floor(n); if (n < 1000) return String(n); let e = Math.floor(Math.log10(n) / 3), m = n / 10 ** (e * 3); if (+m.toFixed(1) >= 1000) { e++; m /= 1000; } return e < SHORT.length ? m.toFixed(1) + SHORT[e] : n.toExponential(1).replace('+', ''); };
    let titleAt = -1e9, title = '';
    ui.update = s => {
      if (!hudDue('u')) return;
      update(s);
      const at = performance.now();
      if (at - titleAt >= 1000) { titleAt = at; const t = short(s.pl); if (t !== title) { title = t; invoke('tray_title', { text: t }); } }
      if (num.dataset.v !== $('pl').dataset.v) { num.dataset.v = $('pl').dataset.v; num.innerHTML = $('pl').innerHTML; }
      rate.textContent = $('rate').textContent + '/s';
      bar.firstChild.style.width = (s.form.p * 100).toFixed(1) + '%'; ring.lastChild.setAttribute('stroke-dashoffset', (100 - s.form.p * 100).toFixed(1));
      B.kaio.hidden = !s.kaio.own; B.kaio.disabled = !s.kaio.ready; B.kaio.title = s.kaio.ready ? 'kaioken' : `kaioken in ${s.kaio.left}s`;
      const f = s.form, key = [f.name, f.next, s.balls, s.wishes].join();
      if (info.dataset.k !== key) {
        info.dataset.k = key;
        iForm.textContent = f.name === 'base' ? (f.next ? '→ ' + f.next : '') : `${f.name} ×${f.x}`;
        iBalls.hidden = !(s.balls || s.wishes); iBalls.innerHTML = '<i class="on"></i>'.repeat(s.balls) + '<i></i>'.repeat(Math.max(0, 7 - s.balls)); iBalls.title = `dragon balls ${s.balls}/7`;
        iWish.hidden = !s.wishes; iWish.textContent = '★' + s.wishes; iWish.title = `wishes ${s.wishes}`;
        iNext.hidden = !f.next; iNext.title = f.next ? 'next: ' + f.next : '';
      }
      iNext.firstChild.style.width = (f.p * 100).toFixed(1) + '%';
    };
    let couldAscend = null;
    ui.shop = items => {
      if (!hudDue('s')) return;
      shop(items); B.up.querySelector('i').textContent = $('shopCount').textContent;
      const can = !!(items.ascend && items.ascend.can); if (can && couldAscend === false) ui.notify('ascend'); couldAscend = can;
    };

    // awake while the pointer is about; the upgrades list or a popup keep it up
    let idle = 0;
    const keep = () => $('shop').classList.contains('open') || !$('menu').hidden || !$('ascBox').hidden || !$('shareBox').hidden;
    // clouds under the floating planet (settings: always, while awake, or never, their shape and amount). window mode has the
    // full cloud sea instead
    const clouds = () => { const on = BARE && (conf.clouds === 'always' || (conf.clouds !== 'never' && root.classList.contains('awake'))); st.clouds = on && (conf.cloud_shape || 'c'); st.cloudAmt = conf.cloud_amount || 2; };
    const sleep = () => { if (keep()) idle = setTimeout(sleep, 1000); else { root.classList.remove('awake'); clouds(); pace(); } };
    const wake = ms => { root.classList.add('awake'); clouds(); pace(); clearTimeout(idle); idle = setTimeout(sleep, ms); };
    addEventListener('pointermove', () => wake(2500)); addEventListener('pointerdown', () => wake(2500), true);
    addEventListener('focusin', () => wake(4000));
    root.addEventListener('mouseleave', () => wake(500));
    // while another app is active the page gets no pointer moves; the app reports where the pointer is instead
    if (tauri) tauri.event.listen('pointer', ({ payload: p }) => wake(p.inside ? 2500 : 500));
    addEventListener('keydown', e => { if (e.key === 'Escape') $('shop').classList.remove('open'); });
    st.el.addEventListener('pointerdown', () => $('shop').classList.remove('open'));

    addEventListener('contextmenu', e => e.preventDefault());

    // dragging the window
    const empty = (x, y) => { x = Math.round(x); y = Math.round(y); for (let j = y - 3; j <= y + 3; j++) for (let i = x - 3; i <= x + 3; i++) if (i >= 0 && j >= 0 && i < st.W && j < st.H && st.buf[j * st.W + i] >>> 24) return false; return true; };
    const win = tauri && tauri.window.getCurrentWindow();
    st.el.addEventListener('pointerdown', e => {
      if (!win || e.button !== 0 || !(e.altKey || e.metaKey || empty(...st.toBuf(e)))) return;
      e.stopPropagation(); e.preventDefault(); win.startDragging();
    }, true);

    // floating, nothing is behind the scene, so everything solid gets a 1px dark rim where it meets the wallpaper: it
    // reads on light and dark desktops alike. glows and dithered haze (not fully opaque) stay rimless
    // with px.wasm, only the box round what's drawn goes to the canvas, joined with the box drawn last time (which it may
    // have to clear): outside both the canvas and the buffer are empty alike. `shown` is that last box, null when the
    // canvas may hold anything (a full put), [0, 0, -1, -1] when it's empty (a resize clears it)
    const flush = st.flush, resize = st.resize, RIM = 0xd8140f0c, NONE = [0, 0, -1, -1];
    let shown = null;
    st.resize = () => { resize(); shown = NONE; };
    st.flush = () => {
      if (BARE && PX) {
        PX.rim();
        const b = new Int32Array(PX.memory.buffer, PX.bbox(), 4), now = [b[0], b[1], b[2], b[3]], was = shown || [0, 0, st.W - 1, st.H - 1];
        const u = now[2] < now[0] ? was : was[2] < was[0] ? now : [Math.min(was[0], now[0]), Math.min(was[1], now[1]), Math.max(was[2], now[2]), Math.max(was[3], now[3])];
        if (u[2] >= u[0]) st.put(u[0], u[1], u[2] - u[0] + 1, u[3] - u[1] + 1);
        shown = now;
        return;
      }
      const b = st.buf, W = st.W, H = st.H, solid = k => b[k] >>> 24 >= 0xf0;
      if (BARE) for (let y = 0; y < H; y++) for (let x = 0, k = y * W; x < W; x++, k++) if (!(b[k] >>> 24) && ((x > 0 && solid(k - 1)) || (x < W - 1 && solid(k + 1)) || (y > 0 && solid(k - W)) || (y < H - 1 && solid(k + W)))) b[k] = RIM;
      flush(); shown = null;
    };

    // notifications: each kind its own toggle, none in quiet hours, none while you're looking, at most one a minute per kind
    const NOTE = {
      raid: name => [`${name} is attacking`, 'tap him before he gets away'],
      shenron: who => [who === 'porunga' ? 'porunga awakens' : 'the eternal dragon awakens', 'make your wish'],
      trip: world => [`off to ${world}`, 'a space pod takes you there'],
      pod: () => ['a saiyan space pod', 'tap it for ×2'],
      ascend: () => ['you can ascend', 'reset for ki seeds and a lasting boost'],
    };
    const mins = hm => { const [h, m] = String(hm).split(':').map(Number); return (h || 0) * 60 + (m || 0); };
    const quiet = () => { const q = conf.quiet; if (!q.on) return false; const d = new Date(), now = d.getHours() * 60 + d.getMinutes(), a = mins(q.from), b = mins(q.to); return a <= b ? now >= a && now < b : now >= a || now < b; };
    const sent = {};
    ui.notify = (kind, arg) => {
      const at = Date.now();
      if (!conf.notify[kind] || quiet() || (root.classList.contains('awake') && !document.hidden) || at - (sent[kind] || 0) < 60000) return;
      sent[kind] = at; const [title, body] = NOTE[kind](arg); invoke('notify', { title, body });
    };
    // hidden, the page gets no animation frames; with notifications or the menu-bar power level on, the game keeps
    // playing without drawing, in quarter-second steps that catch up on however long the (throttled) timer slept
    let bg = 0;
    document.addEventListener('visibilitychange', () => {
      clearInterval(bg); st.headless = false; if (!document.hidden || !(conf.menubar_power || Object.values(conf.notify).some(Boolean))) return;
      st.headless = true; let was = performance.now();
      bg = setInterval(() => { const n = Math.min(240, Math.floor((performance.now() - was) / 250)); was = Math.max(was + n * 250, performance.now() - 250); for (let k = 0; k < n; k++) { T += .25; st.t = T; game.frame(T, .25); } }, 1000);
    });

    const apply = s => {
      const first = conf.layout !== s.layout || !w.firstChild; conf = s;
      idleFps = [60, 30, 15].includes(s.fps) ? s.fps : 30; pace();
      if (first) arrange(s.layout);
      root.classList.toggle('pin', s.hud === 'always');
      BARE = s.mode !== 'window'; root.classList.toggle('windowed', !BARE);   // window mode: the site's skies and backdrops, live
      clouds();
      document.body.style.opacity = s.opacity;
      // the menu-bar icon may be hidden behind the notch: say how to get the widget back
      const keys = (s.shortcut || '').split('+').map(p => ({ Ctrl: '⌃', Alt: '⌥', Shift: '⇧', Cmd: '⌘' })[p] || p.replace(/^(Key|Digit)/, '')).join('');
      B.close.title = B.close.ariaLabel = keys ? `hide (${keys} brings it back)` : 'hide';
    };
    arrange(7);
    invoke('get_settings').then(s => s && apply(s));
    if (tauri) tauri.event.listen('settings', e => apply(e.payload));
  }
