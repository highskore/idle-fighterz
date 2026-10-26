/* the eternal dragon: hand-shaped pixel heads + a scaled serpent body drawn along a path.
   four looks: 0 coil (profile head, body wraps the planet), 1 rising (front head, body behind),
   2 eight-bit (flat chunky profile, body waving over the planet), 3 colossus (giant front head) */
const SHENRON = (() => {
  const PAL = { o: 0x0b2412, G: 0x1c6a2a, g: 0x2f9a3a, l: 0x55c04f, L: 0xa6e67e, k: 0x0f3a18, c: 0xf4e7bf, C: 0xcdb47a, h: 0xeedcab, H: 0xb39a62, r: 0xff2b2b, R: 0xffe0e0, m: 0x6a1018, M: 0xb02a36, w: 0xffffff, y: 0xff9f2e, Y: 0xffe066 };
  const BODY = { o: PAL.o, t: [0x1c6a2a, 0x2f9a3a, 0x55c04f, 0xa6e67e], b: [0xcdb47a, 0xf4e7bf, 0xfff6dc], spine: 0x1c6a2a, spineHi: 0x55c04f };

  function grid(w, h) {
    const g = Array.from({ length: h }, () => Array(w).fill('.'));
    const each = (test, c) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (test(x + .5, y + .5)) g[y][x] = c; };
    return {
      g, w, h,
      set(x, y, c) { if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c; },
      rect(x, y, rw, rh, c) { for (let j = y; j < y + rh; j++) for (let i = x; i < x + rw; i++) this.set(i, j, c); },
      ell(cx, cy, rx, ry, c) { each((x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1, c); },
      poly(p, c) { each((x, y) => { let s = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const [xi, yi] = p[i], [xj, yj] = p[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) s = !s; } return s; }, c); },
      // a tapering stroke along a polyline (horns, spikes)
      line(p, w0, w1, c) {
        let L = 0; const seg = []; for (let i = 1; i < p.length; i++) { const l = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); seg.push(l); L += l; }
        let acc = 0;
        for (let i = 1; i < p.length; i++) for (let s = 0; s <= seg[i - 1]; s += .2) {
          const f = s / seg[i - 1], x = p[i - 1][0] + (p[i][0] - p[i - 1][0]) * f, y = p[i - 1][1] + (p[i][1] - p[i - 1][1]) * f, r = (w0 + (w1 - w0) * (acc + s) / L) / 2;
          for (let yy = Math.floor(y - r); yy <= y + r; yy++) for (let xx = Math.floor(x - r); xx <= x + r; xx++) if ((xx + .5 - x) ** 2 + (yy + .5 - y) ** 2 <= r * r) this.set(xx, yy, c);
          if (s + .2 > seg[i - 1]) acc += seg[i - 1];
        }
      },
      mirror() { for (let y = 0; y < h; y++) for (let x = 0; x < w / 2; x++) g[y][w - 1 - x] = g[y][x]; },
    };
  }
  // rim light on top, shadow underneath, a scatter of scales; then a dark outline around everything
  function finish(G, { scales = true, flat = false } = {}) {
    const { g, w, h } = G, src = g.map(r => r.slice()), green = (x, y) => y >= 0 && y < h && x >= 0 && x < w && src[y][x] === 'g';
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (src[y][x] !== 'g') continue;
      let up = 0; while (green(x, y - up - 1)) up++;
      let dn = 0; while (green(x, y + dn + 1)) dn++;
      if (flat) { g[y][x] = up < 2 ? 'l' : 'g'; continue; }
      g[y][x] = up === 0 ? 'L' : up === 1 ? 'l' : dn <= 1 ? 'G' : scales && up > 2 && dn > 2 && (x + 4 * Math.floor(y / 3)) % 9 === 0 && y % 3 === 0 ? 'G' : 'g';
    }
    const out = g.map(r => r.slice());
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y][x] === '.' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => (g[y + b] || [])[x + a] && g[y + b][x + a] !== '.')) out[y][x] = 'o';
    return out.map(r => r.join(''));
  }

  // 0: classic profile, facing left — long snout, open fanged jaw, heavy brow, antlers
  function profile() {
    const G = grid(52, 32);
    G.line([[31, 9], [40, 4], [50, 3]], 3.2, 1, 'H'); G.line([[42, 4], [45, 0]], 1.8, .8, 'H');
    G.line([[26, 8], [34, 2.5], [45, .8]], 3.8, 1, 'h'); G.line([[35, 2.5], [37, -.5]], 2, .8, 'h');
    G.poly([[34, 11], [49, 9], [39, 15]], 'G'); G.poly([[35, 16], [51, 18], [39, 21]], 'G'); G.poly([[33, 21], [46, 28], [36, 24]], 'G');
    G.poly([[30, 11], [41, 12], [46, 20], [44, 27], [31, 27]], 'g');
    G.ell(31, 14.5, 9, 7.5, 'g');
    G.poly([[2, 11], [6, 8.5], [14, 8], [24, 6.5], [30, 8], [31, 16], [3, 16]], 'g');
    G.ell(5.5, 10.5, 3.6, 3, 'g');
    G.poly([[4, 16], [30, 15.5], [30, 18.5], [8, 23.5]], 'm');
    G.poly([[11, 21], [27, 17.6], [28, 18.8], [13, 22.4]], 'M');
    G.poly([[8, 23.5], [30, 18.5], [33, 22], [29, 27], [12, 27]], 'g');
    G.poly([[11, 25.5], [30, 23.5], [30, 27.5], [13, 27.5]], 'c');
    G.poly([[31, 23], [43, 24], [42, 27], [31, 27]], 'c');
    for (const x of [6, 10, 14, 18, 22, 26]) { G.set(x, 16, 'w'); G.set(x, 17, 'w'); if (x === 6 || x === 14) G.set(x, 18, 'w'); }
    for (const x of [10, 15, 20, 25]) { const y = Math.round(23.5 - (x - 8) * 5 / 22); G.set(x, y - 1, 'w'); G.set(x, y - 2, 'w'); }
    G.poly([[14, 9.6], [27, 4.6], [30, 7.6], [17, 11.6]], 'k');
    G.ell(23.5, 11.2, 2.6, 1.5, 'r'); G.set(22, 10, 'R');
    G.set(3, 10, 'k'); G.set(4, 10, 'k');
    return { rows: finish(G), ax: 41, ay: 22, whiskers: [[4, 12, -1], [6, 13, -1]] };
  }
  // 1: front view, looking straight at you — the wish pose
  function front() {
    const G = grid(44, 40);
    G.line([[15, 10], [9, 5], [2, 1.5]], 3.8, 1, 'h'); G.line([[8, 4.5], [6, .5]], 2, .8, 'h'); G.line([[5, 3], [1, 4.5]], 1.6, .8, 'h');
    G.poly([[11, 16], [0, 19], [11, 21]], 'G'); G.poly([[10, 23], [1, 31], [12, 27]], 'G'); G.poly([[15, 36], [12, 40], [18, 38]], 'G');
    G.ell(22, 15, 11.5, 8.5, 'g'); G.ell(14, 22, 5.5, 5.5, 'g');
    G.poly([[12.5, 15], [22, 15], [22, 29.5], [14, 29.5], [12, 22]], 'g');
    G.ell(22, 33, 10, 5.5, 'g');
    G.poly([[14, 29], [22, 29], [22, 37], [17, 36.4]], 'm'); G.ell(22, 35.2, 4, 1.4, 'M');
    G.ell(22, 38.2, 6.5, 1.6, 'c');
    G.poly([[9.5, 11], [21.5, 15.6], [21.5, 17.8], [9.5, 13.6]], 'k');
    G.ell(15.6, 16.6, 2.8, 1.6, 'r'); G.set(14, 16, 'R');
    G.set(18, 25, 'k'); G.set(19, 25, 'k'); G.set(19, 24, 'k');
    for (let y = 29; y <= 31; y++) G.set(15, y, 'w'); G.set(18, 29, 'w'); G.set(18, 30, 'w'); G.set(20, 29, 'w');
    G.set(17, 35, 'w'); G.set(17, 34, 'w'); G.set(20, 36, 'w');
    G.mirror();
    return { rows: finish(G), ax: 22, ay: 37, whiskers: [[14, 26, -1], [29, 26, 1]] };
  }
  // 2: chunky 8-bit profile, flat colours, orange ridge
  function chunky() {
    const G = grid(34, 20);
    G.rect(16, 0, 2, 4, 'H'); G.rect(21, 1, 2, 3, 'H'); G.rect(14, 3, 11, 2, 'H');
    G.rect(10, 5, 14, 9, 'g'); G.rect(2, 6, 10, 4, 'g'); G.rect(22, 7, 12, 9, 'g'); G.rect(0, 7, 3, 3, 'g');
    G.rect(2, 10, 10, 4, 'm'); G.rect(4, 12, 6, 1, 'M');
    for (let x = 3; x < 12; x += 2) { G.set(x, 10, 'w'); G.set(x + 1, 13, 'w'); }
    G.rect(0, 10, 2, 5, 'Y'); G.rect(2, 14, 12, 2, 'g'); G.rect(2, 16, 12, 1, 'Y'); G.rect(12, 14, 22, 3, 'Y');
    G.rect(15, 7, 3, 2, 'r'); G.set(15, 7, 'R'); G.rect(13, 6, 6, 1, 'k');
    G.rect(0, 7, 1, 1, 'k');
    for (let x = 24; x < 34; x += 3) G.rect(x, 5, 2, 2, 'y');
    return { rows: finish(G, { flat: true }), ax: 29, ay: 12, whiskers: [[1, 8, -1]], flat: true };
  }
  const HEADS = [profile(), front(), chunky()];

  // porunga, namek's dragon: a horned, pointy-eared, heavily muscled giant who rises up behind the planet
  const PORUNGA = (() => {
    const G = grid(64, 58);
    G.line([[25, 11], [19, 4], [15, -1]], 4, 1.2, 'h'); G.line([[28, 9], [25, 3], [24, -1]], 2.6, 1, 'h');          // horns
    G.poly([[22, 14], [6, 8], [21, 19]], 'G');                                                                         // pointed ear
    G.ell(32, 16, 10.5, 9.5, 'g'); G.ell(32, 22, 7.5, 5.5, 'g');                                                       // head, muzzle
    G.rect(26, 23, 7, 6, 'g');                                                                                         // neck
    G.ell(32, 38, 23, 12, 'g'); G.ell(14, 33, 7, 6, 'g');                                                              // chest, shoulder
    G.line([[12, 34], [7, 43], [6, 50]], 9, 7, 'g'); G.line([[6, 50], [8, 55]], 7, 6, 'g');                            // arm, fist
    G.poly([[17, 44], [32, 45], [32, 58], [21, 58]], 'g');                                                             // waist into the body below
    for (const x of [3, 6, 9]) G.line([[x + 1, 55], [x, 58]], 1.6, 1, 'c');                                            // claws
    G.poly([[22, 11.4], [31, 15.2], [31, 16.8], [22, 13.6]], 'k');                                                     // heavy brow
    G.ell(27.5, 16, 2.6, 1.5, 'r'); G.set(26, 15, 'R');                                                                // eye
    G.rect(28, 24, 5, 1, 'm'); G.set(28, 25, 'w'); G.set(31, 25, 'w');                                                 // mouth, fangs
    G.set(30, 20, 'k'); G.set(30, 21, 'k');                                                                            // nostril
    for (let x = 17; x <= 31; x++) { const y = Math.round(38 + Math.pow((x - 31) / 14, 2) * -5); G.set(x, y + 3, 'G'); }   // pec line
    for (const y of [46, 50, 54]) for (let x = 27; x <= 31; x++) G.set(x, y, 'G');                                     // abs
    G.line([[12, 38], [10, 44]], 1.4, 1, 'G');                                                                         // bicep crease
    G.mirror();
    for (let y = 44; y <= 57; y++) G.set(31, y, 'G'), G.set(32, y, 'G');                                               // centre line
    const rows = finish(G, { scales: false });
    return makeSprite(rows, Object.assign({}, PAL, { g: 0x3a9a4a, G: 0x23683a, l: 0x5cbf5c, L: 0xb0ec8a }), { emit: 'rR', ax: 32, ay: 58 });
  })();
  // drawn behind the planet, so the planet hides his lower body; ctx is the same as draw()'s
  function drawPorunga(ctx) {
    const spr = PORUNGA, k = ctx.R * 2.7 / spr.w, rise = 1 - Math.pow(1 - ctx.rise, 3), t = ctx.t;
    const bx = ctx.cx, by = ctx.cy + ctx.R * .35 + (1 - rise) * ctx.H * 1.1 - ctx.gone * ctx.gone * ctx.H * 1.4 + Math.sin(t * 1.3) * 2;
    ctx.z = -ctx.R * 1.6;
    blit(ctx, spr, bx, by, false, k);
    if (rise > .9 && !ctx.gone) for (const ex of [27.5, 36.5]) { const x = bx + (ex - spr.ax) * k, y = by + (16 - spr.ay) * k; for (let a = 0; a < 6.28; a += .5) ctx.px(x + Math.cos(a) * (k + 1.5), y + Math.sin(a) * (k * .6 + 1), 0xff5a4a); }
  }
  for (const hd of HEADS) hd.spr = makeSprite(hd.rows, PAL, { emit: 'rR', ax: hd.ax, ay: hd.ay });

  /* body paths in planet units (x right, y down, z toward you), tail → head */
  const LOOKS = [
    { name: 'coil', head: 0, k: 1, r: .12, path: u => { if (u < .8) { const a = 2.1 + u / .8 * 6.283 * 1.55; return [Math.cos(a) * 1.38, 1.3 - u / .8 * 2.45, Math.sin(a) * 1.38]; } const v = (u - .8) / .2, a = 2.1 + 6.283 * 1.55, e = [Math.cos(a) * 1.38, -1.15]; return [e[0] + (.5 - e[0]) * v + Math.sin(v * Math.PI) * .35, e[1] + (-1.7 - e[1]) * v - Math.sin(v * Math.PI) * .25, 1.2]; } },
    { name: 'rising', head: 1, k: 1, r: .12, path: u => [Math.sin(u * 6.283 * 1.25) * 1.55 * (1 - u * .55), 1.45 - u * 3.05, -1.1 + 2.5 * Math.exp(-(((u - .2) / .08) ** 2))] },
    { name: 'eight-bit', head: 2, k: 2, r: .1, flat: true, path: u => [2.1 - u * 3.75, -1.38 + Math.sin(u * 6.283 * 2) * .26 , .5] },
    { name: 'colossus', head: 1, k: 2, r: .17, path: u => [Math.sin(u * 6.283 * 1.5 + .4) * 1.75 * (1 - u * .7), 1.35 - u * 2.75, -1.2] },
  ];

  // the entry track (a descending spiral that ends where the pose's tail starts) followed by the pose, by arc length
  const TRACKS = [];
  function track(look) {
    if (TRACKS[look]) return TRACKS[look];
    const L = LOOKS[look], P0 = L.path(0), a1 = Math.atan2(P0[2], P0[0]), r1 = Math.hypot(P0[0], P0[2]), turns = 1.75, pts = [];
    for (let i = 0; i <= 600; i++) {
      const v = i / 600, a = a1 - (1 - v) * turns * 6.283, left = (1 - v) * turns * 6.283;   // radians still to go
      const r = left > Math.PI ? 1.45 : r1 + (1.45 - r1) * (left / Math.PI);                    // wide while it can pass in front, tightening only in the last half turn
      pts.push([Math.cos(a) * r, -2.9 + (P0[1] + 2.9) * v * v * (3 - 2 * v), Math.sin(a) * r]);
    }
    const pre = pts.length; for (let i = 1; i <= 600; i++) pts.push(L.path(i / 600));
    const cum = [0]; for (let i = 1; i < pts.length; i++) { const p = pts[i], q = pts[i - 1]; cum.push(cum[i - 1] + Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])); }
    let maxX = 0, minY = 0; for (let i = pre; i < pts.length; i++) { maxX = Math.max(maxX, Math.abs(pts[i][0])); minY = Math.min(minY, pts[i][1]); }
    const total = cum[cum.length - 1], body = total - cum[pre - 1];
    const at = d => {
      if (d <= 0) { const p = pts[0]; return [p[0], p[1] + d, p[2]]; }       // before the track: straight up out of the sky
      let lo = 0, hi = cum.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] < d) lo = m; else hi = m; }
      const f = Math.min(1, (d - cum[lo]) / ((cum[hi] - cum[lo]) || 1)), p = pts[lo], q = pts[hi];
      return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, p[2] + (q[2] - p[2]) * f];
    };
    return (TRACKS[look] = { at, total, body, maxX, minY });
  }
  // ctx: { px(x, y, hex, dz) depth-tested at ctx.z + dz, W, H, cx, cy, R, t, rise (0..1), gone (0..1) }
  function draw(ctx, look) {
    const L = LOOKS[look], hd = HEADS[L.head], spr = hd.spr, W = ctx.W, H = ctx.H, t = ctx.t;
    // on arrival he flies in from the sky, spirals down round the planet and climbs into his pose:
    // one continuous 3D track, so his body only ever passes behind the planet at its edges
    const T = track(look), hk = Math.max(.7, Math.min(1.5, ctx.R / 60)) * L.k, top = spr.ay * hk + 4;
    const e1 = Math.min(1, (ctx.age ?? 99) / 4), head = T.total * (1 - Math.pow(1 - e1, 2.2)), tail = head - T.body;
    // fit the final pose to the screen: x by width, the part above the planet squeezed into the space left
    const ux = Math.min(ctx.R, (W / 2 - 8) / T.maxX), up = Math.min(ctx.R, Math.max(4, ctx.cy - ctx.R - top) / Math.max(.01, -1 - T.minY));
    const lift = -ctx.gone * ctx.gone * H * 1.3;
    const toS = a => { const p = T.at(a), u = (a - tail) / T.body, wob = Math.sin(u * 15 - t * 2.4) * .045 * (1 - u * .6); const y = p[1] >= -1 ? ctx.cy + p[1] * ctx.R : ctx.cy - ctx.R + (p[1] + 1) * up; return [ctx.cx + (p[0] + wob) * ux, y + lift, p[2]]; };
    // sample the body evenly in screen pixels
    const pts = []; let prev = toS(tail), s = 0; pts.push({ x: prev[0], y: prev[1], z: prev[2], s: 0, u: 0 });
    for (let k = 1; k <= 2400; k++) { const a = tail + T.body * k / 2400, p = toS(a), d = Math.hypot(p[0] - prev[0], p[1] - prev[1]); if (d < .45 && k < 2400) continue; s += d; pts.push({ x: p[0], y: p[1], z: p[2], s, u: k / 2400 }); prev = p; }
    const rMax = Math.max(3, ctx.R * L.r) * (L.k > 1 && !L.flat ? 1 : 1), n = pts.length;
    const legsAt = [.3, .5, .68, .85];
    for (let i = 1; i < n - 1; i++) {
      const p = pts[i]; ctx.z = p.z * ctx.R;
      const tx = pts[i + 1].x - pts[i - 1].x, ty = pts[i + 1].y - pts[i - 1].y, tl = Math.hypot(tx, ty) || 1;
      let nx = ty / tl, ny = -tx / tl; if (L.flat && ny < 0) { nx = -nx; ny = -ny; }
      const r = rMax * (.22 + .78 * Math.min(1, p.u * 4)) * (1 - .15 * Math.max(0, (p.u - .9) * 10));
      tube(ctx, p.x, p.y, nx, ny, r, p.s, L.flat);
      // back spines every few pixels
      if (!L.flat && Math.floor(p.s / 9) !== Math.floor(pts[i - 1].s / 9) && p.u > .08 && p.u < .97) for (let j = 1; j < r * .9; j++) { const w = (1 - j / (r * .9)) * 2.4; for (let o = -w; o <= w; o += .5) ctx.px(p.x - nx * (r + j - .5) + (tx / tl) * o, p.y - ny * (r + j - .5) + (ty / tl) * o, j > r * .55 ? BODY.spineHi : BODY.spine); }
      for (const f of legsAt) if (pts[i - 1].u < f && p.u >= f) leg(ctx, p.x, p.y, nx, ny, r, t + f * 7, L.flat, tx / tl, ty / tl);
    }
    // the head rides the end of the path
    const e = pts[n - 1], e0 = pts[Math.max(0, n - 8)];
    { ctx.z = e.z * ctx.R + ctx.R * .25;
      const fl = L.head !== 1 && e.x > e0.x;   // profile heads face the way he flies
      blit(ctx, spr, e.x, e.y, fl, hk);
      for (const [wx, wy, side] of hd.whiskers) {
        let x = e.x + ((fl ? spr.w - 1 - wx : wx) - spr.ax) * hk, y = e.y + (wy - spr.ay) * hk, dir = side * (fl ? -1 : 1);
        const len = 40 * hk;
        for (let j = 0; j < len; j += .5) { const a = j / len; x += dir * .5; y += .18 + Math.sin(t * 3 + j * .16) * .32; const c = a > .8 && (j | 0) % 2 ? BODY.b[0] : BODY.b[1]; ctx.px(x, y, c); if (a < .6) ctx.px(x, y + 1, BODY.b[0]); }
      }
      if (ctx.glow) for (const [ex, ey] of eyes(hd)) { const x = e.x + ((fl ? spr.w - 1 - ex : ex) - spr.ax) * hk, y = e.y + (ey - spr.ay) * hk; for (let a = 0; a < 6.28; a += .4) ctx.px(x + Math.cos(a) * (2 + hk), y + Math.sin(a) * (1 + hk * .6), 0xff5a4a); }
    }
  }
  function eyes(hd) { const out = []; hd.rows.forEach((r, y) => { const x = r.indexOf('R'); if (x >= 0) out.push([x + 1, y + 1]); const x2 = r.lastIndexOf('R'); if (x2 > x) out.push([x2 - 1, y + 1]); }); return out; }
  function tube(ctx, x, y, nx, ny, r, s, flat) {
    for (let o = -r; o <= r; o += .5) {
      const q = o / r, px = x + nx * o, py = y + ny * o; let c;
      if (Math.abs(o) > r - 1) c = BODY.o;
      else if (flat) c = q < -.62 ? (Math.floor(s / 3) % 2 ? PAL.y : PAL.g) : q > .35 ? (Math.floor(s / 5) % 3 ? PAL.Y : PAL.y) : q < -.3 ? PAL.l : PAL.g;
      else if (q > .3) { const plate = (s % 4) < 1; c = plate ? BODY.b[0] : q > .75 ? BODY.b[0] : q < .45 ? BODY.b[2] : BODY.b[1]; }
      else {
        // light from above: the side of the tube facing up is brighter
        let l = .55 * Math.sqrt(Math.max(0, 1 - q * q)) - ny * q * .5 + .1;
        const sc = ((Math.floor(s / 3) + Math.floor((q + 1) * r / 2.2)) & 1) === 0 && (s % 3) < 1;
        if (sc) l -= .3;
        c = BODY.t[l > .62 ? 3 : l > .38 ? 2 : l > .12 ? 1 : 0];
      }
      ctx.px(px, py, c, Math.sqrt(Math.max(0, 1 - q * q)) * r);
    }
  }
  // four leg styles (ctx.legs): 0 none, 1 tucked claws, 2 jointed dragon legs, 3 belly fins
  function limb(ctx, x0, y0, x1, y1, w0, w1, flat) {
    const L = Math.hypot(x1 - x0, y1 - y0) || 1, ux = (x1 - x0) / L, uy = (y1 - y0) / L;
    for (let j = 0; j <= L; j += .5) { const w = w0 + (w1 - w0) * j / L, x = x0 + ux * j, y = y0 + uy * j; for (let o = -w; o <= w; o += .5) ctx.px(x - uy * o, y + ux * o, Math.abs(o) > w - 1 ? BODY.o : flat ? PAL.g : o < -w * .2 ? BODY.t[2] : BODY.t[1]); }
  }
  function talons(ctx, x, y, dx, dy, n, len, spread) {
    for (let i = 0; i < n; i++) { const a = (i - (n - 1) / 2) * spread, cx = dx * Math.cos(a) - dy * Math.sin(a), cy = dx * Math.sin(a) + dy * Math.cos(a); for (let j = 0; j < len; j += .5) { const curl = j / len; ctx.px(x + cx * j - cy * curl * 1.5, y + cy * j + cx * curl * 1.5, j > len * .55 ? BODY.b[2] : BODY.b[0]); } }
  }
  function leg(ctx, x, y, nx, ny, r, ph, flat, tx, ty) {
    const style = ctx.legs ?? 2, sw = Math.sin(ph * 2) * .25;
    if (style === 0) return;
    if (style === 3) {   // fins: a spray of pale spikes off the belly
      for (let i = -2; i <= 2; i++) { const bx = x + tx * i * 2.2 + nx * r * .7, by = y + ty * i * 2.2 + ny * r * .7, len = r * (1 - Math.abs(i) * .22) * (1.9 + sw); for (let j = 0; j < len; j += .5) { const f = 1 - j / len; for (let o = -f * 2; o <= f * 2; o += .5) ctx.px(bx + nx * j - tx * j * .5 + tx * o, by + ny * j - ty * j * .5 + ty * o, j > len * .6 ? BODY.b[2] : BODY.b[1]); } }
      return;
    }
    const w = Math.max(2.5, r * .7);
    if (style === 1) {   // tucked: a short thigh swept back, talons folded under
      const kx = x + (nx * .75 - tx * .66) * r * 2, ky = y + (ny * .75 - ty * .66) * r * 2;
      limb(ctx, x + nx * r * .4, y + ny * r * .4, kx, ky, w, w * .8, flat);
      talons(ctx, kx, ky, nx * .6 + tx * .8, ny * .6 + ty * .8, 3, w * 2.2, .55);
      return;
    }
    // jointed: thigh out and back, shin forward, three talons gripping the air
    const kx = x + (nx * .85 - tx * .5) * r * 2.3 + tx * sw * r, ky = y + (ny * .85 - ty * .5) * r * 2.3 + ty * sw * r;
    const fx = kx + (nx * .55 + tx * .85) * r * 1.9, fy = ky + (ny * .55 + ty * .85) * r * 1.9;
    limb(ctx, x + nx * r * .3, y + ny * r * .3, kx, ky, w * 1.15, w * .85, flat);
    limb(ctx, kx, ky, fx, fy, w * .85, w * .6, flat);
    talons(ctx, fx, fy, tx * .8 + nx * .6, ty * .8 + ny * .6, 3, w * 2.4, .6);
  }

  function blit(ctx, spr, bx, by, flip, k) {
    for (let y = Math.floor(by - spr.ay * k); y < by + (spr.h - spr.ay) * k; y++) for (let x = Math.floor(bx - spr.ax * k); x < bx + (spr.w - spr.ax) * k; x++) {
      let i = Math.floor((x + .5 - bx) / k + spr.ax); const j = Math.floor((y + .5 - by) / k + spr.ay);
      if (i < 0 || j < 0 || i >= spr.w || j >= spr.h) continue; if (flip) i = spr.w - 1 - i;
      const c = spr.col[j * spr.w + i]; if (c >= 0) ctx.px(x, y, c);
    }
  }
  return { draw, drawPorunga, LOOKS, HEADS, kit: { grid, finish, PAL, blit } };
})();
