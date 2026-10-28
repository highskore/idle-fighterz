//! Just enough JSON for the save and the HUD bridge, without dependencies: a writer that prints numbers and strings
//! the way `JSON.stringify` does, and a small parser for reading a save back.

use std::collections::BTreeMap;
use std::fmt::Write;

/// A parsed JSON value. Objects keep their keys sorted; order never matters to the readers here.
#[derive(Clone, Debug, PartialEq)]
pub enum Value {
    Null,
    Bool(bool),
    Num(f64),
    Str(String),
    Arr(Vec<Value>),
    Obj(BTreeMap<String, Value>),
}

impl Value {
    pub fn get(&self, k: &str) -> Option<&Value> {
        match self {
            Value::Obj(m) => m.get(k),
            _ => None,
        }
    }

    pub fn as_str(&self) -> Option<&str> {
        match self {
            Value::Str(s) => Some(s),
            _ => None,
        }
    }

    pub fn as_f64(&self) -> Option<f64> {
        match self {
            Value::Num(n) => Some(*n),
            _ => None,
        }
    }
}

/// `String(n)` / `JSON.stringify(n)` for a double: the shortest digits that round-trip, laid out by ECMAScript's
/// Number::toString rules (plain up to 1e21, exponent form below 1e-6). Non-finite numbers are `null` in JSON.
pub fn num(n: f64) -> String {
    if !n.is_finite() {
        return "null".into();
    }
    if n == 0.0 {
        return "0".into();
    }
    // Rust's {:e} gives the shortest round-trip digits too, as d.ddddde±x
    let e = format!("{:e}", n.abs());
    let (mant, exp) = e.split_once('e').unwrap();
    let digits: String = mant.chars().filter(|c| *c != '.').collect();
    let k = digits.len() as i32;
    let n10 = exp.parse::<i32>().unwrap() + 1;
    let mut s = String::from(if n < 0.0 { "-" } else { "" });
    if k <= n10 && n10 <= 21 {
        s += &digits;
        s.extend(std::iter::repeat_n('0', (n10 - k) as usize));
    } else if 0 < n10 && n10 <= 21 {
        s += &digits[..n10 as usize];
        s.push('.');
        s += &digits[n10 as usize..];
    } else if -6 < n10 && n10 <= 0 {
        s += "0.";
        s.extend(std::iter::repeat_n('0', (-n10) as usize));
        s += &digits;
    } else {
        s += &digits[..1];
        if k > 1 {
            s.push('.');
            s += &digits[1..];
        }
        let x = n10 - 1;
        let _ = write!(s, "e{}{}", if x < 0 { '-' } else { '+' }, x.abs());
    }
    s
}

/// A JSON string literal, escaped as `JSON.stringify` escapes it.
pub fn str(s: &str) -> String {
    let mut o = String::with_capacity(s.len() + 2);
    o.push('"');
    for c in s.chars() {
        match c {
            '"' => o += "\\\"",
            '\\' => o += "\\\\",
            '\n' => o += "\\n",
            '\r' => o += "\\r",
            '\t' => o += "\\t",
            '\u{8}' => o += "\\b",
            '\u{c}' => o += "\\f",
            c if (c as u32) < 0x20 => {
                let _ = write!(o, "\\u{:04x}", c as u32);
            }
            c => o.push(c),
        }
    }
    o.push('"');
    o
}

/// Builds a JSON object in insertion order.
#[derive(Default)]
pub struct Obj(String);

impl Obj {
    pub fn new() -> Self {
        Obj(String::new())
    }

    /// A key and an already-encoded value.
    pub fn raw(mut self, k: &str, v: impl AsRef<str>) -> Self {
        self.0.push(if self.0.is_empty() { '{' } else { ',' });
        self.0 += &str(k);
        self.0.push(':');
        self.0 += v.as_ref();
        self
    }

    pub fn num(self, k: &str, v: f64) -> Self {
        self.raw(k, num(v))
    }

    pub fn str(self, k: &str, v: &str) -> Self {
        self.raw(k, str(v))
    }

    pub fn bool(self, k: &str, v: bool) -> Self {
        self.raw(k, if v { "true" } else { "false" })
    }

    pub fn end(self) -> String {
        if self.0.is_empty() {
            "{}".into()
        } else {
            self.0 + "}"
        }
    }
}

/// A JSON array from already-encoded items.
pub fn arr<I: IntoIterator<Item = String>>(items: I) -> String {
    let v: Vec<String> = items.into_iter().collect();
    format!("[{}]", v.join(","))
}

/// Parses JSON text; `None` if it isn't valid JSON.
pub fn parse(s: &str) -> Option<Value> {
    let mut p = Parser { b: s.as_bytes(), i: 0 };
    let v = p.value()?;
    p.ws();
    (p.i == p.b.len()).then_some(v)
}

struct Parser<'a> {
    b: &'a [u8],
    i: usize,
}

impl Parser<'_> {
    fn ws(&mut self) {
        while self.i < self.b.len() && matches!(self.b[self.i], b' ' | b'\t' | b'\n' | b'\r') {
            self.i += 1;
        }
    }

    fn eat(&mut self, c: u8) -> Option<()> {
        self.ws();
        (self.b.get(self.i) == Some(&c)).then(|| self.i += 1)
    }

    fn lit(&mut self, w: &str, v: Value) -> Option<Value> {
        self.b[self.i..].starts_with(w.as_bytes()).then(|| {
            self.i += w.len();
            v
        })
    }

    fn value(&mut self) -> Option<Value> {
        self.ws();
        match *self.b.get(self.i)? {
            b'{' => {
                self.i += 1;
                let mut m = BTreeMap::new();
                if self.eat(b'}').is_some() {
                    return Some(Value::Obj(m));
                }
                loop {
                    self.ws();
                    let k = self.string()?;
                    self.eat(b':')?;
                    m.insert(k, self.value()?);
                    if self.eat(b',').is_none() {
                        self.eat(b'}')?;
                        return Some(Value::Obj(m));
                    }
                }
            }
            b'[' => {
                self.i += 1;
                let mut v = Vec::new();
                if self.eat(b']').is_some() {
                    return Some(Value::Arr(v));
                }
                loop {
                    v.push(self.value()?);
                    if self.eat(b',').is_none() {
                        self.eat(b']')?;
                        return Some(Value::Arr(v));
                    }
                }
            }
            b'"' => self.string().map(Value::Str),
            b't' => self.lit("true", Value::Bool(true)),
            b'f' => self.lit("false", Value::Bool(false)),
            b'n' => self.lit("null", Value::Null),
            _ => {
                let st = self.i;
                while self.i < self.b.len() && matches!(self.b[self.i], b'-' | b'+' | b'.' | b'e' | b'E' | b'0'..=b'9') {
                    self.i += 1;
                }
                std::str::from_utf8(&self.b[st..self.i]).ok()?.parse().ok().map(Value::Num)
            }
        }
    }

    fn string(&mut self) -> Option<String> {
        if self.b.get(self.i) != Some(&b'"') {
            return None;
        }
        self.i += 1;
        let mut out: Vec<u16> = Vec::new();
        let mut raw = Vec::new();
        let flush = |raw: &mut Vec<u8>, out: &mut Vec<u16>| {
            out.extend(String::from_utf8_lossy(raw).encode_utf16());
            raw.clear();
        };
        loop {
            let c = *self.b.get(self.i)?;
            self.i += 1;
            match c {
                b'"' => {
                    flush(&mut raw, &mut out);
                    return Some(String::from_utf16_lossy(&out));
                }
                b'\\' => {
                    flush(&mut raw, &mut out);
                    let e = *self.b.get(self.i)?;
                    self.i += 1;
                    match e {
                        b'u' => {
                            let h = std::str::from_utf8(self.b.get(self.i..self.i + 4)?).ok()?;
                            out.push(u16::from_str_radix(h, 16).ok()?);
                            self.i += 4;
                        }
                        _ => out.push(match e {
                            b'n' => b'\n',
                            b'r' => b'\r',
                            b't' => b'\t',
                            b'b' => 8,
                            b'f' => 12,
                            c => c,
                        } as u16),
                    }
                }
                c => raw.push(c),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn numbers_print_like_js() {
        for (n, s) in [
            (0.0, "0"),
            (1.0, "1"),
            (-2.5, "-2.5"),
            (45.000000000000014, "45.000000000000014"),
            (1e21, "1e+21"),
            (123456789012345680000.0, "123456789012345680000"),
            (1.5e-7, "1.5e-7"),
            (0.000001, "0.000001"),
            (2e14, "200000000000000"),
            (1.7976931348623157e308, "1.7976931348623157e+308"),
            (f64::INFINITY, "null"),
        ] {
            assert_eq!(num(n), s);
        }
    }

    #[test]
    fn parses_what_it_writes() {
        let s = Obj::new().num("a", 1.5).str("b", "x\"y\n").raw("c", arr(["1".into(), "true".into()])).raw("d", Obj::new().end()).end();
        let v = parse(&s).unwrap();
        assert_eq!(v.get("a"), Some(&Value::Num(1.5)));
        assert_eq!(v.get("b").and_then(Value::as_str), Some("x\"y\n"));
        assert_eq!(v.get("c"), Some(&Value::Arr(vec![Value::Num(1.0), Value::Bool(true)])));
        assert_eq!(parse("{\"k\":\"\\u00e9\"}").unwrap().get("k").and_then(Value::as_str), Some("é"));
        assert!(parse("{").is_none());
    }
}
