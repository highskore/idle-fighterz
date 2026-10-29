// The site page's ?rust engine for build.mjs: loader.js goes into the page after game.js, and the wasm build in pkg/
// (sh rust/planet-web/build.sh) becomes two files next to it, planet-rust.js (wasm-bindgen's glue and shim.js) and
// planet-rust.wasm. The page asks for them with a hash of the build in the URL, so a cached copy of one never meets a
// new copy of the other.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

// null when there's no wasm build
export function rustEngine() {
  let glue, wasm
  try { glue = readFileSync(join(here, 'pkg', 'planet_web.js'), 'utf8'); wasm = readFileSync(join(here, 'pkg', 'planet_web_bg.wasm')) } catch (_) { return null }
  const js = glue + '\n' + readFileSync(join(here, 'shim.js'), 'utf8')
  const v = createHash('sha256').update(js).update(wasm).digest('hex').slice(0, 10)
  return { js, wasm, files: { js: `planet-rust.js?v=${v}`, wasm: `planet-rust.wasm?v=${v}` } }
}

export function rustLoader(engine) {
  const files = engine ? engine.files : { js: 'planet-rust.js', wasm: 'planet-rust.wasm' }
  return readFileSync(join(here, 'loader.js'), 'utf8').replace('__RUST_JS__', files.js).replace('__RUST_WASM__', files.wasm)
}
