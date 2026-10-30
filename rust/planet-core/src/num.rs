//! JS number semantics the game leans on (Math.round, toFixed, toExponential, toLocaleString) and the three
//! power formatters: the game's `fmtShort` and the HUD's `fmt` / `short` from page.html. Past 1e300 (a `Big` in its
//! extended form) they switch to e-notation with the exponent grouped (`4.50e1,204`), then short (`7.1e1.2M`).

use crate::big::Big;

/// `Math.round`: halves go up, toward +infinity.
#[inline]
pub fn js_round<T: JsRound>(x: T) -> T {
    x.js_round()
}

pub trait JsRound {
    fn js_round(self) -> Self;
}

impl JsRound for f64 {
    #[inline]
    fn js_round(self) -> f64 {
        let f = self.floor();
        if self - f >= 0.5 {
            f + 1.0
        } else {
            f
        }
    }
}

impl JsRound for Big {
    #[inline]
    fn js_round(self) -> Big {
        self.round()
    }
}

/// Rounds the decimal digit string `d` (no sign, no point) to `keep` digits, halves up as JS does;
/// returns the digits and whether a carry added a leading digit.
fn round_half_up(d: &[u8], keep: usize) -> (Vec<u8>, bool) {
    let mut out: Vec<u8> = d[..keep].to_vec();
    let up = d.get(keep).is_some_and(|&c| c >= b'5');
    if !up {
        return (out, false);
    }
    for i in (0..out.len()).rev() {
        if out[i] == b'9' {
            out[i] = b'0';
        } else {
            out[i] += 1;
            return (out, false);
        }
    }
    out.insert(0, b'1');
    (out, true)
}

/// `Number.prototype.toFixed` for |x| < 1e21.
pub fn to_fixed(x: f64, digits: usize) -> String {
    let neg = x < 0.0;
    // the exact binary value in decimal: enough places that a tie is a real tie
    let exact = format!("{:.1100}", x.abs());
    let (int, frac) = exact.split_once('.').unwrap();
    let all: Vec<u8> = int.bytes().chain(frac.bytes()).collect();
    let (r, carry) = round_half_up(&all, int.len() + digits);
    let int_len = int.len() + carry as usize;
    let s = String::from_utf8(r).unwrap();
    let body = if digits == 0 { s } else { format!("{}.{}", &s[..int_len], &s[int_len..]) };
    let zero = body.bytes().all(|c| c == b'0' || c == b'.');
    if neg && !zero {
        format!("-{body}")
    } else {
        body
    }
}

/// `Number.prototype.toExponential(digits)`, e.g. `1.8e+308`.
pub fn to_exponential(x: f64, digits: usize) -> String {
    if x == 0.0 {
        return format!("{}e+0", to_fixed(0.0, digits));
    }
    let neg = x < 0.0;
    // 30 digits past the rounding place settle it unless, from the rounding digit on, they read as a tie (5000…, which
    // may be a 4999… rounded up, or 4999…);
    // only then the full expansion is needed (it's slow: the shop formats every cost every frame)
    let fast = format!("{:.*e}", digits + 30, x.abs());
    let tail = &fast.split_once('e').unwrap().0[digits + 2..];
    let tie = tail.strip_prefix('5').is_some_and(|t| t.bytes().all(|c| c == b'0')) || tail.strip_prefix('4').is_some_and(|t| t.bytes().all(|c| c == b'9'));
    let exact = if tie { format!("{:.1100e}", x.abs()) } else { fast };
    let (mant, exp) = exact.split_once('e').unwrap();
    let mut e: i32 = exp.parse().unwrap();
    let all: Vec<u8> = mant.bytes().filter(|&c| c != b'.').collect();
    let (mut r, carry) = round_half_up(&all, digits + 1);
    if carry {
        e += 1;
        r.pop();
    }
    let s = String::from_utf8(r).unwrap();
    let m = if digits == 0 { s } else { format!("{}.{}", &s[..1], &s[1..]) };
    format!("{}{}e{}{}", if neg { "-" } else { "" }, m, if e < 0 { '-' } else { '+' }, e.abs())
}

/// `String(n)` for the integers the game prints.
pub fn js_string(n: f64) -> String {
    if n.fract() == 0.0 && n.abs() < 1e21 {
        format!("{}", n as i128)
    } else {
        format!("{n}")
    }
}

/// `n.toLocaleString('en-US')` for whole numbers: thousands separated by commas.
pub fn locale_en(n: f64) -> String {
    let s = js_string(n);
    let (sign, digits) = s.strip_prefix('-').map_or(("", s.as_str()), |d| ("-", d));
    let mut out = String::new();
    for (i, c) in digits.chars().enumerate() {
        if i > 0 && (digits.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(c);
    }
    format!("{sign}{out}")
}

/// `String(n)` in HUD text; past 1e300, `fmt_short`'s e-notation.
pub fn big_string(n: Big) -> String {
    match n.as_plain() {
        Some(x) => crate::json::num(x),
        None => fmt_short(n),
    }
}

/// `n.toFixed(1)` for a multiplier; from 1e21, where `toFixed` gives up on digits, `fmt_short`.
pub fn fixed1(n: Big) -> String {
    match n.as_plain() {
        Some(x) if x < 1e21 => to_fixed(x, 1),
        _ => fmt_short(n),
    }
}

const SUF: [&str; 12] = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
// the HUD's table leaves K and M out: full digits run up to a billion
const HUD_SUF: [&str; 12] = ["", "", "", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

/// A `Big` past 1e300 as [mantissa to `digits` places, `e` and its exponent]; page.html's `sci` is the same.
pub fn sci(n: Big, digits: usize) -> (String, String) {
    let (m, e) = n.parts();
    let s = to_exponential(m, digits);
    let (mant, carry) = s.split_once('e').unwrap();
    let e = e.saturating_add(carry.parse::<i64>().unwrap());
    let x = if e < 1000 {
        e.to_string()
    } else if e < 1_000_000 {
        locale_en(e as f64)
    } else {
        short_f64(e as f64)
    };
    (mant.to_string(), format!("e{x}"))
}

/// game.js `fmtShort`: floating gains, event text. 12345 → "12.3K".
pub fn fmt_short(n: impl Into<Big>) -> String {
    let n = n.into();
    match n.as_plain() {
        Some(n) => short_f64(n),
        None => {
            let (m, x) = sci(n, 1);
            m + &x
        }
    }
}

fn short_f64(n: f64) -> String {
    if n < 1e4 {
        return js_string(n);
    }
    let mut e = (n.log10() / 3.0).floor() as i32;
    let mut m = n / 10f64.powf((e * 3) as f64);
    let digits = |m: f64| if m < 100.0 { 1 } else { 0 };
    let probe: f64 = to_fixed(m, digits(m)).parse().unwrap();
    if probe >= 1000.0 {
        e += 1;
        m /= 1000.0;
    }
    if (e as usize) < SUF.len() {
        to_fixed(m, digits(m)) + SUF[e as usize]
    } else {
        to_exponential(n, 1).replace('+', "")
    }
}

/// page.html `big`: the HUD's power readout as [number, suffix].
pub fn hud_big(n: impl Into<Big>) -> (String, String) {
    let n = n.into();
    let Some(n) = n.as_plain() else { return sci(n, 2) };
    let n = n.floor();
    if n < 1e9 {
        return (locale_en(n), String::new());
    }
    let e = (n.log10() / 3.0).floor() as i32;
    if e as usize >= HUD_SUF.len() {
        let s = to_exponential(n, 2);
        let (m, x) = s.split_once("e+").unwrap();
        return (m.to_string(), format!("e{x}"));
    }
    let m = n / 10f64.powf((e * 3) as f64);
    (
        to_fixed(
            m,
            if m < 10.0 {
                2
            } else if m < 100.0 {
                1
            } else {
                0
            },
        ),
        HUD_SUF[e as usize].to_string(),
    )
}

/// page.html `fmt`.
pub fn hud_fmt(n: impl Into<Big>) -> String {
    let (a, b) = hud_big(n);
    a + &b
}

/// page.html `short`: shop prices, 950,000 then 1.2M.
pub fn hud_short(n: impl Into<Big>) -> String {
    let n = n.into();
    let Some(n) = n.as_plain() else { return fmt_short(n) };
    let n = n.floor();
    if n < 1e6 {
        return locale_en(n);
    }
    let e = (n.log10() / 3.0).floor() as i32;
    let m = n / 10f64.powf((e * 3) as f64);
    if (e as usize) < HUD_SUF.len() {
        let suf = if e == 2 { "M" } else { HUD_SUF[e as usize] };
        to_fixed(
            m,
            if m < 10.0 {
                2
            } else if m < 100.0 {
                1
            } else {
                0
            },
        ) + suf
    } else {
        to_exponential(n, 1).replace('+', "")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn js_number_semantics() {
        assert_eq!(js_round(2.5), 3.0);
        assert_eq!(js_round(-2.5), -2.0);
        assert_eq!(to_fixed(0.125, 2), "0.13");
        assert_eq!(to_fixed(1.005, 2), "1.00");
        assert_eq!(to_fixed(99.95, 1), "100.0");
        assert_eq!(to_exponential(1.7976931348623157e308, 1), "1.8e+308");
        // the fast path agrees with the full expansion, ties included
        let slow = |x: f64, d: usize| {
            let exact = format!("{:.1100e}", x);
            let (mant, exp) = exact.split_once('e').unwrap();
            let mut e: i32 = exp.parse().unwrap();
            let all: Vec<u8> = mant.bytes().filter(|&c| c != b'.').collect();
            let (mut r, carry) = round_half_up(&all, d + 1);
            if carry {
                e += 1;
                r.pop();
            }
            let s = String::from_utf8(r).unwrap();
            let m = if d == 0 { s } else { format!("{}.{}", &s[..1], &s[1..]) };
            format!("{m}e{}{}", if e < 0 { '-' } else { '+' }, e.abs())
        };
        let mut seed = 12345u64;
        for i in 0..20000 {
            seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1442695040888963407);
            let x = f64::from_bits((seed >> 2) & 0x7fef_ffff_ffff_ffff);
            let x = if i % 3 == 0 { (x.log2().abs() * 1e3).round() / 8.0 + 0.5 } else { x };
            if x.is_finite() && x > 0.0 {
                for d in [0, 1, 2, 5] {
                    assert_eq!(to_exponential(x, d), slow(x, d), "{x:e} to {d} digits");
                }
            }
        }
        for x in [1.25, 2.5, 0.125, 1.5e-7, 9.5, 1e21 + 2.0f64.powi(20)] {
            assert_eq!(to_exponential(x, 1), slow(x, 1));
        }
        assert_eq!(locale_en(1234567.0), "1,234,567");
        assert_eq!(fmt_short(12345.0), "12.3K");
        assert_eq!(fmt_short(999_950.0), "1.0M");
    }

    #[test]
    fn suffixes_then_e_notation() {
        // today's formats, unchanged
        assert_eq!(fmt_short(1.5e35), "150Dc");
        assert_eq!(fmt_short(1.5e36), "1.5e36");
        assert_eq!(fmt_short(1.7e299), "1.7e299");
        assert_eq!(hud_fmt(1.234e12), "1.23T");
        assert_eq!(hud_fmt(1.234e40), "1.23e40");
        assert_eq!(hud_short(950_000.0), "950,000");
        assert_eq!(hud_short(1.2e6), "1.20M");
        assert_eq!(hud_short(3.3e50), "3.3e50");
        // past 1e300
        assert_eq!(hud_fmt(Big::new(1.2345, 308)), "1.23e308");
        assert_eq!(hud_big(Big::new(4.5, 1204)), ("4.50".into(), "e1,204".into()));
        assert_eq!(fmt_short(Big::new(7.1, 1_200_000)), "7.1e1.2M");
        assert_eq!(fmt_short(Big::new(9.96, 999)), "1.0e1,000", "the mantissa's carry moves the exponent");
        assert_eq!(fmt_short(Big::new(9.99, 999_999)), "1.0e1.0M");
        assert_eq!(hud_short(Big::new(3.0, 300)), "3.0e300");
        assert_eq!(hud_fmt(Big::new(5.0, 123_456_789_012)), "5.00e123B");
        assert_eq!(fmt_short(Big::new(1.0, crate::big::E_MAX)), "1.0e1.0Qi");
    }
}
