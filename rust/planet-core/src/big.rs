//! `Big`: power and every economy number that can grow without bound, as m × 10^e.
//!
//! Below 1e300 a `Big` is a plain f64 (`e == 0`) and every operation is the f64 one, so the game rounds exactly as it
//! did. Only a result at or past 1e300 takes the extended form: 1 ≤ |m| < 10 and an integer exponent e ≥ 300. The slow
//! path uses IEEE basic operations, a table of correctly rounded powers of ten and `jsmath`'s fdlibm log and pow, so it
//! lands on the same bits in wasm, on arm64 and on x86-64. The exponent saturates at `E_MAX`: never Infinity or NaN.

use crate::jsmath;
use std::cmp::Ordering;
use std::ops::{Add, AddAssign, Div, Mul, MulAssign, Neg, Sub, SubAssign};
use std::sync::OnceLock;

/// The first value kept in the extended form.
pub const LIM: f64 = 1e300;
const E_LIM: i64 = 300;
/// The largest exponent, 10^(10^18); past it a `Big` saturates.
pub const E_MAX: i64 = 1_000_000_000_000_000_000;
const P10_MIN: i64 = -340;
const P10_MAX: i64 = 340;

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Big {
    m: f64,
    e: i64,
}

/// 10^k, correctly rounded (Rust's float parser is exact and the same everywhere); 0 below the table.
fn p10(k: i64) -> f64 {
    static T: OnceLock<Vec<f64>> = OnceLock::new();
    let t = T.get_or_init(|| (P10_MIN..=P10_MAX).map(|k| format!("1e{k}").parse().unwrap()).collect());
    if k < P10_MIN {
        0.0
    } else {
        t[(k.min(P10_MAX) - P10_MIN) as usize]
    }
}

/// Below 1e300 (NaN included, as f64 carries it): the plain f64 range.
#[inline]
fn plain_range(x: f64) -> bool {
    x.abs() < LIM || x.is_nan()
}

fn log10_of(x: f64) -> f64 {
    jsmath::log(x) / std::f64::consts::LN_10
}

/// A finite non-zero x as (m, e), 1 ≤ |m| < 10.
fn norm(x: f64) -> (f64, i64) {
    let a = x.abs();
    if (1.0..10.0).contains(&a) {
        return (x, 0);
    }
    let mut e = log10_of(a).floor() as i64;
    let mut m = if e < -300 { (a * 1e300) / p10(e + 300) } else { a / p10(e) };
    while m >= 10.0 {
        m /= 10.0;
        e += 1;
    }
    while m < 1.0 {
        m *= 10.0;
        e -= 1;
    }
    (m.copysign(x), e)
}

impl Big {
    pub const ZERO: Big = Big { m: 0.0, e: 0 };

    const fn plain(x: f64) -> Big {
        Big { m: x, e: 0 }
    }

    /// m × 10^e for any finite m.
    pub fn new(m: f64, e: i64) -> Big {
        if m == 0.0 || !m.is_finite() {
            return Big::plain(m);
        }
        let (m, k) = norm(m);
        let e = e.saturating_add(k);
        if e >= E_LIM {
            return Big { m, e: e.min(E_MAX) };
        }
        let v = m * p10(e);
        if v.abs() < LIM {
            Big::plain(v)
        } else {
            Big { m: 1f64.copysign(m), e: E_LIM }
        }
    }

    /// 10^l.
    pub fn exp10(l: f64) -> Big {
        if l.is_nan() {
            return Big::plain(l);
        }
        if l >= E_MAX as f64 {
            return Big { m: 1.0, e: E_MAX };
        }
        if l < -400.0 {
            return Big::ZERO;
        }
        let e = l.floor();
        Big::new(jsmath::pow(10.0, l - e), e as i64)
    }

    /// The f64 itself, below 1e300.
    pub fn as_plain(self) -> Option<f64> {
        (self.e == 0).then_some(self.m)
    }

    /// (m, e) with 1 ≤ |m| < 10, for any finite non-zero value; zero and non-finite plain values come back as (m, 0).
    pub fn parts(self) -> (f64, i64) {
        if self.e != 0 || self.m == 0.0 || !self.m.is_finite() {
            (self.m, self.e)
        } else {
            norm(self.m)
        }
    }

    /// The nearest f64, saturating at ±f64::MAX: for drawing and ratios, never for the economy.
    pub fn to_f64(self) -> f64 {
        if self.e == 0 {
            return self.m;
        }
        let v = if self.e > 308 { f64::INFINITY } else { self.m * p10(self.e) };
        if v.is_finite() {
            v
        } else {
            f64::MAX.copysign(self.m)
        }
    }

    pub fn log10(self) -> f64 {
        if self.e == 0 {
            log10_of(self.m)
        } else {
            self.e as f64 + log10_of(self.m.abs())
        }
    }

    pub fn floor(self) -> Big {
        if self.e == 0 {
            Big::plain(self.m.floor())
        } else {
            self
        }
    }

    pub fn ceil(self) -> Big {
        if self.e == 0 {
            Big::plain(self.m.ceil())
        } else {
            self
        }
    }

    /// `Math.round`.
    pub fn round(self) -> Big {
        if self.e == 0 {
            Big::plain(crate::num::JsRound::js_round(self.m))
        } else {
            self
        }
    }

    pub fn sqrt(self) -> Big {
        if self.e == 0 {
            return Big::plain(self.m.sqrt());
        }
        let (m, e) = if self.e % 2 == 0 { (self.m, self.e) } else { (self.m * 10.0, self.e - 1) };
        Big::new(m.sqrt(), e / 2)
    }

    /// `self ** y`, as `jsmath::pow` (V8's `Math.pow`) below 1e300.
    pub fn pow(self, y: f64) -> Big {
        if self.e == 0 {
            let r = jsmath::pow(self.m, y);
            if plain_range(r) {
                return Big::plain(r);
            }
        }
        let (m, e) = self.parts();
        if m == 0.0 || !m.is_finite() {
            return Big::plain(jsmath::pow(m, y));
        }
        let mag = Big::exp10((e as f64 + log10_of(m.abs())) * y);
        if m > 0.0 {
            mag
        } else if y.fract() != 0.0 {
            Big::plain(f64::NAN)
        } else if (y * 0.5).fract() != 0.0 {
            -mag
        } else {
            mag
        }
    }

    /// `Math.max`, as f64's `max` below 1e300.
    pub fn max(self, o: impl Into<Big>) -> Big {
        let o = o.into();
        if self.e == 0 && o.e == 0 {
            return Big::plain(self.m.max(o.m));
        }
        if self >= o {
            self
        } else {
            o
        }
    }

    pub fn min(self, o: impl Into<Big>) -> Big {
        let o = o.into();
        if self.e == 0 && o.e == 0 {
            return Big::plain(self.m.min(o.m));
        }
        if self <= o {
            self
        } else {
            o
        }
    }

    /// The JSON value: a number below 1e300 (as `JSON.stringify` prints it), past it the text `"<m>e<e>"`.
    pub fn to_json(self) -> String {
        if self.e == 0 {
            crate::json::num(self.m)
        } else {
            format!("\"{}\"", self.to_text())
        }
    }

    /// `<m>e<e>`, m in its shortest round-trip digits: `parse` reads it back exactly.
    pub fn to_text(self) -> String {
        if self.e == 0 {
            format!("{:e}", self.m)
        } else {
            format!("{}e{}", self.m, self.e)
        }
    }

    /// Reads any decimal number, `to_text`'s included.
    pub fn parse(s: &str) -> Option<Big> {
        let s = s.trim();
        let (m, e) = s.split_once(['e', 'E']).map_or((s, 0), |(m, e)| (m, e.parse::<i64>().unwrap_or(i64::MAX)));
        if e < E_LIM {
            return s.parse::<f64>().ok().filter(|x| x.is_finite()).map(Big::from);
        }
        let m: f64 = m.parse().ok().filter(|m: &f64| m.is_finite())?;
        if e > E_MAX {
            return None;
        }
        Some(Big::new(m, e))
    }
}

impl From<f64> for Big {
    fn from(x: f64) -> Big {
        if plain_range(x) || !x.is_finite() {
            Big::plain(x)
        } else {
            Big::new(x, 0)
        }
    }
}

impl From<u32> for Big {
    fn from(x: u32) -> Big {
        Big::plain(x as f64)
    }
}

impl Neg for Big {
    type Output = Big;
    fn neg(self) -> Big {
        Big { m: -self.m, e: self.e }
    }
}

fn slow_add(a: Big, b: Big) -> Big {
    let ((ma, ea), (mb, eb)) = (a.parts(), b.parts());
    if !ma.is_finite() || !mb.is_finite() {
        return Big::plain(a.to_f64() + b.to_f64());
    }
    if mb == 0.0 {
        return a;
    }
    if ma == 0.0 {
        return b;
    }
    let (hi, (mh, eh), (ml, el)) = if ea >= eb { (a, (ma, ea), (mb, eb)) } else { (b, (mb, eb), (ma, ea)) };
    let d = eh - el;
    if d > 20 {
        return hi;
    }
    Big::new(mh + ml / p10(d), eh)
}

impl Add for Big {
    type Output = Big;
    #[inline]
    fn add(self, o: Big) -> Big {
        if self.e == 0 && o.e == 0 {
            let r = self.m + o.m;
            if plain_range(r) {
                return Big::plain(r);
            }
        }
        slow_add(self, o)
    }
}

impl Sub for Big {
    type Output = Big;
    #[inline]
    fn sub(self, o: Big) -> Big {
        if self.e == 0 && o.e == 0 {
            let r = self.m - o.m;
            if plain_range(r) {
                return Big::plain(r);
            }
        }
        slow_add(self, -o)
    }
}

impl Mul for Big {
    type Output = Big;
    #[inline]
    fn mul(self, o: Big) -> Big {
        if self.e == 0 && o.e == 0 {
            let r = self.m * o.m;
            if plain_range(r) {
                return Big::plain(r);
            }
        }
        let ((ma, ea), (mb, eb)) = (self.parts(), o.parts());
        if !ma.is_finite() || !mb.is_finite() {
            return Big::plain(ma * mb);
        }
        Big::new(ma * mb, ea.saturating_add(eb))
    }
}

impl Div for Big {
    type Output = Big;
    /// Division by zero is f64's (Infinity or NaN), as it was.
    #[inline]
    fn div(self, o: Big) -> Big {
        if self.e == 0 && o.e == 0 {
            let r = self.m / o.m;
            if plain_range(r) || o.m == 0.0 {
                return Big::plain(r);
            }
        }
        let ((ma, ea), (mb, eb)) = (self.parts(), o.parts());
        if !ma.is_finite() || !mb.is_finite() || mb == 0.0 {
            return Big::plain(self.to_f64() / o.to_f64());
        }
        Big::new(ma / mb, ea.saturating_sub(eb))
    }
}

macro_rules! with_f64 {
    ($($tr:ident $f:ident),*) => {$(
        impl $tr<f64> for Big {
            type Output = Big;
            #[inline]
            fn $f(self, o: f64) -> Big {
                $tr::$f(self, Big::from(o))
            }
        }
        impl $tr<Big> for f64 {
            type Output = Big;
            #[inline]
            fn $f(self, o: Big) -> Big {
                $tr::$f(Big::from(self), o)
            }
        }
    )*};
}
with_f64!(Add add, Sub sub, Mul mul, Div div);

impl<T: Into<Big>> AddAssign<T> for Big {
    fn add_assign(&mut self, o: T) {
        *self = *self + o.into();
    }
}

impl<T: Into<Big>> SubAssign<T> for Big {
    fn sub_assign(&mut self, o: T) {
        *self = *self - o.into();
    }
}

impl<T: Into<Big>> MulAssign<T> for Big {
    fn mul_assign(&mut self, o: T) {
        *self = *self * o.into();
    }
}

impl PartialOrd for Big {
    fn partial_cmp(&self, o: &Big) -> Option<Ordering> {
        if self.e == 0 && o.e == 0 {
            return self.m.partial_cmp(&o.m);
        }
        let ((ma, ea), (mb, eb)) = (self.parts(), o.parts());
        if ma.is_nan() || mb.is_nan() {
            return None;
        }
        if ma.is_infinite() || mb.is_infinite() {
            return self.to_f64().partial_cmp(&o.to_f64());
        }
        let sign = |m: f64| {
            if m > 0.0 {
                1
            } else if m < 0.0 {
                -1
            } else {
                0
            }
        };
        let (sa, sb) = (sign(ma), sign(mb));
        if sa != sb || sa == 0 {
            return Some(sa.cmp(&sb));
        }
        let mag = ea.cmp(&eb).then(ma.abs().partial_cmp(&mb.abs())?);
        Some(if sa > 0 { mag } else { mag.reverse() })
    }
}

impl PartialEq<f64> for Big {
    fn eq(&self, o: &f64) -> bool {
        *self == Big::from(*o)
    }
}

impl PartialOrd<f64> for Big {
    fn partial_cmp(&self, o: &f64) -> Option<Ordering> {
        if self.e == 0 {
            return self.m.partial_cmp(o);
        }
        self.partial_cmp(&Big::from(*o))
    }
}

impl PartialEq<Big> for f64 {
    fn eq(&self, o: &Big) -> bool {
        o == self
    }
}

impl PartialOrd<Big> for f64 {
    fn partial_cmp(&self, o: &Big) -> Option<Ordering> {
        o.partial_cmp(self).map(Ordering::reverse)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A small deterministic generator for the property tests.
    struct Gen(u64);
    impl Gen {
        fn next(&mut self) -> u64 {
            self.0 = self.0.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            self.0 >> 11
        }
        fn unit(&mut self) -> f64 {
            self.next() as f64 / (1u64 << 53) as f64
        }
        /// any magnitude a plain f64 holds below 1e300, either sign
        fn f64(&mut self) -> f64 {
            let x = jsmath::pow(10.0, self.unit() * 598.0 - 299.0) * (1.0 + self.unit());
            if self.next() & 1 == 0 {
                x
            } else {
                -x
            }
        }
        /// 1e-100 to 1e5000: plain and extended, never so small that a product underflows
        fn big(&mut self) -> Big {
            Big::new(1.0 + self.unit() * 9.0, (self.next() % 5100) as i64 - 100)
        }
    }

    fn close(a: Big, b: Big, rel: f64) -> bool {
        let ((ma, ea), (mb, eb)) = (a.parts(), b.parts());
        if ma == 0.0 || mb == 0.0 {
            return ma == mb;
        }
        let d = (ea - eb) as f64 + log10_of(ma.abs()) - log10_of(mb.abs());
        ma.signum() == mb.signum() && d.abs() < rel
    }

    #[test]
    fn plain_is_f64_bit_for_bit() {
        let mut g = Gen(1);
        for _ in 0..200_000 {
            let (x, y) = (g.f64(), g.f64());
            let (a, b) = (Big::from(x), Big::from(y));
            for (got, want) in [(a + b, x + y), (a - b, x - y), (a * b, x * y), (a / b, x / y), (a * 3.5, x * 3.5), (2.0 * b, 2.0 * y)] {
                if want.abs() < LIM {
                    assert_eq!(got.as_plain().map(f64::to_bits), Some(want.to_bits()), "{x} {y}");
                } else {
                    assert!(got.as_plain().is_none() && got.to_f64().is_finite(), "{x} {y} → {got:?}");
                }
            }
            assert_eq!(a.max(b).as_plain(), Some(x.max(y)));
            assert_eq!(a.min(b).as_plain(), Some(x.min(y)));
            assert_eq!(a.partial_cmp(&b), x.partial_cmp(&y));
            let p = jsmath::pow(x.abs(), 0.15);
            assert_eq!(Big::from(x.abs()).pow(0.15).as_plain().map(f64::to_bits), Some(p.to_bits()));
            assert_eq!(Big::from(x.abs()).sqrt().as_plain().map(f64::to_bits), Some(x.abs().sqrt().to_bits()));
            assert_eq!(a.floor().as_plain(), Some(x.floor()));
        }
    }

    #[test]
    fn the_fast_path_ends_at_1e300() {
        let below = f64::from_bits(LIM.to_bits() - 1);
        assert_eq!(Big::from(below).as_plain(), Some(below));
        assert_eq!(Big::from(LIM).as_plain(), None);
        assert_eq!(Big::from(LIM).parts().1, 300);
        assert_eq!((Big::from(5e299) + 4e299).as_plain(), Some(5e299 + 4e299));
        assert_eq!((Big::from(5e299) + 5e299).parts(), Big::new(1.0, 300).parts());
        assert_eq!((Big::from(1e200) * 1e200).parts(), (1.0, 400));
        // and back: an extended value that falls under the limit is a plain f64 again
        let back = Big::new(1.0, 400) / 1e200;
        assert!(back.as_plain().is_some_and(|x| (x / 1e200 - 1.0).abs() < 1e-15));
        assert_eq!((Big::new(2.0, 300) - Big::new(2.0, 300)).as_plain(), Some(0.0));
        assert!(Big::new(1.0, 300) > Big::from(below) && Big::from(below) < Big::new(1.0, 300));
    }

    #[test]
    fn never_infinite_or_nan() {
        let mut x = Big::from(2.0);
        for _ in 0..80 {
            x = x * x;
            assert!(x.to_f64().is_finite() && !x.m.is_nan());
        }
        assert_eq!(x.parts().1, E_MAX, "the exponent saturates");
        assert_eq!((x * x).parts().1, E_MAX);
        assert!(x > Big::new(9.0, 1_000_000));
        assert!(Big::from(f64::MAX) * f64::MAX > Big::from(f64::MAX));
        assert_eq!((Big::from(f64::MAX) * f64::MAX).parts().1, 616);
        assert!(!(Big::new(3.0, 5000).pow(1e30).log10().is_nan()));
        assert_eq!(Big::new(1.0, 1000).pow(0.0).as_plain(), Some(1.0));
        assert_eq!(Big::new(1.0, 1000).pow(-1.0).as_plain(), Some(0.0), "1e-1000 underflows to zero, as f64 would");
    }

    #[test]
    fn ordering_is_total_on_numbers() {
        let mut g = Gen(2);
        let mut v: Vec<Big> = (0..3000).map(|i| if i % 2 == 0 { g.big() } else { Big::from(g.f64()) }).collect();
        v.extend(v.clone().into_iter().map(|b| -b));
        v.push(Big::ZERO);
        v.sort_by(|a, b| a.partial_cmp(b).unwrap());
        for w in v.windows(2) {
            assert!(w[0] <= w[1] && w[1] >= w[0]);
        }
        let logs: Vec<f64> = v.iter().filter(|b| **b > 0.0).map(|b| b.log10()).collect();
        assert!(logs.windows(2).all(|w| w[0] <= w[1] + 1e-12), "sorted by size is sorted by log10");
    }

    #[test]
    fn arithmetic_holds_within_tolerance() {
        let mut g = Gen(3);
        for _ in 0..20_000 {
            let (a, b, c) = (g.big(), g.big(), g.big());
            assert!(close((a + b) + c, a + (b + c), 1e-12), "+ associates");
            assert!(close((a * b) * c, a * (b * c), 1e-12), "× associates");
            assert!(close(a * (b + c), a * b + a * c, 1e-12), "× distributes");
            assert!(close((a * b) / b, a, 1e-12));
            assert!(close(a.pow(2.0), a * a, 1e-9));
            assert!(close(a.sqrt() * a.sqrt(), a, 1e-12));
            assert!(close(a.pow(0.5), a.sqrt(), 1e-9));
            assert!((a.log10() - (a * 10.0).log10() + 1.0).abs() < 1e-9);
            assert!(a + b >= a.max(b) && a.min(b) <= a.max(b));
            assert_eq!((a - a).as_plain(), Some(0.0));
        }
    }

    #[test]
    fn text_round_trips() {
        let mut g = Gen(4);
        for _ in 0..20_000 {
            for b in [g.big(), Big::from(g.f64()), -g.big()] {
                assert_eq!(Big::parse(&b.to_text()), Some(b), "{}", b.to_text());
                let j = b.to_json();
                let back = Big::parse(j.trim_matches('"')).unwrap();
                assert_eq!(back, b, "{j}");
            }
        }
        assert_eq!(Big::new(4.5, 1204).to_json(), "\"4.5e1204\"");
        assert_eq!(Big::from(123456.0).to_json(), "123456");
        assert_eq!(Big::parse("1e300").unwrap().parts(), (1.0, 300));
        assert_eq!(Big::parse("7.25e9"), Some(Big::from(7.25e9)));
        assert_eq!(Big::parse("nope"), None);
    }

    #[test]
    fn deterministic_slow_path() {
        // fixed bits: if these move, the extended form isn't the same on every target
        let x = Big::from(3.7e299) * 7.3e250 + Big::new(2.5, 550);
        assert_eq!(x.to_text(), "5.2010000000000005e550");
        let p = Big::new(1.234, 5000).pow(0.15);
        assert_eq!(p.parts().1, 750);
        assert_eq!(Big::new(9.99, 1203).sqrt().to_text(), format!("{}e601", (99.9f64).sqrt()));
    }
}
