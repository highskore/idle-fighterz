// The top of the site page's <head> starts the game's engine at once, so it downloads (and the wasm compiles, streaming)
// while the page parses: the Rust engine's two files, or, where WebAssembly can't run, with ?js (or #js) or in a build
// without the wasm, game.js (planet-game.js, preloaded only: it runs after the page's script). loader.js picks them up.
{
  const js = '__RUST_JS__', url = '__RUST_WASM__', game = '__GAME_JS__';
  const rust = !!js && typeof WebAssembly === 'object' && !/[?&]js(?:[=&]|$)/.test(location.search) && !/#js\b/.test(location.hash);
  self.planetLoad = { game };
  if (rust) {
    const s = document.createElement('script');
    s.src = js;
    self.planetLoad.js = new Promise((ok, no) => { s.onload = ok; s.onerror = no; });
    // compileStreaming wants application/wasm; a server without it still gets the bytes
    self.planetLoad.wasm = WebAssembly.compileStreaming(fetch(url)).catch(() => fetch(url).then(r => r.arrayBuffer()).then(b => WebAssembly.compile(b)));
    self.planetLoad.wasm.catch(() => {});
    document.head.append(s);
  } else {
    const l = document.createElement('link');
    l.rel = 'preload'; l.as = 'script'; l.href = game;
    document.head.append(l);
  }
}
