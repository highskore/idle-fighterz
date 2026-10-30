// Screenshots of the widget's page (node build.mjs --widget first) with its hud, panels and popups open, each without
// and with html.win, the Windows text colours: CI renders them on Windows in Edge, the engine under WebView2.
// Run: node test/browser/widget-shots.mjs [out dir, default shots/widget]; PW_CHANNEL picks the browser (msedge on CI)
import { mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const out = process.argv[2] || 'shots/widget'
mkdirSync(out, { recursive: true })
const html = readFileSync('dist/index.html', 'utf8')
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined })

// the page as the app shows it, the hud always up, with a stand-in for the app's commands
async function open(hash, layout = 7) {
  const ctx = await browser.newContext({ viewport: { width: 400, height: 400 } })
  const p = await ctx.newPage()
  await p.route('**/*', r => new URL(r.request().url()).pathname === '/' ? r.fulfill({ contentType: 'text/html', body: html }) : r.abort())
  await p.addInitScript(layout => {
    let s = 1; Math.random = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296
    const conf = { layout, hud: 'always', opacity: 1, mode: 'floating', notify: {}, quiet: {}, fps: 30, clouds: 'never' }
    window.__TAURI__ = { core: { invoke: cmd => Promise.resolve(cmd === 'get_settings' ? conf : null) }, event: { listen: () => Promise.resolve(() => {}) } }
  }, layout)
  await p.goto('http://widget.localhost/' + hash)
  await p.evaluate(() => document.fonts.ready)
  await p.waitForTimeout(2000)
  return p
}
const shot = async (p, name) => {
  for (const win of [false, true]) {
    await p.evaluate(win => document.documentElement.classList.toggle('win', win), win)
    await p.screenshot({ path: join(out, `${name}-${win ? 'after' : 'before'}.png`) })
  }
}
const click = (p, sel) => p.evaluate(sel => document.querySelector(sel).click(), sel).then(() => p.waitForTimeout(400))

for (const layout of [7, 1, 2, 3, 6]) {
  const p = await open('#kaio', layout)
  await shot(p, `hud-${layout}`)
  await click(p, '#shopToggle'); await shot(p, `upgrades-${layout}`)
  await p.context().close()
}
{
  const p = await open('')
  // as ui.event, held up for the shot
  await p.evaluate(() => { const t = document.getElementById('toast'); t.textContent = 'beam struggle! tap fast to push it back'; t.classList.add('on'); }); await p.waitForTimeout(600)
  await shot(p, 'toast'); await p.context().close()
}
{
  const p = await open('#seeds')
  await click(p, '#menuBtn'); await shot(p, 'menu-achievements')
  for (const t of ['chars', 'angels']) if (await p.locator(`[data-mt="${t}"]:visible`).count()) { await click(p, `[data-mt="${t}"]`); await shot(p, 'menu-' + t) }
  await click(p, '#ascTree'); await shot(p, 'menu-tree')
  await p.context().close()
}
{ const p = await open('#shenron'); await p.waitForTimeout(6000); await shot(p, 'wish'); await p.context().close() }
await browser.close()
console.log('widget screenshots in', out, 'from', process.env.PW_CHANNEL || 'chromium', 'on', process.platform)
