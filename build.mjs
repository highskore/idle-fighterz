// Builds dist/planet.html — the whole highskore.com homepage as one self-contained file — from the sources here.
// Run: node build.mjs (highskore.com copies the result to its public/planet.html).
// With --widget it builds the desktop widget's page instead, into dist/index.html under the directory it runs from
// (the root of highskore/idle-fighterz-widget, which has this repo as its game/ submodule)
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
page = widget ? await widgetPage(page) : await sitePage(page)
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
  writeFileSync(join(out, 'index.html'), '<!doctype html>\n<html lang="en" class="widget">\n<head>\n<meta charset="utf-8">\n<title>Idle FighterZ</title>\n' + page.slice(0, split) + '\n</head>\n<body>\n' + page.slice(split) + '\n</body>\n</html>\n')
  console.log(join(out, 'index.html'), 'written')
} else {
  mkdirSync(join(here, 'dist'), { recursive: true })
  writeFileSync(join(here, 'dist', 'planet.html'), head + page.slice(0, split) + '\n</head>\n<body>\n' + page.slice(split) + '\n</body>\n</html>\n')
  console.log(rust ? 'dist/planet.html written (the Rust core)' : 'dist/planet.html written')
}

// the site page fetches nothing before it can play: the fonts are inlined, cut down to the characters the page has (hints
// kept: Linux and Windows use them); three.js is bundled with just what the title uses, after the game's
// script; and the scripts are minified. Only this output is: the difftest reads the sources
async function sitePage(page) {
  let esbuild, subset
  try { esbuild = await import('esbuild'); subset = (await import('subset-font')).default } catch (_) { throw new Error('the site build minifies and subsets its fonts: run npm ci in ' + here + ' first') }
  page = page.replace(/<link [^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\n/g, '')
  let ascii = ''; for (let c = 32; c < 127; c++) ascii += String.fromCharCode(c)
  const text = [...new Set(ascii + page)].join('')   // all of ascii too, for numbers and names put together at run time
  page = page.replace('<style>', '<style>\n' + await faces(here, 'swap', woff2 => subset(woff2, text, { targetFormat: 'woff2' })))
  for (const [all, code] of [...page.matchAll(/<script>\n([\s\S]*?)<\/script>/g)]) {
    const min = (await esbuild.transform(code, { loader: 'js', format: 'iife', minify: true, charset: 'utf8', legalComments: 'none' })).code.trim()
    page = page.replace(all, () => '<script>' + min + '</script>')
  }
  // window.THREE with the names the page reads from it; one it doesn't export fails the build
  const used = [...new Set([...page.matchAll(/\bTHREE\.(\w+)/g)].map(m => m[1]))].sort()
  const examples = { FontLoader: 'loaders/FontLoader.js', TextGeometry: 'geometries/TextGeometry.js', RoomEnvironment: 'environments/RoomEnvironment.js' }
  const core = used.filter(k => !examples[k])
  const entry = `import { ${core.join(', ')} } from 'three'\n` + used.filter(k => examples[k]).map(k => `import { ${k} } from 'three/examples/jsm/${examples[k]}'\n`).join('') + `window.THREE = { ${used.join(', ')} }\n`
  const three = (await esbuild.build({ stdin: { contents: entry, resolveDir: here }, bundle: true, format: 'iife', minify: true, charset: 'utf8', legalComments: 'none', write: false, logLevel: 'error' })).outputFiles[0].text.trim()
  if (three.includes('</script')) throw new Error('three.js bundle closes its script tag')
  return page.replace('<script id="three">__THREE__</script>', () => '<script id="three">' + three + '</script>')
}

// the widget runs offline and has no title, so no three.js, and the fonts are inlined from @fontsource (installed with
// the widget's own dependencies, in node_modules where it runs)
async function widgetPage(page) {
  page = page.replace('__WIDGET_CSS__', () => read('widget.css')).replace('__WIDGET_JS__', () => read('widget.js'))
  page = page.replace(/<link [^>]*fonts\.(googleapis|gstatic)\.com[^>]*>\n/g, '').replace('<script id="three">__THREE__</script>\n', '')
  if (/<(script|link)[^>]+(src|href)="https?:/.test(page)) throw new Error('the widget page still loads something remote')
  return page.replace('<style>', '<style>\n' + await faces(process.cwd(), 'block'))
}

// the faces the page shows (fragment mono's italic never does), from @fontsource in dir's node_modules
async function faces(dir, display, cut = woff2 => woff2) {
  const fonts = [['Fragment Mono', 'fragment-mono', 'normal'], ['Instrument Serif', 'instrument-serif', 'normal'], ['Instrument Serif', 'instrument-serif', 'italic'], ['Press Start 2P', 'press-start-2p', 'normal']]
  return (await Promise.all(fonts.map(async ([family, pkg, style]) => {
    const file = join(dir, 'node_modules', '@fontsource', pkg, 'files', `${pkg}-latin-400-${style}.woff2`)
    return `@font-face { font-family: "${family}"; font-style: ${style}; font-weight: 400; font-display: ${display}; src: url(data:font/woff2;base64,${Buffer.from(await cut(readFileSync(file))).toString('base64')}) format("woff2"); }`
  }))).join('\n')
}
