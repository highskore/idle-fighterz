// The site page's engines for build.mjs: preload.js goes at the top of the page's <head>, loader.js after world.js, and
// the wasm build in pkg/ (sh rust/planet-web/build.sh) becomes two files next to it, planet-rust.js (wasm-bindgen's glue
// and shim.js) and planet-rust.wasm; game.js, the fallback, a third, planet-game.js. The page asks for each with a hash
// of the build in the URL, so a cached copy of one never meets a new copy of another.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const version = (...parts) => parts.reduce((h, p) => h.update(p), createHash('sha256')).digest('hex').slice(0, 10)

// null when there's no wasm build
export function rustEngine() {
  let glue, wasm
  try { glue = readFileSync(join(here, 'pkg', 'planet_web.js'), 'utf8'); wasm = readFileSync(join(here, 'pkg', 'planet_web_bg.wasm')) } catch (_) { return null }
  const js = glue + '\n' + readFileSync(join(here, 'shim.js'), 'utf8')
  const v = version(js, wasm)
  return { js, wasm, files: { js: `planet-rust.js?v=${v}`, wasm: `planet-rust.wasm?v=${v}` } }
}

export const rustLoader = () => readFileSync(join(here, 'loader.js'), 'utf8')

// game.js (with shenron.js), minified, as the page's fallback file
export const gameFile = js => ({ js, file: `planet-game.js?v=${version(js)}` })

// with no wasm build the page goes straight to game.js
export function rustPreload(engine, game) {
  const files = engine ? engine.files : { js: '', wasm: '' }
  return readFileSync(join(here, 'preload.js'), 'utf8').replace('__RUST_JS__', files.js).replace('__RUST_WASM__', files.wasm).replace('__GAME_JS__', game.file)
}
