// Writes a golden scenario's script, rust/golden/<name>.inputs.json: the seed, the start and every input frame by frame,
// as game.js's drawn run of the scenario applied them (rust/difftest/run.js <name>+draw). The golden traces replay these
// in Rust, so they don't change when Rust's behaviour does; only a new or changed scenario needs this. game.js takes
// minutes to draw a long one, so a trace it already wrote (rust/target/difftest/<name>+draw-*.json) can be passed instead.
// Usage: node rust/golden/script.mjs <name> [trace.json]
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const [name, from] = process.argv.slice(2)
if (!name) throw new Error('usage: node rust/golden/script.mjs <name> [trace.json]')
const tr = JSON.parse(from ? readFileSync(from, 'utf8') : execFileSync('node', [join(here, '..', 'difftest', 'run.js'), name + '+draw'], { maxBuffer: 1 << 30, encoding: 'utf8' }))
if (tr.name !== name + '+draw') throw new Error(`${from} is ${tr.name}'s trace, not ${name}+draw's`)
const { seed, calm, dt, frames, today, epoch, saved } = tr
// one input a line, so a changed script reads as a diff
const head = JSON.stringify({ name, seed, calm, dt, frames, today, epoch, saved })
writeFileSync(join(here, name + '.inputs.json'), head.slice(0, -1) + ',"inputs":[\n' + tr.inputs.map(i => JSON.stringify(i)).join(',\n') + '\n]}\n')
console.log(`rust/golden/${name}.inputs.json: ${tr.inputs.length} inputs over ${frames} frames`)
