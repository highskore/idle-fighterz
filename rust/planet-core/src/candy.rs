//! Majin Buu's candy: a story beat once Kid Buu's saga is won, then a rare repeat (every 45–55 minutes of play, at the next quiet moment).
//! Fat Buu floats over the planet as a boss and every few seconds zaps something with his antenna: a tree, a house,
//! bubbles or piccolo turns to candy, and what produces stops producing while it's candy (bubbles' and piccolo's
//! income; a house's share of the houses'). Tap a piece of candy: it turns back and you get a sugar rush. Beat him
//! (the usual fight: taps, beams, big bangs) and all of it turns back, with his prize; or wait him out: he gets bored
//! and floats off, the candy turns back and melts into a sugar high. The ki blasts that wear bosses down don't reach
//! his rubbery belly, so idle you wait him out. planet-render draws him, the zaps and the candy from `Tl::candy`.

use crate::big::Big;
use crate::data::{Dim, Upg};
use crate::game::Game;
use crate::geom::{mul, V3};
use crate::hud::Cue;
use crate::jsmath::hypot;
use crate::sprite::{shape_sprite, Pal, Sprite};
use crate::timeline::Boss;

/// Seconds of play from Kid Buu's saga being won to his visit, and between repeats (then he waits for a quiet moment).
pub const CANDY_STORY: f64 = 90.0;
pub const CANDY_REPEAT: [f64; 3] = [3000.0, 2700.0, 3300.0];
/// How long he stays, his hp (seconds of the bare rate), his first zap, the gap between them, how long one takes to
/// land, and how many things he turns at most.
pub const CANDY_STAY: f64 = 40.0;
pub const CANDY_HP: f64 = 25.0;
pub const CANDY_FIRST: f64 = 2.5;
pub const CANDY_EVERY: f64 = 4.0;
pub const CANDY_ZAP: f64 = 0.6;
pub const CANDY_MAX: usize = 6;
/// A tapped piece: a sugar rush (×1.5 for 15s) and seconds of rate. Waited out: a sugar high, the same buff.
pub const SUGAR_X: f64 = 1.5;
pub const SUGAR_S: f64 = 15.0;
pub const CANDY_PAY: f64 = 2.0;
pub const MELT_S: f64 = 30.0;

/// What he turns: king kai's planet's capsule houses and trees by their scenery slot, a spot on any other home world.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Target {
    Bubbles,
    Piccolo,
    House(usize),
    Tree(usize),
    Spot(usize),
}

/// King kai's planet's capsule houses (the house upgrade's), as planet-render's scenery places them: (th, a, r).
pub const HOUSES: [[f64; 3]; 9] = [
    [0.75, 1.9, 0.15],
    [0.6, 5.1, 0.16],
    [1.05, 4.0, 0.13],
    [2.0, 2.2, 0.16],
    [2.3, 4.2, 0.15],
    [1.9, 0.05, 0.14],
    [2.6, 5.8, 0.13],
    [3.0, 2.4, 0.15],
    [1.25, 2.65, 0.12],
];
/// Its trees: (th, a, size).
pub const TREES: [[f64; 3]; 8] =
    [[0.95, 0.5, 1.05], [0.62, 1.35, 0.85], [1.0, 5.0, 0.95], [0.55, 5.8, 0.7], [2.25, 1.2, 1.0], [2.5, 3.4, 1.1], [2.1, 5.2, 0.9], [2.75, 0.2, 0.8]];
/// Anywhere else: where the candy stands.
pub const SPOTS: [[f64; 2]; 4] = [[0.7, 1.0], [1.0, 3.0], [0.8, 4.6], [1.3, 5.6]];

#[derive(Clone, Debug)]
pub struct Candy {
    pub t0: f64,
    pub n: u32,
    /// fat buu, while he's here
    pub boss: u32,
    pub next: f64,
    /// the zap on its way, and when it left
    pub zap: Option<(Target, f64)>,
    /// what's candy, and since when
    pub done: Vec<(Target, f64)>,
    /// how far down his list he is
    pub i: usize,
    /// when he left (the candy turns back then)
    pub over: Option<f64>,
}

/// Fat Buu: pink and round, a black vest, white baggy trousers, a cape, the antenna.
pub fn buu_sprite() -> &'static Sprite {
    static S: std::sync::OnceLock<Sprite> = std::sync::OnceLock::new();
    S.get_or_init(|| {
        let pal = Pal::new(&[
            ('o', 0x1d1030),
            ('p', 0xf6a6c8),
            ('P', 0xd877a4),
            ('v', 0x2a2440),
            ('V', 0x1a1428),
            ('w', 0xffffff),
            ('W', 0xd8d8e8),
            ('y', 0xf2c84a),
            ('c', 0x6a4aa8),
            ('C', 0x4a3080),
            ('k', 0x1d1030),
        ]);
        shape_sprite(
            26,
            30,
            |g| {
                // the cape behind
                g.poly(&[[6.0, 9.0], [20.0, 9.0], [23.0, 26.0], [3.0, 26.0]], 'c');
                // antenna
                g.line(&[[13.0, 6.0], [14.0, 2.5], [17.0, 1.5], [18.5, 3.0]], 2.2, 1.4, 'p');
                // head
                g.ell(13.0, 8.0, 4.6, 3.8, 'p');
                g.set(11, 8, 'k');
                g.set(15, 8, 'k');
                g.rect(12, 10, 3, 1, 'P');
                // the belly, the vest open over it
                g.ell(13.0, 16.5, 8.5, 6.8, 'p');
                g.poly(&[[5.0, 12.0], [10.0, 11.0], [9.0, 21.0], [5.5, 19.0]], 'v');
                g.poly(&[[21.0, 12.0], [16.0, 11.0], [17.0, 21.0], [20.5, 19.0]], 'v');
                // arms and gloves
                g.line(&[[5.0, 13.0], [2.5, 18.0]], 3.0, 2.6, 'p');
                g.line(&[[21.0, 13.0], [23.5, 18.0]], 3.0, 2.6, 'p');
                g.ell(2.5, 19.0, 1.8, 1.6, 'w');
                g.ell(23.5, 19.0, 1.8, 1.6, 'w');
                // the belt and the M buckle, the baggy trousers, the boots
                g.rect(6, 21, 14, 2, 'y');
                g.set(13, 21, 'k');
                g.ell(9.5, 25.0, 4.0, 3.2, 'w');
                g.ell(16.5, 25.0, 4.0, 3.2, 'w');
                g.rect(6, 27, 6, 2, 'y');
                g.rect(14, 27, 6, 2, 'y');
            },
            &pal,
            &[('p', 'P'), ('v', 'V'), ('w', 'W'), ('c', 'C')],
        )
    })
}

pub fn buu_dim() -> Dim {
    let s = buu_sprite();
    Dim { w: s.w as f64, h: s.h as f64 }
}

impl Game {
    /// Whether `x` is candy right now.
    pub fn candied(&self, x: Target) -> bool {
        self.tl.candy.as_ref().is_some_and(|c| c.done.iter().any(|d| d.0 == x))
    }

    /// The houses king kai's planet draws (the scenery shows at most nine).
    fn houses_drawn(&self) -> usize {
        (self.scenery_house as usize).min(HOUSES.len())
    }

    /// What's left of a producer's income while some of it is candy.
    pub fn candy_keep(&self, u: Upg) -> f64 {
        if self.tl.candy.is_none() {
            return 1.0;
        }
        match u {
            Upg::Partner if self.candied(Target::Bubbles) => 0.0,
            Upg::Piccolo if self.candied(Target::Piccolo) => 0.0,
            Upg::House => {
                let n = self.houses_drawn();
                let k = (0..n).filter(|&i| self.candied(Target::House(i))).count();
                if n == 0 {
                    1.0
                } else {
                    1.0 - k as f64 / n as f64
                }
            }
            _ => 1.0,
        }
    }

    /// Where a target is on the planet, and how high its middle stands off it (in pixels).
    pub fn target_at(&self, x: Target) -> Option<(V3, f64)> {
        let f = &self.frame3;
        Some(match x {
            Target::House(i) => (f.cap_pt(HOUSES[i][0], HOUSES[i][1]), 3.0),
            Target::Tree(i) => (f.cap_pt(TREES[i][0], TREES[i][1]), 12.0 * TREES[i][2]),
            Target::Spot(i) => (f.cap_pt(SPOTS[i][0], SPOTS[i][1]), 5.0),
            Target::Bubbles => (f.road_pt(self.bub_phi()), 6.0),
            Target::Piccolo => (mul(f.cap_pt(0.6, 0.9), 1.28), 8.0),
        })
    }

    /// Where a target is on screen, if it's on the near side.
    pub fn target_spot(&self, x: Target) -> Option<(f64, f64)> {
        let (p, up) = self.target_at(x)?;
        match x {
            Target::Bubbles => self.ally_spot(crate::mech::Ally::Bubbles).map(|(x, y)| (x, y - up)),
            Target::Piccolo => self.ally_spot(crate::mech::Ally::Piccolo).map(|(x, y)| (x, y - up)),
            _ => {
                let s = self.cam.screen(p, up);
                (s.v[2] > 0.05).then_some((s.x, s.y))
            }
        }
    }

    /// His list: what he'd turn, in order, of what's here.
    fn candy_list(&self) -> Vec<Target> {
        let bub = self.s.lv(Upg::Partner) > 0 && self.b.fuse_until <= self.t;
        let pic = self.s.lv(Upg::Piccolo) > 0;
        let order: Vec<Target> = if self.s.world == 0 {
            let n = self.houses_drawn();
            vec![Target::Tree(0), Target::House(0), Target::Bubbles, Target::Tree(1), Target::Piccolo, Target::House(1), Target::Tree(2), Target::House(2)]
                .into_iter()
                .filter(|x| !matches!(x, Target::House(i) if *i >= n))
                .collect()
        } else {
            vec![Target::Spot(0), Target::Bubbles, Target::Spot(1), Target::Piccolo, Target::Spot(2), Target::Spot(3)]
        };
        order.into_iter().filter(|x| (*x != Target::Bubbles || bub) && (*x != Target::Piccolo || pic)).collect()
    }

    pub(crate) fn candy_step(&mut self, t: f64, dt: f64) {
        if self.no_events {
            return;
        }
        if !self.tl.candy_story && self.s.saga >= 6 {
            self.tl.candy_story = true;
            self.tl.candy_next = CANDY_STORY;
        }
        let Some(c) = self.tl.candy.clone() else {
            if self.tl.candy_story {
                self.tl.candy_next -= dt;
            }
            if self.tl.candy_story && self.tl.candy_next < 0.0 && self.s.world == self.home() && self.quiet() {
                self.candy_start(t);
            }
            return;
        };
        if let Some(o) = c.over {
            if t - o > 0.8 {
                self.tl.candy = None;
            }
            return;
        }
        let here = self.tl.boss.as_ref().filter(|b| b.id == c.boss).cloned();
        match here {
            Some(b) if !b.dead => {
                if t < b.go {
                    return;
                }
                if let Some((x, t1)) = c.zap {
                    if t - t1 >= CANDY_ZAP {
                        let at = self.target_spot(x);
                        let cd = self.tl.candy.as_mut().unwrap();
                        cd.zap = None;
                        cd.done.push((x, t));
                        self.burst_seen(at, &[0xffffff, 0xffc0dc, 0xf28ab8, 0x9ae8d0], 14, 90.0);
                        self.cue(Cue::Sfx("coin"));
                        let what = match x {
                            Target::Bubbles => "bubbles",
                            Target::Piccolo => "piccolo",
                            Target::House(_) => "a house",
                            Target::Tree(_) => "a tree",
                            Target::Spot(_) => "a chunk of the floor",
                        };
                        let stops = if matches!(x, Target::Tree(_) | Target::Spot(_)) { "" } else { ", no income from it meanwhile" };
                        self.event(format!("buu turns {what} into candy{stops} — tap the candy for a sugar rush"));
                    }
                } else if t >= c.next && c.done.len() < CANDY_MAX {
                    let list = self.candy_list();
                    let cd = self.tl.candy.as_mut().unwrap();
                    cd.next = t + CANDY_EVERY;
                    // the next one down his list that isn't candy already
                    let pick = (0..list.len()).map(|k| list[(cd.i + k) % list.len()]).find(|x| !cd.done.iter().any(|d| d.0 == *x));
                    cd.i += 1;
                    if let Some(x) = pick {
                        cd.zap = Some((x, t));
                    }
                }
            }
            Some(b) => {
                // beaten (his prize came with the fight), or bored
                let cd = self.tl.candy.as_mut().unwrap();
                cd.over = Some(t);
                cd.zap = None;
                let n = cd.done.len();
                if b.fled {
                    self.b.sugar_until = self.b.sugar_until.max(t + MELT_S);
                    self.event_ms(format!("buu gets bored and floats off — the candy turns back and melts: sugar high ×{SUGAR_X} for {MELT_S}s"), 3500.0);
                } else if n > 0 {
                    self.event("the candy turns back");
                }
                self.candy_done();
            }
            None => {
                self.tl.candy = None;
                self.candy_done();
            }
        }
    }

    fn candy_start(&mut self, t: f64) {
        let n = self.tl.candy_n;
        self.tl.candy_n += 1;
        let hp = Big::from(30.0).max(self.wrate() * CANDY_HP);
        let mut b = Boss::new(0, "majin buu".into(), buu_dim(), hp, t, t + CANDY_STAY);
        b.go = t + 1.2;
        self.new_boss(b);
        let id = self.tl.boss_ids;
        self.tl.candy = Some(Candy { t0: t, n, boss: id, next: t + CANDY_FIRST, zap: None, done: Vec::new(), i: 0, over: None });
        self.event_ms(
            if n == 0 {
                "majin buu floats down: \"buu turn you into candy!\" — tap the candy back, beat him or wait him out"
            } else {
                "majin buu is back for more candy"
            },
            4000.0,
        );
        self.cue(Cue::Sfx("boss"));
        self.cue(Cue::Notify("raid", "majin buu".into()));
    }

    fn candy_done(&mut self) {
        self.tl.candy_next = CANDY_REPEAT[(self.tl.candy_n as usize + 2) % CANDY_REPEAT.len()];
    }

    /// A tap on a piece of candy: it turns back, with a sugar rush. True if it took the tap.
    pub(crate) fn candy_tap(&mut self, px: f64, py: f64) -> bool {
        let Some(c) = self.tl.candy.as_ref().filter(|c| c.over.is_none()) else { return false };
        let hit = c.done.iter().map(|d| d.0).find(|&x| self.target_spot(x).is_some_and(|(x, y)| hypot(&[px - x, py - y]) < 11.0));
        let Some(x) = hit else { return false };
        let t = self.t;
        let (sx, sy) = self.target_spot(x).unwrap();
        self.tl.candy.as_mut().unwrap().done.retain(|d| d.0 != x);
        self.b.sugar_until = t + SUGAR_S;
        let n = self.rate() * CANDY_PAY;
        self.gain_at(n, sx, sy - 8.0, true);
        self.burst_at(sx, sy, &[0xffffff, 0xffc0dc, 0xf28ab8, 0x9ae8d0, 0xfff27a], 16, 120.0);
        self.cue(Cue::Sfx("coin"));
        self.event(format!("sugar rush! ×{SUGAR_X} for {SUGAR_S}s"));
        true
    }
}
