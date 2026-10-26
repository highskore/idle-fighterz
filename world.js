/* ─────────────── painted island ───────────────
   The island is painted pixel by pixel into a baked buffer (day + night),
   like a pixel illustration rather than a block grid: chunky outlined
   boulders hanging below, a soil lip, a grass disc covered in hundreds of
   shaded leaf clumps, lily bells, round trees, a sandy clearing and a pond.
   Per frame: sky, baked island (with bob), water, particles, sprites.

   Island-plane coordinates: (u, v) in the unit disc; screen = (cx + u*rx, cy + v*ry).
*/
const GAMES = [];
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function h2(x, y) { let n = (x * 374761393 + y * 668265263) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; }
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1000003) / 1000003; }; }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = h2(xi, yi), b = h2(xi + 1, yi), c = h2(xi, yi + 1), d = h2(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];
const PK = (hex, a = 255) => ((a << 24) | ((hex & 255) << 16) | (hex & 0xff00) | ((hex >> 16) & 255)) >>> 0;
const UNPK = p => [p & 255, (p >> 8) & 255, (p >> 16) & 255, p >>> 24];

function makeSprite(rows, pal, opts = {}) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const col = new Int32Array(w * h).fill(-1), emit = new Uint8Array(w * h);
  rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const ch = row[i]; if (ch === '.' || pal[ch] === undefined) continue; col[j * w + i] = pal[ch]; if (opts.emit && opts.emit.includes(ch)) emit[j * w + i] = 1; } });
  return { w, h, col, emit, ax: opts.ax ?? Math.floor(w / 2), ay: opts.ay ?? h - 1, glow: opts.glow || 0, glowColor: opts.glowColor };
}

/* palettes */
const LEAF = [
  [0x16401c, 0x245f24, 0x37862f, 0x56ac3c, 0x9ad65e],     // deep greens
  [0x1d4618, 0x31691f, 0x4c8f2a, 0x72b83d, 0xb8e26c],     // yellower greens
];
const ROCK = { o: 0x1e100a, t: [0x3e2216, 0x5c341f, 0x7d4a2b, 0xa06a40] };
const STONE = { o: 0x1c1c22, t: [0x3e3f48, 0x5d5f6b, 0x84879a, 0xb3b7c6] };
const SAND = [0x9c7444, 0xc19a5e, 0xd8b779, 0xead09a];
const WATER = [0x173c96, 0x2457c8, 0x3a7ce6, 0x77b2ff, 0xd8ecff];

/* leaf clump stamps: digits are tone offsets (0 darkest .. 4 brightest) */
const CLUMPS = [
  ['..34..', '.2343.', '123321', '012210', '.0110.'],
  ['.34.', '2332', '1221', '.01.'],
  ['..3...', '.2343.', '122332', '011221', '.0011.'],
  ['.3..3.', '23423.', '122321', '.0110.'],
  ['..4.', '.33.', '2321', '1210', '.00.'],
  ['...34...', '..2343..', '.123332.', '01222321', '.011221.', '..0110..'],
];

function makeStage(section) {
  const el = section.querySelector('.stage'), cv = el.querySelector('canvas'), ctx = cv.getContext('2d');
  const st = { el, cv, ctx, W: 0, H: 0, scale: 3, night: false, t: 0, bob: 0 };
  let img, buf;
  st.resize = () => {
    const r = el.getBoundingClientRect();
    st.scale = r.width < 560 ? 2 : 3;
    st.W = Math.ceil(r.width / st.scale); st.H = Math.ceil(r.height / st.scale);
    cv.width = st.W; cv.height = st.H;
    img = ctx.createImageData(st.W, st.H); buf = new Uint32Array(img.data.buffer);
    st.buf = buf;
  };
  st.clear = () => buf.fill(0);
  st.flush = () => ctx.putImageData(img, 0, 0);
  st.px = (x, y, hex, a = 1) => {
    x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= st.W || y >= st.H) return;
    const k = y * st.W + x;
    if (a >= 1) { buf[k] = PK(hex); return; }
    if (a <= 0) return;
    const p = buf[k], pa = (p >>> 24) / 255;
    if (pa === 0) { buf[k] = PK(hex, Math.round(a * 255)); return; }
    const m = (s, hs) => ((p >> s) & 255) + (((hex >> hs) & 255) - ((p >> s) & 255)) * a;
    buf[k] = (((Math.max(pa, a) * 255) << 24) | (m(16, 0) << 16) | (m(8, 8) << 8) | m(0, 16)) >>> 0;
  };
  st.night = false;
  st.tint = hex => {
    if (!st.night) return hex;
    const r = (hex >> 16) & 255, g = (hex >> 8) & 255, b = hex & 255, l = (r + g + b) / 3;
    return (Math.min(255, (r * .65 + l * .35) * .3 + 3) << 16) | (Math.min(255, (g * .65 + l * .35) * .33 + 4) << 8) | Math.min(255, (b * .65 + l * .35) * .4 + 7);
  };
  st.blit = (spr, x, y, flip = false, raw = false) => {
    x = Math.round(x); y = Math.round(y);
    for (let j = 0; j < spr.h; j++) for (let i = 0; i < spr.w; i++) {
      const si = j * spr.w + (flip ? spr.w - 1 - i : i), c = spr.col[si]; if (c < 0) continue;
      st.px(x + i, y + j, raw || spr.emit[si] ? c : st.tint(c));
    }
  };
  st.glow = (lx, ly, c, R, k = .45) => {
    const W = st.W, H = st.H, cr = (c >> 16) & 255, cg = (c >> 8) & 255, cb = c & 255;
    for (let y = Math.max(0, Math.floor(ly - R)); y < Math.min(H, ly + R); y++) for (let x = Math.max(0, Math.floor(lx - R)); x < Math.min(W, lx + R); x++) {
      const d = Math.hypot(x - lx, y - ly) / R; if (d >= 1) continue;
      let a = (1 - d) * (1 - d) * k; if (a < bayer(x, y) * .12) continue;
      const i = y * W + x, p = buf[i], pa = p >>> 24;
      if (pa === 0) { buf[i] = ((((a * 230) | 0) << 24) | (cb << 16) | (cg << 8) | cr) >>> 0; continue; }
      const r = Math.min(255, (p & 255) + cr * a), g = Math.min(255, ((p >> 8) & 255) + cg * a), b = Math.min(255, ((p >> 16) & 255) + cb * a);
      buf[i] = ((Math.max(pa, (a * 230) | 0) << 24) | (b << 16) | (g << 8) | r) >>> 0;
    }
  };
  const F3 = { '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111', '+': '000010111010000', 'x': '000101010101000', ' ': '000000000000000', 'K': '101101110101101', '.': '000000000000010', "A": '010101111101101', "B": '110101110101110', "C": '011100100100011', "D": '110101101101110', "E": '111100110100111', "F": '111100110100100', "G": '011100101101011', "H": '101101111101101', "I": '111010010010111', "J": '001001001101010', "L": '100100100100111', "M": '101111111101101', "N": '110101101101101', "O": '010101101101010', "P": '110101110100100', "Q": '010101101110011', "R": '110101110101101', "S": '011100010001110', "T": '111010010010010', "U": '101101101101111', "V": '101101101101010', "W": '101101111111101', "X": '101101010101101', "Y": '101101010010010', "Z": '111001010100111', "!": '010010010000010', "'": '010010000000000', "-": '000000111000000' };
  st.text = (s, x, y, hex, a = 1) => { let cx = Math.round(x); for (const ch of String(s).toUpperCase()) { const g = F3[ch] || F3[' ']; for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === '1') st.px(cx + i, y + j, hex, a); cx += 4; } };
  st.textWidth = s => String(s).length * 4 - 1;
  st.toBuf = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * st.W, (e.clientY - r.top) / r.height * st.H]; };
  return st;
}

/* Paint an island into its own buffer. Returns the baked layers and the geometry. */
function bakeIsland(st, opts = {}) {
  const W = st.W, H = st.H, seed = opts.seed || 7, rand = rng(seed * 7919 + 13);
  const portrait = W / H < .9;
  const rx = Math.round(W * (portrait ? .4 : Math.min(.31, H / W * .52))), ry = Math.round(rx * .5);
  const cx = Math.round(W / 2), cy = Math.round(H * (portrait ? .42 : .4));
  const L = new Uint32Array(W * H);
  const put = (x, y, hex) => { x |= 0; y |= 0; if (x < 0 || y < 0 || x >= W || y >= H) return; L[y * W + x] = PK(hex); };
  const has = (x, y) => x >= 0 && y >= 0 && x < W && y < H && (L[y * W + x] >>> 24) > 0;
  const toS = (u, v) => [cx + u * rx, cy + v * ry];
  const edgeK = a => 1 + .07 * (vnoise(Math.cos(a) * 2 + seed, Math.sin(a) * 2) - .5) * 2;
  const inTop = (x, y) => { const dx = (x - cx) / rx, dy = (y - cy) / ry, a = Math.atan2(dy, dx), k = edgeK(a); return dx * dx + dy * dy <= k * k; };

  const clear = opts.clearing || (() => false);
  const pond = opts.pond || null;          // { u, v, r, toEdge: angle }

  // 1 · boulders under the island, back to front
  const boulders = [];
  const under = rx * (opts.depth ?? .95);
  for (let i = 0; i < Math.round(rx * 1.3); i++) {
    const d = Math.pow(rand(), .85), th = -.25 + rand() * (Math.PI + .5);
    const shrink = 1 - d * .82;
    const bx = cx + Math.cos(th) * rx * shrink * (.72 + .28 * rand());
    const by = cy + Math.sin(th) * ry * shrink + d * under + 3;
    const r = Math.max(2.5, rx * (.15 - d * .085) * (.7 + .55 * rand()));
    boulders.push({ bx, by, r, grey: rand() < .16, s1: rand() * 6, s2: rand() * 6 });
  }
  boulders.sort((a, b) => a.by - b.by);
  for (const b of boulders) {
    const P = b.grey ? STONE : ROCK, R = Math.ceil(b.r * 1.3);
    const inside = (x, y) => { const dx = (x - b.bx) / 1.12, dy = y - b.by, a = Math.atan2(dy, dx), rr = b.r * (1 + .16 * Math.sin(3 * a + b.s1) + .09 * Math.sin(5 * a + b.s2)); return dx * dx + dy * dy <= rr * rr; };
    for (let y = Math.floor(b.by - R); y <= b.by + R; y++) for (let x = Math.floor(b.bx - R * 1.15); x <= b.bx + R * 1.15; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      if (edge) { put(x, y, P.o); continue; }
      const nx = (x - b.bx) / b.r, ny = (y - b.by) / b.r;
      let l = -(nx * .55 + ny * .85) + (h2(x, y) - .5) * .35;
      const tv = l > .55 ? 3 : l > .05 ? 2 : l > -.45 ? 1 : 0;
      const t2 = Math.min(3, Math.max(0, tv + (bayer(x, y) < (l % .5) * .5 ? 1 : 0)));
      put(x, y, P.t[t2]);
      if (!b.grey && h2(x * 3, y * 7) > .975) put(x, y, P.t[3]);
    }
  }
  // 2 · soil lip just below the grass edge, with hanging roots
  for (let y = cy - ry - 2; y <= cy + ry + 9; y++) for (let x = cx - rx - 4; x <= cx + rx + 4; x++) {
    const dx = (x - cx) / rx, dy = (y - cy - 5) / ry, a = Math.atan2(dy, dx), k = edgeK(a) * 1.01;
    if (dx * dx + dy * dy > k * k) continue;
    const n = h2(x * 5, y * 9);
    put(x, y, n > .8 ? 0x5c341f : n > .3 ? 0x3e2216 : 0x2c170e);
  }
  for (let i = 0; i < rx * .5; i++) {
    const th = .15 + rand() * (Math.PI - .3), k = edgeK(th);
    let x = cx + Math.cos(th) * rx * k, y = cy + Math.sin(th) * ry * k + 5 + rand() * 4;
    const len = 3 + rand() * 9;
    for (let j = 0; j < len; j++) { put(x, y + j, j > len - 2 ? 0x4a8a2a : 0x2c170e); if (rand() < .3) x += rand() < .5 ? 1 : -1; }
  }
  // 3 · grass disc
  for (let y = cy - ry - 3; y <= cy + ry + 3; y++) for (let x = cx - rx - 4; x <= cx + rx + 4; x++) {
    if (!inTop(x, y)) continue;
    const n = vnoise(x * .15, y * .3), b = bayer(x, y);
    put(x, y, n + b * .25 > .8 ? 0x3f8a2c : n + b * .25 > .45 ? 0x2f7426 : 0x245f20);
  }
  // 4 · clearing and pond painted into the grass
  const sandMask = new Uint8Array(W * H);
  for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
    if (!inTop(x, y)) continue;
    const u = (x - cx) / rx, v = (y - cy) / ry;
    if (clear(u, v, 0)) {
      sandMask[y * W + x] = 1;
      const n = vnoise(x * .3, y * .5) + bayer(x, y) * .3;
      put(x, y, n > 1 ? SAND[3] : n > .7 ? SAND[2] : SAND[1]);
    }
  }
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {     // darker sand border
    if (!sandMask[y * W + x]) continue;
    if (!sandMask[y * W + x - 1] || !sandMask[y * W + x + 1] || !sandMask[(y - 1) * W + x] || !sandMask[(y + 1) * W + x]) put(x, y, SAND[0]);
  }
  const water = [];
  if (pond) {
    const inPond = (u, v) => Math.hypot((u - pond.u) / pond.r, (v - pond.v) / (pond.r * 1.1)) < 1 || (pond.stream && (() => { const ex = Math.cos(pond.stream), ey = Math.sin(pond.stream); const px = u - pond.u, py = v - pond.v, t = Math.max(0, Math.min(1.4, px * ex + py * ey)); return Math.hypot(px - ex * t, py - ey * t) < .05 && t > .2; })());
    for (let y = cy - ry; y <= cy + ry + 2; y++) for (let x = cx - rx - 2; x <= cx + rx + 2; x++) {
      if (!inTop(x, y)) continue;
      const u = (x - cx) / rx, v = (y - cy) / ry;
      if (!inPond(u, v)) continue;
      const edge = !inPond((x - 1 - cx) / rx, v) || !inPond((x + 1 - cx) / rx, v) || !inPond(u, (y - 1 - cy) / ry);
      put(x, y, edge ? WATER[0] : (vnoise(x * .3, y * .6) + bayer(x, y) * .3 > .85 ? WATER[2] : WATER[1]));
      if (!edge) water.push(y * W + x);
    }
  }
  // 5 · everything that stands on the grass, sorted by depth: leaf clumps, lilies, blossoms, trees, rocks
  const items = [];
  const n = Math.round(rx * ry * (opts.lush ?? 1.15));
  for (let i = 0; i < n; i++) {
    const a = rand() * 6.283, r = Math.sqrt(rand()), u = Math.cos(a) * r, v = Math.sin(a) * r;
    if (clear(u, v, .06) || (pond && Math.hypot((u - pond.u) / (pond.r + .07), (v - pond.v) / (pond.r * 1.1 + .07)) < 1)) continue;
    const [x, y] = toS(u, v);
    const kind = rand();
    items.push({ x, y, t: kind < .9 ? 'clump' : kind < .965 ? 'lily' : 'bloom', v: (rand() * CLUMPS.length) | 0, p: rand() < .3 ? 1 : 0 });
  }
  for (let i = 0; i < rx * 1.6; i++) {      // clumps spilling over the front rim
    const th = -.05 + rand() * (Math.PI + .1), k = edgeK(th);
    const u = Math.cos(th) * k, v = Math.sin(th) * k;
    if (pond && pond.stream !== undefined && Math.abs(Math.atan2(Math.sin(th - pond.stream), Math.cos(th - pond.stream))) < .14) continue;
    const [x, y] = toS(u, v);
    items.push({ x: x + (rand() - .5) * 2, y: y + 1 + rand() * 3, t: 'clump', v: (rand() * CLUMPS.length) | 0, p: rand() < .3 ? 1 : 0 });
    if (rand() < .35) items.push({ x: x + (rand() - .5) * 3, y: y + 5 + rand() * 4, t: 'vine', len: 3 + rand() * 6 });
  }
  for (const tr of opts.trees || []) { const [x, y] = toS(tr.u, tr.v); items.push({ x, y, t: 'tree', s: tr.s || 1, seed: rand() * 999 }); }
  for (let i = 0; i < 7; i++) { const a = rand() * 6.28, r = .35 + rand() * .55, u = Math.cos(a) * r, v = Math.sin(a) * r; if (clear(u, v, .02)) continue; const [x, y] = toS(u, v); items.push({ x, y, t: 'stone', s: 2 + rand() * 2 }); }
  items.sort((a, b) => a.y - b.y);

  const clumpAt = (x, y, ci, pal, shift = 0) => {
    const c = CLUMPS[ci], w = c[0].length, h = c.length, ox = Math.round(x - w / 2), oy = Math.round(y - h + 1);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const ch = c[j][i]; if (ch === '.') continue; let t = +ch + shift; t = Math.max(0, Math.min(4, t)); put(ox + i, oy + j, pal[t]); }
  };
  for (const it of items) {
    if (it.t === 'clump') {
      const backDark = (it.y - (cy - ry)) / (2 * ry);              // back of the island a touch darker
      const shift = (backDark < .25 ? -1 : 0) + (h2(it.x | 0, it.y | 0) > .8 ? 1 : 0);
      clumpAt(it.x, it.y, it.v, LEAF[it.p], shift);
    } else if (it.t === 'vine') {
      let x = it.x | 0; for (let j = 0; j < it.len; j++) { put(x, (it.y | 0) + j, j % 3 === 0 ? LEAF[0][3] : LEAF[0][1]); if (h2(x, j) > .7) x += 1; }
    } else if (it.t === 'lily') {
      const x = it.x | 0, y = it.y | 0;
      clumpAt(x, y + 1, 1, LEAF[0], 0);
      put(x, y - 4, 0x2f6b2a); put(x + 1, y - 5, 0x2f6b2a); put(x + 2, y - 5, 0x2f6b2a);
      for (const [dx, dy] of [[-1, -4], [1, -3], [3, -4], [2, -2]]) { put(x + dx, y + dy, 0xffffff); put(x + dx, y + dy + 1, 0xc9d3dc); }
    } else if (it.t === 'bloom') {
      const x = it.x | 0, y = it.y | 0, c = h2(x, y) > .5 ? 0xffffff : 0xfff0a6;
      put(x, y - 2, c); put(x + 1, y - 2, c); put(x, y - 1, 0xd6dde2); put(x - 2, y - 1, c); put(x - 2, y, 0xd6dde2);
    } else if (it.t === 'stone') {
      const x = it.x | 0, y = it.y | 0, s = it.s | 0;
      for (let j = -s; j <= 0; j++) for (let i = -s - 1; i <= s + 1; i++) { if ((i * i) / ((s + 1) * (s + 1)) + (j * j) / (s * s) > 1) continue; put(x + i, y + j, j === -s || Math.abs(i) === s + 1 ? STONE.o : (i < 0 && j < -s / 2 ? STONE.t[3] : STONE.t[2])); }
    } else if (it.t === 'tree') {
      const x = it.x, y = it.y, s = it.s, cr = rx * .15 * s, th = Math.round(rx * .14 * s), tr2 = rng(it.seed | 0);
      for (let j = 0; j < th; j++) for (let i = -1; i <= 1; i++) put(x + i, y - j, i < 0 ? 0x7a4d2b : i === 0 ? 0x5a3720 : 0x3d2414);
      put(x - 2, y, 0x5a3720); put(x + 2, y, 0x3d2414);
      const ccx = x, ccy = y - th - cr * .55;
      const leaves = [];
      for (let k = 0; k < cr * cr * 1.1; k++) {
        const a = tr2() * 6.283, r = Math.sqrt(tr2()) * cr, lx = ccx + Math.cos(a) * r * 1.05, ly = ccy + Math.sin(a) * r * .85;
        leaves.push([lx, ly, (lx - ccx) / cr, (ly - ccy) / cr]);
      }
      leaves.sort((p, q) => p[1] - q[1]);
      // a dark underside first so the canopy reads as a ball
      for (let k = 0; k < cr * 3; k++) { const a = (k / (cr * 3)) * Math.PI, lx = ccx + Math.cos(a) * cr * .95, ly = ccy + Math.sin(a) * cr * .7; clumpAt(lx, ly + 2, 1, LEAF[0], -2); }
      for (const [lx, ly, nx, ny] of leaves) { const l = -(nx * .6 + ny * .8); clumpAt(lx, ly, (h2(lx | 0, ly | 0) * CLUMPS.length) | 0, LEAF[0], l > .45 ? 1 : l < -.35 ? -1 : 0); }
    }
  }
  // 6 · crisp outline around the whole silhouette
  const OUT = new Uint32Array(L);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const k = y * W + x; if (L[k] >>> 24) continue;
    let nb = 0; if (L[k - 1] >>> 24) nb = k - 1; else if (L[k + 1] >>> 24) nb = k + 1; else if (L[k + W] >>> 24) nb = k + W; else if (L[k - W] >>> 24) nb = k - W;
    if (!nb) continue;
    const [r, g, b] = UNPK(L[nb]); OUT[k] = PK(((r * .35) << 16) | ((g * .35) << 8) | (b * .4));
  }
  // night copy
  const N = new Uint32Array(OUT.length);
  for (let k = 0; k < OUT.length; k++) {
    const p = OUT[k]; if (!(p >>> 24)) continue;
    const r = p & 255, g = (p >> 8) & 255, b = (p >> 16) & 255, l = (r + g + b) / 3;
    const nr = Math.min(255, (r * .65 + l * .35) * .3 + 3), ng = Math.min(255, (g * .65 + l * .35) * .33 + 4), nb = Math.min(255, (b * .65 + l * .35) * .4 + 7);
    N[k] = ((255 << 24) | (nb << 16) | (ng << 8) | nr) >>> 0;
  }
  // where the waterfall leaves the island
  let fall = null;
  if (pond && pond.stream !== undefined) { const k = edgeK(pond.stream); const [x, y] = toS(Math.cos(pond.stream) * k, Math.sin(pond.stream) * k); fall = { x, y: y + 2 }; }
  return { day: OUT, night: N, cx, cy, rx, ry, toS, water, fall, under, inTop };
}

/* composite the baked island over whatever is in the buffer, shifted by st.bob */
function drawIsland(st, isl) {
  const src = st.night ? isl.night : isl.day, buf = st.buf, W = st.W, H = st.H, b = st.bob | 0;
  for (let y = 0; y < H; y++) {
    const sy = y - b; if (sy < 0 || sy >= H) continue;
    const so = sy * W, d = y * W;
    for (let x = 0; x < W; x++) { const p = src[so + x]; if (p >>> 24) buf[d + x] = p; }
  }
}

/* sky: drifting clouds and the island's dithered shadow by day, stars by night */
function drawSky(st, isl) {
  if (st.night) {
    for (let k = 0; k < 110; k++) {
      const x = Math.floor(hash(k * 3.1) * st.W), y = Math.floor(hash(k * 7.7) * st.H), big = hash(k * 1.3) > .92;
      const tw = .3 + .7 * Math.max(0, Math.sin(st.t * (.7 + hash(k) * 2) + k));
      st.px(x, y, 0xffffff, tw * (big ? 1 : .5));
      if (big && tw > .8) for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) st.px(x + a, y + b, 0xffffff, .4);
    }
    return;
  }
  const sy = isl.cy + isl.under + isl.ry * .9 + 8, rx = isl.rx * .8, ry = rx * .14;
  for (let y = Math.floor(sy - ry); y <= sy + ry; y++) for (let x = Math.floor(isl.cx - rx); x <= isl.cx + rx; x++) {
    const d = ((x - isl.cx) / rx) ** 2 + ((y - sy) / ry) ** 2; if (d > 1) continue;
    if (bayer(x, y) < (1 - d) * .9) st.px(x, y, 0x000000, .07);
  }
}

/* square pixel particles that grow and dissolve: plumes, spray, sparkles */
function particleSystem() {
  const P = [];
  return {
    list: P,
    add(p) { P.push(Object.assign({ life: 1, age: 0, s: 1, grow: 0, vx: 0, vy: 0, g: 0, drag: 0, c: [0xffffff] }, p)); },
    step(st, dt) {
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i];
        p.age += dt; if (p.age >= p.life) { P.splice(i, 1); continue; }
        p.vy += p.g * dt; p.vx *= 1 - p.drag * dt; p.vy *= 1 - p.drag * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        const k = p.age / p.life, s = Math.max(1, Math.round(p.s + p.grow * k));
        const ci = Math.min(p.c.length - 1, Math.floor(k * p.c.length));
        // dissolve: each pixel of the square survives with falling probability
        for (let j = 0; j < s; j++) for (let i2 = 0; i2 < s; i2++) {
          const x = Math.round(p.x) + i2, y = Math.round(p.y) + j;
          if (k > .45 && bayer(x, y) < (k - .45) * 1.9) continue;
          st.px(x, y, p.raw ? p.c[ci] : st.tint(p.c[ci]));
        }
      }
    }
  };
}
