  // the widget's hud skins (a setting): classic is the five layouts below; scouter, capsule and drawer build their own
  // hud round the same buttons. the theme (light, dark, or auto: the system's) recolours classic and the drawer; the
  // scouter is always dark glass and capsule corp always white enamel. widget.js mounts it; test/skins.test.cjs tests it
  const SKIN = (() => {
    const SKINS = ['classic', 'scouter', 'capsule', 'drawer'], OWN = { scouter: 'dark', capsule: 'light' };
    const pick = s => SKINS.includes(s) ? s : 'classic';
    const theme = (skin, setting, sysDark) => OWN[pick(skin)] || (setting === 'dark' || (setting === 'auto' && !!sysDark) ? 'dark' : 'light');
    const clamp = p => Math.max(0, Math.min(1, +p || 0));
    // the scouter's segments to the next form: lit once whole
    const lit = (p, n) => Math.floor(clamp(p) * n + 1e-9);
    // capsule corp's gauge: full capsules, then one half full
    const caps = (p, n = 8) => { const f = clamp(p) * n; return Array.from({ length: n }, (_, k) => k + 1 <= f + 1e-9 ? 'on' : k < f ? 'half' : ''); };
    // the drawer's tabs: upgrades you can buy, ki tree nodes you can learn, heroes unlocked of all
    const counts = (items, menu) => {
      const m = menu || {}, chars = m.chars || [];
      return { up: Object.values(items || {}).filter(v => v && v.can).length, tree: (m.tree || []).filter(n => n && n.can).length, heroes: [chars.filter(c => c && c.open).length, chars.length] };
    };
    const formName = f => f.name === 'base' ? 'base' : f.name.replace('super saiyan', 'ssj') + (f.x > 1 ? ' ×' + f.x : '');

    // c: { root, w, B (the buttons by key), stage, shop, menuBody, menuCard, menu(tab): renders the page's menu as tab,
    // menuData(), relayout(): the planet moved }
    function mount(c) {
      const el = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
      const icon = k => c.B[k].querySelector('svg').outerHTML;
      const ORDER = ['up', 'kaio', 'itx', 'share', 'snd', 'gear', 'close'];
      const sys = matchMedia('(prefers-color-scheme: dark)');
      let skin = 'classic', setting = 'light', p = null, items = {}, tab = 'up', menuKey = '', menuAt = 0;

      const paint = () => { const t = theme(skin, setting, sys.matches); if (t === 'dark') c.root.dataset.theme = t; else delete c.root.dataset.theme; };
      sys.addEventListener('change', paint);

      const BUILD = {
        scouter() {
          const lens = el(`<div class="sc"><div class="sc-arm"></div><div class="sc-lens"><div class="sc-k"><span>POWER LVL</span><b>▲</b></div><div class="sc-n"></div><div class="sc-r"></div><div class="sc-seg">${'<i></i>'.repeat(12)}</div><div class="sc-f"></div><span class="sc-tgt"></span></div></div>`);
          const tray = el('<div class="sc-btns"></div>'); for (const k of ORDER) tray.append(c.B[k]);
          c.w.append(lens, tray);
          const q = s => lens.querySelector(s), seg = [...lens.querySelectorAll('.sc-seg i')];
          return {
            hud(s, n, rate) {
              const t = n.textContent.replace(/\s/g, ''), e = q('.sc-n');
              if (e.textContent !== t) { e.textContent = t; e.style.fontSize = Math.min(16, 158 / Math.max(1, t.length)).toFixed(1) + 'px'; }
              q('.sc-r').textContent = '+' + rate.toUpperCase();
              const f = s.form; q('.sc-f').textContent = (formName(f) + '  ' + (f.next ? Math.floor(f.p * 100) + '%' : 'max')).toUpperCase();
              const on = lit(f.next ? f.p : 1, 12); seg.forEach((i, k) => i.classList.toggle('on', k < on));
            },
          };
        },
        capsule() {
          const logo = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="8" width="18" height="8" rx="4" fill="#fff"/><rect x="12" y="8" width="9" height="8" rx="4" fill="#ffd23a"/><rect x="11" y="8" width="2" height="8" fill="#1f5fd1"/></svg>';
          const box = el(`<div class="cc"><div class="cc-p"><div class="cc-logo">${logo}</div><div class="cc-m"><div class="cc-k">capsule corp.<span>power level</span></div><div class="cc-n"><span></span><small></small></div></div><div class="cc-g"><span class="cc-f"></span><div class="cc-cap">${'<i></i>'.repeat(8)}</div></div></div><div class="cc-b"></div></div>`);
          const tray = box.querySelector('.cc-b'); for (const k of ORDER) tray.append(c.B[k]);
          c.w.append(box);
          const q = s => box.querySelector(s), cap = [...box.querySelectorAll('.cc-cap i')];
          return {
            hud(s, n, rate) {
              const v = q('.cc-n span'); if (v.innerHTML !== n.innerHTML) v.innerHTML = n.innerHTML;
              q('.cc-n small').textContent = '+' + rate;
              const f = s.form; q('.cc-f').textContent = formName(f) + (f.next ? ' → next' : ' · max');
              caps(f.next ? f.p : 1).forEach((k, i) => { if (cap[i].className !== k) cap[i].className = k; });
            },
          };
        },
        drawer() {
          const chip = el('<div class="dw-chip"><span class="dw-n"></span><span class="dw-r"><span></span><b></b></span><i><b></b></i></div>');
          const edge = el(`<button type="button" class="dw-tab" aria-label="upgrades">${icon('up')}<span>upgrades</span><i></i></button>`);
          const rail = el('<div class="dw-rail"></div>'); for (const k of ORDER) if (k !== 'up') rail.append(c.B[k]);
          const dw = el('<div class="dw" role="dialog" aria-label="upgrades, ki tree and heroes"><header><button type="button" data-dw="up">upgrades <b></b></button><button type="button" data-dw="tree">ki tree <b></b></button><button type="button" data-dw="heroes">heroes <b></b></button><button type="button" class="dw-x" aria-label="close">×</button></header><div class="dw-body"></div></div>');
          c.w.append(chip, edge, rail); c.w.after(dw);   // outside .w: its buttons are the page's, not the hud's round ones
          edge.addEventListener('click', () => open('up'));
          dw.querySelector('.dw-x').addEventListener('click', close);
          dw.querySelector('header').addEventListener('click', e => { const b = e.target.closest('[data-dw]'); if (b) open(b.dataset.dw); });
          const q = s => chip.querySelector(s);
          return {
            dw, edge,
            hud(s, n, rate) {
              const v = q('.dw-n'); if (v.innerHTML !== n.innerHTML) v.innerHTML = n.innerHTML;
              q('.dw-r span').textContent = rate; q('.dw-r b').textContent = formName(s.form);
              q('i b').style.width = ((s.form.next ? s.form.p : 1) * 100).toFixed(1) + '%';
              if (tab !== 'up' && c.root.classList.contains('dw-open') && performance.now() - menuAt > 500) { menuAt = performance.now(); const k = JSON.stringify(c.menuData()); if (k !== menuKey) { menuKey = k; c.menu(tab === 'heroes' ? 'chars' : 'tree'); } }
              badges();
            },
          };
        },
      };

      // the drawer: upgrades are the page's own list, laid over it; the ki tree and heroes are the page's menu body, moved in
      const isOpen = () => c.root.classList.contains('dw-open');
      function badges() {
        if (!p || !p.dw) return;
        const n = counts(items, c.menuData());
        p.edge.querySelector('i').textContent = n.up || '';
        const [up, tree, heroes] = p.dw.querySelectorAll('header b');
        up.textContent = n.up || ''; tree.textContent = n.tree || ''; heroes.textContent = n.heroes[1] ? n.heroes.join('/') : '';
      }
      function home() { if (c.menuBody.parentNode !== c.menuCard) c.menuCard.append(c.menuBody); }
      function open(t) {
        tab = t; c.root.dataset.dw = t;
        if (!isOpen()) { c.root.classList.add('dw-open'); c.relayout(); }
        p.dw.querySelectorAll('[data-dw]').forEach(b => b.classList.toggle('on', b.dataset.dw === t));
        if (t === 'up') { home(); if (!c.shop.classList.contains('open')) c.shop.classList.add('open'); return; }
        c.shop.classList.remove('open');
        p.dw.querySelector('.dw-body').append(c.menuBody);
        menuKey = JSON.stringify(c.menuData()); menuAt = performance.now();
        c.menu(t === 'heroes' ? 'chars' : 'tree'); c.menuBody.scrollTop = 0;
      }
      function close() {
        if (!isOpen()) return;
        c.root.classList.remove('dw-open'); delete c.root.dataset.dw; c.shop.classList.remove('open'); home(); c.relayout();
      }
      // the page opens and closes the upgrades too (a click on the planet, escape); and its own menu (a ki tree gift,
      // ascending) takes its body back
      new MutationObserver(() => {
        if (skin !== 'drawer') return;
        const shop = c.shop.classList.contains('open');
        if (shop && (!isOpen() || tab !== 'up')) open('up'); else if (!shop && isOpen() && tab === 'up') close();
      }).observe(c.shop, { attributes: true, attributeFilter: ['class'] });
      new MutationObserver(() => { if (!c.menuCard.closest('.menu').hidden && c.menuBody.parentNode !== c.menuCard) { home(); close(); } })
        .observe(c.menuCard.closest('.menu'), { attributes: true, attributeFilter: ['hidden'] });
      c.stage.addEventListener('pointerdown', close);
      addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

      return {
        // builds the skin's hud in c.w (emptied, the buttons back in their row); false for classic, which widget.js lays out
        arrange(s) {
          close(); if (p && p.dw) p.dw.remove(); skin = pick(s); p = null;
          if (skin === 'classic') { delete c.root.dataset.skin; paint(); return false; }
          c.root.dataset.skin = skin; paint();
          p = BUILD[skin](); badges();
          return true;
        },
        theme(t) { setting = t; paint(); },
        open: () => isOpen(),
        hud(s, n, rate) { if (p) p.hud(s, n, rate); },
        shop(v) { items = v; badges(); },
      };
    }
    return { SKINS, pick, theme, lit, caps, counts, formName, mount };
  })();
  if (typeof module === 'object' && module.exports) module.exports = SKIN;
