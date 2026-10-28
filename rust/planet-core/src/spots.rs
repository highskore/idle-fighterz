//! Screen spots written back by a renderer that isn't planet-render: until stage 1 draws the planet, the gated web
//! build draws it with game.js running in lockstep (see rust/HUD.md), and that renderer reports where it drew the
//! things taps and beams aim at. planet-render will set these fields directly; this is the same write-back as data.
//!
//! The JSON is `{lift, flip, seen, picc, monkey, boss, ginyu, movie, npc: {greg, kai, ...}, date, saibas, birds,
//! gadgets, ghosts}`: a spot is `[x, y]` (`[x, y, k]` with a scale, `[x, y, r]` for a ghost), `null` where nothing
//! was drawn; lists run in the timeline's own order.

use crate::game::Game;
use crate::json::Value;
use crate::timeline::Seen;

fn xy(v: Option<&Value>) -> Seen {
    match v {
        Some(Value::Arr(a)) if a.len() >= 2 => Some((a[0].as_f64()?, a[1].as_f64()?)),
        _ => None,
    }
}

fn nth(v: Option<&Value>, i: usize) -> Option<f64> {
    match v {
        Some(Value::Arr(a)) => a.get(i).and_then(Value::as_f64),
        _ => None,
    }
}

fn list(v: Option<&Value>) -> &[Value] {
    match v {
        Some(Value::Arr(a)) => a,
        _ => &[],
    }
}

impl Game {
    /// Applies a renderer's screen spots (see the module docs).
    pub fn set_spots(&mut self, s: &Value) {
        if let Some(l) = s.get("lift").and_then(Value::as_f64) {
            self.lift_now = l;
        }
        self.flip_now = matches!(s.get("flip"), Some(Value::Bool(true)));
        self.hero_seen = matches!(s.get("seen"), Some(Value::Bool(true)));
        let tl = &mut self.tl;
        tl.piccolo_at = xy(s.get("picc"));
        tl.monkey_at = xy(s.get("monkey")).map(|(x, y)| (x, y, nth(s.get("monkey"), 2).unwrap_or(1.0)));
        if let (Some(b), Some((x, y))) = (tl.boss.as_mut(), xy(s.get("boss"))) {
            b.x = x;
            b.y = y;
            b.k = nth(s.get("boss"), 2).unwrap_or(b.k);
        }
        if let Some(g) = tl.ginyu.as_mut() {
            for (m, v) in g.members.iter_mut().zip(list(s.get("ginyu"))) {
                if let Some((x, y)) = xy(Some(v)) {
                    (m.x, m.y, m.k) = (x, y, nth(Some(v), 2).unwrap_or(m.k));
                }
            }
        }
        if let Some(m) = tl.movie.as_mut() {
            for (h, v) in m.minions.iter_mut().zip(list(s.get("movie"))) {
                if let Some((x, y)) = xy(Some(v)) {
                    (h.x, h.y, h.k) = (Some(x), y, nth(Some(v), 2).unwrap_or(h.k));
                }
            }
        }
        let npc = s.get("npc");
        let at = |k: &str| xy(npc.and_then(|n| n.get(k)));
        if let Some(g) = tl.greg.as_mut() {
            g.sx = at("greg");
        }
        for (k, n) in [
            ("kai", &mut tl.kai),
            ("roshi", &mut tl.roshi),
            ("satan", &mut tl.satan),
            ("door", &mut tl.door),
            ("bean", &mut tl.bean),
            ("pud", &mut tl.pud),
            ("zen", &mut tl.zen),
        ] {
            if let Some(n) = n.as_mut() {
                n.sx = at(k);
            }
        }
        if let Some(k) = tl.kril.as_mut() {
            k.sx = at("kril");
        }
        if let Some(c) = tl.car.as_mut() {
            c.sx = at("car");
        }
        if let Some(y) = tl.yam.as_mut() {
            y.sx = at("yam");
        }
        if let Some(d) = tl.date.as_mut() {
            d.sx2 = xy(s.get("date"));
        }
        for (sb, v) in tl.saibas.iter_mut().zip(list(s.get("saibas"))) {
            sb.sx = xy(Some(v));
        }
        if let Some(a) = tl.a16.as_mut() {
            for (b, v) in a.birds.iter_mut().zip(list(s.get("birds"))) {
                b.sx = xy(Some(v));
            }
        }
        for (g, v) in tl.gadgets.iter_mut().zip(list(s.get("gadgets"))) {
            g.sx = xy(Some(v));
        }
        if let Some(snk) = tl.snk.as_mut() {
            for (g, v) in snk.ghosts.iter_mut().zip(list(s.get("ghosts"))) {
                g.sx = xy(Some(v));
                if let Some(r) = nth(Some(v), 2) {
                    g.r = r;
                }
            }
        }
    }
}
