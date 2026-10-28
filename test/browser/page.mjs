// Opens dist/planet.html in Chromium with no network: the page, its Google Fonts (from @fontsource) and three.js (from
// node_modules) are all served from disk. Time is Playwright's fake clock and Math.random is the difftest harness's LCG,
// so the same steps draw the same pixels.
import { readFileSync } from 'node:fs'
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

const nm = p => join(ROOT, 'node_modules', p)
const FONT_CSS = ['fragment-mono/400.css', 'fragment-mono/400-italic.css', 'instrument-serif/400.css', 'instrument-serif/400-italic.css', 'press-start-2p/400.css']
  .map(f => readFileSync(nm('@fontsource/' + f), 'utf8').replaceAll('url(./files/', `url(${ORIGIN}/fontsource/${f.split('/')[0]}/files/`)).join('\n')
const THREE = 'https://cdn.jsdelivr.net/npm/three@0.147.0/'

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

const serve = title => async route => {
  const url = route.request().url()
  if (!title && url.startsWith(THREE)) return route.fulfill({ contentType: 'text/javascript', body: '' })
  const file = url.startsWith(ORIGIN + '/fontsource/') ? nm('@fontsource/' + url.slice(ORIGIN.length + 12))
    : url.startsWith(THREE) ? nm('three/' + url.slice(THREE.length))
    : url.split('#')[0] === ORIGIN + '/' ? join(ROOT, 'dist', 'planet.html') : null
  if (url.startsWith('https://fonts.googleapis.com/')) return route.fulfill({ contentType: 'text/css', body: FONT_CSS })
  if (!file) return route.abort('blockedbyclient')
  const type = file.endsWith('.html') ? 'text/html' : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.woff2') ? 'font/woff2' : 'font/woff'
  return route.fulfill({ contentType: type, body: readFileSync(file) })
}

// errors collects every uncaught exception, console.error and blocked request
export async function open(page, hash = '', { seed = 1, title = true } = {}) {
  const errors = []
  page.on('pageerror', e => errors.push('pageerror: ' + (e.stack || e.message)))
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()) })
  page.on('requestfailed', r => errors.push('request failed: ' + r.url()))
  await page.route('**/*', serve(title))
  await page.clock.install({ time: EPOCH })
  await page.clock.pauseAt(EPOCH + 1000)
  await page.addInitScript(init, [seed, EPOCH])
  await page.goto(ORIGIN + '/' + hash, { waitUntil: 'load' })
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
