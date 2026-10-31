//! Bubbles chases things: instead of trotting behind the hero he wanders the road, chasing butterflies, the hero and
//! dragon balls or ki orbs lying ahead. A tap on him makes him do a little dance (the tap still trains). It's all for
//! show: his income, Cell's grab and the fusion offer don't change, only where he stands. Fixed tables, no random
//! draws. planet-render draws him (and the butterfly) from `Tl::bub`.

use crate::data::Upg;
use crate::game::Game;
use crate::jsmath::{atan2, cos, hypot, sin};

/// Where he trails the hero when he's just following.
pub const BUB_HEEL: f64 = -0.32;
/// How fast he closes on what he's after (road radians a second, on top of the hero's pace).
pub const BUB_RUN: f64 = 0.9;
/// What he does next, in turn, and for how long.
pub const BUB_PLAN: [(Chase, f64); 6] =
    [(Chase::Heel, 9.0), (Chase::Fly, 8.0), (Chase::Wander(-0.7), 6.0), (Chase::Orb, 7.0), (Chase::Heel, 7.0), (Chase::Wander(0.35), 6.0)];
/// A tap's dance.
pub const BUB_DANCE: f64 = 1.6;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Chase {
    Heel,
    /// a butterfly, which flutters on ahead of him
    Fly,
    /// to this far off the hero, and sniffs about
    Wander(f64),
    /// the nearest orb or dragon ball ahead (or heel, if there's none)
    Orb,
}

#[derive(Clone, Debug)]
pub struct Butterfly {
    /// where it is on the road, and since when
    pub phi: f64,
    pub t0: f64,
    /// once it's had enough: it flies off up
    pub gone: Option<f64>,
}

#[derive(Clone, Debug)]
pub struct Bub {
    /// how far along the road from the hero he is
    pub off: f64,
    /// his road speed last frame (radians a second, the hero's pace included): he faces where he's going
    pub v: f64,
    pub plan: usize,
    pub until: f64,
    pub fly: Option<Butterfly>,
    pub dance_t: f64,
}

impl Default for Bub {
    fn default() -> Self {
        // the plan's last step, so he starts on its first
        Bub { off: BUB_HEEL, v: 0.0, plan: BUB_PLAN.len() - 1, until: 0.0, fly: None, dance_t: -9.0 }
    }
}

impl Bub {
    pub fn dancing(&self, t: f64) -> bool {
        t - self.dance_t < BUB_DANCE
    }
}

impl Game {
    /// Where bubbles is on the road.
    pub fn bub_phi(&self) -> f64 {
        self.phi + self.tl.bub.off
    }

    pub(crate) fn bubbles_step(&mut self, t: f64, dt: f64, pace: f64) {
        if self.s.lv(Upg::Partner) == 0 || self.s.world == 3 || dt <= 0.0 {
            return;
        }
        let phi = self.phi;
        let orb = self
            .tl
            .orbs
            .iter()
            .map(|o| atan2(sin(o.phi - phi), cos(o.phi - phi)))
            .filter(|d| *d > 0.08 && *d < 1.2)
            .fold(None, |m: Option<f64>, d| Some(m.map_or(d, |m| m.min(d))));
        let b = &mut self.tl.bub;
        if t >= b.until {
            b.plan = (b.plan + 1) % BUB_PLAN.len();
            let (what, secs) = BUB_PLAN[b.plan];
            b.until = t + secs;
            if what == Chase::Fly {
                b.fly = Some(Butterfly { phi: phi + 0.35, t0: t, gone: None });
            }
        }
        let what = BUB_PLAN[b.plan].0;
        if let Some(f) = b.fly.as_mut() {
            // it flutters on, just slower than he runs, and leaves when he's done with it
            f.phi += (0.3 + 0.15 * sin((t - f.t0) * 2.3)) * dt;
            if f.gone.is_none() && (what != Chase::Fly || t >= b.until - 1.2) {
                f.gone = Some(t);
            }
            if f.gone.is_some_and(|g| t - g > 2.5) {
                b.fly = None;
            }
        }
        let goal = match what {
            Chase::Heel => BUB_HEEL,
            Chase::Wander(o) => o + 0.06 * sin(t * 1.7),
            Chase::Fly => b.fly.as_ref().filter(|f| f.gone.is_none()).map_or(BUB_HEEL, |f| f.phi - 0.05 - phi),
            Chase::Orb => orb.map_or(BUB_HEEL, |d| d - 0.04 + 0.02 * sin(t * 6.0)),
        };
        let was = b.off;
        let step = BUB_RUN * dt;
        b.off += (goal - b.off).clamp(-step, step);
        b.v = pace + (b.off - was) / dt;
    }

    /// A tap on bubbles (where planet-render last drew him): a little dance. It doesn't take the tap.
    pub(crate) fn bubbles_tap(&mut self, px: f64, py: f64) {
        let Some((mx, my, mk)) = self.tl.monkey_at else { return };
        if hypot(&[px - mx, py - (my - 5.0 * mk)]) < 12.0 * mk && !self.tl.bub.dancing(self.t) {
            self.tl.bub.dance_t = self.t;
        }
    }
}
