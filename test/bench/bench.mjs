// JS against Rust in real browsers: every scene played on dist/planet.html and dist/planet.html?rust, headless, over a
// local server, in Chromium and WebKit, at desktop size and as a throttled phone. Needs a build with the Rust engine
// (npm run wasm:rust && node build.mjs). Writes test/bench/results.json and prints a markdown table.
//
// Time is real (frame pacing is the point), and Math.random is the test harness's seeded LCG, so both engines play the
// same game from the same start. The 3D title is left out (it's WebGL, the same for both engines, and in software
// rendering it would swamp the game); everything else is the shipped page.
//
// Usage: node test/bench/bench.mjs [--browsers chromium,webkit] [--profiles desktop,phone] [--scenes home,raid,...]
//        [--secs 6] [--throttle 4]
// WebKit comes from @playwright/test unless PLANET_BENCH_WEBKIT names another playwright-core package (one whose
// WebKit is installed).
import { createServer } from 'node:http'
import { readFileSync, writeFileSync } from 'node:fs'
import { loadavg, cpus } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium, webkit as pwWebkit } from '@playwright/test'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i < 0 ? d : process.argv[i + 1] }
const BROWSERS = arg('browsers', 'chromium,webkit').split(',')
const PROFILES = arg('profiles', 'desktop,phone').split(',')
const SECS = +arg('secs', 6), THROTTLE = +arg('throttle', 4)

// [name, hash, what the player does every 3s while it's measured]
const SCENES = [
  ['home', '', null],
  ['raid', '#raid', null],
  ['big bang', '#raid', 'bigbang'],
  ['struggle', '#struggle', null],
  ['snake way', '#snake', null],
  ['shenron', '#shenron', null],
  ['late form', '#mui', null],
  ['multiverse', '#top', null],
].filter(s => !arg('scenes') || arg('scenes').split(',').includes(s[0].replace(' ', '')))

const PROFILE = {
  desktop: { viewport: { width: 1280, height: 800 } },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
}

// the page without its 3D title, and the Rust engine's two files
const html = readFileSync(join(ROOT, 'dist', 'planet.html'), 'utf8').replace(/<script id="three">[\s\S]*?<\/script>/, '')
const files = { '/planet-rust.js': 'text/javascript', '/planet-rust.wasm': 'application/wasm' }
const server = createServer((req, res) => {
  const path = req.url.split('?')[0]
  if (path === '/') { res.writeHead(200, { 'content-type': 'text/html' }); return res.end(html) }
  if (files[path]) { res.writeHead(200, { 'content-type': files[path] }); return res.end(readFileSync(join(ROOT, 'dist', path))) }
  res.writeHead(404); res.end()
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const ORIGIN = `http://127.0.0.1:${server.address().port}`   // a dev host: game.js's preview hooks are on

// before the page: the seeded Math.random, and a watch on animation frames (each one's time, and how long the callback
// that drew the game took) and on the canvas (the first frame drawn)
const init = () => {
  let s = 1; Math.random = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
  const B = window.__bench = { on: false, ticks: [], work: [], puts: 0, firstPut: 0 }
  const raf = window.requestAnimationFrame.bind(window)
  window.requestAnimationFrame = cb => raf(ts => {
    const p = B.puts, t0 = performance.now(); cb(ts); const t1 = performance.now()
    if (!B.on) return
    if (B.ticks[B.ticks.length - 1] !== ts) B.ticks.push(ts)
    if (B.puts !== p) B.work.push(t1 - t0)
  })
  const put = CanvasRenderingContext2D.prototype.putImageData
  CanvasRenderingContext2D.prototype.putImageData = function (...a) { B.puts++; if (!B.firstPut) B.firstPut = performance.now(); return put.apply(this, a) }
}

const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p / 100 * s.length))] : NaN }
const mean = a => a.reduce((x, y) => x + y, 0) / a.length
const worst1 = a => { const s = [...a].sort((x, y) => y - x); return mean(s.slice(0, Math.max(1, Math.ceil(s.length / 100)))) }

async function run(browser, name, profile, rust, scene) {
  const [, hash, act] = scene
  const ctx = await browser.newContext(PROFILE[profile])
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  const cdp = name === 'chromium' ? await ctx.newCDPSession(page) : null
  if (cdp) {
    await cdp.send('Performance.enable')
    if (profile === 'phone') await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
  }
  await page.addInitScript(init)
  await page.goto(ORIGIN + '/' + (rust ? '?rust' : '') + hash, { waitUntil: 'load' })
  await page.waitForFunction(() => window.__bench.firstPut > 0)
  const load = await page.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return { dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd, tti: window.__bench.firstPut } })
  if (rust && await page.evaluate(() => document.documentElement.dataset.engine) !== 'rust') throw new Error('?rust ran game.js')
  // past the intro and press play, as page.mjs does
  if (profile === 'phone') await page.locator('#cue').click()
  else await page.evaluate(() => scrollTo(0, document.getElementById('scroller').offsetHeight))
  await page.waitForTimeout(1500)
  await page.locator('#play').click()
  await page.waitForTimeout(2000)

  const box = await page.locator('.stage canvas').boundingBox()
  const tap = async () => {
    const x = box.x + box.width * .5, y = box.y + box.height * .35
    for (let i = 0; i < 2; i++) { if (profile === 'phone') await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); await page.waitForTimeout(60) }
  }
  const metrics = async () => cdp ? Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value])) : null
  const m0 = await metrics(), w0 = Date.now()
  await page.evaluate(() => { window.__bench.on = true })
  for (let t = 0; t < SECS; t += 3) { if (act === 'bigbang') await tap(); await page.waitForTimeout(Math.min(3, SECS - t) * 1000) }
  await page.evaluate(() => { window.__bench.on = false })
  const m1 = await metrics(), wall = (Date.now() - w0) / 1000
  const B = await page.evaluate(() => window.__bench)

  // the display's interval is the median gap; a gap of n intervals dropped n - 1 frames
  const gaps = B.ticks.slice(1).map((t, i) => t - B.ticks[i]), vsync = pct(gaps, 50)
  const dropped = gaps.reduce((n, g) => n + Math.max(0, Math.round(g / vsync) - 1), 0)
  let heap = null, wasm = null
  if (rust) wasm = await page.evaluate(() => self.planetRust.memory.buffer.byteLength)
  if (cdp) {
    await cdp.send('HeapProfiler.collectGarbage')
    const h = await cdp.send('Runtime.getHeapUsage')
    heap = { js: h.usedSize, buffers: h.backingStorageSize }
  }
  const r = {
    browser: name, profile, engine: rust ? 'rust' : 'js', scene: scene[0], errors,
    load, frames: B.work.length, fps: B.work.length / wall,
    work: { mean: mean(B.work), p95: pct(B.work, 95), p99: pct(B.work, 99), worst1: worst1(B.work) },
    vsync, dropped, droppedPct: 100 * dropped / (gaps.length + dropped),
    busy: 100 * B.work.reduce((x, y) => x + y, 0) / (wall * 1000),
    cpu: m0 && m1 ? 100 * (m1.TaskDuration - m0.TaskDuration) / wall : null,
    heap, wasm,
  }
  await ctx.close()
  return r
}

async function launch(name) {
  if (name === 'chromium') return chromium.launch()
  const pkg = process.env.PLANET_BENCH_WEBKIT
  return (pkg ? (await import(pathToFileURL(join(pkg, 'index.mjs')).href)).webkit : pwWebkit).launch()
}

const results = []
const load0 = loadavg()
console.error(`machine: ${cpus().length} cpus, ${cpus()[0].model}; load ${load0.map(l => l.toFixed(1)).join(' ')}`)
for (const name of BROWSERS) {
  const browser = await launch(name)
  const version = browser.version()
  for (const profile of PROFILES) for (const scene of SCENES) for (const rust of [false, true]) {
    const r = await run(browser, name, profile, rust, scene)
    r.version = version
    results.push(r)
    console.error(`${name} ${profile} ${r.engine} ${r.scene}: ${r.work.mean.toFixed(2)} ms/frame (p95 ${r.work.p95.toFixed(2)}), ${r.fps.toFixed(1)} fps, ${r.dropped} dropped${r.errors.length ? ', ERRORS ' + r.errors.join('; ') : ''}`)
  }
  await browser.close()
}
server.close()
const load1 = loadavg()
writeFileSync(join(ROOT, 'test', 'bench', 'results.json'), JSON.stringify({ when: new Date().toISOString(), cpus: cpus().length, cpu: cpus()[0].model, load: [load0, load1], secs: SECS, throttle: THROTTLE, results }, null, 1) + '\n')

// the table: one row per browser, profile and scene, JS and Rust side by side
const f = (v, d = 2) => v == null || Number.isNaN(v) ? 'n/a' : v.toFixed(d)
const mb = v => v == null ? 'n/a' : (v / 1048576).toFixed(1)
console.log(`| browser | profile | scene | ms/frame mean JS / Rust | p95 | p99 | worst 1% | dropped % | busy % |`)
console.log(`|---|---|---|---|---|---|---|---|---|`)
for (let i = 0; i < results.length; i += 2) {
  const [j, r] = [results[i], results[i + 1]], both = g => `${g(j)} / ${g(r)}`
  console.log(`| ${j.browser} | ${j.profile} | ${j.scene} | ${both(x => f(x.work.mean))} | ${both(x => f(x.work.p95))} | ${both(x => f(x.work.p99))} | ${both(x => f(x.work.worst1))} | ${both(x => f(x.droppedPct, 1))} | ${both(x => f(x.busy, 1))} |`)
}
console.log(`\n| browser | profile | load: DCL ms JS / Rust | first frame (TTI) ms | idle CPU % (home) | JS heap MB | array buffers MB | wasm memory MB |`)
console.log(`|---|---|---|---|---|---|---|---|`)
for (const b of BROWSERS) for (const p of PROFILES) {
  const home = results.filter(r => r.browser === b && r.profile === p && r.scene === 'home'), [j, r] = home
  if (!j) continue
  const both = g => `${g(j)} / ${g(r)}`
  console.log(`| ${b} | ${p} | ${both(x => f(x.load.dcl, 0))} | ${both(x => f(x.load.tti, 0))} | ${both(x => f(x.cpu ?? x.busy, 1))} | ${both(x => mb(x.heap?.js))} | ${both(x => mb(x.heap?.buffers))} | ${mb(r.wasm)} |`)
}
console.log(`\nload average ${load0.map(l => l.toFixed(1)).join(' ')} before, ${load1.map(l => l.toFixed(1)).join(' ')} after (${cpus().length} cpus)`)
