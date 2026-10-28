// Every preview hook in game.js (each marked "// preview hook"), played for 15 game seconds: no uncaught exception, no
// console error and no blocked request
import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { open, start, play } from './page.mjs'

const game = readFileSync(new URL('../../game.js', import.meta.url), 'utf8')
const HOOKS = [...new Set(game.split('\n').flatMap(l => (l.match(/preview hooks?: (.*)/) || ['', ''])[1].match(/#[\w=.-]+/g) || []))].sort()

test('game.js has preview hooks', () => expect(HOOKS.length).toBeGreaterThan(50))

for (const hook of HOOKS) {
  test(hook, async ({ page }) => {
    const errors = await open(page, hook, { title: false })
    await start(page)
    for (let s = 0; s < 15; s++) await play(page, 1000)
    expect(errors).toEqual([])
  })
}

// the pearl title (three.js on WebGL) is stubbed out above: software WebGL takes seconds a frame. Here it runs for real
test('the 3D title', async ({ page }) => {
  const errors = await open(page)
  await play(page, 1000)
  expect(await page.locator('#logo').isHidden()).toBe(false)
  expect(errors).toEqual([])
})
