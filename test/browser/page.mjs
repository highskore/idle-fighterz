// Opens dist/planet.html in Chromium with no network: the page carries its fonts and three.js (and ?rust fetches its two
// files from dist). Time is Playwright's fake clock and Math.random is the difftest harness's LCG, so the same steps draw
// the same pixels.
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
// a .localhost host keeps the preview hooks on (game.js's HASH) without running a server
export const ORIGIN = 'http://planet.localhost'
// rust/difftest/harness.js's wall clock: 2026-10-28 12:00 UTC
export const EPOCH = 1793188800000

export const SIZES = {
  desktop: { viewport: { width: 1280, height: 800 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
}

// before any page script, over the fake clock: the harness's LCG (planet-core's Lcg) as Math.random; performance.now
// counted from EPOCH and animation frames as 16ms timers on the fake clock (its own origin and frame phase drift with the
// real page load); and
// the card always in view, since the clock yields between timers and an IntersectionObserver callback would land on
// whichever game frame the real browser had reached
const init = ([seed, epoch]) => {
  let s = seed >>> 0 || 1; Math.random = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
  const now = () => Date.now() - epoch
  performance.now = now; window.requestAnimationFrame = f => setTimeout(() => f(now()), 16); window.cancelAnimationFrame = id => clearTimeout(id)
  window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
}

// the page and the Rust engine's files, and nothing else; with no title, without its three.js, so the title falls back as
// it does without WebGL (and three.js's start-up draws nothing from the seeded Math.random)
export const RUST_FILES = { '/planet-rust.js': 'text/javascript', '/planet-rust.wasm': 'application/wasm' }
const serve = title => async route => {
  const url = new URL(route.request().url())
  if (url.origin !== ORIGIN) return route.abort('blockedbyclient')
  if (RUST_FILES[url.pathname]) return route.fulfill({ contentType: RUST_FILES[url.pathname], body: readFileSync(join(ROOT, 'dist', url.pathname)) })
  if (url.pathname !== '/') return route.abort('blockedbyclient')
  const html = readFileSync(join(ROOT, 'dist', 'planet.html'), 'utf8')
  return route.fulfill({ contentType: 'text/html', body: title ? html : html.replace(/<script id="three">[\s\S]*?<\/script>/, '') })
}

// whether dist has the ?rust engine (a wasm build was there when build.mjs ran)
export const hasRust = () => existsSync(join(ROOT, 'dist', 'planet-rust.wasm'))

// errors collects every uncaught exception, console.error and blocked request; rust opens the page with ?rust and waits
// for its engine
export async function open(page, hash = '', { seed = 1, title = true, rust = false } = {}) {
  const errors = []
  page.on('pageerror', e => errors.push('pageerror: ' + (e.stack || e.message)))
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()) })
  page.on('requestfailed', r => errors.push('request failed: ' + r.url()))
  await page.route('**/*', serve(title))
  await page.clock.install({ time: EPOCH })
  await page.clock.pauseAt(EPOCH + 1000)
  await page.addInitScript(init, [seed, EPOCH])
  await page.goto(ORIGIN + '/' + (rust ? '?rust' : '') + hash, { waitUntil: 'load' })
  if (rust) await page.waitForSelector('html[data-engine="rust"]', { state: 'attached' })
  await page.evaluate(() => Promise.all(['16px "Fragment Mono"', 'italic 16px "Fragment Mono"', '16px "Instrument Serif"', 'italic 16px "Instrument Serif"', '16px "Press Start 2P"'].map(f => document.fonts.load(f))))
  await settle(page)
  return errors
}

// past the intro (scrolled on a desktop, the cue pressed on a phone), then press start
export async function start(page) {
  const phone = await page.evaluate(() => innerWidth <= 760)
  if (phone) await page.locator('#cue').click()
  else await page.evaluate(() => scrollTo(0, document.getElementById('scroller').offsetHeight))
  await settle(page)
  await page.clock.runFor(1500)
  await page.locator('#play').click()
}

// real time for the browser's own events (layout, ResizeObserver, scroll) to land while the game clock stands still
const settle = page => page.waitForTimeout(250)

// game time passes in fixed 16ms animation frames
export const play = (page, ms) => page.clock.runFor(ms)
