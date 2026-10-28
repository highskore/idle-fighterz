// The Rust build's game for page.html's __PLANET__: wasm-bindgen's glue, then shim.js with the module inlined and
// game.js wrapped as its lockstep renderer (its own randomness, timers, storage and listeners, plus two hooks; see
// shim.js). build.mjs --rust and test.mjs both use it, so the test runs exactly what ships.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

// read: a repo file's text; fence: drops widget-only code, as the site build does
const HOIST = "if (!(S.world === 3 && snk)) { if (bang && Math.min(1, (t - bang.t0) / bang.dur) >= 1) { explode(bang.x1, bang.y1); bang = null; } if (apeUntil > t && Math.floor(t * 3.2) !== apeStep) { apeStep = Math.floor(t * 3.2); shake = Math.max(shake, .35); __stomp = true; } if (charging >= 2.4 && __heroSeen) shake = Math.max(shake, .06); if (capsule) { const c = capsule; if (c.y < c.land) { c.vy += 160 * dt; c.y = Math.min(c.land, c.y + c.vy * dt); } else c.y = c.land + Math.sin((t - c.t0) * 4) * 1.5; if (t - c.t0 > 8) openCapsule(); } }"

export function rustPlanet(read, fence) {
  const pkg = join(here, 'pkg')
  let glue, wasm
  try { glue = readFileSync(join(pkg, 'planet_web.js'), 'utf8'); wasm = readFileSync(join(pkg, 'planet_web_bg.wasm')) } catch (_) { throw new Error('no wasm build in rust/planet-web/pkg: run sh rust/planet-web/build.sh first') }
  const patch = (s, from, to) => { if (s.split(from).length !== 2) throw new Error('game.js anchor not found once: ' + from); return s.replace(from, () => to) }
  let twin = read('shenron.js') + fence(read('game.js'))
  twin = patch(twin, '    return { menu, learn, respec,', '    __rs.ev = s => eval(s);\n    return { menu, learn, respec,')
  // what game.js does to the game while drawing (the big bang landing, a great ape's stomp, a full charge's tremble, the
  // capsule falling and opening itself) runs just before the drawing, every frame, as planet-core runs it; frames the
  // shim doesn't show skip drawing
  twin = patch(twin, 'st.clear(); zb.fill(-1e9); ib.fill(0);', HOIST + ' if (__rs.skip) return; __rs.draw(); st.clear(); zb.fill(-1e9); ib.fill(0);')
  twin = patch(twin, 'const step = Math.floor(t * 3.2); if (step !== apeStep) { apeStep = step; shake = Math.max(shake, .35); for', 'const step = Math.floor(t * 3.2); if (__stomp) { __stomp = false; for')
  twin = patch(twin, 'const c = capsule; if (c.y < c.land) { c.vy += 160 * dt; c.y = Math.min(c.land, c.y + c.vy * dt); } else c.y = c.land + Math.sin((t - c.t0) * 4) * 1.5;\n        if (t - c.t0 > 8) openCapsule();\n        else {', 'const c = capsule; {')
  twin = patch(twin, '    let flipNow = false, liftNow = 0, piccoloAt = null;', '    let flipNow = false, liftNow = 0, piccoloAt = null, __stomp = false, __heroSeen = false;')
  // whether the hero is in view decides a full charge's tremble; it's reported with the spots
  twin = patch(twin, '      const seen = (() => {', '      const seen = __heroSeen = (() => {')
  twin = patch(twin, 'uy = -Math.cos(kd.ang); shake = Math.max(shake, .06);', 'uy = -Math.cos(kd.ang);')
  const env = ['Math', 'setTimeout', 'clearTimeout', 'Date', 'localStorage', 'location', 'document', 'addEventListener']
  const wrapped = `(function (${env.join(', ')}, __rs) {\n${twin}\n})(${env.map(k => 'TWIN.env.' + k).join(', ')}, TWIN.env.rs);`
  return glue + '\n' + readFileSync(join(here, 'shim.js'), 'utf8').replace(/\r\n/g, '\n').replace('__RUST_WASM__', () => wasm.toString('base64')).replace('__TWIN__', () => wrapped)
}
