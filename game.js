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
  rot: ([x, y, z], a) => { const c = Math.cos(a), s = Math.sin(a), C = 1 - c; return [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C]; },   // about a unit axis
  ortho: m => { let a = V.norm([m[0], m[1], m[2]]); const b0 = [m[3], m[4], m[5]], d = V.dot(a, b0), b = V.norm([b0[0] - a[0] * d, b0[1] - a[1] * d, b0[2] - a[2] * d]); return [...a, ...b, ...V.cross(a, b)]; },
};

// hair past ultra instinct: mastered ui steel silver, blue evolved deep blue, beast white with lilac, true ultra ego dark purple, rage pale gold
const LATE_HAIR = [[0xa8b0c4, 0xf4f6fa], [0x1f58c8, 0x6aa8f0], [0xf2f0f8, 0xc8a8f8], [0x4a1a8a, 0x9a6ae0], [0xf2dc6a, 0xd8f2ff]];
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
  const forms = [set(base), set(hair(0xffe02e, 0xfffbc8)), set(hair(0xffe640, 0xfffde0)), setLong(hair(0xffe02e, 0xfffbc8)), set(hair(0xd8344a, 0xff8a8a)), set(hair(0x3fb8ff, 0xc8f2ff)), set(hair(0x6a2fc8, 0xc49cff)), set(Object.assign({}, base, { a: 0xc8302a, A: 0x8a1f1a })), set(hair(0xd8dce8, 0xffffff)), ...LATE_HAIR.map(([h, H]) => set(hair(h, H)))];
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
  const backs = [base, hair(0xffe02e, 0xfffbc8), hair(0xffe640, 0xfffde0), hair(0xffe02e, 0xfffbc8), hair(0xd8344a, 0xff8a8a), hair(0x3fb8ff, 0xc8f2ff), hair(0x6a2fc8, 0xc49cff), base, hair(0xd8dde8, 0xffffff), ...LATE_HAIR.map(([h, H]) => hair(h, H))].map(pal => [runA, runC].map(b => makeSprite(backHead.concat(b), pal, {})));
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
  ['snakeway', 'one million kilometres', 'run all of snake way'], ['hfil', 'home for infinite losers', 'send a lost soul back to HFIL'],
  ['pudding', 'pudding diplomacy', 'calm beerus with pudding'], ['androids', 'seventeen and eighteen', 'beat androids 17 and 18'], ['wallet', "krillin's wallet", 'take krillin\'s wallet while 18 visits'], ['gero', 'not my power', 'make dr. gero let go'], ['birds', 'gentle giant', "free one of 16's birds"], ['westcity', 'capsule corp', 'open a gadget capsule in west city'], ['sagas', 'the whole story', 'clear all 8 sagas'], ['satan', 'the champ', "take mr. satan's prize money"], ['roshi', 'max power', 'watch roshi go max power'], ['krillin', 'you monster', 'watch krillin die (again)'], ['coolerdown', 'cooler down', 'beat cooler and his armoured squadron'], ['unwarped', 'janemba unwarped', 'beat janemba, double and all'], ['sealed', 'bojack sealed', 'beat bojack and his gang'],
  ['mui', 'beyond instinct', "reach your hero's first form past ultra instinct"], ['universe', 'universe star', 'clear a universe'], ['multiverse', 'last one standing', 'clear universe 11 in the tournament of power'], ['mastery', 'beyond the forms', 'earn a mastery star'], ['godki', 'god ki', 'reset for god ki'], ['zeno', "zeno's friend", 'push the zeno button'],
  ['u10', 'obuni goes quiet', 'clear universe 10'], ['u4', 'now you see me', 'clear universe 4'], ['u3', 'anilaza unplugged', 'clear universe 3'], ['u2', 'love lost', 'clear universe 2'], ['u6', 'kefla, split', 'clear universe 6'],
  ['inf1', 'to infinity', 'clear universe ∞'], ['inf5', 'off the edge of the multiverse', 'clear universe ∞ 5'], ['inf10', 'the grand priest is impressed', 'clear universe ∞ 10'], ['whis', "whis's homework", 'learn a rule from the angels'],
  ['f_mui', 'the body moves on its own', 'reach mastered ultra instinct'], ['f_ssbe', 'blue, evolved', 'reach super saiyan blue evolved'], ['f_beast', 'the beast awakens', 'reach beast'], ['f_tue', 'pride of the saiyans', 'reach true ultra ego'], ['f_rage', 'rage of the future', 'reach super saiyan rage'],
  ['giantape', 'oozaru rampage', 'go giant great ape'], ['tail10', 'tail of steel', 'train your tail to lv 10'], ['tail25', 'king of the apes', 'train your tail to lv 25'], ['tail50', 'golden great ape', 'train your tail to lv 50'],
  ['flight', 'bukujutsu', 'wish for the power of flight'], ['flash', 'final flash!', 'fire a fully charged beam at beam lv 5'], ['movies3', 'triple feature', 'beat cooler, janemba and bojack'],
  ['namek', 'namekian holiday', 'visit namek'], ['kame', 'turtle school', 'visit kame house'], ['paozu', 'dinosaur country', 'visit mount paozu'], ['future', 'hope of the future', "visit trunks' future"],
  ['lookout', "mr. popo's tiles", "visit kami's lookout"], ['kaiworld', 'sacred world of the kais', "visit the supreme kai's world"], ['yardrat', 'instant transmission', 'visit yardrat'],
  ['streak', 'golden hop', 'hit a ×3 orb streak on snake way'], ['souls10', 'ghost buster', 'send 10 lost souls back to HFIL'],
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
/* zeno-sama, the omni-king (take A: standing, arms down) */
const ZENO = (() => {
const mir = (W, pts) => pts.map(([x, y]) => [W - x, y]);
const oline = (G, pts, w0, w1, c) => { G.line(pts, w0 + 2, w1 + 2, 'o'); G.line(pts, w0, w1, c); };
const fist = (G, x, y, c, r = 1.5) => { G.ell(x, y, r + 1, r + 1, 'o'); G.ell(x, y, r, r, c); };
const arm = (G, pts, c, hand, w = 3) => { oline(G, pts, w, w - .4, c); const [x, y] = pts[pts.length - 1]; fist(G, x, y, hand); };
const fold = (G, c, c2, hand, dx = 0, dy = 0) => {
  const l = [[7 + dx, 16.6 + dy], [8.6 + dx, 19.4 + dy], [16.6 + dx, 19 + dy]], r = [[19 + dx, 16.6 + dy], [17.6 + dx, 20.4 + dy], [9.4 + dx, 20.2 + dy]];
  G.line(l, 5, 4.6, 'o'); G.line(r, 5, 4.6, 'o'); G.line(l, 3, 2.6, c); G.line(r, 3, 2.6, c2);
  G.ell(9.2 + dx, 19.6 + dy, 1.3, 1.2, hand); G.ell(16.8 + dx, 20.4 + dy, 1.3, 1.2, hand);
};
// ---------- zeno: the omni-king. a big round head, pale blue crown over a white face, tiny black eyes,
// a magenta robe with gold trim and the white 'all' panel, the zeno button ----------
const ZENO_PAL = { o: 0x141028, b: 0x8ab4e8, B: 0x5a7cc0, f: 0xf2f4fa, F: 0xc4c8dc, k: 0x0c0c18, w: 0xffffff, m: 0xc84ab0, M: 0x8a2a7c, y: 0xf2c840, Y: 0xb08820, c: 0xf6f2e8, C: 0xc8c0a8, p: 0x6a3a9a, P: 0x44265e, r: 0xf08aa0, u: 0x3a8af0, U: 0x1a4ab0, l: 0xc8f0ff, s: 0x9ae0ff };
function zeno(o = {}) {
  const W = 24, pose = o.pose || 'stand';
  return shapeSprite(W, 30, G => {
    if (o.erase) for (const [x, y] of [[2, 4], [21, 6], [3, 16], [22, 18], [20, 2]]) { G.set(x, y, 's'); G.set(x - 1, y, 'l'); G.set(x + 1, y, 'l'); G.set(x, y - 1, 'l'); G.set(x, y + 1, 'l'); }
    oline(G, [[10, 24], [9.6, 27]], 3, 3, 'p'); oline(G, [[14, 24], [14.4, 27]], 3, 3, 'p');                       // wide trousers
    G.rect(7, 27, 5, 2, 'y'); G.rect(12, 27, 5, 2, 'y');                                                         // gold slippers
    G.poly([[8, 16], [16, 16], [17, 24.6], [7, 24.6]], 'm');                                                     // robe
    G.poly([[10.4, 16], [13.6, 16], [13.6, 24.6], [10.4, 24.6]], 'c'); G.rect(11, 19, 2, 1, 'M'); G.set(12, 18, 'M'); G.set(12, 20, 'M');   // the 'all' panel
    G.rect(7, 24, 10, 1, 'y'); G.rect(10, 16, 1, 9, 'y'); G.rect(13, 16, 1, 9, 'y');                             // gold trim
    const hand = 'b';
    if (pose === 'stand') { arm(G, [[8, 17], [6.4, 20], [6.8, 22.4]], 'm', hand); arm(G, [[16, 17], [17.6, 20], [17.2, 22.4]], 'm', hand); }
    if (pose === 'button') { arm(G, [[8, 17], [8, 20.4], [11, 21.4]], 'm', hand); arm(G, [[16, 17], [16, 20.4], [13, 21.4]], 'm', hand); G.rect(10, 19, 4, 3, 'c'); G.rect(11, 19, 2, 1, 'u'); G.set(12, 19, 'U'); }   // holding the button
    if (pose === 'cheer') { arm(G, [[8, 17], [5, 14], [4, 10]], 'm', hand); arm(G, [[16, 17], [19, 14], [20, 10]], 'm', hand); }
    if (pose === 'point') { arm(G, [[8, 17], [6.4, 20], [6.8, 22.4]], 'm', hand); arm(G, [[16, 17], [19, 16], [21.4, 15]], 'm', hand); G.set(23, 14, 'l'); }
    G.rect(8, 15, 8, 2, 'y');                                                                                    // gold collar
    // head: a wide egg, pale blue crown with a rounded peak at the back, white face, little ears
    G.ell(12, 8.4, 7, 6.6, 'b'); G.ell(5, 9, 1.4, 1.8, 'b'); G.ell(19, 9, 1.4, 1.8, 'b');
    G.ell(12, 10.2, 5.6, 4.6, 'f'); G.poly([[7, 9], [17, 9], [12, 6.6]], 'f');
    G.set(8, 4, 'l'); G.set(9, 3, 'l');
    const eyes = o.eyes || 'dot';
    if (eyes === 'dot') { G.rect(9, 9, 2, 3, 'k'); G.rect(13, 9, 2, 3, 'k'); G.set(9, 9, 'w'); G.set(13, 9, 'w'); }
    if (eyes === 'happy') { G.rect(9, 10, 2, 1, 'k'); G.rect(13, 10, 2, 1, 'k'); G.set(8, 11, 'k'); G.set(11, 11, 'k'); G.set(12, 11, 'k'); G.set(15, 11, 'k'); }
    if (eyes === 'flat') { G.rect(9, 10, 2, 1, 'k'); G.rect(13, 10, 2, 1, 'k'); }
    G.set(8, 12, 'r'); G.set(15, 12, 'r');                                                                       // rosy cheeks
    if (o.mouth === 'open') { G.rect(11, 13, 2, 1, 'k'); G.set(11, 14, 'r'); G.set(12, 14, 'r'); } else G.rect(11, 13, 2, 1, 'F');
  }, ZENO_PAL, { b: 'B', m: 'M', p: 'P', y: 'Y', c: 'C', f: 'F' });
}
  return zeno({ pose: 'stand' });
})();
/* the tournament of power fighters: four takes each (A idle, B and C attacking or hit, D powered up), keyed by name */
const TOP_FIGHTERS = (() => {
// tournament of power fighters (universes 9, 10, 4, 3, 2, 6, 11) — four takes each, villain scale like hit and jiren
const mir = (W, pts) => pts.map(([x, y]) => [W - x, y]);
const oline = (G, pts, w0, w1, c) => { G.line(pts, w0 + 2, w1 + 2, 'o'); G.line(pts, w0, w1, c); };
const fist = (G, x, y, c, r = 1.5) => { G.ell(x, y, r + 1, r + 1, 'o'); G.ell(x, y, r, r, c); };
const arm = (G, pts, c, hand, w = 3, r = 1.5) => { oline(G, pts, w, w - .4, c); const [x, y] = pts[pts.length - 1]; fist(G, x, y, hand, r); };
// arms folded across the chest; l/r are the two forearms, hands at their far ends
const fold = (G, l, r, c, c2, hand, w = 3, hr = 1.3) => { G.line(l, w + 2, w + 1.6, 'o'); G.line(r, w + 2, w + 1.6, 'o'); G.line(l, w, w - .4, c); G.line(r, w, w - .4, c2); const a = l[l.length - 1], b = r[r.length - 1]; G.ell(b[0], b[1], hr, hr * .9, hand); G.ell(a[0], a[1], hr, hr * .9, hand); };
const shift = (G, dx, dy) => { const m = p => p.map(([x, y]) => [x + dx, y + dy]); return { ...G, ell: (x, y, a, b, c) => G.ell(x + dx, y + dy, a, b, c), rect: (x, y, w, h, c) => G.rect(x + dx, y + dy, w, h, c), poly: (p, c) => G.poly(m(p), c), line: (p, a, b, c) => G.line(m(p), a, b, c), set: (x, y, c) => G.set(x + dx, y + dy, c) }; };
// jiren's flame aura, stretched to any canvas
const AURA_O = [[14, 0], [17, 4], [21, 1], [21.6, 7], [26.6, 6], [24.6, 13], [27.6, 18], [24.6, 24], [27.4, 31], [22, 30], [21, 35.4], [7, 35.4], [6, 30], [.6, 31], [3.4, 24], [.4, 18], [3.4, 13], [1.4, 6], [6.4, 7], [7, 1], [11, 4]], AURA_I = [[14, 3], [19, 6], [24, 9], [22, 18], [25, 29], [3, 29], [6, 18], [4, 9], [9, 6]];
const aura = (G, W, H, c, c2) => { const f = p => p.map(([x, y]) => [x * W / 28, y * H / 36]); G.poly(f(AURA_O), c); if (c2) G.poly(f(AURA_I), c2); };
// one-pixel strokes, snapped to pixel centres (a width-1 stroke along a pixel boundary draws nothing)
const l1 = (G, pts, c) => G.line(pts.map(([x, y]) => [Math.floor(x) + .5, Math.floor(y) + .5]), 1.05, 1.05, c);
const bolt = l1;
// every sprite gets a spare column each side and two spare rows on top, so spikes and auras keep their outline
const spr = (W, H, paint, pal, sh) => shapeSprite(W + 2, H + 2, G => paint(shift(G, 1, 2)), pal, sh);

// ---------- u9 · the trio de dangers: wolf-men brothers. a front-facing wolf head: tall pointed ears, a pale muzzle
// with a black nose, slanted eyes. cx is the face's centre line (a pixel boundary), t the top of the skull ----------
function wolfHead(G, cx, t, c, o = {}) {
  const e = o.ears || [[cx - 3, t + 3], [cx - 5.4, t - 3.4]];
  oline(G, e, 3.8, .8, c.f); oline(G, [[2 * cx - e[0][0], e[0][1]], [2 * cx - e[1][0], e[1][1]]], 3.8, .8, c.f);
  G.line([[e[0][0] - .2, e[0][1] - .4], [e[1][0] + .6, e[1][1] + 1.6]], 1.4, .6, c.i); G.line([[2 * cx - e[0][0] + .2, e[0][1] - .4], [2 * cx - e[1][0] - .6, e[1][1] + 1.6]], 1.4, .6, c.i);
  G.ell(cx, t + 5.2, 4.8, 4.4, c.f);
  G.poly([[cx - 5.6, t + 5], [cx - 6.6, t + 9.6], [cx - 4.6, t + 9.4], [cx - 3.6, t + 11.6], [cx + 3.6, t + 11.6], [cx + 4.6, t + 9.4], [cx + 6.6, t + 9.6], [cx + 5.6, t + 5]], c.f);   // cheek ruff
  if (o.mane) G.poly([[cx - 5, t + 2], [cx - 2, t - .6], [cx, t + 1.4], [cx + 2, t - .6], [cx + 5, t + 2], [cx + 3, t + 3], [cx - 3, t + 3]], c.m || c.f);
  G.poly([[cx - 2.6, t + 7.4], [cx + 2.6, t + 7.4], [cx + 3, t + 10.4], [cx + 1.6, t + 12.4], [cx - 1.6, t + 12.4], [cx - 3, t + 10.4]], c.z);   // muzzle
  G.rect(cx - 1, t + 7, 2, 1, 'k'); G.set(cx - 1, t + 8, 'K');                                                   // nose
  const ey = t + 5, ek = o.eye || 'e';
  if (o.shut) { G.rect(cx - 4, ey + 1, 3, 1, 'k'); G.rect(cx + 1, ey + 1, 3, 1, 'k'); G.set(cx - 3, ey + 2, 'Z'); G.set(cx + 2, ey + 2, 'Z'); }
  else { G.set(cx - 4, ey - 1, 'k'); G.set(cx - 3, ey, 'k'); G.set(cx + 3, ey - 1, 'k'); G.set(cx + 2, ey, 'k');
    G.rect(cx - 4, ey + 1, 2, 1, ek); G.rect(cx + 2, ey + 1, 2, 1, ek); G.set(cx - 3, ey + 1, 'k'); G.set(cx + 2, ey + 1, 'k'); }
  if (o.mouth === 'fang') { G.rect(cx - 2, t + 10, 4, 1, 'k'); G.rect(cx - 2, t + 11, 4, 1, 'm'); G.set(cx - 2, t + 11, 'w'); G.set(cx + 1, t + 11, 'w'); }
  else if (o.mouth === 'grin') { G.rect(cx - 3, t + 10, 6, 1, 'k'); G.set(cx - 2, t + 11, 'w'); G.set(cx + 1, t + 11, 'w'); G.rect(cx - 1, t + 11, 2, 1, 'k'); }
  else if (o.mouth === 'tongue') { G.rect(cx - 2, t + 10, 4, 1, 'k'); G.rect(cx - 1, t + 11, 2, 2, 'q'); G.set(cx - 2, t + 11, 'w'); G.set(cx + 1, t + 11, 'w'); }
  else { G.rect(cx - 1, t + 10, 2, 1, 'k'); G.set(cx - 2, t + 9, 'k'); G.set(cx + 1, t + 9, 'k'); }
}

// bergamo: the eldest, tallest and most muscular; steel-blue grey wolf, a red scarf, bandaged forearms with armbands,
// brown trousers and belt, light-brown boots tied with three straps. absorbs blows and grows
const BER_PAL = { o: 0x0c0e18, b: 0x6c88ae, B: 0x46587e, l: 0xa0b8d8, i: 0xd8a0a8, z: 0xd8e2ee, Z: 0x9aa8bc, k: 0x0a0a10, K: 0x2a2a34, e: 0xf2d040, w: 0xffffff, m: 0x8a1a28, q: 0xe86a8a, r: 0xd02a30, R: 0x86161c, x: 0xf2ead8, X: 0xb8ac94, a: 0x2a2a3a, p: 0x7a4c2c, P: 0x4c2e1a, u: 0xcaa070, U: 0x8a6440, y: 0xf2c840 };
function bergamo(o = {}) {
  const big = !!o.big, W = big ? 34 : 30, H = big ? 44 : 40, cx = W / 2, d = big ? 2 : 0;
  return spr(W, H, G0 => {
    const G = shift(G0, 0, big ? 4 : 0), c = { f: 'b', i: 'i', z: 'z' };
    if (o.aura) aura(G0, W, H, 'l', 'z');
    // legs: brown trousers, boots with three straps
    oline(G, [[cx - 3, 26], [cx - 3.6, 32.4]], 4.2 + d / 2, 3.8 + d / 2, 'p'); oline(G, [[cx + 3, 26], [cx + 3.6, 32.4]], 4.2 + d / 2, 3.8 + d / 2, 'p');
    G.rect(cx - 7, 31, 6, 5, 'u'); G.rect(cx + 1, 31, 6, 5, 'u'); for (const y of [32, 34]) { G.rect(cx - 7, y, 6, 1, 'U'); G.rect(cx + 1, y, 6, 1, 'U'); }
    // v-shaped torso, bare furred chest
    G.poly([[cx - 8 - d, 15], [cx + 8 + d, 15], [cx + 4.6, 26.4], [cx - 4.6, 26.4]], 'b');
    l1(G, [[cx, 17], [cx, 21]], 'B'); G.rect(cx - 5, 19, 3, 1, 'B'); G.rect(cx + 2, 19, 3, 1, 'B');
    for (const y of [22, 24]) G.rect(cx - 2, y, 4, 1, 'B');
    G.rect(cx - 5, 25, 10, 2, 'a'); G.rect(cx - 1, 25, 2, 2, 'y');                                       // belt
    G.ell(cx - 8 - d / 2, 16.4, 3.6 + d / 2, 2.8, 'b'); G.ell(cx + 8 + d / 2, 16.4, 3.6 + d / 2, 2.8, 'b');   // big shoulders
    const fa = (pts, r = 2) => { oline(G, pts, 3.6 + d / 2, 3.4 + d / 2, 'b'); const n = pts.length - 1, [x0, y0] = pts[n - 1], [x1, y1] = pts[n]; G.line([[x0 + (x1 - x0) * .25, y0 + (y1 - y0) * .25], [x0 + (x1 - x0) * .8, y0 + (y1 - y0) * .8]], 3 + d / 2, 3 + d / 2, 'x'); G.line([[x0 + (x1 - x0) * .2, y0 + (y1 - y0) * .2], [x0 + (x1 - x0) * .3, y0 + (y1 - y0) * .3]], 3.4 + d / 2, 3.4 + d / 2, 'a'); fist(G, x1, y1, 'b', r + d / 3); };
    const L = [[cx - 9 - d, 17.4], [cx - 11 - d, 21.6], [cx - 10 - d, 26]];
    if (o.pose === 'fold') { fold(G, [[cx - 9.6, 17.4], [cx - 7.6, 21.6], [cx + 4.6, 21]], [[cx + 9.6, 17.4], [cx + 8, 23], [cx - 4.6, 22.6]], 'b', 'B', 'x', 3, 1.6); G.line([[cx - 3, 21.4], [cx + 1, 21.2]], 2.4, 2.4, 'x'); G.line([[cx - 1, 22.8], [cx + 3, 22.8]], 2.4, 2.4, 'X'); }
    if (o.pose === 'flex') { fa([[cx - 9 - d, 17.4], [cx - 12.4 - d, 15], [cx - 11 - d, 10]]); fa(mir(W, [[cx - 9 - d, 17.4], [cx - 12.4 - d, 15], [cx - 11 - d, 10]])); }
    if (o.pose === 'fists') { fa(L); fa(mir(W, L)); }
    if (o.pose === 'beckon') { fa(L); fa([[cx + 9 + d, 17.4], [cx + 12, 19], [cx + 12.6, 14.6]], 1.8); }
    // the red scarf round the neck, its tail flying
    G.poly([[cx - 4.6, 13.4], [cx + 4.6, 13.4], [cx + 5, 16.4], [cx - 5, 16.4]], 'r'); G.poly([[cx - 4.6, 15], [cx - 2, 16], [cx - 7.4, 21], [cx - 8.6, 18.4]], 'r');
    wolfHead(G, cx, 2, c, { mouth: o.mouth, ears: [[cx - 3.2, 4.6], [cx - 5.6, -1.6]], eye: o.eye });
    G.set(cx - 3, 3, 'l'); G.set(cx - 2, 3, 'l');
  }, BER_PAL, { b: 'B', p: 'P', r: 'R', u: 'U', x: 'X', z: 'Z' });
}

// lavender: the middle brother; gold coyote fur, white muzzle and chest, a hunched lanky build with very long arms,
// green trousers with suspenders, a deranged grin. breathes poison, and fought blinded
const LAV_PAL = { o: 0x120c06, f: 0xe0a83a, F: 0x9a6a1a, l: 0xf6d27a, i: 0xc87a50, z: 0xfaf4e6, Z: 0xc8bca8, k: 0x0c0806, K: 0x2a2018, e: 0xe83a2a, w: 0xffffff, m: 0x7a1a2a, q: 0xe86a8a, g: 0x3a8a4a, G: 0x1e5a2c, s: 0x2a2a30, v: 0xa04ae0, V: 0x6a2ab0, p: 0xd6a8ff };
function lavender(o = {}) {
  const W = 28, cx = 14, pose = o.pose || 'hunch';
  return spr(W, 36, G0 => {
    if (o.mist) { for (const [x, y, r] of [[4, 8, 3.4], [24, 6, 3], [3, 22, 3], [25, 20, 3.4], [22, 30, 2.6]]) { G0.ell(x, y, r, r * .8, 'V'); G0.ell(x - .6, y - .6, r - 1, r * .8 - 1, 'v'); } }
    const G = shift(G0, 0, 2);
    // short bowed legs, bare paws
    oline(G, [[cx - 3, 24], [cx - 4.4, 29]], 3.4, 3, 'g'); oline(G, [[cx + 3, 24], [cx + 4.4, 29]], 3.4, 3, 'g');
    G.ell(cx - 5, 31, 2.6, 1.4, 'f'); G.ell(cx + 5, 31, 2.6, 1.4, 'f');
    // hunched torso, pale chest, green trousers with suspenders
    G.poly([[cx - 6, 13], [cx + 6, 13], [cx + 5, 22], [cx - 5, 22]], 'f'); G.poly([[cx - 3, 13], [cx + 3, 13], [cx + 2, 19], [cx - 2, 19]], 'z');
    G.poly([[cx - 5.6, 20], [cx + 5.6, 20], [cx + 6, 25.4], [cx - 6, 25.4]], 'g');
    l1(G, [[cx - 3.6, 13], [cx - 3.6, 21]], 'G'); l1(G, [[cx + 3.6, 13], [cx + 3.6, 21]], 'G');
    G.ell(cx - 6, 14, 2.6, 2, 'f'); G.ell(cx + 6, 14, 2.6, 2, 'f');
    const a = (pts, r = 1.6) => arm(G, pts, 'f', 'f', 2.8, r);
    const dangle = [[cx - 7, 14.6], [cx - 9.4, 21], [cx - 9.6, 27.6]];                                      // knuckle-dragging arms
    if (pose === 'hunch') { a(dangle); a(mir(W, dangle)); }
    if (pose === 'claw') { a(dangle); a([[cx + 7, 14.6], [cx + 11, 12], [cx + 11.6, 7]]); G.set(cx + 10, 4, 'w'); G.set(cx + 12, 4, 'w'); }
    if (pose === 'breath') { a(dangle); a(mir(W, dangle)); for (const [x, y, r] of [[cx + 7, 10, 2.4], [cx + 10.6, 8, 2]]) { G.ell(x, y, r, r * .8, 'V'); G.ell(x - .4, y - .4, r - .9, r * .8 - .9, 'v'); } }
    if (pose === 'lunge') { a([[cx - 7, 14.6], [cx - 11, 17], [cx - 12, 13]]); a([[cx + 7, 14.6], [cx + 11, 17], [cx + 12, 13]]); }
    // head hangs forward, low between the shoulders
    wolfHead(G, cx, 0, { f: 'f', i: 'i', z: 'z' }, { mouth: o.mouth || 'grin', shut: o.shut, ears: [[cx - 3, 2.6], [cx - 6, -2.4]] });
    G.set(cx - 2, 1, 'l'); G.set(cx - 3, 2, 'l');
    if (o.mouth === 'tongue') G.set(cx, 12, 'q');
  }, LAV_PAL, { f: 'F', g: 'G', z: 'Z' });
}

// basil: the youngest, a maned wolf — red fur, long legs made for kicking, big ears, yellow eyes; a torn muffler,
// black gloves, red boots. powered up he bulks out, the fur goes pink and the eyes purple
const BAS_PAL = { o: 0x140608, f: 0xd8502a, F: 0x903018, l: 0xf6905a, i: 0xf2c0a0, z: 0xf6e8d8, Z: 0xc0ac98, k: 0x0c0606, K: 0x2a1c18, e: 0xf6d23a, u: 0xb05ae8, w: 0xffffff, m: 0x7a1a2a, q: 0xe86a8a, c: 0xe6d8b0, C: 0xa89a70, g: 0x22222a, n: 0x34343e, r: 0xc82a2e, R: 0x80141a, h: 0xec7a8a, H: 0xa84a5c, y: 0xfff08a };
function basil(o = {}) {
  const W = 28, cx = 14, pose = o.pose || 'stand', pw = !!o.power, f = pw ? 'h' : 'f';
  return spr(W, 38, G => {
    if (o.aura) aura(G, W, 38, 'R', 'q');
    const lw = pw ? 3.6 : 3;
    if (pose === 'kick') { oline(G, [[cx - 2.6, 23], [cx - 3.4, 34]], lw, lw - .4, f); G.rect(cx - 6, 33, 5, 3, 'r'); oline(G, [[cx + 2.6, 23], [cx + 8, 20], [cx + 12.6, 17]], lw, lw - .4, f); G.ell(cx + 12.4, 16.6, 1.8, 1.6, 'r'); for (const y of [13, 21]) G.rect(cx + 7, y, 4, 1, 'y'); }
    else { oline(G, [[cx - 2.6, 23], [cx - 3.4, 34]], lw, lw - .4, f); oline(G, [[cx + 2.6, 23], [cx + 3.4, 34]], lw, lw - .4, f); G.rect(cx - 6, 32, 5, 4, 'r'); G.rect(cx + 1, 32, 5, 4, 'r'); }
    G.poly([[cx - 5 - pw, 13], [cx + 5 + pw, 13], [cx + 4, 23.6], [cx - 4, 23.6]], f); G.poly([[cx - 2, 14], [cx + 2, 14], [cx + 1.4, 20], [cx - 1.4, 20]], 'z');
    G.rect(cx - 4, 22, 8, 2, 'g');
    G.ell(cx - 5.6, 14, 2.4 + pw, 1.8 + pw * .4, f); G.ell(cx + 5.6, 14, 2.4 + pw, 1.8 + pw * .4, f);
    const a = (pts, r = 1.5) => arm(G, pts, f, 'g', pw ? 3.2 : 2.6, r + pw * .4);
    if (pose === 'stand') { const p = [[cx - 6.4, 14.6], [cx - 8, 19], [cx - 7.4, 22]]; a(p); a(mir(W, p)); }
    if (pose === 'kick') { a([[cx - 6.4, 14.6], [cx - 9, 13], [cx - 10, 9.6]]); a([[cx + 6.4, 14.6], [cx + 7, 18], [cx + 4.4, 18.6]]); }
    if (pose === 'guard') { a([[cx - 6.4, 14.6], [cx - 8.6, 17.6], [cx - 5.6, 16]]); a([[cx + 6.4, 14.6], [cx + 9, 13], [cx + 8.6, 9.4]]); }
    if (pose === 'flex') { const p = [[cx - 6.4, 14.6], [cx - 10, 13], [cx - 9.6, 8.6]]; a(p); a(mir(W, p)); }
    // the torn muffler
    G.poly([[cx - 4, 11.4], [cx + 4, 11.4], [cx + 4.4, 14], [cx - 4.4, 14]], 'c'); G.poly([[cx + 3, 12.6], [cx + 7.6, 15.4], [cx + 6.6, 17], [cx + 7.6, 18.4], [cx + 5, 17.6], [cx + 2, 14]], 'c'); G.set(cx - 2, 13, 'C'); G.set(cx + 1, 12, 'C');
    wolfHead(G, cx, 1, { f, i: 'i', z: 'z' }, { mouth: o.mouth, eye: pw ? 'u' : 'e', ears: [[cx - 3, 3], [cx - 6.4, -1.8]] });
  }, BAS_PAL, { f: 'F', h: 'H', r: 'R', c: 'C', z: 'Z' });
}

// ---------- u10 · obuni: lean green fighter, long white hair streaming down his back, a small blue vest with a jewelled
// medallion, dark-blue dots down the bare abdomen, brown trousers. fights unseen, splitting into afterimages ----------
const OBU_PAL = { o: 0x08120c, g: 0x5ab070, G: 0x347a48, l: 0x9ad8a4, h: 0xf2f2f6, H: 0xb8bcc8, k: 0x0a0c0e, w: 0xffffff, e: 0xd03030, b: 0x2a5ab8, B: 0x183a80, d: 0x1c2a6a, y: 0xf2c840, Y: 0xa8841a, j: 0xe0303a, p: 0x7a5232, P: 0x4c321c, n: 0x2a221c, a: 0x6a9a7c, A: 0x9ac8a8, m: 0x5a1820 };
function obuni(o = {}) {
  const W = 28, cx = 14, pose = o.pose || 'fold';
  return spr(W, 36, G => {
    if (o.ghost) for (const dx of [-8, 8]) { const g = shift(G, dx, 1); g.ell(cx, 9, 4, 4.4, 'A'); g.poly([[cx - 5, 14], [cx + 5, 14], [cx + 4, 24], [cx + 3, 33], [cx - 3, 33], [cx - 4, 24]], 'a'); }
    // long white hair down the back
    G.poly([[cx - 5, 5], [cx + 5, 5], [cx + 6.4, 12], [cx + 7.4, 22], [cx + 4, 19], [cx - 4, 19], [cx - 7.4, 22], [cx - 6.4, 12]], 'h');
    oline(G, [[cx - 2.6, 24], [cx - 3.4, 31]], 3.6, 3.2, 'p'); oline(G, [[cx + 2.6, 24], [cx + 3.4, 31]], 3.6, 3.2, 'p');
    G.rect(cx - 6, 31, 5, 3, 'n'); G.rect(cx + 1, 31, 5, 3, 'n');
    G.poly([[cx - 5, 14], [cx + 5, 14], [cx + 4, 24.6], [cx - 4, 24.6]], 'g');
    for (const y of [19, 21, 23]) { G.set(cx - 2, y, 'd'); G.set(cx + 1, y, 'd'); }                              // the dots down the abdomen
    G.poly([[cx - 5.4, 13.6], [cx - 1.6, 13.6], [cx - 2.4, 18.4], [cx - 5, 18.4]], 'b'); G.poly(mir(W, [[cx - 5.4, 13.6], [cx - 1.6, 13.6], [cx - 2.4, 18.4], [cx - 5, 18.4]]), 'b');   // small vest
    G.ell(cx, 15.6, 1.6, 1.6, 'y'); G.set(cx - 1, 15, 'j'); G.set(cx, 15, 'j'); G.set(cx - 1, 16, 'j'); G.set(cx, 16, 'j');   // medallion
    G.rect(cx - 4, 23, 8, 2, 'P');
    G.ell(cx - 5.6, 14.6, 2.2, 1.8, 'b'); G.ell(cx + 5.6, 14.6, 2.2, 1.8, 'b');
    const a = (pts, r = 1.4) => arm(G, pts, 'g', 'g', 2.6, r);
    if (pose === 'fold') fold(G, [[cx - 6.6, 15.4], [cx - 5, 18.6], [cx + 3, 18.2]], [[cx + 6.6, 15.4], [cx + 5.4, 19.6], [cx - 3, 19.4]], 'g', 'G', 'g', 2.6, 1.2);
    if (pose === 'stance') { a([[cx - 6.6, 15.4], [cx - 9.4, 15.6], [cx - 11, 12.6]]); a([[cx + 6.6, 15.4], [cx + 8, 18.6], [cx + 5.6, 19.4]]); G.set(cx - 12, 10, 'g'); G.set(cx - 11, 10, 'g'); }
    if (pose === 'blast') { a([[cx - 6.6, 15.4], [cx - 8, 19.6], [cx - 7.4, 22.6]]); a([[cx + 6.6, 15.4], [cx + 10, 15], [cx + 11.6, 14.6]]); G.ell(cx + 11.6, 11.2, 2.4, 2.4, 'b'); G.ell(cx + 11.6, 11.2, 1.4, 1.4, 'l'); }
    if (pose === 'down') { const p = [[cx - 6.6, 15.4], [cx - 8, 19.6], [cx - 7.4, 22.6]]; a(p); a(mir(W, p)); }
    // head: long narrow face, pointed ears, white hair parted and swept back
    G.line([[cx - 4, 9.4], [cx - 6.6, 7.4]], 1.8, .6, 'g'); G.line([[cx + 4, 9.4], [cx + 6.6, 7.4]], 1.8, .6, 'g');
    G.ell(cx, 9.4, 3.8, 4.6, 'g'); G.poly([[cx - 3.6, 9], [cx + 3.6, 9], [cx + 2.6, 13.4], [cx + 1, 14.4], [cx - 1, 14.4], [cx - 2.6, 13.4]], 'g');
    G.poly([[cx - 4.4, 8.4], [cx - 4.6, 4.6], [cx - 2, 2.6], [cx + 2, 2.6], [cx + 4.6, 4.6], [cx + 4.4, 8.4], [cx + 2.6, 6.6], [cx, 5.2], [cx - 2.6, 6.6]], 'h');
    G.set(cx - 2, 3, 'H'); G.set(cx + 1, 4, 'H');
    G.rect(cx - 3, 8, 2, 1, 'k'); G.rect(cx + 1, 8, 2, 1, 'k');
    if (o.shut) { G.rect(cx - 3, 9, 2, 1, 'G'); G.rect(cx + 1, 9, 2, 1, 'G'); }
    else { G.rect(cx - 3, 9, 2, 1, 'w'); G.rect(cx + 1, 9, 2, 1, 'w'); G.set(cx - 2, 9, 'k'); G.set(cx + 1, 9, 'k'); }
    G.set(cx, 11, 'G');
    if (o.mouth === 'shout') { G.rect(cx - 1, 12, 2, 2, 'm'); } else G.rect(cx - 1, 12, 2, 1, 'G');
  }, OBU_PAL, { g: 'G', h: 'H', b: 'B', p: 'P' });
}

// ---------- u10 · murichim: a towering crimson warrior monk, a nio temple guardian; bald with six dots on his crown,
// a white robe wrapped round the hips and slung over one shoulder, bare arms and legs ----------
const MUR_PAL = { o: 0x180608, r: 0xc83440, R: 0x8a1a24, l: 0xf07a80, k: 0x0e0606, w: 0xffffff, W: 0xc4beb0, c: 0xf4f0e6, C: 0xc0b8a6, y: 0xf2c840, Y: 0xa8841a, e: 0xf6e070, m: 0x5a0a14, a: 0xf6a040, A: 0xd05a1a, b: 0x3a2a24 };
function murichim(o = {}) {
  const W = 32, cx = 16, pose = o.pose || 'nio';
  return spr(W, 40, G0 => {
    if (o.aura) aura(G0, W, 40, 'A', 'a');
    const G = shift(G0, 0, 1);
    // bare muscular legs, bare feet
    oline(G, [[cx - 3.6, 27], [cx - 4.6, 34]], 4.6, 4, 'r'); oline(G, [[cx + 3.6, 27], [cx + 4.6, 34]], 4.6, 4, 'r');
    G.ell(cx - 5.4, 35.4, 3, 1.4, 'r'); G.ell(cx + 5.4, 35.4, 3, 1.4, 'r');
    // huge chest and gut
    G.poly([[cx - 9, 15], [cx + 9, 15], [cx + 7, 26], [cx - 7, 26]], 'r');
    l1(G, [[cx, 17], [cx, 21]], 'R'); G.rect(cx - 6, 20, 4, 1, 'R'); G.rect(cx + 2, 20, 4, 1, 'R'); G.set(cx - 1, 24, 'R');
    // the white robe: a wrap round the hips to the knees, and a band slung over the left shoulder
    G.poly([[cx - 7.6, 24], [cx + 7.6, 24], [cx + 9, 31.4], [cx + 3, 30], [cx, 32], [cx - 3, 30], [cx - 9, 31.4]], 'c'); l1(G, [[cx - 2, 26], [cx - 3, 30]], 'C'); l1(G, [[cx + 3, 26], [cx + 4, 30]], 'C');
    G.line([[cx - 8.6, 14.4], [cx + 6, 25]], 3.4, 3.4, 'c'); G.rect(cx - 7, 24, 14, 2, 'C');
    G.ell(cx - 9, 16, 4, 3.2, 'r'); G.ell(cx + 9, 16, 4, 3.2, 'r');
    G.line([[cx - 11.4, 15], [cx - 7, 17.6]], 2.4, 2.4, 'c');                                                   // the robe over the shoulder
    const a = (pts, r = 2.2) => arm(G, pts, 'r', 'r', 4, r);
    if (pose === 'nio') { a([[cx - 10, 17.4], [cx - 13, 21], [cx - 12, 25.4]]); a([[cx + 10, 17.4], [cx + 13.4, 13.6], [cx + 13, 8.6]], 2); for (const y of [5, 6]) G.rect(cx + 11, y, 4, 1, 'r'); G.set(cx + 11, 4, 'r'); G.set(cx + 14, 4, 'r'); }   // open palm raised
    if (pose === 'fold') fold(G, [[cx - 10.4, 17.4], [cx - 8.4, 22], [cx + 5, 21.4]], [[cx + 10.4, 17.4], [cx + 8.6, 23.4], [cx - 5, 23]], 'r', 'R', 'r', 4, 2);
    if (pose === 'fists') { const p = [[cx - 10, 17.4], [cx - 13, 21], [cx - 12, 25.4]]; a(p); a(mir(W, p)); }
    if (pose === 'charge') { a([[cx - 10, 17.4], [cx - 13.4, 14], [cx - 13, 9.6]]); a([[cx + 10, 17.4], [cx + 13.4, 14], [cx + 13, 9.6]]); }
    // bald head, thick neck, six dots in two rows on the crown
    G.rect(cx - 3, 12, 6, 3, 'r');
    G.ell(cx - 5, 8.4, 1.2, 1.8, 'r'); G.ell(cx + 5, 8.4, 1.2, 1.8, 'r');
    G.ell(cx, 7, 4.6, 5, 'r'); G.poly([[cx - 4.4, 7], [cx + 4.4, 7], [cx + 3.6, 11.4], [cx + 1.6, 13], [cx - 1.6, 13], [cx - 3.6, 11.4]], 'r');
    for (const x of [-3, -1, 1]) { G.set(cx + x, 3, 'b'); } for (const x of [-2, 0, 2]) G.set(cx + x, 4, 'b');   // six dots
    G.set(cx - 2, 2, 'l'); G.set(cx - 3, 2, 'l');
    // glaring nio face: heavy brows, bulging eyes, broad nose
    G.rect(cx - 4, 6, 3, 1, 'k'); G.rect(cx + 1, 6, 3, 1, 'k'); G.set(cx - 2, 7, 'k'); G.set(cx + 1, 7, 'k');
    G.rect(cx - 4, 7, 2, 1, 'w'); G.rect(cx + 2, 7, 2, 1, 'w'); G.set(cx - 3, 7, o.glow ? 'e' : 'k'); G.set(cx + 2, 7, o.glow ? 'e' : 'k');
    G.rect(cx - 1, 9, 2, 1, 'R');
    if (o.mouth === 'roar') { G.rect(cx - 2, 10, 4, 2, 'm'); G.rect(cx - 2, 10, 4, 1, 'w'); }
    else { G.rect(cx - 2, 11, 4, 1, 'R'); G.set(cx - 3, 10, 'R'); G.set(cx + 2, 10, 'R'); }
  }, MUR_PAL, { r: 'R', c: 'C' });
}

// ---------- u10 · rubalt: a brutish red bruiser, black dreadlocks, two square teeth jutting up from the lower jaw,
// a tight sleeveless blue shirt, black trousers, purple shoes, gold armbands, a red belt with a gold buckle ----------
const RUB_PAL = { o: 0x16080a, s: 0xc8584a, S: 0x86302a, l: 0xf08a76, h: 0x1c1820, H: 0x3a3440, k: 0x0c0606, w: 0xfff8ea, e: 0xf6e070, b: 0x2a6ac8, B: 0x1a4288, n: 0x1e1e26, N: 0x34343e, v: 0x6a3a9a, V: 0x44245e, y: 0xf2c840, Y: 0xa8841a, r: 0xc8282e, R: 0x80141a, m: 0x5a1018, a: 0xf2d060 };
function rubalt(o = {}) {
  const W = 30, cx = 15, pose = o.pose || 'fists';
  return spr(W, 38, G => {
    if (o.aura) aura(G, W, 38, 'Y', 'a');
    // locks hanging behind the head
    for (const [b, t] of [[[cx - 4, 6], [cx - 8.6, 14]], [[cx - 2.6, 5], [cx - 6.6, 15]], [[cx + 4, 6], [cx + 8.6, 14]], [[cx + 2.6, 5], [cx + 6.6, 15]]]) oline(G, [b, t], 2.4, 1.6, 'h');
    oline(G, [[cx - 3.4, 26], [cx - 4, 32.6]], 4.2, 3.8, 'n'); oline(G, [[cx + 3.4, 26], [cx + 4, 32.6]], 4.2, 3.8, 'n');
    G.rect(cx - 8, 32, 6, 3, 'v'); G.rect(cx + 2, 32, 6, 3, 'v');
    G.poly([[cx - 8, 15], [cx + 8, 15], [cx + 6.6, 26.4], [cx - 6.6, 26.4]], 'b'); l1(G, [[cx, 17], [cx, 22]], 'B');
    G.rect(cx - 7, 24, 14, 2, 'r'); G.rect(cx - 1, 24, 2, 2, 'y');
    G.ell(cx - 8.6, 16.4, 3.4, 2.8, 's'); G.ell(cx + 8.6, 16.4, 3.4, 2.8, 's');                                 // bare shoulders
    const a = (pts, r = 2.2) => { oline(G, pts, 3.8, 3.4, 's'); const [x0, y0] = pts[0], [x1, y1] = pts[1]; G.line([[x0 + (x1 - x0) * .6, y0 + (y1 - y0) * .6], [x0 + (x1 - x0) * .8, y0 + (y1 - y0) * .8]], 4, 4, 'y'); const [x, y] = pts[pts.length - 1]; fist(G, x, y, 's', r); };
    if (pose === 'fists') { const p = [[cx - 9.4, 17.4], [cx - 12, 21.4], [cx - 11, 25.6]]; a(p); a(mir(W, p)); }
    if (pose === 'fold') { fold(G, [[cx - 9.6, 17.4], [cx - 7.6, 21.6], [cx + 5, 21]], [[cx + 9.6, 17.4], [cx + 8, 23], [cx - 5, 22.6]], 's', 'S', 's', 3.6, 1.8); G.rect(cx - 10, 18, 3, 2, 'y'); G.rect(cx + 7, 18, 3, 2, 'y'); }
    if (pose === 'smash') { const p = [[cx - 9.4, 17.4], [cx - 12.4, 13], [cx - 9, 8.6]]; a(p); a(mir(W, p)); }
    if (pose === 'punch') { a([[cx - 9.4, 17.4], [cx - 12, 21.4], [cx - 11, 25.6]]); a([[cx + 9.4, 17.4], [cx + 13.4, 18]], 2.6); for (const [x, y] of [[29, 13], [29, 22], [26, 12]]) G.set(x, y, 'a'); }
    // head: heavy brow, broad flat nose, jaw with two square teeth jutting up
    G.ell(cx, 8.6, 4.8, 4.6, 's'); G.poly([[cx - 5, 9], [cx + 5, 9], [cx + 5, 13], [cx + 3, 15], [cx - 3, 15], [cx - 5, 13]], 's');
    G.poly([[cx - 4.6, 7.4], [cx - 4.6, 4], [cx - 2, 2.4], [cx + 2, 2.4], [cx + 4.6, 4], [cx + 4.6, 7.4], [cx + 2, 5.6], [cx - 2, 5.6]], 'h');
    G.set(cx - 2, 3, 'H'); G.set(cx + 1, 3, 'H'); G.set(cx - 4, 5, 'H');
    G.rect(cx - 4, 7, 3, 1, 'S'); G.rect(cx + 1, 7, 3, 1, 'S');
    G.rect(cx - 4, 8, 3, 1, 'k'); G.rect(cx + 1, 8, 3, 1, 'k'); G.set(cx - 3, 9, o.glow ? 'e' : 'w'); G.set(cx + 2, 9, o.glow ? 'e' : 'w'); G.set(cx - 2, 9, 'k'); G.set(cx + 1, 9, 'k');
    G.rect(cx - 1, 10, 2, 2, 'S'); G.set(cx - 2, 11, 'S'); G.set(cx + 1, 11, 'S');
    if (o.mouth === 'roar') { G.rect(cx - 3, 12, 6, 2, 'm'); G.rect(cx - 3, 13, 1, 1, 'w'); G.rect(cx + 2, 13, 1, 1, 'w'); G.set(cx - 3, 12, 'w'); G.set(cx + 2, 12, 'w'); }
    else { G.rect(cx - 3, 13, 6, 1, 'k'); G.set(cx - 3, 12, 'w'); G.set(cx + 2, 12, 'w'); }                      // the jutting teeth
  }, RUB_PAL, { s: 'S', b: 'B', h: 'H', n: 'N', v: 'V', r: 'R' });
}

// ---------- u4 · ganos, transformed: a big bird-man. green feathered body, a long orange-and-yellow crest, a thick
// shoebill/eagle beak, magenta eyes, the dark-green vest with yellow lining, baggy trousers on a brown double belt with
// a red-and-yellow gem, scaly brown-orange bird feet with black talons; the red beret and goggles ----------
const GAN_PAL = { o: 0x0a1008, g: 0x58a048, G: 0x346a2c, l: 0x96d07a, f: 0x7cbc5c, h: 0xf08a2a, H: 0xb04e14, j: 0xffd04a, J: 0xd89a1a, b: 0xf2d27a, B: 0xb08a3a, k: 0x0c0a0a, e: 0xe03aa8, w: 0xffffff, v: 0x2a5a2e, V: 0x183a1c, y: 0xf2c840, p: 0xd8ccae, P: 0x9a8e70, t: 0x6a4224, T: 0x3e2614, r: 0xd02a30, R: 0x86161c, u: 0x3a8ae0, n: 0xc86a2a, N: 0x8a4218, m: 0x6a1a24, a: 0xfff0a0, A: 0xf2a020 };
function ganos(o = {}) {
  const W = 38, H = 46, cx = 19, pose = o.pose || 'stand';
  return spr(W, H, G0 => {
    if (o.aura) aura(G0, W, H, 'A', 'a');
    const G = shift(G0, 0, 2);
    // long crest of orange and yellow plumes streaming down the back
    for (const [b, t, c] of [[[cx - 3, 4], [cx - 11, 14], 'h'], [[cx + 3, 4], [cx + 11, 14], 'h'], [[cx - 2, 3], [cx - 8, 20], 'H'], [[cx + 2, 3], [cx + 8, 20], 'H'], [[cx - 1, 2], [cx - 5, 22], 'j'], [[cx + 1, 2], [cx + 5, 22], 'j']]) oline(G, [b, t], 4, 1.4, c);
    // scaly bird legs below the baggy trousers, black talons
    oline(G, [[cx - 4, 33], [cx - 5, 39]], 2.4, 2.4, 'n'); oline(G, [[cx + 4, 33], [cx + 5, 39]], 2.4, 2.4, 'n');
    for (const s of [-1, 1]) { const x = cx + s * 5; G.line([[x, 39], [x - 3.4, 41.4]], 1.6, 1.4, 'n'); G.line([[x, 39], [x + 3.4, 41.4]], 1.6, 1.4, 'n'); G.set(Math.round(x - 4), 41, 'k'); G.set(Math.round(x + 3), 41, 'k'); G.set(Math.round(x - 1), 41, 'k'); }
    G.poly([[cx - 8, 27], [cx + 8, 27], [cx + 9, 33], [cx + 6, 35], [cx + 2, 33], [cx - 2, 33], [cx - 6, 35], [cx - 9, 33]], 'p'); l1(G, [[cx, 29], [cx, 33]], 'P');
    // feathered chest, vest open over it
    G.poly([[cx - 9, 15], [cx + 9, 15], [cx + 7.6, 27.4], [cx - 7.6, 27.4]], 'g');
    G.poly([[cx - 3, 15], [cx + 3, 15], [cx + 2.4, 24], [cx, 26], [cx - 2.4, 24]], 'f');
    for (const [x, y] of [[-1, 18], [1, 21], [-1, 23], [1, 17]]) G.set(cx + x, y, 'l');
    if (!o.torn) { G.poly([[cx - 9.4, 14.6], [cx - 3, 14.6], [cx - 3.6, 26], [cx - 8, 26]], 'v'); G.poly(mir(W, [[cx - 9.4, 14.6], [cx - 3, 14.6], [cx - 3.6, 26], [cx - 8, 26]]), 'v'); l1(G, [[cx - 3.4, 15], [cx - 3.8, 25.6]], 'y'); l1(G, [[cx + 3.4, 15], [cx + 3.8, 25.6]], 'y'); }
    G.rect(cx - 8, 26, 16, 2, 't'); G.rect(cx - 8, 28, 16, 1, 'T'); G.rect(cx - 1, 26, 2, 2, 'r'); G.set(cx, 26, 'y');   // double belt, gem
    G.ell(cx - 9.4, 16.4, 4, 3, 'g'); G.ell(cx + 9.4, 16.4, 4, 3, 'g');
    // feathered arms: a row of feathers trailing under each forearm
    const a = (pts, r = 2.2) => { const [x0, y0] = pts[1], [x1, y1] = pts[2]; for (let f = .2; f < .9; f += .3) G.line([[x0 + (x1 - x0) * f, y0 + (y1 - y0) * f], [x0 + (x1 - x0) * f + 1.4, y0 + (y1 - y0) * f + 3.4]], 2.4, .8, 'G'); arm(G, pts, 'g', 'b', 4, r); };
    if (pose === 'stand') { const p = [[cx - 10, 17.4], [cx - 13.4, 21.4], [cx - 13, 26]]; a(p); a(mir(W, p)); }
    if (pose === 'spread') { a([[cx - 10, 17.4], [cx - 15, 14.4], [cx - 17, 10]]); a([[cx + 10, 17.4], [cx + 15, 14.4], [cx + 17, 10]]); }
    if (pose === 'talon') { a([[cx - 10, 17.4], [cx - 13.4, 21.4], [cx - 13, 26]]); a([[cx + 10, 17.4], [cx + 14.6, 15.6], [cx + 16, 11]]); for (const x of [-2, 0, 2]) G.line([[cx + 16 + x * .8, 9.4], [cx + 16 + x * 1.2, 7]], 1.2, .8, 'k'); }
    if (pose === 'fold') fold(G, [[cx - 10.4, 17.4], [cx - 8.4, 22], [cx + 5, 21.4]], [[cx + 10.4, 17.4], [cx + 8.6, 23.4], [cx - 5, 23]], 'g', 'G', 'b', 4, 2);
    // the head: round, feathered, a heavy hooked beak
    G.ell(cx, 7.4, 5.6, 5.4, 'g'); G.rect(cx - 3, 12, 6, 3, 'g');
    G.poly([[cx - 4, 2.4], [cx, -1.6], [cx + 4, 2.4], [cx + 2, 3.6], [cx, 1.6], [cx - 2, 3.6]], 'j');               // crest tuft on the brow
    const beak = [[cx - 4.2, 8.6], [cx + 4.2, 8.6], [cx + 4.4, 12], [cx + 2.6, 15.4], [cx + 1, 18.4], [cx - 1, 18.4], [cx - 2.6, 15.4], [cx - 4.4, 12]];   // the beak: broad, heavy, hooked
    G.poly(beak.map(([x, y]) => [x + Math.sign(x - cx) * 1.1, y + (y > 12 ? 1 : 0)]), 'o'); G.poly(beak, 'b');
    G.rect(cx - 1, 16, 2, 2, 'J'); G.set(cx - 1, 15, 'J'); G.set(cx, 15, 'J');
    if (o.mouth === 'open') { G.rect(cx - 3, 12, 6, 2, 'm'); G.rect(cx - 2, 14, 4, 1, 'm'); } else { G.rect(cx - 3, 12, 6, 1, 'B'); G.set(cx - 4, 11, 'B'); G.set(cx + 3, 11, 'B'); }
    G.set(cx - 2, 10, 'B'); G.set(cx + 1, 10, 'B'); G.set(cx - 3, 9, 'a'); G.set(cx - 2, 9, 'a');
    G.rect(cx - 5, 5, 3, 1, 'k'); G.rect(cx + 2, 5, 3, 1, 'k'); G.set(cx - 2, 6, 'k'); G.set(cx + 1, 6, 'k');
    G.rect(cx - 5, 6, 3, 2, 'e'); G.rect(cx + 2, 6, 3, 2, 'e'); G.set(cx - 4, 7, 'k'); G.set(cx + 3, 7, 'k'); G.set(cx - 5, 6, 'w'); G.set(cx + 2, 6, 'w');
    if (o.beret) { G.poly([[cx - 6, 3], [cx + 4, 1], [cx + 7.4, 2.6], [cx + 5, 4.6], [cx - 5, 5]], 'r'); G.rect(cx - 4, 4, 9, 1, 't'); G.rect(cx - 3, 3, 3, 2, 'u'); G.rect(cx + 1, 3, 3, 2, 'u'); G.set(cx - 2, 3, 'y'); G.set(cx + 2, 3, 'y'); }   // beret, goggles
  }, GAN_PAL, { g: 'G', h: 'H', j: 'J', v: 'V', p: 'P', n: 'N', b: 'B', r: 'R' });
}

// ---------- u4 · caway: an elven princess. light-green skin, long pink hair, blue eyes, a circlet on the brow,
// a fantasy gown with a cape and arm warmers, high heels; fights with energy spears and bolts ----------
const CAW_PAL = { o: 0x120a14, s: 0xb6e2b0, S: 0x7aac78, h: 0xf27ab0, H: 0xb44a80, j: 0xffb8d8, k: 0x100a14, e: 0x3a8af0, w: 0xffffff, W: 0xc8c4d8, d: 0xf6f2fa, D: 0xbcb4d0, c: 0x7a3ab8, C: 0x4e2280, y: 0xf2c840, Y: 0xa8841a, g: 0x3ad0a0, m: 0xd04a6a, b: 0xa0f0ff, B: 0x3ac0f0, p: 0xf06ab0 };
function caway(o = {}) {
  const W = 26, cx = 13, pose = o.pose || 'stand';
  return spr(W, 36, G0 => {
    const G = shift(G0, 0, 1);
    // cape behind, long pink hair over it
    G.poly([[cx - 5, 13], [cx + 5, 13], [cx + 9, 31], [cx - 9, 31]], 'c');
    G.poly([[cx - 5, 4], [cx + 5, 4], [cx + 6.6, 12], [cx + 6, 22], [cx + 3, 19], [cx - 3, 19], [cx - 6, 22], [cx - 6.6, 12]], 'h');
    // gown: fitted bodice, long skirt flaring to the floor, heels peeking out
    G.rect(cx - 4, 31, 3, 2, 'k'); G.rect(cx + 1, 31, 3, 2, 'k');
    G.poly([[cx - 3.4, 13.4], [cx + 3.4, 13.4], [cx + 3, 19], [cx + 7, 31.4], [cx - 7, 31.4], [cx - 3, 19]], 'd');
    l1(G, [[cx, 20], [cx, 31]], 'D'); G.rect(cx - 3, 18, 6, 1, 'y'); G.set(cx - 1, 18, 'g'); G.set(cx, 18, 'g');
    G.poly([[cx - 3, 13], [cx + 3, 13], [cx, 16]], 's');                                                         // neckline
    G.ell(cx - 4, 14, 1.8, 1.4, 'd'); G.ell(cx + 4, 14, 1.8, 1.4, 'd');
    const a = (pts, r = 1.1) => { oline(G, pts, 1.8, 1.6, 's'); const n = pts.length - 1, [x0, y0] = pts[n - 1], [x1, y1] = pts[n]; G.line([[x0 + (x1 - x0) * .2, y0 + (y1 - y0) * .2], [x0 + (x1 - x0) * .9, y0 + (y1 - y0) * .9]], 2.4, 2.2, 'c'); fist(G, x1, y1, 's', r); };   // arm warmers on the forearms
    if (pose === 'stand') { a([[cx - 4.6, 14.6], [cx - 6.6, 17.6], [cx - 4.4, 19]]); a([[cx + 4.6, 14.6], [cx + 6, 18], [cx + 6, 21]]); }
    if (pose === 'spear') { a([[cx - 4.6, 14.6], [cx - 6.6, 17.6], [cx - 6.4, 20.4]]); G.line([[cx + 9, 32], [cx + 10.6, 1]], 1.6, 1.6, 'B'); G.line([[cx + 9.2, 28], [cx + 10.6, 1]], .9, .9, 'b'); G.poly([[cx + 10.6, -1], [cx + 12.2, 4], [cx + 9, 4]], 'b'); a([[cx + 4.6, 14.6], [cx + 8, 15.4], [cx + 10, 13]]); }
    if (pose === 'kiss') { a([[cx - 4.6, 14.6], [cx - 6.6, 17.6], [cx - 4.4, 19]]); a([[cx + 4.6, 14.6], [cx + 6.6, 12.6], [cx + 3.4, 11.4]]); G.set(cx + 7, 8, 'p'); G.set(cx + 9, 8, 'p'); G.rect(cx + 7, 9, 3, 1, 'p'); G.set(cx + 8, 10, 'p'); }
    if (pose === 'bolts') { a([[cx - 4.6, 14.6], [cx - 8, 13.4], [cx - 10.4, 11]]); a([[cx + 4.6, 14.6], [cx + 8, 13.4], [cx + 10.4, 11]]); for (const [x, y] of [[2, 6], [24, 6], [1, 2], [25, 2]]) { G0.ell(x, y, 1.4, 1.4, 'B'); G0.set(x, y, 'b'); } }
    // head: delicate face, pointed elf ears, circlet with a gem, pink bangs
    G.line([[cx - 3.4, 9], [cx - 6.2, 6.4]], 1.6, .6, 's'); G.line([[cx + 3.4, 9], [cx + 6.2, 6.4]], 1.6, .6, 's');
    G.ell(cx, 8.6, 3.6, 4, 's'); G.poly([[cx - 3.4, 8.4], [cx + 3.4, 8.4], [cx + 2.4, 11.6], [cx, 12.8], [cx - 2.4, 11.6]], 's');
    G.poly([[cx - 4, 7.6], [cx - 4, 4.2], [cx - 1.6, 2.4], [cx + 1.6, 2.4], [cx + 4, 4.2], [cx + 4, 7.6], [cx + 2.6, 5.8], [cx, 6.4], [cx - 2.6, 5.8]], 'h');
    G.set(cx - 2, 3, 'j'); G.set(cx - 3, 4, 'j');
    G.rect(cx - 3, 5, 6, 1, 'y'); G.set(cx - 1, 5, 'e'); G.set(cx, 5, 'e');                                      // circlet
    if (o.wink) { G.rect(cx - 3, 8, 2, 1, 'k'); G.rect(cx + 1, 8, 2, 1, 'k'); G.set(cx + 1, 7, 'k'); G.set(cx + 2, 8, 'e'); G.set(cx + 1, 8, 'w'); }
    else { G.rect(cx - 3, 7, 2, 1, 'k'); G.rect(cx + 1, 7, 2, 1, 'k'); G.set(cx - 3, 8, 'w'); G.set(cx - 2, 8, 'e'); G.set(cx + 1, 8, 'e'); G.set(cx + 2, 8, 'w'); }
    G.rect(cx - 1, 10, 2, 1, 'm');
  }, CAW_PAL, { s: 'S', h: 'H', d: 'D', c: 'C' });
}

// ---------- u4 · dercori: light-violet skin, a mint-green high pointy ponytail with two long bangs down the sides of
// the face, folded skin on the shoulders, fin ears, huge hands and bare feet, dark garb; throws paper talismans.
// in the dark she powers up: white hair, face markings, long huge flowing limbs ----------
const DER_PAL = { o: 0x0a0a14, s: 0xc0a6e0, S: 0x8a72b0, h: 0x8ae8c0, H: 0x48a888, j: 0xc8fff0, x: 0xf2f2f8, X: 0xb4b4c8, k: 0x0a0a12, e: 0xf04a6a, w: 0xffffff, d: 0x2a2a4a, D: 0x181830, t: 0xf6eed6, T: 0xd02a2a, m: 0x6a1a4a, n: 0x6a4aa0, z: 0x22163a };
function dercori(o = {}) {
  const W = 28, cx = 14, pose = o.pose || 'stand', dark = !!o.dark, hc = dark ? 'x' : 'h', hd = dark ? 'X' : 'H';
  const tal = (G, x, y) => { G.rect(x, y, 2, 3, 't'); G.set(x, y + 1, 'T'); G.set(x + 1, y + 2, 'T'); };
  return spr(W, 36, G0 => {
    if (dark) { G0.ell(cx, 18, 13, 17, 'z'); }
    const G = shift(G0, 0, 1);
    // the ponytail sweeping up and back
    oline(G, [[cx + 1, 4], [cx + 5, .4], [cx + 9, -.2], [cx + 12, 1.6]], 3.6, .8, hc);
    // legs and huge bare feet
    const lw = dark ? 2.6 : 2.6;
    oline(G, [[cx - 2.4, 22], [cx - 3.4, 30]], lw + .6, lw, 's'); oline(G, [[cx + 2.4, 22], [cx + 3.4, 30]], lw + .6, lw, 's');
    G.ell(cx - 5, 31, 3.4, 1.6, 's'); G.ell(cx + 5, 31, 3.4, 1.6, 's');
    // dark garb: high-collared top and a short skirt
    G.poly([[cx - 4.4, 13], [cx + 4.4, 13], [cx + 4, 20], [cx + 6, 24.4], [cx - 6, 24.4], [cx - 4, 20]], 'd'); l1(G, [[cx, 14], [cx, 24]], 'D');
    G.rect(cx - 4, 19, 8, 1, 'n');
    G.ell(cx - 5, 14.2, 2.4, 1.8, 's'); G.ell(cx + 5, 14.2, 2.4, 1.8, 's'); G.set(cx - 6, 14, 'S'); G.set(cx + 5, 14, 'S'); G.set(cx - 5, 15, 'S'); G.set(cx + 4, 15, 'S');   // the folds of skin
    const a = (pts, r = 2.2) => arm(G, pts, 's', 's', dark ? 2.8 : 2.2, r);                                          // the oversized hands
    if (pose === 'stand') { a([[cx - 6, 15], [cx - 7.6, 19], [cx - 7, 22.4]]); a([[cx + 6, 15], [cx + 8.6, 14], [cx + 9.4, 10.6]], 2); tal(G, cx + 9, 6); }
    if (pose === 'throw') { a([[cx - 6, 15], [cx - 9, 15.6], [cx - 10.6, 13]]); a([[cx + 6, 15], [cx + 9, 15.6], [cx + 10.6, 13]]); for (const [x, y] of [[1, 3], [5, 0], [21, 0], [25, 4], [0, 9], [26, 10]]) tal(G0, x, y); }
    if (pose === 'hush') { a([[cx - 6, 15], [cx - 7.6, 19], [cx - 7, 22.4]]); a([[cx + 6, 15], [cx + 6.6, 12.6], [cx + 1.4, 11.6]], 1.8); }
    if (pose === 'loom') { a([[cx - 6, 15], [cx - 11, 12], [cx - 11.6, 6]], 3); a([[cx + 6, 15], [cx + 11, 12], [cx + 11.6, 6]], 3); for (const x of [-12.6, -10.6, 10.6, 12.6]) G.set(Math.round(cx + x), 2, 's'); }
    // head: fin ears, mint bangs hanging either side of the face
    G.poly([[cx - 3.4, 8], [cx - 6.6, 5.4], [cx - 6, 9], [cx - 3.4, 11]], 'S'); G.poly(mir(W, [[cx - 3.4, 8], [cx - 6.6, 5.4], [cx - 6, 9], [cx - 3.4, 11]]), 'S');
    G.ell(cx, 8.4, 3.6, 4, 's'); G.poly([[cx - 3.4, 8.4], [cx + 3.4, 8.4], [cx + 2.4, 11.6], [cx, 12.8], [cx - 2.4, 11.6]], 's');
    G.poly([[cx - 4, 8], [cx - 3.6, 4], [cx - 1, 2.6], [cx + 2, 2.6], [cx + 4, 4.4], [cx + 3.6, 6.4], [cx, 5], [cx - 2.4, 6.4]], hc);
    oline(G, [[cx - 3.4, 6], [cx - 4, 13.6]], 1.6, 1.2, hc); oline(G, [[cx + 3.4, 6], [cx + 4, 13.6]], 1.6, 1.2, hc);   // the two long bangs
    G.set(cx - 1, 3, dark ? 'w' : 'j');
    if (dark) { G.set(cx - 3, 10, 'e'); G.set(cx + 2, 10, 'e'); G.set(cx - 2, 11, 'e'); G.set(cx + 1, 11, 'e'); G.set(cx, 4, 'e'); G.set(cx - 1, 4, 'e'); }   // face markings
    G.rect(cx - 2, 7, 1, 2, 'k'); G.rect(cx + 1, 7, 1, 2, 'k'); G.set(cx - 2, 7, dark ? 'e' : 'w'); G.set(cx + 1, 7, dark ? 'e' : 'w');
    if (o.mouth === 'grin') { G.rect(cx - 1, 10, 2, 1, 'k'); G.set(cx - 2, 9, 'k'); G.set(cx + 1, 9, 'k'); } else G.rect(cx - 1, 10, 2, 1, 'm');
  }, DER_PAL, { s: 'S', h: 'H', x: 'X', d: 'D' });
}

// ---------- u3 · anilaza: the giant four-way merged robot. a dark body under white plating on the head, neck, shoulders
// and chest; solid pink eyes, no nose; a big red core gem on the forehead; long ear fins with green sonar gems under
// the tips; white shoulder guards topped with red gems; a green gem mid-chest; purple hands and shins; pointed boots;
// it can sprout wings ----------
const ANI_PAL = { o: 0x08080e, d: 0x3e4a5e, D: 0x262e3e, x: 0xeef0f4, X: 0xa8acbc, p: 0x8a52c8, P: 0x5a3090, i: 0xff6ab8, I: 0xc83a8a, r: 0xe02a3a, R: 0x8a1420, q: 0xff9aa0, g: 0x3ad070, G: 0x1a8a44, w: 0xffffff, k: 0x0c0c14, b: 0x6a7a94, y: 0xffe070, a: 0xc8f0ff, A: 0x6ab8f0 };
function anilaza(o = {}) {
  const W = 46, H = 54, cx = 23, pose = o.pose || 'stand';
  return spr(W, H, G0 => {
    const G = shift(G0, 0, 2);
    if (o.wings) for (const s of [-1, 1]) { const m = p => p.map(([x, y]) => [cx + s * x, y]); G.poly(m([[6, 18], [22, 4], [22.6, 14], [20, 22], [21, 30], [9, 26]]), 'D'); l1(G, m([[8, 19], [21, 6]]), 'b'); l1(G, m([[9, 23], [20, 22]]), 'b'); }
    // thick legs, purple shins, pointed boots
    oline(G, [[cx - 5, 34], [cx - 6, 41]], 6, 5.6, 'd'); oline(G, [[cx + 5, 34], [cx + 6, 41]], 6, 5.6, 'd');
    G.rect(cx - 9, 40, 6, 4, 'p'); G.rect(cx + 3, 40, 6, 4, 'p');
    G.poly([[cx - 10, 44], [cx - 2, 44], [cx - 2, 47.4], [cx - 12.4, 47.4]], 'x'); G.poly([[cx + 2, 44], [cx + 10, 44], [cx + 12.4, 47.4], [cx + 2, 47.4]], 'x');
    // massive torso: dark body, white chest plate with the green gem
    G.poly([[cx - 12, 19], [cx + 12, 19], [cx + 9, 35.4], [cx - 9, 35.4]], 'd');
    G.poly([[cx - 11, 18.6], [cx + 11, 18.6], [cx + 9, 26], [cx, 29], [cx - 9, 26]], 'x'); G.ell(cx, 23.6, 2.4, 2.2, 'g'); G.set(cx - 1, 22, 'w');
    for (const y of [30, 32]) G.rect(cx - 4, y, 8, 1, 'D');
    // white shoulder guards with red gems on top
    G.ell(cx - 13, 20, 5, 4, 'x'); G.ell(cx + 13, 20, 5, 4, 'x'); G.ell(cx - 13, 18, 1.6, 1.4, 'r'); G.ell(cx + 13, 18, 1.6, 1.4, 'r');
    const a = (pts, r = 3.4) => arm(G, pts, 'd', 'p', 5.6, r);
    if (pose === 'stand') { const p = [[cx - 14, 23], [cx - 17.6, 29], [cx - 17, 35]]; a(p); a(mir(W, p)); }
    if (pose === 'raise') { const p = [[cx - 14, 23], [cx - 18.6, 18], [cx - 18.4, 11]]; a(p); a(mir(W, p)); }
    if (pose === 'punch') { a([[cx - 14, 23], [cx - 17.6, 29], [cx - 17, 35]]); a([[cx + 14, 23], [cx + 18.6, 25], [cx + 19.4, 24.4]], 3.8); for (const [x, y] of [[44, 18], [44, 31], [41, 17]]) G.set(x, y, 'y'); }
    if (pose === 'burst') { a([[cx - 14, 23], [cx - 17.6, 27], [cx - 13, 29]]); a([[cx + 14, 23], [cx + 17.6, 27], [cx + 13, 29]]); G0.ell(cx, 32, 6, 5, 'A'); G0.ell(cx, 32, 4, 3.4, 'a'); G0.ell(cx, 32, 2, 1.6, 'w'); }   // destruction burst gathering
    // head: white plated, ear fins swept out with green gems near the tips, big red forehead core
    for (const s of [-1, 1]) { oline(G, [[cx + s * 5, 10], [cx + s * 13.6, 3.6]], 4, 1.2, 'x'); G.ell(cx + s * 11.6, 6.6, 1.2, 1.2, 'g'); }
    G.rect(cx - 4, 15, 8, 4, 'x');
    G.ell(cx, 10, 6.4, 6.6, 'x'); G.poly([[cx - 6, 10], [cx + 6, 10], [cx + 4.6, 15], [cx + 2, 17], [cx - 2, 17], [cx - 4.6, 15]], 'x');
    G.ell(cx, 5.4, 2.4, 2.2, 'r'); G.set(cx - 1, 4, 'q');                                                      // the energy core
    G.poly([[cx - 5, 9], [cx - 1.4, 10.6], [cx - 1.6, 12.4], [cx - 4.6, 11.6]], o.dim ? 'I' : 'i'); G.poly(mir(W, [[cx - 5, 9], [cx - 1.4, 10.6], [cx - 1.6, 12.4], [cx - 4.6, 11.6]]), o.dim ? 'I' : 'i');   // solid pink eyes
    G.rect(cx - 5, 8, 4, 1, 'X'); G.rect(cx + 1, 8, 4, 1, 'X');
    if (o.mouth === 'roar') { G.rect(cx - 3, 14, 6, 2, 'k'); G.rect(cx - 2, 14, 4, 1, 'w'); } else G.rect(cx - 2, 15, 4, 1, 'X');
  }, ANI_PAL, { d: 'D', x: 'X', p: 'P', r: 'R', g: 'G' });
}

// ---------- u3 · paparoni: the gaunt dark-purple manager. white curly mohawk and goatee, a monocle, a white suit with a
// red neckerchief, black trousers and shoes, a brown cane with a gold shaft topped by a blue orb ----------
const PAP_PAL = { o: 0x0e0814, s: 0x7a52a2, S: 0x4e3270, l: 0xa888cc, h: 0xf4f4f6, H: 0xb8b8c4, k: 0x0a0810, w: 0xffffff, W: 0xc4c2cc, e: 0xf2d040, r: 0xd02a30, R: 0x86161c, n: 0x1e1c24, N: 0x3a3842, y: 0xf2c840, Y: 0xa8841a, b: 0x7a4a2a, u: 0x3a8af0, U: 0x1a4ab0, a: 0xa0d8ff, g: 0xd8c860, m: 0x6a1a3a };
function paparoni(o = {}) {
  const W = 26, cx = 13, pose = o.pose || 'cane';
  return spr(W, 36, G0 => {
    const G = shift(G0, 0, 1);
    const cane = (x0, y0, x1, y1) => { G.line([[x0, y0], [x1, y1]], 1.6, 1.6, 'o'); l1(G, [[x0, y0], [x1, y1]], 'y'); G.ell(x1, y1 - 1.6, 2.2, 2.2, 'o'); G.ell(x1, y1 - 1.6, 1.6, 1.6, 'u'); G.set(Math.round(x1 - 1), Math.round(y1 - 3), 'a'); G.rect(Math.round(x1) - 1, Math.round(y1), 2, 1, 'b'); };
    if (pose === 'cane') cane(cx + 8, 32, cx + 8, 16);
    // thin legs, black trousers, pointed black shoes
    oline(G, [[cx - 2, 23], [cx - 2.4, 30]], 2.6, 2.4, 'n'); oline(G, [[cx + 2, 23], [cx + 2.4, 30]], 2.6, 2.4, 'n');
    G.poly([[cx - 6, 30], [cx - 1, 30], [cx - 1, 32], [cx - 7, 32]], 'n'); G.poly([[cx + 1, 30], [cx + 6, 30], [cx + 7, 32], [cx + 1, 32]], 'n');
    // white suit jacket with tails, red neckerchief
    G.poly([[cx - 4.4, 13], [cx + 4.4, 13], [cx + 4.4, 22], [cx + 5, 26], [cx + 1, 23.4], [cx - 1, 23.4], [cx - 5, 26], [cx - 4.4, 22]], 'h');
    l1(G, [[cx, 16], [cx, 23]], 'H'); G.set(cx - 1, 18, 'y'); G.set(cx - 1, 21, 'y');
    G.poly([[cx - 2.6, 12.6], [cx + 2.6, 12.6], [cx + 1.4, 15], [cx, 17.4], [cx - 1.4, 15]], 'r');
    G.ell(cx - 4.6, 14, 2, 1.6, 'h'); G.ell(cx + 4.6, 14, 2, 1.6, 'h');
    const a = (pts, r = 1.2) => arm(G, pts, 'h', 's', 2.4, r);
    if (pose === 'cane') { a([[cx - 5.4, 14.6], [cx - 6.6, 18.4], [cx - 5.6, 21]]); a([[cx + 5.4, 14.6], [cx + 7, 17], [cx + 8, 18.6]]); }
    if (pose === 'point') { a([[cx - 5.4, 14.6], [cx - 6.6, 18.4], [cx - 5.6, 21]]); cane(cx + 6.6, 15, cx + 12, 9); a([[cx + 5.4, 14.6], [cx + 7.6, 15.6], [cx + 8.4, 13.4]]); }
    if (pose === 'raise') { a([[cx - 5.4, 14.6], [cx - 6.6, 18.4], [cx - 5.6, 21]]); cane(cx + 8.6, 18, cx + 8.6, 2.6); G0.ell(cx + 8.6, 2, 3.6, 3.6, 'U'); G0.ell(cx + 8.6, 2, 2.4, 2.4, 'a'); a([[cx + 5.4, 14.6], [cx + 8, 13], [cx + 8.6, 10.4]]); }
    if (pose === 'laugh') { a([[cx - 5.4, 14.6], [cx - 8, 13], [cx - 8.6, 9.6]]); cane(cx + 7, 32, cx + 7, 18); a([[cx + 5.4, 14.6], [cx + 6.6, 17], [cx + 7, 18.4]]); }
    // gaunt head, curly white mohawk, goatee, a monocle on the right eye
    G.line([[cx - 3, 8.6], [cx - 5.4, 7.6]], 1.6, .8, 's'); G.line([[cx + 3, 8.6], [cx + 5.4, 7.6]], 1.6, .8, 's');
    G.ell(cx, 8.4, 3.4, 4, 's'); G.poly([[cx - 3, 8.6], [cx + 3, 8.6], [cx + 2, 11.6], [cx, 12.6], [cx - 2, 11.6]], 's');
    for (const [x, y, r] of [[-1, 4.4, 1.5], [1, 4.4, 1.5], [0, 3, 1.7]]) G.ell(cx + x, y + .6, r, r, 'h');   // the curly mohawk
    G.set(cx - 2, 5, 'H'); G.set(cx + 1, 5, 'H'); G.set(cx, 3, 'H'); G.set(cx - 1, 4, 'H');
    G.poly([[cx - 1.6, 11.4], [cx + 1.6, 11.4], [cx + .6, 15.4], [cx - .6, 15.4]], 'h');                          // goatee
    G.rect(cx - 3, 7, 2, 1, 'k'); G.rect(cx + 1, 7, 2, 1, 'k');
    G.set(cx - 3, 8, 'w'); G.set(cx - 2, 8, 'e'); G.set(cx + 2, 8, 'w');
    G.set(cx + 3, 8, 'g'); G.set(cx + 2, 7, 'g'); G.set(cx + 2, 9, 'g'); G.set(cx + 1, 8, 'e'); l1(G, [[cx + 3.6, 10], [cx + 4.6, 14]], 'y');   // monocle and its chain
    if (o.mouth === 'laugh') { G.rect(cx - 2, 10, 4, 1, 'm'); G.set(cx - 2, 9, 'k'); G.set(cx + 1, 9, 'k'); }
    else { G.rect(cx - 2, 10, 3, 1, 'S'); G.set(cx + 1, 9, 'S'); }
  }, PAP_PAL, { s: 'S', h: 'H', n: 'N', r: 'R' });
}

// ---------- u3 · koitsukai: a small giru-like robot. a white egg of a body with one big green eye, thick arms with big
// green cuffs and black hands, stubby legs, two jets on the back ----------
const KOI_PAL = { o: 0x0a0e10, w: 0xf4f6f8, W: 0xb4bcc8, g: 0x3ad070, G: 0x1a8a44, l: 0xb0ffd0, k: 0x14161a, K: 0x34383e, n: 0x6a7280, a: 0xffd060, A: 0xf06a2a, r: 0xe0303a, y: 0xfff4b0 };
function koitsukai(o = {}) {
  const W = 24, H = 28, cx = 12, pose = o.pose || 'stand', up = pose === 'fly' ? -3 : 0;
  return spr(W, H, G0 => {
    const G = shift(G0, 0, up + 2);
    // two jets on the back, poking out either side, flame when flying
    for (const s of [-1, 1]) { G.rect(cx + s * 6 - (s < 0 ? 2 : 0), 8, 2, 6, 'n'); if (pose === 'fly') { G.poly([[cx + s * 7 - 1.2, 14], [cx + s * 7 + 1.2, 14], [cx + s * 7, 20]], 'A'); G.poly([[cx + s * 7 - .6, 14], [cx + s * 7 + .6, 14], [cx + s * 7, 17.4]], 'a'); } }
    // stubby legs
    if (pose !== 'fly') { G.rect(cx - 4, 18, 3, 3, 'K'); G.rect(cx + 1, 18, 3, 3, 'K'); G.rect(cx - 5, 21, 4, 2, 'w'); G.rect(cx + 1, 21, 4, 2, 'w'); }
    else { G.rect(cx - 4, 18, 3, 2, 'K'); G.rect(cx + 1, 18, 3, 2, 'K'); }
    // the egg-shaped body/head
    G.ell(cx, 10.4, 6.4, 8, 'w'); G.rect(cx - 5, 15, 10, 1, 'W');
    G.set(cx - 3, 4, 'y'); G.set(cx - 4, 5, 'y');
    l1(G, [[cx, 2.6], [cx, -0.4]], 'n'); G.set(cx, 0, 'r');                                           // antenna nub
    // the big green eye
    G.ell(cx, 8.4, 3.4, 3.4, 'K'); G.ell(cx, 8.4, 2.6, 2.6, o.red ? 'r' : 'g'); G.rect(cx - 1, 7, 2, 2, o.red ? 'y' : 'l'); G.set(cx + 1, 10, 'G');
    G.rect(cx - 2, 13, 4, 1, 'n');
    // thick arms with big green cuffs and black hands
    const a = (pts, r = 2) => { oline(G, pts, 3, 3, 'W'); const n = pts.length - 1, [x0, y0] = pts[n - 1], [x1, y1] = pts[n]; G.line([[x0 + (x1 - x0) * .55, y0 + (y1 - y0) * .55], [x0 + (x1 - x0) * .75, y0 + (y1 - y0) * .75]], 3.8, 3.8, 'g'); fist(G, x1, y1, 'k', r); };
    if (pose === 'stand') { const p = [[cx - 6, 12], [cx - 8.4, 15], [cx - 8.6, 18]]; a(p); a(mir(W, p)); }
    if (pose === 'fly') { a([[cx - 6, 12], [cx - 9, 13], [cx - 10, 16]]); a([[cx + 6, 12], [cx + 9, 13], [cx + 10, 16]]); }
    if (pose === 'up') { const p = [[cx - 6, 11], [cx - 9, 8], [cx - 9.4, 4]]; a(p); a(mir(W, p)); }
    if (pose === 'punch') { a([[cx - 6, 12], [cx - 8.4, 15], [cx - 8.6, 18]]); a([[cx + 6, 12], [cx + 9.6, 12.4]], 2.4); for (const [x, y] of [[23, 8], [23, 16]]) G.set(x, y, 'a'); }
  }, KOI_PAL, { w: 'W', g: 'G' });
}

// ---------- u2 · ribrianne, transformed: big and near-spherical, teal skin, a pink-red and green sleeveless dress over a
// huge frilled petticoat and bloomers, yellow gloves and boots, a rubber cap with an antenna. super ribrianne grows
// butterfly wings ----------
const RIB_PAL = { o: 0x1a0a14, s: 0x6ad0c4, S: 0x3a9a90, l: 0xa8f0e6, p: 0xf2589a, P: 0xb02a66, q: 0xffa0c8, g: 0x48b860, G: 0x2a7a3a, f: 0xfff4fa, F: 0xe0bcd0, y: 0xf6d040, Y: 0xb8901a, c: 0xf06aa8, C: 0xb03a74, h: 0xf6c84a, H: 0xc08a20, k: 0x140a10, w: 0xffffff, e: 0x3a7ae0, m: 0xc02a4a, r: 0xff3a6a, b: 0xffc8f0, B: 0xd88ae8 };
function ribrianne(o = {}) {
  const W = 36, H = 40, cx = 18, pose = o.pose || 'heart';
  return spr(W, H, G0 => {
    if (o.wings) for (const s of [-1, 1]) { const m = p => p.map(([x, y]) => [cx + s * x, y]); G0.poly(m([[6, 14], [16, 2], [17.6, 10], [14, 18]]), 'B'); G0.poly(m([[6, 18], [17, 20], [15, 30], [8, 27]]), 'B'); G0.poly(m([[8, 14], [14.6, 6], [15.4, 11], [12.6, 16]]), 'b'); G0.poly(m([[8, 19.6], [14.6, 21.4], [13, 26.4], [9, 24.6]]), 'b'); }
    const G = shift(G0, 0, 1);
    if (o.hearts) for (const [x, y] of [[3, 6], [31, 4], [2, 22], [32, 20]]) { G.rect(x, y, 2, 1, 'r'); G.rect(x + 3, y, 2, 1, 'r'); G.rect(x, y + 1, 5, 1, 'r'); G.rect(x + 1, y + 2, 3, 1, 'r'); G.set(x + 2, y + 3, 'r'); }
    // stubby legs in yellow boots under the bloomers
    G.rect(cx - 6, 32, 4, 3, 'y'); G.rect(cx + 2, 32, 4, 3, 'y'); G.rect(cx - 7, 34, 5, 2, 'y'); G.rect(cx + 2, 34, 5, 2, 'y');
    // the round body: huge petticoat, then the dress
    G.ell(cx, 25, 13, 8, 'f'); for (let x = cx - 12; x <= cx + 11; x += 3) G.set(x, 32, 'F');
    G.ell(cx, 22, 12, 9.4, 'p'); G.poly([[cx - 4, 13], [cx + 4, 13], [cx + 3, 22], [cx - 3, 22]], 'g'); G.rect(cx - 12, 24, 24, 2, 'g');
    G.rect(cx - 1, 15, 2, 1, 'q'); G.rect(cx - 2, 16, 4, 1, 'q'); G.rect(cx - 1, 17, 2, 1, 'q');                   // heart on the bodice
    for (const x of [-9, -5, 5, 9]) G.set(cx + x, 19, 'q');
    // arms: chubby, yellow gloves
    const a = (pts, r = 2) => arm(G, pts, 's', 'y', 3.4, r);
    if (pose === 'heart') { a([[cx - 9, 15.4], [cx - 9.6, 12], [cx - 4, 10.4]]); a([[cx + 9, 15.4], [cx + 9.6, 12], [cx + 4, 10.4]]); G.rect(cx - 2, 7, 4, 1, 'r'); }
    if (pose === 'wave') { a([[cx - 10, 16], [cx - 14, 19], [cx - 14.4, 23]]); a([[cx + 10, 16], [cx + 14.4, 12], [cx + 14.6, 7]]); }
    if (pose === 'hips') { a([[cx - 10, 16], [cx - 14, 18.4], [cx - 11, 21.6]]); a([[cx + 10, 16], [cx + 14, 18.4], [cx + 11, 21.6]]); }
    if (pose === 'beam') { a([[cx - 10, 16], [cx - 14, 19], [cx - 14.4, 23]]); a([[cx + 10, 16], [cx + 14, 15], [cx + 15.4, 13]]); G0.ell(cx + 15, 9, 2.6, 2.4, 'r'); G0.rect(cx + 14, 8, 2, 1, 'b'); }
    G.ell(cx - 9.6, 15.6, 3, 2.4, 'p'); G.ell(cx + 9.6, 15.6, 3, 2.4, 'p');                                    // puffed shoulders
    // round head, pink rubber cap with a heart-tipped antenna, golden curls peeking out
    G.ell(cx - 6, 10, 2, 2.4, 'h'); G.ell(cx + 6, 10, 2, 2.4, 'h');
    G.ell(cx, 8.6, 6, 5.4, 's'); G.rect(cx - 4, 13, 8, 1, 's');
    G.poly([[cx - 6.4, 7.6], [cx - 5.6, 3.6], [cx - 2, 1.8], [cx + 2, 1.8], [cx + 5.6, 3.6], [cx + 6.4, 7.6], [cx + 4, 6], [cx - 4, 6]], 'c'); G.set(cx - 3, 3, 'q'); G.set(cx - 4, 4, 'q');
    l1(G, [[cx, 2], [cx, -1]], 'C'); G.set(cx - 1, -1, 'r'); G.set(cx + 1, -1, 'r'); G.set(cx, 0, 'r');
    // big starry eyes, rosy cheeks, lipstick
    for (const x of [cx - 4, cx + 1]) { G.rect(x, 7, 3, 3, 'k'); G.rect(x, 8, 2, 1, 'e'); G.set(x, 7, 'w'); }
    G.set(cx - 5, 11, 'r'); G.set(cx + 4, 11, 'r');
    if (o.mouth === 'open') { G.rect(cx - 1, 11, 2, 2, 'm'); } else { G.rect(cx - 1, 11, 2, 1, 'm'); }
  }, RIB_PAL, { s: 'S', p: 'P', g: 'G', f: 'F', y: 'Y', c: 'C', h: 'H' });
}

// ---------- u2 · rozie (roasie): teal skin, orange sunglasses, a yellow-and-white gown over a purple jumpsuit,
// white gloves and boots, purple hair ----------
const ROZ_PAL = { o: 0x120a16, s: 0x6ad0c4, S: 0x3a9a90, v: 0x7a3ab8, V: 0x4e2280, h: 0x8a4ad0, H: 0x5a2a94, j: 0xc49af0, y: 0xf6d040, Y: 0xb8901a, w: 0xf6f4f8, W: 0xbcb8c8, n: 0xf28a2a, N: 0xb0561a, k: 0x120a10, m: 0xc02a4a, r: 0xff3a6a, b: 0xffc8f0 };
function rozie(o = {}) {
  const W = 26, cx = 13, pose = o.pose || 'stand';
  return spr(W, 36, G0 => {
    const G = shift(G0, 0, 1);
    if (o.hearts) for (const [x, y] of [[0, 4], [21, 2], [22, 12]]) { G.rect(x, y, 2, 1, 'r'); G.rect(x + 3, y, 2, 1, 'r'); G.rect(x, y + 1, 5, 1, 'r'); G.rect(x + 1, y + 2, 3, 1, 'r'); G.set(x + 2, y + 3, 'r'); }
    // purple jumpsuit legs, white boots
    oline(G, [[cx - 2.4, 22], [cx - 2.8, 29]], 2.8, 2.6, 'v'); oline(G, [[cx + 2.4, 22], [cx + 2.8, 29]], 2.8, 2.6, 'v');
    G.rect(cx - 5, 29, 4, 3, 'w'); G.rect(cx + 1, 29, 4, 3, 'w');
    // the gown: yellow, open at the front over the purple, white panels and collar
    G.poly([[cx - 4, 13], [cx + 4, 13], [cx + 4.4, 19], [cx + 7, 26.4], [cx + 2, 25], [cx - 2, 25], [cx - 7, 26.4], [cx - 4.4, 19]], 'y');
    G.poly([[cx - 2, 15], [cx + 2, 15], [cx + 2, 25], [cx - 2, 25]], 'v');
    l1(G, [[cx - 4, 20], [cx - 6, 26]], 'w'); l1(G, [[cx + 3, 20], [cx + 5, 26]], 'w');
    G.poly([[cx - 4.6, 12.4], [cx + 4.6, 12.4], [cx + 3, 15], [cx, 16.4], [cx - 3, 15]], 'w');
    G.ell(cx - 4.6, 14, 2, 1.6, 'y'); G.ell(cx + 4.6, 14, 2, 1.6, 'y');
    const a = (pts, r = 1.3) => arm(G, pts, 'y', 'w', 2.4, r);
    if (pose === 'stand') { a([[cx - 5.4, 14.6], [cx - 7, 18.4], [cx - 4.6, 20]]); a([[cx + 5.4, 14.6], [cx + 7, 18.4], [cx + 4.6, 20]]); }
    if (pose === 'shoot') { a([[cx - 5.4, 14.6], [cx - 7, 18.4], [cx - 6.6, 21]]); a([[cx + 5.4, 14.6], [cx + 9, 14.4], [cx + 11, 14]]); G.ell(cx + 11.6, 10.4, 1.8, 1.8, 'r'); G.set(cx + 11, 10, 'b'); }
    if (pose === 'shades') { a([[cx - 5.4, 14.6], [cx - 7, 18.4], [cx - 4.6, 20]]); a([[cx + 5.4, 14.6], [cx + 7.4, 12], [cx + 4.4, 8.6]], 1.1); }
    if (pose === 'up') { a([[cx - 5.4, 14.6], [cx - 8, 11], [cx - 8.4, 7]]); a([[cx + 5.4, 14.6], [cx + 8, 11], [cx + 8.4, 7]]); }
    // head: purple hair swept up into a big bun-like quiff, orange sunglasses
    G.ell(cx, 4.6, 4.6, 3.4, 'h');
    G.ell(cx, 8.6, 3.6, 4, 's'); G.poly([[cx - 3.4, 8.4], [cx + 3.4, 8.4], [cx + 2.4, 11.6], [cx, 12.8], [cx - 2.4, 11.6]], 's');
    G.poly([[cx - 4.2, 9], [cx - 4.4, 5], [cx, 3.6], [cx + 4.4, 5], [cx + 4.2, 9], [cx + 3, 6.6], [cx - 3, 6.6]], 'h'); G.set(cx - 2, 2, 'j'); G.set(cx - 3, 3, 'j');
    G.rect(cx - 4, 7, 8, 2, 'n'); G.set(cx - 3, 7, 'w'); G.set(cx + 1, 7, 'w'); G.rect(cx - 4, 7, 8, 1, 'N'); G.set(cx - 3, 8, 'w'); G.set(cx + 1, 8, 'w');   // sunglasses
    if (o.mouth === 'grin') { G.rect(cx - 2, 10, 4, 1, 'w'); G.set(cx - 2, 10, 'k'); G.set(cx + 1, 10, 'k'); G.rect(cx - 1, 11, 2, 1, 'm'); } else G.rect(cx - 1, 10, 2, 1, 'm');
  }, ROZ_PAL, { s: 'S', h: 'H', y: 'Y', w: 'W', v: 'V' });
}

// ---------- u2 · kakunsa: a feral beast-girl. teal skin, a wild dark-blue mane, a black mask over the eyes, a dark-blue
// sleeveless bodysuit, green clawed gloves and boots, a dark-blue tail ----------
const KAK_PAL = { o: 0x08101a, s: 0x6ad0c4, S: 0x3a9a90, h: 0x3a4cc0, H: 0x22307e, j: 0x6a86e8, b: 0x3040a0, B: 0x1c2664, g: 0x48c060, G: 0x2a8040, k: 0x0a0a12, e: 0xf6e050, w: 0xffffff, m: 0x8a1a3a, y: 0xfff6c0 };
function kakunsa(o = {}) {
  const W = 28, cx = 14, pose = o.pose || 'crouch', dy = pose === 'crouch' ? 3 : 0;
  return spr(W, 36, G0 => {
    const G = shift(G0, 0, 1 + dy);
    oline(G, [[cx + 3, 21], [cx + 9, 23], [cx + 11.6, 18], [cx + 10.6, 14]], 2.4, 1.6, 'b');                     // the tail
    if (pose === 'crouch') { oline(G, [[cx - 3, 20], [cx - 6.4, 23.6], [cx - 4.6, 27]], 3, 2.8, 'b'); oline(G, [[cx + 3, 20], [cx + 6.4, 23.6], [cx + 4.6, 27]], 3, 2.8, 'b'); G.rect(cx - 8, 26, 5, 2, 'g'); G.rect(cx + 3, 26, 5, 2, 'g'); }
    else if (pose === 'pounce') { oline(G, [[cx - 2.4, 21], [cx - 6, 25], [cx - 9, 27]], 3, 2.8, 'b'); oline(G, [[cx + 2.4, 21], [cx + 4, 26], [cx + 3, 29]], 3, 2.8, 'b'); G.rect(cx - 12, 26, 4, 2, 'g'); G.rect(cx + 1, 29, 5, 2, 'g'); }
    else { oline(G, [[cx - 2.4, 21], [cx - 3, 29]], 3, 2.8, 'b'); oline(G, [[cx + 2.4, 21], [cx + 3, 29]], 3, 2.8, 'b'); G.rect(cx - 6, 29, 5, 3, 'g'); G.rect(cx + 1, 29, 5, 3, 'g'); }
    G.poly([[cx - 4, 13], [cx + 4, 13], [cx + 3.4, 21.6], [cx - 3.4, 21.6]], 'b'); G.poly([[cx - 2, 13], [cx + 2, 13], [cx, 15.4]], 's');
    G.ell(cx - 4.4, 14, 1.8, 1.6, 's'); G.ell(cx + 4.4, 14, 1.8, 1.6, 's');
    const claws = (x, y, up) => { for (const d of [-1, 0, 1]) G.set(Math.round(x + d * 1.2), Math.round(y + (up ? -2 : 2)), 'y'); };
    const a = (pts, up) => { arm(G, pts, 's', 'g', 2.4, 1.5); const [x, y] = pts[pts.length - 1]; claws(x, y, up); };
    if (pose === 'crouch') { a([[cx - 5, 14.6], [cx - 8, 18], [cx - 9, 21.6]]); a([[cx + 5, 14.6], [cx + 8, 18], [cx + 9, 21.6]]); }
    if (pose === 'slash') { a([[cx - 5, 14.6], [cx - 8, 12], [cx - 9, 7.6]], 1); a([[cx + 5, 14.6], [cx + 8, 17.4], [cx + 6, 20]]); }
    if (pose === 'pounce') { a([[cx - 5, 14.6], [cx - 9, 13], [cx - 12, 10]], 1); a([[cx + 5, 14.6], [cx + 9, 13], [cx + 12, 10]], 1); }
    if (pose === 'stand') { a([[cx - 5, 14.6], [cx - 6.6, 18.4], [cx - 6, 21.4]]); a([[cx + 5, 14.6], [cx + 7, 12.6], [cx + 6, 9.4]], 1); }
    // head: wild spiky dark-blue mane, cat ears, black eye mask
    for (const [b, t] of [[[cx - 3, 6], [cx - 8.6, 9]], [[cx + 3, 6], [cx + 8.6, 9]], [[cx - 3, 8], [cx - 7.4, 14]], [[cx + 3, 8], [cx + 7.4, 14]], [[cx - 2, 4], [cx - 5.4, -.6]], [[cx + 2, 4], [cx + 5.4, -.6]]]) oline(G, [b, t], 3.4, .8, 'h');
    G.ell(cx, 8.6, 3.6, 4, 's'); G.poly([[cx - 3.4, 8.4], [cx + 3.4, 8.4], [cx + 2.4, 11.6], [cx, 12.8], [cx - 2.4, 11.6]], 's');
    G.poly([[cx - 4, 8], [cx - 4, 4.6], [cx, 3], [cx + 4, 4.6], [cx + 4, 8], [cx + 2.4, 5.8], [cx, 6.6], [cx - 2.4, 5.8]], 'h'); G.set(cx - 2, 4, 'j');
    G.rect(cx - 4, 7, 8, 2, 'k'); G.set(cx - 3, 8, 'e'); G.set(cx - 2, 8, 'e'); G.set(cx + 1, 8, 'e'); G.set(cx + 2, 8, 'e');   // the mask
    if (o.mouth === 'fang') { G.rect(cx - 2, 10, 4, 1, 'm'); G.set(cx - 2, 10, 'w'); G.set(cx + 1, 10, 'w'); } else { G.rect(cx - 1, 10, 2, 1, 'S'); G.set(cx - 2, 10, 'S'); }
  }, KAK_PAL, { s: 'S', h: 'H', b: 'B', g: 'G' });
}

// ---------- u6 · the saiyan girls. hair spikes are [base, tip] pairs drawn as tapering strokes ----------
const spikes = (G, list, c, b = 3.4, t = .8) => { for (const [p, q] of list) G.line([p, q], b, t, c); };
const SAI_PAL = { o: 0x0e0810, s: 0xf6cfa8, S: 0xc0906c, t: 0xc88c5c, T: 0x8e5a36, k: 0x100a10, K: 0x2a2430, w: 0xffffff, W: 0xc4c0cc, e: 0x2a2a3a, n: 0x22202a, N: 0x3c3844,
  y: 0xffe04a, Y: 0xd8a018, j: 0xfff6b0, g: 0x3ae070, G: 0x1a9a48, q: 0x9cff7a, Q: 0x5ad83a, l: 0xd8ff9a,
  c: 0xa8243e, C: 0x6a1426, m: 0xd82a8a, M: 0x8a1a5a, v: 0x6a3a9a, V: 0x44245e, r: 0xd02a2e, R: 0x86161c, u: 0x8a5a30, U: 0x5a3a1c, a: 0xf2c840, A: 0xa8841a, x: 0x9a9aa8, b: 0xd8781a, B: 0xf0a030, z: 0xc0e8ff, Z: 0x60b0f0, p: 0x6a1a2a, h: 0xf0e070, H: 0xb0a040 };

// kefla: caulifla's spiky hair held up in kale's ponytail with bangs framing the face, a claret belly shirt and fitted
// trousers, kale's gold armbands, black boots, green potara earrings
function kefla(o = {}) {
  const W = 28, cx = 14, pose = o.pose || 'fold', ss = o.ss || 0, hc = ss ? 'y' : 'k', hd = ss ? 'Y' : 'K';
  return spr(W, 36, G0 => {
    if (ss) aura(G0, W, 36, 'b', ss > 1 ? 'B' : null);
    if (ss > 1) for (const p of [[[2, 6], [4, 9], [2, 11], [4, 14]], [[25, 18], [23, 21], [25, 23]], [[3, 24], [5, 27]], [[24, 4], [22, 7], [24, 9]]]) bolt(G0, p, 'z');
    const G = shift(G0, 0, 1);
    spikes(G, [[[cx + 1, 3], [cx + 4, -1.4]], [[cx + 2, 3], [cx + 7, -.6]]], hc, 3.6, 1);                      // the ponytail, held up
    oline(G, [[cx - 2.4, 21], [cx - 2.8, 28.6]], 2.8, 2.6, 'c'); oline(G, [[cx + 2.4, 21], [cx + 2.8, 28.6]], 2.8, 2.6, 'c');
    G.rect(cx - 5, 28, 4, 4, 'n'); G.rect(cx + 1, 28, 4, 4, 'n');
    G.poly([[cx - 3.6, 18], [cx + 3.6, 18], [cx + 3.4, 22], [cx - 3.4, 22]], 't');                            // bare midriff
    G.poly([[cx - 3.6, 22], [cx + 3.6, 22], [cx + 4, 23.6], [cx - 4, 23.6]], 'c');
    G.poly([[cx - 4.4, 13], [cx + 4.4, 13], [cx + 3.6, 18], [cx - 3.6, 18]], 'c'); G.rect(cx - 2, 13, 4, 1, 't');
    G.ell(cx - 4.6, 14, 1.8, 1.4, 'c'); G.ell(cx + 4.6, 14, 1.8, 1.4, 'c');
    const a = (pts, r = 1.3) => { oline(G, pts, 2.2, 2, 't'); const n = pts.length - 1, [x0, y0] = pts[n - 1], [x1, y1] = pts[n]; G.line([[x0 + (x1 - x0) * .3, y0 + (y1 - y0) * .3], [x0 + (x1 - x0) * .8, y0 + (y1 - y0) * .8]], 2.6, 2.6, 'a'); fist(G, x1, y1, 't', r); };
    if (pose === 'fold') fold(G, [[cx - 5.4, 14.6], [cx - 4.4, 17.4], [cx + 2.4, 17]], [[cx + 5.4, 14.6], [cx + 4.6, 18.2], [cx - 2.4, 18]], 'a', 'A', 't', 2.4, 1.1);
    if (pose === 'hips') { a([[cx - 5.4, 14.6], [cx - 7.4, 17.6], [cx - 4.6, 19.6]]); a([[cx + 5.4, 14.6], [cx + 7.4, 17.6], [cx + 4.6, 19.6]]); }
    if (pose === 'blast') { a([[cx - 5.4, 14.6], [cx - 7, 18.4], [cx - 6.6, 21.4]]); a([[cx + 5.4, 14.6], [cx + 9, 14], [cx + 11, 13.4]]); G0.ell(cx + 11.4, 9.4, 2.4, 2.4, 'Q'); G0.ell(cx + 11.4, 9.4, 1.4, 1.4, 'l'); }
    if (pose === 'charge') { a([[cx - 5.4, 14.6], [cx - 7.6, 18], [cx - 7.6, 20.6]]); a([[cx + 5.4, 14.6], [cx + 7.6, 18], [cx + 7.6, 20.6]]); }
    // head: caulifla's face, spiky crown, bangs down both sides
    G.ell(cx, 8.6, 3.6, 4, 't'); G.poly([[cx - 3.4, 8.4], [cx + 3.4, 8.4], [cx + 2.4, 11.6], [cx, 12.8], [cx - 2.4, 11.6]], 't');
    spikes(G, [[[cx - 2, 4], [cx - 5.4, -.4]], [[cx, 4], [cx - 1, -1.4]], [[cx + 1, 4], [cx + 2.4, -1]], [[cx - 3, 6], [cx - 7.6, 4]]], hc);
    G.poly([[cx - 4.2, 8], [cx - 4, 4], [cx, 2.6], [cx + 4, 4], [cx + 4.2, 8], [cx + 2.6, 6], [cx, 7], [cx - 2.6, 6]], hc);
    oline(G, [[cx - 3.6, 6], [cx - 4.4, 12.6]], 1.6, .8, hc); oline(G, [[cx + 3.6, 6], [cx + 4.4, 12.6]], 1.6, .8, hc);   // the framing bangs
    G.set(cx - 2, 3, ss ? 'j' : 'N'); G.set(cx - 1, 4, ss ? 'j' : 'N');
    G.set(cx - 5, 10, 'g'); G.set(cx - 5, 11, 'g'); G.set(cx + 4, 10, 'g'); G.set(cx + 4, 11, 'g');              // potara
    G.rect(cx - 3, 8, 2, 1, 'k'); G.rect(cx + 1, 8, 2, 1, 'k'); G.set(cx - 2, 8, ss ? 'G' : 'e'); G.set(cx + 1, 8, ss ? 'G' : 'e'); G.set(cx - 3, 7, 'k'); G.set(cx + 2, 7, 'k');
    if (o.mouth === 'grin') { G.rect(cx - 2, 10, 4, 1, 'w'); G.set(cx - 2, 10, 'k'); G.set(cx + 1, 10, 'k'); } else { G.rect(cx - 1, 10, 2, 1, 'T'); G.set(cx + 1, 9, 'T'); }
  }, SAI_PAL, { t: 'T', c: 'C', y: 'Y', k: 'K', a: 'A' });
}

// caulifla: short and slender, long wild spiky black hair, a magenta tube top, low-set purple sirwal trousers,
// long dark-grey wristbands, pointed dark-grey shoes
function caulifla(o = {}) {
  const W = 28, cx = 14, pose = o.pose || 'hips', ss = o.ss || 0, hc = ss ? 'y' : 'k';
  return spr(W, 36, G0 => {
    if (ss) aura(G0, W, 36, 'b', ss > 1 ? 'B' : null);
    if (ss > 1) for (const p of [[[2, 6], [4, 9], [2, 11], [4, 14]], [[25, 18], [23, 21], [25, 23]], [[3, 24], [5, 27]], [[24, 4], [22, 7], [24, 9]]]) bolt(G0, p, 'z');
    const G = shift(G0, 0, 2);
    // the long wild mane behind
    spikes(G, [[[cx - 3, 6], [cx - 9.6, 9]], [[cx + 3, 6], [cx + 9.6, 9]], [[cx - 3, 8], [cx - 8, 15]], [[cx + 3, 8], [cx + 8, 15]], [[cx - 2, 10], [cx - 5, 18]], [[cx + 2, 10], [cx + 5, 18]]], hc, 4, 1);
    // baggy sirwal trousers gathered at the ankle, pointy shoes
    G.poly([[cx - 4, 19], [cx + 4, 19], [cx + 5.4, 24], [cx + 4.4, 28], [cx + 1, 28], [cx, 22.4], [cx - 1, 28], [cx - 4.4, 28], [cx - 5.4, 24]], 'v');
    G.poly([[cx - 5, 28], [cx - 1, 28], [cx - 1, 30], [cx - 7, 30]], 'n'); G.poly([[cx + 1, 28], [cx + 5, 28], [cx + 7, 30], [cx + 1, 30]], 'n');
    G.poly([[cx - 3.4, 15.6], [cx + 3.4, 15.6], [cx + 3.6, 19.4], [cx - 3.6, 19.4]], 's');                     // bare midriff
    G.poly([[cx - 3.6, 12.6], [cx + 3.6, 12.6], [cx + 3.6, 15.6], [cx - 3.6, 15.6]], 'm'); G.rect(cx - 3, 12, 6, 1, 's');   // tube top
    G.ell(cx - 4.4, 13.4, 1.6, 1.4, 's'); G.ell(cx + 4.4, 13.4, 1.6, 1.4, 's');
    const a = (pts, r = 1.2) => { oline(G, pts, 2, 1.8, 's'); const n = pts.length - 1, [x0, y0] = pts[n - 1], [x1, y1] = pts[n]; G.line([[x0 + (x1 - x0) * .25, y0 + (y1 - y0) * .25], [x0 + (x1 - x0) * .85, y0 + (y1 - y0) * .85]], 2.4, 2.4, 'N'); fist(G, x1, y1, 's', r); };
    if (pose === 'hips') { a([[cx - 5, 14], [cx - 7.4, 17], [cx - 4.6, 18.6]]); a([[cx + 5, 14], [cx + 7.4, 17], [cx + 4.6, 18.6]]); }
    if (pose === 'point') { a([[cx - 5, 14], [cx - 7.4, 17], [cx - 4.6, 18.6]]); a([[cx + 5, 14], [cx + 8.6, 12.6], [cx + 10.6, 11]], 1); G.set(cx + 11, 9, 's'); }
    if (pose === 'fists') { a([[cx - 5, 14], [cx - 7, 17.6], [cx - 6.4, 20.4]]); a([[cx + 5, 14], [cx + 7, 17.6], [cx + 6.4, 20.4]]); }
    if (pose === 'cannon') { a([[cx - 5, 14], [cx - 7, 17.6], [cx - 6.4, 20.4]]); a([[cx + 5, 14], [cx + 8.4, 11], [cx + 9, 7.4]]); G0.ell(cx + 9, 3.4, 3, 3, 'r'); G0.ell(cx + 9, 3.4, 1.8, 1.8, 'a'); }
    // head: big-eyed, bangs spiking forward
    G.ell(cx, 8.6, 3.6, 4, 's'); G.poly([[cx - 3.4, 8.4], [cx + 3.4, 8.4], [cx + 2.4, 11.6], [cx, 12.8], [cx - 2.4, 11.6]], 's');
    spikes(G, [[[cx - 1, 4], [cx - 4.6, -1.4]], [[cx + 1, 4], [cx + 3.6, -1.6]], [[cx, 4], [cx, -1.4]]], hc);
    G.poly([[cx - 4.4, 8.6], [cx - 4.2, 4], [cx, 2.6], [cx + 4.2, 4], [cx + 4.4, 8.6], [cx + 3, 6], [cx + 1.6, 7.6], [cx, 6], [cx - 1.6, 7.6], [cx - 3, 6]], hc);
    G.set(cx - 2, 3, ss ? 'j' : 'N'); G.set(cx - 3, 4, ss ? 'j' : 'N');
    G.rect(cx - 3, 8, 2, 2, 'k'); G.rect(cx + 1, 8, 2, 2, 'k'); G.set(cx - 3, 8, 'w'); G.set(cx + 1, 8, 'w'); if (ss) { G.set(cx - 2, 9, 'G'); G.set(cx + 2, 9, 'G'); }
    if (o.mouth === 'grin') { G.rect(cx - 2, 11, 4, 1, 'w'); G.set(cx - 2, 11, 'k'); G.set(cx + 1, 11, 'k'); } else { G.rect(cx - 1, 11, 2, 1, 'S'); G.set(cx + 1, 10, 'S'); }
  }, SAI_PAL, { s: 'S', m: 'M', v: 'V', y: 'Y', k: 'K' });
}

// kale, berserk legendary super saiyan: huge and hulking, a long mane of green-gold spikes, blank pupil-less eyes,
// green aura; the red crop top torn, red skirt on a brown belt, gold bracelets on arms and shins, gold hoop earrings
function kale(o = {}) {
  const W = 36, H = 42, cx = 18, pose = o.pose || 'roar';
  return spr(W, H, G0 => {
    aura(G0, W, H, 'G', 'g');
    const G = shift(G0, 0, 2);
    spikes(G, [[[cx - 4, 6], [cx - 12, 4]], [[cx + 4, 6], [cx + 12, 4]], [[cx - 4, 9], [cx - 12.6, 13]], [[cx + 4, 9], [cx + 12.6, 13]], [[cx - 3, 11], [cx - 9, 20]], [[cx + 3, 11], [cx + 9, 20]], [[cx - 2, 3], [cx - 7, -2]], [[cx + 2, 3], [cx + 7, -2]], [[cx, 3], [cx, -2.6]]], 'q', 5, 1.2);
    // legs: tan, gold shin guards, gold loafers
    oline(G, [[cx - 4, 27], [cx - 5, 34]], 4.6, 4, 't'); oline(G, [[cx + 4, 27], [cx + 5, 34]], 4.6, 4, 't');
    G.rect(cx - 8, 31, 6, 3, 'a'); G.rect(cx + 2, 31, 6, 3, 'a'); G.rect(cx - 8, 35, 6, 2, 'a'); G.rect(cx + 2, 35, 6, 2, 'a');
    G.poly([[cx - 7, 24], [cx + 7, 24], [cx + 9, 30], [cx - 9, 30]], 'r'); G.rect(cx - 7, 24, 14, 2, 'u'); G.ell(cx, 25, 1.4, 1, 'x');   // skirt, belt, buckle
    // massive torso: tan abs, shreds of the red top
    G.poly([[cx - 10, 13], [cx + 10, 13], [cx + 7, 24.4], [cx - 7, 24.4]], 't');
    G.poly([[cx - 9, 13], [cx + 9, 13], [cx + 7, 17], [cx + 4, 16], [cx + 2, 18], [cx - 1, 16.4], [cx - 4, 18], [cx - 7, 16.6]], 'r');
    for (const y of [20, 22]) { G.rect(cx - 3, y, 2, 1, 'T'); G.rect(cx + 1, y, 2, 1, 'T'); }
    G.ell(cx - 10, 15, 4.6, 3.6, 't'); G.ell(cx + 10, 15, 4.6, 3.6, 't');
    const a = (pts, r = 2.6) => { oline(G, pts, 5, 4.6, 't'); const n = pts.length - 1, [x0, y0] = pts[n - 1], [x1, y1] = pts[n]; G.line([[x0 + (x1 - x0) * .4, y0 + (y1 - y0) * .4], [x0 + (x1 - x0) * .85, y0 + (y1 - y0) * .85]], 5.4, 5.4, 'a'); fist(G, x1, y1, 't', r); };
    if (pose === 'roar') { const p = [[cx - 11, 16], [cx - 14.6, 21], [cx - 14, 26]]; a(p); a(mir(W, p)); }
    if (pose === 'flex') { const p = [[cx - 11, 16], [cx - 15.4, 13], [cx - 14.6, 7.6]]; a(p); a(mir(W, p)); }
    if (pose === 'blast') { a([[cx - 11, 16], [cx - 14.6, 21], [cx - 14, 26]]); a([[cx + 11, 16], [cx + 15, 16.6], [cx + 15.4, 15]]); G0.ell(cx + 14.6, 8.6, 3.4, 3.4, 'G'); G0.ell(cx + 14.6, 8.6, 2.2, 2.2, 'q'); G0.ell(cx + 14.6, 8.6, 1, 1, 'l'); }
    if (pose === 'grab') { a([[cx - 11, 16], [cx - 15, 18], [cx - 15.6, 13.6]]); a([[cx + 11, 16], [cx + 15, 18], [cx + 15.6, 13.6]]); }
    // head: small on the bulk, thick neck, bangs over the left of the face, blank eyes
    G.rect(cx - 3, 10, 6, 4, 't');
    G.ell(cx, 7.4, 4, 4.4, 't'); G.poly([[cx - 3.6, 7.4], [cx + 3.6, 7.4], [cx + 2.6, 11], [cx, 12.2], [cx - 2.6, 11]], 't');
    G.poly([[cx - 4.6, 8], [cx - 4.4, 3.6], [cx, 2], [cx + 4.4, 3.6], [cx + 4.6, 8], [cx + 3, 5.4], [cx, 6], [cx - 2, 7.6], [cx - 3, 5.6]], 'q');
    G.set(cx - 2, 3, 'l'); G.set(cx - 3, 4, 'l');
    G.rect(cx - 3, 7, 2, 1, 'T'); G.rect(cx + 1, 7, 2, 1, 'T'); G.rect(cx - 3, 8, 2, 1, 'w'); G.rect(cx + 1, 8, 2, 1, 'w');   // blank eyes
    G.set(cx - 5, 10, 'a'); G.set(cx + 4, 10, 'a');                                                                // hoop earrings
    if (o.mouth === 'roar') { G.rect(cx - 2, 9, 4, 2, 'p'); G.rect(cx - 2, 9, 4, 1, 'w'); } else { G.rect(cx - 2, 10, 4, 1, 'p'); G.set(cx - 2, 10, 'w'); G.set(cx + 1, 10, 'w'); }
  }, SAI_PAL, { t: 'T', r: 'R', a: 'A', q: 'Q' });
}

// ---------- u11 · dyspo: small, slim, hairless lilac speedster; long wide pointed ears, bulging yellow eyes, buck teeth;
// the pride trooper suit (red, black yoke and legs, white gloves and tall white boots) ----------
const DYS_PAL = { o: 0x140a18, p: 0xa47ad0, P: 0x6e4c9c, l: 0xd2b4f2, q: 0xe8a0c8, e: 0xf6e44a, k: 0x0e0a10, t: 0xfffcf0, r: 0xd8282e, R: 0x8e161c, n: 0x1c1a20, w: 0xf6f4f6, W: 0xbcb8c4, s: 0x9ad8ff, y: 0xfff07a };
function dyspo(o = {}) {
  const W = 22, pose = o.pose || 'stand';
  return spr(W, 30, G => {
    if (o.streak) for (const [y, x0, n] of [[10, 0, 4], [15, 1, 3], [19, 0, 5], [24, 1, 3]]) G.rect(x0, y, n, 1, o.streak);   // speed streaks
    oline(G, [[9.4, 21], [9, 25.4]], 3, 2.8, 'n'); oline(G, [[12.6, 21], [13, 25.4]], 3, 2.8, 'n');
    G.rect(6, 24, 5, 3, 'w'); G.rect(11, 24, 5, 3, 'w');                                                  // tall white boots
    G.poly([[7, 14], [15, 14], [14.6, 21.6], [7.4, 21.6]], 'r');
    G.poly([[8, 14], [14, 14], [13.2, 15.8], [11, 16.8], [8.8, 15.8]], 'n'); G.rect(7, 20, 8, 2, 'n');
    G.ell(6.6, 15.4, 2.2, 1.8, 'r'); G.ell(15.4, 15.4, 2.2, 1.8, 'r');
    const a = (pts, r = 1.3) => arm(G, pts, 'p', 'w', 2.2, r);
    if (pose === 'stand') { a([[6.2, 15.8], [5, 19], [5.6, 21.4]]); a(mir(W, [[6.2, 15.8], [5, 19], [5.6, 21.4]])); }
    if (pose === 'fight') { a([[6.2, 15.8], [4.6, 18.6], [7.6, 18.4]]); a([[15.8, 15.8], [18.6, 15.6], [19, 12.6]]); }
    if (pose === 'point') { a([[6.2, 15.8], [5, 19], [5.6, 21.4]]); a([[15.8, 15.8], [18.4, 14.6], [20, 12.4]], 1.1); G.set(20, 10, 'w'); G.set(21, 9, 'w'); }
    if (pose === 'dash') { a([[6.2, 15.8], [3.4, 17.4], [2.4, 15]]); a([[15.8, 15.8], [18.4, 18.4], [19.8, 17]]); }
    // head: lilac, wide ears swept up and out, a narrow jaw
    for (const e of [[[8, 8.6], [1.4, 1.4]], mir(W, [[8, 8.6], [1.4, 1.4]])]) oline(G, e, 5, 1, 'p');
    G.line([[6.6, 7.4], [3, 3.6]], 1.6, .6, 'q'); G.line(mir(W, [[6.6, 7.4], [3, 3.6]]), 1.6, .6, 'q');
    G.ell(11, 8.8, 4.4, 4.2, 'p'); G.poly([[7, 9], [15, 9], [14.2, 12.4], [12.4, 14.2], [9.6, 14.2], [7.8, 12.4]], 'p');
    G.set(9, 5, 'l'); G.set(10, 5, 'l'); G.set(8, 6, 'l');
    // bulging yellow eyes under heavy lids
    G.rect(8, 7, 2, 1, 'P'); G.rect(12, 7, 2, 1, 'P');
    G.rect(8, 8, 2, 2, 'e'); G.rect(12, 8, 2, 2, 'e');
    if (o.glow) { G.set(9, 8, 'y'); G.set(12, 8, 'y'); } else { G.set(9, 9, 'k'); G.set(12, 9, 'k'); }
    if (o.mouth === 'grin') { G.rect(9, 11, 4, 1, 'k'); G.set(8, 10, 'k'); G.set(13, 10, 'k'); G.rect(10, 12, 2, 1, 't'); }
    else { G.rect(9, 11, 4, 1, 'P'); G.rect(10, 12, 2, 1, 't'); }                                       // buck teeth
  }, DYS_PAL, { p: 'P', r: 'R', w: 'W' });
}

// ---------- u11 · toppo, god of destruction mode: tall and burly, tan, bald with two veins, big pointy ears,
// yellow eyes with dark lines under, a huge white moustache over the mouth, a pot belly on short skinny legs,
// long arms ending in massive white-gloved hands; violet hakai aura ----------
const TOP_PAL = { o: 0x140a10, s: 0xdca478, S: 0x9e6a46, v: 0x9c4ef0, V: 0x5a1fa8, u: 0xd8a8ff, k: 0x0e0a0e, e: 0xf6d23a, y: 0xfff2c8, h: 0xf6f6f8, H: 0xbcbcc8, r: 0xd8282e, R: 0x8e161c, n: 0x1c1a20, N: 0x34323a, w: 0xf6f4f6, W: 0xbcb8c4 };
function toppo(o = {}) {
  const W = 34, H = 40, pose = o.pose || 'fold', cx = 17;
  return spr(W, H, G => {
    aura(G, W, H, 'V', 'v');
    if (o.sparks) for (const p of [[[2, 10], [4, 12], [3, 14]], [[31, 8], [29, 11], [31, 13]], [[1, 26], [3, 28]], [[32, 24], [30, 27]]]) bolt(G, p, 'u');
    // short skinny legs, white boots
    oline(G, [[14.4, 31], [14, 35.4]], 3, 2.8, 'n'); oline(G, [[19.6, 31], [20, 35.4]], 3, 2.8, 'n');
    G.rect(11, 35, 5, 3, 'w'); G.rect(18, 35, 5, 3, 'w');
    // barrel torso with a pot belly
    G.poly([[9, 17], [25, 17], [26.6, 25], [24.6, 31.6], [9.4, 31.6], [7.4, 25]], 'r');
    G.poly([[11, 17], [23, 17], [21.6, 19.6], [17, 21], [12.4, 19.6]], 'n'); G.rect(9, 30, 16, 2, 'n');
    l1(G, [[11, 27], [23, 27]], 'R'); G.set(17, 24, 'R');
    if (o.torn) { G.poly([[12, 21], [15, 22.6], [13.4, 25], [16, 26], [14, 27.4], [11, 26]], 's'); G.set(13, 23, 'S'); }
    G.ell(8.4, 19.4, 3.8, 3.2, 'r'); G.ell(25.6, 19.4, 3.8, 3.2, 'r');
    const glove = (x, y, r = 2.6) => fist(G, x, y, 'w', r);
    const a = pts => oline(G, pts, 3.8, 3.4, 's');
    if (pose === 'fold') { fold(G, [[6.4, 20], [8, 24.6], [21.6, 24]], [[27.6, 20], [26, 26], [12.4, 25.8]], 's', 'S', 'w', 4, 2.2); }
    if (pose === 'fists') { const p = [[6.4, 20.4], [4.6, 25], [5, 29]]; a(p); a(mir(W, p)); glove(5, 30); glove(29, 30); }
    if (pose === 'hakai') {
      const p = [[6.4, 20.4], [4.6, 25], [5, 29]]; a(p); glove(5, 30);
      a([[27.6, 20], [30.4, 15.6], [29.6, 11]]); G.ell(28.4, 5, 5, 5, 'o'); G.ell(28.4, 5, 4.2, 4.2, 'u'); G.ell(28.4, 5, 3.2, 3.2, 'k'); G.ell(28.4, 5, 2, 2, 'V'); G.set(27, 3, 'u'); glove(29.6, 10.2, 2.4);
    }
    if (pose === 'punch') { const p = [[6.4, 20.4], [4.6, 25], [5, 29]]; a(p); glove(5, 30); a([[27.6, 20], [30, 21]]); glove(30.4, 21, 2.8); G.ell(30.4, 21, 1, 1, 'u'); }
    // the head: bald and wide, big pointed ears, two veins on the crown
    for (const e of [[[12.6, 11], [5, 3]], mir(W, [[12.6, 11], [5, 3]])]) oline(G, e, 4.4, .8, 's');
    l1(G, [[10.6, 9], [7.6, 6]], 'S'); l1(G, mir(W, [[10.6, 9], [7.6, 6]]), 'S');
    G.ell(cx, 9.2, 5.4, 6, 's'); G.poly([[11.6, 10], [22.4, 10], [21.8, 14.6], [19.4, 16.8], [14.6, 16.8], [12.2, 14.6]], 's'); G.rect(14, 16, 6, 2, 's');
    l1(G, [[14.6, 7], [15.4, 5], [14.6, 3.6]], 'S'); l1(G, [[19.4, 7], [18.6, 5], [19.4, 3.6]], 'S');   // the two veins
    G.set(13, 5, 'y'); G.set(14, 4, 'y');
    G.rect(12, 8, 4, 1, 'k'); G.rect(18, 8, 4, 1, 'k'); G.set(15, 9, 'k'); G.set(18, 9, 'k');                  // heavy brows
    if (o.blank) { G.rect(13, 9, 2, 1, 'y'); G.rect(19, 9, 2, 1, 'y'); }
    else { G.rect(13, 9, 2, 1, 'e'); G.rect(19, 9, 2, 1, 'e'); G.set(14, 9, 'k'); G.set(19, 9, 'k'); }
    G.rect(13, 10, 3, 1, 'S'); G.rect(18, 10, 3, 1, 'S');                                                       // the dark lines under the eyes
    G.rect(16, 11, 2, 1, 'S');
    G.poly([[12, 12.6], [17, 11.6], [22, 12.6], [23.4, 16], [21, 14.6], [17, 15.4], [13, 14.6], [10.6, 16]], 'h');   // the moustache
    G.set(17, 13, 'H'); G.set(16, 13, 'H');
    if (o.roar) { G.rect(15, 15, 4, 1, 'k'); G.rect(15, 16, 4, 1, 'k'); }
  }, TOP_PAL, { s: 'S', r: 'R', w: 'W', h: 'H' });
}
return {
  bergamo: [bergamo({ pose: 'fold' }), bergamo({ pose: 'beckon', mouth: 'grin' }), bergamo({ pose: 'flex', mouth: 'fang' }), bergamo({ pose: 'fists', mouth: 'fang', big: true, aura: true })],
  lavender: [lavender({ pose: 'hunch' }), lavender({ pose: 'claw', mouth: 'tongue' }), lavender({ pose: 'breath', mouth: 'fang', mist: true }), lavender({ pose: 'lunge', shut: true, mouth: 'fang' })],
  basil: [basil({ pose: 'stand' }), basil({ pose: 'kick', mouth: 'grin' }), basil({ pose: 'guard', mouth: 'fang' }), basil({ pose: 'flex', power: true, aura: true, mouth: 'fang' })],
  obuni: [obuni({ pose: 'fold' }), obuni({ pose: 'stance' }), obuni({ pose: 'down', ghost: true, shut: true }), obuni({ pose: 'blast', mouth: 'shout' })],
  murichim: [murichim({ pose: 'nio' }), murichim({ pose: 'fold' }), murichim({ pose: 'fists', mouth: 'roar' }), murichim({ pose: 'charge', mouth: 'roar', aura: true, glow: true })],
  rubalt: [rubalt({ pose: 'fists' }), rubalt({ pose: 'fold' }), rubalt({ pose: 'smash', mouth: 'roar' }), rubalt({ pose: 'punch', mouth: 'roar', aura: true })],
  ganos: [ganos({ pose: 'stand', beret: true }), ganos({ pose: 'spread', beret: true, mouth: 'open' }), ganos({ pose: 'talon', mouth: 'open' }), ganos({ pose: 'fold', aura: true, torn: true })],
  caway: [caway({ pose: 'stand' }), caway({ pose: 'spear' }), caway({ pose: 'kiss', wink: true }), caway({ pose: 'bolts' })],
  dercori: [dercori({ pose: 'stand' }), dercori({ pose: 'throw', mouth: 'grin' }), dercori({ pose: 'hush' }), dercori({ pose: 'loom', dark: true, mouth: 'grin' })],
  anilaza: [anilaza({ pose: 'stand' }), anilaza({ pose: 'raise', mouth: 'roar' }), anilaza({ pose: 'punch', wings: true }), anilaza({ pose: 'burst', wings: true, mouth: 'roar' })],
  paparoni: [paparoni({ pose: 'cane' }), paparoni({ pose: 'point' }), paparoni({ pose: 'raise', mouth: 'laugh' }), paparoni({ pose: 'laugh', mouth: 'laugh' })],
  koitsukai: [koitsukai({ pose: 'stand' }), koitsukai({ pose: 'fly' }), koitsukai({ pose: 'up' }), koitsukai({ pose: 'punch', red: true })],
  ribrianne: [ribrianne({ pose: 'heart' }), ribrianne({ pose: 'wave', mouth: 'open', hearts: true }), ribrianne({ pose: 'hips' }), ribrianne({ pose: 'beam', wings: true, mouth: 'open' })],
  rozie: [rozie({ pose: 'stand' }), rozie({ pose: 'shoot', mouth: 'grin' }), rozie({ pose: 'shades' }), rozie({ pose: 'up', hearts: true, mouth: 'grin' })],
  kakunsa: [kakunsa({ pose: 'crouch', mouth: 'fang' }), kakunsa({ pose: 'slash', mouth: 'fang' }), kakunsa({ pose: 'pounce', mouth: 'fang' }), kakunsa({ pose: 'stand' })],
  kefla: [kefla({ pose: 'fold', ss: 1 }), kefla({ pose: 'blast', ss: 2, mouth: 'grin' }), kefla({ pose: 'hips', mouth: 'grin' }), kefla({ pose: 'charge', ss: 2 })],
  caulifla: [caulifla({ pose: 'hips', mouth: 'grin' }), caulifla({ pose: 'point', ss: 1, mouth: 'grin' }), caulifla({ pose: 'fists', ss: 2 }), caulifla({ pose: 'cannon', mouth: 'grin' })],
  kale: [kale({ pose: 'roar', mouth: 'roar' }), kale({ pose: 'flex', mouth: 'roar' }), kale({ pose: 'blast' }), kale({ pose: 'grab', mouth: 'roar' })],
  dyspo: [dyspo({ pose: 'stand' }), dyspo({ pose: 'fight', mouth: 'grin' }), dyspo({ pose: 'point', mouth: 'grin' }), dyspo({ pose: 'dash', streak: 'y', glow: true })],
  toppo: [toppo({ pose: 'fold' }), toppo({ pose: 'hakai', sparks: true }), toppo({ pose: 'fists', blank: true, roar: true, torn: true, sparks: true }), toppo({ pose: 'punch' })],
};
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
// the movie villains (picked takes): cooler (final form, mouth guard shut), super janemba (arms folded), bojack; plus
// salza's armoured squadron and bojack's gang as small henchmen
const MOVIE = (() => {
  const fist = (G, x, y, c, r = 1.5) => { G.ell(x, y, r + 1, r + 1, 'o'); G.ell(x, y, r, r, c); };
  const arm = (G, pts, c, hand, w = 3) => { oline(G, pts, w, w - .4, c); const [x, y] = pts[pts.length - 1]; fist(G, x, y, hand); };
  const fold = (G, c, c2, hand, dx = 0, dy = 0) => {
    const l = [[7 + dx, 16.6 + dy], [8.6 + dx, 19.4 + dy], [16.6 + dx, 19 + dy]], r = [[19 + dx, 16.6 + dy], [17.6 + dx, 20.4 + dy], [9.4 + dx, 20.2 + dy]];
    G.line(l, 5, 4.6, 'o'); G.line(r, 5, 4.6, 'o'); G.line(l, 3, 2.6, c); G.line(r, 3, 2.6, c2);
    G.ell(9.2 + dx, 19.6 + dy, 1.3, 1.2, hand); G.ell(16.8 + dx, 20.4 + dy, 1.3, 1.2, hand);
  };
  const shift = (G0, dy) => ({ ...G0, ell: (x, y, a, b, c) => G0.ell(x, y + dy, a, b, c), rect: (x, y, w, h, c) => G0.rect(x, y + dy, w, h, c), poly: (p, c) => G0.poly(p.map(([x, y]) => [x, y + dy]), c), line: (p, a, b, c) => G0.line(p.map(([x, y]) => [x, y + dy]), a, b, c), set: (x, y, c) => G0.set(x, y + dy, c) });
  // ---------- cooler, final form: frieza's elder brother. silver-white skin, a crowned purple dome with back-swept spikes,
  // purple shoulder and chest plates with blue gems, red eyes, the mouth guard, tail ----------
  const COOL_PAL = { o: 0x100a20, w: 0xeceaf6, W: 0xaca8c8, p: 0x6a48b8, P: 0x3e2680, q: 0xb49af0, g: 0x3a7af0, G: 0x1a40a8, r: 0xe0302a, k: 0x100a18, n: 0xffd0a0, N: 0xf06a20, a: 0xffe2c0, i: 0xf8f8ff, I: 0xd0b0ff };
  function cooler(o = {}) {
    const W = 28, pose = o.pose || 'fold';
    return shapeSprite(W, 38, G0 => {
      const G = shift(G0, 2);
      if (pose === 'nova') { G0.ell(14, 4.6, 8, 4.6, 'N'); G0.ell(14, 4.4, 6.2, 3.4, 'n'); G0.ell(12, 3, 2, 1, 'a'); }
      G.line([[17, 26], [23, 29], [26, 24], [25, 19]], 3, 1.6, 'w'); G.ell(25, 19, 1.4, 1.4, 'p');                  // tail
      oline(G, [[12, 25], [11, 32]], 3.2, 3, 'w'); oline(G, [[16, 25], [17, 32]], 3.2, 3, 'w');                       // legs
      G.ell(11.4, 29, 1.6, 1.6, 'p'); G.ell(16.6, 29, 1.6, 1.6, 'p'); G.rect(9, 32, 4, 2, 'p'); G.rect(15, 32, 4, 2, 'p');
      G.poly([[9.6, 16], [18.4, 16], [17.4, 25], [10.6, 25]], 'w');
      G.poly([[9.6, 15.4], [18.4, 15.4], [17.6, 20.6], [14, 22], [10.4, 20.6]], 'p'); G.ell(14, 18.6, 1.6, 1.4, 'g');  // chest plate, gem
      for (const y of [22, 24]) G.rect(12, y, 4, 1, 'W');                                                            // abs
      G.ell(9, 16.6, 3, 2.3, 'p'); G.ell(19, 16.6, 3, 2.3, 'p'); G.set(8, 16, 'g'); G.set(19, 16, 'g');               // shoulder pads
      const c = 'w', h = 'w';
      if (pose === 'fold') fold(G, 'w', 'W', 'p', 1, 0);
      if (pose === 'beam') { arm(G, [[9, 18], [7, 22], [7.4, 25]], c, h); arm(G, [[19, 18], [23, 18], [25.6, 17.4]], c, h); G.ell(21.6, 18, 1.2, 1.2, 'g'); G.line([[26.6, 16.6], [27.6, 16.6]], 1, 1, 'I'); }
      if (pose === 'nova') { arm(G, [[9, 18], [6, 13], [7, 8]], c, h); arm(G, [[19, 18], [22, 13], [21, 8]], c, h); }
      if (pose === 'hips') { arm(G, [[9, 18], [6, 21], [9, 23.6]], c, h); arm(G, [[19, 18], [22, 21], [19, 23.6]], c, h); }
      // head: purple crowned dome, four spikes swept back and out, silver face
      for (const [a, b] of [[[9, 6], [4, 1]], [[11, 4], [8.4, -1.4]], [[17, 4], [19.6, -1.4]], [[19, 6], [24, 1]]]) G.line([a, b], 2.6, .8, 'p');
      G.ell(14, 9, 4.8, 5, 'p'); G.set(12, 5, 'q'); G.set(11, 6, 'q');
      G.poly([[9.6, 8.4], [18.4, 8.4], [18, 12], [16, 14.6], [12, 14.6], [10, 12]], 'w');                            // face
      G.ell(9, 10, .9, 1.6, 'p'); G.ell(19, 10, .9, 1.6, 'p');                                                       // purple cheek plates
      G.poly([[10.4, 9], [13.4, 10], [13.4, 10.6], [10.4, 9.8]], 'k'); G.poly([[17.6, 9], [14.6, 10], [14.6, 10.6], [17.6, 9.8]], 'k');
      G.rect(11, 10, 2, 1, 'r'); G.rect(15, 10, 2, 1, 'r'); G.set(12, 10, 'k'); G.set(15, 10, 'k');
      if (o.mask) { G.poly([[10.4, 12], [17.6, 12], [16.4, 14.8], [11.6, 14.8]], 'p'); G.rect(12, 13, 4, 1, 'P'); }  // the mouth guard closed
      else if (o.mouth === 'smirk') { G.rect(13, 13, 2, 1, 'k'); G.set(15, 12, 'k'); }
      else G.rect(13, 13, 2, 1, 'W');
      G.rect(12, 15, 4, 1, 'w');
    }, COOL_PAL, { w: 'W', p: 'P', g: 'G' });
  }
  // ---------- super janemba: a lean red demon, white mane of spines down the back, yellow chest armour,
  // a horned crest, yellow eyes, a long tail, the dimension sword ----------
  const JAN_PAL = { o: 0x1c0408, r: 0xd02a2a, R: 0x8a1018, h: 0xf4f0ea, H: 0xbcb4a8, y: 0xf2c440, Y: 0xb0841a, k: 0x100406, e: 0xf8f040, w: 0xffffff, p: 0x6a2a8a, P: 0x44185c, s: 0xf8e8a0, S: 0xc8b060, g: 0xfff0b0, b: 0x9a8ad0, B: 0x6a5aa0 };
  function janemba(o = {}) {
    const W = 32, pose = o.pose || 'sword';
    return shapeSprite(W, 40, G => {
      G.poly([[11, 6], [21, 6], [26, 14], [27, 26], [23, 22], [21, 28], [16, 22], [11, 28], [9, 22], [5, 26], [6, 14]], 'h');   // mane of spines
      G.line([[19, 29], [25, 33], [29, 29], [29, 23]], 2.6, 1, 'r'); G.poly([[27.4, 23.4], [29, 20], [30.6, 23.4], [29, 25]], 'y');   // tail, arrow tip
      oline(G, [[13.6, 28], [12.6, 35]], 3.4, 3, 'r'); oline(G, [[18.4, 28], [19.4, 35]], 3.4, 3, 'r');
      G.poly([[10, 35], [14, 35], [14, 37], [9, 37]], 'y'); G.poly([[18, 35], [22, 35], [23, 37], [18, 37]], 'y');   // gold feet
      G.poly([[11, 17], [21, 17], [20, 28], [12, 28]], 'r');
      G.poly([[10.4, 16.4], [21.6, 16.4], [20.6, 22.6], [16, 24], [11.4, 22.6]], 'y'); G.line([[16, 17], [16, 23]], 1, 1, 'Y');   // yellow chest armour
      for (const y of [25, 27]) G.rect(13, y, 6, 1, 'R');
      G.ell(10.4, 17, 3, 2.4, 'y'); G.ell(21.6, 17, 3, 2.4, 'y');
      const c = 'r', h = 'r';
      const sword = (x0, y0, x1, y1) => { G.line([[x0, y0], [x1, y1]], 3, 1.4, 'o'); G.line([[x0, y0], [x1, y1]], 1.4, .6, 'g'); G.rect(Math.round(x0) - 1, Math.round(y0), 3, 1, 'Y'); };
      if (pose === 'sword') { arm(G, [[10, 18], [7.6, 22], [8, 26]], c, h); sword(24.6, 19, 30, 3); arm(G, [[22, 18], [24.6, 20.6], [24.6, 21.4]], c, h); }
      if (pose === 'fold') fold(G, c, 'R', h, 3, 1);
      if (pose === 'claw') { arm(G, [[10, 18], [5.6, 16], [4, 11]], c, h); arm(G, [[22, 18], [26.4, 16], [28, 11]], c, h); for (const x of [3, 5, 27, 29]) G.set(x, 8, 'w'); }
      // head: horned crest, demon face, yellow eyes
      G.line([[12, 7], [9, 2], [8, 0]], 2.6, .8, 'y'); G.line([[20, 7], [23, 2], [24, 0]], 2.6, .8, 'y'); G.line([[16, 5], [16, .4]], 2.4, .8, 'y');
      G.ell(16, 10, 4.8, 5.2, 'r');
      G.poly([[11.6, 8.6], [15, 9.8], [15, 10.6], [11.6, 9.6]], 'k'); G.poly([[20.4, 8.6], [17, 9.8], [17, 10.6], [20.4, 9.6]], 'k');
      G.rect(12, 10, 3, 1, 'e'); G.rect(17, 10, 3, 1, 'e'); G.set(14, 10, 'k'); G.set(17, 10, 'k');
      if (o.mouth === 'fang') { G.rect(13, 13, 6, 1, 'k'); G.set(13, 14, 'w'); G.set(18, 14, 'w'); G.rect(13, 12, 6, 1, 'R'); }
      else { G.rect(14, 13, 4, 1, 'k'); G.set(14, 14, 'w'); G.set(17, 14, 'w'); }
      G.rect(14, 15, 4, 2, 'r');
    }, JAN_PAL, { r: 'R', h: 'H', y: 'Y' });
  }
  // ---------- bojack: teal skin, a mane of orange hair under a black band with a gold gem, a scar over the eye,
  // pirate-gypsy rig: open purple vest with gold trim, red sash, white baggy trousers, black boots ----------
  const BOJ_PAL = { o: 0x061414, s: 0x5ab8a8, S: 0x2e8070, h: 0xf08a2a, H: 0xb0561a, j: 0xffc070, k: 0x0c0c10, K: 0x2a2a32, e: 0x101010, w: 0xffffff, y: 0xf2c840, Y: 0xb08820, v: 0x5a3a8a, V: 0x38225c, r: 0xc82a2a, R: 0x82141a, p: 0xf2ece0, P: 0xbcb4a0, x: 0x9ae84a, X: 0x5aa82a, q: 0xd83a20, Q: 0x8a1a10, g: 0xc8ff8a, G: 0x4ac83a, c: 0x8a4848 };
  function bojack(o = {}) {
    const W = 28, pose = o.pose || 'fold', fp = !!o.full, sk = fp ? 'x' : 's', hc = fp ? 'q' : 'h';
    return shapeSprite(W, 38, G0 => {
      const G = shift(G0, 1);
      G.poly([[7, 8], [21, 8], [23.4, 15], [24, 21], [20, 18], [14, 16], [8, 18], [4, 21], [4.6, 15]], hc);           // the mane down the back
      oline(G, [[11.6, 26], [10.6, 32]], 4, 3.6, 'p'); oline(G, [[16.4, 26], [17.4, 32]], 4, 3.6, 'p');               // baggy trousers
      G.rect(8, 32, 5, 3, 'k'); G.rect(15, 32, 5, 3, 'k'); G.rect(8, 32, 5, 1, 'K'); G.rect(15, 32, 5, 1, 'K');
      G.poly([[9, 16], [19, 16], [18.4, 25], [9.6, 25]], sk); G.line([[14, 17], [14, 22]], 1, 1, fp ? 'X' : 'S');
      if (!fp) { G.poly([[8.6, 15.6], [11.6, 15.6], [12, 25], [9.4, 25]], 'v'); G.poly([[19.4, 15.6], [16.4, 15.6], [16, 25], [18.6, 25]], 'v'); G.line([[11.6, 16], [12, 24.6]], 1, 1, 'y'); G.line([[16.4, 16], [16, 24.6]], 1, 1, 'y'); }
      else { G.poly([[8.6, 15.6], [10.6, 15.6], [10, 19], [9, 21]], 'v'); G.poly([[19.4, 15.6], [17.4, 15.6], [18.4, 20]], 'v'); }   // vest shredded
      G.rect(9, 24, 10, 2, 'r'); G.poly([[17, 25], [20, 25], [21, 29], [19, 28]], 'r');                                 // sash and its tail
      G.ell(8.4, 16.4, 2.6, 2, fp ? sk : 'v'); G.ell(19.6, 16.4, 2.6, 2, fp ? sk : 'v');
      const c = fp ? sk : 'v';
      if (pose === 'fold') fold(G, c, fp ? 'X' : 'V', sk, 1, 0);
      if (pose === 'fist') { arm(G, [[8, 17], [6, 21], [6.6, 24.4]], c, sk); arm(G, [[20, 17], [23, 15], [23.6, 11]], c, sk); }
      if (pose === 'buster') { arm(G, [[8, 17], [6, 21], [6.6, 24.4]], c, sk); arm(G, [[20, 17], [23, 17.6], [25, 17]], c, sk); G0.ell(25.4, 13.4, 2.4, 2.4, 'G'); G0.ell(25.4, 13.4, 1.4, 1.4, 'g'); }
      if (pose === 'roar') { arm(G, [[8, 17], [4.6, 14], [4, 10]], c, sk, 3.4); arm(G, [[20, 17], [23.4, 14], [24, 10]], c, sk, 3.4); }
      // head: wild hair spilling over a black band with a gold gem, teal face, scar
      G.poly([[6.6, 10], [6, 4], [9, 1.6], [11, 3], [13, .6], [15.4, 2.6], [18, .8], [20, 3.6], [22, 4], [21.4, 10]], hc);
      G.ell(14, 10, 4.4, 4.6, sk);
      G.rect(9, 6, 10, 2, 'k'); G.rect(13, 6, 2, 2, 'y'); G.set(13, 6, 'w');                                          // headband, gem
      G.set(10, 3, 'j'); G.set(11, 4, 'j');
      G.poly([[10, 8.4], [13.2, 9.4], [13.2, 10], [10, 9.2]], 'e'); G.poly([[18, 8.4], [14.8, 9.4], [14.8, 10], [18, 9.2]], 'e');
      G.rect(11, 10, 2, 1, 'w'); G.rect(15, 10, 2, 1, 'w'); G.set(12, 10, 'e'); G.set(15, 10, 'e');
      G.line([[16.4, 8], [17.4, 12]], 1, 1, 'c');                                                                    // the scar
      if (o.mouth === 'grin') { G.rect(12, 13, 4, 1, 'e'); G.rect(12, 12, 4, 1, 'w'); G.set(11, 12, 'e'); G.set(16, 12, 'e'); }
      else if (o.mouth === 'roar') { G.rect(12, 12, 4, 2, 'e'); G.rect(12, 12, 4, 1, 'w'); }
      else G.rect(13, 13, 2, 1, fp ? 'X' : 'S');
      G.rect(12, 15, 4, 1, sk);
    }, BOJ_PAL, { s: 'S', x: 'X', h: 'H', q: 'Q', v: 'V', p: 'P', r: 'R' });
  }
  // ---------- henchmen: one small chibi build, a head per goon. o.suit/o.trim body colours, o.armor for the squadron's plates ----------
  function hench(o) {
    const W = 18;
    return shapeSprite(W, 26, G => {
      if (o.hair === 'salza') G.poly([[4, 6], [14, 6], [15, 14], [13, 18], [9, 15], [5, 18], [3, 14]], 'h');       // long silver hair down the back
      if (o.hair === 'zangya') { G.ell(9, 9, 7.4, 7, 'h'); G.ell(3.4, 14, 2.6, 4, 'h'); G.ell(14.6, 14, 2.6, 4, 'h'); }   // a big cloud of orange curls
      if (o.hair === 'kogu') G.poly([[4, 5], [14, 5], [15.6, 17], [12, 15], [9, 18], [6, 15], [2.4, 17]], 'h');     // long dark hair
      if (o.cape) G.poly([[4, 13], [14, 13], [15.4, 23], [2.6, 23]], 'c');
      if (o.sword) { G.line([[13, 12], [16.6, 3]], 2.4, 1.2, 'o'); G.line([[13, 12], [16.6, 3]], 1, .6, 'w'); G.rect(12, 11, 3, 1, 'y'); }
      const bulk = o.big ? 1 : 0;
      oline(G, [[7.4 - bulk, 19], [7, 23]], 2.6 + bulk, 2.4 + bulk, o.legs || 'u'); oline(G, [[10.6 + bulk, 19], [11, 23]], 2.6 + bulk, 2.4 + bulk, o.legs || 'u');
      G.rect(5 - bulk, 23, 4 + bulk, 2, 'b'); G.rect(9, 23, 4 + bulk, 2, 'b');                                         // boots
      G.poly([[5 - bulk, 13], [13 + bulk, 13], [12 + bulk, 20], [6 - bulk, 20]], o.suit || 'u');
      if (o.armor) { G.poly([[5 - bulk, 12.6], [13 + bulk, 12.6], [12.4 + bulk, 17], [9, 18], [5.6 - bulk, 17]], 'a'); G.ell(4.4 - bulk, 13.4, 2.2, 1.8, 'a'); G.ell(13.6 + bulk, 13.4, 2.2, 1.8, 'a'); G.set(9, 15, 'g'); }
      else if (o.vest) { G.poly([[5 - bulk, 12.6], [7.6, 12.6], [8, 20], [6 - bulk, 20]], 'v'); G.poly([[13 + bulk, 12.6], [10.4, 12.6], [10, 20], [12 + bulk, 20]], 'v'); G.ell(4.6 - bulk, 13.4, 2, 1.6, 'v'); G.ell(13.4 + bulk, 13.4, 2, 1.6, 'v'); }
      G.rect(6 - bulk, 19, 6 + bulk * 2, 1, 'r');                                                                    // belt or sash
      const ac = o.vest ? 's' : 'u';                                                                               // bare arms under a vest, sleeves otherwise
      if (o.pose === 'hips') { oline(G, [[4.4 - bulk, 14], [2.6 - bulk, 17], [5 - bulk, 19]], 2, 1.8, ac); oline(G, [[13.6 + bulk, 14], [15.4 + bulk, 17], [13 + bulk, 19]], 2, 1.8, ac); }
      else { oline(G, [[4.4 - bulk, 14], [4.6 - bulk, 17.4], [12, 17.4]], 2, 1.8, ac); oline(G, [[13.6 + bulk, 14], [13.4 + bulk, 16], [6, 16]], 2, 1.8, ac); }   // arms folded
      // head
      G.ell(9, 8, o.big ? 4.6 : 4.2, 4.4, 's');
      if (o.hair === 'salza' || o.hair === 'kogu') G.poly([[4.6, 7], [5, 3.6], [9, 2.4], [13, 3.6], [13.4, 7], [11, 5], [7, 5]], 'h');
      if (o.hair === 'zangya') { G.poly([[4.6, 7.4], [5, 3.6], [9, 2], [13, 3.6], [13.4, 7.4], [11.6, 5], [9, 6], [6.4, 5]], 'h'); }
      if (o.hair === 'bido') G.rect(4, 1, 10, 4, 'h');                                                             // a flat red top
      if (o.hair === 'bujin') { G.poly([[6, 5], [12, 5], [10.6, -1], [9, 1.4], [7.4, -1]], 'h'); G.poly([[4.4, 7], [1.4, 4], [5, 9]], 's'); G.poly([[13.6, 7], [16.6, 4], [13, 9]], 's'); }   // white flame tuft, pointed ears
      if (o.hair === 'neiz') { G.line([[6, 5], [4, 1]], 1.6, .6, 's'); G.line([[9, 4], [9, 0]], 1.6, .6, 's'); G.line([[12, 5], [14, 1]], 1.6, .6, 's'); }   // three horn stubs
      if (o.hair === 'dore') { G.ell(9, 5, 4.4, 2.4, 's'); G.set(7, 4, 'l'); }                                     // a bald dome
      G.rect(6, 8, 2, 1, 'k'); G.rect(10, 8, 2, 1, 'k'); G.set(6, 7, 'k'); G.set(11, 7, 'k');                     // scowl
      if (o.eyes) { G.set(7, 8, o.eyes); G.set(10, 8, o.eyes); }
      if (o.lips) G.rect(8, 10, 2, 1, o.lips); else G.rect(8, 10, 2, 1, 'S');
      if (o.hair === 'zangya') { G.set(5, 7, 'h'); G.set(12, 7, 'h'); }
    }, { o: 0x0e0a16, s: o.skin, S: o.skinD, l: o.skinL || o.skin, h: o.hairC || 0xf4f0ea, H: o.hairD || 0xbcb4a8, k: 0x100a14, u: o.suitC || 0x3a2a6a, U: o.suitD || 0x241848, a: 0xf2f0f6, A: 0xb8b4c8, g: 0x3a7af0, b: 0x1c1a26, r: o.belt || 0x6a48b8, v: o.vestC || 0x5a3a8a, V: 0x38225c, c: o.capeC || 0x3a2a4a, C: 0x241a30, w: 0xe8f0ff, y: 0xf2c840, R: 0xe0302a, Y: 0xf8f040, m: 0xc84a6a }, { s: 'S', h: 'H', u: 'U', a: 'A', c: 'C', v: 'V' });
  }
  return {
    cooler: cooler({ pose: 'hips', mask: true }), janemba: janemba({ pose: 'fold', mouth: 'fang' }), bojack: bojack({ pose: 'fold' }),
    salza: hench({ hair: 'salza', skin: 0x8ab8e8, skinD: 0x5a84c0, hairC: 0xf4f6fa, hairD: 0xb8c0d0, armor: true, pose: 'hips' }),
    dore: hench({ hair: 'dore', skin: 0x6ab84a, skinD: 0x3e8a2e, skinL: 0x9ad87a, armor: true, big: true, pose: 'hips' }),
    neiz: hench({ hair: 'neiz', skin: 0xf2c84a, skinD: 0xc0961a, armor: true, pose: 'hips', eyes: 'R' }),
    zangya: hench({ hair: 'zangya', skin: 0x7ab0e0, skinD: 0x4a7ab0, hairC: 0xf2902a, hairD: 0xb0561a, suitC: 0xf2ece0, suitD: 0xbcb4a0, vest: true, vestC: 0x8a4ab8, belt: 0xc82a2a, pose: 'hips', lips: 'm' }),
    bujin: hench({ hair: 'bujin', skin: 0xc8a0e8, skinD: 0x9a6ac0, hairC: 0xf6eef6, hairD: 0xd0a8d8, suitC: 0x3a3a5a, vest: true, vestC: 0x6a2a6a, belt: 0xf2c840, eyes: 'Y' }),
    bido: hench({ hair: 'bido', skin: 0x4aa878, skinD: 0x2a7a50, hairC: 0xd84a24, hairD: 0x8a2a14, suitC: 0x5a4a3a, vest: true, vestC: 0x8a5a2a, belt: 0x2a2a2a, big: true }),
    kogu: hench({ hair: 'kogu', skin: 0x8ac88a, skinD: 0x5a9a5a, hairC: 0x2a2a3a, hairD: 0x14141e, suitC: 0x2a3a5a, cape: true, capeC: 0x5a1a2a, sword: true, belt: 0xc8a040 }),
  };
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
// tournament of power: the null realm arena, the ring is the planet. TOP.dmg (0..1) breaks the floor, TOP.erase(u) empties that universe's stand
const TOP = { dmg: 0, erased: new Set(), UNI: [9, 10, 4, 3, 2, 6, 11, 7], erase(u) { this.erased.add(u); } };
const TOP_LOOK = { map: 'sq', tile: .19, tiles: [0x5e6078, 0x80849c, 0xa6aabe, 0xc8ccda, 0xe2e4ee, 0xf8f8fc], trim: [0x3a3e66, 0x50578a, 0x6c76b0, 0x96a2d6],
    bg: [0x0c0618, 0x1c0c34, 0x2e1450], neb: [0x3e1a6a, 0x5a2a8e, 0x8a4ac0], rock: [0x140c22, 0x2a1e40, 0x443660, 0x66568a], rim: 0xa898d8, star: [0xffffff, 0xd8c8ff] };   // a square tile grid in a deep purple void
const topTones = () => Object.assign({}, KAI, { grass: TOP_LOOK.tiles, road: TOP_LOOK.trim, stone: TOP_LOOK.tiles.slice(1, 5), leaf: TOP_LOOK.rock });
// the gods in the stands: [god skin, god clothes, angel skin, banner]
const TOP_GODS = { 9: [0x4a5a9a, 0xe0a040, 0x9ab8e8, 0x8a3a3a], 10: [0x9a9aa8, 0x6a3a9a, 0xa8c0f0, 0x3a7a5a], 4: [0xb8a49c, 0x3a6ac0, 0x8ab0e0, 0x8a6a2a], 3: [0x6a7080, 0x2a3a5a, 0x94b4e8, 0x2a5a8a],
  2: [0xf4c8d0, 0x6ab0e0, 0xf0d8f0, 0xb04a8a], 6: [0x9a6ad0, 0x222222, 0x9ab8e8, 0x5a5ab0], 11: [0xf0e0d8, 0x8a2a6a, 0xd0e0f0, 0xc04a2a], 7: [0x8a5ac8, 0xf0f0f0, 0x9ab8e8, 0x2a8ab8] };
const TOP_SPR = (() => {
  const oline = (G, pts, w0, w1, c) => { G.line(pts, w0 + 2, w1 + 2, 'o'); G.line(pts, w0, w1, c); };
  const arm = (G, pts, c, hand, w = 3) => { oline(G, pts, w, w - .4, c); const [x, y] = pts[pts.length - 1]; G.ell(x, y, 2.5, 2.5, 'o'); G.ell(x, y, 1.5, 1.5, hand); };
  const zeno = ZENO;
  // the grand priest: blue skin, tall white hair, an angel's halo round his neck, a long navy robe with a white panel and gold sash
  const priest = shapeSprite(16, 31, G => {
    G.rect(6, 0, 4, 2, 'h'); G.rect(5, 2, 6, 2, 'h');
    G.rect(5, 4, 6, 6, 's'); G.rect(4, 4, 1, 4, 'h'); G.rect(11, 4, 1, 4, 'h'); G.rect(5, 4, 6, 1, 'h');
    G.set(6, 7, 'k'); G.set(9, 7, 'k'); G.set(7, 5, 'c'); G.set(8, 5, 'c'); G.rect(7, 9, 2, 1, 'S');
    G.rect(7, 10, 2, 2, 's');
    G.rect(3, 13, 10, 15, 'r'); G.rect(2, 20, 12, 8, 'r'); G.rect(2, 14, 2, 6, 'r'); G.rect(12, 14, 2, 6, 'r');
    G.rect(7, 13, 2, 15, 'w'); G.rect(6, 13, 4, 1, 'w'); G.rect(3, 18, 10, 1, 'y'); G.rect(2, 27, 12, 1, 'w');
    G.rect(1, 19, 2, 2, 's'); G.rect(13, 19, 2, 2, 's');
    G.rect(3, 11, 10, 2, 'c');
    G.rect(4, 28, 3, 2, 'k'); G.rect(9, 28, 3, 2, 'k');
  }, { o: 0x0c1028, s: 0x6a9ae8, S: 0x3e64b0, h: 0xf4f4fa, H: 0xbcc0d4, r: 0x232a5e, R: 0x121638, w: 0xf0f0f6, W: 0xb8bcd0, c: 0x7ae0f4, C: 0x3a9ac4, k: 0x0c0c18, y: 0xf2c840, Y: 0xb08820 }, { s: 'S', h: 'H', r: 'R', w: 'W', c: 'C', y: 'Y' });
  // zeno's box: a gold-framed blue back panel on a white floating bowl, and a gold rail in front that hides their feet
  const BP = { o: 0x140c26, w: 0xf4f2f8, W: 0xb4aec8, y: 0xf2c840, Y: 0xa8801c, b: 0x34348e, B: 0x22225e, m: 0xd85ac0, M: 0x8a2a7c };
  const boxB = shapeSprite(64, 44, G => {
    G.rect(18, 0, 28, 2, 'y'); G.rect(10, 2, 44, 2, 'y'); G.rect(6, 4, 52, 4, 'y'); G.rect(4, 8, 56, 24, 'y');
    G.rect(20, 2, 24, 2, 'b'); G.rect(12, 4, 40, 4, 'b'); G.rect(7, 8, 50, 24, 'b'); G.rect(7, 8, 50, 1, 'B'); G.rect(56, 8, 1, 24, 'B');
    G.rect(30, 3, 4, 3, 'm'); G.rect(31, 4, 2, 1, 'M');
    for (const x of [12, 51]) { G.rect(x, 12, 1, 18, 'B'); }
    G.rect(0, 32, 64, 4, 'w'); G.rect(0, 32, 64, 1, 'y'); G.rect(4, 36, 56, 3, 'w'); G.rect(10, 39, 44, 2, 'w'); G.rect(18, 41, 28, 2, 'y'); G.rect(28, 43, 8, 1, 'y');
    for (let x = 8; x < 58; x += 8) G.rect(x, 37, 2, 1, 'y');
  }, BP, { w: 'W', y: 'Y', b: 'B', m: 'M' });
  const boxF = shapeSprite(64, 33, G => { G.rect(1, 27, 62, 2, 'y'); for (const x of [1, 31, 61]) G.rect(x, 26, 2, 6, 'y'); G.rect(3, 29, 58, 3, 'w'); G.rect(28, 29, 8, 2, 'm'); }, BP, { w: 'W', y: 'Y', m: 'M' });
  const plate = shapeSprite(22, 6, G => { G.rect(0, 0, 22, 2, 'w'); G.rect(2, 2, 18, 2, 'w'); G.rect(6, 4, 10, 1, 'y'); G.rect(0, 0, 22, 1, 'y'); }, BP, { w: 'W', y: 'Y' });
  return { zeno, priest, boxB, boxF, plate };
})();
const TRIP_WAIT = 120;   // seconds at home before a trip happens anyway, so slower players still see every world
const PLANET_EVERY = 1e6;   // the first trip to another world at 1M best power, then at 4x your best each time: namek, planet vegeta, snake way, beerus' planet, west city, kame house, mount paozu, the future, kami's lookout, the kais' world, yardrat, in turn
const WORLDS = [{ name: "king kai's planet", tones: KAI, sea: [0xe2a93a, 0xf3c55a, 0xf9dd8c, 0xfff2c8] }, { name: 'namek', tones: NAMEK, sea: [0x1e7a7a, 0x2fa59a, 0x6cd1bf, 0xc6f2e6] }, null /* planet vegeta: set with the newer worlds below */, { name: 'snake way', tones: KAI, sea: [0xc8642a, 0xe08a3a, 0xf4b45a, 0xfde0a0] }, { name: "beerus' planet", tones: BEERUSP, sea: [0x4a2a7a, 0x6a3ea0, 0x9a6ad0, 0xd8c0f0] }, { name: 'west city', tones: EARTH, sea: [0xd2dce8, 0xe6edf5, 0xf4f8fc, 0xffffff] }, { name: 'kame house', tones: KAMEP, sea: [0xd2dce8, 0xe6edf5, 0xf4f8fc, 0xffffff] }, { name: 'mount paozu', tones: PAOZU, sea: [0xd2dce8, 0xe6edf5, 0xf4f8fc, 0xffffff] }];
function useWorld(w) { for (const [k, v] of Object.entries(WORLDS[w].tones)) TONES[k].splice(0, TONES[k].length, ...v); }

// preview hooks (#raid, #snake, ...) jump straight to things for testing; on the live site they're ignored so nobody can cheat with them
const HASH = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\]|.*\.localhost|.*-git-.*\.vercel\.app)$/.test(location.hostname) ? location.hash : '';   // preview hooks only on dev hosts and branch previews, never on a live copy of the site
WORLDS[8] = { name: 'the future', tones: FUTURE, sea: [0x1e242c, 0x323a44, 0x4e5864, 0x7a8692] };
// planet vegeta's new look (world 2), kami's lookout, the supreme kai's world and yardrat (10–12): their residents, then each world's tones
const W2S = (() => {
const ln = (G, pts, w0, w1, c) => { G.line(pts, w0 + 1.4, w1 + 1.4, 'o'); G.line(pts, w0, w1, c); };   // a limb with its own outline, so it reads over the body
// mr. popo: white turban, big round eyes, red vest open over the chest, baggy white trousers, curled red shoes (blue skin, as the edited dub drew him)
const POPO = shapeSprite(18, 25, G => {
  G.ell(6.5, 20.4, 3.6, 2.8, 'w'); G.ell(11.5, 20.4, 3.6, 2.8, 'w');
  G.poly([[2, 24], [3.4, 22], [8, 22], [8, 24]], 'r'); G.poly([[10, 22], [14.6, 22], [16, 24], [10, 24]], 'r'); G.set(2, 23, 'r'); G.set(15, 23, 'r');
  G.ell(9, 15.4, 5, 4.2, 's');
  G.poly([[3.6, 12], [7.4, 12], [6.8, 19], [3.6, 18.4]], 'r'); G.poly([[14.4, 12], [10.6, 12], [11.2, 19], [14.4, 18.4]], 'r');
  G.rect(4, 18, 10, 1, 'y');
  ln(G, [[4.4, 13], [3.4, 16], [6.6, 17]], 2, 2, 's'); ln(G, [[13.6, 13], [14.6, 16], [11.4, 17]], 2, 2, 's'); G.rect(8, 16, 2, 2, 's');   // hands folded in front
  G.ell(9, 8.4, 4.4, 4, 's');
  G.ell(9, 3.8, 5, 3, 'w'); G.rect(5, 4, 8, 2, 'w'); G.rect(5, 5, 8, 1, 'W'); G.set(9, 1, 'W');
  G.rect(6, 8, 2, 2, 'w'); G.rect(10, 8, 2, 2, 'w'); G.set(7, 9, 'k'); G.set(10, 9, 'k'); G.rect(8, 11, 2, 1, 'm');
}, { o: 0x0e1024, s: 0x3a4ab8, S: 0x26307a, w: 0xf6f4ee, W: 0xc8c4b8, r: 0xd03030, R: 0x8e1e22, y: 0xf2c84a, Y: 0xb88a1a, k: 0x111111, m: 0xe87a7a }, { s: 'S', w: 'W', r: 'R', y: 'Y' });
const NP = { o: 0x0d2a12, g: 0x6cc94e, G: 0x3a8a34, w: 0xf6f4ee, W: 0xc8c4b8, v: 0x5a3aa8, V: 0x3a2478, k: 0x111111, m: 0x8a3a3a, n: 0x7a4a26, N: 0x4a2a14, y: 0xf2c84a, Y: 0xb88a1a, p: 0xe88aa8 };
const NS = { g: 'G', w: 'W', v: 'V', n: 'N', y: 'Y' };
// dende as the young guardian: antennae, big pointed ears, the white robe with kami's mark over a purple tunic, the guardian's staff
const DENDE = shapeSprite(16, 23, G => {
  G.line([[6.4, 4.6], [5.4, .6]], 1, 1, 'g'); G.line([[8.6, 4.6], [9.6, .6]], 1, 1, 'g');
  G.line([[14, 4], [14, 22]], 1, 1, 'n'); G.ell(14, 3.4, 1.4, 1.4, 'y');
  G.poly([[3, 12], [12, 12], [13.4, 21], [1.6, 21]], 'w'); G.rect(6, 12, 3, 9, 'v');
  G.rect(6, 13, 3, 1, 'w'); G.rect(7, 13, 1, 3, 'w');
  G.rect(3, 21, 4, 2, 'n'); G.rect(8, 21, 4, 2, 'n');
  ln(G, [[3.6, 13], [2.8, 16.4], [5, 18]], 1.8, 1.6, 'w'); ln(G, [[11.4, 13], [13.2, 14.6]], 1.8, 1.6, 'w'); G.set(14, 14, 'g'); G.set(13, 15, 'g');
  G.poly([[4.4, 7.4], [.6, 5.4], [4, 9.6]], 'g'); G.poly([[10.6, 7.4], [14.4, 5.4], [11, 9.6]], 'g'); G.set(2, 6, 'p'); G.set(12, 6, 'p');
  G.ell(7.5, 8, 3.6, 3.6, 'g');
  G.rect(5, 7, 2, 2, 'k'); G.rect(8, 7, 2, 2, 'k'); G.set(5, 7, 'w'); G.set(8, 7, 'w'); G.rect(7, 10, 2, 1, 'm');
}, NP, NS);
// the supreme kai: lilac skin, white mohawk, potara earrings, a navy tunic over light-blue sleeves, orange sash, baggy white trousers
const SHIN = shapeSprite(17, 26, G => {
  G.ell(6, 21.8, 2.8, 2.6, 'w'); G.ell(11, 21.8, 2.8, 2.6, 'w'); G.rect(3, 24, 4, 2, 'b'); G.rect(10, 24, 4, 2, 'b');
  G.poly([[4, 12.6], [13, 12.6], [13.6, 20.4], [3.4, 20.4]], 'n'); G.poly([[6.4, 12.6], [10.6, 12.6], [8.5, 15.4]], 'c');
  G.rect(4, 18, 9, 2, 'y'); G.poly([[9.6, 19.4], [11.4, 19.4], [11.6, 22.6], [10, 22]], 'y');
  ln(G, [[3.8, 13.6], [2.8, 17.4], [3.2, 19.4]], 2, 1.8, 'c'); G.ell(3.2, 20, 1.1, 1.1, 's');
  ln(G, [[13.2, 13.6], [14.2, 17.4], [13.8, 19.4]], 2, 1.8, 'c'); G.ell(13.8, 20, 1.1, 1.1, 's');
  G.poly([[5, 8], [2.2, 6.2], [5, 10.2]], 's'); G.poly([[12, 8], [14.8, 6.2], [12, 10.2]], 's');
  G.ell(8.5, 8.6, 3.8, 3.8, 's');
  G.set(3, 10, 'e'); G.set(3, 11, 'q'); G.set(13, 10, 'e'); G.set(13, 11, 'q');   // potara
  G.poly([[7, 5.6], [7.2, .6], [9.8, .6], [10, 5.6]], 'h');
  G.rect(6, 8, 2, 2, 'k'); G.rect(9, 8, 2, 2, 'k'); G.set(6, 8, 'w'); G.set(9, 8, 'w'); G.rect(8, 11, 2, 1, 'm');
}, { o: 0x140e24, s: 0xc0a2e8, S: 0x8a6ab8, h: 0xf8f8fc, H: 0xc8c8d8, n: 0x262c66, N: 0x161a40, c: 0x6ab0e8, C: 0x3a7ab8, y: 0xf08a24, Y: 0xb85a14, w: 0xf6f4ee, W: 0xc8c4b8, b: 0x2a3a8a, B: 0x1a2458, k: 0x111111, m: 0x7a3a6a, e: 0xf2d84a, q: 0x4ad86a }, { s: 'S', h: 'H', n: 'N', c: 'C', y: 'Y', w: 'W', b: 'B' });
// kibito: tall, pink-skinned, white hair tied back in a tail, crimson tunic with a blue sash, arms folded
const KIBITO = shapeSprite(17, 30, G => {
  G.poly([[4, 4], [12, 4], [13.6, 15], [11, 11], [6, 11], [3.4, 15]], 'h');
  G.poly([[3.6, 12.6], [12.4, 12.6], [12.8, 21.6], [3.2, 21.6]], 'r'); G.poly([[6.4, 12.6], [9.6, 12.6], [8, 15]], 'c');
  G.rect(3, 20, 10, 2, 'c');
  G.poly([[3.2, 21.6], [12.8, 21.6], [13.2, 26.6], [8.6, 26.6], [8, 24], [7.4, 26.6], [2.8, 26.6]], 'w');
  G.rect(3, 26, 4, 4, 'b'); G.rect(9, 26, 4, 4, 'b');
  G.line([[3.6, 14], [4.2, 17.4], [11.6, 17]], 2.4, 2.2, 'r'); G.line([[12.4, 14], [11.8, 17.4], [4.4, 17]], 2.4, 2.2, 'R'); G.set(11, 17, 's'); G.set(4, 17, 's');
  G.ell(8, 8, 3.4, 3.8, 's'); G.ell(8, 4.6, 3.8, 2.2, 'h'); G.rect(5, 5, 6, 1, 'h');
  G.rect(5, 7, 2, 1, 'k'); G.rect(9, 7, 2, 1, 'k'); G.set(6, 8, 'k'); G.set(9, 8, 'k'); G.rect(7, 10, 2, 1, 'm');
}, { o: 0x1a0e14, s: 0xf2a2a8, S: 0xc06a76, h: 0xf8f8fc, H: 0xc8c8d8, r: 0xb0303a, R: 0x701c24, c: 0x4a8ae0, C: 0x2a5aa8, w: 0xf6f4ee, W: 0xc8c4b8, b: 0x3a2a4a, B: 0x22182c, k: 0x111111, m: 0x8a2a3a }, { s: 'S', h: 'H', r: 'R', c: 'C', w: 'W', b: 'B' });
// king vegeta: flame hair with a widow's peak, a full beard, white armour and gold shoulder guards, the royal crest, a red cape
const KINGVEG = shapeSprite(22, 30, G => {
  G.poly([[5, 11.6], [17, 11.6], [20.4, 28], [1.6, 28]], 'r');
  G.line([[9, 21], [8.6, 26.4]], 3.2, 3, 'b'); G.line([[13, 21], [13.4, 26.4]], 3.2, 3, 'b'); G.rect(6, 26, 4, 3, 'w'); G.rect(12, 26, 4, 3, 'w');
  G.poly([[6.6, 12], [15.4, 12], [15, 20.6], [7, 20.6]], 'a'); G.rect(7, 19, 8, 2, 'y'); G.ell(11, 15.4, 1.8, 1.6, 'r'); G.set(11, 15, 'y');
  G.ell(5.8, 13, 3, 2.2, 'y'); G.ell(16.2, 13, 3, 2.2, 'y');
  ln(G, [[5, 14.6], [4.4, 18], [5.6, 20.4]], 2.4, 2.2, 'b'); G.ell(5.8, 21, 1.4, 1.4, 'w');
  ln(G, [[17, 14.6], [17.6, 18], [16.4, 20.4]], 2.4, 2.2, 'b'); G.ell(16.2, 21, 1.4, 1.4, 'w');
  G.ell(11, 8, 3.8, 3.8, 's');
  G.poly([[6.8, 7], [5.4, 2.4], [7.8, 3.8], [8.6, .2], [10.6, 2.6], [12.4, .2], [13.6, 3.6], [16.4, 2.2], [15.2, 7], [13.6, 5], [8.4, 5]], 'h'); G.poly([[9.4, 5], [12.6, 5], [11, 6.8]], 'h');
  G.poly([[7.2, 8.4], [7.8, 11.4], [11, 13], [14.2, 11.4], [14.8, 8.4], [13.2, 10.2], [8.8, 10.2]], 'h'); G.rect(9, 10, 4, 1, 'h');
  G.rect(8, 7, 2, 1, 'k'); G.rect(12, 7, 2, 1, 'k'); G.set(9, 8, 'k'); G.set(12, 8, 'k');
}, { o: 0x140c0c, s: 0xf0c49a, S: 0xc8946e, h: 0x2a1a14, H: 0x4a3226, r: 0xc02a2a, R: 0x7a1414, b: 0x232a5a, B: 0x141a3a, a: 0xf2f0ea, A: 0xbcb8b0, y: 0xd8b05a, Y: 0x9a7a3a, w: 0xf6f4ee, W: 0xc8c4b8, k: 0x111111 }, { s: 'S', h: 'H', r: 'R', b: 'B', a: 'A', y: 'Y', w: 'W' });
// yardratians: a bulbous ridged head with a knob on top, huge black eyes, a short body in a dark tunic; the elder has a long robe, whiskers and a staff
const yardrat = (elder, P) => shapeSprite(16, 21, G => {
  if (elder) { G.line([[14, 6], [14, 20.4]], 1, 1, 'd'); G.ell(14, 5.4, 1.4, 1.6, 'g'); G.poly([[3.4, 12], [11.6, 12], [13, 20], [2, 20]], 'v'); G.rect(4, 20, 3, 1, 'd'); G.rect(8, 20, 3, 1, 'd'); }
  else { G.poly([[4, 12], [11, 12], [11.8, 17.4], [3.2, 17.4]], 'v'); G.rect(4, 17, 2, 2, 's'); G.rect(9, 17, 2, 2, 's'); G.rect(3, 19, 4, 2, 'd'); G.rect(8, 19, 4, 2, 'd'); }
  G.rect(4, 12, 7, 1, 'c'); G.rect(7, 13, 1, 3, 'c');
  ln(G, [[3.6, 13], [2.6, 16]], 1.6, 1.4, 'v'); G.set(2, 16, 's'); G.set(2, 17, 's');
  if (elder) { ln(G, [[11.4, 13], [13.4, 14.4]], 1.6, 1.4, 'v'); G.set(13, 14, 's'); } else { ln(G, [[11.4, 13], [12.6, 16]], 1.6, 1.4, 'v'); G.set(12, 16, 's'); G.set(12, 17, 's'); }
  G.ell(7.5, 7, 5.4, 4.8, 's'); G.ell(7.5, 1.9, 1.6, 1.6, 's'); G.line([[3.6, 4.6], [3.4, 9.4]], 1, 1, 'S'); G.line([[11.4, 4.6], [11.6, 9.4]], 1, 1, 'S');
  G.set(5, 3, 'p'); G.set(10, 4, 'p'); G.set(9, 2, 'p');
  G.rect(5, 6, 2, 3, 'k'); G.rect(8, 6, 2, 3, 'k'); G.set(5, 6, 'w'); G.set(8, 6, 'w'); G.set(7, 10, 'm');
  if (elder) { G.line([[4, 9.6], [1.4, 12.4]], 1, 1, 'h'); G.line([[11, 9.6], [13.4, 11.4]], 1, 1, 'h'); }
}, P, { s: 'S', v: 'V', d: 'D' });
const YP = { o: 0x1a1428, s: 0xece4f4, S: 0xb4a6cc, p: 0xc088d8, v: 0x3a2a5a, V: 0x241a3a, c: 0xe8c860, d: 0x5a3a2a, D: 0x3a2418, g: 0x7ae0f4, k: 0x141020, w: 0xffffff, m: 0x8a5a9a, h: 0xffffff };
const YARD = yardrat(false, YP), YARD2 = yardrat(false, Object.assign({}, YP, { s: 0xf4e2d8, S: 0xc8a698, p: 0xe8907a, v: 0x2a4a5a, V: 0x18303c })), ELDER = yardrat(true, Object.assign({}, YP, { v: 0x6a2a4a, V: 0x441a30, c: 0xf2f2f2 }));
// the z sword, stuck fast in its rock
const ZSWORD = shapeSprite(14, 24, G => {
  G.poly([[5.4, 8], [8.6, 8], [8.6, 19], [7, 20.6], [5.4, 19]], 'b'); G.rect(5, 9, 1, 10, 'l');
  G.rect(3, 6, 8, 2, 'y'); G.rect(6, 2, 2, 4, 'g'); G.ell(7, 1.4, 1.4, 1.2, 'y');
  G.ell(7, 21, 6.4, 3, 'r'); G.ell(4.4, 19.4, 3, 2.2, 'r'); G.ell(10, 19.8, 2.6, 1.8, 'r'); G.set(4, 18, 'l'); G.set(9, 19, 'l');
}, { o: 0x1a1a24, b: 0xc8d4e4, B: 0x8494aa, l: 0xf4f8ff, y: 0xe8b830, Y: 0x9a7414, g: 0xa82a3a, G: 0x6a1622, r: 0x8a8478, R: 0x5a564e }, { b: 'B', y: 'Y', g: 'G', r: 'R' });
return { popo: POPO, dende: DENDE, shin: SHIN, kibito: KIBITO, king: KINGVEG, yard: YARD, yard2: YARD2, elder: ELDER, zsword: ZSWORD };
})();
// each world's tones, its cloud sea, how big the planet sits (zoom) and how high (dy, a fraction of the height); tones beyond the shared names (under, spot, ...) are read straight off the entry
const W2P = { gold: [0x8a5a10, 0xc08a1a, 0xe8b830, 0xffe07a], pink: [0x9a3a6a, 0xc85a8e, 0xe88ab0, 0xf8bcd4, 0xffe4ee] };
const W2L = {
  2: { sea: [0xa03a1c, 0xc85a2c, 0xe88a4a, 0xfcc080], zoom: 1.22, tones: { grass: [0x6a2414, 0x8a341c, 0xa84a26, 0xc46632, 0xdc8848, 0xf0b070], road: [0x4a3020, 0x6a4a34, 0x8a6a4e, 0xac8e70], dome: [0x8e8a8a, 0xb2aeae, 0xd2cece, 0xeceaea, 0xffffff], band: [0x9a7414, 0xc8961e, 0xe8bc3a, 0xffe08a], glass: [0x3a1418, 0x6a2028, 0xa83a3a, 0xe86a5a], stone: [0x4a2418, 0x6a3422, 0x8a4a30, 0xaa6644], leaf: [0x3a1612, 0x5a2218, 0x7a3220, 0x9a4a2c, 0xc06a40], trunk: [0x2a1410, 0x3a1c14, 0x4a2618, 0x5a3020] } },
  10: { sea: [0xd2dce8, 0xe6edf5, 0xf4f8fc, 0xffffff], zoom: .82, dy: -.07, tones: { grass: [0x8a92b0, 0xaab2cc, 0xc8cee2, 0xe2e6f2, 0xf4f6fc, 0xffffff], road: [0x5a6a9a, 0x7686b6, 0x96a4cc, 0xbac4e2], stone: [0x5a6a9a, 0x7686b6, 0x96a4cc, 0xbac4e2], under: [0x6a4a24, 0x8e6a38, 0xb08c50, 0xcaa86a, 0xe2c88e], dome: [0x9aa4b4, 0xc4ccd8, 0xe6eaf0, 0xf8fafc, 0xffffff], band: [0x2a3a8a, 0x3a52b0, 0x5a74d0, 0x8aa4ec], glass: [0x1c2a4a, 0x2a4070, 0x4a6aa0, 0x9ab8e0], leaf: [0x124a3a, 0x1c6a4a, 0x2a8a56, 0x48ac64, 0x84d080], trunk: [0x5a3a1c, 0x7a5228, 0x9a6c36, 0xbe8e4e] } },
  11: { sea: [0xd89ab8, 0xeab6cc, 0xf6d4e2, 0xfff0f6], flower: [0xff9ac8, 0xffffff], tones: { grass: [0x1e6a2a, 0x2c8a34, 0x44a840, 0x66c450, 0x92dc6e, 0xc4f09a], road: [0x9a7a4a, 0xb8986a, 0xd4b88a, 0xead6ae], leaf: [0x1a5a2a, 0x24783a, 0x34984a, 0x52b85a, 0x8ad87a], trunk: [0x5a3a24, 0x7a5232, 0x9a6c44, 0xbc8e5e], stone: [0x5a5a62, 0x7a7a84, 0x9e9ea6, 0xc4c4ca], pinkg: W2P.pink } },
  12: { sea: [0xc89ab8, 0xdab4cc, 0xeacede, 0xfaeaf2], tones: { grass: [0x8a7aa8, 0xa898c2, 0xc4b6da, 0xdcd0ec, 0xeee6f6, 0xfaf6fe], road: [0xc89ab0, 0xdcb4c6, 0xecd0dc, 0xf8e8f0], spot: [0x7a6a9a, 0x8e7eae, 0xa494c2, 0xbaaad6], leaf: [0x5a8ac8, 0x7aa6dc, 0x9ec2ee, 0xc4dcf8, 0xe8f2ff], trunk: [0x9a7aa8, 0xb496c2, 0xceb4da, 0xe6d2ee], dome: [0xa898b8, 0xc8b8d6, 0xe2d6ee, 0xf4eefa, 0xffffff], band: [0x6a5a8a, 0x8a7aaa, 0xaa9ac8, 0xcabce2], dot: [0xffffff, 0xfff0f8] } },
};
[[2, 'planet vegeta'], [10, "kami's lookout"], [11, "the supreme kai's world"], [12, 'yardrat']].forEach(([w, name]) => { const L = W2L[w]; L.T = Object.assign({}, KAI, Object.fromEntries(Object.entries(L.tones).filter(([n]) => n in KAI))); WORLDS[w] = { name, tones: L.T, sea: L.sea }; });
WORLDS[9] = { name: 'tournament of power', tones: topTones(), sea: TOP_LOOK.bg };
GAMES.push({
  id: 'planet',
  mount(st, ui) {
    const SAVE = 'hs-power';
    const S = { pl: 0, best: 0, boots: 0, partner: 0, gravity: 0, cloud: 0, scouter: 0, galick: 0, senzu: 0, house: 0, armor: 0, kaio: 0, bigbang: 0, piccolo: 0, chamber: 0, spirit: 0, world: 0, orbs7: 0, wishes: 0, granted: 0, ascend: 0, form: 0, seeds: 0, tree: {}, saga: 0, runBest: 0, uni: 0, uniStage: 0, multi: 0, multiT: 0, uniBest: 0, ustars: 0, mastery: 0, godki: 0, godTotal: 0, gods: 0, angel: {}, autoAt: 0, zeno: 0, formTop: 0, formTopName: '', movies: 0, souls: 0 };
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
    const ALL_FORMS = [
      { name: 'base', at: 0, x: 1, aura: [0xffffff, 0xbfe9ff, 0x6fb0ff] },
      { name: 'super saiyan', at: 2e4, x: 1.5, aura: [0xffffff, 0xfff8b0, 0xffe02e] },
      { name: 'super saiyan 2', at: 2e5, x: 2, aura: [0xffffff, 0xfff8b0, 0xffe02e], sparks: 0x9fdcff },
      { name: 'super saiyan 3', at: 2e6, x: 3, aura: [0xffffff, 0xfff8b0, 0xffd60a], sparks: 0x9fdcff },
      { name: 'super saiyan god', at: 2e7, x: 4, aura: [0xffd0c0, 0xff7a5a, 0xd8344a] },
      { name: 'super saiyan blue', at: 2e8, x: 6, aura: [0xffffff, 0x9fe6ff, 0x2f9ae0] },
      { name: 'ultra ego', at: 2e9, x: 8, aura: [0xe6d6ff, 0xa070f0, 0x4a1f9a], sparks: 0xc9a2ff },
      { name: 'super saiyan 4', at: 2e10, x: 12, aura: [0xffffff, 0xff9a8a, 0xc8302a], sparks: 0xffd0a0 },
      { name: 'ultra instinct', at: 2e11, x: 16, aura: [0xffffff, 0xd8e8ff, 0x8aa0c8], sparks: 0xffffff },
      // past ultra instinct each hero has his own canon forms; ladderOf sets where they sit
      { name: 'mastered ultra instinct', aura: [0xffffff, 0xeef2ff, 0xa8b4d0], sparks: 0xffffff },
      { name: 'super saiyan blue evolved', aura: [0xc8e8ff, 0x3a74d8, 0x122e78], sparks: 0x9fdcff },
      { name: 'beast', aura: [0xffffff, 0xe2d4ff, 0x8a4ae0], sparks: 0xf0e4ff },
      { name: 'true ultra ego', aura: [0xd8c0ff, 0x7a3ad0, 0x2a0a5a], sparks: 0xc9a2ff },
      { name: 'super saiyan rage', aura: [0xffffff, 0xfff4b0, 0x6ab8f0], sparks: 0xd8f2ff },
    ].map((f, i) => ({ ...f, i }));   // i: the hero sprite set
    const LATE_ACH = { 'mastered ultra instinct': 'f_mui', 'super saiyan blue evolved': 'f_ssbe', beast: 'f_beast', 'true ultra ego': 'f_tue', 'super saiyan rage': 'f_rage' };
    const UI_FORM = 8, MUI_FORM = 9, LATE_STEP = 1000, LATE = { vegeta: [10, 12], goku: [9], gohan: [11], trunks: [13] };
    // the first late form ×1000 past ultra instinct, every one after it (and every mastery star) ×1000 further
    const ladderOf = h => [...ALL_FORMS.slice(0, 9), ...(LATE[h] || LATE.vegeta).map((i, j) => ({ ...ALL_FORMS[i], at: 2e14 * LATE_STEP ** j, x: [24, 40][j] }))];
    let FORMS = ladderOf(S.hero);
    S.form = Math.min(S.form || 0, FORMS.length - 1);
    const save = () => { try { localStorage.setItem(SAVE, JSON.stringify(S)); } catch (_) {} };
    S.tail = S.tail || 0;
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
      tail: { base: 40000, k: 2.5, label: 'tail training', what: 'great ape: +8% size, +2s, +×0.25 (less past lv 10)', unlock: () => !!S.ach.ape },
      kaio: { base: 20000, k: 2.6, label: 'kaioken', what: 'red button: big boost, then tired', unlock: () => S.best >= 8000 },
      bigbang: { base: 60000, k: 2.5, label: 'big bang attack', what: 'double-tap: an exploding ki ball', unlock: () => S.best >= 20000 },
      piccolo: { base: 30000, k: 2.4, label: 'piccolo', what: '+60/s, zaps meteors', unlock: () => S.best >= 10000 },
      chamber: { base: 150000, k: 2.8, label: 'time chamber', what: 'a door appears: train ×2 for 15s inside', unlock: () => S.best >= 40000 },
      ascend: { base: 1e6, k: 1, label: 'ascend', what: 'reset for ki seeds', unlock: () => S.best >= 1e6 || treeOpen() },   // a wish of seeds or ranks opens the way to the tree before the first ascend
      godki: { base: 2e14, k: 1, label: 'god ki', what: 'reset for god ki', unlock: () => S.form >= MUI_FORM && godNow() > 0 },
      zeno: { base: 1, k: 1, label: 'zeno button', what: 'erase everything for zeno\'s favour', unlock: () => zenoReady() },
    };
    const RESETS = ['boots', 'partner', 'gravity', 'cloud', 'scouter', 'galick', 'senzu', 'house', 'armor', 'kaio', 'bigbang', 'piccolo', 'chamber', 'tail'];
    const cost = k => k === 'ascend' ? Math.max(1e6, Math.floor(S.pl)) : k === 'godki' ? Math.max(2e14, Math.floor(S.pl)) : k === 'zeno' ? 0 : Math.floor(SHOP[k].base * Math.pow(SHOP[k].k, S[k]) * (1 - .05 * lvl('deal')));   // ascending spends all you hold (1M at least), so that's its price
    // permanent: gravity ×1.15 a level, wishes ×1.25 each, ascensions +10% each; temporary boosts add up rather than multiply
    const KAIO = () => 1.25 + .25 * S.kaio;
    // milestones: levels 10, 25, 50 and 100 of a producer double its output, then every 50 levels after, forever
    const MILES = { boots: 1, partner: 1, house: 1, piccolo: 1 }, MS = [10, 25, 50, 100];
    const ms = k => 2 ** (MS.filter(n => S[k] >= n).length + Math.max(0, Math.floor((S[k] - 100) / 50))), nextMile = k => MS.find(n => S[k] < n) || 100 + 50 * (Math.floor((S[k] - 100) / 50) + 1);
    // the training tree: ki seeds from ascending buy ranks; every seed you've earned also boosts everything, spent or not
    const TREE = [
      { id: 'fist', branch: 'body', tier: 0, name: 'iron fist', what: 'taps +50% a rank', max: Infinity },
      { id: 'crit', branch: 'body', tier: 0, name: 'eagle eye', what: '+8% crit chance a rank', max: 5 },
      { id: 'legs', branch: 'body', tier: 1, name: 'road work', what: 'lap bonus +50% a rank', max: Infinity },
      { id: 'stride', branch: 'body', tier: 1, name: 'long stride', what: 'he runs 10% faster a rank: more laps', max: 5 },
      { id: 'brawl', branch: 'body', tier: 1, name: 'brawler', what: 'villain taps +50% a rank', max: Infinity },
      { id: 'critx', branch: 'body', tier: 2, name: 'pressure point', what: 'crits hit ×1 harder a rank', max: Infinity },
      { id: 'pride', branch: 'body', tier: 3, name: 'saiyan pride', what: 'combo goes to ×4', max: 1 },
      { id: 'idle', branch: 'spirit', tier: 0, name: 'meditation', what: 'idle income +50% a rank', max: Infinity },
      { id: 'beam', branch: 'spirit', tier: 0, name: 'ki control', what: 'beams +50% a rank', max: Infinity },
      { id: 'chamber', branch: 'spirit', tier: 1, name: 'patience', what: 'the chamber door comes 25% more often a rank', max: Infinity },
      { id: 'senzu', branch: 'spirit', tier: 1, name: 'senzu farmer', what: 'senzu beans last 5s longer a rank', max: Infinity },
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
    const ang = id => !!S.angel[id];
    const lvl = id => S.tree[id] || 0, rankCost = (n, r) => TIER_COST[n.tier] * 2 ** Math.floor(r / 5), nodeCost = n => rankCost(n, lvl(n.id)), nodeMax = n => n.max;   // uncapped nodes cost double every 5 ranks
    const branchPts = b => TREE.filter(n => n.branch === b).reduce((a, n) => a + lvl(n.id), 0), nodeOpen = n => branchPts(n.branch) >= TIER_NEED[n.tier];
    const SEED_SOFT = 10, SEED_EXP = .5, seedBoostOf = a => { const b = 1 + a * (.1 + .02 * lvl('seedx')); return b <= SEED_SOFT ? b : SEED_SOFT * (b / SEED_SOFT) ** SEED_EXP; };   // linear up to ×10, then the square root, so seed spam can't skip the walls
    const seedBoost = () => seedBoostOf(S.ascend), comboCap = () => lvl('pride') ? 4 : 2;
    const tapPower = () => 1 + S.boots * ms('boots') + passive() / 10;   // villain taps keep pace with idle builds
    const treeOpen = () => S.seeds > 0 || Object.values(S.tree || {}).some(v => v > 0);   // seeds to spend or ranks learned: the tree has something to show
    const seedsNow = () => Math.max(1, Math.floor(ang('divine') ? (S.pl / 1e4) ** .55 : Math.sqrt(S.pl / 1e4)));   // 1M → 10, 100M → 100, 10B → 1000
    // the multiverse: the tournament of power's universes in the order zeno erased them, then an endless ∞ remix. fixed walls, never scaled from your rate
    const LADDER = [
      { n: 9, name: 'universe 9', c: 0xc84a4a, f: ['bergamo', 'lavender', 'basil'] },
      { n: 10, name: 'universe 10', c: 0x58b848, f: ['obuni', 'murichim', 'rubalt'] },
      { n: 4, name: 'universe 4', c: 0x8a6ad0, f: ['ganos', 'caway', 'dercori'] },
      { n: 3, name: 'universe 3', c: 0x9aa6b8, f: ['anilaza', 'paparoni', 'koitsukai'] },
      { n: 2, name: 'universe 2', c: 0xf08ac0, f: ['ribrianne', 'rozie', 'kakunsa'] },
      { n: 6, name: 'universe 6', c: 0x48d0a8, f: ['kefla', 'caulifla', 'kale'] },
      { n: 11, name: 'universe 11', c: 0xe0473e, f: ['dyspo', 'toppo', 'jiren'] },
    ];
    const FIGHTERS = LADDER.flatMap(l => l.f), INF_TINT = [0x8a4ae0, 0xe8ecf4, 0xf2c84a];
    // ∞ remixes the 21 fighters: each fight picks from a harder universe, the last always from universe 11 or 6
    const uniFighter = (u, k) => u < LADDER.length ? LADDER[u].f[k] : LADDER[k === 2 ? 5 + (u + k) % 2 : (u * 3 + k * 5) % LADDER.length].f[(u + k * 2) % 3];
    const UNI_HP = 6e14, UNI_STEP = 20, UNI_STAGES = [.2, .45, 1], STAR_X = 1.5;
    const uniName = u => u < LADDER.length ? LADDER[u].name : 'universe ∞' + (u > LADDER.length ? ' ' + (u - LADDER.length + 1) : '');
    const uniBadge = u => u < LADDER.length ? 'U' + LADDER[u].n : 'U-INF' + (u > LADDER.length ? ' ' + (u - LADDER.length + 1) : ''), uniColour = u => u < LADDER.length ? LADDER[u].c : INF_TINT[u % INF_TINT.length];
    const uniHp = (u, k) => UNI_HP * UNI_STEP ** u * UNI_STAGES[k], uniTime = () => ang('skip') ? 45 : 30;
    const tints = new Map();
    const tint = (spr, c) => { const key = spr.col, m = tints.get(key) || tints.set(key, new Map()).get(key); if (!m.has(c)) { const col = spr.col.map(v => { if (v < 0 || ((v >> 16) + (v >> 8 & 255) + (v & 255)) < 90) return v; const mix = (s, k) => Math.round((v >> s & 255) * .6 + (c >> s & 255) * .4) << s; return mix(16) | mix(8) | mix(0); }); m.set(c, Object.assign({}, spr, { col })); } return m.get(c); };   // each universe's fighters wear its colour; outlines stay dark
    // god ki: the prestige above ascending, spent in the angels' tree; zeno: the one above that
    const FIGHTER_SPR = TOP_FIGHTERS;   // four takes per fighter: idle, two attacking or hit, powered up
    const home = () => S.multi ? 9 : 0;   // the arena is home for the rest of the run once the multiverse opens
    // the arena's stands empty as each universe is erased; its floor breaks up from none at universe 9 to most of it at 11, all of it in ∞
    const topSync = () => { TOP.erased = new Set(LADDER.slice(0, Math.min(S.uni, LADDER.length)).map(l => l.n)); TOP.dmg = S.uni >= LADDER.length ? 1 : .7 * S.uni / (LADDER.length - 1); if (S.world === 9) scenery(); };
    const fighterSpr = (key, c) => FIGHTER_SPR[key] || [key === 'jiren' ? VILLAINS.find(v => v.name === 'jiren').spr : tint(VILLAINS[[...key].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) % 9973, 7) % VILLAINS.length].spr, c)];
    const POWER_UP = {
      bergamo: 'bergamo soaked up every hit — he\'s grown huge!', lavender: 'lavender goes blind with rage and lunges!', basil: 'basil powers up: bulkier, pink fur, a red aura!',
      obuni: 'obuni shouts and fires a blue ki blast!', murichim: 'murichim\'s eyes glow — an orange aura!', rubalt: 'rubalt winds up a gold-aura punch!',
      ganos: 'ganos sheds his vest: max power!', caway: 'caway throws up both hands — energy bolts!', dercori: 'the lights go out — dercori looms in the dark!',
      anilaza: 'anilaza gathers a destruction burst!', paparoni: 'paparoni cackles and waves his cane!', koitsukai: 'koitsukai\'s eye turns red!',
      ribrianne: 'super ribrianne! butterfly wings and a love blast!', rozie: 'rozie throws up both arms — love hearts everywhere!', kakunsa: 'kakunsa rears up on her hind legs!',
      kefla: 'kefla goes super saiyan 2!', caulifla: 'caulifla charges a crush cannon!', kale: 'kale lunges to grab you!',
      dyspo: 'dyspo hits super maximum light speed mode!', toppo: 'toppo unleashes hakai!',
    };
    const ANGELS = [
      { id: 'divine', who: 'whis', tier: 0, cost: 1, name: 'divine seeds', what: 'ki seeds grow with power^0.55, not its square root' },
      { id: 'golden', who: 'whis', tier: 0, cost: 1, name: 'born golden', what: 'every ascension starts at super saiyan' },
      { id: 'staff', who: 'whis', tier: 1, cost: 2, name: "whis' staff", what: "whis' training is always on at beerus' planet" },
      { id: 'auto', who: 'whis', tier: 2, cost: 3, name: 'self-ascension', what: 'ascends on its own at the power you pick' },
      { id: 'notes', who: 'vados', tier: 0, cost: 1, name: "vados' notes", what: 'ascending keeps a tenth of every upgrade' },
      { id: 'skip', who: 'vados', tier: 0, cost: 1, name: 'time skip', what: 'universe fights last 45s, not 30' },
      { id: 'stars', who: 'vados', tier: 1, cost: 2, name: 'twin stars', what: 'universe stars count double' },
      { id: 'priest', who: 'vados', tier: 2, cost: 3, name: "grand priest's nod", what: 'every god ki reset pays double' },
    ];
    const AUTO_AT = [0, 1e9, 1e12, 1e15, 1e18, 1e21], GOD_X = 1, MASTERY_X = 1.25, ZENO_X = 1000, ZENO_GODS = 2;   // zeno shows up after this many god ki resets
    const godNow = () => Math.max(S.gods ? 0 : 1, S.uni) * (ang('priest') ? 2 : 1);   // one per universe cleared this cycle (the very first reset pays one regardless)
    const angelOpen = a => ANGELS.filter(x => x.who === a.who && ang(x.id)).length >= a.tier, zenoReady = () => S.gods >= ZENO_GODS;
    const godBoostOf = n => 1 + GOD_X * n;   // each god ki ever earned: +100% on everything, spent or not
    // the ki ceiling: gravity, wishes and seeds only push so far, then shrink to a small power. it rises with every minute in the multiverse and a little per universe cleared, so the walls set the late pace
    const CEIL0 = 20, CEIL_T = 1.08, CEIL_STEP = 2, CEIL_EXP = .15;   // the step counts your best universe this run, so god ki doesn't take it back
    const ceiling = () => CEIL0 * (S.multi ? CEIL_T ** Math.max(0, (session - S.multiT) / 60) : 1) * CEIL_STEP ** S.uniBest, capped = m => { const c = ceiling(); return m <= c ? m : c * (m / c) ** CEIL_EXP; };
    const lateBoost = () => STAR_X ** (S.ustars * (ang('stars') ? 2 : 1)) * MASTERY_X ** S.mastery * godBoostOf(S.godTotal) * ZENO_X ** S.zeno;
    const chamberLen = () => 15, chamberX = (lv = S.chamber) => 1.5 + .5 * lv;   // a fixed 15s visit: the shop raises what training inside pays, the tree brings the door round sooner
    const ECON = .35;   // every gain runs through mult(); an active player reaches super saiyan god in about half an hour
    const core = () => Math.pow(1.15, S.gravity) * Math.pow(1.25, S.wishes) * (1 + .05 * lvl('wish') * S.wishes) * seedBoost() * ECON;   // the engine the ki ceiling caps; forms sit outside it; shenron's favour adds per wish, compounding it snowballed
    // the great ape: tail training (shop) makes him bigger, longer and stronger; shenron's "bigger great ape" makes the next one a giant on top
    let ape = { cd: 0, rage: 0, giant: false, at: 0, k: 2.3 };
    const tailLv = () => S.tail <= 10 ? S.tail : 10 + 2 * Math.sqrt(S.tail - 10);   // tail training never ends; past lv 10 each level adds a little less
    const apeLen = () => 15 + 2 * tailLv() + (ape.giant ? 15 : 0), apeX = () => 2 + .25 * tailLv() + (ape.giant ? 1 : 0);   // apeX: his bonus on top of ×1
    const apeWant = () => 2.3 * (1 + .08 * tailLv()) * (ape.giant ? 1 + .5 * Math.min(1, (st.t - ape.at) / 1.2) : 1);
    const mult = (bare) => {   // permanent boosts multiply; temporary ones add their bonuses, so a pile of buffs can't explode
      const T = st.t, b = bare ? 1 : 1 + (carUntil > T) * .5 + (boostUntil > T) * 1 + (apeUntil > T) * apeX() + (senzuUntil > T) * .5 + (riding > 0) * .5 + (kaioUntil > T ? KAIO() - 1 : 0) + (dailyUntil > T) * .25 + (fuseUntil > T) * 1 + (fused && fused.until > T ? fused.x - 1 : 0) + (laughUntil > T) * .25 + (chamberUntil > T) * (chamberX() - 1) + (rageUntil > T) * (rage - 1) + (chiUntil > T) * .5 + (roshiUntil > T) * .5 + (calmUntil > T) * .25 + (gadgetUntil > T) * .5;
      return capped(core()) * FORMS[S.form].x * lateBoost() * b * (kaioUntil <= T && tiredUntil > T ? .75 : 1) * (bz && bz.awake ? .25 : 1);
    };
    const lapValue = () => 30 * (1 + S.boots * ms('boots'));
    const passive = () => (S.partner * 4 * ms('partner') + S.house * 40 * ms('house') + S.piccolo * 60 * ms('piccolo')) * (1 + .5 * lvl('idle')) * (wished('idle') ? 3 : 1) * (lvl('eternal') ? 3 : 1) * (S.krillinAlly ? 1.5 : 1);
    let laughUntil = 0, chamberUntil = 0, chamberT0 = 0, echo = null, door = null, nextDoor = 60, kai = null, nextKai = 50, greg = null, nextGreg = 70, ship = null, nextShip = 200, nextNappa = 0, car = null, nextCar = 140, carUntil = 0, poseUntil = 0, storm = null, nextStorm = 240, spirit = 0, spiritReady = false, spiritShot = null, struggle = null, yam = null, nextYam = 130, zap = null, nextZap = 4, ginyu = null, nextGinyu = 160;
    let gadgets = [], nextGadget = 2, robotUntil = 0, robotAcc = 0, autoAcc = 0, gadgetUntil = 0, bikeUntil = 0, calmUntil = 0, nextAndro = 340, date = null, nextDate = 300, gero = null, nextGero = 230, a16 = null, nextA16 = 180;
    let bz = null, pud = null;   // beerus asleep on his planet, and the pudding that calms him
    let wishBuff = {}, homeSince = 0, bangReady = 0, whisUntil = 0, whisReady = 0, chiUntil = 0, chiReady = 0, kameReady = 0, dance = null, fused = null, nextDance = 300, cling = null, nextCling = 200, preview = null, rage = 2, rageUntil = 0, roshiUntil = 0, roshi = null, nextRoshi = 200, kril = null, nextKril = 260, satan = null, zen = null;
    let dailyUntil = 0, fuseUntil = 0, fuseOffer = 0, nextFuse = 150, monkeyAt = null, kaioUntil = 0, tiredUntil = 0, kaioReady = 0, bang = null, blasts = [], lastTap = { t: -9, x: 0, y: 0 }, capsule = null, tour = null, nextTour = 45, namekUntil = 0;
    if (!(S.namekLeft > 0)) S.world = 0;   // namek is a visit; a visit in progress survives a reload
    let saibas = [], nextSaiba = 40, boss = null, nextBoss = 120, kis = [];
    let night = false, nightK = 0, shake = 0, moon = null, nextMoon = 150, apeUntil = 0, apeStep = 0, flashT = 0, senzuUntil = 0, combo = 1, lastClick = -9, charging = 0, beam = null, bean = null, nextBean = 30;
    function ascend() {
      // seeds grow with the square root of the power you give up; forms and trips start over from base
      const gainA = seedsNow(), keep = Math.floor(S.pl * .01 * lvl('head')); S.ascend += gainA; S.seeds += gainA; ach('ascend'); S.pl = keep; S.runBest = keep; S.namekAt = 0; S.foes = []; for (const r of RESETS) S[r] = ang('notes') ? Math.floor(S[r] * .1) : 0; S.form = ang('golden') ? 1 : 0; preview = null; ui.fx && ui.fx('form', S.form); scenery();
      ui.event(`ascended — +${gainA} ki seed${gainA > 1 ? 's' : ''} (×${seedBoost().toFixed(1)} on everything), back to ${FORMS[S.form].name}`, 4500); ui.fx && ui.fx('super'); save(); syncShop();
    }
    const dropUniBoss = () => { if (boss && boss.uni && !boss.dead) { boss.dead = boss.fled = true; boss.t1 = st.t; } };
    function godReset() {
      // god ki: ascending's big sister. seeds, the tree, forms and universes all go; wishes, sagas and mastery stars stay
      if (S.form < MUI_FORM || !godNow()) return; const g = godNow(); S.godki += g; S.godTotal += g; S.gods++; ach('godki');
      S.pl = 0; S.runBest = 0; S.namekAt = 0; S.foes = []; for (const r of RESETS) S[r] = 0; S.seeds = 0; S.ascend = 0; S.tree = {}; S.form = ang('golden') ? 1 : 0; S.uni = S.uniStage = S.ustars = 0; preview = null; dropUniBoss(); topSync(); ui.fx && ui.fx('form', S.form); scenery();
      ui.event(`whis: "ohoho, not bad." — +${g} god ki (×${fmtShort(godBoostOf(S.godTotal))} on everything). back to universe 9: spend god ki in menu → angels`, 5000); ui.fx && ui.fx('super'); flashT = 1; save(); syncShop();
      if (zenoReady()) setTimeout(() => ui.event('something tiny and very powerful is watching…', 3500), 5200);
    }
    // the zeno button: the whole universe is erased. only his favour survives (plus achievements and heroes)
    const ERASE = ['pl', 'granted', 'multi', 'multiT', 'uniBest', 'runBest', 'seeds', 'ascend', 'form', 'wishes', 'saga', 'uni', 'uniStage', 'ustars', 'mastery', 'godki', 'godTotal', 'gods', 'autoAt', 'orbs7', 'namekAt', 'trips'];
    function zenoErase() {
      if (!zenoReady()) return; const v = boss && !boss.dead ? boss.name : '';
      if (boss && !boss.dead) { boss.dead = boss.fled = true; boss.t1 = st.t; }
      for (const r of [...RESETS, ...ERASE]) S[r] = 0; S.tree = {}; S.angel = {}; S.foes = []; S.zeno++; zen = null; preview = null; nextBoss = 60; ach('zeno'); topSync();
      if (S.world) { travel(0); namekUntil = 0; }
      flashT = 1; shake = 1; ui.fx && ui.fx('form', S.form); ui.fx && ui.fx('super'); ui.sfx && ui.sfx('boom'); scenery();
      ui.event(v ? `zeno: "${v}? he's no fun." — ${v} is erased. then so is everything else. zeno's favour ×${fmtShort(ZENO_X ** S.zeno)}` : `zeno: "friend! let's play again!" — the whole universe is erased. zeno's favour ×${fmtShort(ZENO_X ** S.zeno)}`, 6000);
      setTimeout(() => ui.event('villains line up to meet zeno\'s friend — the sagas come 4× as often', 4000), 6200); save(); syncShop();
    }
    const tailAch = () => { for (const n of [10, 25, 50]) if (S.tail >= n) ach('tail' + n); };
    ui.onBuy(k => {
      const c = cost(k); if (S.pl < c) return;
      if (k === 'ascend') { ascend(); return; }
      if (k === 'godki') { godReset(); return; }
      if (k === 'zeno') { zenoErase(); return; }
      S.pl -= c; S[k]++; ui.fx && ui.fx('buy'); tailAch();
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
    const what = k => k === 'ascend' ? `reset for +${seedsNow()} ki seeds` : k === 'godki' ? `reset for +${godNow()} god ki` : k === 'zeno' ? `erase it all: zeno's favour ×${fmtShort(ZENO_X ** (S.zeno + 1))}` : MILES[k] && S[k] && nextMile(k) ? `${SHOP[k].what} · ×2 at lv ${nextMile(k)}${S[k] >= 100 ? ' (every 50)' : ''}` : k === 'chamber' && S.chamber ? `train ×${chamberX()} inside · next ×${chamberX(S.chamber + 1)}` : k === 'kaio' && S.kaio ? `×${KAIO()} for 15s, then ×0.75` : k === 'bigbang' && S.bigbang ? `blast radius +${S.bigbang * 25}%` : k === 'galick' && S.galick ? (S.galick === 4 ? `beam ×1.6 · next: ${kame() ? 'super kamehameha' : 'final flash'}` : S.galick >= 5 ? `beam ×1.6 (now ×${fmtShort(Math.round(1.6 ** S.galick))}) · full charge ×3` : 'beam ×1.6') : SHOP[k].what;
    const syncShop = () => ui.shop(Object.fromEntries(Object.keys(SHOP).filter(k => !SHOP[k].unlock || SHOP[k].unlock() || S[k] > 0 && k !== 'godki' && k !== 'zeno').map(k => [k, { cost: cost(k), level: k === 'ascend' ? S.ascend : k === 'godki' ? S.gods : S[k], label: SHOP[k].label, what: what(k), can: S.pl >= cost(k) && (k !== 'ascend' || S.best >= 1e6), open: k === 'ascend' && treeOpen(), special: k === 'ascend' || k === 'godki' || k === 'zeno' }])));

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
      dino(B, .3, 4.9, .75, .7, 0); dino(C, .36, 2.3, .83, .5, 0);   // half again as big as before, feet planted (no hop)
    }
    const slabs = [];                        // the future's skyscrapers: { b: base, t: top, w: half-width, seed }
    function scenery() {
      solids.length = 0; wcRoads.length = 0; slabs.length = 0;
      if (S.world === 9) return topScenery();
      if (S.world === 5) return westcityScenery();
      if (S.world === 6) return kameScenery();
      if (S.world === 8) return futureScenery();
      if (W2L[S.world]) return w2Scenery();
      const dome = (th, a, r) => { const s = capPt(th, a), door = V.norm(V.cross(s, V.cross(N, s))); solids.push({ c: s, r, kind: 'dome', s, door: V.mul(door, -1) }); for (let i = 1; i <= 5; i++) solids.push({ c: V.mul(s, 1 + r + .018 * i), r: .009, kind: 'trunk' }); solids.push({ c: V.mul(s, 1 + r + .11), r: .02, kind: 'knob' }); };
      const tree = (th, a, k = 1) => S.world ? ajissa(th, a, k) : kaiTree(th, a, k);
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

    // planet vegeta (2), the lookout, the kais' world and yardrat (10–12): props are spheres, residents are upright sprites
    let w2Res = [], w2Pole = false;   // residents { spr, c, flip, k, hop, blink: [spots], ph }; korin's tower under the lookout
    function shadeSpot(o, n, x, y) { const q = M3.apT(M, n), g = vnoise3(q[0] * o.f + o.seed, q[1] * o.f, q[2] * o.f); return g > .64 ? tone(o.pal2, light(n) + .25, x, y) : tone(o.pal, light(n) + (o.lift || 0), x, y); }   // a bulb with blotches
    function w2Scenery() {
      SHADE.spot = shadeSpot; w2Res = []; w2Pole = false;
      const T = W2L[S.world].tones, UP = [0, 1, 0];
      let sd = 31 + S.world * 7; const rnd = () => (sd = sd * 16807 % 2147483647) / 2147483647;
      const put = (c, r, kind, o) => solids.push(Object.assign({ c, r, kind }, o)), pal = (c, r, p, lift = 0) => put(c, r, 'pal', { pal: p, lift });
      const tan = s => { const t1 = V.norm(V.cross(s, N)); return [t1, V.cross(s, t1)]; };
      const res = (spr, th, a, o) => w2Res.push(Object.assign({ spr, c: capPt(th, a), ph: rnd() * 9 }, o));
      const dome = (th, a, r) => { const s = capPt(th, a); put(s, r, 'dome', { s, door: V.mul(V.norm(V.cross(s, V.cross(N, s))), -1) }); return s; };
      const rock = (th, a, r) => put(V.mul(capPt(th, a), 1 - r * .3), r, 'stone');
      const stack = (s, h, r0, r1, kind, p, dir = s) => { const n = Math.ceil(h / (Math.min(r0, r1) * .8)); for (let i = 0; i <= n; i++) { const f = i / n, c = V.add(s, dir, h * f), r = r0 + (r1 - r0) * f; p ? pal(c, r, p) : put(c, r, kind); } return V.add(s, dir, h); };   // a column of spheres, straight up from s unless dir says otherwise
      if (S.world === 2) {
        // planet vegeta: the king's palace in a ring of spires and gold-topped pillars, saiyan domes with antennae round the rim
        const city = (th, a, r) => { const s = dome(th, a, r); for (let i = 1; i <= 4; i++) put(V.mul(s, 1 + r + .018 * i), .009, 'trunk'); put(V.mul(s, 1 + r + .09), .018, 'knob'); };
        const s = dome(.3, 1.57, .3), [t1, t2] = tan(s); pal(V.mul(s, 1.3), .066, W2P.gold, .1);
        for (let i = 0; i < 6; i++) { const q = i / 6 * 6.283, b = V.norm(V.add(s, V.add(V.mul(t1, Math.cos(q)), t2, Math.sin(q)), .375)), top = stack(b, .45, .048, .024, 0, T.dome, s); pal(V.mul(top, 1.03), .03, [0x6a1010, 0x9a1c1c, 0xd03030, 0xff6a5a], .1); }
        for (let i = 0; i < 8; i++) { const a = 2.4 + i * .7; pal(V.mul(capPt(.62, a), 1.06), .02, W2P.gold, .2); stack(capPt(.62, a), .06, .022, .02, 0, T.dome); }
        res(W2S.king, .42, 4.71, { k: 1.1 }); city(1.1, .4, .12); city(1.1, 2.75, .12); city(.95, 5.6, .1);
      }
      if (S.world === 10) {
        // kami's lookout: the palace dome and its six pointed turrets, a few palms, and the banded bulb tapering to a gold tip underneath
        const palm = (th, a, k = 1, lean = 0) => { const s = capPt(th, a), [t1, t2] = tan(s);
          for (let i = 1; i <= 8; i++) { const f = i / 8; put(V.add(V.mul(s, 1 + .34 * k * f), t1, lean * .1 * k * f * f), (.028 - .008 * f) * k, 'trunk'); }
          const C = V.add(V.mul(s, 1 + .36 * k), t1, lean * .1 * k); put(C, .045 * k, 'leaf');
          for (let j = 0; j < 6; j++) { const d = V.add(V.mul(t1, Math.cos(j * 1.05 + .3)), t2, Math.sin(j * 1.05 + .3)); for (let m = 1; m <= 4; m++) put(V.add(V.add(C, d, .055 * m * k), s, (.02 * m - .014 * m * m) * k), (.042 - .006 * m) * k, 'leaf'); } };
        const s = dome(.3, 1.57, .22), [t1, t2] = tan(s); pal(V.mul(s, 1.22), .044, W2P.gold, .1); pal(V.mul(s, 1.28), .02, W2P.gold, .2);
        for (let i = 0; i < 6; i++) { const q = i / 6 * 6.283 + .4, b = V.norm(V.add(s, V.add(V.mul(t1, Math.cos(q)), t2, Math.sin(q)), .253)), top = stack(b, .2, .037, .031, 0, T.dome); pal(V.mul(top, 1.026), .042, T.band, .1); pal(V.mul(top, 1.07), .022, T.band, .2); pal(V.mul(top, 1.1), .011, T.band, .3); }
        [[.98, .2], [1.08, .13], [1.17, .085], [1.25, .055], [1.31, .035]].forEach(([d, r], i) => pal(V.mul(UP, -d), r, T.under, (i & 1) * .12 - .04)); pal(V.mul(UP, -1.36), .03, W2P.gold, .2);
        res(W2S.dende, .5, 4.35, { flip: 1 }); res(W2S.popo, .5, 5.05, { flip: 2 });
        palm(.82, .3, .85, .5); palm(.82, 2.85, .85, -.5); palm(.86, 3.72, .8, -.3); palm(.86, 5.68, .8, .3); w2Pole = true;
      }
      if (S.world === 11) {
        // the kais' sacred world: the great tree, two mushroom trees, the z sword stuck in its hill
        const s = capPt(.95, 2.45), [t1, t2] = tan(s); for (let i = 0; i <= 9; i++) put(V.mul(s, 1 + .055 * i), .07 - .004 * i, 'trunk');
        for (const d of [1, -1]) for (let i = 1; i <= 3; i++) put(V.add(V.mul(s, 1 + .32 + .05 * i), t1, d * .05 * i), .028, 'trunk');
        const C = V.mul(s, 1.62); put(C, .2, 'leaf'); for (let j = 0; j < 7; j++) { const q = j * .9; put(V.add(V.add(V.add(C, t1, Math.cos(q) * .19), t2, Math.sin(q) * .19), s, -.03), .12 + .03 * (j % 3), 'leaf'); } put(V.mul(s, 1.82), .14, 'leaf');
        const mush = (th, a, k, p) => { const s = capPt(th, a), [t1, t2] = tan(s), top = stack(s, .3 * k, .024 * k, .02 * k, 'trunk'); pal(V.mul(top, 1.01), .075 * k, p, .05);
          for (let j = 0; j < 7; j++) { const q = j * .9; pal(V.add(V.add(V.mul(top, 1 - .015 * k), t1, Math.cos(q) * .07 * k), t2, Math.sin(q) * .07 * k), .05 * k, p, -.05); } };
        for (let i = 0; i < 6; i++) rock(.42 + (rnd() - .5) * .13, 4.15 + (rnd() - .5) * .27, .09 * (.5 + rnd() * .4));
        put(V.mul(capPt(.42, 4.15), 1.018), .072, 'stone'); w2Res.push({ spr: W2S.zsword, c: V.mul(capPt(.42, 4.15), 1.095), ph: 0 });
        res(W2S.shin, .45, 4.85, { flip: 1 }); res(W2S.kibito, .4, 5.55, { flip: 1 }); mush(.95, .5, .9, T.pinkg); mush(1.15, 1.1, .7, T.leaf); rock(.6, 3.6, .05);
      }
      if (S.world === 12) {
        // yardrat: onion-domed huts, spotted bulbs on curling stems; the elder meditates while the others blink between spots
        const bulb = (th, a, k) => { const s = capPt(th, a), [t1] = tan(s), curl = (rnd() - .5) * .16; let c = s;
          for (let i = 1; i <= 7; i++) { const f = i / 7; c = V.add(V.mul(s, 1 + .32 * k * f), t1, curl * k * Math.sin(f * 2.4)); put(c, (.024 - .008 * f) * k, 'trunk'); }
          put(V.mul(c, 1 + .05 * k), .07 * k, 'spot', { pal: T.leaf, pal2: T.dot, f: 26, seed: rnd() * 50 });
          for (const d of [-1, 1]) put(V.add(V.mul(s, 1 + .14 * k), t1, d * .06 * k), .03 * k, 'spot', { pal: T.leaf, pal2: T.dot, f: 30, seed: rnd() * 50 }); };
        const hut = (th, a, r) => { const s = dome(th, a, r); stack(V.mul(s, 1 + r * .75), r * .7, r * .62, r * .1, 0, T.dome); pal(V.mul(s, 1 + r * 1.55), r * .12, T.band, .2); };   // an onion dome
        const folk = (spr, spots, o) => w2Res.push(Object.assign({ spr, blink: spots.map(([th, a]) => capPt(th, a)), ph: rnd() * 3, hop: 3 }, o));
        hut(.55, 1.0, .16); hut(.5, 2.3, .14); hut(.9, 1.65, .12); bulb(.9, .4, .9); bulb(.85, 3.0, .8); bulb(.7, 5.8, .7);
        folk(W2S.elder, [[.3, 4.71], [.3, 4.71]], { hop: 0 }); folk(W2S.yard, [[.45, 5.5], [.15, 1.0]], { flip: 1 }); folk(W2S.yard2, [[.5, 3.95], [.15, 2.2]], {});
      }
    }
    // the ground: vegeta's cracked red rock and gold forecourt, the lookout's ringed tiles over its banded underside, kai meadows, spotted yardrat soil
    function shadeW2(nb, dn, lum, x, y) {
      const T = W2L[S.world].tones, u = V.dot(nb, E1), w = V.dot(nb, E2), road = Math.abs(dn) < .07;
      const patch = vnoise3(nb[0] * 3 + 9, nb[1] * 3, nb[2] * 3), f = vnoise3(nb[0] * 24, nb[1] * 24 + 4, nb[2] * 24);
      if (S.world === 2) {
        if (road) return tone(T.road, lum + .2 - (Math.floor(Math.atan2(w, u) * 20) & 1) * .06, x, y);
        if (dn > .8) { const ga = u * 14, gb = w * 14; return ga - Math.floor(ga) < .08 || gb - Math.floor(gb) < .08 ? tone(T.road, lum - .1, x, y) : tone(T.band, lum + .15, x, y); }
        if (Math.abs(vnoise3(nb[0] * 7 + 2, nb[1] * 7, nb[2] * 7) - .5) < .018) return tone(T.stone, lum - .15, x, y);   // cracks
        if (f > .9 && lum > .45) return tone(T.grass, lum + .3, x, y);
        return tone(T.grass, lum + (patch - .5) * .3, x, y);
      }
      if (S.world === 10) {
        // the platform is the cap round N, so its rim is a tilted ellipse; everything below it is the inverted dome, banded in rings that follow the rim
        if (dn < .55) return dn > .52 ? tone(W2P.gold, lum + .2, x, y) : tone(T.under, lum - .1 + (Math.floor((.52 - dn) * 10) & 1) * .14, x, y);
        if (dn < .57) return tone(T.grass, lum + .45, x, y);
        const a = Math.acos(Math.min(1, dn)) * 1.2, ga = a * 7, gb = (Math.atan2(w, u) + 3.1416) / 6.2832 * (8 + Math.floor(a * 7) * 4), fa = ga - Math.floor(ga), fb = gb - Math.floor(gb);
        if (fa < .08 || fb < .08) return tone(T.stone, lum + .1, x, y);
        if (Math.floor(ga) % 3 === 2) return tone(T.stone, lum + .3, x, y);
        return tone(T.grass, lum + ((Math.floor(ga) + Math.floor(gb)) & 1 ? .06 : -.02) + (f - .5) * .08, x, y);
      }
      if (S.world === 11) {
        if (road) return tone(T.road, lum + .15 + (f - .5) * .2, x, y);
        if (f > .88 && lum > .35) return W2L[11].flower[f > .93 ? 0 : 1];
        if (patch > .68) return tone(T.pinkg, lum + (patch - .5) * .2, x, y);
        return tone(T.grass, lum + (patch - .5) * .25, x, y);
      }
      if (road) return tone(T.road, lum + .2 + (f - .5) * .15, x, y);
      const g = vnoise3(nb[0] * 8 + 1, nb[1] * 8, nb[2] * 8 + 5);
      if (g > .64) return tone(T.spot, lum + (g > .67 ? .15 : -.3), x, y);   // soft spots with a dark rim
      if (f > .9 && lum > .4) return T.dot[0];
      return tone(T.grass, lum + (patch - .5) * .25, x, y);
    }
    // residents stand up on the cap; a yardratian fades out in a shimmer of light and steps in somewhere else
    const POLE = [0x7a4a2a, 0xa86a3a, 0xcc8e52, 0xe8b880], POLE_RING = [0x8a1a12, 0xb82a1c, 0xe0503a, 0xf88a6a];
    function drawW2(t, dt) {
      if (w2Pole) { const y0 = Math.round(cy + R * .98 + st.bob), hw = Math.max(3, Math.round(R * .07));   // korin's tower, running down into the clouds behind everything
        for (let y = y0; y < st.H; y++) for (let dx = -hw; dx <= hw; dx++) { const x = Math.round(cx) + dx, k = y * st.W + x; if (x < 0 || x >= st.W || zb[k] > -1e8) continue;
          const l = .62 - dx / hw * .4, ring = (y - y0) % 26 < 3; st.buf[k] = PK(Math.abs(dx) === hw ? 0x3a2014 : tone(ring ? POLE_RING : POLE, l, x, y)); } }
      for (const r of w2Res) {
        let c = r.c, vis = 1;
        if (r.blink) { const per = 4.2, q = t / per + r.ph, f = (q % 1) * per; c = r.blink[Math.floor(q) % r.blink.length]; vis = Math.min(1, f / .4, (per - f) / .4); }
        const p = M3.ap(M, c); if (p[2] <= .05) continue;
        const x = cx + p[0] * R, y = cy - p[1] * R + st.bob, k = r.k || 1, hop = r.hop && vis >= 1 ? Math.abs(Math.sin(t * r.hop + r.ph * 3)) * 1.5 : 0;
        if (vis > .45) blitZ(r.spr, x, y, standAng(p), r.flip === 2 ? Math.floor(t / 3 + r.ph) % 2 === 0 : !!r.flip, hop, p[2] * R + 6, k);
        if (vis < 1) for (let i = -4; i <= 4; i++) { const h = r.spr.h * k * (1.15 - Math.abs(i) / 6); for (let j = 0; j < h; j++) if (h2(i * 13 + Math.floor(t * 24), j * 7 + i) < (1 - vis) * .8) st.px(x + i * 1.5, y - j, (j + i) % 3 ? 0xbff6ff : 0xffffff, .85); }   // instant transmission
      }
      if (S.world === 12 && Math.random() < dt * 4) { const a = Math.random() * 6.28, rr = R * Math.sqrt(Math.random()); fx.add({ x: cx + Math.cos(a) * rr, y: cy + st.bob + Math.sin(a) * rr, vx: 0, vy: -8, life: 1.4, s: 1, c: [0xffffff, 0xbff6ff], raw: true }); }   // a faint shimmer in the air
    }
    let R = 40, cx = 0, cy = 0, zb = null, ib = null, dm = null;
    function layout() {
      const wide = st.W / st.H >= 1.15, fcx = +(st.el.closest('[data-cx]')?.dataset.cx || (wide ? .56 : .5));
      R = Math.round(st.W / st.H < .8 ? Math.min(st.W * .34, st.H * .22) : wide ? Math.min(st.W * .19, st.H * .3) : Math.min(st.W * .28, st.H * .24));
      cx = Math.round(st.W * fcx); cy = Math.round(st.H * (wide ? .5 : st.W / st.H < .8 ? .5 : .55));/*widget*/ if (WIDGET) { R = Math.max(56, Math.min(70, Math.round(Math.min(st.W, st.H) * .2))); cy = Math.round(st.H * .5); }   // the widget: the planet at the site's size against the sprites (56-70px, as on phones and desktops), with room round it/*/widget*/
      { const lk = W2L[S.world]; if (lk) { R = Math.round(R * (lk.zoom || 1)); cy += Math.round(st.H * (lk.dy || 0)); } }   // some worlds sit the planet bigger, smaller or higher
      zb = new Float32Array(st.W * st.H); ib = new Uint16Array(st.W * st.H); dm = new Uint8Array(st.W * st.H);
    }
    // view rotation (drag to spin) with inertia, and a slow automatic turn
    let M = M3.I(), vrx = 0, vry = 0, drag = null, idleT = 99;
    // each world idles round its own axis at its own pace: a small tilt off the road's pole keeps the road in view; the lookout turns upright over korin's tower
    const AUTO_SPIN = .06;   // radians a second
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
      if (roll < .3) { senzuUntil = st.t + 15 + 5 * lvl('senzu'); ui.event(`capsule: senzu beans — ×1.5 for ${15 + 5 * lvl('senzu')}s`); }
      else if (roll < .6) { const g = wrate() * 150; gain(g, c.x, c.y - 8, true); ui.event('capsule: +' + fmtShort(Math.round(g))); }
      else if (roll < .82) { S.orbs7++; if (S.orbs7 >= 7) { S.orbs7 = 0; summon(); } else ui.event(`capsule: a dragon ball! ${S.orbs7}/7`); goal('ball'); }
      else { S.aura = 1 + (((S.aura || 0) + (Math.random() * 3 | 0)) % AURAS.length); ui.event('capsule: a new aura colour'); }
      save();
    }
    function onClick(px, py) {
      if (!playing) return;
      if (S.world === 3 && snk) { snakeTap(px, py); return; }
      if (dance && !dance.done) { const b = dance.beats[dance.i]; if (b !== undefined && dance.spoil !== dance.i) { if (Math.abs(st.t - b) < .32) { dance.hits++; dance.ok = st.t; dance.i++; } else if (st.t > b - .8) dance.spoil = dance.i; } return; }   // the dance takes every tap; tapping just before a beat spoils it, so mashing fails
      if (movie) { px = movieX(px); if (movieTap(px, py)) return; }
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
      if (zen && zen.sx !== undefined && Math.hypot(px - zen.sx, py - (zen.sy - 9)) < 13) { ui.sfx && ui.sfx('coin'); ui.event('zeno: "want to push my button? it\'s fun!"'); ui.zeno && ui.zeno(); return; }
      if (satan && satan.sx !== undefined && st.t > satan.t0 && Math.hypot(px - satan.sx, py - (satan.sy - 10)) < 13) { gain(satan.prize, satan.sx, satan.sy - 20, true); ach('satan'); ui.event(`hercule cash prize! +${fmtShort(Math.round(satan.prize))} — "keep it between us, kid"`, 3500); ui.sfx && ui.sfx('coin'); burst(satan.sx, satan.sy - 12, [0xffffff, 0xf2c84a, 0xb88a1a], 18, 120); satan = null; return; }
      if (door && door.sx !== undefined && Math.hypot(px - door.sx, py - (door.sy - 9)) < 13) { chamberT0 = st.t; chamberUntil = st.t + chamberLen(); ach('chamber'); ui.event(`hyperbolic time chamber — time slows, training ×${chamberX()} for ${chamberLen()}s`); flashT = 1; ui.sfx && ui.sfx('form'); door = null; return; }
      if (ginyu && !ginyu.done) for (const m of ginyu.members) if (!m.dead && Math.abs(px - m.x) < (m.spr.w / 2 + 2) * m.k && py > m.y - (m.spr.h + 2) * m.k && py < m.y + 3) { combo = st.t - lastClick < .6 ? Math.min(comboCap(), combo + .1) : 1; lastClick = st.t; ginyuHit(m, tapPower() * mult() * combo * 6 * (1 + .5 * lvl('fist')) * (1 + .5 * lvl('brawl'))); ui.sfx && ui.sfx('hit'); return; }
      if (capsule && Math.hypot(px - capsule.x, py - capsule.y) < 11) { openCapsule(); return; }
      if (star && Math.hypot(px - star.x, py - star.y) < 13) {
        boostUntil = st.t + 15; S.stars = (S.stars || 0) + 1; if (S.stars >= 25) ach('stars25'); gain(Math.max(50, wrate() * 20), star.x, star.y - 6, true); ui.event('space pod caught — ×2 for 15s'); goal('star'); ui.fx && ui.fx('star');
        for (let k = 0; k < 24; k++) fx.add({ x: star.x, y: star.y, vx: (Math.random() - .5) * 120, vy: (Math.random() - .5) * 120, drag: 2.5, life: .7, c: [0xffffff, 0xffd84a, 0xff8a3a], raw: true });
        star = null; return;
      }
      for (const m of meteors) if (!m.dead && m.delay <= 0 && Math.hypot(px - m.x, py - m.y) < 15) { m.dead = true; goal('meteor'); gain(25 * mult() * (1 + Math.min(laps, 50) * .1), m.x, m.y - 6, true); for (let k = 0; k < 16; k++) fx.add({ x: m.x, y: m.y, vx: (Math.random() - .5) * 110, vy: (Math.random() - .5) * 110, drag: 2.5, life: .6, c: [0xffffff, 0xffb35a, 0xe0473e, 0x6c6f7c], raw: true }); return; }
      // anywhere else: train — a sprint burst and a few points
      if (moon && moon.a > .3 && !moon.leaving && Math.hypot(px - moon.x, py - moon.y) < moon.r + 6) {
        ape = { cd: 0, rage: 0, giant: !!S.bigApe, at: st.t, k: 2.3 }; S.bigApe = 0; apeUntil = st.t + apeLen(); moon.leaving = true; ach('ape'); if (ape.giant) ach('giantape'); flashT = 1; shake = .8; ui.event(`${ape.giant ? 'a giant great ape' : 'great ape mode'} — ×${1 + apeX()}${ape.giant || S.tail ? ', tap to ' + (ape.giant ? 'stomp' : 'build rage') : ''}`); ui.fx && ui.fx('super');
        for (let k = 0; k < 80; k++) { const q = kidScreen(20); fx.add({ x: q.x, y: q.y, vx: (Math.random() - .5) * 220, vy: (Math.random() - .5) * 220, drag: 2, life: 1, c: [0xffffff, 0xffd0a0, 0x7a4a2a], raw: true }); }
        return;
      }
      // senzu bean on the planet
      for (const sb of saibas) if (!sb.dead && sb.sx !== undefined && Math.hypot(px - sb.sx, py - (sb.sy - 6)) < 9) { killSaiba(sb); return; }
      if (boss && !boss.dead && Math.abs(px - boss.x) < (boss.spr.w / 2 + 3) * boss.k && py > boss.y - (boss.spr.h + 2) * boss.k && py < boss.y + 4) { combo = st.t - lastClick < .6 ? Math.min(comboCap(), combo + .1) : 1; lastClick = st.t; hitBoss(tapPower() * mult() * combo * 6 * (1 + .5 * lvl('fist')) * (1 + .5 * lvl('brawl')), px, py); return; }
      if (bean && bean.sx !== undefined && Math.hypot(px - bean.sx, py - (bean.sy - 6)) < 13) { senzuUntil = st.t + 15 + 5 * lvl('senzu'); ui.event(`senzu bean — ×1.5 for ${15 + 5 * lvl('senzu')}s`); for (let k = 0; k < 18; k++) fx.add({ x: bean.sx, y: bean.sy, vx: (Math.random() - .5) * 100, vy: (Math.random() - .5) * 100, drag: 3, life: .6, c: [0xffffff, 0xb8f08a, 0x4fae3a], raw: true }); bean = null; return; }
      if (apeTap(px, py)) return;   // the ape takes the taps that would have trained
      // train: rhythm builds a combo up to ×2; the scouter adds crits
      combo = wished('combo') ? comboCap() : st.t - lastClick < .6 ? Math.min(comboCap(), combo + .1) : 1; lastClick = st.t; if (combo >= 2) goal('combo');
      sprint = Math.min(1.2, sprint + .5);
      if (bz && !bz.awake) bz.noise += whisUntil > st.t ? .08 : .04;
      if (jumpH <= 0) jumpV = 120;
      const crit = wished('crit') || Math.random() < S.scouter * .1 + lvl('crit') * .08, k = kidScreen(14);
      gain((1 + S.boots * ms('boots')) * mult() * combo * (crit ? 2 + lvl('critx') : 1) * (1 + .5 * lvl('fist')) * (wished('taps') ? 3 : 1), k.x, k.y - 10, crit); ui.sfx && ui.sfx('tap');
      if (crit) for (let i = 0; i < 10; i++) fx.add({ x: k.x, y: k.y - 14, vx: (Math.random() - .5) * 90, vy: -20 - Math.random() * 60, drag: 2, life: .5, c: [0xffffff, 0x9cf0b8, 0x34d873], raw: true });
      ui.bump();
    }
    st.cv.addEventListener('pointerdown', e => { const [bx, by] = st.toBuf(e); if (playing && S.world === 3 && snk) { snakeTap(bx, by); return; }   // snake way acts on the press: no drag, beam charge or double-tap to swallow it
      drag = { x: e.clientX, y: e.clientY, moved: 0, t: st.t, ax: bx, ay: by }; try { st.cv.setPointerCapture(e.pointerId); } catch (_) {} });
    st.cv.addEventListener('pointermove', e => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
      if (charging > 0) { const [px, py] = st.toBuf(e); drag.ax = px; drag.ay = py; return; }
      if (drag.moved > 6) { st.cv.style.cursor = 'default'; const k = 1.1 / (R * st.scale); vry = dx * k * 30; vrx = dy * k * 30; M = M3.ortho(M3.mul(M3.mul(M3.rx(dy * k), M3.ry(dx * k)), M)); idleT = 0; }
    });
    st.cv.addEventListener('pointerup', e => {
      if (drag && charging > .15) fireBeam(charging, drag.ax, drag.ay); else if (drag && drag.moved <= 6) { const [px, py] = st.toBuf(e); tap(px, py); } charging = 0; drag = null; st.cv.style.cursor = 'default'; });
    st.cv.addEventListener('pointercancel', () => { drag = null; charging = 0; });
    function fireBeam(c, tx, ty) {
      if (S.world === 3) return;
      if (bz && !bz.awake) bz.noise += .35;   // a beam is loud
      if (a16 && st.t < a16.until - 1) { a16.until = st.t + 1; ui.event('16: "please… the birds." he walks off'); }
      if (struggle) { struggle.p += .12 * c; return; }   // a charged beam shoves the struggle
      if (movie) tx = movieX(tx);
      const k = handPos(); let dx = tx - k.x, dy = ty - k.y, dl = Math.hypot(dx, dy);
      if (dl < 4) { dx = Math.sin(k.ang); dy = -Math.cos(k.ang); dl = 1; }
      const dir = [dx / dl, dy / dl];
      beam = { t0: st.t, c, x: k.x, y: k.y, dx: dir[0], dy: dir[1], z: kidScreen().v[2] * (R + 12) }; ui.sfx && ui.sfx('beam'); shake = Math.max(shake, .2 + c * .15);
      if (star) { const rx = star.x - k.x, ry = star.y - k.y; if (rx * dir[0] + ry * dir[1] > 0 && Math.abs(rx * dir[1] - ry * dir[0]) < 8 + c * 3) onClick(star.x, star.y); }
      if (c >= 2.4) goal('beam');
      const ff = S.galick >= 5 && c >= 2.4; beam.ff = ff; beam.full = c >= 2.4; if (ff) ach('flash');   // galick lv 5: a full charge fires a final flash
      const pts = Math.pow(1.6, S.galick) * lapValue() * 2.5 * c * mult() * (ff ? 3 : 1) * (1 + .5 * lvl('beam'));   // each level hits ×1.6 harder
      const onLine = (x, y, w) => { const rx = x - k.x, ry = y - k.y; return rx * dir[0] + ry * dir[1] > 0 && Math.abs(rx * dir[1] - ry * dir[0]) < w + c * 3 * (ff ? 2 : 1) * (1 + .15 * (S.galick - 1)); };
      for (const sb of saibas) if (!sb.dead && sb.sx !== undefined && onLine(sb.sx, sb.sy - 6, 7)) killSaiba(sb);
      if (ginyu && !ginyu.done) for (const m of ginyu.members) if (!m.dead && onLine(m.x, m.y - m.spr.h / 2 * m.k, m.spr.w / 2 * m.k)) ginyuHit(m, pts * 2);
      if (movie) movieBeam(onLine, pts);
      if (boss && !boss.dead && onLine(boss.x, boss.y - boss.spr.h / 2 * boss.k, boss.spr.w / 2 * boss.k)) hitBoss(pts * 4, boss.x, boss.y - boss.spr.h / 2 * boss.k);
      gain(pts, k.x, k.y - 16, true); ui.fx && ui.fx('buy');
      for (const m of meteors) { if (m.dead || m.delay > 0) continue; const rx = m.x - k.x, ry = m.y - k.y, along = rx * dir[0] + ry * dir[1], off = Math.abs(rx * dir[1] - ry * dir[0]); if (along > 0 && off < 6 + c * 3) { m.dead = true; goal('meteor'); gain(25 * mult() * (1 + Math.min(laps, 50) * .1), m.x, m.y - 6, true); } }
    }
    st.cv.style.cursor = 'default';

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
      S.form++; victory(); if (!preview) { if (S.form >= 1) ach('ss'); if (S.form >= UI_FORM) ach('ui'); if (S.form >= MUI_FORM) ach('mui'); if (LATE_ACH[FORMS[S.form].name]) ach(LATE_ACH[FORMS[S.form].name]); if (S.form > S.formTop) { S.formTop = S.form; S.formTopName = FORMS[S.form].name; } } const F = FORMS[S.form]; ui.sfx && ui.sfx('form'); ui.event(F.name + '!  ×' + F.x + (preview ? ' — a taste, for 60s' : '')); ui.fx && ui.fx('form', S.form); flashT = 1;
      for (let k = 0; k < 90; k++) { const q = kidScreen(10); fx.add({ x: q.x, y: q.y, vx: (Math.random() - .5) * 200, vy: (Math.random() - .5) * 200, drag: 2, life: 1.1, c: F.aura, raw: true }); }
      save();
    }
    // the spirit bomb: energy gathers into a ball above him; once full, tap it to throw
    function spiritPos() { const kd = kidScreen(), up = liftNow + 34 + spirit * 10 + (apeUntil > st.t ? APE[0].h * 2.3 : 0); return { x: kd.x + Math.sin(kd.ang) * up, y: kd.y - Math.cos(kd.ang) * up, r: 2 + spirit * 9 * Math.max(1, R / 60) }; }   // over the great ape's head while he's one
    function throwSpirit() {
      const from = spiritPos(), m = ginyu && !ginyu.done && ginyu.members.find(x => !x.dead);
      const to = boss && !boss.dead ? { x: boss.x, y: boss.y - boss.spr.h / 2 * boss.k } : m ? { x: m.x, y: m.y - m.spr.h / 2 * m.k } : { x: cx, y: cy - R * 1.5 };
      spiritShot = { x0: from.x, y0: from.y, x1: to.x, y1: to.y, r: from.r, t0: st.t }; spirit = 0; spiritReady = false; ach('spirit'); ui.sfx && ui.sfx('beam');
    }
    const finisher = () => boss.uni ? Math.min(boss.hp, boss.max * .25) / (1 + .5 * S.armor) : boss.hp / (1 + .5 * S.armor) + 1;   // a universe's wall takes a quarter from a spirit bomb or a won struggle, never the lot
    function spiritBlast(x, y) {
      ui.sfx && ui.sfx('boom'); flashT = 1; shake = 1; blasts.push({ x, y, r: R * 1.1, t0: st.t });
      for (const sb of saibas) if (!sb.dead && sb.sx !== undefined) killSaiba(sb);
      for (const m of meteors) if (!m.dead) { m.dead = true; goal('meteor'); }
      if (ginyu && !ginyu.done) for (const m of ginyu.members) if (!m.dead) ginyuHit(m, m.hp + 1);
      if (movie) movieBlast(x, y, 1e9, Infinity);
      if (boss && !boss.dead) hitBoss(finisher(), x, y);
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
      gain(Math.pow(1.6, Math.max(1, S.galick)) * lapValue() * 6.25 * mult() * (1 + .5 * lvl('beam')) * (1.1 + .1 * S.bigbang), x, y - 10, true);   // a bit more than a full-charge beam (its cooldown is about a beam's charge time); what it hits pays on top
      for (const sb of saibas) if (!sb.dead && sb.sx !== undefined && Math.hypot(sb.sx - x, sb.sy - 6 - y) < r + 6) killSaiba(sb);
      for (const m of meteors) if (!m.dead && m.delay <= 0 && Math.hypot(m.x - x, m.y - y) < r + 4) { m.dead = true; goal('meteor'); gain(25 * mult() * (1 + Math.min(laps, 50) * .1), m.x, m.y - 6, true); }
      if (ginyu && !ginyu.done) for (const m of ginyu.members) if (!m.dead && Math.hypot(m.x - x, m.y - m.spr.h / 2 * m.k - y) < r + 6) ginyuHit(m, Math.max(rate(), lapValue() * mult()) * 8 * S.bigbang);
      if (movie) movieBlast(x, y, r, Math.max(rate(), lapValue() * mult()) * 8 * S.bigbang);
      if (boss && !boss.dead && Math.hypot(boss.x - x, boss.y - boss.spr.h / 2 * boss.k - y) < r + boss.spr.w / 2 * boss.k) hitBoss(Math.max(rate(), lapValue() * mult()) * 12 * S.bigbang, x, y);
      if (star && Math.hypot(star.x - x, star.y - y) < r) onClick(star.x, star.y);
      burst(x, y, [0xffffff, 0xbfe9ff, 0x6fb0ff, 0x2f6ae0], 36, 220);
    }
    const WORLD_ACH = { 1: 'namek', 6: 'kame', 7: 'paozu', 8: 'future', 10: 'lookout', 11: 'kaiworld', 12: 'yardrat' };
    function travel(w) {
      ui.hell && ui.hell(false);
      if (!playing) return;
      S.world = w; useWorld(w); layout(); scenery(); ui.world && ui.world(w);/*widget*/ if (w) ui.notify('trip', WORLDS[w].name);/*/widget*/
      flashT = 1; shake = .5; const q = handPos(); burst(q.x, q.y, [0xffffff, 0xdfe6e8, 0x9adada], 40, 220);
      ui.event(['back on king kai\'s planet', 'a space pod takes you to namek for 45 seconds — dragon balls ×2', 'a space pod takes you to planet vegeta for 45 seconds — the moon is always full', 'knocked into other world — run snake way back to king kai!', 'a space pod takes you to beerus\' planet — he\'s asleep. laps pay ×3 here, but every tap makes noise', 'capsule corp, west city — bulma is handing out gadgets: tap the capsules', 'kame house — master roshi\'s little island, out in the open sea', 'a space pod drops you on mount paozu — goku\'s home, deep in dinosaur country', 'a time machine drops you in trunks\' future — the city is in ruins and the androids are still out there', 'back in the null realm — the tournament of power goes on', 'kami\'s lookout — mr. popo keeps the tiles swept, high above the clouds', 'the sacred world of the kais — the supreme kai is expecting you', 'yardrat — the locals keep blinking in and out of sight'][w], w >= 3 ? 6000 : 2600); save(); syncShop();
      if (WORLD_ACH[w]) ach(WORLD_ACH[w]);
      if (w === 2) { ach('vegeta'); nextMoon = 3; if (!boss) nextNappa = 6; }
      if (w === 3) { startSnake(); meteors = []; storm = null; moon = null; } else snk = null;   // no meteors or full moon over snake way and HFIL
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
      if (boss.movie && movieGuard(dmg, x, y)) return;
      boss.hp -= dmg * (1 + .5 * S.armor); boss.flash = .12; boss.hitT = st.t; ui.sfx && ui.sfx('hit'); burst(x, y, [0xffffff, 0xffe08a, 0xff9a3c], 6, 70);
      if (boss.hp <= 0 && !boss.dead) {
        boss.dead = true; boss.t1 = st.t; S.bosses = (S.bosses || 0) + 1; goal('boss'); if (tour) tour.ko += 10; capsule = { x: boss.x, y: boss.y - boss.spr.h / 2 * boss.k, vy: -40, t0: st.t, land: cy - R * .3 }; let prize = boss.uni ? wrate() * 15 : Math.max(boss.movie ? 0 : boss.max * 1.5, wrate() * 90) * (1 + .5 * lvl('bounty'));   // a universe fight pays little: its star is the prize
        if (boss.uni) {   // a stage of the universe ladder; its last fight pays a universe star
          if (++S.uniStage >= UNI_STAGES.length) { const u = S.uni; S.uniStage = 0; S.uni++; S.ustars++; S.uniBest = Math.max(S.uniBest, S.uni); topSync(); ach('universe'); if (S.uni >= LADDER.length) ach('multiverse'); if (u < LADDER.length) ach('u' + LADDER[u].n); for (const n of [1, 5, 10]) if (u === LADDER.length + n - 1) ach('inf' + n); setTimeout(() => ui.event(`${uniName(u)} cleared — a universe star: ×${STAR_X ** (ang('stars') ? 2 : 1)} on everything. next: ${uniName(S.uni)}`, 4500), 2600); }
        }
        if (boss.saga) { prize *= 2; S.saga++; if (lvl('saga')) { S.seeds++; S.ascend++; setTimeout(() => ui.event('legend — the villain drops a ki seed'), 5200); } if (S.saga >= VILLAINS.length) ach('sagas'); satan = { c: capPt(.42, 2.9), t0: st.t + 1.2, until: st.t + 9, prize: prize * .5 }; setTimeout(() => ui.event('mr. satan: "i did it! it was all me!" — tap him for the prize money', 4500), 2800); }
        victory(); S.beaten = S.beaten || {}; S.beaten[boss.name] = 1; S.foes = [...new Set([...(S.foes || []), boss.name])]; if (S.bosses >= 10) ach('villains10'); if (boss.name === 'frieza') ach('frieza'); if (boss.name === 'nappa' && S.world === 2) ach('nappa'); if (boss.name === 'cell') ach('cell'); if (boss.name === 'beerus') ach('beerus'); if (['frieza', 'cell', 'kid buu', 'beerus'].every(n => S.beaten[n])) ach('all4'); gain(prize, boss.x, boss.y - (boss.spr.h + 10) * boss.k, true); ui.event(boss.name === 'past vegeta' ? `you beat your younger self — technically you also lost. +${fmtShort(Math.round(prize))}` : `${boss.name} defeated — +${fmtShort(Math.round(prize))}`); ui.fx && ui.fx('star'); shake = .7; flashT = .8;
        for (let k = 0; k < 4; k++) burst(boss.x + (Math.random() - .5) * 20, boss.y - boss.spr.h / 2 * boss.k + (Math.random() - .5) * 20, [0xffffff, 0xffe08a, 0xff9a3c, 0xe0473e], 20, 180);
        save();
      }
    }
    // ── movie raids: now and then cooler, janemba or bojack drops in, each with his own entrance and gimmicks
    let movie = null, nextMovie = 480, lastMovie = '', movieForce = '', movieNote = null;
    const MV = {
      cooler: { hp: [16, 34], minions: ['salza', 'dore', 'neiz'], nova: 14, intro: "cooler's armoured squadron drops in — beat salza, dore and neiz, then stop his supernova", win: 'cooler: "impossible… not again"' },
      janemba: { hp: [70, 0], jelly: true, split: true, flip: true, intro: 'reality turns to jelly — janemba! he splits in two and space flips as he does', win: 'janemba bursts like a bubble — the world sets back to normal' },
      bojack: { hp: [55, 20], earth: true, minions: ['zangya', 'bujin', 'bido', 'kogu'], web: true, intro: "bojack's gang drags the fight to earth — and bujin's psychic web is up: tap him or fire a beam", win: 'bojack and his gang are sealed away again' },
    };
    const MV_ACH = { cooler: 'coolerdown', janemba: 'unwarped', bojack: 'sealed' };
    // janemba's jelly world: candy-pink ground, mint roads, gummy trees
    const JELLY = Object.assign({}, KAI, {
      grass: [0xb83a8a, 0xd8569e, 0xf07ab8, 0xff9ccc, 0xffc0de, 0xffe2f0], road: [0x5ac8a8, 0x7ae0c0, 0xa6f2d8, 0xdafff0],
      dome: [0x7a4ac8, 0x9a6ae0, 0xb890f0, 0xd6b8ff, 0xf0e2ff], band: [0xe0a020, 0xf2c040, 0xffdc6a, 0xfff2b0],
      leaf: [0x2a9a3a, 0x48c050, 0x78e070, 0xa8f498, 0xdaffc8], trunk: [0xc82a3a, 0xf6f0f0, 0xc82a3a, 0xf6f0f0], stone: [0x6a3a9a, 0x8a5ab8, 0xac80d8, 0xd0b0f2], glass: [0x2a8ae0, 0x5ab0f2, 0x9ad6ff, 0xdaf2ff],
    });
    const recolour = P => { for (const [k, v] of Object.entries(P)) TONES[k].splice(0, TONES[k].length, ...v); };
    const fitSpot = (spr, k, x, y) => ({ x: Math.max((spr.w / 2 + 2) * k + 3, Math.min(st.W - (spr.w / 2 + 2) * k - 3, x)), y: Math.max(spr.h * k + 18, Math.min(st.H * .8, y)) });
    function startMovie(who, t) {
      const o = MV[who], arm = 1 + .5 * S.armor, dps = (tapPower() * mult(true) * 6 * 4 * 1.5 * (1 + .5 * lvl('fist')) * (1 + .5 * lvl('brawl')) + (S.bigbang ? Math.max(wrate(), lapValue() * mult(true)) * 12 * S.bigbang / 2.5 : 0)) * arm, hp = Math.max(600, wrate() * 26, dps * o.hp[0]), mh = Math.max(150, wrate() * 5, dps * o.hp[1]);   // sized to how hard you hit, so the fight lasts about a minute; prizes stay on wrate
      boss = { name: who, spr: MOVIE[who], hp, max: hp, t0: t, until: t + 90, x: 0, y: 0, k: 1, flash: 0, nextKi: 1, movie: who, struggled: true };   // no beam struggle: it would skip the gimmicks
      movie = { who, o, boss, t0: t, wob: o.jelly ? t + 1.6 : 0, minions: (o.minions || []).map((n, i, a) => ({ name: n, spr: MOVIE[n], hp: mh, max: mh, i, n: a.length, pos: 'row', k: 1, flash: 0, dead: false })), nextSay: 0, flipUntil: 0, flips: 0, web: null, nextWeb: t + 5, nova: null };
      if (o.jelly || o.earth) { recolour(o.jelly ? JELLY : EARTH); document.body.classList.add(o.jelly ? 'jelly' : 'earth'); }
      lastMovie = who; krillinHit(who); ui.sfx && ui.sfx('boss'); shake = .5; ui.event(o.intro, 5000);
    }
    function endMovie() { if (movie.o.jelly || movie.o.earth) { useWorld(S.world || 0); document.body.classList.remove('jelly', 'earth'); } movie = null; }
    const say = (s, t) => { if (t > movie.nextSay) { movie.nextSay = t + 4; ui.event(s); } };
    // true when a hit on the movie villain is turned away
    function movieGuard(dmg, x, y) {
      const m = movie; if (!m || boss !== m.boss) return false;
      const deflect = s => { burst(x, y, [0xffffff, 0xd8c8ff, 0x8a6ad8], 5, 60); say(s, st.t); return true; };
      if (m.o.minions && m.minions.some(h => !h.dead)) return deflect(m.who === 'cooler' ? 'cooler: "my squadron will deal with you" — take them out first' : 'bojack just laughs behind his gang — beat them first');
      if (m.twin && !m.twin.dead && boss.hp - dmg * (1 + .5 * S.armor) <= 0) { boss.hp = 1; boss.flash = .12; return deflect('his other half holds him together — beat the double first'); }
      return false;
    }
    function movieHit(h, dmg) {
      if (h.dead) return; h.hp -= dmg * (1 + .5 * S.armor); h.flash = .12; burst(h.x, h.y - 10, [0xffffff, 0xffe08a, 0xff9a3c], 5, 60);
      if (h.hp > 0) return;
      h.dead = true; burst(h.x, h.y - 10, [0xffffff, 0xffe08a, 0xe0473e], 16, 140); if (h.name === 'bujin') movie.web = null;
      gain(Math.max(100, wrate() * (h.pos === 'twin' ? 20 : 5)), h.x, h.y - h.spr.h * h.k - 6, true);   // a fixed handful of goons, so these can't be farmed
      if (h.pos === 'twin') ui.event('one janemba down — the real one is open');
      else if (movie.minions.every(x => x.dead)) ui.event(movie.who === 'cooler' ? 'cooler: "useless. i\'ll do it myself"' : 'the gang is down — bojack steps up');
    }
    const breakWeb = s => { movie.web = null; movie.nextWeb = st.t + 9; ui.event(s); const h = handPos(); burst(h.x, h.y, [0xffffff, 0xff9af0, 0x9ae84a], 14, 120); };
    function movieTap(px, py) {   // true when the tap was used up here
      const m = movie; if (!m || m.over) return false;
      if (m.flipUntil > st.t) burst(px, py, [0xf0d0ff, 0xa66ae0], 5, 40);   // shows where a mirrored tap really lands
      for (const h of m.minions) if (!h.dead && h.x !== undefined && Math.abs(px - h.x) < (h.spr.w / 2 + 2) * h.k && py > h.y - (h.spr.h + 2) * h.k && py < h.y + 3) {
        combo = st.t - lastClick < .6 ? Math.min(comboCap(), combo + .1) : 1; lastClick = st.t; movieHit(h, tapPower() * mult() * combo * 6 * (1 + .5 * lvl('fist')) * (1 + .5 * lvl('brawl'))); ui.sfx && ui.sfx('hit');
        if (m.web && h.name === 'bujin' && ++m.web.hits >= 3) breakWeb('you tore through the psychic web'); return true;
      }
      if (m.web) { floats.push({ x: px, y: py - 6, s: 'webbed!', life: .7 }); return true; }   // stuck: taps don't train until the web breaks
      return false;
    }
    const movieX = px => movie && movie.flipUntil > st.t ? st.W - px : px;
    function movieBeam(onLine, pts) { const m = movie; if (!m || m.over) return; if (m.web) breakWeb('your beam burns through the psychic web'); for (const h of m.minions) if (!h.dead && h.x !== undefined && onLine(h.x, h.y - h.spr.h / 2 * h.k, h.spr.w / 2 * h.k)) movieHit(h, pts * 2); }
    function movieBlast(x, y, r, dmg) { if (!movie || movie.over) return; for (const h of movie.minions) if (!h.dead && h.x !== undefined && Math.hypot(h.x - x, h.y - h.spr.h / 2 * h.k - y) < r + 6) movieHit(h, dmg); }
    function movieTick(t, dt) {
      const m = movie, o = m.o, b = m.boss;
      if (boss !== b) { endMovie(); return; }
      if (b.dead) {
        if (!m.over) { m.over = t; m.web = null; m.flipUntil = 0; for (const h of m.minions) h.dead = true;
          if (!b.fled) { const g = Math.max(500, wrate() * 70) * (1 + .5 * lvl('bounty')); gain(g, cx, cy - R * 1.3, true); ach(MV_ACH[m.who]); S.movies++; if (Object.values(MV_ACH).every(id => S.ach[id])) ach('movies3'); movieNote = { at: t + 2.4, s: `${o.win} — movie bonus +${fmtShort(Math.round(g))}` }; } }
        return;
      }
      // cooler: once his squadron is down he raises a supernova; it drops when its time runs out
      if (o.nova && !m.nova && t > m.t0 + 2 && m.minions.every(h => h.dead)) { m.nova = { t0: t, t1: t + o.nova }; b.until = Math.max(b.until, t + o.nova + 2); ui.event(`cooler raises a supernova — ${o.nova}s to bring him down`, 3500); }
      if (m.nova && t > m.nova.t1) { flashT = 1; shake = 1; tiredUntil = Math.max(tiredUntil, t + 8); blasts.push({ x: cx, y: cy - R * .6, r: R * 1.2, t0: t }); ui.sfx && ui.sfx('boom'); ui.event('SUPERNOVA — you\'re knocked flat. tired ×0.75 for 8s, and cooler leaves you for dead', 4000); b.dead = true; b.fled = true; b.t1 = t; return; }
      // janemba: splits in two at half health
      if (o.split && !m.twin && b.hp < b.max * .5) { const hp = b.max * .35; m.twin = { name: 'janemba', spr: b.spr, hp, max: hp, i: 0, n: 1, pos: 'twin', k: 1, flash: 0, dead: false }; m.minions.push(m.twin); m.wob = t + 1; shake = .5; ui.event('janemba splits in two! the real one won\'t fall while his double stands', 3500); }
      // janemba: twists space at 75/50/25%, taps land mirrored for a few seconds
      if (o.flip && m.flips < 3 && b.hp < b.max * (.75 - .25 * m.flips)) { m.flips++; m.flipUntil = t + 6; m.wob = t + .8; ui.event('janemba twists space — left is right for 6s: hit his reflection', 3500); }
      // bojack: bujin's psychic web sticks your taps until it breaks
      if (o.web && !m.web && t > m.nextWeb && m.minions.some(h => h.name === 'bujin' && !h.dead) && t - m.t0 > 3) { m.web = { t0: t, hits: 0 }; ui.event("bujin's psychic web! your taps are stuck — tap bujin three times or fire a beam", 3500); }
      if (m.web && t - m.web.t0 > 10) breakWeb('the web frays and lets go');
    }
    function movieFx(t) {
      const m = movie; if (m.over) return '';
      if (m.nova) return `supernova ${Math.max(0, Math.ceil(m.nova.t1 - t))}s`;
      if (m.web) return 'psychic web — tap bujin';
      if (m.flipUntil > t) return `mirrored ${Math.ceil(m.flipUntil - t)}s`;
      const left = m.minions.filter(h => !h.dead && h.pos === 'row').length;
      return left ? `${left} to go before ${m.who}` : `${m.who} ${Math.ceil(m.boss.until - t)}s`;
    }
    const mvBlit = (spr, x, y, k, flip, white, a = 1) => { for (let j = 0; j < spr.h; j++) for (let i = 0; i < spr.w; i++) { const c = spr.col[j * spr.w + (flip ? spr.w - 1 - i : i)]; if (c < 0) continue; for (let yy = 0; yy < k; yy++) for (let xx = 0; xx < k; xx++) st.px(x + (i - spr.ax) * k + xx, y + (j - spr.h) * k + yy, white ? 0xffffff : c, a); } };
    function movieDraw(t, dt) {
      const m = movie, b = m.boss, W = st.W;
      // the henchmen float in a row above the planet; janemba's double mirrors him on the left
      for (const h of m.minions) {
        if (h.pos === 'twin') { h.k = b.k; const s = fitSpot(h.spr, h.k, cx - R * 1.45, cy - R * .75 + Math.sin(t * 2 + 1) * 3); h.x = s.x; h.y = s.y; }
        else { h.k = Math.max(.9, R / 62); const slot = h.i - (h.n - 1) / 2, e = Math.max(0, Math.min(1, (t - m.t0) / 1.2 - h.i * .1)), tx = cx + slot * R * .55, ty = cy - R * 1.12 + Math.abs(slot) * R * .08 + Math.sin(t * 2 + h.i) * 2; h.x = tx + st.W * .6 * (1 - e); h.y = ty; }
        h.flash = Math.max(0, h.flash - dt); if (h.dead) continue;
        mvBlit(h.spr, h.x, h.y, h.k, h.pos === 'twin' ? false : (t * 2 + h.i) % 2 < 1, h.flash > 0);
        const bw = Math.round((h.pos === 'twin' ? 20 : 12) * h.k), bx = Math.round(h.x - bw / 2), by = Math.round(h.y - h.spr.h * h.k - 5), f = Math.max(0, h.hp / h.max);
        for (let x = -1; x <= bw; x++) for (let y = -1; y <= 1; y++) st.px(bx + x, by + y, x < 0 || x === bw || y !== 0 ? 0x1d1030 : x < bw * f ? 0x34d873 : 0xffffff);
      }
      if (m.over) return;
      // the supernova: a swelling orange sun over his head, or beside him when he's near the top
      if (m.nova) { const p = Math.min(1, (t - m.nova.t0) / (m.nova.t1 - m.nova.t0)), r = (3 + 11 * p) * b.k, up = b.y - b.spr.h * b.k - 18 - r, ny = Math.max(r + 4, up), nx = up < r + 4 ? b.x - b.spr.w * b.k / 2 - r - 6 : b.x; for (let yy = -r - 3; yy <= r + 3; yy++) for (let xx = -r - 3; xx <= r + 3; xx++) { const d = Math.hypot(xx, yy); if (d <= r) st.px(nx + xx, ny + yy, d < r * .45 ? 0xfff2d0 : d < r * .8 ? 0xffb050 : 0xf06a20); else if (d <= r + 3 && bayer(Math.round(nx + xx), Math.round(ny + yy)) < .5) st.px(nx + xx, ny + yy, 0xffd0a0, .7); } }
      // the psychic web: strands from bujin to you, and a net around you
      if (m.web) { const bj = m.minions.find(h => h.name === 'bujin'), hp = handPos(); if (bj) for (let i = 0; i <= 1; i += .015) st.px(bj.x + (hp.x - bj.x) * i + Math.sin(i * 30 + t * 8) * 2, bj.y - bj.spr.h * bj.k / 2 + (hp.y - bj.y + bj.spr.h * bj.k / 2) * i, i * 60 % 4 < 2 ? 0xff9af0 : 0x9ae84a);
        for (let a = 0; a < 6.28; a += .05) for (const r of [8, 14]) st.px(hp.x + Math.cos(a) * r, hp.y + Math.sin(a) * r, 0xff9af0, .8); for (let a = 0; a < 6.28; a += .785) for (let r = 0; r < 14; r++) st.px(hp.x + Math.cos(a) * r, hp.y + Math.sin(a) * r, 0xffc8f6, .8); }
      // space flipped: a mirror line down the middle and his reflection where your taps now land
      if (m.flipUntil > t) { for (let y = 0; y < st.H; y++) if ((y >> 2) % 2) st.px(W / 2, y, 0xc070ff, .7); mvBlit(b.spr, W - b.x, b.y, b.k, false, false, .45); }
      // the jelly wobble: every row of the world sways for a moment
      if (m.wob > t) { const B = st.buf, amp = 3 * (m.wob - t), row = new Uint32Array(W); for (let y = 0; y < st.H; y++) { const s = Math.round(Math.sin(y * .12 + t * 14) * amp); if (!s) continue; row.set(B.subarray(y * W, y * W + W)); for (let x = 0; x < W; x++) B[y * W + x] = row[Math.max(0, Math.min(W - 1, x - s))]; } }
    }
    let shen = null;     // { t0, phase: 'rise' | 'wish' | 'leave', t1 }
    let playing = false;
    let shenLook = 1;   // 'rising'
    let summonLater = false, podWish = 0;   // seven balls gathered on snake way: the dragon waits until you're back on a planet
    function summon(look) {
      if (shen) return;
      if (look !== undefined) shenLook = look;
      if (S.world === 3) { summonLater = true; return; }
      shen = { t0: st.t, phase: 'rise', phaseT: st.t, look: shenLook, wishes: S.world === 1 ? 3 : 1, porunga: S.world === 1 }; ach(S.world === 1 ? 'porunga' : 'shenron'); document.body.classList.add('shen'); ui.sfx && ui.sfx('dragon'); ui.event(S.world === 1 ? 'porunga awakens — three wishes…' : 'the eternal dragon awakens…');/*widget*/ ui.notify('shenron', S.world === 1 ? 'porunga' : 'shenron');/*/widget*/
    }
    const wishSeeds = () => Math.max(3, Math.ceil(seedsNow() / 5));
    const wished = k => (wishBuff[k] || 0) > st.t;
    const buff = (k, secs, msg) => { wishBuff[k] = st.t + secs; ui.event(`your wish is granted — ${msg}`); };
    // twenty wishes; the dragon offers three you can use right now (plus krillin whenever he's dead), each with a rarity: the strong ones rarely
    const WISHES = [
      { key: 'power', tier: 'epic', label: 'eternal power', what: () => '×1.25 to everything, forever, even after ascending', grant: () => { S.wishes++; ui.event('your wish is granted — ×1.25 forever'); } },
      { key: 'form', tier: 'rare', label: () => 'a taste of ' + FORMS[S.form + 1].name, what: () => `×${FORMS[S.form + 1].x} for 60 seconds`, ok: () => S.form < FORMS.length - 1, grant: () => { preview = { from: preview ? preview.from : S.form, until: st.t + 60 }; transform(true); } },   // a second taste still falls back to where you started
      { key: 'seeds', tier: 'rare', label: 'the seeds of power', what: () => `+${wishSeeds()} ki seeds, kept forever`, grant: () => { const g = wishSeeds(); S.seeds += g; S.ascend += g; ui.event(`your wish is granted — +${g} ki seeds (×${seedBoost().toFixed(1)} on everything)`); ui.treeGift && ui.treeGift(`+${g} ki seeds from shenron`); } },
      { key: 'bigape', tier: 'rare', label: 'a bigger great ape', what: 'the next full moon makes a giant: bigger, +15s, +×1, and every tap stomps', ok: () => !!S.ach.ape && !S.bigApe, grant: () => { S.bigApe = 1; nextMoon = Math.min(nextMoon, 8); ui.event('your wish is granted — the next full moon makes a giant'); } },
      { key: 'fortune', label: 'a fortune in power', what: () => '+10 minutes of income', grant: () => { gain(wrate() * 600); ui.event('your wish is granted — +' + fmtShort(wrate() * 600)); } },
      { key: 'skills', tier: 'legendary', label: 'ki talent mastery', what: () => '+1 rank to every ki talent you\'ve learned (training tree)', ok: () => TREE.some(n => lvl(n.id) && lvl(n.id) < nodeMax(n)), grant: () => { for (const n of TREE) if (lvl(n.id) && lvl(n.id) < nodeMax(n)) S.tree[n.id]++; ui.event('your wish is granted — every ki talent +1 rank'); ui.treeGift && ui.treeGift('+1 rank on every talent from shenron'); } },
      { key: 'gear', tier: 'epic', label: 'capsule corp delivery', what: () => '+1 level to every shop upgrade you own', ok: () => RESETS.some(r => S[r] > 0), grant: () => { for (const r of RESETS) if (S[r] > 0) S[r]++; tailAch(); ui.event('your wish is granted — every shop upgrade +1 level'); } },
      { key: 'fly', tier: 'rare', label: 'the power of flight', what: () => 'fly your laps for 30s: laps ×1.8', ok: () => !wished('fly'), grant: () => { buff('fly', 30, 'flying for 30s — laps ×1.8'); ach('flight'); } },
      { key: 'fast', label: 'flying nimbus legs', what: () => 'run 50% faster for 3 minutes', grant: () => buff('fast', 180, 'running 50% faster for 3 minutes') },
      { key: 'taps', label: 'golden fists', what: () => 'taps ×3 for 3 minutes', grant: () => buff('taps', 180, 'taps ×3 for 3 minutes') },
      { key: 'idle', tier: 'rare', label: 'a hundred clones', what: () => 'idle income ×3 for 3 minutes', ok: () => passive() > 0, grant: () => buff('idle', 180, 'idle income ×3 for 3 minutes') },
      { key: 'laps', label: 'road of the gods', what: () => 'laps pay ×3 for 3 minutes', grant: () => buff('laps', 180, 'laps pay ×3 for 3 minutes') },
      { key: 'crit', tier: 'rare', label: 'scouter-proof', what: () => 'every tap crits for 1 minute', grant: () => buff('crit', 60, 'every tap crits for 1 minute') },
      { key: 'combo', label: 'perfect rhythm', what: () => 'max combo for 2 minutes', grant: () => buff('combo', 120, 'max combo for 2 minutes') },
      { key: 'senzu', label: 'a bag of senzu', what: () => 'senzu ×1.5 for 2 minutes', grant: () => { senzuUntil = Math.max(senzuUntil, st.t + 120); ui.event('your wish is granted — senzu ×1.5 for 2 minutes'); } },
      { key: 'fuse', tier: 'rare', label: 'fusion ha!', what: () => 'fuse with bubbles right now: ×2 for 30s', ok: () => S.partner > 0, grant: () => { fuseUntil = st.t + 30; ach('fusion'); ui.event('your wish is granted — fusion ha! ×2 for 30s'); } },
      { key: 'kaio', tier: 'rare', label: 'king kai\'s blessing', what: () => `kaioken ×${KAIO()} now, no tiredness after`, ok: () => S.kaio > 0, grant: () => { kaioUntil = st.t + 15; kaioReady = st.t + 15; ui.event(`your wish is granted — kaioken ×${KAIO()}, and you won't get tired`); } },
      { key: 'bubbles', label: 'a bigger monkey', what: () => 'bubbles +5 levels', ok: () => S.partner > 0, grant: () => { S.partner += 5; ui.event('your wish is granted — bubbles +5 levels'); } },
      { key: 'trip', label: 'a space pod', what: () => 'fly to the next world as soon as the dragon leaves', ok: () => S.world === home(), grant: () => { podWish = 1; ui.event('your wish is granted — a space pod is on its way'); } },
      { key: 'radar', label: 'dragon radar', what: () => '+3 dragon balls toward the next summon', grant: () => { S.orbs7 = Math.min(6, S.orbs7 + 3); ui.event(`your wish is granted — ${S.orbs7}/7 dragon balls already`); } },
      { key: 'again', tier: 'epic', label: 'one more wish', what: () => 'the dragon grants an extra wish', grant: () => { shen.wishes++; ui.event('your wish is granted — one more wish!'); } },
      { key: 'satan', label: 'mr. satan\'s autograph', what: () => '"the world champion\'s signature!" (a little power)', grant: () => { gain(wrate() * 30); ui.event('mr. satan signs it with a flourish — +' + fmtShort(wrate() * 30) + '. it\'s worthless.'); } },
    ];
    const KRILLIN_WISH = { key: 'krillin', label: 'bring krillin back', what: () => `he trains with you: idle ×1.5 and destructo discs. next death: rage ×${3 + (S.krillinRevives || 0)}`, grant: () => { S.krillinDead = 0; S.krillinAlly = 1; S.krillinRevives = (S.krillinRevives || 0) + 1; nextKril = 240; ui.event('krillin is back! "did i miss anything?" — he trains with you: idle ×1.5 and destructo discs'); } };
    const TIERS = { common: 1, rare: .5, epic: .25, legendary: .08 };   // how often each rarity makes the three: a given common shows up in ~1 in 5 summons, rare ~1 in 9, epic ~1 in 18, legendary ~1 in 50
    const val = v => typeof v === 'function' ? v() : v;
    const RANK = ['common', 'rare', 'epic', 'legendary'];
    function openWish() {
        shen.phase = 'wish'; shen.phaseT = st.t;
        const pool = WISHES.filter(w => !w.ok || w.ok()).map(w => [w, Math.random() ** (1 / TIERS[w.tier || 'common'])]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => w), offer = S.krillinDead ? [...pool, KRILLIN_WISH] : pool;
        const pick = (k, auto) => {
          if (!shen || shen.phase !== 'wish') return; shen.phase = 'granting'; shen.phaseT = st.t;   // a wish is granted once, however often the box fires
          const w = offer.find(w => w.key === k); if (w) { w.grant(); S.granted = (S.granted || 0) + 1; }
          if (auto && w) { ui.wishDone && ui.wishDone(); ui.event(`20s and no answer — the dragon grants the rarest: ${val(w.label)} (${w.tier || 'common'})`, 4500); }
          ui.fx && ui.fx('super'); save();
          if (--shen.wishes > 0) { setTimeout(() => { if (shen) { ui.event(`${shen.wishes} wish${shen.wishes > 1 ? 'es' : ''} left`); openWish(); } }, 1400); return; }
          shen.phase = 'leave'; shen.t1 = st.t; shen.phaseT = st.t;
        };
        // no answer in 20s: the rarest of the three (the first offered wins a tie)
        shen.auto = () => pick(offer.slice(0, 3).reduce((a, w) => RANK.indexOf(w.tier || 'common') > RANK.indexOf(a.tier || 'common') ? w : a).key, true);
        ui.wish(offer.map(w => ({ key: w.key, label: val(w.label), what: val(w.what), tier: w.tier || 'common' })), k => pick(k));
    }
    // the dragon's timeline runs here, not in the draw (snake way skips that), with a watchdog so no phase can hang
    function shenStep(t) {
      if (summonLater && S.world !== 3 && !shen) { summonLater = false; summon(); }
      if (!shen) return;
      const age = t - shen.t0, inPhase = t - shen.phaseT;
      if (shen.phase === 'rise' && age > 4.4) openWish();
      else if (shen.phase === 'wish' && inPhase > 20) shen.auto();
      else if (shen.phase === 'granting' && inPhase > 6) openWish();   // its follow-up timer never fired
      else if (shen.phase === 'leave' && t - shen.t1 > 1.7) { shen = null; document.body.classList.remove('shen'); }
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
      if (S.world === 9) return shadeTop(nb, lum, x, y);
      const dn = V.dot(nb, N);
      if (W2L[S.world]) return shadeW2(nb, dn, lum, x, y);
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
    // ── tournament of power: the tiled ring in the null realm
    const mixc = (a, b, k) => { const m = s => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * k); return (m(16) << 16) | (m(8) << 8) | m(0); };
    function shadeTop(nb, lum, x, y) {
      const Lk = TOP_LOOK, P = Lk.tiles, d = TOP.dmg;
      const w = V.dot(nb, N), u = V.dot(nb, E1), v = V.dot(nb, E2), th = Math.acos(Math.max(-1, Math.min(1, w)));
      const sc = th / Math.max(1e-4, Math.sin(th)) / Lk.tile, X = u * sc, Y = v * sc, ti = Math.floor(X), tj = Math.floor(Y), fu = X - ti, fv = Y - tj;
      const road = Math.abs(th - 1.571) < .075, seam = .08;
      // missing chunks: whole tiles drop out in ragged clusters, the hero's path holds out longest
      if (d > 0) {
        const thr = .2 + .32 * d - (road ? .14 : 0), hv = vnoise3(nb[0] * 3.2 + 11, nb[1] * 3.2, nb[2] * 3.2) * .7 + h2(ti * 7 + tj * 131 + 5, tj * 17 + ti * 3) * .3;
        if (hv < thr) { const deep = thr - hv; if (deep < .028) return tone(P, lum * .55 - .1, x, y); const s = h2(x * 7 + 1, y * 13); return s > .992 ? Lk.star[1] : bayer(x, y) < .3 ? Lk.bg[1] : Lk.bg[0]; }
        const c = vnoise3(nb[0] * 8 + 3, nb[1] * 8, nb[2] * 8 + 5);
        if (Math.abs(c - .5) < .012 + .012 * d && vnoise3(nb[0] * 2 + 7, nb[1] * 2, nb[2] * 2) < .2 + d * .9) return tone(P, lum * .35, x, y);   // cracks
        if (hv < thr + .035) lum -= .18;   // chipped, dusty tiles round each hole
        lum -= d * .08;
      }
      const pal = road ? Lk.trim : P;
      if (fu < seam || fv < seam) return tone(pal, lum - .2, x, y);
      return tone(pal, lum + (h2(ti * 13 + 1, tj * 29 + 7) - .5) * .14 + (fu < seam * 2.5 || fv < seam * 2.5 ? .06 : 0), x, y);
    }
    SHADE.topChunk = (o, n, x, y) => tone(TOP_LOOK.tiles, light(n) * .8 - .12 + (h2(x * 5, y * 3) - .5) * .2, x, y);
    // floor debris grows with the damage
    function topScenery() {
      let sd = 77; const rnd = () => (sd = sd * 16807 % 2147483647) / 2147483647, d = TOP.dmg;
      for (let i = 0, n = Math.round(d * 26); i < n; i++) { const th = .1 + rnd() * 1.35, a = rnd() * 6.283, r = (.012 + rnd() * .022) * (1 + d * .8); if (Math.abs(th - 1.571) < .12) continue; solids.push({ c: V.mul(capPt(th, a), 1 + r * .15), r, kind: 'topChunk' }); }
    }
    // the void: a baked gradient and nebula, twinkling stars, floating rock pillars, then the stands and zeno's box
    let voidBake = null;
    const PILLARS = [[.06, .5, 16, 48], [.17, .2, 9, 22], [.9, .58, 18, 54], [.8, .14, 8, 18], [.3, .82, 7, 16], [.97, .28, 9, 26], [.66, .9, 8, 14]];
    function bakeVoid() {
      const W = st.W, H = st.H, Lk = TOP_LOOK, B = new Uint32Array(W * H), k0 = 267 / Math.min(W, H);
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const g = y / H + (bayer(x, y) - .5) * .18;
        let c = g < .45 ? Lk.bg[0] : g < .8 ? Lk.bg[1] : Lk.bg[2];
        const X = x * k0, Y = y * k0;
        const n = vnoise(X * .018 + 3, Y * .026) * .7 + vnoise(X * .05, Y * .07) * .35;
        const b = bayer(x, y) * .14;
        if (n + b > .78) c = Lk.neb[2]; else if (n + b > .66) c = Lk.neb[1]; else if (n + b > .55) c = Lk.neb[0];
        B[y * W + x] = PK(c);
      }
      voidBake = { B, W, H };
    }
    function topPillar(x0, y0, w, h, seed) {
      const Lk = TOP_LOOK, far = w < 10 ? .45 : 0, R4 = Lk.rock.map(c => mixc(c, Lk.bg[1], far)), rim = mixc(Lk.rim, Lk.bg[1], far + .15), taper = Math.round(h * .45);
      for (let j = 0; j < h + taper; j++) {
        const hw = j < h ? w / 2 * (1 + (h2(seed, j >> 2) - .5) * .22) : w / 2 * (1 - (j - h) / taper) * (1 + (h2(seed + 3, j) - .5) * .5);
        if (hw < .6) continue;
        for (let i = -Math.ceil(hw); i <= Math.ceil(hw); i++) {
          if (Math.abs(i) > hw) continue;
          if (j < 2 && h2(seed + i * 7, j) < .35) continue;
          const f = i / hw, edge = Math.abs(i) > hw - 1;
          let c = edge ? R4[0] : j < 3 ? rim : f < -.4 ? R4[3] : f < .25 ? R4[2] : R4[1];
          if (!edge && j >= 3 && j % 7 === 6 && h2(seed + i, j) > .25) c = R4[1];
          st.px(x0 + i, y0 + j, c);
        }
      }
    }
    // a gods' stand: two figures on a pale ledge with the universe number on its banner, on a stalk of rock; erased ones stand empty and faded
    function topStand(x, y, u) {
      const Lk = TOP_LOOK, g = TOP_GODS[u], gone = TOP.erased.has(u), a = gone ? .45 : 1;
      x = Math.round(x) - 11; y = Math.round(y) - 13;
      const P = (i, j, c) => st.px(x + i, y + j, c, a);
      if (!gone) {
        const fig = (fx, skin, cloth, angel) => {
          for (let j = 0; j < 9; j++) for (let i = -1; i <= 5; i++) {   // outline first
            const inside = (ii, jj) => jj >= 0 && jj < 9 && ii >= 0 && ii < 5 && !((jj === 0 || jj === 3) && (ii === 0 || ii === 4)) && !(jj === 8 && ii === 2);
            if (inside(i, j)) P(fx + i, j, j < 4 ? (angel && j === 0 ? 0xffffff : skin) : angel && j === 4 ? 0x7ae0f4 : cloth);
            else if (inside(i - 1, j) || inside(i + 1, j) || inside(i, j - 1) || inside(i, j + 1)) P(fx + i, j, 0x0c0a14);
          }
          P(fx + 1, 2, 0x0c0a14); P(fx + 3, 2, 0x0c0a14);
        };
        fig(4, g[0], g[1], false); fig(13, g[2], 0x2a2a5a, true);
      }
      const ROWS = ['..oooooooooooooooooo..', '.owwwwwwwwwwwwwwwwwwo.', 'owwwwwwwwwwwwwwwwwwwwo', 'oWWWWWWWWWWWWWWWWWWWWo', 'obbbbbbbbbbbbbbbbbbbbo', 'obbbbbbbbbbbbbbbbbbbbo', 'obbbbbbbbbbbbbbbbbbbbo', 'obbbbbbbbbbbbbbbbbbbbo', 'obbbbbbbbbbbbbbbbbbbbo', '.oBBBBBBBBBBBBBBBBBBo.', '..oorrrrrrrrrrrrrroo..', '....orrrrrrrrrrrro....', '.....orrrrrrrrrro.....', '......orrrRrrrro......', '........orrro.........', '.........oro..........'];
      const ban = gone ? 0x2a2a34 : g[3], C = { o: 0x0c0a14, w: gone ? 0x9a98a8 : 0xf2f2f8, W: gone ? 0x6a687a : 0xb8b6c8, b: ban, B: mixc(ban, 0, .45), r: Lk.rock[2], R: Lk.rock[3] };
      ROWS.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') P(i, 9 + j, gone && ch !== 'o' && h2(x + i, j) > .9 ? 0x0c0a14 : C[ch]); }));
      const s = String(u), tw = st.textWidth(s); st.text(s, x + 11 - (tw >> 1), 9 + 4 + y, gone ? 0x5a5868 : 0xffffff, a);
    }
    // where the stands and zeno's box go, per look and per screen shape: { box: [x, y] bottom-centre of the box floor, back: drawn behind the planet, stands: [[x, y, u]] centres }
    function topPlaces(t) {
      const port = st.W / st.H < .8, U = TOP.UNI, bob = i => Math.round(Math.sin(t * .8 + i * 1.7) * 1.5);
        const rx = port ? Math.min(1.3 * R, st.W / 2 - 12) : 1.62 * R, ry = port ? 1.55 * R : 1.22 * R;
        return { box: [cx, cy - R + (port ? -R * .98 : 2) + bob(9)], back: true, stands: U.map((u, i) => { const a = (125 + i * 41.4) * Math.PI / 180; return [cx + Math.cos(a) * rx, cy - Math.sin(a) * ry + bob(i), u]; }) };
    }
    function topBox(x, y, apart) {
      const X = Math.round(x) - 32, Y = Math.round(y) - 36;
      st.blit(TOP_SPR.boxB, X, Y, false, true);
      st.blit(TOP_SPR.zeno, X + 7, Y + 3, false, true); st.blit(TOP_SPR.zeno, X + 33, Y + 3, true, true);
      st.blit(TOP_SPR.boxF, X, Y, false, true);
      if (apart) { st.blit(TOP_SPR.plate, X + 67, Y + 49, false, true); st.blit(TOP_SPR.priest, X + 70, Y + 19, false, true); }   // on his own floating tile
      else { st.blit(TOP_SPR.plate, X + 63, Y + 32, false, true); st.blit(TOP_SPR.priest, X + 66, Y + 2, false, true); }           // beside the box
    }
    let topFront = null;
    function drawVoid(t) {
      const Lk = TOP_LOOK;
      if (!voidBake || voidBake.W !== st.W || voidBake.H !== st.H) bakeVoid();
      /*widget*/if (!BARE) /*/widget*/st.buf.set(voidBake.B);
      /*widget*/if (!BARE) /*/widget*/for (let k = 0; k < 140; k++) {
        const x = Math.floor(hash(k * 3.1 + 1) * st.W), y = Math.floor(hash(k * 7.7 + 2) * st.H), big = hash(k * 1.3) > .9, tw = .35 + .65 * Math.max(0, Math.sin(t * (.6 + hash(k) * 2) + k));
        st.px(x, y, Lk.star[k % 2], tw * (big ? 1 : .55));
        if (big && tw > .75) for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) st.px(x + a, y + b, Lk.star[1], .45);
      }
      const k0 = Math.min(st.W, st.H) / 267;
      PILLARS.forEach(([fx, fy, w, h], i) => topPillar(Math.round(st.W * fx), Math.round(st.H * fy - h * k0 / 2 + Math.sin(t * .4 + i * 2) * 1.5), Math.round(w * k0), Math.round(h * k0), i * 31 + 7));
      const pl = topPlaces(t); topFront = [];
      for (const s of pl.stands) { if (s[3] > 0) topFront.push(s); else topStand(s[0], s[1], s[2]); }
      if (pl.back) topBox(pl.box[0], pl.box[1], pl.priestApart); else topFront.box = pl;
    }
    function drawTopFront() {
      if (!topFront) return;
      for (const s of topFront) topStand(s[0], s[1], s[2]);
      if (topFront.box) topBox(topFront.box.box[0], topFront.box.box[1], topFront.box.priestApart);
    }
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
    // kaioken: the sprite washed red, a pulsing red rim round it and flames licking up off the top, depth-tested like the sprite
    function kaioAura(spr, bx, by, ang, flip, lift, depth, k, t) {
      const ux = Math.sin(ang), uy = -Math.cos(ang), rx = Math.cos(ang), ry = Math.sin(ang), ox = bx + ux * lift, oy = by + uy * lift, Rr = (Math.hypot(spr.w, spr.h) + 6) * k, W = st.W, H = st.H, buf = st.buf;
      const on = (i, j) => i >= 0 && j >= 0 && i < spr.w && j < spr.h && spr.col[j * spr.w + (flip ? spr.w - 1 - i : i)] >= 0, pulse = .5 + .5 * Math.sin(t * 9), f = Math.floor(t * 12), wash = .12 + .08 * pulse;
      for (let y = Math.floor(oy - Rr); y <= oy + Rr; y++) { if (y < 0 || y >= H) continue; for (let x = Math.floor(ox - Rr); x <= ox + Rr; x++) {
        if (x < 0 || x >= W) continue; const kk = y * W + x; if (zb[kk] > depth) continue;
        const dx = x + .5 - ox, dy = y + .5 - oy, i = Math.floor((dx * rx + dy * ry) / k + spr.ax + .5), j = Math.floor(spr.ay + .5 - (dx * ux + dy * uy) / k);
        if (on(i, j)) { const [r, g, b] = UNPK(buf[kk]); buf[kk] = PK(((r + (255 - r) * wash) << 16) | ((g * (1 - wash)) << 8) | (b * (1 - wash))); continue; }
        if (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1)) { buf[kk] = PK(pulse > .5 ? 0xff4a3a : 0xe0332b); continue; }
        const fl = 2 + (h2(i * 13 + f * 7, f) * 4 | 0); let q = 0; for (let n = 2; n <= fl; n++) if (on(i, j + n)) { q = n; break; }
        if (q) { buf[kk] = PK(q >= fl ? 0xffd0c0 : q > 2 ? 0xff8a6a : 0xff4a3a); continue; }
        if ((on(i - 2, j) || on(i + 2, j) || on(i, j + 2)) && bayer(x, y) < .25 + .35 * pulse) buf[kk] = PK(0xb0201a);
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

    // ── snake way: down the snake's back from behind, an auto-run back to king kai. he runs at lap pace, hops the gaps and spines and steers himself, so an idle run always gets there;
    // taps train like at home and speed him up, a hop timed under a golden orb grabs it (a streak for every one in a row), a tap on a lost soul blasts it, a tap on a straight is a dash
    let snk = null;
    const SN_LAPS = 4, END = 400;   // the road is four laps of running long, END steps from the hole he fell through to king kai's planet
    const SN = { edge: 0x3a1e0c, rim: 0x8a4a18, ridge: 0xf2c060, ridgeHi: 0xfff0b0, road: 0xf2c84a, scale: 0xc87a28, scaleHi: 0xffe28a, spine: 0xd89a34 };
    const bendAt = s => 1.25 * Math.sin(s * .045) + .6 * Math.sin(s * .017 + 1);   // the road winds left and right
    const mixC = (a, b, k) => { k = Math.max(0, Math.min(1, k)); const c = sh => Math.round(((a >> sh) & 255) + (((b >> sh) & 255) - ((a >> sh) & 255)) * k); return (c(16) << 16) | (c(8) << 8) | c(0); };
    const bendS = s => bendAt(s) * Math.min(1, Math.max(0, (END - 10 - s) / 40));   // the last stretch runs dead straight at the planet
    const ease = k => { k = Math.max(0, Math.min(1, k)); return k * k * (3 - 2 * k); };
    function startSnake() {
      const R = Math.random, orbs = [], ghosts = [], sky = [], gaps = [], spikes = [];
      for (let i = 0; i < 16; i++) orbs.push({ p: .05 + i * .055 + R() * .02, u: [-1, 0, 1][(R() * 3) | 0] * .52 });   // ki orbs on the road: he picks them up running past
      for (let i = 0; i < 6; i++) ghosts.push({ p: .1 + i * .13 + R() * .04, ph: R() * 6, u: (R() * 2 - 1) * .6, h: 1.6 + R() * 1.4 });   // lost souls drifting by: tap one for a bonus, or let it float past
      for (let i = 0; i < 18; i++) sky.push({ p: .07 + i * .048 + R() * .012 });   // golden orbs up over the road: only a hop timed to its top gets one
      for (let s = 45; s < END - 70; s += 62 + R() * 22) { gaps.push([s, s + 3.4]); spikes.push({ s: s + 24 + R() * 10, u: [-1, 0, 1][(R() * 3) | 0] * .52 }); }   // a few big tears in his body, a cluster of spines between
      for (const o of orbs) o.s = o.p * END;
      for (const g of ghosts) g.s = g.p * END + 10;
      setTimeout(() => playing && S.world === 3 && snk && ui.event('he runs on his own — tap to hop for the golden orbs and to blast the lost souls', 4200), 2800);
      snk = { p: 0, phi0: phi, t0: st.t, done: 0, orbs, ghosts, sky, gaps, spikes, streak: 0, streakT: 0, shots: [], got: 0, blasted: 0, dash: 0, x: 0, spin: 0, hx: st.W / 2, hy: st.H / 2, sh: 28 };
      if (/nimbus/.test(HASH)) riding = 30;   // preview hook: #snake-nimbus
    }
    function blastGhost(g) {
      g.dead = true; snk.blasted++; if (++S.souls >= 10) ach('souls10'); snk.shots.push({ x: g.sx, y: g.sy, t0: st.t }); burst(g.sx, g.sy, [0xffffff, 0xdff4ff, 0xfff3a0], 18, 120);
      gain(Math.max(90, wrate() * 12), g.sx, g.sy - 8, true); ui.sfx && ui.sfx('beam'); ach('hfil');   // sent back down to HFIL
    }
    function snakeWin(t) { snk.done = t; ach('snakeway'); const g = Math.max(300, wrate() * 100); gain(g, snk.hx, snk.hy - 16, true); ui.event(`made it to king kai's planet at ${(t - snk.t0).toFixed(0)}s! +${fmtShort(Math.round(g))}`); victory(); ui.sfx && ui.sfx('form'); }
    const straight = () => Math.abs(bendS(snk.p * END + 9) - bendS(snk.p * END)) < .22;
    function snakeTap(px, py) {   // a tap trains like at home and speeds him up; on a lost soul it blasts it instead
      if (!snk || snk.done) return;
      const g = snk.ghosts.find(g => !g.dead && g.sx !== undefined && Math.hypot(px - g.sx, py - g.sy) < g.r + 8);
      if (g) { blastGhost(g); return; }
      const dash = straight(); if (dash) snk.dash = st.t + .8;   // on a straight a tap is a full dash
      sprint = Math.min(1.2, sprint + (dash ? 1.2 : .5)); if (jumpH <= 0) jumpV = 120;
      gain((1 + S.boots * ms('boots')) * mult() * (1 + .5 * lvl('fist'))); ui.sfx && ui.sfx('tap'); ui.bump && ui.bump();
    }
    const BEAT = 3.6;   // seconds from landing on king kai's planet to being home there
    function updateSnake(t, dt) {
      if (!snk) startSnake();
      snk.spin += dt * .35;
      if (snk.done) {   // the arrival: the globe turns king kai round to face him, then home
        const tg = -.52 + 6.283 * Math.round((snk.spin + .52) / 6.283); snk.spin += (tg - snk.spin) * Math.min(1, dt * 2.2) - dt * .35;
        if (t - snk.done > BEAT) namekUntil = t; return; }
      snk.p = Math.min(1, Math.max(snk.p, (phi - snk.phi0) / (6.283 * SN_LAPS)));
      for (const o of snk.orbs) if (!o.got && o.p <= snk.p) { o.got = true; snk.got++; gain(Math.max(5, wrate() * 1.5), snk.hx, snk.hy - 18, true); ui.sfx && ui.sfx('coin'); }
      for (const g of snk.ghosts) if (!g.dead && snk.p > g.p + .1) g.dead = true;   // the ones you leave behind drift off
      for (const o of snk.sky) if (!o.got && !o.miss && o.p <= snk.p) { if (jumpH > 10) { o.got = true; snk.streak = Math.min(8, snk.streak + 1); snk.streakT = t; if (snk.streak >= 8) ach('streak'); gain(Math.max(40, wrate() * 8 * (1 + snk.streak * .25)), snk.hx, snk.hy - 26, true); ui.sfx && ui.sfx('coin'); } else { o.miss = true; snk.streak = 0; } }   // timed hops beat mashing: a low hop misses and breaks the streak
      const here = snk.p * END + 1.6, o = snk.orbs.find(o => !o.got && o.s > here && o.s - here < 14), sp = snk.spikes.find(q => q.s > here && q.s - here < 6);
      const lane = snk.p > .9 ? 0 : o ? o.u : sp ? (sp.u ? 0 : .52) : 0; snk.x += (lane - snk.x) * Math.min(1, dt * 5);   // he steers for the next orb and round the spines, and lines up for the planet at the end
      if (snk.p >= 1) { snakeWin(t); burst(snk.hx, snk.hy, [0xffffff, 0xfff3a0, 0xffd23a, 0x8ad65a], 36, 160); }
    }
    function hop(here) {   // he hops every gap and spine on his own: how high, from where he stands
      for (const [a, b] of snk.gaps) { const k = (here - a + 1.4) / (b - a + 2.8); if (k > 0 && k < 1) return Math.sin(k * Math.PI); }
      for (const q of snk.spikes) { const k = (here - q.s + 1) / 2; if (k > 0 && k < 1 && Math.abs(q.u - snk.x) < .4) return Math.sin(k * Math.PI) * .7; }
      return 0;
    }
    // ── drawing helpers
    // king kai's planet: a slowly turning mini-world with a road ring round its cap, the red-domed house, the tree, king kai, bubbles, gregory and the car going round
    function stamp(bx, by, ang, w, h, f) {   // a procedural shape standing on (bx, by) tipped by ang; f(u, v) gives a colour or -1, u across and v up, both 0..1
      const ux = Math.sin(ang), uy = -Math.cos(ang), rx = Math.cos(ang), ry = Math.sin(ang), Rr = Math.hypot(w, h) + 1;
      for (let y = Math.floor(by - Rr); y <= by + Rr; y++) for (let x = Math.floor(bx - Rr); x <= bx + Rr; x++) { const dx = x + .5 - bx, dy = y + .5 - by, u = (dx * rx + dy * ry) / w + .5, v = (dx * ux + dy * uy) / h; if (u < 0 || u > 1 || v < 0 || v > 1) continue; const c = f(u, v); if (c >= 0) st.px(x, y, c); }
    }
    const kaiHouseShape = (u, v) => { const e = (u - .5) ** 2 / .2 + (v - .42) ** 2 / .34, dome = v > .42 && e < 1;   // cream round walls under a red dome, a door and a porthole
      if (dome) return e > .78 ? 0x7a1a12 : u < .4 && v > .6 ? 0xff8a6a : u > .7 ? 0xb8301e : 0xe0473a;
      if (v > .46 || u < .08 || u > .92) return -1; if (u < .11 || u > .89 || v < .04) return 0x5a4630; if (u > .42 && u < .58 && v < .34) return 0x3a2a1e; if (Math.hypot((u - .74) * 1.4, v - .26) < .09) return 0x5ab8f2; return u > .72 ? 0xcdbf9e : 0xf6ecd4; };
    const kaiTreeShape = (u, v) => { const can = [[.5, .66, .34], [.28, .52, .24], [.72, .52, .24], [.5, .86, .2]].reduce((m, [a, b, r]) => Math.min(m, Math.hypot(u - a, (v - b) * .8) / r), 9);
      if (can < 1) return can > .86 ? 0x173f16 : u < .45 && v > .62 ? 0x8ad65a : u > .62 || v < .45 ? 0x2f7a26 : 0x4f9e36;
      return u > .43 && u < .57 && v < .5 ? (u > .51 ? 0x4a2a12 : 0x7a4a24) : -1; };
    function kingKaiPlanet(kx, ky, kr, t, spin, beat) {   // beat: seconds since he landed, when king kai waves and bubbles jumps about
      const W = st.W, H = st.H, tilt = .42, ct = Math.cos(tilt), sn = Math.sin(tilt), k = kr / 42, G5 = [0x2f7a26, 0x3f9330, 0x57ad3c, 0x78c64a, 0xa6de66, 0xd2f28e], at = {};
      const hr = kr * 1.45 + 8; /*widget*/if (!BARE) /*/widget*/for (let y = Math.max(0, ky - hr); y < Math.min(H, ky + hr); y++) for (let x = Math.max(0, kx - hr); x < Math.min(W, kx + hr); x++) { const d = Math.hypot(x - kx, y - ky); if (d >= kr && d <= hr) st.px(x, y, 0xfff4cc, ((1 - (d - kr) / (hr - kr)) ** 2) * .6); }   // a soft gold halo
      // the globe, lit from the upper left; its pole is tipped toward us so the cap with the house shows, and the grass turns with it
      for (let y = -kr; y <= kr; y++) { const Y = ky + y; if (Y < 0 || Y >= H) continue; for (let x = -kr; x <= kr; x++) { const X = kx + x; if (X < 0 || X >= W) continue; const d = Math.hypot(x, y); if (d > kr + .3) continue;
        if (d > kr - .7) { st.px(X, Y, 0x1f3a1a); continue; }
        const nx = x / kr, ny = -y / kr, nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny)), oy = ny * ct + nz * sn, oz = -ny * sn + nz * ct, ox = nx * Math.cos(spin) - oz * Math.sin(spin), oz2 = nx * Math.sin(spin) + oz * Math.cos(spin);
        const l = nx * -.5 + ny * .62 + nz * .6, q = l * .8 + .45 + (bayer(X, Y) - .5) * .35 - (vnoise(ox * 5 + 9, oz2 * 5 + oy * 3) > .66 ? .25 : 0);
        const rd = Math.abs(oy - .62), tuft = h2(Math.floor((ox + 2) * kr * .55), Math.floor((oz2 + 2) * kr * .55) + Math.floor(oy * kr * .3) * 57);   // the road ring with its kerbs, then grass with darker tufts and the odd flower
        st.px(X, Y, rd < .05 ? (rd > .04 ? 0xa8a090 : q > .5 ? 0xfdfaf2 : 0xd8d2c4) : kr > 30 && tuft > .985 ? (tuft > .993 ? 0xfff27a : 0xffffff) : G5[Math.max(0, Math.min(5, Math.round(q * 4.2) - (kr > 20 && tuft > .91 ? 1 : 0)))]); } }
      if (kr < 6) return at;
      // who lives there, placed on the cap and carried round as it spins, far side hidden; the car drives the road ring faster than the spin
      const folk = [{ a: -.5, tree: 1 }, { a: -.16, house: 1 }, { a: .14, spr: KINGKAI, s: .62, kk: 1 }, { a: .34, spr: MONKEY[Math.floor(t * 6) % 2], s: .8, h: 9, bub: 1 }, { a: .5, spr: GREGORY, s: .9, h: 13 }, { a: .74, spr: KAICAR, s: .55, car: 1 }];
      const pts = folk.map((f, i) => { const lon = f.a * 2.6 + spin * (f.car ? 2.2 : 1) + (f.car ? t * .5 : 0), lat = f.car ? .67 : .9 + (i % 2) * .08, p = [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)];
        return { f, x: p[0], y: p[1] * ct - p[2] * sn, z: p[1] * sn + p[2] * ct }; }).filter(p => p.z > .05).sort((a, b) => a.z - b.z);
      for (const { f, x, y, z } of pts) { const bx = kx + x * kr, by = ky - y * kr, ang = Math.atan2(x, y) * .8, sz = .7 + .3 * z;
        if (f.tree) stamp(bx, by, ang, kr * .4 * sz, kr * .58 * sz, kaiTreeShape);
        else if (f.house) stamp(bx, by, ang, kr * .5 * sz, kr * .42 * sz, kaiHouseShape);
        else if (k * sz >= .32) { const wave = beat > .5 && f.kk, cheer = beat > .3 && f.bub, lift = wave ? Math.abs(Math.sin(beat * 7)) * 4 * k : cheer ? Math.abs(Math.sin(beat * 14)) * 7 * k : f.h ? Math.abs(Math.sin(t * f.h + f.a)) * 3 * k : 0;   // king kai bounces and turns to and fro waving, bubbles leaps about
          blitZ(f.spr, bx, by, ang, wave ? Math.floor(beat * 4) % 2 === 0 : f.a > .3, lift, 1e9, k * f.s * sz); if (f.kk) at.kk = { x: bx, y: by - f.spr.h * k * f.s * sz - lift }; if (f.bub) at.bub = { x: bx, y: by - f.spr.h * k * f.s * sz - lift }; } }   // bubbles and gregory hop
      return at;
    }
    function puffRow(off, y0, r, pal, sd, cel, deep) {   // a band of cloud puffs, lit from the upper left; off scrolls it
      const W = st.W, step = r * 1.4, j0 = Math.floor(off / step) - 2;
      for (let j = j0; j < j0 + W / step + 4; j++) { const cx = j * step - off, cy = y0 + Math.sin(j * 1.9 + sd) * r * .35, rr = r * (.75 + .4 * hash(j * 3.1 + sd)), yb = deep ? st.H : Math.min(st.H, cy + rr * 1.6);   // only the nearest row needs to reach the bottom
        if (cx + rr < 0 || cx - rr > W) continue;
        for (let y = Math.floor(cy - rr); y < yb; y++) for (let x = Math.floor(cx - rr); x <= cx + rr; x++) { const dx = x - cx, dy = y - cy; if (dy < 0 ? dx * dx + dy * dy > rr * rr : Math.abs(dx) > rr) continue;
          const l = dy < 0 ? -(dx * .5 + dy * .9) / rr : -.5 - dy / (st.H - cy + 1), v = l + (cel ? .1 : bayer(x, y) * .3);
          st.px(x, y, cel && dy < 0 && dx * dx + dy * dy > (rr - 1.2) ** 2 ? pal[0] : pal[v > .65 ? 3 : v > .2 ? 2 : v > -.4 || cel ? 1 : 0]); } }
    }
    function drawGhost(ox, gy, R, ph, t, a = 1, mean = false) {   // a lost soul: a white wisp with a curling tail and two dark eyes
      for (let yy = -R; yy <= R * 2.2; yy++) for (let xx = -R - 2; xx <= R + 2; xx++) { const tail = yy > 0 ? R * (1 - yy / (R * 2.2)) : R, off = yy > 0 ? Math.sin(yy / R * 2 + t * 5 + ph) * R * .35 : 0, d = yy > 0 ? Math.abs(xx - off) / Math.max(.6, tail) : Math.hypot(xx, yy) / R;
        if (d <= 1) st.px(ox + xx, gy + yy, d > .8 ? 0xb8c8dc : yy < -R * .3 && xx < 0 ? 0xffffff : 0xeef3fa, a); }
      if (R >= 3) for (const ex of [-.35, .35]) for (let p = 0; p < Math.max(1, R / 4); p++) for (let q = 0; q < Math.max(1, R / 3); q++) st.px(ox + ex * R + p, gy - R * .15 + q + (mean && q === 0 && (ex < 0 ? p === 0 : p > 0) ? 1 : 0), mean ? 0x8a0a14 : 0x2a2440, a);
    }
    // kinto'un: a puffy yellow cloud centred on (x, y), w wide
    function drawNimbus(x, y, w) {
      const r = Math.max(2, w / 4);
      const puffs = [[-1.3, .25, .8], [1.3, .25, .8], [-.6, -.15, 1], [.6, -.1, 1], [0, .3, .9]];
      for (const pass of [0, 1]) for (const [dx, dy, rr] of puffs) { const cx0 = x + dx * r, cy0 = y + dy * r, R = rr * r - pass;   // outline first, then every fill over it
        for (let yy = -R - 1; yy <= R + 1; yy++) for (let xx = -R - 1; xx <= R + 1; xx++) { const d = Math.hypot(xx, yy) / Math.max(1, R); if (d > 1) continue; st.px(cx0 + xx, cy0 + yy, !pass ? 0x7a3e06 : yy < -R * .35 && d < .65 ? 0xfffbe0 : yy > R * .35 ? 0xeea21e : 0xffe36a); } }
    }
    const halo = (x, y, k) => { for (const [r, c] of [[1, 0x5a3a08], [0, 0]]) for (let a = 0; a < 6.28; a += .04) for (let d = -r; d <= r; d++) st.px(x + Math.cos(a) * (5 * k + d), y + Math.sin(a) * (1.6 * k + d) - (r ? 0 : 0), r ? c : Math.sin(a) < 0 ? 0xfff8c8 : 0xffd23a); };   // the dead wear a halo in other world
    function hud(t, dt, prog, col) {
      const W = st.W, H = st.H, bw = W - 40; for (let x = 0; x < bw; x++) for (let y = 0; y < 2; y++) st.px(20 + x, H - 3 + y, x < bw * prog ? col[0] : col[1]);
      fx.step(st, dt);
      if (flashT > 0) { flashT = Math.max(0, flashT - dt * 1.8); }
      for (const f of floats) { f.life -= dt * .8; f.y -= dt * 16; if (f.life <= 0) continue; const x = Math.round(f.x - st.textWidth(f.s) / 2), y = Math.round(f.y); for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) st.text(f.s, x + ox, y + oy, 0xffffff); st.text(f.s, x, y, f.red ? 0xd8241e : f.gold ? 0xb07a10 : 0x1d1030); }
      for (let i = floats.length - 1; i >= 0; i--) if (floats[i].life <= 0) floats.splice(i, 1);
    }
    const label = (s, x, y, c = 0x1d1030, o = 0xffffff) => { x = Math.round(x - st.textWidth(s) / 2); y = Math.round(y); for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) st.text(s, x + a, y + b, o); st.text(s, x, y, c); };
    function shotsDraw(t, x0, y0) {   // ki blasts: a bright streak from his hands to the ghost
      for (const sh of snk.shots) { const a = (t - sh.t0) / .18; if (a > 1) continue; for (let i = 0; i <= 1; i += 1 / Math.max(20, Math.hypot(sh.x - x0, sh.y - y0))) if (i > a - .5 && i < a + .05) for (let w = -1; w <= 1; w++) st.px(x0 + (sh.x - x0) * i + w, y0 + (sh.y - y0) * i, w ? 0xfff3a0 : 0xffffff); }
      snk.shots = snk.shots.filter(sh => t - sh.t0 < .2);
    }
    function sblitF(spr, x, y, s, flip) {   // a sprite at any scale, feet centred on (x, y)
      const w = spr.w * s, h = spr.h * s, x0 = Math.round(x - w / 2), y0 = Math.round(y - h);
      for (let j = 0; j < Math.ceil(h); j++) for (let i = 0; i < Math.ceil(w); i++) { const si = Math.min(spr.w - 1, Math.floor(i / s)), sj = Math.min(spr.h - 1, Math.floor(j / s)), c = spr.col[sj * spr.w + (flip ? spr.w - 1 - si : si)]; if (c >= 0) st.px(x0 + i, y0 + j, c); }
    }
    const skyDot = (x, y, t) => { const r = 2 + (Math.floor(t * 6) % 2); for (let i = -r - 2; i <= r + 2; i++) { st.px(x + i, y, Math.abs(i) <= 1 ? 0xffffff : 0xffe36a); st.px(x, y + i, Math.abs(i) <= 1 ? 0xffffff : 0xffe36a); } for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) st.px(x + a, y + b, 0xfff3a0); };   // a golden orb: a twinkling star
    const orbDot = (x, y, r) => { for (let yy = -r; yy <= r; yy++) for (let xx = -r; xx <= r; xx++) { const q = Math.hypot(xx, yy) / r; if (q <= 1) st.px(x + xx, y + yy, q < .45 ? 0xffffff : q < .8 ? 0xffe08a : 0xff9a2a); } };
    const ghostAt = (g, x, y, R, t) => { g.sx = x; g.sy = y; g.r = R; drawGhost(x, y, R, g.ph, t); };
    function streakTag(t) { if (snk.streak < 2 || t - snk.streakT > 1.4) return; label(`STREAK X${(1 + snk.streak * .25).toFixed(2).replace(/0$/, '')}`, snk.hx, snk.hy - snk.sh - 14, 0xb07a10); }
    // the snake's back: o across (-1..1 is the road, past that its dark edge), v along
    const SNC = (o, v) => { const au = Math.abs(o); if (au > 1) return 0x3a1e0c; if (au > .9) return 0x9a5a14; if (au > .78) return Math.floor(v * 2) % 2 ? 0xffc84a : 0xfff6c0; if (au > .74) return 0x9a5a14;
      const row = Math.floor(v), fv = v - row, su = o * 4.2 + (row % 2) * .5, fu = su - Math.floor(su), arc = Math.pow((fu - .5) * 2, 2) * .55; return fv < arc + .12 && fv > arc ? 0xd8901e : fv < arc + .2 && fv > arc + .12 ? 0xfff0a0 : au < .04 ? 0xe8a830 : 0xffd84a; };
    function tear(gi, g, sAt, u, o, y, t) {   // a torn break in his body: ragged scales, a cut face on the far side, the cloud sea parting on HFIL's glow below; -1 where the road is whole
      const ju = Math.round(u * 9), a = g[0] + .55 * h2(ju + gi * 31, 7), b = g[1] - .55 * h2(ju + gi * 31, 11);
      if (sAt < a || sAt > b) return -1;
      /*widget*/if (BARE && sAt <= b - .5) return -2;/*/widget*/
      if (sAt > b - .5) { const f = (b - sAt) / .5; return f < .22 ? 0xd8901e : f < .55 ? (bayer(o, y) < .5 ? 0x9a5a14 : 0x7a4010) : 0x4a2008; }   // the cut face: scales, flesh, then the dark underside
      const d = Math.min(1, Math.min(sAt - a, b - .5 - sAt) / ((b - .5 - a) / 2), (1 - Math.abs(u)) * 2.2), q = d + Math.sin(o * .35 + t * 7 + y * .9) * .08 + (bayer(o, y) - .5) * .25;
      return q < .1 ? 0x2a0804 : q < .24 ? (bayer(o, y) < .55 ? 0xf0b060 : 0x7a2a10) : q < .45 ? 0x8a1a10 : q < .66 ? 0xd0481e : q < .86 ? 0xff8a30 : 0xffd070;
    }
    function road3D(t, P) {
      const W = st.W, H = st.H, ph = W / H < .8, p = snk.p, sH = p * END, tb = snk.done ? t - snk.done : -1;
      const lag = tb >= 0 ? 5 - 2.6 * ease(tb / 1.8) : 5 * ease((p - .93) / .07), cam = (tb >= 0 ? END : sH) - lag, zH = 1.6 + lag;   // near the end the camera falls back and he runs on ahead; once he's landed it pushes in
      const hz = Math.round(H * ((ph ? .4 : .36) + ((ph ? .5 : .52) - (ph ? .4 : .36)) * ease((p - .82) / .18))), RW = P.RW, px = (x, y, c) => st.px(x, y, c), base = ph ? Math.round(H * .74) : H - 4;   // the camera tips up toward the planet; portrait phones: clear of the power level card
      const yAt = z => hz + 1.6 / z * (H - hz), xAt = (s, z) => W / 2 + (bendS(s) - bendS(cam) - snk.x) * RW * 1.6 / z;
      /*widget*/if (!BARE) /*/widget*/for (let y = 0; y < hz + 4; y++) for (let x = 0; x < W; x++) px(x, y, mixC(P.sky[0], P.sky[1], y / hz + (bayer(x, y) - .5) * .1));
      /*widget*/if (!BARE) /*/widget*/for (let y = hz + 3; y < H; y++) for (let x = 0; x < W; x++) px(x, y, mixC(P.floor[0], P.floor[1], (y - hz) / (H - hz) + (bayer(x, y) - .5) * .12));
      const fo = cam * 6 + t * 3;
      /*widget*/if (!BARE) {/*/widget*/puffRow(fo * .3, hz + 3, Math.max(4, W * .03), P.puff, 1); puffRow(fo * .6, hz + (H - hz) * .3, Math.max(6, W * .055), P.puff, 2); puffRow(fo, hz + (H - hz) * .7, Math.max(9, W * .09), P.puff, 3, false, true);/*widget*/}/*/widget*/
      // king kai's planet sits where the road ends: a speck at first, filling the sky by the end, never cut off by the frame
      const zE = END - cam, yE = yAt(Math.max(.5, zE)), yP = ph ? Math.min(yE, H * .64) : yE, m = Math.min(W, H * 1.2);   // on a phone the planet stays up clear of the power level card and the road climbs to it
      const kr = Math.round(Math.max(2, Math.min((yP - 5) / 2.25, W * .44, Math.max(3 + m * (.04 * p + .2 * p ** 3), (H - hz) * 2.2 / zE)))), kx = Math.round(Math.max(kr + 2, Math.min(W - kr - 2, xAt(END, Math.max(.5, zE))))), ky = Math.round(yP - kr * .9);
      const folk = kingKaiPlanet(kx, ky, kr, t, snk.spin, tb), tipY = ky + kr * .38, wE = Math.min(RW * 1.6 / Math.max(.5, zE), kr * .55);
      if (kr > 8) for (let y = Math.floor(yE); y > tipY; y--) { const f = (yE - y) / (yE - tipY), hw = wE + (kr * .2 - wE) * f, c = kx + (xAt(END, Math.max(.5, zE)) - kx) * (1 - f);   // the road runs on up the planet's face and stops where he'll land
        for (let o = -hw - 1.5; o <= hw + 1.5; o++) st.px(c + o, y, mixC(SNC(o / hw, f * 7), 0x6a4410, f * .35 + Math.max(0, o / hw) * .15)); }
      // the road: the snake's back in perspective, crescent scales and a raised border down both sides, torn open at the gaps, running up onto the planet
      const seen = [];
      for (let y = H - 1; y > hz + 1; y--) {
        const q = (y - hz) / (H - hz), z = 1.6 / q, sAt = cam + z, w = RW * q, cxr = xAt(sAt, z), v = sAt * 3.2, gi = snk.gaps.findIndex(g => sAt > g[0] - .6 && sAt < g[1] + .6);
        if (sAt > END) break;
        for (let o = -w - 2; o <= w + 2; o++) { const u = o / w; if (Math.abs(u) > 1 + 2.5 / w) continue;
          const c = gi >= 0 ? tear(gi, snk.gaps[gi], sAt, u, cxr + o, y, t) : -1; if (c !== -1) { if (Math.abs(u) > 1) continue; if (c >= 0) px(cxr + o, y, c); const g = seen[gi] = seen[gi] || { x: cxr, y0: y, y1: y, w }; g.y0 = Math.min(g.y0, y); continue; }
          px(cxr + o, y, mixC(SNC(Math.abs(u) > 1 ? 2 : u, v), P.sky[1], Math.max(0, .55 - q) * .9)); } }
      seen.forEach((g, gi) => { if (!g) return; const span = g.y1 - g.y0 + 1 + g.w * .5;   // embers rising out of HFIL, and chunks of scale breaking off the near edge and tumbling in
        for (let i = 0; i < 12; i++) { const k = (t * (.5 + hash(i + gi * 9) * .5) + hash(i * 3.7 + gi)) % 1, ex = g.x + (hash(i * 1.3 + gi) - .5) * g.w * 1.6 + Math.sin(t * 3 + i) * 2, ey = g.y1 - k * span; px(ex, ey, k > .7 ? 0xffe08a : i % 2 ? 0xff8a30 : 0xffc040); if (g.w > 40) px(ex, ey - 1, 0xffd070); }
        for (let i = 0; i < 3; i++) { const k = (t * .7 + i / 3) % 1, s = Math.max(1, Math.round(g.w * .05 * (1 - k))), cx2 = g.x + (hash(i * 5.1 + gi) - .5) * g.w * 1.3 * (1 - k * .5), cy2 = g.y1 + 2 - k * (g.y1 - g.y0) * .6;
          for (let yy = 0; yy < s; yy++) for (let xx = 0; xx < s; xx++) px(cx2 + xx, cy2 + yy, yy === 0 ? 0xffd84a : mixC(0xc87a1e, 0x3a1206, k)); } });
      // orbs, spines, golden orbs and ghosts, far to near
      for (const g of snk.ghosts) g.sx = undefined;
      const things = snk.orbs.filter(o => !o.got).concat(snk.spikes.map(sp => ({ ...sp, spike: true })), snk.ghosts.filter(g => !g.dead).map(g => ({ s: g.s, u: g.u + Math.sin(t + g.ph) * .15, ghost: g })), snk.sky.filter(o => !o.got && !o.miss).map(o => ({ s: o.p * END + 1.6, u: snk.x, sky: true }))).filter(o => o.s - cam > 1.2 && o.s - cam < 40 && o.s < END).sort((a, b) => b.s - a.s);
      for (const o of things) { const z = o.s - cam, q = 1.6 / z, y = hz + q * (H - hz), w = RW * q, ox = xAt(o.s, z) + o.u * w, r = Math.max(1.5, 7 * q * (RW / 130));
        if (o.ghost) { ghostAt(o.ghost, ox, y - r * o.ghost.h * 2.4 + Math.sin(t * 3 + o.ghost.ph) * r * .4, Math.max(2, r * 1.5), t); continue; }
        if (o.sky) { skyDot(ox, y - r * 7, t); continue; }
        if (o.spike) {   // a cluster of three spines, shaded on the right
          for (const [dx, hk, wk] of [[-.9, 1.6, .55], [.9, 1.6, .55], [0, 2.6, .7]]) { const hh = r * hk * 1.3, bw = r * wk * 1.3, bx = ox + dx * r;
            for (let yy = 0; yy <= hh; yy++) { const half = bw * (1 - yy / hh); for (let xx = -half; xx <= half; xx++) px(bx + xx, y - yy, Math.abs(xx) > half - 1 ? SN.edge : xx > 0 ? 0xa84a18 : yy > hh * .6 ? 0xffe0a0 : 0xe07a2a); } }
          continue; }
        orbDot(ox, y - r * 2.2, r); }
      // speed streaks, thicker in a dash; gone once he's there
      const dash = st.t < snk.dash;
      if (tb < 0) for (let i = 0; i < (dash ? 18 : 10); i++) { const k = (t * (dash ? 3 : 1.8) + i * .37) % 1, side = i % 2 ? -1 : 1, x0 = W / 2 + side * W * (.38 + k * .2), y0 = hz + (H - hz) * (.2 + ((i * .29) % .7)); for (let j = 0; j < 6 + k * 8; j++) px(x0 + side * j * .5, y0 + j, P.streak); }
      // him, from behind: full size at his usual spot, smaller as he runs on ahead, a last big leap onto the planet, then turning round on it
      const k = Math.max(1, Math.round(Math.min(W, H) / 110)), sc = k * 1.6 / zH, feet = hz + (base - hz) * 1.6 / zH, hx = W / 2 + (bendS(cam + zH) - bendS(cam)) * RW * 1.6 / zH;
      const leap = tb < 0 && p > .975 ? Math.sin((p - .975) / .025 * Math.PI) * 30 * k : 0, jump = (tb < 0 ? hop(cam + zH) * 18 * k + jumpH * k : 0) * (1.6 / zH) + leap * Math.min(1, 1.6 / zH * 2.2) + (riding > 0 && tb < 0 ? 10 * sc : 0);
      if (riding > 0 && tb < 0) drawNimbus(hx, feet - jump + 2 * sc, 14 * sc * 2.1);
      if (jump > 0) for (let yy = -2 * sc; yy <= 2 * sc; yy++) for (let xx = -8 * sc; xx <= 8 * sc; xx++) if ((xx / (8 * sc)) ** 2 + (yy / (2 * sc)) ** 2 <= 1 && bayer(hx + xx, feet - 2 + yy) < .5) px(hx + xx, feet - 2 + yy, P.shadow);   // his shadow on the road
      if (leap > 0) for (let i = 0; i < 10; i++) { const yy = feet - jump + i * 2 * sc + 4 * sc; for (let j = -1; j <= 1; j++) if (bayer(hx + j, yy) < .7 - i * .06) px(hx + j * sc, yy, 0xfff3c0); }   // a ki trail under the leap
      const land = tb >= 0 ? 1 : p > .975 ? ease((p - .975) / .025) : 0, fy = feet + (tipY + 2 - feet) * land, fx2 = hx + (kx - hx) * land;   // the leap ends on the tip of the road, up on the planet
      const set = HERO().forms[FORMS[S.form].i], back = (HERO().backs[FORMS[S.form].i] || HERO().backs[0])[Math.floor(t * 8) % 2], spr = tb > .35 ? set.pose : back;
      sblitF(spr, fx2, fy - jump, sc, false); halo(fx2, fy - jump - spr.h * sc - 2 * sc, sc);
      snk.hx = fx2; snk.hy = fy - jump - spr.h * sc / 2; snk.sh = spr.h * sc;
      shotsDraw(t, fx2, fy - jump - 14 * sc);
      if (tb >= 0) arrival(t, tb, kx, ky, kr, folk, fx2, fy);
      return { k, base, hz };
    }
    function arrival(t, tb, kx, ky, kr, folk, hx, feet) {   // the landing: sparkles, king kai waves and calls out, bubbles cheers, then a soft white-out into the visit
      for (let i = 0; i < 14; i++) { const a = hash(i * 2.3) * 6.283 + t * .3, r = kr * (1.05 + .25 * hash(i * 4.1)), tw = (t * 2.5 + hash(i)) % 1; if (tw > .6) continue; const x = kx + Math.cos(a) * r, y = ky + Math.sin(a) * r, s = Math.round(1 + (1 - Math.abs(tw - .3) / .3) * 2);
        for (let d = -s; d <= s; d++) { st.px(x + d, y, d ? 0xfff3a0 : 0xffffff); st.px(x, y + d, d ? 0xfff3a0 : 0xffffff); } }
      if (tb < .5) { const r = tb / .5 * 40; for (let a = 0; a < 6.28; a += .08) st.px(hx + Math.cos(a) * r, feet - 4 + Math.sin(a) * r * .35, 0xfffbe0, 1 - tb / .5); }   // a ring kicked up where he lands
      if (folk.kk && tb > .6 && tb < BEAT - .5 && (tb < 1.7 || tb > 2.4)) label(tb < 1.7 ? 'YOU MADE IT!' : 'NOW, A JOKE...', Math.max(40, Math.min(st.W - 40, folk.kk.x)), Math.max(6, folk.kk.y - 12), 0x1d1030);
      if (folk.bub && tb > 1.7 && tb < 2.4) label('OOK OOK!', Math.max(30, Math.min(st.W - 30, folk.bub.x)), Math.max(6, folk.bub.y - 10), 0x7a4a24);
      const f = (tb - (BEAT - .7)) / .7; if (f > 0) for (let y = 0; y < st.H; y++) for (let x = 0; x < st.W; x++) if (/*widget*/(!BARE || st.buf[y * st.W + x] >>> 24) && /*/widget*/bayer(x, y) < f * .85) st.px(x, y, 0xffffff);   // the visit's own flash picks up from this white
    }
    const P1 = { hz: 0, RW: 0, sky: [0xfffbe2, 0xffd468], floor: [0xffe48a, 0xe0a030], puff: [0xd99a2a, 0xf4c84a, 0xffe58a, 0xfffbe0], streak: 0xfffbe0, shadow: 0xb07a1a };
    addEventListener('keydown', e => {
      if (!playing || e.repeat || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea, [contenteditable]')) return;
      const k = e.key.toLowerCase();
      if (S.world === 3 && snk) { if (k === 'f') { const g = snk.ghosts.find(g => !g.dead && g.sx !== undefined); if (g) blastGhost(g); } else if (k === ' ' || k === 'arrowup' || k === 'arrowright' || k === 'w' || k === 'd') snakeTap(-99, -99); else return; }
      else if (k === ' ') { e.target.blur?.(); const q = kidScreen(14); onClick(q.x + 999, q.y + 999); }   // space trains and hops like a click; held space doesn't repeat
      else return;
      e.preventDefault();
    });
    function drawSnake(t, dt) {
      P1.RW = st.W * (st.W / st.H < .8 ? .6 : .42);
      const r = road3D(t, P1);
      if (straight() && !snk.done && snk.p < .99) { const y0 = Math.round(r.hz + (st.H - r.hz) * .3); for (let i = 0; i < 3; i++) { const a = ((t * 2 + i / 3) % 1), y = y0 + a * (st.H - r.hz) * .25, w = 3 + a * 5; for (let xx = -w; xx <= w; xx++) st.px(st.W / 2 + xx, y - Math.abs(xx) * .6, 0xfffbe0, .4 + .6 * (1 - a)); } }   // chevrons on a straight: a tap here dashes
      streakTag(t); hud(t, dt, snk.p, [0xd4a017, 0xf2e2c0]);
      st.flush();
    }
    // a meteor: a lumpy cratered rock with a dark outline, tumbling as it falls, its leading face burning white-hot, a wide fire tail and grey smoke behind
    const METEOR = { o: 0x24160c, t: [0x4a3020, 0x6b4a32, 0x8a6446, 0xa8835e], cr: 0x3a2618 };
    function drawMeteor(m, t) {
      m.sd ??= Math.random() * 9;
      const sp = Math.hypot(m.vx, m.vy) || 1, dx = m.vx / sp, dy = m.vy / sp, nx = -dy, ny = dx, x = Math.round(m.x), y = Math.round(m.y), spin = t * 1.6 + m.sd, P = METEOR;
      const rad = a => 4.6 * (1 + .16 * Math.sin(3 * (a - spin) + m.sd) + .09 * Math.sin(5 * (a - spin) + 2 * m.sd)), inside = (xx, yy) => Math.hypot(xx, yy) < rad(Math.atan2(yy, xx));
      // the fire tail, behind the rock: white at the root, flickering through yellow and orange to red, dissolving at the end
      const cols = [0xfff6d0, 0xffd24a, 0xffa53a, 0xf0662a, 0xc83a22], L = 20;
      for (let s = L; s >= 1; s -= .5) { const k = s / L, w = 4.2 * Math.pow(1 - k, .6) * (1 + .25 * Math.sin(s * .9 - t * 30 + m.sd * 7));
        for (let o = -w; o <= w; o += .5) { const X = x - dx * s + nx * o, Y = y - dy * s + ny * o; if (k > .6 && bayer(Math.round(X), Math.round(Y)) >= 1 - (k - .6) / .4) continue; st.px(X, Y, cols[Math.min(4, Math.floor((k * .8 + Math.abs(o) / (w || 1) * .4) * 5))]); } }
      // the rock: outline, shading lit from the upper left, three craters turning with it, the face it falls into glowing
      for (let yy = -6; yy <= 6; yy++) for (let xx = -6; xx <= 6; xx++) { if (!inside(xx, yy)) continue;
        const edge = !inside(xx + 1, yy) || !inside(xx - 1, yy) || !inside(xx, yy + 1) || !inside(xx, yy - 1), lead = (xx * dx + yy * dy) / 4.6;
        if (edge && lead < .35) { st.px(x + xx, y + yy, P.o); continue; }
        const lx = Math.cos(spin) * xx + Math.sin(spin) * yy, ly = -Math.sin(spin) * xx + Math.cos(spin) * yy, cr = [[1.4, -1, 1.2], [-1.6, 1.2, .9], [.4, 2, .7]].find(([a, b, r]) => Math.hypot(lx - a, ly - b) < r);
        let c = cr ? (Math.hypot(lx - cr[0], ly - cr[1]) > cr[2] - .6 && lx - cr[0] + ly - cr[1] > 0 ? P.t[3] : P.cr) : P.t[Math.max(0, Math.min(3, Math.round(1.4 + ((-xx * .6 - yy * .8) / 4.6 + (bayer(x + xx, y + yy) - .5) * .5) * 1.6)))];
        if (lead > .45) c = lead > .78 ? 0xfff6d0 : lead > .6 ? 0xffc04a : mixC(c, 0xff7a2a, .6);
        st.px(x + xx, y + yy, c); }
      for (let a = -1.5; a <= 1.5; a += .12) { const ang = Math.atan2(dy, dx) + a, r = rad(ang) + 1 + (Math.sin(a * 7 - t * 25) > .3 ? .6 : 0); st.px(x + Math.cos(ang) * r, y + Math.sin(ang) * r, Math.abs(a) < .6 ? 0xfff3c0 : 0xffa53a); }   // flame licking round the leading edge
      /*widget*/if (!BARE) /*/widget*/if (!m.dead && Math.random() < .9) { const s0 = 16 + Math.random() * 6; fx.add({ x: x - dx * s0 + (Math.random() - .5) * 3, y: y - dy * s0, vx: (Math.random() - .5) * 4, vy: -4, drag: 1.5, life: .7, s: 2, grow: 3, c: [0x9a948e, 0x7e7872, 0x625e5a, 0x4e4b48] }); }   // smoke rolling off the end
    }
    // a full charge crackles: jagged bolts off the ball and over his body, a faint tremble; once fired, bolts crawl along the beam
    const crackle = (x0, y0, x1, y1, c, put = st.px, core = 0xffffff) => { let px0 = x0, py0 = y0; const n = 6, L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / L, ny = (x1 - x0) / L;
      for (let i = 1; i <= n; i++) { const j = i === n ? 0 : (Math.random() - .5) * L * .35, qx = x0 + (x1 - x0) * i / n + nx * j, qy = y0 + (y1 - y0) * i / n + ny * j, m = Math.hypot(qx - px0, qy - py0);
        for (let d = 0; d <= m; d += .5) { const X = px0 + (qx - px0) * d / m, Y = py0 + (qy - py0) * d / m; put(X, Y, core); put(X + 1, Y, c, .7); } px0 = qx; py0 = qy; } };
    function chargeCrackle(hx, hy, r, kd) {
      const sp = BEAM().spark, ux = Math.sin(kd.ang), uy = -Math.cos(kd.ang); shake = Math.max(shake, .06);
      for (let i = 0; i < 3; i++) { const a = Math.random() * 6.28, L = r + 8 + Math.random() * 14; crackle(hx + Math.cos(a) * r, hy + Math.sin(a) * r, hx + Math.cos(a) * L, hy + Math.sin(a) * L, sp); }
      if (Math.random() < .6) { const h = 4 + Math.random() * 22, s = (Math.random() - .5) * 12; crackle(hx, hy, kd.x + ux * (liftNow + h) + Math.cos(kd.ang) * s, kd.y + uy * (liftNow + h) + Math.sin(kd.ang) * s, sp); }
    }
    function beamCrackle(w, reach, px, bp) {   // dark-cored bolts, so they read against the pale glow
      const nx = -beam.dy, ny = beam.dx, at = (d, o) => [beam.x + beam.dx * d + nx * o, beam.y + beam.dy * d + ny * o];
      for (let i = 0; i < 6; i++) { const d = 10 + Math.random() * Math.min(reach, 260), sd = Math.random() < .5 ? -1 : 1, [x0, y0] = at(d, sd * (w + 1)), [x1, y1] = at(d + 8 + Math.random() * 12, sd * (w + 5 + Math.random() * 8)); crackle(x0, y0, x1, y1, 0xffffff, px, bp.edge); }
    }
    // the flight wish: superman pose tipped forward round his middle, a white aura, and a white-blue ki streak along the orbit he just flew
    function flyDraw(t, spr, kd, flip, lift, depth, seen, draw) {
      const pal = [0xffffff, 0xcdeeff, 0x7ac8ff], N = 50, W0 = 3.6, dir = flip ? -1 : 1, tilt = 1.2, sh = spr.h * 1.05;
      const at = j => { const v = M3.ap(M, roadPt(phi - j * .013)), r = R + lift + sh * .45; return { x: cx + v[0] * r, y: cy - v[1] * r + st.bob, z: v[2] * r }; };
      for (let j = N; j >= 1; j--) { const p = at(j), q = at(j - 1), dx = q.x - p.x, dy = q.y - p.y, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, k = j / N, w = W0 * (1 - k) + .6, zi = Math.round(p.y) * st.W + Math.round(p.x);
        if (p.x >= 0 && p.y >= 0 && p.x < st.W && p.y < st.H && zb[zi] > p.z + 4) continue;   // behind the planet
        for (let s = 0; s < 1; s += .34) for (let e = -w - 1.5; e <= w + 1.5; e += .5) { const a = Math.abs(e) / w, X = p.x + dx * s + nx * e, Y = p.y + dy * s + ny * e; if (a > 1) { if (bayer(Math.round(X), Math.round(Y)) < (1 - k) * .6) st.px(X, Y, pal[2], .5); continue; } st.px(X, Y, a < .45 ? pal[0] : a < .8 ? pal[1] : pal[2], 1 - k * k * .5); } }
      const ux = Math.sin(kd.ang), uy = -Math.cos(kd.ang), a2 = kd.ang + dir * tilt, mx = kd.x + ux * (lift + sh / 2), my = kd.y + uy * (lift + sh / 2);
      if (seen) for (let i = 0; i < 3; i++) { const r = 5 + Math.random() * 7, a = Math.random() * 6.28; fx.add({ x: mx + Math.cos(a) * r, y: my + Math.sin(a) * r * .7, vx: -Math.cos(a2) * dir * 30, vy: -Math.sin(a2) * dir * 30, life: .4, s: 1, grow: 1, c: pal, raw: true }); }
      draw(spr, 0, depth, 1.05, mx - Math.sin(a2) * sh / 2, my + Math.cos(a2) * sh / 2, a2);
    }
    // a giant stomps where you tap; tail training fills a rage meter that roars for a burst and 2s more (10s at most)
    function apeTap(px, py) {
      if (apeUntil <= st.t || !(ape.giant || S.tail)) return false;
      if (st.t < ape.cd) return true; ape.cd = st.t + .2;
      if (ape.giant) { gain(Math.max(30, wrate() * .55 * (1 + apeX())), px, py - 8, true); shake = Math.max(shake, .6); burst(px, py, [0xffffff, 0xe7e2d4, 0x9a8a70], 14, 150); ui.sfx && ui.sfx('hit'); }
      if (S.tail) { ape.rage = Math.min(1, ape.rage + (ape.giant ? .04 : .08)); const h = kidScreen(APE[0].h * ape.k * .7); if (!ape.giant) { shake = Math.max(shake, .35); burst(px, py, [0xffffff, 0xe7e2d4, 0x9a8a70], 8, 110); }   // every tap lands as a stomp where you tapped, so no label or meter is needed
        if (ape.rage >= 1) { ape.rage = 0; gain(Math.max(200, wrate() * 3.2 * (1 + apeX())), h.x, h.y - 20, true); apeUntil = Math.min(ape.at + apeLen() + 10, apeUntil + 2); flashT = .6; shake = .9; ui.event('ROAAAR! +2s'); ui.fx && ui.fx('super'); burst(h.x, h.y, [0xffffff, 0xfff27a, 0xe0332b], 40, 240); } }
      return true;
    }
    function frame(t, dt) {
      // the hyperbolic time chamber: a year inside is a day outside — the world crawls while your power keeps real time
      const rdt = dt; if (chamberUntil > t && S.world !== 3) dt *= .3;   // no slow-mo on snake way: the run would crawl
      if (playing) session += dt; st.bob = (shake > 0 && !st.calm ? Math.round((Math.random() - .5) * 5 * shake) : 0); shake = Math.max(0, shake - dt);
      idleT += dt;
      if (!drag) {
        if (Math.abs(vrx) + Math.abs(vry) > .001) { M = M3.ortho(M3.mul(M3.mul(M3.rx(vrx * dt), M3.ry(vry * dt)), M)); vrx *= Math.pow(.06, dt); vry *= Math.pow(.06, dt); }
        M = M3.ortho(M3.mul(M3.ry(AUTO_SPIN * dt), M));   // a slow sideways drag that never stops, the same turn the mouse makes
      }
      // running: sprint decays; riding the golden cloud triples everything
      sprint = Math.max(0, sprint - dt * .8); riding = Math.max(0, riding - dt);
      const pace = (.42 + sprint * (S.world === 3 ? .45 : .9)) * (1 + .1 * lvl('stride')) * (wished('fast') ? 1.5 : 1) * (riding > 0 ? 1.6 : 1) * (wished('fly') && S.world !== 3 ? 1.8 : 1) * (poseUntil > t || struggle ? 0 : 1);   // he stops to pose, and to hold a beam struggle
      phi += pace * dt;
      if (phi - lastLap > 6.283) { lastLap += 6.283; if (playing) { laps++; S.lapsTotal = (S.lapsTotal || 0) + 1; ach('lap1'); if (S.lapsTotal >= 100) ach('laps100'); goal('laps'); ui.fx && ui.fx('lap'); const k = kidScreen(20); gain(lapValue() * 4 * mult() * (1 + .5 * lvl('legs')) * (wished('laps') ? 3 : 1) * (bz ? 3 : 1) * (whisUntil > t ? 2 : 1), k.x, k.y - 14, true); } }
      if (jumpH > 0 || jumpV > 0) { jumpV -= 520 * dt; jumpH = Math.max(0, jumpH + jumpV * dt); if (jumpH === 0) jumpV = 0; }
      if (playing) {
      // income: lap steps + passive, once a second
      acc += rdt; if (acc >= 1) { acc -= 1; gain((lapValue() / 7 + passive()) * mult()); }
      if ((saveAcc += dt) > 3) { saveAcc = 0; save(); }

      // ── timeline: the longer you stay, the more happens (all of it waits while you're on snake way)
      if (S.world === 3) updateSnake(t, dt); else {
      // the space pod: on phones the title covers the top of the sky, so there it flies just above the planet
      if (session > 12) { if (!star && (nextStar -= dt) < 0) { once('stars', 'a saiyan space pod — tap it');/*widget*/ ui.notify('pod');/*/widget*/ star = { x: -8, y: st.W / st.H < .8 ? cy - R * (1.12 + Math.random() * .16) : st.H * (.08 + Math.random() * .2), vx: st.W / 6 }; nextStar = (18 + Math.random() * 14) * (1 - .12 * lvl('pods')); } }
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
      if (!dance && !(fused && fused.until > t) && session > 200 && S.best >= 2e5 && !shen && !boss && !tour && S.world === home() && !cling && (nextDance -= dt) < 0) { const satanTurn = Math.random() < .2, [who, res] = satanTurn ? ['mr. satan', 'satan'] : DANCE[S.hero] || DANCE.vegeta; dance = { who, res, t0: t, beats: [t + 2, t + 2.8, t + 3.6], i: 0, hits: 0, ok: -9 }; ui.event(`${who} wants to do the fusion dance! tap on the beat: fu · sion · ha!`, 3500); nextDance = 300 + Math.random() * 120; }
      if (dance) { while (dance.i < dance.beats.length && t > dance.beats[dance.i] + .32) dance.i++;
        if (!dance.done && t > dance.beats[2] + .4) { dance.done = t; const ok = dance.hits === 3, sat = dance.res === 'satan', spr = sat ? FUSED.satan : ok ? FUSED[dance.res] : dance.hits ? FUSED.fat : FUSED.skinny;
          fused = { spr, x: sat ? 1.5 : ok ? 3 : .75, until: t + (ok || sat ? 25 : 15), fat: !sat && !ok && dance.hits > 0 }; flashT = 1; shake = .6; ui.sfx && ui.sfx('form'); ach('dance');
          ui.event(sat ? 'fusion ha! …mr. satan takes all the credit. ×1.5 for 25s' : ok ? `fusion ha! ${dance.res === 'gohanVidel' ? 'gohan and videl' : dance.res} — ×3 for 25s` : dance.hits ? 'fusion ha… you got the fat one. ×0.75 for 15s' : 'fusion ha… you got the skinny one. ×0.75 for 15s', 4000); }
        if (dance.done && t - dance.done > 1) dance = null; }
      // a saibaman clings to you now and then: tap it off before it blows
      if (!cling && session > 150 && !shen && !boss && !tour && S.world === home() && (nextCling -= dt) < 0) { cling = { boom: t + 3.5 }; ui.event('a saibaman is hugging you — tap it off!'); nextCling = 240 + Math.random() * 120; }
      if (cling && t > cling.boom) { const k = kidScreen(10); burst(k.x, k.y, [0xffffff, 0xffe08a, 0xa6e67e, 0x58b848], 30, 160); shake = .8; flashT = .6; tiredUntil = Math.max(tiredUntil, t + 6); ui.sfx && ui.sfx('boom'); ui.event('BOOM — you got yamcha\'d. tired ×0.75 for 6s'); cling = null; }
      // king kai takes his car for a spin round the road; tap it for a ride
      const carRoad = S.world !== 6 && S.world !== 10;   // no road for a car on kame house's sea or kami's lookout
      if (!car && carRoad && session > 70 && !shen && (nextCar -= dt) < 0) { car = { phi: phi + Math.PI, until: t + 16 }; ui.event("king kai's out for a drive — tap his car"); nextCar = 170 + Math.random() * 60; }
      if (car) { car.phi += .85 * dt; if (t > car.until || !carRoad) car = null; }
      if (kai && t > kai.until) kai = null;
      // the time chamber door, once you own the key
      if (S.chamber > 0 && !door && chamberUntil < t && (nextDoor -= dt) < 0) { door = { c: capPt(.25 + Math.random() * .9, Math.random() * 6.28), t0: t, until: t + 15 }; once('door', 'the time chamber door is open — tap it'); nextDoor = Math.max(40, (150 + Math.random() * 40) / (1 + .25 * lvl('chamber'))); }
      if (door && t > door.until) door = null;
      // piccolo zaps a meteor with his special beam cannon, quicker every level; each zap counts as a bust
      if (S.piccolo > 0 && (nextZap -= dt) < 0) { nextZap = Math.max(.6, 5 / (1 + .35 * (S.piccolo - 1))); const m = meteors.find(m => !m.dead && m.delay <= 0); if (m && piccoloAt) { zap = { x0: piccoloAt.x, y0: piccoloAt.y - 8, x1: m.x, y1: m.y, t0: t }; m.dead = true; goal('meteor'); gain(25 * mult() * (1 + Math.min(laps, 50) * .1), m.x, m.y - 6, true); burst(m.x, m.y, [0xffffff, 0xfff08a, 0x9a6ad8], 12, 90); ui.sfx && ui.sfx('beam'); } }
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
      // a trip at the next power mark, or after two minutes at home, whichever comes first
      if (podWish && S.world === home() && !shen && (tour || boss) && podWish !== 2) { podWish = 2; ui.event(`your space pod is incoming — it lands after the ${tour ? 'tournament' : 'fight'}`); }   // the wished pod waits for the fight, and says so
      if (S.world === home() && (S.runBest >= (S.namekAt || PLANET_EVERY) || session - homeSince > TRIP_WAIT || podWish) && !tour && !shen && !boss && !dance) { podWish = 0; S.namekAt = S.runBest * 4; S.trips = (S.trips || 0) + 1; travel([1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12][(S.trips - 1) % 11]); namekUntil = t + (S.world === 3 ? 75 : 45); }
      if (S.world && S.world !== 9 && !namekUntil) namekUntil = t + Math.min(45, S.namekLeft || 45);   // resumed after a reload
      if (S.world && S.world !== 9) { S.namekLeft = Math.max(0, namekUntil - t); const hung = t - namekUntil > 120;   // watchdog: whatever is still running, no visit outlasts its timer by two minutes
        if (S.namekLeft <= 0 && (!shen || hung) && (S.world !== 3 || snk?.done || hung)) { if (hung && shen) { shen = null; document.body.classList.remove('shen'); ui.wishDone && ui.wishDone(); } travel(home()); namekUntil = 0; homeSince = session; S.namekAt = Math.max(S.namekAt || 0, S.runBest * 2); } }   // home after any wishes; the next trip is at least twice this run's best away
      if (S.world !== 3) {
      if (S.partner >= 3 && S.best >= 50000 && fuseUntil < t && fuseOffer < t && !tour && (nextFuse -= dt) < 0) { fuseOffer = t + 12; nextFuse = 170 + Math.random() * 60; ui.event('bubbles wants to fuse — tap him!'); }
      if (!tour && !shen && !boss && S.world === home() && session > 75 && S.best >= 3000 && (nextTour -= dt) < 0) { tour = { t0: t, until: t + 60, ko: 0, next: 1.5, villain: false }; ui.event('the tournament of power begins — 60s!'); ui.fx && ui.fx('star'); }
      if (tour) {
        if ((tour.next -= dt) < 0 && saibas.length < 8) { saibas.push({ c: capPt(.2 + Math.random() * .9, Math.random() * 6.28), born: t, life: 6 }); tour.next = Math.max(.45, 1.2 - (t - tour.t0) / 80); }
        if (!tour.villain && t - tour.t0 > 28 && !boss) { tour.villain = true; const V0 = VILLAINS[(S.bosses || 0) % VILLAINS.length], hp = Math.max(400, wrate() * 18); boss = { name: V0.name === 'vegeta' && S.hero === 'vegeta' ? 'past vegeta' : V0.name, spr: V0.spr, hp, max: hp, t0: t, until: t + 25, x: 0, y: 0, k: 1, flash: 0, nextKi: 1 }; ui.event(`${V0.name} joins the tournament!`); }
        if (t > tour.until) {
          const ko = tour.ko, best = S.tourBest || 0, prize = Math.max(500, rate() * ko * 8); S.tourBest = Math.max(best, ko); gain(prize); goal('tour', ko, true);
          ui.event(ko > best ? `tournament over — ${ko} KO, new best! +${fmtShort(Math.round(prize))}` : `tournament over — ${ko} KO (best ${best}) +${fmtShort(Math.round(prize))}`); ui.fx && ui.fx('star');
          ach('tournament'); tour = null; nextTour = 240 + Math.random() * 60; nextSaiba = 30; save();
        }
      }
      // a movie villain: rare, home only, never on top of another raid, a trip or a wish
      if (!movie && S.world === home() && !boss && !ginyu && !tour && !shen && !ship && !storm && !dance && !cling && session > 240 && S.best >= 3e5 && (nextMovie -= dt) < 0) { const pool = ['cooler', 'janemba', 'bojack'].filter(w => w !== lastMovie); startMovie(movieForce || pool[Math.random() * pool.length | 0], t); movieForce = ''; nextMovie = 480 + Math.random() * 180; }
      if (movie) movieTick(t, dt);
      if (movieNote && t > movieNote.at) { ui.event(movieNote.s, 3500); movieNote = null; }
      // nappa defends planet vegeta
      if (S.world === 2 && nextNappa > 0 && !boss && !shen && (nextNappa -= dt) <= 0) { nextNappa = 0; const hp = Math.max(800, wrate() * 50); boss = { name: 'nappa', spr: NAPPA, hp, max: hp, t0: t, until: t + 35, x: 0, y: 0, k: 1, flash: 0, nextKi: 1 }; ui.event('nappa: "vegeta, let me handle this!" — tap him'); }
      // ultra instinct (or the end of the sagas) opens the multiverse, for the rest of the run
      if (!S.multi && (S.saga >= VILLAINS.length || S.form >= UI_FORM)) { S.multi = 1; S.multiT = session; nextBoss = Math.min(nextBoss, 20); topSync(); if (!S.world) travel(9); ui.event('the grand priest: "welcome to the tournament of power." — universe 9 is up first. beat each universe for a universe star', 5000); }
      if (!tour && session > 110 && !boss && !shen && S.multi && (nextBoss -= dt) < 0) {
        // past the sagas: the multiverse. three fights a universe, a fixed wall each, the villains in that universe's colour
        const u = S.uni, k = S.uniStage, who = uniFighter(u, k), hp = uniHp(u, k), last = k === UNI_STAGES.length - 1;
        boss = { name: who, tag: uniName(u) + (last ? ' boss' : ` ${k + 1}/${UNI_STAGES.length}`), sprs: fighterSpr(who, uniColour(u)), get spr() { return this.sprs[this.p || 0]; }, hp, max: hp, t0: t, until: t + uniTime(), x: 0, y: 0, k: 1, flash: 0, nextKi: 1, uni: true, badge: uniBadge(u) + (last ? ' BOSS' : ''), tc: uniColour(u) };
        ui.event(`${uniName(u)}${last ? ' — its strongest' : ''}: ${who} steps up. ${uniTime()}s to win — tap!`, 3500); ui.sfx && ui.sfx('boss'); nextBoss = 10 + Math.random() * 6;
      }
      if (!tour && session > 110 && !boss && !shen && !S.multi && (nextBoss -= dt) < 0) {
        // the next saga in story order; then the multiverse
        const n = VILLAINS.length, V0 = VILLAINS[S.saga % n], hp = Math.max(600, wrate() * 40) * (1 + .15 * S.saga), me = V0.name === 'vegeta' && S.hero === 'vegeta', twin = V0.name === 'goku black' && S.hero === 'goku';
        boss = { name: me ? 'past vegeta' : V0.name, spr: V0.spr, hp, max: hp, t0: t, until: t + 40, x: 0, y: 0, k: 1, flash: 0, nextKi: 1, saga: true };/*widget*/ ui.notify('raid', boss.name);/*/widget*/
        ui.event(`saga ${S.saga % n + 1}/${n}: ` + (me ? 'your younger self shows up, scouter and all — "that\'s MY hair!" tap him' : twin ? 'goku black is attacking — "hey, that\'s MY face!" tap him' : `${V0.name} is attacking — tap him!`), 4000); nextBoss = (160 + Math.random() * 60) / (S.zeno ? 4 : 1); krillinHit(V0.name);
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
        else if (struggle.p >= 1) { struggle = null; hitBoss(finisher(), boss.x, boss.y - boss.spr.h / 2 * boss.k); ach('struggle'); ui.event('you won the beam struggle!'); }
        else if (struggle.p <= 0 || t > struggle.until) { struggle = null; tiredUntil = t + 6; shake = .6; ui.event('lost the beam struggle — tired ×0.75 for 6s'); }
      }
      if (boss && boss.sprs && !boss.dead) {
        const low = boss.sprs[3] && boss.hp / boss.max < .4;
        if (low && !boss.pow) { boss.pow = 1; shake = .5; flashT = .4; ui.event(POWER_UP[boss.name] || `${boss.name} powers up!`, 3000); }
        boss.p = low ? 3 : boss.sprs[2] && (t - (boss.hitT ?? -9) < .4 || struggle) ? 1 + Math.floor(t * 6) % 2 : 0;
      }
      if (boss) {
        if (!boss.dead && t > boss.until) { boss.dead = true; boss.fled = true; boss.t1 = t; if (boss.uni) { nextBoss = 20; ui.event(`${boss.name} holds ${boss.tag.replace(/ (boss|\d\/\d)$/, '')} — ${Math.round(boss.hp / boss.max * 100)}% left. grow, he's back in 20s`, 3500); } else ui.event(`${boss.name} got away`); }
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
      // past the last form: a mastery star for every ×100 of held power beyond it, the best you've ever held
      if (S.form === FORMS.length - 1 && !preview && S.pl >= FORMS[S.form].at * LATE_STEP ** (S.mastery + 1)) { S.mastery++; ach('mastery'); ui.event(`mastery star ${S.mastery} — ×${MASTERY_X} on everything, kept through god ki. next at ${fmtShort(FORMS[S.form].at * LATE_STEP ** (S.mastery + 1))}`, 3500); ui.fx && ui.fx('star'); save(); }
      if (ang('auto') && S.autoAt && S.pl >= AUTO_AT[S.autoAt] && !boss && !shen && S.world === home()) ascend();   // the angels' self-ascension
      if (ang('staff') && bz) whisUntil = Math.max(whisUntil, t + 1);
      if (!zen && zenoReady() && playing && !shen && S.world === home()) { zen = { c: capPt(.4, 1.7), t0: t }; ui.event('zeno-sama is here. "you\'re strong! let\'s be friends!" — tap him for the zeno button', 5000); ui.sfx && ui.sfx('dragon'); }
      if (star) { star.x += star.vx * dt; star.y += Math.sin(t * 3) * .3; if (Math.random() < .9) fx.add({ x: star.x - 7, y: star.y + (Math.random() - .5) * 4, vx: -30, vy: 0, life: .45, s: 2, c: [0xffffff, 0xffd84a, 0xff8a3a], raw: true }); if (star.x > st.W + 12) star = null; }
      for (const m of meteors) { if (m.delay > 0) { m.delay -= dt; continue; } m.x += m.vx * dt; m.y += m.vy * dt; }
      meteors = meteors.filter(m => !m.dead && m.y < st.H + 10);
      if (cloudFly) { const k = kidScreen(10); cloudFly.x += (k.x - cloudFly.x) * dt * 1.8; cloudFly.y += (k.y - 10 - cloudFly.y) * dt * 1.8; if (Math.hypot(k.x - cloudFly.x, k.y - 10 - cloudFly.y) < 6) { cloudFly = null; riding = 10 + S.cloud * 2; ui.event('riding flying nimbus — ×1.5'); } }
      if (S.world !== 3) for (const o of orbs) { let d = Math.atan2(Math.sin(o.phi - phi), Math.cos(o.phi - phi)); if (Math.abs(d) < .06 && !o.done) { o.done = true; const k = kidScreen(16); gain(lapValue() * mult() * (o.star ? 3 : 1), k.x, k.y - 12, true); if (o.star) { goal('ball'); S.orbs7++; if (S.orbs7 >= 7) { S.orbs7 = 0; summon(); } else ui.event(`dragon ball ${S.orbs7}/7`); save(); } for (let i = 0; i < 12; i++) fx.add({ x: k.x, y: k.y - 10, vx: (Math.random() - .5) * 90, vy: (Math.random() - .5) * 90, drag: 3, life: .6, c: [0xffffff, 0xffd84a, 0xff9a3c], raw: true }); } }
      for (let i = orbs.length - 1; i >= 0; i--) if (orbs[i].done) orbs.splice(i, 1);
      if (t - lastClick > .9) combo = 1;
      if ((session > 40 || S.world === 2) && S.world !== 3 && !moon && apeUntil < t && (nextMoon -= dt) < 0) { moon = { x: st.W * .2, y: st.H * .22, r: Math.max(9, Math.round(Math.min(st.W, st.H) * .07)), a: 0, born: t }; once('moon', 'a full moon is rising… click it to transform'); }
      { const n = !!moon && !moon.leaving || apeUntil > t; if (n !== night) { night = n; ui.night && ui.night(n); } nightK = Math.max(0, Math.min(1, nightK + (night ? dt : -dt) / .8)); }   // the full moon brings the night
      if (moon && (S.tail || S.bigApe) && moon.a > .3 && !moon.leaving && t - moon.born > 6 && apeUntil < t) onClick(moon.x, moon.y);   // you stared at the moon too long
      if (apeUntil > t && S.tail) ape.rage = Math.max(0, ape.rage - dt * .1);
      if (moon) { moon.a = moon.leaving ? moon.a - dt * 1.5 : Math.min(1, moon.a + dt * 1.2); if (!moon.leaving && t - moon.born > 12) moon.leaving = true; if (moon.a <= 0 && moon.leaving) { moon = null; nextMoon = S.world === 2 ? 40 : 180 + Math.random() * 60; } }

      if (drag && (drag.moved <= 6 || charging > 0) && S.galick > 0 && t - drag.t > .3) charging = Math.min(2.5, t - drag.t - .3); else if (!drag) charging = 0;
      if (S.senzu > 0 && !bean && (nextBean -= dt) < 0) { bean = { c: V.mul(capPt(.3 + Math.random() * .9, Math.random() * 6.28), 1.03) }; nextBean = 40 / S.senzu; once('bean', 'a senzu bean sprouted — tap it'); }
      const fxs = [];
      if (S.world && S.world !== 9) { const left = Math.max(0, namekUntil - t); const wn = ['', 'namek', 'vegeta', 'snake way', 'beerus', 'west city', 'kame house', 'paozu', 'the future', 'the arena', 'lookout', 'kai world', 'yardrat'][S.world]; if (bz) fxs.push(bz.awake ? 'beerus AWAKE ×0.25 — find pudding' : `noise ${Math.round(bz.noise * 100)}%`); fxs.push(S.world === 3 && snk ? `${wn} ${Math.floor(snk.p * 100)}%` : left > 60 ? `${wn} ${Math.ceil(left / 60)}m` : `${wn} ${Math.ceil(left)}s`); }
      if (storm && t < storm.until) fxs.push(`meteor storm ${Math.ceil(storm.until - t)}s`);
      if (struggle) fxs.push(`struggle ${Math.ceil(struggle.until - t)}s`);
      if (boss && boss.uni && !boss.dead) fxs.push(`${boss.tag} ${Math.ceil(boss.until - t)}s`);
      if (greg) fxs.push(`gregory ${Math.ceil(greg.until - t)}s`);
      if (chamberUntil > t) fxs.push(`time chamber ×${chamberX()} ${Math.ceil(chamberUntil - t)}s`);
      if (laughUntil > t) fxs.push(`laughing ×1.25 ${Math.ceil(laughUntil - t)}s`);
      if (ginyu && !ginyu.done) fxs.push(`ginyu force ${Math.ceil(ginyu.until - t)}s`);
      if (movie) { const s = movieFx(t); if (s) fxs.push(s); }
      if (fuseUntil > t) fxs.push(`fusion ×2 ${Math.ceil(fuseUntil - t)}s`);
      if (whisUntil > t) fxs.push(`whis' training: laps ×2, taps ×2 noise ${Math.ceil(whisUntil - t)}s`);
      if (chiUntil > t) fxs.push(`chi-chi ×1.5 ${Math.ceil(chiUntil - t)}s`);
      for (const [k, name] of [['fly', 'flight laps ×1.8'], ['fast', 'nimbus legs'], ['taps', 'golden fists ×3'], ['idle', 'clones ×3 idle'], ['laps', 'laps ×3'], ['crit', 'all crits'], ['combo', 'max combo']]) if (wished(k)) fxs.push(`${name} ${Math.ceil(wishBuff[k] - t)}s`);   // wishes still running
      if (preview) fxs.push(`${FORMS[S.form].name} (wish) ${Math.ceil(preview.until - t)}s`);
      if (dailyUntil > t) fxs.push(`daily ×1.25 ${Math.ceil((dailyUntil - t) / 60)}m`);
      if (tour) fxs.push(`tournament ${Math.ceil(tour.until - t)}s · ${tour.ko} KO`);
      if (kaioUntil > t) fxs.push(`kaioken ×${KAIO()} ${Math.ceil(kaioUntil - t)}s`); else if (tiredUntil > t) fxs.push(`tired ×0.75 ${Math.ceil(tiredUntil - t)}s`);
      if (boostUntil > t) fxs.push(`boost ×2 ${Math.ceil(boostUntil - t)}s`);
      if (senzuUntil > t) fxs.push(`senzu ×1.5 ${Math.ceil(senzuUntil - t)}s`);
      if (riding > 0) fxs.push('nimbus ×1.5');
      if (carUntil > t) fxs.push(`king kai's car ×1.5 ${Math.ceil(carUntil - t)}s`);
      if (apeUntil > t) fxs.push(`${ape.giant ? 'giant ape' : 'great ape'} ×${1 + apeX()} ${Math.ceil(apeUntil - t)}s`);
      const extra = [S.form ? FORMS[S.form].name + ' ×' + FORMS[S.form].x : (S.pl > 2000 ? 'next form at 20K' : ''), S.orbs7 || S.granted ? `dragon balls ${S.orbs7}/7` : '', S.granted ? `wishes ${S.granted}` : '', S.multi ? `${uniName(S.uni)} · fight ${S.uniStage + 1}/${UNI_STAGES.length}` : S.saga || session > 110 ? `saga ${S.saga + 1}/${VILLAINS.length}` : '', core() > ceiling() ? (S.multi ? 'ki ceiling — it rises with time; clearing universes lifts it too' : 'ki ceiling — reach ultra instinct or finish the sagas: the multiverse lifts it') : '', S.ustars ? `universe stars ${S.ustars} ×${fmtShort(Math.round(STAR_X ** (S.ustars * (ang('stars') ? 2 : 1))))}` : '', S.mastery ? `mastery ${S.mastery}` : '', S.seeds ? `ki seeds ${S.seeds}` : '', S.ascend ? `ki seeds ×${seedBoost().toFixed(1)}` : '', S.godTotal ? `god ki ${S.godki} · ×${fmtShort(godBoostOf(S.godTotal))}` : '', S.zeno ? `zeno's favour ×${fmtShort(ZENO_X ** S.zeno)}` : '', S.krillinAlly ? 'krillin: idle ×1.5' : ''].filter(Boolean).join(' · ');
      const nf = FORMS[S.form + 1] || { name: `mastery ${S.mastery + 1}`, at: FORMS[S.form].at * LATE_STEP ** (S.mastery + 1) }, cf = FORMS[S.form];
      const G = GOALS.find(g => g.id === S.goal.id);
      ui.update({ goal: { text: G.text, p: Math.min(S.goal.p, G.n), n: G.n }, kaio: { own: S.kaio > 0, ready: t >= kaioReady, left: Math.ceil(kaioReady - t) }, pl: S.pl, best: S.best, rate: rate(), laps, time: session, effects: fxs.join(' · '), extra, combo, form: { name: S.form ? cf.name : 'base', x: cf.x, next: nf ? nf.name : '', p: nf ? Math.min(1, S.pl / nf.at) : 1 }, balls: S.orbs7, wishes: S.granted, ascend: S.ascend ? seedBoost().toFixed(1) : '', snake: S.world === 3, busy: S.world === 3 || !!(boss && !boss.dead) || !!(ginyu && !ginyu.done) || !!moon || !!storm });   // busy: something up in the sky the phone title would cover
      syncShop();
      }

      shenStep(t);/*widget*/ if (st.headless) return;/*/widget*/
      // ── draw
      st.clear(); zb.fill(-1e9); ib.fill(0);
      if (S.world === 3 && snk) { drawSnake(t, dt); return; }
      if (S.world === 9) drawVoid(t); else /*widget*/if (BARE) { if (st.clouds) drawClouds(t, false); } else /*/widget*/drawSea(t, false);
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
      const kd = kidScreen(), set = fuseUntil > t ? HERO().fused : HERO().forms[FORMS[S.form].i];
      const ahead = M3.ap(M, roadPt(phi + .05)), ax = cx + ahead[0] * R, flip = ax < kd.x;
      const surf = S.world === 6;
      const fly = wished('fly') && !surf && apeUntil <= t, spr = poseUntil > t || struggle ? set.pose : jumpH > 1 || surf || fly ? set.run[0] : set.run[Math.floor(t * (9 + sprint * 10)) % 4];
      const lift = jumpH + (riding > 0 ? 9 : 0) + (surf && !riding ? 3 + Math.sin(t * 4) : 0) + (fly ? 18 : 0), depth = kd.v[2] * R + 6; flipNow = flip; liftNow = lift;
      // auras and sparks only while he's in view: behind the planet the depth buffer hides him, and must hide them too
      const seen = (() => { const x = Math.round(kd.x + Math.sin(kd.ang) * (lift + 8)), y = Math.round(kd.y - Math.cos(kd.ang) * (lift + 8)); return x < 0 || y < 0 || x >= st.W || y >= st.H || zb[y * st.W + x] <= depth + 4; })();
      if (riding > 0) blitZ(puff, kd.x, kd.y, kd.ang, flip, lift - 9, depth + 1, 1.25, true);
      if (surf && !riding) { blitZ(SURFBOARD, kd.x, kd.y, kd.ang, flip, lift - 2, depth + 1, 1.1);   // the board under you, bobbing on the swell, kicking up spray
        if (seen && Math.random() < .45) { const bx = kd.x + Math.sin(kd.ang) * lift + (flip ? 10 : -10) * Math.cos(kd.ang), by = kd.y - Math.cos(kd.ang) * lift + (flip ? 10 : -10) * Math.sin(kd.ang); fx.add({ x: bx, y: by, vx: (flip ? 20 : -20) + (Math.random() - .5) * 20, vy: -20 - Math.random() * 25, drag: 2, life: .5, c: [0xffffff, 0xcfe6f2], raw: true }); } }
      if (seen && (aura || boostUntil > t || riding > 0 || S.form > 0 || kaioUntil > t || S.aura)) for (let i = 0; i < (S.form > 0 ? 4 : 3); i++) { const a = kd.ang + (Math.random() - .5) * .9, r = 4 + Math.random() * 8; fx.add({ x: kd.x + Math.sin(kd.ang) * (lift + 10) + Math.cos(a) * r, y: kd.y - Math.cos(kd.ang) * (lift + 10) + Math.sin(a) * r * .5, vx: Math.sin(kd.ang) * 20, vy: -Math.cos(kd.ang) * 30, life: .5, s: 1, grow: 1, c: kaioUntil > t ? [0xffffff, 0xff9a8a, 0xe0332b] : !S.form && S.aura ? AURAS[(S.aura - 1) % AURAS.length] : FORMS[S.form].aura, raw: true }); }
      // super saiyan 2+: crackling sparks around him
      if (seen && FORMS[S.form].sparks && Math.random() < .35) { let x = kd.x + (Math.random() - .5) * 22, y = kd.y - Math.cos(kd.ang) * (lift + 14) + (Math.random() - .5) * 26; for (let k = 0; k < 6; k++) { st.px(x, y, FORMS[S.form].sparks); x += (Math.random() - .5) * 4; y += 1 + Math.random() * 2; } }
      const drawHero = (s, l, d, k, x = kd.x, y = kd.y, a = kd.ang) => { blitZ(s, x, y, a, flip, l, d, k); if (kaioUntil > t) kaioAura(s, x, y, a, flip, l, d, k, t); };   // x, y, a: the flight pose draws him from his own pivot
      if (apeUntil > t) {
        // giant ape stomps: a little hop each step and a screen shake on landing
        const step = Math.floor(t * 3.2); if (step !== apeStep) { apeStep = step; shake = Math.max(shake, .35); for (let k = 0; k < 8; k++) fx.add({ x: kd.x + (Math.random() - .5) * 30, y: kd.y, vx: (Math.random() - .5) * 60, vy: -20 - Math.random() * 30, drag: 2, life: .5, s: 2, c: [0xffffff, 0xe7e2d4], raw: true }); }
        const ux = Math.sin(kd.ang), uy = -Math.cos(kd.ang), half = Math.min((kd.x + ux * lift) / (1.001 - ux), (st.W - kd.x - ux * lift) / (1.001 + ux), (kd.y + uy * lift) / (1.001 - uy), (st.H - kd.y - uy * lift) / (1.001 + uy)) - 3;
        ape.k += (Math.max(1.5, Math.min(apeWant(), 2 * half / Math.max(APE[0].w, APE[0].h))) - ape.k) * Math.min(1, dt * 2);   // he grows only into the room the canvas has where he stands, so a big ape does not run off a phone screen
        drawHero(APE[step % 2], lift + Math.abs(Math.sin(t * 3.2 * Math.PI)) * 3, depth + 30, ape.k);
      } else if (fused && fused.until > t) drawHero(fused.fat ? fused.spr[Math.floor(t * 4) % 4] : fused.spr, lift, depth, 1.05);
      else if (fly) flyDraw(t, spr, kd, flip, lift, depth, seen, drawHero);
      else drawHero(spr, lift, depth, 1.05);
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
      if (W2L[S.world]) drawW2(t, dt);
      if (S.world === 5) { const v = M3.ap(M, capPt(.55, 3.2)); if (v[2] > .05) blitZ(BULMA, cx + v[0] * R, cy - v[1] * R + st.bob, Math.atan2(v[0], v[1]), Math.floor(t / 2) % 2 === 0, 0, v[2] * R + 6, 1); }
      if (S.world === 7) drawPaozu(t);
      if (S.world === 9) drawTopFront();
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
      if (zen) { const v = M3.ap(M, zen.c), up = Math.min(1, (t - zen.t0) / .6); if (v[2] > .05) { zen.sx = cx + v[0] * R; zen.sy = cy - v[1] * R + st.bob; blitZ(ZENO, zen.sx, zen.sy, Math.atan2(v[0], v[1]), Math.floor(t / 3) % 2 === 0, (up - 1) * 24 + Math.abs(Math.sin(t * 2.5)) * 2, v[2] * R + 6, 1); } else zen.sx = undefined; }
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
        if (charging >= 2.4) chargeCrackle(hx, hy, r, kd);   // full: lightning crackles off the ball and over him
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
          if (beam.full) beamCrackle(w, reach, px, bp);
          if (beam.z > 0 && Math.random() < .8) fx.add({ x: beam.x + beam.dx * Math.random() * 80, y: beam.y + beam.dy * Math.random() * 80, vx: (Math.random() - .5) * 60, vy: (Math.random() - .5) * 60, life: .4, c: [0xffffff, bp.spark, bp.edge], raw: true });
        }
      }
      if (sprint > .3 && Math.random() < .6) fx.add({ x: kd.x, y: kd.y, vx: (Math.random() - .5) * 30, vy: -10, drag: 3, life: .4, s: 1, grow: 1.5, c: [0xffffff, 0xe7e2d4], raw: true });
      if (cloudFly) st.blit(puff, cloudFly.x - 13, cloudFly.y - 9, false, true);
      if (boss) {
        const k = boss.k = Math.max(.9, R / 62), ent = Math.min(1, (t - boss.t0) / 1.2), out = boss.dead ? Math.min(1, (t - boss.t1) / 1.2) : 0;
        boss.x = cx + R * 1.45 + (1 - ent) * st.W * .4 + (boss.fled ? out * st.W * .5 : 0); boss.y = cy - R * .75 + Math.sin(t * 2) * 3 - (boss.fled ? out * 30 : 0);
        boss.x = Math.min(boss.x, st.W - Math.max((boss.spr.w - boss.spr.ax + 1) * k, st.textWidth(boss.name) / 2 + 1, 10 * k + 1) - 3 + (1 - ent) * st.W * .4 + (boss.fled ? out * st.W * .5 : 0));
        boss.flash = Math.max(0, boss.flash - dt);
        if (!(boss.dead && !boss.fled)) {
          const spr = boss.spr, W = st.W;
          for (let j = 0; j < spr.h; j++) for (let i = 0; i < spr.w; i++) { const c = spr.col[j * spr.w + (spr.w - 1 - i)]; if (c < 0) continue; for (let yy = 0; yy < k; yy++) for (let xx = 0; xx < k; xx++) st.px(boss.x + (i - spr.ax) * k + xx, boss.y + (j - spr.h) * k + yy, boss.flash > 0 ? 0xffffff : c); }
          // health bar and name
          const bw = Math.round(20 * k), bx = Math.round(boss.x - bw / 2), by = Math.round(boss.y - spr.h * k - 7), f = Math.max(0, boss.hp / boss.max);
          for (let x = -1; x <= bw; x++) for (let y = -1; y <= 2; y++) st.px(bx + x, by + y, x < 0 || x === bw || y < 0 || y === 2 ? 0x1d1030 : x < bw * f ? (f > .3 ? 0x34d873 : 0xe0473e) : 0xffffff);
          const nm = boss.name.toUpperCase(), nx = Math.round(boss.x - st.textWidth(nm) / 2);
          for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) st.text(nm, nx + ox, by - 8 + oy, 0xffffff); st.text(nm, nx, by - 8, 0x1d1030);
          if (boss.badge) { const bx2 = Math.round(boss.x - st.textWidth(boss.badge) / 2); for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) st.text(boss.badge, bx2 + ox, boss.y + 3 + oy, 0x1d1030); st.text(boss.badge, bx2, boss.y + 3, boss.tc); }   // the universe badge, under his feet
        }
      }
      if (movie) movieDraw(t, dt);
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
      for (const m of meteors) if (m.delay <= 0) drawMeteor(m, t);
      fx.step(st, dt);
      if (star) st.blit(POD, star.x - 7, star.y - 7, false, true);   // in front of the planet
      if (gero) { const h = handPos(); if (t - gero.t0 > 1.2) for (let i = 0; i <= 1; i += .02) if ((i * 50 + t * 20) % 4 < 2) st.px(h.x + (gero.x - h.x) * i, h.y + (gero.y - gero.spr.h * .55 - h.y) * i, 0xe0473e); st.blit(gero.spr, gero.x - gero.spr.w / 2, gero.y - gero.spr.h + Math.sin(t * 3) * 2, true, true); }
      /*widget*/if (BARE) { if (st.clouds && S.world !== 9) drawClouds(t, true); } else /*/widget*/if (S.world !== 9) drawSea(t, true);
      if (flashT > 0) { flashT = Math.max(0, flashT - dt * 1.8); const a = flashT * flashT * .85; for (let k = 0; k < st.buf.length; k++) { if (/*widget*/(!BARE || st.buf[k] >>> 24) && /*/widget*/bayer(k % st.W, (k / st.W) | 0) < a) st.buf[k] = 0xffffffff; } }
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
    }/*widget*/
    // widget clouds: whole puffs with their own edges (the widget's rim pass outlines them) instead of the screen-wide sea.
    // five arrangements, st.clouds = 'a' bank under the planet, 'b' halo round it, 'c' drifting clusters, 'd' a plate,
    // 'e' a band along the bottom of the canvas, which ends just above the dock, like the site's cloud sea
    function cloudPuff(x0, y0, r, pal, pale = 0) {
      for (let y = Math.floor(y0 - r); y <= y0 + r; y++) for (let x = Math.floor(x0 - r); x <= x0 + r; x++) {
        const dx = x - x0, dy = y - y0; if (dx * dx + dy * dy > r * r) continue;
        const v = -(dx * .5 + dy * .9) / r + bayer(x, y) * .3;
        st.px(x, y, pal[Math.min(3, (v > .65 ? 3 : v > .2 ? 2 : v > -.4 ? 1 : 0) + pale)]);   // pale: tones shifted toward the light one
      }
    }
    function cloudPuffs(t) {
      const P = [], add = (x, y, r, f, pale = 0) => P.push({ x, y, r, f, pale }), bob = (i, k = .02) => Math.sin(t * .4 + i * 1.7) * R * k;
      if (st.clouds === 'e') {   // like the site's cloud sea: four staggered rows along the dock (400pt wide at most), rising
        // well above it; back rows smaller and paler, each row swaying at its own pace; the front row passes in front
        const span = Math.min(st.W, 404 / st.scale), x0 = (st.W - span) / 2;
        for (let L = 0; L < 4; L++) {
          const rb = R * (.13 + .05 * L), step = rb * (1.1 + .25 * (3 - L)), n = Math.max(3, Math.ceil((span - 2 * rb) / step) + 1), gap = (span - 2 * rb - 2) / (n - 1);
          for (let i = 0; i < n; i++) {
            const h = hash(i * 7.1 + L * 13.3), r = rb * (.7 + .6 * h), sway = Math.sin(t * (.12 + .06 * L) + i * 1.9 + L * 2.1) * rb * .25;
            add(x0 + rb + 1 + (i + (L % 2 ? .5 * (i < n - 1) : 0)) * gap + sway, st.H - r - 1 - R * .2 * (3 - L) - hash(i * 3.7 + L * 5.9) * rb * (L === 3 ? .5 : .9) + bob(i * 4 + L, .01), r, L === 3, L < 2 ? 1 : 0);
          }
        }
      } else if (st.clouds && st.clouds[0] === 'e') {   // dock-cloud variants. the canvas reaches the pill's middle (html.cloudbed),
        // so puffs can sit behind its top edge: the pill rests in them. pt: the pill's top, hw: half its width, in canvas px
        const vmin = Math.min(innerWidth, innerHeight), ph = (Math.min(26, Math.max(18, vmin * .07)) + 8) / st.scale, pt = st.H - ph / 2;
        const xc = st.W / 2, hw = Math.min(st.W / 2 - 6 / st.scale, 200 / st.scale), k = st.clouds[1];
        const sway = (i, L) => Math.sin(t * (.12 + .06 * L) + i * 1.9 + L * 2.1) * R * .03;
        if (k === '1') {   // nestled: a row straddling the pill's top edge, then rows above with tall puffs and dips
          for (let L = 0; L < 4; L++) {
            const rb = R * (.13 + .045 * L), n = Math.ceil(hw * 2 / (rb * 1.15)) + 1;
            for (let i = 0; i < n; i++) {
              const u = n > 1 ? i / (n - 1) * 2 - 1 : 0, h = hash(i * 5.3 + L * 11.7), tall = h > .62 ? 1 : h < .25 ? -.6 : 0;
              add(xc + u * (hw + rb * .3) + sway(i, L), pt - rb * .15 - R * .11 * (3 - L) * (1 + tall * .7) - (L < 3 ? h * rb * .5 : 0) + bob(i * 4 + L, .01), rb * (.75 + .55 * h), L === 3, L < 2 ? 1 : 0);
            }
          }
        } else if (k === '2') {   // mound: columns of puffs under an arch that peaks under the planet and tapers to the pill's ends
          const rb = R * .2, cols = Math.ceil(hw * 2 / (rb * 1.05)) + 1;
          for (let i = 0; i < cols; i++) {
            const u = i / (cols - 1) * 2 - 1, top = R * (.15 + .85 * (1 - u * u) ** 1.4), rows = Math.max(1, Math.round(top / (rb * .9)));
            for (let j = 0; j < rows; j++) { const h = hash(i * 3.1 + j * 7.7), r = rb * (.8 + .45 * h) * (1 - .25 * Math.abs(u)); add(xc + u * hw + sway(i, j), pt - j * rb * .9 - h * rb * .25 + bob(i + j * 9, .01), r, j === 0, j >= 2 ? 1 : 0); }
          }
        } else if (k === '3') {   // scattered sea: separate groups at different heights, sky between them
          const g = 6;
          for (let q = 0; q < g; q++) {
            const u = (q + .5) / g * 2 - 1, h = hash(q * 9.3), lift = R * (.08 + .5 * h), x = xc + u * hw * .92 + sway(q, 1) * 2, y = pt - lift, rb = R * (.13 + .07 * hash(q * 4.1)), m = 3 + Math.round(h), low = lift < R * .25;
            for (let j = 0; j < m; j++) { const o = j - (m - 1) / 2; add(x + o * rb * 1.05, y + Math.abs(o) * rb * .35 + bob(q * 5 + j, .012), rb * (.75 + .3 * hash(q * 2 + j)) * (1 - Math.abs(o) * .12), low, low ? 0 : 1); }
            add(x + (h - .5) * rb, y - rb * .75, rb * 1.05, low, low ? 0 : 1);   // a crown on each group, so it puffs up instead of lying flat
          }
        } else {   // '4' cuffs: a low bed along the pill, and cloud columns hugging both ends that climb up the sides
          const rb = R * .17, n = Math.ceil(hw * 2 / (rb * 1.3)) + 1;
          for (let i = 0; i < n; i++) { const u = i / (n - 1) * 2 - 1; add(xc + u * hw + sway(i, 3), pt - rb * .2 - hash(i * 6.1) * rb * .4 + bob(i, .01), rb * (.85 + .3 * hash(i * 2.9)), true); }
          for (const side of [-1, 1]) for (let j = 0; j < 5; j++) {
            const h = hash(j * 3.3 + (side + 1) * 5), r = rb * (1.35 - j * .12) * (.85 + .3 * h);
            add(xc + side * (hw - r * .4 - h * rb * .6) + sway(j, side + 1), pt - rb * .4 - j * rb * 1.05 + bob(j * 2 + side, .01), r, j < 2, j > 1 ? 1 : 0);
            if (j < 4) add(xc + side * (hw - rb * 1.6 - j * rb * .8), pt - rb * .3 - j * rb * .6, rb * (1.05 - j * .1), false, j > 1 ? 1 : 0);
          }
        }
      } else if (st.clouds === 'b') {   // a tilted ring of puffs round the planet: the far half behind it, the near half in front
        for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2 + t * .06; add(cx + Math.cos(a) * R * 1.3, cy + R * .12 + Math.sin(a) * R * .36, R * (.11 + .04 * hash(i * 2.1)), Math.sin(a) > 0); }
      } else if (st.clouds === 'c') {   // three loose clusters, one in front, drifting a little
        [[-1, .5, false], [1.02, .18, false], [-.1, 1.02, true]].forEach(([u, v, f], k) => {
          const x = cx + u * R + Math.sin(t * .15 + k * 2) * R * .08, y = cy + v * R;
          add(x - R * .2, y + R * .03, R * .15, f); add(x, y - R * .07, R * .21, f); add(x + R * .21, y + R * .04, R * .14, f);
        });
      } else if (st.clouds === 'd') {   // a broad flat plate the planet sits on: one row behind its rim, a lower row in front
        for (let i = 0; i < 9; i++) { const u = i / 8 * 2 - 1; add(cx + u * R * 1.45, cy + R * .9 + bob(i), R * (.19 + .05 * hash(i * 3.7)), false); }
        for (let i = 0; i < 8; i++) { const u = (i + .5) / 8 * 2 - 1; add(cx + u * R * 1.38, cy + R * 1.12 + bob(i + 9), R * (.17 + .04 * hash(i * 5.3)), true); }
      } else {   // 'a': an island of puffs the planet sinks into, big in the middle, smaller to the sides
        for (let i = 0; i < 7; i++) { const u = i / 6 * 2 - 1; add(cx + u * R * 1.05, cy + R * (.8 + .12 * u * u) + bob(i), R * (.17 + .13 * (1 - u * u)), false); }
        for (let i = 0; i < 6; i++) { const u = (i + .5) / 6 * 2 - 1; add(cx + u * R * .95, cy + R * (1.02 + .06 * u * u) + bob(i + 7), R * (.15 + .09 * (1 - u * u)), true); }
      }
      return P;
    }
    function drawClouds(t, front) {
      const pal = seaPal(), m = 1;   // every puff whole inside the canvas
      for (const p of cloudPuffs(t)) {
        if (p.f !== front) continue;
        const r = Math.max(2, Math.round(p.r));
        cloudPuff(Math.round(Math.min(st.W - m - r, Math.max(m + r, p.x))), Math.round(Math.min(st.H - m - r, p.y)), r, pal, Math.min(1, p.pale));
      }
    }
    /*/widget*/
    useWorld(S.world || 0); ui.world && ui.world(S.world || 0);
    layout(); scenery(); syncShop();
    if (/ape/.test(HASH)) { session = 41; nextMoon = 0; }
    if (/ozaru/.test(HASH)) { session = 41; nextMoon = 0; S.ach.ape = S.ach.ape || Date.now(); S.best = Math.max(S.best, 5e4); S.tail = Math.max(S.tail, 3); if (/giant/.test(HASH)) S.bigApe = 1; }   // preview hooks: #ozaru (tail training lv 3), #ozaru-giant (and the giant wish)
    if (/ginyu/.test(HASH)) { session = 151; S.best = Math.max(S.best, 5e4); nextGinyu = 0; }   // preview hook: #ginyu
    if (/visitors/.test(HASH)) { session = 61; nextGreg = 0; nextKai = 0; }   // preview hook: #visitors (gregory, king kai)
    if (/raid/.test(HASH)) { session = 111; nextBoss = 0; nextSaiba = 0; }   // preview hook: #raid
    { const sg = HASH.match(/saga(\d+)/); if (sg) { S.saga = Math.max(0, +sg[1] - 1); session = 111; nextBoss = 0; } }   // preview hook: #saga3 (that saga's villain raids now)
    if (/roshi/.test(HASH)) { session = 91; nextRoshi = 0; }   // preview hook: #roshi
    if (/paozu/.test(HASH)) { S.best = Math.max(S.best, 7e6); S.namekAt = 7e6; S.trips = 6; }   // preview hook: #paozu
    if (/westcity/.test(HASH)) { S.best = Math.max(S.best, 5e6); S.namekAt = 5e6; S.trips = 4; }   // preview hook: #westcity
    if (/kame/.test(HASH)) { S.best = Math.max(S.best, 6e6); S.namekAt = 6e6; S.trips = 5; }   // preview hook: #kame
    if (/lookout/.test(HASH)) { S.best = Math.max(S.best, 5e6); S.namekAt = 5e6; S.trips = 8; }   // preview hook: #lookout (kami's lookout)
    if (/kaiworld/.test(HASH)) { S.best = Math.max(S.best, 5e6); S.namekAt = 5e6; S.trips = 9; }   // preview hook: #kaiworld (the supreme kai's world)
    if (/yardrat/.test(HASH)) { S.best = Math.max(S.best, 5e6); S.namekAt = 5e6; S.trips = 10; }   // preview hook: #yardrat
    if (/future/.test(HASH)) { S.best = Math.max(S.best, 5e6); S.namekAt = 5e6; S.trips = 7; }   // preview hook: #future (trunks' timeline)
    if (/androids/.test(HASH)) { session = 201; S.best = Math.max(S.best, 2e5); nextAndro = 0; }   // preview hook: #androids (17 and 18)
    if (/date/.test(HASH)) { session = 161; nextDate = 0; }   // preview hook: #date (18 visits krillin)
    if (/gero/.test(HASH)) { session = 141; nextGero = 0; }   // preview hook: #gero
    if (/sixteen/.test(HASH)) { session = 101; nextA16 = 0; }   // preview hook: #sixteen (16 and the birds)
    if (/beerus/.test(HASH)) { S.best = Math.max(S.best, 4e6); S.namekAt = 4e6; S.trips = 3; }   // preview hook: #beerus (his planet)
    if (/krillin/.test(HASH)) { session = 131; nextKril = 0; }   // preview hook: #krillin
    if (/seeds/.test(HASH)) S.seeds = 40;   // preview hook: #seeds (40 ki seeds to spend)
    if (/galick/.test(HASH)) S.galick = Math.max(/galick5/.test(HASH) ? 5 : 1, S.galick);   // preview hooks: #galick (hold to charge a beam), #galick5 (the final flash)
    if (/flight/.test(HASH)) setTimeout(() => { wishBuff.fly = st.t + 120; }, 800);   // preview hook: #flight (the flight wish, for two minutes)
    { const uh = HASH.match(/universe(\d+)/); if (uh) { S.saga = VILLAINS.length; S.multi = 1; S.uni = Math.max(0, LADDER.findIndex(l => l.n === +uh[1])); S.uniStage = UNI_STAGES.length - 1; S.ustars = S.uni; session = 111; nextBoss = 0; } }   // preview hook: #universe3 (that universe's boss raids now)
    if (/mui/.test(HASH)) { S.pl = S.best = 2.1e14; S.form = MUI_FORM - 1; }   // preview hook: #mui (the first form past ultra instinct; #hero-goku#mui for mastered ultra instinct)
    { const fh = HASH.match(/form(\d+)/); if (fh) { S.pl = S.best = FORMS[Math.min(+fh[1], FORMS.length - 1)].at * 1.05; S.form = Math.max(0, Math.min(+fh[1], FORMS.length - 1) - 1); } }   // preview hook: #form12 (any form by index)
    if (/godki/.test(HASH)) { S.pl = S.best = 2.1e15; S.form = MUI_FORM; S.godki = 6; S.godTotal = 3; S.gods = 1; S.multi = 1; S.saga = VILLAINS.length; S.uni = S.ustars = 2; }   // preview hook: #godki (the god ki reset is up, 6 god ki to spend)
    if (/zeno/.test(HASH)) { S.gods = ZENO_GODS; S.saga = VILLAINS.length; S.multi = 1; session = 111; }   // preview hook: #zeno (he shows up)
    if (/fusion/.test(HASH)) { S.partner = Math.max(3, S.partner); S.best = Math.max(S.best, 5e4); nextFuse = 2; }   // preview hook: #fusion
    if (/namek|porunga/.test(HASH)) { S.best = Math.max(S.best, 1e6); S.namekAt = 1e6; S.trips = 0; }   // preview hooks: #namek, #porunga (namek, then summon)
    if (/chamber/.test(HASH)) setTimeout(() => { chamberT0 = st.t; chamberUntil = st.t + 60; }, 800);   // preview hook: #chamber
    if (/buffs/.test(HASH)) setTimeout(() => { boostUntil = senzuUntil = carUntil = roshiUntil = laughUntil = calmUntil = st.t + 120; riding = 120; for (const k of ['fast', 'taps', 'idle', 'laps', 'combo']) wishBuff[k] = st.t + 120; }, 800);   // preview hook: #buffs (a long buff line)
    if (/foes/.test(HASH)) S.foes = ['raditz', 'cell', 'broly', 'goku black'];   // preview hook: #foes (villains beaten this run, for hfil)
    if (/cvlink/.test(HASH)) setTimeout(() => { S.pl = S.best = S.runBest = 9.1e15; }, 3000);   // preview hook: #cvlink (power past MAX_SAFE_INTEGER after 3s: the cv link appears)
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
    { const mv = HASH.match(/cooler|janemba|bojack/); if (mv) { movieForce = mv[0]; session = 241; homeSince = session; S.best = Math.max(S.best, 3e5); nextMovie = 0; } }   // preview hooks: #cooler, #janemba, #bojack (that movie villain raids now)
    if (/yamcha/.test(HASH)) { session = 101; nextYam = 0; }   // preview hook: #yamcha
    if (/cling/.test(HASH)) { session = 151; nextCling = 0; }   // preview hook: #cling (a saibaman hugs you)
    if (/dance/.test(HASH)) { session = 201; nextDance = 0; S.best = Math.max(S.best, 2e5); }   // preview hook: #dance (the fusion dance)
    if (/gregory/.test(HASH)) { session = 61; nextGreg = 0; }   // preview hook: #gregory (the race)
    { const tp = HASH.match(/#top/); if (tp) { const dm = HASH.match(/topdmg=([\d.]+)/), er = HASH.match(/toperase=([\d.]+)/); TOP.dmg = dm ? Math.max(0, Math.min(1, +dm[1])) : 0; if (er) er[1].split('.').forEach(u => TOP.erase(+u)); S.world = 9; useWorld(9); layout(); scenery(); ui.world && ui.world(9); namekUntil = 1e9; } }   // preview hooks: #top, #topdmg=0.7, #toperase=9.10 (the arena, its damage, emptied stands)
    if (/tournament/.test(HASH)) { session = 76; S.best = Math.max(S.best, 3000); nextTour = 0; }   // preview hook: #tournament
    if (/shenron/.test(HASH)) setTimeout(() => summon(+(HASH.match(/shenron(\d)/) || [0, 1])[1]), 800);   // preview hook: #shenron summons him   // preview hook: #ape brings the moon out at once
    FORMS = ladderOf(S.hero); S.form = Math.min(S.form, FORMS.length - 1);   // a #hero- hook may have switched the ladder
    if (S.multi && !S.world) { S.world = 9; useWorld(9); layout(); scenery(); ui.world && ui.world(9); }   // multiverse hooks open in the arena
    if (S.multi) topSync();
    S.runBest = Math.max(S.runBest, S.best);   // hooks raise best; this run's best follows
    // the achievements / characters popup reads from here
    const menu = () => ({ seeds: S.seeds, boost: seedBoost().toFixed(1), branches: ['body', 'spirit', 'fate'].map(b => ({ name: b, pts: branchPts(b) })), tree: TREE.map(n => ({ id: n.id, branch: n.branch, tier: n.tier, need: TIER_NEED[n.tier], open: nodeOpen(n), name: n.name, what: n.what, lvl: lvl(n.id), max: nodeMax(n), cost: nodeCost(n), can: nodeOpen(n) && lvl(n.id) < nodeMax(n) && S.seeds >= nodeCost(n) })), spent: TREE.some(n => lvl(n.id)), ach: ACH.map(a => ({ ...a, done: !!S.ach[a.id] })), chars: CHARS.map(c => ({ id: c.id, name: c.name, open: heroOpen(c.id), need: c.need && ACH.find(a => a.id === c.need).text, on: S.hero === c.id })) });
    // the angels' tab: god ki buys rule changes from whis and vados
    const angels = () => ({ godki: S.godki, gods: S.gods, boost: fmtShort(godBoostOf(S.godTotal)), auto: ang('auto') ? (S.autoAt ? fmtShort(AUTO_AT[S.autoAt]) : 'off') : '', list: ANGELS.map(a => ({ ...a, on: ang(a.id), open: angelOpen(a), need: a.tier, can: !ang(a.id) && angelOpen(a) && S.godki >= a.cost })) });
    const learnAngel = id => { const a = ANGELS.find(x => x.id === id); if (!a || ang(a.id) || !angelOpen(a) || S.godki < a.cost) return; S.godki -= a.cost; S.angel[id] = 1; ach('whis'); ui.sfx && ui.sfx('buy'); save(); syncShop(); };
    const autoNext = () => { S.autoAt = (S.autoAt + 1) % AUTO_AT.length; save(); };
    const godInfo = () => ({ pl: fmtShort(Math.floor(S.pl)), gain: godNow(), now: fmtShort(godBoostOf(S.godTotal)), next: fmtShort(godBoostOf(S.godTotal + godNow())), seeds: fmtShort(S.ascend), stars: S.ustars });   // what the god ki confirm box spells out
    const zenoInfo = () => ({ now: fmtShort(ZENO_X ** S.zeno), next: fmtShort(ZENO_X ** (S.zeno + 1)), gods: S.gods, stars: S.ustars + S.mastery });
    const learn = id => { const n = TREE.find(x => x.id === id); if (!n || !nodeOpen(n) || lvl(id) >= nodeMax(n) || S.seeds < nodeCost(n)) return; S.seeds -= nodeCost(n); S.tree[id] = lvl(id) + 1; ui.sfx && ui.sfx('buy'); save(); syncShop(); };
    const respec = () => { for (const n of TREE) for (let r = 0; r < lvl(n.id); r++) S.seeds += rankCost(n, r); S.tree = {}; save(); syncShop(); };
    const pick = id => { if (!heroOpen(id)) return false; S.hero = id; FORMS = ladderOf(id); S.form = Math.min(S.form, FORMS.length - 1); save(); return true; };   // forms past ultra instinct follow the hero
    const thumb = (id, k = 4) => { const spr = (HEROES[id] || HEROES.vegeta).idle, c = document.createElement('canvas'); c.width = spr.w * k; c.height = spr.h * k; const x = c.getContext('2d'); for (let j = 0; j < spr.h; j++) for (let i = 0; i < spr.w; i++) { const v = spr.col[j * spr.w + i]; if (v < 0) continue; x.fillStyle = '#' + v.toString(16).padStart(6, '0'); x.fillRect(i * k, j * k, k, k); } return c; };
    // what the share card shows: the exact power level, the form, and the hero as he looks right now
    const card = () => ({ ach: ACH.filter(a => S.ach[a.id]).sort((a, b) => S.ach[b.id] - S.ach[a.id]).map(a => a.name), achN: ACH.length, laps, time: session, best: Math.floor(S.best), pl: Math.floor(S.pl), form: FORMS[S.form].name, hero: (CHARS.find(c => c.id === S.hero) || CHARS[0]).name, spr: (fuseUntil > st.t ? HERO().fused : HERO().forms[S.form]).idle, world: S.world, scene: st.cv,
      worldName: WORLDS[S.world].name, wishes: S.granted, orbs: S.orbs7, seeds: S.ascend, sagas: VILLAINS.length, saga: S.saga,
      peak: S.formTop > S.form ? S.formTopName : '', uni: S.multi || S.uniBest ? uniBadge(Math.max(S.uni, S.uniBest)) : '', ustars: S.ustars, godki: S.godTotal, zeno: S.zeno ? fmtShort(ZENO_X ** S.zeno) : '', mastery: S.mastery, movies: S.movies, tail: S.tail });
    const ascendInfo = () => { const g = seedsNow(); return { ok: S.pl >= cost('ascend') && S.best >= 1e6, pl: fmtShort(Math.floor(S.pl)), seeds: g, now: seedBoost().toFixed(1), next: seedBoostOf(S.ascend + g).toFixed(1), keep: lvl('head') }; };   // what the ascend confirm box spells out
    return { menu, learn, respec, ascendInfo, angels, learnAngel, autoNext, godInfo, zenoInfo, pick, thumb, card, frame, kaioken, start: () => {
      playing = true; syncShop();
      // first visit of the day: ×1.25 for five minutes and a dragon ball
      const today = new Date().toDateString();
      if (S.daily !== today) { const first = !S.daily; S.daily = today; if (!first) { dailyUntil = st.t + 300; S.orbs7 = Math.min(6, S.orbs7 + 1); setTimeout(() => ui.event('daily bonus: ×1.25 for 5 min + a dragon ball'), 900); } }
      if (/porunga/.test(HASH)) setTimeout(() => summon(), 2500);
      save();
    }, resize: layout, train: () => { const k = kidScreen(14); onClick(k.x + 999, k.y + 999); } };
  }
});
