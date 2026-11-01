// The site page runs the planet on the Rust engine, whose files preload.js started fetching from the <head>. Where it
// can't (no WebAssembly, ?js or #js, or the engine failed to load) it runs game.js, the frozen legacy engine, from
// planet-game.js next to the page. The page, its title and intro start at once either way; only the game's mount waits,
// for the engine main hands its mount to (a mount that fails on the Rust engine runs game.js too), and the card shows
// a ki-charging dragon ball if it's on screen (or start was pressed) before the engine is in.
const planetMain = main => {
  const L = self.planetLoad || {}, root = document.documentElement;
  // game.js's: preview hooks only on dev hosts and branch previews, never on a live copy of the site
  const hash = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\]|.*\.localhost|.*-git-.*\.vercel\.app)$/.test(location.hostname) ? location.hash : '';
  // game.js runs as a script of its own after the page's, sharing its top-level names (world.js's stage and sprites)
  const legacy = () => new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = L.game; s.onload = ok; s.onerror = no;
    document.body.append(s);
  }).then(() => { root.dataset.engine = 'js'; });
  let ready = false, ki = null;
  const engine = mount => (L.js ? L.js.then(() => self.planetRust({ GAMES, HASH: hash, wasm: L.wasm })).then(mount).catch(e => {
    console.warn('planet: the Rust engine did not load, running game.js', e || '');
    for (let i = GAMES.length; i--;) if (GAMES[i].id === 'planet') GAMES.splice(i, 1);   // game.js adds its own
    return legacy().then(mount);
  }) : legacy().then(mount))
    .finally(() => { ready = true; if (ki) { ki.remove(); ki = null; } });
  main(engine);
  if (ready) return;
  const stage = document.querySelector('#game .stage');
  const show = () => {
    if (ready || ki || !stage) return;
    ki = document.createElement('canvas'); ki.width = ki.height = 21; ki.setAttribute('aria-hidden', 'true');
    ki.style.cssText = 'position:absolute;left:50%;top:38%;width:84px;height:84px;transform:translate(-50%,-50%);image-rendering:pixelated;pointer-events:none;z-index:4';
    stage.append(ki);
    const x = ki.getContext('2d'), still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // a four-star dragon ball, its aura ring swelling out pixel by pixel
    const draw = f => {
      if (!ki) return;
      x.clearRect(0, 0, 21, 21);
      for (let j = 0; j < 21; j++) for (let i = 0; i < 21; i++) {
        const d = Math.hypot(i - 10, j - 10), r = 6.5 + f * 1.1;
        let c = d <= 5.2 ? (d > 4.3 ? '#c45a00' : (i - 8) ** 2 + (j - 8) ** 2 < 2 ? '#ffe9a8' : '#ff9a1a') : Math.abs(d - r) < .55 ? '#ffd84a' : null;
        if (d <= 4.3 && [[10, 9], [12, 10], [10, 11], [11, 12]].some(([a, b]) => a === i && b === j)) c = '#d0201a';
        if (!c) continue;
        x.globalAlpha = d > 5.2 ? 1 - f / 4 : 1; x.fillStyle = c; x.fillRect(i, j, 1, 1);
      }
      if (!still) setTimeout(() => draw((f + 1) % 4), 130);
    };
    draw(still ? 1 : 0);
  };
  for (const id of ['play', 'intro']) document.getElementById(id)?.addEventListener('click', show);
  // on screen with nothing drawn yet: a short grace first, so a fast connection never sees it
  if (stage) new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { o.disconnect(); setTimeout(show, 400); } }).observe(stage);
};
