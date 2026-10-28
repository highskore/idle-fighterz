// Builds dist/planet.html — the whole highskore.com homepage as one self-contained file — from the sources here.
// Run: node build.mjs (highskore.com copies the result to its public/planet.html).
// With --widget it builds the desktop widget's page instead, into dist/index.html under the directory it runs from
// (the root of highskore/powerrr, which has this repo as its game/ submodule)
// With --rust the planet runs on the Rust core (rust/planet-web, built first with sh rust/planet-web/build.sh) behind the
// same HTML HUD; game.js stays in the page only to draw, in lockstep, until the Rust renderer lands (rust/HUD.md)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rustPlanet } from './rust/planet-web/assemble.mjs'

const here = dirname(fileURLToPath(import.meta.url))
// a Windows checkout may have CRLF sources: everything below matches on \n, and the output must not depend on it
const read = f => readFileSync(join(here, f), 'utf8').replace(/\r\n/g, '\n')

const widget = process.argv.includes('--widget')
const rust = process.argv.includes('--rust')
if (rust && widget) throw new Error('--rust builds the site page; the widget gets the Rust core natively (stage 5)')
// widget-only code is fenced by /*widget*/…/*/widget*/: the site build drops it whole, so its output is unchanged
const fence = s => s.replace(/\/\*widget\*\/([\s\S]*?)\/\*\/widget\*\//g, widget ? '$1' : '')

let page = fence(read('page.html'))
  .replace('__BAGEL__', () => read('bagel.typeface.json'))
  .replace('__WORLD__', () => fence(read('world.js')).replace('__PX__', () => readFileSync(join(here, 'wasm', 'px.wasm')).toString('base64')))
  .replace('__PLANET__', () => rust ? rustPlanet(read, fence) : read('shenron.js') + fence(read('game.js')))
if (widget) page = widgetPage(page)
const split = page.indexOf('</style>') + '</style>'.length

const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover">
<title>highskore</title>
<meta name="description" content="a smart contract developer portfolio">
<meta property="og:description" content="a smart contract developer portfolio">
<meta name="twitter:description" content="a smart contract developer portfolio">
<meta name="twitter:title" content="highskore">
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/static/favicons/favicon-32x32.png" sizes="32x32">
<link rel="icon" href="/static/favicons/favicon-16x16.png" sizes="16x16">
<link rel="apple-touch-icon" href="/static/favicons/apple-touch-icon.png">
<link rel="manifest" href="/static/favicons/site.webmanifest">
<meta property="og:title" content="highskore">
<meta property="og:site_name" content="highskore">
<meta property="og:url" content="https://highskore.com">
<meta property="og:type" content="website">
<meta property="og:image" content="https://highskore.com/static/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="highskore">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://highskore.com/static/og.png">
<meta name="twitter:site" content="@0xhighskore">
`

if (widget) {
  const out = join(process.cwd(), 'dist')
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'index.html'), '<!doctype html>\n<html lang="en" class="widget">\n<head>\n<meta charset="utf-8">\n<title>powerrr</title>\n' + page.slice(0, split) + '\n</head>\n<body>\n' + page.slice(split) + '\n</body>\n</html>\n')
  console.log(join(out, 'index.html'), 'written')
} else {
  mkdirSync(join(here, 'dist'), { recursive: true })
  writeFileSync(join(here, 'dist', 'planet.html'), head + page.slice(0, split) + '\n</head>\n<body>\n' + page.slice(split) + '\n</body>\n</html>\n')
  console.log(rust ? 'dist/planet.html written (the Rust core)' : 'dist/planet.html written')
}

// the widget runs offline: no CDN three.js (only the title used it, and the widget has no title), and the
// fonts are inlined from @fontsource (installed with the widget's own dependencies, in node_modules where it runs) instead of google fonts
function widgetPage(page) {
  page = page.replace('__WIDGET_CSS__', () => read('widget.css')).replace('__WIDGET_JS__', () => read('widget.js'))
  page = page.replace(/<link [^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\n/g, '').replace(/<script src="https:[^"]*"><\/script>\n/g, '')
  if (/<(script|link)[^>]+(src|href)="https?:/.test(page)) throw new Error('the widget page still loads something remote')
  const fonts = [['Fragment Mono', 'fragment-mono', 'normal'], ['Instrument Serif', 'instrument-serif', 'normal'], ['Instrument Serif', 'instrument-serif', 'italic'], ['Press Start 2P', 'press-start-2p', 'normal']]
  const faces = fonts.map(([family, pkg, style]) => {
    const file = join(process.cwd(), 'node_modules', '@fontsource', pkg, 'files', `${pkg}-latin-400-${style}.woff2`)
    return `@font-face { font-family: "${family}"; font-style: ${style}; font-weight: 400; font-display: block; src: url(data:font/woff2;base64,${readFileSync(file).toString('base64')}) format("woff2"); }`
  }).join('\n')
  return page.replace('<style>', '<style>\n' + faces)
}
