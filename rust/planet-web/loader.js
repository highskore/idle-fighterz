// ?rust (or #rust) runs the planet on the Rust engine: only then does the site page fetch its script and wasm (written
// next to planet.html by build.mjs), and the page's code starts once they're in. Without them, or if they fail to load,
// the page runs game.js as it always does.
const planetMain = main => {
  if (!/[?&]rust(?:[=&]|$)/.test(location.search) && !/#rust\b/.test(location.hash)) return main();
  const js = e => { console.warn('planet: the Rust engine did not load, running game.js', e || ''); main(); };
  const s = document.createElement('script');
  s.src = '__RUST_JS__';
  s.onload = () => self.planetRust({ GAMES, HEROES, HASH, wasm: '__RUST_WASM__' }).then(main, js);
  s.onerror = () => js();
  document.head.append(s);
};
