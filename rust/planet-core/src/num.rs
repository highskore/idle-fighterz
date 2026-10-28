//! JS number semantics the game leans on (Math.round, toFixed, toExponential, toLocaleString) and the three
//! power formatters: the game's `fmtShort` and the HUD's `fmt` / `short` from page.html.

/// `Math.round`: halves go up, toward +infinity.
pub fn js_round(x: f64) -> f64 {
    let f = x.floor();
    if x - f >= 0.5 {
        f + 1.0
    } else {
        f
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
    let exact = format!("{:.1100e}", x.abs());
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

const SUF: [&str; 12] = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];
// the HUD's table leaves K and M out: full digits run up to a billion
const HUD_SUF: [&str; 12] = ["", "", "", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No", "Dc"];

/// game.js `fmtShort`: floating gains, event text. 12345 → "12.3K".
pub fn fmt_short(n: f64) -> String {
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
pub fn hud_big(n: f64) -> (String, String) {
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
pub fn hud_fmt(n: f64) -> String {
    let (a, b) = hud_big(n);
    a + &b
}

/// page.html `short`: shop prices, 950,000 then 1.2M.
pub fn hud_short(n: f64) -> String {
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
        assert_eq!(locale_en(1234567.0), "1,234,567");
        assert_eq!(fmt_short(12345.0), "12.3K");
        assert_eq!(fmt_short(999_950.0), "1.0M");
    }
}
