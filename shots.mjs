// node shots.mjs <outdir> <name=hash[@ms]>... : desktop and phone page shots per state (SIZES env picks)
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { open, start, play, SIZES } from './test/browser/page.mjs'
const [out, ...specs] = process.argv.slice(2)
const sizes = (process.env.SIZES || 'desktop,phone').split(',')
mkdirSync(out, { recursive: true })
const HIDE = '#brand, #brand * { visibility: hidden !important; }'
const browser = await chromium.launch()
for (const spec of specs) {
  const [name, rest] = spec.split('=')
  const [hash, ms] = rest.split('@')
  for (const size of sizes) {
    const ctx = await browser.newContext(SIZES[size])
    const page = await ctx.newPage()
    const errors = await open(page, hash, { title: false })
    await start(page)
    await play(page, +(ms || 8000))
    await page.addStyleTag({ content: HIDE })
    writeFileSync(`${out}/${name}-${size}.png`, await page.screenshot({ animations: 'disabled', caret: 'hide' }))
    if (errors.length) console.log(name, size, errors.slice(0, 3))
    await ctx.close()
  }
  console.log('done', name)
}
await browser.close()
