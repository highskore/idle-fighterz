//! The ramen break: now and then the hero stops mid-lap for a bowl of ramen. Left alone, he finishes it and runs on
//! with a full belly (a timed buff); a tap on him knocks the bowl over, and he sulks (tired for a few seconds). Idle
//! play is the winning move here. Anything big (a fight, a form-up, a limit break, a trip) has him gulp it down at
//! once, buff and all. The schedule is fixed (no random draws). planet-render draws the bowl from `Tl::ramen`.

use crate::data::CHARS;
use crate::game::Game;
use crate::hud::Cue;
use crate::jsmath::hypot;

/// The first break and the gaps between them, in seconds of quiet (fights, scenes and trips hold the clock); how long
/// he eats, and the full belly.
pub const RAMEN_FIRST: f64 = 150.0;
pub const RAMEN_GAPS: [f64; 4] = [180.0, 220.0, 160.0, 200.0];
pub const RAMEN_EAT: f64 = 8.0;
pub const FULL_X: f64 = 1.5;
pub const FULL_S: f64 = 30.0;
/// A knocked-over bowl: tired this long, and how long the spill is drawn.
pub const SPILL_TIRED: f64 = 5.0;
pub const SPILL_T: f64 = 1.0;

#[derive(Clone, Debug)]
pub struct Ramen {
    pub t0: f64,
    /// when the bowl went over
    pub spilt: Option<f64>,
}

impl Game {
    fn hero_name(&self) -> &'static str {
        CHARS.iter().find(|c| c.0 == self.s.hero).map_or("he", |c| c.2)
    }

    /// Nothing else on the planet wants him: no fight, scene, dragon, trip or visitor that holds the stage.
    pub(crate) fn quiet(&self) -> bool {
        let tl = &self.tl;
        self.calm()
            && self.xf.is_none()
            && self.mo.is_none()
            && tl.storm.is_none()
            && tl.cling.is_none()
            && tl.ship.is_none()
            && self.b.ape_until <= self.t
            && self.b.chamber_until <= self.t
            && self.riding <= 0.0
            && self.s.world != 3
    }

    /// He's sat with his bowl: he doesn't run.
    pub fn eating(&self) -> bool {
        self.tl.ramen.as_ref().is_some_and(|r| r.spilt.is_none())
    }

    pub(crate) fn ramen_step(&mut self, t: f64, dt: f64) {
        if self.no_events {
            return;
        }
        if self.tl.ramen.is_none() {
            if self.quiet() && {
                self.tl.next_ramen -= dt;
                self.tl.next_ramen < 0.0
            } {
                self.tl.next_ramen = RAMEN_GAPS[self.tl.ramens as usize % RAMEN_GAPS.len()];
                self.tl.ramens += 1;
                self.tl.ramen = Some(Ramen { t0: t, spilt: None });
                let msg = format!("ramen break — {} sits down to eat. leave him be", self.hero_name());
                self.event_ms(msg, 3200.0);
            }
            return;
        }
        let r = self.tl.ramen.clone().unwrap();
        if r.spilt.is_none() {
            // the planet turns him our way, gently
            self.face_us(1f64.min(dt * 1.5));
        }
        if let Some(s) = r.spilt {
            if t - s > SPILL_T {
                self.tl.ramen = None;
            }
            return;
        }
        // something big came: he gulps it down
        let rushed = !self.quiet();
        if rushed || t - r.t0 >= RAMEN_EAT {
            self.tl.ramen = None;
            self.b.ramen_until = t + FULL_S;
            let msg = if rushed {
                format!("{} gulps his ramen down — full belly ×{FULL_X} for {FULL_S}s", self.hero_name())
            } else {
                format!("{} slurps the last noodle — full belly ×{FULL_X} for {FULL_S}s", self.hero_name())
            };
            self.event(msg);
            self.cue(Cue::Sfx("coin"));
        }
    }

    /// A tap on him while he eats: the bowl goes over. True if it took the tap.
    pub(crate) fn ramen_tap(&mut self, px: f64, py: f64) -> bool {
        if !self.eating() {
            return false;
        }
        let k = self.kid_screen(10.0);
        if hypot(&[px - k.x, py - k.y]) >= 13.0 {
            return false;
        }
        let t = self.t;
        self.tl.ramen.as_mut().unwrap().spilt = Some(t);
        self.b.tired_until = self.b.tired_until.max(t + SPILL_TIRED);
        self.combo = 1.0;
        self.cue(Cue::Sfx("hit"));
        let (x, y) = self.hand_pos();
        self.burst_at(x, y, &[0xffffff, 0xf2d27a, 0xe8b04a, 0xd84a2a], 12, 80.0);
        let msg = format!("you knocked his bowl over — {} sulks: tired ×0.75 for {SPILL_TIRED}s", self.hero_name());
        self.event(msg);
        true
    }
}
