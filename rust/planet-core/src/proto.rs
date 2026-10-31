//! Prototype only (scratch/heroes): the `#hero-<id>#style=<A|B|C>` hook stages one playstyle pitch for the heroes
//! picker. It pins the hero to the front of the planet, sets a mid-early run up, and plays the pitch's toast; the
//! pitch's own drawing is planet-render's `proto`. Nothing here is the real mechanic.

use crate::data::{Hero, Upg};
use crate::geom::{add, cross, mul, norm};
use crate::jsmath::{cos, sin};
use crate::Game;

/// When the pitch's moment peaks, in seconds of play; the screenshots are taken here.
pub const MOMENT: f64 = 6.0;

#[derive(Clone, Debug)]
pub struct Proto {
    pub opt: char,
    /// the time of the first frame played
    pub t0: f64,
    pub said: bool,
    /// piccolo A's meditation look (`#med-N`, 0 = the first rings) and its focus, 0..1 (`#focus-lo`: low, else full)
    pub look: u32,
    pub focus: f64,
    /// where on the road he stands
    pub phi0: Option<f64>,
}

impl Proto {
    /// Seconds played.
    pub fn el(&self, t: f64) -> f64 {
        if self.t0 < 0.0 {
            0.0
        } else {
            t - self.t0
        }
    }
}

fn toast(h: Hero, o: char) -> &'static str {
    match (h, o) {
        (Hero::Piccolo, 'A') => "focus ×1.8 · 80s untouched — tap to spend it",
        (Hero::Piccolo, 'B') => "weights off! 4 min of training released: +1.2M",
        (Hero::Piccolo, 'C') => "gohan reaches lv 6 · ×1.8 — tap to spar with him",
        (Hero::Krillin, 'A') => "destructo disc! 3 cut in one throw · chain ×4",
        (Hero::Krillin, 'B') => "solar flare! the villain is blind for 4s — every tap crits",
        (Hero::Krillin, 'C') => "tag! 18 takes the laps — tag bonus ×2.4",
        (Hero::Goten, 'A') => "fu · sion · ha! a perfect dance — gotenks ×3 for 30s",
        (Hero::Goten, 'B') => "goten copies the kamehameha! moves learned 4/12 · ×1.4",
        (Hero::Goten, 'C') => "super saiyan again! power-up 7 this run · surge ×2",
        (Hero::Tien, 'A') => "multi-form! 4 tiens · ¼ power each · 4× laps and taps",
        (Hero::Tien, 'B') => "tri-beam! −20% power now · +60% back if it lands",
        (Hero::Tien, 'C') => "a student graduates! +840K · 5 in class",
        (Hero::A17, 'A') => "infinite energy · beams cost no ki · overclock 140%",
        (Hero::A17, 'B') => "poacher caught! the preserve grows: 9 animals · ×1.45",
        (Hero::A17, 'C') => "perfect barrier! 3 blocked · stored energy +900K",
        _ => "",
    }
}

impl Game {
    pub(crate) fn proto_preview(&mut self, hash: &str) {
        let Some(i) = hash.find("style-") else { return };
        let Some(opt) = hash[i + 6..].chars().next() else { return };
        let look = hash.find("med-").and_then(|i| hash[i + 4..].chars().next()).and_then(|c| c.to_digit(10)).unwrap_or(0);
        let focus = if hash.contains("focus-lo") { 0.12 } else { 1.0 };
        self.proto = Some(Proto { opt, t0: -1.0, said: false, phi0: None, look, focus });
        let s = &mut self.s;
        s.pl = 1.5e4.into();
        s.best = s.pl;
        s.o9k = true;
        s.ach.insert("o9k");
        for (u, n) in [(Upg::Boots, 10), (Upg::House, 2), (Upg::Gravity, 2), (Upg::Scouter, 2), (Upg::Galick, 1), (Upg::Senzu, 1), (Upg::Kaio, 1)] {
            s.levels[u as usize] = n;
        }
        if s.hero == Hero::Piccolo && opt == 'B' {
            s.pl = 2.4e4.into();
            s.best = s.pl;
        }
        self.scenery();
    }

    /// Each frame, before the run moves: the hero held at the front of the planet, the pitch's toast and poses.
    pub(crate) fn proto_step(&mut self, t: f64) {
        let Some(p) = self.proto.as_mut() else { return };
        if !self.playing {
            return;
        }
        if p.t0 < 0.0 {
            p.t0 = t;
        }
        let el = p.el(t);
        let opt = p.opt;
        let say = !p.said && el >= MOMENT - 1.4;
        if say {
            p.said = true;
        }
        // he holds still at his first spot, and the camera looks at the road from just above it, `lead` ahead of
        // him: he stands on top of the planet, a little left, with what the pitch puts ahead of him to his right
        let phi = p.phi0.get_or_insert(self.phi).to_owned();
        self.phi = phi;
        self.last_lap = phi - 1.0;
        let lead = match (self.s.hero, opt) {
            (Hero::Tien, 'A') | (Hero::Piccolo, 'A') => 0.0,
            _ => 0.3,
        };
        let f = &self.frame3;
        let c = phi + lead;
        let (pp, tt) = (f.road_pt(c), norm(add(mul(f.e1, -sin(c)), f.e2, cos(c))));
        let nn = cross(pp, tt);
        let tilt: f64 = 1.15;
        let (pv, tv) = ([0.0, cos(tilt), sin(tilt)], [-1.0, 0.0, 0.0]);
        let nv = cross(pv, tv);
        let mut m = [0.0; 9];
        for r in 0..3 {
            for k in 0..3 {
                m[r * 3 + k] = pv[r] * pp[k] + tv[r] * tt[k] + nv[r] * nn[k];
            }
        }
        self.cam.m = m;
        let h = self.s.hero;
        match (h, opt) {
            (Hero::Piccolo, 'A') => {
                self.b.pose_until = t + 0.5;
                self.tl.jump_h = 16.0;
                self.tl.jump_v = 0.0;
            }
            (Hero::Tien, 'B') | (Hero::A17, 'C') | (Hero::Krillin, 'B') if el > MOMENT - 1.0 => self.b.pose_until = t + 0.5,
            (Hero::Goten, 'A') if el > MOMENT - 1.2 && self.b.fused.is_none() => {
                self.b.fused = Some((3.0, t + 30.0));
                self.tl.fused_look = "FUSED.gotenks";
            }
            _ => {}
        }
        if say && h == Hero::Piccolo && opt == 'A' && self.proto.as_ref().is_some_and(|p| p.look > 0) {
            let lo = self.proto.as_ref().is_some_and(|p| p.focus < 0.5);
            self.event_ms(if lo { "focus ×1.1 · 12s untouched" } else { "focus ×2 · full — tap to spend it" }, 4000.0);
        } else if say {
            let s = toast(h, opt);
            if !s.is_empty() {
                self.event_ms(s, 4000.0);
            }
        }
    }
}
