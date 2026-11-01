//! The transformation event: a form-up is a scene. He powers up on top of the planet for a few seconds, then the form
//! lands. Taps hurry it along, and enough of them earn a power surge. Idle, it lands on its own. planet-render draws
//! it from `Game::xf`; the HUD gets the form's name (and the surge) in the usual toast.

use crate::game::Game;
use crate::geom::{ap, cross, dot, m_mul, mul, ortho, rot};
use crate::hud::Cue;
use crate::jsmath::{atan2, hypot};

/// How long the power-up takes untouched, and how long the reveal after it lasts (reduced motion: shorter).
pub const XF_DUR: f64 = 7.0;
pub const XF_REV: f64 = 3.0;
pub const XF_DUR_CALM: f64 = 3.5;
pub const XF_REV_CALM: f64 = 1.5;
/// How far one tap brings the power-up on.
pub const XF_TAP: f64 = 0.02;
/// The surge: earned with this many taps in one power-up, its multiplier and how long it lasts.
pub const SURGE_TAPS: u32 = 6;
pub const SURGE_X: f64 = 2.0;
pub const SURGE_S: f64 = 20.0;

#[derive(Clone, Debug)]
pub struct XForm {
    /// when it started
    pub t0: f64,
    /// how far he's powered up, 0 to 1
    pub p: f64,
    pub taps: u32,
    /// the last tap
    pub tap_t: f64,
    /// when the form landed; `None` while he powers up
    pub rv: Option<f64>,
    /// the ladder form he powers up from, and the one it lands on
    pub from: usize,
    pub to: usize,
}

impl XForm {
    /// Seconds since the form landed, or -1 while he powers up.
    pub fn since(&self, t: f64) -> f64 {
        self.rv.map_or(-1.0, |rv| t - rv)
    }
}

impl Game {
    pub fn xf_dur(&self) -> f64 {
        if self.calm {
            XF_DUR_CALM
        } else {
            XF_DUR
        }
    }

    pub fn xf_rev(&self) -> f64 {
        if self.calm {
            XF_REV_CALM
        } else {
            XF_REV
        }
    }

    /// Turns the planet `k` of the way to having him on top of it, facing us (unless it's being dragged, or it's the
    /// lookout).
    pub(crate) fn face_us(&mut self, k: f64) {
        self.turn_to(self.frame3.road_pt(self.phi), [0.0, 0.42, 0.91], k);
    }

    /// Turns the planet `k` of the way to having `p` (on it) at `u` on screen, unless it's being dragged or it's the
    /// lookout.
    pub(crate) fn turn_to(&mut self, p: crate::geom::V3, u: crate::geom::V3, k: f64) {
        if self.inp.drag.is_none() && !self.inp.w2_pole {
            let v = ap(&self.cam.m, p);
            let ax = cross(v, u);
            let s = hypot(&ax);
            if s > 1e-4 {
                self.cam.m = ortho(&m_mul(&rot(mul(ax, 1.0 / s), atan2(s, dot(v, u)) * k), &self.cam.m));
            }
        }
    }

    pub(crate) fn form_owed(&self) -> bool {
        self.s.form < self.forms.len() - 1 && self.s.pl >= self.forms[self.s.form + 1].at
    }

    /// A form he holds the power for: the scene starts (on snake way, and for a preview hook's form, it lands at once,
    /// as every form-up did before), and runs.
    pub(crate) fn xform_step(&mut self, t: f64, dt: f64) {
        if self.a17_marks() {
            return;
        }
        let preview = self.tl.preview.is_some();
        if self.xf_instant {
            if self.form_owed() {
                self.transform(preview);
                return;
            }
            self.xf_instant = false;
        }
        if self.xf.is_none() && self.form_owed() && !self.breaking() && self.powered_down().is_none() {
            if self.s.world == 3 && self.tl.snk.is_some() {
                self.transform(preview);
                return;
            }
            let f = self.s.form;
            self.xf = Some(XForm { t0: t, p: 0.0, taps: 0, tap_t: -9.0, rv: None, from: f, to: f + 1 });
            self.cue(Cue::Sfx("form"));
            self.cue(Cue::Scene(true));
        }
        let Some(x) = self.xf.clone() else { return };
        // a wish, an ascend or a wish wearing off moved the form under him: the scene is off
        if x.rv.is_none() && self.s.form != x.from {
            self.xf = None;
            self.cue(Cue::Scene(false));
            return;
        }
        // the planet turns so he powers up on top of it, facing us
        self.face_us(1f64.min(dt * 3.0));
        let Some(rv) = x.rv else {
            let p = 1f64.min(x.p + dt / self.xf_dur());
            self.xf.as_mut().unwrap().p = p;
            self.b.pose_until = t + 0.3;
            if !self.calm {
                self.shake = self.shake.max(0.12 + p * 0.5);
            }
            if p >= 1.0 {
                self.xform_land(t, x.taps);
            }
            return;
        };
        if t - rv > self.xf_rev() {
            self.xf = None;
        }
    }

    /// An ascend, god ki or zeno took the power the scene was for: it's off before it lands a form.
    pub(crate) fn xform_cancel(&mut self) {
        if self.xf.take().is_some_and(|x| x.rv.is_none()) {
            self.cue(Cue::Scene(false));
        }
    }

    /// The form lands, with every other form the power already holds (they came one a frame before the scene).
    fn xform_land(&mut self, t: f64, taps: u32) {
        let preview = self.tl.preview.is_some();
        // goten powering up again replays a form he's had: hurrying it is its own reward, there's no surge
        let surge = taps >= SURGE_TAPS && self.held_form() <= self.s.form;
        if surge {
            self.b.surge_until = t + SURGE_S;
        }
        let mut n = 1;
        while self.s.form + n < self.forms.len() - 1 && self.s.pl >= self.forms[self.s.form + n + 1].at {
            n += 1;
        }
        let said = self.events.len();
        for i in 0..n {
            let more = if surge && i == n - 1 { format!(" — power surge ×{SURGE_X} for {SURGE_S}s") } else { String::new() };
            // up past the reveal, so the new form settles with its name still showing
            self.transform_with(preview, &more, 4000.0);
        }
        // goten powering up again climbs straight back to his best form: only its own toast
        if self.s.hero == crate::data::Hero::Goten && n > 1 {
            let last = self.events.pop();
            self.events.truncate(said);
            self.events.extend(last);
        }
        if self.calm {
            self.flash_t = 0.0;
        } else {
            self.shake = 1.0;
        }
        self.cue(Cue::Scene(false));
        let to = self.s.form;
        let x = self.xf.as_mut().unwrap();
        x.rv = Some(t);
        x.to = to;
    }

    /// A fight that wants taps now: a beam struggle, ginyu in your body, frieza's aim, cell's grab, the self-destruct or
    /// the cell jrs.
    fn fight_taps(&self) -> bool {
        use crate::mech::{Mech, Ph};
        let mech = self.tl.boss.as_ref().filter(|b| !b.dead).and_then(|b| b.mech.as_ref());
        self.tl.struggle.is_some()
            || self.swapped()
            || matches!(mech, Some(Mech::Frieza { ph: Ph::Aim, .. } | Mech::Cell { ph: Ph::Reach | Ph::Drain, .. }))
            || self.tl.cg.as_ref().is_some_and(|g| matches!(g.ph, crate::cellgames::CgPh::Boom | crate::cellgames::CgPh::Jrs))
    }

    /// A tap while he powers up goes into it. False when there's no power-up to take it, or a fight wants the tap.
    pub(crate) fn xform_tap(&mut self) -> bool {
        let t = self.t;
        if self.fight_taps() {
            return false;
        }
        let Some(x) = self.xf.as_mut().filter(|x| x.rv.is_none()) else { return false };
        x.p = 1f64.min(x.p + XF_TAP);
        x.taps += 1;
        x.tap_t = t;
        let to = x.to;
        if !self.calm {
            self.shake = self.shake.max(0.4);
        }
        self.cue(Cue::Sfx("tap"));
        let k = self.kid_screen(10.0);
        let aura = self.forms[to].aura();
        self.burst_at(k.x, k.y, &aura, 10, 140.0);
        true
    }
}
