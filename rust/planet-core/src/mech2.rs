//! Boss mechanics, wave 2: the Ginyu Force's poses and body change, Broly's rage, and Metal Cooler's clones. As in
//! wave 1 the penalties land on active inputs only (taps, beams, big bangs): idle ki blasts, krillin's disc and income
//! are never slowed, so an idle fight takes as long as it did. Playing the mechanic pays: free crits on a pose, a hit
//! for swapping back, calm-downs, and finding the real Cooler. No gameplay random draws but the particle bursts.

use crate::big::Big;
use crate::data::{Upg, N_FIST};
use crate::floats::Float;
use crate::game::Game;
use crate::hud::Cue;
use crate::jsmath::hypot;
use crate::mech::Mech;
use crate::num::fmt_short;

/// Ginyu Force: the entrance, a spotlight each, then a group hold (10.4s in all).
pub const G_ENTER: f64 = 1.2;
pub const G_SPOT: f64 = 1.6;
pub const G_POSE: f64 = 10.4;
/// who poses when, by `GINYU` index: recoome, burter, jeice, guldo, then the captain
pub const G_ORDER: [usize; 5] = [3, 2, 1, 4, 0];
/// The body change: once, when ginyu falls under 60% (even mid-pose) or 12s after the poses; a 0.6s glow first, then
/// up to 12s.
pub const G_BELOW: f64 = 0.6;
pub const G_AFTER: f64 = 12.0;
pub const G_TELL: f64 = 0.6;
pub const G_SWAP: f64 = 12.0;
/// swapping back hits ginyu for this share of his hp
pub const G_BACK: f64 = 0.2;
/// what the swap's wrong taps can take off you, in seconds of rate
pub const G_LOSS: f64 = 10.0;
/// the ginyu force's first toast slot (`mech_say`): a boss's mechanic, up at the same time, has the ones below
pub const G_SAY: usize = 4;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum GPh {
    Pose,
    Fight,
    Tell,
    Swap,
    Over,
}

/// The ginyu force's mechanic (not the androids'). `rude`: the last rude crit (when, on whom); `back`: when you
/// swapped back; `lost`: what the swap's wrong taps took.
#[derive(Clone, Debug)]
pub struct GinyuMech {
    pub ph: GPh,
    pub p0: f64,
    pub lost: Big,
    pub rude: (f64, usize),
    pub back: f64,
}

/// Broly: rage starts 2s in and fills over 30s; your taps, beams and big bangs land ×(1 − r/2).
pub const R_START: f64 = 2.0;
pub const R_RAMP: f64 = 30.0;
pub const R_CUT: f64 = 0.5;
/// a full beam or a big bang takes this off his rage, at most once every `R_GAP`
pub const R_CALM: f64 = 0.15;
pub const R_GAP: f64 = 3.0;
/// he switches to the raging sprite from here, and grows to ×1.4 at full rage
pub const R_FORM: f64 = 0.5;
pub const R_GROW: f64 = 0.4;

/// Metal Cooler: two clones to start, two more from each that breaks, while fewer than 8 stand and 14 have come.
pub const M_START: u32 = 2;
pub const M_ALIVE: usize = 8;
pub const M_TOTAL: u32 = 14;
/// a clone's hp: 4% of the core's (at least 3s of rate)
pub const M_HP: f64 = 0.04;
pub const M_SLOTS: usize = 9;
pub const M_FADE: f64 = 0.4;

#[derive(Clone, Debug)]
pub struct MClone {
    pub hp: Big,
    pub max: Big,
    pub t0: f64,
    /// when it broke (0 while it stands)
    pub died: f64,
    /// written by the renderer
    pub x: Option<f64>,
    pub y: f64,
    pub k: f64,
    pub flash: f64,
}

impl MClone {
    pub fn dead(&self) -> bool {
        self.died != 0.0
    }
}

/// The clones round the movie villain (the core). `shuffles`: how often they've swapped places.
#[derive(Clone, Debug, Default)]
pub struct Metal {
    pub clones: Vec<MClone>,
    pub spawned: u32,
    pub shuffles: u32,
}

impl Metal {
    /// The slot (0 is the usual boss spot) of the `rank`th metal cooler standing, the core first.
    pub fn slot(&self, rank: usize) -> usize {
        (rank * 5 + self.shuffles as usize * 3) % M_SLOTS
    }

    pub fn alive(&self) -> usize {
        self.clones.iter().filter(|c| !c.dead()).count()
    }

    /// Each standing clone's slot, by clone index.
    pub fn clone_slots(&self) -> Vec<Option<usize>> {
        let mut rank = 0;
        self.clones
            .iter()
            .map(|c| {
                (!c.dead()).then(|| {
                    rank += 1;
                    self.slot(rank)
                })
            })
            .collect()
    }
}

/// Who holds the spotlight `e` seconds into the poses (none in the entrance and the group hold).
pub fn spotlit(e: f64) -> Option<usize> {
    if e < G_ENTER {
        return None;
    }
    G_ORDER.get(((e - G_ENTER) / G_SPOT).floor() as usize).copied()
}

impl Game {
    fn gmech(&self) -> Option<&GinyuMech> {
        self.tl.ginyu.as_ref().filter(|g| g.done == 0.0).and_then(|g| g.mech.as_ref())
    }

    /// The ginyu force is posing: a tap on a member is a free crit.
    pub fn posing(&self) -> bool {
        self.gmech().is_some_and(|m| m.ph == GPh::Pose)
    }

    /// Ginyu has your body: tap yourself to swap back, anything else costs you.
    pub fn swapped(&self) -> bool {
        self.gmech().is_some_and(|m| m.ph == GPh::Swap)
    }

    /// A new ginyu force (not the androids) brings its mechanic, unless the sims turned them off.
    pub(crate) fn ginyu_arm(&mut self) {
        if self.no_mechs {
            return;
        }
        let t = self.t;
        if let Some(g) = self.tl.ginyu.as_mut().filter(|g| !g.androids) {
            g.mech = Some(GinyuMech { ph: GPh::Pose, p0: t, lost: Big::ZERO, rude: (-9.0, 0), back: -9.0 });
            self.tl.mech_say[G_SAY..].fill(-9.0);
        }
    }

    /// Once a frame, after the ginyu force's timers.
    pub(crate) fn ginyu_step(&mut self, t: f64) {
        let Some(g) = self.tl.ginyu.as_ref() else { return };
        let Some(m) = g.mech.clone() else { return };
        let gm = &g.members[0];
        let (low, down) = (gm.hp < gm.max * G_BELOW, gm.dead);
        let next = match m.ph {
            _ if g.done != 0.0 => Some((GPh::Over, m.p0)),
            // a beating cuts his poses short
            GPh::Pose if low && !down => Some((GPh::Tell, t)),
            GPh::Pose if t - g.t0 >= G_POSE => Some((GPh::Fight, t)),
            GPh::Fight | GPh::Tell if down => Some((GPh::Over, m.p0)),
            GPh::Fight if low || t - m.p0 >= G_AFTER => Some((GPh::Tell, t)),
            GPh::Tell if t - m.p0 >= G_TELL => {
                self.mech_say(G_SAY + 1, "ginyu took your body — tap yourself to swap back", 10.0);
                self.cue(Cue::Sfx("beam"));
                Some((GPh::Swap, t))
            }
            GPh::Swap if down || t - m.p0 >= G_SWAP => {
                self.mech_say(G_SAY + 2, "the change wears off", 10.0);
                Some((GPh::Over, m.p0))
            }
            _ => None,
        };
        if let Some((ph, p0)) = next {
            let m = self.tl.ginyu.as_mut().unwrap().mech.as_mut().unwrap();
            (m.ph, m.p0) = (ph, p0);
        }
    }

    /// A tap while ginyu has your body, before anything else gets it: on yourself it swaps back (and ginyu, dizzy in
    /// his own body, takes a crit); anywhere else it costs you that tap's value. True if it took the tap.
    pub(crate) fn ginyu_tap(&mut self, px: f64, py: f64) -> bool {
        if !self.swapped() {
            return false;
        }
        let t = self.t;
        let k = self.kid_screen(12.0);
        if hypot(&[px - k.x, py - k.y]) < 16.0 {
            let g = self.tl.ginyu.as_mut().unwrap();
            let m = g.mech.as_mut().unwrap();
            (m.ph, m.back) = (GPh::Over, t);
            let gm = &g.members[0];
            let (max, x, y) = (gm.max, gm.x, gm.y - gm.spr.h / 2.0 * gm.k);
            let arm = 1.0 + 0.5 * self.s.lvf(Upg::Armor);
            self.ginyu_hit(0, max * G_BACK / arm);
            self.floats.push(Float { x, y: y - 10.0, s: fmt_short((max * G_BACK).round()), life: 1.2, gold: true, red: false });
            self.burst_at(k.x, k.y, &[0xffffff, 0xbfe9ff, 0xc8a0ff, 0x9a6ad8], 16, 120.0);
            self.cue(Cue::Sfx("hit"));
            self.mech_say(G_SAY + 2, "you're back — ginyu is dizzy", 6.0);
            return true;
        }
        // the tap hurts you: its training is lost (capped a swap, and never below your form's mark)
        self.combo = 1.0;
        self.last_click = t;
        let n = (1.0 + self.s.lvf(Upg::Boots) * self.ms(Upg::Boots)) * self.mult(false) * (1.0 + 0.5 * self.lvl(N_FIST));
        let lost = self.gmech().unwrap().lost;
        let floor = Big::from(self.forms[self.s.form].at);
        let take = n.round().min((self.wrate() * G_LOSS - lost).max(Big::ZERO)).min((self.s.pl - floor).max(Big::ZERO));
        if take > 0.0 {
            self.s.pl -= take;
            self.tl.ginyu.as_mut().unwrap().mech.as_mut().unwrap().lost = lost + take;
            let k = self.kid_screen(14.0);
            self.floats.push(Float { x: k.x, y: k.y - 10.0, s: format!("-{}", fmt_short(take)), life: 1.0, gold: false, red: true });
        }
        self.cue(Cue::Sfx("tap"));
        true
    }

    /// A tap on a member mid-pose is rude: a free crit. Returns the tap's multiplier.
    pub(crate) fn ginyu_rude(&mut self, mi: usize) -> f64 {
        if !self.posing() {
            return 1.0;
        }
        let t = self.t;
        self.tl.ginyu.as_mut().unwrap().mech.as_mut().unwrap().rude = (t, mi);
        self.crit_hit()
    }

    /// After a rude crit lands: the gold number and gold spikes at the member.
    pub(crate) fn ginyu_rude_pop(&mut self, mi: usize, dmg: Big) {
        let g = self.tl.ginyu.as_ref().unwrap();
        let m = &g.members[mi];
        let (x, y) = (m.x, m.y - m.spr.h * m.k);
        let s = fmt_short((dmg * (1.0 + 0.5 * self.s.lvf(Upg::Armor))).round());
        self.floats.push(Float { x, y: y - 4.0, s, life: 1.0, gold: true, red: false });
        self.burst_at(x, y + 6.0, &[0xffffff, 0xffe066, 0xf2c84a], 6, 90.0);
        self.mech_say(G_SAY, "rude! a tap mid-pose is a free crit", 6.0);
    }

    /// Broly's rage now (0 to 1), if it's Broly's fight.
    pub fn rage(&self) -> Option<f64> {
        let b = self.tl.boss.as_ref()?;
        let Some(Mech::Broly { off, .. }) = b.mech else { return None };
        Some(((self.t - b.go - R_START) / R_RAMP - off).clamp(0.0, 1.0))
    }

    pub(crate) fn broly_step(&mut self) {
        let r = self.rage().unwrap_or(0.0);
        if r >= 0.2 {
            self.mech_say(0, "broly is getting angrier — beat him fast", 1e9);
        }
        if r >= 1.0 {
            self.mech_say(1, "broly is at full rage", 1e9);
        }
    }

    /// One of your hits reaches Broly: what it's worth against his rage now. `calms`: a full beam or a big bang,
    /// which then knocks his rage back.
    pub(crate) fn broly_hit(&mut self, calms: bool) -> f64 {
        let t = self.t;
        let r = self.rage().unwrap_or(0.0);
        let x = 1.0 - R_CUT * r;
        if calms && r > 0.0 {
            if let Some(Mech::Broly { off, calm }) = self.tl.boss.as_mut().and_then(|b| b.mech.as_mut()) {
                if t - *calm >= R_GAP {
                    *off += R_CALM;
                    *calm = t;
                    self.mech_say(2, "that rocked him — his rage drops", 4.0);
                }
            }
        }
        x
    }

    /// A big bang reaching the boss: what it's worth against his mechanic.
    pub(crate) fn mech_bang(&mut self) -> f64 {
        if self.rage().is_some() {
            self.broly_hit(true)
        } else {
            1.0
        }
    }

    /// Metal Cooler's opening clones (none for the sims' baseline).
    pub(crate) fn metal_start(&mut self) -> Metal {
        let mut m = Metal::default();
        if !self.no_mechs {
            for _ in 0..M_START {
                self.metal_spawn(&mut m);
            }
        }
        m
    }

    fn metal_spawn(&self, m: &mut Metal) {
        let Some(b) = self.tl.boss.as_ref() else { return };
        let hp = (b.max * M_HP).max(self.wrate() * 3.0);
        m.clones.push(MClone { hp, max: hp, t0: self.t, died: 0.0, x: None, y: 0.0, k: 1.0, flash: 0.0 });
        m.spawned += 1;
    }

    /// A hit on clone `i`. When it breaks, every metal cooler swaps places and two more step out, up to the caps.
    /// Clones pay nothing, so they can't be farmed.
    pub(crate) fn clone_hit(&mut self, i: usize, dmg: Big) {
        let t = self.t;
        let arm = 1.0 + 0.5 * self.s.lvf(Upg::Armor);
        let Some(mut m) = self.tl.movie.as_mut().and_then(|mv| mv.metal.take()) else { return };
        let c = &mut m.clones[i];
        if c.dead() {
            self.tl.movie.as_mut().unwrap().metal = Some(m);
            return;
        }
        c.hp -= dmg * arm;
        c.flash = 0.12;
        let at = c.x.map(|x| (x, c.y - 12.0 * c.k));
        self.burst_seen(at, &[0xffffff, 0xdfe6f0, 0x8a96b0], 4, 60.0);
        if m.clones[i].hp <= 0.0 {
            m.clones[i].died = t;
            self.burst_seen(at, &[0xffffff, 0xdfe6f0, 0x8a96b0, 0x5a6478], 14, 150.0);
            m.shuffles += 1;
            for _ in 0..2 {
                if m.alive() < M_ALIVE && m.spawned < M_TOTAL {
                    self.metal_spawn(&mut m);
                }
            }
            if m.spawned >= M_TOTAL {
                self.mech_say(1, "no more spares — the clones are done", 1e9);
            }
            self.cue(Cue::Sfx("hit"));
        }
        self.tl.movie.as_mut().unwrap().metal = Some(m);
    }

    /// The spirit bomb, or the fight's end: every clone breaks, and none step out.
    pub(crate) fn clones_wipe(&mut self) {
        let t = self.t;
        let Some(m) = self.tl.movie.as_mut().and_then(|mv| mv.metal.as_mut()) else { return };
        let at: Vec<Option<(f64, f64)>> = m.clones.iter().filter(|c| !c.dead()).map(|c| c.x.map(|x| (x, c.y - 12.0 * c.k))).collect();
        for c in m.clones.iter_mut().filter(|c| !c.dead()) {
            c.died = t;
        }
        for a in at {
            self.burst_seen(a, &[0xffffff, 0xdfe6f0, 0x8a96b0, 0x5a6478], 14, 150.0);
        }
    }

    /// The standing clone a tap at (px, py) lands on.
    pub(crate) fn clone_at(&self, px: f64, py: f64) -> Option<usize> {
        let (sw, sh) = (crate::data::movie_dim("cooler").w, crate::data::movie_dim("cooler").h);
        let m = self.tl.movie.as_ref()?.metal.as_ref()?;
        m.clones.iter().position(|c| !c.dead() && c.x.is_some_and(|x| (px - x).abs() < (sw / 2.0 + 2.0) * c.k && py > c.y - (sh + 2.0) * c.k && py < c.y + 3.0))
    }
}
