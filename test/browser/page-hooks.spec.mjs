// The page's input and the Rust engine's shim (rust/planet-web/shim.js): pointer capture, keys on focused buttons,
// popups' focus, and a trap in the engine
import { test, expect } from '@playwright/test'
import { open, start, play, hasRust } from './page.mjs'

test.skip(!hasRust(), 'the Rust engine is not built')

// the canvas's pixels, summed with their positions
const canvasSum = page => page.evaluate(() => { const c = document.querySelector('.stage canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let s = 0; for (let i = 0; i < d.length; i += 4) s = (s + d[i] * ((i >> 2) % 97 + 1) + d[i + 1] * 3) % 1e15; return s })

test('a drag released off the canvas does not leave hovering spinning the planet', async ({ browser, isMobile }) => {
  test.skip(isMobile, 'a mouse drag')
  // the same game twice, each on a page of its own (the fake clock is the context's)
  const run = async hover => {
    const page = await (await browser.newContext({ viewport: test.info().project.use.viewport })).newPage()
    await open(page, '', { title: false })
    await start(page)
    await play(page, 1000)
    await expect(page.locator('#intro')).toBeHidden()   // its fade runs on real time; until then it's over the canvas
    const r = await page.locator('.stage canvas').boundingBox(), cx = r.x + r.width * .6, cy = r.y + r.height * .5
    // pressed on the canvas, dragged off it and released over the page
    await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx, cy + 10); await page.mouse.move(cx, r.y + r.height + 40); await page.mouse.move(r.x + r.width / 2, r.y - 40); await page.mouse.up()
    if (hover) for (let i = 0; i < 30; i++) { await page.mouse.move(cx - 150 + i * 10, cy); await play(page, 16) }
    else await play(page, 30 * 16)
    await play(page, 500)
    return canvasSum(page)
  }
  const still = await run(false)
  expect(await run(true)).toBe(still)
})

test('space presses a focused button', async ({ page }) => {
  const errors = await open(page, '', { title: false })
  await start(page)
  await play(page, 1000)
  const gear = page.locator('#gear:visible, #gearM:visible').first()
  await gear.focus()
  await page.keyboard.press(' ')
  await expect(page.locator('#setBox')).toBeVisible()
  expect(errors).toEqual([])
})

test('settings take focus and hand it back', async ({ page }) => {
  const errors = await open(page, '', { title: false })
  await start(page)
  await play(page, 1000)
  const gear = page.locator('#gear:visible, #gearM:visible').first()
  await gear.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#setX')).toBeFocused()
  await expect(page.locator('#setBody')).toContainText('sound')
  await page.keyboard.press('Escape')
  await expect(page.locator('#setBox')).toBeHidden()
  await expect(gear).toBeFocused()
  expect(errors).toEqual([])
})

// the settings panel's hero row: a carousel over menu().chars, picking through game.pick
const openSettings = async page => { await page.locator('#gear:visible, #gearM:visible').first().click(); await expect(page.locator('#setBox')).toBeVisible() }
const centre = page => page.locator('.car .mid .hb')

test('the hero row steps with the arrow keys and picks with Enter', async ({ page }) => {
  const errors = await open(page, '', { title: false })
  await start(page)
  await play(page, 1000)
  await openSettings(page)
  const name = page.locator('.hero .cname')
  await expect(name).toContainText('vegeta')
  await expect(name).toContainText('playing')
  await expect(page.locator('.hero .fstrip i')).toHaveCount(11)   // vegeta's ladder: the nine, then his two late forms
  await expect(page.locator('.hero .fstrip .now')).toHaveText('base')
  await centre(page).focus()
  await page.keyboard.press('ArrowRight')   // goku waits for super saiyan
  await expect(name).toContainText('goku')
  await expect(name).toContainText('unlock: ')
  await expect(page.locator('.hero .fstrip')).toHaveClass(/off/)
  await expect(centre(page)).toHaveAttribute('aria-disabled', 'true')
  await expect(centre(page)).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(name).toContainText('unlock: ')   // a locked hero can't be picked
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight')
  await expect(name).toContainText('krillin')
  await expect(name).toContainText('pick to play')
  await page.keyboard.press('Enter')
  await expect(name).toContainText('playing')
  await expect(centre(page)).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('.hero .fstrip i').first()).toHaveText('base')
  await expect(page.locator('.hero .fstrip i').nth(1)).toHaveText('unlocked potential')   // his own names for the marks
  await page.keyboard.press('ArrowLeft')
  await expect(name).toContainText('trunks')
  expect(errors).toEqual([])
})

test("a locked hero's unlock shows only on its card, never in a line of its own", async ({ page, isMobile }) => {
  const errors = await open(page, '', { title: false })
  await start(page)
  await play(page, 1000)
  await openSettings(page)
  await expect(page.locator('.hero .cname')).not.toContainText('unlock')
  await expect(page.locator('.hero .lines')).not.toContainText('unlock')
  const goku = page.locator('.car .side .hb[data-step="1"]')
  if (isMobile) await expect(page.locator('.car .what').first()).toBeHidden()
  else {
    await goku.hover()
    await expect(goku.locator('xpath=..').locator('.what')).toBeVisible()
    await expect(goku.locator('xpath=..').locator('.what')).toContainText('unlock: ')
  }
  await goku.click()   // stepping onto him
  await expect(page.locator('.hero .cname')).toContainText('unlock: ')
  expect(errors).toEqual([])
})

test('a hero picked mid-transformation waits, and the row says why', async ({ page }) => {
  const errors = await open(page, '#form1xform', { title: false })
  await start(page)
  await play(page, 300)
  await openSettings(page)
  for (let i = 0; i < 4; i++) await page.locator('.car .arr[data-step="1"]').click()
  await expect(page.locator('.hero .cname')).toContainText('krillin')
  await centre(page).click()
  await expect(page.locator('.car .mid.no')).toBeVisible()
  await expect(page.locator('.hero .hno')).toContainText("krillin — he's mid-transformation")
  await expect(centre(page)).toHaveAttribute('aria-pressed', 'false')
  await page.locator('.car .arr[data-step="1"]').click()   // stepping on clears it
  await expect(page.locator('.hero .hno')).toHaveCount(0)
  expect(errors).toEqual([])
})

test("the hero row runs on game.js's fallback, without the ladder it doesn't have", { tag: '@js' }, async ({ page }) => {
  const errors = await open(page, '', { title: false, js: true })
  await start(page)
  await play(page, 1000)
  await openSettings(page)
  await expect(page.locator('.hero .cname')).toContainText('vegeta')
  await expect(page.locator('.hero .fstrip')).toHaveCount(0)
  await page.locator('.car .arr[data-step="-1"]').click()   // game.js has the first four: trunks, behind vegeta
  await expect(page.locator('.hero .cname')).toContainText('future trunks')
  expect(errors).toEqual([])
})

test('a swipe steps the hero row on phones', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'a touch swipe')
  const errors = await open(page, '', { title: false })
  await start(page)
  await play(page, 1000)
  await openSettings(page)
  const r = await page.locator('.car').boundingBox(), y = r.y + r.height / 2
  const swipe = async (from, to) => {
    await page.locator('.car').dispatchEvent('pointerdown', { pointerType: 'touch', clientX: from, clientY: y, isPrimary: true })
    await page.locator('.car').dispatchEvent('pointerup', { pointerType: 'touch', clientX: to, clientY: y, isPrimary: true })
  }
  await swipe(r.x + r.width * .7, r.x + r.width * .3)
  await expect(page.locator('.hero .cname')).toContainText('goku')
  await swipe(r.x + r.width * .3, r.x + r.width * .7)
  await expect(page.locator('.hero .cname')).toContainText('vegeta')
  await expect(page.locator('.hero .lines')).toContainText('galick gun')   // the playstyle, in a line on touch
  expect(errors).toEqual([])
})

test('the menu takes focus and hands it back', async ({ page }) => {
  const errors = await open(page, '', { title: false })
  await start(page)
  await play(page, 1000)
  const btn = page.locator('.hud [data-menu]')
  await btn.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#menuX')).toBeFocused()
  // locked characters say so, and stay focusable for their unlock hint
  await page.locator('[data-mt="chars"]').click()
  const locked = page.locator('#menuBody .char.locked').first()
  await expect(locked).toHaveAttribute('aria-disabled', 'true')
  await locked.focus()
  await expect(locked).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('#menu')).toBeHidden()
  await expect(btn).toBeFocused()
  expect(errors).toEqual([])
})

test('a trap in the engine stops the game and says so', async ({ page }) => {
  const errors = await open(page, '', { title: false })
  await start(page)
  await play(page, 1000)
  const calls = await page.evaluate(() => {
    const P = planetRust.game, n = { calls: 0 }
    P.frame_drawn = () => { n.calls++; throw new WebAssembly.RuntimeError('unreachable') }
    window.__trap = n
    return n.calls
  })
  expect(calls).toBe(0)
  await play(page, 500)
  const r = await page.locator('.stage canvas').boundingBox()
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2)
  await page.keyboard.press(' ')
  await play(page, 500)
  expect(await page.evaluate(() => __trap.calls)).toBe(1)
  await expect(page.locator('#toast')).toContainText('reload')
  expect(errors).toEqual([expect.stringContaining('the Rust engine stopped')])
})

test('a trap while mounting runs game.js instead', async ({ page }) => {
  // the engine's first draw traps, inside mount
  await page.addInitScript(() => {
    let fn
    Object.defineProperty(window, 'planetRust', {
      configurable: true, get: () => fn,
      set: f => { fn = f; wasm_bindgen.Planet.prototype.draw_with_rust = () => { throw new WebAssembly.RuntimeError('unreachable') } },
    })
  })
  const errors = await open(page, '', { title: false, engine: 'js' })
  await start(page)
  await play(page, 3000)
  expect(await page.locator('#game').getAttribute('class')).toContain('playing')
  expect(errors).toEqual([])
})
