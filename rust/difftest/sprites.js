// Bakes every sprite game.js builds at load (makeSprite, shapeSprite and the rest, but the heroes) into
// planet-core/data/sprites.bin, so planet-render draws the same pixels without re-running the paint programs.
// Usage: node rust/difftest/sprites.js            (rewrites the file)
//        node rust/difftest/sprites.js --check    (exits 1 if the baked file is stale)
const fs = require('fs'), path = require('path'), vm = require('vm')
const mount = require('./harness')
const ROOT = path.join(__dirname, '..', '..')
const OUT = process.argv.includes('--heroes') ? process.argv[process.argv.indexOf('--heroes') + 1] : path.join(__dirname, '..', 'planet-core', 'data', 'sprites.bin')

const g = mount({ seed: 1 })
const src = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'shenron.js'), 'utf8')
const names = [...new Set([...src.matchAll(/^(?:const|let) ([A-Za-z_$][\w$]*) =/gm)].map(m => m[1]))]
const isSpr = o => o && typeof o === 'object' && typeof o.w === 'number' && typeof o.h === 'number' && o.col && o.col.constructor && o.col.constructor.name === 'Int32Array'
const seen = new Map(), list = [], alias = []   // alias: [path, canonical path] for a sprite reached a second way (VILLAINS.0.spr is RADITZ)
function walk(o, name, depth) {
  if (!o || typeof o !== 'object' || depth > 6) return
  if (isSpr(o)) { if (!seen.has(o)) { seen.set(o, name); list.push([name, o]) } else alias.push([name, seen.get(o)]); return }
  if (seen.has(o)) return
  seen.set(o, name)
  if (ArrayBuffer.isView(o)) return
  for (const k of Object.keys(o)) { let v; try { v = o[k] } catch (_) { continue } walk(v, name + '.' + k, depth + 1) }
}
// HEROES is left out: planet-core builds the hero sets itself (sprite::make_hero), checked against game.js by test
const heroesOnly = process.argv.includes('--heroes')   // the test's reference for make_hero: HEROES alone, to a given file
if (heroesOnly) walk(vm.runInContext('HEROES', g.ctx), 'HEROES', 0)
else for (const n of names.filter(n => n !== 'HEROES')) { let v; try { v = vm.runInContext(n, g.ctx) } catch (_) { continue } walk(v, n, 0) }
if (!heroesOnly) for (const n of ['puff']) walk(g.ev(n), n, 0)   // built inside mount()

// per sprite: name, w, h, ax, ay, its palette (distinct colours), then one palette index a pixel (0 = transparent),
// with bit 7 set on pixels that emit light
const parts = [], u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b }, u16 = n => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b }, i16 = n => { const b = Buffer.alloc(2); b.writeInt16LE(n); return b }
parts.push(Buffer.from('SPR1'), u32(list.length))
for (const [name, s] of list) {
  const pal = [], idx = new Map(), px = Buffer.alloc(s.w * s.h)
  for (let k = 0; k < s.w * s.h; k++) {
    const c = s.col[k]; if (c < 0) continue
    if (!idx.has(c)) { idx.set(c, pal.length + 1); pal.push(c) }
    px[k] = idx.get(c) | (s.emit[k] ? 128 : 0)
  }
  if (pal.length > 127) throw new Error(name + ': too many colours')
  const nb = Buffer.from(name)
  parts.push(u16(nb.length), nb, u16(s.w), u16(s.h), i16(s.ax), i16(s.ay), u16(pal.length), ...pal.map(u32), px)
}
// then the aliases: name, and the name it is another path to
parts.push(u32(alias.length))
for (const [a, b] of alias) { const x = Buffer.from(a), y = Buffer.from(b); parts.push(u16(x.length), x, u16(y.length), y) }
const out = Buffer.concat(parts)
if (process.argv.includes('--check')) { const old = fs.existsSync(OUT) ? fs.readFileSync(OUT) : Buffer.alloc(0); if (!old.equals(out)) { console.error('sprites.bin is stale: run node rust/difftest/sprites.js'); process.exit(1) } console.log('sprites.bin up to date'); }
else { fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, out); console.log(`${list.length} sprites, ${out.length} bytes`) }
