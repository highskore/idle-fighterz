//! A saga boss's arrival: Vegeta's scouter swings in, its reading climbs and the lens swells to fill the view, then
//! it overloads and shatters to reveal him, locked in red. It plays out on its own (about 4s) and any tap skips
//! straight to the shatter. The fight's clock waits for it. planet-render draws it from `Boss::intro`; the name and
//! the reading come in the usual toast.

use crate::big::Big;
use crate::game::Game;
use crate::hud::Cue;
use crate::num::{hud_fmt, js_round};

/// When the reading locks, when the glass shatters (he's in place by then), and when the fight starts.
pub const BI_LOCK: f64 = 2.45;
pub const BI_BLOW: f64 = 2.75;
pub const BI_DUR: f64 = 4.1;
/// His slide in (`Boss::t0` to in place) takes this long.
const ENTER: f64 = 1.2;

#[derive(Clone, Debug)]
pub struct Intro {
    /// when it started (a skip moves it back, so the shatter is now)
    pub t0: f64,
    /// what the scouter reads: his health
    pub read: Big,
    pub blown: bool,
}

impl Intro {
    pub fn e(&self, t: f64) -> f64 {
        t - self.t0
    }
}

impl Game {
    /// A saga boss just spawned at `t`: he arrives behind the scouter, and the fight starts once it's done.
    pub(crate) fn intro_start(&mut self, t: f64) {
        let Some(b) = self.tl.boss.as_mut() else { return };
        b.t0 = t + BI_BLOW - ENTER;
        b.go = t + BI_DUR;
        b.until = b.go + 40.0;
        b.intro = Some(Intro { t0: t, read: js_round(b.max), blown: false });
        self.cue(Cue::Sfx("boss"));
    }

    /// The shatter and its toast, once.
    pub(crate) fn intro_step(&mut self, t: f64) {
        let calm = self.calm;
        let Some(b) = self.tl.boss.as_mut() else { return };
        let Some(i) = b.intro.as_mut() else { return };
        if !i.blown && i.e(t) >= BI_BLOW {
            i.blown = true;
            let msg = format!("the scouter can't take it! {}, power {}", b.name, hud_fmt(i.read));
            if !calm {
                self.flash_t = self.flash_t.max(0.45);
                self.shake = self.shake.max(0.8);
            }
            self.cue(Cue::Sfx("boom"));
            self.event_ms(msg, 2600.0);
        }
        let b = self.tl.boss.as_mut().unwrap();
        if b.intro.as_ref().is_some_and(|i| i.e(t) >= BI_DUR) || b.dead {
            b.intro = None;
        }
    }

    /// Whether the arrival still holds the fight back.
    pub fn intro_on(&self) -> bool {
        self.tl.boss.as_ref().is_some_and(|b| b.intro.is_some() && self.t < b.go)
    }

    /// A tap (or a beam, or a big bang) during the arrival: the glass shatters now and the fight starts. True if it
    /// took the tap.
    pub(crate) fn intro_skip(&mut self) -> bool {
        if !self.intro_on() {
            return false;
        }
        let t = self.t;
        let b = self.tl.boss.as_mut().unwrap();
        let i = b.intro.as_mut().unwrap();
        if i.e(t) < BI_BLOW {
            i.t0 = t - BI_BLOW;
        }
        b.t0 = b.t0.min(t - ENTER);
        b.go = t;
        b.until = t + 40.0;
        self.intro_step(t);
        true
    }
}
