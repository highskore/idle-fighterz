//! The Cell Games: a story beat 20 minutes of play after Cell's saga is won (so perfect Cell isn't back right after it), then a rare repeat (every 45–55 minutes of play, at the next quiet moment), scaled
//! as everything is, on your rate. Cell builds his ring on the planet and a countdown runs out; five Cell Jr.s hop
//! about it (tap them; Gohan picks one off every few seconds on his own); then perfect Cell steps up as a boss (the
//! usual fight: taps, beams, big bangs, and the ki blasts that wear him down idle); beaten, he swells to self-destruct,
//! and you beam it back: taps, beams and big bangs push, Gohan pushes on his own, and a tap into one of its flares
//! pushes it back at you. Beamed back: a prize and a champion's ×2. If it goes off, King Kai's planet goes up with
//! him: no prize, and everyone wears a halo for two minutes (it costs nothing else). Idle, Gohan wins every phase,
//! slowly. Nothing else big starts meanwhile (no saga boss, universe fight, tournament, movie, storm or trip).
//! planet-render draws it from `Tl::cg`; the words go in the usual toasts.

use crate::game::Game;
use crate::geom::{add, norm, V3};
use crate::hud::Cue;
use crate::jsmath::{cos, hypot, sin};
use crate::num::{fmt_short, js_round};
use crate::sprite::{shape_sprite, Pal, Sprite};
use crate::timeline::{Boss, Later};

/// Seconds of play from Cell's saga being won to the games, and between repeats (then they wait for a quiet moment).
pub const CG_STORY: f64 = 1200.0;
pub const CG_REPEAT: [f64; 3] = [2700.0, 3300.0, 3000.0];
/// The countdown, the Cell Jr.s (when Gohan gets the first, and then how often), what a tapped one pays (seconds of
/// rate).
pub const CG_COUNT: f64 = 10.0;
pub const CG_JRS: usize = 5;
pub const CG_JR_FIRST: f64 = 3.0;
pub const CG_JR_EVERY: f64 = 3.0;
pub const CG_JR_PAY: f64 = 4.0;
/// Perfect Cell's hp (seconds of the bare rate) and his fight's clock.
pub const CG_HP: f64 = 8.0;
pub const CG_FIGHT: f64 = 45.0;
/// The self-destruct: its fuse, Gohan's push a second, a tap's, a tap into a flare's, a beam's (× its charge) and a
/// big bang's; the flares' cycle and how long each lasts.
pub const CG_FUSE: f64 = 14.0;
pub const CG_GOHAN: f64 = 0.07;
pub const CG_TAP: f64 = 0.035;
pub const CG_FLARE_TAP: f64 = -0.06;
pub const CG_BEAM: f64 = 0.2;
pub const CG_BANG: f64 = 0.3;
pub const CG_FLARE_EVERY: f64 = 2.0;
pub const CG_FLARE: f64 = 0.5;
/// Beamed back: seconds of the bare rate, and the champion's ×2 for 30s. Gone off: the halos.
pub const CG_PRIZE: f64 = 30.0;
pub const CG_X: f64 = 2.0;
pub const CG_X_S: f64 = 30.0;
pub const CG_HALO: f64 = 120.0;
/// How long the end is drawn.
pub const CG_END: f64 = 1.6;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CgPh {
    Count,
    Jrs,
    Cell,
    Boom,
    /// beamed back (true), or gone off
    Over(bool),
}

#[derive(Clone, Debug)]
pub struct Jr {
    pub c: V3,
    /// when Gohan or a tap got him
    pub dead: Option<f64>,
    /// Gohan's (the renderer draws his shot), or yours
    pub gohan: bool,
}

#[derive(Clone, Debug)]
pub struct CellGames {
    pub ph: CgPh,
    /// when this phase started
    pub t0: f64,
    /// which games these are (0: the story beat)
    pub n: u32,
    /// the ring's middle, on the planet
    pub ring: V3,
    pub jrs: Vec<Jr>,
    pub next_jr: f64,
    /// perfect Cell, while he fights
    pub boss: u32,
    /// where he stood (from the fight's last drawing), and his scale: he swells there
    pub at: (f64, f64, f64),
    /// the self-destruct: 1 beamed back, 0 gone off
    pub p: f64,
}

impl CellGames {
    /// A flare of the self-destruct is on: a tap into it pushes the wrong way.
    pub fn flaring(&self, t: f64) -> bool {
        self.ph == CgPh::Boom && (t - self.t0) % CG_FLARE_EVERY >= CG_FLARE_EVERY - CG_FLARE
    }
}

/// Cell Jr.: small, blue-white, with Cell's crest and spots.
pub fn jr_sprite() -> &'static Sprite {
    static S: std::sync::OnceLock<Sprite> = std::sync::OnceLock::new();
    S.get_or_init(|| {
        let pal = Pal::new(&[
            ('o', 0x1d1030),
            ('b', 0x7ab0e8),
            ('B', 0x4a7ac0),
            ('g', 0x6cc94e),
            ('G', 0x3a8a3a),
            ('s', 0x2a2a3a),
            ('w', 0xffffff),
            ('p', 0xb85ad8),
            ('k', 0x2a1a3a),
        ]);
        shape_sprite(
            12,
            15,
            |g| {
                g.poly(&[[3.0, 1.0], [6.0, 3.0], [9.0, 1.0], [9.0, 5.0], [3.0, 5.0]], 'g');
                g.ell(6.0, 5.5, 3.2, 3.0, 'b');
                g.rect(4, 4, 4, 2, 'p');
                g.set(4, 5, 'k');
                g.set(7, 5, 'k');
                g.ell(6.0, 10.0, 3.0, 3.0, 'g');
                g.rect(5, 8, 2, 4, 's');
                g.set(4, 10, 'G');
                g.set(8, 11, 'G');
                g.line(&[[3.2, 9.0], [1.5, 11.5]], 1.6, 1.4, 'b');
                g.line(&[[8.8, 9.0], [10.5, 11.5]], 1.6, 1.4, 'b');
                g.rect(4, 12, 2, 3, 'B');
                g.rect(6, 12, 2, 3, 'B');
            },
            &pal,
            &[('b', 'B'), ('g', 'G')],
        )
    })
}

impl Game {
    /// The games aren't on (they hold the stage: no other big thing starts).
    pub fn no_games(&self) -> bool {
        self.tl.cg.is_none()
    }

    /// Where a Cell Jr. stands on screen, if he's on the near side.
    pub fn jr_spot(&self, i: usize) -> Option<(f64, f64)> {
        let j = self.tl.cg.as_ref()?.jrs.get(i)?;
        let s = self.cam.screen(j.c, 0.0);
        (s.v[2] > 0.05).then_some((s.x, s.y))
    }

    pub(crate) fn cg_step(&mut self, t: f64, dt: f64) {
        if self.no_events {
            return;
        }
        if !self.tl.cg_story && self.s.saga >= 5 {
            self.tl.cg_story = true;
            self.tl.cg_next = CG_STORY;
        }
        let Some(cg) = self.tl.cg.clone() else {
            // the clock runs on play time; the games wait for a quiet moment at home once it's up
            if self.tl.cg_story {
                self.tl.cg_next -= dt;
            }
            if self.tl.cg_story && self.tl.cg_next < 0.0 && self.s.world == self.home() && self.quiet() {
                self.cg_start(t);
            }
            return;
        };
        if self.s.world != self.home() {
            self.tl.cg = None;
            return;
        }
        if !matches!(cg.ph, CgPh::Over(_)) {
            self.cg_face(dt, cg.ring);
        }
        match cg.ph {
            CgPh::Count if t - cg.t0 >= CG_COUNT => {
                let (a, b) = self.tangents(cg.ring);
                let jrs = (0..CG_JRS)
                    .map(|i| {
                        let q = i as f64 * std::f64::consts::TAU / CG_JRS as f64 + 0.4;
                        Jr { c: norm(add(add(cg.ring, a, cos(q) * 0.22), b, sin(q) * 0.3)), dead: None, gohan: false }
                    })
                    .collect();
                let g = self.tl.cg.as_mut().unwrap();
                (g.ph, g.t0, g.jrs, g.next_jr) = (CgPh::Jrs, t, jrs, t + CG_JR_FIRST);
                let msg = format!(
                    "cell: \"meet my children!\" — tap the cell jr.s ({} take them on too)",
                    if self.s.hero == crate::data::Hero::Gohan { "the z fighters" } else { "you and gohan" }
                );
                self.event_ms(msg, 3200.0);
                self.cue(Cue::Sfx("boss"));
            }
            CgPh::Jrs => {
                if t >= cg.next_jr {
                    if let Some(i) = cg.jrs.iter().position(|j| j.dead.is_none()) {
                        self.tl.cg.as_mut().unwrap().next_jr = t + CG_JR_EVERY;
                        self.jr_down(i, true);
                    }
                }
                let g = self.tl.cg.as_ref().unwrap();
                if g.jrs.iter().all(|j| j.dead.is_some_and(|d| t - d > 0.6)) {
                    self.cg_cell(t);
                }
            }
            CgPh::Cell => match self.tl.boss.as_ref().filter(|b| b.id == cg.boss) {
                Some(b) if b.dead && !b.fled => {
                    let at = (b.x, b.y, b.k);
                    let g = self.tl.cg.as_mut().unwrap();
                    (g.ph, g.t0, g.at, g.p) = (CgPh::Boom, t, at, 0.5);
                    let who = if self.s.hero == crate::data::Hero::Gohan { "goku's spirit" } else { "gohan" };
                    self.after(1.0, Later::Event(format!("cell swells up to self-destruct! beam it back — tap, or fire ({who} pushes too)"), 3500.0));
                    self.cue(Cue::Sfx("boss"));
                }
                Some(b) if b.fled => {
                    self.tl.cg = None;
                    self.cg_done();
                    self.event("cell leaves the ring — the games end in a draw");
                }
                None => {
                    self.tl.cg = None;
                    self.cg_done();
                }
                _ => {}
            },
            CgPh::Boom => {
                let p = cg.p + CG_GOHAN * dt;
                self.tl.cg.as_mut().unwrap().p = p;
                if !self.calm {
                    self.shake = self.shake.max(0.05 + 0.1 * (t - cg.t0) / CG_FUSE);
                }
                if p >= 1.0 || p <= 0.0 || t - cg.t0 >= CG_FUSE {
                    self.cg_end(t, p >= 0.5);
                }
            }
            CgPh::Over(_) if t - cg.t0 >= CG_END => self.tl.cg = None,
            _ => {}
        }
    }

    fn cg_start(&mut self, t: f64) {
        let n = self.tl.cg_n;
        self.tl.cg_n += 1;
        // the ring goes down a little off the road, ahead of him
        let ring = self.frame3.cap_pt(1.1, self.phi + 0.8);
        self.tl.cg = Some(CellGames { ph: CgPh::Count, t0: t, n, ring, jrs: Vec::new(), next_jr: 0.0, boss: 0, at: (0.0, 0.0, 1.0), p: 0.5 });
        self.event_ms(
            if n == 0 {
                "the cell games! cell has built his ring on the planet — 10 seconds to the bell"
            } else {
                "the cell games are back — cell wants a rematch. 10 seconds"
            },
            3500.0,
        );
        self.cue(Cue::Sfx("boss"));
        self.cue(Cue::Notify("raid", "the cell games".into()));
    }

    /// Two directions along the planet at `c`.
    fn tangents(&self, c: V3) -> (V3, V3) {
        let n = self.frame3.n;
        let a = norm(crate::geom::cross(c, n));
        (a, crate::geom::cross(c, a))
    }

    /// The planet turns the ring our way, gently (as the ramen break turns him).
    fn cg_face(&mut self, dt: f64, ring: V3) {
        self.turn_to(ring, [0.0, 0.5, 0.87], 1f64.min(dt * 1.2));
    }

    /// A Cell Jr. goes down: Gohan's, or a tap's (that pays).
    fn jr_down(&mut self, i: usize, gohan: bool) {
        let t = self.t;
        let at = self.jr_spot(i);
        let j = &mut self.tl.cg.as_mut().unwrap().jrs[i];
        j.dead = Some(t);
        j.gohan = gohan;
        self.cue(Cue::Sfx("hit"));
        self.burst_seen(at.map(|(x, y)| (x, y - 6.0)), &[0xffffff, 0x7ab0e8, 0x6cc94e], 10, 90.0);
        if !gohan {
            let n = self.rate() * CG_JR_PAY;
            let (x, y) = at.unwrap_or((0.0, 0.0));
            self.gain_at(n, x, y - 12.0, true);
        }
    }

    /// Perfect Cell steps up: the usual fight, his hp on the bare rate.
    fn cg_cell(&mut self, t: f64) {
        let hp = crate::big::Big::from(10.0).max(self.wrate() * CG_HP);
        let spr = crate::data::VILLAINS[4].1;
        let b = Boss::new(0, "perfect cell".into(), spr, hp, t, t + CG_FIGHT);
        self.new_boss(b);
        let id = self.tl.boss_ids;
        let g = self.tl.cg.as_mut().unwrap();
        (g.ph, g.t0, g.boss) = (CgPh::Cell, t, id);
        let who = if self.s.hero == crate::data::Hero::Gohan { "the z fighters wear" } else { "gohan wears" };
        self.event_ms(format!("perfect cell steps into the ring — tap him ({who} him down too)"), 3200.0);
        self.cue(Cue::Sfx("boss"));
    }

    /// The self-destruct is beamed back, or goes off.
    fn cg_end(&mut self, t: f64, won: bool) {
        let g = self.tl.cg.as_mut().unwrap();
        (g.ph, g.t0) = (CgPh::Over(won), t);
        let at = g.at;
        if won {
            let prize = self.wrate() * CG_PRIZE;
            self.gain_at(prize, at.0, at.1 - 30.0, true);
            self.b.champ_until = t + CG_X_S;
            let p = fmt_short(js_round(prize));
            // the father-son kamehameha is goku's and gohan's; anyone else beams it back with gohan
            let fin = if matches!(self.s.hero, crate::data::Hero::Gohan | crate::data::Hero::Goku) {
                "father-son kamehameha!"
            } else {
                "you and gohan beam it back!"
            };
            self.event_ms(format!("{fin} cell is gone for good — champion ×{CG_X} for {CG_X_S}s, +{p}"), 4000.0);
            self.cue(Cue::Fx("star"));
            self.victory();
        } else {
            self.tl.halo_until = t + CG_HALO;
            self.event_ms("cell self-destructs — king kai's planet goes up with him! everyone wears a halo for 2 minutes", 4000.0);
            self.cue(Cue::Sfx("boom"));
        }
        if !self.calm {
            self.flash_t = self.flash_t.max(0.8);
            self.shake = self.shake.max(0.8);
        }
        self.cg_done();
    }

    fn cg_done(&mut self) {
        self.tl.cg_next = CG_REPEAT[(self.tl.cg_n as usize + 2) % CG_REPEAT.len()];
    }

    /// A tap during the games: it pushes the self-destruct, or gets a Cell Jr. True if it took the tap.
    pub(crate) fn cg_tap(&mut self, px: f64, py: f64) -> bool {
        let t = self.t;
        let Some(g) = self.tl.cg.as_ref() else { return false };
        match g.ph {
            CgPh::Boom => {
                let flare = g.flaring(t);
                self.tl.cg.as_mut().unwrap().p += if flare { CG_FLARE_TAP } else { CG_TAP };
                self.cue(Cue::Sfx("tap"));
                if !self.calm {
                    self.shake = self.shake.max(0.1);
                }
                true
            }
            CgPh::Jrs => {
                let n = g.jrs.len();
                let hit = (0..n).find(|&i| g.jrs[i].dead.is_none() && self.jr_spot(i).is_some_and(|(x, y)| hypot(&[px - x, py - (y - 6.0)]) < 9.0));
                match hit {
                    Some(i) => {
                        self.jr_down(i, false);
                        true
                    }
                    None => false,
                }
            }
            _ => false,
        }
    }

    /// A beam (of charge `c`) or a big bang (`None`) during the self-destruct pushes it. True if it took it.
    pub(crate) fn cg_push(&mut self, c: Option<f64>) -> bool {
        let Some(g) = self.tl.cg.as_mut().filter(|g| g.ph == CgPh::Boom) else { return false };
        g.p += c.map_or(CG_BANG, |c| CG_BEAM * c);
        true
    }
}
