// Pixel baselines: each state is played the same way on the fake clock and the seeded Math.random, then compared with
// test/browser/__screenshots__/<size>/. The game canvas must match exactly; the whole page may differ by a shade where
// Chromium rasterises text and rounded corners (seen as ±2 levels on the card's corners between identical runs).
// Every run also writes what it rendered to shots/<size>/, named as the baselines are (CI uploads it; copied over
// __screenshots__ it is a new baseline set). PLANET_SHOTS_ONLY=1 (npm run shots) skips the comparison, for a machine
// that isn't CI's Linux. The page runs the Rust engine (game.js without a wasm build in dist). game.js's fallback gets a
// smoke test (tagged @js): home with ?js and without WebAssembly must match the same canvas baseline, as game.js is
// frozen; the page gets its own (js-home, no-wasm-home), since game.js still counts snake way's parked achievements.
import { mkdirSync, writeFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { open, start, play } from './page.mjs'

const SHOTS_ONLY = !!process.env.PLANET_SHOTS_ONLY
// the WebGL title is stubbed out (see hooks.spec.mjs), so its no-WebGL fallback heading is hidden too
const HIDE_TITLE = '#brand, #brand * { visibility: hidden !important; }'

const playUntil = async (page, selector, max = 20000) => {
  for (let t = 0; t < max && !(await page.locator(selector).isVisible()); t += 250) await play(page, 250)
  await expect(page.locator(selector)).toBeVisible()
  await play(page, 500)
}
const openShop = async page => { if (await page.locator('#shopToggle').isVisible()) await page.locator('#shopToggle').click() }

const WORLDS = ['namek', 'vegeta', 'snake', 'beerus', 'westcity', 'kame', 'paozu', 'future', 'lookout', 'kaiworld', 'yardrat', 'top']
const STATES = [
  ['home', '', page => play(page, 6000)],
  ...WORLDS.map(w => [`world-${w}`, '#' + w, page => play(page, 8000)]),
  ['shop', '#form4#kaio', async page => { await play(page, 3000); await openShop(page); await play(page, 500) }],
  ['hud', '#buffs#kaio#spirit#galick', page => play(page, 4000)],
  ['itx', '#itx', page => playUntil(page, '#wish.itxp:not([hidden])')],
  ['wish', '#shenron', page => playUntil(page, '#wish:not([hidden])')],
  ['ascend', '#mui', async page => { await play(page, 2000); await openShop(page); await page.locator('[data-buy="ascend"]').click(); await play(page, 500) }],
  ['menu', '', async page => { await play(page, 2000); await page.locator('.hud [data-menu]').click(); await play(page, 500) }],
  ['menu-chars', '', async page => { await play(page, 2000); await page.locator('.hud [data-menu]').click(); await page.locator('[data-mt="chars"]').click(); await play(page, 500) }],
  ['tree', '#seeds', async page => { await play(page, 2000); await openShop(page); await page.locator('[data-buy="ascend"]').click(); await page.locator('#ascTree').click(); await play(page, 500) }],
  ['angels', '#godki', async page => { await play(page, 2000); await page.locator('.hud [data-menu]').click(); await page.locator('[data-mt="angels"]').click(); await play(page, 500) }],
]

const RUNS = [
  ...STATES.map(s => ['', s, {}]),
  ['js ', STATES[0], { js: true }],
  ['no-wasm ', STATES[0], { wasm: false }],
]
for (const [pre, [name, hash, act], how] of RUNS) {
  test(pre + name, { tag: pre ? '@js' : [] }, async ({ page }, info) => {
    const errors = await open(page, hash, { title: false, ...how })
    await start(page)
    await act(page)
    await page.addStyleTag({ content: HIDE_TITLE })
    const shot = await page.screenshot({ animations: 'disabled', caret: 'hide' })
    // the canvas's own pixels, at its size, before the page scales it up
    const canvas = Buffer.from((await page.evaluate(() => document.querySelector('.stage canvas').toDataURL('image/png'))).split(',')[1], 'base64')
    const dir = `shots/${info.project.name}`
    mkdirSync(dir, { recursive: true })
    const as = pre.replace(' ', '-') + name
    writeFileSync(`${dir}/${as}.png`, shot)
    writeFileSync(`${dir}/${as}-canvas.png`, canvas)
    expect(errors).toEqual([])
    if (SHOTS_ONLY) return
    expect(canvas).toMatchSnapshot(`${name}-canvas.png`, { threshold: 0, maxDiffPixels: 0 })
    await expect(page).toHaveScreenshot(`${pre ? as : name}.png`, { animations: 'disabled', caret: 'hide', threshold: 0.02, maxDiffPixels: 0 })
  })
}
