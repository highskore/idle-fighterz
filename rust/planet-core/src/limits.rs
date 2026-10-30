//! Breaking the ceilings, and the number milestones.
//!
//! The ki ceiling creeps up as play goes on, driven by **strain**: a second of play is a second of strain, and taps,
//! full beams, big bangs and kaioken add more. It creeps only as far as the current **limit** (limit I at a ceiling of
//! 1e6, each one after it at twice the exponent). Pinned there, with the engine pushing past it, strain fills the break
//! meter instead; when it's full the limit breaks: the old limit becomes a floor under the engine, the lid lifts to the
//! next limit and the creep runs twice as fast. Limits I–V each bring a named reward, and from limit III every break is
//! also a form-up (a limit-breaker form). Nothing resets them: not ascending, god ki or zeno.
//!
//! Milestones go by lifetime best power: named ones (1e10, 1e100, 1.8e308, 1e1000, 1e10,000, …) play a scene
//! (planet-render's `limits`), with small beats between them; each gives ×2 for 30s. The text is the usual toast.

use crate::big::Big;
use crate::data::{
    ladder_of, roman_static, BREAK_G, BREAK_S, CEIL0, CEIL_STEP, CEIL_T, LIMIT0, STRAIN_BANG, STRAIN_BEAM, STRAIN_KAIO, STRAIN_TAP, STRAIN_TAP_GAP,
};
use crate::game::Game;
use crate::geom::{ap, cross, dot, m_mul, mul, ortho, rot};
use crate::hud::Cue;
use crate::jsmath::{atan2, hypot};

/// A limit break: he powers up for `BREAK_UP`s, the world freezes and cracks, then the colour floods back.
pub const BREAK_UP: f64 = 3.2;
pub const BREAK_LEN: f64 = 6.6;
/// A milestone's beat and its length.
pub const MILE_HIT: f64 = 1.6;
pub const MILE_LEN: f64 = 5.0;
/// the milestones' ×2, for this long
pub const MILE_BOOST_S: f64 = 30.0;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Kind {
    /// limit `n` breaks
    Break(u32),
    /// a named milestone (`MILE_NAMES` index)
    Mile(u32),
}

/// A scene in progress, for planet-render.
#[derive(Clone, Debug)]
pub struct Moment {
    pub kind: Kind,
    pub t0: f64,
}

impl Moment {
    pub fn age(&self, t: f64) -> f64 {
        t - self.t0
    }
    pub fn len(&self) -> f64 {
        match self.kind {
            Kind::Break(_) => BREAK_LEN,
            Kind::Mile(_) => MILE_LEN,
        }
    }
}

/// log10 of the named milestones; past the table, every ×10 of the exponent.
const NAMED: [f64; 7] = [10.0, 100.0, 308.2547155599167, 1000.0, 1e4, 1e5, 1e6];

/// The `i`-th milestone past 9,000: log10 of its power, and its named index if it plays a scene. Between two named
/// ones the small beats fall on each step of the lower one's leading power of ten (1e20 … 1e90, then 1e200, 1e300,
/// 1e400 … 1e900, then 1e2,000 …), so a beat comes every hour or two.
pub fn milestone(i: u32) -> (f64, Option<u32>) {
    let named = |k: usize| if k < NAMED.len() { NAMED[k] } else { 10f64.powi(k as i32) };
    let (mut k, mut n) = (0usize, 0u32);
    loop {
        let (a, b) = (named(k), named(k + 1));
        if n == i {
            return (a, Some(k as u32));
        }
        n += 1;
        let step = 10f64.powf(a.log10().floor());
        let mut x = (a / step).floor() * step + step;
        while x < b {
            if n == i {
                return (x, None);
            }
            n += 1;
            x += step;
        }
        k += 1;
    }
}

impl Game {
    /// log10 of limit `n`'s ki ceiling (n = 1 for limit I).
    pub fn limit_log(n: u32) -> f64 {
        LIMIT0 * 2f64.powi(n as i32 - 1)
    }

    /// The floor under the engine: every limit broken, multiplied.
    pub fn floor(&self) -> Big {
        if self.s.limits == 0 {
            Big::from(1.0)
        } else {
            Big::exp10(LIMIT0 * (2f64.powi(self.s.limits as i32) - 1.0))
        }
    }

    /// log10 of where the ceiling has crept to (before the lid and the floor clamp it).
    fn creep_log(&self) -> f64 {
        CEIL0.log10() + self.s.creep + self.s.uni_best as f64 * CEIL_STEP.log10()
    }

    /// Whether the ceiling has crept up to the current limit.
    pub fn at_limit(&self) -> bool {
        self.creeping() && self.creep_log() >= Self::limit_log(self.s.limits + 1)
    }

    /// The ceiling creeps once the multiverse is open (or a limit is broken: then it never stops).
    pub fn creeping(&self) -> bool {
        self.s.multi || self.s.limits > 0
    }

    /// The ki ceiling: past it, the engine shrinks to a small power.
    pub fn ceiling(&self) -> Big {
        let lid = Self::limit_log(self.s.limits + 1);
        let floor = if self.s.limits > 0 { Self::limit_log(self.s.limits) } else { f64::MIN };
        Big::exp10(self.creep_log().min(lid).max(floor))
    }

    /// Strain needed to break the next limit.
    pub fn break_need(&self) -> f64 {
        BREAK_S * BREAK_G.powi(self.s.limits as i32)
    }

    /// A training tap's strain (at most one every `STRAIN_TAP_GAP`s counts).
    pub(crate) fn strain_tap(&mut self) {
        if self.t - self.strain_tap_t >= STRAIN_TAP_GAP {
            self.strain_tap_t = self.t;
            self.strain_extra += STRAIN_TAP;
        }
    }

    pub(crate) fn strain_beam(&mut self) {
        self.strain_extra += STRAIN_BEAM;
    }

    pub(crate) fn strain_bang(&mut self) {
        self.strain_extra += STRAIN_BANG;
    }

    /// Strain per second of play right now, over the last second (for the HUD and tests): 1 idle.
    pub fn strain_now(&self) -> f64 {
        self.strain_rate
    }

    /// One frame of strain: the creep, the break meter, the break, the milestones.
    pub(crate) fn limits_step(&mut self, t: f64, dt: f64) {
        let kaio = if self.b.kaio_until > t { STRAIN_KAIO } else { 1.0 };
        let s = (dt + std::mem::take(&mut self.strain_extra)) * kaio;
        self.strain_rate += (s / dt.max(1e-9) - self.strain_rate) * (dt / 1.0).min(1.0);
        if self.creeping() {
            let lid = Self::limit_log(self.s.limits + 1);
            let base = self.creep_log();
            if base < lid {
                let speed = CEIL_T.log10() / 60.0 * 2f64.powi(self.s.limits as i32);
                self.s.creep += (s * speed).min(lid - base);
            } else if self.core() >= self.ceiling() && self.mo.is_none() {
                self.s.meter += s;
                if self.s.meter >= self.break_need() {
                    self.limit_break(t);
                }
            }
        }
        self.milestones(t);
        self.moment_step(t, dt);
    }

    fn limit_break(&mut self, t: f64) {
        self.s.meter = 0.0;
        self.s.limits += 1;
        let n = self.s.limits;
        let r = roman_static(n);
        self.forms = ladder_of(self.s.hero, n);
        self.mo = Some(Moment { kind: Kind::Break(n), t0: t });
        self.cue(Cue::Sfx("form"));
        self.cue(Cue::Scene(true));
        self.ach("limit1");
        if n >= 5 {
            self.ach("limit5");
        }
        let reward = match n {
            1 => "the grand priest takes notice…".to_string(),
            2 => "zenkai without limit: ki seeds count for more".to_string(),
            3 => format!("beyond the forms: from now on every limit you break is a new form (×{})", 2),
            4 => "the god limit: god ki now compounds".to_string(),
            5 => format!("the universe limit: universe stars ×{}", crate::data::STAR_X_V),
            _ => "your old limit is your new base".to_string(),
        };
        let msg = format!("you broke limit {r}! {reward}");
        self.after(BREAK_UP, crate::timeline::Later::Event(msg, 4600.0));
        let next = crate::num::fmt_short(Big::exp10(Self::limit_log(n + 1)));
        let msg = format!("your old limit is your new base — next limit at a ki ceiling of {next}");
        self.after(BREAK_UP + 4.7, crate::timeline::Later::Event(msg, 3600.0));
    }

    fn milestones(&mut self, t: f64) {
        if self.mo.is_some() || self.xf.is_some() {
            return;
        }
        let (at, named) = milestone(self.s.mile);
        if self.s.best.log10() < at {
            return;
        }
        self.s.mile += 1;
        self.b.boost_until = self.b.boost_until.max(t + MILE_BOOST_S);
        let pw = crate::num::fmt_short(Big::exp10(at));
        let line = match named {
            None => {
                self.cue(Cue::Sfx("coin"));
                self.cue(Cue::Fx("star"));
                self.flash_t = self.flash_t.max(0.25);
                self.mile_burst();
                format!("power passes {pw}! ×2 for {MILE_BOOST_S}s")
            }
            Some(k) => {
                self.mo = Some(Moment { kind: Kind::Mile(k), t0: t });
                for (i, id) in [(1, "googol"), (2, "infinity"), (3, "applause")] {
                    if k == i {
                        self.ach(id);
                    }
                }
                let who = match k {
                    0 => format!("the scouter exploded! power {pw}"),
                    1 => "whis raises an eyebrow: \"oh my. a googol.\"".into(),
                    2 => "past infinity — beerus wakes up: \"…that's infinity. how annoying.\"".into(),
                    3 => "zeno claps! \"wow! you're super strong!\"".into(),
                    4 => "the grand priest smiles: \"how interesting.\"".into(),
                    5 => "both zenos clap together!".into(),
                    6 => "shenron: \"that is beyond my power.\"".into(),
                    _ => match (k - 7) % 5 {
                        0 => format!("whis: \"my, my. {pw}? still going?\""),
                        1 => format!("beerus: \"who keeps making that noise?\" — {pw}"),
                        2 => format!("zeno: \"again! again!\" — {pw}"),
                        3 => format!("the grand priest: \"the multiverse has never seen {pw}.\""),
                        _ => format!("shenron: \"{pw}… even further beyond my power.\""),
                    },
                };
                format!("{who} — ×2 for {MILE_BOOST_S}s")
            }
        };
        let after = if named.is_some() { MILE_HIT } else { 0.0 };
        if let Some(k) = named {
            let new = Self::looks_of(k);
            if !new.is_empty() {
                let msg = format!("new looks: {} — wear them from the menu", new.join(", "));
                self.after(MILE_HIT + 4.2, crate::timeline::Later::Event(msg, 4000.0));
            }
        }
        self.after(after, crate::timeline::Later::Event(line, 4000.0));
    }

    /// A small beat's burst at his hands: green, then blue-violet, then gold-pink as the numbers grow.
    fn mile_burst(&mut self) {
        let (x, y) = self.hand_pos();
        let e = self.s.best.log10();
        let cols: &[u32] = if e < 100.0 {
            &[0xffffff, 0x9cf0b8, 0x34d873]
        } else if e < 1000.0 {
            &[0xffffff, 0xbfe9ff, 0x6fb0ff, 0xb59cff]
        } else {
            &[0xffffff, 0xffe02e, 0xff9ad8, 0x9fe6ff]
        };
        self.burst_at(x, y - 6.0, cols, 40, 180.0);
    }

    /// A scene's beats: he poses on top of the planet, facing us; the shake builds while a limit strains.
    fn moment_step(&mut self, t: f64, dt: f64) {
        let Some(m) = self.mo.clone() else { return };
        let age = m.age(t);
        if age > m.len() {
            self.mo = None;
            if matches!(m.kind, Kind::Break(_)) {
                self.cue(Cue::Scene(false));
            }
            return;
        }
        if let Kind::Break(_) = m.kind {
            if age < m.len() - 0.5 {
                self.b.pose_until = t + 0.3;
                if self.inp.drag.is_none() && !self.inp.w2_pole {
                    let v = ap(&self.cam.m, self.frame3.road_pt(self.phi));
                    let u = [0.0, 0.42, 0.91];
                    let ax = cross(v, u);
                    let s = hypot(&ax);
                    if s > 1e-4 {
                        self.cam.m = ortho(&m_mul(&rot(mul(ax, 1.0 / s), atan2(s, dot(v, u)) * 1f64.min(dt * 3.0)), &self.cam.m));
                    }
                }
            }
            if age < BREAK_UP && !self.calm {
                self.shake = self.shake.max(0.1 + age / BREAK_UP * 0.45);
            }
            if age >= BREAK_UP && age - dt < BREAK_UP {
                if !self.calm {
                    self.shake = 1.0;
                }
                self.cue(Cue::Sfx("boom"));
                self.cue(Cue::Fx("super"));
            }
        } else if age >= MILE_HIT && age - dt < MILE_HIT {
            if !self.calm {
                self.shake = self.shake.max(0.6);
            }
            self.cue(Cue::Sfx("boom"));
        }
    }

    /// While a limit is breaking, the next form waits for the scene to end.
    pub(crate) fn breaking(&self) -> bool {
        self.mo.as_ref().is_some_and(|m| matches!(m.kind, Kind::Break(_)))
    }

    /// The HUD's standing line: the limit and its strain, or the limits broken; and the next milestone.
    pub fn limit_line(&self) -> String {
        let next = if self.s.o9k { format!("next: {}", crate::num::fmt_short(Big::exp10(milestone(self.s.mile).0))) } else { String::new() };
        let head = if self.at_limit() {
            let n = self.s.limits + 1;
            let pct = (self.s.meter / self.break_need() * 100.0).floor().min(99.0);
            format!("ki limit {} ({}) — strain {pct}%", roman_static(n), crate::num::fmt_short(Big::exp10(Self::limit_log(n))))
        } else if self.s.limits > 0 {
            format!("limits broken {}", self.s.limits)
        } else if self.core() > self.ceiling() {
            if self.s.multi {
                "ki ceiling — it rises as you train; clearing universes lifts it too".into()
            } else {
                "ki ceiling — reach ultra instinct or finish the sagas: the multiverse lifts it".into()
            }
        } else {
            String::new()
        };
        match (head.is_empty(), next.is_empty()) {
            (true, _) => next,
            (false, true) => head,
            (false, false) => format!("{head} · {next}"),
        }
    }
}

impl Game {
    /// Preview hooks: `#limit1` (… `#limitN`) opens with limit N about to break, late in the tournament of power;
    /// `#mile0` (… `#mileK`) with the K-th named milestone (0: 1e10, 1: 1e100, 2: infinity, 3: 1e1000 …) about to land.
    pub(crate) fn limits_preview(&mut self, hash: &str) {
        let num = |k: &str| -> Option<u32> {
            let i = hash.find(k)? + k.len();
            hash[i..].chars().take_while(|c| c.is_ascii_digit()).collect::<String>().parse().ok()
        };
        let late = |g: &mut Game, pl: Big| {
            g.s.saga = crate::data::VILLAINS.len() as u32;
            g.s.multi = true;
            g.session = 111.0;
            g.s.uni = 3;
            g.s.uni_best = 3;
            g.s.ustars = 3;
            g.s.form = crate::data::MUI_FORM;
            g.s.mastery = ((pl.log10() - 17.3) / 3.0).ceil().max(0.0) as u32;
            g.s.pl = pl;
            g.s.best = pl;
            g.s.namek_at = pl * 1e6;
            g.s.trips = 3;
            g.s.o9k = true;
            g.s.ach.insert("o9k");
            g.tl.next_boss = 1e9;
            g.tl.next_saga = 1e9;
            // and no trip for a while: the scene plays at home
            g.tl.home_since = g.session + 600.0;
        };
        if let Some(n) = num("limit").filter(|&n| n >= 1) {
            self.s.limits = n - 1;
            self.s.levels[crate::data::Upg::Gravity as usize] = 60;
            self.s.ascend = Big::from(4e7);
            late(self, Big::exp10(Self::limit_log(n) + 15.0));
            self.s.creep += Self::limit_log(n) - self.creep_log();
            self.s.meter = self.break_need() - 1.0;
            let (mut i, at) = (0, Self::limit_log(n) + 15.0);
            while milestone(i).0 <= at {
                i += 1;
            }
            self.s.mile = i;
        }
        if let Some(k) = num("mile") {
            let mut i = 0;
            while milestone(i).1 != Some(k) {
                i += 1;
            }
            self.s.mile = i;
            let at = milestone(i).0;
            let pl = Big::exp10(at + 0.0002);
            if k == 0 {
                self.s.form = 6;
                self.s.namek_at = pl * 1e6;
                self.s.trips = 3;
                self.s.pl = pl;
                self.s.best = pl;
                self.s.o9k = true;
                self.s.ach.insert("o9k");
            } else {
                late(self, pl);
                self.s.form = crate::data::MUI_FORM + 1;
            }
        }
    }
}
