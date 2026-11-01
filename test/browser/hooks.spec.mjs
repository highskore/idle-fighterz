// Every preview hook the Rust engine takes (rust/planet-core/src/hooks.txt, the list Game::preview reads its keys from),
// played for 15 game seconds: no uncaught exception, no console error and no blocked request
import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
import { open, start, play } from './page.mjs'

const list = readFileSync(new URL('../../rust/planet-core/src/hooks.txt', import.meta.url), 'utf8')
const HOOKS = list.split('\n').filter(l => l.startsWith('#')).map(l => l.split(/\s/)[0])

test('hooks.txt has preview hooks', () => expect(HOOKS.length).toBeGreaterThan(50))

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
