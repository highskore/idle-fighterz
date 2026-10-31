//! The run state of the heroes game.js doesn't have, and what each one changes about the economy. None of it is
//! saved: it starts over each run (a new visit, an ascend, god ki, zeno) and when you switch heroes.
//!
//! Piccolo meditates. He starts a run at full focus, and left alone he sits cross-legged and builds it back, +1% a
//! second. His steady income (the steps, laps and passive) is ×0.5 at no focus and ×1 at full, so an idle Piccolo
//! earns what an idle Vegeta does. A training tap spends a slice of focus and pays it out; a beam, his special beam
//! cannon, spends focus in proportion to its charge and pays much more for it, both in seconds of what he's been
//! earning lately. Taps and beams themselves pay as anyone's.

use crate::big::Big;
use crate::data::{Hero, LAP, N_LEGS, N_STRIDE};
use crate::Game;

/// Focus gained a second while he's left alone.
pub const FOCUS_RISE: f64 = 0.01;
/// Seconds after the last tap before he settles to meditate.
pub const FOCUS_REST: f64 = 2.0;
/// Focus one training tap spends.
pub const FOCUS_TAP: f64 = 0.04;
/// Seconds of his recent income a full bar pays when taps spend it, and when the cannon does.
pub const TAP_SECS: f64 = 20.0;
pub const CANNON_SECS: f64 = 160.0;
/// How far back "recently" reaches: his income a second, smoothed over about this many seconds.
pub const RATE_SECS: f64 = 60.0;
/// Strain (limits.rs) for a full bar of focus the cannon spends: the hundred seconds of meditation it took count as
/// training, as a tapping player's taps do.
pub const STRAIN_FOCUS: f64 = 100.0;
/// His power with no focus; full focus doubles it.
pub const PICCOLO_BASE: f64 = 0.5;

#[derive(Clone, Debug, Default, PartialEq)]
pub enum HeroRt {
    #[default]
    None,
    Piccolo {
        focus: f64,
        /// what he earned since `tick` began, and his income a second, smoothed (focus payouts left out)
        earned: Big,
        tick: f64,
        rate: Big,
    },
}

impl HeroRt {
    fn of(h: Hero) -> Self {
        match h {
            Hero::Piccolo => HeroRt::Piccolo { focus: 1.0, earned: Big::ZERO, tick: 0.0, rate: Big::ZERO },
            _ => HeroRt::None,
        }
    }

    fn fits(&self, h: Hero) -> bool {
        std::mem::discriminant(self) == std::mem::discriminant(&HeroRt::of(h))
    }
}

impl Game {
    /// A fresh run's state for the hero.
    pub(crate) fn hero_reset(&mut self) {
        self.hero_rt = HeroRt::of(self.s.hero);
    }

    /// The state for the hero now playing, kept if it's already his.
    pub(crate) fn hero_sync(&mut self) {
        if !self.hero_rt.fits(self.s.hero) {
            self.hero_reset();
        }
    }

    /// Piccolo's focus, 0..1 (0 for everyone else).
    pub fn focus(&self) -> f64 {
        match self.hero_rt {
            HeroRt::Piccolo { focus, .. } => focus,
            HeroRt::None => 0.0,
        }
    }

    fn set_focus(&mut self, f: f64) {
        if let HeroRt::Piccolo { focus, .. } = &mut self.hero_rt {
            *focus = f.clamp(0.0, 1.0);
        }
    }

    /// The hero's own factor on everything he earns.
    pub fn hero_x(&self) -> f64 {
        match self.hero_rt {
            HeroRt::Piccolo { focus, .. } => PICCOLO_BASE * (1.0 + focus),
            HeroRt::None => 1.0,
        }
    }

    /// Piccolo sits cross-legged and meditates: left alone, and not busy being something else.
    pub fn meditating(&self) -> bool {
        let t = self.t;
        matches!(self.hero_rt, HeroRt::Piccolo { .. })
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

    /// What spent focus pays out in: his income a second lately, and never less than his steady income at full focus
    /// (the steps, the lap bonus at his running pace and the passive, without timed buffs).
    fn focus_unit(&self) -> Big {
        let lap = self.lap_value();
        let pace = 0.42 * (1.0 + 0.1 * self.lvl(N_STRIDE));
        let laps = lap * (4.0 * (1.0 + 0.5 * self.lvl(N_LEGS)) * pace / LAP);
        let steady = (lap / 7.0 + laps + self.passive()) * self.mult(true);
        match &self.hero_rt {
            HeroRt::Piccolo { rate, .. } => steady.max(*rate),
            HeroRt::None => steady,
        }
    }

    /// Everything gained goes through `gain`: Piccolo counts it toward his recent income.
    pub(crate) fn hero_earned(&mut self, n: Big) {
        if let HeroRt::Piccolo { earned, .. } = &mut self.hero_rt {
            *earned += n;
        }
    }

    /// Spent focus paid out at (x, y), left out of his recent income so a payout doesn't feed the next.
    fn focus_pay(&mut self, pay: Big, x: f64, y: f64) {
        self.gain_at(pay, x, y, true);
        if let HeroRt::Piccolo { earned, .. } = &mut self.hero_rt {
            *earned = (*earned - pay).max(Big::ZERO);
        }
    }

    /// Each frame: meditation builds focus, and his recent income is brought up to date once a second.
    pub(crate) fn hero_step(&mut self, dt: f64) {
        if let HeroRt::Piccolo { earned, tick, rate, .. } = &mut self.hero_rt {
            *tick += dt;
            if *tick >= 1.0 {
                let now = *earned / *tick;
                *rate = *rate + (now - *rate) * (*tick / RATE_SECS).min(1.0);
                (*earned, *tick) = (Big::ZERO, 0.0);
            }
        }
        if self.meditating() {
            let f = self.focus();
            if f < 1.0 {
                self.set_focus(f + FOCUS_RISE * dt);
                if self.focus() >= 1.0 {
                    self.once("focus", "full focus — piccolo's power ×2 · hold to fire the special beam cannon");
                }
            }
        }
    }

    /// A training tap at (x, y): Piccolo spends a slice of focus and it pays out.
    pub(crate) fn hero_tap(&mut self, x: f64, y: f64) {
        let spend = self.focus().min(FOCUS_TAP);
        if spend <= 0.0 {
            return;
        }
        let pay = self.focus_unit() * (spend * TAP_SECS);
        self.set_focus(self.focus() - spend);
        self.focus_pay(pay, x, y);
    }

    /// A beam of charge `c` from (x, y): Piccolo's special beam cannon spends focus with its charge.
    pub(crate) fn hero_beam(&mut self, c: f64, x: f64, y: f64) {
        let spend = self.focus() * (c / 2.5).min(1.0);
        if spend <= 0.0 {
            return;
        }
        let pay = self.focus_unit() * (spend * CANNON_SECS);
        self.set_focus(self.focus() - spend);
        self.strain_extra += spend * STRAIN_FOCUS;
        if c >= 2.4 {
            self.event(format!("special beam cannon! focus ×{:.1} spent", 1.0 + spend));
        }
        self.focus_pay(pay, x, y);
    }
}
