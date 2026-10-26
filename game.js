/* Power planet: an idle game on a tiny 3D pixel planet.
   Everything solid (planet, dome huts, trees, bushes, orbs) is a sphere rasterised with a
   depth buffer and shaded in dithered palette tones, so it all turns correctly when you
   drag the planet. Characters are sprites drawn against the same depth buffer.
   The kid runs laps on his own; clicks make him sprint; upgrades and timed events pile up. */
function vnoise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const s = t => t * t * (3 - 2 * t), u = s(xf), v = s(yf), w = s(zf);
  const H = (a, b, c) => h2(a * 73 + c * 151, b * 37 - c * 17), l = (a, b, t) => a + (b - a) * t;
  return l(l(l(H(xi, yi, zi), H(xi + 1, yi, zi), u), l(H(xi, yi + 1, zi), H(xi + 1, yi + 1, zi), u), v), l(l(H(xi, yi, zi + 1), H(xi + 1, yi, zi + 1), u), l(H(xi, yi + 1, zi + 1), H(xi + 1, yi + 1, zi + 1), u), v), w);
}
const V = {
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  add: (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k],
  mul: (a, k) => [a[0] * k, a[1] * k, a[2] * k],
};
const M3 = {
  I: () => [1, 0, 0, 0, 1, 0, 0, 0, 1],
  mul: (a, b) => [0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => { const r = (i / 3) | 0, c = i % 3; return a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]; }),
  ap: (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]],
  apT: (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]],
  rx: a => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; },
  ry: a => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; },
  ortho: m => { let a = V.norm([m[0], m[1], m[2]]); const b0 = [m[3], m[4], m[5]], d = V.dot(a, b0), b = V.norm([b0[0] - a[0] * d, b0[1] - a[1] * d, b0[2] - a[2] * d]); return [...a, ...b, ...V.cross(a, b)]; },
};

/* hero in the Vegeta style: flame hair with a widow's peak, scouter over one eye, blue bodysuit, white armour with gold shoulders, white gloves and boots */
const KID = (() => {
  const base = { o: 0x120c18, h: 0x1a1826, H: 0x4a5080, s: 0xf6c8a2, S: 0xd99a73, e: 0x120c18, m: 0xa8564e, b: 0x2b4fc8, B: 0x1c3584, a: 0xf4f4f6, A: 0xc2c6d2, y: 0xe8c040, Y: 0xa8841a, g: 0xffffff, G: 0xc8ccda, w: 0xffffff, W: 0xc8ccda, E: 0x120c18, L: 0x34d873, l: 0xc8ffd8, k: 0xdfe3ea, K: 0x8e95a4, M: 0x5e2824, r: 0xffffff };
  const head = ['......o...o.....', '.....oho.oho....', '....ohHo.oHho...', '....ohHhohHhho..', '...ohhHhhhhhho..', '...ohhhhhhhhho..', '...ohhhhhhhhhho.', '....ohhhhhhhhho.', '....ohhhhhhhhKo.', '....ohhsshsshko.', '....ohEEssEEhko.', '....osrEEsLLLko.', '....osssssLlLko.', '....oSssMMsSoK..', '.....oSsssSo....', '......ooSSoo....'];
  const idle = ['...oyyobbbbyyo..', '..oyyyoaaaaoyyo.', '..oYYoaaaaaAoYo.', '..obboaaaaaAobo.', '..obboaaaaaAobo.', '..oggoaaaaaAogo.', '..oGgoBaaaAAoGo.', '...oo.oBbbbBo.o.', '......obbbbBo...', '.....obbo.obBo..', '.....obbo.obBo..', '.....obbo.obBo..', '.....owwo.owWo..', '....owwwo.owwWo.', '....ooooo.ooooo.'];
  const runA = ['...oyyobbbbyyo..', '..oyyyoaaaaoyyo.', '.oYYoaaaaaaAoYYo', 'oggoaaaaaaaAobbo', 'oGgoaaaaaaaAobbo', '.oo.aaaaaaaAoggo', '....oBaaaaAAoGo.', '....oBbbbbBo.oo.', '....obbbbbbBo...', '...obbbo..obBBo.', '..obbo.....obBo.', '.obbo.......obBo', 'owwo........owWo', 'owwwo.......owwo', 'ooooo........ooo'];
  const runB = ['...oyyobbbbyyo..', '..oyyyoaaaaoyyo.', '..oYYoaaaaaAoYo.', '...ooaaaaaaAobo.', '...oaaaaaaaAobo.', '...ogoaaaaaAogo.', '...oGoBaaaAAoGo.', '....o.oBbbbBo...', '......obbbbBo...', '......obbbBo....', '......obbBo.....', '......obbBoo....', '......obbBowwo..', '.....owwwowwo...', '.....oooooooo...'];
  const runC = ['...oyyobbbbyyo..', '..oyyyoaaaaoyyo.', '.oYYoaaaaaaAoYYo', 'oggoaaaaaaaAobbo', 'oGgoaaaaaaaAobbo', '.oo.aaaaaaaAoggo', '....oBaaaaAAoGo.', '.oo.oBbbbbBo....', '...oBbbbbbbo....', '.oBBbo..obbbo...', '.oBbo.....obbo..', 'oBbo.......obbo.', 'oWwo........owwo', 'owwo.......owwwo', 'ooo........ooooo'];
  const set = pal => ({ idle: makeSprite(head.concat(idle), pal, { emit: 'Ll' }), run: [runA, runB, runC, runB].map(b => makeSprite(head.concat(b), pal, { emit: 'Ll' })) });
  // long hair down the back for super saiyan 3: fill the columns behind him (he faces right)
  // gold III: a thick spiky mane down his back (he faces right, so it flows off the left side)
  const longHair = rows => {
    const pad = rows.map(r => '....' + r.padEnd(16, '.'));
    const g = pad.map(r => [...r]);
    for (let j = 1; j < g.length - 3; j++) {
      const first = g[j].findIndex(c => c !== '.'); if (first < 0) continue;
      const w = j < 4 ? 2 : j < 12 ? 5 : Math.max(2, Math.round(5 - (j - 12) * .45));
      const jag = (j % 3 === 0) ? 1 : 0;
      for (let c = first - 1; c >= Math.max(1, first - w - jag); c--) if (g[j][c] === '.') g[j][c] = (c === first - 2 && j % 2) ? 'H' : 'h';
      const edge = g[j].findIndex(c => c !== '.'); if (edge > 0 && j < g.length - 4) g[j][edge - 1] = 'o';
    }
    return g.map(r => r.join(''));
  };
  const setLong = pal => ({ idle: makeSprite(longHair(head.concat(idle)), pal, { emit: 'Ll', ax: 12 }), run: [runA, runB, runC, runB].map(b => makeSprite(longHair(head.concat(b)), pal, { emit: 'Ll', ax: 12 })) });
  const hair = (h, H) => Object.assign({}, base, { h, H });
  const forms = [set(base), set(hair(0xffe02e, 0xfffbc8)), set(hair(0xffe640, 0xfffde0)), setLong(hair(0xffe02e, 0xfffbc8)), set(hair(0xd8344a, 0xff8a8a)), set(hair(0x3fb8ff, 0xc8f2ff)), set(hair(0x6a2fc8, 0xc49cff)), set(Object.assign({}, base, { a: 0xc8302a, A: 0x8a1f1a })), set(hair(0xd8dce8, 0xffffff))];
  // fused with Bubbles: monkey ears and tail, Potara earrings, an orange fusion vest, fur-brown streaks in the hair
  const fuse = rows => rows.map((r, j) => {
    const g = [...r];
    const put = (i, c) => { if (g[i] === '.') g[i] = c; };
    if (j >= 8 && j <= 11) { put(3, j === 8 || j === 11 ? 'o' : 'q'); put(2, j === 9 || j === 10 ? 'o' : '.'); }   // ear
    if (j === 12) { put(3, 'y'); put(2, 'o'); } if (j === 13) put(3, 'Y');                                                // earring
    const b = j - head.length;                                                                                           // tail, curling off his back
    if (b === 6) { put(2, 'o'); put(1, 'o'); } if (b === 7) { put(2, 'T'); put(1, 'T'); put(0, 'o'); } if (b === 8) { put(1, 'T'); put(0, 'o'); put(2, 'o'); }
    if (b === 9) { put(1, 'T'); put(0, 'o'); put(2, 'T'); put(3, 'o'); } if (b === 10) { put(2, 'o'); put(1, 'o'); }
    return g.join('');
  });
  const fusedPal = Object.assign({}, base, { a: 0xf28a1c, A: 0xc0601a, H: 0x8a5a36, q: 0xf0c9a0, T: 0x8a5a36 });
  const fused = { idle: makeSprite(fuse(head.concat(idle)), fusedPal, { emit: 'Ll' }), run: [runA, runB, runC, runB].map(b => makeSprite(fuse(head.concat(b)), fusedPal, { emit: 'Ll' })) };
  return { forms, fused, black: forms[0], gold: forms[1] };
})();
/* great ape: the full-moon form, giant, armoured, red-eyed */
const APE = (() => {
  const pal = { o: 0x1a0f0a, f: 0x7a4a2a, F: 0x553018, l: 0xa0683a, s: 0xe8b48a, S: 0xc08460, r: 0xff2a2a, w: 0xffffff, a: 0xf2f2f2, A: 0xc2c6d2, y: 0xe8c040, Y: 0xa8841a, b: 0x2b4fc8, B: 0x1c3584 };
  const top = ['.......ooooo..........', '.....oofflffoo........', '....offfllffffo.......', '...offfffffffffo......', '..offfffffsssssfo.....', '..offffFFsrssrsso.....', '..offfffssssssssso....', '..offffsswwwswwsSo....', '...offfsSSoooooSSo....', '...offffSSSSSSSo......', '.ooofffffffffffoooo...', 'offyyyfaaaaaafyyyyfo..', 'ofyyyyaaaaaaaayyyyfo..', 'offyYaaaaaaaaAAYyffo..', 'offfoaaaaaaaaAAofffo..', 'offfoaaaaaaaaAAofffo..', 'offfobbbbbbbbbbofffo..', 'osssobbbbbbbbbBossso..', '.oo.offffffffffo.ooo.o', '....offffoooffffo..ofo'];
  return [['....offfo...offfo..ofo', '....offfo...offfo.ofo.', '...offffo...offffoo...', '...ossso.....ossso....', '...ooooo.....ooooo....'], ['.....offfo.offfo...ofo', '.....offfo.offfo..ofo.', '....offffo.offffooo...', '....ossso...ossso.....', '....ooooo...ooooo.....']].map(l => makeSprite(top.concat(l), pal, { emit: 'r' }));
})();
/* the eternal dragon's head and claws (side view, facing right) */
const DRAGON = (() => {
  const pal = { o: 0x0a2410, g: 0x2a8a36, G: 0x1a5e26, l: 0x4cb84c, L: 0x9be27a, c: 0xf2e6c0, C: 0xb8a77a, r: 0xff2a2a, R: 0xffd0d0, m: 0x5a0f12, t: 0xffffff, y: 0xf2c84a, b: 0xf2d48a };
  return { head: makeSprite(['........cc.......cc...................', '.......cCc......cCc...................', '......cCc......cCc....................', '.....oCco.....oCco....................', '....ogggoooooogggoo...................', '...ogglllgggggglllggoo................', '..ogglLLllggggglLlgggoo...............', '.oggggllllggggglllggggggoo............', 'oGgggggggggoooggggggggggggoooo........', 'oGGggggggggoRrogggggggggggggggoo......', 'oGGGggggggggoooggggggggggggllllggo....', 'oGGGGgggggggggggggggggggggggggggggo...', '.oGGGGggggggggggmmmmmmmmmmmmmmmmmmo...', '..oGGGGgggggggmtmtmtmtmtmtmtmtmmmo....', '...oGGGGGgggggmmmmmmmmmmmmmmmmmo......', '....oGGGGGGgggmtmtmtmtmtmtmmmgggo.....', '.....oGGGGGGGgggbbbbbbbbbbbbggggo.....', '......ooGGGGGGGGbbbbbbbbbbbbGGGo......', '........oooooooooooooooooooooo........'], pal, { emit: 'rR', ax: 6, ay: 10 }), claw: makeSprite(['..oggo..', '.oggggo.', '.ogGGgo.', '..oggo..', '.ocococ.', '.c.c.c..'], pal, { ax: 4, ay: 0 }) };
})();
const MONKEY = [
  makeSprite(['..oooo......', '.obbbbo.....', 'obtttbbo....', 'obtetbbo....', 'obttttbo..o.', '.oobbbbo.obo', '..obbbbboobo', '..obbbbbbbo.', '..obo..obo..', '..oo....oo..'], { o: 0x24140a, b: 0x8a5a36, t: 0xf0c9a0, e: 0x24140a }),
  makeSprite(['..oooo......', '.obbbbo.....', 'obtttbbo....', 'obtetbbo..o.', 'obttttbo.obo', '.oobbbbo.obo', '..obbbbbbbo.', '..obbbbbbo..', '...obo.obo..', '...oo..oo...'], { o: 0x24140a, b: 0x8a5a36, t: 0xf0c9a0, e: 0x24140a }),
];
function makePuff(w, h) {
  const rows = [], puffs = [[.18, .62, .3], [.4, .45, .38], [.62, .5, .34], [.82, .62, .26]];
  for (let j = 0; j < h; j++) { let row = ''; for (let i = 0; i < w; i++) { let inside = false, l = 0; for (const [fx, fy, fr] of puffs) { const dx = (i + .5) / w - fx, dy = ((j + .5) / h - fy) * h / w, r = fr * .5; if (dx * dx + dy * dy < r * r) { inside = true; l = Math.max(l, -(dx * .6 + dy * .9) / r); } } row += !inside || (j + .5) / h > .82 ? '.' : l > .45 ? 'w' : l > .05 ? 'y' : l > -.4 ? 'Y' : 'd'; } rows.push(row); }
  const out = rows.map((r, j) => [...r].map((c, i) => c !== '.' ? c : ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => (rows[j + b] || '')[i + a] && (rows[j + b] || '')[i + a] !== '.') ? 'o' : '.')).join(''));
  return makeSprite(out, { o: 0xb07a1c, d: 0xe9b43c, Y: 0xf7d36b, y: 0xfbe7a3, w: 0xffffff }, { ay: h - 2, emit: 'oYydw' });
}
/* saibamen sprout out of the planet; villains raid it */
const SAIBA = makeSprite(['...ooo...', '..oGgGo..', '.oGgLgGo.', '.ogrgrgo.', '.ogggggo.', '..oGgGo..', '.oogggoo.', 'og.ogo.go', '..ogggo..', '..og.go..', '..oo.oo..'], { o: 0x0d2a12, g: 0x58b848, G: 0x2f7a2a, L: 0xa6e67e, r: 0xd8241e }, { emit: 'r' });
/* frieza (final form) and cell (perfect form), shaped on a grid: light from the top left,
   a darker tone on the right and lower edges, then a dark outline */
function shapeSprite(w, h, paint, pal, shadeOf) {
  const G = SHENRON.kit.grid(w, h); paint(G);
  const g = G.g, at = (x, y) => (g[y] || [])[x] || '.';
  const out = g.map(r => r.slice());
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = g[y][x]; if (shadeOf[c] && (at(x + 1, y) === '.' || at(x, y + 1) === '.' || at(x + 1, y + 1) === '.')) out[y][x] = shadeOf[c]; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y][x] === '.' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => at(x + a, y + b) !== '.')) out[y][x] = 'o';
  return makeSprite(out.map(r => r.join('')), pal, { emit: 'r' });
}
const FRIEZA = shapeSprite(26, 34, G => {
  G.line([[15, 25], [20, 28], [23, 24], [22, 19]], 2.8, 1.5, 'w'); G.ell(22, 19, 1.6, 1.6, 'p');     // tail, curled behind, purple tip
  G.ell(13, 10, 4.4, 4.4, 'w');                                                                      // face
  G.poly([[8, 9.5], [8.4, 5], [10.8, 2.2], [15.2, 2.2], [17.6, 5], [18, 9.5], [16.4, 7.6], [9.6, 7.6]], 'p');   // the shiny dome
  G.set(11, 3, 'q'); G.set(10, 4, 'q'); G.set(12, 3, 'q');                                           // its highlight
  G.set(10, 10, 'r'); G.set(11, 10, 'k'); G.set(15, 10, 'r'); G.set(14, 10, 'k');                    // eyes
  G.rect(12, 12, 3, 1, 'P'); G.rect(11, 14, 5, 2, 'w');                                              // lips, neck
  G.ell(8, 17, 3, 2.3, 'p'); G.ell(18, 17, 3, 2.3, 'p');                                             // shoulder plates
  G.poly([[9, 16], [17, 16], [16, 25], [10, 25]], 'w'); G.ell(13, 19.5, 2.4, 1.8, 'p');              // torso, chest gem
  G.line([[8, 18], [6, 23], [7, 27]], 2.6, 2.2, 'w'); G.line([[18, 18], [20, 23], [19, 27]], 2.6, 2.2, 'w');   // arms
  G.ell(6.4, 23, 1.3, 1.3, 'p'); G.ell(19.6, 23, 1.3, 1.3, 'p');                                     // forearm gems
  G.line([[11, 25], [10, 32]], 3, 2.6, 'w'); G.line([[15, 25], [16, 32]], 3, 2.6, 'w');              // legs
  G.ell(10, 29, 1.3, 1.2, 'p'); G.ell(16, 29, 1.3, 1.2, 'p');                                        // shin gems
}, { o: 0x1d1030, w: 0xf6f4fa, W: 0xb8b0cc, p: 0xa25ae8, P: 0x5a1f8a, q: 0xe6d0ff, r: 0xe0302a, k: 0x2a1840 }, { w: 'W', p: 'P' });
const CELL = shapeSprite(30, 35, G => {
  G.poly([[11, 17], [2, 29], [5, 30], [11, 24]], 'K'); G.poly([[17, 17], [26, 29], [23, 30], [17, 24]], 'K');   // folded wings
  G.poly([[8, 9], [7.5, 3], [9.5, 0], [11, 4], [14, 2.5], [17, 4], [18.5, 0], [20.5, 3], [20, 9]], 'g');          // crest
  G.line([[9.5, .5], [10.8, 5]], 1, 1, 'k'); G.line([[18.5, .5], [17.2, 5]], 1, 1, 'k');
  G.ell(14, 10.5, 3.8, 4.4, 'f');                                                                    // pale face
  G.set(12, 10, 'P'); G.set(16, 10, 'P'); G.set(12, 9, 'k'); G.set(16, 9, 'k');                     // eyes
  G.line([[11, 11], [12, 13]], 1, 1, 'P'); G.line([[17, 11], [16, 13]], 1, 1, 'P');                 // cheek stripes
  G.rect(13, 13, 3, 1, 'k'); G.rect(12, 15, 5, 2, 'g');                                              // mouth, neck
  G.ell(14, 20, 6.5, 4.5, 'g'); G.poly([[10, 22], [18, 22], [17, 27], [11, 27]], 'g');               // chest, waist
  G.poly([[9, 18], [13, 18], [13, 21], [9, 21]], 'k'); G.poly([[15, 18], [19, 18], [19, 21], [15, 21]], 'k');   // black chest plates
  G.line([[8, 19], [6, 24], [7, 28]], 2.6, 2.2, 'g'); G.line([[20, 19], [22, 24], [21, 28]], 2.6, 2.2, 'g');   // arms
  G.line([[12, 27], [11, 33]], 3, 2.6, 'g'); G.line([[16, 27], [17, 33]], 3, 2.6, 'g');              // legs
  G.rect(9, 32, 4, 2, 'k'); G.rect(15, 32, 4, 2, 'k');                                               // boots
  for (const [x, y] of [[10, 23], [17, 24], [13, 25], [8, 20], [20, 20], [12, 29], [16, 30], [14, 22]]) G.set(x, y, 'k');   // spots
}, { o: 0x0d2210, g: 0x7acb5c, G: 0x3f8a3a, k: 0x1a2a1a, K: 0x24342a, f: 0xf2e8f2, F: 0xc8b8d0, P: 0x9a4ad8, r: 0xd03050 }, { g: 'G', f: 'F' });
const KIDBUU = shapeSprite(22, 30, G => {
  G.line([[11, 7], [13, 3], [12, 1]], 2.2, 1.2, 'p');                                               // antenna
  G.ell(11, 10, 3.8, 3.8, 'p'); G.set(9, 10, 'r'); G.set(13, 10, 'r'); G.set(9, 9, 'k'); G.set(13, 9, 'k'); G.rect(10, 12, 3, 1, 'k');   // head, red eyes, grin
  G.ell(11, 18, 4, 3.5, 'p'); G.rect(8, 20, 7, 2, 'y');                                             // body, gold belt
  G.line([[7, 16], [4, 20], [3, 24]], 2.2, 1.8, 'p'); G.line([[15, 16], [18, 19], [19, 15]], 2.2, 1.8, 'p');   // arms, one fist up
  G.poly([[7, 22], [15, 22], [16, 27], [6, 27]], 'w'); G.rect(6, 27, 4, 2, 'k'); G.rect(12, 27, 4, 2, 'k');   // baggy pants, shoes
}, { o: 0x2a0f1a, p: 0xf59ac8, P: 0xc8669a, w: 0xffffff, W: 0xc8c8d8, k: 0x1a1a1a, y: 0xf2c84a, Y: 0xb88a1a, r: 0xd8241e }, { p: 'P', w: 'W', y: 'Y' });
const BEERUS = shapeSprite(26, 34, G => {
  G.poly([[8.5, 7], [7, -1], [11.5, 4]], 's'); G.poly([[17.5, 7], [19, -1], [14.5, 4]], 's');      // tall ears
  G.ell(13, 9, 4.4, 4.6, 's'); G.set(11, 9, 'e'); G.set(15, 9, 'e'); G.set(11, 8, 'k'); G.set(15, 8, 'k'); G.rect(12, 12, 3, 1, 'S');   // head, yellow eyes
  G.rect(9, 14, 9, 2, 'y');                                                                          // gold collar
  G.poly([[9, 16], [17, 16], [16, 23], [10, 23]], 's');                                             // torso
  G.rect(9, 22, 9, 2, 'w'); G.poly([[9, 24], [17, 24], [19, 31], [7, 31]], 'k');                    // white sash, black wrap trousers
  G.rect(8, 26, 11, 1, 'y'); G.rect(7, 31, 5, 2, 'y'); G.rect(14, 31, 5, 2, 'y');                   // gold trim, shoes
  G.line([[17, 28], [22, 30], [23, 26]], 1.6, 1.1, 's');                                            // thin tail
  G.line([[8, 17], [9, 21], [17, 20]], 2.6, 2.2, 'S'); G.line([[18, 17], [17, 21], [9, 20]], 2.6, 2.2, 's'); G.ell(9.5, 20, 1.3, 1.1, 'y');   // arms folded, gold cuff
}, { o: 0x1a1030, s: 0x8a6ad0, S: 0x5e44a0, y: 0xf2c84a, Y: 0xb88a1a, k: 0x1a1a1a, K: 0x34343c, w: 0xf2eee6, W: 0xc0b8a8, e: 0xd8e84a }, { s: 'S', y: 'Y', w: 'W', k: 'K' });
// friends and visitors on the planet
const PICCOLO = shapeSprite(22, 26, G => {
  G.poly([[3, 11], [19, 11], [21, 22], [1, 22]], 'w'); G.ell(6, 11.5, 3, 2, 'w'); G.ell(16, 11.5, 3, 2, 'w');   // cape spread behind, shoulder pads
  G.ell(11, 8, 3.2, 3, 'g'); G.set(10, 8, 'k'); G.set(12, 8, 'k'); G.set(9, 7, 'k'); G.set(13, 7, 'k');       // head, eyes, brows
  G.poly([[8, 8], [5.5, 6], [8, 9.4]], 'g'); G.poly([[14, 8], [16.5, 6], [14, 9.4]], 'g');                     // pointed ears
  G.ell(11, 5.4, 4, 2.6, 'w'); G.rect(7, 6, 9, 1, 'v');                                                         // turban with its purple band
  G.poly([[7.5, 11], [14.5, 11], [15, 19], [7, 19]], 'v'); G.rect(7, 17, 9, 1, 'b');                            // gi, blue sash
  G.line([[7, 14], [15, 14]], 2, 2, 'g');                                                                        // folded arms
  G.ell(11, 20.5, 8, 2.2, 'v'); G.set(3, 20, 'n'); G.set(19, 20, 'n');                                          // crossed legs, shoes
}, { o: 0x0d2a12, w: 0xf6f4ee, W: 0xc8c4b8, v: 0x6a3aa8, V: 0x45227a, g: 0x5cb84a, G: 0x35803a, k: 0x111111, b: 0x3a6ad8, n: 0x7a4a2a }, { w: 'W', v: 'V', g: 'G' });
const KINGKAI = shapeSprite(26, 28, G => {
  G.line([[11, 4], [9, 1], [5, 0]], 1, 1, 'k'); G.line([[15, 4], [17, 1], [21, 0]], 1, 1, 'k');               // long antennae
  G.ell(3.5, 19, 2.2, 3.4, 'r'); G.ell(22.5, 19, 2.2, 3.4, 'r');                                               // red sleeves
  G.ell(8, 26.5, 2.8, 1.1, 'f'); G.ell(18, 26.5, 2.8, 1.1, 'f');                                               // feet
  G.poly([[4, 15], [22, 15], [23, 26], [3, 26]], 'y'); G.poly([[5, 16], [21, 16], [22, 25], [4, 25]], 'k');   // robe, gold trim
  G.ell(13, 20.5, 3.4, 3.4, 'y'); G.ell(13, 20.5, 2.5, 2.5, 'w');                                              // the emblem and its kanji
  G.rect(12, 19, 3, 1, 'k'); G.rect(12, 21, 3, 1, 'k'); G.set(13, 20, 'k'); G.set(13, 22, 'k');
  G.poly([[9, 9], [4.5, 4.5], [10, 12]], 'b'); G.poly([[17, 9], [21.5, 4.5], [16, 12]], 'b');                 // pointy ears
  G.ell(13, 10.5, 5.2, 5, 'b'); G.rect(9, 15, 9, 1, 'y');                                                      // round face, collar
  G.ell(13, 5.8, 3.4, 1.8, 'k');                                                                                // skullcap
  G.rect(10, 9, 2, 2, 'k'); G.rect(15, 9, 2, 2, 'k'); G.rect(12, 9, 3, 1, 'k');                                 // round shades
  G.rect(12, 13, 3, 1, 'm'); G.set(8, 12, 'W'); G.set(7, 12, 'W'); G.set(18, 12, 'W'); G.set(19, 12, 'W');      // smile, whiskers
}, { o: 0x0a1020, b: 0xa2d8d2, B: 0x6aa8a4, k: 0x16161c, w: 0xf6f4ee, W: 0xe8e8e8, y: 0xf0a024, r: 0xd03030, R: 0x962028, m: 0xe8303a, f: 0xeeeae2, F: 0xbab4a8 }, { b: 'B', r: 'R', f: 'F' });
const GREGORY = shapeSprite(11, 8, G => {
  G.ell(4.5, 4.5, 3.6, 2, 'g'); G.ell(7.6, 3.4, 1.9, 1.9, 'g'); G.set(8, 3, 'k');
  G.line([[3, 6], [1, 8]], 1, 1, 'G'); G.line([[6, 6], [7, 8]], 1, 1, 'G'); G.line([[8.5, 2], [10, 0]], 1, 1, 'k');
}, { o: 0x0d2a12, g: 0x7ad85a, G: 0x3f8a3a, k: 0x111111 }, { g: 'G' });
const DOOR = shapeSprite(12, 16, G => { G.rect(1, 1, 10, 15, 'w'); G.rect(3, 3, 6, 13, 'k'); G.set(8, 9, 'y'); }, { o: 0x1a1a24, w: 0xf6f4ee, W: 0xc8c4b8, k: 0x2a2a3a, y: 0xf2c84a }, { w: 'W' });
// frieza's ship and his soldiers, yamcha in his crater
const SHIP = shapeSprite(30, 18, G => {
  G.line([[7, 12], [4, 17]], 1.4, 1.2, 'k'); G.line([[23, 12], [26, 17]], 1.4, 1.2, 'k'); G.line([[15, 13], [15, 17]], 1.4, 1.2, 'k');   // landing legs
  G.rect(3, 17, 3, 1, 'k'); G.rect(25, 17, 3, 1, 'k'); G.rect(14, 17, 3, 1, 'k');
  G.ell(15, 10, 14, 4.2, 'w');                                                                        // saucer body
  G.ell(15, 6.5, 8, 5.5, 'w');                                                                        // dome
  for (const x of [5, 9, 13, 17, 21, 25]) G.ell(x, 10.4, 1.3, 1, 'r');                              // ring of red-orange portholes
  G.rect(4, 13, 23, 1, 'p');                                                                        // purple keel band
  G.set(12, 3, 'l'); G.set(13, 2, 'l'); G.set(11, 4, 'l');                                            // glint on the dome
}, { o: 0x1a1a24, w: 0xe8e8ee, W: 0xa8a8b8, r: 0xf06a2a, p: 0x6a3aa8, P: 0x45227a, k: 0x3a3a48, l: 0xffffff }, { w: 'W', p: 'P' });
const SOLDIER = shapeSprite(13, 18, G => {
  G.ell(6.5, 4, 2.8, 3, 's'); G.set(5, 4, 'k'); G.set(8, 4, 'k'); G.rect(3, 1, 7, 2, 'h');        // head, eyes, helmet hair
  G.rect(9, 3, 2, 1, 'g');                                                                        // green scouter lens
  G.ell(2.5, 8, 2.2, 1.6, 'y'); G.ell(10.5, 8, 2.2, 1.6, 'y');                                       // armour shoulder pads
  G.poly([[3, 7], [10, 7], [10, 12], [3, 12]], 'w'); G.rect(3, 12, 7, 1, 'k');                        // chest plate
  G.rect(1, 9, 2, 4, 's'); G.rect(10, 9, 2, 4, 's');                                            // arms
  G.rect(4, 13, 2, 4, 'b'); G.rect(7, 13, 2, 4, 'b'); G.rect(3, 17, 3, 1, 'w'); G.rect(7, 17, 3, 1, 'w');   // legs, boots
}, { o: 0x14141c, s: 0xb8a0e0, S: 0x8a72b4, h: 0x3a2a5a, k: 0x111111, g: 0x5ae07a, y: 0xd8c070, Y: 0xa89040, w: 0xf2f0e8, W: 0xc8c4b8, b: 0x2a2a3a }, { s: 'S', y: 'Y', w: 'W' });
const YAMCHA = shapeSprite(26, 12, G => {
  G.ell(13, 8, 12.5, 3.6, 'c'); G.ell(13, 7.6, 10, 2.6, 'C');                                         // the crater
  G.ell(9, 5.5, 4.2, 2.6, 'g'); G.rect(12, 4, 6, 3, 'g');                                             // curled up in his orange gi
  G.ell(18.5, 5, 2.4, 2.2, 's'); G.rect(17, 3, 4, 1, 'h'); G.set(16, 4, 'h'); G.set(19, 5, 'k');  // head, hair, closed eye
  G.rect(6, 7, 3, 1, 'b'); G.rect(13, 7, 2, 1, 'b');                                                // blue wristbands
  G.ell(5, 7.6, 1.4, 1, 's');                                                                         // a limp hand
}, { o: 0x2a1a10, c: 0x8a6a48, C: 0x5a4430, g: 0xf08a24, G: 0xc0641a, s: 0xf2c8a0, S: 0xc89a76, h: 0x1a1a1a, k: 0x111111, b: 0x2a5ad8 }, { g: 'G', s: 'S' });
// the ginyu force: one armoured build, five heads
function ginyuMember(skin, hair, style) {
  return shapeSprite(16, 22, G => {
    if (style === 'jeice') { G.ell(8, 3.5, 4.4, 3, 'h'); G.rect(3, 4, 2, 6, 'h'); G.rect(11, 4, 2, 6, 'h'); }
    G.ell(8, 5.5, 3.6, 3.6, 's');
    if (style === 'ginyu') { G.line([[5.5, 3], [4, -1]], 1.4, 1, 'k'); G.line([[10.5, 3], [12, -1]], 1.4, 1, 'k'); }
    if (style === 'recoome') G.rect(4, 0, 9, 3, 'h');
    G.set(6, 5, 'k'); G.set(10, 5, 'k'); if (style === 'guldo') { G.set(5, 3, 'k'); G.set(11, 3, 'k'); }
    G.rect(7, 9, 3, 1, 's');
    G.poly([[4, 10], [12, 10], [12, 16], [4, 16]], 'w'); G.ell(3.5, 10.5, 2.2, 1.6, 'y'); G.ell(12.5, 10.5, 2.2, 1.6, 'y');   // armour, shoulder pads
    G.line([[3, 12], [2, 16]], 1.8, 1.6, 'k'); G.line([[13, 12], [14, 16]], 1.8, 1.6, 'k'); G.set(2, 17, 's'); G.set(14, 17, 's');
    G.line([[6, 16], [6, 21]], 2, 2, 'k'); G.line([[10, 16], [10, 21]], 2, 2, 'k');
  }, { o: 0x14101e, s: skin, S: skin, h: hair, H: hair, k: 0x1a1a24, w: 0xf6f4ee, W: 0xc8c4b8, y: 0xf2c84a, Y: 0xb88a1a }, { w: 'W', y: 'Y' });
}
const GINYU = [
  { name: 'ginyu', spr: ginyuMember(0x9a6ad8, 0, 'ginyu') }, { name: 'jeice', spr: ginyuMember(0xe0503a, 0xf6f4ee, 'jeice') },
  { name: 'burter', spr: ginyuMember(0x4a7ad8, 0, 'burter') }, { name: 'recoome', spr: ginyuMember(0xf2c8a2, 0xe8702a, 'recoome') },
  { name: 'guldo', spr: ginyuMember(0x7acb5c, 0, 'guldo') },
];
const VILLAINS = (() => {
  const body = (rows, pal) => makeSprite(rows, pal, { emit: 'r' });
  return [
    { name: 'frieza', spr: FRIEZA },
    { name: 'cell', spr: CELL },
    { name: 'kid buu', spr: KIDBUU },
    { name: 'beerus', spr: BEERUS },
  ];
})();
const STAR = makeSprite(['....o....', '...oyo...', '..oyYyo..', 'ooyYWYyoo', 'oyYWWWYyo', '.oyYYYyo.', '.oyYoYyo.', 'oyyo.oyyo', 'ooo...ooo'], { o: 0x8a5a12, y: 0xf2b134, Y: 0xffd84a, W: 0xffffff }, { emit: 'oyYW' });

const TONES = {
  grass: [0x2f7a26, 0x3f9330, 0x57ad3c, 0x78c64a, 0xa6de66, 0xd2f28e],
  road: [0xcfc8b6, 0xe6e1d4, 0xf6f3ec, 0xffffff],
  dome: [0x8a3418, 0xc04e26, 0xe8703a, 0xf6985a, 0xffc896],
  band: [0x9a8a6a, 0xcbbd98, 0xe9dcb8, 0xfff6e0],
  leaf: [0x1a4f1e, 0x2a7229, 0x429a36, 0x63bb46, 0x9edc68],
  trunk: [0x3d2414, 0x5a3720, 0x7a4d2b, 0x9a6640],
  stone: [0x4a4c56, 0x6c6f7c, 0x9497a4, 0xc2c5cf],
  orb: [0xff9a2a, 0xffc04a, 0xffe08a, 0xfff6d0, 0xffffff],
  glass: [0x2a5a8a, 0x5aa0d8, 0x9fdcff, 0xe6f6ff],
  dragon: [0x0c3418, 0x1a5e26, 0x2a8a36, 0x4cb84c, 0x9be27a],
  belly: [0x9a7a3a, 0xd2b060, 0xf2d48a, 0xfff0c0],
  dorb: [0xc4561a, 0xee7a1e, 0xffa63a, 0xffd27a, 0xfff2cc],
  bean: [0x2e6b22, 0x4a9a32, 0x76c64a, 0xb6ea7a],
};

const KAI = Object.fromEntries(Object.entries(TONES).map(([k, v]) => [k, v.slice()]));
const NAMEK = Object.assign({}, KAI, {
  grass: [0x1f6a5a, 0x2a8a72, 0x3fa88a, 0x62c4a0, 0x96deb8, 0xc8f2d8],
  road: [0xc9cdb8, 0xdfe2d0, 0xf0f2e6, 0xffffff],
  dome: [0x8f9aa0, 0xbcc6ca, 0xdfe6e8, 0xf4f8f8, 0xffffff],      // namekian houses: white domes with round windows
  band: [0x8a9aa0, 0xb4c2c6, 0xd6e0e2, 0xf0f6f6],
  glass: [0x1c3a4a, 0x2a5a6a, 0x4a8a9a, 0x9adada],
  leaf: [0x1c4a5e, 0x245f78, 0x2f7f98, 0x4aa2b8, 0x86cfe0],      // ajissa trees: blue-green puffs on tall stems
  trunk: [0x5a5a40, 0x7a7a58, 0x9a9a74, 0xbebe96],
});
const WORLDS = [{ name: "king kai's planet", tones: KAI, sea: [0xe2a93a, 0xf3c55a, 0xf9dd8c, 0xfff2c8] }, { name: 'namek', tones: NAMEK, sea: [0x1e7a7a, 0x2fa59a, 0x6cd1bf, 0xc6f2e6] }];
function useWorld(w) { for (const [k, v] of Object.entries(WORLDS[w].tones)) TONES[k].splice(0, TONES[k].length, ...v); }

GAMES.push({
  id: 'planet',
  mount(st, ui) {
    const SAVE = 'hs-power';
    const S = { pl: 0, best: 0, boots: 0, partner: 0, gravity: 0, cloud: 0, scouter: 0, galick: 0, senzu: 0, house: 0, armor: 0, kaio: 0, bigbang: 0, piccolo: 0, chamber: 0, world: 0, orbs7: 0, wishes: 0, ascend: 0, form: 0 };
    try { Object.assign(S, JSON.parse(localStorage.getItem(SAVE) || '{}')); } catch (_) {}
    delete S.gold;
    delete S.nextSuper;
    // transformations: unlocked by power level, permanent until you ascend
    const AURAS = [[0xffffff, 0xffc2e2, 0xf05aa8], [0xffffff, 0xb8f5dc, 0x2fbf8a], [0xffffff, 0xffd8a0, 0xf28a1c], [0xffffff, 0xd9c8ff, 0x7a4ae0]];   // capsule cosmetics for the base form
    const FORMS = [
      { name: 'base', at: 0, x: 1, aura: [0xffffff, 0xbfe9ff, 0x6fb0ff] },
      { name: 'super saiyan', at: 2e4, x: 1.25, aura: [0xffffff, 0xfff8b0, 0xffe02e] },
      { name: 'super saiyan 2', at: 2e5, x: 1.5, aura: [0xffffff, 0xfff8b0, 0xffe02e], sparks: 0x9fdcff },
      { name: 'super saiyan 3', at: 2e6, x: 1.75, aura: [0xffffff, 0xfff8b0, 0xffd60a], sparks: 0x9fdcff },
      { name: 'super saiyan god', at: 2e7, x: 2, aura: [0xffd0c0, 0xff7a5a, 0xd8344a] },
      { name: 'super saiyan blue', at: 2e8, x: 2.25, aura: [0xffffff, 0x9fe6ff, 0x2f9ae0] },
      { name: 'ultra ego', at: 2e9, x: 2.5, aura: [0xe6d6ff, 0xa070f0, 0x4a1f9a], sparks: 0xc9a2ff },
      { name: 'super saiyan 4', at: 2e10, x: 3, aura: [0xffffff, 0xff9a8a, 0xc8302a], sparks: 0xffd0a0 },
      { name: 'ultra instinct', at: 2e11, x: 3.5, aura: [0xffffff, 0xd8e8ff, 0x8aa0c8], sparks: 0xffffff },
    ];
    S.form = Math.min(S.form || 0, FORMS.length - 1);
    const save = () => { S.last = Date.now(); try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (_) {} };
    const SHOP = {
      boots: { base: 50, k: 1.7, label: 'weighted boots', what: '+1 per step' },
      partner: { base: 250, k: 1.7, label: 'bubbles', what: '+4/s, trains with you' },
      gravity: { base: 2500, k: 2.6, label: 'gravity chamber', what: '×1.15 everything' },
      cloud: { base: 1000, k: 2.2, label: 'flying nimbus', what: 'comes more often' },
      scouter: { base: 800, k: 2.1, label: 'scouter', what: '+10% crits (×2)', unlock: () => S.best >= 150 },
      galick: { base: 1500, k: 2.3, label: 'galick charge', what: 'hold to charge a beam', unlock: () => S.best >= 400 },
      senzu: { base: 4000, k: 2.2, label: 'senzu tree', what: 'beans: tap for ×1.5', unlock: () => S.best >= 1000 },
      house: { base: 6000, k: 2.3, label: 'capsule house', what: '+40/s (a new dome up to lv 9)', unlock: () => S.best >= 2000 },
      armor: { base: 12000, k: 2.4, label: 'saiyan armor', what: '+50% vs villains & saibamen', unlock: () => S.best >= 5000 },
      kaio: { base: 20000, k: 2.6, label: 'kaioken', what: 'red button: big boost, then tired', unlock: () => S.best >= 8000 },
      bigbang: { base: 60000, k: 2.5, label: 'big bang attack', what: 'double-tap: an exploding ki ball', unlock: () => S.best >= 20000 },
      piccolo: { base: 30000, k: 2.4, label: 'piccolo', what: '+60/s, zaps meteors', unlock: () => S.best >= 10000 },
      chamber: { base: 150000, k: 2.8, label: 'time chamber', what: 'a door appears: train ×2 inside', unlock: () => S.best >= 40000 },
      ascend: { base: 1e6, k: 1, label: 'ascend', what: 'reset for a permanent boost', unlock: () => S.pl >= 1e6 },
    };
    const RESETS = ['boots', 'partner', 'gravity', 'cloud', 'scouter', 'galick', 'senzu', 'house', 'armor', 'kaio', 'bigbang', 'piccolo', 'chamber'];
    const cost = k => k === 'ascend' ? 1e6 : Math.floor(SHOP[k].base * Math.pow(SHOP[k].k, S[k]));
    // permanent: gravity ×1.15 a level, wishes ×1.25 each, ascensions +10% each; temporary boosts add up rather than multiply
    const KAIO = () => 1.25 + .25 * S.kaio;
    const mult = () => {   // permanent boosts multiply; temporary ones add their bonuses, so a pile of buffs can't explode
      const T = st.t, b = 1 + (boostUntil > T) * 1 + (apeUntil > T) * 2 + (senzuUntil > T) * .5 + (riding > 0) * .5 + (kaioUntil > T ? KAIO() - 1 : 0) + (dailyUntil > T) * .25 + (fuseUntil > T) * 1 + (laughUntil > T) * .25 + (chamberUntil > T) * 1;
      return Math.pow(1.15, S.gravity) * Math.pow(1.25, S.wishes) * (1 + .1 * S.ascend) * FORMS[S.form].x * b * (kaioUntil <= T && tiredUntil > T ? .5 : 1);
    };
    const lapValue = () => 30 * (1 + S.boots) ;
    const passive = () => S.partner * 4 + S.house * 40 + S.piccolo * 60;
    let laughUntil = 0, chamberUntil = 0, chamberT0 = 0, echo = null, door = null, nextDoor = 60, kai = null, nextKai = 50, greg = null, nextGreg = 70, ship = null, nextShip = 200, yam = null, nextYam = 130, zap = null, nextZap = 4, ginyu = null, nextGinyu = 160;
    let dailyUntil = 0, fuseUntil = 0, fuseOffer = 0, nextFuse = 150, monkeyAt = null, kaioUntil = 0, tiredUntil = 0, kaioReady = 0, bang = null, blasts = [], lastTap = { t: -9, x: 0, y: 0 }, capsule = null, tour = null, nextTour = 45, namekUntil = 0;
    if (!(S.namekLeft > 0)) S.world = 0;   // namek is a visit; a visit in progress survives a reload
    let saibas = [], nextSaiba = 40, boss = null, nextBoss = 120, kis = [];
    let shake = 0, moon = null, nextMoon = 95, apeUntil = 0, apeStep = 0, flashT = 0, senzuUntil = 0, combo = 1, lastClick = -9, charging = 0, beam = null, bean = null, nextBean = 30;
    ui.onBuy(k => {
      const c = cost(k); if (S.pl < c) return;
      if (k === 'ascend') {
        const gainA = Math.max(1, Math.floor(Math.sqrt(S.pl / 1e6))); S.ascend += gainA; S.pl = 0; for (const r of RESETS) S[r] = 0; S.form = 0; ui.fx && ui.fx('form', 0); scenery();
        ui.event(`ascended — now ×${(1 + .1 * S.ascend).toFixed(2)} forever`); ui.fx && ui.fx('super'); save(); syncShop(); return;
      }
      S.pl -= c; S[k]++; ui.fx && ui.fx('buy');
      if (k === 'partner' && S.partner === 1) ui.event('bubbles wants to train with you');
      if (k === 'galick' && S.galick === 1) ui.event('hold anywhere to charge a galick gun');
      if (k === 'house') { scenery(); ui.event('a new capsule house lands'); }
      if (k === 'piccolo' && S.piccolo === 1) ui.event('piccolo lands to meditate');
      if (k === 'chamber' && S.chamber === 1) ui.event('the time chamber door will appear — tap it');
      if (k === 'kaio' && S.kaio === 1) ui.event('kaioken unlocked — hit the red button');
      if (k === 'bigbang' && S.bigbang === 1) ui.event('big bang attack — double-tap anywhere');
      if (k === 'armor' && S.armor === 1) ui.event('saiyan armor on — hit villains harder');
      save(); syncShop();
    });
    const what = k => k === 'ascend' ? `→ ×${(1 + .1 * (S.ascend + Math.max(1, Math.floor(Math.sqrt(S.pl / 1e6))))).toFixed(2)} forever` : k === 'chamber' && S.chamber ? `train ×2 for ${10 + 5 * S.chamber}s` : k === 'kaio' && S.kaio ? `×${KAIO()} for 15s, then ×0.5` : k === 'bigbang' && S.bigbang ? `blast radius +${S.bigbang * 25}%` : k === 'galick' && S.galick ? (S.galick === 4 ? 'next: final flash' : S.galick >= 5 ? 'full charge: final flash' : '+beam power') : SHOP[k].what;
    const syncShop = () => ui.shop(Object.fromEntries(Object.keys(SHOP).filter(k => !SHOP[k].unlock || SHOP[k].unlock() || S[k] > 0).map(k => [k, { cost: cost(k), level: k === 'ascend' ? S.ascend : S[k], label: SHOP[k].label, what: what(k), can: S.pl >= cost(k), special: k === 'ascend' }])));

    // the planet: a road ring near the rim, a cap of scenery facing the viewer
    const N = V.norm([0, .38, .92]);
    const E1 = V.norm(V.cross([0, 1, 0], N)), E2 = V.cross(N, E1);
    const roadPt = phi => V.norm(V.add(V.mul(E1, Math.cos(phi)), E2, Math.sin(phi)));
    const capPt = (th, a) => V.norm(V.add(V.mul(N, Math.cos(th)), V.add(V.mul(E1, Math.cos(a)), E2, Math.sin(a)), Math.sin(th)));
    const L = V.norm([-.55, .7, .55]);
    const solids = [];                       // { c: body centre, r, kind, ... }
    function scenery() {
      solids.length = 0;
      const dome = (th, a, r) => { const s = capPt(th, a), door = V.norm(V.cross(s, V.cross(N, s))); solids.push({ c: s, r, kind: 'dome', s, door: V.mul(door, -1) }); for (let i = 1; i <= 5; i++) solids.push({ c: V.mul(s, 1 + r + .018 * i), r: .009, kind: 'trunk' }); solids.push({ c: V.mul(s, 1 + r + .11), r: .02, kind: 'knob' }); };
      const tree = (th, a, k = 1) => S.world ? ajissa(th, a, k) : kaiTree(th, a, k);
      const ajissa = (th, a, k) => { const s = capPt(th, a); for (let i = 1; i <= 7; i++) solids.push({ c: V.mul(s, 1 + .05 * i * k), r: .022 * k, kind: 'trunk' }); solids.push({ c: V.mul(s, 1 + .42 * k), r: .12 * k, kind: 'leaf' }, { c: V.mul(s, 1 + .52 * k), r: .08 * k, kind: 'leaf' }); };
      const kaiTree = (th, a, k = 1) => { const s = capPt(th, a), t1 = V.norm(V.cross(s, N)); for (let i = 1; i <= 4; i++) solids.push({ c: V.mul(s, 1 + .045 * i * k), r: .03 * k, kind: 'trunk' }); solids.push({ c: V.add(V.mul(s, 1 + .26 * k), t1, .05 * k), r: .13 * k, kind: 'leaf' }, { c: V.add(V.mul(s, 1 + .2 * k), t1, -.08 * k), r: .1 * k, kind: 'leaf' }, { c: V.mul(s, 1 + .33 * k), r: .09 * k, kind: 'leaf' }); };
      const bush = (th, a, r) => solids.push({ c: capPt(th, a), r, kind: 'leaf' });
      const rock = (th, a, r) => solids.push({ c: V.mul(capPt(th, a), 1 - r * .3), r, kind: 'stone' });
      dome(.3, 2.5, .25); dome(.82, 3.55, .17);
      [[.75, 1.9, .15], [.6, 5.1, .16], [1.05, 4.0, .13], [2.0, 2.2, .16], [2.3, 4.2, .15], [1.9, .05, .14], [2.6, 5.8, .13], [3.0, 2.4, .15], [1.25, 2.65, .12]].slice(0, Math.min(9, S.house)).forEach(([a, b, r]) => dome(a, b, r));
      tree(.95, .5, 1.05); tree(.62, 1.35, .85); tree(1.0, 5.0, .95); tree(.55, 5.8, .7); tree(2.25, 1.2, 1); tree(2.5, 3.4, 1.1); tree(2.1, 5.2, .9); tree(2.75, .2, .8);
      bush(.7, 4.3, .07); bush(.98, 2.2, .06); bush(.4, .9, .05); bush(1.1, 3.0, .06); bush(2.3, 2.3, .08); bush(2.6, 4.5, .07);
      rock(.62, 4.05, .05); rock(1.05, 1.7, .04); rock(2.4, .6, .05);
    }

    let R = 40, cx = 0, cy = 0, zb = null, ib = null, dm = null;
    function layout() {
      const wide = st.W / st.H >= 1.15, fcx = +(st.el.closest('[data-cx]')?.dataset.cx || (wide ? .56 : .5));
      R = Math.round(st.W / st.H < .8 ? Math.min(st.W * .34, st.H * .22) : wide ? Math.min(st.W * .19, st.H * .3) : Math.min(st.W * .28, st.H * .24));
      cx = Math.round(st.W * fcx); cy = Math.round(st.H * (wide ? .5 : st.W / st.H < .8 ? .5 : .55));
      zb = new Float32Array(st.W * st.H); ib = new Uint16Array(st.W * st.H); dm = new Uint8Array(st.W * st.H);
    }
    // view rotation (drag to spin) with inertia, easing home when idle
    let M = M3.I(), vrx = 0, vry = 0, drag = null, idleT = 99;
    const fx = particleSystem(), puff = makePuff(26, 11);

    // ── game state
    let phi = 0, laps = 0, lastLap = 0, sprint = 0, riding = 0, jumpH = 0, jumpV = 0, boostUntil = 0, session = 0, acc = 0, saveAcc = 0;
    const orbs = [];            // { phi, done }
    let star = null, nextStar = 14, meteors = [], nextShower = 55, nextCloud = 85, cloudFly = null, aura = false;
    const seen = new Set();
    const once = (key, text) => { if (seen.has(key)) return; seen.add(key); ui.event(text); };
    const gain = (n, x, y, gold) => { n = Math.max(1, Math.round(n)); S.pl += n; if (S.pl > S.best) S.best = S.pl; if (x !== undefined) floats.push({ x, y, s: '+' + fmtShort(n), life: 1, gold }); };
    const fmtShort = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : String(n);
    const floats = [];

    let flipNow = false, liftNow = 0, piccoloAt = null;
    function handPos() { const kd = kidScreen(); return { x: kd.x + Math.sin(kd.ang) * (liftNow + 12) + Math.cos(kd.ang) * 6 * (flipNow ? -1 : 1), y: kd.y - Math.cos(kd.ang) * (liftNow + 12) + Math.sin(kd.ang) * 6 * (flipNow ? -1 : 1), ang: kd.ang }; }
    function kidScreen(lift = 0) { const v = M3.ap(M, roadPt(phi)); return { v, x: cx + v[0] * (R + lift), y: cy - v[1] * (R + lift) + st.bob, ang: Math.atan2(v[0], v[1]) }; }
    function openCapsule() {
      const c = capsule; capsule = null; const roll = Math.random();
      burst(c.x, c.y, [0xffffff, 0xe4e6ea, 0xe0332b], 22, 140); flashT = .3;
      if (roll < .3) { senzuUntil = st.t + 15; ui.event('capsule: senzu beans — ×1.5 for 15s'); }
      else if (roll < .6) { const g = rate() * 150; gain(g, c.x, c.y - 8, true); ui.event('capsule: +' + fmtShort(Math.round(g))); }
      else if (roll < .82) { S.orbs7++; if (S.orbs7 >= 7) { S.orbs7 = 0; summon(); } else ui.event(`capsule: a dragon ball! ${S.orbs7}/7`); goal('ball'); }
      else { S.aura = 1 + (((S.aura || 0) + (Math.random() * 3 | 0)) % AURAS.length); ui.event('capsule: a new aura colour'); }
      save();
    }
    function onClick(px, py) {
      if (!playing) return;
      if (fuseOffer > st.t && monkeyAt && Math.hypot(px - monkeyAt.x, py - (monkeyAt.y - 5)) < 12) {
        fuseOffer = 0; fuseUntil = st.t + 30; flashT = 1; shake = .6; ui.event('fusion ha! vegebubs — ×2 for 30s'); ui.fx && ui.fx('super');
        burst(monkeyAt.x, monkeyAt.y - 6, [0xffffff, 0xffe08a, 0xff9a3c, 0x6fb0ff], 50, 200); return;
      }
      if (yam && yam.sx !== undefined && !yam.helped && Math.hypot(px - yam.sx, py - (yam.sy - 3)) < 12) { yam.helped = true; yam.until = st.t + 1.2; senzuUntil = Math.max(senzuUntil, st.t + 10); const g = Math.max(200, rate() * 40); gain(g, yam.sx, yam.sy - 10, true); ui.event('yamcha: "i\'m fine!" — senzu ×1.5 for 10s'); ui.sfx && ui.sfx('coin'); return; }
      if (greg && greg.sx !== undefined && Math.hypot(px - greg.sx, py - (greg.sy - 4)) < 10) { const g = Math.max(300, rate() * 120) * (1 + .5 * (S.gregWins || 0)); S.gregWins = (S.gregWins || 0) + 1; gain(g, greg.sx, greg.sy - 10, true); ui.event(`you caught gregory! +${fmtShort(Math.round(g))} — race ${S.gregWins} won`); ui.sfx && ui.sfx('coin'); burst(greg.sx, greg.sy - 4, [0xffffff, 0x9cf07a, 0x3f8a3a], 18, 120); greg = null; return; }
      if (kai && kai.sx !== undefined && !kai.laughed && Math.hypot(px - kai.sx, py - (kai.sy - 8)) < 12) { kai.laughed = true; laughUntil = st.t + 10; ui.event('ha! ha! ha! — ×1.25 for 10s'); ui.sfx && ui.sfx('coin'); burst(kai.sx, kai.sy - 14, [0xffffff, 0xbfe9ff, 0x3a7ad8], 14, 90); return; }
      if (door && Math.hypot(px - door.x, py - (door.y - 8)) < 12) { chamberT0 = st.t; chamberUntil = st.t + 10 + 5 * S.chamber; ui.event(`hyperbolic time chamber — time slows, training ×2 for ${10 + 5 * S.chamber}s`); flashT = 1; ui.sfx && ui.sfx('form'); door = null; return; }
      if (ginyu && !ginyu.done) for (const m of ginyu.members) if (!m.dead && Math.abs(px - m.x) < (m.spr.w / 2 + 2) * m.k && py > m.y - (m.spr.h + 2) * m.k && py < m.y + 3) { combo = st.t - lastClick < .6 ? Math.min(2, combo + .1) : 1; lastClick = st.t; ginyuHit(m, (1 + S.boots) * mult() * combo * 6); ui.sfx && ui.sfx('hit'); return; }
      if (capsule && Math.hypot(px - capsule.x, py - capsule.y) < 11) { openCapsule(); return; }
      if (star && Math.hypot(px - star.x, py - star.y) < 10) {
        boostUntil = st.t + 15; gain(Math.max(50, rate() * 20), star.x, star.y - 6, true); ui.event('shooting star — ×2 for 15s'); goal('star'); ui.fx && ui.fx('star');
        for (let k = 0; k < 24; k++) fx.add({ x: star.x, y: star.y, vx: (Math.random() - .5) * 120, vy: (Math.random() - .5) * 120, drag: 2.5, life: .7, c: [0xffffff, 0xffd84a, 0xf2b134], raw: true });
        star = null; return;
      }
      for (const m of meteors) if (!m.dead && Math.hypot(px - m.x, py - m.y) < 9) { m.dead = true; goal('meteor'); gain(25 * mult() * (1 + laps * .1), m.x, m.y - 6, true); for (let k = 0; k < 16; k++) fx.add({ x: m.x, y: m.y, vx: (Math.random() - .5) * 110, vy: (Math.random() - .5) * 110, drag: 2.5, life: .6, c: [0xffffff, 0xffb35a, 0xe0473e, 0x6c6f7c], raw: true }); return; }
      // anywhere else: train — a sprint burst and a few points
      if (moon && moon.a > .3 && !moon.leaving && Math.hypot(px - moon.x, py - moon.y) < moon.r + 6) {
        apeUntil = st.t + 20; moon.leaving = true; flashT = 1; shake = .8; ui.event('great ape mode — ×3'); ui.fx && ui.fx('super');
        for (let k = 0; k < 80; k++) { const q = kidScreen(20); fx.add({ x: q.x, y: q.y, vx: (Math.random() - .5) * 220, vy: (Math.random() - .5) * 220, drag: 2, life: 1, c: [0xffffff, 0xffd0a0, 0x7a4a2a], raw: true }); }
        return;
      }
      // senzu bean on the planet
      for (const sb of saibas) if (!sb.dead && sb.sx !== undefined && Math.hypot(px - sb.sx, py - (sb.sy - 6)) < 9) { killSaiba(sb); return; }
      if (boss && !boss.dead && Math.abs(px - boss.x) < (boss.spr.w / 2 + 3) * boss.k && py > boss.y - (boss.spr.h + 2) * boss.k && py < boss.y + 4) { combo = st.t - lastClick < .6 ? Math.min(2, combo + .1) : 1; lastClick = st.t; hitBoss((1 + S.boots) * mult() * combo * 6, px, py); return; }
      if (bean && bean.sx !== undefined && Math.hypot(px - bean.sx, py - bean.sy) < 9) { senzuUntil = st.t + 15; ui.event('senzu bean — ×1.5 for 15s'); for (let k = 0; k < 18; k++) fx.add({ x: bean.sx, y: bean.sy, vx: (Math.random() - .5) * 100, vy: (Math.random() - .5) * 100, drag: 3, life: .6, c: [0xffffff, 0xb8f08a, 0x4fae3a], raw: true }); bean = null; return; }
      // train: rhythm builds a combo up to ×2; the scouter adds crits
      combo = st.t - lastClick < .6 ? Math.min(2, combo + .1) : 1; lastClick = st.t; if (combo >= 2) goal('combo');
      sprint = Math.min(1.2, sprint + .5);
      if (jumpH <= 0) jumpV = 120;
      const crit = Math.random() < S.scouter * .1, k = kidScreen(14);
      gain((1 + S.boots) * mult() * combo * (crit ? 2 : 1), k.x, k.y - 10, crit); ui.sfx && ui.sfx('tap');
      if (crit) for (let i = 0; i < 10; i++) fx.add({ x: k.x, y: k.y - 14, vx: (Math.random() - .5) * 90, vy: -20 - Math.random() * 60, drag: 2, life: .5, c: [0xffffff, 0x9cf0b8, 0x34d873], raw: true });
      ui.bump();
    }
    st.cv.addEventListener('pointerdown', e => { const [bx, by] = st.toBuf(e); drag = { x: e.clientX, y: e.clientY, moved: 0, t: st.t, ax: bx, ay: by }; try { st.cv.setPointerCapture(e.pointerId); } catch (_) {} });
    st.cv.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
      if (charging > 0) { const [px, py] = st.toBuf(e); drag.ax = px; drag.ay = py; return; }
      if (drag.moved > 6) { st.cv.style.cursor = 'grabbing'; const k = 1.1 / (R * st.scale); vry = dx * k * 30; vrx = dy * k * 30; M = M3.ortho(M3.mul(M3.mul(M3.rx(dy * k), M3.ry(dx * k)), M)); idleT = 0; }
    });
    st.cv.addEventListener('pointerup', e => { if (drag && charging > .15) fireBeam(charging, drag.ax, drag.ay); else if (drag && drag.moved <= 6) { const [px, py] = st.toBuf(e); tap(px, py); } charging = 0; drag = null; st.cv.style.cursor = 'grab'; });
    st.cv.addEventListener('pointercancel', () => { drag = null; charging = 0; });
    function fireBeam(c, tx, ty) {
      const k = handPos(); let dx = tx - k.x, dy = ty - k.y, dl = Math.hypot(dx, dy);
      if (dl < 4) { dx = Math.sin(k.ang); dy = -Math.cos(k.ang); dl = 1; }
      const dir = [dx / dl, dy / dl];
      beam = { t0: st.t, c, x: k.x, y: k.y, dx: dir[0], dy: dir[1], z: kidScreen().v[2] * (R + 12) }; ui.sfx && ui.sfx('beam'); shake = Math.max(shake, .2 + c * .15);
      if (star) { const rx = star.x - k.x, ry = star.y - k.y; if (rx * dir[0] + ry * dir[1] > 0 && Math.abs(rx * dir[1] - ry * dir[0]) < 8 + c * 3) onClick(star.x, star.y); }
      if (c >= 2.4) goal('beam');
      const ff = S.galick >= 5 && c >= 2.4; beam.ff = ff;   // galick lv 5: a full charge fires a final flash
      const pts = (1 + S.galick) * lapValue() * 2.5 * c * mult() * (ff ? 3 : 1);
      const onLine = (x, y, w) => { const rx = x - k.x, ry = y - k.y; return rx * dir[0] + ry * dir[1] > 0 && Math.abs(rx * dir[1] - ry * dir[0]) < w + c * 3 * (ff ? 2 : 1); };
      for (const sb of saibas) if (!sb.dead && sb.sx !== undefined && onLine(sb.sx, sb.sy - 6, 7)) killSaiba(sb);
      if (ginyu && !ginyu.done) for (const m of ginyu.members) if (!m.dead && onLine(m.x, m.y - m.spr.h / 2 * m.k, m.spr.w / 2 * m.k)) ginyuHit(m, pts * 2);
      if (boss && !boss.dead && onLine(boss.x, boss.y - boss.spr.h / 2 * boss.k, boss.spr.w / 2 * boss.k)) hitBoss(pts * 4, boss.x, boss.y - boss.spr.h / 2 * boss.k);
      gain(pts, k.x, k.y - 16, true); ui.fx && ui.fx('buy');
      for (const m of meteors) { if (m.dead || m.delay > 0) continue; const rx = m.x - k.x, ry = m.y - k.y, along = rx * dir[0] + ry * dir[1], off = Math.abs(rx * dir[1] - ry * dir[0]); if (along > 0 && off < 6 + c * 3) { m.dead = true; goal('meteor'); gain(25 * mult() * (1 + laps * .1), m.x, m.y - 6, true); } }
    }
    st.cv.style.cursor = 'grab';

    const rate = () => Math.round((lapValue() / 7 + passive()) * mult());
    function burst(x, y, c, n = 16, sp = 110) { for (let k = 0; k < n; k++) fx.add({ x, y, vx: (Math.random() - .5) * sp, vy: (Math.random() - .5) * sp, drag: 2.5, life: .6, c, raw: true }); }
    const GOALS = [
      { id: 'combo', n: 1, text: 'hit a ×2 combo' },
      { id: 'laps', n: 10, text: 'run 10 laps' },
      { id: 'star', n: 3, text: 'catch 3 shooting stars' },
      { id: 'saiba', n: 15, text: 'defeat 15 saibamen' },
      { id: 'meteor', n: 10, text: 'bust 10 meteors' },
      { id: 'boss', n: 1, text: 'defeat a villain' },
      { id: 'ball', n: 2, text: 'find 2 dragon balls' },
      { id: 'beam', n: 5, text: 'fire 5 full-power beams', need: () => S.galick > 0 },
      { id: 'tour', n: 20, text: 'score 20 KO in a tournament', need: () => S.best >= 3000 },
    ];
    if (!S.goal || !GOALS.find(g => g.id === S.goal.id)) S.goal = { id: 'combo', p: 0 };
    function nextGoal() {
      const i = GOALS.findIndex(g => g.id === S.goal.id);
      for (let k = 1; k <= GOALS.length; k++) { const g = GOALS[(i + k) % GOALS.length]; if (!g.need || g.need()) { S.goal = { id: g.id, p: 0 }; return; } }
    }
    function goal(id, amount = 1, set) {
      if (!playing || S.goal.id !== id) return;
      const g = GOALS.find(x => x.id === id); S.goal.p = set ? Math.max(S.goal.p, amount) : S.goal.p + amount;
      if (S.goal.p >= g.n) {
        S.goalsDone = (S.goalsDone || 0) + 1; const prize = Math.max(200, rate() * 90 * (1 + S.goalsDone * .15)); gain(prize);
        let msg = `training done: ${g.text} — +${fmtShort(Math.round(prize))}`;
        if (S.goalsDone % 5 === 0) { S.orbs7++; msg += ' and a dragon ball'; if (S.orbs7 >= 7) { S.orbs7 = 0; setTimeout(summon, 1500); } }
        ui.event(msg); ui.fx && ui.fx('buy'); nextGoal(); save();
      }
    }
    function tap(px, py) {
      const dbl = st.t - lastTap.t < .32 && Math.hypot(px - lastTap.x, py - lastTap.y) < 30;
      lastTap = { t: dbl ? -9 : st.t, x: px, y: py };
      if (dbl && playing && S.bigbang > 0 && !bang) { throwBang(px, py); return; }
      onClick(px, py);
    }
    function throwBang(x, y) { const h = handPos(); bang = { x0: h.x, y0: h.y, x1: x, y1: y, t0: st.t, dur: .38 }; }
    function explode(x, y) {
      ui.sfx && ui.sfx('boom');
      const r = 18 * (1 + .25 * (S.bigbang - 1)) * Math.max(1, R / 50);
      blasts.push({ x, y, r, t0: st.t }); shake = Math.max(shake, .45);
      gain(lapValue() * mult() * 3 * S.bigbang, x, y - 10, true);
      for (const sb of saibas) if (!sb.dead && sb.sx !== undefined && Math.hypot(sb.sx - x, sb.sy - 6 - y) < r + 6) killSaiba(sb);
      for (const m of meteors) if (!m.dead && m.delay <= 0 && Math.hypot(m.x - x, m.y - y) < r + 4) { m.dead = true; goal('meteor'); gain(25 * mult() * (1 + laps * .1), m.x, m.y - 6, true); }
      if (ginyu && !ginyu.done) for (const m of ginyu.members) if (!m.dead && Math.hypot(m.x - x, m.y - m.spr.h / 2 * m.k - y) < r + 6) ginyuHit(m, Math.max(rate(), lapValue() * mult()) * 8 * S.bigbang);
      if (boss && !boss.dead && Math.hypot(boss.x - x, boss.y - boss.spr.h / 2 * boss.k - y) < r + boss.spr.w / 2 * boss.k) hitBoss(Math.max(rate(), lapValue() * mult()) * 12 * S.bigbang, x, y);
      if (star && Math.hypot(star.x - x, star.y - y) < r) onClick(star.x, star.y);
      burst(x, y, [0xffffff, 0xbfe9ff, 0x6fb0ff, 0x2f6ae0], 36, 220);
    }
    function travel(w) {
      if (!playing) return;
      S.world = w; useWorld(w); scenery(); ui.world && ui.world(w);
      flashT = 1; shake = .5; const q = handPos(); burst(q.x, q.y, [0xffffff, 0xdfe6e8, 0x9adada], 40, 220);
      ui.event(w ? 'a space pod takes you to namek for 30 minutes — dragon balls ×2' : "back on king kai's planet"); save(); syncShop();
    }
    function kaioken() {
      if (!playing || S.kaio <= 0 || st.t < kaioReady) return;
      kaioUntil = st.t + 15; tiredUntil = st.t + 25; kaioReady = st.t + 45; shake = .5; flashT = .4;
      ui.event(`kaioken! ×${KAIO()}`); const q = handPos(); burst(q.x, q.y, [0xffffff, 0xff9a8a, 0xe0332b], 40, 200);
    }
    function killSaiba(sb) { if (sb.soldier && ship) ship.ko++; goal('saiba'); if (tour) tour.ko++; sb.dead = true; gain(Math.max(40, rate() * 3) * (1 + .5 * S.armor), sb.sx, sb.sy - 12, true); burst(sb.sx, sb.sy - 5, [0xffffff, 0xa6e67e, 0x58b848, 0x2f7a2a]); }
    const PUNS = [
      'why did the saiyan bring a ladder? to reach the next level!',
      "what's a namekian's favourite drink? green tea!",
      'what do you call a villain with no heat? frieza!',
      'why was the cricket so good at training? he always hopped to it!',
      "how does vegeta stay so sharp? he's always on point!",
      'what do saiyans eat at the beach? sand-wiches — then the whole buffet!',
    ];
    // the ginyu force: five at once, each with a little health bar; beat them all before they leave
    function ginyuHit(m, dmg) {
      if (m.dead) return; m.hp -= dmg * (1 + .5 * S.armor); m.flash = .12; burst(m.x, m.y - 12, [0xffffff, 0xffe08a, 0xff9a3c], 5, 60);
      if (m.hp <= 0) { m.dead = true; burst(m.x, m.y - 10, [0xffffff, 0xffe08a, 0xe0473e], 16, 140); if (tour) tour.ko += 2;
        if (ginyu.members.every(x => x.dead)) { const prize = Math.max(ginyu.max * 2, rate() * 200); gain(prize, cx, cy - R * 1.3, true); ui.event(`the ginyu force is defeated! +${fmtShort(Math.round(prize))}`); ui.fx && ui.fx('star'); ui.sfx && ui.sfx('boom'); goal('boss'); ginyu.done = st.t; save(); } }
    }
    function hitBoss(dmg, x, y) {
      boss.hp -= dmg * (1 + .5 * S.armor); boss.flash = .12; ui.sfx && ui.sfx('hit'); burst(x, y, [0xffffff, 0xffe08a, 0xff9a3c], 6, 70);
      if (boss.hp <= 0 && !boss.dead) {
        boss.dead = true; boss.t1 = st.t; S.bosses = (S.bosses || 0) + 1; goal('boss'); if (tour) tour.ko += 10; capsule = { x: boss.x, y: boss.y - boss.spr.h / 2 * boss.k, vy: -40, t0: st.t, land: cy - R * .3 }; const prize = Math.max(boss.max * 1.5, rate() * 90);
        gain(prize, boss.x, boss.y - (boss.spr.h + 10) * boss.k, true); ui.event(`${boss.name} defeated — +${fmtShort(Math.round(prize))}`); ui.fx && ui.fx('star'); shake = .7; flashT = .8;
        for (let k = 0; k < 4; k++) burst(boss.x + (Math.random() - .5) * 20, boss.y - boss.spr.h / 2 * boss.k + (Math.random() - .5) * 20, [0xffffff, 0xffe08a, 0xff9a3c, 0xe0473e], 20, 180);
        save();
      }
    }
    let shen = null;     // { t0, phase: 'rise' | 'wish' | 'leave', t1 }
    let playing = false;
    let shenLook = 1;   // 'rising'
    function summon(look) {
      if (shen) return;
      if (look !== undefined) shenLook = look;
      shen = { t0: st.t, phase: 'rise', look: shenLook, wishes: S.world ? 3 : 1, porunga: !!S.world }; document.body.classList.add('shen'); ui.sfx && ui.sfx('dragon'); ui.event(S.world ? 'porunga awakens — three wishes…' : 'the eternal dragon awakens…');
    }
    function openWish() {
        shen.phase = 'wish';
        const next = S.form < FORMS.length - 1 ? FORMS[S.form + 1] : null;
        ui.wish([
          { key: 'power', label: 'eternal power', what: '×1.25 to everything, forever' },
          next ? { key: 'form', label: 'unlock ' + next.name, what: 'transform right now' } : { key: 'fortune', label: 'a mountain of power', what: '+20 minutes of income' },
          { key: 'fortune', label: 'a fortune in power', what: '+10 minutes of income' },
        ], k => {
          if (k === 'power') { S.wishes++; ui.event('your wish is granted — ×1.25 forever'); }
          if (k === 'form' && next) { S.pl = Math.max(S.pl, next.at); ui.event('your wish is granted'); }
          if (k === 'fortune') { gain(rate() * 600); ui.event('your wish is granted — +' + fmtShort(rate() * 600)); }
          ui.fx && ui.fx('super'); save();
          if (--shen.wishes > 0) { setTimeout(() => { if (shen) { ui.event(`${shen.wishes} wish${shen.wishes > 1 ? 'es' : ''} left`); openWish(); } }, 1400); return; }
          shen.phase = 'leave'; shen.t1 = st.t;
        });
    }

    // ── rasterise one sphere into the depth buffer
    function sphere(o, id, shade) {
      const v = M3.ap(M, o.c), X = cx + v[0] * R, Y = cy - v[1] * R + st.bob, Z = v[2] * R, pr = o.r * R, W = st.W, H = st.H, buf = st.buf;
      const x0 = Math.max(0, Math.floor(X - pr)), x1 = Math.min(W - 1, Math.ceil(X + pr)), y0 = Math.max(0, Math.floor(Y - pr)), y1 = Math.min(H - 1, Math.ceil(Y + pr));
      const r2 = pr * pr;
      for (let y = y0; y <= y1; y++) { const dy = y + .5 - Y; for (let x = x0; x <= x1; x++) {
        const dx = x + .5 - X, q = r2 - dx * dx - dy * dy; if (q < 0) continue;
        const sq = Math.sqrt(q), z = Z + sq, k = y * W + x; if (z <= zb[k]) continue;
        zb[k] = z; ib[k] = id;
        buf[k] = PK(shade(o, [dx / pr, -dy / pr, sq / pr], x, y));
      } }
    }
    const tone = (pal, lum, x, y) => pal[Math.max(0, Math.min(pal.length - 1, Math.floor((lum + (bayer(x, y) - .5) * .2) * pal.length)))];
    const light = n => Math.max(0, V.dot(n, L)) * .78 + .22;
    function shadePlanet(o, n, x, y) {
      const nb = M3.apT(M, n), lum = light(n) + Math.pow(1 - n[2], 3) * .15;
      if (Math.abs(V.dot(nb, N)) < .07) return tone(TONES.road, lum + .2, x, y);
      const patch = vnoise3(nb[0] * 3 + 9, nb[1] * 3, nb[2] * 3), f = vnoise3(nb[0] * 24, nb[1] * 24 + 4, nb[2] * 24);
      if (f > .9 && lum > .4) return f > .94 ? 0xffffff : 0xfff2a8;
      return tone(TONES.grass, lum + (patch - .5) * .22, x, y);
    }
    function shadeDome(o, n, x, y) {
      const u = M3.apT(M, n), up = V.dot(u, o.s), lum = light(n);
      if (up < .36) {
        if (V.dot(u, o.door) > .9 && up < .3) return 0x4a2a16;                                   // door
        return tone(TONES.band, lum, x, y);
      }
      for (const a of [.9, -.9]) { const w = V.norm(V.add(o.door, V.cross(o.s, o.door), a)); if (up < .72 && up > .44 && V.dot(u, w) > .955) return V.dot(u, w) > .975 ? tone(TONES.glass, lum + .2, x, y) : 0x3a2214; }
      return tone(TONES.dome, lum, x, y);
    }
    const shadeBy = pal => (o, n, x, y) => tone(pal, light(n) + (pal === TONES.leaf ? (h2(x * 3, y * 5) - .5) * .25 : 0), x, y);
    const SHADE = { planet: shadePlanet, dome: shadeDome, knob: (o, n, x, y) => tone(TONES.orb, light(n) + .25, x, y), leaf: shadeBy(TONES.leaf), trunk: shadeBy(TONES.trunk), stone: shadeBy(TONES.stone), orb: (o, n, x, y) => tone(TONES.orb, light(n) * .5 + .55, x, y), dorb: (o, n, x, y) => tone(TONES.dorb, light(n) * .55 + .5, x, y), bean: (o, n, x, y) => tone(TONES.bean, light(n), x, y), dragon: (o, n, x, y) => { const inward = -(n[0] * o.vr[0] + n[1] * o.vr[1] + n[2] * o.vr[2]); if (inward > .45) return tone(TONES.belly, light(n) + .25 - (o.seg % 4 === 0 ? .3 : 0), x, y); const scale = ((x >> 1) + (y >> 1) * 2 + o.seg) % 4 === 0 ? -.16 : 0; return tone(TONES.dragon, light(n) + scale, x, y); }, spine: (o, n, x, y) => tone(TONES.dorb, light(n) + .2, x, y) };

    function outline() {
      const W = st.W, H = st.H, buf = st.buf;
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
        const k = y * W + x, id = ib[k];
        let n = 0;
        if (id) { for (const d of [-1, 1, -W, W]) { const j = k + d; if (ib[j] && ib[j] !== id && zb[j] > zb[k] + 1.2) { n = 1; break; } } if (n) { const [r, g, b] = UNPK(buf[k]); buf[k] = PK(((r * .4) << 16) | ((g * .4) << 8) | (b * .45)); } }
        else { for (const d of [-1, 1, -W, W]) { const j = k + d; if (ib[j]) { const [r, g, b] = UNPK(buf[j]); buf[k] = PK(((r * .32) << 16) | ((g * .32) << 8) | (b * .36)); zb[k] = zb[j]; break; } } }
      }
    }
    // sprite drawn against the depth buffer
    function blitZ(spr, bx, by, ang, flip, lift, depth, k = 1, raw = false) {
      const ux = Math.sin(ang), uy = -Math.cos(ang), rx = Math.cos(ang), ry = Math.sin(ang);
      const ox = bx + ux * lift, oy = by + uy * lift, Rr = (Math.hypot(spr.w, spr.h) + 1) * k, W = st.W, H = st.H;
      for (let y = Math.floor(oy - Rr); y <= oy + Rr; y++) { if (y < 0 || y >= H) continue; for (let x = Math.floor(ox - Rr); x <= ox + Rr; x++) {
        if (x < 0 || x >= W) continue;
        const dx = x + .5 - ox, dy = y + .5 - oy, lx = (dx * rx + dy * ry) / k, ly = (dx * ux + dy * uy) / k;
        let i = Math.floor(lx + spr.ax + .5); const j = Math.floor(spr.ay + .5 - ly);
        if (i < 0 || j < 0 || i >= spr.w || j >= spr.h) continue; if (flip) i = spr.w - 1 - i;
        const c = spr.col[j * spr.w + i]; if (c < 0) continue;
        const kk = y * W + x; if (zb[kk] > depth) continue;
        st.buf[kk] = PK(c);
      } }
    }

    function frame(t, dt) {
      // the hyperbolic time chamber: a year inside is a day outside — the world crawls while your power keeps real time
      const rdt = dt; if (chamberUntil > t) dt *= .3;
      if (playing) session += dt; st.bob = Math.round(Math.sin(t * .7) * 2) + (shake > 0 ? Math.round((Math.random() - .5) * 5 * shake) : 0); shake = Math.max(0, shake - dt);
      idleT += dt;
      if (!drag) {
        if (Math.abs(vrx) + Math.abs(vry) > .001) { M = M3.ortho(M3.mul(M3.mul(M3.rx(vrx * dt), M3.ry(vry * dt)), M)); vrx *= Math.pow(.06, dt); vry *= Math.pow(.06, dt); }
        if (idleT > 3) { const I = M3.I(), k = Math.min(1, dt * .7); M = M3.ortho(M.map((v, i) => v + (I[i] - v) * k)); }
      }
      // running: sprint decays; riding the golden cloud triples everything
      sprint = Math.max(0, sprint - dt * .8); riding = Math.max(0, riding - dt);
      const pace = (.42 + sprint * .9) * (riding > 0 ? 1.6 : 1);
      phi += pace * dt;
      if (phi - lastLap > 6.283) { lastLap += 6.283; if (playing) { laps++; goal('laps'); ui.fx && ui.fx('lap'); const k = kidScreen(20); gain(lapValue() * 4 * mult(), k.x, k.y - 14, true); } }
      if (jumpH > 0 || jumpV > 0) { jumpV -= 520 * dt; jumpH = Math.max(0, jumpH + jumpV * dt); if (jumpH === 0) jumpV = 0; }
      if (playing) {
      // income: lap steps + passive, once a second
      acc += rdt; if (acc >= 1) { acc -= 1; gain((lapValue() / 7 + passive()) * mult()); }
      if ((saveAcc += dt) > 3) { saveAcc = 0; save(); }

      // ── timeline: the longer you stay, the more happens
      if (session > 12) { once('stars', 'shooting stars — click one'); if (!star && (nextStar -= dt) < 0) { star = { x: -8, y: st.H * (.08 + Math.random() * .2), vx: st.W / 6 }; nextStar = 18 + Math.random() * 14; } }
      if (session > 30 && orbs.length < 3 && Math.random() < dt * .25) { once('orbs', 'ki orbs on the road'); orbs.push({ phi: phi + 1.5 + Math.random() * 2, star: session > 60 && Math.random() < (S.world ? .4 : .2) }); }
      if (session > 50) { if ((nextShower -= dt) < 0) { once('meteors', 'meteor shower — bust them'); for (let i = 0; i < 6; i++) meteors.push({ x: st.W * (.15 + Math.random() * .9), y: -10 - i * 18, vx: -st.W * .12, vy: st.H * .22, delay: i * .5 }); nextShower = 45 + Math.random() * 20; } }
      if (session > 75 || S.cloud > 0) { if (!cloudFly && riding <= 0 && (nextCloud -= dt * (1 + S.cloud * .6)) < 0) { once('cloud', 'flying nimbus is here'); cloudFly = { x: -30, y: st.H * .3 }; nextCloud = 60 + Math.random() * 25; } }
      if (session > 140 && !aura) { aura = true; ui.event('ki aura unlocked'); }
      // gregory hops about the planet now and then — catch him
      if (!greg && session > 60 && (nextGreg -= dt) < 0) { greg = { c: capPt(.2 + Math.random() * .9, Math.random() * 6.28), from: null, hopT: t, until: t + 10, hop: Math.max(.3, .75 - .08 * (S.gregWins || 0)) }; ui.event(S.gregWins ? `race gregory again — he's faster now. 10s` : 'race gregory! catch him in 10s'); nextGreg = 80 + Math.random() * 40; }
      if (greg) { if (t > greg.until) { if (greg.sx !== undefined) burst(greg.sx, greg.sy, [0xffffff, 0x9cf07a], 8, 60); greg = null; ui.event('gregory got away'); } else if (t - greg.hopT > greg.hop) { greg.from = greg.c; greg.c = V.norm(V.add(greg.c, [Math.random() - .5, Math.random() - .5, Math.random() - .5], .45)); if (V.dot(greg.c, N) < .1) greg.c = capPt(.3 + Math.random() * .6, Math.random() * 6.28); greg.hopT = t; } }
      // king kai pops out to tell a terrible joke — laugh (tap him) for ×1.25
      if (!kai && session > 45 && !shen && (nextKai -= dt) < 0) { kai = { c: capPt(.35, 3.6), t0: t, until: t + 9 }; ui.event('king kai: ' + PUNS[Math.floor(Math.random() * PUNS.length)], 6000); nextKai = 140 + Math.random() * 40; }
      // frieza's ship lands and four soldiers hop out; drop them all before it lifts off
      if (!ship && session > 150 && !tour && !shen && !boss && !(ginyu && !ginyu.done) && (nextShip -= dt) < 0) { ship = { c: capPt(.35 + Math.random() * .5, Math.random() * 6.28), t0: t, until: t + 28, out: 0, ko: 0, next: t + 1.6 }; ui.event("frieza's ship has landed — take out his soldiers!"); ui.sfx && ui.sfx('boss'); nextShip = 220 + Math.random() * 60; }
      if (ship) {
        if (!ship.left && ship.out < 4 && t > ship.next) { saibas.push({ c: V.norm(V.add(ship.c, [Math.random() - .5, Math.random() - .5, Math.random() - .5], .3)), born: t, life: 16, soldier: true }); ship.out++; ship.next = t + 1.1; }
        if (!ship.left && ship.ko >= 4) { ship.left = t; const g = Math.max(500, rate() * 60) * (1 + .5 * S.armor); const q = handPos(); gain(g, q.x, q.y - 16, true); ui.event(`frieza's soldiers are down — the ship flees! +${fmtShort(Math.round(g))}`); }
        else if (!ship.left && t > ship.until) { ship.left = t; ui.event("frieza's ship took off"); }
        if (ship.left && t - ship.left > 1.5) ship = null;
      }
      // yamcha turns up flattened in a crater now and then; help him up for a senzu
      if (!yam && session > 100 && !shen && (nextYam -= dt) < 0) { yam = { c: capPt(.3 + Math.random() * .6, Math.random() * 6.28), until: t + 14 }; ui.event('yamcha got wrecked again — tap him'); nextYam = 200 + Math.random() * 80; }
      if (yam && t > yam.until) yam = null;
      if (kai && t > kai.until) kai = null;
      // the time chamber door, once you own the key
      if (S.chamber > 0 && !door && chamberUntil < t && (nextDoor -= dt) < 0) { door = { x: cx - R * 1.45, y: cy - R * .45, t0: t, until: t + 15 }; once('door', 'the time chamber door is open — tap it'); nextDoor = 150 + Math.random() * 40; }
      if (door && t > door.until) door = null;
      // piccolo zaps a meteor with his special beam cannon
      if (S.piccolo > 0 && (nextZap -= dt) < 0) { nextZap = 5; const m = meteors.find(m => !m.dead && m.delay <= 0); if (m && piccoloAt) { zap = { x0: piccoloAt.x, y0: piccoloAt.y - 8, x1: m.x, y1: m.y, t0: t }; m.dead = true; goal('meteor'); gain(25 * mult() * (1 + laps * .1), m.x, m.y - 6, true); burst(m.x, m.y, [0xffffff, 0xfff08a, 0x9a6ad8], 12, 90); ui.sfx && ui.sfx('beam'); } }
      // the ginyu force
      if (!ginyu && !tour && !boss && !shen && session > 150 && S.best >= 5e4 && (nextGinyu -= dt) < 0) { const hp = Math.max(300, rate() * 9); ginyu = { members: GINYU.map((g, i) => ({ ...g, hp, max: hp, i, x: 0, y: 0, k: 1, flash: 0, dead: false })), max: hp * 5, t0: t, until: t + 45, nextKi: 1 }; ui.event('the ginyu force strikes a pose!'); ui.sfx && ui.sfx('boss'); nextGinyu = 300 + Math.random() * 60; }
      if (ginyu && !ginyu.done && t > ginyu.until) { ui.event('the ginyu force retreats'); ginyu.done = t; }
      if (ginyu && ginyu.done && t - ginyu.done > 1.5) ginyu = null;
      // the scouter can't take it
      if (!S.o9k && S.best > 9000) { S.o9k = 1; boostUntil = Math.max(boostUntil, t + 20); shake = .6; ui.event("it's over 9000!!  ×2 for 20s"); ui.fx && ui.fx('star'); const q = handPos(); burst(q.x, q.y - 6, [0xffffff, 0x9cf0b8, 0x34d873, 0xe0473e], 30, 160); save(); }
      // saibamen sprout from the soil in threes; tap or beam them before they burrow back
      if (!tour && session > 80 && (nextSaiba -= dt) < 0) { once('saiba', 'saibamen! tap them'); for (let i = 0; i < 3; i++) saibas.push({ c: capPt(.25 + Math.random() * .85, Math.random() * 6.28), born: t + i * .35, life: 11 }); nextSaiba = 35 + Math.random() * 20; }
      for (const sb of saibas) if (!sb.dead && t - sb.born > sb.life) { sb.dead = true; sb.gone = true; if (sb.sx !== undefined) burst(sb.sx, sb.sy - 4, [0xe7e2d4, 0xcfc8b6], 8, 50); }
      saibas = saibas.filter(sb => !sb.dead);
      // villain raids: one hovers by the planet with a health bar; Vegeta fires ki blasts at him while you tap
      // the tournament of power: 60s of saibamen waves and a villain halfway; your KO count is the score to beat
      // every 10 million power a space pod takes you to namek for half an hour
      if (!S.world && S.best >= (S.namekAt || 1e7) && !tour && !shen && !boss) { S.namekAt = (Math.floor(S.best / 1e7) + 1) * 1e7; travel(1); namekUntil = t + 1800; }
      if (S.world && !namekUntil) namekUntil = t + (S.namekLeft || 1800);   // resumed after a reload
      if (S.world) { S.namekLeft = Math.max(0, namekUntil - t); if (S.namekLeft <= 0 && !shen) { travel(0); namekUntil = 0; } }   // home after any wishes
      if (S.partner >= 3 && S.best >= 50000 && fuseUntil < t && fuseOffer < t && !tour && (nextFuse -= dt) < 0) { fuseOffer = t + 12; nextFuse = 170 + Math.random() * 60; ui.event('bubbles wants to fuse — tap him!'); }
      if (!tour && !shen && !boss && session > 75 && S.best >= 3000 && (nextTour -= dt) < 0) { tour = { t0: t, until: t + 60, ko: 0, next: 1.5, villain: false }; ui.event('the tournament of power begins — 60s!'); ui.fx && ui.fx('star'); }
      if (tour) {
        if ((tour.next -= dt) < 0 && saibas.length < 8) { saibas.push({ c: capPt(.2 + Math.random() * .9, Math.random() * 6.28), born: t, life: 6 }); tour.next = Math.max(.45, 1.2 - (t - tour.t0) / 80); }
        if (!tour.villain && t - tour.t0 > 28 && !boss) { tour.villain = true; const V0 = VILLAINS[(S.bosses || 0) % VILLAINS.length], hp = Math.max(400, rate() * 18); boss = { name: V0.name, spr: V0.spr, hp, max: hp, t0: t, until: t + 25, x: 0, y: 0, k: 1, flash: 0, nextKi: 1 }; ui.event(`${V0.name} joins the tournament!`); }
        if (t > tour.until) {
          const ko = tour.ko, best = S.tourBest || 0, prize = Math.max(500, rate() * ko * 8); S.tourBest = Math.max(best, ko); gain(prize); goal('tour', ko, true);
          ui.event(ko > best ? `tournament over — ${ko} KO, new best! +${fmtShort(Math.round(prize))}` : `tournament over — ${ko} KO (best ${best}) +${fmtShort(Math.round(prize))}`); ui.fx && ui.fx('star');
          tour = null; nextTour = 240 + Math.random() * 60; nextSaiba = 30; save();
        }
      }
      if (!tour && session > 110 && !boss && !shen && (nextBoss -= dt) < 0) {
        const V0 = VILLAINS[(S.bosses || 0) % VILLAINS.length], hp = Math.max(600, rate() * 40);
        boss = { name: V0.name, spr: V0.spr, hp, max: hp, t0: t, until: t + 40, x: 0, y: 0, k: 1, flash: 0, nextKi: 1 };
        ui.event(`${V0.name} is attacking — tap him!`); nextBoss = 160 + Math.random() * 60;
      }
      if (boss) {
        if (!boss.dead && t > boss.until) { boss.dead = true; boss.fled = true; boss.t1 = t; ui.event(`${boss.name} got away`); }
        if (boss.dead && t - boss.t1 > 1.2) boss = null;
        else if (!boss.dead && (boss.nextKi -= dt) < 0) { boss.nextKi = .7; const h = handPos(); kis.push({ x: h.x, y: h.y, t0: t }); }
      }
      if (ginyu && !ginyu.done && (ginyu.nextKi -= dt) < 0) { ginyu.nextKi = .8; const h = handPos(), m = ginyu.members.find(x => !x.dead); if (m) kis.push({ x: h.x, y: h.y, t0: t, m });
      }
      for (const kb of kis) { if (kb.m) { if (kb.m.dead || !ginyu) { kb.done = true; continue; } const tx = kb.m.x, ty = kb.m.y - kb.m.spr.h / 2 * kb.m.k, d = Math.hypot(tx - kb.x, ty - kb.y); if (d < 6) { kb.done = true; ginyuHit(kb.m, Math.max(1, rate() * .5)); continue; } const sp = 260 * dt / d; kb.x += (tx - kb.x) * Math.min(1, sp); kb.y += (ty - kb.y) * Math.min(1, sp); continue; } if (!boss || boss.dead) { kb.done = true; continue; } const tx = boss.x, ty = boss.y - boss.spr.h / 2 * boss.k, d = Math.hypot(tx - kb.x, ty - kb.y); if (d < 6) { kb.done = true; hitBoss(Math.max(1, rate() * .5), tx, ty); continue; } const sp = 260 * dt / d; kb.x += (tx - kb.x) * Math.min(1, sp); kb.y += (ty - kb.y) * Math.min(1, sp); }
      kis = kis.filter(kb => !kb.done);
      // super mode: a 25s golden-hair burst (×2) each time power level passes the next milestone
      // transform when power level reaches the next form
      if (S.form < FORMS.length - 1 && S.pl >= FORMS[S.form + 1].at) {
        S.form++; const F = FORMS[S.form]; ui.sfx && ui.sfx('form'); ui.event(F.name + '!  ×' + F.x); ui.fx && ui.fx('form', S.form); flashT = 1;
        for (let k = 0; k < 90; k++) { const q = kidScreen(10); fx.add({ x: q.x, y: q.y, vx: (Math.random() - .5) * 200, vy: (Math.random() - .5) * 200, drag: 2, life: 1.1, c: F.aura, raw: true }); }
        save();
      }
      if (star) { star.x += star.vx * dt; star.y += Math.sin(t * 3) * .3; if (Math.random() < .8) fx.add({ x: star.x - 4, y: star.y, vx: -12, vy: 4, life: .6, s: 2, c: [0xffd84a, 0xf2b134], raw: true }); if (star.x > st.W + 12) star = null; }
      for (const m of meteors) { if (m.delay > 0) { m.delay -= dt; continue; } m.x += m.vx * dt; m.y += m.vy * dt; if (!m.dead && Math.random() < .9) fx.add({ x: m.x + 2, y: m.y - 2, vx: -m.vx * .1, vy: -m.vy * .1, life: .5, s: 2, grow: 1, c: [0xfff1c0, 0xffb35a, 0xe0473e, 0x8a8f98], raw: true }); }
      meteors = meteors.filter(m => !m.dead && m.y < st.H + 10);
      if (cloudFly) { const k = kidScreen(10); cloudFly.x += (k.x - cloudFly.x) * dt * 1.8; cloudFly.y += (k.y - 10 - cloudFly.y) * dt * 1.8; if (Math.hypot(k.x - cloudFly.x, k.y - 10 - cloudFly.y) < 6) { cloudFly = null; riding = 10 + S.cloud * 2; ui.event('riding flying nimbus — ×1.5'); } }
      for (const o of orbs) { let d = Math.atan2(Math.sin(o.phi - phi), Math.cos(o.phi - phi)); if (Math.abs(d) < .06 && !o.done) { o.done = true; const k = kidScreen(16); gain(lapValue() * mult() * (o.star ? 3 : 1), k.x, k.y - 12, true); if (o.star) { goal('ball'); S.orbs7++; if (S.orbs7 >= 7) { S.orbs7 = 0; summon(); } else ui.event(`dragon ball ${S.orbs7}/7`); save(); } for (let i = 0; i < 12; i++) fx.add({ x: k.x, y: k.y - 10, vx: (Math.random() - .5) * 90, vy: (Math.random() - .5) * 90, drag: 3, life: .6, c: [0xffffff, 0xffd84a, 0xff9a3c], raw: true }); } }
      for (let i = orbs.length - 1; i >= 0; i--) if (orbs[i].done) orbs.splice(i, 1);
      if (t - lastClick > .9) combo = 1;
      if (session > 40 && !moon && apeUntil < t && (nextMoon -= dt) < 0) { moon = { x: st.W * .2, y: st.H * .22, r: Math.max(9, Math.round(Math.min(st.W, st.H) * .07)), a: 0, born: t }; once('moon', 'a full moon is rising… click it to transform'); }
      if (moon) { moon.a = moon.leaving ? moon.a - dt * 1.5 : Math.min(1, moon.a + dt * 1.2); if (!moon.leaving && t - moon.born > 25) moon.leaving = true; if (moon.a <= 0 && moon.leaving) { moon = null; nextMoon = 110 + Math.random() * 40; } }

      if (drag && (drag.moved <= 6 || charging > 0) && S.galick > 0 && t - drag.t > .3) charging = Math.min(2.5, t - drag.t - .3); else if (!drag) charging = 0;
      if (S.senzu > 0 && !bean && (nextBean -= dt) < 0) { bean = { c: V.mul(capPt(.3 + Math.random() * .9, Math.random() * 6.28), 1.03) }; nextBean = 40 / S.senzu; once('bean', 'a senzu bean sprouted — tap it'); }
      const fxs = [];
      if (S.world) { const left = Math.max(0, namekUntil - t); fxs.push(left > 60 ? `namek ${Math.ceil(left / 60)}m` : `namek ${Math.ceil(left)}s`); }
      if (greg) fxs.push(`gregory ${Math.ceil(greg.until - t)}s`);
      if (chamberUntil > t) fxs.push(`time chamber ×2 ${Math.ceil(chamberUntil - t)}s`);
      if (laughUntil > t) fxs.push(`laughing ×1.25 ${Math.ceil(laughUntil - t)}s`);
      if (ginyu && !ginyu.done) fxs.push(`ginyu force ${Math.ceil(ginyu.until - t)}s`);
      if (fuseUntil > t) fxs.push(`fusion ×2 ${Math.ceil(fuseUntil - t)}s`);
      if (dailyUntil > t) fxs.push(`daily ×1.25 ${Math.ceil((dailyUntil - t) / 60)}m`);
      if (tour) fxs.push(`tournament ${Math.ceil(tour.until - t)}s · ${tour.ko} KO`);
      if (kaioUntil > t) fxs.push(`kaioken ×${KAIO()} ${Math.ceil(kaioUntil - t)}s`); else if (tiredUntil > t) fxs.push(`tired ×0.5 ${Math.ceil(tiredUntil - t)}s`);
      if (boostUntil > t) fxs.push(`star ×2 ${Math.ceil(boostUntil - t)}s`);
      if (senzuUntil > t) fxs.push(`senzu ×1.5 ${Math.ceil(senzuUntil - t)}s`);
      if (riding > 0) fxs.push('nimbus ×1.5');
      if (apeUntil > t) fxs.push(`great ape ×3 ${Math.ceil(apeUntil - t)}s`);
      const extra = [S.form ? FORMS[S.form].name + ' ×' + FORMS[S.form].x : (S.pl > 2000 ? 'next form at 20K' : ''), S.orbs7 || S.wishes ? `dragon balls ${S.orbs7}/7` : '', S.wishes ? `wishes ${S.wishes}` : '', S.ascend ? `ascended ×${(1 + .5 * S.ascend).toFixed(1)}` : ''].filter(Boolean).join(' · ');
      const nf = FORMS[S.form + 1], cf = FORMS[S.form];
      const G = GOALS.find(g => g.id === S.goal.id);
      ui.update({ goal: { text: G.text, p: Math.min(S.goal.p, G.n), n: G.n }, kaio: { own: S.kaio > 0, ready: t >= kaioReady, left: Math.ceil(kaioReady - t) }, pl: S.pl, best: S.best, rate: rate(), laps, time: session, effects: fxs.join(' · '), extra, combo, form: { name: S.form ? cf.name : 'base', x: cf.x, next: nf ? nf.name : '', p: nf ? Math.min(1, Math.max(0, (S.best - (cf.at || 0)) / (nf.at - (cf.at || 0)))) : 1 }, balls: S.orbs7, wishes: S.wishes, ascend: S.ascend ? (1 + .5 * S.ascend).toFixed(1) : '' });
      syncShop();
      }

      // ── draw
      st.clear(); zb.fill(-1e9); ib.fill(0);
      drawSea(t, false);
      if (moon) {
        const { x, y, r } = moon, a = moon.a;
        for (let yy = -r - 6; yy <= r + 6; yy++) for (let xx = -r - 6; xx <= r + 6; xx++) {
          const d = Math.hypot(xx, yy);
          if (d <= r - 1) { const n = h2(Math.round(x + xx) * 3, Math.round(y + yy) * 5), crater = Math.hypot(xx + r * .3, yy - r * .2) < r * .22 || Math.hypot(xx - r * .35, yy + r * .3) < r * .16 || Math.hypot(xx - r * .1, yy - r * .45) < r * .12; const l = -(xx * .5 + yy * .6) / r + (n - .5) * .3; st.px(x + xx, y + yy, crater ? 0xe6c878 : l > .3 ? 0xfffbe6 : l > -.3 ? 0xffeab0 : 0xf2d07e, a); }
          else if (d <= r) st.px(x + xx, y + yy, 0xc89a3a, a);
          else if (d <= r + 7 && bayer(Math.round(x + xx), Math.round(y + yy)) < (1 - (d - r) / 7) * .7 * a) st.px(x + xx, y + yy, 0xffd978, .8);
        }
      }
      let id = 1;
      sphere({ c: [0, 0, 0], r: 1 }, id++, shadePlanet);
      for (const o of solids) sphere(o, id++, SHADE[o.kind]);
      for (const o of orbs) sphere({ c: V.mul(roadPt(o.phi), 1.14 + Math.sin(t * 4 + o.phi) * .015), r: o.star ? .055 : .045 }, id++, o.star ? SHADE.dorb : SHADE.orb);
      if (bean) { sphere({ c: bean.c, r: .04 }, id++, SHADE.bean); const v = M3.ap(M, bean.c); if (v[2] > 0) { bean.sx = cx + v[0] * R; bean.sy = cy - v[1] * R + st.bob; } else bean.sx = undefined; }
      const shenCtx = shen && { z: 0, px(x, y, hex, dz = 0) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= st.W || y >= st.H) return; const k = y * st.W + x, z = this.z + dz; if (zb[k] > z) return; zb[k] = z; st.buf[k] = PK(hex); dm[k] = 1; }, W: st.W, H: st.H, cx, cy: cy + st.bob, R, t, rise: Math.min(1, (t - shen.t0) / 1.1), age: t - shen.t0, gone: shen.phase === 'leave' ? Math.min(1, (t - shen.t1) / 1.6) : 0, glow: shen.look === 3 };
      outline();
      // dragon balls get a proper red star on their face
      for (const o of orbs) if (o.star) {
        const v = M3.ap(M, V.mul(roadPt(o.phi), 1.14 + Math.sin(t * 4 + o.phi) * .015)); if (v[2] < .1) continue;
        const x = Math.round(cx + v[0] * R) - 1, y = Math.round(cy - v[1] * R + st.bob) - 1, k = y * st.W + x;
        if (k < 0 || k >= zb.length || zb[k] > v[2] * R + .055 * R + 1) continue;
        const pat = .055 * R >= 4 ? ['...r...', '..rrr..', 'rrrrrrr', '.rrrrr.', '..rrr..', '.rr.rr.', '.r...r.'] : ['..r..', '.rrr.', 'rrrrr', '.rrr.', '.r.r.'];
        const h = pat.length >> 1; pat.forEach((row, j) => [...row].forEach((c, i) => { if (c === 'r') st.px(x + i - h, y + j - h, 0xd8241e); }));
      }
      // drawn after the planet's outline, depth-tested so the planet, trees and runner occlude him correctly
      if (shen) { dm.fill(0); if (shen.porunga) SHENRON.drawPorunga(shenCtx); else SHENRON.draw(shenCtx, shen.look); }
      for (const sb of saibas) {
        const v = M3.ap(M, sb.c), up = Math.min(1, Math.max(0, (t - sb.born) / .5)), down = Math.min(1, Math.max(0, (sb.born + sb.life - t) / .5));
        if (v[2] < .05 || up <= 0) { sb.sx = undefined; continue; }
        sb.sx = cx + v[0] * R; sb.sy = cy - v[1] * R + st.bob;
        const hop = Math.abs(Math.sin((t - sb.born) * 7)) * 2 * up * down;
        blitZ(sb.soldier ? SOLDIER : SAIBA, sb.sx, sb.sy, Math.atan2(v[0], v[1]), Math.sin(t * 3 + sb.born) > 0, (up * down - 1) * 11 + hop, v[2] * R + 4, 1.1);
      }
      // kid (and the monkey) against the depth buffer
      const kd = kidScreen(), set = fuseUntil > t ? KID.fused : KID.forms[S.form];
      const ahead = M3.ap(M, roadPt(phi + .05)), ax = cx + ahead[0] * R, flip = ax < kd.x;
      const spr = jumpH > 1 ? set.run[0] : set.run[Math.floor(t * (9 + sprint * 10)) % 4];
      const lift = jumpH + (riding > 0 ? 9 : 0), depth = kd.v[2] * R + 6; flipNow = flip; liftNow = lift;
      // auras and sparks only while he's in view: behind the planet the depth buffer hides him, and must hide them too
      const seen = (() => { const x = Math.round(kd.x + Math.sin(kd.ang) * (lift + 8)), y = Math.round(kd.y - Math.cos(kd.ang) * (lift + 8)); return x < 0 || y < 0 || x >= st.W || y >= st.H || zb[y * st.W + x] <= depth + 4; })();
      if (riding > 0) blitZ(puff, kd.x, kd.y, kd.ang, flip, lift - 9, depth + 1, 1.25, true);
      if (seen && (aura || boostUntil > t || riding > 0 || S.form > 0 || kaioUntil > t || S.aura)) for (let i = 0; i < (S.form > 0 ? 4 : 3); i++) { const a = kd.ang + (Math.random() - .5) * .9, r = 4 + Math.random() * 8; fx.add({ x: kd.x + Math.sin(kd.ang) * (lift + 10) + Math.cos(a) * r, y: kd.y - Math.cos(kd.ang) * (lift + 10) + Math.sin(a) * r * .5, vx: Math.sin(kd.ang) * 20, vy: -Math.cos(kd.ang) * 30, life: .5, s: 1, grow: 1, c: kaioUntil > t ? [0xffffff, 0xff9a8a, 0xe0332b] : !S.form && S.aura ? AURAS[(S.aura - 1) % AURAS.length] : FORMS[S.form].aura, raw: true }); }
      // super saiyan 2+: crackling sparks around him
      if (seen && FORMS[S.form].sparks && Math.random() < .35) { let x = kd.x + (Math.random() - .5) * 22, y = kd.y - Math.cos(kd.ang) * (lift + 14) + (Math.random() - .5) * 26; for (let k = 0; k < 6; k++) { st.px(x, y, FORMS[S.form].sparks); x += (Math.random() - .5) * 4; y += 1 + Math.random() * 2; } }
      if (apeUntil > t) {
        // giant ape stomps: a little hop each step and a screen shake on landing
        const step = Math.floor(t * 3.2); if (step !== apeStep) { apeStep = step; shake = Math.max(shake, .35); for (let k = 0; k < 8; k++) fx.add({ x: kd.x + (Math.random() - .5) * 30, y: kd.y, vx: (Math.random() - .5) * 60, vy: -20 - Math.random() * 30, drag: 2, life: .5, s: 2, c: [0xffffff, 0xe7e2d4], raw: true }); }
        blitZ(APE[step % 2], kd.x, kd.y, kd.ang, flip, lift + Math.abs(Math.sin(t * 3.2 * Math.PI)) * 3, depth + 30, 2.3);
      } else blitZ(spr, kd.x, kd.y, kd.ang, flip, lift, depth, 1.05);
      // piccolo meditates above the planet; king kai and gregory stand on it
      if (S.piccolo > 0) { const c = capPt(.6, .9), v = M3.ap(M, V.mul(c, 1.28)); piccoloAt = v[2] > -.2 ? { x: cx + v[0] * R, y: cy - v[1] * R + st.bob + Math.sin(t * 1.6) * 2 } : null; if (piccoloAt) blitZ(PICCOLO, piccoloAt.x, piccoloAt.y, 0, false, 0, v[2] * R + 8, .95); } else piccoloAt = null;
      if (kai) { const v = M3.ap(M, kai.c), up = Math.min(1, (t - kai.t0) / .4) * Math.min(1, (kai.until - t) / .4); if (v[2] > .05) { kai.sx = cx + v[0] * R; kai.sy = cy - v[1] * R + st.bob; blitZ(KINGKAI, kai.sx, kai.sy, Math.atan2(v[0], v[1]), false, (up - 1) * 18, v[2] * R + 6, .85); } else kai.sx = undefined; }
      if (ship) { const v = M3.ap(M, ship.c), land = Math.min(1, (t - ship.t0) / 1.2), lift = ship.left ? Math.pow((t - ship.left) / 1.5, 2) : 0; if (v[2] > .05) { ship.sx = cx + v[0] * R; ship.sy = cy - v[1] * R + st.bob; blitZ(SHIP, ship.sx, ship.sy, Math.atan2(v[0], v[1]), false, (1 - land) * 70 + lift * 90, v[2] * R + 5, .9); } }
      if (yam) { const v = M3.ap(M, yam.c); if (v[2] > .05) { yam.sx = cx + v[0] * R; yam.sy = cy - v[1] * R + st.bob; blitZ(YAMCHA, yam.sx, yam.sy, Math.atan2(v[0], v[1]), false, -2, v[2] * R + 3, .9); } else yam.sx = undefined; }
      if (greg) { const k = Math.min(1, (t - greg.hopT) / .35), from = greg.from || greg.c, c = V.norm(V.add(V.mul(from, 1 - k), greg.c, k)), v = M3.ap(M, c); if (v[2] > .05) { greg.sx = cx + v[0] * R; greg.sy = cy - v[1] * R + st.bob; blitZ(GREGORY, greg.sx, greg.sy, Math.atan2(v[0], v[1]), k < 1 && from[0] > greg.c[0], Math.sin(k * Math.PI) * 9, v[2] * R + 4, 1.1); } else greg.sx = undefined; }
      if (S.partner > 0 && fuseUntil <= t) {
        const mv = M3.ap(M, roadPt(phi - .32)), mx = cx + mv[0] * R, my = cy - mv[1] * R + st.bob, ma = Math.atan2(mv[0], mv[1]);
        monkeyAt = mv[2] > 0 ? { x: mx, y: my } : null;
        if (fuseOffer > t && Math.random() < .7) fx.add({ x: mx + (Math.random() - .5) * 12, y: my - 4 - Math.random() * 10, vx: 0, vy: -20, life: .5, s: 1, c: [0xffffff, 0xffe08a, 0xff9a3c], raw: true });
        blitZ(MONKEY[Math.floor(t * 8) % 2], mx, my, ma, flip, fuseOffer > t ? Math.abs(Math.sin(t * 9)) * 3 : 0, mv[2] * R + 5, 1.1);
      } else monkeyAt = null;
      if (seen && fuseUntil > t && Math.random() < .6) { const q = handPos(); fx.add({ x: q.x + (Math.random() - .5) * 20, y: q.y + (Math.random() - .5) * 20, vx: 0, vy: -26, life: .5, s: 1, grow: 1, c: [0xffffff, 0xffe08a, 0xff9a3c, 0x6fb0ff], raw: true }); }
      if (charging > 0 && seen) {
        const hp = handPos(), hx = hp.x, hy = hp.y, r = 2 + charging * 2.2;
        // a dotted aim line toward the pointer
        if (drag) { let ax = drag.ax - hx, ay = drag.ay - hy; const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al; for (let d = r + 4; d < Math.min(al, 400); d += 4) if (((d / 4 | 0) + (t * 12 | 0)) % 2) st.px(hx + ax * d, hy + ay * d, 0x9a5af0); }
        for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = Math.hypot(x, y) / r; if (d > 1) continue; if (d > .7 && bayer(Math.round(hx + x), Math.round(hy + y)) > .5) continue; st.px(hx + x, hy + y, d < .4 ? 0xffffff : d < .75 ? 0xd9b8ff : 0x8a4ae8); }
        if (Math.random() < .9) { const a = Math.random() * 6.28, rr = r + 6 + Math.random() * 8; fx.add({ x: hx + Math.cos(a) * rr, y: hy + Math.sin(a) * rr, vx: -Math.cos(a) * rr * 3, vy: -Math.sin(a) * rr * 3, life: .3, c: [0xffffff, 0xc9a2ff], raw: true }); }
      }
      if (bang) {
        const k = Math.min(1, (t - bang.t0) / bang.dur), x = bang.x0 + (bang.x1 - bang.x0) * k, y = bang.y0 + (bang.y1 - bang.y0) * k - Math.sin(k * Math.PI) * 14, r = 3 + k * 2;
        for (let yy = -r - 2; yy <= r + 2; yy++) for (let xx = -r - 2; xx <= r + 2; xx++) { const d = Math.hypot(xx, yy); if (d <= r) st.px(x + xx, y + yy, d < r * .5 ? 0xffffff : 0x8fd8ff); else if (d <= r + 2 && bayer(Math.round(x + xx), Math.round(y + yy)) < .5) st.px(x + xx, y + yy, 0x4a9aff, .7); }
        fx.add({ x, y, vx: 0, vy: 0, life: .25, s: 2, c: [0xffffff, 0x8fd8ff, 0x2f6ae0], raw: true });
        if (k >= 1) { explode(bang.x1, bang.y1); bang = null; }
      }
      for (let i = blasts.length - 1; i >= 0; i--) {
        const b = blasts[i], k = (t - b.t0) / .45; if (k > 1) { blasts.splice(i, 1); continue; }
        const rr = b.r * (.3 + .7 * Math.sqrt(k));
        for (let yy = -rr; yy <= rr; yy++) for (let xx = -rr; xx <= rr; xx++) { const d = Math.hypot(xx, yy); if (d > rr) continue; const edge = d > rr - 2; if (!edge && bayer(Math.round(b.x + xx), Math.round(b.y + yy)) > (1 - k) * .8) continue; st.px(b.x + xx, b.y + yy, edge ? (k < .5 ? 0xffffff : 0x8fd8ff) : d < rr * .4 ? 0xffffff : 0xbfe9ff); }
      }
      if (capsule) {
        const c = capsule; if (c.y < c.land) { c.vy += 160 * dt; c.y = Math.min(c.land, c.y + c.vy * dt); } else c.y = c.land + Math.sin((t - c.t0) * 4) * 1.5;
        if (t - c.t0 > 8) openCapsule();
        else { const x = Math.round(c.x), y = Math.round(c.y); for (let yy = -3; yy <= 3; yy++) for (let xx = -6; xx <= 6; xx++) { const inside = Math.hypot(Math.max(0, Math.abs(xx) - 3), yy) <= 3; if (!inside) continue; const edge = Math.hypot(Math.max(0, Math.abs(xx) - 3), yy) > 2.2; st.px(x + xx, y + yy, edge ? 0x2a2a30 : xx === 0 ? 0x9a9ca4 : xx < 0 ? 0xffffff : 0xd9dbe0); } st.px(x + 3, y - 4, 0xe0332b); st.px(x + 4, y - 4, 0xe0332b); if (((t * 4) | 0) % 2) st.px(x - 2, y - 1, 0xffffff); }
      }
      if (beam) {
        const age = t - beam.t0, life = .7 + beam.c * .25;
        if (age > life) beam = null;
        else {
          const w = (3 + beam.c * 3) * (beam.ff ? 1.8 : 1) * (1 - Math.pow(age / life, 3)), reach = Math.min(1, age / .12) * Math.max(st.W, st.H) * 1.6;
          // the beam sits at vegeta's depth: from the far side only the part clearing the planet shows
          const px = (X, Y, c, a) => { const xi = Math.round(X), yi = Math.round(Y), k = yi * st.W + xi; if (xi >= 0 && yi >= 0 && xi < st.W && k < zb.length && zb[k] > beam.z + 6) return; st.px(X, Y, c, a); };
          for (let d = 2; d < reach; d += .6) {
            const x0 = beam.x + beam.dx * d, y0 = beam.y + beam.dy * d; if (x0 < -30 || y0 < -30 || x0 > st.W + 30 || y0 > st.H + 30) break;
            const ww = w * Math.min(1, .35 + d / 18) * (1 + Math.sin(d * .35 - t * 40) * .12), gw = ww + 2.5;
            for (let o = -gw; o <= gw; o += .6) { const a = Math.abs(o) / (ww || 1), X = x0 - beam.dy * o, Y = y0 + beam.dx * o; if (a > 1) { if (bayer(Math.round(X), Math.round(Y)) < .5) px(X, Y, beam.ff ? 0xffe066 : 0xb98af8, .6); continue; } px(X, Y, a < .4 ? 0xffffff : a < .75 ? (beam.ff ? 0xfff3a0 : 0xe2cbff) : (beam.ff ? 0xffc21a : 0x7a3ae0)); }
          }
          // the charged ball stays lit in his hands while the beam pours out
          const bw = w * 1.4; for (let y = -bw; y <= bw; y++) for (let x = -bw; x <= bw; x++) { const q = Math.hypot(x, y) / bw; if (q <= 1) px(beam.x + x, beam.y + y, q < .55 ? 0xffffff : beam.ff ? 0xfff3a0 : 0xd9b8ff); }
          if (beam.z > 0 && Math.random() < .8) fx.add({ x: beam.x + beam.dx * Math.random() * 80, y: beam.y + beam.dy * Math.random() * 80, vx: (Math.random() - .5) * 60, vy: (Math.random() - .5) * 60, life: .4, c: [0xffffff, 0xc9a2ff, 0x7a3ae0], raw: true });
        }
      }
      if (sprint > .3 && Math.random() < .6) fx.add({ x: kd.x, y: kd.y, vx: (Math.random() - .5) * 30, vy: -10, drag: 3, life: .4, s: 1, grow: 1.5, c: [0xffffff, 0xe7e2d4], raw: true });
      if (cloudFly) st.blit(puff, cloudFly.x - 13, cloudFly.y - 9, false, true);
      if (boss) {
        const k = boss.k = Math.max(.9, R / 62), ent = Math.min(1, (t - boss.t0) / 1.2), out = boss.dead ? Math.min(1, (t - boss.t1) / 1.2) : 0;
        boss.x = cx + R * 1.45 + (1 - ent) * st.W * .4 + (boss.fled ? out * st.W * .5 : 0); boss.y = cy - R * .75 + Math.sin(t * 2) * 3 - (boss.fled ? out * 30 : 0);
        boss.x = Math.min(boss.x, st.W - (boss.spr.w / 2 + 2) * k - 3 + (1 - ent) * st.W * .4 + (boss.fled ? out * st.W * .5 : 0));
        boss.flash = Math.max(0, boss.flash - dt);
        if (!(boss.dead && !boss.fled)) {
          const spr = boss.spr, W = st.W;
          for (let j = 0; j < spr.h; j++) for (let i = 0; i < spr.w; i++) { const c = spr.col[j * spr.w + (spr.w - 1 - i)]; if (c < 0) continue; for (let yy = 0; yy < k; yy++) for (let xx = 0; xx < k; xx++) st.px(boss.x + (i - spr.ax) * k + xx, boss.y + (j - spr.h) * k + yy, boss.flash > 0 ? 0xffffff : c); }
          // health bar and name
          const bw = Math.round(20 * k), bx = Math.round(boss.x - bw / 2), by = Math.round(boss.y - spr.h * k - 7), f = Math.max(0, boss.hp / boss.max);
          for (let x = -1; x <= bw; x++) for (let y = -1; y <= 2; y++) st.px(bx + x, by + y, x < 0 || x === bw || y < 0 || y === 2 ? 0x1d1030 : x < bw * f ? (f > .3 ? 0x34d873 : 0xe0473e) : 0xffffff);
          const nm = boss.name.toUpperCase(), nx = Math.round(boss.x - st.textWidth(nm) / 2);
          for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) st.text(nm, nx + ox, by - 8 + oy, 0xffffff); st.text(nm, nx, by - 8, 0x1d1030);
        }
      }
      if (door) { const a = Math.min(1, (t - door.t0) / .5); blitZ(DOOR, door.x, door.y + (1 - a) * 10 + Math.sin(t * 2) * 1.5, 0, false, 0, 9999, 1.2); if (Math.random() < .3) fx.add({ x: door.x + (Math.random() - .5) * 12, y: door.y - Math.random() * 18, vx: 0, vy: -10, life: .6, s: 1, c: [0xffffff, 0xf6f4ee], raw: true }); }
      if (zap) { const k = (t - zap.t0) / .3; if (k > 1) zap = null; else { const dx = zap.x1 - zap.x0, dy = zap.y1 - zap.y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L; for (let d = 0; d < L; d += .6) { const w = Math.sin(d * .5) * 2.2; st.px(zap.x0 + dx * d / L + nx * w, zap.y0 + dy * d / L + ny * w, 0xc89aff); st.px(zap.x0 + dx * d / L, zap.y0 + dy * d / L, 0xfff6a0); } } }
      if (ginyu) for (const m of ginyu.members) {
        const k = m.k = Math.max(.9, R / 62), slot = m.i - 2, ent = Math.min(1, (t - ginyu.t0) / 1.2 + m.i * -.1), out = ginyu.done ? Math.min(1, (t - ginyu.done) / 1.2) : 0;
        m.x = cx + slot * R * .55 + (1 - Math.max(0, ent)) * st.W * .6; m.y = cy - R * 1.12 - Math.abs(slot) * -R * .08 + Math.sin(t * 2 + m.i) * 2 - out * 40;
        m.flash = Math.max(0, m.flash - dt); if (m.dead) continue;
        const spr = m.spr; for (let j = 0; j < spr.h; j++) for (let i = 0; i < spr.w; i++) { const c = spr.col[j * spr.w + ((t * 2 + m.i) % 2 < 1 ? i : spr.w - 1 - i)]; if (c < 0) continue; for (let yy = 0; yy < k; yy++) for (let xx = 0; xx < k; xx++) st.px(m.x + (i - spr.ax) * k + xx, m.y + (j - spr.h) * k + yy, m.flash > 0 ? 0xffffff : c); }
        const bw = Math.round(12 * k), bx = Math.round(m.x - bw / 2), by = Math.round(m.y - spr.h * k - 5), f = Math.max(0, m.hp / m.max);
        for (let x = -1; x <= bw; x++) for (let y = -1; y <= 1; y++) st.px(bx + x, by + y, x < 0 || x === bw || y !== 0 ? 0x1d1030 : x < bw * f ? 0x34d873 : 0xffffff);
      }
      if (chamberUntil > t) {   // the time chamber: every frame leaves a ghost of the last, so everything trails afterimages
        const e = Math.min(1, (t - chamberT0) / .5, (chamberUntil - t) / .5), B = st.buf, f = .62 * e, mix = (a, b, q) => (a + (b - a) * q) | 0;
        if (!echo || echo.length !== B.length) echo = new Uint32Array(B);
        for (let k = 0; k < B.length; k++) { const [r, g, b, al] = UNPK(B[k]), [r2, g2, b2, a2] = UNPK(echo[k]); if (!al && !a2) continue; const q = al ? f * a2 / 255 : 1; B[k] = echo[k] = PK((mix(r, r2, q) << 16) | (mix(g, g2, q) << 8) | mix(b, b2, q), al || (a2 * f) | 0); }
      } else echo = null;
      for (const kb of kis) for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) { const d = Math.hypot(x, y); if (d <= 2.2) st.px(kb.x + x, kb.y + y, d < 1.2 ? 0xffffff : 0x8fd8ff); }
      for (const m of meteors) if (m.delay <= 0) { st.px(m.x, m.y, 0xffffff); st.px(m.x + 1, m.y, 0xffe08a); st.px(m.x, m.y + 1, 0xffb35a); st.px(m.x + 1, m.y + 1, 0xe0473e); }
      fx.step(st, dt);
      if (star) st.blit(STAR, star.x - 4, star.y - 4, false, true);   // in front of the planet, like its tail
      drawSea(t, true);
      if (flashT > 0) { flashT = Math.max(0, flashT - dt * 1.8); const a = flashT * flashT * .85; for (let k = 0; k < st.buf.length; k++) { if (bayer(k % st.W, (k / st.W) | 0) < a) st.buf[k] = 0xffffffff; } }
      if (shen) {
        const age = t - shen.t0, dark = shen.phase === 'leave' ? Math.max(0, .62 * (1 - (t - shen.t1) / 1.6)) : Math.min(.62, age * .4);
        if (shen.phase === 'rise' && age > 4.4) openWish();
        if (shen.phase === 'leave' && t - shen.t1 > 1.7) { shen = null; document.body.classList.remove('shen'); }
        // no darkening: he just appears in the daylight
      }
      for (const f of floats) { f.life -= dt * .8; f.y -= dt * 16; if (f.life <= 0) continue; const x = Math.round(f.x - st.textWidth(f.s) / 2), y = Math.round(f.y), a = Math.min(1, f.life * 2); for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) st.text(f.s, x + ox, y + oy, 0xffffff, a); st.text(f.s, x, y, f.gold ? 0xd99a1c : 0x111111, a); }
      for (let k = floats.length - 1; k >= 0; k--) if (floats[k].life <= 0) floats.splice(k, 1);
      st.flush();
    }

    function drawSea(t, front) {
      // cloud puffs keep the same on-screen size whatever the pixel scale (phones render at 2×, desktop at 3×)
      const ck = 3 / st.scale, base = st.H - (st.H * (front ? .06 : .14) * (st.scale === 2 ? .7 : 1)), W = st.W, pal = WORLDS[S.world].sea, sp = (front ? 6 : 3) * ck, rr = Math.round((front ? 9 : 7) * ck);
      for (let i = -2; i < W / (rr * 1.3) + 3; i++) {
        const px = ((i * rr * 1.3 - t * sp) % (W + rr * 4) + W + rr * 4) % (W + rr * 4) - rr * 2, py = base + Math.sin(i * 1.7) * rr * .45 + (front ? 0 : -6 * ck), r = rr * (.8 + .4 * hash(i * 3.3 + (front ? 9 : 0)));
        for (let y = Math.floor(py - r); y < st.H; y++) for (let x = Math.floor(px - r); x <= px + r; x++) {
          const dx = x - px, dy = y - py; if (dy < 0 && dx * dx + dy * dy > r * r) continue; if (dy >= 0 && Math.abs(dx) > r) continue;
          const l = dy < 0 ? -(dx * .5 + dy * .9) / r : -.6 - dy / (st.H - py + 1), v = l + bayer(x, y) * .3;
          st.px(x, y, pal[v > .65 ? 3 : v > .2 ? 2 : v > -.4 ? 1 : 0]);
        }
      }
    }
    useWorld(S.world || 0); ui.world && ui.world(S.world || 0);
    layout(); scenery(); syncShop();
    if (/ape/.test(location.hash)) { session = 41; nextMoon = 0; }
    if (/ginyu/.test(location.hash)) { session = 151; S.best = Math.max(S.best, 5e4); nextGinyu = 0; }   // preview hook: #ginyu
    if (/visitors/.test(location.hash)) { session = 61; nextGreg = 0; nextKai = 0; }   // preview hook: #visitors (gregory, king kai)
    if (/raid/.test(location.hash)) { session = 111; nextBoss = 0; nextSaiba = 0; }   // preview hook: #raid
    if (/fusion/.test(location.hash)) { S.partner = Math.max(3, S.partner); S.best = Math.max(S.best, 5e4); nextFuse = 2; }   // preview hook: #fusion
    if (/namek|porunga/.test(location.hash)) { S.best = Math.max(S.best, 1e7); S.namekAt = 1e7; }   // preview hooks: #namek, #porunga (namek, then summon)
    if (/chamber/.test(location.hash)) setTimeout(() => { chamberT0 = st.t; chamberUntil = st.t + 60; }, 800);   // preview hook: #chamber
    if (/frieza/.test(location.hash)) { session = 151; nextShip = 0; }   // preview hook: #frieza (his ship lands)
    if (/yamcha/.test(location.hash)) { session = 101; nextYam = 0; }   // preview hook: #yamcha
    if (/gregory/.test(location.hash)) { session = 61; nextGreg = 0; }   // preview hook: #gregory (the race)
    if (/tournament/.test(location.hash)) { session = 76; S.best = Math.max(S.best, 3000); nextTour = 0; }   // preview hook: #tournament
    if (/shenron/.test(location.hash)) setTimeout(() => summon(+(location.hash.match(/shenron(\d)/) || [0, 1])[1]), 800);   // preview hook: #shenron summons him   // preview hook: #ape brings the moon out at once
    return { frame, kaioken, start: () => {
      playing = true; syncShop();
      // while you were away: half of your idle rate, up to eight hours
      const away = S.last ? Math.min(8 * 3600, (Date.now() - S.last) / 1000) : 0, idle = (lapValue() / 7 + passive()) * Math.pow(1.5, S.gravity) * Math.pow(2, S.wishes) * (1 + .5 * S.ascend) * FORMS[S.form].x;
      if (away > 90 && idle > 0) { const got = Math.round(idle * away * .5); gain(got); setTimeout(() => ui.event(`while you were away: +${fmtShort(got)}`), 900); }
      // first visit of the day: ×1.25 for five minutes and a dragon ball
      const today = new Date().toDateString();
      if (S.daily !== today) { const first = !S.daily; S.daily = today; if (!first) { dailyUntil = st.t + 300; S.orbs7 = Math.min(6, S.orbs7 + 1); setTimeout(() => ui.event('daily bonus: ×1.25 for 5 min + a dragon ball'), away > 90 ? 3600 : 900); } }
      if (/porunga/.test(location.hash)) setTimeout(() => summon(), 2500);
      save();
    }, resize: layout, train: () => { const k = kidScreen(14); onClick(k.x + 999, k.y + 999); } };
  }
});
