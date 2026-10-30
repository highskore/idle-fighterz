//! planet-render: the software raster both targets share, pixel-identical to game.js and world.js.
//!
//! `px` holds px.wasm's kernels (the same source file builds both), `scene` turns a `planet_core::Game` into pixels.

// game.js's literals (6.28, 3.1416) and its `!(a > b)` tests, which differ from `a <= b` on NaN, are kept as written so the
// pixels stay bit-identical; ports of game.js's drawing functions keep their parameter lists
#![allow(clippy::approx_constant, clippy::neg_cmp_op_on_partial_ord, clippy::too_many_arguments)]

pub mod beam;
pub mod effects;
pub mod floats;
pub mod px;
pub mod scene;
pub mod scenery;
pub mod shade;
pub mod shenron;
pub mod snake;
pub mod storm;
pub mod tones;
pub mod top;
pub mod visitors;

/// The buffers game.js keeps per stage: packed ABGR pixels as `ImageData` wants them (`st.buf`), depth (`zb`),
/// object ids (`ib`) and the dither mask (`dm`).
#[derive(Clone, Debug)]
pub struct Framebuffer {
    pub w: usize,
    pub h: usize,
    pub buf: Vec<u32>,
    pub zb: Vec<f32>,
    pub ib: Vec<u16>,
    pub dm: Vec<u8>,
    /// the px kernels' caches
    pub px: px::PxCache,
}

impl Framebuffer {
    pub fn new(w: usize, h: usize) -> Self {
        let n = w * h;
        Framebuffer { w, h, buf: vec![0; n], zb: vec![-1e9; n], ib: vec![0; n], dm: vec![0; n], px: px::PxCache::default() }
    }

    /// The start of every drawn frame: `st.clear(); zb.fill(-1e9); ib.fill(0);`
    pub fn clear(&mut self) {
        self.buf.fill(0);
        self.zb.fill(-1e9);
        self.ib.fill(0);
    }

    /// `st.px`: one pixel, alpha-blended over what is there.
    pub fn px(&mut self, x: f64, y: f64, hex: u32, a: f64) {
        let (x, y) = (js_round(x), js_round(y));
        if x < 0.0 || y < 0.0 || x >= self.w as f64 || y >= self.h as f64 {
            return;
        }
        let k = y as usize * self.w + x as usize;
        if a >= 1.0 {
            self.buf[k] = pk(hex, 255);
            return;
        }
        if a <= 0.0 {
            return;
        }
        let p = self.buf[k];
        let pa = (p >> 24) as f64 / 255.0;
        if pa == 0.0 {
            self.buf[k] = pk(hex, js_round(a * 255.0) as u32);
            return;
        }
        // m(): a channel moved towards the new colour by a; `| 0` and `<<` truncate it
        let m = |s: u32, hs: u32| -> u32 {
            let old = ((p >> s) & 255) as f64;
            to_int32(old + (((hex >> hs) & 255) as f64 - old) * a) as u32
        };
        let alpha = to_int32(pa.max(a) * 255.0) as u32;
        self.buf[k] = (alpha << 24) | (m(16, 0) << 16) | (m(8, 8) << 8) | m(0, 16);
    }

    /// The RGBA bytes `putImageData` (web) or a texture upload (native) takes.
    pub fn rgba(&self) -> &[u8] {
        // SAFETY: u32 has no padding and u8 has alignment 1; the length is exact.
        unsafe { std::slice::from_raw_parts(self.buf.as_ptr() as *const u8, self.buf.len() * 4) }
    }
}

/// `PK`: 0xRRGGBB plus alpha to the little-endian ABGR word ImageData stores.
pub fn pk(hex: u32, a: u32) -> u32 {
    (a << 24) | ((hex & 255) << 16) | (hex & 0xff00) | ((hex >> 16) & 255)
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

/// The 4×4 ordered-dither threshold.
pub fn bayer(x: i32, y: i32) -> f64 {
    BAYER[((y & 3) * 4 + (x & 3)) as usize]
}

/// `h2`: the integer hash every noise in the art comes from.
pub fn h2(x: f64, y: f64) -> f64 {
    let n = to_int32(x * 374761393.0 + y * 668265263.0);
    let n = ((n ^ ((n as u32) >> 13) as i32) as i64).wrapping_mul(1274126177) as i32; // Math.imul
    ((n ^ ((n as u32) >> 16) as i32) as u32) as f64 / 4294967295.0
}

/// JS ToInt32 (`x | 0`).
#[inline]
pub fn to_int32(x: f64) -> i32 {
    // below 2^63 the truncation fits an i64, whose low 32 bits are the answer (no fmod, which wasm has to call)
    if x.abs() < 9223372036854775808.0 {
        return x as i64 as i32;
    }
    if !x.is_finite() {
        return 0;
    }
    (x.trunc().rem_euclid(4294967296.0) as u64 as u32) as i32
}

/// `x % 2` without wasm's `fmod` call: exact for every double (x / 2 is exact wherever it decides anything)
#[inline]
pub fn rem2(x: f64) -> f64 {
    (x - 2.0 * (x * 0.5).trunc()).copysign(x)
}

fn js_round(x: f64) -> f64 {
    planet_core::num::js_round(x)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pack_and_blend_like_world_js() {
        assert_eq!(pk(0x123456, 255), 0xff563412);
        let mut fb = Framebuffer::new(4, 4);
        fb.px(1.4, 2.6, 0xff0000, 1.0);
        assert_eq!(fb.buf[3 * 4 + 1], 0xff0000ff);
        fb.px(1.0, 3.0, 0x0000ff, 0.5);
        // channel 0 (r): 255 → 0 halfway = 127.5 | 0 = 127; b: 0 → 255 = 127
        assert_eq!(fb.buf[3 * 4 + 1], 0xff7f007f);
        fb.px(0.0, 0.0, 0x00ff00, 0.5);
        assert_eq!(fb.buf[0], pk(0x00ff00, 128));
    }

    #[test]
    fn fast_paths_match_fmod() {
        let slow = |x: f64| if x.is_finite() { (x.trunc().rem_euclid(4294967296.0) as u64 as u32) as i32 } else { 0 };
        let mut s = 0x2545f4914f6cdd1du64;
        let mut edge = vec![
            0.0,
            -0.0,
            0.5,
            -0.5,
            1.0,
            -1.0,
            2.0,
            -3.0,
            2147483648.0,
            -2147483649.0,
            4294967296.0,
            9.2e18,
            -9.3e18,
            1e300,
            f64::MIN_POSITIVE,
            5e-324,
            -5e-324,
        ];
        edge.extend([f64::INFINITY, f64::NEG_INFINITY, f64::NAN]);
        for i in 0..2_000_000u64 {
            s ^= s << 13;
            s ^= s >> 7;
            s ^= s << 17;
            let x = if (i as usize) < edge.len() {
                edge[i as usize]
            } else if i % 2 == 0 {
                f64::from_bits(s)
            } else {
                (s >> 11) as f64 * if s & 1 == 0 { 1e-3 } else { -7.3 }
            };
            assert_eq!(to_int32(x), slow(x), "{x:e}");
            let (a, b) = (rem2(x), x % 2.0);
            assert!(a.to_bits() == b.to_bits() || (a.is_nan() && b.is_nan()), "{x:e}: {a:e} {b:e}");
        }
    }

    #[test]
    fn hash_matches_world_js() {
        // world.js h2 under node
        assert_eq!(h2(3.0, 5.0), 0.094906086822717);
        assert_eq!(h2(-7.0, 11.0), 0.4690640532572437);
        assert_eq!(h2(123456.0, 654321.0), 0.7357713137138102);
        assert_eq!(h2(2.5, -1e7), 0.1927606997063292);
    }
}
