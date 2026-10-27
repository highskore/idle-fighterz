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
function makeHero(head, pal = {}, gi = false) {
  const base = Object.assign({ o: 0x120c18, h: 0x1a1826, H: 0x4a5080, s: 0xf6c8a2, S: 0xd99a73, e: 0x120c18, m: 0xa8564e, b: 0x2b4fc8, B: 0x1c3584, a: 0xf4f4f6, A: 0xc2c6d2, y: 0xe8c040, Y: 0xa8841a, g: 0xffffff, G: 0xc8ccda, w: 0xffffff, W: 0xc8ccda, E: 0x120c18, L: 0x34d873, l: 0xc8ffd8, k: 0xdfe3ea, K: 0x8e95a4, M: 0x5e2824, r: 0xffffff }, pal);
  // a gi instead of armour: bare arms with wristbands, a belt (u), trousers (p)
  const body = rows => gi ? rows.map((r, j) => [...r].map(c => j >= 3 && j <= 4 && c === 'b' ? 's' : j >= 3 && j <= 4 && c === 'B' ? 'S' : j === 7 && (c === 'b' || c === 'B') ? 'u' : j >= 8 && c === 'b' ? 'p' : j >= 8 && c === 'B' ? 'P' : c).join('')) : rows;
  const IDLE_LEGS = ['...oyyobbbbyyo..', '..oyyyoaaaaoyyo.', '..oYYoaaaaaAoYo.', '..obboaaaaaAobo.', '..obboaaaaaAobo.', '..oggoaaaaaAogo.', '..oGgoBaaaAAoGo.', '...oo.oBbbbBo.o.', '......obbbbBo...', '.....obbo.obBo..', '.....obbo.obBo..', '.....obbo.obBo..', '.....owwo.owWo..', '....owwwo.owwWo.', '....ooooo.ooooo.'].slice(7);
  const idle = body(['...oyyobbbbyyo..', '..oyyyoaaaaoyyo.', '..oYYoaaaaaAoYo.', '..obboaaaaaAobo.', '..obboaaaaaAobo.', '..oggoaaaaaAogo.', '..oGgoBaaaAAoGo.', '...oo.oBbbbBo.o.', '......obbbbBo...', '.....obbo.obBo..', '.....obbo.obBo..', '.....obbo.obBo..', '.....owwo.owWo..', '....owwwo.owwWo.', '....ooooo.ooooo.']);
  const runA = body(['...oyyobbbbyyo..', '..oyyyoaaaaoyyo.', '.oYYoaaaaaaAoYYo', 'oggoaaaaaaaAobbo', 'oGgoaaaaaaaAobbo', '.oo.aaaaaaaAoggo', '....oBaaaaAAoGo.', '....oBbbbbBo.oo.', '....obbbbbbBo...', '...obbbo..obBBo.', '..obbo.....obBo.', '.obbo.......obBo', 'owwo........owWo', 'owwwo.......owwo', 'ooooo........ooo']);
  const runB = body(['...oyyobbbbyyo..', '..oyyyoaaaaoyyo.', '..oYYoaaaaaAoYo.', '...ooaaaaaaAobo.', '...oaaaaaaaAobo.', '...ogoaaaaaAogo.', '...oGoBaaaAAoGo.', '....o.oBbbbBo...', '......obbbbBo...', '......obbbBo....', '......obbBo.....', '......obbBoo....', '......obbBowwo..', '.....owwwowwo...', '.....oooooooo...']);
  const runC = body(['...oyyobbbbyyo..', '..oyyyoaaaaoyyo.', '.oYYoaaaaaaAoYYo', 'oggoaaaaaaaAobbo', 'oGgoaaaaaaaAobbo', '.oo.aaaaaaaAoggo', '....oBaaaaAAoGo.', '.oo.oBbbbbBo....', '...oBbbbbbbo....', '.oBBbo..obbbo...', '.oBbo.....obbo..', 'oBbo.......obbo.', 'oWwo........owwo', 'owwo.......owwwo', 'ooo........ooooo']);
  // victory pose: arms folded across the chest
  const pose = body(['...oyyobbbbyyo..', '..oyyyoaaaaoyyo.', '..oYYoaaaaaAoYo.', '..obbbbbbbbggoo.', '..oggbbbbbbbbbo.', '...oooaaaaaAoo..', '.....oBaaaAAo...'].concat(IDLE_LEGS));
  const set = pal => ({ pose: makeSprite(head.concat(pose), pal, { emit: 'Ll' }), idle: makeSprite(head.concat(idle), pal, { emit: 'Ll' }), run: [runA, runB, runC, runB].map(b => makeSprite(head.concat(b), pal, { emit: 'Ll' })) });
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
  const setLong = pal => ({ pose: makeSprite(longHair(head.concat(pose)), pal, { emit: 'Ll', ax: 12 }), idle: makeSprite(longHair(head.concat(idle)), pal, { emit: 'Ll', ax: 12 }), run: [runA, runB, runC, runB].map(b => makeSprite(longHair(head.concat(b)), pal, { emit: 'Ll', ax: 12 })) });
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
  const fused = { pose: makeSprite(fuse(head.concat(pose)), fusedPal, { emit: 'Ll' }), idle: makeSprite(fuse(head.concat(idle)), fusedPal, { emit: 'Ll' }), run: [runA, runB, runC, runB].map(b => makeSprite(fuse(head.concat(b)), fusedPal, { emit: 'Ll' })) };
  // from behind (snake way): spiky hair over the back of the head, the same body
  const backHead = ['......o...o.....', '.....oho.oho....', '....ohHo.oHho...', '...ohhHhohHhho..', '...ohhhhhhhhho..', '..ohhhhhhhhhhho.', '..ohhHhhhhHhhho.', '...ohhhhhhhhho..', '...ohhhhhhhhho..', '....ohhhhhhho...', '....oShhhhhSo...', '.....oSSSSSo....'];
  const backs = [base, hair(0xffe02e, 0xfffbc8), hair(0xffe640, 0xfffde0), hair(0xffe02e, 0xfffbc8), hair(0xd8344a, 0xff8a8a), hair(0x3fb8ff, 0xc8f2ff), hair(0x6a2fc8, 0xc49cff), base, hair(0xd8dde8, 0xffffff)].map(pal => [runA, runC].map(b => makeSprite(backHead.concat(b), pal, {})));
  return { forms, fused, idle: forms[0].idle, backs };
}
const VEGETA_HEAD = ['......o...o.....', '.....oho.oho....', '....ohHo.oHho...', '....ohHhohHhho..', '...ohhHhhhhhho..', '...ohhhhhhhhho..', '...ohhhhhhhhhho.', '....ohhhhhhhhho.', '....ohhhhhhhhKo.', '....ohhsshsshko.', '....ohEEssEEhko.', '....osrEEsLLLko.', '....osssssLlLko.', '....oSssMMsSoK..', '.....oSsssSo....', '......ooSSoo....'];
const GOKU_HEAD = ['..o.......o.....', '.oho..o..oho....', '.ohHo.ohoohHo..o', '..ohhohHhhhHhooo', '.oohhhhhhhhhhhho', 'ohhhhHhhhhhhhho.', '.ohhhhhhhhhhhhho', '..ohhhhhhhhhhho.', '..ohhhhhshhhho..', '...ohhsshsshho..', '...ohEEssEEsho..', '...osrEEsEErso..', '...ossssssssSo..', '...oSsssMMsSo...', '....oSsssSo.....', '.....ooSSoo.....'];
const GOHAN_HEAD = ['................', '................', '.....o..o.o.....', '....ohoohohoo...', '...ohhHhhhHhho..', '..ohhhhhhhhhhho.', '..ohhhhhhhhhhho.', '...ohhhhhhhhhho.', '...ohhhhhhhhho..', '...ohhsshsshho..', '...ohEEssEEsho..', '...osrEEsEErso..', '...ossssssssSo..', '...oSsssMMsSo...', '....oSsssSo.....', '.....ooSSoo.....'];
const TRUNKS_HEAD = ['................', '................', '.....oooooo.....', '....ohHHhhhoo...', '...ohhhhhhhhho..', '...ohhhhhhhhhho.', '..ohhhhhohhhhho.', '..ohhhhosohhhho.', '..ohhhossssohho.', '..ohhossssssoho.', '..ohhsEEssEEsho.', '..ohhsrEEsrEsho.', '..ohhsssssssSho.', '...ohSssMMsSoho.', '...ohoSsssSo.o..', '....o.ooSSoo....'];
// playable heroes; all but vegeta are unlocked by an achievement
const HEROES = {
  vegeta: makeHero(VEGETA_HEAD),
  goku: makeHero(GOKU_HEAD, { y: 0xf08a24, Y: 0xc0641a, a: 0xf08a24, A: 0xc0641a, g: 0x2b4fc8, G: 0x1c3584, u: 0x2b4fc8, p: 0xf08a24, P: 0xc0641a, w: 0x2b4fc8, W: 0x1c3584 }, true),
  gohan: makeHero(GOHAN_HEAD, { y: 0x6a3aa8, Y: 0x45227a, a: 0x6a3aa8, A: 0x45227a, b: 0x6a3aa8, B: 0x45227a, g: 0xd8323a, G: 0x962028, u: 0xd8323a, p: 0x6a3aa8, P: 0x45227a, w: 0x7a4a2a, W: 0x553018 }, true),
  trunks: makeHero(TRUNKS_HEAD, { h: 0xb8a0e8, H: 0xe2d4ff, y: 0x26346e, Y: 0x16204a, a: 0x26346e, A: 0x16204a, b: 0x1a1a22, B: 0x0c0c12, g: 0xf6c8a2, G: 0xd99a73, u: 0x8a5a2a, p: 0x6a6e7a, P: 0x4a4e58, w: 0xf2c84a, W: 0xc49a24 }, true),
};
const CHARS = [{ id: 'vegeta', name: 'vegeta' }, { id: 'goku', name: 'goku', need: 'ss' }, { id: 'gohan', name: 'gohan', need: 'cell' }, { id: 'trunks', name: 'future trunks', need: 'frieza' }];
// achievements, each recorded once with the time it was earned
const ACH = [
  ['lap1', 'first steps', 'run a lap of the planet'], ['laps100', 'marathon', 'run 100 laps'], ['ss', 'super saiyan', 'reach super saiyan'], ['ui', 'ultra instinct', 'reach ultra instinct'],
  ['o9k', "it's over 9000", 'pass 9,000 power'], ['villains10', 'villain slayer', 'beat 10 villains'], ['frieza', 'emperor down', 'beat frieza'], ['cell', 'perfect no more', 'beat cell'],
  ['beerus', 'god of destruction', 'beat beerus'], ['all4', 'clean sweep', 'beat frieza, cell, kid buu and beerus'], ['ginyu', 'ginyu force', 'defeat the ginyu force'], ['fleet', "frieza's fleet", "drop every soldier from frieza's ship"],
  ['greg5', 'faster than gregory', 'win 5 gregory races · learn the spirit bomb'], ['yamcha', 'yamcha!', 'help yamcha out of his crater'], ['stars25', 'pod catcher', 'catch 25 space pods'], ['storm20', 'meteor buster', 'bust 20 meteors in one storm'],
  ['spirit', 'spirit bomb', 'throw a spirit bomb'], ['struggle', 'beam struggle', 'win a beam struggle'], ['ape', 'great ape', 'look at the full moon'], ['fusion', 'fusion ha!', 'fuse with bubbles'], ['dance', 'fu · sion · ha!', 'do the fusion dance'],
  ['kaioken', 'kaioken', 'use the kaioken'], ['shenron', 'eternal dragon', 'summon shenron'], ['porunga', 'namekian dragon', 'summon porunga'], ['chamber', 'a year in a day', 'enter the time chamber'],
  ['tournament', 'tournament of power', 'finish a tournament'], ['ascend', 'ascended', 'ascend for the first time'],
  ['vegeta', 'homeworld', 'visit planet vegeta'], ['nappa', 'bald and beaten', 'beat nappa on planet vegeta'],
  ['snakeway', 'one million kilometres', 'run all of snake way'], ['hfil', 'home for infinite losers', 'fall off snake way'],
  ['pudding', 'pudding diplomacy', 'calm beerus with pudding'], ['androids', 'seventeen and eighteen', 'beat androids 17 and 18'], ['wallet', "krillin's wallet", 'take krillin\'s wallet while 18 visits'], ['gero', 'not my power', 'make dr. gero let go'], ['birds', 'gentle giant', "free one of 16's birds"], ['westcity', 'capsule corp', 'open a gadget capsule in west city'], ['sagas', 'the whole story', 'clear all 8 sagas'], ['satan', 'the champ', "take mr. satan's prize money"], ['roshi', 'max power', 'watch roshi go max power'], ['krillin', 'you monster', 'watch krillin die (again)'],
].map(([id, name, text]) => ({ id, name, text }));
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
const CP = { o: 0x0b140c, g: 0x6cc94e, G: 0x3a8a34, L: 0xa8ec84, k: 0x15171c, K: 0x2c3036, f: 0xf2eaf4, F: 0xc4b6d4, P: 0x8a3ac8, w: 0xffffff, e: 0x111111, c: 0x9fdcff, C: 0x2f6ae0 };
const CS = { g: 'G', f: 'F' };
// perfect cell: a tall two-horned crest, pale face with vegeta-style eyes and purple stripes, dark chest plates, spotted green armour, beetle wings behind
function cell(G, { arms = 'fold', wings = 'fold' } = {}) {
  if (wings === 'fold') { G.poly([[10, 18], [7, 38], [12, 36], [14, 20]], 'K'); G.poly([[22, 18], [25, 38], [20, 36], [18, 20]], 'K'); }
  else { G.poly([[11, 19], [0, 10], [0, 24], [6, 34], [12, 30]], 'K'); G.poly([[21, 19], [32, 10], [32, 24], [26, 34], [20, 30]], 'K'); for (const x of [2, 30]) G.line([[16, 22], [x, 14]], 1, 1, 'k'); }
  // crest: two horns sweeping up from the brow
  G.poly([[10.5, 13], [8, 6], [7.5, 0], [11, 3], [13, 7], [16, 6], [19, 7], [21, 3], [24.5, 0], [24, 6], [21.5, 13]], 'g');
  G.line([[8, .5], [10, 6]], 1.4, 1, 'k'); G.line([[24, .5], [22, 6]], 1.4, 1, 'k');                              // dark horn tips
  for (const [x, y] of [[11, 8], [14, 9], [18, 9], [21, 8], [16, 7]]) G.set(x, y, 'k');                             // spots
  G.set(9, 4, 'L'); G.set(10, 7, 'L');
  // face
  G.poly([[11.5, 10], [20.5, 10], [20.5, 14], [18.5, 18], [13.5, 18], [11.5, 14]], 'f');
  G.poly([[12, 11.6], [15.4, 12.4], [15.4, 13.2], [12, 12.6]], 'e'); G.poly([[20, 11.6], [16.6, 12.4], [16.6, 13.2], [20, 12.6]], 'e');   // hard brows
  G.rect(13, 13, 2, 1, 'w'); G.set(14, 13, 'e'); G.rect(17, 13, 2, 1, 'w'); G.set(17, 13, 'e');                    // vegeta-style eyes
  G.line([[12.5, 14], [13.5, 17]], 1, 1, 'P'); G.line([[19.5, 14], [18.5, 17]], 1, 1, 'P');                         // purple cheek stripes
  G.rect(15, 16, 2, 1, 'P');                                                                                         // mouth
  G.rect(14, 18, 4, 2, 'k');                                                                                         // neck
  // body
  G.ell(9, 21, 4, 3, 'g'); G.ell(23, 21, 4, 3, 'g');                                                                 // shoulder armour
  G.poly([[11, 19], [21, 19], [21.5, 25], [10.5, 25]], 'k'); G.rect(16, 19, 1, 6, 'K');                              // black chest plates
  G.set(13, 21, 'K'); G.set(19, 21, 'K');
  G.poly([[11, 25], [21, 25], [20, 31], [12, 31]], 'g'); G.rect(12, 31, 8, 1, 'k');                                  // abdomen, belt
  for (const [x, y] of [[13, 27], [18, 28], [15, 29], [8, 21], [24, 22], [10, 20], [22, 20]]) G.set(x, y, 'k');
  G.line([[14, 32], [13, 40]], 3.4, 3, 'g'); G.line([[18, 32], [19, 40]], 3.4, 3, 'g');                              // legs
  for (const [x, y] of [[13, 35], [19, 36], [14, 38]]) G.set(x, y, 'k');
  G.rect(11, 40, 4, 2, 'w'); G.rect(18, 40, 4, 2, 'w');                                                              // white feet
}
const cArm = (G, pts) => { G.line(pts, 4.8, 4.2, 'o'); G.line(pts, 3, 2.4, 'g'); const [x, y] = pts[1]; G.set(Math.round(x), Math.round(y), 'k'); };
const CELL = shapeSprite(33, 43, G => { cell(G); cArm(G, [[8, 21], [10, 26], [22, 25]]); cArm(G, [[24, 21], [22, 26], [10, 25]]); }, CP, CS);   // arms crossed
const BP = { o: 0x2a0f1a, p: 0xf28ab8, P: 0xc25a8e, l: 0xffc0dc, w: 0xe6e2f4, W: 0xb4b0d0, k: 0x1a1a1a, y: 0xf2c84a, Y: 0xb88a1a, r: 0xe0202a, e: 0x111111, m: 0x6a1020, t: 0xffffff };
const BS = { p: 'P', w: 'W', y: 'Y' };
// kid buu: big round head, the thick antenna sweeping down his back, black eyes with red irises, a fanged grin, broad muscled shoulders, baggy pants
function buu(G, { mouth = 'grin' } = {}) {
  G.line([[13, 3], [8, 2], [4, 5], [3, 9]], 3.4, 2, 'p');                                                            // the antenna, flopping back
  G.ell(14, 8, 5.2, 5.4, 'p'); G.set(11, 4, 'P'); G.set(16, 5, 'P'); G.set(5, 6, 'P'); G.set(12, 3, 'l');          // head, steam holes, shine
  G.poly([[10.5, 7.4], [13.6, 8.4], [13.6, 9.2], [10.5, 8.4]], 'e'); G.poly([[19, 7.4], [15.4, 8.4], [15.4, 9.2], [19, 8.4]], 'e');   // furious brows
  G.rect(11, 9, 3, 2, 'e'); G.rect(16, 9, 3, 2, 'e'); G.set(12, 9, 'r'); G.set(16, 9, 'r');                         // black eyes, red irises
  if (mouth === 'grin') { G.rect(11, 12, 8, 1, 'e'); G.set(12, 13, 't'); G.set(17, 13, 't'); G.set(11, 11, 'e'); G.set(18, 11, 'e'); }
  else { G.ell(14.5, 12.6, 3.4, 1.8, 'm'); G.rect(12, 11, 6, 1, 't'); G.set(12, 14, 't'); G.set(17, 14, 't'); }
  G.ell(14.5, 18.5, 6.4, 4.4, 'p'); G.set(12, 18, 'P'); G.set(17, 18, 'P'); G.rect(14, 20, 1, 2, 'P');               // broad chest, pecs
  G.rect(10, 22, 10, 2, 'k'); G.rect(13, 22, 3, 2, 'y');                                                              // belt and buckle
  G.poly([[9, 24], [20, 24], [22, 31], [15, 29.5], [8, 31]], 'w');                                                    // baggy pants
  G.rect(7, 31, 6, 2, 'k'); G.rect(16, 31, 6, 2, 'k'); G.set(7, 31, 'y'); G.set(21, 31, 'y');                         // shoes
}
const bArm = (G, pts) => { G.line(pts, 4.4, 3.6, 'o'); G.line(pts, 2.6, 2, 'p'); };
const bFist = (G, x, y) => { G.ell(x, y, 2, 2, 'o'); G.ell(x, y, 1.3, 1.3, 'p'); };
const KIDBUU = shapeSprite(29, 34, G => { buu(G); bArm(G, [[9, 17], [11, 21], [19, 20]]); bArm(G, [[20, 17], [18, 21], [10, 20]]); }, BP, BS);   // arms crossed
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
const GREGORY = shapeSprite(12, 9, G => {   // gregory the cricket: brown, big white eye, folded wing
  G.ell(5, 5, 3.8, 2.2, 'g'); G.ell(8.6, 3.8, 2, 2, 'g'); G.poly([[2, 3.6], [6.5, 3.4], [6, 5], [2, 5.2]], 'G');
  G.set(9, 3, 'w'); G.set(10, 3, 'k');
  G.line([[3, 6.5], [1, 9]], 1, 1, 'l'); G.line([[6.5, 6.5], [7.5, 9]], 1, 1, 'l'); G.line([[9.5, 2], [11, 0]], 1, 1, 'k');
}, { o: 0x2a1a0a, g: 0xa8743a, G: 0x7a4e22, w: 0xffffff, k: 0x111111, l: 0x5a3a1a }, { g: 'G' });
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
// king kai's car: a rounded red '50s sedan with a white roof, big glass, round headlights, chrome bumpers and whitewall tyres; him at the wheel
const KAICAR = shapeSprite(34, 16, G => {
  G.poly([[2, 8.5], [8, 7.6], [30, 7.6], [32.5, 9.4], [32.5, 12.6], [1.5, 12.6], [1.2, 10]], 'r');
  G.poly([[8.5, 7.8], [11.5, 2.6], [23.5, 2.6], [27, 7.8]], 'w');
  G.poly([[10.4, 7.4], [12.6, 3.6], [17.4, 3.6], [17.4, 7.4]], 'g'); G.poly([[18.4, 7.4], [18.4, 3.6], [23, 3.6], [25.4, 7.4]], 'g');
  G.rect(1, 12, 4, 1, 'c'); G.rect(29, 12, 4, 1, 'c'); G.rect(5, 10, 24, 1, 'c');
  G.ell(2.2, 9.6, 1.2, 1.2, 'y'); G.set(32, 10, 'h');
  G.ell(14, 6, 2.2, 2, 'b'); G.set(15, 6, 'k'); G.set(13, 6, 'k'); G.line([[13, 4.2], [11.6, 1]], 1, 1, 'k'); G.line([[15, 4.2], [16.4, 1]], 1, 1, 'k');
  for (const x of [7, 26]) { G.ell(x, 13.2, 2.6, 2.6, 't'); G.ell(x, 13.2, 1.5, 1.5, 'w'); G.set(x, 13, 'c'); }
}, { o: 0x1a1010, r: 0xd8241e, R: 0x962018, h: 0xff8a7a, w: 0xf6f4ee, W: 0xc8c4b8, c: 0xdfe3ea, C: 0x8e95a4, g: 0x5ab8f2, k: 0x111111, t: 0x2a2a2a, b: 0xa2d8d2, B: 0x6aa8a4, y: 0xffe08a }, { r: 'R', w: 'W', c: 'C', b: 'B' });
// nappa: bald, black moustache, saiyan armour with broad shoulder pads, flexing with a grin
const NAPPA = shapeSprite(28, 34, G => {
  G.ell(14, 6.5, 4.6, 5, 's'); G.rect(11, 6, 2, 1, 'k'); G.rect(15, 6, 2, 1, 'k'); G.set(12, 6, 'w'); G.set(16, 6, 'w');   // bald head, eyes
  G.poly([[10.5, 4.6], [13.4, 5.4], [13.4, 6], [10.5, 5.4]], 'k'); G.poly([[17.5, 4.6], [14.6, 5.4], [14.6, 6], [17.5, 5.4]], 'k');   // brows
  G.poly([[11, 8.6], [17, 8.6], [17.5, 10.4], [15, 9.6], [13, 9.6], [10.5, 10.4]], 'k'); G.rect(12, 10, 4, 1, 'w');         // moustache, grin
  G.rect(12, 11, 4, 2, 's');                                                                                                 // thick neck
  G.ell(6, 15, 4.6, 3.2, 'y'); G.ell(22, 15, 4.6, 3.2, 'y');                                                                 // shoulder pads
  G.poly([[9, 13], [19, 13], [20, 22], [8, 22]], 'a'); G.rect(9, 16, 10, 1, 'A');                                           // chest armour
  G.poly([[8, 22], [20, 22], [19, 26], [9, 26]], 'y'); G.rect(9, 26, 10, 2, 'b');                                           // armour skirt, bodysuit
  G.line([[11, 27], [10, 33]], 3.6, 3.2, 'b'); G.line([[17, 27], [18, 33]], 3.6, 3.2, 'b');                                 // legs
  G.rect(7, 31, 5, 3, 'w'); G.rect(16, 31, 5, 3, 'w');                                                                       // boots
  for (const pts of [[[5, 16], [1.5, 13], [4, 8]], [[23, 16], [26.5, 13], [24, 8]]]) { G.line(pts, 5.4, 5, 'o'); G.line(pts, 3.6, 3.2, 's'); }   // both arms up, flexing
  G.ell(4, 7, 1.9, 1.9, 'w'); G.ell(24, 7, 1.9, 1.9, 'w');                                                                   // white gloves
}, { o: 0x1a1210, s: 0xe8b48a, S: 0xc08460, k: 0x15110f, w: 0xf6f4ee, W: 0xc8c4b8, m: 0x7a3a2a, y: 0xd8b05a, Y: 0x9a7a3a, a: 0x3a2e2a, A: 0x2a201c, b: 0x2a2a46 }, { s: 'S', y: 'Y', w: 'W' });
// the saga villains, krillin and mr. satan: big chibi heads so faces read, after the gba-era sprites
// villains, round 2: chibi LoG II / Supersonic Warriors proportions (big head, big hair) so the faces read
const mir = (W, pts) => pts.map(([x, y]) => [W - x, y]);
const sym = (W, half) => [...half, ...mir(W, half).reverse()];
// a stroke with its own dark rim, so a limb stays readable over hair/armour of a similar tone
const oline = (G, pts, w0, w1, c) => { G.line(pts, w0 + 2, w1 + 2, 'o'); G.line(pts, w0, w1, c); };

// ---------- raditz ----------
const RAD_PAL = { o: 0x0c0a12, h: 0x1e1f2e, H: 0x111119, j: 0x3a4468, s: 0xf0bc8e, S: 0xc08060, k: 0x140e14, w: 0xffffff, W: 0xc8ccd4, g: 0x48e070, G: 0xb0ffc0, n: 0x1e8a44, a: 0x2e2c2c, A: 0x1c1a1a, q: 0x8e8a86, y: 0x8a5a32, Y: 0x5e3c20, t: 0x8e5e34, T: 0x5e3c20, u: 0xc89a5a, b: 0x2c2c4a, B: 0x1c1c30, v: 0x9a44d8, V: 0x62289a };
const RAD_SH = { h: 'H', a: 'A', y: 'Y', t: 'T', b: 'B', w: 'W', v: 'V' };
const RAD_MANE = {
  // right half of the outline, top centre round to the bottom
  long: [[13, 0.6], [15.2, 3], [17.6, -0.2], [18.6, 3.4], [23, 1.6], [21.2, 6.2], [25.8, 7.6], [22, 10.6], [25.8, 15], [21.8, 15.6], [25, 21.6], [21, 21], [22.6, 28], [19.4, 25.6], [19.6, 32], [16.4, 28]],
  fan: [[13, 0.5], [15, 3], [17, 0], [18.5, 3], [22.5, 1], [21, 5.5], [25.6, 5], [22.4, 9.5], [25.6, 12.5], [22.2, 14.5], [25.4, 19], [21.8, 20], [24, 25.5], [20.4, 24.5], [21, 31], [17.6, 27]],
};
function raditz(o = {}) {
  const W = 26, pose = o.pose || 'hips';
  return shapeSprite(W, 34, G => {
    G.poly(sym(W, RAD_MANE[o.mane || 'long']), 'h');
    for (const pts of [[[17.5, 3.5], [20.5, 7], [23, 11.5]], [[20.5, 13.5], [22.5, 18]], [[19.6, 19.5], [20.6, 25]]]) { G.line(pts, 1, 1, 'j'); G.line(mir(W, pts), 1, 1, 'j'); }
    // legs dangling as he hovers, rimmed so they stand off the mane
    oline(G, [[11, 24], [10.5, 30]], 3.6, 3, 'b'); oline(G, [[15, 24], [15.5, 30]], 3.6, 3, 'b');
    G.rect(9, 26, 3, 1, 'v');                                                                              // purple leg sash
    for (const x of [8.6, 13.6]) { G.poly([[x - 1, 29], [x + 4.8, 29], [x + 4.4, 33], [x - .6, 33]], 'o'); G.poly([[x, 29.5], [x + 3.8, 29.5], [x + 3.4, 32.5], [x + 1.9, 33.3], [x + .4, 32.5]], 'w'); }
    G.rect(9, 32, 3, 1, 'y'); G.rect(14, 32, 3, 1, 'y');                                                  // boot tips
    if (pose === 'up') oline(G, [[19, 16], [22, 11], [22.5, 6.5]], 3, 2.6, 's');                           // right arm raised
    // torso: black plate with grey trim, brown shoulder straps, tail wound round as a belt
    G.poly([[7.5, 14], [18.5, 14], [18.2, 25.5], [7.8, 25.5]], 'o');
    G.poly([[8.5, 15], [17.5, 15], [17.2, 23.5], [8.8, 23.5]], 'a');
    G.rect(9, 15, 8, 1, 'q'); G.line([[9.5, 19.5], [13, 20.5], [16.5, 19.5]], 1, 1, 'q');
    const flap = [[16.4, 14.6], [20.6, 14.8], [21.2, 18.4], [17.4, 18.8]]; G.poly(flap, 'y'); G.poly(mir(W, flap), 'y');
    G.rect(9, 23, 8, 2, 't'); G.set(10, 23, 'u'); G.set(13, 24, 'u'); G.set(16, 23, 'u');
    G.rect(11, 13, 4, 2, 's');                                                                             // neck
    const arm = (pts, band, fist) => { oline(G, pts, 2.8, 2.4, 's'); G.ell(band[0], band[1], 1.5, 1, 'v'); G.ell(fist[0], fist[1], 1.5, 1.5, 's'); };
    const hip = [[7, 17], [4.5, 20.5], [8, 23]], side = [[6.5, 17], [5, 21], [5, 25]];
    if (pose === 'hips') { arm(hip, [5.4, 21.8], [8.4, 23]); arm(mir(W, hip), [W - 5.4, 21.8], [W - 8.4, 23]); }
    if (pose === 'down') { arm(side, [5, 23.4], [5, 25.8]); arm(mir(W, side), [21, 23.4], [21, 25.8]); }
    if (pose === 'up') { arm(side, [5, 23.4], [5, 25.8]); G.poly(flap, 'y'); G.ell(22.6, 9.6, 1.5, 1, 'v'); G.ell(22.6, 6.4, 1.8, 1.8, 's'); G.set(23, 5, 'S'); G.set(22, 5, 'S'); }
    if (pose === 'fold') { oline(G, [[7, 17], [8, 19.6], [16.5, 19]], 2.6, 2.4, 's'); oline(G, [[19, 17], [18, 22], [9.5, 22]], 2.6, 2.4, 's'); G.rect(8, 19, 2, 1, 'v'); G.rect(16, 21, 2, 2, 'v'); }
    // head: big, Vegeta-style widow's peak, heavy brows, smirk; scouter over his left eye
    G.ell(13, 9.4, 4.6, 4.8, 's');
    G.poly([[8, 3.5], [18, 3.5], [18.2, 9], [17, 7.2], [13, 9.4], [9, 7.2], [7.8, 9]], 'h');
    G.rect(8, 8, 1, 3, 'h'); G.rect(17, 8, 1, 3, 'h');
    for (const [x, y] of [[9, 9], [10, 9], [10, 10], [11, 10], [15, 9], [16, 9], [14, 10], [15, 10], [11, 11], [14, 11]]) G.set(x, y, 'k');
    G.set(10, 11, 'w'); G.set(15, 11, 'w'); G.set(13, 12, 'S');
    if (o.mouth === 'grin') { G.rect(11, 13, 4, 1, 'w'); G.set(10, 13, 'k'); G.set(15, 12, 'k'); G.set(14, 13, 'W'); }
    else { G.set(11, 13, 'k'); G.set(12, 13, 'k'); G.set(13, 13, 'k'); G.set(14, 12, 'k'); }
    G.rect(14, 9, 3, 3, 'g'); G.set(14, 9, 'G'); G.set(15, 9, 'G'); G.set(15, 11, 'n'); G.rect(17, 8, 2, 4, 'w'); G.set(18, 11, 'W'); G.set(17, 12, 'q');
  }, RAD_PAL, RAD_SH);
}
const RADITZ = raditz({ pose: 'hips' });
const VEG_PAL = { o: 0x0c0a18, h: 0x1c1a28, H: 0x0f0e18, j: 0x38385a, s: 0xf6c8a0, S: 0xc48c66, k: 0x120c18, w: 0xffffff, W: 0xbcc2d4, r: 0xff3a30, R: 0xffb0a0, x: 0x3ad070, X: 0xb8ffc8, a: 0xf6f6f8, A: 0xc0c6d6, y: 0xf0c838, Y: 0xb08a1a, b: 0x2f56d8, B: 0x1c3592 };
const VEG_SH = { h: 'H', a: 'A', y: 'Y', b: 'B', w: 'W' };
const shift = (G, dy) => { const m = p => p.map(([x, y]) => [x, y + dy]); return { ell: (x, y, a, b, c) => G.ell(x, y + dy, a, b, c), rect: (x, y, w, h, c) => G.rect(x, y + dy, w, h, c), poly: (p, c) => G.poly(m(p), c), line: (p, a, b, c) => G.line(m(p), a, b, c), set: (x, y, c) => G.set(x, y + dy, c) }; };
// the flame: a solid crown plus tapering spikes, [base, tip] pairs
const VEG_HAIR = {
  flame: [[[12, 7], [12, 0]], [[10, 7], [8, 0.8]], [[14, 7], [16, 0.8]], [[8.4, 8.6], [4.4, 3.2]], [[15.6, 8.6], [19.6, 3.2]]],
  tall: [[[12, 7], [11.4, -0.2]], [[10, 7], [7.4, 0.6]], [[14, 7], [15.8, 0.2]], [[8.4, 8.6], [3.8, 2.6]], [[15.6, 8.6], [20, 2]], [[13, 7], [19, 0.6]]],
};
function vegeta(o = {}) {
  const W = 24, pose = o.pose || 'fold', lens = o.green ? 'x' : 'r', glint = o.green ? 'X' : 'R';
  return shapeSprite(W, 34, G0 => {
    // the flame of hair is drawn on the full grid; everything else sits two rows lower
    G0.poly([[7.2, 15], [7, 9], [7.6, 5.6], [12, 4.4], [16.4, 5.6], [17, 9], [16.8, 15]], 'h');
    for (const [b, t] of VEG_HAIR[o.hair || 'flame']) { G0.line([b, t], 3.4, .8, 'h'); G0.line([[b[0] + (t[0] - b[0]) * .3 - .5, b[1] + (t[1] - b[1]) * .3], [b[0] + (t[0] - b[0]) * .65 - .5, b[1] + (t[1] - b[1]) * .65]], 1, 1, 'j'); }
    const H = shift(G0, 1);
    const G = shift(G0, 2);
    // legs and boots
    oline(G, [[10, 22], [9.6, 28]], 3.4, 3, 'b'); oline(G, [[14, 22], [14.4, 28]], 3.4, 3, 'b');
    for (const x of [7.8, 12.4]) { G.poly([[x, 27], [x + 3.8, 27], [x + 3.4, 30.4], [x + 1.9, 31.2], [x + .4, 30.4]], 'w'); G.rect(Math.round(x + 1), 30, 2, 1, 'y'); }
    if (pose === 'point') oline(G, [[17, 15.5], [20, 11], [20.6, 7]], 2.6, 2.4, 'b');
    // armour: white chest, gold belly band, gold shoulder pads flaring out flat
    G.poly([[6.6, 14.4], [17.4, 14.4], [17, 23.4], [7, 23.4]], 'o');
    G.poly([[7.5, 15], [16.5, 15], [16, 20.5], [8, 20.5]], 'a');
    G.poly([[8, 20.4], [16, 20.4], [15.6, 22.6], [8.4, 22.6]], 'y');
    G.rect(10, 21, 4, 1, 'Y');
    G.poly([[16, 14.4], [21.2, 14.4], [21.6, 16.4], [16.4, 17.2]], 'y'); G.poly(mir(W, [[16, 14.4], [21.2, 14.4], [21.6, 16.4], [16.4, 17.2]]), 'y');
    G.rect(10, 15, 4, 1, 'b');                                                  // high blue collar
    const glove = (x, y) => { G.ell(x, y, 1.5, 1.5, 'w'); };
    if (pose === 'fold') { const l = [[6, 17], [7.4, 19.6], [15.4, 19]], rr = [[18, 17], [16.6, 20.2], [8.6, 20]]; G.line(l, 4.6, 4.4, 'o'); G.line(rr, 4.6, 4.4, 'o'); G.line(l, 2.6, 2.4, 'b'); G.line(rr, 2.6, 2.4, 'B'); glove(8.3, 18.7); glove(15.7, 19.4); }
    if (pose === 'fists') { const a = [[5.2, 17], [4.4, 21], [5.4, 24]]; oline(G, a, 2.6, 2.4, 'b'); oline(G, mir(W, a), 2.6, 2.4, 'b'); glove(5.4, 24.2); glove(18.6, 24.2); }
    if (pose === 'point') { const a = [[5.2, 17], [4.6, 20.6], [7.6, 22.4]]; oline(G, a, 2.6, 2.4, 'b'); glove(7.8, 22.4); G.poly(mir(W, [[16, 14.4], [21.2, 14.4], [21.6, 16.4], [16.4, 17.2]]), 'y'); glove(20.6, 7.6); G.rect(20, 4, 1, 3, 'o'); G.set(20, 5, 'w'); G.set(20, 6, 'w'); }
    if (pose === 'palm') { const a = [[5.2, 17], [4.4, 21], [5.4, 24]]; oline(G, a, 2.6, 2.4, 'b'); glove(5.4, 24.2); oline(G, [[18.6, 16.2], [21, 18.4], [21.4, 20.4]], 2.6, 2.4, 'b'); G.ell(21.4, 21.4, 1.7, 1.7, 'w'); }
    // head: narrow face, sharp M hairline, heavy scowl, scouter over his left eye
    { const G = H;
    G.ell(12, 10.6, 4.4, 4.4, 's'); G.poly([[7.6, 10], [16.4, 10], [16.2, 13.6], [14.4, 15.4], [9.6, 15.4], [7.8, 13.6]], 's');
    G.poly([[7, 4], [17, 4], [17, 9.8], [15.4, 6.8], [12, 10.2], [8.6, 6.8], [7, 9.8]], 'h');
    for (const [x, y] of [[8, 9], [9, 9], [9, 10], [10, 10], [15, 9], [14, 9], [14, 10], [13, 10], [10, 11], [13, 11]]) G.set(x, y, 'k');
    G.set(9, 11, 'w'); G.set(14, 11, 'w'); G.set(12, 12, 'S');
    if (o.mouth === 'smirk') { G.set(10, 13, 'k'); G.set(11, 13, 'k'); G.set(12, 13, 'k'); G.set(13, 12, 'k'); }
    else { G.set(10, 13, 'k'); G.set(11, 13, 'k'); G.set(12, 13, 'k'); G.set(13, 13, 'k'); G.set(9, 14, 'S'); G.set(14, 14, 'S'); }
    G.rect(13, 9, 3, 3, lens); G.set(13, 9, glint); G.rect(16, 8, 2, 4, 'w'); G.set(17, 11, 'W'); }
  }, VEG_PAL, VEG_SH);
}
const VEGETA_V = vegeta({ pose: 'fold' });
const BRO_PAL = { o: 0x141008, h: 0xc8e040, H: 0x8aa424, j: 0xf2ff9c, s: 0xeab486, S: 0xb87c58, k: 0x1a120c, w: 0xffffff, g: 0xf2c43a, G: 0xa8801a, r: 0xff2a3a, e: 0xc8202c, E: 0x861420, p: 0xf6f4ee, P: 0xc4c2c8, d: 0x3a2a1c, D: 0x241810 };
const BRO_SH = { h: 'H', g: 'G', e: 'E', p: 'P', s: 'S', d: 'D' };
const BRO_MANE = {
  wild: [[15, 0.2], [17, 3], [19.6, -0.2], [20.2, 3.4], [24.4, 1], [22.8, 5.2], [28.6, 4.4], [24.8, 8], [29.6, 10], [25, 11], [28.4, 15.2], [23, 13.4], [20.5, 15], [18, 13]],
  tall: [[15, -0.4], [16.8, 3], [18.8, -0.4], [19.8, 3.4], [23.4, 0.6], [22.6, 4.6], [28, 2.6], [25, 7.2], [29.6, 7.6], [25.6, 10.4], [29.4, 13.2], [23.6, 12.8], [21, 15], [18, 13]],
};
function broly(o = {}) {
  const W = 30, pose = o.pose || 'down';
  return shapeSprite(W, 38, G => {
    G.poly(sym(W, BRO_MANE[o.mane || 'wild']), 'h');
    for (const pts of [[[19.5, 1.5], [18.6, 5.5]], [[23, 2.4], [20.6, 7]], [[26.4, 5], [22.4, 9]], [[27.6, 9.6], [23.4, 11]]]) { G.line(pts, 1, 1, 'j'); G.line(mir(W, pts), 1, 1, 'j'); }
    // baggy white trousers, dark boots with gold cuffs
    G.poly([[8, 26], [22, 26], [26, 33.6], [19.4, 34.6], [15, 30.5], [10.6, 34.6], [4, 33.6]], 'p');
    G.line([[15, 28], [15, 31]], 1, 1, 'P'); G.line([[9, 28], [7.6, 33]], 1, 1, 'P'); G.line([[21, 28], [22.4, 33]], 1, 1, 'P');
    for (const x of [6, 19]) { G.rect(x, 34, 5, 1, 'g'); G.poly([[x + .4, 35], [x + 4.6, 35], [x + 4, 37.2], [x + 1, 37.2]], 'd'); }
    // the slab of a torso: traps, pecs, abs
    G.poly([[11, 12], [19, 12], [26, 15.4], [24.6, 20], [21.6, 26], [8.4, 26], [5.4, 20], [4, 15.4]], 's');
    G.ell(5.6, 17.4, 3.6, 3.2, 's'); G.ell(24.4, 17.4, 3.6, 3.2, 's');
    G.line([[7.8, 15.8], [8.4, 19.6]], 1, 1, 'S'); G.line([[22.2, 15.8], [21.6, 19.6]], 1, 1, 'S'); G.line([[8.6, 20.4], [11, 21.4], [14, 20.6]], 1, 1, 'S'); G.line([[21.4, 20.4], [19, 21.4], [16, 20.6]], 1, 1, 'S');
    G.line([[15, 17.6], [15, 25]], 1, 1, 'S'); for (const y of [22.6, 24.4]) { G.set(12, Math.floor(y), 'S'); G.set(17, Math.floor(y), 'S'); }
    G.line([[10, 14.4], [15, 17.4], [20, 14.4]], 1.6, 1.6, 'g'); G.set(15, 17, 'r'); G.set(12, 15, 'G'); G.set(18, 15, 'G');   // gold necklace
    // gold belt with a red gem, red sash hanging off his left hip
    G.rect(8, 25, 14, 2, 'g'); G.rect(14, 25, 2, 2, 'r');
    G.poly([[17, 26.5], [21, 26.5], [21.6, 31], [19.2, 30], [18, 31.4]], 'e');
    const arm = (a, fist) => { oline(G, a, 4.6, 4, 's'); G.ell(fist[0], fist[1], 2.3, 2.1, 's'); };
    const hang = [[5, 18], [4, 23], [4.6, 27]];
    if (pose === 'down') { arm(hang, [4.6, 28.6]); arm(mir(W, hang), [25.4, 28.6]); for (const x of [4.6, 25.4]) { G.rect(Math.round(x - 2.4), 20, 5, 1, 'g'); G.rect(Math.round(x - 2.4), 26, 5, 1, 'g'); } }
    if (pose === 'flex') for (const f of [p => p, p => mir(W, p)]) { oline(G, f([[23.6, 17], [27, 16.4]]), 4.4, 4, 's'); oline(G, f([[27, 17], [27, 10.6]]), 4, 3.6, 's'); G.ell(...f([[27, 9.6]])[0], 2.1, 2, 's'); G.rect(...f([[25.4, 13]])[0].map(Math.round), 3, 1, 'g'); G.line(f([[25.4, 15.4], [25.4, 17.6]]), 1, 1, 'g'); G.line(f([[26, 13.4], [28, 13.4]]), 1, 1, 'S'); }
    if (pose === 'reach') { arm(hang, [4.6, 28.6]); G.rect(2, 20, 5, 1, 'g'); G.rect(2, 26, 5, 1, 'g'); oline(G, [[24.6, 17.4], [24, 20.6], [20.6, 22]], 4.4, 4, 's'); G.rect(21, 20, 4, 1, 'g'); G.ell(19.6, 22.2, 3.6, 3.2, 'o'); G.ell(19.6, 22.2, 2.7, 2.4, 's'); for (const x of [18, 19.4, 20.8]) G.line([[x, 20.6], [x, 22.2]], 1, 1, 'S'); G.rect(18, 23, 3, 1, 'S'); }
    if (pose === 'guard') { const a = [[5, 18], [6, 23], [11, 23]]; arm(a, [11.6, 22.4]); arm(mir(W, a), [18.4, 22.4]); G.rect(5, 21, 3, 2, 'g'); G.rect(22, 21, 3, 2, 'g'); }
    // little head on a huge body: spiky bangs, gold circlet with a gem, blank white eyes, snarl
    G.ell(15, 9.4, 3.9, 4.4, 's');
    G.poly([[10.6, 3], [19.4, 3], [19.4, 7.4], [18.2, 6.4], [17, 7.6], [15.6, 6], [14.4, 7.6], [13, 6], [11.8, 7.6], [10.6, 7.2]], 'h');
    G.rect(11, 7, 8, 1, 'g'); G.rect(14, 7, 2, 1, 'r');
    for (const [x, y] of [[12, 8], [13, 8], [16, 8], [17, 8], [11, 8], [18, 8]]) G.set(x, y, 'k');
    G.rect(12, 9, 2, 1, 'w'); G.rect(16, 9, 2, 1, 'w'); G.set(14, 9, 'S'); G.set(15, 9, 'S');
    if (o.mouth === 'roar') { G.rect(13, 11, 4, 2, 'k'); G.rect(13, 11, 4, 1, 'w'); }
    else { G.rect(13, 11, 4, 1, 'w'); G.set(12, 11, 'k'); G.set(17, 11, 'k'); G.rect(13, 12, 4, 1, 'k'); }
  }, BRO_PAL, BRO_SH);
}
const BROLY = broly({ pose: 'guard', mane: 'tall' });

// krillin: peach dome with a cream crown highlight, brown incense dots, tall eyes, navy collar, blue belt with tails
const krPal = { o: 0x2a1406, s: 0xf8d0a0, S: 0xd09058, h: 0xfff2dc, d: 0xb87440, k: 0x1a1212, m: 0x9a2a2a, g: 0xf8a018, G: 0xd05410, b: 0x2a5ae8, B: 0x1a3098, n: 0x1a2468, w: 0xffffff, K: 0x34343e, p: 0xf07a7a, l: 0x8a5a2a, L: 0x5a3818, c: 0x9fdcff, y: 0xfff27a, Y: 0xf2b830 };
const krShade = { g: 'G', s: 'S', b: 'B', l: 'L' };
function krHead(G, x, y, face = 'smile', eyes = face === 'shut' ? 'shut' : 'open') {          // dome centred on pixel x, top row y, 10 rows tall
  G.ell(x + .5, y + 5, 4.2, 5.1, 's'); G.rect(x - 5, y + 5, 1, 2, 's'); G.rect(x + 5, y + 5, 1, 2, 's');   // dome, ears
  G.set(x - 1, y + 0, 'h'); G.set(x - 3, y + 2, 'h'); G.set(x - 3, y + 3, 'h');                           // crown highlight
  for (const i of [-2, 0, 2]) { G.set(x + i, y + 1, 'd'); G.set(x + i, y + 3, 'd'); }                       // six dots
  if (eyes === 'shut') { G.set(x - 3, y + 6, 'k'); G.set(x - 2, y + 5, 'k'); G.set(x - 1, y + 6, 'k'); G.set(x + 1, y + 6, 'k'); G.set(x + 2, y + 5, 'k'); G.set(x + 3, y + 6, 'k'); }   // happy ^ ^
  else { G.rect(x - 2, y + 5, 1, 2, 'k'); G.rect(x + 2, y + 5, 1, 2, 'k'); }
  if (face === 'blush') { G.rect(x - 4, y + 7, 2, 1, 'p'); G.rect(x + 3, y + 7, 2, 1, 'p'); G.set(x - 1, y + 8, 'm'); G.set(x, y + 7, 'm'); G.set(x + 1, y + 8, 'm'); }   // wobbly mouth
  else if (face === 'open') { G.rect(x - 1, y + 7, 3, 2, 'm'); }
  else { G.rect(x - 1, y + 8, 3, 1, 'm'); G.set(x - 2, y + 7, 'm'); G.set(x + 2, y + 7, 'm'); }            // grin
}
function krBody(G, x, y) {                          // gi from the collar row y down to the boots
  G.poly([[x - 3.5, y], [x + 4.5, y], [x + 4.5, y + 5], [x - 3.5, y + 5]], 'g');
  G.rect(x - 1, y, 3, 1, 'n'); G.set(x, y + 1, 'n'); G.set(x - 2, y + 2, 'w');            // navy collar V, chest kanji patch
  G.line([[x - 1.5, y + 5], [x - 2, y + 7.5]], 2.6, 2.6, 'g'); G.line([[x + 2.5, y + 5], [x + 3, y + 7.5]], 2.6, 2.6, 'g');   // legs
  G.rect(x - 3, y + 4, 8, 1, 'b'); G.set(x, y + 5, 'b'); G.set(x + 1, y + 6, 'b');          // belt, tails
  G.rect(x - 4, y + 8, 3, 2, 'K'); G.rect(x + 2, y + 8, 3, 2, 'K');                         // boots
}
// krillin A: waving hello with a big open hand, the other hand on his belt
const KRILLIN = shapeSprite(16, 22, G => {
  G.line([[9.5, 13], [12.5, 12], [13.5, 7]], 2, 2, 'g'); G.rect(13, 7, 2, 1, 'b'); G.rect(13, 4, 2, 3, 's'); G.set(12, 3, 's'); G.set(14, 3, 's'); G.set(15, 5, 's');   // waving arm, open hand
  krHead(G, 6, 1, 'grin'); krBody(G, 6, 11);
  G.line([[2.5, 12], [1.5, 14.5]], 2, 2, 'g'); G.set(1, 15, 'b'); G.set(2, 15, 's');          // arm down to the belt
}, krPal, krShade);
// krillin B: red-faced in front of 18, holding his wallet out with both hands, a sweat drop
const satPal = { o: 0x120a06, a: 0x2e1c10, A: 0x1a0e06, c: 0x5e3e24, s: 0xdca868, S: 0xa87436, k: 0x140c08, w: 0xf6f4ee, W: 0xb4b8c8, t: 0xffffff, y: 0xf2c440, Y: 0xb8861a, r: 0xc8241e, R: 0x7a1010, K: 0x2a2a30, m: 0x9a1e1e };
const satShade = { a: 'A', s: 'S', w: 'W', y: 'Y', r: 'R' };
const satDown = G => ({                             // paints one row lower, so the afro's top bumps stay on the grid
  set: (x, y, c) => G.set(x, y + 1, c), rect: (x, y, w, h, c) => G.rect(x, y + 1, w, h, c), ell: (x, y, rx, ry, c) => G.ell(x, y + 1, rx, ry, c),
  poly: (p, c) => G.poly(p.map(([x, y]) => [x, y + 1]), c), line: (p, a, b, c) => G.line(p.map(([x, y]) => [x, y + 1]), a, b, c),
});
function satHead(G, x, mouth = 'grin') {            // afro and face centred on pixel x
  G.ell(x + .5, 6.5, 7, 5, 'a');
  for (const [i, j] of [[-7, 8.5], [-7.5, 5.5], [-6, 3], [-3.2, 1.8], [0, 1.5], [3.2, 1.8], [6, 3], [7.5, 5.5], [7, 8.5], [-6, 10.5], [6, 10.5]]) G.ell(x + .5 + i, j, 2.1, 1.9, 'a');   // scalloped edge
  for (const [i, j] of [[-6, 4], [-2, 2], [3, 3], [6, 6], [-4, 7], [0, 5], [-7, 9], [7, 9]]) { G.set(x + i, j, 'c'); G.set(x + i + 1, j - 1, 'c'); }   // curls
  G.ell(x + .5, 10.5, 3.6, 3.4, 's');                                     // face
  G.rect(x - 3, 8, 3, 1, 'k'); G.rect(x + 1, 8, 3, 1, 'k');                 // heavy brows
  G.set(x - 2, 9, 't'); G.set(x - 1, 9, 'k'); G.set(x + 1, 9, 't'); G.set(x + 2, 9, 'k'); G.set(x, 10, 'S');   // eyes, nose
  G.rect(x - 3, 11, 7, 1, 'k'); G.set(x - 3, 12, 'k'); G.set(x + 3, 12, 'k');   // thick moustache, drooping ends
  G.rect(x - 2, 12, 5, 1, 't');                                                 // the grin
  if (mouth === 'laugh') { G.rect(x - 2, 13, 5, 1, 'm'); G.set(x - 3, 13, 'k'); G.set(x + 3, 13, 'k'); G.rect(x - 2, 14, 5, 1, 'a'); }
  else { G.rect(x - 2, 13, 5, 1, 'a'); G.set(x - 2, 13, 'c'); G.set(x + 2, 13, 'c'); }               // fuzzy chin beard closing the ring
}
function satBody(G, x) {                            // white gi, gold champion's belt, white trousers, black boots
  G.poly([[x - 4, 15], [x + 5, 15], [x + 4.5, 21], [x - 3.5, 21]], 'w'); G.poly([[x - 1, 15], [x + 2, 15], [x + .5, 17.5]], 's');   // gi, open chest
  G.line([[x - 1.5, 21], [x - 2.5, 24]], 3, 3, 'w'); G.line([[x + 2.5, 21], [x + 3.5, 24]], 3, 3, 'w');   // trousers
  G.rect(x - 4, 19, 9, 2, 'y'); G.rect(x - 1, 19, 3, 2, 'Y'); G.set(x, 19, 't'); G.set(x, 20, 'r');    // belt and its plate with a red jewel
  G.rect(x - 4, 24, 3, 2, 'K'); G.rect(x + 3, 24, 3, 2, 'K');
}
const satCape = (G, x) => { G.poly([[x - 5, 15], [x + 6, 15], [x + 9.5, 26], [x - 8.5, 26]], 'r'); G.line([[x - 5, 17], [x - 7, 25]], 1, 1, 'R'); G.line([[x + 6, 17], [x + 8, 25]], 1, 1, 'R'); };
// satan A: the V sign thrown out wide, other fist on his hip
const SATAN = shapeSprite(24, 27, G0 => {
  const G = satDown(G0); satCape(G, 11); satHead(G, 11); satBody(G, 11);
  G.line([[7.5, 16], [3, 16], [2, 12]], 2.6, 2.4, 'w'); G.line([[15.5, 16], [20, 16], [21, 12]], 2.6, 2.4, 'w');   // arms
  G.rect(1, 12, 3, 1, 'K'); G.rect(20, 12, 3, 1, 'K'); G.rect(1, 9, 3, 3, 's'); G.rect(20, 9, 3, 3, 's');       // wristbands, fists
}, satPal, satShade);
// satan C: thumb jabbed at his chest, other fist punched high, laughing

// master roshi: bald, a long white beard, sunglasses, turtle shell on his back, cane; and roshi at max power, all muscle
const RP = { o: 0x1a1210, s: 0xf2c8a0, S: 0xc89a76, k: 0x111111, K: 0x5a6a7a, w: 0xffffff, W: 0xd8d8e0, r: 0xf08a24, R: 0xc0641a, y: 0xfff0a0, p: 0x6a5a48, P: 0x4a3e30, g: 0x4a9a3a, G: 0x2e6a26, n: 0x7a4a2a, m: 0xe0302a, b: 0xb86a1a, B: 0x7a4210, c: 0xe8a0a0 };
// roshi B: an old man hunched right over his cane, the big shell riding high on his back
const ROSHI = shapeSprite(20, 22, G => {
  G.ell(7, 10, 5.4, 5.8, 'G'); G.ell(7, 10, 4, 4.4, 'g'); G.set(5, 8, 'G'); G.set(8, 11, 'G'); G.set(5, 12, 'G'); G.set(8, 7, 'G');   // the shell
  G.line([[7, 16], [6.5, 21]], 2, 2, 'p'); G.line([[11, 16], [12, 21]], 2, 2, 'p');                                     // bent legs
  G.poly([[8, 9], [13, 10], [14, 16], [7, 17]], 'r'); G.set(10, 13, 'y'); G.set(12, 15, 'y');                          // flowery shirt
  G.ell(13.5, 7.5, 3.3, 3.4, 's'); G.set(12, 5, 'w');                                                                   // head pushed forward, shine
  G.rect(13, 6, 4, 2, 'k'); G.set(12, 6, 'k');                                                                          // sunglasses
  G.poly([[11.5, 9], [17, 9], [16.5, 14], [15, 17], [13, 13]], 'w');                                                   // beard hanging down
  G.line([[11, 11], [14, 14], [16, 13]], 1.8, 1.6, 'r'); G.set(17, 13, 's');                                           // arm out to the cane
  G.line([[17.5, 11], [18, 12], [17.5, 21]], 1, 1, 'n');                                                               // cane
}, RP, { w: 'W', r: 'R', g: 'G' });
// roshi C: chibi and leering, glasses glinting, a nosebleed and a grin under the moustache, cane tucked under an arm
const MP = { o: 0x1a1210, s: 0xf2c8a0, S: 0xc89a76, k: 0x111111, w: 0xffffff, W: 0xd8d8e0, r: 0xf08a24, R: 0xc0641a, p: 0x6a5a48, P: 0x4a3e30, g: 0x4a9a3a, G: 0x2e6a26, v: 0xd89a7a };
const roshiHead = (G, x, y, ring) => {
  if (ring) { G.ell(x, y, 4.2, 4.4, 'o'); G.poly([[x - 4, y + 1.5], [x + 4, y + 1.5], [x + 3, y + 7], [x, y + 9.2], [x - 3, y + 7]], 'o'); }   // outline where he sinks into muscle
  G.ell(x, y, 3.2, 3.4, 's'); G.set(x - 2, y - 3, 'w'); G.rect(x - 3, y - 1, 6, 2, 'k');                              // small head, shine, shades
  G.poly([[x - 3, y + 1.5], [x + 3, y + 1.5], [x + 2, y + 6], [x, y + 8], [x - 2, y + 6]], 'w');                      // beard
};
// beerus' favourite: a wobbling custard pudding with a caramel top, on a little plate
const PUDDING = shapeSprite(12, 10, G => { G.ell(6, 8.6, 5.6, 1.4, 'w'); G.poly([[2.5, 8], [9.5, 8], [8.5, 3], [3.5, 3]], 'y'); G.ell(6, 3, 2.6, 1.2, 'c'); G.set(4, 5, 'l'); }, { o: 0x3a2410, w: 0xf6f4ee, W: 0xc8c4b8, y: 0xf8d468, Y: 0xd8a83a, c: 0x8a4a1a, l: 0xfff4c0 }, { y: 'Y', w: 'W' });
// the android arc and west city: 17, 18, 16 and his birds, 19, dr. gero, bulma and her capsules
// androids & west city: 17, 18, 16 (+ a bird), 19, 20, bulma, a capsule gadget — four takes each
// an arm stroke with its own outline so it separates from the torso behind it
const limb = (G, pts, w0, w1, c) => { G.line(pts, w0 + 1.4, w1 + 1.4, 'o'); G.line(pts, w0, w1, c); };

// android 17
const P17 = { o: 0x101018, h: 0x1a1922, H: 0x2e2c3a, s: 0xf6d2b0, S: 0xc89a78, k: 0x141a30, f: 0xf28a22, F: 0xb85e10, b: 0x26252e, B: 0x141318, w: 0xf4f4f0, W: 0xbcbcc4, j: 0x3c6cc0, J: 0x284a8a, g: 0x3a9a4a, n: 0x8a6a48, N: 0x5a4430, r: 0xe0302a };
const S17 = { f: 'F', b: 'B', j: 'J', w: 'W', n: 'N' };
const head17 = (G, x, y, s = 1) => {
  G.poly([[x - 4.4 * s, y + 5], [x - 4.4 * s, y - 2], [x - 2.6 * s, y - 4.8 * s], [x + 2.6 * s, y - 4.8 * s], [x + 4.4 * s, y - 2], [x + 4.4 * s, y + 5], [x + 2.6 * s, y + 5], [x + 2.4 * s, y], [x - 2.4 * s, y], [x - 2.6 * s, y + 5]], 'h');   // shoulder-length hair
  G.ell(x, y + .4, 2.8 * s, 3.2 * s, 's');                                                                   // face
  G.poly([[x - 3 * s, y], [x - 3 * s, y - 3.6 * s], [x + 3 * s, y - 3.6 * s], [x + 3 * s, y], [x + .7, y - 2.2 * s], [x, y - 2.6 * s], [x - .7, y - 2.2 * s]], 'h');   // fringe, parted in the middle
  G.set(Math.floor(x - 1.3 * s), Math.floor(y + .6), 'k'); G.set(Math.floor(x + 1 * s), Math.floor(y + .6), 'k');   // eyes
};
// A: standing tall, hands in pockets, scarf tail hanging, white RR on the shirt
const A17 = shapeSprite(20, 25, G => {
  G.line([[11, 10], [15, 9], [18, 11]], 1.8, 1.2, 'f');                                                       // scarf tail in the wind
  head17(G, 9, 5);
  G.rect(6, 9, 6, 2, 'f');
  G.poly([[4.5, 11], [13.5, 11], [12.6, 18], [5.4, 18]], 'b');
  G.line([[4.6, 12], [5.4, 16], [12, 15]], 2.2, 2, 'w'); G.line([[13.4, 12], [12.6, 16], [6, 15]], 2.2, 2, 'W');   // arms folded
  G.set(6, 15, 's'); G.set(12, 15, 's');                                                                      // hands
  G.line([[7.5, 18], [6.5, 22]], 3, 2.6, 'j'); G.line([[10.5, 18], [11.5, 22]], 3, 2.6, 'j');                // legs apart
  G.rect(4, 22, 4, 2, 'n'); G.rect(11, 22, 4, 2, 'n');
}, P17, S17);
// C: chibi, big head, little body hovering, legs dangling, hands in pockets
const P18 = { o: 0x141018, y: 0xf4dc7a, Y: 0xc8a840, s: 0xf8d8bc, S: 0xcc9e80, e: 0x1e3c9a, k: 0x1c1a24, K: 0x0e0d12, w: 0xf6f6f2, d: 0x6a96d4, D: 0x40669e, j: 0x2c4c8c, J: 0x1c3264, n: 0x6a4a34, N: 0x46301e, m: 0xd8807a };
const S18 = { y: 'Y', d: 'D', j: 'J', n: 'N', k: 'K' };
const head18 = (G, x, y, s = 1) => {
  G.ell(x, y, 4 * s, 4.2 * s, 'y'); G.rect(Math.round(x - 4 * s), Math.round(y), Math.round(8 * s), Math.round(3 * s), 'y');   // the bob
  G.ell(x, y + .9 * s, 2.7 * s, 3 * s, 's');                                                                 // face
  G.poly([[x - 3.2 * s, y + .5], [x - 3.2 * s, y - 3 * s], [x + 3.2 * s, y - 3 * s], [x + 3.2 * s, y + 0], [x + 1 * s, y - 1.6 * s], [x - 2 * s, y - .8 * s]], 'y');   // swept fringe
  G.set(Math.floor(x - 1.3 * s), Math.floor(y + 1 * s), 'e'); G.set(Math.floor(x + 1 * s), Math.floor(y + 1 * s), 'e');   // blue eyes
};
// striped sleeve: alternating black/white along the arm
const stripes = (G, pts, w) => { G.line(pts, w + 1.4, w + 1.4, 'o'); G.line(pts, w, w, 'w'); const [[x0, y0], [x1, y1]] = [pts[0], pts[pts.length - 1]]; for (let t = 0; t <= 1.001; t += .34) { const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; G.set(Math.floor(x), Math.floor(y), 'k'); } };
// A: hand on hip, denim vest and skirt, black leggings, boots
const A18 = shapeSprite(16, 24, G => {
  head18(G, 8, 5);
  G.poly([[5, 10], [11, 10], [10.6, 16], [5.4, 16]], 'w'); for (const y of [11, 13, 15]) G.rect(6, y, 4, 1, 'k');   // striped shirt
  G.poly([[4.6, 10], [6.8, 10], [7, 16], [5, 16]], 'd'); G.poly([[9.2, 10], [11.4, 10], [11, 16], [9, 16]], 'd');   // open vest
  stripes(G, [[4.4, 11], [3.6, 16]], 1.8); G.set(3, 17, 's');                                                // arm hanging
  limb(G, [[11.6, 11], [13.4, 13.5], [11.4, 15.5]], 1.8, 1.8, 'w'); G.set(13, 12, 'k'); G.set(12, 14, 'k');  // hand on hip
  G.poly([[5, 16], [11, 16], [11.8, 18.5], [4.2, 18.5]], 'j');                                                // skirt
  G.line([[6.5, 18.5], [6.5, 21]], 2, 2, 'k'); G.line([[9.5, 18.5], [9.5, 21]], 2, 2, 'k');                   // leggings
  G.rect(5, 21, 3, 2, 'n'); G.rect(9, 21, 3, 2, 'n');
}, P18, S18);
// B: arms crossed, jeans, weight on one hip
const P16 = { o: 0x0e1410, g: 0x52a84c, G: 0x2e6e30, L: 0x8ad87a, s: 0xf0c8a0, S: 0xb88a64, r: 0xe0402a, R: 0x9a2414, e: 0x2050b0, p: 0x5a5470, P: 0x3a3650, k: 0x22222a, n: 0x6a5a3a, N: 0x443822, m: 0xa07050 };
const S16 = { g: 'G', p: 'P', r: 'R', n: 'N', s: 'S' };
// big square head, jaw, red mohawk
const head16 = (G, x, y, s = 1) => {
  G.rect(Math.round(x - 1.5 * s), Math.round(y - 5.5 * s), Math.round(3 * s), Math.round(3 * s), 'r');        // mohawk
  G.rect(Math.round(x - 3.5 * s), Math.round(y - 3 * s), Math.round(7 * s), Math.round(7 * s), 's');          // block head
  G.rect(Math.round(x - 1.5 * s), Math.round(y - 3 * s), Math.round(3 * s), 1, 'r');                          // mohawk base
  G.rect(Math.round(x - 2.5 * s), Math.round(y - .4 * s), 2, 1, 'k'); G.rect(Math.round(x + 1.5 * s) - 1, Math.round(y - .4 * s), 2, 1, 'k');   // flat brows
  G.set(Math.round(x - 1.6 * s), Math.round(y + .6 * s), 'e'); G.set(Math.round(x + 1.6 * s) - 1, Math.round(y + .6 * s), 'e');   // eyes
  G.rect(Math.round(x - 1 * s), Math.round(y + 2.6 * s), Math.round(2 * s), 1, 'S');                          // mouth
};
// A: standing straight, arms at his sides, calm
const A16 = shapeSprite(20, 28, G => {
  head16(G, 10, 6);
  G.rect(8, 10, 4, 2, 'p');                                                                                   // neck
  G.poly([[3, 12], [17, 12], [15.5, 20], [4.5, 20]], 'g'); G.rect(4, 12, 12, 1, 'L'); G.rect(9, 13, 2, 6, 'G');   // armour vest
  limb(G, [[3, 13], [2.4, 19]], 3, 2.8, 'p'); limb(G, [[17, 13], [17.6, 19]], 3, 2.8, 'p');                    // arms
  G.ell(2.5, 20.5, 1.6, 1.4, 's'); G.ell(17.5, 20.5, 1.6, 1.4, 's');                                          // fists
  G.rect(5, 20, 10, 2, 'k');                                                                                   // belt
  G.line([[7, 22], [7, 25]], 3.6, 3.4, 'p'); G.line([[13, 22], [13, 25]], 3.6, 3.4, 'p');                    // legs
  G.rect(4, 25, 5, 2, 'g'); G.rect(11, 25, 5, 2, 'g');                                                        // green boots
}, P16, S16);
// B: arms crossed, broader and stockier
const birdPal = (c, C, belly) => ({ o: 0x1a1410, c, C, b: belly, k: 0x111111, y: 0xf0a020 });
// A: blue, perched in profile
const BIRD_A = shapeSprite(8, 7, G => {
  G.ell(3.6, 3.8, 2.6, 1.8, 'c'); G.ell(5.2, 2.4, 1.4, 1.4, 'c'); G.line([[2, 4], [0.5, 5.5]], 1.4, 1, 'C');
  G.rect(3, 4, 2, 1, 'b'); G.set(5, 2, 'k'); G.set(7, 2, 'y'); G.set(3, 5, 'y'); G.set(4, 5, 'y');
}, birdPal(0x4a8ae0, 0x2a5aa8, 0xc8e0f8), { c: 'C' });
// B: yellow, wings raised, landing
const BIRD_B = shapeSprite(8, 7, G => {
  G.poly([[1, 1], [3.5, 3.5], [2, 4]], 'C'); G.poly([[7, 1], [4.5, 3.5], [6, 4]], 'C');
  G.ell(4, 4, 1.8, 1.6, 'c'); G.ell(4, 2.4, 1.1, 1.1, 'c');
  G.set(4, 2, 'k'); G.set(4, 3, 'y'); G.set(3, 5, 'y'); G.set(4, 5, 'y');
}, birdPal(0xf6d838, 0xc8a018, 0xfff0a0), {});
// C: red, round little puffball
const BIRD_C = shapeSprite(8, 7, G => {
  G.ell(3.8, 3.6, 2.8, 2.5, 'c'); G.ell(3.6, 4.4, 1.6, 1.2, 'b'); G.line([[1.4, 3.4], [0.5, 2.5]], 1.2, 1, 'C');
  G.set(5, 2, 'k'); G.set(6, 3, 'y'); G.set(3, 6, 'y'); G.set(4, 6, 'y');
}, birdPal(0xe0402e, 0x9a2218, 0xf6c8a0), { c: 'C' });
// D: white, wings spread wide in flight
const BIRD_D = shapeSprite(9, 7, G => {
  G.line([[3, 4.5], [0.6, 5.6]], 1.6, 1.2, 'C'); G.ell(4, 4.4, 2.4, 1.5, 'c'); G.ell(6.4, 3.2, 1.3, 1.2, 'c');   // tail, body, head
  G.poly([[2.5, 4], [1.6, 0.4], [3.4, 1.4], [5, 3.6]], 'C');                                                 // wing up
  G.set(6, 3, 'k'); G.set(8, 3, 'y'); G.set(4, 6, 'y');
}, birdPal(0xf6f6f2, 0xa8b0c4, 0xffffff), {});

// android 19
const P19 = { o: 0x16121a, w: 0xf6f2ee, W: 0xc8c0c8, k: 0x1c1c24, K: 0x0c0c10, b: 0x4a62a8, B: 0x2e3e78, r: 0xd8241e, y: 0xf2c84a, Y: 0xb88a1a, l: 0x4a6ad8, e: 0x111111, m: 0xf4a0a8, g: 0x9a9aa8, c: 0x3a4a5a, C: 0x223038 };
const S19 = { w: 'W', b: 'B', y: 'Y', k: 'K', c: 'C' };
// round white face, black hat with RR star, blue lips, ear studs
const head19 = (G, x, y, s = 1) => {
  G.ell(x, y + .4, 3.9 * s, 3.6 * s, 'w');                                                                   // round white face
  G.poly([[x - 2.8 * s, y - 2.2 * s], [x - 2.4 * s, y - 4.6 * s], [x + 2.4 * s, y - 4.6 * s], [x + 2.8 * s, y - 2.2 * s]], 'k'); G.rect(Math.round(x - 4 * s), Math.round(y - 2.4 * s), Math.round(8 * s), 1, 'k');   // little black hat, brim
  G.set(Math.floor(x), Math.floor(y - 3.6 * s), 'r');                                                        // RR badge
  G.set(Math.floor(x - 1.6 * s), Math.floor(y), 'e'); G.set(Math.floor(x + 1.4 * s), Math.floor(y), 'e');   // beady eyes
  G.set(Math.floor(x - 2.6 * s), Math.floor(y + 1.2 * s), 'm'); G.set(Math.floor(x + 2.4 * s), Math.floor(y + 1.2 * s), 'm');   // clown blush
  G.rect(Math.floor(x - 1 * s), Math.floor(y + 2 * s), Math.max(2, Math.round(2 * s)), 1, 'l');             // blue lips
  G.set(Math.floor(x - 4 * s), Math.floor(y + .6), 'g'); G.set(Math.floor(x + 4 * s) - 1, Math.floor(y + .6), 'g');   // ear studs
};
// A: flying right, belly out, one palm thrust forward
const A19 = shapeSprite(18, 24, G => {
  G.ell(9, 15, 7, 6, 'c'); G.ell(9, 15.5, 4.6, 4.4, 'b'); G.rect(8, 13, 3, 1, 'r'); G.set(9, 14, 'r');
  head19(G, 9, 6);
  G.rect(3, 19, 12, 1, 'y');
  G.line([[6.5, 20], [6, 22]], 3, 3, 'c'); G.line([[11.5, 20], [12, 22]], 3, 3, 'c');
  G.rect(4, 22, 4, 1, 'k'); G.rect(10, 22, 4, 1, 'k');
  limb(G, [[3, 13], [2.5, 17]], 2.4, 2.2, 'w');
  limb(G, [[15, 13], [13.4, 15]], 2.4, 2.4, 'w'); G.ell(12.6, 16, 2, 2.2, 'w'); G.set(12, 16, 'g'); G.set(13, 16, 'g');   // big palm facing out
}, P19, S19);
// C: chibi beach ball, both hands out
const P20 = { o: 0x16121a, w: 0xf8f8f8, W: 0xbcb8c0, s: 0xeab894, S: 0xb07e60, k: 0x1c1a22, K: 0x0c0c10, p: 0xf2a0b4, P: 0xc06a84, q: 0xcfeaf8, c: 0xe2d4b0, C: 0xa8986e, r: 0xd8241e, e: 0x111111, b: 0x3a3442, B: 0x24202c, g: 0x8a8a96 };
const S20 = { c: 'C', k: 'K', b: 'B', p: 'P' };
// thin old face, long white moustache drooping past the chin, hair tufts at the sides
const face20 = (G, x, y) => {
  G.ell(x, y + 1.5, 2.6, 3.6, 's');
  G.rect(x - 4, y - 1, 2, 4, 'w'); G.rect(x + 2, y - 1, 2, 4, 'w');                                          // side hair
  G.rect(x - 3, y, 2, 1, 'w'); G.rect(x + 1, y, 2, 1, 'w');                                                  // bushy brows
  G.set(x - 2, y + 1, 'e'); G.set(x + 1, y + 1, 'e'); G.set(x - 1, y + 2, 'S');                             // eyes, nose
  G.poly([[x - 2.6, y + 3], [x + 2.6, y + 3], [x + 3, y + 7], [x + 1.6, y + 7], [x + .5, y + 4], [x - .5, y + 4], [x - 1.6, y + 7], [x - 3, y + 7]], 'w');   // drooping moustache
};
const hat20 = (G, x, y) => { G.rect(x - 4, y - 1, 8, 1, 'k'); G.rect(x - 3, y - 4, 6, 3, 'k'); G.set(x, y - 2, 'r'); };   // black hat, RR badge
const brain20 = (G, x, y) => {
  G.ell(x, y - 2, 3.4, 2.8, 'q'); G.ell(x, y - 1.6, 2.8, 2.2, 'p');                                          // glass dome, brain
  G.set(x - 2, y - 2, 'P'); G.set(x, y - 3, 'P'); G.set(x + 1, y - 1, 'P'); G.set(x - 1, y - 1, 'P');
  G.rect(x - 3, y, 6, 1, 'g');                                                                                // metal rim
};
const coat20 = (G, x, y, h = 11) => {
  G.poly([[x - 4, y], [x + 4, y], [x + 5, y + h], [x - 5, y + h]], 'c'); G.rect(x - .5, y, 1, h, 'C');       // long coat
  G.rect(x - 1, y, 2, 2, 'b');                                                                                // dark shirt at the collar
};
// A: hat on, flying at you with a palm out, coat flapping
const A20 = shapeSprite(18, 26, G => {
  coat20(G, 8, 11, 12);
  brain20(G, 8, 4); face20(G, 8, 4);
  limb(G, [[4, 12], [4, 17]], 1.8, 1.6, 'c'); G.set(4, 18, 's');
  limb(G, [[12, 12], [14, 14], [15.5, 12.5]], 1.8, 1.8, 'c'); G.ell(16, 11.4, 1, 1.6, 's');
  G.rect(5, 23, 2, 2, 'k'); G.rect(9, 23, 2, 2, 'k');
}, P20, S20);
// C: chibi, oversize head, hat knocked back so the brain shows under the brim
const PB = { o: 0x14101a, h: 0x3ac0c8, H: 0x1e8a94, s: 0xf8d6bc, S: 0xcc9e80, e: 0x1a2a4a, p: 0xf07ab0, P: 0xb84a80, w: 0xf6f6f2, W: 0xbcbcc8, k: 0x222230, b: 0x3a5ac8, B: 0x243a8a, r: 0xe0302a, y: 0xf2c84a, n: 0x6a4a34, l: 0xd8d8e0, g: 0x80e880, m: 0xe06a6a };
const SB = { h: 'H', p: 'P', w: 'W', b: 'B' };
// A: classic: long teal ponytail, pink dress with belt, holding a capsule up
const BULMA = shapeSprite(14, 24, G => {
  G.line([[9, 3], [11.5, 5], [12, 9]], 2.4, 1.4, 'h');                                                       // ponytail
  G.ell(7, 5, 3.4, 3.6, 'h'); G.ell(7, 6, 2.6, 2.8, 's'); G.poly([[4, 5], [5, 2.5], [10, 3], [9.5, 5], [7, 3.8]], 'h');   // hair, face, fringe
  G.rect(4, 3, 6, 1, 'r');                                                                                   // red bow band
  G.set(6, 6, 'e'); G.set(8, 6, 'e'); G.set(7, 8, 'm');
  G.poly([[5, 10], [9, 10], [11, 18], [3, 18]], 'p'); G.rect(4, 13, 6, 1, 'k');                              // dress, belt
  limb(G, [[5, 11], [3.5, 15]], 1.4, 1.4, 's');
  limb(G, [[9, 11], [11, 9], [11.5, 7]], 1.4, 1.4, 's'); G.rect(11, 5, 2, 2, 'w'); G.set(11, 6, 'r');      // hand up with a capsule
  G.line([[6, 18], [6, 21]], 1.6, 1.6, 's'); G.line([[8, 18], [8, 21]], 1.6, 1.6, 's');
  G.rect(5, 21, 2, 1, 'b'); G.rect(8, 21, 2, 1, 'b');                                                         // shoes
}, PB, SB);
// B: short bob, white Capsule Corp jumpsuit with CC patch, holding a gadget out in both hands
const PG = { o: 0x16141c, w: 0xf6f6f2, W: 0xb8bcc8, q: 0xffffff, r: 0xe0302a, R: 0x9a1a16, b: 0x3a6ad8, B: 0x22409a, y: 0xf2c84a, Y: 0xb88a1a, k: 0x22222a, g: 0x6ae86a };
const SG = { w: 'W', r: 'R', b: 'B', y: 'Y' };
// A: horizontal pill, red band, number "1"
const GADGET_A = shapeSprite(10, 10, G => {
  G.ell(5, 5, 4.2, 3, 'w'); G.rect(6, 2, 1, 6, 'r'); G.rect(2, 3, 2, 1, 'q');                                 // pill, red band, shine
  G.rect(3, 4, 1, 3, 'k'); G.set(2, 4, 'k');                                                                   // "1"
}, PG, SG);
// B: upright pill, blue cap on top, number "3" on the white body
const GADGET_B = shapeSprite(10, 10, G => {
  G.ell(5, 5, 3, 4.2, 'w'); for (let y = 0; y < 4; y++) for (let x = 0; x < 10; x++) if (G.g[y][x] === 'w') G.g[y][x] = 'b';   // blue cap
  G.rect(2, 4, 6, 1, 'B'); G.set(3, 1, 'q'); G.set(3, 2, 'q');                                                                   // seam, shine
  G.rect(4, 5, 2, 1, 'k'); G.set(5, 6, 'k'); G.rect(4, 7, 2, 1, 'k'); G.set(3, 7, 'W');                        // a squat 3
}, PG, SG);
// C: tilted diagonal capsule with a gold band, sparkling
const GADGET_C = shapeSprite(10, 10, G => {
  G.line([[2.2, 7.8], [7.8, 2.2]], 4, 4, 'w'); G.line([[5, 5.2], [5.8, 6]], 1, 1, 'y'); G.line([[4, 4.2], [6, 6.2]], 1.6, 1.6, 'y');   // pill, band
  G.set(2, 6, 'q'); G.set(3, 5, 'q'); G.set(7, 3, 'k'); G.set(6, 4, 'k');
  G.set(9, 0, 'y'); G.set(0, 9, 'y');
}, PG, SG);
// D: fat horizontal capsule, half red / half white, Capsule Corp "CC" mark and a green glow pip
const GADGET_D = shapeSprite(10, 10, G => {
  G.ell(5, 5, 4, 3, 'w'); for (let y = 0; y < 10; y++) for (let x = 0; x < 5; x++) if (G.g[y][x] === 'w') G.g[y][x] = 'r';   // red half
  G.set(6, 4, 'k'); G.set(6, 5, 'k'); G.set(7, 4, 'k'); G.set(7, 6, 'k'); G.set(6, 6, 'k');                  // C
  G.set(3, 3, 'q'); G.set(5, 7, 'g');
}, PG, SG);

const BIRDS = [BIRD_A, BIRD_B, BIRD_C, BIRD_D], GADGETS = [GADGET_A, GADGET_B, GADGET_C, GADGET_D];

// the saga villains after beerus: hit, goku black, jiren, moro, gas (picked takes)
// ---------- hit: purple dome split down the middle, paler face framed by lines from the eyes to the chin, red eyes,
// a dark purple turtleneck trench coat, dark cyan undershirt with a yellow buckle ----------
const HIT_PAL = { o: 0x140a1c, s: 0x9a6cc8, S: 0x6a4696, f: 0xc8a8ea, F: 0x9c7cc4, c: 0x4e2e72, C: 0x2e1a46, k: 0x140a18, w: 0xffffff, e: 0xf03a2a, a: 0x46345e, A: 0x2a1e3c, q: 0x5c6c8c, Q: 0x3c4864, u: 0x2a7884, U: 0x1a4c56, y: 0xf2c840, b: 0x3e2a56, B: 0x1c1424, p: 0xd8a0ff, P: 0x9a5aee };
const HIT_SH = { s: 'S', a: 'A', u: 'U', q: 'Q', b: 'B' };
function hitSpr(o = {}) {
  const W = 26, pose = o.pose || 'pockets';
  return shapeSprite(W, 36, G => {
    if (pose === 'skip') for (const r of [[13, 21, 12.4, 13.8], [13, 21, 10.8, 12.2]]) { G.ell(r[0], r[1], r[2], r[3], 'P'); G.ell(r[0], r[1], r[2] - .9, r[3] - .9, '.'); }   // time-skip ripple
    // cyan trousers in the split of the coat, dark purple boots with black toes
    oline(G, [[11, 26], [10.6, 32]], 3, 2.8, 'u'); oline(G, [[15, 26], [15.4, 32]], 3, 2.8, 'u');
    G.rect(8, 32, 5, 2, 'b'); G.rect(14, 32, 5, 2, 'b'); G.rect(8, 33, 2, 1, 'B'); G.rect(17, 33, 2, 1, 'B');
    // the long coat: two panels flaring to the shins, open below the belt
    const panel = [[6.6, 14.6], [13, 15], [12.4, 24], [10.4, 31.4], [4.4, 31.4]];
    G.poly(panel, 'a'); G.poly(mir(W, panel), 'a');
    G.line([[12.4, 23], [10.8, 31]], 1, 1, 'A'); G.line([[13.6, 23], [15.2, 31]], 1, 1, 'A');
    G.poly([[10.4, 15], [15.6, 15], [14.6, 20.6], [11.4, 20.6]], 'u');                                    // undershirt
    G.rect(8, 21, 10, 2, 'u'); G.rect(12, 21, 2, 2, 'y');                                                  // cyan belt, yellow buckle
    const arm = pts => oline(G, pts, 3, 2.6, 'a');
    const pocket = side => { const p = [[7.4, 16], [5.4, 20], [7.2, 23.8]]; arm(side ? mir(W, p) : p); G.rect(side ? 17 : 6, 24, 3, 1, 'C'); };
    if (pose !== 'fold') pocket(0);
    if (pose === 'pockets') pocket(1);
    if (pose === 'jab') {
      arm([[18.6, 16.4], [22, 17.6], [23.6, 17.6]]); G.ell(24, 17.6, 1.5, 1.5, 's'); G.rect(21, 17, 1, 2, 'c');
      for (const y of [15, 20]) G.line([[17.6, y], [21.4, y]], 1, 1, 'p');                                // the blur of the punch
    }
    if (pose === 'fold') { const l = [[7, 16.6], [8.6, 19.4], [16.6, 19]], r = [[19, 16.6], [17.6, 20.4], [9.4, 20.2]]; G.line(l, 5, 4.6, 'o'); G.line(r, 5, 4.6, 'o'); G.line(l, 3, 2.6, 'a'); G.line(r, 3, 2.6, 'q'); G.ell(9.2, 19.6, 1.3, 1.2, 's'); G.ell(16.8, 20.4, 1.3, 1.2, 's'); }
    if (pose === 'skip') { arm(mir(W, [[7.4, 16], [4.2, 17], [3.4, 12.6]])); G.ell(22.6, 12.4, 1.4, 1.4, 's'); G.rect(22, 9, 1, 3, 's'); G.rect(23, 9, 1, 3, 's'); G.rect(21, 13, 3, 1, 'c'); }
    // the turtleneck collar
    const col = [[7, 13], [10.6, 14.4], [10.6, 16.6], [6.4, 16]]; G.poly(col, 'q'); G.poly(mir(W, col), 'q'); G.rect(10, 14, 6, 2, 'q');
    // head: purple dome with a raised split down the middle, flat ears, paler face framed in dark lines
    G.ell(13, 8.8, 4.9, 5.2, 's'); G.rect(11, 13, 4, 1, 's');
    G.ell(7.8, 9.6, 1, 1.8, 's'); G.ell(18.2, 9.6, 1, 1.8, 's');
    G.poly([[11.8, 4], [12.4, 2.6], [13, 2.4], [13.6, 2.6], [14.2, 4], [13, 3.8]], 's'); G.line([[13, 3], [13, 7.4]], 1, 1, 'C');   // the split crest
    G.set(11, 5, 'f'); G.set(10, 6, 'f');
    G.poly([[9.2, 9.4], [16.8, 9.4], [16.4, 12], [14.6, 14.4], [11.4, 14.4], [9.6, 12]], 'f');
    G.line([[9.2, 10.4], [9.8, 12.4], [11.6, 14.4], [14.4, 14.4], [16.2, 12.4], [16.8, 10.4]], 1, 1, 'c');   // the framing lines
    const eye = o.glow ? 'p' : 'e';
    G.rect(9, 8, 3, 1, 'C'); G.rect(14, 8, 3, 1, 'C'); G.set(11, 9, 'C'); G.set(14, 9, 'C');               // brows
    G.rect(10, 9, 2, 2, eye); G.rect(14, 9, 2, 2, eye); G.set(10, 9, 'k'); G.set(15, 9, 'k'); if (!o.glow) { G.set(11, 10, 'k'); G.set(14, 10, 'k'); }
    if (o.mouth === 'smirk') { G.rect(12, 12, 2, 1, 'C'); G.set(14, 11, 'C'); }
    else G.rect(12, 12, 2, 1, 'F');
  }, HIT_PAL, HIT_SH);
}

// ---------- goku black: goku's face, darker skin, cruel narrowed eyes; grey dogi over a black long-sleeved turtleneck,
// red sash, black trousers, pointy white boots, green-and-gold potara on his left ear; rosé turns the hair pink ----------
const BLK_PAL = { o: 0x050408, h: 0x343448, H: 0x22222f, j: 0x5c5c7c, s: 0xe8b48c, S: 0xb47c5a, k: 0x120c12, w: 0xffffff, W: 0xbcc0cc, v: 0x9aa0b0, g: 0x80808e, G: 0x585866, n: 0x26263a, N: 0x3c3c52, r: 0xc0242e, R: 0x7a141c, x: 0x3ad070, y: 0xf2c840, p: 0xf27ac0, P: 0xc04a8e, l: 0xffc4e4, m: 0x9a50e0 };
const BLK_SH = { h: 'H', g: 'G', r: 'R', s: 'S', p: 'P', w: 'W' };
const BLK_HAIR = {
  base: [[[13, 6], [12.4, 0]], [[11, 6.4], [6, 0.8]], [[15, 6.4], [19.6, 1.4]], [[9.4, 8], [2.4, 4.6]], [[16.6, 8], [23.6, 5]], [[9, 10], [2.6, 11]], [[17, 10], [23.2, 11.4]]],
  rose: [[[13, 6], [13, -0.6]], [[10.6, 6.4], [6.6, 0]], [[15.4, 6.4], [19.6, 0.2]], [[9.2, 8.4], [2.6, 3.4]], [[16.8, 8.4], [23.4, 3.8]], [[9, 10.6], [2.8, 9]], [[17, 10.6], [23.2, 9.4]]],
};
function blackSpr(o = {}) {
  const W = 26, pose = o.pose || 'fold', rose = !!o.rose, hc = rose ? 'p' : 'h', hl = rose ? 'l' : 'j';
  return shapeSprite(W, 36, G0 => {
    G0.poly([[7.4, 14], [7.2, 8.6], [8, 5.4], [13, 4], [18, 5.4], [18.8, 8.6], [18.6, 14]], hc);
    for (const [b, t] of BLK_HAIR[rose ? 'rose' : 'base']) { G0.line([b, t], rose ? 4.4 : 3.8, 1, hc); G0.line([[b[0] + (t[0] - b[0]) * .3, b[1] + (t[1] - b[1]) * .3], [b[0] + (t[0] - b[0]) * .62, b[1] + (t[1] - b[1]) * .62]], 1, 1, hl); }
    if (pose === 'scythe') G0.line([[3, 35], [20, 4]], 1.6, 1.6, 'P');                                     // the scythe's shaft behind him
    const G = shift(G0, 2);
    // black trousers, pointy white boots
    oline(G, [[11, 22], [10.4, 28.4]], 3.6, 3, 'n'); oline(G, [[15, 22], [15.6, 28.4]], 3.6, 3, 'n');
    G.poly([[8, 28], [12.6, 28], [12.6, 31.4], [7, 31.4], [6.8, 30.4]], 'w'); G.poly([[13.4, 28], [18, 28], [19.2, 30.4], [19, 31.4], [13.4, 31.4]], 'w');
    // grey dogi over the black turtleneck, red sash with a hanging tail
    G.poly([[7.4, 14.2], [18.6, 14.2], [18, 22.4], [8, 22.4]], 'g');
    G.poly([[10.6, 14.2], [15.4, 14.2], [13, 18.4]], 'n'); G.rect(11, 13, 4, 2, 'n');
    G.rect(8, 20, 10, 2, 'r'); G.poly([[9, 21.6], [11, 21.6], [10.4, 25], [8.6, 24.6]], 'r');
    G.ell(6.8, 15.8, 2.4, 2, 'g'); G.ell(19.2, 15.8, 2.4, 2, 'g');                                        // dogi shoulders
    const arm = (pts, fist) => { oline(G, pts, 2.6, 2.4, 'n'); if (fist) G.ell(fist[0], fist[1], 1.4, 1.4, 's'); };
    if (pose === 'fold') { const l = [[6.2, 16.6], [7.6, 19.2], [15.4, 18.8]], r = [[19.8, 16.6], [18.4, 19.8], [10.6, 19.6]]; G.line(l, 4.6, 4.4, 'o'); G.line(r, 4.6, 4.4, 'o'); G.line(l, 2.6, 2.4, 'n'); G.line(r, 2.6, 2.4, 'N'); G.ell(8, 19.2, 1.2, 1.2, 's'); G.ell(18, 19.8, 1.2, 1.2, 's'); }
    if (pose === 'blade') {
      arm([[6, 16.6], [4.6, 20], [5.6, 23]], [5.6, 23.6]);
      G.line([[19.6, 17], [23.4, 5.4]], 3, .8, 'm'); G.line([[20, 15.6], [22.6, 8]], 1, .6, 'l');        // the ki blade off his hand
      arm([[19.6, 16.4], [21.2, 19.6], [19.6, 18.4]]); G.ell(19.6, 18, 1.5, 1.5, 's'); G.set(20, 17, 'x');  // time ring
    }
    if (pose === 'orb') {
      arm([[6, 16.6], [4.6, 20], [5.6, 23]], [5.6, 23.6]);
      arm([[19.6, 16.2], [22.4, 14], [22.4, 10.6]]); G.ell(22.4, 7.6, 2.8, 2.8, 'P'); G.ell(22.4, 7.6, 1.7, 1.7, 'l'); G.ell(22.4, 9.8, 1.3, 1.3, 's');
    }
    if (pose === 'scythe') {
      arm([[6, 16.6], [5, 19.4], [7.6, 21.4]], [7.8, 21.4]);
      arm([[19.6, 16.2], [19.4, 12.6]]); G.ell(19.2, 11.6, 1.5, 1.5, 's');
    }
    // head: goku's face, narrowed eyes, smirk; potara on his left ear
    { const H = shift(G0, 1);
      H.ell(13, 10.4, 4.5, 4.6, 's'); H.poly([[8.6, 10], [17.4, 10], [17.2, 13.4], [15.4, 15.2], [10.6, 15.2], [8.8, 13.4]], 's');
      H.rect(8, 10, 1, 3, 's'); H.rect(17, 10, 1, 3, 's');
      H.poly([[8, 5], [18, 5], [18, 8.6], [16.6, 7], [15.6, 9.6], [14.2, 7], [12.6, 9.8], [11, 7], [9.4, 9.6], [8, 8.6]], hc);
      for (const [x, y] of [[9, 9], [10, 10], [11, 10], [17, 9], [16, 10], [15, 10]]) H.set(x, y, 'k');
      H.set(10, 11, 'w'); H.set(11, 11, rose ? 'v' : 'k'); H.set(16, 11, 'w'); H.set(15, 11, rose ? 'v' : 'k');
      H.set(13, 12, 'S');
      if (o.mouth === 'grin') { H.rect(11, 13, 4, 1, 'w'); H.set(10, 13, 'k'); H.set(15, 12, 'k'); }
      else { H.set(11, 13, 'k'); H.set(12, 13, 'k'); H.set(13, 13, 'k'); H.set(14, 12, 'k'); }
      H.set(18, 12, 'y'); H.set(18, 13, 'x'); H.set(18, 14, 'x'); }
    if (pose === 'scythe') { G0.line([[21, 4.4], [17, 1.6], [11, 1.2], [3.6, 4.4]], 4.6, .8, 'o'); G0.line([[20.6, 4.4], [17, 2], [11, 1.6], [4.6, 4.2]], 3.2, .4, 'p'); G0.line([[18.4, 2], [13, 1], [9, 1.4]], 1, .6, 'l'); }   // the pink scythe blade over his head
  }, BLK_PAL, BLK_SH);
}

// ---------- jiren: huge sleek grey head, giant round black eyes, red spandex pride trooper suit with black collar and legs,
// white gloves and boots ----------
const JIR_PAL = { o: 0x140a0c, g: 0xa89498, G: 0x6e5a62, l: 0xd2c0c4, k: 0x0e0a0e, K: 0x3a3438, r: 0xd8282e, R: 0x8e161c, n: 0x1c1a20, N: 0x34323a, w: 0xf6f4f6, W: 0xbcb8c4, e: 0xff3a30, a: 0xff6a3a, A: 0xc8201c, y: 0xffd060 };
const JIR_SH = { g: 'G', r: 'R', w: 'W' };
function jirenSpr(o = {}) {
  const W = 28, pose = o.pose || 'fold';
  return shapeSprite(W, 36, G => {
    if (o.aura) { G.poly([[14, 0], [17, 4], [21, 1], [21.6, 7], [26.6, 6], [24.6, 13], [27.6, 18], [24.6, 24], [27.4, 31], [22, 30], [21, 35.4], [7, 35.4], [6, 30], [.6, 31], [3.4, 24], [.4, 18], [3.4, 13], [1.4, 6], [6.4, 7], [7, 1], [11, 4]], 'A'); G.poly([[14, 3], [19, 6], [24, 9], [22, 18], [25, 29], [3, 29], [6, 18], [4, 9], [9, 6]], 'a'); }
    // short black legs, white boots
    oline(G, [[11.4, 26], [10.6, 31.6]], 4, 3.6, 'n'); oline(G, [[16.6, 26], [17.4, 31.6]], 4, 3.6, 'n');
    G.rect(8, 31, 6, 3, 'w'); G.rect(15, 31, 6, 3, 'w');
    // barrel chest: red suit, black collar yoke, black belt line
    G.poly([[7, 16], [21, 16], [20.2, 26.6], [7.8, 26.6]], 'r');
    G.poly([[9, 16], [19, 16], [18, 18], [14, 19.4], [10, 18]], 'n');
    G.rect(8, 25, 12, 2, 'n');
    G.line([[14, 20.4], [14, 24]], 1, 1, 'R'); G.set(11, 21, 'R'); G.set(16, 21, 'R');
    G.ell(6.4, 18, 3, 2.6, 'r'); G.ell(21.6, 18, 3, 2.6, 'r');                                             // shoulders
    const glove = (x, y, r = 1.7) => { G.ell(x, y, r + 1, r + 1, 'o'); G.ell(x, y, r, r, 'w'); };
    const arm = pts => oline(G, pts, 3.4, 3, 'g');
    if (pose === 'fold') { const l = [[5.4, 18.6], [7, 22], [17.4, 21.4]], r = [[22.6, 18.6], [21, 23], [10.6, 22.8]]; G.line(l, 5.6, 5.2, 'o'); G.line(r, 5.6, 5.2, 'o'); G.line(l, 3.6, 3.2, 'g'); G.line(r, 3.6, 3.2, 'G'); glove(8.4, 22.6, 1.6); glove(19.4, 22, 1.6); }
    if (pose === 'punch') {
      arm([[5.4, 18.6], [4, 22.4], [5.6, 25]]); glove(5.6, 25.4);
      arm([[22.4, 18.4], [24.6, 19]]); glove(25.2, 19, 2.2); for (const [x, y] of [[27, 15], [27, 23], [24, 14]]) G.set(x, y, 'y');
    }
    if (pose === 'fists') { const a = [[5.4, 18.6], [4, 22.4], [5.6, 25]]; arm(a); arm(mir(W, a)); glove(5.6, 25.4); glove(22.4, 25.4); }
    if (pose === 'raise') {
      arm([[5.4, 18.6], [4, 22.4], [5.6, 25]]); glove(5.6, 25.4);
      arm([[22.6, 18], [25, 14.6], [24.6, 10.4]]); glove(24.6, 9.4, 2);
    }
    // the head: a wide sleek cranium narrowing to a small jaw, flat round ears
    G.ell(14, 8.6, 5.8, 5.6, 'g'); G.poly([[8.4, 9], [19.6, 9], [18.4, 14], [16, 16.4], [12, 16.4], [9.6, 14]], 'g');
    G.ell(7.8, 11, 1, 1.6, 'g'); G.ell(20.2, 11, 1, 1.6, 'g'); G.set(7, 11, 'G'); G.set(21, 11, 'G');
    G.set(11, 4, 'l'); G.set(12, 4, 'l'); G.set(10, 5, 'l');
    G.rect(12, 16, 4, 1, 'g');
    // big round black eyes with dark-grey rims, small pupils
    G.poly([[9.4, 9.4], [13, 10.4], [13, 13.2], [11.4, 13.6], [9.6, 12]], 'k'); G.poly(mir(W, [[9.4, 9.4], [13, 10.4], [13, 13.2], [11.4, 13.6], [9.6, 12]]), 'k');
    G.set(10, 10, 'K'); G.set(17, 10, 'K');
    if (o.glow) { G.rect(11, 11, 2, 1, 'e'); G.rect(15, 11, 2, 1, 'e'); G.set(11, 12, 'y'); G.set(16, 12, 'y'); }
    else { G.set(11, 11, 'K'); G.set(16, 11, 'K'); G.set(12, 11, 'w'); G.set(15, 11, 'w'); }
    G.line([[9, 8.8], [13, 9.8]], 1, 1, 'G'); G.line([[19, 8.8], [15, 9.8]], 1, 1, 'G');
    G.set(14, 13, 'G');
    if (o.mouth === 'roar') { G.rect(12, 14, 4, 2, 'k'); G.rect(12, 14, 4, 1, 'w'); }
    else G.rect(13, 15, 2, 1, 'G');
  }, JIR_PAL, JIR_SH);
}

// ---------- moro: hunched old blue goat sorcerer, horns curling round to his cheeks, long pointy ears, round red eyes,
// a shaggy white beard, red hooded robe, fur tufts on the shoulders, bandaged wrists, crooked staff ----------
const MOR_PAL = { o: 0x120a10, g: 0x5a7ad0, G: 0x3c5296, l: 0x9cb8f0, h: 0xe0d2b0, H: 0xa08c66, k: 0x100a10, w: 0xffffff, W: 0xc4c6d4, y: 0xffd23a, e: 0xff3828, v: 0xb02a2c, V: 0x6e1418, b: 0x7a5232, B: 0x4e321c, f: 0x8a6440, d: 0x2e2a3e, m: 0x5a1018, u: 0xa070ff, U: 0x6a3ac8, z: 0x5aff9a, Z: 0x1aa858 };
const MOR_SH = { g: 'G', h: 'H', v: 'V', b: 'B', w: 'W' };
function moroSpr(o = {}) {
  const W = 26, pose = o.pose || 'staff';
  return shapeSprite(W, 36, G => {
    const staff = pts => G.line(pts, 1.6, 1.6, 'b');
    if (pose === 'staff') { staff([[21.4, 9], [21, 35]]); G.line([[21.4, 9], [21.6, 5.4], [23.6, 4.2], [24.8, 6], [23.6, 7.6]], 1.8, 1.2, 'b'); }
    if (pose === 'cast') { staff([[20.4, 4], [21, 33]]); G.ell(20.4, 3, 3, 3, 'U'); G.ell(20.4, 3, 2, 2, 'u'); G.set(20, 2, 'w'); for (const [x, y] of [[15, 2], [24, 8], [16, 6], [25, 1]]) G.set(x, y, 'u'); }
    // the robe: red, hooded, to the floor; dark trousers peek out, bandaged ankles
    G.poly([[7.6, 15], [18.4, 15], [21.6, 32.4], [4.4, 32.4]], 'v');
    G.line([[13, 22], [13, 32]], 1, 1, 'V'); G.line([[9, 23], [7.4, 32]], 1, 1, 'V');
    G.rect(7, 32, 4, 2, 'd'); G.rect(15, 32, 4, 2, 'd'); G.rect(7, 32, 4, 1, 'W'); G.rect(15, 32, 4, 1, 'W');
    G.rect(7, 25, 12, 2, 'f');                                                                             // fur pelt at the waist
    G.ell(7, 15.6, 2.8, 2, 'f'); G.ell(19, 15.6, 2.8, 2, 'f');                                             // fur tufts on the shoulders
    const hand = (x, y) => { G.ell(x, y, 1.4, 1.4, 'g'); };
    const arm = (pts, cuff) => { oline(G, pts, 2.8, 2.4, 'v'); G.ell(cuff[0], cuff[1], 1.2, 1, 'w'); };
    if (pose === 'staff') { arm([[7, 17], [5.2, 21], [8, 23.6]], [7.4, 23.4]); hand(8.8, 23.6); arm([[19, 17], [20.8, 19.4], [20.6, 21]], [20.8, 20.6]); hand(21.2, 21.8); }
    if (pose === 'cast') { arm([[7, 17], [5.2, 21], [8, 23.6]], [7.4, 23.4]); hand(8.8, 23.6); arm([[19, 17], [21.4, 13], [20.6, 9]], [21, 10]); hand(20.6, 8); }
    if (pose === 'laugh') { arm([[7, 17], [3.6, 16], [2.6, 12.4]], [2.8, 12.6]); hand(2.6, 11); arm([[19, 17], [22.4, 16], [23.4, 12.4]], [23.2, 12.6]); hand(23.4, 11); }
    if (pose === 'drain') {
      arm([[7, 17], [5.2, 21], [8, 23.6]], [7.4, 23.4]); hand(8.8, 23.6);
      arm([[19, 17], [22.4, 19.4], [23.6, 18.6]], [22.8, 19]); G.ell(24.4, 18.2, 1.5, 1.5, 'g');
      for (const [x, y] of [[22, 13], [24, 11], [20, 12], [25, 14], [23, 23], [25, 22]]) G.set(x, y, 'z'); G.line([[24.4, 14.6], [24.2, 16]], 1, 1, 'Z');   // life energy drawn in
    }
    // hood behind the head, long pointy ears, ram horns curling round to the cheeks
    G.ell(13, 9, 6.4, 6.2, 'V');
    G.line([[9.4, 11.4], [3.4, 10.4]], 2, .6, 'g'); G.line(mir(W, [[9.4, 11.4], [3.4, 10.4]]), 2, .6, 'g');
    G.ell(13, 10, 4.2, 4.4, 'g');
    const horn = [[10, 6.6], [7, 4.4], [4.6, 6], [5, 9.2], [7.8, 10.6]];
    oline(G, horn, 2.4, 1.2, 'h'); oline(G, mir(W, horn), 2.4, 1.2, 'h');
    G.set(6, 5, 'H'); G.set(20, 5, 'H'); G.set(5, 8, 'H'); G.set(21, 8, 'H');
    G.poly([[10.6, 12], [15.4, 12], [14.6, 15.6], [11.4, 15.6]], 'l');                                    // pale snout
    G.poly([[10, 14], [16, 14], [15.4, 20], [14.2, 24.6], [13, 26], [11.8, 24.6], [10.6, 20]], 'w');    // shaggy beard to the belly
    G.set(12, 19, 'W'); G.set(14, 22, 'W'); G.set(13, 17, 'W');
    // round eyes under heavy brows: red with a slit pupil
    for (const x of [10.8, 15.2]) { G.ell(x, 10.2, 1.8, 1.7, 'k'); G.ell(x, 10.2, 1.1, 1.1, o.glow ? 'y' : 'e'); }
    if (!o.glow) { G.set(11, 10, 'k'); G.set(15, 10, 'k'); }
    G.line([[8.6, 7.8], [12.2, 8.6]], 1, 1, 'G'); G.line([[17.4, 7.8], [13.8, 8.6]], 1, 1, 'G');
    G.set(12, 13, 'G'); G.set(14, 13, 'G');                                                                  // nostrils
    if (o.mouth === 'laugh') { G.rect(11, 14, 4, 2, 'm'); G.rect(11, 14, 4, 1, 'w'); G.set(10, 14, 'k'); G.set(15, 14, 'k'); }
    else G.rect(12, 14, 2, 1, 'G');
  }, MOR_PAL, MOR_SH);
}

// ---------- gas: tallest heeter, blue skin, long pale dreadlocks, dark rings under red eyes, bone headband,
// red jacket with gold trim and long flaps over a white bodysuit, blue boots ----------
const GAS_PAL = { o: 0x0c0a16, b: 0x5a86d6, B: 0x3a5aa4, l: 0x9cbcf4, c: 0x2a8a8a, h: 0xece6f8, H: 0xa894c8, k: 0x100c18, w: 0xf6f4f8, W: 0xbcbad0, e: 0xff3030, y: 0xf2c640, Y: 0xa8841a, r: 0xc8282e, R: 0x7e161c, t: 0xe8dcc0, T: 0xa89a7a, u: 0x2a5ad8, U: 0x1a3a94, m: 0x6a1020 };
const GAS_SH = { b: 'B', h: 'H', r: 'R', w: 'W', u: 'U', t: 'T' };
function gasSpr(o = {}) {
  const W = 28, pose = o.pose || 'fold';
  return shapeSprite(W, 38, G => {
    // long dreadlocks hanging behind the head to the shoulders
    const locks = o.wild ? [[[9, 6], [5, 4], [1.6, 6]], [[9, 8], [4.4, 10], [1.4, 14]], [[9.4, 10], [6, 15], [5, 20]], [[11, 4], [8.6, 1], [5.6, 0.6]]] : [[[9, 6], [6.4, 9], [6.6, 21]], [[9, 8], [4.6, 12], [4.2, 19]], [[9.6, 10], [8.4, 14], [8.6, 18]], [[10.6, 4.6], [7.4, 6], [3, 15]]];
    for (const p of locks) { oline(G, p, 1.8, 1.4, 'h'); oline(G, mir(W, p), 2.2, 1.8, 'h'); const m = p[1]; G.set(Math.round(m[0]), Math.round(m[1]), 'H'); G.set(Math.round(W - m[0]) - 1, Math.round(m[1]), 'H'); }
    G.ell(14, 6.4, 5, 3.4, 'h');
    // white bodysuit legs, blue boots with white soles
    oline(G, [[11.6, 27], [11, 33.4]], 3.6, 3.2, 'w'); oline(G, [[16.4, 27], [17, 33.4]], 3.6, 3.2, 'w');
    G.rect(8, 33, 6, 3, 'u'); G.rect(15, 33, 6, 3, 'u'); G.rect(8, 35, 6, 1, 'w'); G.rect(15, 35, 6, 1, 'w'); G.set(10, 33, 'y'); G.set(17, 33, 'y');
    // red jacket: gold-trimmed front, the heeter crest on the chest, long flaps from the hips to below the knee
    G.poly([[8, 25], [11.4, 25], [10.4, 31], [7, 30.4]], 'r'); G.poly(mir(W, [[8, 25], [11.4, 25], [10.4, 31], [7, 30.4]]), 'r');
    G.poly([[8, 16], [20, 16], [19.4, 26.4], [8.6, 26.4]], 'r');
    G.line([[14, 16.4], [14, 26]], 1, 1, 'y'); G.rect(9, 25, 10, 1, 'y');
    G.ell(11.4, 19.4, 1.3, 1.3, 'y'); G.set(11, 19, 'r');                                                    // heeter crest
    G.rect(12, 15, 4, 2, 'w');                                                                             // bodysuit collar
    G.ell(7.2, 17.6, 2.8, 2.4, 'r'); G.ell(20.8, 17.6, 2.8, 2.4, 'r'); G.rect(5, 16, 3, 1, 'y'); G.rect(20, 16, 3, 1, 'y');
    const arm = pts => oline(G, pts, 3, 2.6, 'w');
    const fist = (x, y, r = 1.6) => G.ell(x, y, r, r, 'b');
    if (pose === 'fold') { const l = [[6, 18.6], [7.6, 21.6], [17, 21.2]], r = [[22, 18.6], [20.6, 22.8], [11, 22.6]]; G.line(l, 5, 4.6, 'o'); G.line(r, 5, 4.6, 'o'); G.line(l, 3, 2.6, 'w'); G.line(r, 3, 2.6, 'W'); fist(9.4, 21.6, 1.4); fist(18.6, 22.6, 1.4); }
    if (pose === 'punch') { arm([[6, 18.6], [4.6, 22.6], [6, 26]]); fist(6, 26.6); arm([[22, 18.6], [25.6, 19.4]]); fist(26.2, 19.4, 1.8); for (const [x, y] of [[23, 15], [23, 23]]) G.set(x, y, 'y'); }
    if (pose === 'claw') for (const f of [p => p, p => mir(W, p)]) { arm(f([[6, 18.6], [3, 21], [3.4, 16]])); const [cx, cy] = f([[3.4, 15]])[0]; fist(cx, cy, 1.6); G.set(Math.round(cx - 1), Math.round(cy - 2), 'b'); G.set(Math.round(cx + 1), Math.round(cy - 2), 'b'); }
    // head: long face, no brows or nose, pointy ears
    G.line([[9.4, 10.6], [6.4, 8.6]], 1.8, .6, 'b'); G.line(mir(W, [[9.4, 10.6], [6.4, 8.6]]), 1.8, .6, 'b');
    G.ell(14, 10.4, 4.4, 4.6, 'b'); G.poly([[9.6, 10], [18.4, 10], [17.6, 14], [15.4, 16.4], [12.6, 16.4], [10.4, 14]], 'b'); G.rect(12, 16, 4, 1, 'b');
    G.poly([[9.4, 5], [18.6, 5], [18.8, 7.6], [16.4, 6.6], [14, 7.4], [11.6, 6.6], [9.2, 7.6]], 'h');         // locks swept off the forehead
    if (o.horns) { G.rect(10, 6, 8, 2, 'b'); G.set(12, 6, 'l'); const hn = [[10, 7.4], [6.8, 9.6], [6.4, 15.6]]; oline(G, hn, 2.6, .8, 't'); oline(G, mir(W, hn), 2.6, .8, 't'); }
    else { G.rect(9, 7, 10, 1, 't'); for (const x of [10, 14, 17]) G.set(x, 7, 'T'); G.set(9, 8, 't'); G.set(18, 8, 't'); }      // bone headband
    // eyes with dark turquoise rings beneath
    G.rect(10, 10, 3, 1, 'k'); G.rect(15, 10, 3, 1, 'k');
    G.rect(11, 11, 2, 1, o.glow ? 'y' : 'w'); G.rect(15, 11, 2, 1, o.glow ? 'y' : 'w'); G.set(12, 11, 'e'); G.set(15, 11, 'e');
    G.rect(10, 12, 3, 1, 'c'); G.rect(15, 12, 3, 1, 'c');
    if (o.mouth === 'grin') { G.rect(12, 14, 4, 1, 'w'); G.set(11, 13, 'k'); G.set(16, 13, 'k'); G.rect(12, 15, 4, 1, 'm'); }
    else G.rect(13, 14, 2, 1, 'B');
  }, GAS_PAL, GAS_SH);
}

const HIT = hitSpr({ pose: 'pockets' }), GOKU_BLACK = blackSpr({ pose: 'fold' }), JIREN = jirenSpr({ pose: 'fold' }), MORO = moroSpr({ pose: 'laugh', mouth: 'laugh' }), GAS = gasSpr({ pose: 'fold' });
// fusion dance results (picked takes): gogeta, gotenks, gohan + videl, the botched fat (4 frames) and skinny ones, mr. satan's, and future gohan
const FUSED = (() => {
// fusion-dance results (gogeta, gotenks, gohan+videl, the two botched gogetas, the mr. satan gag) and future gohan — four takes each
const oline = (G, pts, w0, w1, c) => { G.line(pts, w0 + 2, w1 + 2, 'o'); G.line(pts, w0, w1, c); };
// tapering hair spikes, [base, tip] pairs, with a highlight streak down each
const spikes = (G, list, hi = 'j', b = 3.4, t = .8) => { for (const [p, q] of list) { G.line([p, q], b, t, 'h'); G.line([[p[0] + (q[0] - p[0]) * .3 - .4, p[1] + (q[1] - p[1]) * .3], [p[0] + (q[0] - p[0]) * .62 - .4, p[1] + (q[1] - p[1]) * .62]], 1, 1, hi); } };
// eyes on row Y for a face centred on the pixel boundary X
function eyes(G, X, Y, kind = 'angry', e = 'e') {
  const L = X - 3, R = X + 2, pr = (a, b, c) => { G.set(a, b, c); G.set(2 * X - 1 - a, b, c); };
  if (kind === 'angry') { pr(X - 4, Y - 2, 'k'); pr(X - 3, Y - 2, 'k'); pr(X - 3, Y - 1, 'k'); pr(X - 2, Y - 1, 'k'); G.set(L, Y, 'w'); G.set(L + 1, Y, e); G.set(R - 1, Y, e); G.set(R, Y, 'w'); }
  if (kind === 'smug') { pr(X - 4, Y - 1, 'k'); pr(X - 3, Y - 1, 'k'); pr(X - 2, Y - 1, 'k'); G.set(L, Y, 'k'); G.set(L + 1, Y, 'k'); G.set(R - 1, Y, e); G.set(R, Y, 'w'); G.set(X + 1, Y - 2, 'k'); G.set(X + 2, Y - 2, 'k'); G.set(X + 1, Y - 1, 's'); G.set(X + 2, Y - 1, 'k'); }
  if (kind === 'wink') { pr(X - 4, Y - 2, 'k'); pr(X - 3, Y - 2, 'k'); G.set(L - 1, Y, 'k'); G.set(L, Y - 1, 'k'); G.set(L + 1, Y, 'k'); G.set(R - 1, Y, e); G.set(R, Y, 'w'); G.set(R - 1, Y - 1, e); G.set(R, Y - 1, 'w'); }
  if (kind === 'shut') { pr(X - 4, Y, 'k'); pr(X - 3, Y - 1, 'k'); pr(X - 2, Y, 'k'); }
  if (kind === 'wide') { pr(X - 4, Y - 2, 'k'); pr(X - 3, Y - 2, 'k'); for (const y of [Y - 1, Y]) { G.set(L, y, 'w'); G.set(L + 1, y, e); G.set(R - 1, y, e); G.set(R, y, 'w'); } }
  if (kind === 'big') { pr(X - 4, Y - 3, 'k'); pr(X - 3, Y - 3, 'k'); for (const y of [Y - 1, Y]) { G.set(L, y, e); G.set(L + 1, y, e); G.set(R - 1, y, e); G.set(R, y, e); } G.set(L, Y - 1, 'w'); G.set(R - 1, Y - 1, 'w'); pr(X - 4, Y - 1, 'k'); }
  if (kind === 'droop') { pr(X - 4, Y - 1, 'k'); pr(X - 3, Y - 2, 'k'); pr(X - 2, Y - 2, 'k'); G.set(L, Y, 'k'); G.set(L + 1, Y, e); G.set(R - 1, Y, e); G.set(R, Y, 'k'); pr(X - 3, Y + 1, 'S'); }
  if (kind === 'dot') { pr(X - 3, Y - 2, 'k'); pr(X - 2, Y - 2, 'k'); pr(X - 3, Y, e); }
}
function mouth(G, X, Y, kind = 'smirk') {
  if (kind === 'smirk') { G.set(X - 2, Y, 'k'); G.set(X - 1, Y, 'k'); G.set(X, Y, 'k'); G.set(X + 1, Y - 1, 'k'); }
  if (kind === 'flat') { G.set(X - 1, Y, 'k'); G.set(X, Y, 'k'); }
  if (kind === 'grin') { G.rect(X - 2, Y, 4, 1, 'w'); G.set(X - 3, Y - 1, 'k'); G.set(X + 2, Y - 1, 'k'); G.rect(X - 2, Y + 1, 4, 1, 'k'); }
  if (kind === 'yell') { G.rect(X - 2, Y, 4, 2, 'm'); G.rect(X - 2, Y, 4, 1, 'w'); }
  if (kind === 'o') { G.rect(X - 1, Y, 2, 2, 'm'); }
  if (kind === 'tongue') { G.rect(X - 2, Y, 4, 1, 'k'); G.set(X - 3, Y - 1, 'k'); G.set(X + 2, Y - 1, 'k'); G.rect(X, Y + 1, 2, 1, 'r'); }
  if (kind === 'wobble') { G.set(X - 2, Y + 1, 'k'); G.set(X - 1, Y, 'k'); G.set(X, Y + 1, 'k'); G.set(X + 1, Y, 'k'); }
}
// an arm from a shoulder, mirrored by side (-1 viewer's left, +1 right) about the pixel boundary X
const arm = (G, X, Y, side, pts, hand, c = 's', w = 2.6, hc = c) => { const m = ([a, b]) => [X + side * a, Y + b]; oline(G, pts.map(m), w, w - .3, c); if (hand) { const [hx, hy] = m(hand); G.ell(hx, hy, 1.6, 1.6, hc); } };
const ARM = {
  hang: [[[6, 1.6], [7, 5], [7, 8.4]], [7, 9.4]],
  hip: [[[6, 1.6], [8.6, 4.6], [5.8, 7.2]], [5.6, 7.6]],
  up: [[[6, 1.6], [8.4, -1.6], [8.6, -5]], [8.6, -6]],
  flex: [[[6, 1.4], [9.8, 1.8], [10.4, -2.4]], [10.4, -3.4]],
  punch: [[[6, 1.8], [9.6, 2.6], [13.4, 2.4]], [14.2, 2.4]],
};
const ball = (G, x, y, r, a = 'x', b = 'X') => { G.ell(x, y, r, r, a); G.ell(x - r * .15, y - r * .15, r * .55, r * .55, b); };
// paints dy rows lower, so overhead poses get headroom without moving every coordinate
const dn = (G, dy) => { const m = p => p.map(([x, y]) => [x, y + dy]); return { ell: (x, y, a, b, c) => G.ell(x, y + dy, a, b, c), rect: (x, y, w, h, c) => G.rect(x, y + dy, w, h, c), poly: (p, c) => G.poly(m(p), c), line: (p, a, b, c) => G.line(m(p), a, b, c), set: (x, y, c) => G.set(x, y + dy, c) }; };
// arms folded: the lower forearm in shade, the upper one rimmed so the two bars read apart
const fold = (G, X, Y, sh = 6, w = 2.4) => { oline(G, [[X + sh, Y + 2], [X + sh - .8, Y + 6.2], [X - 3, Y + 6.2]], w, w, 'S'); oline(G, [[X - sh, Y + 2], [X - sh + .6, Y + 3.4], [X + 3, Y + 3.2]], w, w, 's'); };

/* ---------- the metamoran fusion vest, shared by every fusion ---------- */
// Y = top row of the torso; stance 'stand' | 'wide'
function vestBody(G, X, Y, o = {}) {
  const wd = o.wide ? 1.4 : 0;
  G.poly([[X - 5.4, Y + 8], [X + 5.4, Y + 8], [X + 6.6 + wd, Y + 13], [X + 5.2 + wd, Y + 15], [X + 1.2 + wd * .5, Y + 15], [X, Y + 11.6], [X - 1.2 - wd * .5, Y + 15], [X - 5.2 - wd, Y + 15], [X - 6.6 - wd, Y + 13]], 'p');
  G.line([[X - 3, Y + 10], [X - 3.6 - wd, Y + 14]], 1, 1, 'P'); G.line([[X + 3, Y + 10], [X + 3.6 + wd, Y + 14]], 1, 1, 'P');
  for (const x of [X - 5.6 - wd, X + 1.6 + wd]) { G.poly([[x, Y + 14.6], [x + 4, Y + 14.6], [x + 4.2, Y + 17.6], [x - .2, Y + 17.6]], 'b'); G.rect(Math.round(x + .6), Y + 15, 3, 1, 'B'); }
  G.poly([[X - 5.6, Y], [X + 5.6, Y], [X + 5, Y + 8], [X - 5, Y + 8]], 'v');
  G.poly([[X - 2.4, Y - .4], [X + 2.4, Y - .4], [X, Y + 3.6]], 's');
  G.rect(X - 5, Y + 7, 10, 2, 'c'); G.poly([[X + 1.6, Y + 8], [X + 4.2, Y + 8], [X + 4, Y + 12.6], [X + 2.4, Y + 11.6]], 'c');
  G.rect(X - 2, Y - 1, 4, 2, 's');
}
// shoulder pads and padded collar go on after the arms so bare arms come out from under them
function vestPads(G, X, Y) {
  G.line([[X - 3, Y - .4], [X, Y + 3.6], [X + 3, Y - .4]], 1, 1, 'y');
  for (const s of [-1, 1]) { G.ell(X + s * 5.6, Y + 1, 2.3, 1.5, 'y'); G.set(X + s * 5.6 - (s < 0 ? 1 : 0), Y + 1, 'Y'); }
}

/* ---------- gogeta ---------- */
const GOG = { o: 0x0c0a18, h: 0x1c1a28, H: 0x0f0e18, j: 0x3e3e62, s: 0xf6c8a0, S: 0xc48c66, k: 0x120c18, w: 0xffffff, W: 0xc8ccd8, e: 0x120c18, m: 0x9a2a2a, r: 0xe0505a, v: 0x283a7a, V: 0x18244e, y: 0xf4a832, Y: 0xb87418, p: 0xf6f4ee, P: 0xc4c2cc, c: 0x58d0ec, C: 0x2a88b0, b: 0x1c1c24, B: 0x3a3a48, x: 0x6ac8ff, X: 0xeefaff };
const GOG_SSJ = { ...GOG, h: 0xf8d43a, H: 0xc8961a, j: 0xfff4a8, e: 0x1fa088, o: 0x1a1008 };
const GOG_SH = { h: 'H', v: 'V', y: 'Y', p: 'P', c: 'C' };
function gogHead(G, X, T, o = {}) {
  G.poly([[X - 5.4, T + 14], [X - 5.8, T + 8], [X - 4, T + 4.4], [X, T + 3.4], [X + 4, T + 4.4], [X + 5.8, T + 8], [X + 5.4, T + 14]], 'h');
  spikes(G, [[[X - 1, T + 6], [X - 2.6, T]], [[X + 1.6, T + 6], [X + 3.2, T + .2]], [[X - 3, T + 7], [X - 7.6, T + 1.6]], [[X + 3.6, T + 7], [X + 8.2, T + 2.2]], [[X - 4, T + 9], [X - 9.8, T + 6.6]], [[X + 4.2, T + 9], [X + 10, T + 7.6]], [[X - 4.6, T + 11], [X - 8.6, T + 12.8]]]);
  G.ell(X, T + 10.4, 4.3, 4.3, 's'); G.poly([[X - 4.4, T + 10], [X + 4.4, T + 10], [X + 4.2, T + 13.4], [X + 2.4, T + 15.2], [X - 2.4, T + 15.2], [X - 4.2, T + 13.4]], 's');
  G.poly([[X - 5, T + 4.5], [X + 5, T + 4.5], [X + 5, T + 10], [X + 3.8, T + 7.4], [X + 1.6, T + 8.2], [X + .2, T + 6.8], [X - 1.8, T + 8.4], [X - 3.8, T + 7.4], [X - 5, T + 10]], 'h');
  G.line([[X - .6, T + 7], [X - 1.4, T + 10]], 1.6, .8, 'h');                                  // the single loose bang
  eyes(G, X, T + 11, o.eyes || 'angry'); G.set(X, T + 12, 'S'); mouth(G, X, T + 13, o.mouth || 'smirk');
}
function gogeta(o) {
  const W = o.w || 26, X = o.x || 13;
  return shapeSprite(W, 34, G => {
    if (o.pre) o.pre(G, X);
    vestBody(G, X, 15, o);
    o.arms(G, X, 15);
    vestPads(G, X, 15);
    gogHead(G, X, 0, o);
    if (o.post) o.post(G, X);
  }, o.ssj ? GOG_SSJ : GOG, GOG_SH);
}
// A: base form, fists on hips, confident smirk
const GOGETA = gogeta({ arms: (G, X, Y) => { arm(G, X, Y, -1, ...ARM.hip); arm(G, X, Y, 1, ...ARM.hip); } });
// B: base form, straight punch out to the side, teeth bared
const GTK = { ...GOG, h: 0x3e2468, H: 0x281646, j: 0x7a5ab8, l: 0xbca6ee, L: 0x8a72c4, g: 0xf4f4ff, G: 0xb8b8d8, n: 0xf2d24a, N: 0xc89a1a };
const GTK_SH = { ...GOG_SH, l: 'L', g: 'G', n: 'N' };
function gtkHead(G, X, T, o = {}) {
  G.poly([[X - 5, T + 12], [X - 5.4, T + 7], [X - 3.6, T + 4], [X, T + 3.2], [X + 3.6, T + 4], [X + 5.4, T + 7], [X + 5, T + 12]], 'h');
  spikes(G, [[[X - .6, T + 6], [X - 1.4, T]], [[X + 1.8, T + 6], [X + 3.6, T + .6]], [[X - 2.8, T + 7], [X - 6.4, T + 1.8]], [[X + 3.6, T + 7], [X + 7.6, T + 2.8]], [[X - 4, T + 9], [X - 8.4, T + 6.6]], [[X + 4.2, T + 9], [X + 8.6, T + 7.4]]]);
  G.ell(X, T + 9.6, 4.1, 4, 's'); G.poly([[X - 4.2, T + 9], [X + 4.2, T + 9], [X + 3.8, T + 12.4], [X + 2, T + 13.8], [X - 2, T + 13.8], [X - 3.8, T + 12.4]], 's');
  // lavender trunks-style fringe, parted, over the dark spikes
  G.poly([[X - 4.6, T + 4.4], [X + 4.6, T + 4.4], [X + 4.8, T + 9.6], [X + 3.4, T + 7], [X + 1.4, T + 8], [X, T + 6.4], [X - 1.6, T + 8], [X - 3.4, T + 7], [X - 4.8, T + 9.6]], 'l');
  G.set(X - 2, T + 5, 'L'); G.set(X + 2, T + 6, 'L');
  eyes(G, X, T + 10, o.eyes || 'angry'); mouth(G, X, T + 12, o.mouth || 'smirk');
}
// kid-sized vest body, Y = top of the torso
function gtkBody(G, X, Y) {
  G.poly([[X - 4.4, Y + 6], [X + 4.4, Y + 6], [X + 5.4, Y + 9.4], [X + .8, Y + 9.4], [X, Y + 8], [X - .8, Y + 9.4], [X - 5.4, Y + 9.4]], 'p');
  for (const x of [X - 5.2, X + 1.4]) { G.poly([[x, Y + 9.2], [x + 3.8, Y + 9.2], [x + 4, Y + 11.6], [x - .2, Y + 11.6]], 'b'); }
  G.poly([[X - 4.4, Y], [X + 4.4, Y], [X + 4, Y + 6.4], [X - 4, Y + 6.4]], 'v');
  G.poly([[X - 2, Y - .4], [X + 2, Y - .4], [X, Y + 2.6]], 's');
  G.rect(X - 4, Y + 5, 8, 2, 'c'); G.poly([[X + 1.4, Y + 6], [X + 3.6, Y + 6], [X + 3.4, Y + 9.4], [X + 2, Y + 8.6]], 'c');
}
const gtkPads = (G, X, Y) => { G.line([[X - 2.6, Y - .2], [X, Y + 2.8], [X + 2.6, Y - .2]], 1.2, 1.2, 'y'); for (const s of [-1, 1]) G.ell(X + s * 4.6, Y + 1, 2, 1.6, 'y'); };
const KA = {   // kid arms, from the shoulder at (4.8, 1.2)
  hip: [[[4.8, 1.4], [6.8, 3.6], [4.6, 5.4]], [4.4, 5.6]],
  up: [[[4.8, 1.2], [6.6, -1.4], [6.8, -4.4]], [6.8, -5.2]],
  fwd: [[[4.8, 1.4], [7.6, 2.4], [9.8, 2]], [10.6, 2]],
};
const karm = (G, X, Y, s, [p, h]) => arm(G, X, Y, s, p, h, 's', 2.2);
function gotenks(o) {
  const W = o.w || 22, X = o.x || 11, H = 28 + (o.dy || 0);
  return shapeSprite(W, H, G0 => {
    const G = dn(G0, o.dy || 0);
    if (o.pre) o.pre(G, X);
    gtkBody(G, X, 14); o.arms(G, X, 14); gtkPads(G, X, 14); gtkHead(G, X, 0, o);
    if (o.post) o.post(G, X);
  }, GTK, GTK_SH);
}
// A: smug, hands laced behind his head, elbows out
const GOTENKS = gotenks({ eyes: 'smug', arms: (G, X, Y) => { for (const s of [-1, 1]) arm(G, X, Y, s, [[4.8, 1.2], [7.6, -3], [4.4, -6]], null, 's', 2.2); } });
// B: victory: fist punched to the sky, other on his hip, tongue out
const GV = { ...GOG, e: 0x2a5ad0, n: 0xe0404a, N: 0x9a2028, q: 0xf4a0a0 };
function gvHead(G, X, T, o = {}) {
  // videl's pigtails: two short black tails from behind the ears, red ties
  for (const s of [-1, 1]) { const sw = o.swing || 0; G.line([[X + s * 4.6, T + 11], [X + s * 6.8 + sw, T + 14.4], [X + s * 6.6 + sw * 1.6, T + 19]], 3, 1.2, 'h'); G.rect(X + (s < 0 ? -7 : 6) + Math.round(s * sw), T + 14, 2, 1, 'n'); }
  G.poly([[X - 5.2, T + 12], [X - 5.6, T + 7], [X - 3.8, T + 4.2], [X, T + 3.6], [X + 3.8, T + 4.2], [X + 5.6, T + 7], [X + 5.2, T + 12]], 'h');
  // gohan's short buu-saga cut: a few short spikes and one forelock
  spikes(G, [[[X - 1.2, T + 6], [X - 2.4, T + 1.2]], [[X + 1.4, T + 6], [X + 3.2, T + 1.6]], [[X - 3.4, T + 7], [X - 7, T + 3.6]], [[X + 3.6, T + 7], [X + 7.4, T + 4.2]]]);
  G.ell(X, T + 10.4, 4.2, 4.3, 's'); G.poly([[X - 4.3, T + 10], [X + 4.3, T + 10], [X + 4, T + 13.2], [X + 2.2, T + 15], [X - 2.2, T + 15], [X - 4, T + 13.2]], 's');
  G.poly([[X - 4.8, T + 4.6], [X + 4.8, T + 4.6], [X + 4.8, T + 9.6], [X + 3, T + 7.6], [X + .6, T + 8], [X - 1.4, T + 7.2], [X - 3.2, T + 8], [X - 4.8, T + 9.6]], 'h');
  G.line([[X + .4, T + 7.4], [X + 1, T + 9.6]], 1.4, .8, 'h');
  eyes(G, X, T + 11, o.eyes || 'big'); G.set(X - 4, T + 13, 'q'); G.set(X + 3, T + 13, 'q'); mouth(G, X, T + 13, o.mouth || 'smirk');
}
function gohanVidel(o) {
  const W = o.w || 26, X = o.x || 13;
  return shapeSprite(W, 34 + (o.dy || 0), G0 => {
    const G = dn(G0, o.dy || 0);
    if (o.pre) o.pre(G, X);
    vestBody(G, X, 15, o); o.arms(G, X, 15); vestPads(G, X, 15); gvHead(G, X, 0, o);
    if (o.post) o.post(G, X);
  }, GV, GOG_SH);
}
// A: videl's pose: hand on hip, peace sign up by the face, pigtails swinging
const GOHANVIDEL = gohanVidel({ eyes: 'wink', mouth: 'grin', swing: .8, arms: (G, X, Y) => { arm(G, X, Y, -1, ...ARM.hip); arm(G, X, Y, 1, [[6, 1.6], [8.6, -1], [9, -4]], [9, -4.6]); G.rect(X + 8, Y - 9, 1, 3, 's'); G.rect(X + 10, Y - 9, 1, 3, 's'); } });
// B: masenko: both palms stacked over the head, golden ki crackling above
const VK = { ...GOG, z: 0x9ac850, Z: 0x6a9a30, d: 0x9fdcff };
const VK_SH = { ...GOG_SH, z: 'Z' };
function vekuHead(G, X, T, o = {}) {
  G.poly([[X - 5, T + 10], [X - 5.2, T + 6], [X - 3.4, T + 3.6], [X, T + 3], [X + 3.4, T + 3.6], [X + 5.2, T + 6], [X + 5, T + 10]], 'h');
  spikes(G, [[[X - 1, T + 5], [X - 2, T + .4]], [[X + 1.6, T + 5], [X + 3, T + .8]], [[X - 3, T + 6], [X - 6.6, T + 2.4]], [[X + 3.4, T + 6], [X + 7, T + 3]]], 'j', 3, .8);
  G.ell(X, T + 10.4, 5.6, 4.8, 's');                                                         // round face, jowls
  G.poly([[X - 4.6, T + 4.6], [X + 4.6, T + 4.6], [X + 4.6, T + 8.6], [X + 2.8, T + 7], [X, T + 7.8], [X - 2.8, T + 7], [X - 4.6, T + 8.6]], 'h');
  G.set(X - 5, T + 12, 'r'); G.set(X + 4, T + 12, 'r');                                    // flushed cheeks
  eyes(G, X, T + 10, o.eyes || 'dot'); G.set(X, T + 11, 'S'); mouth(G, X, T + 13, o.mouth || 'grin');
}
// a round belly squeezed into the vest; Y = top of torso
function vekuBody(G, X, Y) {
  G.poly([[X - 6, Y + 9], [X + 6, Y + 9], [X + 6.6, Y + 11.4], [X + .8, Y + 11.4], [X, Y + 10.4], [X - .8, Y + 11.4], [X - 6.6, Y + 11.4]], 'p');
  for (const x of [X - 6.6, X + 1.6]) G.poly([[x, Y + 11.2], [x + 5, Y + 11.2], [x + 5, Y + 13.6], [x, Y + 13.6]], 'b');
  G.ell(X, Y + 5, 10.4, 6.4, 'v');
  G.ell(X, Y + 6.6, 5.8, 3.8, 's'); G.set(X, Y + 7, 'S'); G.line([[X - 4, Y + 4.2], [X - 1, Y + 3.4]], 1, 1, 'S');   // belly bursting out the front, navel
  G.rect(X - 6, Y + 9, 12, 2, 'c'); G.poly([[X + 2.6, Y + 10], [X + 5, Y + 10], [X + 4.6, Y + 13], [X + 3, Y + 12.4]], 'c');
  G.rect(X - 2, Y - 1, 4, 2, 's');
}
const vekuPads = (G, X, Y) => { for (const s of [-1, 1]) G.ell(X + s * 7.4, Y + .8, 2.6, 1.8, 'y'); G.line([[X - 3.4, Y - .4], [X, Y + 1.4], [X + 3.4, Y - .4]], 1.2, 1.2, 'y'); };
function veku(o) {
  const W = o.w || 30, X = o.x || 15;
  return shapeSprite(W, 30, G => {
    if (o.pre) o.pre(G, X);
    vekuBody(G, X, 15); o.arms(G, X, 15); vekuPads(G, X, 15); vekuHead(G, X, 0, o);
    if (o.post) o.post(G, X);
  }, VK, VK_SH);
}
const stub = (G, X, Y, s, pts, hand) => arm(G, X, Y, s, pts, hand, 's', 3.2);
// A: a wobbly double-biceps flex that makes no muscle at all
const FATGOGETA_A = veku({ eyes: 'shut', mouth: 'grin', arms: (G, X, Y) => { for (const s of [-1, 1]) stub(G, X, Y, s, [[8, 1.4], [11, .6], [11.6, -2.6]], [11.6, -3.2]); } });
// B: attacking: a stubby punch, cheeks puffed, sweat flying
const FATGOGETA_B = veku({ w: 34, x: 14, eyes: 'angry', mouth: 'o', arms: (G, X, Y) => { stub(G, X, Y, -1, [[8, 1.6], [10.4, 4.4]], [10.4, 5.4]); stub(G, X, Y, 1, [[8, 2], [12, 2.6], [15.4, 2]], [16.2, 2]); }, post: (G, X) => { G.rect(X - 8, 3, 1, 2, 'd'); G.set(X - 9, 5, 'd'); G.set(X + 18, -1 + 15, 'W'); G.set(X + 18, 3 + 15, 'W'); } });
// C: smug, patting his belly, eyes shut, pleased with himself
const FATGOGETA_C = veku({ eyes: 'smug', mouth: 'smirk', arms: (G, X, Y) => { stub(G, X, Y, -1, [[8, 1.6], [8, 5], [4, 6.6]], [3.4, 6.6]); stub(G, X, Y, 1, [[8, 1.6], [9.6, 4.6], [7.6, 7.4]], [7, 7.6]); } });
// D: his one technique: a green cloud of gas, hands on knees, blushing
const FATGOGETA_D = veku({ w: 36, x: 20, eyes: 'shut', mouth: 'wobble', pre: (G, X) => { for (const [x, y, r] of [[-11, 21, 3.6], [-14, 17, 3], [-15.6, 23, 3.2], [-12, 26, 2.4], [-17.4, 19, 2]]) G.ell(X + x, y, r, r * .9, 'z'); G.set(X - 14, 20, 'Z'); G.set(X - 12, 24, 'Z'); }, arms: (G, X, Y) => { stub(G, X, Y, -1, ...[[[8, 1.6], [9.6, 6], [7.6, 10]], [7.4, 10.4]]); stub(G, X, Y, 1, [[8, 1.6], [9.6, 6], [7.6, 10]], [7.4, 10.4]); }, post: (G, X) => { G.rect(X + 6, 2, 1, 2, 'd'); G.set(X + 7, 4, 'd'); } });

/* ---------- the skinny, old-looking botched gogeta ---------- */
const SK = { ...GOG, h: 0x3a3844, H: 0x24222c, j: 0xa8a8b6, s: 0xe8bc96, S: 0xb08462, d: 0x9fdcff };
function skHead(G, X, T, o = {}) {
  // thin, wiry gogeta spikes gone grey at the streaks
  G.poly([[X - 4.2, T + 10], [X - 4.6, T + 6], [X - 3.2, T + 3.6], [X, T + 3], [X + 3.2, T + 3.6], [X + 4.6, T + 6], [X + 4.2, T + 10]], 'h');
  spikes(G, [[[X - .8, T + 5], [X - 2, T]], [[X + 1.4, T + 5], [X + 3, T + .4]], [[X - 3, T + 6], [X - 7, T + 2.6]], [[X + 3.4, T + 6], [X + 7.4, T + 3.2]], [[X - 3.8, T + 8], [X - 7.6, T + 7.4]], [[X + 3.8, T + 8], [X + 7.4, T + 8.6]]], 'j', 2.6, .6);
  G.ell(X, T + 10.4, 4.2, 4.2, 's'); G.poly([[X - 4, T + 10], [X + 4, T + 10], [X + 2.8, T + 14.6], [X + 1, T + 15.8], [X - 1, T + 15.8], [X - 2.8, T + 14.6]], 's');   // long face, pointed chin
  G.poly([[X - 4.2, T + 4.6], [X + 4.2, T + 4.6], [X + 4, T + 8.4], [X + 2, T + 7], [X, T + 7.6], [X - 2, T + 7], [X - 4, T + 8.4]], 'h');
  G.set(X - 3, T + 13, 'S'); G.set(X + 2, T + 13, 'S'); G.set(X - 2, T + 14, 'S'); G.set(X + 1, T + 14, 'S');   // hollow cheeks
  eyes(G, X, T + 11, o.eyes || 'droop'); mouth(G, X, T + 14, o.mouth || 'wobble');
}
function skinny(o) {
  const W = o.w || 20, X = o.x || 10;
  return shapeSprite(W, 34, G => {
    const Y = 16;
    if (o.pre) o.pre(G, X);
    // baggy trousers hanging off stick legs, big boots
    G.poly([[X - 3.4, Y + 7], [X + 3.4, Y + 7], [X + 5, Y + 13], [X + 3.6, Y + 14.6], [X + .8, Y + 14.6], [X, Y + 11], [X - .8, Y + 14.6], [X - 3.6, Y + 14.6], [X - 5, Y + 13]], 'p');
    G.line([[X - 2.4, Y + 9], [X - 3, Y + 13]], 1, 1, 'P'); G.line([[X + 2.4, Y + 9], [X + 3, Y + 13]], 1, 1, 'P');
    for (const x of [X - 5, X + 1]) G.poly([[x, Y + 14.4], [x + 4, Y + 14.4], [x + 4.2, Y + 16.6], [x - .2, Y + 16.6]], 'b');
    // a vest hanging loose off a bony chest: ribs show in the V
    G.poly([[X - 4, Y], [X + 4, Y], [X + 3.4, Y + 7.6], [X - 3.4, Y + 7.6]], 'v');
    G.poly([[X - 2.2, Y - .4], [X + 2.2, Y - .4], [X, Y + 4.6]], 's'); G.set(X - 1, Y + 1, 'S'); G.set(X, Y + 1, 'S'); G.set(X - 1, Y + 3, 'S');
    G.rect(X - 4, Y + 6, 8, 2, 'c'); G.poly([[X + 1, Y + 7], [X + 3, Y + 7], [X + 2.4, Y + 12.4], [X + 1.4, Y + 11.4]], 'c');
    G.rect(X - 1, Y - 1, 2, 2, 's');
    o.arms(G, X, Y);
    G.line([[X - 2.4, Y - .4], [X, Y + 4.6], [X + 2.4, Y - .4]], 1, 1, 'y');
    for (const s of [-1, 1]) G.ell(X + s * 4.4, Y + 1.6, 1.7, 1.2, 'y');                   // pads slipping down sloped shoulders
    skHead(G, X, 0, o);
    if (o.post) o.post(G, X);
  }, SK, GOG_SH);
}
const thin = (G, X, Y, s, pts, hand) => arm(G, X, Y, s, pts, hand, 's', 1.4);
// A: trying to flex, a trembling twig of an arm and a nervous wobbly smile
const SKINNYGOGETA = skinny({ eyes: 'shut', mouth: 'o', arms: (G, X, Y) => { for (const s of [-1, 1]) thin(G, X, Y, s, [[4.8, 2], [6.4, 7], [4.6, 11]], [4.4, 11.6]); }, post: (G, X) => { G.rect(X - 8, 3, 1, 2, 'd'); G.set(X - 9, 5, 'd'); G.rect(X + 7, 2, 1, 2, 'd'); G.set(X + 8, 4, 'd'); } });

/* ---------- mr. satan fusion (gag) ---------- */
const SF = { ...GOG, h: 0x15141e, H: 0x0c0b12, a: 0x3a2414, A: 0x1a0e06, s: 0xdca868, S: 0xa87436, u: 0x5e3e24, t: 0xffffff, n: 0xf2c440, N: 0xb8861a, R: 0xc8241e };
const SF_SH = { ...GOG_SH, a: 'A', n: 'N' };
function sfHead(G, X, o = {}) {
  // satan's afro with two gogeta spikes bursting out of the top
  G.ell(X, 7, 7, 4.8, 'a');
  for (const [i, j] of [[-7, 9], [-7.4, 6], [-5.6, 3.4], [-2.6, 2.4], [2.6, 2.4], [5.6, 3.4], [7.4, 6], [7, 9], [-6, 11], [6, 11]]) G.ell(X + i, j, 2, 1.8, 'a');
  for (const [i, j] of [[-6, 5], [-3, 3], [3, 4], [5, 7], [-5, 8], [6, 10], [-7, 10]]) { G.set(X + i, j, 'u'); G.set(X + i + 1, j - 1, 'u'); }
  for (const pts of [[[X - 1.6, 4], [X - 3.4, -1.8]], [[X + 1.8, 4], [X + 4.6, -1.4]], [[X - 4.6, 4.6], [X - 9, 0]]]) { G.line(pts, 3.6, .8, 'o'); G.line(pts, 2.4, .6, 'a'); G.line([pts[0], [(pts[0][0] + pts[1][0]) / 2, (pts[0][1] + pts[1][1]) / 2]], 1, 1, 'u'); }   // gogeta spikes bursting out the top
  G.ell(X, 11, 3.8, 3.6, 's');
  eyes(G, X, 10, o.eyes || 'angry'); G.set(X, 11, 'S');
  G.rect(X - 3, 12, 6, 1, 'k'); G.set(X - 4, 13, 'k'); G.set(X + 3, 13, 'k');                    // the moustache
  if (o.mouth === 'laugh') { G.rect(X - 2, 13, 4, 2, 'm'); G.rect(X - 2, 13, 4, 1, 't'); }
  else { G.rect(X - 2, 13, 4, 1, 't'); }
  G.rect(X - 2, 14 + (o.mouth === 'laugh' ? 1 : 0), 4, 1, 'a');                                  // chin tuft
}
function satanFusion(o) {
  const W = o.w || 26, X = o.x || 13;
  return shapeSprite(W, 37, G0 => {
    const G = dn(G0, 2);
    if (o.pre) o.pre(G, X);
    vestBody(G, X, 16, o); G.rect(X - 1, 23, 2, 2, 'n'); o.arms(G, X, 16); vestPads(G, X, 16); sfHead(G, X, o);
    if (o.post) o.post(G, X);
  }, SF, SF_SH);
}
// A: champion's double biceps, roaring laugh
const SATANFUSION = satanFusion({ w: 30, x: 15, mouth: 'laugh', eyes: 'shut', arms: (G, X, Y) => { for (const s of [-1, 1]) { arm(G, X, Y, s, ...ARM.flex); G.ell(X + s * 8.6, Y + .8, 1.8, 1.4, 's'); } } });
// B: attacking: "dynamite kick" turned punch, fist thrown out, teeth gritted
const FG = { o: 0x120a06, h: 0x1c1a28, H: 0x0f0e18, j: 0x3e3e62, s: 0xf2c49c, S: 0xbc8862, k: 0x120c18, w: 0xffffff, W: 0xc8ccd8, e: 0x120c18, m: 0x9a2a2a, q: 0xc86a5a, g: 0xf08a24, G: 0xc0641a, u: 0x2b4fc8, U: 0x1c3584, b: 0x1c2a5a, B: 0x101a3a, y: 0xf2c84a, x: 0xfff27a, X: 0xffffff };
const FG_SSJ = { ...FG, h: 0xf8d43a, H: 0xc8961a, j: 0xfff4a8, e: 0x1fa088 };
const FG_SH = { h: 'H', g: 'G', u: 'U', b: 'B' };
function fgHead(G, X, T, o = {}) {
  G.poly([[X - 5.2, T + 13], [X - 5.6, T + 7], [X - 3.8, T + 4], [X, T + 3.2], [X + 3.8, T + 4], [X + 5.6, T + 7], [X + 5.2, T + 13]], 'h');
  const tall = o.ssj ? -1.6 : 0;
  spikes(G, [[[X - 1, T + 6], [X - 1.8, T + .4 + tall]], [[X + 1.6, T + 6], [X + 3.6, T + .6 + tall]], [[X - 3, T + 7], [X - 7, T + 2.4 + tall]], [[X + 3.6, T + 7], [X + 7.6, T + 3 + tall]], [[X - 4, T + 9], [X - 8.6, T + 8.4]], [[X + 4.2, T + 9], [X + 8.6, T + 9.6]]]);
  G.ell(X, T + 10.4, 4.2, 4.4, 's'); G.poly([[X - 4.3, T + 10], [X + 4.3, T + 10], [X + 4.2, T + 13.6], [X + 2.4, T + 15.4], [X - 2.4, T + 15.4], [X - 4.2, T + 13.6]], 's');
  G.poly([[X - 5, T + 4.5], [X + 5, T + 4.5], [X + 5, T + 9.4], [X + 3.4, T + 7.6], [X + 1.4, T + 8.6], [X - .4, T + 7], [X - 2.4, T + 8.4], [X - 4, T + 7.4], [X - 5, T + 9.6]], 'h');
  eyes(G, X, T + 11, o.eyes || 'angry'); G.set(X, T + 12, 'S'); mouth(G, X, T + 13, o.mouth || 'flat');
  G.line([[X + 3, T + 8.4], [X + 1.4, T + 13.6]], 1, 1, 'q');                                 // the scar down over his left eye
}
function futureGohan(o) {
  const W = o.w || 24, X = o.x || 12, Y = 15;
  return shapeSprite(W, 34, G => {
    if (o.pre) o.pre(G, X);
    // orange gi trousers, navy boots with gold trim
    G.poly([[X - 5, Y + 8], [X + 5, Y + 8], [X + 6.2, Y + 13], [X + 5, Y + 15], [X + 1.2, Y + 15], [X, Y + 11.6], [X - 1.2, Y + 15], [X - 5, Y + 15], [X - 6.2, Y + 13]], 'g');
    for (const x of [X - 5.4, X + 1.4]) { G.poly([[x, Y + 14.6], [x + 4, Y + 14.6], [x + 4.2, Y + 17.6], [x - .2, Y + 17.6]], 'b'); G.rect(Math.round(x), Y + 15, 4, 1, 'y'); }
    G.poly([[X - 5.6, Y], [X + 5.6, Y], [X + 5, Y + 8.4], [X - 5, Y + 8.4]], 'g');
    G.poly([[X - 2.8, Y - .4], [X + 2.8, Y - .4], [X, Y + 3.6]], 'u'); G.rect(X - 1, Y - 1, 2, 2, 's');   // blue undershirt in the V
    G.line([[X - 3, Y - .2], [X - .2, Y + 4.6]], 1, 1, 'G');
    G.rect(X - 5, Y + 7, 10, 2, 'u'); G.poly([[X - 3.4, Y + 8], [X - 1.4, Y + 8], [X - 1.8, Y + 11.6], [X - 3.4, Y + 11]], 'u');   // blue belt, knot tails
    // the empty left sleeve: a short stump, pinned flat
    G.ell(X + 6.2, Y + 2.2, 2.4, 2.6, 'g'); G.line([[X + 6.6, Y + 3], [X + 6, Y + 5.6]], 1.8, 1.4, 'G');
    o.arms(G, X, Y);
    fgHead(G, X, 0, o);
    if (o.post) o.post(G, X);
  }, o.ssj ? FG_SSJ : FG, FG_SH);
}
// his one arm: long orange sleeve, blue wristband, bare hand
const fgArm = (G, X, Y, pts, hand) => { const P = pts.map(([a, b]) => [X - a, Y + b]); oline(G, P, 2.8, 2.6, 'g'); const n = P.length, [ax, ay] = P[n - 1], [bx, by] = P[n - 2]; const t = 1.6 / Math.hypot(ax - bx, ay - by); G.line([[ax - (ax - bx) * t, ay - (ay - by) * t], [ax, ay]], 2.8, 2.8, 'u'); G.ell(X - hand[0], Y + hand[1], 1.7, 1.7, 's'); };
// A: standing guard, fist clenched at his side, stern
const FUTUREGOHAN = futureGohan({ arms: (G, X, Y) => fgArm(G, X, Y, [[6, 1.6], [7.2, 5], [7.2, 8.4]], [7.2, 9.4]) });
// B: a one-handed masenko, palm thrust out, golden blast
return { gogeta: GOGETA, gotenks: GOTENKS, gohanVidel: GOHANVIDEL, fat: [FATGOGETA_A, FATGOGETA_B, FATGOGETA_C, FATGOGETA_D], skinny: SKINNYGOGETA, satan: SATANFUSION, futureGohan: FUTUREGOHAN };
})();
// whis, chi-chi, umigame and oolong (picked takes), each standing on their own world
const NPCS = (() => {
// friends, round 3: whis, chi-chi, umigame and oolong — four takes each, chibi gba-era proportions
// an arm stroke with its own outline so it separates from the torso behind it
const limb = (G, pts, w0, w1, c) => { G.line(pts, w0 + 1.4, w1 + 1.4, 'o'); G.line(pts, w0, w1, c); };
const shift = (G, dx, dy) => { const m = p => p.map(([x, y]) => [x + dx, y + dy]); return { ell: (x, y, a, b, c) => G.ell(x + dx, y + dy, a, b, c), rect: (x, y, w, h, c) => G.rect(x + dx, y + dy, w, h, c), poly: (p, c) => G.poly(m(p), c), line: (p, a, b, c) => G.line(m(p), a, b, c), set: (x, y, c) => G.set(x + dx, y + dy, c) }; };

/* ---------- whis ---------- */
const WP = { o: 0x16121e, h: 0xf4f4fa, H: 0xbcc0d4, s: 0xb4c8ec, S: 0x8298c8, k: 0x1a1428, v: 0x8a4ab8, r: 0x8e2a52, R: 0x5c1634, a: 0x22202c, w: 0xf6f6f2, W: 0xc8c8d0, y: 0xf08a2a, Y: 0xb85a14, c: 0x7ae0f4, C: 0x3a9ac4, n: 0x4a4658, b: 0x26305e, q: 0x8ab0ff, m: 0xe0485a, p: 0xf2a0b8, K: 0x2a2434 };
const WS = { h: 'H', s: 'S', r: 'R', y: 'Y', c: 'C' };
function whisHead(G, x, y, face = 'calm', tilt = 1) {        // head centred on x, crest top at y
  G.poly([[x - 3.6, y + 7.4], [x - 3, y + 4.6], [x - 1.8 + tilt, y + 2.2], [x - .6 + tilt * 1.6, y], [x + 1 + tilt * 1.6, y + .2], [x + 1.6 + tilt, y + 2.6], [x + 2.8, y + 4.6], [x + 3.6, y + 7.4]], 'h');   // the tall swept crest, tapering to a point
  G.line([[x + tilt, y + 1.6], [x + 1.4, y + 5.4]], 1, 1, 'H');
  G.ell(x, y + 9.4, 3.8, 3.5, 's');
  G.rect(x - 3, y + 6, 6, 1, 'h');                                                                            // hairline
  const e = (i, j, c) => G.set(Math.floor(x + i), Math.floor(y + j), c);
  if (face === 'shut' || face === 'laugh' || face === 'eat') { e(-3, 9, 'k'); e(-2, 8, 'k'); e(-1, 9, 'k'); e(1, 9, 'k'); e(2, 8, 'k'); e(3, 9, 'k'); }   // ^ ^
  else if (face === 'wink') { e(-3, 8, 'v'); e(-2, 8, 'v'); e(-2, 9, 'k'); e(-3, 9, 'w'); e(1, 9, 'k'); e(2, 9, 'k'); e(3, 8, 'k'); }
  else { e(-3, 8, 'v'); e(-2, 8, 'v'); e(1, 8, 'v'); e(2, 8, 'v'); e(-2, 9, 'k'); e(1, 9, 'k'); e(-3, 9, 'w'); e(2, 9, 'w'); }                                           // calm eyes under purple lids
  if (face === 'eat') { e(-1, 11, 'm'); e(0, 11, 'm'); e(-3, 10, 'p'); e(2, 10, 'p'); }
  else if (face === 'laugh') { e(-3, 10, 'p'); e(2, 10, 'p'); }
  else { e(-1, 11, 'v'); e(0, 11, 'v'); }
}
function whisBody(G, x) {
  G.poly([[x - 4, 14], [x + 4, 14], [x + 5.5, 27], [x - 5.5, 27]], 'r');                                       // maroon robe to the ankles
  G.poly([[x - 3, 14.5], [x + 3, 14.5], [x + 2.6, 19.5], [x - 2.6, 19.5]], 'a');                                 // black cuirass
  G.line([[x - 2, 15.4], [x, 17.6], [x + 2, 15.4]], 1, 1, 'w'); G.set(x, 19, 'w');
  G.rect(x - 4, 20, 8, 2, 'y'); G.poly([[x + 1, 21.5], [x + 3, 21.5], [x + 3.4, 25.5], [x + 1.6, 24.6]], 'y');   // orange sash and its tail
  G.line([[x - 1, 22], [x - 1.6, 26.4]], 1, 1, 'R');
  G.rect(x - 4, 27, 3, 2, 'K'); G.rect(x + 1, 27, 3, 2, 'K');                                                     // shoes
}
const whisRing = (G, x) => { G.ell(x, 13.6, 5.2, 1.6, 'c'); G.rect(x - 2, 13, 4, 1, 'C'); };                    // the blue ring round his neck
const whisStaff = (G, x0, y0, x1, y1) => { G.line([[x0, y0], [x1, y1]], 1.2, 1.2, 'n'); };
const whisOrb = (G, x, y) => { G.ell(x, y, 1.9, 1.9, 'b'); G.set(Math.floor(x) - 1, Math.floor(y) - 1, 'q'); };
// A: a slice of strawberry cake on a plate, a bite in his mouth, eyes shut in bliss
const WHIS = shapeSprite(20, 30, G => {
  whisStaff(G, 17, 7, 17, 28.6); whisOrb(G, 17, 3.4);
  whisBody(G, 10);
  limb(G, [[13.6, 16], [16, 20], [16.4, 21]], 2.4, 2.2, 'r'); G.ell(16.6, 21.6, 1.2, 1.2, 's');
  whisRing(G, 10); whisHead(G, 10, 0, 'laugh');
  limb(G, [[6.4, 16], [5, 14.4], [8, 11.6]], 2.4, 2.2, 'r'); G.rect(8, 10, 3, 2, 's'); G.set(11, 11, 's');       // hand over his mouth
  G.set(2, 6, 'c'); G.set(1, 8, 'c'); G.set(3, 9, 'q');
}, WP, WS);

/* ---------- chi-chi ---------- */
const CP = { o: 0x140e16, h: 0x1c1822, H: 0x0e0c12, j: 0x4a4466, s: 0xf8d2b0, S: 0xcc9c7c, k: 0x18121a, w: 0xffffff, W: 0xc4c4cc, p: 0x8a52c8, P: 0x5a2e8e, r: 0xf27aaa, R: 0xb84a78, e: 0xd8302a, m: 0xb8343a, n: 0x7a4a26, g: 0x4a4a54, G: 0x2a2a32, q: 0xd8dce4, b: 0x2a62c8, B: 0x1a3e88, c: 0x9fdcff };
const CS = { h: 'H', p: 'P', r: 'R', b: 'B', g: 'G' };
function chiHead(G, x, face = 'smile') {      // bun on top, black hair framing the face, centre between pixels x-1 and x
  G.ell(x, 2.6, 2.6, 2.4, 'h'); G.set(x - 2, 1, 'j'); G.set(x - 1, 1, 'j');
  G.ell(x, 7.4, 4.6, 4.4, 'h');
  G.ell(x, 8.6, 3.5, 3.4, 's');
  G.poly([[x - 4.4, 6.6], [x - 3, 4.4], [x, 3.8], [x + 3, 4.4], [x + 4.4, 6.6], [x + 2, 6.4], [x, 5.2], [x - 2, 6.4]], 'h');   // parted fringe
  G.rect(x - 5, 7, 1, 5, 'h'); G.rect(x + 4, 7, 1, 5, 'h');                                                       // side locks
  const e = (i, j, c) => G.set(x + i, j, c);
  if (face === 'shut') { e(-3, 9, 'k'); e(-2, 9, 'k'); e(1, 9, 'k'); e(2, 9, 'k'); e(-3, 7, 'k'); e(-2, 8, 'S'); e(2, 7, 'k'); e(1, 8, 'S'); }
  else if (face === 'happy') { e(-3, 9, 'k'); e(-2, 8, 'k'); e(-1, 9, 'k'); e(1, 9, 'k'); e(2, 8, 'k'); e(3, 9, 'k'); }
  else { e(-2, 8, 'k'); e(-2, 9, 'k'); e(1, 8, 'k'); e(1, 9, 'k'); e(-3, 9, 'w'); e(2, 9, 'w'); }
  if (face === 'yell' || face === 'stern') { e(-3, 7, 'k'); e(-2, 7, 'S'); e(2, 7, 'k'); e(1, 7, 'S'); e(-1, 7, 's'); e(0, 7, 's'); }   // brows pulled down at the middle
  if (face === 'yell') { G.rect(x - 1, 10, 2, 2, 'm'); G.set(x + 3, 4, 'e'); G.set(x + 4, 3, 'e'); G.set(x + 4, 5, 'e'); }   // shouting, anger mark
  else if (face === 'stern') { G.rect(x - 1, 11, 2, 1, 'm'); }
  else if (face === 'shut') { G.rect(x - 1, 11, 2, 1, 'm'); e(-3, 10, 'r'); e(2, 10, 'r'); }
  else { G.rect(x - 1, 11, 2, 1, 'm'); e(-2, 10, 'm'); e(1, 10, 'm'); e(-3, 10, 'r'); e(2, 10, 'r'); }
}
function chiBody(G, x) {
  G.poly([[x - 3.6, 13], [x + 3.6, 13], [x + 4.6, 22], [x - 4.6, 22]], 'p');                                     // purple qipao
  G.rect(x - 2, 12, 4, 1, 'p'); G.line([[x - 1, 13], [x + 2, 15]], 1, 1, 'P');                                   // mandarin collar, wrap-over
  G.rect(x - 4, 17, 8, 1, 'r'); G.poly([[x - 3, 17.5], [x - 1.6, 17.5], [x - 2, 21], [x - 3.4, 21]], 'r');         // pink sash, tail
  G.rect(x - 3, 22, 2, 1, 's'); G.rect(x + 1, 22, 2, 1, 's');
  G.rect(x - 4, 23, 3, 2, 'e'); G.rect(x + 1, 23, 3, 2, 'e');                                                     // red slippers
}
// A: scolding with the frying pan raised high, other fist on her hip
const CHICHI = shapeSprite(20, 26, G => {
  chiBody(G, 9);
  limb(G, [[12.4, 14], [15, 11], [15.6, 8.6]], 2.2, 2, 'p'); G.ell(15.6, 8.2, 1.3, 1.3, 's');
  G.line([[15.6, 7.6], [16.4, 4.6]], 1.2, 1.2, 'n'); G.ell(16.6, 2.6, 3, 2, 'g'); G.set(15, 2, 'q'); G.set(16, 1, 'q');   // pan
  limb(G, [[5.6, 14], [3.4, 16.4], [5.4, 18]], 2.2, 2, 'p'); G.set(5, 18, 's');
  chiHead(G, 9, 'yell');
}, CP, CS);
// B: "study, gohan!" — an open book held up, a finger stabbing at the page
const TP = { o: 0x14180c, g: 0x8ab858, G: 0x5a8a36, L: 0xb8dc84, b: 0x9a6634, B: 0x64401c, l: 0xc89050, y: 0xece0a8, Y: 0xbcaa6a, k: 0x141010, w: 0xffffff, m: 0x3a5a22, c: 0x8ad0f4, C: 0x3a8ac8, z: 0xdcecff };
const TS = { g: 'G', b: 'B', y: 'Y', l: 'b' };
const arc = (cx, cy, rx, ry) => Array.from({ length: 19 }, (_, i) => [cx - rx * Math.cos(i * Math.PI / 18), cy - ry * Math.sin(i * Math.PI / 18)]);
function shell(G, x, y) {                          // dome with its centre-bottom at (x, y)
  G.poly(arc(x, y, 8.8, 7.6), 'b');
  for (const [i, j] of [[-5, -3], [-1, -5], [3, -5], [6, -2], [1, -2], [-3, -1]]) { G.ell(x + i, y + j, 1.6, 1.2, 'l'); }   // scutes
  G.line([[x - 7, y - 1.6], [x - 4, y - 2], [x - 2, y - 3.6], [x + 2, y - 3.6], [x + 4, y - 2], [x + 7.4, y - 1.4]], 1, 1, 'B');
  G.line([[x - 1, y - 7], [x - 2, y - 3.6]], 1, 1, 'B'); G.line([[x + 3, y - 7], [x + 2, y - 3.6]], 1, 1, 'B');
  G.line([[x - 8.6, y + .2], [x + 8.6, y + .2]], 1.8, 1.8, 'y');                                                 // cream rim
}
function turtleHead(G, x, y, face = 'chill') {      // head centred at (x, y), facing left
  G.ell(x, y, 3.4, 2.7, 'g'); G.ell(x - 2.4, y + .6, 1.6, 1.8, 'g');
  const e = (i, j, c) => G.set(Math.floor(x + i), Math.floor(y + j), c);
  if (face === 'sleep') { e(-1, -1, 'G'); e(0, -1, 'm'); e(1, -1, 'G'); }
  else { e(-1, -2, 'G'); e(0, -2, 'G'); e(1, -2, 'G'); e(-1, -1, 'w'); e(0, -1, 'k'); }                        // half-lidded eye
  if (face === 'talk') { e(-4, 1, 'm'); e(-3, 1, 'm'); e(-2, 2, 'm'); e(-3, 2, 'k'); }
  else { e(-4, 1, 'm'); e(-3, 2, 'm'); e(-2, 2, 'm'); e(-1, 1, 'm'); }                                           // easy smile
  e(-5, 0, 'G');
}
// A: plodding along the beach, head out, easy smile
const TURTLE = shapeSprite(26, 17, G => {
  G.line([[23, 13], [25, 14.4]], 1.6, 1, 'g');
  G.line([[1.6, 14.4], [9, 14]], 2.4, 2.6, 'g');                                                                  // front flipper laid out flat
  G.line([[8, 12], [5, 11.6]], 3, 3, 'g'); turtleHead(G, 4, 11.4, 'sleep');
  shell(G, 15, 13);
  G.line([[19, 14.4], [23, 14.6]], 2, 2, 'g');
  G.rect(3, 2, 3, 1, 'z'); G.set(4, 3, 'z'); G.rect(3, 4, 3, 1, 'z'); G.set(7, 0, 'z'); G.set(8, 0, 'z'); G.set(7, 1, 'z'); G.set(8, 1, 'z');   // Z z
}, TP, TS);
// C: swimming, flippers stretched out, a wave line under him and bubbles
const OP = { o: 0x1e0e12, p: 0xf6a8bc, P: 0xd07890, n: 0xf28aa4, N: 0xc85a78, k: 0x1a1014, w: 0xffffff, m: 0x8a2a3a, t: 0xe85a6a, g: 0x4e8a3e, G: 0x2e5e26, L: 0x7ab468, y: 0xf2c84a, K: 0x2a2226, c: 0x8ad0f4, z: 0xf4f2f6, Z: 0xc4c2d0 };
const OS = { p: 'P', g: 'G', n: 'N', z: 'Z' };
function oolHead(G, x, face = 'smug') {            // centre between pixels x-1 and x
  G.poly([[x - 5.6, 5], [x - 6.4, .4], [x - 1.6, 2.6]], 'p'); G.poly([[x + 5.6, 5], [x + 6.4, .4], [x + 1.6, 2.6]], 'p');   // big ears flaring out
  G.set(x - 5, 2, 'n'); G.set(x - 5, 3, 'n'); G.set(x + 4, 2, 'n'); G.set(x + 4, 3, 'n');
  G.ell(x, 6.6, 5.6, 4.3, 'p');
  G.ell(x, 8.1, 2.5, 1.6, 'n'); G.set(x - 2, 8, 'N'); G.set(x + 1, 8, 'N');                                      // big snout, nostrils
  const e = (i, j, c) => G.set(x + i, j, c);
  if (face === 'razz') { e(-3, 5, 'k'); e(-2, 5, 'k'); e(-3, 6, 'k'); e(-2, 6, 'w'); e(1, 6, 'k'); e(2, 5, 'k'); e(3, 6, 'k'); }   // one eye pulled, one squeezed
  else if (face === 'panic') { e(-3, 5, 'w'); e(-3, 6, 'w'); e(-2, 5, 'w'); e(-2, 6, 'k'); e(1, 5, 'w'); e(1, 6, 'k'); e(2, 5, 'w'); e(2, 6, 'w'); }
  else { e(-3, 5, 'P'); e(-2, 5, 'P'); e(1, 5, 'P'); e(2, 5, 'P'); e(-2, 6, 'k'); e(1, 6, 'k'); }                 // half-lidded, scheming
  if (face === 'razz') { e(-1, 10, 'm'); e(0, 10, 'm'); e(-1, 11, 't'); e(0, 11, 't'); }
  else if (face === 'panic') { G.rect(x - 1, 10, 2, 1, 'm'); e(-2, 10, 'k'); e(1, 10, 'k'); }
  else { e(-2, 10, 'm'); e(-1, 10, 'm'); e(0, 10, 'm'); e(1, 9, 'm'); }                                          // lopsided grin
}
function oolBody(G, x, legs = 'stand') {
  G.line([[x + 4.6, 14], [x + 6, 13.4], [x + 5.6, 12.4]], 1, 1, 'p');                                           // curly tail
  if (legs === 'run') { G.line([[x - 1.6, 16], [x - 4, 17.4]], 2.4, 2.4, 'g'); G.line([[x + 1.6, 16], [x + 3, 18.4]], 2.4, 2.4, 'g'); G.rect(x - 7, 17, 3, 2, 'K'); G.rect(x + 2, 18, 3, 2, 'K'); }
  else { G.rect(x - 3, 16, 2, 2, 'g'); G.rect(x + 1, 16, 2, 2, 'g'); G.rect(x - 4, 18, 3, 2, 'K'); G.rect(x + 1, 18, 3, 2, 'K'); }
  G.poly([[x - 3.8, 10.6], [x + 3.8, 10.6], [x + 4.2, 16.4], [x - 4.2, 16.4]], 'g');                             // army jacket
  G.rect(x - 2, 11, 4, 1, 'L'); G.line([[x - 1, 12], [x - 1, 16]], 1, 1, 'G'); G.set(x, 12, 'y'); G.set(x, 14, 'y');   // collar, placket, buttons
  G.rect(x - 4, 15, 8, 1, 'G');                                                                                  // belt
}
// A: hands on hips, smug and scheming
const OOLONG = shapeSprite(18, 21, G => {
  oolBody(G, 9);
  limb(G, [[5.4, 12], [3.6, 14], [5, 15.4]], 2, 2, 'g'); G.set(5, 15, 'p');
  limb(G, [[12.6, 12], [14.4, 14], [13, 15.4]], 2, 2, 'g'); G.set(12, 15, 'p');
  oolHead(G, 9, 'smug');
}, OP, OS);
// B: "nyah!" — tugging an eyelid down, tongue out
return { whis: WHIS, chichi: CHICHI, turtle: TURTLE, oolong: OOLONG };
})();
// what you surf across roshi's sea on
const SURFBOARD = shapeSprite(22, 5, G => { G.poly([[1, 2], [4, 0.5], [18, 0.5], [21.5, 2], [18, 3.5], [4, 3.5]], 'b'); G.rect(4, 2, 15, 1, 'r'); }, { o: 0x1c1410, b: 0xfff4dc, B: 0xd8c8a8, r: 0xe0402e }, { b: 'B' });
// roshi's kamehameha, three frames: ki ball at the hip, arms thrust out, the blast at his palms (picked take D: low stance, big shell)
const ROSHI_KAME = (() => {
// roshi at max power doing the kamehameha, facing right: ka-me-ha-me (charge at the hip), ha (thrust), HAAA (flare at the palms)
// every frame of a version shares one canvas so the feet never move; the beam itself is drawn by the game
const limb = (G, pts, w0, w1, c) => { G.line(pts, w0 + 1.4, w1 + 1.4, 'o'); G.line(pts, w0, w1, c); };
const shift = (G, dx, dy) => { const m = p => p.map(([x, y]) => [x + dx, y + dy]); return { ell: (x, y, a, b, c) => G.ell(x + dx, y + dy, a, b, c), rect: (x, y, w, h, c) => G.rect(Math.round(x + dx), Math.round(y + dy), w, h, c), poly: (p, c) => G.poly(m(p), c), line: (p, a, b, c) => G.line(m(p), a, b, c), set: (x, y, c) => G.set(Math.round(x + dx), Math.round(y + dy), c) }; };
const KP = { o: 0x1a1210, s: 0xf2c8a0, S: 0xc89a76, k: 0x111111, w: 0xffffff, W: 0xd8d8e0, r: 0xf08a24, R: 0xc0641a, p: 0x6a5a48, P: 0x4a3e30, g: 0x4a9a3a, G: 0x2e6a26, v: 0xd89a7a, n: 0x7a4a2a, q: 0xffffff, c: 0x9fdcff, C: 0x3a8ae8, b: 0x2f5ad0 };
const KS = { w: 'W', s: 'S', p: 'P', r: 'R', g: 'G' };

// one frame. o: { cx, head (scale), buff, veins, glint, shell, stance, crouch[3], lean[3], rags }
function kame(G0, f, o) {
  const cx = o.cx, dx = o.lean[f], dy = o.crouch[f], B = o.buff, T = shift(G0, cx + dx, dy), G = G0;
  const hs = o.head;
  // shell strapped on behind
  const sr = o.shell;
  T.ell(-6 - B * .5, 15, 3.6 * sr, 6 * sr, 'G'); T.ell(-6 - B * .5, 15, 2.6 * sr, 4.8 * sr, 'g');
  for (const [x, y] of [[-6, 12], [-7, 15], [-6, 18], [-5, 15]]) T.set(x - B * .5, y, 'G');
  // legs: hips ride with the torso, feet stay planted
  const st = o.stance, fb = [cx - st[0], 28], ff = [cx + st[1], 28];
  limb(G, [[cx + dx - 3, 21 + dy], [fb[0] + 1, 24.5 + dy * .5], fb], 3.4, 3, 'p');
  limb(G, [[cx + dx + 1, 21 + dy], [ff[0] + 1, 23.5 + dy], ff], 3.4, 3, 'p');
  G.rect(fb[0] - 1, 28, 3, 2, 'n'); G.rect(ff[0] - 1, 28, 4, 2, 'n');
  // far arm, behind the torso
  if (f === 0) limb(G0, [[cx + dx - 1, 11 + dy], [cx + dx - 3 - B * .5, 16 + dy], [cx + dx - 5, 18 + dy]], 3.4 + B, 3, 'S');
  else limb(G0, [[cx + dx - 1, 11 + dy], [cx + 12 + f, 12.6 + (o.armDy || 0)]], 3.6 + B, 3, 'S');
  // the barrel chest
  T.poly([[-5 - B, 15], [-3 - B, 9], [2, 7.5], [6 + B, 10], [7 + B, 14], [5 + B * .5, 19], [2, 22], [-4, 22], [-5 - B, 19]], 's');
  T.rect(-4, 21, 7, 1, 'r'); T.rect(-4, 22, 7, 1, 'P');                                                              // torn gi hem, belt line
  T.line([[1, 12], [5 + B, 13]], 1, 1, 'S'); T.set(2, 16, 'S'); T.set(4, 16, 'S'); T.set(2, 18, 'S'); T.set(4, 18, 'S');   // pec, abs
  T.ell(3 + B * .5, 10.5, 2.6 + B * .4, 2.2 + B * .3, 'S'); T.ell(3 + B * .5, 10.3, 2.2 + B * .4, 1.8 + B * .3, 's');    // front delt
  if (o.rags) { T.poly([[-4 - B, 13], [-2 - B, 8.5], [1, 8.5], [-1, 12]], 'r'); T.set(-3 - B, 13, 'R'); }        // shoulder rag over the back
  if (o.veins) for (const [x, y] of o.veins) T.set(x, y, 'v');
  // head: small and sunk into the traps, shades and beard aimed forward; the beard hangs over the arms
  const drawHead = () => {
  const hx = 2 + o.headDx, hy = 5.6 - (hs - 1) * 2.4;
  T.ell(hx, hy, 4.2 * hs, 4.4 * hs, 'o');
  T.poly([[hx - 2, hy + 1.5], [hx + 4.4 * hs, hy + 1.5], [hx + 3.6 * hs, hy + 6 * hs], [hx + 2.2 * hs, hy + 9 * hs], [hx - 1, hy + 6]], 'o');
  T.ell(hx, hy, 3.2 * hs, 3.4 * hs, 's'); T.set(hx - 2 * hs, hy - 2.6 * hs, 'w');
  T.rect(hx - 1, hy - 1, Math.round(4 * hs), Math.round(2 * hs - .4), 'k'); T.set(hx - 2, hy - 1, 'k');               // shades
  if (o.glint) { T.set(hx + 1, hy - 1, 'w'); T.set(hx + 2, hy - 1, 'W'); }
  T.poly([[hx - 1.6, hy + 1.5], [hx + 3.6 * hs, hy + 1.5], [hx + 3 * hs, hy + 5 * hs], [hx + 2 * hs, hy + 8 * hs], [hx - .4, hy + 5]], 'w');   // beard
  T.rect(hx, hy + 1.5, Math.round(3.4 * hs), 1, 'W');                                                                 // moustache
  };
  // near arm, hands and ki
  if (f === 0) {
    const bx = cx + dx - 5, by = 19 + dy;
    G0.ell(cx + dx, 13 + dy, 2.6 + B * .5, 2.2 + B * .4, 'o');
    limb(G0, [[cx + dx + 2, 11 + dy], [cx + dx - 1.5, 15.5 + dy], [bx + 1.5, by + .5]], 4 + B, 3.2, 's');                // elbow drawn back past the ribs
    G0.ell(cx + dx, 13 + dy, 1.8 + B * .5, 1.5 + B * .4, 's'); G0.set(cx + dx - 1, 14 + dy, 'S');                 // bicep bunched up
    if (o.veins) G0.set(cx + dx, 12 + dy, 'v');
    for (const s of [-1, 1]) { G0.ell(bx + .5, by + s * 2.8, 2.8, 1.8, 'o'); G0.ell(bx + .5, by + s * 2.8, 2.1, 1.1, 's'); }   // cupped palms, one over and one under
    G0.ell(bx, by, 2.4, 2.2, 'o'); G0.ell(bx, by, 2, 1.8, 'C'); G0.ell(bx, by, 1.4, 1.2, 'c'); G0.set(bx - 1, by - 1, 'q');
    G0.rect(Math.round(bx), Math.round(by) - 2, 2, 1, 'S'); G0.rect(Math.round(bx), Math.round(by) + 2, 2, 1, 'S');   // fingertips curled round the ball
    G0.set(bx - 3, by - 3, 'c'); G0.set(bx + 3, by - 4, 'c'); G0.set(bx - 4, by + 1, 'c');
  } else {
    const ex = cx + 12 + f, ay = 14 + (o.armDy || 0);
    const mx = (cx + dx + 3 + ex) / 2 - 2, my = (12 + dy + ay) / 2 - 1;
    G0.ell(mx, my, 2.8 + B * .5, 2 + B * .4, 'o');
    limb(G0, [[cx + dx + 3, 12 + dy], [ex, ay]], 4 + B, 3.2, 's');
    G0.ell(mx, my, 2 + B * .5, 1.3 + B * .4, 's');                                                                       // bicep bulging on top
    if (o.veins) { G0.set(cx + dx + 6, 12 + dy, 'v'); G0.set(cx + dx + 8, ay - 1, 'v'); }
    G0.ell(ex + .5, ay - .5, 1.8, 3.4, 'o'); G0.rect(ex, ay - 3, 2, 5, 's'); G0.set(ex + 1, ay - 1, 'S');                        // palms open, heels together
    if (f === 1) { G0.set(ex + 3, ay - 1, 'c'); G0.set(ex + 3, ay, 'C'); G0.set(ex + 4, ay - 2, 'c'); }
    else {
      const fx = ex + 5.5, fy = ay - .5;
      for (const [a, b] of [[4, -5], [4, 5], [6, -2], [6, 2], [1, -6], [1, 6]]) G0.line([[fx, fy], [fx + a, fy + b]], 1.4, .4, 'c');
      G0.ell(fx, fy, 3.4, 4.4, 'C'); G0.ell(fx, fy, 2.4, 3.4, 'c'); G0.ell(fx + .3, fy, 1.4, 2.2, 'q');
    }
  }
  drawHead();
}
const seq = (o, w = 46, h = 30) => [0, 1, 2].map(f => shapeSprite(w, h, G => kame(G, f, o), KP, KS));

// A: the classic anime pose: torn gi rags, steady side stance, a clean push forward
const kameD = seq({ cx: 19, head: 1, headDx: 0, buff: .6, shell: 1.25, stance: [9, 6], crouch: [4, 3, 2], lean: [-3, 1, 2], rags: false });
return kameD;
})();
const VILLAINS = (() => {
  const body = (rows, pal) => makeSprite(rows, pal, { emit: 'r' });
  return [
    { name: 'raditz', spr: RADITZ },
    { name: 'nappa', spr: NAPPA },
    { name: 'vegeta', spr: VEGETA_V },
    { name: 'frieza', spr: FRIEZA },
    { name: 'cell', spr: CELL },
    { name: 'kid buu', spr: KIDBUU },
    { name: 'broly', spr: BROLY },
    { name: 'beerus', spr: BEERUS },
    { name: 'hit', spr: HIT },
    { name: 'goku black', spr: GOKU_BLACK },
    { name: 'jiren', spr: JIREN },
    { name: 'moro', spr: MORO },
    { name: 'gas', spr: GAS },
  ];
})();
// a senzu bean: kidney-shaped, bright green with a shine, outlined in white so it stands out on the grass
const SENZU = shapeSprite(12, 8, G => {
  G.ell(6, 4.3, 5.2, 3, 'g'); G.set(5, 1, '.'); G.set(6, 1, '.'); G.set(7, 1, '.'); G.set(6, 2, '.');   // an oval with a shallow dent on top: a bean
  G.ell(3.6, 3.8, 1.5, .9, 'l'); G.set(8, 5, 'l');                                                   // shine
}, { o: 0xffffff, g: 0x8ee04a, G: 0x3f9a26, l: 0xeaffd0 }, { g: 'G' });
// a saiyan space pod streaks across the sky now and then; tap it for a boost
const POD = shapeSprite(14, 14, G => {   // white attack pod with a purple window and the door seam
  G.ell(7, 7, 5.9, 5.9, 'w'); G.line([[4.3, 2.8], [3.9, 7], [4.7, 11.3]], 1, 1, 'W');
  G.ell(9, 5.5, 2.8, 2.6, 'k'); G.ell(9, 5.5, 2.1, 1.9, 'm'); G.set(8, 4, 'M'); G.set(8, 5, 'M');
}, { o: 0x22222e, w: 0xf4f4f8, W: 0xbcc0cc, k: 0x3a3a48, m: 0x6a2a8a, M: 0xc08ae0 }, { w: 'W' });

/* ---------- mount paozu dinosaurs (draft sprites: four poses each, b1/c1 used as placeholders until picked) ---------- */
const DINOS = (() => {
// earth's dinosaurs, take two: bigger, four poses each, all facing right
// a stroke with its own outline so a limb/neck reads in front of the body behind it
const dl = (G, pts, w0, w1, c) => { G.line(pts, w0 + 1.6, w1 + 1.6, 'o'); G.line(pts, w0, w1, c); };
const de = (G, cx, cy, rx, ry, c) => { G.ell(cx, cy, rx + .9, ry + .9, 'o'); G.ell(cx, cy, rx, ry, c); };
const dp = (G, pts, c) => { G.poly(pts, 'o'); G.poly(pts.map(([x, y]) => [x, y]), c); };

/* ---------- B: the classic DBZ theropod (gohan's tail donor / goku's dinner) ---------- */
// orange-brown hide, cream belly and throat, dark-brown back ridge and head crest, stubby arms, thick legs
const PB = { o: 0x2a1408, b: 0xd07a38, B: 0x8e4a1e, h: 0xeea05a, y: 0xf6e2aa, Y: 0xc9a868, d: 0x7a3a18, D: 0x52240c, w: 0xffffff, k: 0x140a04, m: 0x6a1412, n: 0xe0606a, t: 0xfff8e8, p: 0xf08c8c, P: 0xc05a5a };
const SB = { b: 'B', y: 'Y', d: 'D', p: 'P' };
// skull at (x,y) = top-left of the cranium; mouth: 'shut' | 'open' | 'roar'
function bHead(G, x, y, { mouth = 'shut', eye = 'open' } = {}) {
  // crest: a backswept knobbed fin on the back of the skull
  G.poly([[x + 1, y + 3], [x - 2, y - 1], [x + 1, y - 2], [x + 4, y - 1], [x + 6, y + 1]], 'd');
  G.poly([[x + 4, y + 1], [x + 5, y - 3], [x + 8, y - 2], [x + 9, y + 1]], 'd');
  if (mouth === 'shut') {
    G.poly([[x, y + 3], [x + 3, y], [x + 11, y], [x + 15, y + 2], [x + 17, y + 5], [x + 16, y + 8], [x + 12, y + 10], [x + 3, y + 11], [x, y + 8]], 'b');
    G.poly([[x + 3, y + 8], [x + 15, y + 8], [x + 12, y + 10], [x + 3, y + 11]], 'y');
    G.line([[x + 6, y + 7.5], [x + 16, y + 7.5]], 1, 1, 'k');
    for (const i of [8, 11, 14]) G.set(x + i, y + 8, 't');
    G.set(x + 15, y + 3, 'B');
  } else {
    const r = mouth === 'roar';
    // upper jaw tilted up, lower jaw dropped; dark mouth with teeth and tongue between
    const up = r ? -3 : -1, dn = r ? 4 : 3;
    G.poly([[x, y + 3], [x + 3, y], [x + 11, y + up * .3], [x + 16, y + up + 2], [x + 18, y + up + 4], [x + 17, y + up + 6], [x + 7, y + 7], [x, y + 8]], 'b');
    G.poly([[x + 2, y + 8], [x + 7, y + 7], [x + 16, y + 7 + dn], [x + 15, y + 9 + dn], [x + 8, y + 11 + dn * .5], [x + 2, y + 11]], 'b');
    G.poly([[x + 4, y + 10], [x + 9, y + 10 + dn * .4], [x + 15, y + 8 + dn], [x + 14, y + 9 + dn], [x + 8, y + 11 + dn * .5], [x + 3, y + 11]], 'y');
    G.poly([[x + 8, y + 7], [x + 19, y + up + 5], [x + 19, y + 8 + dn], [x + 8, y + 8]], '.');   // open jaws you can see through
    G.set(x + 8, y + 7, 'm'); G.set(x + 9, y + 7, 'm');
    for (const i of [10, 13, 16]) G.set(x + i, Math.round(y + 6 + (up) * (i - 7) / 10 + .4), 't');
    for (const i of [11, 14]) G.set(x + i, Math.round(y + 7 + dn * (i - 7) / 9 - .2), 't');
    G.set(x + 16, y + up + 3, 'B');
  }
  // the eye: white with a black pupil looking ahead, heavy brow
  if (eye === 'open') { G.rect(x + 6, y + 2, 3, 3, 'w'); G.rect(x + 8, y + 3, 1, 2, 'k'); G.line([[x + 5, y + 1.5], [x + 10, y + 2]], 1.2, 1.2, 'd'); }
  else if (eye === 'mad') { G.rect(x + 6, y + 3, 3, 2, 'w'); G.set(x + 8, y + 3, 'k'); G.set(x + 8, y + 4, 'k'); G.line([[x + 5, y + 1.5], [x + 10, y + 3.5]], 1.4, 1.2, 'd'); }
  else { G.line([[x + 6, y + 3.5], [x + 9, y + 3.5]], 1, 1, 'k'); G.line([[x + 5, y + 2], [x + 10, y + 2.2]], 1.2, 1.2, 'd'); }   // shut, smug/sleepy
  G.set(x + 4, y, 'h'); G.set(x + 5, y, 'h'); G.set(x + 9, y + 0, 'h');
}
function bRidge(G, pts) { for (const [x, y, s = 1] of pts) G.poly([[x - 1.8 * s, y + 1.5], [x - .6 * s, y - 2 * s], [x + 1.6 * s, y + 1.5]], 'd'); }
// standing body: thigh-heavy, belly cream; bx,by = body centre
function bBody(G, bx, by) {
  G.ell(bx, by, 11, 8.5, 'b');
  G.ell(bx + 4, by + 2.4, 6.6, 5.6, 'y');
  for (const [i, j] of [[-6, -6], [-3, -7], [0, -7.5], [3, -7]]) G.set(Math.round(bx + i), Math.round(by + j), 'h');
}
const bFoot = (G, x, y, c = 'b') => { G.rect(x, y, 7, 2, c); G.set(x + 7, y + 1, 't'); G.set(x + 5, y + 1, 't'); };

// 1: stomping forward, mouth shut, near leg lifted mid-stride, tail swinging up

// 2: roaring at the sky, head thrown back, jaws wide, arms out, tail up
const DB2 = shapeSprite(50, 40, G => {
  G.line([[16, 25], [8, 23], [3, 18], [1, 12]], 8, 1.4, 'b');
  bRidge(G, [[3, 16, .7], [7, 20, .9], [11, 21.5], [16, 18], [20, 16], [24, 15], [28, 14]]);
  dl(G, [[19, 29], [18, 34], [17, 36.5]], 5, 3.4, 'B'); bFoot(G, 14, 36, 'B');
  bBody(G, 24, 24);
  G.poly([[27, 19], [29, 10], [35, 9], [36, 20], [31, 26]], 'b'); G.poly([[32, 16], [35, 12], [36, 20], [31, 25]], 'y');
  bHead(G, 28, 3, { mouth: 'roar', eye: 'mad' });
  dl(G, [[34, 23], [38, 22], [40, 19]], 2, 1.4, 'b');
  de(G, 27, 28, 5, 5.5, 'b'); dl(G, [[28, 32], [30, 35], [30, 36.5]], 4.2, 3.4, 'b'); bFoot(G, 28, 36);
}, PB, SB);

// 3: sniffing the ground, head low and forward, tail level, hungry

// 4: sitting back on its haunches, tail cut to a stub (gohan's dinner), eyes squeezed shut, pouting

/* ---------- C: the long-neck sauropod ---------- */
const PC = { o: 0x10200e, g: 0x6cae4c, G: 0x3c7a30, h: 0x9ad070, t: 0xece2b0, T: 0xbcae78, s: 0x4a8a36, k: 0x0c1408, w: 0xffffff, m: 0x5a1a14, n: 0xe07070, f: 0x58b0e0, F: 0x2a78b0, l: 0x2e8a5a, L: 0x1a5a3a };
const SC = { g: 'G', t: 'T', l: 'L' };
function cHead(G, x, y, { open = false, eye = 'open', tilt = 0 } = {}) {
  G.ell(x, y, 3.6, 2.8, 'g'); G.ell(x + 3, y + 1 + tilt, 2.8, 2, 'g');
  if (open) { G.poly([[x + 2, y + 2 + tilt], [x + 6, y + 1 + tilt], [x + 6, y + 4 + tilt], [x + 2, y + 3 + tilt]], 'm'); G.set(x + 5, y + 2 + tilt, 'n'); }
  else G.line([[x + 2, y + 2.5 + tilt], [x + 5, y + 2.5 + tilt]], 1, 1, 'G');
  if (eye === 'open') { G.rect(x - 1, y - 1, 2, 2, 'w'); G.set(x, y - 1, 'k'); G.set(x, y, 'k'); }
  else G.rect(x - 1, y, 2, 1, 'k');
  G.set(x - 2, y - 2, 'h'); G.set(x - 1, y - 2, 'h'); G.set(x + 5, y, 'G');
}
// barrel body + belly + back spots; legs drawn by caller
function cBody(G, bx, by) {
  G.ell(bx, by, 14, 8.6, 'g'); G.ell(bx + 2, by + 4, 10, 4, 't');
  for (const [i, j] of [[-7, -4], [-2, -6], [4, -5], [-4, -1], [8, -2], [1, -2]]) G.ell(bx + i, by + j, 1.3, 1, 's');
  for (const i of [-8, -5, -1, 3]) G.set(bx + i, by - 8, 'h');
}
const cLeg = (G, x, y, h, c) => { G.rect(x - 1, y, 6, h, 'o'); G.rect(x, y, 4, h, c); G.rect(x, y + h - 1, 4, 1, c === 'g' ? 'T' : 'G'); G.set(x + 1, y + h - 1, 't'); G.set(x + 3, y + h - 1, 't'); };

// 1: plodding along, head held high, tail swaying
const DC1 = shapeSprite(56, 40, G => {
  G.line([[12, 25], [5, 27], [0, 32]], 6, 1.2, 'g');
  cLeg(G, 14, 27, 12, 'G'); cLeg(G, 30, 27, 12, 'G');                                        // far legs
  cBody(G, 23, 23);
  dl(G, [[33, 21], [39, 14], [43, 8], [45, 5]], 7, 4, 'g'); G.line([[36, 20], [41, 13], [44, 8]], 2.4, 1.6, 't');
  cHead(G, 47, 4);
  cLeg(G, 18, 28, 11, 'g'); cLeg(G, 34, 28, 11, 'g');                                        // near legs
}, PC, SC);

// 2: grazing, neck bent down to a bush, tail high

// 3: rearing up on its hind legs, neck stretched to the sky, calling

// 4: lying down for a nap, legs tucked, neck curled round, eyes shut

/* ---------- D: the pterodactyl ---------- */
// dusky purple-grey hide, paler wing membrane, orange beak and backswept crest
const PD2 = { o: 0x1a1428, p: 0x8a78b0, P: 0x5a4a80, v: 0xb8a8d8, V: 0x8a7aac, h: 0xc8bce0, c: 0xf09040, C: 0xb05a20, w: 0xffffff, k: 0x100818, y: 0xf0c040, Y: 0xc08a20, r: 0xe02a2a, s: 0xf2c49a, S: 0xc8906a, u: 0x2a6ad0, U: 0x1a3e88, q: 0xe8e0f0 };
const SD2 = { p: 'P', v: 'V', c: 'C', y: 'Y', s: 'S', u: 'U' };
// head at (x,y) = back of skull; beak points right; dive tilts it down
function dHead(G, x, y, { dive = 0, open = false } = {}) {
  G.poly([[x + 1, y - 1], [x - 7, y - 4], [x - 4, y + 1], [x + 1, y + 2]], 'c');            // crest
  G.ell(x + 2, y + 1, 3.4, 2.8, 'p');
  if (!open) G.poly([[x + 4, y - 1], [x + 15, y + 2 + dive], [x + 15, y + 3 + dive], [x + 4, y + 3]], 'c');
  else { G.poly([[x + 4, y - 1], [x + 15, y + 1 + dive], [x + 4, y + 1.5]], 'c'); G.poly([[x + 4, y + 2], [x + 14, y + 5 + dive], [x + 4, y + 3.5]], 'c'); }
  G.rect(x + 1, y - 1, 2, 2, 'w'); G.set(x + 2, y, 'k'); G.set(x + 2, y - 1, 'k');
  G.line([[x, y - 2], [x + 4, y - 1.4]], 1, 1, 'P');
  G.set(x + 1, y - 2, 'h');
}
// wing: arm bone along the leading edge, membrane hanging back to the body
const dWing = (G, pts, c) => { G.poly(pts, c); };

// 1: gliding, wings spread flat, feet tucked
const DD1 = shapeSprite(54, 34, G => {
  dWing(G, [[26, 15], [40, 9], [53, 8], [44, 13], [32, 19]], 'V');                            // far wing, peeking out ahead
  G.ell(24, 18, 7, 3.6, 'p'); G.ell(25, 19.5, 5, 2, 'h');                                   // body
  G.line([[17, 19], [10, 19], [6, 21]], 2, 1, 'p');                                         // tail
  dWing(G, [[28, 16], [18, 10], [6, 7], [0, 9], [6, 12], [12, 18], [22, 21]], 'v');          // near wing
  G.line([[28, 16], [18, 10], [6, 7], [0, 9]], 1.6, 1, 'p');
  for (const x of [8, 14, 20]) G.line([[x, 9 + (x - 6) * .3], [x + 3, 15 + (x - 6) * .3]], 1, 1, 'V');
  G.line([[30, 17], [33, 13]], 3, 2.4, 'p');                                                 // neck
  dHead(G, 35, 12);
  G.line([[22, 21], [19, 24]], 1.4, 1, 'P'); G.rect(17, 24, 3, 1, 'c');                     // tucked feet
}, PD2, SD2);

// 2: flapping hard, wings raised high, beak open, legs dangling

// 3: diving, wings swept back, beak aimed down at prey

// 4: carrying a four-star dragon ball in its talons, wings mid-beat
return { b: DB2, c: DC1, d: DD1 };
})();
/* ---------- end mount paozu dinosaurs ---------- */

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
  hull: [0xa8a49a, 0xccc8bc, 0xe8e4d8, 0xf8f6ee, 0xffffff],     // west city building bodies
  cc: [0x10306a, 0x1a4a9a, 0x2a6ac8, 0x4a8ae0],
  pane: [0x16244a, 0x24406e, 0x3a6aa0, 0x8ac0ec],
  peach: [0xb8642a, 0xe0884a, 0xf4ac72, 0xffd2a8],
  aqua: [0x2a7a8a, 0x40a0b0, 0x6ac8d0, 0xb0ecee],
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
const VEGETA = Object.assign({}, KAI, {
  grass: [0x5a1a14, 0x7a2a1c, 0x9a3e24, 0xb85a30, 0xd27a44, 0xeaa06a],     // red rock
  road: [0x3a2620, 0x52362c, 0x6a4a3a, 0x86624e],
  dome: [0x8a8a92, 0xaeaeb6, 0xcfcfd6, 0xe8e8ee, 0xffffff],                  // saiyan domes
  band: [0x6a6a72, 0x8a8a92, 0xaeaeb6, 0xd0d0d6],
  glass: [0x3a1418, 0x6a2028, 0xa83a3a, 0xe86a5a],
  trunk: [0x2a1410, 0x3a1c14, 0x4a2618, 0x5a3020],
  leaf: [0x3a1612, 0x5a2218, 0x7a3220, 0x9a4a2c, 0xc06a40],                  // red boulders where bushes grow
  stone: [0x3a1a16, 0x5a2a20, 0x7a3e2c, 0x9a5a40],
});
// beerus' planet: violet grass, magenta-and-teal puff trees, stone-grey pyramids for houses
const BEERUSP = Object.assign({}, KAI, {
  grass: [0x2a1f5a, 0x3a2a7a, 0x4e3a9a, 0x6a52b8, 0x8f78d2, 0xbcaaec],
  road: [0x8a7aa8, 0xa898c4, 0xc6b8dc, 0xe4dcf2],
  dome: [0x6a6478, 0x8a8498, 0xaaa4b8, 0xcac6d6, 0xeceaf2],
  band: [0x4a4458, 0x6a6478, 0x8a8498, 0xaaa4b8],
  leaf: [0x6a1a5a, 0x8a2a78, 0xb04a9a, 0xd47abc, 0xf0b4e0],
  trunk: [0x1a4a4a, 0x226060, 0x2e7a7a, 0x46a0a0],
});
// west city on earth: bright grass, asphalt roads, cream capsule corp domes with a yellow band
const EARTH = Object.assign({}, KAI, {
  grass: [0x2a6a2a, 0x3a8a34, 0x52a83e, 0x72c450, 0x9ade6e, 0xcaf29a],
  road: [0x3a3c44, 0x50525c, 0x686a76, 0x8a8c98],
  dome: [0xb8b0a0, 0xd8d0c0, 0xece6d8, 0xf8f4ec, 0xffffff],
  band: [0xb88a1a, 0xd8a82a, 0xf2c84a, 0xffe08a],
  glass: [0x1c3a6a, 0x2a5a9a, 0x4a8ad0, 0x9fd0ff],
});
// kame house: the planet is open sea (grass), lagoon shallows (glass), dry sand (road) and wet sand (band); palm trees
const KAMEP = Object.assign({}, KAI, {
  grass: [0x123e86, 0x1a52a2, 0x2268bc, 0x2e80d0, 0x4a9ee0, 0x7cc0ee],
  glass: [0x1a7aa8, 0x2a9ac0, 0x48bcd2, 0x7adae0, 0xb8f0ec],
  road: [0xc8a464, 0xe0c080, 0xf0d89c, 0xfaecc4, 0xfff8e4],
  band: [0x9a7a48, 0xb8945a, 0xcfac70, 0xe2c488],
  leaf: [0x174a22, 0x23692c, 0x338a36, 0x52ac44, 0x8ad466],
  trunk: [0x5a3a1c, 0x7a5228, 0x9a6c36, 0xbe8e4e],
  stone: [0x5a5048, 0x7a7068, 0x9e968a, 0xc8c0b2],
});
// roshi's pink house: red hip roof, "KAME HOUSE" painted under the eaves, two white-framed windows and a door
const KAMEHOUSE = shapeSprite(44, 30, G => {
  G.poly([[0, 13], [8, 3], [36, 3], [44, 13]], 'r'); G.rect(9, 3, 26, 1, 'q'); for (const y of [6, 9]) for (let x = 6; x < 39; x += 2) G.set(x + (y === 9 ? 1 : 0), y, 'R');   // roof, ridge, tile rows
  G.rect(1, 12, 42, 1, 'R'); G.rect(2, 13, 40, 15, 'p');
  const F = { K: '1.11.111.1.11.1', A: '.1.1.11111.11.1', M: '1.11111111.11.1', E: '1111..11.1..111', H: '1.11.11111.11.1', O: '1111.11.11.1111', U: '1.11.11.11.1111', S: '1111..111..1111' };   // a 3x5 pixel font
  [...'KAME HOUSE'].forEach((ch, i) => { const x0 = 4 + i * 4 - (i > 4 ? 2 : 0); if (F[ch]) for (let k = 0; k < 15; k++) if (F[ch][k] === '1') G.set(x0 + k % 3, 15 + (k / 3 | 0), 'm'); });
  for (const x of [5, 32]) { G.rect(x, 21, 7, 6, 'w'); G.rect(x + 1, 22, 5, 4, 'g'); G.rect(x + 3, 22, 1, 4, 'w'); }   // windows
  G.rect(19, 21, 6, 7, 'd'); G.set(23, 24, 'y'); G.rect(18, 28, 8, 2, 'w'); G.rect(2, 28, 40, 1, 'P');                  // door, step, footing
}, { o: 0x2a1418, r: 0xe0402e, R: 0x9a2018, q: 0xff8a6a, p: 0xf6a2b6, P: 0xc87088, m: 0xd0202a, w: 0xfaf6f0, W: 0xc8c0c0, g: 0x7ac8f0, d: 0x7a3e22, y: 0xf2c84a }, { r: 'R', p: 'P', w: 'W' });
// mount paozu: deep forest, a dirt track, goku's white dome house, grey karst pillars
const PAOZU = Object.assign({}, KAI, {
  grass: [0x1c5a22, 0x26722a, 0x348c32, 0x4aa63c, 0x72c454, 0xa8e080],
  road: [0x8a6a44, 0xa8885a, 0xc6a676, 0xe2c89a],
  dome: [0xa8a49a, 0xccc8bc, 0xe8e4d8, 0xf8f6ee, 0xffffff],
  band: [0x7a2a18, 0xa83e22, 0xd05a30, 0xee8a54],
  glass: [0x1c3a5a, 0x2a5a8a, 0x5a9ad0, 0xb0e0ff],
  leaf: [0x0e3a18, 0x185a22, 0x24782c, 0x3a983a, 0x6ab852],
  trunk: [0x3a2414, 0x553620, 0x74502e, 0x94683e],
  stone: [0x3e4a4a, 0x5e6c68, 0x84928a, 0xb0bcb0, 0xd8e0d4],
});
// future trunks' timeline in the rain: wet grey rubble, black asphalt, a ring of broken concrete skyscrapers, rusted rebar
const FUTURE = Object.assign({}, KAI, {
  grass: [0x1e2228, 0x2a3038, 0x384048, 0x4a525a, 0x5e666e, 0x767e86],
  road: [0x14161a, 0x1e2226, 0x2a2e34, 0x3a4048],
  dome: [0x3a4048, 0x545a62, 0x6e747c, 0x8a9098, 0xa8aeb4],     // concrete
  band: [0x22262c, 0x30343c, 0x40464e, 0x545a62],
  glass: [0x1a1a22, 0x2a2a36, 0x4a4a5a, 0x8a8aa0],
  leaf: [0x22262a, 0x30343a, 0x40464c, 0x545a60, 0x6a7076],
  trunk: [0x1a1412, 0x2e221c, 0x4a3022, 0x6a4028],              // rebar, burnt car shells
  stone: [0x2e3238, 0x464c54, 0x60666e, 0x7e848c],
});
// puddles mirror the grey sky; a few windows, fires and craters still glow
const FUT = { sky: [0x4e5866, 0x6a7480, 0x8a929c, 0xc4ccd4], lit: [0xe8a050, 0x9aaab8], fire: [0x5a1a0e, 0xa03a14, 0xe0702a, 0xffb050], fleck: [0xc4d0dc, 0x8a96a2] };
const PLANET_EVERY = 1e6;   // the first trip to another world at 1M best power, then at 4x your best each time: namek, planet vegeta, snake way, beerus' planet, west city, kame house, mount paozu, the future, in turn
const WORLDS = [{ name: "king kai's planet", tones: KAI, sea: [0xe2a93a, 0xf3c55a, 0xf9dd8c, 0xfff2c8] }, { name: 'namek', tones: NAMEK, sea: [0x1e7a7a, 0x2fa59a, 0x6cd1bf, 0xc6f2e6] }, { name: 'planet vegeta', tones: VEGETA, sea: [0x7a2a1c, 0xa83a24, 0xd0603a, 0xf09a6a] }, { name: 'snake way', tones: KAI, sea: [0xc8642a, 0xe08a3a, 0xf4b45a, 0xfde0a0] }, { name: "beerus' planet", tones: BEERUSP, sea: [0x4a2a7a, 0x6a3ea0, 0x9a6ad0, 0xd8c0f0] }, { name: 'west city', tones: EARTH, sea: [0xd2dce8, 0xe6edf5, 0xf4f8fc, 0xffffff] }, { name: 'kame house', tones: KAMEP, sea: [0xd2dce8, 0xe6edf5, 0xf4f8fc, 0xffffff] }, { name: 'mount paozu', tones: PAOZU, sea: [0xd2dce8, 0xe6edf5, 0xf4f8fc, 0xffffff] }];
function useWorld(w) { for (const [k, v] of Object.entries(WORLDS[w].tones)) TONES[k].splice(0, TONES[k].length, ...v); }

// preview hooks (#raid, #snake, ...) jump straight to things for testing; on the live site they're ignored so nobody can cheat with them
const HASH = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\]|.*\.localhost|.*-git-.*\.vercel\.app)$/.test(location.hostname) ? location.hash : '';   // preview hooks only on dev hosts and branch previews, never on a live copy of the site
WORLDS[8] = { name: 'the future', tones: FUTURE, sea: [0x1e242c, 0x323a44, 0x4e5864, 0x7a8692] };
GAMES.push({
  id: 'planet',
  mount(st, ui) {
    const SAVE = 'hs-power';
    const S = { pl: 0, best: 0, boots: 0, partner: 0, gravity: 0, cloud: 0, scouter: 0, galick: 0, senzu: 0, house: 0, armor: 0, kaio: 0, bigbang: 0, piccolo: 0, chamber: 0, spirit: 0, world: 0, orbs7: 0, wishes: 0, ascend: 0, form: 0, seeds: 0, tree: {}, saga: 0, runBest: 0 };
    // every visit starts from zero, achievements and heroes included; only the date of the last daily bonus carries over
    const KEEP = ['daily'];
    try { const saved = JSON.parse(localStorage.getItem(SAVE) || '{}'); for (const k of KEEP) if (k in saved) S[k] = saved[k]; } catch (_) {}
    delete S.gold;
    // goku and gohan fire a blue kamehameha; vegeta and trunks a purple galick gun
    const kame = () => S.hero === 'goku' || S.hero === 'gohan';
    const BEAMS = { galick: { aim: 0x9a5af0, ball: 0xd9b8ff, ballEdge: 0x8a4ae8, spark: 0xc9a2ff, glow: 0xb98af8, mid: 0xe2cbff, edge: 0x7a3ae0 }, kame: { aim: 0x4aa8f0, ball: 0xb8e4ff, ballEdge: 0x2a8ae8, spark: 0xa2d8ff, glow: 0x7ac8ff, mid: 0xcdeeff, edge: 0x1f6ad8 } };
    const BEAM = () => kame() ? BEAMS.kame : BEAMS.galick;
    delete S.nextSuper;
    // transformations: unlocked by power level, permanent until you ascend
    const AURAS = [[0xffffff, 0xffc2e2, 0xf05aa8], [0xffffff, 0xb8f5dc, 0x2fbf8a], [0xffffff, 0xffd8a0, 0xf28a1c], [0xffffff, 0xd9c8ff, 0x7a4ae0]];   // capsule cosmetics for the base form
    const FORMS = [
      { name: 'base', at: 0, x: 1, aura: [0xffffff, 0xbfe9ff, 0x6fb0ff] },
      { name: 'super saiyan', at: 2e4, x: 1.5, aura: [0xffffff, 0xfff8b0, 0xffe02e] },
      { name: 'super saiyan 2', at: 2e5, x: 2, aura: [0xffffff, 0xfff8b0, 0xffe02e], sparks: 0x9fdcff },
      { name: 'super saiyan 3', at: 2e6, x: 3, aura: [0xffffff, 0xfff8b0, 0xffd60a], sparks: 0x9fdcff },
      { name: 'super saiyan god', at: 2e7, x: 4, aura: [0xffd0c0, 0xff7a5a, 0xd8344a] },
      { name: 'super saiyan blue', at: 2e8, x: 6, aura: [0xffffff, 0x9fe6ff, 0x2f9ae0] },
      { name: 'ultra ego', at: 2e9, x: 8, aura: [0xe6d6ff, 0xa070f0, 0x4a1f9a], sparks: 0xc9a2ff },
      { name: 'super saiyan 4', at: 2e10, x: 12, aura: [0xffffff, 0xff9a8a, 0xc8302a], sparks: 0xffd0a0 },
      { name: 'ultra instinct', at: 2e11, x: 16, aura: [0xffffff, 0xd8e8ff, 0x8aa0c8], sparks: 0xffffff },
    ];
    S.form = Math.min(S.form || 0, FORMS.length - 1);
    const save = () => { try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (_) {} };
    const SHOP = {
      boots: { base: 50, k: 1.7, label: 'weighted boots', what: '+1 per step' },
      partner: { base: 250, k: 1.7, label: 'bubbles', what: '+4/s, trains with you' },
      gravity: { base: 2500, k: 2.6, label: 'gravity chamber', what: '×1.15 everything' },
      cloud: { base: 1000, k: 2.2, label: 'flying nimbus', what: 'comes more often' },
      scouter: { base: 800, k: 2.1, label: 'scouter', what: '+10% crits (×2)', unlock: () => S.best >= 150 },
      galick: { base: 1500, k: 2.3, get label() { return kame() ? 'kamehameha' : 'galick charge'; }, what: 'hold to charge a beam', unlock: () => S.best >= 400 },
      senzu: { base: 4000, k: 2.2, label: 'senzu tree', what: 'beans: tap for ×1.5', unlock: () => S.best >= 1000 },
      house: { base: 6000, k: 2.3, label: 'capsule house', what: '+40/s (a new dome up to lv 9)', unlock: () => S.best >= 2000 },
      armor: { base: 12000, k: 2.4, label: 'saiyan armor', what: '+50% vs villains & saibamen', unlock: () => S.best >= 5000 },
      kaio: { base: 20000, k: 2.6, label: 'kaioken', what: 'red button: big boost, then tired', unlock: () => S.best >= 8000 },
      bigbang: { base: 60000, k: 2.5, label: 'big bang attack', what: 'double-tap: an exploding ki ball', unlock: () => S.best >= 20000 },
      piccolo: { base: 30000, k: 2.4, label: 'piccolo', what: '+60/s, zaps meteors', unlock: () => S.best >= 10000 },
      chamber: { base: 150000, k: 2.8, label: 'time chamber', what: 'a door appears: train ×2 inside', unlock: () => S.best >= 40000 },
      ascend: { base: 1e6, k: 1, label: 'ascend', what: 'reset for ki seeds', unlock: () => S.best >= 1e6 },
    };
    const RESETS = ['boots', 'partner', 'gravity', 'cloud', 'scouter', 'galick', 'senzu', 'house', 'armor', 'kaio', 'bigbang', 'piccolo', 'chamber'];
    const cost = k => k === 'ascend' ? Math.max(1e6, Math.floor(S.pl)) : Math.floor(SHOP[k].base * Math.pow(SHOP[k].k, S[k]) * (1 - .05 * lvl('deal')));   // ascending spends all you hold (1M at least), so that's its price
    // permanent: gravity ×1.15 a level, wishes ×1.25 each, ascensions +10% each; temporary boosts add up rather than multiply
    const KAIO = () => 1.25 + .25 * S.kaio;
    // milestones: every 10th, 25th, 50th and 100th level of a producer doubles its output
    const MILES = { boots: 1, partner: 1, house: 1, piccolo: 1 }, MS = [10, 25, 50, 100];
    const ms = k => 2 ** MS.filter(n => S[k] >= n).length, nextMile = k => MS.find(n => S[k] < n);
    // the training tree: ki seeds from ascending buy ranks; every seed you've earned also boosts everything, spent or not
    const TREE = [
      { id: 'fist', branch: 'body', tier: 0, name: 'iron fist', what: 'taps +50% a rank', max: Infinity },
      { id: 'crit', branch: 'body', tier: 0, name: 'eagle eye', what: '+8% crit chance a rank', max: 5 },
      { id: 'legs', branch: 'body', tier: 1, name: 'road work', what: 'lap bonus +50% a rank', max: Infinity },
      { id: 'brawl', branch: 'body', tier: 1, name: 'brawler', what: 'villain taps +50% a rank', max: Infinity },
      { id: 'critx', branch: 'body', tier: 2, name: 'pressure point', what: 'crits hit ×1 harder a rank', max: Infinity },
      { id: 'pride', branch: 'body', tier: 3, name: 'saiyan pride', what: 'combo goes to ×4', max: 1 },
      { id: 'idle', branch: 'spirit', tier: 0, name: 'meditation', what: 'idle income +50% a rank', max: Infinity },
      { id: 'beam', branch: 'spirit', tier: 0, name: 'ki control', what: 'beams +50% a rank', max: Infinity },
      { id: 'chamber', branch: 'spirit', tier: 1, name: 'patience', what: 'time chamber +5s a rank', max: Infinity },
      { id: 'seedx', branch: 'spirit', tier: 1, name: 'zenkai', what: 'each ki seed +2% more a rank', max: Infinity },
      { id: 'auto', branch: 'spirit', tier: 2, name: 'instinct', what: 'an auto tap every second a rank', max: Infinity },
      { id: 'eternal', branch: 'spirit', tier: 3, name: 'eternal ki', what: 'idle income ×3', max: 1 },
      { id: 'pods', branch: 'fate', tier: 0, name: 'pod magnet', what: 'space pods 12% sooner a rank', max: 5 },
      { id: 'balls', branch: 'fate', tier: 0, name: 'dragon radar', what: '+5% dragon ball orbs a rank', max: 5 },
      { id: 'bounty', branch: 'fate', tier: 1, name: 'bounty hunter', what: 'villain prizes +50% a rank', max: Infinity },
      { id: 'deal', branch: 'fate', tier: 1, name: 'bulma\'s discount', what: 'every upgrade costs 5% less a rank', max: 5 },
      { id: 'wish', branch: 'fate', tier: 1, name: 'shenron\'s favour', what: 'each wish +5% more a rank', max: Infinity },
      { id: 'head', branch: 'fate', tier: 2, name: 'head start', what: 'keep 1% of your power a rank when you ascend', max: 3 },
      { id: 'saga', branch: 'fate', tier: 3, name: 'legend', what: 'saga villains drop a ki seed', max: 1 },
    ];
    const TIER_COST = [1, 2, 5, 15], TIER_NEED = [0, 4, 8, 12];   // seeds per rank, and points in the branch to open the tier
    const lvl = id => S.tree[id] || 0, rankCost = (n, r) => TIER_COST[n.tier] * 2 ** Math.floor(r / 5), nodeCost = n => rankCost(n, lvl(n.id)), nodeMax = n => n.max;   // uncapped nodes cost double every 5 ranks
    const branchPts = b => TREE.filter(n => n.branch === b).reduce((a, n) => a + lvl(n.id), 0), nodeOpen = n => branchPts(n.branch) >= TIER_NEED[n.tier];
    const seedBoost = () => 1 + S.ascend * (.1 + .02 * lvl('seedx')), comboCap = () => lvl('pride') ? 4 : 2;
    const tapPower = () => 1 + S.boots * ms('boots') + passive() / 10;   // villain taps keep pace with idle builds
    const seedsNow = () => Math.max(1, Math.floor(Math.sqrt(S.pl / 1e4)));   // 1M → 10, 100M → 100, 10B → 1000
    const chamberLen = () => 10 + 5 * S.chamber + 5 * lvl('chamber');
    const ECON = .35;   // every gain runs through mult(); an active player reaches super saiyan god in about half an hour
    const mult = (bare) => {   // permanent boosts multiply; temporary ones add their bonuses, so a pile of buffs can't explode
      const T = st.t, b = bare ? 1 : 1 + (carUntil > T) * .5 + (boostUntil > T) * 1 + (apeUntil > T) * 2 + (senzuUntil > T) * .5 + (riding > 0) * .5 + (kaioUntil > T ? KAIO() - 1 : 0) + (dailyUntil > T) * .25 + (fuseUntil > T) * 1 + (fused && fused.until > T ? fused.x - 1 : 0) + (laughUntil > T) * .25 + (chamberUntil > T) * 1 + (rageUntil > T) * (rage - 1) + (chiUntil > T) * .5 + (roshiUntil > T) * .5 + (calmUntil > T) * .25 + (gadgetUntil > T) * .5;
      return Math.pow(1.15, S.gravity) * Math.pow(1.25 + .05 * lvl('wish'), S.wishes) * seedBoost() * FORMS[S.form].x * b * (kaioUntil <= T && tiredUntil > T ? .75 : 1) * (bz && bz.awake ? .25 : 1) * ECON;
    };
    const lapValue = () => 30 * (1 + S.boots * ms('boots'));
    const passive = () => (S.partner * 4 * ms('partner') + S.house * 40 * ms('house') + S.piccolo * 60 * ms('piccolo')) * (1 + .5 * lvl('idle')) * (lvl('eternal') ? 3 : 1) * (S.krillinAlly ? 1.5 : 1);
    let laughUntil = 0, chamberUntil = 0, chamberT0 = 0, echo = null, door = null, nextDoor = 60, kai = null, nextKai = 50, greg = null, nextGreg = 70, ship = null, nextShip = 200, nextNappa = 0, car = null, nextCar = 140, carUntil = 0, poseUntil = 0, storm = null, nextStorm = 240, spirit = 0, spiritReady = false, spiritShot = null, struggle = null, yam = null, nextYam = 130, zap = null, nextZap = 4, ginyu = null, nextGinyu = 160;
    let gadgets = [], nextGadget = 2, robotUntil = 0, robotAcc = 0, autoAcc = 0, gadgetUntil = 0, bikeUntil = 0, calmUntil = 0, nextAndro = 340, date = null, nextDate = 300, gero = null, nextGero = 230, a16 = null, nextA16 = 180;
    let bz = null, pud = null;   // beerus asleep on his planet, and the pudding that calms him
    let bangReady = 0, whisUntil = 0, whisReady = 0, chiUntil = 0, chiReady = 0, kameReady = 0, dance = null, fused = null, nextDance = 300, cling = null, nextCling = 200, preview = null, rage = 2, rageUntil = 0, roshiUntil = 0, roshi = null, nextRoshi = 200, kril = null, nextKril = 260, satan = null;
    let dailyUntil = 0, fuseUntil = 0, fuseOffer = 0, nextFuse = 150, monkeyAt = null, kaioUntil = 0, tiredUntil = 0, kaioReady = 0, bang = null, blasts = [], lastTap = { t: -9, x: 0, y: 0 }, capsule = null, tour = null, nextTour = 45, namekUntil = 0;
    if (!(S.namekLeft > 0)) S.world = 0;   // namek is a visit; a visit in progress survives a reload
    let saibas = [], nextSaiba = 40, boss = null, nextBoss = 120, kis = [];
    let night = false, nightK = 0, shake = 0, moon = null, nextMoon = 150, apeUntil = 0, apeStep = 0, flashT = 0, senzuUntil = 0, combo = 1, lastClick = -9, charging = 0, beam = null, bean = null, nextBean = 30;
    ui.onBuy(k => {
      const c = cost(k); if (S.pl < c) return;
      if (k === 'ascend') {
        // seeds grow with the square root of the power you give up; forms and trips start over from base
        const gainA = seedsNow(), keep = Math.floor(S.pl * .01 * lvl('head')); S.ascend += gainA; S.seeds += gainA; ach('ascend'); S.pl = keep; S.runBest = keep; S.namekAt = 0; for (const r of RESETS) S[r] = 0; S.form = 0; preview = null; ui.fx && ui.fx('form', S.form); scenery();
        ui.event(`ascended — +${gainA} ki seed${gainA > 1 ? 's' : ''} (×${seedBoost().toFixed(1)} on everything), back to ${FORMS[S.form].name}: spend seeds in menu → training`, 4500); ui.fx && ui.fx('super'); save(); syncShop(); return;
      }
      S.pl -= c; S[k]++; ui.fx && ui.fx('buy');
      if (k === 'partner' && S.partner === 1) ui.event('bubbles wants to train with you');
      if (k === 'galick' && S.galick === 1) ui.event(`hold anywhere to charge a ${kame() ? 'kamehameha' : 'galick gun'}`);
      if (k === 'house') { scenery(); ui.event('a new capsule house lands'); }
      if (k === 'piccolo' && S.piccolo === 1) ui.event('piccolo lands to meditate');
      if (k === 'chamber' && S.chamber === 1) ui.event('the time chamber door will appear — tap it');
      if (k === 'kaio' && S.kaio === 1) ui.event('kaioken unlocked — hit the red button');
      if (k === 'bigbang' && S.bigbang === 1) ui.event('big bang attack — double-tap anywhere');
      if (k === 'armor' && S.armor === 1) ui.event('saiyan armor on — hit villains harder');
      save(); syncShop();
    });
    const what = k => k === 'ascend' ? `reset for +${seedsNow()} ki seeds` : MILES[k] && S[k] && nextMile(k) ? `${SHOP[k].what} · ×2 at lv ${nextMile(k)}` : k === 'chamber' && S.chamber ? `train ×2 for ${chamberLen()}s` : k === 'kaio' && S.kaio ? `×${KAIO()} for 15s, then ×0.75` : k === 'bigbang' && S.bigbang ? `blast radius +${S.bigbang * 25}%` : k === 'galick' && S.galick ? (S.galick === 4 ? `beam ×1.6 · next: ${kame() ? 'super kamehameha' : 'final flash'}` : S.galick >= 5 ? `beam ×1.6 (now ×${fmtShort(Math.round(1.6 ** S.galick))}) · full charge ×3` : 'beam ×1.6') : SHOP[k].what;
    const syncShop = () => ui.shop(Object.fromEntries(Object.keys(SHOP).filter(k => !SHOP[k].unlock || SHOP[k].unlock() || S[k] > 0).map(k => [k, { cost: cost(k), level: k === 'ascend' ? S.ascend : S[k], label: SHOP[k].label, what: what(k), can: S.pl >= cost(k), special: k === 'ascend' }])));

    // the planet: a road ring near the rim, a cap of scenery facing the viewer
    const N = V.norm([0, .38, .92]);
    const E1 = V.norm(V.cross([0, 1, 0], N)), E2 = V.cross(N, E1);
    const roadPt = phi => V.norm(V.add(V.mul(E1, Math.cos(phi)), E2, Math.sin(phi)));
    const capPt = (th, a) => V.norm(V.add(V.mul(N, Math.cos(th)), V.add(V.mul(E1, Math.cos(a)), E2, Math.sin(a)), Math.sin(th)));
    const L = V.norm([-.55, .7, .55]);
    const solids = [];                       // { c: body centre, r, kind, ... }
    const wcRoads = [];                      // west city streets painted on the ground: { n, lo, hi, a, b, pave }
    // mount paozu: karst pillars, round forest, goku's dome house by the water
    let pzWater = null, pzDinos = [];   // surface water test, walking dinos
    const PZ_ROOF = [0x6a1a10, 0x9a2c1a, 0xc8432a, 0xe86a44, 0xffa070], PZ_WATER = [0x1a4a7a, 0x2a6aa8, 0x4a94d0, 0x8ac8ee, 0xdaf2ff], PZ_MIST = [0xaab6be, 0xc6d0d6, 0xdee6ea, 0xf2f6f8, 0xffffff];
    function paozuScenery(bush, rock) {
      let sd = 12; const rnd = () => (sd = sd * 16807 % 2147483647) / 2147483647, pal = (c, r, p, lift = 0) => solids.push({ c, r, kind: 'pal', pal: p, lift });
      // a karst tower: lumpy stacked stone that bulges midway, mossy ledges, a cap of forest
      const pillar = (th, a, h, r, lean = 0, cap = 'leaf') => { const s = capPt(th, a), t1 = V.norm(V.cross(s, N)), t2 = V.cross(s, t1), n = Math.ceil(h / (r * .4)); let top = s;
        for (let i = 0; i <= n; i++) { const f = i / n, w = r * (.8 + .35 * Math.sin(Math.PI * Math.min(1, f * 1.1))) * (1 - .25 * f); top = V.add(V.add(V.mul(s, 1 + h * f), t1, lean * f * f + (rnd() - .5) * r * .3), t2, (rnd() - .5) * r * .3); solids.push({ c: top, r: w, kind: 'karst' });
          if (i > 1 && i < n - 1 && rnd() < .3) solids.push({ c: V.add(top, rnd() < .5 ? t1 : t2, (rnd() < .5 ? -1 : 1) * w * .8), r: w * .42, kind: 'leaf' }); }
        if (cap === 'leaf') solids.push({ c: V.mul(top, 1 + r * .45), r: r * .85, kind: 'leaf' }, { c: V.add(V.mul(top, 1 + r * .8), t1, r * .35), r: r * .5, kind: 'leaf' });
        return top; };
      const round = (th, a, k = 1) => { const s = capPt(th, a); solids.push({ c: V.mul(s, 1 + .03 * k), r: .02 * k, kind: 'trunk' }, { c: V.mul(s, 1 + .085 * k), r: .065 * k, kind: 'leaf' }); };
      const forest = (th0, a0, n, sp, f = round) => { for (let i = 0; i < n; i++) { const th = th0 + (rnd() - .5) * sp, a = a0 + (rnd() - .5) * sp * 2 / Math.max(.3, Math.sin(th)); if (Math.abs(th - 1.571) > .13 && !(pzWater && pzWater(capPt(th, a)))) f === round ? round(th, a, .65 + rnd() * .5) : pine(capPt(th, a), .9 + rnd() * .5); } };
      // goku's house: a white dome with a red roof cap and a stovepipe chimney; little side huts
      const house = (th, a, r) => { const s = capPt(th, a), door = V.mul(V.norm(V.cross(s, V.cross(N, s))), -1); solids.push({ c: s, r, kind: 'dome', s, door }); pal(V.mul(s, 1 + r * .55), r * .6, PZ_ROOF);
        for (let i = 0; i <= 3; i++) solids.push({ c: V.add(V.mul(s, 1 + r * .62 + .022 * i), door, -r * .42), r: .016, kind: 'stone' }); };
      const hut = (th, a, r) => { const s = capPt(th, a); solids.push({ c: s, r, kind: 'dome', s, door: V.mul(V.norm(V.cross(s, V.cross(N, s))), -1) }); };
      const river = (A, w, F) => nb => Math.abs(V.dot(nb, A) + .05 * Math.sin(V.dot(nb, F) * 9)) < w;
      const dino = (spr, th, a, k, sway = .3, hop = 1) => pzDinos.push({ spr, th, a, k, sway, hop });
      const [B, C] = [DINOS.b, DINOS.c], UP = Math.PI / 2;
      // the karst forest: a ring of green-capped towers, round trees everywhere, a winding river past the house
      pzWater = river(V.norm(V.add(E1, E2, -.8)), .032, E2);
      [[1.08, .3, .42, .1], [1.15, .95, .32, .085], [1.8, .9, .72, .11], [1.8, 2.15, .62, .1], [1.85, 2.7, .7, .11], [1.1, 2.6, .36, .09], [1.08, 3.4, .48, .1], [1.2, 4.2, .3, .08], [1.05, 5.4, .4, .1], [2.1, 3.0, .4, .09], [1.95, 4.6, .5, .1], [2.15, 5.9, .36, .085]].forEach(([th, a, h, r]) => pillar(th, a, h, r, (rnd() - .5) * .06));
      forest(.85, .6, 10, .4); forest(.8, 4.6, 12, .45); forest(.55, 5.6, 6, .3); forest(.95, 2.4, 8, .3); forest(2.2, 2.2, 14, .6); forest(2.3, 4.8, 12, .6);
      house(.55, 3.5, .15); hut(.66, 4.0, .08);
      bush(.7, 2.0, .05); bush(.32, 3.9, .04); rock(.75, 3.0, .04); rock(.6, 5.0, .035);
      dino(B, .3, 4.9, .5, .7); dino(C, .36, 2.3, .55, .5, .4);
    }
    const slabs = [];                        // the future's skyscrapers: { b: base, t: top, w: half-width, seed }
    function scenery() {
      solids.length = 0; wcRoads.length = 0; slabs.length = 0;
      if (S.world === 5) return westcityScenery();
      if (S.world === 6) return kameScenery();
      if (S.world === 8) return futureScenery();
      const dome = (th, a, r) => { const s = capPt(th, a), door = V.norm(V.cross(s, V.cross(N, s))); solids.push({ c: s, r, kind: 'dome', s, door: V.mul(door, -1) }); for (let i = 1; i <= 5; i++) solids.push({ c: V.mul(s, 1 + r + .018 * i), r: .009, kind: 'trunk' }); solids.push({ c: V.mul(s, 1 + r + .11), r: .02, kind: 'knob' }); };
      const tree = (th, a, k = 1) => S.world === 2 ? spire(th, a, k) : S.world ? ajissa(th, a, k) : kaiTree(th, a, k);
      const spire = (th, a, k) => { const s = capPt(th, a); for (let i = 0; i <= 8; i++) solids.push({ c: V.mul(s, 1 + .05 * i * k), r: (.1 - .011 * i) * k, kind: 'stone' }); };   // planet vegeta: jagged rock spires
      const ajissa = (th, a, k) => { const s = capPt(th, a); for (let i = 1; i <= 7; i++) solids.push({ c: V.mul(s, 1 + .05 * i * k), r: .022 * k, kind: 'trunk' }); solids.push({ c: V.mul(s, 1 + .42 * k), r: .12 * k, kind: 'leaf' }, { c: V.mul(s, 1 + .52 * k), r: .08 * k, kind: 'leaf' }); };
      const kaiTree = (th, a, k = 1) => { const s = capPt(th, a), t1 = V.norm(V.cross(s, N)); for (let i = 1; i <= 4; i++) solids.push({ c: V.mul(s, 1 + .045 * i * k), r: .03 * k, kind: 'trunk' }); solids.push({ c: V.add(V.mul(s, 1 + .26 * k), t1, .05 * k), r: .13 * k, kind: 'leaf' }, { c: V.add(V.mul(s, 1 + .2 * k), t1, -.08 * k), r: .1 * k, kind: 'leaf' }, { c: V.mul(s, 1 + .33 * k), r: .09 * k, kind: 'leaf' }); };
      const bush = (th, a, r) => solids.push({ c: capPt(th, a), r, kind: 'leaf' });
      const rock = (th, a, r) => solids.push({ c: V.mul(capPt(th, a), 1 - r * .3), r, kind: 'stone' });
      pzWater = null; pzDinos = [];
      if (S.world === 7) return paozuScenery(bush, rock);
      dome(.3, 2.5, .25); dome(.82, 3.55, .17);
      [[.75, 1.9, .15], [.6, 5.1, .16], [1.05, 4.0, .13], [2.0, 2.2, .16], [2.3, 4.2, .15], [1.9, .05, .14], [2.6, 5.8, .13], [3.0, 2.4, .15], [1.25, 2.65, .12]].slice(0, Math.min(9, S.house)).forEach(([a, b, r]) => dome(a, b, r));
      tree(.95, .5, 1.05); tree(.62, 1.35, .85); tree(1.0, 5.0, .95); tree(.55, 5.8, .7); tree(2.25, 1.2, 1); tree(2.5, 3.4, 1.1); tree(2.1, 5.2, .9); tree(2.75, .2, .8);
      bush(.7, 4.3, .07); bush(.98, 2.2, .06); bush(.4, .9, .05); bush(1.1, 3.0, .06); bush(2.3, 2.3, .08); bush(2.6, 4.5, .07);
      rock(.62, 4.05, .05); rock(1.05, 1.7, .04); rock(2.4, .6, .05);
    }
    // west city: capsule corp and the rounded towers around it, built from the same spheres
    function westcityScenery() {
      const put = (c, r, kind, o) => solids.push(Object.assign({ c, r, kind }, o));
      const face = s => V.norm(V.add([0, 0, 1], s, -s[2]));   // the side that looks at the camera at rest
      const frame = n => { const a = V.norm(V.cross(n, Math.abs(n[0]) < .9 ? [1, 0, 0] : [0, 1, 0])); return [a, V.cross(n, a)]; };
      const onCircle = (n, r, q, h) => { const [a, b] = frame(n); return V.mul(V.norm(V.add(V.mul(n, Math.cos(r)), V.add(V.mul(a, Math.cos(q)), b, Math.sin(q)), Math.sin(r))), h); };
      const ring = (n, r, w, pave) => { const [a, b] = frame(n), c = Math.cos(r); wcRoads.push({ n, lo: pave ? c : c - w, hi: pave ? 2 : c + w, a, b, pave }); };
      const street = (n, w) => ring(n, Math.PI / 2, w);
      // capsule corp hq: the big lettered dome; text 0 makes a plain capsule house with a door
      const hq = (th, a, r, text = 1, p = 'hull') => { const s = capPt(th, a), door = face(s); put(s, r, 'hq', { s, door, side: V.cross(s, door), text, p }); };
      // a round tower: one sphere per floor with a window ribbon round its waist, a dome on top, an antenna
      const tower = (th, a, h, r, p = 'hull', top = 'pane', w = .16) => { const s = capPt(th, a); for (let z = 0; z <= h; z += r * .85) put(V.mul(s, 1 + z), r, 'tower', { s, p, w }); put(V.mul(s, 1 + h + r * .55), r * .78, 'tower', { s, p: top }); for (let i = 1; i <= 4; i++) put(V.mul(s, 1 + h + r * 1.2 + .016 * i), .008, 'tower', { s, p: 'stone' }); return s; };
      const palm = (th, a, k = 1) => { const s = capPt(th, a), t1 = V.norm(V.cross(s, N)), t2 = V.cross(s, t1); for (let i = 1; i <= 7; i++) put(V.add(V.mul(s, 1 + .045 * i * k), t1, .05 * k * (i / 7) ** 2), .017 * k, 'trunk'); const top = V.add(V.mul(s, 1 + .33 * k), t1, .05 * k); put(top, .03 * k, 'leaf'); for (let j = 0; j < 6; j++) { const d = V.add(V.mul(t1, Math.cos(j * 1.05)), t2, Math.sin(j * 1.05)); for (let q = 1; q <= 3; q++) put(V.add(V.add(top, d, .045 * q * k), s, -.012 * q * q * k), (.03 - .005 * q) * k, 'leaf'); } };
      // hover cars glide round a circle on the planet: a coloured body under a glass bubble
      const car = (n, r, q0, w, p = 'peach', h = 1.05, k = 1) => { for (const [dq, dh, rr, pp] of [[-.032 * k, 0, .034 * k, p], [.032 * k, 0, .034 * k, p], [0, .03 * k, .024 * k, 'pane']]) { const fly = t => onCircle(n, r, q0 + dq / Math.sin(r) + w * t, h + dh); put(fly(0), rr, 'tower', { p: pp, fly }); } };
      const bush = (th, a, r) => put(capPt(th, a), r, 'leaf');
      const PAST = ['hull', 'peach', 'aqua'];
      const houses = spots => spots.slice(0, Math.min(spots.length, S.house)).forEach(([a, b, r], i) => hq(a, b, r, 0, PAST[i % 3]));
      // capsule corp hq on the skyline, a ring road round a park in front
      street(E1, .03); ring(N, .62, .03); ring(capPt(.32, 3.9), .15, 0, 'pool'); ring(capPt(.45, 1.6), .2, 0, 'pave');
      hq(.9, 1.6, .38); hq(1.0, .98, .2, 0); tower(1.1, 2.25, .3, .06);
      tower(1.75, 1.0, .5, .07); tower(1.9, .7, .7, .06, 'aqua'); tower(1.8, 2.4, .6, .08, 'peach'); tower(2.0, 2.1, .9, .065);
      palm(.95, .5); palm(.62, 3.3, .85); palm(1.05, 5.6, .9); palm(.75, 4.6); palm(1.2, 3.2, 1.1); palm(.4, 2.5, .7); palm(.4, 1.3, .7);
      hq(.85, 4.0, .1, 0, 'peach'); hq(.95, 5.0, .1, 0, 'aqua'); hq(.85, .3, .1, 0);
      car(N, .62, 0, .5); car(N, .62, 2.5, .5, 'aqua'); car(E1, Math.PI / 2, 1, -.4, 'hull');
      bush(.3, 5.2, .05); bush(.55, 5.6, .04); bush(.2, .6, .045);
      houses([[1.0, 3.5, .1], [.45, 5.3, .1], [1.15, 4.5, .1], [1.25, 3.85, .09], [.3, 5.85, .09], [.85, .9, .1], [1.25, 5.2, .1], [.85, 2.8, .09], [1.25, .2, .1]]);

    }
    // kame house: an island cap with roshi's house and palms, open sea all round; you surf across it
    let kh = null;   // { house, roshi }: where the sprites stand
    function kameScenery() {
      const palm = (th, a, k = 1, lean = 0) => {
        const s = capPt(th, a), t1 = V.norm(V.cross(s, N)), t2 = V.cross(s, t1);
        for (let i = 1; i <= 8; i++) { const f = i / 8; solids.push({ c: V.add(V.mul(s, 1 + .34 * k * f), t1, lean * .1 * k * f * f), r: (.028 - .008 * f) * k, kind: 'trunk' }); }
        const C = V.add(V.mul(s, 1 + .36 * k), t1, lean * .1 * k); solids.push({ c: C, r: .045 * k, kind: 'leaf' });
        for (let j = 0; j < 6; j++) { const d = V.add(V.mul(t1, Math.cos(j * 1.05 + .3)), t2, Math.sin(j * 1.05 + .3)); for (let m = 1; m <= 4; m++) solids.push({ c: V.add(V.add(C, d, .055 * m * k), s, (.02 * m - .014 * m * m) * k), r: (.042 - .006 * m) * k, kind: 'leaf' }); }   // fronds arch out and droop
        for (let j = 0; j < 3; j++) solids.push({ c: V.add(V.add(C, s, -.035 * k), V.add(V.mul(t1, Math.cos(j * 2.1)), t2, Math.sin(j * 2.1)), .025 * k), r: .02 * k, kind: 'trunk' });   // coconuts
      };
      const rock = (th, a, r) => solids.push({ c: V.mul(capPt(th, a), 1 - r * .3), r, kind: 'stone' });
      kh = { house: capPt(.1, 4.71), roshi: capPt(.34, 4.45) };
      palm(.5, 5.95, 1, .8); palm(.48, 3.3, .85, -.7); rock(.72, 5.6, .045); rock(.62, 1.6, .035);
    }
    // the sea shader: e is how far inland a point is (negative is out to sea); sand, wet sand, a line of surf, shallows, then deep water
    function shadeKame(nb, lum, x, y) {
      const c = V.dot(nb, N), w = vnoise3(nb[0] * 5 + 3, nb[1] * 5, nb[2] * 5 + 7) - .5, t = st.t;
      const e = c - .66 + w * .1;
      if (e < -.1 && Math.abs(c) < .02) { const a = Math.atan2(V.dot(nb, E2), V.dot(nb, E1)), back = ((phi - a) % 6.283 + 6.283) % 6.283; if (back < .9 && bayer(x, y) < (1 - back / .9) * .9) return lum > .35 ? 0xffffff : 0xcfe6f2; }   // your wake
      if (e > .03) return tone(TONES.road, lum + w * .35, x, y);
      if (e > 0) return tone(TONES.band, lum, x, y);
      if (e > -.02 - .01 * Math.sin(t * 2.2 + (nb[0] + nb[2]) * 20)) return lum + (bayer(x, y) - .5) * .3 > .45 ? 0xffffff : 0xcfe6f2;   // surf
      if (e > -.1) return tone(TONES.glass, lum + .1 + e * 2.5, x, y);
      const g = vnoise3(nb[0] * 22 + t * .15, nb[1] * 22, nb[2] * 22); if (g > .86 && lum > .45) return g > .9 ? 0xffffff : 0xbfe6ff;   // glints
      return tone(TONES.grass, lum + (w - .2) * .3, x, y);
    }
    // the future timeline: broken skyscrapers ring the rim, where they stand side-on against the sky; streets, wrecks and craters fill the middle
    const smokes = []; let futAndro = [];
    function futureScenery() {
      smokes.length = 0;
      // a skyscraper is a flat slab standing on the rim at screen angle deg, just behind the road so the runner passes in front;
      // back pushes it further round the planet so a taller row peeks over the front one, lean tips it over
      const tower = (deg, h, w, lean = 0, smoke = false, back = 0) => {
        const f = deg * Math.PI / 180, zr = -.38 * Math.sin(Math.atan2(Math.sin(f) / .92, Math.cos(f))), z = Math.min(zr, 0) - .04 - back, q = Math.sqrt(1 - z * z), b = [Math.cos(f) * q, Math.sin(f) * q, z];
        const s = V.norm(V.add(b, [-Math.sin(f), Math.cos(f), 0], lean)), t = V.add(b, s, Math.abs(lean) > 1 ? h : (1 + h) / q - 1); slabs.push({ b: V.mul(b, .97), t, w, seed: slabs.length * 7 + 3 }); if (smoke) smokes.push(V.add(t, s, .01));
      };
      const rubble = (th, a, r) => { const b = capPt(th, a), t1 = V.norm(V.cross(b, N)), t2 = V.cross(b, t1); solids.push({ c: V.mul(b, 1 - r * .3), r, kind: 'stone' }, { c: V.add(V.mul(b, 1 - r * .4), t1, r * .9), r: r * .7, kind: 'leaf' }, { c: V.add(V.mul(b, 1 - r * .5), t2, -r * .8), r: r * .6, kind: 'stone' }); };
      // a sphere sunk almost to its crown leaves a flat disc: a puddle of sky, or a crater still smouldering
      const pool = (th, a, r, lava = false) => { const b = capPt(th, a); solids.push({ c: V.mul(b, 1 - r * 2.3), r: r * 2.5, kind: 'pool', s: b, lava }); if (lava) smokes.push(V.mul(b, 1.02)); };
      // a burnt-out car: chassis and cab, nose along the road
      const car = (th, a) => { const b = capPt(th, a), d = V.norm(V.cross(N, b)); solids.push({ c: V.add(V.mul(b, 1 + .012), d, .022), r: .03, kind: 'trunk' }, { c: V.add(V.mul(b, 1 + .012), d, -.022), r: .03, kind: 'trunk' }, { c: V.mul(b, 1 + .04), r: .022, kind: 'stone' }); };
      // the skyline round the top and sides: a tall back row and a shorter front row filling its gaps, some leaning, two toppled across the rest
      for (let d = -32, i = 0; d <= 212; d += (5 + 6 * hash(i * 5.3)) * (1.5 - .7 * Math.max(0, 1 - Math.abs(d - 90) / 120)), i++) { const r1 = hash(i * 3.7), r2 = hash(i * 9.1 + 2), up = Math.max(0, 1 - Math.abs(d - 90) / 120); tower(d, (.22 + .45 * r1 * r1 + (r1 > .8 ? .2 : 0)) * (.3 + 1.5 * up * up), .065 + .03 * r2, r2 > .82 ? .25 : r2 < .12 ? -.2 : 0, i % 4 === 1, .07); if (r2 > .35) tower(d + 4, .1 + .14 * r2, .08 + .02 * r1); }
      tower(64, .3, .065, 1.6, false, .04); tower(150, .26, .06, -1.5, false, .04);
      // short broken blocks down the lower rims
      [-48, -58, 228, 238].forEach((d, i) => tower(d, .12 + .06 * (i % 2), .085));
      [[1.42, 4.0], [1.43, 4.5], [1.7, 4.8], [1.42, 5.2], [1.72, .2], [1.42, 2.9]].forEach(([th, a]) => car(th, a));
      [[.3, .9, .12], [.7, 1.3, .1], [.6, 3.0, .09], [.5, 4.5, .1], [1.05, 5.4, .12], [.25, 5.0, .09], [1.1, 3.5, .11]].forEach(([th, a, r]) => pool(th, a, r));
      pool(.85, 2.2, .14, true); pool(.95, 4.2, .12, true); pool(.15, 2.6, .1, true);
      rubble(.85, 2.8, .05); rubble(1.1, 1.7, .045); rubble(.45, 1.7, .04); rubble(.6, 5.8, .05); rubble(1.15, .6, .045); rubble(.4, 3.9, .045); rubble(1.2, 4.9, .04);
      futAndro = [capPt(1.3, 3.55), capPt(1.3, 3.78)];
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
    S.ach = S.ach || {}; if (S.ach.greg5) S.spirit = 1;   // the spirit bomb is king kai's reward for catching gregory, not something you buy
    if (!HEROES[S.hero] || !heroOpen(S.hero)) S.hero = 'vegeta';
    function heroOpen(id) { const c = CHARS.find(x => x.id === id); return !!c && (!c.need || !!S.ach[c.need]); }
    const FUT_GOHAN = capPt(1.3, 3.25);
    const standAng = v => Math.atan2(v[0], v[1]) * Math.min(1, (v[0] * v[0] + v[1] * v[1]) * 1.6);
    const WHIS_AT = capPt(.5, 3.3), CHI_AT = capPt(.45, 3.2), TURTLE_AT = capPt(.5, 5.2), OOLONG_AT = capPt(.62, 4.1);   // whis by beerus, chi-chi by the house, umigame and oolong on roshi's island
    // a krillin who follows you is the first thing every villain goes for: three in four raids, he's blown up on arrival
    const krillinHit = by => { if (!S.krillinAlly || kril || Math.random() > .75) return; kril = { c: roadPt(phi - .5), t0: st.t - 1, boom: st.t + 1.2, by }; ui.event(`${by} goes straight for krillin…`); };
    const DANCE = { vegeta: ['goku', 'gogeta'], goku: ['vegeta', 'gogeta'], gohan: ['videl', 'gohanVidel'], trunks: ['goten', 'gotenks'] };
    function HERO() { return HEROES[S.hero] || HEROES.vegeta; }
    function ach(id) {
      if (S.ach[id] || !playing) return; const a = ACH.find(x => x.id === id); if (!a) return;
      S.ach[id] = Date.now(); const c = CHARS.find(x => x.need === id);
      setTimeout(() => ui.event(`achievement — ${a.name}` + (c ? ` · ${c.name} unlocked` : ''), 3200), 900); ui.sfx && ui.sfx('coin'); ui.achieved && ui.achieved(); save();
    }
    const once = (key, text) => { if (seen.has(key)) return; seen.add(key); ui.event(text); };
    const gain = (n, x, y, gold) => { n = Math.max(1, Math.round(n)); S.pl += n; if (S.pl > S.best) S.best = S.pl; if (S.pl > S.runBest) S.runBest = S.pl; if (x !== undefined) floats.push({ x, y, s: '+' + fmtShort(n), life: 1, gold }); };
    const SUF = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
    const fmtShort = n => { if (n < 1e4) return String(n); let e = Math.floor(Math.log10(n) / 3), m = n / 10 ** (e * 3); if (+m.toFixed(m < 100 ? 1 : 0) >= 1000) { e++; m /= 1000; } return e < SUF.length ? m.toFixed(m < 100 ? 1 : 0) + SUF[e] : n.toExponential(1).replace('+', ''); };
    const floats = [];

    let flipNow = false, liftNow = 0, piccoloAt = null;
    function handPos() { const kd = kidScreen(); return { x: kd.x + Math.sin(kd.ang) * (liftNow + 12) + Math.cos(kd.ang) * 6 * (flipNow ? -1 : 1), y: kd.y - Math.cos(kd.ang) * (liftNow + 12) + Math.sin(kd.ang) * 6 * (flipNow ? -1 : 1), ang: kd.ang }; }
    function kidScreen(lift = 0) { const v = M3.ap(M, roadPt(phi)); return { v, x: cx + v[0] * (R + lift), y: cy - v[1] * (R + lift) + st.bob, ang: Math.atan2(v[0], v[1]) }; }
    function openCapsule() {
      const c = capsule; capsule = null; const roll = Math.random();
      burst(c.x, c.y, [0xffffff, 0xe4e6ea, 0xe0332b], 22, 140); flashT = .3;
      if (roll < .3) { senzuUntil = st.t + 15; ui.event('capsule: senzu beans — ×1.5 for 15s'); }
      else if (roll < .6) { const g = wrate() * 150; gain(g, c.x, c.y - 8, true); ui.event('capsule: +' + fmtShort(Math.round(g))); }
      else if (roll < .82) { S.orbs7++; if (S.orbs7 >= 7) { S.orbs7 = 0; summon(); } else ui.event(`capsule: a dragon ball! ${S.orbs7}/7`); goal('ball'); }
      else { S.aura = 1 + (((S.aura || 0) + (Math.random() * 3 | 0)) % AURAS.length); ui.event('capsule: a new aura colour'); }
      save();
    }
    function onClick(px, py) {
      if (!playing) return;
      if (S.world === 3 && snk) { snakeTap(px, py); return; }
      if (dance && !dance.done) { const b = dance.beats[dance.i]; if (b !== undefined && dance.spoil !== dance.i) { if (Math.abs(st.t - b) < .32) { dance.hits++; dance.ok = st.t; dance.i++; } else if (st.t > b - .8) dance.spoil = dance.i; } return; }   // the dance takes every tap; tapping just before a beat spoils it, so mashing fails
      const npcHit = (c, r = 12) => { const v = M3.ap(M, c); return v[2] > .05 && Math.hypot(px - (cx + v[0] * R), py - (cy - v[1] * R + st.bob - 10)) < r; };
      if (bz && st.t > whisReady && npcHit(WHIS_AT)) { whisReady = st.t + 45; whisUntil = st.t + 20; ui.event('whis: "ohohoho — a little training?" laps ×2 for 20s, but every tap is twice as loud'); ui.sfx && ui.sfx('buy'); return; }
      if (S.world === 7 && st.t > chiReady && npcHit(CHI_AT)) { chiReady = st.t + 40; chiUntil = st.t + 15; shake = .4; ui.event('chi-chi: "stop slacking and TRAIN!" — a frying pan to the head: ×1.5 for 15s'); ui.sfx && ui.sfx('hit'); return; }
      if (S.world === 6 && st.t > kameReady && (npcHit(TURTLE_AT, 14) || npcHit(OOLONG_AT))) { kameReady = st.t + 30; const turtle = npcHit(TURTLE_AT, 14), g = Math.max(200, rate() * (turtle ? 15 : 30)); gain(g, px, py - 10, true); ui.event(turtle ? `umigame wakes up, yawns, and goes back to sleep. +${fmtShort(Math.round(g))}` : `oolong turns into a ${['bag of gold', 'giant cake', 'bicycle', 'very convincing roshi'][Math.random() * 4 | 0]} — +${fmtShort(Math.round(g))}`); return; }
      if (cling) { const k = kidScreen(12); if (Math.hypot(px - k.x, py - k.y) < 16) { burst(k.x, k.y, [0xffffff, 0xa6e67e, 0x58b848, 0x2f7a2a]); gain(Math.max(60, wrate() * 20), k.x, k.y - 16, true); ui.event('shook the saibaman off — it pops harmlessly'); cling = null; return; } }
      if (struggle) { struggle.p += .055; ui.sfx && ui.sfx('tap'); shake = Math.max(shake, .08); return; }   // a beam struggle takes every tap
      if (spiritReady && !spiritShot) { const b = spiritPos(); if (Math.hypot(px - b.x, py - b.y) < b.r + 8) { throwSpirit(); return; } }
      if (fuseOffer > st.t && monkeyAt && Math.hypot(px - monkeyAt.x, py - (monkeyAt.y - 5 * monkeyAt.k)) < 12 * monkeyAt.k) {   // his tap target grows with him
        fuseOffer = 0; fuseUntil = st.t + 30; ach('fusion'); flashT = 1; shake = .6; ui.event('fusion ha! vegebubs — ×2 for 30s'); ui.fx && ui.fx('super');
        burst(monkeyAt.x, monkeyAt.y - 6, [0xffffff, 0xffe08a, 0xff9a3c, 0x6fb0ff], 50, 200); return;
      }
      if (car && car.sx !== undefined && Math.hypot(px - car.sx, py - (car.sy - 6)) < 16) { carUntil = st.t + 15; ui.event("riding with king kai — ×1.5 for 15s"); ui.sfx && ui.sfx('coin'); burst(car.sx, car.sy - 6, [0xffffff, 0xd8241e, 0xdfe3ea], 16, 110); car = null; return; }
      if (yam && !yam.boom && yam.sx !== undefined && !yam.helped && Math.hypot(px - yam.sx, py - (yam.sy - 3)) < 12) { yam.helped = true; ach('yamcha'); yam.until = st.t + 1.2; senzuUntil = Math.max(senzuUntil, st.t + 10); const g = Math.max(200, wrate() * 40); gain(g, yam.sx, yam.sy - 10, true); ui.event('yamcha: "i\'m fine!" — senzu ×1.5 for 10s'); ui.sfx && ui.sfx('coin'); return; }
      if (greg && greg.sx !== undefined && Math.hypot(px - greg.sx, py - (greg.sy - 4)) < 10) { const g = Math.max(300, wrate() * 120) * (1 + .5 * Math.min(6, S.gregWins || 0)); S.gregWins = (S.gregWins || 0) + 1; if (S.gregWins >= 5 && !S.ach.greg5) { ach('greg5'); S.spirit = 1; setTimeout(() => ui.event('king kai taught you the spirit bomb — it charges on its own, tap the ball'), 4200); } gain(g, greg.sx, greg.sy - 10, true); ui.event(`you caught gregory! +${fmtShort(Math.round(g))} — race ${S.gregWins} won`); ui.sfx && ui.sfx('coin'); burst(greg.sx, greg.sy - 4, [0xffffff, 0xd8a868, 0xa8743a], 18, 120); greg = null; return; }
      if (kai && kai.sx !== undefined && !kai.laughed && Math.hypot(px - kai.sx, py - (kai.sy - 8)) < 12) { kai.laughed = true; laughUntil = st.t + 10; ui.event('ha! ha! ha! — ×1.25 for 10s'); ui.sfx && ui.sfx('coin'); burst(kai.sx, kai.sy - 14, [0xffffff, 0xbfe9ff, 0x3a7ad8], 14, 90); return; }
      if (gero && Math.hypot(px - gero.x, py - (gero.y - gero.spr.h / 2)) < 16) { const g = Math.max(gero.drained * 2, wrate() * 20); gain(g, gero.x, gero.y - gero.spr.h - 4, true); ach('gero'); ui.event(`${gero.name} lets go — you take it all back, twice over: +${fmtShort(Math.round(g))}`); burst(gero.x, gero.y - 10, [0xffffff, 0xffe08a, 0xe0473e], 20, 160); ui.sfx && ui.sfx('hit'); gero = null; return; }
      if (date && date.kr && !date.paid && date.sx2 !== undefined && Math.hypot(px - date.sx2, py - (date.sy2 - 9)) < 11) { date.paid = true; date.until = Math.min(date.until, st.t + 2); const g = Math.max(400, wrate() * 90); gain(g, date.sx2, date.sy2 - 18, true); ach('wallet'); ui.event(`krillin hands over his whole wallet without looking: +${fmtShort(Math.round(g))}`); ui.sfx && ui.sfx('coin'); return; }
      if (a16) for (const b of a16.birds) if (!b.free && b.sx !== undefined && Math.hypot(px - b.sx, py - b.sy) < 7) { b.free = st.t; calmUntil = st.t + 12; ach('birds'); ui.event('16: "thank you." — calm ×1.25 for 12s'); return; }
      for (const g of gadgets) if (g.sx !== undefined && Math.hypot(px - g.sx, py - (g.sy - 5)) < 10) { gadgets.splice(gadgets.indexOf(g), 1); openGadget(g.sx, g.sy); return; }
      if (pud && pud.sx !== undefined && Math.hypot(px - pud.sx, py - (pud.sy - 4)) < 11) { const g = Math.max(500, wrate() * 60); gain(g, pud.sx, pud.sy - 12, true); bz.awake = 0; bz.noise = 0; pud = null; ach('pudding'); ui.event(`pudding! beerus dozes off happy — +${fmtShort(Math.round(g))}`); ui.sfx && ui.sfx('coin'); return; }
      if (roshi && !roshi.max && roshi.sx !== undefined && Math.hypot(px - roshi.sx, py - (roshi.sy - 9)) < 12) { roshi.max = st.t; roshi.until = st.t + 5; shake = .5; ui.event('roshi: "MAX POWER!"'); ui.sfx && ui.sfx('form'); return; }
      if (satan && satan.sx !== undefined && st.t > satan.t0 && Math.hypot(px - satan.sx, py - (satan.sy - 10)) < 13) { gain(satan.prize, satan.sx, satan.sy - 20, true); ach('satan'); ui.event(`hercule cash prize! +${fmtShort(Math.round(satan.prize))} — "keep it between us, kid"`, 3500); ui.sfx && ui.sfx('coin'); burst(satan.sx, satan.sy - 12, [0xffffff, 0xf2c84a, 0xb88a1a], 18, 120); satan = null; return; }
      if (door && door.sx !== undefined && Math.hypot(px - door.sx, py - (door.sy - 9)) < 13) { chamberT0 = st.t; chamberUntil = st.t + chamberLen(); ach('chamber'); ui.event(`hyperbolic time chamber — time slows, training ×2 for ${chamberLen()}s`); flashT = 1; ui.sfx && ui.sfx('form'); door = null; return; }
      if (ginyu && !ginyu.done) for (const m of ginyu.members) if (!m.dead && Math.abs(px - m.x) < (m.spr.w / 2 + 2) * m.k && py > m.y - (m.spr.h + 2) * m.k && py < m.y + 3) { combo = st.t - lastClick < .6 ? Math.min(comboCap(), combo + .1) : 1; lastClick = st.t; ginyuHit(m, tapPower() * mult() * combo * 6 * (1 + .5 * lvl('fist')) * (1 + .5 * lvl('brawl'))); ui.sfx && ui.sfx('hit'); return; }
      if (capsule && Math.hypot(px - capsule.x, py - capsule.y) < 11) { openCapsule(); return; }
      if (star && Math.hypot(px - star.x, py - star.y) < 13) {
        boostUntil = st.t + 15; S.stars = (S.stars || 0) + 1; if (S.stars >= 25) ach('stars25'); gain(Math.max(50, wrate() * 20), star.x, star.y - 6, true); ui.event('space pod caught — ×2 for 15s'); goal('star'); ui.fx && ui.fx('star');
        for (let k = 0; k < 24; k++) fx.add({ x: star.x, y: star.y, vx: (Math.random() - .5) * 120, vy: (Math.random() - .5) * 120, drag: 2.5, life: .7, c: [0xffffff, 0xffd84a, 0xff8a3a], raw: true });
        star = null; return;
      }
      for (const m of meteors) if (!m.dead && Math.hypot(px - m.x, py - m.y) < 9) { m.dead = true; goal('meteor'); gain(25 * mult() * (1 + Math.min(laps, 50) * .1), m.x, m.y - 6, true); for (let k = 0; k < 16; k++) fx.add({ x: m.x, y: m.y, vx: (Math.random() - .5) * 110, vy: (Math.random() - .5) * 110, drag: 2.5, life: .6, c: [0xffffff, 0xffb35a, 0xe0473e, 0x6c6f7c], raw: true }); return; }
      // anywhere else: train — a sprint burst and a few points
      if (moon && moon.a > .3 && !moon.leaving && Math.hypot(px - moon.x, py - moon.y) < moon.r + 6) {
        apeUntil = st.t + 15; moon.leaving = true; ach('ape'); flashT = 1; shake = .8; ui.event('great ape mode — ×3'); ui.fx && ui.fx('super');
        for (let k = 0; k < 80; k++) { const q = kidScreen(20); fx.add({ x: q.x, y: q.y, vx: (Math.random() - .5) * 220, vy: (Math.random() - .5) * 220, drag: 2, life: 1, c: [0xffffff, 0xffd0a0, 0x7a4a2a], raw: true }); }
        return;
      }
      // senzu bean on the planet
      for (const sb of saibas) if (!sb.dead && sb.sx !== undefined && Math.hypot(px - sb.sx, py - (sb.sy - 6)) < 9) { killSaiba(sb); return; }
      if (boss && !boss.dead && Math.abs(px - boss.x) < (boss.spr.w / 2 + 3) * boss.k && py > boss.y - (boss.spr.h + 2) * boss.k && py < boss.y + 4) { combo = st.t - lastClick < .6 ? Math.min(comboCap(), combo + .1) : 1; lastClick = st.t; hitBoss(tapPower() * mult() * combo * 6 * (1 + .5 * lvl('fist')) * (1 + .5 * lvl('brawl')), px, py); return; }
      if (bean && bean.sx !== undefined && Math.hypot(px - bean.sx, py - (bean.sy - 6)) < 13) { senzuUntil = st.t + 15; ui.event('senzu bean — ×1.5 for 15s'); for (let k = 0; k < 18; k++) fx.add({ x: bean.sx, y: bean.sy, vx: (Math.random() - .5) * 100, vy: (Math.random() - .5) * 100, drag: 3, life: .6, c: [0xffffff, 0xb8f08a, 0x4fae3a], raw: true }); bean = null; return; }
      // train: rhythm builds a combo up to ×2; the scouter adds crits
      combo = st.t - lastClick < .6 ? Math.min(comboCap(), combo + .1) : 1; lastClick = st.t; if (combo >= 2) goal('combo');
      sprint = Math.min(1.2, sprint + .5);
      if (bz && !bz.awake) bz.noise += whisUntil > st.t ? .08 : .04;
      if (jumpH <= 0) jumpV = 120;
      const crit = Math.random() < S.scouter * .1 + lvl('crit') * .08, k = kidScreen(14);
      gain((1 + S.boots * ms('boots')) * mult() * combo * (crit ? 2 + lvl('critx') : 1) * (1 + .5 * lvl('fist')), k.x, k.y - 10, crit); ui.sfx && ui.sfx('tap');
      if (crit) for (let i = 0; i < 10; i++) fx.add({ x: k.x, y: k.y - 14, vx: (Math.random() - .5) * 90, vy: -20 - Math.random() * 60, drag: 2, life: .5, c: [0xffffff, 0x9cf0b8, 0x34d873], raw: true });
      ui.bump();
    }
    st.cv.addEventListener('pointerdown', e => { const [bx, by] = st.toBuf(e); if (playing && S.world === 3 && snk) { snakeTap(bx, by); return; }   // snake way acts on the press: no drag, beam charge or double-tap to swallow it
      drag = { x: e.clientX, y: e.clientY, moved: 0, t: st.t, ax: bx, ay: by }; try { st.cv.setPointerCapture(e.pointerId); } catch (_) {} });
    st.cv.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
      if (charging > 0) { const [px, py] = st.toBuf(e); drag.ax = px; drag.ay = py; return; }
      if (drag.moved > 6) { st.cv.style.cursor = 'grabbing'; const k = 1.1 / (R * st.scale); vry = dx * k * 30; vrx = dy * k * 30; M = M3.ortho(M3.mul(M3.mul(M3.rx(dy * k), M3.ry(dx * k)), M)); idleT = 0; }
    });
    st.cv.addEventListener('pointerup', e => { if (drag && charging > .15) fireBeam(charging, drag.ax, drag.ay); else if (drag && drag.moved <= 6) { const [px, py] = st.toBuf(e); tap(px, py); } charging = 0; drag = null; st.cv.style.cursor = 'grab'; });
    st.cv.addEventListener('pointercancel', () => { drag = null; charging = 0; });
    function fireBeam(c, tx, ty) {
      if (S.world === 3) return;
      if (bz && !bz.awake) bz.noise += .35;   // a beam is loud
      if (a16 && st.t < a16.until - 1) { a16.until = st.t + 1; ui.event('16: "please… the birds." he walks off'); }
      if (struggle) { struggle.p += .12 * c; return; }   // a charged beam shoves the struggle
      const k = handPos(); let dx = tx - k.x, dy = ty - k.y, dl = Math.hypot(dx, dy);
      if (dl < 4) { dx = Math.sin(k.ang); dy = -Math.cos(k.ang); dl = 1; }
      const dir = [dx / dl, dy / dl];
      beam = { t0: st.t, c, x: k.x, y: k.y, dx: dir[0], dy: dir[1], z: kidScreen().v[2] * (R + 12) }; ui.sfx && ui.sfx('beam'); shake = Math.max(shake, .2 + c * .15);
      if (star) { const rx = star.x - k.x, ry = star.y - k.y; if (rx * dir[0] + ry * dir[1] > 0 && Math.abs(rx * dir[1] - ry * dir[0]) < 8 + c * 3) onClick(star.x, star.y); }
      if (c >= 2.4) goal('beam');
      const ff = S.galick >= 5 && c >= 2.4; beam.ff = ff;   // galick lv 5: a full charge fires a final flash
      const pts = Math.pow(1.6, S.galick) * lapValue() * 2.5 * c * mult() * (ff ? 3 : 1) * (1 + .5 * lvl('beam'));   // each level hits ×1.6 harder
      const onLine = (x, y, w) => { const rx = x - k.x, ry = y - k.y; return rx * dir[0] + ry * dir[1] > 0 && Math.abs(rx * dir[1] - ry * dir[0]) < w + c * 3 * (ff ? 2 : 1) * (1 + .15 * (S.galick - 1)); };
      for (const sb of saibas) if (!sb.dead && sb.sx !== undefined && onLine(sb.sx, sb.sy - 6, 7)) killSaiba(sb);
      if (ginyu && !ginyu.done) for (const m of ginyu.members) if (!m.dead && onLine(m.x, m.y - m.spr.h / 2 * m.k, m.spr.w / 2 * m.k)) ginyuHit(m, pts * 2);
      if (boss && !boss.dead && onLine(boss.x, boss.y - boss.spr.h / 2 * boss.k, boss.spr.w / 2 * boss.k)) hitBoss(pts * 4, boss.x, boss.y - boss.spr.h / 2 * boss.k);
      gain(pts, k.x, k.y - 16, true); ui.fx && ui.fx('buy');
      for (const m of meteors) { if (m.dead || m.delay > 0) continue; const rx = m.x - k.x, ry = m.y - k.y, along = rx * dir[0] + ry * dir[1], off = Math.abs(rx * dir[1] - ry * dir[0]); if (along > 0 && off < 6 + c * 3) { m.dead = true; goal('meteor'); gain(25 * mult() * (1 + Math.min(laps, 50) * .1), m.x, m.y - 6, true); } }
    }
    st.cv.style.cursor = 'grab';

    const rate = () => Math.round((lapValue() / 7 + passive()) * mult());
    const wrate = () => Math.round((lapValue() / 7 + passive()) * mult(true));   // windfalls and villain hp: your rate without the temporary buffs, so stacking them first can't multiply a lump sum
    function burst(x, y, c, n = 16, sp = 110) { for (let k = 0; k < n; k++) fx.add({ x, y, vx: (Math.random() - .5) * sp, vy: (Math.random() - .5) * sp, drag: 2.5, life: .6, c, raw: true }); }
    const GOALS = [
      { id: 'combo', n: 1, text: 'hit a ×2 combo' },
      { id: 'laps', n: 10, text: 'run 10 laps' },
      { id: 'star', n: 3, text: 'catch 3 space pods' },
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
      if (id === 'meteor' && storm) storm.hit++;
      if (!playing || S.goal.id !== id) return;
      const g = GOALS.find(x => x.id === id); S.goal.p = set ? Math.max(S.goal.p, amount) : S.goal.p + amount;
      if (S.goal.p >= g.n) {
        S.goalsDone = (S.goalsDone || 0) + 1; const prize = Math.max(200, wrate() * 90 * (1 + Math.min(20, S.goalsDone) * .15)); gain(prize);
        let msg = `training done: ${g.text} — +${fmtShort(Math.round(prize))}`;
        if (S.goalsDone % 5 === 0) { S.orbs7++; msg += ' and a dragon ball'; if (S.orbs7 >= 7) { S.orbs7 = 0; setTimeout(summon, 1500); } }
        ui.event(msg); ui.fx && ui.fx('buy'); nextGoal(); save();
      }
    }
    function tap(px, py) {
      const dbl = st.t - lastTap.t < .32 && Math.hypot(px - lastTap.x, py - lastTap.y) < 30;
      lastTap = { t: dbl ? -9 : st.t, x: px, y: py };
      if (dbl && playing && S.bigbang > 0 && !bang && st.t > bangReady) { throwBang(px, py); return; }
      onClick(px, py);
    }
    function victory() { poseUntil = st.t + 1.6; }
    function transform(preview) {
      S.form++; victory(); if (!preview) { if (S.form >= 1) ach('ss'); if (S.form >= FORMS.length - 1) ach('ui'); } const F = FORMS[S.form]; ui.sfx && ui.sfx('form'); ui.event(F.name + '!  ×' + F.x + (preview ? ' — a taste, for 60s' : '')); ui.fx && ui.fx('form', S.form); flashT = 1;
      for (let k = 0; k < 90; k++) { const q = kidScreen(10); fx.add({ x: q.x, y: q.y, vx: (Math.random() - .5) * 200, vy: (Math.random() - .5) * 200, drag: 2, life: 1.1, c: F.aura, raw: true }); }
      save();
    }
    // the spirit bomb: energy gathers into a ball above him; once full, tap it to throw
    function spiritPos() { const kd = kidScreen(), up = liftNow + 34 + spirit * 10; return { x: kd.x + Math.sin(kd.ang) * up, y: kd.y - Math.cos(kd.ang) * up, r: 2 + spirit * 9 * Math.max(1, R / 60) }; }
    function throwSpirit() {
      const from = spiritPos(), m = ginyu && !ginyu.done && ginyu.members.find(x => !x.dead);
      const to = boss && !boss.dead ? { x: boss.x, y: boss.y - boss.spr.h / 2 * boss.k } : m ? { x: m.x, y: m.y - m.spr.h / 2 * m.k } : { x: cx, y: cy - R * 1.5 };
      spiritShot = { x0: from.x, y0: from.y, x1: to.x, y1: to.y, r: from.r, t0: st.t }; spirit = 0; spiritReady = false; ach('spirit'); ui.sfx && ui.sfx('beam');
    }
    function spiritBlast(x, y) {
      ui.sfx && ui.sfx('boom'); flashT = 1; shake = 1; blasts.push({ x, y, r: R * 1.1, t0: st.t });
      for (const sb of saibas) if (!sb.dead && sb.sx !== undefined) killSaiba(sb);
      for (const m of meteors) if (!m.dead) { m.dead = true; goal('meteor'); }
      if (ginyu && !ginyu.done) for (const m of ginyu.members) if (!m.dead) ginyuHit(m, m.hp + 1);
      if (boss && !boss.dead) hitBoss(boss.hp / (1 + .5 * S.armor) + 1, x, y);
      const g = Math.max(wrate() * 120, lapValue() * mult() * 60) * (1 + .5 * (S.spirit - 1)); gain(g, x, y - 20, true); ui.event(`spirit bomb! +${fmtShort(Math.round(g))}`); victory();
      for (let k = 0; k < 5; k++) burst(x + (Math.random() - .5) * 40, y + (Math.random() - .5) * 40, [0xffffff, 0xd8f0ff, 0x8fd8ff, 0x2f6ae0], 30, 260);
    }
    function openGadget(x, y) {
      ach('westcity'); burst(x, y - 5, [0xffffff, 0xf2c84a, 0x4a8ad0], 18, 120); ui.sfx && ui.sfx('coin');
      const roll = Math.random(), T0 = st.t;
      if (roll < .3) { robotUntil = T0 + 10; ui.event('capsule: a training robot — it taps for you for 10s'); }
      else if (roll < .55) { gadgetUntil = T0 + 15; ui.event('capsule: a gravity machine — ×1.5 for 15s'); }
      else if (roll < .8) { bikeUntil = T0 + 12; ui.event('capsule: a hover bike — full sprint for 12s'); }
      else { orbs.push({ phi: phi + .8, star: true }); ui.event('capsule: a dragon radar — a dragon ball just ahead'); }
    }
    function throwBang(x, y) { const h = handPos(); bangReady = st.t + 2.5; bang = { x0: h.x, y0: h.y, x1: x, y1: y, t0: st.t, dur: .38 }; }
    function explode(x, y) {
      ui.sfx && ui.sfx('boom');
      const r = 18 * (1 + .25 * (S.bigbang - 1)) * Math.max(1, R / 50);
      blasts.push({ x, y, r, t0: st.t }); shake = Math.max(shake, .45);
      gain(lapValue() * mult() * 3 * S.bigbang, x, y - 10, true);
      for (const sb of saibas) if (!sb.dead && sb.sx !== undefined && Math.hypot(sb.sx - x, sb.sy - 6 - y) < r + 6) killSaiba(sb);
      for (const m of meteors) if (!m.dead && m.delay <= 0 && Math.hypot(m.x - x, m.y - y) < r + 4) { m.dead = true; goal('meteor'); gain(25 * mult() * (1 + Math.min(laps, 50) * .1), m.x, m.y - 6, true); }
      if (ginyu && !ginyu.done) for (const m of ginyu.members) if (!m.dead && Math.hypot(m.x - x, m.y - m.spr.h / 2 * m.k - y) < r + 6) ginyuHit(m, Math.max(rate(), lapValue() * mult()) * 8 * S.bigbang);
      if (boss && !boss.dead && Math.hypot(boss.x - x, boss.y - boss.spr.h / 2 * boss.k - y) < r + boss.spr.w / 2 * boss.k) hitBoss(Math.max(rate(), lapValue() * mult()) * 12 * S.bigbang, x, y);
      if (star && Math.hypot(star.x - x, star.y - y) < r) onClick(star.x, star.y);
      burst(x, y, [0xffffff, 0xbfe9ff, 0x6fb0ff, 0x2f6ae0], 36, 220);
    }
    function travel(w) {
      ui.hell && ui.hell(false);
      if (!playing) return;
      S.world = w; useWorld(w); scenery(); ui.world && ui.world(w);
      flashT = 1; shake = .5; const q = handPos(); burst(q.x, q.y, [0xffffff, 0xdfe6e8, 0x9adada], 40, 220);
      ui.event(['back on king kai\'s planet', 'a space pod takes you to namek for 45 seconds — dragon balls ×2', 'a space pod takes you to planet vegeta for 45 seconds — the moon is always full', 'knocked into other world — run snake way back to king kai! tap left / right (or ← →) to switch lanes, middle (or space) to jump, tap a ghost to blast it', 'a space pod takes you to beerus\' planet — he\'s asleep. laps pay ×3 here, but every tap makes noise', 'capsule corp, west city — bulma is handing out gadgets: tap the capsules', 'kame house — master roshi\'s little island, out in the open sea', 'a space pod drops you on mount paozu — goku\'s home, deep in dinosaur country', 'a time machine drops you in trunks\' future — the city is in ruins and the androids are still out there'][w], w >= 3 ? 6000 : 2600); save(); syncShop();
      if (w === 2) { ach('vegeta'); nextMoon = 3; if (!boss) nextNappa = 6; }
      if (w === 3) startSnake(); else snk = null;
      bz = w === 4 ? { c: capPt(.3, 4.4), noise: 0, awake: 0 } : null; pud = null; gadgets = []; nextGadget = 2;
    }
    function kaioken() {
      if (!playing || S.kaio <= 0 || st.t < kaioReady) return;
      ach('kaioken'); kaioUntil = st.t + 15; tiredUntil = st.t + 25; kaioReady = st.t + 45; shake = .5; flashT = .4;
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
        if (ginyu.members.every(x => x.dead)) { victory(); ach(ginyu.androids ? 'androids' : 'ginyu'); const prize = Math.max(ginyu.max * 2, wrate() * 200) * (1 + .5 * lvl('bounty')); gain(prize, cx, cy - R * 1.3, true); ui.event(`${ginyu.androids ? 'androids 17 and 18 are' : 'the ginyu force is'} defeated! +${fmtShort(Math.round(prize))}`); ui.fx && ui.fx('star'); ui.sfx && ui.sfx('boom'); goal('boss'); ginyu.done = st.t; save(); } }
    }
    function hitBoss(dmg, x, y) {
      boss.hp -= dmg * (1 + .5 * S.armor); boss.flash = .12; ui.sfx && ui.sfx('hit'); burst(x, y, [0xffffff, 0xffe08a, 0xff9a3c], 6, 70);
      if (boss.hp <= 0 && !boss.dead) {
        boss.dead = true; boss.t1 = st.t; S.bosses = (S.bosses || 0) + 1; goal('boss'); if (tour) tour.ko += 10; capsule = { x: boss.x, y: boss.y - boss.spr.h / 2 * boss.k, vy: -40, t0: st.t, land: cy - R * .3 }; let prize = Math.max(boss.max * 1.5, wrate() * 90) * (1 + .5 * lvl('bounty'));
        if (boss.saga) { prize *= 2; S.saga++; if (lvl('saga')) { S.seeds++; S.ascend++; setTimeout(() => ui.event('legend — the villain drops a ki seed'), 5200); } if (S.saga >= VILLAINS.length) ach('sagas'); satan = { c: capPt(.42, 2.9), t0: st.t + 1.2, until: st.t + 9, prize: prize * .5 }; setTimeout(() => ui.event('mr. satan: "i did it! it was all me!" — tap him for the prize money', 4500), 2800); }
        victory(); S.beaten = S.beaten || {}; S.beaten[boss.name] = 1; if (S.bosses >= 10) ach('villains10'); if (boss.name === 'frieza') ach('frieza'); if (boss.name === 'nappa' && S.world === 2) ach('nappa'); if (boss.name === 'cell') ach('cell'); if (boss.name === 'beerus') ach('beerus'); if (['frieza', 'cell', 'kid buu', 'beerus'].every(n => S.beaten[n])) ach('all4'); gain(prize, boss.x, boss.y - (boss.spr.h + 10) * boss.k, true); ui.event(boss.name === 'past vegeta' ? `you beat your younger self — technically you also lost. +${fmtShort(Math.round(prize))}` : `${boss.name} defeated — +${fmtShort(Math.round(prize))}`); ui.fx && ui.fx('star'); shake = .7; flashT = .8;
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
      shen = { t0: st.t, phase: 'rise', look: shenLook, wishes: S.world === 1 ? 3 : 1, porunga: S.world === 1 }; ach(S.world === 1 ? 'porunga' : 'shenron'); document.body.classList.add('shen'); ui.sfx && ui.sfx('dragon'); ui.event(S.world ? 'porunga awakens — three wishes…' : 'the eternal dragon awakens…');
    }
    const wishSeeds = () => Math.max(3, Math.ceil(seedsNow() / 5));
    function openWish() {
        shen.phase = 'wish';
        const next = S.form < FORMS.length - 1 ? FORMS[S.form + 1] : null;
        ui.wish([
          { key: 'power', label: 'eternal power', what: '×1.25 to everything, forever, even after ascending' },
          next ? { key: 'form', label: 'a taste of ' + next.name, what: `×${next.x} for 60 seconds` } : { key: 'seeds', label: 'the seeds of power', what: `+${wishSeeds()} ki seeds, kept forever` },   // at the top form: something other than more income
          { key: 'fortune', label: 'a fortune in power', what: '+10 minutes of income' },
          ...(S.krillinDead ? [{ key: 'krillin', label: 'bring krillin back', what: `he trains with you: idle ×1.5 and destructo discs. next death: rage ×${3 + (S.krillinRevives || 0)}` }] : []),
        ], k => {
          if (!shen || shen.phase !== 'wish') return; shen.phase = 'granting';   // a wish is granted once, however often the box fires
          if (k === 'krillin') { S.krillinDead = 0; S.krillinAlly = 1; S.krillinRevives = (S.krillinRevives || 0) + 1; nextKril = 240; ui.event('krillin is back! "did i miss anything?" — he trains with you: idle ×1.5 and destructo discs'); }
          if (k === 'power') { S.wishes++; ui.event('your wish is granted — ×1.25 forever'); }
          if (k === 'form' && next) { preview = { from: preview ? preview.from : S.form, until: st.t + 60 }; transform(true); }   // a second taste still falls back to where you started
          if (k === 'seeds') { const g = wishSeeds(); S.seeds += g; S.ascend += g; ui.event(`your wish is granted — +${g} ki seeds (×${seedBoost().toFixed(1)} on everything)`); }
          if (k === 'fortune') { gain(wrate() * 600); ui.event('your wish is granted — +' + fmtShort(wrate() * 600)); }
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
    const street = c => Math.abs(c) < .7 && Math.abs(c * 4 - Math.round(c * 4)) < .04;
    function shadePlanet(o, n, x, y) {
      const nb = M3.apT(M, n), lum = light(n) + Math.pow(1 - n[2], 3) * .15;
      if (S.world === 6) return shadeKame(nb, lum, x, y);
      const dn = V.dot(nb, N);
      if (Math.abs(dn) < .07) return S.world === 5 && Math.abs(dn) < .006 && (Math.atan2(V.dot(nb, E2), V.dot(nb, E1)) * 10 + 99) % 1 < .55 ? 0xf6d84a : tone(TONES.road, lum + .2, x, y);
      for (const q of wcRoads) { const d = V.dot(nb, q.n); if (d < q.lo || d > q.hi) continue; const u = V.dot(nb, q.a), v = V.dot(nb, q.b);
        if (q.pave === 'pool') return tone(TONES.glass, lum + (d - q.lo < .006 ? -.3 : .05), x, y);
        if (q.pave) return tone(TONES.stone, lum + .2 - ((Math.floor(u * 50) + Math.floor(v * 50)) & 1) * .1, x, y);   // plaza tiles
        return Math.abs(d - (q.lo + q.hi) / 2) < .005 && (Math.atan2(v, u) * 12 + 99) % 1 < .55 ? 0xf6d84a : tone(TONES.road, lum + .2, x, y); }
      if (pzWater && pzWater(nb)) return tone(PZ_WATER, lum + .1 + Math.sin(nb[0] * 60 + nb[1] * 45) * .08, x, y);   // paozu's river and lake
      const patch = vnoise3(nb[0] * 3 + 9, nb[1] * 3, nb[2] * 3), f = vnoise3(nb[0] * 24, nb[1] * 24 + 4, nb[2] * 24);
      if (f > .9 && lum > .4) return S.world === 8 ? FUT.fleck[f > .94 ? 0 : 1] : f > .94 ? 0xffffff : 0xfff2a8;
      if (S.world === 8 && patch > .45 && (street(nb[0]) || street(nb[1]) || street(nb[2]))) return tone(TONES.road, lum + (f - .5) * .6, x, y);   // the old street grid, buried in places
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
    // capsule corp: cream dome on a grey plinth, a blue band lettered across the front, a ring of round windows
    const GLYPH = { C: 0x7927, A: 0x2bed, P: 0x6ba4, S: 0x388e, U: 0x5b6f, L: 0x4927, E: 0x79a7, O: 0x2b6a, R: 0x6bad, ' ': 0 };
    const LABEL = 'CAPSULE';
    function shadeHQ(o, n, x, y) {
      const u = M3.apT(M, n), up = V.dot(u, o.s), lum = light(n), f = V.dot(u, o.door), sd = V.dot(u, o.side), ang = Math.atan2(sd, f);
      if (up < .1) return tone(TONES.stone, lum + .1, x, y);
      if (up < .36) {
        const col = Math.floor((ang / 1.7 + .5) * LABEL.length * 4), row = Math.floor((.33 - up) / .2 * 5);
        if (o.text && col >= 0 && col < LABEL.length * 4 && col % 4 < 3 && row >= 0 && row < 5 && (GLYPH[LABEL[col >> 2]] >> (14 - row * 3 - col % 4)) & 1) return 0xffffff;
        if (!o.text && Math.abs(ang) < .22 && up < .3) return 0x24304a;                           // door
        return tone(TONES.cc, lum + .15, x, y);
      }
      const w = (ang / (Math.PI / 5) + 99.5) % 1;
      if (up > .44 && up < .58 && Math.abs(w - .5) < .2) return tone(TONES.pane, lum + .25, x, y);
      return tone(TONES[o.p], lum, x, y);
    }
    // west city towers and cars: a body in its own palette with a window ribbon round each sphere's waist
    function shadeTower(o, n, x, y) {
      const lum = light(n), up = o.w ? Math.abs(V.dot(M3.apT(M, n), o.s)) : 1;
      if (up < o.w) return tone(TONES.pane, lum + (up < o.w * .4 ? .3 : 0), x, y);
      return tone(TONES[o.p], lum, x, y);
    }
    const shadeBy = pal => (o, n, x, y) => tone(pal, light(n) + (pal === TONES.leaf ? (h2(x * 3, y * 5) - .5) * .25 : 0), x, y);
    const SHADE = { planet: shadePlanet, karst: (o, n, x, y) => h2(x * 5, y * 3) > .9 && light(n) > .45 ? tone(TONES.leaf, light(n), x, y) : tone(TONES.stone, light(n) + (h2(x * 3, y * 7) - .5) * .3, x, y), pal: (o, n, x, y) => tone(o.pal, light(n) + o.lift, x, y), dome: shadeDome, hq: shadeHQ, tower: shadeTower, knob: (o, n, x, y) => tone(TONES.orb, light(n) + .25, x, y), leaf: shadeBy(TONES.leaf), trunk: shadeBy(TONES.trunk), stone: shadeBy(TONES.stone), orb: (o, n, x, y) => tone(TONES.orb, light(n) * .5 + .55, x, y), dorb: (o, n, x, y) => tone(TONES.dorb, light(n) * .55 + .5, x, y), bean: (o, n, x, y) => tone(TONES.bean, light(n), x, y), dragon: (o, n, x, y) => { const inward = -(n[0] * o.vr[0] + n[1] * o.vr[1] + n[2] * o.vr[2]); if (inward > .45) return tone(TONES.belly, light(n) + .25 - (o.seg % 4 === 0 ? .3 : 0), x, y); const scale = ((x >> 1) + (y >> 1) * 2 + o.seg) % 4 === 0 ? -.16 : 0; return tone(TONES.dragon, light(n) + scale, x, y); }, spine: (o, n, x, y) => tone(TONES.dorb, light(n) + .2, x, y) };
    // puddles mirror the sky and shimmer in the rain; craters smoulder from the middle out
    function shadePool(o, n, x, y) {
      const k = (V.dot(M3.apT(M, n), o.s) - .92) * 12.5, lum = light(n);
      if (k < .2) return tone(o.lava ? TONES.trunk : TONES.road, lum * .8, x, y);
      if (o.lava) return tone(FUT.fire, k + Math.sin(st.t * 3 + x * .7 + y * .5) * .15 - .15, x, y);
      return tone(FUT.sky, .15 + k * .5 + Math.sin(st.t * 6 + x * .9 + y * 1.3) * .12, x, y);
    }
    SHADE.pool = shadePool;
    // a skyscraper drawn as an upright slab in screen space: crisp edges, window grid, a snapped jagged top with holes and bent rebar
    function slab(o, id) {
      const b = M3.ap(M, o.b), t = M3.ap(M, o.t), X0 = cx + b[0] * R, Y0 = cy - b[1] * R + st.bob, X1 = cx + t[0] * R, Y1 = cy - t[1] * R + st.bob;
      const len = Math.hypot(X1 - X0, Y1 - Y0) || 1, ux = (X1 - X0) / len, uy = (Y1 - Y0) / len, w = o.w * R, W = st.W, H = st.H, buf = st.buf;
      const side = Math.sign(-uy * -.62 + ux * -.78) || 1;   // which face catches the upper-left light
      const x0 = Math.max(0, Math.floor(Math.min(X0, X1) - w - 4)), x1 = Math.min(W - 1, Math.ceil(Math.max(X0, X1) + w + 4)), y0 = Math.max(0, Math.floor(Math.min(Y0, Y1) - w - 4)), y1 = Math.min(H - 1, Math.ceil(Math.max(Y0, Y1) + w + 4));
      const jag = w * 1.2, cut = c => len - jag * (.35 + .65 * h2(c >> 1, o.seed)) - (o.seed % 2 ? 1 : -1) * (c / (2 * w) - .5) * jag * .8;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const dx = x + .5 - X0, dy = y + .5 - Y0, al = dx * ux + dy * uy, ac = -dx * uy + dy * ux;
        if (al < 0 || ac < -w || ac > w) continue;
        const ci = (ac + w) | 0, top = cut(ci); if (al > top) continue;
        if (al > top - 5 && h2((al | 0) * 7 + ci, o.seed) > .78) continue;   // blown-out holes under the break
        const bulge = Math.sqrt(Math.max(0, w * w - ac * ac)), z = (b[2] + (t[2] - b[2]) * al / len) * R + bulge, k = y * W + x; if (z <= zb[k]) continue;
        zb[k] = z; ib[k] = id;
        const ai = al | 0, lum = .4 + side * (ac / w) * .25;
        let c;
        if (ai % 4 > 1 && ci % 3 === 1 && ci < 2 * w - 1 && al < top - 2) { const q = h2((ai >> 2) * 31 + ci, o.seed); c = q > .9 ? FUT.lit[0] : q > .78 ? FUT.lit[1] : TONES.road[0]; }
        else c = TONES.dome[Math.max(0, Math.min(4, ((lum - (ai % 8 === 0 ? .15 : 0)) * 5) | 0))];   // flat bands, no dither, so the window grid stays legible
        buf[k] = PK(c);
      }
      // rebar poking out of the break
      for (const f of o.seed % 3 ? [-.45] : [-.45, .35]) { const ac = f * w, s = f < 0 ? -1 : 1, top = cut((ac + w) | 0); for (let i = 0; i < 3; i++) { const al = top + i, a2 = ac + s * i * .45, x = Math.round(X0 + ux * al - uy * a2), y = Math.round(Y0 + uy * al + ux * a2); if (x < 0 || y < 0 || x >= W || y >= H) continue; const k = y * W + x, z = (b[2] + (t[2] - b[2]) * al / len) * R; if (z <= zb[k]) continue; zb[k] = z; ib[k] = id; buf[k] = PK(i < 2 ? 0x4a3022 : 0x6a4028); } }
    }

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
    // a sprite lying flat on the surface (yamcha's crater), foreshortened with the planet's curve
    function decal(spr, v, k) {
      let t1 = V.cross([0, 1, 0], v); const l1 = Math.hypot(...t1); t1 = l1 < .05 ? [1, 0, 0] : V.mul(t1, 1 / l1); const t2 = V.cross(t1, v);
      const ax = t1[0] * k, ay = -t1[1] * k, bx = t2[0] * k, by = -t2[1] * k, det = ax * by - bx * ay; if (Math.abs(det) < .05) return;
      const ox = cx + v[0] * R, oy = cy - v[1] * R + st.bob, z0 = v[2] * R, rr = Math.hypot(spr.w, spr.h) * k / 2 + 1, W = st.W, H = st.H;
      for (let y = Math.floor(oy - rr); y <= oy + rr; y++) { if (y < 0 || y >= H) continue; for (let x = Math.floor(ox - rr); x <= ox + rr; x++) {
        if (x < 0 || x >= W) continue;
        const dx = x + .5 - ox, dy = y + .5 - oy, u = (dx * by - dy * bx) / det, w = (ax * dy - ay * dx) / det;
        const i = Math.floor(u + spr.w / 2), j = Math.floor(w + spr.h / 2); if (i < 0 || j < 0 || i >= spr.w || j >= spr.h) continue;
        const c = spr.col[j * spr.w + i]; if (c < 0) continue;
        const kk = y * W + x, z = z0 + (t1[2] * u + t2[2] * w) * k; if (zb[kk] > z + 3) continue; st.buf[kk] = PK(c);
      } }
    }
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

    // mount paozu's dinos plod back and forth in their clearings; a pterodactyl circles high over the cap
    const pzRing = a => V.norm(V.add(V.add(V.mul(E1, Math.cos(a)), E2, Math.sin(a)), N, .55));
    function drawPaozu(t) {
      for (const d of pzDinos) {   // they stand nearly upright on the face of the planet, tipping outward only near the rim
        const ph = t * .12 + d.a * 3, a = d.a + Math.sin(ph) * d.sway, v = M3.ap(M, capPt(d.th, a)); if (v[2] < .05) continue;
        const ah = M3.ap(M, capPt(d.th, a + .02 * Math.cos(ph))), x = cx + v[0] * R, y = cy - v[1] * R + st.bob;
        blitZ(d.spr, x, y, Math.atan2(v[0], v[1]) * Math.min(1, (v[0] * v[0] + v[1] * v[1]) * 1.6), cx + ah[0] * R < x, Math.abs(Math.sin(t * 5 + d.a)) * d.hop, v[2] * R + 6, d.k); }
      const pa = t * .3, pv = M3.ap(M, V.mul(pzRing(pa), 1.6)), pn = M3.ap(M, pzRing(pa + .05)), px = cx + pv[0] * R, py = cy - pv[1] * R + st.bob;
      blitZ(DINOS.d, px, py, 0, pn[0] * 1.6 * R + cx < px, 0, pv[2] * R + 4, .42);
    }

    // ── snake way: a pseudo-3D run along the snake's back to king kai's planet
    let snk = null;
    const SNAKE_LEN = 420, SNAKE_SPEED = 7.5, LANE = .52, HELL_T = 3.2;
    const SN = { edge: 0x3a1e0c, rim: 0x8a4a18, ridge: 0xf2c060, ridgeHi: 0xfff0b0, road: 0xf2c84a, scale: 0xc87a28, scaleHi: 0xffe28a, spine: 0xd89a34 };
    const bendAt = s => 1.25 * Math.sin(s * .045) + .6 * Math.sin(s * .017 + 1);   // the road winds left and right
    function startSnake() {
      const gaps = [], orbsS = [];
      const spikes = []; let set = 0;
      for (let s = 30; s < SNAKE_LEN - 20; set++) {
        const next = s + 26 + Math.random() * 18; gaps.push([s, s + 2.2]);
        const lane = [-1, 0, 1][(Math.random() * 3) | 0]; for (let k = 0; k < 4; k++) orbsS.push({ s: s + 6 + k * 2.4, u: lane * LANE, set });
        // spines on the snake's back past the orbs, never in the orb lane: change lanes or jump them
        for (let q = s + 18; q < next - 5; q += 7 + Math.random() * 5) { const l = [-1, 0, 1].filter(v => v !== lane || q > s + 15)[(Math.random() * 2.99) | 0]; spikes.push({ s: q, u: (l ?? 0) * LANE }); }
        s = next;
      }
      // lost souls drifting over the road (tap to blast), and two flying nimbus clouds just past a gap
      const ghosts = []; for (let q = 22; q < SNAKE_LEN - 15; q += 11 + Math.random() * 9) ghosts.push({ s: q, u: (Math.random() * 2 - 1) * LANE * 1.2, h: 1.6 + Math.random() * 1.6, ph: Math.random() * 6 });
      const nimbi = [gaps[Math.floor(gaps.length * .3)], gaps[Math.floor(gaps.length * .7)]].filter(Boolean).map(g => ({ s: g[1] + 3, u: [-1, 0, 1][(Math.random() * 3) | 0] * LANE }));
      snk = { dist: 0, len: SNAKE_LEN, lane: 0, x: 0, jumpT: -9, fall: 0, stun: -9, nimbus: /nimbus/.test(HASH) ? st.t + 30 : 0, gaps, orbs: orbsS, spikes, ghosts, nimbi, shots: [], sets: {}, done: 0, got: 0, blasted: 0 };
    }
    function snakeTap(px, py) {
      // a ghost under the finger takes a ki blast instead of a lane change
      const g = !snk.fall && snk.ghosts.filter(g => !g.dead && g.sx !== undefined && Math.hypot(px - g.sx, py - g.sy) < g.r + 12).sort((a, b) => a.s - b.s)[0];
      if (g) {
        g.dead = true; snk.blasted++; snk.shots.push({ x: g.sx, y: g.sy, t0: st.t }); burst(g.sx, g.sy, [0xffffff, 0xdff4ff, 0xfff3a0], 18, 120);
        gain(lapValue() * mult() * 3, g.sx, g.sy - g.r - 4, true); ui.sfx && ui.sfx('beam'); return;
      }
      const third = px / st.W;
      if (third < .33) snakeMove(-1); else if (third > .67) snakeMove(1); else snakeJump();
    }
    const snakeMove = d => { if (!snk.fall && !snk.done) snk.lane = Math.max(-1, Math.min(1, snk.lane + d)); };
    const snakeJump = () => { if (!snk.fall && !snk.done && st.t - snk.jumpT > .6) { snk.jumpT = st.t; ui.sfx && ui.sfx('tap'); } };
    addEventListener('keydown', e => {
      if (!playing || e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea, [contenteditable]')) return;
      const k = e.key.toLowerCase();
      if (S.world === 3 && snk) { if (k === 'arrowleft' || k === 'a') snakeMove(-1); else if (k === 'arrowright' || k === 'd') snakeMove(1); else if (k === 'arrowup' || k === 'w' || k === ' ') snakeJump(); else return; }
      else if (k === ' ') { e.target.blur?.(); const q = kidScreen(14); onClick(q.x + 999, q.y + 999); }   // space trains and hops like a click; held space doesn't repeat
      else return;
      e.preventDefault();
    });
    const airborne = t => t - snk.jumpT < .6 || t < snk.nimbus;
    function updateSnake(t, dt) {
      if (!snk) startSnake();
      if (snk.done) { if (t - snk.done > 2.5) namekUntil = t; return; }
      if (snk.fall) { if (t - snk.fall > HELL_T) { snk.fall = 0; ui.hell && ui.hell(false); const g = snk.gaps.find(g => snk.dist + 1.6 >= g[0] - .5 && snk.dist + 1.6 <= g[1] + .5); if (g) snk.dist = g[1] + .2; } return; }
      snk.x += (snk.lane * LANE - snk.x) * Math.min(1, dt * 10);
      if (t - snk.stun > .7) snk.dist += SNAKE_SPEED * (1 + Math.min(1, snk.dist / snk.len) * .5) * (t < snk.nimbus ? 1.3 : 1) * dt * (1 + sprint * .4);   // faster the closer king kai gets
      const here = snk.dist + 1.6;
      if (!airborne(t) && snk.gaps.some(g => here > g[0] && here < g[1])) {
        // hell takes all of your power (upgrades and your best stay)
        const loss = Math.round(S.pl); S.pl -= loss; snk.fall = t; snk.loss = loss; shake = .6; ui.hell && ui.hell(true); ach('hfil'); ui.sfx && ui.sfx('boom');
        ui.event(loss > 0 ? `fell into HFIL — lost all ${fmtShort(loss)} power` : 'fell into HFIL — climbing back up…'); save();
      }
      for (const sp of snk.spikes) if (!sp.hit && !airborne(t) && Math.abs(sp.s - here) < .6 && Math.abs(sp.u - snk.x) < .3) {
        sp.hit = true; snk.stun = t; shake = .4; ui.sfx && ui.sfx('boom'); for (const o of snk.orbs) if (o.s > here - 12 && o.s < here) snk.sets[o.set] = -9;   // tripping breaks the streak
        floats.push({ x: st.W / 2, y: st.H * .6, s: 'OUCH', life: 1, red: true });
      }
      for (const nb of snk.nimbi) if (!nb.got && Math.abs(nb.s - here) < .7 && Math.abs(nb.u - snk.x) < .35) { nb.got = true; snk.nimbus = t + 6; ui.event('flying nimbus! — over every gap for 6s'); ui.sfx && ui.sfx('coin'); ui.fx && ui.fx('star'); }
      for (const g of snk.ghosts) if (!g.dead && !g.passed && g.s < here) { g.passed = true; if (!airborne(t) && Math.abs(g.u + Math.sin(t + g.ph) * .15 - snk.x) < .45) { snk.stun = t; shake = .3; floats.push({ x: st.W / 2, y: st.H * .6, s: 'BOO', life: 1, red: true }); } }
      for (const o of snk.orbs) if (!o.got && Math.abs(o.s - here) < .7 && (t < snk.nimbus || Math.abs(o.u - snk.x) < .3)) {
        o.got = true; snk.got++; gain(lapValue() * mult() * 2, st.W / 2, st.H * .7, true); ui.sfx && ui.sfx('coin');
        if ((snk.sets[o.set] = (snk.sets[o.set] || 0) + 1) === 4) { const g = lapValue() * mult() * 8; gain(g, st.W / 2, st.H * .55, true); floats.push({ x: st.W / 2, y: st.H * .5, s: 'PERFECT', life: 1.2, gold: true }); ui.fx && ui.fx('star'); }
      }
      if (snk.dist >= snk.len) { snk.done = t; ach('snakeway'); snk.nimbus = 0; const g = Math.max(wrate() * 120, lapValue() * mult() * 80); gain(g, st.W / 2, st.H * .4, true); ui.event(`made it to king kai's planet! +${fmtShort(Math.round(g))}`); victory(); }
    }
    // HFIL: you drop past the sign onto a ledge over the lava, lose your power, and fly back up to the road
    function drawHell(t, f, k) {
      const W = st.W, H = st.H, px = (x, y, c) => st.px(x, y, c), lava = Math.round(H * .8);
      for (let y = 0; y < lava; y++) for (let x = 0; x < W; x++) { const q = y / lava + (bayer(x, y) - .5) * .18; px(x, y, q < .35 ? 0x1e0404 : q < .6 ? 0x3a0808 : q < .82 ? 0x5e0e0a : 0x8a1c0c); }
      // jagged rock spires against the glow
      for (let x = 0; x < W; x++) { const h = H * (.22 + .12 * Math.sin(x * .05) + .08 * Math.sin(x * .13 + 2) + .05 * Math.abs(Math.sin(x * .41))); for (let y = Math.round(lava - h); y < lava; y++) px(x, y, (x + y) % 5 ? 0x160303 : 0x240606); }
      // the lava sea, rolling
      for (let y = lava; y < H; y++) for (let x = 0; x < W; x++) { const w = Math.sin(x * .09 + t * 3 + y * .4) + Math.sin(x * .031 - t * 2), d = (y - lava) / (H - lava); px(x, y, w > 1.1 ? 0xfff0a0 : w > .3 - d ? 0xffa12a : w > -.6 ? 0xe85a14 : 0xb0300c); }
      // rising embers
      for (let i = 0; i < 40; i++) { const sd = i * 97.31, ex = (sd * 13.7) % W + Math.sin(t * 2 + i) * 4, ey = H - ((t * (20 + i % 7 * 6) + sd) % H); px(ex, ey, i % 3 ? 0xffa12a : 0xffe08a); }
      // the ledge he lands on
      const lx = Math.round(W / 2), ly = Math.round(H * .66), lw = Math.round(Math.min(W * .22, 30 * k));
      for (let y = 0; y < lava - ly + 4; y++) { const half = lw * (1 - y / (lava - ly + 4) * .55); for (let x = -half; x <= half; x++) px(lx + x, ly + y, y < 2 ? 0xc0441a : y < 4 ? 0x7a2a12 : x > half * .4 ? 0x120202 : 0x3a0e0a); }
      // the HFIL sign on its posts, left of the ledge
      const sk = Math.max(2, k), sw = 19 * sk, sh = 9 * sk, sx = Math.round(lx - lw - sw * .6), sy = Math.round(ly - sh - 10 * sk);
      for (const pxo of [3 * sk, sw - 4 * sk]) for (let y = sy + sh; y < ly + 6 * sk; y++) for (let x = 0; x < sk; x++) px(sx + pxo + x, y, 0x3a1e0c);
      for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) px(sx + x, sy + y, x < sk || y < sk || x >= sw - sk || y >= sh - sk ? 0x2a1406 : (y % (3 * sk)) < sk / 2 ? 0x7a4a1e : 0x9a6028);
      const tw = (4 * 4 - 1) * sk; for (let j = 0; j < 5; j++) for (let i = 0; i < 15; i++) { if (HFIL_GLYPH[j][i] === '1') for (let a = 0; a < sk; a++) for (let b = 0; b < sk; b++) px(sx + Math.round((sw - tw) / 2) + i * sk + a, sy + 2 * sk + j * sk + b, 0xffd23a); }
      // him: falling, landing, then flying back up
      const set = HERO().forms[S.form], fall = Math.min(1, (f - .12) / .3), up = Math.max(0, (f - .72) / .28), spr = up > 0 ? set.pose : set.idle;
      const y0 = -spr.h * k, y1 = ly - spr.h * k + k, oy = Math.round(y0 + (y1 - y0) * (1 - (1 - fall) ** 2) - up * up * H * 1.2), ox = Math.round(lx - spr.w * k / 2);
      if (fall >= 1 && up === 0 && f < .5) shake = Math.max(shake, .25);
      if (up > 0) for (let y = oy + spr.h * k; y < ly; y++) for (let x = -3 * k; x <= 3 * k; x++) if (bayer(ox + spr.w * k / 2 + x, y) < .6 - Math.abs(x) / (4 * k)) px(ox + spr.w * k / 2 + x, y, 0xfff3c0);   // ki trail
      for (let j = 0; j < spr.h; j++) for (let i = 0; i < spr.w; i++) { const c = spr.col[j * spr.w + i]; if (c < 0) continue; for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) px(ox + i * k + a, oy + j * k + b, c); }
      if (snk.loss && f > .42 && f < .45) floats.push({ x: lx, y: ly - spr.h * k - 10, s: '-' + fmtShort(snk.loss), life: 1.4, red: true }), snk.loss = 0;
    }
    // kinto'un: a puffy yellow cloud centred on (x, y), w wide
    function drawNimbus(x, y, w) {
      const r = Math.max(2, w / 4);
      const puffs = [[-1.3, .25, .8], [1.3, .25, .8], [-.6, -.15, 1], [.6, -.1, 1], [0, .3, .9]];
      for (const pass of [0, 1]) for (const [dx, dy, rr] of puffs) { const cx0 = x + dx * r, cy0 = y + dy * r, R = rr * r - pass;   // outline first, then every fill over it
        for (let yy = -R - 1; yy <= R + 1; yy++) for (let xx = -R - 1; xx <= R + 1; xx++) { const d = Math.hypot(xx, yy) / Math.max(1, R); if (d > 1) continue; st.px(cx0 + xx, cy0 + yy, !pass ? 0x7a3e06 : yy < -R * .35 && d < .65 ? 0xfffbe0 : yy > R * .35 ? 0xeea21e : 0xffe36a); } }
    }
    const HFIL_GLYPH = ['101011101110100', '101010000100100', '111011000100100', '101010000100100', '101010001110111'];
    function drawSnake(t, dt) {
      const W = st.W, H = st.H, hz = Math.round(H * (W / H < .8 ? .4 : .36)), RW = W * (W / H < .8 ? .6 : .42), mix = (a, b, k) => { k = Math.max(0, Math.min(1, k)); const c = sh => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * k); return (c(16) << 16) | (c(8) << 8) | c(0); };
      const dist = snk.dist, prog = Math.min(1, dist / snk.len), px = (x, y, c) => st.px(x, y, c);
      // other world's sky
      for (let y = 0; y < hz + 4; y++) for (let x = 0; x < W; x++) px(x, y, mix(0xffe9c8, 0xf6b86a, y / hz + (bayer(x, y) - .5) * .1));
      // king kai's planet at the end of the road, growing as you close in
      const kr = Math.round(5 + prog * Math.min(W, H) * .16), kx = Math.round(W / 2 + (bendAt(dist + 60) - bendAt(dist) - snk.x) * RW * .08), ky = Math.round(hz - kr * .7 - 4);
      for (let y = -kr - 8; y <= kr + 8; y++) for (let x = -kr - 8; x <= kr + 8; x++) { const d = Math.hypot(x, y); if (d > kr && d < kr + 8 && bayer(kx + x, ky + y) < (1 - (d - kr) / 8) * .55) px(kx + x, ky + y, 0xfff6d8); }
      const G5 = [0x2f7a26, 0x3f9330, 0x57ad3c, 0x78c64a, 0xa6de66, 0xd2f28e];
      for (let y = -kr; y <= kr; y++) for (let x = -kr; x <= kr; x++) { const d = Math.hypot(x, y); if (d > kr + .3) continue; if (d > kr - .7) { px(kx + x, ky + y, 0x1f3a1a); continue; }
        const nz = Math.sqrt(Math.max(0, 1 - (d / kr) ** 2)), l = (-x * .55 - y * .7) / kr * .8 + nz * .5 + (bayer(kx + x, ky + y) - .5) * .35, band = Math.abs((y + x * .35) - kr * .25) < Math.max(1, kr * .09);
        px(kx + x, ky + y, band ? (l > .3 ? 0xfdfaf2 : 0xd8d2c4) : G5[Math.max(0, Math.min(5, Math.round(1 + l * 3.4)))]); }
      if (kr > 9) { const hr = Math.max(2, kr * .28); for (let y = -hr; y <= 0; y++) for (let x = -hr; x <= hr; x++) if (x * x + y * y <= hr * hr) px(kx - kr * .35 + x, ky - kr * .4 + y, x + y < 0 ? 0xf6985a : 0xc04e26); }
      // the clouds of other world, below and beyond the road
      for (let y = hz + 3; y < H; y++) for (let x = 0; x < W; x++) px(x, y, mix(0xe8923a, 0xb0521e, (y - hz) / (H - hz) + (bayer(x, y) - .5) * .12));
      drawSea(t, false);
      // the road: the snake's yellow back in perspective, crescent scales and a raised border down both sides
      const rows = [];
      for (let y = H - 1; y > hz + 1; y--) {
        const p = (y - hz) / (H - hz), z = 1.6 / p, sAt = dist + z, w = RW * p, cxr = W / 2 + (bendAt(sAt) - bendAt(dist) - snk.x) * w;
        rows.push({ y, z, s: sAt, w, cx: cxr });
        if (snk.gaps.some(g => sAt > g[0] && sAt < g[1])) { for (let o = -w; o <= w; o++) if ((Math.round(o) + y) % 3 === 0) px(cxr + o, y, 0x7a1a10); continue; }   // a gap: hell glows below
        const v = sAt * 3.2;
        for (let o = -w - 2; o <= w + 2; o++) { const u = o / w, au = Math.abs(u); let col;
          if (au > 1) col = au < 1 + 2.5 / w ? SN.edge : null;
          else if (au > .93) col = SN.rim;
          else if (au > .82) col = Math.floor(v * 2) % 2 ? SN.ridge : SN.ridgeHi;
          else if (au > .79) col = SN.rim;
          else { const row = Math.floor(v), fv = v - row, su = u * 4.2 + (row % 2) * .5, fu = su - Math.floor(su), arc = Math.pow((fu - .5) * 2, 2) * .55; col = fv < arc + .12 && fv > arc ? SN.scale : fv < arc + .2 && fv > arc + .12 ? SN.scaleHi : au < .03 ? SN.spine : SN.road; }
          if (col) px(cxr + o, y, mix(col, 0xf6b86a, Math.max(0, .55 - p) * .9)); } }
      // ki orbs and spines over the road, far to near
      for (const g of snk.ghosts) g.sx = undefined;
      const things = snk.orbs.filter(o => !o.got).concat(snk.spikes.map(sp => ({ ...sp, spike: true })), snk.nimbi.filter(nb => !nb.got).map(nb => ({ ...nb, cloud: true })), snk.ghosts.filter(g => !g.dead).map(g => ({ s: g.s, u: g.u + Math.sin(t + g.ph) * .15, ghost: g }))).filter(o => o.s - dist > 1.2 && o.s - dist < 40).sort((a, b) => b.s - a.s);
      for (const o of things) { const z = o.s - dist, p = 1.6 / z, y = hz + p * (H - hz), w = RW * p, cxr = W / 2 + (bendAt(o.s) - bendAt(dist) - snk.x) * w, r = Math.max(1.5, 7 * p * (RW / 130)), ox = cxr + o.u * w;
        if (o.ghost) {   // a lost soul: a white wisp with a curling tail and two dark eyes
          const g = o.ghost, R = Math.max(2, r * 1.5), gy = y - r * g.h * 2.4 + Math.sin(t * 3 + g.ph) * r * .4; g.sx = ox; g.sy = gy; g.r = R;
          for (let yy = -R; yy <= R * 2.2; yy++) for (let xx = -R - 2; xx <= R + 2; xx++) { const tail = yy > 0 ? R * (1 - yy / (R * 2.2)) : R, off = yy > 0 ? Math.sin(yy / R * 2 + t * 5 + g.ph) * R * .35 : 0, d = yy > 0 ? Math.abs(xx - off) / Math.max(.6, tail) : Math.hypot(xx, yy) / R;
            if (d <= 1) px(ox + xx, gy + yy, d > .8 ? 0xb8c8dc : yy < -R * .3 && xx < 0 ? 0xffffff : 0xeef3fa); }
          if (R >= 3) for (const ex of [-.35, .35]) for (let a = 0; a < Math.max(1, R / 4); a++) for (let b = 0; b < Math.max(1, R / 3); b++) px(ox + ex * R + a, gy - R * .15 + b, 0x2a2440);
          continue; }
        if (o.cloud) {   // the flying nimbus, bobbing over its lane
          drawNimbus(ox, y - r * 3 + Math.sin(t * 3) * r * .3, r * 2.2); continue; }
        if (o.spike) {   // a cluster of three spines, shaded on the right
          for (const [dx, hk, wk] of [[-.9, 1.6, .55], [.9, 1.6, .55], [0, 2.6, .7]]) { const hh = r * hk * 1.3, bw = r * wk * 1.3, bx = ox + dx * r;
            for (let yy = 0; yy <= hh; yy++) { const half = bw * (1 - yy / hh); for (let xx = -half; xx <= half; xx++) px(bx + xx, y - yy, Math.abs(xx) > half - 1 ? SN.edge : xx > 0 ? 0xa84a18 : yy > hh * .6 ? 0xffe0a0 : 0xe07a2a); } }
          continue; }
        const oy = y - r * 2.2;
        for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) { const q = Math.hypot(xx, yy) / r; if (q <= 1) px(ox + xx, oy + yy, q < .45 ? 0xffffff : q < .8 ? 0xffe08a : 0xff9a2a); } }
      // speed streaks
      for (let i = 0; i < 10; i++) { const k = (t * 1.8 + i * .37) % 1, side = i % 2 ? -1 : 1, x0 = W / 2 + side * W * (.38 + k * .2), y0 = hz + (H - hz) * (.2 + ((i * .29) % .7)); for (let j = 0; j < 6 + k * 8; j++) px(x0 + side * j * .5, y0 + j, 0xfff3d0); }
      // him, from behind
      const k = Math.max(1, Math.round(Math.min(W, H) / 110)), set = HERO().backs[S.form] || HERO().backs[0], onNimbus = t < snk.nimbus, spr = set[onNimbus ? 0 : Math.floor(t * 8) % 2], jump = onNimbus ? (16 + Math.sin(t * 4) * 1.5) * k : t - snk.jumpT < .6 ? Math.sin((t - snk.jumpT) / .6 * Math.PI) * 18 * k : 0;
      if (onNimbus && !snk.fall && (snk.nimbus - t > 1.5 || Math.floor(t * 8) % 2)) { for (let yy = -2 * k; yy <= 2 * k; yy++) for (let xx = -spr.w * k; xx <= spr.w * k; xx++) if ((xx / (spr.w * k)) ** 2 + (yy / (2 * k)) ** 2 <= 1 && bayer(W / 2 + xx, H - 6 + yy) < .5) px(W / 2 + xx, H - 6 + yy, 0x9a5a14);   // its shadow on the road
        drawNimbus(W / 2, H - 4 - jump + 2 * k, spr.w * k * 2.1); }   // blinks as it runs out
      // ki blasts: a bright streak from his hands to the ghost
      for (const sh of snk.shots) { const a = (t - sh.t0) / .18; if (a > 1) continue; const x0 = W / 2, y0 = H - spr.h * k * .7 - jump; for (let i = 0; i <= 1; i += 1 / Math.max(20, Math.hypot(sh.x - x0, sh.y - y0))) if (i > a - .5 && i < a + .05) for (let w = -1; w <= 1; w++) px(x0 + (sh.x - x0) * i + w, y0 + (sh.y - y0) * i, w ? 0xfff3a0 : 0xffffff); }
      snk.shots = snk.shots.filter(sh => t - sh.t0 < .2);
      if (snk.fall) { const f = (t - snk.fall) / HELL_T; if (f < .12) { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (bayer(x, y) < f / .12) px(x, y, 0x3a0606); } else drawHell(t, f, k); }
      else if (t - snk.stun > .7 || Math.floor(t * 12) % 2) { const ox = Math.round(W / 2 - spr.w * k / 2), oy = Math.round(H - spr.h * k - 4 - jump); for (let j = 0; j < spr.h; j++) for (let i = 0; i < spr.w; i++) { const c = spr.col[j * spr.w + i]; if (c < 0) continue; for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) px(ox + i * k + a, oy + j * k + b, c); } }
      // distance to king kai
      const bw = W - 40; for (let x = 0; x < bw; x++) for (let y = 0; y < 2; y++) px(20 + x, H - 3 + y, x < bw * prog ? 0xd4a017 : 0xf2e2c0);
      fx.step(st, dt);
      if (flashT > 0) { flashT = Math.max(0, flashT - dt * 1.8); }
      for (const f of floats) { f.life -= dt * .8; f.y -= dt * 16; if (f.life <= 0) continue; const x = Math.round(f.x - st.textWidth(f.s) / 2), y = Math.round(f.y); for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) st.text(f.s, x + ox, y + oy, 0xffffff); st.text(f.s, x, y, f.red ? 0xd8241e : f.gold ? 0xb07a10 : 0x1d1030); }
      for (let i = floats.length - 1; i >= 0; i--) if (floats[i].life <= 0) floats.splice(i, 1);
      st.flush();
    }
    function frame(t, dt) {
      // the hyperbolic time chamber: a year inside is a day outside — the world crawls while your power keeps real time
      const rdt = dt; if (chamberUntil > t && S.world !== 3) dt *= .3;   // no slow-mo on snake way: jumps run on real time and couldn't clear a gap
      if (playing) session += dt; st.bob = Math.round(Math.sin(t * .7) * 2) + (shake > 0 && !st.calm ? Math.round((Math.random() - .5) * 5 * shake) : 0); shake = Math.max(0, shake - dt);
      idleT += dt;
      if (!drag) {
        if (Math.abs(vrx) + Math.abs(vry) > .001) { M = M3.ortho(M3.mul(M3.mul(M3.rx(vrx * dt), M3.ry(vry * dt)), M)); vrx *= Math.pow(.06, dt); vry *= Math.pow(.06, dt); }
        if (idleT > 3) { const I = M3.I(), k = Math.min(1, dt * .7); M = M3.ortho(M.map((v, i) => v + (I[i] - v) * k)); }
      }
      // running: sprint decays; riding the golden cloud triples everything
      sprint = Math.max(0, sprint - dt * .8); riding = Math.max(0, riding - dt);
      const pace = (.42 + sprint * .9) * (riding > 0 ? 1.6 : 1) * (poseUntil > t || struggle ? 0 : 1);   // he stops to pose, and to hold a beam struggle
      phi += pace * dt;
      if (phi - lastLap > 6.283) { lastLap += 6.283; if (playing) { laps++; S.lapsTotal = (S.lapsTotal || 0) + 1; ach('lap1'); if (S.lapsTotal >= 100) ach('laps100'); goal('laps'); ui.fx && ui.fx('lap'); const k = kidScreen(20); gain(lapValue() * 4 * mult() * (1 + .5 * lvl('legs')) * (bz ? 3 : 1) * (whisUntil > t ? 2 : 1), k.x, k.y - 14, true); } }
      if (jumpH > 0 || jumpV > 0) { jumpV -= 520 * dt; jumpH = Math.max(0, jumpH + jumpV * dt); if (jumpH === 0) jumpV = 0; }
      if (playing) {
      // income: lap steps + passive, once a second
      acc += rdt; if (acc >= 1) { acc -= 1; gain((lapValue() / 7 + passive()) * mult()); }
      if ((saveAcc += dt) > 3) { saveAcc = 0; save(); }

      // ── timeline: the longer you stay, the more happens (all of it waits while you're on snake way)
      if (S.world === 3) updateSnake(t, dt); else {
      // the space pod: on phones the title covers the top of the sky, so there it flies just above the planet
      if (session > 12) { if (!star && (nextStar -= dt) < 0) { once('stars', 'a saiyan space pod — tap it'); star = { x: -8, y: st.W / st.H < .8 ? cy - R * (1.12 + Math.random() * .16) : st.H * (.08 + Math.random() * .2), vx: st.W / 6 }; nextStar = (18 + Math.random() * 14) * (1 - .12 * lvl('pods')); } }
      if (session > 30 && orbs.length < 3 && Math.random() < dt * .25) { once('orbs', 'ki orbs on the road'); orbs.push({ phi: phi + 1.5 + Math.random() * 2, star: session > 60 && Math.random() < (S.world === 1 ? .4 : .2) + .05 * lvl('balls') }); }
      if (session > 50) { if ((nextShower -= dt) < 0) { once('meteors', 'meteor shower — bust them'); for (let i = 0; i < 6; i++) meteors.push({ x: st.W * (.15 + Math.random() * .9), y: -10 - i * 18, vx: -st.W * .12, vy: st.H * .22, delay: i * .5 }); nextShower = 45 + Math.random() * 20; } }
      if (session > 75 || S.cloud > 0) { if (!cloudFly && riding <= 0 && (nextCloud -= dt * (1 + S.cloud * .6)) < 0) { once('cloud', 'flying nimbus is here'); cloudFly = { x: -30, y: st.H * .3 }; nextCloud = 60 + Math.random() * 25; } }
      if (session > 140 && !aura) { aura = true; ui.event('ki aura unlocked'); }
      // gregory hops about the planet now and then — catch him
      if (!greg && session > 60 && (nextGreg -= dt) < 0) { greg = { c: capPt(.2 + Math.random() * .9, Math.random() * 6.28), from: null, hopT: t, until: t + 10, hop: Math.max(.3, .75 - .08 * (S.gregWins || 0)) }; ui.event(S.gregWins ? `race gregory again — he's faster now. 10s` : 'race gregory! catch him in 10s'); nextGreg = 80 + Math.random() * 40; }
      if (greg) { if (t > greg.until) { if (greg.sx !== undefined) burst(greg.sx, greg.sy, [0xffffff, 0xd8a868], 8, 60); greg = null; ui.event('gregory got away'); } else if (t - greg.hopT > greg.hop) { greg.from = greg.c; greg.c = V.norm(V.add(greg.c, [Math.random() - .5, Math.random() - .5, Math.random() - .5], .45)); if (V.dot(greg.c, N) < .1) greg.c = capPt(.3 + Math.random() * .6, Math.random() * 6.28); greg.hopT = t; } }
      if (bz && !bz.awake) { bz.noise = Math.max(0, bz.noise - dt * .14); if (bz.noise >= 1) { bz.awake = t; shake = .8; flashT = .5; ui.sfx && ui.sfx('boss'); ui.event('beerus is AWAKE — "who dares?!" everything ×0.25 until you find him pudding', 5000); pud = { c: capPt(.4 + Math.random() * .7, Math.random() * 6.28), t0: t }; } }
      // master roshi wanders over; tap him and he goes max power
      if (!roshi && S.world !== 6 && session > 90 && !shen && !boss && (nextRoshi -= dt) < 0) { roshi = { c: capPt(.5, 5.4), t0: t, until: t + 12 }; ui.event('master roshi wandered over — tap him'); nextRoshi = 200 + Math.random() * 80; }
      if (roshi) {
        if (roshi.max && !roshi.fired && t - roshi.max > 1.1) {
          roshi.fired = t; roshiUntil = t + 20; flashT = .6; shake = .6; ach('roshi'); ui.sfx && ui.sfx('beam'); ui.event('kamehameha! roshi clears the sky — ×1.5 for 20s');
          for (const m of meteors) if (!m.dead && m.delay <= 0) { m.dead = true; burst(m.x, m.y, [0xffffff, 0x9fdcff, 0x2f9ae0], 8, 80); }
          for (const sb of saibas) if (!sb.dead && sb.sx !== undefined) killSaiba(sb);
        }
        if (t > roshi.until) roshi = null;
      }
      // krillin drops by to say hi… and doesn't make it. wish him back with the dragon
      if (!kril && !S.krillinDead && session > 130 && !shen && !boss && !tour && (nextKril -= dt) < 0) { kril = { c: capPt(.38, 1.3), t0: t, boom: t + 3.2 }; ui.event(S.krillinAlly ? 'krillin: "don\'t worry guys, i\'ve got this one!"' : 'krillin: "hey guys! what did i miss?"'); nextKril = 360 + Math.random() * 180; }
      if (kril) {
        if (!kril.dead && t > kril.boom) {
          kril.dead = t; S.krillinDead = 1; S.krillinAlly = 0; rage = 2 + (S.krillinRevives || 0); rageUntil = t + 20; flashT = 1; shake = .9; ach('krillin'); ui.sfx && ui.sfx('boom'); ui.event(`KRILLIN!!! — rage ×${rage} for 20s`, 4000);
          if (kril.sx !== undefined) for (let k = 0; k < 4; k++) burst(kril.sx + (Math.random() - .5) * 14, kril.sy - 8 + (Math.random() - .5) * 14, [0xffffff, 0xffe08a, 0xff9a3c, 0xe0473e], 24, 200);
        }
        if (kril.dead && t - kril.dead > 1) kril = null;
      }
      if (satan && t > satan.until) satan = null;
      // king kai pops out to tell a terrible joke — laugh (tap him) for ×1.25
      if (!kai && session > 45 && !shen && (nextKai -= dt) < 0) { kai = { c: capPt(.35, 3.6), t0: t, until: t + 9 }; ui.event('king kai: ' + PUNS[Math.floor(Math.random() * PUNS.length)], 6000); nextKai = 140 + Math.random() * 40; }
      if (!ginyu && !tour && !boss && !shen && S.world !== 8 && session > 200 && S.best >= 2e5 && (nextAndro -= dt) < 0) { krillinHit('the androids'); const hp = Math.max(500, wrate() * 14); ginyu = { androids: true, members: [{ name: 'android 17', spr: A17 }, { name: 'android 18', spr: A18 }].map((g, i) => ({ ...g, hp, max: hp, i, x: 0, y: 0, k: 1, flash: 0, dead: false })), max: hp * 2, t0: t, until: t + 45, nextKi: 1 }; ui.event('androids 17 and 18 drop in — "we\'re just bored"'); ui.sfx && ui.sfx('boss'); nextAndro = 340 + Math.random() * 60; }
      // android 18 drops by: krillin goes red and hands over his wallet (if he's alive)
      if (!date && session > 160 && !shen && S.world !== 8 && (nextDate -= dt) < 0) { const kr = !S.krillinDead; date = { c: capPt(.45, .35), c2: capPt(.45, .55), t0: t, until: t + (kr ? 10 : 4), kr }; ui.event(kr ? 'android 18 drops by — krillin is a mess. tap him' : 'android 18 drops by, sees no krillin, shrugs and leaves'); nextDate = 300 + Math.random() * 120; }
      if (date && t > date.until) date = null;
      // dr. gero / android 19 flies in and drains your power until you tap him
      if (!gero && session > 140 && !shen && !boss && (nextGero -= dt) < 0) { S.geros = (S.geros || 0) + 1; gero = { spr: S.geros % 2 ? A20 : A19, name: S.geros % 2 ? 'dr. gero' : 'android 19', x: st.W + 20, y: st.H * .28, t0: t, drained: 0 }; ui.event(`${gero.name} is absorbing your power — tap him!`); ui.sfx && ui.sfx('boss'); nextGero = 230 + Math.random() * 80; }
      if (gero) {
        const h = handPos(), tx = h.x + st.W * .18, ty = h.y - st.H * .16; gero.x += (tx - gero.x) * Math.min(1, dt * 2); gero.y += (ty - gero.y) * Math.min(1, dt * 2);
        if (t - gero.t0 > 1.2) { const d = Math.min(S.pl, rate() * 3 * dt); S.pl -= d; gero.drained += d; }
        if (t - gero.t0 > 15) { ui.event(`${gero.name} got away with ${fmtShort(Math.round(gero.drained))} power`); gero = null; }
      }
      // android 16 stands still while birds land on him; free one for calm, but beams upset him
      if (!a16 && session > 100 && !shen && (nextA16 -= dt) < 0) { a16 = { c: capPt(.35, 2.2), t0: t, until: t + 16, birds: [0, 1, 2].map(i => ({ i, free: 0, kind: Math.random() * 4 | 0 })) }; ui.event('android 16 is watching the birds'); nextA16 = 180 + Math.random() * 80; }
      if (a16 && t > a16.until) a16 = null;
      // west city: bulma's capsules pop up on the planet; each one is a gadget
      if (S.world === 5 && gadgets.length < 3 && (nextGadget -= dt) < 0) { gadgets.push({ c: capPt(.25 + Math.random() * .8, Math.random() * 6.28), t0: t, kind: Math.random() * 4 | 0 }); nextGadget = 4 + Math.random() * 3; }
      if (lvl('auto') && playing) { autoAcc += dt * lvl('auto'); while (autoAcc > 1) { autoAcc -= 1; const k = kidScreen(14); gain((1 + S.boots * ms('boots')) * mult() * (1 + .5 * lvl('fist')), k.x, k.y - 10); } }
      if (robotUntil > t) { robotAcc += dt; while (robotAcc > .25) { robotAcc -= .25; const k = kidScreen(14); gain((1 + S.boots * ms('boots')) * mult() * (1 + .5 * lvl('fist')), k.x, k.y - 10); } }
      if (bikeUntil > t) sprint = 1.2;
      // frieza's ship lands and four soldiers hop out; drop them all before it lifts off
      if (!ship && session > 150 && !tour && !shen && !boss && !(ginyu && !ginyu.done) && (nextShip -= dt) < 0) { ship = { c: capPt(.35 + Math.random() * .5, Math.random() * 6.28), t0: t, until: t + 28, out: 0, ko: 0, next: t + 1.6 }; ui.event("frieza's ship has landed — take out his soldiers!"); ui.sfx && ui.sfx('boss'); nextShip = 220 + Math.random() * 60; }
      if (ship) {
        if (!ship.left && ship.out < 4 && t > ship.next) { saibas.push({ c: V.norm(V.add(ship.c, [Math.random() - .5, Math.random() - .5, Math.random() - .5], .3)), born: t, life: 16, soldier: true }); ship.out++; ship.next = t + 1.1; }
        if (!ship.left && ship.ko >= 4) { ship.left = t; victory(); ach('fleet'); const g = Math.max(500, wrate() * 60) * (1 + .5 * S.armor); const q = handPos(); gain(g, q.x, q.y - 16, true); ui.event(`frieza's soldiers are down — the ship flees! +${fmtShort(Math.round(g))}`); }
        else if (!ship.left && t > ship.until) { ship.left = t; ui.event("frieza's ship took off"); }
        if (ship.left && t - ship.left > 1.5) ship = null;
      }
      // yamcha turns up flattened in a crater now and then; help him up for a senzu
      if (!yam && session > 100 && !shen && (nextYam -= dt) < 0) { yam = { c: capPt(.3 + Math.random() * .6, Math.random() * 6.28), boom: t + 2.4, until: t + 16 }; ui.event('a saibaman jumps on yamcha…'); nextYam = 200 + Math.random() * 80; }
      if (yam && yam.boom && t > yam.boom) { yam.boom = 0; shake = .6; if (yam.sx !== undefined) burst(yam.sx, yam.sy - 6, [0xffffff, 0xffe08a, 0xa6e67e, 0x58b848], 30, 160); ui.sfx && ui.sfx('boom'); ui.event('BOOM. yamcha got wrecked again — tap him'); }
      if (yam && t > yam.until) yam = null;
      // the fusion dance: fu · sion · ha! three taps on the beat. all three makes the real fusion, fewer a botched one
      if (!dance && !(fused && fused.until > t) && session > 200 && S.best >= 2e5 && !shen && !boss && !tour && !S.world && !cling && (nextDance -= dt) < 0) { const satanTurn = Math.random() < .2, [who, res] = satanTurn ? ['mr. satan', 'satan'] : DANCE[S.hero] || DANCE.vegeta; dance = { who, res, t0: t, beats: [t + 2, t + 2.8, t + 3.6], i: 0, hits: 0, ok: -9 }; ui.event(`${who} wants to do the fusion dance! tap on the beat: fu · sion · ha!`, 3500); nextDance = 300 + Math.random() * 120; }
      if (dance) { while (dance.i < dance.beats.length && t > dance.beats[dance.i] + .32) dance.i++;
        if (!dance.done && t > dance.beats[2] + .4) { dance.done = t; const ok = dance.hits === 3, sat = dance.res === 'satan', spr = sat ? FUSED.satan : ok ? FUSED[dance.res] : dance.hits ? FUSED.fat : FUSED.skinny;
          fused = { spr, x: sat ? 1.5 : ok ? 3 : .75, until: t + (ok || sat ? 25 : 15), fat: !sat && !ok && dance.hits > 0 }; flashT = 1; shake = .6; ui.sfx && ui.sfx('form'); ach('dance');
          ui.event(sat ? 'fusion ha! …mr. satan takes all the credit. ×1.5 for 25s' : ok ? `fusion ha! ${dance.res === 'gohanVidel' ? 'gohan and videl' : dance.res} — ×3 for 25s` : dance.hits ? 'fusion ha… you got the fat one. ×0.75 for 15s' : 'fusion ha… you got the skinny one. ×0.75 for 15s', 4000); }
        if (dance.done && t - dance.done > 1) dance = null; }
      // a saibaman clings to you now and then: tap it off before it blows
      if (!cling && session > 150 && !shen && !boss && !tour && !S.world && (nextCling -= dt) < 0) { cling = { boom: t + 3.5 }; ui.event('a saibaman is hugging you — tap it off!'); nextCling = 240 + Math.random() * 120; }
      if (cling && t > cling.boom) { const k = kidScreen(10); burst(k.x, k.y, [0xffffff, 0xffe08a, 0xa6e67e, 0x58b848], 30, 160); shake = .8; flashT = .6; tiredUntil = Math.max(tiredUntil, t + 6); ui.sfx && ui.sfx('boom'); ui.event('BOOM — you got yamcha\'d. tired ×0.75 for 6s'); cling = null; }
      // king kai takes his car for a spin round the road; tap it for a ride
      if (!car && session > 70 && !shen && (nextCar -= dt) < 0) { car = { phi: phi + Math.PI, until: t + 16 }; ui.event("king kai's out for a drive — tap his car"); nextCar = 170 + Math.random() * 60; }
      if (car) { car.phi += .85 * dt; if (t > car.until) car = null; }
      if (kai && t > kai.until) kai = null;
      // the time chamber door, once you own the key
      if (S.chamber > 0 && !door && chamberUntil < t && (nextDoor -= dt) < 0) { door = { c: capPt(.25 + Math.random() * .9, Math.random() * 6.28), t0: t, until: t + 15 }; once('door', 'the time chamber door is open — tap it'); nextDoor = 150 + Math.random() * 40; }
      if (door && t > door.until) door = null;
      // piccolo zaps a meteor with his special beam cannon
      if (S.piccolo > 0 && (nextZap -= dt) < 0) { nextZap = 5; const m = meteors.find(m => !m.dead && m.delay <= 0); if (m && piccoloAt) { zap = { x0: piccoloAt.x, y0: piccoloAt.y - 8, x1: m.x, y1: m.y, t0: t }; m.dead = true; goal('meteor'); gain(25 * mult() * (1 + Math.min(laps, 50) * .1), m.x, m.y - 6, true); burst(m.x, m.y, [0xffffff, 0xfff08a, 0x9a6ad8], 12, 90); ui.sfx && ui.sfx('beam'); } }
      // the ginyu force
      if (!ginyu && !tour && !boss && !shen && session > 150 && S.best >= 5e4 && (nextGinyu -= dt) < 0) { krillinHit('the ginyu force'); const hp = Math.max(300, wrate() * 9); ginyu = { members: GINYU.map((g, i) => ({ ...g, hp, max: hp, i, x: 0, y: 0, k: 1, flash: 0, dead: false })), max: hp * 5, t0: t, until: t + 45, nextKi: 1 }; ui.event('the ginyu force strikes a pose!'); ui.sfx && ui.sfx('boss'); nextGinyu = 300 + Math.random() * 60; }
      if (ginyu && !ginyu.done && t > ginyu.until) { ui.event(ginyu.androids ? '17 and 18 got bored and flew off' : 'the ginyu force retreats'); ginyu.done = t; }
      if (ginyu && ginyu.done && t - ginyu.done > 1.5) ginyu = null;
      // the scouter can't take it
      if (S.best > 9000) ach('o9k'); if (!S.o9k && S.best > 9000) { S.o9k = 1; boostUntil = Math.max(boostUntil, t + 20); shake = .6; ui.event("it's over 9000!!  ×2 for 20s"); ui.fx && ui.fx('star'); const q = handPos(); burst(q.x, q.y - 6, [0xffffff, 0x9cf0b8, 0x34d873, 0xe0473e], 30, 160); save(); }
      // saibamen sprout from the soil in threes; tap or beam them before they burrow back
      if (!tour && session > 80 && (nextSaiba -= dt) < 0) { once('saiba', 'saibamen! tap them'); for (let i = 0; i < 3; i++) saibas.push({ c: capPt(.25 + Math.random() * .85, Math.random() * 6.28), born: t + i * .35, life: 11 }); nextSaiba = 35 + Math.random() * 20; }
      for (const sb of saibas) if (!sb.dead && t - sb.born > sb.life) { sb.dead = true; sb.gone = true; if (sb.sx !== undefined) burst(sb.sx, sb.sy - 4, [0xe7e2d4, 0xcfc8b6], 8, 50); }
      saibas = saibas.filter(sb => !sb.dead);
      // villain raids: one hovers by the planet with a health bar; Vegeta fires ki blasts at him while you tap
      // the tournament of power: 60s of saibamen waves and a villain halfway; your KO count is the score to beat
      }
      // the first visit at 1M, then each time this run's best passes 4x what it was when you last left: the eight worlds strictly in turn
      if (!S.world && S.runBest >= (S.namekAt || PLANET_EVERY) && !tour && !shen && !boss) { S.namekAt = S.runBest * 4; S.trips = (S.trips || 0) + 1; travel([1, 2, 3, 4, 5, 6, 7, 8][(S.trips - 1) % 8]); namekUntil = t + (S.world === 3 ? 75 : 45); }
      if (S.world && !namekUntil) namekUntil = t + Math.min(45, S.namekLeft || 45);   // resumed after a reload
      if (S.world) { S.namekLeft = Math.max(0, namekUntil - t); if (S.namekLeft <= 0 && !shen && (S.world !== 3 || snk?.done)) { travel(0); namekUntil = 0; S.namekAt = Math.max(S.namekAt || 0, S.runBest * 2); } }   // home after any wishes; the next trip is at least twice this run's best away
      if (S.world !== 3) {
      if (S.partner >= 3 && S.best >= 50000 && fuseUntil < t && fuseOffer < t && !tour && (nextFuse -= dt) < 0) { fuseOffer = t + 12; nextFuse = 170 + Math.random() * 60; ui.event('bubbles wants to fuse — tap him!'); }
      if (!tour && !shen && !boss && session > 75 && S.best >= 3000 && (nextTour -= dt) < 0) { tour = { t0: t, until: t + 60, ko: 0, next: 1.5, villain: false }; ui.event('the tournament of power begins — 60s!'); ui.fx && ui.fx('star'); }
      if (tour) {
        if ((tour.next -= dt) < 0 && saibas.length < 8) { saibas.push({ c: capPt(.2 + Math.random() * .9, Math.random() * 6.28), born: t, life: 6 }); tour.next = Math.max(.45, 1.2 - (t - tour.t0) / 80); }
        if (!tour.villain && t - tour.t0 > 28 && !boss) { tour.villain = true; const V0 = VILLAINS[(S.bosses || 0) % VILLAINS.length], hp = Math.max(400, wrate() * 18); boss = { name: V0.name === 'vegeta' && S.hero === 'vegeta' ? 'past vegeta' : V0.name, spr: V0.spr, hp, max: hp, t0: t, until: t + 25, x: 0, y: 0, k: 1, flash: 0, nextKi: 1 }; ui.event(`${V0.name} joins the tournament!`); }
        if (t > tour.until) {
          const ko = tour.ko, best = S.tourBest || 0, prize = Math.max(500, rate() * ko * 8); S.tourBest = Math.max(best, ko); gain(prize); goal('tour', ko, true);
          ui.event(ko > best ? `tournament over — ${ko} KO, new best! +${fmtShort(Math.round(prize))}` : `tournament over — ${ko} KO (best ${best}) +${fmtShort(Math.round(prize))}`); ui.fx && ui.fx('star');
          ach('tournament'); tour = null; nextTour = 240 + Math.random() * 60; nextSaiba = 30; save();
        }
      }
      // nappa defends planet vegeta
      if (S.world === 2 && nextNappa > 0 && !boss && !shen && (nextNappa -= dt) <= 0) { nextNappa = 0; const hp = Math.max(800, wrate() * 50); boss = { name: 'nappa', spr: NAPPA, hp, max: hp, t0: t, until: t + 35, x: 0, y: 0, k: 1, flash: 0, nextKi: 1 }; ui.event('nappa: "vegeta, let me handle this!" — tap him'); }
      if (!tour && session > 110 && !boss && !shen && (nextBoss -= dt) < 0) {
        // the next saga in story order; after beerus it all starts over, tougher
        const n = VILLAINS.length, V0 = VILLAINS[S.saga % n], hp = Math.max(600, wrate() * 40) * (1 + .15 * S.saga), me = V0.name === 'vegeta' && S.hero === 'vegeta', twin = V0.name === 'goku black' && S.hero === 'goku';
        boss = { name: me ? 'past vegeta' : V0.name, spr: V0.spr, hp, max: hp, t0: t, until: t + 40, x: 0, y: 0, k: 1, flash: 0, nextKi: 1, saga: true };
        ui.event(`saga ${S.saga % n + 1}/${n}: ` + (me ? 'your younger self shows up, scouter and all — "that\'s MY hair!" tap him' : twin ? 'goku black is attacking — "hey, that\'s MY face!" tap him' : `${V0.name} is attacking — tap him!`), 4000); nextBoss = 160 + Math.random() * 60; krillinHit(V0.name);
      }
      // meteor storm: a 12s downpour; every bust counts and pays out at the end
      if (!storm && session > 120 && !tour && !shen && !boss && (nextStorm -= dt) < 0) { storm = { until: t + 12, next: t, hit: 0 }; ui.event('meteor storm! bust as many as you can'); ui.sfx && ui.sfx('boss'); nextStorm = 260 + Math.random() * 60; }
      if (storm) {
        if (t < storm.until && t > storm.next) { storm.next = t + .3; meteors.push({ x: st.W * (.1 + Math.random() * 1.1), y: -10, vx: -st.W * (.1 + Math.random() * .08), vy: st.H * (.25 + Math.random() * .15), delay: 0 }); }
        if (t > storm.until + 2) { const g = storm.hit * Math.max(30, rate() * 2); if (storm.hit) { const q = handPos(); gain(g, q.x, q.y - 16, true); } ui.event(storm.hit ? `meteor storm over — ${storm.hit} busted, +${fmtShort(Math.round(g))}` : 'meteor storm over'); if (storm.hit >= 20) { victory(); ach('storm20'); } storm = null; }
      }
      // spirit bomb charge: a full one takes five minutes to gather
      if (S.spirit > 0 && !spiritShot && !spiritReady && playing) { spirit = Math.min(1, spirit + dt / 300); if (spirit >= 1) { spiritReady = true; once('spirit', 'spirit bomb ready — tap the ball'); } }
      if (spiritShot && t - spiritShot.t0 > .7) { spiritBlast(spiritShot.x1, spiritShot.y1); spiritShot = null; }
      // beam struggle: a villain fires back; tap fast to push the clash into him
      if (boss && !boss.dead && !struggle && !boss.struggled && S.galick > 0 && t - boss.t0 > 5) { boss.struggled = true; if (/struggle/.test(HASH) || Math.random() < .6) { struggle = { t0: t, until: t + 7, p: .5 }; boss.until = Math.max(boss.until, t + 10); ui.event('beam struggle! tap fast to push it back'); ui.sfx && ui.sfx('beam'); } }
      if (struggle) {
        struggle.p -= dt * .11;
        if (!boss || boss.dead) struggle = null;
        else if (struggle.p >= 1) { struggle = null; hitBoss(boss.hp / (1 + .5 * S.armor) + 1, boss.x, boss.y - boss.spr.h / 2 * boss.k); ach('struggle'); ui.event('you won the beam struggle!'); }
        else if (struggle.p <= 0 || t > struggle.until) { struggle = null; tiredUntil = t + 6; shake = .6; ui.event('lost the beam struggle — tired ×0.75 for 6s'); }
      }
      if (boss) {
        if (!boss.dead && t > boss.until) { boss.dead = true; boss.fled = true; boss.t1 = t; ui.event(`${boss.name} got away`); }
        if (boss.dead && t - boss.t1 > 1.2) boss = null;
        else if (!boss.dead && !struggle && (boss.nextKi -= dt) < 0) { boss.nextKi = .7; const h = handPos(); kis.push({ x: h.x, y: h.y, t0: t }); }
        if (boss && !boss.dead && S.krillinAlly && (boss.nextDisc = (boss.nextDisc ?? 2) - dt) < 0) { boss.nextDisc = 5; const h = handPos(); kis.push({ x: h.x, y: h.y - 10, t0: t, disc: true }); }
      }
      if (ginyu && !ginyu.done && (ginyu.nextKi -= dt) < 0) { ginyu.nextKi = .8; const h = handPos(), m = ginyu.members.find(x => !x.dead); if (m) kis.push({ x: h.x, y: h.y, t0: t, m });
      }
      for (const kb of kis) { if (kb.m) { if (kb.m.dead || !ginyu) { kb.done = true; continue; } const tx = kb.m.x, ty = kb.m.y - kb.m.spr.h / 2 * kb.m.k, d = Math.hypot(tx - kb.x, ty - kb.y); if (d < 6) { kb.done = true; ginyuHit(kb.m, Math.max(1, rate() * .2)); continue; } const sp = 260 * dt / d; kb.x += (tx - kb.x) * Math.min(1, sp); kb.y += (ty - kb.y) * Math.min(1, sp); continue; } if (!boss || boss.dead) { kb.done = true; continue; } const tx = boss.x, ty = boss.y - boss.spr.h / 2 * boss.k, d = Math.hypot(tx - kb.x, ty - kb.y); if (d < 6) { kb.done = true; hitBoss(Math.max(1, rate() * (kb.disc ? 2 : .2)), tx, ty); continue; } const sp = 260 * dt / d; kb.x += (tx - kb.x) * Math.min(1, sp); kb.y += (ty - kb.y) * Math.min(1, sp); }
      kis = kis.filter(kb => !kb.done);
      }
      // super mode: a 25s golden-hair burst (×2) each time power level passes the next milestone
      // transform once you're holding the next form's power: spend now or save up for it. a form you reach stays for the run
      if (preview && t > preview.until) { let f = preview.from; while (f < FORMS.length - 1 && S.pl >= FORMS[f + 1].at) f++; if (f < S.form) { S.form = f; ui.fx && ui.fx('form', S.form); ui.event(`the wish wears off — back to ${FORMS[S.form].name}`); } else ui.event(`the wish wears off — but you're holding enough power: ${FORMS[S.form].name} stays`); preview = null; }   // back to the best form your held power earns
      if (S.form < FORMS.length - 1 && S.pl >= FORMS[S.form + 1].at) transform(!!preview);
      if (star) { star.x += star.vx * dt; star.y += Math.sin(t * 3) * .3; if (Math.random() < .9) fx.add({ x: star.x - 7, y: star.y + (Math.random() - .5) * 4, vx: -30, vy: 0, life: .45, s: 2, c: [0xffffff, 0xffd84a, 0xff8a3a], raw: true }); if (star.x > st.W + 12) star = null; }
      for (const m of meteors) { if (m.delay > 0) { m.delay -= dt; continue; } m.x += m.vx * dt; m.y += m.vy * dt; if (!m.dead && Math.random() < .9) fx.add({ x: m.x + 2, y: m.y - 2, vx: -m.vx * .1, vy: -m.vy * .1, life: .5, s: 2, grow: 1, c: [0xfff1c0, 0xffb35a, 0xe0473e, 0x8a8f98], raw: true }); }
      meteors = meteors.filter(m => !m.dead && m.y < st.H + 10);
      if (cloudFly) { const k = kidScreen(10); cloudFly.x += (k.x - cloudFly.x) * dt * 1.8; cloudFly.y += (k.y - 10 - cloudFly.y) * dt * 1.8; if (Math.hypot(k.x - cloudFly.x, k.y - 10 - cloudFly.y) < 6) { cloudFly = null; riding = 10 + S.cloud * 2; ui.event('riding flying nimbus — ×1.5'); } }
      for (const o of orbs) { let d = Math.atan2(Math.sin(o.phi - phi), Math.cos(o.phi - phi)); if (Math.abs(d) < .06 && !o.done) { o.done = true; const k = kidScreen(16); gain(lapValue() * mult() * (o.star ? 3 : 1), k.x, k.y - 12, true); if (o.star) { goal('ball'); S.orbs7++; if (S.orbs7 >= 7) { S.orbs7 = 0; summon(); } else ui.event(`dragon ball ${S.orbs7}/7`); save(); } for (let i = 0; i < 12; i++) fx.add({ x: k.x, y: k.y - 10, vx: (Math.random() - .5) * 90, vy: (Math.random() - .5) * 90, drag: 3, life: .6, c: [0xffffff, 0xffd84a, 0xff9a3c], raw: true }); } }
      for (let i = orbs.length - 1; i >= 0; i--) if (orbs[i].done) orbs.splice(i, 1);
      if (t - lastClick > .9) combo = 1;
      if ((session > 40 || S.world === 2) && !moon && apeUntil < t && (nextMoon -= dt) < 0) { moon = { x: st.W * .2, y: st.H * .22, r: Math.max(9, Math.round(Math.min(st.W, st.H) * .07)), a: 0, born: t }; once('moon', 'a full moon is rising… click it to transform'); }
      { const n = !!moon && !moon.leaving || apeUntil > t; if (n !== night) { night = n; ui.night && ui.night(n); } nightK = Math.max(0, Math.min(1, nightK + (night ? dt : -dt) / .8)); }   // the full moon brings the night
      if (moon) { moon.a = moon.leaving ? moon.a - dt * 1.5 : Math.min(1, moon.a + dt * 1.2); if (!moon.leaving && t - moon.born > 12) moon.leaving = true; if (moon.a <= 0 && moon.leaving) { moon = null; nextMoon = S.world === 2 ? 40 : 180 + Math.random() * 60; } }

      if (drag && (drag.moved <= 6 || charging > 0) && S.galick > 0 && t - drag.t > .3) charging = Math.min(2.5, t - drag.t - .3); else if (!drag) charging = 0;
      if (S.senzu > 0 && !bean && (nextBean -= dt) < 0) { bean = { c: V.mul(capPt(.3 + Math.random() * .9, Math.random() * 6.28), 1.03) }; nextBean = 40 / S.senzu; once('bean', 'a senzu bean sprouted — tap it'); }
      const fxs = [];
      if (S.world) { const left = Math.max(0, namekUntil - t); const wn = ['', 'namek', 'vegeta', 'snake way', 'beerus', 'west city', 'kame house', 'paozu', 'the future'][S.world]; if (bz) fxs.push(bz.awake ? 'beerus AWAKE ×0.25 — find pudding' : `noise ${Math.round(bz.noise * 100)}%`); fxs.push(S.world === 3 && snk ? `${wn} ${Math.floor(Math.min(1, snk.dist / snk.len) * 100)}%` : left > 60 ? `${wn} ${Math.ceil(left / 60)}m` : `${wn} ${Math.ceil(left)}s`); }
      if (storm && t < storm.until) fxs.push(`meteor storm ${Math.ceil(storm.until - t)}s`);
      if (struggle) fxs.push(`struggle ${Math.ceil(struggle.until - t)}s`);
      if (greg) fxs.push(`gregory ${Math.ceil(greg.until - t)}s`);
      if (chamberUntil > t) fxs.push(`time chamber ×2 ${Math.ceil(chamberUntil - t)}s`);
      if (laughUntil > t) fxs.push(`laughing ×1.25 ${Math.ceil(laughUntil - t)}s`);
      if (ginyu && !ginyu.done) fxs.push(`ginyu force ${Math.ceil(ginyu.until - t)}s`);
      if (fuseUntil > t) fxs.push(`fusion ×2 ${Math.ceil(fuseUntil - t)}s`);
      if (whisUntil > t) fxs.push(`whis' training: laps ×2, taps ×2 noise ${Math.ceil(whisUntil - t)}s`);
      if (chiUntil > t) fxs.push(`chi-chi ×1.5 ${Math.ceil(chiUntil - t)}s`);
      if (preview) fxs.push(`${FORMS[S.form].name} (wish) ${Math.ceil(preview.until - t)}s`);
      if (dailyUntil > t) fxs.push(`daily ×1.25 ${Math.ceil((dailyUntil - t) / 60)}m`);
      if (tour) fxs.push(`tournament ${Math.ceil(tour.until - t)}s · ${tour.ko} KO`);
      if (kaioUntil > t) fxs.push(`kaioken ×${KAIO()} ${Math.ceil(kaioUntil - t)}s`); else if (tiredUntil > t) fxs.push(`tired ×0.75 ${Math.ceil(tiredUntil - t)}s`);
      if (boostUntil > t) fxs.push(`boost ×2 ${Math.ceil(boostUntil - t)}s`);
      if (senzuUntil > t) fxs.push(`senzu ×1.5 ${Math.ceil(senzuUntil - t)}s`);
      if (riding > 0) fxs.push('nimbus ×1.5');
      if (carUntil > t) fxs.push(`king kai's car ×1.5 ${Math.ceil(carUntil - t)}s`);
      if (apeUntil > t) fxs.push(`great ape ×3 ${Math.ceil(apeUntil - t)}s`);
      const extra = [S.form ? FORMS[S.form].name + ' ×' + FORMS[S.form].x : (S.pl > 2000 ? 'next form at 20K' : ''), S.orbs7 || S.wishes ? `dragon balls ${S.orbs7}/7` : '', S.wishes ? `wishes ${S.wishes}` : '', S.saga || session > 110 ? `saga ${S.saga % VILLAINS.length + 1}/${VILLAINS.length}` : '', S.seeds ? `ki seeds ${S.seeds}` : '', S.ascend ? `ki seeds ×${seedBoost().toFixed(1)}` : '', S.krillinAlly ? 'krillin: idle ×1.5' : ''].filter(Boolean).join(' · ');
      const nf = FORMS[S.form + 1], cf = FORMS[S.form];
      const G = GOALS.find(g => g.id === S.goal.id);
      ui.update({ goal: { text: G.text, p: Math.min(S.goal.p, G.n), n: G.n }, kaio: { own: S.kaio > 0, ready: t >= kaioReady, left: Math.ceil(kaioReady - t) }, pl: S.pl, best: S.best, rate: rate(), laps, time: session, effects: fxs.join(' · '), extra, combo, form: { name: S.form ? cf.name : 'base', x: cf.x, next: nf ? nf.name : '', p: nf ? Math.min(1, S.pl / nf.at) : 1 }, balls: S.orbs7, wishes: S.wishes, ascend: S.ascend ? seedBoost().toFixed(1) : '' });
      syncShop();
      }

      // ── draw
      st.clear(); zb.fill(-1e9); ib.fill(0);
      if (S.world === 3 && snk) { drawSnake(t, dt); return; }
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
      for (const o of solids) { if (o.fly) o.c = o.fly(t); sphere(o, id++, SHADE[o.kind]); }   // west city hover cars move
      for (const o of slabs) slab(o, id++);
      for (const o of orbs) sphere({ c: V.mul(roadPt(o.phi), 1.14 + Math.sin(t * 4 + o.phi) * .015), r: o.star ? .055 : .045 }, id++, o.star ? SHADE.dorb : SHADE.orb);
      if (bean) { const v = M3.ap(M, bean.c); if (v[2] > 0) { bean.sx = cx + v[0] * R; bean.sy = cy - v[1] * R + st.bob; bean.v = v; } else bean.sx = undefined; }
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
      const kd = kidScreen(), set = fuseUntil > t ? HERO().fused : HERO().forms[S.form];
      const ahead = M3.ap(M, roadPt(phi + .05)), ax = cx + ahead[0] * R, flip = ax < kd.x;
      const surf = S.world === 6;
      const spr = poseUntil > t || struggle ? set.pose : jumpH > 1 || surf ? set.run[0] : set.run[Math.floor(t * (9 + sprint * 10)) % 4];
      const lift = jumpH + (riding > 0 ? 9 : 0) + (surf && !riding ? 3 + Math.sin(t * 4) : 0), depth = kd.v[2] * R + 6; flipNow = flip; liftNow = lift;
      // auras and sparks only while he's in view: behind the planet the depth buffer hides him, and must hide them too
      const seen = (() => { const x = Math.round(kd.x + Math.sin(kd.ang) * (lift + 8)), y = Math.round(kd.y - Math.cos(kd.ang) * (lift + 8)); return x < 0 || y < 0 || x >= st.W || y >= st.H || zb[y * st.W + x] <= depth + 4; })();
      if (riding > 0) blitZ(puff, kd.x, kd.y, kd.ang, flip, lift - 9, depth + 1, 1.25, true);
      if (surf && !riding) { blitZ(SURFBOARD, kd.x, kd.y, kd.ang, flip, lift - 2, depth + 1, 1.1);   // the board under you, bobbing on the swell, kicking up spray
        if (seen && Math.random() < .45) { const bx = kd.x + Math.sin(kd.ang) * lift + (flip ? 10 : -10) * Math.cos(kd.ang), by = kd.y - Math.cos(kd.ang) * lift + (flip ? 10 : -10) * Math.sin(kd.ang); fx.add({ x: bx, y: by, vx: (flip ? 20 : -20) + (Math.random() - .5) * 20, vy: -20 - Math.random() * 25, drag: 2, life: .5, c: [0xffffff, 0xcfe6f2], raw: true }); } }
      if (seen && (aura || boostUntil > t || riding > 0 || S.form > 0 || kaioUntil > t || S.aura)) for (let i = 0; i < (S.form > 0 ? 4 : 3); i++) { const a = kd.ang + (Math.random() - .5) * .9, r = 4 + Math.random() * 8; fx.add({ x: kd.x + Math.sin(kd.ang) * (lift + 10) + Math.cos(a) * r, y: kd.y - Math.cos(kd.ang) * (lift + 10) + Math.sin(a) * r * .5, vx: Math.sin(kd.ang) * 20, vy: -Math.cos(kd.ang) * 30, life: .5, s: 1, grow: 1, c: kaioUntil > t ? [0xffffff, 0xff9a8a, 0xe0332b] : !S.form && S.aura ? AURAS[(S.aura - 1) % AURAS.length] : FORMS[S.form].aura, raw: true }); }
      // super saiyan 2+: crackling sparks around him
      if (seen && FORMS[S.form].sparks && Math.random() < .35) { let x = kd.x + (Math.random() - .5) * 22, y = kd.y - Math.cos(kd.ang) * (lift + 14) + (Math.random() - .5) * 26; for (let k = 0; k < 6; k++) { st.px(x, y, FORMS[S.form].sparks); x += (Math.random() - .5) * 4; y += 1 + Math.random() * 2; } }
      if (apeUntil > t) {
        // giant ape stomps: a little hop each step and a screen shake on landing
        const step = Math.floor(t * 3.2); if (step !== apeStep) { apeStep = step; shake = Math.max(shake, .35); for (let k = 0; k < 8; k++) fx.add({ x: kd.x + (Math.random() - .5) * 30, y: kd.y, vx: (Math.random() - .5) * 60, vy: -20 - Math.random() * 30, drag: 2, life: .5, s: 2, c: [0xffffff, 0xe7e2d4], raw: true }); }
        blitZ(APE[step % 2], kd.x, kd.y, kd.ang, flip, lift + Math.abs(Math.sin(t * 3.2 * Math.PI)) * 3, depth + 30, 2.3);
      } else if (fused && fused.until > t) blitZ(fused.fat ? fused.spr[Math.floor(t * 4) % 4] : fused.spr, kd.x, kd.y, kd.ang, flip, lift, depth, 1.05);
      else blitZ(spr, kd.x, kd.y, kd.ang, flip, lift, depth, 1.05);
      if (dance && !dance.done && seen) { const b = dance.beats[dance.i]; if (b !== undefined) { const r = 6 + Math.max(0, b - t) * 26, hx = kd.x + Math.sin(kd.ang) * 14, hy = kd.y - Math.cos(kd.ang) * 14; for (let a = 0; a < 6.28; a += .12) st.px(hx + Math.cos(a) * r, hy + Math.sin(a) * r, Math.abs(b - t) < .32 ? 0xfff27a : 0xffffff); st.text(['fu', 'sion', 'ha!'][dance.i], hx, hy - r - 8, t - dance.ok < .3 ? 0xfff27a : 0xffffff); } }   // the beat ring
      if (cling) blitZ(SAIBA, kd.x - Math.cos(kd.ang) * 5, kd.y - Math.sin(kd.ang) * 5, kd.ang, !flip, lift + 6 + (cling.boom - t < 1 && Math.floor(t * 16) % 2 ? 1 : 0), depth + 1, .9);   // hugging his back, shaking before it blows
      // piccolo meditates above the planet; king kai and gregory stand on it
      if (S.piccolo > 0) { const c = capPt(.6, .9), v = M3.ap(M, V.mul(c, 1.28)); piccoloAt = v[2] > -.2 ? { x: cx + v[0] * R, y: cy - v[1] * R + st.bob + Math.sin(t * 1.6) * 2 } : null; if (piccoloAt) blitZ(PICCOLO, piccoloAt.x, piccoloAt.y, 0, false, 0, v[2] * R + 8, .95); } else piccoloAt = null;
      if (car) { const c = roadPt(car.phi), v = M3.ap(M, c), ahead = M3.ap(M, roadPt(car.phi + .05)), ax = cx + ahead[0] * R; if (v[2] > .05) { car.sx = cx + v[0] * R; car.sy = cy - v[1] * R + st.bob; blitZ(KAICAR, car.sx, car.sy, Math.atan2(v[0], v[1]), ax > car.sx, 0, v[2] * R + 6, .9); } else car.sx = undefined; }
      if (kai) { const v = M3.ap(M, kai.c), up = Math.min(1, (t - kai.t0) / .4) * Math.min(1, (kai.until - t) / .4); if (v[2] > .05) { kai.sx = cx + v[0] * R; kai.sy = cy - v[1] * R + st.bob; blitZ(KINGKAI, kai.sx, kai.sy, Math.atan2(v[0], v[1]), false, (up - 1) * 18, v[2] * R + 6, .85); } else kai.sx = undefined; }
      if (date) { const v = M3.ap(M, date.c), v2 = M3.ap(M, date.c2), up = Math.min(1, (t - date.t0) / .4) * Math.min(1, (date.until - t) / .4);
        if (v[2] > .05) blitZ(A18, cx + v[0] * R, cy - v[1] * R + st.bob, Math.atan2(v[0], v[1]), true, (up - 1) * 18, v[2] * R + 6, 1);
        if (date.kr && v2[2] > .05) { date.sx2 = cx + v2[0] * R; date.sy2 = cy - v2[1] * R + st.bob; blitZ(KRILLIN, date.sx2, date.sy2, Math.atan2(v2[0], v2[1]), false, (up - 1) * 18 + Math.abs(Math.sin(t * 9)) * 1.5, v2[2] * R + 6, 1); if (!date.paid && Math.random() < .25) fx.add({ x: date.sx2 + (Math.random() - .5) * 8, y: date.sy2 - 20, vx: 0, vy: -24, life: .7, s: 1, c: [0xffd0e0, 0xff7aa8, 0xe0306a], raw: true }); } else date.sx2 = undefined; }
      if (a16) { const v = M3.ap(M, a16.c), up = Math.min(1, (t - a16.t0) / .4) * Math.min(1, (a16.until - t) / .4); if (v[2] > .05) { const x = cx + v[0] * R, y = cy - v[1] * R + st.bob, ang = Math.atan2(v[0], v[1]);
        blitZ(A16, x, y, ang, false, (up - 1) * 18, v[2] * R + 6, .95);
        for (const b of a16.birds) { const fly = b.free ? (t - b.free) * 60 : 0, bx = x + (b.i - 1) * 9 + fly * .6, by = y - 24 - (b.i % 2) * 6 - fly; b.sx = b.free ? undefined : bx; b.sy = by; if (by > -10) st.blit(BIRDS[b.kind], bx - 3, by - 3 + (b.free ? 0 : Math.abs(Math.sin(t * 3 + b.i)) * 1), b.i % 2 === 1, true); }
      } else for (const b of a16.birds) b.sx = undefined; }
      for (const g of gadgets) { const v = M3.ap(M, g.c), up = Math.min(1, (t - g.t0) / .3); if (v[2] > .05) { g.sx = cx + v[0] * R; g.sy = cy - v[1] * R + st.bob; blitZ(GADGETS[g.kind], g.sx, g.sy, Math.atan2(v[0], v[1]), false, (1 - up) * 30 + Math.abs(Math.sin(t * 3 + g.t0)) * 2, v[2] * R + 6, 1); } else g.sx = undefined; }
      const npc = (spr, c, flip = false, k = 1) => { const v = M3.ap(M, c); if (v[2] > .05) blitZ(spr, cx + v[0] * R, cy - v[1] * R + st.bob, standAng(v), flip, 0, v[2] * R + 6, k); };   // standing up on the face of the planet, tipping out only near the rim
      if (S.world === 6 && kh) { const v = M3.ap(M, kh.house); if (v[2] > .05) blitZ(KAMEHOUSE, cx + v[0] * R, cy - v[1] * R + st.bob, Math.atan2(v[0], v[1]), false, 0, v[2] * R + 6, 1); npc(ROSHI, kh.roshi, Math.floor(t / 3) % 2 === 0, .95); }   // roshi stays home by his door
      if (S.world === 8) drawFuture(t, dt);
      if (S.world === 5) { const v = M3.ap(M, capPt(.55, 3.2)); if (v[2] > .05) blitZ(BULMA, cx + v[0] * R, cy - v[1] * R + st.bob, Math.atan2(v[0], v[1]), Math.floor(t / 2) % 2 === 0, 0, v[2] * R + 6, 1); }
      if (S.world === 7) drawPaozu(t);
      if (bz) npc(NPCS.whis, WHIS_AT, Math.floor(t / 3) % 2 === 0);
      if (S.world === 7) npc(NPCS.chichi, CHI_AT, true);
      if (S.world === 6) { npc(NPCS.turtle, TURTLE_AT); npc(NPCS.oolong, OOLONG_AT, Math.floor(t / 2.5) % 2 === 0); }
      if (bz) { const v = M3.ap(M, bz.c); if (v[2] > .05) { const x = cx + v[0] * R, y = cy - v[1] * R + st.bob, ang = Math.atan2(v[0], v[1]);
        if (bz.awake) { blitZ(BEERUS, x + (Math.random() - .5) * 2, y, ang, false, 0, v[2] * R + 6, .9); if (Math.random() < .5) fx.add({ x: x + (Math.random() - .5) * 16, y: y - 10 - Math.random() * 20, vx: 0, vy: -30, life: .5, s: 1, grow: 1, c: [0xffffff, 0xd9c8ff, 0x7a4ae0], raw: true }); }
        else { blitZ(BEERUS, x, y, ang + 1.45, false, -12, v[2] * R + 6, .9); const z = (t * .8) % 1; st.text(z < .33 ? 'z' : z < .66 ? 'zz' : 'zzz', x + 6, y - 22 - z * 6, 0x5e44a0); }
      } }
      if (bean && bean.sx !== undefined) { const ang = Math.atan2(bean.v[0], bean.v[1]), hop = 3 + Math.abs(Math.sin(t * 3)) * 3; blitZ(SENZU, bean.sx, bean.sy, ang, false, hop, bean.v[2] * R + 6, 1.5); if (Math.random() < .12) fx.add({ x: bean.sx + (Math.random() - .5) * 14, y: bean.sy - hop - 8 - Math.random() * 8, vx: 0, vy: -12, life: .5, c: [0xffffff, 0xdaf8b4], raw: true }); }   // hopping a little and sparkling so you spot it
      if (pud) { const v = M3.ap(M, pud.c); if (v[2] > .05) { pud.sx = cx + v[0] * R; pud.sy = cy - v[1] * R + st.bob; blitZ(PUDDING, pud.sx, pud.sy, Math.atan2(v[0], v[1]), false, Math.abs(Math.sin(t * 4)) * 3, v[2] * R + 6, 1.1); } else pud.sx = undefined; }
      if (roshi) { const v = M3.ap(M, roshi.c), up = Math.min(1, (t - roshi.t0) / .4) * Math.min(1, (roshi.until - t) / .4); if (v[2] > .05) {
        const ang = Math.atan2(v[0], v[1]), big = roshi.max && (!roshi.fired || t - roshi.fired < .7), down = roshi.fired && t - roshi.fired >= .7;
        roshi.sx = cx + v[0] * R; roshi.sy = cy - v[1] * R + st.bob;
        const kf = roshi.max && (!roshi.fired || t - roshi.fired < .7) ? (roshi.fired ? 2 : t - roshi.max < .55 ? 0 : 1) : -1, rx = Math.cos(ang), ry = Math.sin(ang);
        if (kf >= 0) blitZ(ROSHI_KAME[kf], roshi.sx + rx * 4, roshi.sy + ry * 4, ang, false, (up - 1) * 18, v[2] * R + 6, .95);   // shifted so his feet stay put
        else blitZ(ROSHI, roshi.sx, roshi.sy, ang + (down ? 1.45 : 0), false, (up - 1) * 18, v[2] * R + 6, .95);
        if (roshi.fired && t - roshi.fired < .6) { const ux = Math.sin(ang), uy = -Math.cos(ang), bx = roshi.sx + rx * 24 + ux * 12, by = roshi.sy + ry * 24 + uy * 12, L = st.W + st.H; for (let d = 0; d < L; d += .5) for (let w = -3; w <= 3; w++) st.px(bx + rx * d + ux * w, by + ry * d + uy * w, Math.abs(w) < 2 ? 0xffffff : 0x6fc8ff); }   // the kamehameha, straight out of his palms
      } else roshi.sx = undefined; }
      if (kril && !kril.dead) { const v = M3.ap(M, kril.c), up = Math.min(1, (t - kril.t0) / .4); if (v[2] > .05) {
        kril.sx = cx + v[0] * R; kril.sy = cy - v[1] * R + st.bob; blitZ(KRILLIN, kril.sx, kril.sy, Math.atan2(v[0], v[1]), false, (up - 1) * 18 + Math.abs(Math.sin(t * 6)) * 2, v[2] * R + 6, 1);
        const a = (t - (kril.boom - .35)) / .35; if (a > 0) for (let i = 0; i <= 1; i += .01) if (i < a) { const x = st.W + 10 + (kril.sx - st.W - 10) * i, y = -10 + (kril.sy - 8 + 10) * i; for (let w = -1; w <= 1; w++) st.px(x, y + w, w ? 0xc89aff : 0xffffff); }   // the ki blast that gets him
      } else kril.sx = undefined; }
      if (satan && t > satan.t0) { const v = M3.ap(M, satan.c), up = Math.min(1, (t - satan.t0) / .3); if (v[2] > .05) { satan.sx = cx + v[0] * R; satan.sy = cy - v[1] * R + st.bob; blitZ(SATAN, satan.sx, satan.sy, Math.atan2(v[0], v[1]), Math.floor(t * 2) % 2 === 0, (up - 1) * 18 + Math.abs(Math.sin(t * 5)) * 3, v[2] * R + 6, 1); } else satan.sx = undefined; }
      if (ship) { const v = M3.ap(M, ship.c), land = Math.min(1, (t - ship.t0) / 1.2), lift = ship.left ? Math.pow((t - ship.left) / 1.5, 2) : 0; if (v[2] > .05) { ship.sx = cx + v[0] * R; ship.sy = cy - v[1] * R + st.bob; blitZ(SHIP, ship.sx, ship.sy, Math.atan2(v[0], v[1]), false, (1 - land) * 70 + lift * 90, v[2] * R + 5, .9); } }
      if (yam) { const v = M3.ap(M, yam.c); if (v[2] > .05) { yam.sx = cx + v[0] * R; yam.sy = cy - v[1] * R + st.bob + 3; if (yam.boom) blitZ(SAIBA, yam.sx, yam.sy - 3, Math.atan2(v[0], v[1]), false, Math.abs(Math.sin(t * 14)) * 2, v[2] * R + 6, 1.1); else decal(YAMCHA, v, 1.1); } else yam.sx = undefined; }
      if (greg) { const k = Math.min(1, (t - greg.hopT) / .35), from = greg.from || greg.c, c = V.norm(V.add(V.mul(from, 1 - k), greg.c, k)), v = M3.ap(M, c); if (v[2] > .05) { greg.sx = cx + v[0] * R; greg.sy = cy - v[1] * R + st.bob; blitZ(GREGORY, greg.sx, greg.sy, Math.atan2(v[0], v[1]), k < 1 && from[0] > greg.c[0], Math.sin(k * Math.PI) * 9, v[2] * R + 4, 1.1); } else greg.sx = undefined; }
      // a revived krillin jogs along behind you; he's off-screen while he's busy on his own (visiting, dying, on a date)
      if (S.krillinAlly && !kril && !(date && date.kr)) { const kv = M3.ap(M, roadPt(phi - .5)); { const kx = cx + kv[0] * R, ky = cy - kv[1] * R + st.bob, ka = M3.ap(M, roadPt(phi - .45)); blitZ(KRILLIN, kx, ky, Math.atan2(kv[0], kv[1]), cx + ka[0] * R < kx, Math.abs(Math.sin(t * 9)) * 2, kv[2] * R + 5, 1); } }
      if (S.partner > 0 && fuseUntil <= t) {
        const mv = M3.ap(M, roadPt(phi - .32)), mx = cx + mv[0] * R, my = cy - mv[1] * R + st.bob, ma = Math.atan2(mv[0], mv[1]);
        monkeyAt = mv[2] > 0 ? { x: mx, y: my, k: Math.min(2.6, 1 + .16 * Math.sqrt(S.partner)) } : null;
        if (fuseOffer > t && Math.random() < .7) fx.add({ x: mx + (Math.random() - .5) * 12, y: my - 4 - Math.random() * 10, vx: 0, vy: -20, life: .5, s: 1, c: [0xffffff, 0xffe08a, 0xff9a3c], raw: true });
        blitZ(MONKEY[Math.floor(t * 8) % 2], mx, my, ma, flip, fuseOffer > t ? Math.abs(Math.sin(t * 9)) * 3 : 0, mv[2] * R + 5, 1.1 * Math.min(2.6, 1 + .16 * Math.sqrt(S.partner)));   // bubbles bulks up with every level: ×1.5 at lv 10, ×1.8 at 25, ×2.1 at 50, maxing out around lv 100
      } else monkeyAt = null;
      if (seen && fuseUntil > t && Math.random() < .6) { const q = handPos(); fx.add({ x: q.x + (Math.random() - .5) * 20, y: q.y + (Math.random() - .5) * 20, vx: 0, vy: -26, life: .5, s: 1, grow: 1, c: [0xffffff, 0xffe08a, 0xff9a3c, 0x6fb0ff], raw: true }); }
      if (charging > 0 && seen) {
        const hp = handPos(), hx = hp.x, hy = hp.y, r = 2 + charging * 2.2;
        // a dotted aim line toward the pointer
        if (drag) { let ax = drag.ax - hx, ay = drag.ay - hy; const al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al; for (let d = r + 4; d < Math.min(al, 400); d += 4) if (((d / 4 | 0) + (t * 12 | 0)) % 2) st.px(hx + ax * d, hy + ay * d, BEAM().aim); }
        for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const d = Math.hypot(x, y) / r; if (d > 1) continue; if (d > .7 && bayer(Math.round(hx + x), Math.round(hy + y)) > .5) continue; st.px(hx + x, hy + y, d < .4 ? 0xffffff : d < .75 ? BEAM().ball : BEAM().ballEdge); }
        if (Math.random() < .9) { const a = Math.random() * 6.28, rr = r + 6 + Math.random() * 8; fx.add({ x: hx + Math.cos(a) * rr, y: hy + Math.sin(a) * rr, vx: -Math.cos(a) * rr * 3, vy: -Math.sin(a) * rr * 3, life: .3, c: [0xffffff, BEAM().spark], raw: true }); }
      }
      if (bang) {
        const k = Math.min(1, (t - bang.t0) / bang.dur), x = bang.x0 + (bang.x1 - bang.x0) * k, y = bang.y0 + (bang.y1 - bang.y0) * k - Math.sin(k * Math.PI) * 14, r = 3 + k * 2;
        for (let yy = -r - 2; yy <= r + 2; yy++) for (let xx = -r - 2; xx <= r + 2; xx++) { const d = Math.hypot(xx, yy); if (d <= r) st.px(x + xx, y + yy, d < r * .5 ? 0xffffff : 0x8fd8ff); else if (d <= r + 2 && bayer(Math.round(x + xx), Math.round(y + yy)) < .5) st.px(x + xx, y + yy, 0x4a9aff, .7); }
        fx.add({ x, y, vx: 0, vy: 0, life: .25, s: 2, c: [0xffffff, 0x8fd8ff, 0x2f6ae0], raw: true });
        if (k >= 1) { explode(bang.x1, bang.y1); bang = null; }
      }
      // the spirit bomb: a pale blue ball over his head, motes of energy streaming in from the planet
      const ball = (x, y, r) => { for (let yy = -r - 2; yy <= r + 2; yy++) for (let xx = -r - 2; xx <= r + 2; xx++) { const d = Math.hypot(xx, yy); if (d <= r) st.px(x + xx, y + yy, d < r * .45 ? 0xffffff : d < r * .8 ? 0xd8f0ff : 0x8fd8ff); else if (d <= r + 2 && bayer(Math.round(x + xx), Math.round(y + yy)) < .5) st.px(x + xx, y + yy, 0x8fd8ff, .6); } };
      if (S.spirit > 0 && !spiritShot && spirit > .04 && playing) {
        const b = spiritPos(), r = b.r * (spiritReady ? 1 + Math.sin(t * 8) * .08 : 1); ball(b.x, b.y, r);
        if (!spiritReady && Math.random() < .6) { const a = Math.random() * 6.28, sx = cx + Math.cos(a) * R * 1.05, sy = cy + st.bob + Math.sin(a) * R * 1.05; fx.add({ x: sx, y: sy, vx: (b.x - sx) * 1.6, vy: (b.y - sy) * 1.6, life: .55, c: [0xffffff, 0xd8f0ff, 0x8fd8ff], raw: true }); }
      }
      if (spiritShot) { const k = Math.min(1, (t - spiritShot.t0) / .7), e = k * k; ball(spiritShot.x0 + (spiritShot.x1 - spiritShot.x0) * e, spiritShot.y0 + (spiritShot.y1 - spiritShot.y0) * e, spiritShot.r); }
      // beam struggle: his beam against the villain's, meeting at the clash point
      if (struggle && boss) {
        const h = handPos(), bx = boss.x, by = boss.y - boss.spr.h / 2 * boss.k, p = Math.max(.04, Math.min(.96, struggle.p)), qx = h.x + (bx - h.x) * p, qy = h.y + (by - h.y) * p;
        const ray = (x0, y0, x1, y1, w, core, edge) => { const L = Math.hypot(x1 - x0, y1 - y0) || 1, dx = (x1 - x0) / L, dy = (y1 - y0) / L; for (let d = 0; d < L; d += .6) { const ww = w * (1 + Math.sin(d * .4 - t * 40) * .12); for (let o = -ww; o <= ww; o += .6) st.px(x0 + dx * d - dy * o, y0 + dy * d + dx * o, Math.abs(o) < ww * .45 ? 0xffffff : Math.abs(o) < ww * .8 ? core : edge); } };
        const w = 3 + R / 40; ray(h.x, h.y, qx, qy, w, BEAM().mid, BEAM().edge); ray(bx, by, qx, qy, w, 0xffd8a0, 0xe0603a);
        ball(qx, qy, w * 2.2 + Math.sin(t * 30) * 1.2); if (Math.random() < .9) fx.add({ x: qx, y: qy, vx: (Math.random() - .5) * 160, vy: (Math.random() - .5) * 160, life: .3, c: [0xffffff, 0xfff3a0, 0xffb35a], raw: true });
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
          const bp = BEAM(), ff = beam.ff && !kame();   // vegeta's level-5 shot is a golden final flash; a kamehameha stays blue
          const w = (3 + beam.c * 3) * (beam.ff ? 1.8 : 1) * (1 + .15 * (S.galick - 1)) * (1 - Math.pow(age / life, 3)), reach = Math.min(1, age / .12) * Math.max(st.W, st.H) * 1.6;
          // the beam sits at vegeta's depth: from the far side only the part clearing the planet shows
          const px = (X, Y, c, a) => { const xi = Math.round(X), yi = Math.round(Y), k = yi * st.W + xi; if (xi >= 0 && yi >= 0 && xi < st.W && k < zb.length && zb[k] > beam.z + 6) return; st.px(X, Y, c, a); };
          for (let d = 2; d < reach; d += .6) {
            const x0 = beam.x + beam.dx * d, y0 = beam.y + beam.dy * d; if (x0 < -30 || y0 < -30 || x0 > st.W + 30 || y0 > st.H + 30) break;
            const ww = w * Math.min(1, .35 + d / 18) * (1 + Math.sin(d * .35 - t * 40) * .12), gw = ww + 2.5;
            for (let o = -gw; o <= gw; o += .6) { const a = Math.abs(o) / (ww || 1), X = x0 - beam.dy * o, Y = y0 + beam.dx * o; if (a > 1) { if (bayer(Math.round(X), Math.round(Y)) < .5) px(X, Y, ff ? 0xffe066 : bp.glow, .6); continue; } px(X, Y, a < .4 ? 0xffffff : a < .75 ? (ff ? 0xfff3a0 : bp.mid) : (ff ? 0xffc21a : bp.edge)); }
          }
          // the charged ball stays lit in his hands while the beam pours out
          const bw = w * 1.4; for (let y = -bw; y <= bw; y++) for (let x = -bw; x <= bw; x++) { const q = Math.hypot(x, y) / bw; if (q <= 1) px(beam.x + x, beam.y + y, q < .55 ? 0xffffff : ff ? 0xfff3a0 : bp.ball); }
          if (beam.z > 0 && Math.random() < .8) fx.add({ x: beam.x + beam.dx * Math.random() * 80, y: beam.y + beam.dy * Math.random() * 80, vx: (Math.random() - .5) * 60, vy: (Math.random() - .5) * 60, life: .4, c: [0xffffff, bp.spark, bp.edge], raw: true });
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
      if (door) { const v = M3.ap(M, door.c), a = Math.min(1, (t - door.t0) / .5); if (v[2] > .05) { const ang = Math.atan2(v[0], v[1]); door.sx = cx + v[0] * R; door.sy = cy - v[1] * R + st.bob; blitZ(DOOR, door.sx, door.sy, ang, false, (a - 1) * 18, v[2] * R + 6, 1.1); if (Math.random() < .3) { const h = Math.random() * 18; fx.add({ x: door.sx + Math.sin(ang) * h + (Math.random() - .5) * 10, y: door.sy - Math.cos(ang) * h, vx: Math.sin(ang) * 10, vy: -Math.cos(ang) * 10, life: .6, s: 1, c: [0xffffff, 0xf6f4ee], raw: true }); } } else door.sx = undefined; }
      if (zap) { const k = (t - zap.t0) / .3; if (k > 1) zap = null; else { const dx = zap.x1 - zap.x0, dy = zap.y1 - zap.y0, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L; for (let d = 0; d < L; d += .6) { const w = Math.sin(d * .5) * 2.2; st.px(zap.x0 + dx * d / L + nx * w, zap.y0 + dy * d / L + ny * w, 0xc89aff); st.px(zap.x0 + dx * d / L, zap.y0 + dy * d / L, 0xfff6a0); } } }
      if (ginyu) for (const m of ginyu.members) {
        const k = m.k = Math.max(.9, R / 62), slot = ginyu.androids ? ((m.i + Math.floor((t - ginyu.t0) / 2.5)) % 2) - .5 : m.i - 2, ent = Math.min(1, (t - ginyu.t0) / 1.2 + m.i * -.1), out = ginyu.done ? Math.min(1, (t - ginyu.done) / 1.2) : 0;
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
      for (const kb of kis) if (kb.disc) { for (let x = -5; x <= 5; x++) st.px(kb.x + x, kb.y, Math.abs(x) < 3 ? 0xfff6c0 : 0xffd23a); for (let x = -3; x <= 3; x++) { st.px(kb.x + x, kb.y - 1, 0xffe880); st.px(kb.x + x, kb.y + 1, 0xffe880); } }   // destructo disc, flat and spinning
      else for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) { const d = Math.hypot(x, y); if (d <= 2.2) st.px(kb.x + x, kb.y + y, d < 1.2 ? 0xffffff : 0x8fd8ff); }
      for (const m of meteors) if (m.delay <= 0) { st.px(m.x, m.y, 0xffffff); st.px(m.x + 1, m.y, 0xffe08a); st.px(m.x, m.y + 1, 0xffb35a); st.px(m.x + 1, m.y + 1, 0xe0473e); }
      fx.step(st, dt);
      if (star) st.blit(POD, star.x - 7, star.y - 7, false, true);   // in front of the planet
      if (gero) { const h = handPos(); if (t - gero.t0 > 1.2) for (let i = 0; i <= 1; i += .02) if ((i * 50 + t * 20) % 4 < 2) st.px(h.x + (gero.x - h.x) * i, h.y + (gero.y - gero.spr.h * .55 - h.y) * i, 0xe0473e); st.blit(gero.spr, gero.x - gero.spr.w / 2, gero.y - gero.spr.h + Math.sin(t * 3) * 2, true, true); }
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

    // by night the cloud sea turns moonlit blue, fading in step with the sky
    const NIGHT_SEA = [0x141a3a, 0x232c5a, 0x3a4a82, 0x6a7ab8];
    const seaPal = () => { const day = WORLDS[S.world].sea; if (nightK <= 0) return day; return day.map((c, i) => { const n = NIGHT_SEA[i], k = nightK, ch = sh => Math.round(((c >> sh) & 255) + (((n >> sh) & 255) - ((c >> sh) & 255)) * k); return (ch(16) << 16) | (ch(8) << 8) | ch(0); }); };
    // the future: 17 and 18 stand among the ruins, smoke columns climb from the burning towers, and it rains
    function drawFuture(t, dt) {
      futAndro.forEach((c, i) => { const v = M3.ap(M, c); if (v[2] > .05) blitZ(i ? A18 : A17, cx + v[0] * R, cy - v[1] * R + st.bob, standAng(v), i === 0, 0, v[2] * R + 6, 1); });
      { const v = M3.ap(M, FUT_GOHAN); if (v[2] > .05) blitZ(FUSED.futureGohan, cx + v[0] * R, cy - v[1] * R + st.bob, standAng(v), false, 0, v[2] * R + 6, .85); }   // future gohan squares up to them, one arm and all
      for (const p of smokes) { const v = M3.ap(M, p); if ((v[2] > .1 || Math.hypot(v[0], v[1]) > 1.02) && Math.random() < dt * 9) fx.add({ x: cx + v[0] * R + (Math.random() - .5) * 3, y: cy - v[1] * R + st.bob, vx: 2 + Math.random() * 3, vy: -11 - Math.random() * 5, life: 3.4, s: 2, grow: 4, c: [0x5a5e64, 0x4a4e54, 0x3a3e44, 0x2e3238], raw: true }); }
      for (let i = 0; i < 90; i++) { const y = (hash(i * 5.3) * st.H + t * (150 + hash(i * 3.1) * 60)) % (st.H + 8) - 4, x = ((hash(i * 1.7) * st.W - y * .3) % st.W + st.W) % st.W; for (let k = 0; k < 4; k++) st.px(Math.round(x + k * .3), Math.round(y - k), 0xc8d4e0, .45); }
    }
    function drawSea(t, front) {
      // cloud puffs keep the same on-screen size whatever the pixel scale (phones render at 2×, desktop at 3×)
      const glint = S.world === 8, ck = 3 / st.scale, base = st.H - (st.H * (front ? .06 : .14) * (st.scale === 2 ? .7 : 1)), W = st.W, pal = seaPal(), sp = (front ? 6 : 3) * ck, rr = Math.round((front ? 9 : 7) * ck);
      for (let i = -2; i < W / (rr * 1.3) + 3; i++) {
        const px = ((i * rr * 1.3 - t * sp) % (W + rr * 4) + W + rr * 4) % (W + rr * 4) - rr * 2, py = base + Math.sin(i * 1.7) * rr * .45 + (front ? 0 : -6 * ck), r = rr * (.8 + .4 * hash(i * 3.3 + (front ? 9 : 0)));
        for (let y = Math.floor(py - r); y < st.H; y++) for (let x = Math.floor(px - r); x <= px + r; x++) {
          const dx = x - px, dy = y - py; if (dy < 0 && dx * dx + dy * dy > r * r) continue; if (dy >= 0 && Math.abs(dx) > r) continue;
          const l = dy < 0 ? -(dx * .5 + dy * .9) / r : -.6 - dy / (st.H - py + 1), v = l + bayer(x, y) * .3;
          st.px(x, y, glint && v < -.2 && !((x * 3 + y) & 7) && h2(x * 7 + (t * 4 | 0), y) > .94 ? FUT.fire[2] : pal[v > .65 ? 3 : v > .2 ? 2 : v > -.4 ? 1 : 0]);   // embers glint in the future's smoke
        }
      }
    }
    useWorld(S.world || 0); ui.world && ui.world(S.world || 0);
    layout(); scenery(); syncShop();
    if (/ape/.test(HASH)) { session = 41; nextMoon = 0; }
    if (/ginyu/.test(HASH)) { session = 151; S.best = Math.max(S.best, 5e4); nextGinyu = 0; }   // preview hook: #ginyu
    if (/visitors/.test(HASH)) { session = 61; nextGreg = 0; nextKai = 0; }   // preview hook: #visitors (gregory, king kai)
    if (/raid/.test(HASH)) { session = 111; nextBoss = 0; nextSaiba = 0; }   // preview hook: #raid
    { const sg = HASH.match(/saga(\d+)/); if (sg) { S.saga = Math.max(0, +sg[1] - 1); session = 111; nextBoss = 0; } }   // preview hook: #saga3 (that saga's villain raids now)
    if (/roshi/.test(HASH)) { session = 91; nextRoshi = 0; }   // preview hook: #roshi
    if (/paozu/.test(HASH)) { S.best = Math.max(S.best, 7e6); S.namekAt = 7e6; S.trips = 6; }   // preview hook: #paozu
    if (/westcity/.test(HASH)) { S.best = Math.max(S.best, 5e6); S.namekAt = 5e6; S.trips = 4; }   // preview hook: #westcity
    if (/kame/.test(HASH)) { S.best = Math.max(S.best, 6e6); S.namekAt = 6e6; S.trips = 5; }   // preview hook: #kame
    if (/future/.test(HASH)) { S.best = Math.max(S.best, 5e6); S.namekAt = 5e6; S.trips = 7; }   // preview hook: #future (trunks' timeline)
    if (/androids/.test(HASH)) { session = 201; S.best = Math.max(S.best, 2e5); nextAndro = 0; }   // preview hook: #androids (17 and 18)
    if (/date/.test(HASH)) { session = 161; nextDate = 0; }   // preview hook: #date (18 visits krillin)
    if (/gero/.test(HASH)) { session = 141; nextGero = 0; }   // preview hook: #gero
    if (/sixteen/.test(HASH)) { session = 101; nextA16 = 0; }   // preview hook: #sixteen (16 and the birds)
    if (/beerus/.test(HASH)) { S.best = Math.max(S.best, 4e6); S.namekAt = 4e6; S.trips = 3; }   // preview hook: #beerus (his planet)
    if (/krillin/.test(HASH)) { session = 131; nextKril = 0; }   // preview hook: #krillin
    if (/seeds/.test(HASH)) S.seeds = 40;   // preview hook: #seeds (40 ki seeds to spend)
    if (/fusion/.test(HASH)) { S.partner = Math.max(3, S.partner); S.best = Math.max(S.best, 5e4); nextFuse = 2; }   // preview hook: #fusion
    if (/namek|porunga/.test(HASH)) { S.best = Math.max(S.best, 1e6); S.namekAt = 1e6; S.trips = 0; }   // preview hooks: #namek, #porunga (namek, then summon)
    if (/chamber/.test(HASH)) setTimeout(() => { chamberT0 = st.t; chamberUntil = st.t + 60; }, 800);   // preview hook: #chamber
    if (/kaio/.test(HASH)) S.kaio = Math.max(1, S.kaio);   // preview hook: #kaio (kaioken owned)
    if (/vegeta/.test(HASH)) { S.best = Math.max(S.best, 2e6); S.namekAt = 2e6; S.trips = 1; }   // preview hook: #vegeta (planet vegeta, then nappa)
    { const hh = HASH.match(/hero-(\w+)/); if (hh && HEROES[hh[1]]) S.hero = hh[1]; }   // preview hook: #hero-goku (play as any character)
    if (/snake/.test(HASH)) { S.best = Math.max(S.best, 3e6); S.namekAt = 3e6; S.trips = 2; }   // preview hooks: #snake (snake way), #snake-nimbus (riding the nimbus)
    if (/door/.test(HASH)) { S.chamber = Math.max(1, S.chamber); nextDoor = 0; }   // preview hook: #door (the time chamber door)
    if (/car/.test(HASH)) { session = 71; nextCar = 0; }   // preview hook: #car (king kai's car)
    if (/pod/.test(HASH)) { session = 13; nextStar = 0; }   // preview hook: #pod (a saiyan space pod)
    if (/storm/.test(HASH)) { session = 121; nextStorm = 0; }   // preview hook: #storm (meteor storm)
    if (/spirit/.test(HASH)) { S.spirit = Math.max(1, S.spirit); spirit = .97; }   // preview hook: #spirit (a nearly full spirit bomb)
    if (/struggle/.test(HASH)) { session = 111; nextBoss = 0; S.galick = Math.max(1, S.galick); }   // preview hook: #struggle (a villain who fires back)
    if (/frieza/.test(HASH)) { session = 151; nextShip = 0; }   // preview hook: #frieza (his ship lands)
    if (/yamcha/.test(HASH)) { session = 101; nextYam = 0; }   // preview hook: #yamcha
    if (/cling/.test(HASH)) { session = 151; nextCling = 0; }   // preview hook: #cling (a saibaman hugs you)
    if (/dance/.test(HASH)) { session = 201; nextDance = 0; S.best = Math.max(S.best, 2e5); }   // preview hook: #dance (the fusion dance)
    if (/gregory/.test(HASH)) { session = 61; nextGreg = 0; }   // preview hook: #gregory (the race)
    if (/tournament/.test(HASH)) { session = 76; S.best = Math.max(S.best, 3000); nextTour = 0; }   // preview hook: #tournament
    if (/shenron/.test(HASH)) setTimeout(() => summon(+(HASH.match(/shenron(\d)/) || [0, 1])[1]), 800);   // preview hook: #shenron summons him   // preview hook: #ape brings the moon out at once
    S.runBest = Math.max(S.runBest, S.best);   // hooks raise best; this run's best follows
    // the achievements / characters popup reads from here
    const menu = () => ({ seeds: S.seeds, boost: seedBoost().toFixed(1), branches: ['body', 'spirit', 'fate'].map(b => ({ name: b, pts: branchPts(b) })), tree: TREE.map(n => ({ id: n.id, branch: n.branch, tier: n.tier, need: TIER_NEED[n.tier], open: nodeOpen(n), name: n.name, what: n.what, lvl: lvl(n.id), max: nodeMax(n), cost: nodeCost(n), can: nodeOpen(n) && lvl(n.id) < nodeMax(n) && S.seeds >= nodeCost(n) })), spent: TREE.some(n => lvl(n.id)), ach: ACH.map(a => ({ ...a, done: !!S.ach[a.id] })), chars: CHARS.map(c => ({ id: c.id, name: c.name, open: heroOpen(c.id), need: c.need && ACH.find(a => a.id === c.need).text, on: S.hero === c.id })) });
    const learn = id => { const n = TREE.find(x => x.id === id); if (!n || !nodeOpen(n) || lvl(id) >= nodeMax(n) || S.seeds < nodeCost(n)) return; S.seeds -= nodeCost(n); S.tree[id] = lvl(id) + 1; ui.sfx && ui.sfx('buy'); save(); syncShop(); };
    const respec = () => { for (const n of TREE) for (let r = 0; r < lvl(n.id); r++) S.seeds += rankCost(n, r); S.tree = {}; save(); syncShop(); };
    const pick = id => { if (!heroOpen(id)) return false; S.hero = id; save(); return true; };
    const thumb = (id, k = 4) => { const spr = (HEROES[id] || HEROES.vegeta).idle, c = document.createElement('canvas'); c.width = spr.w * k; c.height = spr.h * k; const x = c.getContext('2d'); for (let j = 0; j < spr.h; j++) for (let i = 0; i < spr.w; i++) { const v = spr.col[j * spr.w + i]; if (v < 0) continue; x.fillStyle = '#' + v.toString(16).padStart(6, '0'); x.fillRect(i * k, j * k, k, k); } return c; };
    // what the share card shows: the exact power level, the form, and the hero as he looks right now
    const card = () => ({ ach: ACH.filter(a => S.ach[a.id]).sort((a, b) => S.ach[b.id] - S.ach[a.id]).map(a => a.name), achN: ACH.length, laps, time: session, best: Math.floor(S.best), pl: Math.floor(S.pl), form: FORMS[S.form].name, hero: (CHARS.find(c => c.id === S.hero) || CHARS[0]).name, spr: (fuseUntil > st.t ? HERO().fused : HERO().forms[S.form]).idle, world: S.world, scene: st.cv,
      worldName: WORLDS[S.world].name, wishes: S.wishes, orbs: S.orbs7, seeds: S.ascend, sagas: VILLAINS.length, saga: S.saga });
    const ascendInfo = () => { const g = seedsNow(); return { pl: fmtShort(Math.floor(S.pl)), seeds: g, now: seedBoost().toFixed(1), next: (1 + (S.ascend + g) * (.1 + .02 * lvl('seedx'))).toFixed(1), keep: lvl('head') }; };   // what the ascend confirm box spells out
    return { menu, learn, respec, ascendInfo, pick, thumb, card, frame, kaioken, start: () => {
      playing = true; syncShop();
      // first visit of the day: ×1.25 for five minutes and a dragon ball
      const today = new Date().toDateString();
      if (S.daily !== today) { const first = !S.daily; S.daily = today; if (!first) { dailyUntil = st.t + 300; S.orbs7 = Math.min(6, S.orbs7 + 1); setTimeout(() => ui.event('daily bonus: ×1.25 for 5 min + a dragon ball'), 900); } }
      if (/porunga/.test(HASH)) setTimeout(() => summon(), 2500);
      save();
    }, resize: layout, train: () => { const k = kidScreen(14); onClick(k.x + 999, k.y + 999); } };
  }
});
