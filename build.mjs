// Builds public/planet.html — the whole homepage as one self-contained file — from the sources in planet/.
// The root route is rewritten to it in next.config.js. Run: pnpm build:planet
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const read = f => readFileSync(join(here, f), 'utf8')

const page = read('page.html')
  .replace('__BAGEL__', () => read('bagel.typeface.json'))
  .replace('__WORLD__', () => read('world.js'))
  .replace('__PLANET__', () => read('shenron.js') + read('game.js'))
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

writeFileSync(join(here, '..', 'public', 'planet.html'), head + page.slice(0, split) + '\n</head>\n<body>\n' + page.slice(split) + '\n</body>\n</html>\n')
console.log('public/planet.html written')
