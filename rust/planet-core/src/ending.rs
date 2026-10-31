//! PROTOTYPE (design picker only): five takes on the game's ending, each as three key moments behind preview hooks
//! `#endA1` … `#endE3` (take A–E, moment 1–3). Each hook sets the run up, posts the moment's toasts and leaves the
//! drawing to planet-render's `ending`. Nothing here is wired into normal play.

use crate::big::Big;
use crate::game::Game;
use crate::limits::milestone;
use crate::timeline::Later;

#[derive(Clone, Debug)]
pub struct Ending {
    /// the take, b'A'..=b'E'
    pub v: u8,
    /// the moment, 1..=3
    pub stage: u8,
    /// when the moment started (set on its first frame)
    pub t0: f64,
}

impl Ending {
    pub fn age(&self, t: f64) -> f64 {
        t - self.t0
    }
    pub fn is(&self, v: u8, stage: u8) -> bool {
        self.v == v && self.stage == stage
    }
}

/// Each moment's toasts: (seconds in, text, ms shown).
fn script(v: u8, stage: u8) -> Vec<(f64, &'static str, f64)> {
    match (v, stage) {
        (b'A', 1) => vec![(0.5, "universe 7 is gone — its stars went out all at once. 4 universes left", 6000.0)],
        (b'A', 2) => vec![
            (0.4, "king kai: \"…that's everyone, isn't it. sit with me a while.\"", 4200.0),
            (5.0, "idle fighterz — made by highskore", 4200.0),
            (9.6, "dragon ball is akira toriyama's. this was a fan's thank-you", 4200.0),
            (14.2, "thank you for playing", 4200.0),
        ],
        (b'A', 3) => vec![
            (3.0, "nobody is left to read the number. it keeps going anyway", 4500.0),
            (8.0, "tap king kai to say \"let there be light\" and start a new run", 4500.0),
        ],
        (b'B', 1) => vec![(0.5, "the camera keeps pulling back… something huge is watching", 5500.0)],
        (b'B', 2) => vec![
            (0.4, "zeno: \"it's so small! can i keep it?\"", 4200.0),
            (5.0, "zeno reads the credits: \"idle fighterz! made by highskore!\"", 4200.0),
            (9.6, "zeno: \"dragon ball is toriyama's. thank you for playing!\"", 4200.0),
        ],
        (b'B', 3) => vec![(0.5, "zeno erased everything — new game plus: power 1, zeno's favour ×2, and he stays to watch", 6000.0)],
        (b'C', 1) => vec![(0.5, "you pressed the big bang. everything falls into him", 5500.0)],
        (b'C', 2) => vec![
            (0.4, "…and then there was light", 4200.0),
            (5.0, "idle fighterz — made by highskore. thank you for playing", 4200.0),
        ],
        (b'C', 3) => vec![(0.5, "a new universe. power level 1 — the brightest star up there is you", 6000.0)],
        (b'D', 1) => vec![(0.5, "no one is left to fight. your friends come to say goodbye", 5500.0)],
        (b'D', 2) => vec![
            (0.4, "king kai: \"why did the saiyan sit down? …he finally ran out of ceilings!\"", 4200.0),
            (5.0, "piccolo, krillin, bulma, roshi, yamcha — idle fighterz, made by highskore", 4200.0),
            (9.6, "thank you for playing", 4200.0),
        ],
        (b'D', 3) => vec![(0.5, "morning on king kai's planet. the sagas start again — the ladder never ends", 6000.0)],
        (b'E', 1) => vec![(0.5, "power passes 1e3,1▒5,7█8 — the scouter can't read it", 5500.0)],
        (b'E', 2) => vec![
            (0.4, "idle fighterz — made by highskore", 4200.0),
            (5.0, "thank you for playing", 4200.0),
        ],
        (b'E', 3) => vec![(0.5, "power level: 1", 5000.0)],
        _ => vec![],
    }
}

/// While an ending plays only its own toasts (and the ladder's beats) show.
pub(crate) fn toast_filter(end: Option<&Ending>, s: String) -> Option<String> {
    if let Some(r) = s.strip_prefix('\u{1}') {
        return Some(r.to_string());
    }
    match end {
        None => Some(s),
        Some(e) => (e.is(b'A', 3) && s.starts_with("power passes")).then_some(s),
    }
}

impl Game {
    /// A late run: every saga beaten, deep in the tournament of power, `limits` limits broken and power at 10^`e`.
    fn end_late(&mut self, limits: u32, e: f64) {
        let pl = Big::exp10(e);
        self.s.saga = crate::data::VILLAINS.len() as u32;
        self.s.multi = true;
        self.session = 111.0;
        self.s.uni = 3;
        self.s.uni_best = 3;
        self.s.ustars = 3;
        self.s.form = crate::data::MUI_FORM;
        self.s.mastery = ((e - 17.3) / 3.0).ceil().max(0.0) as u32;
        self.s.limits = limits;
        self.s.pl = pl;
        self.s.best = pl;
        self.s.namek_at = pl * 1e6;
        self.s.trips = 3;
        self.s.o9k = true;
        self.s.ach.insert("o9k");
        let mut i = 0;
        while milestone(i).0 <= e {
            i += 1;
        }
        self.s.mile = i;
    }

    /// Preview hooks `#endA1` … `#endE3`.
    pub(crate) fn ending_preview(&mut self, hash: &str) {
        let Some(i) = hash.find("#end") else { return };
        let b = hash.as_bytes();
        let (Some(&v), Some(&st)) = (b.get(i + 4), b.get(i + 5)) else { return };
        let stage = st.wrapping_sub(b'0');
        if !(b'A'..=b'E').contains(&v) || !(1..=3).contains(&stage) {
            return;
        }
        let fresh = matches!((v, stage), (b'B', 3) | (b'C', 3) | (b'E', 3));
        if !fresh {
            match v {
                b'A' => self.end_late(11, 12300.0),
                b'B' => self.end_late(17, 1000000.5),
                b'C' => self.end_late(9, 3100.0),
                b'D' => self.end_late(13, 98000.0),
                _ => self.end_late(19, 3145728.5),
            }
        }
        if (v, stage) == (b'A', 3) {
            // a small beat lands as the moment opens: the ladder carries on in the dark
            let mut i = 0;
            while milestone(i).0 < 20000.0 {
                i += 1;
            }
            self.s.mile = i;
            self.s.pl = Big::exp10(20000.0002);
            self.s.best = self.s.pl;
        }
        for t in [
            &mut self.tl.next_boss,
            &mut self.tl.next_saga,
            &mut self.tl.next_greg,
            &mut self.tl.next_kai,
            &mut self.tl.next_roshi,
            &mut self.tl.next_kril,
            &mut self.tl.next_yam,
            &mut self.tl.next_car,
            &mut self.tl.next_star,
            &mut self.tl.next_moon,
            &mut self.tl.next_storm,
            &mut self.tl.next_ship,
            &mut self.tl.next_movie,
            &mut self.tl.next_date,
            &mut self.tl.next_dance,
        ] {
            *t = 1e9;
        }
        self.tl.home_since = self.session + 600.0;
        self.end = Some(Ending { v, stage, t0: -1.0 });
    }

    /// One frame of an ending moment: its toasts on the first frame; he stands still and faces us in the quiet ones.
    pub(crate) fn ending_step(&mut self, t: f64) {
        let Some(e) = self.end.as_mut() else { return };
        if e.t0 < 0.0 {
            e.t0 = t;
            let (v, stage) = (e.v, e.stage);
            for (at, s, ms) in script(v, stage) {
                self.after(at, Later::Event(format!("\u{1}{s}"), ms));
            }
        }
        // the ending plays at home, on king kai's planet
        if !matches!((self.end.as_ref().unwrap().v, self.end.as_ref().unwrap().stage), (b'B', 3) | (b'C', 3) | (b'E', 3)) && self.s.world != 0 {
            self.s.world = 0;
            self.cam.layout(0);
            self.scenery();
            self.tl.namek_until = 1e12;
        }
        let e = self.end.clone().unwrap();
        let still = !matches!((e.v, e.stage), (b'B', 3) | (b'C', 3) | (b'E', 3) | (b'D', 3));
        if still {
            self.b.pose_until = t + 0.3;
        }
        {
            // the camera brings him round to the top, facing us (as a limit break does)
            use crate::geom::{ap, cross, dot, m_mul, mul, ortho, rot};
            use crate::jsmath::{atan2, hypot};
            let v = ap(&self.cam.m, self.frame3.road_pt(self.phi));
            let u = [0.0, 0.42, 0.91];
            let ax = cross(v, u);
            let s = hypot(&ax);
            if s > 1e-4 {
                let k = if e.age(t) < 0.05 { 1.0 } else { 0.1 };
                self.cam.m = ortho(&m_mul(&rot(mul(ax, 1.0 / s), atan2(s, dot(v, u)) * k), &self.cam.m));
            }
        }
    }
}
