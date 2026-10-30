//! The shop's bulk buys (×10 and max), undoing a big buy, and what an upgrade's next level does (the hover card).
//! None of it changes what a buy does: a bulk buy is the single buys in a row, and undo is an input like any other.

use crate::big::Big;
use crate::data::*;
use crate::game::{Game, WishBuff};
use crate::hud::Cue;
use crate::json::{num, Obj};
use crate::num::{fmt_short, js_round, to_fixed};

/// How long a big buy can be undone, in game seconds.
pub const UNDO_S: f64 = 5.0;
/// A buy is big when it spends at least this share of the power you held...
pub const UNDO_SHARE: f64 = 0.25;
/// ...and at least this much: the first minute's buys are all big, and all cheap.
pub const UNDO_MIN: f64 = 1000.0;
/// The most levels one max buy takes.
pub const BULK_MAX: u32 = 100_000;

/// Everything an undo has to find as the buy left it: the levels, and whatever spends, resets or forms up.
#[derive(Clone, Debug, PartialEq)]
struct Econ {
    levels: [u32; 15],
    form: usize,
    mastery: u32,
    tree: [u32; TREE.len()],
    seeds: Big,
    ascend: Big,
    godki: u32,
    gods: u32,
    zeno: u32,
    angel: [bool; ANGELS.len()],
    kaio_ready: f64,
    itx_ready: f64,
    drains: u32,
    playing: bool,
}

/// A big buy that can still be taken back.
#[derive(Clone, Debug)]
pub struct Undo {
    pub id: u32,
    levels: [u32; 15],
    before: Big,
    until: f64,
    after: Econ,
}

/// A number on the hover card: two decimals at most, then the short suffixes.
fn nice(v: impl Into<Big>) -> String {
    let v = v.into();
    if v < 1e4 {
        num(to_fixed(v.to_f64(), 2).parse().unwrap())
    } else {
        fmt_short(v)
    }
}

impl Game {
    fn econ(&self) -> Econ {
        let s = &self.s;
        Econ {
            levels: s.levels,
            form: s.form,
            mastery: s.mastery,
            tree: s.tree,
            seeds: s.seeds,
            ascend: s.ascend,
            godki: s.godki,
            gods: s.gods,
            zeno: s.zeno,
            angel: s.angel,
            kaio_ready: self.b.kaio_ready,
            itx_ready: self.tl.itx_ready,
            drains: self.drains,
            playing: self.playing,
        }
    }

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
    /// single buys in a row, with one sound and one note. A big one (see `UNDO_SHARE`) can be undone for `UNDO_S`.
    pub fn buy_n(&mut self, key: &str, n: u32) -> bool {
        let Some(u) = Upg::from_key(key) else { return false };
        let (k, after) = self.plan(u, if n == 0 { None } else { Some(n) });
        if k == 0 {
            return false;
        }
        let (before, levels, achs) = (self.s.pl, self.s.levels, self.s.ach.len());
        self.s.pl = after;
        self.s.levels[u as usize] += k;
        self.cue(Cue::Fx("buy"));
        for (n, id) in [(10, "tail10"), (25, "tail25"), (50, "tail50")] {
            if self.s.lv(Upg::Tail) >= n {
                self.ach(id);
            }
        }
        let first = levels[u as usize] == 0;
        let note = match u {
            Upg::Partner if first => "bubbles wants to train with you",
            Upg::Galick if first => {
                if self.kame() {
                    "hold anywhere to charge a kamehameha"
                } else {
                    "hold anywhere to charge a galick gun"
                }
            }
            Upg::House => "a new capsule house lands",
            Upg::Piccolo if first => "piccolo lands to meditate",
            Upg::Chamber if first => "the time chamber door will appear — tap it",
            Upg::Kaio if first => "kaioken unlocked — hit the red button",
            Upg::Bigbang if first => "big bang attack — double-tap anywhere",
            Upg::Itx if first => "instant transmission — tap with two fingers (or right-click), or press its button, to jump to a world you've been",
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
        let spent = before - after;
        // an achievement can't be taken back, so a buy that lands one can't be either
        if spent >= before * UNDO_SHARE && spent >= UNDO_MIN && self.s.ach.len() == achs {
            self.undo_seq += 1;
            let id = self.undo_seq;
            self.undo = Some(Undo { id, levels, before, until: self.t + UNDO_S, after: self.econ() });
            let label = if u == Upg::Galick && self.kame() { "kamehameha" } else { SHOP[u as usize].label };
            let text = if note.is_empty() {
                format!("{label}{} for {}", if k > 1 { format!(" ×{k}") } else { String::new() }, fmt_short(spent))
            } else {
                note.into()
            };
            self.undo_offer = Some((id, text));
        }
        true
    }

    /// Undo puts your power back to exactly what it was before the buy and takes the levels back. It rewinds power, not
    /// time: anything earned since goes with it (it was earned with the upgrade). Live for `UNDO_S`, while it gives
    /// power back, and only while nothing else that hangs on the buy has happened: another buy or a learn, a level
    /// granted, a form or a mastery star, a reset, kaioken or a jump, or dr. gero draining you.
    pub fn undo_live(&self) -> bool {
        self.undo.as_ref().is_some_and(|u| self.t <= u.until && self.s.pl < u.before && self.econ() == u.after)
    }

    /// Takes back the big buy `id`; false if it can't be any more.
    pub fn undo(&mut self, id: u32) -> bool {
        if !self.undo_live() || self.undo.as_ref().is_some_and(|u| u.id != id) {
            return false;
        }
        let u = self.undo.take().unwrap();
        self.s.pl = u.before;
        self.s.levels = u.levels;
        self.scenery();
        self.cue(Cue::Sfx("buy"));
        self.event(format!("undone — back to {} power", fmt_short(u.before)));
        self.sync_shop();
        true
    }

    /// The undo that just stopped being possible, if one did: the HUD greys its button.
    pub fn undo_lapse(&mut self) -> Option<u32> {
        if self.undo.is_some() && !self.undo_live() {
            return self.undo.take().map(|u| u.id);
        }
        None
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
            Upg::Tail => format!("great ape ×{}", nice(2.0 + 0.25 * lf)),
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
