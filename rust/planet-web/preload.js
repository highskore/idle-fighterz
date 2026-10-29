// ?rust (or #rust): the top of the page's <head> starts the Rust engine's two files at once, so they download (and the
// wasm compiles, streaming) while the page parses. Nothing is fetched without the flag. loader.js picks them up.
if (/[?&]rust(?:[=&]|$)/.test(location.search) || /#rust\b/.test(location.hash)) {
  const s = document.createElement('script'), url = '__RUST_WASM__';
  s.src = '__RUST_JS__';
  self.planetRustLoad = {
    js: new Promise((ok, no) => { s.onload = ok; s.onerror = no; }),
    // compileStreaming wants application/wasm; a server without it still gets the bytes
    wasm: WebAssembly.compileStreaming(fetch(url)).catch(() => fetch(url).then(r => r.arrayBuffer()).then(b => WebAssembly.compile(b))),
  };
  self.planetRustLoad.wasm.catch(() => {});
  document.head.append(s);
}
