//! The run state of the heroes game.js doesn't have, and what each one changes about the economy. None of it is
//! saved: it starts over each run (a new visit, an ascend, god ki, zeno) and when you switch heroes. Every new hero
//! keeps his recent income (what he's earned a second, smoothed), which his own payouts are measured in.
//!
//! Piccolo meditates. He starts a run at full focus, and left alone he sits cross-legged and builds it back, +1% a
//! second. His steady income (the steps, laps and passive) is ×0.5 at no focus and ×1 at full, so an idle Piccolo
//! earns what an idle Vegeta does. A training tap spends a slice of focus and pays it out; a beam, his special beam
//! cannon, spends focus in proportion to its charge and pays much more for it. Taps and beams themselves pay as anyone's.
//!
//! Krillin throws destructo discs: his taps are discs, not training. A tap that hits nothing else throws one toward
//! where you tapped (on himself, straight ahead), at most one every `DISC_GAP`; a chain counts as his combo. It cuts every saibaman, soldier, meteor and orb along its
//! line, each paying as if taken by hand, and each cut after the first in one throw also pays a chain bonus that
//! doubles with every cut. Left alone he throws one by himself every `DISC_AUTO` at the nearest saibaman or meteor
//! (never at an orb: running picks those up anyway). After `BARRAGE_CUTS` cuts, his next disc at a villain is a giant
//! one that takes a fifth of its hp.

use crate::big::Big;
use crate::data::{Hero, LAP, N_LEGS, N_STRIDE};
use crate::jsmath::{cos, hypot, sin};
use crate::Game;

/// How far back "recently" reaches: income a second, smoothed over about this many seconds.
pub const RATE_SECS: f64 = 60.0;

/// Focus gained a second while he's left alone.
pub const FOCUS_RISE: f64 = 0.01;
/// Seconds after the last tap before he settles to meditate.
pub const FOCUS_REST: f64 = 2.0;
/// Focus one training tap spends.
pub const FOCUS_TAP: f64 = 0.04;
/// Seconds of his recent income a full bar pays when taps spend it, and when the cannon does.
pub const TAP_SECS: f64 = 20.0;
pub const CANNON_SECS: f64 = 155.0;
/// Strain (limits.rs) for a full bar of focus the cannon spends: the hundred seconds of meditation it took count as
/// training, as a tapping player's taps do.
pub const STRAIN_FOCUS: f64 = 100.0;
/// His steady income with no focus; full focus doubles it.
pub const PICCOLO_BASE: f64 = 0.5;

/// Seconds between krillin's discs, and between the ones he throws by himself.
pub const DISC_GAP: f64 = 0.4;
pub const DISC_AUTO: f64 = 15.0;
/// How far off its line a disc cuts (past a target's own size), and how far it flies, in the game's pixels.
pub const DISC_BAND: f64 = 6.0;
pub const DISC_RANGE: f64 = 240.0;
/// A chain's bonus: seconds of his recent income for the second cut in one throw, doubling for each one after.
pub const CHAIN_SECS: f64 = 1.0;
/// Cuts that charge the barrage, and the share of a villain's hp it takes.
pub const BARRAGE_CUTS: u32 = 10;
pub const BARRAGE_HP: f64 = 0.2;
/// How long a thrown disc is in the air (the renderer draws it; the cuts land when it's thrown).
pub const DISC_FLIGHT: f64 = 0.45;

/// A disc in the air, from (x0, y0) to (x1, y1), thrown at `t0`; `big` for the barrage.
#[derive(Clone, Debug, PartialEq)]
pub struct Disc {
    pub t0: f64,
    pub x0: f64,
    pub y0: f64,
    pub x1: f64,
    pub y1: f64,
    pub big: bool,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub enum Kind {
    #[default]
    None,
    Piccolo {
        focus: f64,
    },
    Krillin {
        /// cuts toward the barrage, the last disc thrown, the next one he throws by himself, and those in the air
        cuts: u32,
        last: f64,
        auto: f64,
        discs: Vec<Disc>,
    },
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct HeroRt {
    pub kind: Kind,
    /// what he earned since `tick` began, and his income a second, smoothed (his own payouts left out)
    pub earned: Big,
    pub tick: f64,
    pub rate: Big,
}

impl Kind {
    fn of(h: Hero) -> Self {
        match h {
            Hero::Piccolo => Kind::Piccolo { focus: 1.0 },
            Hero::Krillin => Kind::Krillin { cuts: 0, last: -9.0, auto: DISC_AUTO, discs: Vec::new() },
            _ => Kind::None,
        }
    }
}

/// A target a disc can cut, at its screen spot with its half-size.
#[derive(Clone, Copy)]
enum Target {
    Saiba(usize),
    Meteor(usize),
    Orb(usize),
}

impl Game {
    /// A fresh run's state for the hero.
    pub(crate) fn hero_reset(&mut self) {
        self.hero_rt = HeroRt { kind: Kind::of(self.s.hero), ..Default::default() };
    }

    /// The state for the hero now playing, kept if it's already his.
    pub(crate) fn hero_sync(&mut self) {
        if std::mem::discriminant(&self.hero_rt.kind) != std::mem::discriminant(&Kind::of(self.s.hero)) {
            self.hero_reset();
        }
    }

    /// Piccolo's focus, 0..1 (0 for everyone else).
    pub fn focus(&self) -> f64 {
        match self.hero_rt.kind {
            Kind::Piccolo { focus } => focus,
            _ => 0.0,
        }
    }

    fn set_focus(&mut self, f: f64) {
        if let Kind::Piccolo { focus } = &mut self.hero_rt.kind {
            *focus = f.clamp(0.0, 1.0);
        }
    }

    /// The hero's own factor on his steady income.
    pub fn hero_x(&self) -> f64 {
        match self.hero_rt.kind {
            Kind::Piccolo { focus } => PICCOLO_BASE * (1.0 + focus),
            _ => 1.0,
        }
    }

    /// What the full moon makes him: a saiyan's great ape (or giant ape), piccolo's giant namekian, krillin's max
    /// power (his gi torn off, every muscle up).
    pub fn ape_name(&self, giant: bool) -> &'static str {
        match self.s.hero {
            Hero::Piccolo => "giant namekian",
            Hero::Krillin => "max power",
            _ if giant => "giant ape",
            _ => "great ape",
        }
    }

    /// The shop's names for the upgrades the hero has his own of.
    pub fn own_label(&self, u: crate::data::Upg) -> Option<&'static str> {
        use crate::data::Upg;
        Some(match (self.s.hero, u) {
            (Hero::Goku | Hero::Gohan | Hero::Krillin, Upg::Galick) => "kamehameha",
            (Hero::Piccolo, Upg::Galick) => "special beam cannon",
            (Hero::Piccolo, Upg::Piccolo) => "kid gohan",
            (Hero::Piccolo, Upg::Tail) => "giant training",
            (Hero::Krillin, Upg::Tail) => "max power training",
            (Hero::Piccolo, Upg::Armor) => "weighted cape",
            (Hero::Krillin, Upg::Armor) => "turtle shell",
            _ => return None,
        })
    }

    /// Krillin's cuts toward the barrage (0 for everyone else).
    pub fn cuts(&self) -> u32 {
        match self.hero_rt.kind {
            Kind::Krillin { cuts, .. } => cuts,
            _ => 0,
        }
    }

    /// Krillin's discs in the air.
    pub fn discs(&self) -> &[Disc] {
        match &self.hero_rt.kind {
            Kind::Krillin { discs, .. } => discs,
            _ => &[],
        }
    }

    /// Piccolo sits cross-legged and meditates: left alone, and not busy being something else.
    pub fn meditating(&self) -> bool {
        let t = self.t;
        matches!(self.hero_rt.kind, Kind::Piccolo { .. })
            && t - self.last_click >= FOCUS_REST
            && self.inp.charging == 0.0
            && self.b.ape_until <= t
            && self.b.fuse_until <= t
            && self.b.fused.is_none_or(|f| f.1 <= t)
            && self.b.pose_until <= t
            && self.riding <= 0.0
            && self.xf.is_none()
            && self.tl.struggle.is_none()
            && !self.eating()
    }

    /// What the hero's own payouts are measured in: his income a second lately, and never less than his steady
    /// income at full strength (the steps, the lap bonus at his running pace and the passive, without timed buffs).
    fn recent(&self) -> Big {
        let lap = self.lap_value();
        let pace = 0.42 * (1.0 + 0.1 * self.lvl(N_STRIDE));
        let laps = lap * (4.0 * (1.0 + 0.5 * self.lvl(N_LEGS)) * pace / LAP);
        let steady = (lap / 7.0 + laps + self.passive()) * self.mult(true);
        steady.max(self.hero_rt.rate)
    }

    /// Everything gained goes through `gain`: the new heroes count it toward their recent income.
    pub(crate) fn hero_earned(&mut self, n: Big) {
        if self.hero_rt.kind != Kind::None {
            self.hero_rt.earned += n;
        }
    }

    /// A hero's own payout at (x, y), left out of his recent income so one payout doesn't feed the next.
    fn own_pay(&mut self, pay: Big, x: f64, y: f64) {
        self.gain_at(pay, x, y, true);
        self.hero_rt.earned = (self.hero_rt.earned - pay).max(Big::ZERO);
    }

    /// Each frame: recent income is brought up to date once a second; piccolo's meditation builds focus; krillin
    /// throws a disc by himself now and then, and his discs land.
    pub(crate) fn hero_step(&mut self, dt: f64) {
        if self.hero_rt.kind == Kind::None {
            return;
        }
        let r = &mut self.hero_rt;
        r.tick += dt;
        if r.tick >= 1.0 {
            let now = r.earned / r.tick;
            r.rate = r.rate + (now - r.rate) * (r.tick / RATE_SECS).min(1.0);
            (r.earned, r.tick) = (Big::ZERO, 0.0);
        }
        if self.meditating() {
            let f = self.focus();
            if f < 1.0 {
                self.set_focus(f + FOCUS_RISE * dt);
                if self.focus() >= 1.0 {
                    self.once("focus", "full focus — hold to fire the special beam cannon");
                }
            }
        }
        let t = self.t;
        let mut due = false;
        if let Kind::Krillin { auto, discs, .. } = &mut self.hero_rt.kind {
            discs.retain(|d| t - d.t0 < DISC_FLIGHT);
            *auto -= dt;
            if *auto <= 0.0 {
                *auto = DISC_AUTO;
                due = true;
            }
        }
        if let Some((x, y)) = due.then(|| self.nearest_target_of(false)).flatten() {
            self.throw_disc(x, y);
        }
    }

    /// A disc cuts a meteor out of the sky: as a beam takes one.
    fn cut_meteor(&mut self, i: usize) {
        let (mx, my) = (self.tl.meteors[i].x, self.tl.meteors[i].y);
        self.tl.meteors[i].dead = true;
        self.goal("meteor", 1.0, false);
        let n = self.meteor_pay();
        self.gain_at(n, mx, my - 6.0, true);
        self.burst_at(mx, my, &[0xffffff, 0xffb35a, 0xe0473e, 0x6c6f7c], 16, 110.0);
    }

    /// A disc picks up an orb off the road ahead of him: as running over it does (a star one is a dragon ball).
    fn cut_orb(&mut self, i: usize, x: f64, y: f64) {
        self.tl.orbs[i].done = true;
        let star = self.tl.orbs[i].star;
        let n = self.lap_value() * self.mult(false) * if star { 3.0 } else { 1.0 };
        self.gain_at(n, x, y - 12.0, true);
        if star {
            self.goal("ball", 1.0, false);
            self.s.orbs7 += 1;
            if self.s.orbs7 >= 7 {
                self.s.orbs7 = 0;
                self.summon();
            } else {
                let msg = format!("dragon ball {}/7", self.s.orbs7);
                self.event(msg);
            }
        }
        self.spray(x, y - 10.0, &[0xffffff, 0xffd84a, 0xff9a3c], 12, 90.0, 3.0, 0.6);
    }

    /// A training tap at (x, y): Piccolo spends a slice of focus and it pays out.
    pub(crate) fn hero_tap(&mut self, x: f64, y: f64) {
        let spend = self.focus().min(FOCUS_TAP);
        if spend <= 0.0 {
            return;
        }
        let pay = self.recent() * (spend * TAP_SECS);
        self.set_focus(self.focus() - spend);
        self.own_pay(pay, x, y);
    }

    /// A tap of yours at (x, y) that hit nothing else and would train: krillin throws a disc that way instead (on
    /// himself, straight ahead along the road) if one's ready, and either way the tap is spent. Everything a tap
    /// does before that (a villain, a pod, the moon, the fusion dance's beats…) is his as anyone's, and a training
    /// tap the game makes (instinct's, from off the screen) still trains.
    pub(crate) fn hero_disc_tap(&mut self, x: f64, y: f64) -> bool {
        let t = self.t;
        let Kind::Krillin { last, .. } = self.hero_rt.kind else { return false };
        if !(0.0..=self.cam.w).contains(&x) || !(0.0..=self.cam.h).contains(&y) {
            return false;
        }
        if t - last >= DISC_GAP && !self.stunned() && !self.swapped() {
            let k = self.kid_screen(14.0);
            let (x, y) = if hypot(&[x - k.x, y - k.y]) < 14.0 {
                let a = self.cam.screen(self.frame3.road_pt(self.phi + 0.6), 14.0);
                (a.x, a.y)
            } else {
                (x, y)
            };
            self.throw_disc(x, y);
        }
        true
    }

    /// A beam of charge `c` from (x, y): Piccolo's special beam cannon spends focus with its charge.
    pub(crate) fn hero_beam(&mut self, c: f64, x: f64, y: f64) {
        let spend = self.focus() * (c / 2.5).min(1.0);
        if spend <= 0.0 {
            return;
        }
        let pay = self.recent() * (spend * CANNON_SECS);
        self.set_focus(self.focus() - spend);
        self.strain_extra += spend * STRAIN_FOCUS;
        if c >= 2.4 {
            self.event(format!("special beam cannon! {}% of his focus spent", (spend * 100.0).round()));
        }
        self.own_pay(pay, x, y);
    }

    /// Where every target a disc can cut is on screen now, with its half-size.
    fn disc_targets(&self) -> Vec<(Target, f64, f64, f64)> {
        let mut v = Vec::new();
        for (i, sb) in self.tl.saibas.iter().enumerate() {
            if let Some((x, y)) = sb.sx.filter(|_| !sb.dead) {
                v.push((Target::Saiba(i), x, y - 6.0, 7.0));
            }
        }
        for (i, m) in self.tl.meteors.iter().enumerate() {
            if !m.dead && m.delay <= 0.0 {
                v.push((Target::Meteor(i), m.x, m.y, 6.0));
            }
        }
        if self.s.world != 3 {
            for (i, o) in self.tl.orbs.iter().enumerate() {
                let p = self.cam.screen(self.frame3.road_pt(o.phi), 4.0);
                if !o.done && p.v[2] > 0.05 {
                    v.push((Target::Orb(i), p.x, p.y, 4.0));
                }
            }
        }
        v
    }

    /// The disc target nearest his hand, if there is one.
    pub fn nearest_target(&self) -> Option<(f64, f64)> {
        self.nearest_target_of(true)
    }

    /// The nearest target; with `orbs` off, not the road's orbs (he runs over those anyway: his own discs leave them).
    fn nearest_target_of(&self, orbs: bool) -> Option<(f64, f64)> {
        let (hx, hy) = self.hand_pos();
        self.disc_targets()
            .into_iter()
            .filter(|t| orbs || !matches!(t.0, Target::Orb(_)))
            .min_by(|a, b| hypot(&[a.1 - hx, a.2 - hy]).total_cmp(&hypot(&[b.1 - hx, b.2 - hy])))
            .map(|(_, x, y, _)| (x, y))
    }

    /// Krillin's destructo disc toward (tx, ty): it cuts everything along its line; or, with the barrage charged and a
    /// villain up, a giant one at him.
    fn throw_disc(&mut self, tx: f64, ty: f64) {
        let t = self.t;
        let (hx, hy) = self.hand_pos();
        let boss = self.tl.boss.as_ref().filter(|b| !b.dead).map(|b| (b.x, b.y - b.spr().h / 2.0 * b.k));
        if let (Some((bx, by)), true) = (boss, self.cuts() >= BARRAGE_CUTS) {
            let max = self.tl.boss.as_ref().unwrap().max;
            self.hit_boss(max * BARRAGE_HP, bx, by, true);
            self.event("disc barrage! a giant destructo disc takes a fifth of his hp");
            if let Kind::Krillin { cuts, last, discs, .. } = &mut self.hero_rt.kind {
                *cuts -= BARRAGE_CUTS;
                *last = t;
                discs.push(Disc { t0: t, x0: hx, y0: hy, x1: bx, y1: by, big: true });
            }
            return;
        }
        let (dx, dy) = (tx - hx, ty - hy);
        let l = hypot(&[dx, dy]);
        let (ux, uy) = if l < 4.0 {
            let a = self.kid_screen(0.0).ang;
            (cos(a), sin(a))
        } else {
            (dx / l, dy / l)
        };
        let mut hits: Vec<(f64, Target, f64, f64)> = self
            .disc_targets()
            .into_iter()
            .filter_map(|(k, x, y, w)| {
                let (rx, ry) = (x - hx, y - hy);
                let along = rx * ux + ry * uy;
                (along > 0.0 && along < DISC_RANGE && (rx * uy - ry * ux).abs() < w + DISC_BAND).then_some((along, k, x, y))
            })
            .collect();
        hits.sort_by(|a, b| a.0.total_cmp(&b.0));
        let reach = hits.last().map_or(DISC_RANGE, |h| h.0 + 12.0);
        let unit = self.recent();
        for (n, &(_, k, x, y)) in hits.iter().enumerate() {
            match k {
                Target::Saiba(i) => self.kill_saiba(i),
                Target::Meteor(i) => self.cut_meteor(i),
                Target::Orb(i) => self.cut_orb(i, x, y),
            }
            if n > 0 {
                self.own_pay(unit * (CHAIN_SECS * 2f64.powi(n as i32 - 1)), x, y - 8.0);
            }
        }
        let n = hits.len() as u32;
        if n >= 2 {
            self.event(format!("destructo disc! {n} cut in one throw · chain ×{}", 1u32 << (n - 1)));
            // a chain is his combo: n cuts in one throw count as a ×n combo
            self.combo = self.combo.max((n as f64).min(self.combo_cap()));
            self.last_click = t;
            self.goal("combo", 1.0, false);
        }
        if let Kind::Krillin { cuts, last, discs, .. } = &mut self.hero_rt.kind {
            *cuts += n;
            *last = t;
            discs.push(Disc { t0: t, x0: hx, y0: hy, x1: hx + ux * reach, y1: hy + uy * reach, big: false });
        }
        if n > 0 && self.cuts() >= BARRAGE_CUTS && boss.is_some() {
            self.once("barrage", "the disc barrage is charged — throw at the villain");
        }
    }
}
