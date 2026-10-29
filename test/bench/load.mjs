// How soon the site page shows its title and its game, JS against ?rust, in Chromium: navigation to the first draw of the
// 3D title (its first WebGL draw to the screen) and to the first game frame on the card (the first putImageData), over a local
// server that sends brotli as a CDN does, with and without DevTools' Fast 4G and a 4× CPU slowdown. The median of
// --runs loads each, cache cleared. Needs a build with the Rust engine (npm run wasm:rust && node build.mjs).
//
// Usage: node test/bench/load.mjs [--dist dist] [--runs 5] [--shot ki.png]
// --dist measures another build (say, main's); --shot also loads ?rust with its wasm held back, presses start, and saves a
// screenshot of the card while the engine is still on its way (the ki-charging indicator).
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { loadavg, cpus } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliCompressSync, constants } from 'node:zlib'
import { chromium } from '@playwright/test'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1] }
const DIST = resolve(ROOT, arg('dist', 'dist')), RUNS = +arg('runs', 5), SHOT = arg('shot')

const br = b => brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } })
const files = {
  '/': ['text/html', br(readFileSync(join(DIST, 'planet.html')))],
  '/planet-rust.js': ['text/javascript', br(readFileSync(join(DIST, 'planet-rust.js')))],
  '/planet-rust.wasm': ['application/wasm', br(readFileSync(join(DIST, 'planet-rust.wasm')))],
}
const server = createServer((req, res) => {
  const f = files[req.url.split('?')[0]]
  if (!f) { res.writeHead(404); return res.end() }
  res.writeHead(200, { 'content-type': f[0], 'content-encoding': 'br', 'cache-control': 'no-store' }); res.end(f[1])
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const ORIGIN = `http://127.0.0.1:${server.address().port}`

// DevTools' presets (front_end/core/sdk/NetworkManager.ts)
const FAST_4G = { offline: false, downloadThroughput: 9e6 / 8 * .9, uploadThroughput: 1.5e6 / 8 * .9, latency: 60 * 2.75 }

// the first WebGL draw onto the title's canvas itself (not the environment map three.js renders first), and the first frame put on the game's
const init = () => {
  const B = window.__load = { title: 0, game: 0 }
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext].filter(Boolean)) for (const k of ['drawElements', 'drawArrays']) {
    const f = C.prototype[k]
    C.prototype[k] = function (...a) { if (!B.title && this.canvas.id === 'logo' && !this.getParameter(this.FRAMEBUFFER_BINDING)) B.title = performance.now(); return f.apply(this, a) }
  }
  const put = CanvasRenderingContext2D.prototype.putImageData
  CanvasRenderingContext2D.prototype.putImageData = function (...a) { if (!B.game && this.canvas.closest('#game')) B.game = performance.now(); return put.apply(this, a) }
}

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
async function load(rust, net, cpu) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true })
  const page = await ctx.newPage(), cdp = await ctx.newCDPSession(page)
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  if (net) await cdp.send('Network.emulateNetworkConditions', net)
  if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu })
  await page.addInitScript(init)
  await page.goto(ORIGIN + '/' + (rust ? '?rust' : ''), { waitUntil: 'commit' })
  await page.waitForFunction(() => window.__load.title && window.__load.game, null, { timeout: 60000 })
  const r = await page.evaluate(() => ({ ...window.__load, dcl: performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd, engine: document.documentElement.dataset.engine || 'js' }))
  if (rust && r.engine !== 'rust') throw new Error('?rust ran game.js')
  await ctx.close()
  return r
}

const med = a => [...a].sort((x, y) => x - y)[a.length >> 1]
const l0 = loadavg()
console.log(`| network, CPU | engine | DCL ms | title visible ms | first game frame ms |\n|---|---|---|---|---|`)
for (const [name, net, cpu] of (RUNS ? [['Fast 4G, 4× CPU', FAST_4G, 4], ['no throttling', null, 1]] : [])) for (const rust of [false, true]) {
  const rs = []
  for (let i = 0; i < RUNS; i++) rs.push(await load(rust, net, cpu))
  console.log(`| ${name} | ${rust ? 'Rust' : 'JS'} | ${med(rs.map(r => r.dcl)).toFixed(0)} | ${med(rs.map(r => r.title)).toFixed(0)} | ${med(rs.map(r => r.game)).toFixed(0)} |`)
}
console.log(`\nmedian of ${RUNS}, ${DIST}; load average ${l0.map(x => x.toFixed(1)).join(' ')} before, ${loadavg().map(x => x.toFixed(1)).join(' ')} after (${cpus().length} cpus)`)

if (SHOT) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  // the wasm held back 8s, as on a link slow enough that the player presses start before it's in
  let release; const held = new Promise(r => { release = r })
  await page.route('**/planet-rust.wasm*', async r => { await Promise.race([held, new Promise(x => setTimeout(x, 8000))]); r.continue() })
  await page.goto(ORIGIN + '/?rust', { waitUntil: 'load' })
  await page.locator('#cue').click()
  await page.waitForTimeout(1800)
  await page.locator('#play').click()
  await page.waitForTimeout(600)
  const shown = await page.evaluate(() => !!document.querySelector('#game .stage > canvas[aria-hidden]'))
  await page.locator('#game').screenshot({ path: SHOT })
  release()
  await page.waitForSelector('html[data-engine="rust"]', { state: 'attached' })
  await page.waitForTimeout(300)
  const gone = await page.evaluate(() => !document.querySelector('#game .stage > canvas[aria-hidden]') && document.getElementById('game').classList.contains('playing'))
  console.log(`indicator ${shown ? 'shown' : 'NOT shown'} while the engine loads, ${gone ? 'gone and the game started' : 'STILL THERE or the game did not start'} once it's in: ${SHOT}`)
  await ctx.close()
}
await browser.close(); server.close()
