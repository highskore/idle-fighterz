// ?rust (or #rust) runs the planet on the Rust engine, whose files preload.js started fetching from the <head>. The page,
// its title and intro start at once either way; with the flag only the game's mount waits, for the promise handed to
// main, and the card shows a ki-charging dragon ball if it's on screen (or start was pressed) before the engine is in.
// If the engine fails to load, the game runs on game.js as it always does.
const planetMain = main => {
  const L = self.planetRustLoad;
  if (!L) return main();
  let ready = false, ki = null;
  const engine = L.js.then(() => self.planetRust({ GAMES, HEROES, HASH, wasm: L.wasm }))
    .catch(e => console.warn('planet: the Rust engine did not load, running game.js', e || ''))
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
