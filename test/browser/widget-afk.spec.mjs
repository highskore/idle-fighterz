// The widget's afk close (widget.js): a panel the game opens with no input, as a wish's ki seeds open the tree while the
// player is away, still closes after a minute, counted from when it opened. Builds the widget page (dist/index.html)
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'
import { EPOCH } from './page.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
test.use({ launchOptions: { args: ['--mute-audio'] } })

let html
test.beforeAll(({}, info) => { test.skip(info.project.name !== 'desktop', 'the widget has one size of window here'); execFileSync('node', ['build.mjs', '--widget'], { cwd: ROOT }); html = readFileSync(join(ROOT, 'dist', 'index.html'), 'utf8') })

test('a ki tree the game opens with no input closes a minute after it opened', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 400 })
  await page.route('**/*', r => new URL(r.request().url()).pathname === '/' ? r.fulfill({ contentType: 'text/html', body: html }) : r.abort())
  await page.clock.install({ time: EPOCH })
  await page.addInitScript(() => {
    let s = 1; Math.random = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
    HTMLMediaElement.prototype.play = () => Promise.resolve()
    // the app in the background: the menu focusing its close button moves no focus, so nothing wakes the hud
    HTMLElement.prototype.focus = () => {}
    const conf = { layout: 7, hud: 'hover', opacity: 1, mode: 'floating', notify: {}, quiet: {}, fps: 30, clouds: 'never' }
    window.__TAURI__ = { core: { invoke: cmd => Promise.resolve(cmd === 'get_settings' ? conf : null) }, event: { listen: () => Promise.resolve(() => {}) }, window: { getCurrentWindow: () => ({ startDragging() {} }) } }
  })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('http://widget.localhost/#treegift70')
  const tree = () => page.evaluate(() => !document.getElementById('menu').hidden && document.getElementById('menu').classList.contains('tree-only'))
  // the gift lands 70.9 s in, over a minute after the last input: it isn't closed at once
  await page.clock.runFor(72000)
  expect(await tree()).toBe(true)
  await page.clock.runFor(50000)
  expect(await tree()).toBe(true)
  await page.clock.runFor(12000)
  expect(await tree()).toBe(false)
  // and nothing opens it again
  await page.clock.runFor(10000)
  expect(await tree()).toBe(false)
  expect(errors).toEqual([])
})
