//! Android 17 has infinite energy and no form ladder. His power marks still come as anyone's do (the shared marks,
//! the late ones and the limit breakers), but silently: no scene, no toast. What shows is his **overclock**, 100% to
//! `OC_MAX`; every point of it over 100% is worth `OC_GAIN` on everything, on top of the mark he holds. Every training tap is a ki blast that adds `OC_TAP`
//! (and pays `A17_TAP` of a tap); a beam adds with its charge. It always cools, `OC_COOL` of what's above 100% a
//! second, so steady play holds it where the blasts balance the cooling. His boost, infinite energy, pins it at the
//! top for `PIN_SECS` with no tiredness after. Left alone for `OC_REST` he fires a small beam (`AUTO_C`) by himself
//! every `AUTO_BEAM` at the nearest saibaman or meteor (never at a villain). At `LOOKS[1]` he's in core overload, at
//! `LOOKS[2]` redline: looks, not forms.

use crate::data::{Hero, Upg};
use crate::heroes::Kind;
use crate::Game;

pub const OC_MAX: f64 = 2.5;
/// What the overclock is worth: ×(1 + `OC_GAIN` × (overclock − 1)), so 250% is ×1.45 (a straight ×2.5 on
/// everything made playing him earn ×15 his idle).
pub const OC_GAIN: f64 = 0.1;
pub const OC_TAP: f64 = 0.01;
pub const OC_BEAM: f64 = 0.04;
pub const OC_REST: f64 = 2.0;
pub const OC_COOL: f64 = 0.05;
pub const A17_TAP: f64 = 0.3;
/// His steady income: under vegeta's, since his marks come at once, with no scene to wait through.
pub const A17_BASE: f64 = 0.85;
pub const AUTO_BEAM: f64 = 20.0;
pub const AUTO_C: f64 = 0.5;
/// Infinite energy's pin: 15s at lv 1, `PIN_STEP` more each level.
pub const PIN_SECS: f64 = 15.0;
pub const PIN_STEP: f64 = 2.0;
pub const PIN_READY: f64 = 45.0;
/// Where each overclock look starts: base, core overload, redline.
pub const LOOKS: [f64; 3] = [1.0, 1.75, 2.25];
pub const LOOK_NAMES: [&str; 3] = ["base", "core overload", "redline"];
/// Each look's aura, and the sprite look it wears (his sprites keep the late looks at 9 and 10).
pub const LOOK_AURA: [[u32; 3]; 3] = [[0xffffff, 0xd8e8ff, 0x7a9ad8], [0xffffff, 0xb8f8ff, 0x2ec8e8], [0xffffff, 0xffb0a0, 0xe02828]];
pub const LOOK_SPRITE: [usize; 3] = [0, 9, 10];

pub fn pin_secs_at(lv: f64) -> f64 {
    PIN_SECS + PIN_STEP * (lv - 1.0).max(0.0)
}

impl Game {
    /// His overclock (1 for everyone else): a factor on everything, on top of his power mark.
    pub fn overclock(&self) -> f64 {
        match self.hero_rt.kind {
            Kind::A17 { oc, .. } => oc,
            _ => 1.0,
        }
    }

    /// What his overclock multiplies everything by (1 for everyone else).
    pub fn oc_x(&self) -> f64 {
        1.0 + OC_GAIN * (self.overclock() - 1.0)
    }

    /// Which overclock look he's in (None for everyone else).
    pub fn oc_look(&self) -> Option<usize> {
        let Kind::A17 { oc, .. } = self.hero_rt.kind else { return None };
        Some(LOOKS.iter().rposition(|&l| oc >= l).unwrap_or(0))
    }

    /// Seconds left of infinite energy's pin, if it's on.
    pub fn pinned(&self) -> Option<f64> {
        match self.hero_rt.kind {
            Kind::A17 { pin, .. } if pin > self.t => Some(pin - self.t),
            _ => None,
        }
    }

    fn set_oc(&mut self, v: f64) {
        if let Kind::A17 { oc, .. } = &mut self.hero_rt.kind {
            *oc = v.clamp(1.0, OC_MAX);
        }
    }

    /// His power marks come without a scene: every mark this run's power reached, at once and quietly.
    pub(crate) fn a17_marks(&mut self) -> bool {
        if self.s.hero != Hero::A17 {
            return false;
        }
        let reached = self.s.run_best.max(self.s.pl);
        while self.s.form < self.forms.len() - 1 && reached >= self.forms[self.s.form + 1].at {
            self.s.form += 1;
        }
        true
    }

    /// Each frame: the overclock cools (not while pinned), and the auto-beam comes round while he's left alone.
    pub(crate) fn a17_step(&mut self, dt: f64) {
        let t = self.t;
        let rest = t - self.last_click >= OC_REST && self.inp.charging == 0.0;
        let free = !self.stunned() && !self.swapped();
        let beam = self.s.lv(Upg::Galick) > 0;
        let Kind::A17 { oc, auto, pin } = &mut self.hero_rt.kind else { return };
        if *pin > t {
            *oc = OC_MAX;
        } else {
            *oc = 1.0 + (*oc - 1.0) * crate::jsmath::exp(-OC_COOL * dt);
        }
        *auto -= dt;
        if *auto > 0.0 || !beam || !free || !rest {
            return;
        }
        *auto = AUTO_BEAM;
        // never at a villain: beating villains is for players
        let at = if self.boss_up() { None } else { self.nearest_target() };
        // his own beam doesn't wind him up: only yours do
        if let Some((x, y)) = at {
            let oc = self.overclock();
            self.fire_beam(AUTO_C, x, y);
            self.set_oc(oc);
        }
    }

    /// A training tap: a ki blast off his hand, and the overclock climbs.
    pub(crate) fn a17_tap(&mut self) {
        if !matches!(self.hero_rt.kind, Kind::A17 { .. }) {
            return;
        }
        self.set_oc(self.overclock() + OC_TAP);
        let (x, y) = self.hand_pos();
        let col = LOOK_AURA[self.oc_look().unwrap_or(0)];
        self.spray(x, y, &col, 4, 140.0, 4.0, 0.35);
    }

    /// A beam of charge `c`: the overclock climbs with it.
    pub(crate) fn a17_beam(&mut self, c: f64) {
        if matches!(self.hero_rt.kind, Kind::A17 { .. }) {
            self.set_oc(self.overclock() + OC_BEAM * c);
        }
    }

    /// His boost button: infinite energy pins the overclock at the top, with no tiredness after.
    pub(crate) fn infinite_energy(&mut self) -> bool {
        let (t, secs) = (self.t, pin_secs_at(self.s.lvf(Upg::Kaio)));
        let Kind::A17 { oc, pin, .. } = &mut self.hero_rt.kind else { return false };
        *oc = OC_MAX;
        *pin = t + secs;
        self.b.kaio_ready = t + PIN_READY;
        self.shake = 0.5;
        self.flash_t = 0.4;
        self.event(format!("infinite energy! overclock pinned at {}% for {}s", (OC_MAX * 100.0).round(), crate::json::num(secs)));
        let (x, y) = self.hand_pos();
        self.burst_at(x, y, &LOOK_AURA[2], 40, 200.0);
        true
    }

    /// The HUD's form line for him: his look and overclock, what it's worth, and the next look (or mastery star).
    pub(crate) fn a17_form_line(&self) -> Option<(String, f64, String, f64)> {
        let l = self.oc_look()?;
        let oc = self.overclock();
        let x = self.forms[self.s.form].x * self.oc_x();
        let name = format!("{} {}%", if l == 0 { "overclock" } else { LOOK_NAMES[l] }, (oc * 100.0).round());
        Some(if l + 1 < LOOKS.len() {
            let (from, to) = (LOOKS[l], LOOKS[l + 1]);
            (name, x, format!("{} at {}%", LOOK_NAMES[l + 1], (to * 100.0).round()), ((oc - from) / (to - from)).clamp(0.0, 1.0))
        } else {
            let at = self.mastery_at(self.s.mastery);
            (name, x, format!("mastery {}", self.s.mastery + 1), 1f64.min((self.s.pl / at).to_f64()))
        })
    }
}
