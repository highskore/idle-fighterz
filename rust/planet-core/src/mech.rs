//! Boss mechanics, wave 1: Frieza's death beam you deflect, Cell absorbing an ally you rescue, Kid Buu regenerating
//! unless one big hit finishes him, Hit's time skip, and Jiren batting weak beams back. Each one costs an idle player
//! a bounded share of the fight (a stun, some hp back, a reform) and pays an active one; none of them blocks idle play,
//! and none touches income. They run for saga raids (and universe 11's Jiren), from 2.5s into the fight, and wait out a
//! beam struggle. Cadences are fixed tables: no random draws but the particle bursts. planet-render draws them from
//! `Boss::mech`; anything with words goes in the usual toast.

use crate::big::Big;
use crate::data::Upg;
use crate::game::Game;
use crate::geom::{ap, mul};
use crate::hud::Cue;
use crate::jsmath::{hypot, sin};

/// Frieza: the aim (a tap on your fighter deflects it), the beam, the gaps between shots, the stun and the bounce.
pub const F_FIRST: f64 = 3.0;
pub const F_AIM: f64 = 1.4;
pub const F_FIRE: f64 = 0.35;
pub const F_SHOT: [f64; 4] = [5.5, 4.5, 6.0, 5.0];
pub const F_STUN: f64 = 1.5;
pub const F_BACK: f64 = 0.03;
/// Cell: grabs below this share of his hp; the tail's reach, the drain, its heal a second and its cap a fight.
pub const C_BELOW: f64 = 0.9;
pub const C_FIRST: f64 = 4.0;
pub const C_EVERY: f64 = 10.0;
pub const C_REACH: f64 = 0.8;
pub const C_DRAIN: f64 = 3.0;
pub const C_HEAL: f64 = 0.04;
pub const C_CAP: f64 = 0.3;
/// a rescued ally's punch, and how much later the next grab comes
pub const C_HIT: f64 = 0.05;
pub const C_PUSH: f64 = 4.0;
/// Kid Buu: the zone, his regen in it, what he reforms to, how often, and how long he can't be touched meanwhile.
pub const B_ZONE: f64 = 0.25;
pub const B_REGEN: f64 = 0.015;
pub const B_REFORM: f64 = 0.12;
pub const B_REFORMS: u32 = 3;
pub const B_REFORM_T: f64 = 0.6;
/// A beam this charged is a big hit (60% of the full 2.5).
pub const B_BIG: f64 = 1.5;
/// Hit: the glint, the skip, the opening (taps there hit ×2), then a gap.
pub const H_FIRST: f64 = 3.0;
pub const H_GLINT: f64 = 0.5;
pub const H_SKIP: f64 = 1.0;
pub const H_OPEN: f64 = 0.6;
pub const H_GAP: [f64; 4] = [2.0, 3.0, 1.5, 2.5];
pub const H_X: f64 = 2.0;
/// Jiren: a full charge breaks through (×1.5); anything less comes back and stuns.
pub const J_FULL: f64 = 2.4;
pub const J_X: f64 = 1.5;
pub const J_BACK: f64 = 0.25;
pub const J_STUN: f64 = 1.2;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Ph {
    Idle,
    Aim,
    Fire,
    Reach,
    Drain,
    Glint,
    Skip,
    Open,
}

/// The ally Cell grabs.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Ally {
    Bubbles,
    Piccolo,
    Krillin,
}

impl Ally {
    pub fn name(self) -> &'static str {
        match self {
            Ally::Bubbles => "bubbles",
            Ally::Piccolo => "piccolo",
            Ally::Krillin => "krillin",
        }
    }
}

#[derive(Clone, Debug)]
pub enum Mech {
    /// `deflected`: this shot went back at him
    Frieza {
        next: f64,
        i: u32,
        ph: Ph,
        p0: f64,
        deflected: bool,
    },
    /// `healed`: the share of his hp he's taken back this fight
    Cell {
        next: f64,
        i: u32,
        ph: Ph,
        p0: f64,
        who: Ally,
        healed: f64,
    },
    Buu {
        zone: bool,
        reforms: u32,
        reform_until: f64,
        reform_t: f64,
    },
    Hit {
        next: f64,
        i: u32,
        ph: Ph,
        p0: f64,
    },
    /// `refl`: when a weak beam bounced and its charge; `stag`: when a full one broke through
    Jiren {
        refl: Option<(f64, f64)>,
        stag: f64,
    },
}

impl Game {
    fn mech_for(&self) -> Option<Mech> {
        let b = self.tl.boss.as_ref()?;
        if b.movie || !(b.saga || b.uni && b.name == "jiren") {
            return None;
        }
        let go = b.go;
        Some(match b.name.as_str() {
            "frieza" => Mech::Frieza { next: go + F_FIRST, i: 0, ph: Ph::Idle, p0: 0.0, deflected: false },
            "cell" => Mech::Cell { next: go + C_FIRST, i: 0, ph: Ph::Idle, p0: 0.0, who: Ally::Bubbles, healed: 0.0 },
            "kid buu" => Mech::Buu { zone: false, reforms: 0, reform_until: 0.0, reform_t: -9.0 },
            "hit" => Mech::Hit { next: go + H_FIRST, i: 0, ph: Ph::Idle, p0: 0.0 },
            "jiren" => Mech::Jiren { refl: None, stag: -9.0 },
            _ => return None,
        })
    }

    /// A mechanic's toast, at most once every `gap` seconds per slot.
    fn mech_say(&mut self, k: usize, s: impl Into<String>, gap: f64) {
        if self.t >= self.tl.mech_say[k] {
            self.tl.mech_say[k] = self.t + gap;
            self.event(s);
        }
    }

    pub fn stunned(&self) -> bool {
        self.t < self.tl.stun_until
    }

    fn stun(&mut self, secs: f64) {
        self.tl.stun_until = self.t + secs;
        self.combo = 1.0;
        let k = self.kid_screen(12.0);
        self.burst_at(k.x, k.y, &[0xffffff, 0xffe066, 0xff8ad0], 8, 90.0);
    }

    /// Hit's time skip is on: the fight is frozen and taps do nothing.
    pub fn skipping(&self) -> bool {
        matches!(self.tl.boss.as_ref().and_then(|b| b.mech.as_ref()), Some(Mech::Hit { ph: Ph::Skip, .. }))
    }

    /// Right after a skip: taps on Hit land double.
    fn opening(&self) -> bool {
        matches!(self.tl.boss.as_ref().and_then(|b| b.mech.as_ref()), Some(Mech::Hit { ph: Ph::Open, .. }))
    }

    /// Who Cell can grab: the allies you have on the planet.
    fn allies(&self) -> Vec<Ally> {
        let mut v = Vec::new();
        if self.s.lv(Upg::Partner) > 0 && self.b.fuse_until <= self.t {
            v.push(Ally::Bubbles);
        }
        if self.s.lv(Upg::Piccolo) > 0 {
            v.push(Ally::Piccolo);
        }
        if self.s.krillin_ally && self.tl.kril.is_none() && !self.tl.date.as_ref().is_some_and(|d| d.kr) {
            v.push(Ally::Krillin);
        }
        v
    }

    /// Where an ally stands on the planet (as planet-render places him), if he's on the near side.
    pub fn ally_spot(&self, a: Ally) -> Option<(f64, f64)> {
        let c = &self.cam;
        let v = match a {
            Ally::Bubbles => ap(&c.m, self.frame3.road_pt(self.phi - 0.32)),
            Ally::Krillin => ap(&c.m, self.frame3.road_pt(self.phi - 0.5)),
            Ally::Piccolo => ap(&c.m, mul(self.frame3.cap_pt(0.6, 0.9), 1.28)),
        };
        let lift = if a == Ally::Piccolo { sin(self.t * 1.6) * 2.0 } else { 0.0 };
        (v[2] > -0.2).then(|| (c.cx + v[0] * c.r, c.cy - v[1] * c.r + c.bob + lift))
    }

    /// Where Cell holds the ally he's draining: under him, off the planet.
    pub fn held_spot(&self) -> Option<(f64, f64)> {
        let b = self.tl.boss.as_ref()?;
        Some((b.x - 2.0 * b.k, b.y + 26.0 * b.k + sin(self.t * 9.0) * 1.5))
    }

    /// Once a frame, after the beam struggle: each mechanic's clock and what it does to the fight.
    pub(crate) fn mech_step(&mut self, t: f64, dt: f64, struggling: bool) {
        let Some(b) = self.tl.boss.as_mut() else { return };
        if b.dead || t < b.go {
            return;
        }
        if !b.armed {
            b.armed = true;
            if !self.no_mechs {
                let m = self.mech_for();
                self.tl.boss.as_mut().unwrap().mech = m;
                self.tl.mech_say = [-9.0; 4];
            }
        }
        let b = self.tl.boss.as_mut().unwrap();
        let Some(m) = b.mech.as_mut() else { return };
        // a beam struggle stops the clocks, and calls off what's under way
        if struggling {
            match m {
                Mech::Frieza { next, ph, .. } | Mech::Hit { next, ph, .. } => {
                    *next = next.max(t) + dt;
                    *ph = Ph::Idle;
                }
                Mech::Cell { next, ph, .. } => {
                    *next = next.max(t) + dt;
                    *ph = Ph::Idle;
                }
                _ => {}
            }
            return;
        }
        let (max, hp) = (b.max, b.hp);
        match m.clone() {
            Mech::Frieza { next, i, ph, p0, deflected } => match ph {
                Ph::Idle if t >= next => {
                    self.set_mech(Mech::Frieza { next, i, ph: Ph::Aim, p0: t, deflected: false });
                    self.mech_say(0, "frieza takes aim — tap your fighter to deflect", 12.0);
                }
                Ph::Aim if t - p0 >= F_AIM => {
                    self.set_mech(Mech::Frieza { next, i, ph: Ph::Fire, p0: t, deflected });
                    self.stun(F_STUN);
                    self.mech_say(1, "death beam — stunned, combo lost", 8.0);
                    self.cue(Cue::Sfx("beam"));
                }
                Ph::Fire if t - p0 >= F_FIRE => {
                    self.set_mech(Mech::Frieza { next: t + F_SHOT[i as usize % 4], i: i + 1, ph: Ph::Idle, p0, deflected });
                }
                _ => {}
            },
            Mech::Cell { next, i, ph, p0, who, healed } => match ph {
                Ph::Idle if t >= next && hp < max * C_BELOW => {
                    let owned = self.allies();
                    if let Some(&who) = owned.get(i as usize % owned.len().max(1)) {
                        self.set_mech(Mech::Cell { next, i, ph: Ph::Reach, p0: t, who, healed });
                        let n = who.name();
                        self.mech_say(0, format!("cell grabs {n} — tap {n} to rescue him"), 8.0);
                    }
                }
                Ph::Reach if t - p0 >= C_REACH => self.set_mech(Mech::Cell { next, i, ph: Ph::Drain, p0: t, who, healed }),
                Ph::Drain => {
                    let room = (C_CAP - healed).max(0.0);
                    let add = (max * C_HEAL * dt).min(max * room).min((max - hp).max(Big::ZERO));
                    let full = room > 0.0 && add >= max * room;
                    self.tl.boss.as_mut().unwrap().hp = hp + add;
                    let healed = healed + (add / max).to_f64();
                    if full {
                        self.mech_say(2, "cell is full", 30.0);
                    }
                    if t - p0 >= C_DRAIN {
                        self.set_mech(Mech::Cell { next: t + C_EVERY, i: i + 1, ph: Ph::Idle, p0, who, healed });
                    } else {
                        self.set_mech(Mech::Cell { next, i, ph, p0, who, healed });
                    }
                }
                _ => {}
            },
            Mech::Buu { mut zone, reforms, reform_until, reform_t } => {
                if !zone && hp <= max * B_ZONE {
                    zone = true;
                    self.mech_say(0, "kid buu regenerates — finish him with a big hit", 30.0);
                }
                if zone && reforms < B_REFORMS && t >= reform_until && hp < max * B_ZONE {
                    self.tl.boss.as_mut().unwrap().hp = (hp + max * B_REGEN * dt).min(max * B_ZONE);
                }
                self.set_mech(Mech::Buu { zone, reforms, reform_until, reform_t });
            }
            Mech::Hit { next, i, ph, p0 } => match ph {
                Ph::Idle if t >= next => self.set_mech(Mech::Hit { next, i, ph: Ph::Glint, p0: t }),
                Ph::Glint if t - p0 >= H_GLINT => {
                    self.set_mech(Mech::Hit { next, i, ph: Ph::Skip, p0: t });
                    self.mech_say(0, "hit skips time — strike right after", 10.0);
                }
                Ph::Skip if t - p0 >= H_SKIP => self.set_mech(Mech::Hit { next, i, ph: Ph::Open, p0: t }),
                Ph::Open if t - p0 >= H_OPEN => self.set_mech(Mech::Hit { next: t + H_GAP[i as usize % 4], i: i + 1, ph: Ph::Idle, p0 }),
                _ => {}
            },
            Mech::Jiren { refl, stag } => {
                if refl.is_some_and(|r| t - r.0 >= J_BACK) {
                    self.set_mech(Mech::Jiren { refl: None, stag });
                    self.stun(J_STUN);
                    self.mech_say(0, "jiren swats weak beams back — fully charge", 10.0);
                }
            }
        }
    }

    fn set_mech(&mut self, m: Mech) {
        if let Some(b) = self.tl.boss.as_mut() {
            b.mech = Some(m);
        }
    }

    /// A tap during a mechanic, after the saibaman's cling: a deflect, or a rescue. True if it took the tap.
    pub(crate) fn mech_tap(&mut self, px: f64, py: f64) -> bool {
        let t = self.t;
        let Some(b) = self.tl.boss.as_ref().filter(|b| !b.dead) else { return false };
        let (max, arm) = (b.max, 1.0 + 0.5 * self.s.lvf(Upg::Armor));
        match b.mech.clone() {
            Some(Mech::Frieza { next, i, ph: Ph::Aim, .. }) => {
                let k = self.kid_screen(12.0);
                if hypot(&[px - k.x, py - k.y]) >= 16.0 {
                    return false;
                }
                self.set_mech(Mech::Frieza { next, i, ph: Ph::Fire, p0: t, deflected: true });
                let b = self.tl.boss.as_ref().unwrap();
                let (bx, by) = (b.x, b.y - b.spr().h / 2.0 * b.k);
                self.hit_boss(max * F_BACK / arm, bx, by, false);
                self.cue(Cue::Sfx("beam"));
                self.burst_at(k.x, k.y, &[0xffffff, 0xffc0ec, 0xd84aa8], 10, 110.0);
                self.mech_say(1, "deflected — frieza eats his own death beam", 8.0);
                true
            }
            Some(Mech::Cell { i, ph: ph @ (Ph::Reach | Ph::Drain), p0, who, healed, .. }) => {
                let at = if ph == Ph::Reach { self.ally_spot(who) } else { self.held_spot() };
                let Some((x, y)) = at.filter(|&(x, y)| hypot(&[px - x, py - (y - 8.0)]) < 14.0) else { return false };
                self.set_mech(Mech::Cell { next: t + C_EVERY + C_PUSH, i: i + 1, ph: Ph::Idle, p0, who, healed });
                let b = self.tl.boss.as_ref().unwrap();
                let (bx, by) = (b.x, b.y - b.spr().h / 2.0 * b.k);
                self.hit_boss(max * C_HIT / arm, bx, by, false);
                self.burst_at(x, y - 8.0, &[0xffffff, 0xffe066, 0x6cc94e], 12, 110.0);
                self.mech_say(1, format!("{} breaks free and smacks cell", who.name()), 6.0);
                true
            }
            _ => false,
        }
    }

    /// What a mechanic does to a hit on the boss before it lands: Buu reforms from small hits and goes down to a big
    /// one once he's low. Returns the damage to apply (0 for none).
    pub(crate) fn mech_hit(&mut self, dmg: Big, big: bool) -> Big {
        let t = self.t;
        let arm = 1.0 + 0.5 * self.s.lvf(Upg::Armor);
        let Some(b) = self.tl.boss.as_mut() else { return dmg };
        let (hp, max) = (b.hp, b.max);
        let Some(Mech::Buu { zone, reforms, reform_until, .. }) = b.mech.as_mut() else { return dmg };
        if t < *reform_until {
            return Big::ZERO;
        }
        let after = hp - dmg * arm;
        if *reforms >= B_REFORMS || after > max * B_ZONE {
            return dmg;
        }
        if big {
            // he's low, and this one is big enough: it finishes him
            return hp / arm + 1.0;
        }
        if after <= 0.0 {
            *zone = true;
            *reforms += 1;
            *reform_until = t + B_REFORM_T;
            let n = *reforms;
            if let Some(Mech::Buu { reform_t, .. }) = b.mech.as_mut() {
                *reform_t = t;
            }
            b.hp = max * B_REFORM;
            let (x, y) = (b.x, b.y - b.spr().h / 2.0 * b.k);
            self.burst_at(x, y, &[0xffffff, 0xffc0dc, 0xf28ab8, 0xff4aa0], 20, 150.0);
            if n >= B_REFORMS {
                self.mech_say(3, "buu is spent — anything finishes him now", 30.0);
            } else {
                self.mech_say(1, "kid buu reforms", 6.0);
            }
            return Big::ZERO;
        }
        dmg
    }

    /// A beam reaching Jiren: a full charge breaks through for more (the multiplier), a weaker one comes back at you
    /// (None: no damage).
    pub(crate) fn mech_beam(&mut self, c: f64) -> Option<f64> {
        let t = self.t;
        let Some(Mech::Jiren { refl, stag }) = self.tl.boss.as_mut().and_then(|b| b.mech.as_mut()) else { return Some(1.0) };
        if c >= J_FULL {
            *stag = t;
            Some(J_X)
        } else {
            *refl = Some((t, c));
            None
        }
    }

    /// A tap on the boss: nothing while you're stunned, double in Hit's opening.
    pub(crate) fn mech_tap_x(&mut self) -> f64 {
        if self.stunned() {
            self.combo = 1.0;
            0.0
        } else if self.opening() {
            H_X
        } else {
            1.0
        }
    }
}
