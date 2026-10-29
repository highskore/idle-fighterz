//! V8's `Math` functions, bit for bit: fdlibm's sin, cos, atan2 and log (V8's `ieee754::*`) and its Kahan `Math.hypot`.
//! The timeline's geometry (where the hero stands, where a ki blast flies) has to land on the same doubles as game.js.
//! V8 for arm64 is built with clang's FP contraction, which fuses each `a * b + c` inside an expression (the left
//! product first) into one rounding, so these use `fma` in exactly those places: they match node on arm64 over
//! 400k random arguments. x86-64 builds have no FMA in their baseline, so V8 there likely differs in the last bit.

#![allow(clippy::excessive_precision, clippy::approx_constant, clippy::eq_op)] // fdlibm as written: its constants digit for digit, x - x for NaN

#[inline]
fn hi(x: f64) -> u32 {
    (x.to_bits() >> 32) as u32
}

#[inline]
fn lo(x: f64) -> u32 {
    x.to_bits() as u32
}

#[inline]
fn with_hi(h: u32, l: u32) -> f64 {
    f64::from_bits(((h as u64) << 32) | l as u64)
}

/// `a * b + c` with one rounding. Native targets have the instruction; wasm has none, and its software `fma` costs
/// more than the rest of a `sin`, so there it is emulated exactly (Boldo and Melquiond's rounding to odd) whenever
/// nothing can overflow or underflow, which covers every argument the kernels here see.
#[inline(always)]
pub fn fma(a: f64, b: f64, c: f64) -> f64 {
    #[cfg(target_arch = "wasm32")]
    if let Some(r) = fma_odd(a, b, c) {
        return r;
    }
    a.mul_add(b, c)
}

/// The emulated `fma`, or None outside the exponent range it is proved for (zeros, tiny, huge or non-finite).
#[inline(always)]
pub fn fma_odd(a: f64, b: f64, c: f64) -> Option<f64> {
    // biased exponents within ±400 of 1 for the factors, ±800 for the addend (or an addend of zero)
    let e = |x: f64, r: u64| ((x.to_bits() >> 52) & 0x7ff).wrapping_sub(1023 - r) <= 2 * r;
    if !(e(a, 400) && e(b, 400) && (c == 0.0 || e(c, 800))) {
        return None;
    }
    let two_sum = |x: f64, y: f64| {
        let s = x + y;
        let bb = s - x;
        (s, (x - (s - bb)) + (y - bb))
    };
    // usually the unfused sum already is the answer: a * b + c = s + r + (the product's error, at most half an ulp of
    // p), so s stands when |r| plus that bound is under half an ulp of s (a quarter at a power of two)
    let p = a * b;
    let (s, r) = two_sum(p, c);
    let (bs, es, ep) = (s.to_bits(), (s.to_bits() >> 52) & 0x7ff, (p.to_bits() >> 52) & 0x7ff);
    if es > 64 {
        let half = f64::from_bits((es - 53 - (bs & ((1 << 52) - 1) == 0) as u64) << 52);
        if r.abs() < half - f64::from_bits((ep - 53) << 52) {
            return Some(s);
        }
    }
    let split = |x: f64| {
        let t = 134217729.0 * x;
        let h = t - (t - x);
        (h, x - h)
    };
    // the product exactly (Dekker), then c added to its high part exactly
    let uh = p;
    let ((ah, al), (bh, bl)) = (split(a), split(b));
    let ul = ((ah * bh - uh) + ah * bl + al * bh) + al * bl;
    let (th, tl) = two_sum(c, uh);
    // the low parts summed, rounded to odd: on an inexact sum, the neighbour whose last bit is 1
    let (v, ve) = two_sum(tl, ul);
    let v = if ve != 0.0 && v.to_bits() & 1 == 0 { f64::from_bits(if (ve > 0.0) == (v > 0.0) { v.to_bits() + 1 } else { v.to_bits() - 1 }) } else { v };
    Some(th + v)
}

const S1: f64 = -1.66666666666666324348e-01;
const S2: f64 = 8.33333333332248946124e-03;
const S3: f64 = -1.98412698298579493134e-04;
const S4: f64 = 2.75573137070700676789e-06;
const S5: f64 = -2.50507602534068634195e-08;
const S6: f64 = 1.58969099521155010221e-10;

#[inline]
fn k_sin(x: f64, y: f64, iy: bool) -> f64 {
    let ix = hi(x) & 0x7fffffff;
    if ix < 0x3e400000 && x as i32 == 0 {
        return x;
    }
    let z = x * x;
    let v = z * x;
    let r = fma(z, fma(z, fma(z, fma(z, S6, S5), S4), S3), S2);
    if !iy {
        fma(v, fma(z, r, S1), x)
    } else {
        x - fma(-v, S1, fma(z, fma(0.5, y, -(v * r)), -y))
    }
}

const C1: f64 = 4.16666666666666019037e-02;
const C2: f64 = -1.38888888888741095749e-03;
const C3: f64 = 2.48015872894767294178e-05;
const C4: f64 = -2.75573143513906633035e-07;
const C5: f64 = 2.08757232129817482790e-09;
const C6: f64 = -1.13596475577881948265e-11;

#[inline]
fn k_cos(x: f64, y: f64) -> f64 {
    let ix = hi(x) & 0x7fffffff;
    if ix < 0x3e400000 && x as i32 == 0 {
        return 1.0;
    }
    let z = x * x;
    let r = z * fma(z, fma(z, fma(z, fma(z, fma(z, C6, C5), C4), C3), C2), C1);
    if ix < 0x3fd33333 {
        1.0 - fma(0.5, z, -fma(z, r, -(x * y)))
    } else {
        let qx = if ix > 0x3fe90000 { 0.28125 } else { with_hi(ix - 0x00200000, 0) };
        let hz = fma(0.5, z, -qx);
        let a = 1.0 - qx;
        a - (hz - fma(z, r, -(x * y)))
    }
}

const INVPIO2: f64 = 6.36619772367581382433e-01;
const PIO2_1: f64 = 1.57079632673412561417e+00;
const PIO2_1T: f64 = 6.07710050650619224932e-11;
const PIO2_2: f64 = 6.07710050630396597660e-11;
const PIO2_2T: f64 = 2.02226624879595063154e-21;
const PIO2_3: f64 = 2.02226624871116645580e-21;
const PIO2_3T: f64 = 8.47842766036889956997e-32;

/// x reduced by n·π/2: (n, y0, y1). Medium arguments only (|x| < 2^19·π/2); past that it defers to the platform.
#[inline]
fn rem_pio2(x: f64) -> Option<(i32, f64, f64)> {
    let hx = hi(x) as i32;
    let ix = (hx & 0x7fffffff) as u32;
    if ix < 0x4002d97c {
        let near = ix == 0x3ff921fb;
        return Some(if hx > 0 {
            let z = x - PIO2_1;
            if !near {
                let y0 = z - PIO2_1T;
                (1, y0, (z - y0) - PIO2_1T)
            } else {
                let z = z - PIO2_2;
                let y0 = z - PIO2_2T;
                (1, y0, (z - y0) - PIO2_2T)
            }
        } else {
            let z = x + PIO2_1;
            if !near {
                let y0 = z + PIO2_1T;
                (-1, y0, (z - y0) + PIO2_1T)
            } else {
                let z = z + PIO2_2;
                let y0 = z + PIO2_2T;
                (-1, y0, (z - y0) + PIO2_2T)
            }
        });
    }
    if ix > 0x413921fb {
        return None;
    }
    let t = x.abs();
    let n = fma(t, INVPIO2, 0.5) as i32;
    let fnn = n as f64;
    let mut r = fma(-fnn, PIO2_1, t);
    let mut w = fnn * PIO2_1T;
    let mut y0;
    let npio2_hw = |n: i32| hi(n as f64 * std::f64::consts::FRAC_PI_2);
    if n < 32 && ix != npio2_hw(n) {
        y0 = r - w;
    } else {
        let j = (ix >> 20) as i32;
        y0 = r - w;
        let i = j - ((hi(y0) >> 20) & 0x7ff) as i32;
        if i > 16 {
            let t = r;
            w = fnn * PIO2_2;
            r = t - w;
            w = fma(fnn, PIO2_2T, -((t - r) - w));
            y0 = r - w;
            let i = j - ((hi(y0) >> 20) & 0x7ff) as i32;
            if i > 49 {
                let t = r;
                w = fnn * PIO2_3;
                r = t - w;
                w = fma(fnn, PIO2_3T, -((t - r) - w));
                y0 = r - w;
            }
        }
    }
    let y1 = (r - y0) - w;
    Some(if hx < 0 { (-n, -y0, -y1) } else { (n, y0, y1) })
}

/// `Math.sin`
#[inline]
pub fn sin(x: f64) -> f64 {
    let ix = hi(x) & 0x7fffffff;
    if ix <= 0x3fe921fb {
        return k_sin(x, 0.0, false);
    }
    if ix >= 0x7ff00000 {
        return x - x;
    }
    let Some((n, y0, y1)) = rem_pio2(x) else { return x.sin() };
    match n & 3 {
        0 => k_sin(y0, y1, true),
        1 => k_cos(y0, y1),
        2 => -k_sin(y0, y1, true),
        _ => -k_cos(y0, y1),
    }
}

/// `Math.cos`
#[inline]
pub fn cos(x: f64) -> f64 {
    let ix = hi(x) & 0x7fffffff;
    if ix <= 0x3fe921fb {
        return k_cos(x, 0.0);
    }
    if ix >= 0x7ff00000 {
        return x - x;
    }
    let Some((n, y0, y1)) = rem_pio2(x) else { return x.cos() };
    match n & 3 {
        0 => k_cos(y0, y1),
        1 => -k_sin(y0, y1, true),
        2 => -k_cos(y0, y1),
        _ => k_sin(y0, y1, true),
    }
}

const ATANHI: [f64; 4] = [4.63647609000806093515e-01, 7.85398163397448278999e-01, 9.82793723247329054082e-01, 1.57079632679489655800e+00];
const ATANLO: [f64; 4] = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17];
const AT: [f64; 11] = [
    3.33333333333329318027e-01,
    -1.99999999998764832476e-01,
    1.42857142725034663711e-01,
    -1.11111104054623557880e-01,
    9.09088713343650656196e-02,
    -7.69187620504482999495e-02,
    6.66107313738753120669e-02,
    -5.83357013379057348645e-02,
    4.97687799461593236017e-02,
    -3.65315727442169155270e-02,
    1.62858201153657823623e-02,
];

/// `Math.atan`
#[inline]
pub fn atan(x: f64) -> f64 {
    let hx = hi(x) as i32;
    let ix = (hx & 0x7fffffff) as u32;
    if ix >= 0x44100000 {
        if ix > 0x7ff00000 || (ix == 0x7ff00000 && lo(x) != 0) {
            return x + x;
        }
        return if hx > 0 { ATANHI[3] + ATANLO[3] } else { -ATANHI[3] - ATANLO[3] };
    }
    let mut x = x;
    let id: i32;
    if ix < 0x3fdc0000 {
        if ix < 0x3e400000 && 1.0e300 + x > 1.0 {
            return x;
        }
        id = -1;
    } else {
        x = x.abs();
        if ix < 0x3ff30000 {
            if ix < 0x3fe60000 {
                id = 0;
                x = fma(2.0, x, -1.0) / (2.0 + x);
            } else {
                id = 1;
                x = (x - 1.0) / (x + 1.0);
            }
        } else if ix < 0x40038000 {
            id = 2;
            x = (x - 1.5) / fma(1.5, x, 1.0);
        } else {
            id = 3;
            x = -1.0 / x;
        }
    }
    let z = x * x;
    let w = z * z;
    let s1 = z * fma(w, fma(w, fma(w, fma(w, fma(w, AT[10], AT[8]), AT[6]), AT[4]), AT[2]), AT[0]);
    let s2 = w * fma(w, fma(w, fma(w, fma(w, AT[9], AT[7]), AT[5]), AT[3]), AT[1]);
    if id < 0 {
        return fma(-x, s1 + s2, x);
    }
    let id = id as usize;
    let z = ATANHI[id] - (fma(x, s1 + s2, -ATANLO[id]) - x);
    if hx < 0 {
        -z
    } else {
        z
    }
}

const PI: f64 = 3.1415926535897931160E+00;
const PI_LO: f64 = 1.2246467991473531772E-16;
const PI_O_2: f64 = 1.5707963267948965580E+00;
const PI_O_4: f64 = 7.8539816339744827900E-01;

/// `Math.atan2(y, x)`
#[inline]
pub fn atan2(y: f64, x: f64) -> f64 {
    if x.is_nan() || y.is_nan() {
        return x + y;
    }
    let (hx, lx) = (hi(x) as i32, lo(x));
    let (hy, ly) = (hi(y) as i32, lo(y));
    let ix = hx & 0x7fffffff;
    let iy = hy & 0x7fffffff;
    if hx.wrapping_sub(0x3ff00000) as u32 | lx == 0 {
        return atan(y);
    }
    let m = ((hy >> 31) & 1) | ((hx >> 30) & 2);
    if iy as u32 | ly == 0 {
        return match m {
            0 | 1 => y,
            2 => PI,
            _ => -PI,
        };
    }
    if ix as u32 | lx == 0 {
        return if hy < 0 { -PI_O_2 } else { PI_O_2 };
    }
    if ix == 0x7ff00000 {
        return if iy == 0x7ff00000 {
            match m {
                0 => PI_O_4,
                1 => -PI_O_4,
                2 => 3.0 * PI_O_4,
                _ => -3.0 * PI_O_4,
            }
        } else {
            match m {
                0 => 0.0,
                1 => -0.0,
                2 => PI,
                _ => -PI,
            }
        };
    }
    if iy == 0x7ff00000 {
        return if hy < 0 { -PI_O_2 } else { PI_O_2 };
    }
    let k = (iy - ix) >> 20;
    let (z, m) = if k > 60 {
        (PI_O_2 + 0.5 * PI_LO, m & 1)
    } else if hx < 0 && k < -60 {
        (0.0, m)
    } else {
        (atan((y / x).abs()), m)
    };
    match m {
        0 => z,
        1 => -z,
        2 => PI - (z - PI_LO),
        _ => (z - PI_LO) - PI,
    }
}

/// `Math.log`: fdlibm's `__ieee754_log`, with clang's contractions.
pub fn log(x: f64) -> f64 {
    const LN2_HI: f64 = 6.93147180369123816490e-01;
    const LN2_LO: f64 = 1.90821492927058770002e-10;
    const TWO54: f64 = 1.80143985094819840000e+16;
    const LG1: f64 = 6.666666666666735130e-01;
    const LG2: f64 = 3.999999999940941908e-01;
    const LG3: f64 = 2.857142874366239149e-01;
    const LG4: f64 = 2.222219843214978396e-01;
    const LG5: f64 = 1.818357216161805012e-01;
    const LG6: f64 = 1.531383769920937332e-01;
    const LG7: f64 = 1.479819860511658591e-01;
    let mut x = x;
    let mut hx = hi(x) as i32;
    let lx = lo(x);
    let mut k: i32 = 0;
    if hx < 0x00100000 {
        if ((hx & 0x7fffffff) as u32 | lx) == 0 {
            return f64::NEG_INFINITY;
        }
        if hx < 0 {
            return f64::NAN;
        }
        k -= 54;
        x *= TWO54;
        hx = hi(x) as i32;
    }
    if hx >= 0x7ff00000 {
        return x + x;
    }
    k += (hx >> 20) - 1023;
    hx &= 0x000fffff;
    let i = (hx + 0x95f64) & 0x100000;
    x = with_hi((hx | (i ^ 0x3ff00000)) as u32, lo(x));
    k += i >> 20;
    let f = x - 1.0;
    let dk = k as f64;
    if (0x000fffff & (2 + hx)) < 3 {
        if f == 0.0 {
            return if k == 0 { 0.0 } else { fma(dk, LN2_HI, dk * LN2_LO) };
        }
        let r = f * f * fma(-0.33333333333333333f64, f, 0.5);
        return if k == 0 { f - r } else { fma(dk, LN2_HI, -(fma(-dk, LN2_LO, r) - f)) };
    }
    let s = f / (2.0 + f);
    let z = s * s;
    let w = z * z;
    let i = (hx - 0x6147a) | (0x6b851 - hx);
    let t1 = w * fma(w, fma(w, LG6, LG4), LG2);
    let t2 = z * fma(w, fma(w, fma(w, LG7, LG5), LG3), LG1);
    let r = t2 + t1;
    if i > 0 {
        let hfsq = 0.5 * f * f;
        if k == 0 {
            f - fma(-s, hfsq + r, hfsq)
        } else {
            fma(dk, LN2_HI, -((hfsq - fma(s, hfsq + r, dk * LN2_LO)) - f))
        }
    } else if k == 0 {
        fma(-s, f - r, f)
    } else {
        fma(dk, LN2_HI, -(fma(s, f - r, -(dk * LN2_LO)) - f))
    }
}

/// `Math.hypot`: V8 scales by the largest magnitude and sums with Kahan compensation.
pub fn hypot(v: &[f64]) -> f64 {
    let mut max = 0.0f64;
    for &x in v {
        if x.is_infinite() {
            return f64::INFINITY;
        }
        if x.abs() > max {
            max = x.abs();
        }
    }
    if v.iter().any(|x| x.is_nan()) {
        return f64::NAN;
    }
    if max == 0.0 {
        return 0.0;
    }
    let (mut sum, mut comp) = (0.0f64, 0.0f64);
    for &x in v {
        let n = x.abs() / max;
        let s = n * n - comp;
        let p = sum + s;
        comp = (p - sum) - s;
        sum = p;
    }
    sum.sqrt() * max
}

/// `Math.pow` as node on arm64 computes it: the platform's `pow`, except that ±1 ** ±Infinity is NaN and V8 takes
/// y = 2 and y = 0.5 itself (x * x and the square root). Matches node over 300k random arguments.
#[inline]
pub fn pow(x: f64, y: f64) -> f64 {
    if y.is_nan() || (y.is_infinite() && (x == 1.0 || x == -1.0)) {
        return f64::NAN;
    }
    if y == 2.0 {
        return x * x;
    }
    if y == 0.5 && x.is_sign_positive() && !x.is_nan() {
        return x.sqrt();
    }
    x.powf(y)
}

const LN2_HI: f64 = 6.93147180369123816490e-01;
const LN2_LO: f64 = 1.90821492927058770002e-10;
const INVLN2: f64 = 1.44269504088896338700e+00;
const EP1: f64 = 1.66666666666666019037e-01;
const EP2: f64 = -2.77777777770155933842e-03;
const EP3: f64 = 6.61375632143793436117e-05;
const EP4: f64 = -1.65339022054652515390e-06;
const EP5: f64 = 4.13813679705723846039e-08;

/// `Math.exp`: fdlibm's e_exp.c (V8's `ieee754::exp`), contracted as clang builds it for arm64.
pub fn exp(x: f64) -> f64 {
    let mut hx = hi(x);
    let xsb = ((hx >> 31) & 1) as usize;
    hx &= 0x7fffffff;
    if hx >= 0x40862E42 {
        if hx >= 0x7ff00000 {
            if ((hx & 0xfffff) | lo(x)) != 0 {
                return x + x;
            }
            return if xsb == 0 { x } else { 0.0 };
        }
        if x > 7.09782712893383973096e+02 {
            return f64::INFINITY;
        }
        if x < -7.45133219101941108420e+02 {
            return 0.0;
        }
    }
    let (mut x, mut hi_, mut lo_, mut k) = (x, 0.0, 0.0, 0i32);
    if hx > 0x3fd62e42 {
        if hx < 0x3FF0A2B2 {
            // V8 returns E for exp(1), which the reduction below gets a bit wrong
            if x == 1.0 {
                return std::f64::consts::E;
            }
            hi_ = x - if xsb == 0 { LN2_HI } else { -LN2_HI };
            lo_ = if xsb == 0 { LN2_LO } else { -LN2_LO };
            k = 1 - xsb as i32 - xsb as i32;
        } else {
            k = fma(INVLN2, x, if xsb == 0 { 0.5 } else { -0.5 }) as i32;
            let t = k as f64;
            hi_ = fma(-t, LN2_HI, x);
            lo_ = t * LN2_LO;
        }
        x = hi_ - lo_;
    } else if hx < 0x3e300000 {
        return 1.0 + x;
    }
    let t = x * x;
    let c = fma(-t, fma(t, fma(t, fma(t, fma(t, EP5, EP4), EP3), EP2), EP1), x);
    if k == 0 {
        return 1.0 - ((x * c) / (c - 2.0) - x);
    }
    let y = 1.0 - ((lo_ - (x * c) / (2.0 - c)) - hi_);
    if k >= -1021 {
        with_hi((hi(y) as i32 + (k << 20)) as u32, lo(y))
    } else {
        with_hi((hi(y) as i32 + ((k + 1000) << 20)) as u32, lo(y)) * 9.33263618503218878990e-302
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_v8() {
        // values from node 25 on arm64, where a plain (unfused) fdlibm is one ulp off
        assert_eq!(sin(0.7791953906416893), 0.7027071839262887);
        assert_eq!(sin(16.43856730312109), -0.6673196248681893);
        assert_eq!(cos(-14.913382465019822), -0.7005839540352707);
        assert_eq!(atan2(-7.154588392004371, 18.199517838656902), -0.37456101990228924);
        assert_eq!(log(3.0), 1.0986122886681096);
        assert_eq!(hypot(&[3.0, 4.0]), 5.0);
    }
}

#[cfg(test)]
mod fma_tests {
    use super::fma_odd;

    struct X(u64);
    impl X {
        fn next(&mut self) -> u64 {
            self.0 ^= self.0 << 13;
            self.0 ^= self.0 >> 7;
            self.0 ^= self.0 << 17;
            self.0
        }
        /// a double with exponent within ±r of 1 and `bits` significant bits (few bits make exact products and ties)
        fn f(&mut self, r: u64, bits: u32) -> f64 {
            let m = (self.next() & ((1 << 52) - 1)) >> (52 - bits) << (52 - bits);
            let e = 1023 - r + self.next() % (2 * r + 1);
            f64::from_bits(((self.next() & 1) << 63) | (e << 52) | m)
        }
    }

    fn check(a: f64, b: f64, c: f64) {
        if let Some(r) = fma_odd(a, b, c) {
            let want = a.mul_add(b, c);
            assert_eq!(r.to_bits(), want.to_bits(), "fma({a:e}, {b:e}, {c:e}) = {r:e}, want {want:e}");
        }
    }

    /// against the hardware's fused multiply-add: random operands, near-cancelling addends and halfway cases.
    /// `FMA_CASES` raises the count (each round is five checks).
    #[test]
    fn emulated_fma_is_exact() {
        let n: u64 = std::env::var("FMA_CASES").ok().and_then(|s| s.parse().ok()).unwrap_or(400_000);
        let mut x = X(0x9e3779b97f4a7c15);
        for i in 0..n {
            let bits = [52, 52, 26, 20, 8][(i % 5) as usize];
            let (a, b) = (x.f(60, bits), x.f(60, bits));
            check(a, b, x.f(120, 52));
            check(a, b, x.f(4, bits));
            let p = a * b;
            check(a, b, -p);
            // the addend a few ulps off the product, and one exactly half an ulp of the result off
            let k = (x.next() % 64) as i64 - 32;
            check(a, b, -f64::from_bits((p.to_bits() as i64 + k) as u64));
            let half = f64::from_bits((p.abs().to_bits() & (0x7ff << 52)).saturating_sub(53 << 52));
            check(a, b, if x.next() & 1 == 0 { half } else { -half } * (1.0 + (x.next() % 4) as f64));
            // sums landing on a power of two, where the ulp below is half the ulp above
            let pw = f64::from_bits(p.abs().to_bits() & (0x7ff << 52)) * [2.0, 4.0, 1024.0][(i % 3) as usize];
            check(a, b, pw.copysign(p) - p);
            check(a, b, pw.copysign(-p));
        }
        // and the kernels' own arguments, the ranges sin, cos, atan, log and exp evaluate their polynomials over
        for _ in 0..n {
            let z = (x.next() >> 11) as f64 / (1u64 << 53) as f64 * 0.62;
            for c in [super::S2, super::S1, super::C1, -0.5, 1.0, x.f(30, 52)] {
                check(z, x.f(30, 52), c);
                check(z * z, z, c);
            }
        }
    }
}
