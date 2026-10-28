// The game's per-pixel hot loops, compiled to WebAssembly. The pixel, depth, id and mask buffers live in this module's
// memory, and the page draws into them through typed-array views, so nothing is copied per frame. Every function is a
// line-for-line port of its JS twin in game.js / widget.js, with the same float operations in the same order, so the
// pixels come out identical; the only transcendental (Math.pow) is imported from JS for the same reason.
use std::arch::wasm32;
use std::ptr::addr_of_mut;

#[link(wasm_import_module = "js")]
extern "C" {
    #[link_name = "pow"]
    fn js_pow(x: f64, y: f64) -> f64;
}
extern "C" {
    static __heap_base: u8;
}

static mut BUF: *mut u32 = 0 as *mut u32;
static mut ZB: *mut f32 = 0 as *mut f32;
static mut IB: *mut u16 = 0 as *mut u16;
// the planet's lighting per pixel of its box (sq, lum and the normal a, b, c; sq < 0 outside the disc): it depends only on where the planet
// sits and its size, not on how it's turned, so it's kept while those stay put (the planet only moves when the screen shakes)
static mut LC: *mut f64 = 0 as *mut f64;
// per row, the span (first, last x) a pass has to visit; i32::MAX, -1 when the row is empty
static mut ROWS: *mut i32 = 0 as *mut i32;
// what rim() leaves for the page: the box round everything not fully transparent (x0, y0, x1, y1; x1 < x0 when empty)
static mut BOX: [i32; 4] = [0; 4];
static mut LKEY: [f64; 5] = [f64::NAN; 5];
static mut W: usize = 0;
static mut H: usize = 0;
// call arguments that don't fit in a signature: see planet()
static mut P: [f64; 24] = [0.0; 24];
static mut PAL: [u32; 16] = [0; 16];

#[no_mangle]
pub extern "C" fn params() -> *mut f64 {
    addr_of_mut!(P) as *mut f64
}

#[no_mangle]
pub extern "C" fn bbox() -> *mut i32 {
    addr_of_mut!(BOX) as *mut i32
}

#[no_mangle]
pub extern "C" fn palette() -> *mut u32 {
    addr_of_mut!(PAL) as *mut u32
}

// lays out the stage's buffers for a w×h canvas and returns where they start: the pixels (u32 × n), depth (f32 × n),
// ids (u16 × n), the mask (u8 × n), the planet's lighting (5 × f64 × n), then two spans per row (4 × i32 × h). growing the memory detaches every view, so the page rebuilds them after each call
#[no_mangle]
pub unsafe extern "C" fn alloc(w: u32, h: u32) -> usize {
    let n = (w * h) as usize;
    let base = ((&__heap_base as *const u8 as usize) + 15) & !15;
    let lc = (base + n * 11 + 7) & !7;
    let rows = lc + n * 40;
    let end = rows + h as usize * 16;
    let have = wasm32::memory_size(0) * 65536;
    if end > have {
        wasm32::memory_grow(0, (end - have + 65535) / 65536);
    }
    BUF = base as *mut u32;
    ZB = (base + n * 4) as *mut f32;
    IB = (base + n * 8) as *mut u16;
    LC = lc as *mut f64;
    ROWS = rows as *mut i32;
    LKEY = [f64::NAN; 5];
    W = w as usize;
    H = h as usize;
    base
}

#[inline(always)]
fn pk(hex: u32) -> u32 {
    0xff00_0000 | ((hex & 255) << 16) | (hex & 0xff00) | ((hex >> 16) & 255)
}

const BAYER: [f64; 16] = {
    let v = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    let mut o = [0.0; 16];
    let mut i = 0;
    while i < 16 {
        o[i] = (v[i] as f64 + 0.5) / 16.0;
        i += 1;
    }
    o
};

#[inline(always)]
fn bayer(x: i32, y: i32) -> f64 {
    BAYER[((y & 3) * 4 + (x & 3)) as usize]
}

// x | 0 on a double that holds an exact integer
#[inline(always)]
fn to_i32(v: f64) -> i32 {
    v as i64 as i32
}

#[inline(always)]
fn h2(x: f64, y: f64) -> f64 {
    let mut n = to_i32(x * 374761393.0 + y * 668265263.0);
    n = (n ^ ((n as u32 >> 13) as i32)).wrapping_mul(1274126177);
    ((n ^ ((n as u32 >> 16) as i32)) as u32) as f64 / 4294967295.0
}

#[inline(always)]
fn hh(a: f64, b: f64, c: f64) -> f64 {
    h2(a * 73.0 + c * 151.0, b * 37.0 - c * 17.0)
}

#[inline(always)]
fn lerp(a: f64, b: f64, t: f64) -> f64 {
    a + (b - a) * t
}

#[inline(always)]
fn smooth(t: f64) -> f64 {
    t * t * (3.0 - 2.0 * t)
}

// value noise, as vnoise3 in game.js. neighbouring pixels mostly fall in the same lattice cell, so each caller keeps
// the last cell's eight corner hashes (the same numbers, so the same result)
struct Cell {
    at: [f64; 3],
    h: [f64; 8],
    max: f64,
}

impl Cell {
    const NEW: Cell = Cell { at: [f64::NAN; 3], h: [0.0; 8], max: 0.0 };

    // the lattice cell (x, y, z) falls in: its corner hashes, and the largest
    #[inline(always)]
    fn find(&mut self, x: f64, y: f64, z: f64) -> [f64; 3] {
        let c = [floor(x), floor(y), floor(z)];
        if self.at != c {
            let [xi, yi, zi] = c;
            self.at = c;
            self.h = [
                hh(xi, yi, zi), hh(xi + 1.0, yi, zi), hh(xi, yi + 1.0, zi), hh(xi + 1.0, yi + 1.0, zi),
                hh(xi, yi, zi + 1.0), hh(xi + 1.0, yi, zi + 1.0), hh(xi, yi + 1.0, zi + 1.0), hh(xi + 1.0, yi + 1.0, zi + 1.0),
            ];
            self.max = self.h.iter().fold(0.0, |a, &b| fmax(a, b));
        }
        c
    }

    #[inline(always)]
    fn blend(&self, x: f64, y: f64, z: f64, c: [f64; 3]) -> f64 {
        let (u, v, w, h) = (smooth(x - c[0]), smooth(y - c[1]), smooth(z - c[2]), &self.h);
        lerp(lerp(lerp(h[0], h[1], u), lerp(h[2], h[3], u), v), lerp(lerp(h[4], h[5], u), lerp(h[6], h[7], u), v), w)
    }

    fn vnoise3(&mut self, x: f64, y: f64, z: f64) -> f64 {
        let c = self.find(x, y, z);
        self.blend(x, y, z, c)
    }
}

#[inline(always)]
fn floor(x: f64) -> f64 {
    x.floor()
}
#[inline(always)]
fn ceil(x: f64) -> f64 {
    x.ceil()
}
#[inline(always)]
fn sqrt(x: f64) -> f64 {
    x.sqrt()
}
#[inline(always)]
fn fmax(a: f64, b: f64) -> f64 {
    if a > b { a } else { b }
}

#[inline(always)]
unsafe fn tone(pal: *const u32, len: usize, lum: f64, x: i32, y: i32) -> u32 {
    let i = floor((lum + (bayer(x, y) - 0.5) * 0.2) * len as f64);
    let i = if i < 0.0 { 0.0 } else if i > (len - 1) as f64 { (len - 1) as f64 } else { i };
    *pal.add(i as usize)
}

// the planet sphere on a plain grass world (shadePlanet's last branch): rasterised into the depth buffer and shaded.
// P: X Y Z pr id, the view matrix (9), the light L (3), the road's pole N (3), grass and road palette lengths.
// PAL: the grass tones from 0, the road tones from 8
#[no_mangle]
pub unsafe extern "C" fn planet() {
    let p = &*addr_of_mut!(P);
    let pal = addr_of_mut!(PAL) as *const u32;
    let (cx, cy, cz, pr, id) = (p[0], p[1], p[2], p[3], p[4] as u16);
    let m = &p[5..14];
    let (l0, l1, l2, n0, n1, n2) = (p[14], p[15], p[16], p[17], p[18], p[19]);
    let (glen, rlen) = (p[20] as usize, p[21] as usize);
    let (w, h) = (W as f64, H as f64);
    let x0 = fmax(0.0, floor(cx - pr)) as i32;
    let x1 = { let v = ceil(cx + pr); if w - 1.0 < v { w - 1.0 } else { v } } as i32;
    let y0 = fmax(0.0, floor(cy - pr)) as i32;
    let y1 = { let v = ceil(cy + pr); if h - 1.0 < v { h - 1.0 } else { v } } as i32;
    let r2 = pr * pr;
    let (mut patch_cell, mut fleck_cell) = (Cell::NEW, Cell::NEW);
    let key = [cx, cy, pr, w, h];
    let fresh = LKEY != key;
    LKEY = key;
    let mut e = LC;
    let mut y = y0;
    while y <= y1 {
        let dy = y as f64 + 0.5 - cy;
        let mut x = x0;
        while x <= x1 {
            let dx = x as f64 + 0.5 - cx;
            if fresh {
                let q = r2 - dx * dx - dy * dy;
                if q < 0.0 {
                    *e = -1.0;
                } else {
                    let sq = sqrt(q);
                    let (a, b, c) = (dx / pr, -dy / pr, sq / pr);
                    *e = sq;
                    *e.add(1) = fmax(0.0, a * l0 + b * l1 + c * l2) * 0.78 + 0.22 + js_pow(1.0 - c, 3.0) * 0.15;
                    *e.add(2) = a;
                    *e.add(3) = b;
                    *e.add(4) = c;
                }
            }
            let sq = *e;
            if sq >= 0.0 {
                let z = cz + sq;
                let k = y as usize * W + x as usize;
                if z > *ZB.add(k) as f64 {
                    *ZB.add(k) = z as f32;
                    *IB.add(k) = id;
                    let (lum, a, b, c) = (*e.add(1), *e.add(2), *e.add(3), *e.add(4));
                    let nb0 = m[0] * a + m[3] * b + m[6] * c;
                    let nb1 = m[1] * a + m[4] * b + m[7] * c;
                    let nb2 = m[2] * a + m[5] * b + m[8] * c;
                    let dn = nb0 * n0 + nb1 * n1 + nb2 * n2;
                    let hex = if (if dn < 0.0 { -dn } else { dn }) < 0.07 {
                        tone(pal.add(8), rlen, lum + 0.2, x, y)
                    } else {
                        let patch = patch_cell.vnoise3(nb0 * 3.0 + 9.0, nb1 * 3.0, nb2 * 3.0);
                        // a fleck needs f > .9 and lum > .4. f blends its cell's corners, so it can't top the largest
                        // (but for rounding, far inside the margin): skipped, it reads 0, and the pixel is the same
                        let f = if lum > 0.4 {
                            let (fx, fy, fz) = (nb0 * 24.0, nb1 * 24.0 + 4.0, nb2 * 24.0);
                            let cell = fleck_cell.find(fx, fy, fz);
                            if fleck_cell.max >= 0.9 - 1e-9 { fleck_cell.blend(fx, fy, fz, cell) } else { 0.0 }
                        } else {
                            0.0
                        };
                        if f > 0.9 && lum > 0.4 {
                            if f > 0.94 { 0xffffff } else { 0xfff2a8 }
                        } else {
                            tone(pal, glen, lum + (patch - 0.5) * 0.22, x, y)
                        }
                    };
                    *BUF.add(k) = pk(hex);
                }
            }
            e = e.add(5);
            x += 1;
        }
        y += 1;
    }
}

// the first and last x in row y where hit(k) holds, read 64 bits at a time from both ends so empty stretches cost little.
// `mask` picks out the bits that can matter in each 64-bit word of `per` pixels
#[inline(always)]
unsafe fn span(row: *const u64, words: usize, per: usize, mask: u64, hit: impl Fn(usize) -> bool) -> (i32, i32) {
    let mut a = 0;
    while a < words && *row.add(a) & mask == 0 {
        a += 1;
    }
    if a == words {
        return (i32::MAX, -1);
    }
    let mut b = words - 1;
    while *row.add(b) & mask == 0 {
        b -= 1;
    }
    // the mask may only narrow it down (a word with some bits set and no pixel that counts): then the row has none
    let (mut lo, mut hi) = (a * per, b * per + per - 1);
    while lo <= hi && !hit(lo) {
        lo += 1;
    }
    if lo > hi {
        return (i32::MAX, -1);
    }
    while !hit(hi) {
        hi -= 1;
    }
    (lo as i32, hi as i32)
}

// a dark line where a nearer solid meets a farther one, and a darker halo round everything solid (ib marks solids).
// in place, in scan order like the JS: a halo pixel takes the colour of a neighbour that may already be outlined. only
// pixels within one of a solid can change, so each row visits just the span its own and its neighbours' solids cover
#[no_mangle]
pub unsafe extern "C" fn outline() {
    let (w, h) = (W, H);
    if w < 3 || h < 3 {
        return;
    }
    for y in 0..h {
        let row = IB.add(y * w);
        let (lo, hi) = if w % 4 == 0 { span(row as *const u64, w / 4, 4, !0, |x| *row.add(x) != 0) } else { (0, w as i32 - 1) };
        *ROWS.add(y * 2) = lo;
        *ROWS.add(y * 2 + 1) = hi;
    }
    let ds = [-1isize, 1, -(w as isize), w as isize];
    for y in 1..h - 1 {
        let r = |y: usize, i: usize| *ROWS.add(y * 2 + i);
        let lo = r(y - 1, 0).min(r(y, 0).saturating_sub(1)).min(r(y + 1, 0)).max(1);
        let hi = r(y - 1, 1).max(r(y, 1) + 1).max(r(y + 1, 1)).min(w as i32 - 2);
        let mut x = lo;
        while x <= hi {
            let k = y * w + x as usize;
            x += 1;
            let id = *IB.add(k);
            if id != 0 {
                let zk = *ZB.add(k) as f64 + 1.2;
                for d in ds {
                    let j = (k as isize + d) as usize;
                    let ij = *IB.add(j);
                    if ij != 0 && ij != id && *ZB.add(j) as f64 > zk {
                        let p = *BUF.add(k);
                        let (r, g, b) = (p & 255, (p >> 8) & 255, (p >> 16) & 255);
                        *BUF.add(k) = pk((((r as f64 * 0.4) as u32) << 16) | (((g as f64 * 0.4) as u32) << 8) | (b as f64 * 0.45) as u32);
                        break;
                    }
                }
            } else {
                for d in ds {
                    let j = (k as isize + d) as usize;
                    if *IB.add(j) != 0 {
                        let p = *BUF.add(j);
                        let (r, g, b) = (p & 255, (p >> 8) & 255, (p >> 16) & 255);
                        *BUF.add(k) = pk((((r as f64 * 0.32) as u32) << 16) | (((g as f64 * 0.32) as u32) << 8) | (b as f64 * 0.36) as u32);
                        *ZB.add(k) = *ZB.add(j);
                        break;
                    }
                }
            }
        }
    }
}

// the floating widget's 1px dark rim: every empty pixel touching a solid one (alpha ≥ 0xf0). rows visit only the span
// their own and their neighbours' solids cover. leaves in BOX the box round everything drawn, rim included, so the page
// can put just that on the canvas
#[no_mangle]
pub unsafe extern "C" fn rim() {
    const RIM: u32 = 0xd814_0f0c;
    let (w, h) = (W, H);
    let solid = |k: usize| *BUF.add(k) >> 24 >= 0xf0;
    let (mut bx0, mut by0, mut bx1, mut by1) = (i32::MAX, i32::MAX, -1, -1);
    for y in 0..h {
        let row = BUF.add(y * w);
        let (any, sol) = if w % 2 == 0 {
            let (wp, n) = (row as *const u64, w / 2);
            let any = span(wp, n, 2, 0xff00_0000_ff00_0000, |x| *row.add(x) >> 24 != 0);
            let sol = if any.1 < 0 { any } else { span(wp, n, 2, 0xf000_0000_f000_0000, |x| *row.add(x) >> 24 >= 0xf0) };
            (any, sol)
        } else {
            ((0, w as i32 - 1), (0, w as i32 - 1))
        };
        *ROWS.add(y * 2) = sol.0;
        *ROWS.add(y * 2 + 1) = sol.1;
        if any.1 >= 0 {
            bx0 = bx0.min(any.0);
            bx1 = bx1.max(any.1);
            by0 = by0.min(y as i32);
            by1 = y as i32;
        }
    }
    for y in 0..h {
        let r = |y: usize, i: usize| *ROWS.add(y * 2 + i);
        let mut lo = r(y, 0).saturating_sub(1);
        let mut hi = r(y, 1) + 1;
        if y > 0 {
            lo = lo.min(r(y - 1, 0));
            hi = hi.max(r(y - 1, 1));
        }
        if y < h - 1 {
            lo = lo.min(r(y + 1, 0));
            hi = hi.max(r(y + 1, 1));
        }
        let (lo, hi) = (lo.max(0) as usize, hi.min(w as i32 - 1));
        if hi < 0 {
            continue;
        }
        for x in lo..=hi as usize {
            let k = y * w + x;
            if *BUF.add(k) >> 24 == 0 && ((x > 0 && solid(k - 1)) || (x < w - 1 && solid(k + 1)) || (y > 0 && solid(k - w)) || (y < h - 1 && solid(k + w))) {
                *BUF.add(k) = RIM;
            }
        }
    }
    // rim pixels sit within one of a solid one
    BOX = if bx1 < 0 { [0, 0, -1, -1] } else { [(bx0 - 1).max(0), (by0 - 1).max(0), (bx1 + 1).min(w as i32 - 1), (by1 + 1).min(h as i32 - 1)] };
}
