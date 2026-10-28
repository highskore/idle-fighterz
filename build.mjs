// Builds public/planet.html — the whole homepage as one self-contained file — from the sources in planet/.
// The root route is rewritten to it in next.config.js. Run: pnpm build:planet
// With --widget it builds the desktop widget's page instead (desktop/dist/index.html): see desktop/README.md
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const read = f => readFileSync(join(here, f), 'utf8')

const widget = process.argv.includes('--widget')
// widget-only code is fenced by /*widget*/…/*/widget*/: the site build drops it whole, so its output is unchanged
const fence = s => s.replace(/\/\*widget\*\/([\s\S]*?)\/\*\/widget\*\//g, widget ? '$1' : '')

let page = fence(read('page.html'))
  .replace('__BAGEL__', () => read('bagel.typeface.json'))
  .replace('__WORLD__', () => read('world.js'))
  .replace('__PLANET__', () => read('shenron.js') + fence(read('game.js')))
if (widget) page = widgetPage(page)
const split = page.indexOf('</style>') + '</style>'.length

const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
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
  const out = join(here, '..', 'desktop', 'dist')
  mkdirSync(out, { recursive: true })
  writeFileSync(join(out, 'index.html'), '<!doctype html>\n<html lang="en" class="widget">\n<head>\n<meta charset="utf-8">\n<title>power planet</title>\n' + page.slice(0, split) + '\n</head>\n<body>\n' + page.slice(split) + '\n</body>\n</html>\n')
  console.log('desktop/dist/index.html written')
} else {
  writeFileSync(join(here, '..', 'public', 'planet.html'), head + page.slice(0, split) + '\n</head>\n<body>\n' + page.slice(split) + '\n</body>\n</html>\n')
  console.log('public/planet.html written')
}

// the widget runs offline: no CDN three.js (only the title used it, and the widget has no title), and the
// fonts are inlined from @fontsource (installed with desktop/'s dependencies) instead of google fonts
function widgetPage(page) {
  page = page.replace('__WIDGET_CSS__', () => read('widget.css')).replace('__WIDGET_JS__', () => read('widget.js'))
  page = page.replace(/<link [^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\n/g, '').replace(/<script src="https:[^"]*"><\/script>\n/g, '')
  if (/<(script|link)[^>]+(src|href)="https?:/.test(page)) throw new Error('the widget page still loads something remote')
  const fonts = [['Fragment Mono', 'fragment-mono', 'normal'], ['Instrument Serif', 'instrument-serif', 'normal'], ['Instrument Serif', 'instrument-serif', 'italic'], ['Press Start 2P', 'press-start-2p', 'normal']]
  const faces = fonts.map(([family, pkg, style]) => {
    const file = join(here, '..', 'desktop', 'node_modules', '@fontsource', pkg, 'files', `${pkg}-latin-400-${style}.woff2`)
    return `@font-face { font-family: "${family}"; font-style: ${style}; font-weight: 400; font-display: block; src: url(data:font/woff2;base64,${readFileSync(file).toString('base64')}) format("woff2"); }`
  }).join('\n')
  return page.replace('<style>', '<style>\n' + faces)
}
