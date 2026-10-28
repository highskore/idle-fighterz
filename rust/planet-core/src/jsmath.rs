//! V8's `Math` functions, bit for bit: fdlibm's sin, cos and atan2 (V8's `ieee754::*`) and its Kahan `Math.hypot`.
//! The timeline's geometry (where the hero stands, where a ki blast flies) has to land on the same doubles as game.js.
//! V8 for arm64 is built with clang's FP contraction, which fuses each `a * b + c` inside an expression (the left
//! product first) into one rounding, so these use `mul_add` in exactly those places: they match node on arm64 over
//! 400k random arguments. x86-64 builds have no FMA in their baseline, so V8 there likely differs in the last bit.

#![allow(clippy::excessive_precision, clippy::approx_constant, clippy::eq_op)] // fdlibm as written: its constants digit for digit, x - x for NaN

fn hi(x: f64) -> u32 {
    (x.to_bits() >> 32) as u32
}

fn lo(x: f64) -> u32 {
    x.to_bits() as u32
}

fn with_hi(h: u32, l: u32) -> f64 {
    f64::from_bits(((h as u64) << 32) | l as u64)
}

const S1: f64 = -1.66666666666666324348e-01;
const S2: f64 = 8.33333333332248946124e-03;
const S3: f64 = -1.98412698298579493134e-04;
const S4: f64 = 2.75573137070700676789e-06;
const S5: f64 = -2.50507602534068634195e-08;
const S6: f64 = 1.58969099521155010221e-10;

fn k_sin(x: f64, y: f64, iy: bool) -> f64 {
    let ix = hi(x) & 0x7fffffff;
    if ix < 0x3e400000 && x as i32 == 0 {
        return x;
    }
    let z = x * x;
    let v = z * x;
    let r = z.mul_add(z.mul_add(z.mul_add(z.mul_add(S6, S5), S4), S3), S2);
    if !iy {
        v.mul_add(z.mul_add(r, S1), x)
    } else {
        x - (-v).mul_add(S1, z.mul_add(0.5f64.mul_add(y, -(v * r)), -y))
    }
}

const C1: f64 = 4.16666666666666019037e-02;
const C2: f64 = -1.38888888888741095749e-03;
const C3: f64 = 2.48015872894767294178e-05;
const C4: f64 = -2.75573143513906633035e-07;
const C5: f64 = 2.08757232129817482790e-09;
const C6: f64 = -1.13596475577881948265e-11;

fn k_cos(x: f64, y: f64) -> f64 {
    let ix = hi(x) & 0x7fffffff;
    if ix < 0x3e400000 && x as i32 == 0 {
        return 1.0;
    }
    let z = x * x;
    let r = z * z.mul_add(z.mul_add(z.mul_add(z.mul_add(z.mul_add(C6, C5), C4), C3), C2), C1);
    if ix < 0x3fd33333 {
        1.0 - 0.5f64.mul_add(z, -z.mul_add(r, -(x * y)))
    } else {
        let qx = if ix > 0x3fe90000 { 0.28125 } else { with_hi(ix - 0x00200000, 0) };
        let hz = 0.5f64.mul_add(z, -qx);
        let a = 1.0 - qx;
        a - (hz - z.mul_add(r, -(x * y)))
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
    let n = t.mul_add(INVPIO2, 0.5) as i32;
    let fnn = n as f64;
    let mut r = (-fnn).mul_add(PIO2_1, t);
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
            w = fnn.mul_add(PIO2_2T, -((t - r) - w));
            y0 = r - w;
            let i = j - ((hi(y0) >> 20) & 0x7ff) as i32;
            if i > 49 {
                let t = r;
                w = fnn * PIO2_3;
                r = t - w;
                w = fnn.mul_add(PIO2_3T, -((t - r) - w));
                y0 = r - w;
            }
        }
    }
    let y1 = (r - y0) - w;
    Some(if hx < 0 { (-n, -y0, -y1) } else { (n, y0, y1) })
}

/// `Math.sin`
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
                x = 2.0f64.mul_add(x, -1.0) / (2.0 + x);
            } else {
                id = 1;
                x = (x - 1.0) / (x + 1.0);
            }
        } else if ix < 0x40038000 {
            id = 2;
            x = (x - 1.5) / 1.5f64.mul_add(x, 1.0);
        } else {
            id = 3;
            x = -1.0 / x;
        }
    }
    let z = x * x;
    let w = z * z;
    let s1 = z * w.mul_add(w.mul_add(w.mul_add(w.mul_add(w.mul_add(AT[10], AT[8]), AT[6]), AT[4]), AT[2]), AT[0]);
    let s2 = w * w.mul_add(w.mul_add(w.mul_add(w.mul_add(AT[9], AT[7]), AT[5]), AT[3]), AT[1]);
    if id < 0 {
        return (-x).mul_add(s1 + s2, x);
    }
    let id = id as usize;
    let z = ATANHI[id] - (x.mul_add(s1 + s2, -ATANLO[id]) - x);
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
        assert_eq!(hypot(&[3.0, 4.0]), 5.0);
    }
}

/// `Math.pow` as node on arm64 computes it: the platform's `pow`, except that ±1 ** ±Infinity is NaN and V8 takes
/// y = 2 and y = 0.5 itself (x * x and the square root). Matches node over 300k random arguments.
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
            k = INVLN2.mul_add(x, if xsb == 0 { 0.5 } else { -0.5 }) as i32;
            let t = k as f64;
            hi_ = (-t).mul_add(LN2_HI, x);
            lo_ = t * LN2_LO;
        }
        x = hi_ - lo_;
    } else if hx < 0x3e300000 {
        return 1.0 + x;
    }
    let t = x * x;
    let c = (-t).mul_add(t.mul_add(t.mul_add(t.mul_add(t.mul_add(EP5, EP4), EP3), EP2), EP1), x);
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
