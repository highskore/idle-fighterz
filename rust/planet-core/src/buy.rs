//! The shop's bulk buys (×10 and max) and what an upgrade's next level does (the hover card).
//! None of it changes what a buy does: a bulk buy is the single buys in a row.

use crate::big::Big;
use crate::data::*;
use crate::game::{Game, WishBuff};
use crate::hud::Cue;
use crate::json::{num, Obj};
use crate::num::{fmt_short, js_round, to_fixed};

/// The most levels one max buy takes.
pub const BULK_MAX: u32 = 100_000;

/// A number on the hover card: two decimals at most, then the short suffixes.
fn nice(v: impl Into<Big>) -> String {
    let v = v.into();
    if !v.to_f64().is_finite() {
        return fmt_short(v);
    }
    if v < 1e4 {
        num(to_fixed(v.to_f64(), 2).parse().unwrap())
    } else {
        fmt_short(v)
    }
}

impl Game {
    /// Single buys of `u` in a row, on paper: `want` levels or none (all or nothing), or with `None` as many as you can
    /// afford. Returns how many and the power left after them. Levels too cheap to change what you hold (late, when
    /// you're astronomically rich) cost nothing one by one too, so max counts them in one search instead of a loop.
    fn plan(&self, u: Upg, want: Option<u32>) -> (u32, Big) {
        let l0 = self.s.lvf(u);
        let mut p = self.s.pl;
        let mut n = 0;
        if let Some(k) = want {
            while n < k {
                let c = self.cost_at(u, l0 + n as f64);
                if p < c {
                    return (0, self.s.pl);
                }
                p -= c;
                n += 1;
            }
            return (n, p);
        }
        let cap = BULK_MAX.min(u32::MAX - self.s.lv(u));
        let free = |i: u32| {
            let c = self.cost_at(u, l0 + i as f64);
            p >= c && p - c == p
        };
        if cap > 0 && free(0) {
            // costs rise with the level, so the free ones are a prefix: gallop past it, then halve back to its end
            let (mut lo, mut step) = (0, 1);
            while lo + step < cap && free(lo + step) {
                lo += step;
                step *= 2;
            }
            let mut hi = (lo + step).min(cap);
            while hi - lo > 1 {
                let mid = lo + (hi - lo) / 2;
                if free(mid) {
                    lo = mid;
                } else {
                    hi = mid;
                }
            }
            n = lo + 1;
        }
        while n < cap {
            let c = self.cost_at(u, l0 + n as f64);
            if p < c {
                break;
            }
            p -= c;
            n += 1;
        }
        (n, p)
    }

    /// Buys `n` levels of a shop upgrade (all or none), or with `n` 0 as many as you can afford: the same as that many
    /// single buys in a row, with one sound and one note.
    pub fn buy_n(&mut self, key: &str, n: u32) -> bool {
        let Some(u) = Upg::from_key(key) else { return false };
        let (k, after) = self.plan(u, if n == 0 { None } else { Some(n) });
        if k == 0 {
            return false;
        }
        let first = self.s.levels[u as usize] == 0;
        self.s.pl = after;
        self.s.levels[u as usize] += k;
        self.cue(Cue::Fx("buy"));
        for (n, id) in [(10, "tail10"), (25, "tail25"), (50, "tail50")] {
            if self.s.lv(Upg::Tail) >= n {
                self.ach(id);
            }
        }
        let charge;
        let note = match u {
            Upg::Partner if first => "bubbles wants to train with you",
            Upg::Galick if first && self.s.hero == Hero::Tien => "hold anywhere to charge the kikoho: at a villain it stakes a fifth of your power",
            Upg::Galick if first && self.s.hero == Hero::Piccolo => "hold anywhere to charge the special beam cannon: it spends his focus",
            Upg::Piccolo if first && self.s.hero == Hero::Piccolo => "kid gohan lands to meditate",
            Upg::Galick if first => {
                charge = format!("hold anywhere to charge a {}", hero_beam(self.s.hero).0);
                &charge
            }
            Upg::House => "a new capsule house lands",
            Upg::Piccolo if first => "piccolo lands to meditate",
            Upg::Chamber if first => "the time chamber door will appear — tap it",
            Upg::Kaio if first => {
                charge = format!("{} unlocked — hit the red button", self.boost());
                &charge
            }
            Upg::Bigbang if first => {
                charge = format!("{} — double-tap anywhere", hero_moves(self.s.hero).1);
                &charge
            }
            Upg::Itx if first => "instant transmission — tap with two fingers (or right-click), or press its button, to jump to a world you've been",
            Upg::Armor if first && self.s.hero == Hero::Piccolo => "weighted cape on — hit villains harder",
            Upg::Armor if first && self.s.hero == Hero::Krillin => "turtle shell on — hit villains harder",
            Upg::Armor if first && self.s.hero == Hero::Tien => "crane gi on — hit villains harder",
            Upg::Armor if first && self.s.hero == Hero::A17 => "ranger vest on — hit villains harder",
            Upg::Armor if first => "saiyan armor on — hit villains harder",
            _ => "",
        };
        if u == Upg::House {
            self.scenery();
        }
        if !note.is_empty() {
            self.event(note);
        }
        self.sync_shop();
        true
    }

    /// What `u` does at level `l`, in the shop's words.
    pub fn effect_at(&self, u: Upg, l: u32) -> String {
        let lf = l as f64;
        let idle = (1.0 + 0.5 * self.lvl(N_IDLE)) * if self.wished(WishBuff::Idle) { 3.0 } else { 1.0 };
        let per_s = |base: f64| format!("+{}/s", nice(lf * base * Self::ms_at(l) * idle));
        let none = "none".to_string();
        match u {
            Upg::Boots => format!("+{} per step", nice(lf * Self::ms_at(l))),
            Upg::Partner => per_s(4.0),
            Upg::House => per_s(40.0),
            Upg::Piccolo => per_s(60.0),
            Upg::Gravity => format!("×{} everything", nice(Big::from(1.15f64).pow(lf))),
            Upg::Cloud => format!("nimbus ×{} as often, {}s rides", nice(1.0 + lf * 0.6), nice(10.0 + lf * 2.0)),
            Upg::Scouter => {
                let chance = lf * 0.1 + self.lvl(N_CRIT) * 0.08;
                if chance <= 1.0 {
                    format!("{}% crits", num(js_round(chance * 100.0)))
                } else {
                    format!("crits always, ×{} crit damage", nice((2.0 + self.lvl(N_CRITX)) * (1.0 + 2.0 * (chance - 1.0))))
                }
            }
            Upg::Galick if l > 0 => format!("beams ×{}", nice(Self::beam_x_at(lf))),
            Upg::Senzu if l > 0 => format!("a bean every {}s, ×{}", nice(40.0 / lf), nice(Self::senzu_x_at(lf))),
            Upg::Armor => format!("+{}% vs villains", num(50.0 * lf)),
            Upg::Kaio if l > 0 => format!("×{} for 15s", nice(1.25 + 0.25 * lf)),
            Upg::Bigbang if l > 0 => format!("pays {} beams", nice(Self::bang_x_at(lf))),
            Upg::Chamber if l > 0 => format!("×{} inside", nice(1.5 + 0.5 * lf)),
            Upg::Tail => format!("{} ×{}", self.ape_name(false), nice(2.0 + 0.25 * lf)),
            Upg::Itx if l > 0 => {
                let min = (300.0 / (1.0 + 0.1 * (lf - 1.0))).max(90.0) / 60.0;
                let soon = (1.0 / (1.0 + 0.04 * lf)).max(0.7);
                format!("a jump every {} min, trips {}% sooner", nice(min), num(js_round(100.0 - 100.0 * soon)))
            }
            _ => none,
        }
    }

    /// The hover card for a shop row: `{now, next, rate?, cost, x10: {n, cost, can}, max: {n, cost, can}}`. `rate` is
    /// your power a second without timed buffs, now and with the next level, for the upgrades that change it.
    pub fn shop_info_json(&mut self, key: &str) -> String {
        let Some(u) = Upg::from_key(key) else { return "null".into() };
        let l = self.s.lv(u);
        let mut o = Obj::new().str("now", &self.effect_at(u, l)).str("next", &self.effect_at(u, l + 1));
        if matches!(u, Upg::Boots | Upg::Partner | Upg::Gravity | Upg::House | Upg::Piccolo) {
            let now = self.wrate();
            self.s.levels[u as usize] += 1;
            let next = self.wrate();
            self.s.levels[u as usize] -= 1;
            o = o.raw("rate", format!("[{},{}]", now.to_json(), next.to_json()));
        }
        o.big("cost", self.cost(u)).raw("x10", self.bulk_row(u, 10)).raw("max", self.bulk_row(u, 0)).end()
    }

    /// `{n, cost, can}` for buying `n` levels (0: max). ×10's cost is the ten prices summed; max's is what it would
    /// spend, or the next level's price when you can't afford one.
    fn bulk_row(&self, u: Upg, n: u32) -> String {
        let (k, after) = self.plan(u, if n == 0 { None } else { Some(n) });
        let cost = if n > 0 {
            let l0 = self.s.lvf(u);
            (0..n).fold(Big::ZERO, |sum, i| sum + self.cost_at(u, l0 + i as f64))
        } else if k > 0 {
            self.s.pl - after
        } else {
            self.cost(u)
        };
        Obj::new().num("n", if n > 0 { n as f64 } else { k as f64 }).big("cost", cost).bool("can", k > 0).end()
    }

    /// `{key: {n, cost, can}}` for every upgrade the shop shows, buying `n` (0: max): the buttons' prices in that mode.
    pub fn bulk_json(&self, n: u32) -> String {
        Upg::ALL.into_iter().filter(|&u| self.unlocked(u) || self.s.lv(u) > 0).fold(Obj::new(), |o, u| o.raw(u.key(), self.bulk_row(u, n))).end()
    }
}
