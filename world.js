/* ─────────────── pixel stage ───────────────
   The buffer game.js draws into (makeStage), sprites, the 3×5 text, particles, and the noise and dither helpers.
*/
const GAMES = [];
// the per-pixel hot loops in WebAssembly (wasm/, built into px.wasm and inlined by build.mjs); where it can't run
// (no WebAssembly, or a CSP without wasm-unsafe-eval) the JS loops draw the same pixels
const PX = (() => { try { const b = atob('__PX__'), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new WebAssembly.Instance(new WebAssembly.Module(u), { js: { pow: Math.pow } }).exports; } catch (e) { return null; } })();
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }
function h2(x, y) { let n = (x * 374761393 + y * 668265263) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; }
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

function makeStage(section) {
  const el = section.querySelector('.stage'), cv = el.querySelector('canvas'), ctx = cv.getContext('2d');
  const st = { el, cv, ctx, W: 0, H: 0, scale: 3, night: false, t: 0, bob: 0 };
  let img, buf;
  st.resize = () => {
    const r = el.getBoundingClientRect();
    st.scale = r.width < 560 ? 2 : 3;/*widget*/ if (WIDGET) st.scale = r.width >= 520 ? 2 : 1;   // the widget: 1× up to medium, 2× at large, so a site-sized planet fits with room round it/*/widget*/
    st.W = Math.ceil(r.width / st.scale); st.H = Math.ceil(r.height / st.scale);
    cv.width = st.W; cv.height = st.H;
    if (PX) {   // the pixels, depth, ids and mask in the module's memory: drawn into from both sides, put on the canvas uncopied
      const n = st.W * st.H, p = PX.alloc(st.W, st.H), m = PX.memory.buffer;
      img = new ImageData(new Uint8ClampedArray(m, p, n * 4), st.W, st.H); buf = new Uint32Array(m, p, n);
      st.zb = new Float32Array(m, p + n * 4, n); st.ib = new Uint16Array(m, p + n * 8, n); st.dm = new Uint8Array(m, p + n * 10, n);
    } else { img = ctx.createImageData(st.W, st.H); buf = new Uint32Array(img.data.buffer); }
    st.buf = buf;
  };
  st.clear = () => buf.fill(0);
  st.flush = () => ctx.putImageData(img, 0, 0);/*widget*/
  st.put = (x, y, w, h) => ctx.putImageData(img, 0, 0, x, y, w, h);   // just a box of it/*/widget*/
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
  const F3 = { '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111', '+': '000010111010000', '-': '000000111000000', 'x': '000101010101000', ' ': '000000000000000', 'K': '101101110101101', '.': '000000000000010', "A": '010101111101101', "B": '110101110101110', "C": '011100100100011', "D": '110101101101110', "E": '111100110100111', "F": '111100110100100', "G": '011100101101011', "H": '101101111101101', "I": '111010010010111', "J": '001001001101010', "L": '100100100100111', "M": '101111111101101', "N": '110101101101101', "O": '010101101101010', "P": '110101110100100', "Q": '010101101110011', "R": '110101110101101', "S": '011100010001110', "T": '111010010010010', "U": '101101101101111', "V": '101101101101010', "W": '101101111111101', "X": '101101010101101', "Y": '101101010010010', "Z": '111001010100111', "!": '010010010000010', "'": '010010000000000', "-": '000000111000000' };
  st.text = (s, x, y, hex, a = 1) => { let cx = Math.round(x); for (const ch of String(s).toUpperCase()) { const g = F3[ch] || F3[' ']; for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g[j * 3 + i] === '1') st.px(cx + i, y + j, hex, a); cx += 4; } };
  st.textWidth = s => String(s).length * 4 - 1;
  st.toBuf = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * st.W, (e.clientY - r.top) / r.height * st.H]; };
  return st;
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
