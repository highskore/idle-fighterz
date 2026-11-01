//! Stage 3: the `frame()` timeline. Pods, orbs, meteors, the nimbus and the planet's visitors; trips and snake way;
//! the moon and the great ape; senzu beans and the dragon; sagas, raids, movies, the tournament and the multiverse.
//! Statements follow game.js in order, short-circuits included (a timer only counts down when the line reaches it),
//! and every `Math.random()` game.js draws is drawn here too, cosmetic particles included (burned with `Lcg::skip`).
//!
//! Screen positions game.js writes while drawing (`sx`/`sy`, a boss's `x`/`y`, `piccoloAt`, `monkeyAt`) start unset,
//! as they do in a headless game.js; the renderer fills them in.

#![allow(clippy::approx_constant)] // game.js turns by 6.28 and laps by 6.283, not by τ

use crate::big::Big;
use crate::data::*;
use crate::fx::Particle;
use crate::game::{Game, WishBuff};
use crate::geom::{self, Spot, V3};
use crate::hud::Cue;
use crate::jsmath::{atan2, cos, hypot, sin};
use crate::num::{big_string, fixed1, fmt_short, js_round, to_fixed};

/// A screen spot the renderer writes back (game.js's `sx`/`sy`); unset in a headless game.
pub type Seen = Option<(f64, f64)>;

#[derive(Clone, Debug)]
pub struct Star {
    pub x: f64,
    pub y: f64,
    pub vx: f64,
}

#[derive(Clone, Debug)]
pub struct Orb {
    pub phi: f64,
    pub star: bool,
    pub done: bool,
}

#[derive(Clone, Debug)]
pub struct Meteor {
    pub x: f64,
    pub y: f64,
    pub vx: f64,
    pub vy: f64,
    pub delay: f64,
    pub dead: bool,
    /// its spin seed, drawn by the renderer the first time it draws the meteor
    pub sd: Option<f64>,
}

#[derive(Clone, Debug)]
pub struct Greg {
    pub c: V3,
    pub from: Option<V3>,
    pub hop_t: f64,
    pub until: f64,
    pub hop: f64,
    pub sx: Seen,
}

/// Beerus asleep on his planet: tapping and beams make noise; `awake` is when he woke (0 asleep).
#[derive(Clone, Debug)]
pub struct Beerus {
    pub c: V3,
    pub noise: f64,
    pub awake: f64,
}

/// An npc standing on the planet for a while: pudding, satan, zeno, king kai, the time chamber door, a senzu bean.
#[derive(Clone, Debug, Default)]
pub struct Npc {
    pub c: V3,
    pub t0: f64,
    pub until: f64,
    pub sx: Seen,
    /// king kai: laughed; roshi: when he went max power (0 not yet)
    pub flag: f64,
    /// roshi: when his kamehameha fired
    pub n: f64,
    /// satan: his prize
    pub prize: Big,
}

#[derive(Clone, Debug)]
pub struct Krillin {
    pub c: V3,
    pub t0: f64,
    pub boom: f64,
    pub dead: f64,
    pub sx: Seen,
}

#[derive(Clone, Debug)]
pub struct Member {
    pub name: &'static str,
    pub spr: Dim,
    pub hp: Big,
    pub max: Big,
    pub i: usize,
    pub x: f64,
    pub y: f64,
    pub k: f64,
    pub dead: bool,
    /// the white flash of a hit, run down by the renderer
    pub flash: f64,
}

/// The ginyu force, or androids 17 and 18.
#[derive(Clone, Debug)]
pub struct Ginyu {
    pub androids: bool,
    pub members: Vec<Member>,
    pub max: Big,
    pub t0: f64,
    pub until: f64,
    pub next_ki: f64,
    pub done: f64,
    /// the poses and the body change (mech2.rs); none for the androids
    pub mech: Option<crate::mech2::GinyuMech>,
}

#[derive(Clone, Debug)]
pub struct Date {
    pub c: V3,
    pub c2: V3,
    pub t0: f64,
    pub until: f64,
    pub kr: bool,
    pub paid: bool,
    pub sx2: Seen,
}

#[derive(Clone, Debug)]
pub struct Gero {
    pub name: &'static str,
    pub spr: Dim,
    pub x: f64,
    pub y: f64,
    pub t0: f64,
    pub drained: Big,
}

#[derive(Clone, Debug)]
pub struct Bird {
    pub i: usize,
    pub free: f64,
    pub kind: u32,
    pub sx: Seen,
}

#[derive(Clone, Debug)]
pub struct A16 {
    pub c: V3,
    pub t0: f64,
    pub until: f64,
    pub birds: Vec<Bird>,
}

#[derive(Clone, Debug)]
pub struct Gadget {
    pub c: V3,
    pub t0: f64,
    pub kind: u32,
    pub sx: Seen,
}

#[derive(Clone, Debug)]
pub struct Ship {
    pub c: V3,
    pub t0: f64,
    pub until: f64,
    pub out: u32,
    pub ko: u32,
    pub next: f64,
    pub left: f64,
}

#[derive(Clone, Debug)]
pub struct Saiba {
    pub c: V3,
    pub born: f64,
    pub life: f64,
    pub soldier: bool,
    pub dead: bool,
    pub sx: Seen,
}

#[derive(Clone, Debug)]
pub struct Yamcha {
    pub c: V3,
    pub boom: f64,
    pub until: f64,
    pub helped: bool,
    pub sx: Seen,
}

#[derive(Clone, Debug)]
pub struct Dance {
    pub who: &'static str,
    pub res: &'static str,
    pub t0: f64,
    pub beats: [f64; 3],
    pub i: usize,
    pub hits: u32,
    pub ok: f64,
    pub done: f64,
    pub spoil: Option<usize>,
}

#[derive(Clone, Debug)]
pub struct Car {
    pub phi: f64,
    pub until: f64,
    pub sx: Seen,
}

#[derive(Clone, Debug)]
pub struct Tour {
    pub t0: f64,
    pub until: f64,
    pub ko: u32,
    pub next: f64,
    pub villain: bool,
}

#[derive(Clone, Debug)]
pub struct Boss {
    /// identity, so a movie can tell its villain from the next boss
    pub id: u32,
    pub name: String,
    /// the takes a tournament fighter switches between; one for everyone else
    pub sprs: Vec<Dim>,
    pub p: usize,
    pub hp: Big,
    pub max: Big,
    pub t0: f64,
    pub until: f64,
    pub x: f64,
    pub y: f64,
    pub k: f64,
    pub next_ki: f64,
    pub next_disc: Option<f64>,
    pub saga: bool,
    pub uni: bool,
    pub tag: String,
    pub movie: bool,
    pub struggled: bool,
    pub dead: bool,
    pub fled: bool,
    pub t1: f64,
    pub hit_t: Option<f64>,
    pub pow: bool,
    /// the white flash of a hit, run down by the renderer
    pub flash: f64,
    /// when the fight starts: his ki blasts and the bosses' mechanics wait for it (a saga boss's arrival holds it back)
    pub go: f64,
    /// a saga boss's arrival behind the scouter (intro.rs)
    pub intro: Option<crate::intro::Intro>,
    /// his mechanic (mech.rs), set when the fight starts
    pub mech: Option<crate::mech::Mech>,
    pub armed: bool,
}

impl Boss {
    pub(crate) fn new(id: u32, name: String, spr: Dim, hp: Big, t: f64, until: f64) -> Self {
        Boss {
            id,
            name,
            sprs: vec![spr],
            p: 0,
            hp,
            max: hp,
            t0: t,
            until,
            x: 0.0,
            y: 0.0,
            k: 1.0,
            next_ki: 1.0,
            next_disc: None,
            saga: false,
            uni: false,
            tag: String::new(),
            movie: false,
            struggled: false,
            dead: false,
            fled: false,
            t1: 0.0,
            hit_t: None,
            pow: false,
            flash: 0.0,
            go: t,
            intro: None,
            mech: None,
            armed: false,
        }
    }

    pub fn spr(&self) -> Dim {
        self.sprs[self.p]
    }
}

#[derive(Clone, Debug)]
pub struct Storm {
    pub until: f64,
    pub next: f64,
    pub hit: u32,
}

#[derive(Clone, Debug)]
pub struct Struggle {
    pub t0: f64,
    pub until: f64,
    pub p: f64,
}

/// A ki blast from the hero's hands, homing on the boss (or a ginyu member, by index).
#[derive(Clone, Debug)]
pub struct Ki {
    pub x: f64,
    pub y: f64,
    pub t0: f64,
    pub m: Option<usize>,
    pub disc: bool,
    pub done: bool,
}

#[derive(Clone, Debug)]
pub struct Moon {
    pub x: f64,
    pub y: f64,
    pub r: f64,
    pub a: f64,
    pub born: f64,
    pub leaving: bool,
}

#[derive(Clone, Debug)]
pub struct Capsule {
    pub x: f64,
    pub y: f64,
    pub vy: f64,
    pub t0: f64,
    pub land: f64,
}

#[derive(Clone, Debug, Default)]
pub struct Ape {
    pub cd: f64,
    pub rage: f64,
    pub giant: bool,
    pub at: f64,
    pub k: f64,
}

#[derive(Clone, Debug)]
pub struct SpiritShot {
    pub x0: f64,
    pub y0: f64,
    pub r: f64,
    pub x1: f64,
    pub y1: f64,
    pub t0: f64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Phase {
    Rise,
    Wish,
    Granting,
    Leave,
}

/// The dragon: shenron at home, porunga (three wishes) on namek.
#[derive(Clone, Debug)]
pub struct Shen {
    pub t0: f64,
    pub phase: Phase,
    pub phase_t: f64,
    pub wishes: u32,
    pub porunga: bool,
    pub t1: f64,
    /// which of shenron's four looks (`shenLook`: 'rising' unless the #shenronN hook picks one)
    pub look: usize,
    /// the offer on the table: indexes into `WISHES`
    pub offer: Vec<usize>,
    /// the offer as the wish box shows it, worded when it was made (`ui.wish`'s list)
    pub offer_json: String,
}

#[derive(Clone, Debug)]
pub struct SnakeOrb {
    pub p: f64,
    pub u: f64,
    pub s: f64,
    pub got: bool,
}

#[derive(Clone, Debug)]
pub struct Ghost {
    pub p: f64,
    pub ph: f64,
    pub u: f64,
    pub h: f64,
    pub s: f64,
    pub dead: bool,
    pub sx: Seen,
    pub r: f64,
}

#[derive(Clone, Debug)]
pub struct SkyOrb {
    pub p: f64,
    pub got: bool,
    pub miss: bool,
}

#[derive(Clone, Debug)]
pub struct Spike {
    pub s: f64,
    pub u: f64,
}

/// Snake way: the run to king kai's planet.
#[derive(Clone, Debug)]
pub struct Snake {
    pub p: f64,
    pub phi0: f64,
    pub t0: f64,
    pub done: f64,
    pub orbs: Vec<SnakeOrb>,
    pub ghosts: Vec<Ghost>,
    pub sky: Vec<SkyOrb>,
    pub gaps: Vec<(f64, f64)>,
    pub spikes: Vec<Spike>,
    pub streak: u32,
    pub streak_t: f64,
    pub got: u32,
    pub blasted: u32,
    pub dash: f64,
    pub x: f64,
    pub spin: f64,
    pub hx: f64,
    pub hy: f64,
    /// his height on screen as last drawn: the streak tag sits over it
    pub sh: f64,
    /// ki blasts at lost souls, (x, y, t0); the renderer draws and drops them
    pub shots: Vec<(f64, f64, f64)>,
}

#[derive(Clone, Debug)]
pub struct Henchman {
    pub name: &'static str,
    pub spr: Dim,
    pub hp: Big,
    pub max: Big,
    pub twin: bool,
    pub dead: bool,
    /// written by the renderer
    pub x: Option<f64>,
    pub y: f64,
    pub k: f64,
    /// the white flash of a hit, run down by the renderer
    pub flash: f64,
}

#[derive(Clone, Debug)]
pub struct Movie {
    pub o: &'static MovieDef,
    pub boss: u32,
    pub t0: f64,
    pub minions: Vec<Henchman>,
    pub twin: Option<usize>,
    pub next_say: f64,
    pub flip_until: f64,
    pub flips: u32,
    /// bujin's psychic web: (t0, hits)
    pub web: Option<(f64, u32)>,
    pub next_web: f64,
    pub nova: Option<(f64, f64)>,
    pub over: f64,
    /// the jelly wobble: every row of the screen sways until then (the renderer's)
    pub wob: f64,
    /// Metal Cooler's clones (mech2.rs), on every other visit of cooler's
    pub metal: Option<crate::mech2::Metal>,
}

/// State game.js changes from `setTimeout`, due at a time.
#[derive(Clone, Debug, PartialEq)]
pub enum Later {
    Summon,
    NextWish,
    /// a toast that waits (game.js `setTimeout(() => ui.event(text, ms), …)`)
    Event(String, f64),
    /// snake way's tip, if he's still on it
    SnakeTip,
    /// the `#buffs` preview hook: two minutes of every timed buff
    Buffs,
    /// the `#itx` preview hook: the transmission picker opens, once playing (it asks again every 0.5s)
    ItxPicker,
    /// the `#scaleN` preview hook: a full beam (or with `bang`, a big bang) at the boss or the sky, every 6s
    Wave(bool),
}

/// The timeline's runtime state: `mount()`'s closure variables that frame() reads and writes.
#[derive(Clone, Debug)]
pub struct Tl {
    /// a boss mechanic's stun: taps on him, beams and big bangs do nothing (idle ki and income go on)
    pub stun_until: f64,
    /// when each mechanic toast may come again
    pub mech_say: [f64; 7],
    pub star: Option<Star>,
    pub next_star: f64,
    pub orbs: Vec<Orb>,
    pub meteors: Vec<Meteor>,
    pub next_shower: f64,
    pub next_cloud: f64,
    pub cloud_fly: Option<(f64, f64)>,
    pub aura: bool,
    pub greg: Option<Greg>,
    pub next_greg: f64,
    pub bz: Option<Beerus>,
    pub pud: Option<Npc>,
    pub roshi: Option<Npc>,
    pub next_roshi: f64,
    pub kril: Option<Krillin>,
    pub next_kril: f64,
    pub satan: Option<Npc>,
    pub kai: Option<Npc>,
    pub next_kai: f64,
    pub ginyu: Option<Ginyu>,
    pub next_ginyu: f64,
    pub next_andro: f64,
    pub date: Option<Date>,
    pub next_date: f64,
    pub gero: Option<Gero>,
    pub next_gero: f64,
    pub a16: Option<A16>,
    pub next_a16: f64,
    pub gadgets: Vec<Gadget>,
    pub next_gadget: f64,
    pub robot_acc: f64,
    pub ship: Option<Ship>,
    pub next_ship: f64,
    pub yam: Option<Yamcha>,
    pub next_yam: f64,
    pub dance: Option<Dance>,
    pub next_dance: f64,
    /// the fusion dance's result, by its baked sprite name (`FUSED.fat` has four frames)
    pub fused_look: &'static str,
    pub cling: Option<f64>,
    pub next_cling: f64,
    pub car: Option<Car>,
    pub next_car: f64,
    pub door: Option<Npc>,
    pub next_door: f64,
    pub chamber_t0: f64,
    pub next_zap: f64,
    /// piccolo's zap: from (x0, y0) to (x1, y1), at t0; the renderer draws it and lets it go
    pub zap: Option<(f64, f64, f64, f64, f64)>,
    pub saibas: Vec<Saiba>,
    pub next_saiba: f64,
    pub pod_wish: u32,
    pub home_since: f64,
    pub namek_until: f64,
    pub fuse_offer: f64,
    pub next_fuse: f64,
    pub tour: Option<Tour>,
    pub next_tour: f64,
    pub movie: Option<Movie>,
    pub next_movie: f64,
    pub last_movie: &'static str,
    pub movie_force: &'static str,
    /// cooler's visits this run: every other one is Metal Cooler (or the `#metal` hook's next)
    pub coolers: u32,
    pub metal_force: bool,
    /// the `#broly-rage` hook: broly arrives nearly at full rage
    pub rage_force: bool,
    /// the `#struggle` preview hook (and the difftests' forced struggles): every villain fires back
    pub struggle_force: bool,
    /// the difftest harness's forced wish (an index into `WISHES`): the third of each offer while it's ok
    pub wish_force: Option<usize>,
    pub movie_note: Option<(f64, String)>,
    pub next_nappa: f64,
    pub boss: Option<Boss>,
    pub boss_ids: u32,
    pub next_boss: f64,
    pub next_saga: f64,
    pub storm: Option<Storm>,
    pub next_storm: f64,
    pub spirit: f64,
    pub spirit_ready: bool,
    pub spirit_shot: Option<SpiritShot>,
    pub struggle: Option<Struggle>,
    pub kis: Vec<Ki>,
    pub capsule: Option<Capsule>,
    pub moon: Option<Moon>,
    pub next_moon: f64,
    pub ape: Ape,
    pub bean: Option<Npc>,
    pub next_bean: f64,
    pub zen: Option<Npc>,
    pub preview: Option<(usize, f64)>,
    pub shen: Option<Shen>,
    pub summon_later: bool,
    /// `shenLook`: which look the dragon comes in (the #shenronN hook sets it)
    pub shen_look: usize,
    pub snk: Option<Snake>,
    pub jump_h: f64,
    pub jump_v: f64,
    pub whis_ready: f64,
    pub chi_ready: f64,
    pub kame_ready: f64,
    /// piccolo and bubbles where the renderer last drew them: (x, y) and (x, y, scale)
    /// the full moon's night, and how far the sea has faded to it
    pub night: bool,
    pub night_k: f64,
    pub piccolo_at: Option<(f64, f64)>,
    pub monkey_at: Option<(f64, f64, f64)>,
    /// `once()` texts already shown
    pub seen: Vec<&'static str>,
    /// instant transmission: when it's recharged, whether the trip under way was a jump (its end starts the cooldown),
    /// and the session time the last jumped trip got home (a natural trip waits `TRIP_WAIT × 0.7` after it)
    pub itx_ready: f64,
    pub itx_trip: bool,
    pub itx_back: f64,
    /// where and when the last jump left from (`itxFx`): the renderer's shimmer and pose
    pub itx_fx: Option<(Spot, f64)>,
    pub later: Vec<(f64, Later)>,
    /// the cell games (cellgames.rs): on now, the quiet seconds to the next, whether the story beat is due, how many
    pub cg: Option<crate::cellgames::CellGames>,
    pub cg_next: f64,
    pub cg_story: bool,
    pub cg_n: u32,
    /// halos on everyone after the planet went up
    pub halo_until: f64,
    /// buu's candy (candy.rs), the same way
    pub candy: Option<crate::candy::Candy>,
    pub candy_next: f64,
    pub candy_story: bool,
    pub candy_n: u32,
    /// the ramen break (ramen.rs): the one on now, the quiet seconds to the next, and how many he's had
    pub ramen: Option<crate::ramen::Ramen>,
    pub next_ramen: f64,
    pub ramens: u32,
    /// bubbles wandering the road (bubbles.rs)
    pub bub: crate::bubbles::Bub,
}

impl Default for Tl {
    fn default() -> Self {
        Tl {
            star: None,
            next_star: 14.0,
            orbs: Vec::new(),
            meteors: Vec::new(),
            next_shower: 55.0,
            next_cloud: 85.0,
            cloud_fly: None,
            aura: false,
            greg: None,
            next_greg: 70.0,
            bz: None,
            pud: None,
            roshi: None,
            next_roshi: 200.0,
            kril: None,
            next_kril: 260.0,
            satan: None,
            kai: None,
            next_kai: 50.0,
            ginyu: None,
            next_ginyu: 160.0,
            next_andro: 340.0,
            date: None,
            next_date: 300.0,
            gero: None,
            next_gero: 230.0,
            a16: None,
            next_a16: 180.0,
            gadgets: Vec::new(),
            next_gadget: 2.0,
            robot_acc: 0.0,
            ship: None,
            next_ship: 200.0,
            yam: None,
            next_yam: 130.0,
            dance: None,
            next_dance: 300.0,
            fused_look: "",
            cling: None,
            next_cling: 200.0,
            car: None,
            next_car: 140.0,
            door: None,
            next_door: 60.0,
            chamber_t0: 0.0,
            next_zap: 4.0,
            zap: None,
            saibas: Vec::new(),
            next_saiba: 40.0,
            pod_wish: 0,
            home_since: 0.0,
            namek_until: 0.0,
            fuse_offer: 0.0,
            next_fuse: 150.0,
            tour: None,
            next_tour: 45.0,
            movie: None,
            next_movie: 480.0,
            last_movie: "",
            movie_force: "",
            coolers: 0,
            metal_force: false,
            rage_force: false,
            struggle_force: false,
            wish_force: None,
            movie_note: None,
            next_nappa: 0.0,
            boss: None,
            boss_ids: 0,
            next_boss: 120.0,
            next_saga: 60.0,
            storm: None,
            next_storm: 240.0,
            spirit: 0.0,
            spirit_ready: false,
            spirit_shot: None,
            struggle: None,
            kis: Vec::new(),
            capsule: None,
            moon: None,
            next_moon: 150.0,
            ape: Ape { k: 2.3, ..Default::default() },
            bean: None,
            next_bean: 30.0,
            zen: None,
            preview: None,
            shen: None,
            summon_later: false,
            shen_look: 1,
            snk: None,
            jump_h: 0.0,
            jump_v: 0.0,
            whis_ready: 0.0,
            chi_ready: 0.0,
            kame_ready: 0.0,
            night: false,
            night_k: 0.0,
            piccolo_at: None,
            monkey_at: None,
            seen: Vec::new(),
            stun_until: 0.0,
            mech_say: [-9.0; 7],
            itx_ready: 0.0,
            itx_trip: false,
            itx_back: f64::NEG_INFINITY,
            itx_fx: None,
            later: Vec::new(),
            cg: None,
            cg_next: 0.0,
            cg_story: false,
            cg_n: 0,
            halo_until: 0.0,
            candy: None,
            candy_next: 0.0,
            candy_story: false,
            candy_n: 0,
            ramen: None,
            next_ramen: crate::ramen::RAMEN_FIRST,
            ramens: 0,
            bub: Default::default(),
        }
    }
}

/// `(x -= dt) < 0`: a countdown that only ticks when the condition chain reaches it.
fn tick(x: &mut f64, dt: f64) -> bool {
    *x -= dt;
    *x < 0.0
}

const SN_LAPS: f64 = 4.0;
const END: f64 = 400.0;
const BEAT: f64 = 3.6;

fn bend_at(s: f64) -> f64 {
    1.25 * sin(s * 0.045) + 0.6 * sin(s * 0.017 + 1.0)
}

fn bend_s(s: f64) -> f64 {
    bend_at(s) * 1f64.min(0f64.max((END - 10.0 - s) / 40.0))
}

impl Game {
    pub(crate) fn r(&mut self) -> f64 {
        self.rng.random()
    }

    /// n particles flying apart from (x, y) at up to `sp`: two draws each.
    #[allow(clippy::too_many_arguments)]
    pub(crate) fn spray(&mut self, x: f64, y: f64, c: &[u32], n: u32, sp: f64, drag: f64, life: f64) {
        for _ in 0..n {
            let vx = (self.rng.random() - 0.5) * sp;
            let vy = (self.rng.random() - 0.5) * sp;
            self.fx.push(Particle::new(x, y, c).v(vx, vy).drag(drag).life(life));
        }
    }

    /// `burst(x, y, c, n, sp)`: n particles flying apart from (x, y).
    pub(crate) fn burst_at(&mut self, x: f64, y: f64, c: &[u32], n: u32, sp: f64) {
        self.spray(x, y, c, n, sp, 2.5, 0.6);
    }

    /// `burst` at a spot only the drawing places: unplaced (headless) it spends the draws on particles nothing sees.
    pub(crate) fn burst_seen(&mut self, at: Option<(f64, f64)>, c: &[u32], n: u32, sp: f64) {
        match at {
            Some((x, y)) => self.burst_at(x, y, c, n, sp),
            None => self.rng.skip(2 * n),
        }
    }

    pub(crate) fn once(&mut self, key: &'static str, text: &str) {
        if self.tl.seen.contains(&key) {
            return;
        }
        self.tl.seen.push(key);
        self.event(text);
    }

    pub fn home(&self) -> u32 {
        if self.s.multi {
            9
        } else {
            0
        }
    }

    pub fn boss_up(&self) -> bool {
        self.tl.boss.as_ref().is_some_and(|b| !b.dead)
    }

    pub(crate) fn after(&mut self, secs: f64, what: Later) {
        let at = self.t + secs;
        self.tl.later.push((at, what));
    }

    /// The `setTimeout`s due by `by`, in time order (the harness runs them after the frame, by its time).
    pub(crate) fn run_later(&mut self, by: f64) {
        self.tl.later.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
        while !self.tl.later.is_empty() && self.tl.later[0].0 <= by {
            let (at, what) = self.tl.later.remove(0);
            match what {
                Later::Summon => self.summon(),
                Later::Event(s, ms) => self.event_ms(s, ms),
                Later::SnakeTip => {
                    if self.playing && self.s.world == 3 && self.tl.snk.is_some() {
                        self.event_ms("he runs on his own — tap to hop for the golden orbs and to blast the lost souls", 4200.0);
                    }
                }
                Later::Buffs => {
                    let (u, b) = (self.t + 120.0, &mut self.b);
                    (b.boost_until, b.senzu_until, b.car_until, b.roshi_until, b.laugh_until, b.calm_until) = (u, u, u, u, u, u);
                    self.riding = 120.0;
                    for k in [WishBuff::Fast, WishBuff::Taps, WishBuff::Idle, WishBuff::Laps, WishBuff::Combo] {
                        self.wish_buff[k as usize] = u;
                    }
                }
                Later::ItxPicker => {
                    if self.playing {
                        self.itx_open();
                    } else {
                        // from when this one was due, as a setTimeout set inside a setTimeout counts
                        self.tl.later.push((at + 0.5, Later::ItxPicker));
                    }
                }
                Later::Wave(bang) => {
                    if self.playing {
                        let (tx, ty) = match self.tl.boss.as_ref().filter(|b| !b.dead) {
                            Some(b) => (b.x, b.y - b.spr().h / 2.0 * b.k),
                            None => (self.cam.cx + self.cam.r * 1.45, self.cam.cy - self.cam.r * 0.75),
                        };
                        if bang {
                            self.throw_bang(tx, ty);
                        } else {
                            self.fire_beam(2.5, tx, ty);
                        }
                    }
                    self.tl.later.push((at + if self.playing { 6.0 } else { 0.5 }, Later::Wave(bang)));
                }
                Later::NextWish => {
                    if let Some(sh) = &self.tl.shen {
                        let n = sh.wishes;
                        self.event(format!("{n} wish{} left", if n > 1 { "es" } else { "" }));
                        self.open_wish();
                    }
                }
            }
        }
    }

    // ── geometry

    pub fn kid_screen(&self, lift: f64) -> Spot {
        let p = self.frame3.road_pt(self.phi);
        // the lookout's road rings its bulb: standing off the bulb would hang him sideways or upside down, so he stands up
        if self.inp.w2_pole {
            let s = self.cam.screen(p, 0.0);
            return Spot { y: s.y - lift, ang: 0.0, ..s };
        }
        self.cam.screen(p, lift)
    }

    /// Where the hero's ki leaves his hands (`liftNow`/`flipNow` come from the renderer; 0 and unflipped headless).
    pub fn hand_pos(&self) -> (f64, f64) {
        let kd = self.kid_screen(0.0);
        let flip = if self.flip_now { -1.0 } else { 1.0 };
        (kd.x + sin(kd.ang) * (self.lift_now + 12.0) + cos(kd.ang) * 6.0 * flip, kd.y - cos(kd.ang) * (self.lift_now + 12.0) + sin(kd.ang) * 6.0 * flip)
    }

    fn cap_pt(&self, th: f64, a: f64) -> V3 {
        self.frame3.cap_pt(th, a)
    }

    /// A random spot on the planet: `capPt(lo + r·span, r·6.28)`.
    fn rand_cap(&mut self, lo: f64, span: f64) -> V3 {
        let th = lo + self.r() * span;
        let a = self.r() * 6.28;
        self.cap_pt(th, a)
    }

    // ── economy the timeline adds

    pub fn tap_power(&self) -> Big {
        1.0 + self.s.lvf(Upg::Boots) * self.ms(Upg::Boots) + self.passive() / 10.0
    }

    pub fn ape_len(&self) -> f64 {
        15.0 + 2.0 * self.tail_lv() + if self.tl.ape.giant { 15.0 } else { 0.0 }
    }

    fn wish_seeds(&self) -> Big {
        Big::from(WISH_SEEDS)
    }

    fn uni_time(&self) -> f64 {
        if self.ang(A_SKIP) {
            45.0
        } else {
            30.0
        }
    }

    fn finisher(&self) -> Big {
        let b = self.tl.boss.as_ref().unwrap();
        let arm = 1.0 + 0.5 * self.s.lvf(Upg::Armor);
        if b.uni {
            b.hp.min(b.max * 0.25) / arm
        } else {
            b.hp / arm + 1.0
        }
    }

    pub(crate) fn meteor_pay(&self) -> Big {
        25.0 * self.mult(false) * (1.0 + (self.laps.min(50) as f64) * 0.1)
    }

    // ── the frame's timeline, in game.js order

    /// The visitors and raids (game.js's `else` branch off snake way), from the space pod to the saibamen.
    pub(crate) fn timeline_home(&mut self, t: f64, dt: f64) {
        let session = self.session;
        let (w, h) = (self.cam.w, self.cam.h);
        // the space pod
        if session > 12.0 && self.tl.star.is_none() && tick(&mut self.tl.next_star, dt) {
            self.once("stars", "a saiyan space pod — tap it");
            self.cue(crate::hud::Cue::Notify("pod", String::new()));
            let y = if w / h < 0.8 { self.cam.cy - self.cam.r * (1.12 + self.r() * 0.16) } else { h * (0.08 + self.r() * 0.2) };
            self.tl.star = Some(Star { x: -8.0, y, vx: w / 6.0 });
            self.tl.next_star = (18.0 + self.r() * 14.0) * (1.0 - 0.12 * self.lvl(N_PODS)) * self.soon();
        }
        if session > 30.0 && self.tl.orbs.len() < 3 && self.r() < dt * 0.25 {
            self.once("orbs", "ki orbs on the road");
            let phi = self.phi + 1.5 + self.r() * 2.0;
            let star = session > 60.0 && self.r() < (if self.s.world == 1 { 0.4 } else { 0.2 }) + 0.05 * self.lvl(N_BALLS);
            self.tl.orbs.push(Orb { phi, star, done: false });
        }
        if session > 50.0 && tick(&mut self.tl.next_shower, dt) {
            self.once("meteors", "meteor shower — bust them");
            for i in 0..6 {
                let x = w * (0.15 + self.r() * 0.9);
                self.tl.meteors.push(Meteor { x, y: -10.0 - i as f64 * 18.0, vx: -w * 0.12, vy: h * 0.22, delay: i as f64 * 0.5, dead: false, sd: None });
            }
            self.tl.next_shower = 45.0 + self.r() * 20.0;
        }
        if (session > 75.0 || self.s.lv(Upg::Cloud) > 0)
            && self.tl.cloud_fly.is_none()
            && self.riding <= 0.0
            && tick(&mut self.tl.next_cloud, dt * (1.0 + self.s.lvf(Upg::Cloud) * 0.6))
        {
            self.once("cloud", "flying nimbus is here");
            self.tl.cloud_fly = Some((-30.0, h * 0.3));
            self.tl.next_cloud = (60.0 + self.r() * 25.0) * self.soon();
        }
        if session > 140.0 && !self.tl.aura {
            self.tl.aura = true;
            self.event("ki aura unlocked");
        }
        // gregory
        if self.tl.greg.is_none() && session > 60.0 && tick(&mut self.tl.next_greg, dt) {
            let c = self.rand_cap(0.2, 0.9);
            let hop = 0.3f64.max(0.75 - 0.08 * self.s.greg_wins as f64);
            self.tl.greg = Some(Greg { c, from: None, hop_t: t, until: t + 10.0, hop, sx: None });
            self.event(if self.s.greg_wins > 0 { "race gregory again — he's faster now. 10s" } else { "race gregory! catch him in 10s" });
            self.tl.next_greg = 80.0 + self.r() * 40.0;
        }
        if let Some(g) = self.tl.greg.clone() {
            if t > g.until {
                if let Some((x, y)) = g.sx {
                    self.burst_at(x, y, &[0xffffff, 0xd8a868], 8, 60.0);
                }
                self.tl.greg = None;
                self.event("gregory got away");
            } else if t - g.hop_t > g.hop {
                let d = [self.r() - 0.5, self.r() - 0.5, self.r() - 0.5];
                let mut c = geom::norm(geom::add(g.c, d, 0.45));
                if geom::dot(c, self.frame3.n) < 0.1 {
                    c = self.rand_cap(0.3, 0.6);
                }
                let gr = self.tl.greg.as_mut().unwrap();
                gr.from = Some(g.c);
                gr.c = c;
                gr.hop_t = t;
            }
        }
        if let Some(bz) = self.tl.bz.as_mut() {
            if bz.awake == 0.0 {
                bz.noise = 0f64.max(bz.noise - dt * 0.14);
                if bz.noise >= 1.0 {
                    bz.awake = t;
                    self.flash_t = 0.5;
                    self.shake = 0.8;
                    self.cue(Cue::Sfx("boss"));
                    self.event_ms("beerus is AWAKE — \"who dares?!\" everything ×0.25 until you find him pudding", 5000.0);
                    let c = self.rand_cap(0.4, 0.7);
                    self.tl.pud = Some(Npc { c, t0: t, ..Default::default() });
                }
            }
        }
        // master roshi
        if self.tl.roshi.is_none()
            && self.s.world != 6
            && session > 90.0
            && self.tl.shen.is_none()
            && self.tl.boss.is_none()
            && tick(&mut self.tl.next_roshi, dt)
        {
            let c = self.cap_pt(0.5, 5.4);
            self.tl.roshi = Some(Npc { c, t0: t, until: t + 12.0, ..Default::default() });
            self.event("master roshi wandered over — tap him");
            self.tl.next_roshi = 200.0 + self.r() * 80.0;
        }
        if let Some(ro) = self.tl.roshi.clone() {
            if ro.flag != 0.0 && ro.n == 0.0 && t - ro.flag > 1.1 {
                self.tl.roshi.as_mut().unwrap().n = t;
                self.b.roshi_until = t + 20.0;
                self.flash_t = 0.6;
                self.shake = 0.6;
                self.ach("roshi");
                self.cue(Cue::Sfx("beam"));
                self.event("kamehameha! roshi clears the sky — ×1.5 for 20s");
                for i in 0..self.tl.meteors.len() {
                    let m = &mut self.tl.meteors[i];
                    if !m.dead && m.delay <= 0.0 {
                        m.dead = true;
                        let (x, y) = (m.x, m.y);
                        self.burst_at(x, y, &[0xffffff, 0x9fdcff, 0x2f9ae0], 8, 80.0);
                    }
                }
                for i in 0..self.tl.saibas.len() {
                    if !self.tl.saibas[i].dead && self.tl.saibas[i].sx.is_some() {
                        self.kill_saiba(i);
                    }
                }
            }
            if t > self.tl.roshi.as_ref().unwrap().until {
                self.tl.roshi = None;
            }
        }
        // krillin drops by
        // (not to himself: playing krillin, he never drops by, so he's never blown up and never wished back)
        if self.tl.kril.is_none()
            && self.s.hero != Hero::Krillin
            && !self.s.krillin_dead
            && session > 130.0
            && self.tl.shen.is_none()
            && self.tl.boss.is_none()
            && self.tl.tour.is_none()
            && tick(&mut self.tl.next_kril, dt)
        {
            let c = self.cap_pt(0.38, 1.3);
            self.tl.kril = Some(Krillin { c, t0: t, boom: t + 3.2, dead: 0.0, sx: None });
            self.event(if self.s.krillin_ally { "krillin: \"don't worry guys, i've got this one!\"" } else { "krillin: \"hey guys! what did i miss?\"" });
            self.tl.next_kril = 360.0 + self.r() * 180.0;
        }
        if let Some(k) = self.tl.kril.clone() {
            if k.dead == 0.0 && t > k.boom {
                self.tl.kril.as_mut().unwrap().dead = t;
                self.s.krillin_dead = true;
                self.s.krillin_ally = false;
                self.b.rage = 2.0 + self.s.krillin_revives as f64;
                self.b.rage_until = t + 20.0;
                self.flash_t = 1.0;
                self.shake = 0.9;
                self.ach("krillin");
                self.cue(Cue::Sfx("boom"));
                let msg = format!("KRILLIN!!! — rage ×{} for 20s", self.b.rage);
                self.event_ms(msg, 4000.0);
                if let Some((sx, sy)) = k.sx {
                    for _ in 0..4 {
                        let x = sx + (self.r() - 0.5) * 14.0;
                        let y = sy - 8.0 + (self.r() - 0.5) * 14.0;
                        self.burst_at(x, y, &[0xffffff, 0xffe08a, 0xff9a3c, 0xe0473e], 24, 200.0);
                    }
                }
            }
            let k = self.tl.kril.as_ref().unwrap();
            if k.dead != 0.0 && t - k.dead > 1.0 {
                self.tl.kril = None;
            }
        }
        if self.tl.satan.as_ref().is_some_and(|s| t > s.until) {
            self.tl.satan = None;
        }
        // king kai's joke
        if self.tl.kai.is_none() && session > 45.0 && self.tl.shen.is_none() && tick(&mut self.tl.next_kai, dt) {
            let c = self.cap_pt(0.35, 3.6);
            self.tl.kai = Some(Npc { c, t0: t, until: t + 9.0, ..Default::default() });
            let pun = PUNS[(self.r() * PUNS.len() as f64).floor() as usize];
            self.event_ms(format!("king kai: {pun}"), 6000.0);
            self.tl.next_kai = 140.0 + self.r() * 40.0;
        }
        if self.tl.ginyu.is_none()
            && self.tl.tour.is_none()
            && self.tl.boss.is_none()
            && self.no_games()
            && self.tl.shen.is_none()
            && self.s.world != 8
            && session > 200.0
            && self.s.best >= 2e5
            && self.s.hero != Hero::A17
            && tick(&mut self.tl.next_andro, dt)
        {
            self.krillin_hit("the androids");
            let hp = Big::from(500.0).max(self.wrate() * 14.0);
            let members = [("android 17", A17), ("android 18", A18)]
                .iter()
                .enumerate()
                .map(|(i, &(name, spr))| Member { name, spr, hp, max: hp, i, x: 0.0, y: 0.0, k: 1.0, dead: false, flash: 0.0 })
                .collect();
            self.tl.ginyu = Some(Ginyu { androids: true, members, max: hp * 2.0, t0: t, until: t + 45.0, next_ki: 1.0, done: 0.0, mech: None });
            self.event("androids 17 and 18 drop in — \"we're just bored\"");
            self.cue(Cue::Sfx("boss"));
            self.tl.next_andro = 340.0 + self.r() * 60.0;
        }
        // android 18 drops by
        if self.tl.date.is_none()
            && self.s.hero != Hero::Krillin
            && session > 160.0
            && self.tl.shen.is_none()
            && self.s.world != 8
            && tick(&mut self.tl.next_date, dt)
        {
            let kr = !self.s.krillin_dead;
            let (c, c2) = (self.cap_pt(0.45, 0.35), self.cap_pt(0.45, 0.55));
            self.tl.date = Some(Date { c, c2, t0: t, until: t + if kr { 10.0 } else { 4.0 }, kr, paid: false, sx2: None });
            self.event(if kr { "android 18 drops by — krillin is a mess. tap him" } else { "android 18 drops by, sees no krillin, shrugs and leaves" });
            self.tl.next_date = 300.0 + self.r() * 120.0;
        }
        if self.tl.date.as_ref().is_some_and(|d| t > d.until) {
            self.tl.date = None;
        }
        // dr. gero / android 19
        if self.tl.gero.is_none() && session > 140.0 && self.tl.shen.is_none() && self.tl.boss.is_none() && self.no_games() && tick(&mut self.tl.next_gero, dt)
        {
            self.s.geros += 1;
            let odd = self.s.geros % 2 == 1;
            let (spr, name) = if odd { (A20, "dr. gero") } else { (A19, "android 19") };
            self.tl.gero = Some(Gero { name, spr, x: w + 20.0, y: h * 0.28, t0: t, drained: Big::ZERO });
            self.event(format!("{name} is absorbing your power — tap him!"));
            self.cue(Cue::Sfx("boss"));
            self.tl.next_gero = 230.0 + self.r() * 80.0;
        }
        if self.tl.gero.is_some() {
            let (hx, hy) = self.hand_pos();
            let (tx, ty) = (hx + w * 0.18, hy - h * 0.16);
            let rate = self.rate();
            let g = self.tl.gero.as_mut().unwrap();
            g.x += (tx - g.x) * 1f64.min(dt * 2.0);
            g.y += (ty - g.y) * 1f64.min(dt * 2.0);
            if t - g.t0 > 1.2 {
                let d = self.s.pl.min(rate * 3.0 * dt);
                self.s.pl -= d;
                g.drained += d;
            }
            if t - g.t0 > 15.0 {
                let msg = format!("{} got away with {} power", g.name, fmt_short(g.drained.round()));
                self.tl.gero = None;
                self.event(msg);
            }
        }
        // android 16 and the birds
        if self.tl.a16.is_none() && session > 100.0 && self.tl.shen.is_none() && tick(&mut self.tl.next_a16, dt) {
            let c = self.cap_pt(0.35, 2.2);
            let birds = (0..3).map(|i| Bird { i, free: 0.0, kind: (self.r() * 4.0) as u32, sx: None }).collect();
            self.tl.a16 = Some(A16 { c, t0: t, until: t + 16.0, birds });
            self.event("android 16 is watching the birds");
            self.tl.next_a16 = 180.0 + self.r() * 80.0;
        }
        if self.tl.a16.as_ref().is_some_and(|a| t > a.until) {
            self.tl.a16 = None;
        }
        // west city's capsules
        if self.s.world == 5 && self.tl.gadgets.len() < 3 && tick(&mut self.tl.next_gadget, dt) {
            let c = self.rand_cap(0.25, 0.8);
            let kind = (self.r() * 4.0) as u32;
            self.tl.gadgets.push(Gadget { c, t0: t, kind, sx: None });
            self.tl.next_gadget = 4.0 + self.r() * 3.0;
        }
        if self.lvl(N_AUTO) > 0.0 && self.playing {
            self.auto_acc += dt * self.lvl(N_AUTO);
            while self.auto_acc > 1.0 {
                self.auto_acc -= 1.0;
                let k = self.kid_screen(14.0);
                let n = (1.0 + self.s.lvf(Upg::Boots) * self.ms(Upg::Boots)) * self.mult(false) * (1.0 + 0.5 * self.lvl(N_FIST));
                self.gain_at(n, k.x, k.y - 10.0, false);
            }
        }
        if self.b.robot_until > t {
            self.tl.robot_acc += dt;
            while self.tl.robot_acc > 0.25 {
                self.tl.robot_acc -= 0.25;
                let k = self.kid_screen(14.0);
                let n = (1.0 + self.s.lvf(Upg::Boots) * self.ms(Upg::Boots)) * self.mult(false) * (1.0 + 0.5 * self.lvl(N_FIST));
                self.gain_at(n, k.x, k.y - 10.0, false);
            }
        }
        if self.b.bike_until > t {
            self.sprint = 1.2;
        }
        // frieza's ship
        if self.tl.ship.is_none()
            && session > 150.0
            && self.tl.tour.is_none()
            && self.tl.shen.is_none()
            && self.tl.boss.is_none()
            && self.no_games()
            && !self.tl.ginyu.as_ref().is_some_and(|g| g.done == 0.0)
            && tick(&mut self.tl.next_ship, dt)
        {
            let c = self.rand_cap(0.35, 0.5);
            self.tl.ship = Some(Ship { c, t0: t, until: t + 28.0, out: 0, ko: 0, next: t + 1.6, left: 0.0 });
            self.event("frieza's ship has landed — take out his soldiers!");
            self.cue(Cue::Sfx("boss"));
            self.tl.next_ship = 220.0 + self.r() * 60.0;
        }
        if let Some(sh) = self.tl.ship.clone() {
            if sh.left == 0.0 && sh.out < 4 && t > sh.next {
                let d = [self.r() - 0.5, self.r() - 0.5, self.r() - 0.5];
                let c = geom::norm(geom::add(sh.c, d, 0.3));
                self.tl.saibas.push(Saiba { c, born: t, life: 16.0, soldier: true, dead: false, sx: None });
                let s = self.tl.ship.as_mut().unwrap();
                s.out += 1;
                s.next = t + 1.1;
            }
            let sh = self.tl.ship.clone().unwrap();
            if sh.left == 0.0 && sh.ko >= 4 {
                self.tl.ship.as_mut().unwrap().left = t;
                self.victory();
                self.ach("fleet");
                let g = Big::from(500.0).max(self.wrate() * 60.0) * (1.0 + 0.5 * self.s.lvf(Upg::Armor));
                let q = self.hand_pos();
                self.gain_at(g, q.0, q.1 - 16.0, true);
                self.event(format!("frieza's soldiers are down — the ship flees! +{}", fmt_short(js_round(g))));
            } else if sh.left == 0.0 && t > sh.until {
                self.tl.ship.as_mut().unwrap().left = t;
                self.event("frieza's ship took off");
            }
            let sh = self.tl.ship.as_ref().unwrap();
            if sh.left != 0.0 && t - sh.left > 1.5 {
                self.tl.ship = None;
            }
        }
        // yamcha
        if self.tl.yam.is_none() && session > 100.0 && self.tl.shen.is_none() && tick(&mut self.tl.next_yam, dt) {
            let c = self.rand_cap(0.3, 0.6);
            self.tl.yam = Some(Yamcha { c, boom: t + 2.4, until: t + 16.0, helped: false, sx: None });
            self.event("a saibaman jumps on yamcha…");
            self.tl.next_yam = 200.0 + self.r() * 80.0;
        }
        if let Some(y) = self.tl.yam.clone() {
            if y.boom != 0.0 && t > y.boom {
                self.tl.yam.as_mut().unwrap().boom = 0.0;
                self.shake = 0.6;
                if let Some((x, yy)) = y.sx {
                    self.burst_at(x, yy - 6.0, &[0xffffff, 0xffe08a, 0xa6e67e, 0x58b848], 30, 160.0);
                }
                self.cue(Cue::Sfx("boom"));
                self.event("BOOM. yamcha got wrecked again — tap him");
            }
        }
        if self.tl.yam.as_ref().is_some_and(|y| t > y.until) {
            self.tl.yam = None;
        }
        // the fusion dance
        if self.tl.dance.is_none()
            && !self.b.fused.is_some_and(|(_, until)| until > t)
            && session > 200.0
            && self.s.best >= 2e5
            && self.tl.shen.is_none()
            && self.tl.boss.is_none()
            && self.no_games()
            && self.tl.tour.is_none()
            && self.s.world == self.home()
            && self.tl.cling.is_none()
            && tick(&mut self.tl.next_dance, dt)
        {
            let satan_turn = self.r() < 0.2;
            let (who, res) = if satan_turn {
                ("mr. satan", "satan")
            } else {
                match self.s.hero {
                    Hero::Vegeta => ("goku", "gogeta"),
                    Hero::Goku => ("vegeta", "gogeta"),
                    Hero::Gohan => ("videl", "gohanVidel"),
                    Hero::Trunks => ("goten", "gotenks"),
                    // the new heroes' partners are still to be picked
                    Hero::Krillin => ("master roshi", "roshillin"),
                    // the other new heroes' fusions come with their own work
                    Hero::Goten => ("kid trunks", "gotenks"),
                    Hero::Piccolo | Hero::Tien | Hero::A17 => ("goku", "gogeta"),
                }
            };
            self.tl.dance = Some(Dance { who, res, t0: t, beats: [t + 2.0, t + 2.8, t + 3.6], i: 0, hits: 0, ok: -9.0, done: 0.0, spoil: None });
            self.event_ms(format!("{who} wants to do the fusion dance! tap on the beat: fu · sion · ha!"), 3500.0);
            self.tl.next_dance = 300.0 + self.r() * 120.0;
        }
        if let Some(d) = self.tl.dance.as_mut() {
            while d.i < 3 && t > d.beats[d.i] + 0.32 {
                d.i += 1;
            }
            if d.done == 0.0 && t > d.beats[2] + 0.4 {
                d.done = t;
                let (ok, sat, hits, res) = (d.hits == 3, d.res == "satan", d.hits, d.res);
                // the new heroes' fusions have no fat or skinny one: a botched dance is still them, weaker
                let own = match res {
                    "roshillin" => Some("FUSED.roshillin"),
                    // goten's gotenks: a botched dance is still gotenks (trunks' keeps the old fat and skinny ones)
                    "gotenks" if self.s.hero == Hero::Goten => Some("FUSED.gotenks"),
                    _ => None,
                };
                let x = if sat {
                    1.5
                } else if ok {
                    3.0
                } else {
                    0.75
                };
                self.b.fused = Some((x, t + if ok || sat { 25.0 } else { 15.0 }));
                self.tl.fused_look = if sat {
                    "FUSED.satan"
                } else if let Some(look) = own {
                    look
                } else if ok {
                    match res {
                        "gogeta" => "FUSED.gogeta",
                        "gotenks" => "FUSED.gotenks",
                        _ => "FUSED.gohanVidel",
                    }
                } else if hits > 0 {
                    "FUSED.fat"
                } else {
                    "FUSED.skinny"
                };
                self.flash_t = 1.0;
                self.shake = 0.6;
                self.cue(Cue::Sfx("form"));
                self.ach("dance");
                let msg = if sat {
                    "fusion ha! …mr. satan takes all the credit. ×1.5 for 25s".to_string()
                } else if own.is_some() && !ok {
                    format!("fusion ha… a wobbly {res}. ×0.75 for 15s")
                } else if ok {
                    format!("fusion ha! {} — ×3 for 25s", if res == "gohanVidel" { "gohan and videl" } else { res })
                } else if hits > 0 {
                    "fusion ha… you got the fat one. ×0.75 for 15s".to_string()
                } else {
                    "fusion ha… you got the skinny one. ×0.75 for 15s".to_string()
                };
                self.event_ms(msg, 4000.0);
            }
            let d = self.tl.dance.as_ref().unwrap();
            if d.done != 0.0 && t - d.done > 1.0 {
                self.tl.dance = None;
            }
        }
        // a saibaman clings on
        if self.tl.cling.is_none()
            && session > 150.0
            && self.tl.shen.is_none()
            && self.tl.boss.is_none()
            && self.no_games()
            && self.tl.tour.is_none()
            && self.s.world == self.home()
            && tick(&mut self.tl.next_cling, dt)
        {
            self.tl.cling = Some(t + 3.5);
            self.event("a saibaman is hugging you — tap it off!");
            self.tl.next_cling = 240.0 + self.r() * 120.0;
        }
        if self.tl.cling.is_some_and(|boom| t > boom) {
            let k = self.kid_screen(10.0);
            self.burst_at(k.x, k.y, &[0xffffff, 0xffe08a, 0xa6e67e, 0x58b848], 30, 160.0);
            self.flash_t = 0.6;
            self.shake = 0.8;
            self.b.tired_until = self.b.tired_until.max(t + 6.0);
            self.cue(Cue::Sfx("boom"));
            self.event("BOOM — you got yamcha'd. tired ×0.75 for 6s");
            self.tl.cling = None;
        }
        // king kai's car
        let car_road = self.s.world != 6 && self.s.world != 10;
        if self.tl.car.is_none() && car_road && session > 70.0 && self.tl.shen.is_none() && tick(&mut self.tl.next_car, dt) {
            self.tl.car = Some(Car { phi: self.phi + std::f64::consts::PI, until: t + 16.0, sx: None });
            self.event("king kai's out for a drive — tap his car");
            self.tl.next_car = 170.0 + self.r() * 60.0;
        }
        if let Some(c) = self.tl.car.as_mut() {
            c.phi += 0.85 * dt;
            if t > c.until || !car_road {
                self.tl.car = None;
            }
        }
        if self.tl.kai.as_ref().is_some_and(|k| t > k.until) {
            self.tl.kai = None;
        }
        // the time chamber door
        if self.s.lv(Upg::Chamber) > 0 && self.tl.door.is_none() && self.b.chamber_until < t && tick(&mut self.tl.next_door, dt) {
            let c = self.rand_cap(0.25, 0.9);
            self.tl.door = Some(Npc { c, t0: t, until: t + 15.0, ..Default::default() });
            self.once("door", "the time chamber door is open — tap it");
            self.tl.next_door = 40f64.max((150.0 + self.r() * 40.0) / (1.0 + 0.25 * self.lvl(N_CHAMBER)));
        }
        if self.tl.door.as_ref().is_some_and(|d| t > d.until) {
            self.tl.door = None;
        }
        // piccolo zaps a meteor
        if self.s.lv(Upg::Piccolo) > 0 && tick(&mut self.tl.next_zap, dt) {
            self.tl.next_zap = 0.6f64.max(5.0 / (1.0 + 0.35 * (self.s.lvf(Upg::Piccolo) - 1.0)));
            let m = self.tl.meteors.iter().position(|m| !m.dead && m.delay <= 0.0);
            if let (Some(i), Some((px, py))) = (m, self.tl.piccolo_at) {
                let (mx, my) = (self.tl.meteors[i].x, self.tl.meteors[i].y);
                self.tl.zap = Some((px, py - 8.0, mx, my, t));
                self.tl.meteors[i].dead = true;
                self.goal("meteor", 1.0, false);
                let n = self.meteor_pay();
                self.gain_at(n, mx, my - 6.0, true);
                self.burst_at(mx, my, &[0xffffff, 0xfff08a, 0x9a6ad8], 12, 90.0);
                self.cue(Cue::Sfx("beam"));
            }
        }
        // the ginyu force
        if self.tl.ginyu.is_none()
            && self.tl.tour.is_none()
            && self.tl.boss.is_none()
            && self.no_games()
            && self.tl.shen.is_none()
            && session > 150.0
            && self.s.best >= 5e4
            && tick(&mut self.tl.next_ginyu, dt)
        {
            self.krillin_hit("the ginyu force");
            let hp = Big::from(300.0).max(self.wrate() * 9.0);
            let members = GINYU
                .iter()
                .enumerate()
                .map(|(i, &(name, spr))| Member { name, spr, hp, max: hp, i, x: 0.0, y: 0.0, k: 1.0, dead: false, flash: 0.0 })
                .collect();
            self.tl.ginyu = Some(Ginyu { androids: false, members, max: hp * 5.0, t0: t, until: t + 45.0, next_ki: 1.0, done: 0.0, mech: None });
            self.ginyu_arm();
            self.event(if self.posing() { "the ginyu force poses — a tap now is rude, and a free crit" } else { "the ginyu force strikes a pose!" });
            self.cue(Cue::Sfx("boss"));
            self.tl.next_ginyu = 300.0 + self.r() * 60.0;
        }
        if let Some(g) = self.tl.ginyu.as_mut() {
            if g.done == 0.0 && t > g.until {
                g.done = t;
                let msg = if g.androids { "17 and 18 got bored and flew off" } else { "the ginyu force retreats" };
                self.event(msg);
            }
        }
        self.ginyu_step(t);
        if self.tl.ginyu.as_ref().is_some_and(|g| g.done != 0.0 && t - g.done > 1.5) {
            self.tl.ginyu = None;
        }
        // the scouter can't take it
        if self.s.best > 9000.0 {
            self.ach("o9k");
        }
        if !self.s.o9k && self.s.best > 9000.0 {
            self.s.o9k = true;
            self.b.boost_until = self.b.boost_until.max(t + 20.0);
            self.shake = 0.6;
            self.event("it's over 9000!!  ×2 for 20s");
            self.cue(Cue::Fx("star"));
            let (x, y) = self.hand_pos();
            self.burst_at(x, y - 6.0, &[0xffffff, 0x9cf0b8, 0x34d873, 0xe0473e], 30, 160.0);
        }
        // saibamen
        if self.tl.tour.is_none() && session > 80.0 && tick(&mut self.tl.next_saiba, dt) {
            self.once("saiba", "saibamen! tap them");
            for i in 0..3 {
                let c = self.rand_cap(0.25, 0.85);
                self.tl.saibas.push(Saiba { c, born: t + i as f64 * 0.35, life: 11.0, soldier: false, dead: false, sx: None });
            }
            self.tl.next_saiba = 35.0 + self.r() * 20.0;
        }
        for i in 0..self.tl.saibas.len() {
            let sb = &mut self.tl.saibas[i];
            if !sb.dead && t - sb.born > sb.life {
                sb.dead = true;
                if let Some((x, y)) = sb.sx {
                    self.burst_at(x, y - 4.0, &[0xe7e2d4, 0xcfc8b6], 8, 50.0);
                }
            }
        }
        self.tl.saibas.retain(|s| !s.dead);
    }

    /// Trips: the next world at the next power mark (or after two minutes at home), and back home when the visit's up.
    pub(crate) fn timeline_trips(&mut self, t: f64) {
        let session = self.session;
        let home = self.home();
        if self.tl.pod_wish != 0
            && self.s.world == home
            && self.tl.shen.is_none()
            && (self.tl.tour.is_some() || self.tl.boss.is_some())
            && self.tl.pod_wish != 2
        {
            self.tl.pod_wish = 2;
            let msg = format!("your space pod is incoming — it lands after the {}", if self.tl.tour.is_some() { "tournament" } else { "fight" });
            self.event(msg);
        }
        let mark = if self.s.namek_at != 0.0 { self.s.namek_at } else { Big::from(PLANET_EVERY) };
        // jumped trips don't move either; one that comes due during a jump waits until you've been home TRIP_WAIT × 0.7
        let due = (self.s.run_best >= mark || session - self.tl.home_since > TRIP_WAIT * self.soon()) && session - self.tl.itx_back >= TRIP_WAIT * 0.7;
        if self.s.world == home
            && (due || self.tl.pod_wish != 0)
            && self.tl.tour.is_none()
            && self.tl.shen.is_none()
            && self.tl.boss.is_none()
            && self.tl.dance.is_none()
            && self.no_games()
        {
            self.tl.pod_wish = 0;
            self.s.namek_at = self.s.run_best * 4.0;
            self.s.trips += 1;
            if !self.snake_way && TRIPS[((self.s.trips - 1) % 11) as usize] == 3 {
                self.s.trips += 1;
            }
            self.trip(TRIPS[((self.s.trips - 1) % 11) as usize]);
        }
        let w = self.s.world;
        if w != 0 && w != 9 && self.tl.namek_until == 0.0 {
            self.tl.namek_until = t + 45f64.min(if self.s.namek_left != 0.0 { self.s.namek_left } else { 45.0 });
        }
        if w != 0 && w != 9 {
            self.s.namek_left = 0f64.max(self.tl.namek_until - t);
            let hung = t - self.tl.namek_until > 120.0;
            let snake_done = self.tl.snk.as_ref().is_some_and(|s| s.done != 0.0);
            if self.s.namek_left <= 0.0 && (self.tl.shen.is_none() || hung) && (w != 3 || snake_done || hung) {
                if hung && self.tl.shen.is_some() {
                    self.tl.shen = None;
                    self.cue(crate::hud::Cue::WishDone);
                }
                self.travel(self.home());
                self.tl.namek_until = 0.0;
                if self.tl.itx_trip {
                    self.itx_home();
                } else {
                    self.tl.home_since = self.session;
                    self.s.namek_at = self.s.namek_at.max(self.s.run_best * 2.0);
                }
            }
        }
    }

    /// The fights (off snake way): the tournament, movies, nappa, the sagas, the multiverse, the meteor storm, the
    /// spirit bomb, beam struggles, and the ki blasts that wear villains down.
    pub(crate) fn timeline_fights(&mut self, t: f64, dt: f64) {
        let session = self.session;
        let (w, h) = (self.cam.w, self.cam.h);
        let home = self.home();
        if self.s.lv(Upg::Partner) >= 3
            && self.s.best >= 50000.0
            && self.b.fuse_until < t
            && self.tl.fuse_offer < t
            && self.tl.tour.is_none()
            && tick(&mut self.tl.next_fuse, dt)
        {
            self.tl.fuse_offer = t + 12.0;
            self.tl.next_fuse = 170.0 + self.r() * 60.0;
            self.event("bubbles wants to fuse — tap him!");
        }
        if self.tl.tour.is_none()
            && self.tl.shen.is_none()
            && self.tl.boss.is_none()
            && self.s.world == home
            && session > 75.0
            && self.s.best >= 3000.0
            && self.no_games()
            && tick(&mut self.tl.next_tour, dt)
        {
            self.tl.tour = Some(Tour { t0: t, until: t + 60.0, ko: 0, next: 1.5, villain: false });
            self.event("the tournament of power begins — 60s!");
            self.cue(Cue::Fx("star"));
        }
        if self.tl.tour.is_some() {
            let tr = self.tl.tour.as_mut().unwrap();
            tr.next -= dt;
            if tr.next < 0.0 && self.tl.saibas.len() < 8 {
                let c = self.rand_cap(0.2, 0.9);
                self.tl.saibas.push(Saiba { c, born: t, life: 6.0, soldier: false, dead: false, sx: None });
                let tr = self.tl.tour.as_mut().unwrap();
                tr.next = 0.45f64.max(1.2 - (t - tr.t0) / 80.0);
            }
            let tr = self.tl.tour.clone().unwrap();
            if !tr.villain && t - tr.t0 > 28.0 && self.tl.boss.is_none() {
                self.tl.tour.as_mut().unwrap().villain = true;
                let (vname, spr) = VILLAINS[(self.s.bosses as usize) % VILLAINS.len()];
                let hp = Big::from(400.0).max(self.wrate() * 18.0);
                let name = if vname == "vegeta" && self.s.hero == Hero::Vegeta { "past vegeta" } else { vname };
                self.new_boss(Boss::new(0, name.into(), spr, hp, t, t + 25.0));
                self.event(format!("{vname} joins the tournament!"));
            }
            if t > tr.until {
                let ko = self.tl.tour.as_ref().unwrap().ko;
                let best = self.s.tour_best;
                let prize = Big::from(500.0).max(self.rate() * ko as f64 * 8.0);
                self.s.tour_best = best.max(ko);
                self.gain(prize);
                self.goal("tour", ko as f64, true);
                let p = fmt_short(js_round(prize));
                self.event(if ko > best {
                    format!("tournament over — {ko} KO, new best! +{p}")
                } else {
                    format!("tournament over — {ko} KO (best {best}) +{p}")
                });
                self.cue(Cue::Fx("star"));
                self.ach("tournament");
                self.tl.tour = None;
                self.tl.next_tour = 240.0 + self.r() * 60.0;
                self.tl.next_saiba = 30.0;
            }
        }
        // a movie villain
        if self.tl.movie.is_none()
            && self.s.world == home
            && self.tl.boss.is_none()
            && self.tl.ginyu.is_none()
            && self.tl.tour.is_none()
            && self.tl.shen.is_none()
            && self.tl.ship.is_none()
            && self.tl.storm.is_none()
            && self.tl.dance.is_none()
            && self.tl.cling.is_none()
            && session > 240.0
            && self.s.best >= 3e5
            && self.no_games()
            && tick(&mut self.tl.next_movie, dt)
        {
            let who = if !self.tl.movie_force.is_empty() {
                self.tl.movie_force
            } else {
                let pool: Vec<&'static str> = MOVIES.iter().map(|m| m.who).filter(|&w| w != self.tl.last_movie).collect();
                pool[(self.r() * pool.len() as f64) as usize]
            };
            let metal = who == "cooler" && {
                self.tl.coolers += 1;
                self.tl.metal_force || self.tl.coolers.is_multiple_of(2)
            };
            self.tl.metal_force = false;
            self.start_movie(who, t, metal);
            self.tl.movie_force = "";
            self.tl.next_movie = 480.0 + self.r() * 180.0;
        }
        if self.tl.movie.is_some() {
            self.movie_tick(t);
        }
        if self.tl.movie_note.as_ref().is_some_and(|n| t > n.0) {
            let (_, s) = self.tl.movie_note.take().unwrap();
            self.event_ms(s, 3500.0);
        }
        // nappa defends planet vegeta
        if self.s.world == 2 && self.tl.next_nappa > 0.0 && self.tl.boss.is_none() && self.tl.shen.is_none() && {
            self.tl.next_nappa -= dt;
            self.tl.next_nappa <= 0.0
        } {
            self.tl.next_nappa = 0.0;
            let hp = Big::from(800.0).max(self.wrate() * 50.0);
            self.new_boss(Boss::new(0, "nappa".into(), NAPPA, hp, t, t + 35.0));
            self.event("nappa: \"vegeta, let me handle this!\" — tap him");
        }
        // ultra instinct (or the end of the sagas) opens the multiverse
        let sagas = VILLAINS.len() as u32;
        if !self.s.multi && (self.s.saga >= sagas || self.held_form() >= UI_FORM) {
            self.s.multi = true;
            self.s.multi_t = session;
            self.tl.next_boss = self.tl.next_boss.min(20.0);
            self.top_sync();
            if self.s.world == 0 {
                self.travel(9);
            }
            self.event_ms("the grand priest: \"welcome to the tournament of power.\" — universe 9 is up first. beat each universe for a universe star", 5000.0);
        }
        if self.s.multi && self.s.saga < sagas {
            self.tl.next_saga -= dt;
        }
        if self.tl.tour.is_none()
            && session > 110.0
            && self.tl.boss.is_none()
            && self.tl.shen.is_none()
            && self.no_games()
            && if self.s.multi { self.s.saga < sagas && self.tl.next_saga < 0.0 } else { tick(&mut self.tl.next_boss, dt) }
        {
            let n = VILLAINS.len();
            let (vname, spr) = VILLAINS[self.s.saga as usize % n];
            let hp = Big::from(600.0).max(self.wrate() * 40.0) * (1.0 + 0.15 * self.s.saga as f64);
            let me = vname == "vegeta" && self.s.hero == Hero::Vegeta;
            let mut b = Boss::new(0, if me { "past vegeta".into() } else { vname.into() }, spr, hp, t, t + 40.0);
            b.saga = true;
            let name = b.name.clone();
            self.new_boss(b);
            self.cue(crate::hud::Cue::Notify("raid", name));
            // the scouter reads him as he arrives; its toast names him
            self.intro_start(t);
            let z = if self.s.zeno > 0 { 4.0 } else { 1.0 };
            if self.s.multi {
                self.tl.next_saga = (120.0 + self.r() * 60.0) / z;
            } else {
                self.tl.next_boss = (160.0 + self.r() * 60.0) / z;
            }
            self.krillin_hit(vname);
        }
        if self.tl.tour.is_none()
            && session > 110.0
            && self.tl.boss.is_none()
            && self.tl.shen.is_none()
            && self.s.multi
            && self.no_games()
            && tick(&mut self.tl.next_boss, dt)
        {
            let (u, k) = (self.s.uni as usize, self.s.uni_stage as usize);
            let who = uni_fighter(u, k);
            let hp = UNI_HP * crate::jsmath::pow(UNI_STEP, u as f64) * UNI_STAGES[k];
            let last = k == UNI_STAGES.len() - 1;
            let ut = self.uni_time();
            let mut b = Boss::new(0, who.into(), Dim::default(), hp.into(), t, t + ut);
            b.sprs = fighter_takes(who);
            b.uni = true;
            b.tag = format!("{}{}", uni_name(u), if last { " boss".to_string() } else { format!(" {}/{}", k + 1, UNI_STAGES.len()) });
            self.new_boss(b);
            self.event_ms(format!("{}{}: {who} steps up. {ut}s to win — tap!", uni_name(u), if last { " — its strongest" } else { "" }), 3500.0);
            self.cue(Cue::Sfx("boss"));
            self.tl.next_boss = 10.0 + self.r() * 6.0;
        }
        // the meteor storm
        if self.tl.storm.is_none()
            && session > 120.0
            && self.tl.tour.is_none()
            && self.tl.shen.is_none()
            && self.tl.boss.is_none()
            && self.no_games()
            && tick(&mut self.tl.next_storm, dt)
        {
            self.tl.storm = Some(Storm { until: t + 12.0, next: t, hit: 0 });
            self.event("meteor storm! bust as many as you can");
            self.cue(Cue::Sfx("boss"));
            self.tl.next_storm = 260.0 + self.r() * 60.0;
        }
        if let Some(s) = self.tl.storm.clone() {
            if t < s.until && t > s.next {
                self.tl.storm.as_mut().unwrap().next = t + 0.3;
                let x = w * (0.1 + self.r() * 1.1);
                let vx = -w * (0.1 + self.r() * 0.08);
                let vy = h * (0.25 + self.r() * 0.15);
                self.tl.meteors.push(Meteor { x, y: -10.0, vx, vy, delay: 0.0, dead: false, sd: None });
            }
            if t > s.until + 2.0 {
                let hit = self.tl.storm.as_ref().unwrap().hit;
                let g = hit as f64 * Big::from(30.0).max(self.rate() * 2.0);
                if hit > 0 {
                    let q = self.hand_pos();
                    self.gain_at(g, q.0, q.1 - 16.0, true);
                }
                self.event(if hit > 0 { format!("meteor storm over — {hit} busted, +{}", fmt_short(js_round(g))) } else { "meteor storm over".into() });
                if hit >= 20 {
                    self.victory();
                    self.ach("storm20");
                }
                self.tl.storm = None;
            }
        }
        // the spirit bomb gathers
        if self.s.spirit > 0 && self.tl.spirit_shot.is_none() && !self.tl.spirit_ready && self.playing {
            self.tl.spirit = 1f64.min(self.tl.spirit + dt / 300.0);
            if self.tl.spirit >= 1.0 {
                self.tl.spirit_ready = true;
                self.once("spirit", "spirit bomb ready — tap the ball");
            }
        }
        if let Some(s) = self.tl.spirit_shot.clone() {
            if t - s.t0 > 0.7 {
                self.spirit_blast(s.x1, s.y1);
                self.tl.spirit_shot = None;
            }
        }
        // beam struggle
        if self.tl.struggle.is_none() && self.s.lv(Upg::Galick) > 0 && self.tl.boss.as_ref().is_some_and(|b| !b.dead && !b.struggled && t - b.t0 > 5.0) {
            self.tl.boss.as_mut().unwrap().struggled = true;
            if self.tl.struggle_force || self.r() < 0.6 {
                self.tl.struggle = Some(Struggle { t0: t, until: t + 7.0, p: 0.5 });
                let b = self.tl.boss.as_mut().unwrap();
                b.until = b.until.max(t + 10.0);
                self.event("beam struggle! tap fast to push it back");
                self.cue(Cue::Sfx("beam"));
            }
        }
        if let Some(s) = self.tl.struggle.as_mut() {
            s.p -= dt * 0.11;
            let (p, until) = (s.p, s.until);
            if !self.boss_up() {
                self.tl.struggle = None;
            } else if p >= 1.0 {
                self.tl.struggle = None;
                let f = self.finisher();
                let b = self.tl.boss.as_ref().unwrap();
                let (x, y) = (b.x, b.y - b.spr().h / 2.0 * b.k);
                self.hit_boss(f, x, y, true);
                self.ach("struggle");
                self.event("you won the beam struggle!");
            } else if p <= 0.0 || t > until {
                self.tl.struggle = None;
                self.b.tired_until = t + 6.0;
                self.shake = 0.6;
                self.event("lost the beam struggle — tired ×0.75 for 6s");
            }
        }
        let struggling = self.tl.struggle.is_some();
        self.mech_step(t, dt, struggling);
        if let Some(b) = self.tl.boss.as_mut() {
            if b.sprs.len() > 1 && !b.dead {
                let low = b.sprs.len() > 3 && b.hp / b.max < 0.4;
                if low && !b.pow {
                    b.pow = true;
                    self.flash_t = 0.4;
                    self.shake = 0.5;
                    let msg = POWER_UP.iter().find(|p| p.0 == b.name).map_or(format!("{} powers up!", b.name), |p| p.1.to_string());
                    self.event_ms(msg, 3000.0);
                }
                let b = self.tl.boss.as_mut().unwrap();
                b.p = if low {
                    3
                } else if b.sprs.len() > 2 && (t - b.hit_t.unwrap_or(-9.0) < 0.4 || struggling) {
                    1 + ((t * 6.0).floor() as i64 % 2) as usize
                } else {
                    0
                };
            }
        }
        if self.tl.boss.is_some() {
            let b = self.tl.boss.as_mut().unwrap();
            if !b.dead && t > b.until {
                b.dead = true;
                b.fled = true;
                b.t1 = t;
                if b.uni {
                    let next = if b.hp / b.max > 0.95 { 150.0 } else { 20.0 };
                    let place = b.tag.trim_end_matches(" boss").to_string();
                    let place = match place.rfind(' ') {
                        Some(i) if place[i + 1..].len() == 3 && place.as_bytes()[i + 2] == b'/' => place[..i].to_string(),
                        _ => place,
                    };
                    let msg = format!("{} holds {place} — {}% left. grow, he's back in {next}s", b.name, js_round((b.hp / b.max * 100.0).to_f64()));
                    self.tl.next_boss = next;
                    self.event_ms(msg, 3500.0);
                } else if b.name != "perfect cell" && b.name != "majin buu" {
                    // (the games and buu's candy say their own goodbyes)
                    let msg = format!("{} got away", b.name);
                    self.event(msg);
                }
            }
            self.intro_step(t);
            // the ki blasts (and krillin's discs) don't reach fat buu's rubbery belly (candy.rs)
            let buu = self.tl.candy.as_ref().map(|c| c.boss);
            let b = self.tl.boss.as_mut().unwrap();
            let buu = buu == Some(b.id);
            if b.dead && t - b.t1 > 1.2 {
                self.tl.boss = None;
            } else if !b.dead && !buu && !struggling && t >= b.go && tick(&mut b.next_ki, dt) {
                b.next_ki = 0.7;
                let (x, y) = self.hand_pos();
                self.tl.kis.push(Ki { x, y, t0: t, m: None, disc: false, done: false });
            }
            if self.s.krillin_ally && !buu {
                if let Some(b) = self.tl.boss.as_mut().filter(|b| !b.dead && t >= b.go) {
                    let nd = b.next_disc.unwrap_or(2.0) - dt;
                    b.next_disc = Some(nd);
                    if nd < 0.0 {
                        b.next_disc = Some(5.0);
                        let (x, y) = self.hand_pos();
                        self.tl.kis.push(Ki { x, y: y - 10.0, t0: t, m: None, disc: true, done: false });
                    }
                }
            }
        }
        if let Some(g) = self.tl.ginyu.as_mut() {
            if g.done == 0.0 && tick(&mut g.next_ki, dt) {
                g.next_ki = 0.8;
                // with the poses, your ki takes them in story order, the captain last (so he's there to swap bodies)
                let m = if g.mech.is_some() { crate::mech2::G_ORDER.into_iter().find(|&i| !g.members[i].dead) } else { g.members.iter().position(|x| !x.dead) };
                let (x, y) = self.hand_pos();
                if let Some(m) = m {
                    self.tl.kis.push(Ki { x, y, t0: t, m: Some(m), disc: false, done: false });
                }
            }
        }
        for i in 0..self.tl.kis.len() {
            let kb = self.tl.kis[i].clone();
            let (tx, ty) = if let Some(mi) = kb.m {
                let Some(m) = self.tl.ginyu.as_ref().map(|g| &g.members[mi]).filter(|m| !m.dead) else {
                    self.tl.kis[i].done = true;
                    continue;
                };
                (m.x, m.y - m.spr.h / 2.0 * m.k)
            } else {
                let Some(b) = self.tl.boss.as_ref().filter(|b| !b.dead) else {
                    self.tl.kis[i].done = true;
                    continue;
                };
                (b.x, b.y - b.spr().h / 2.0 * b.k)
            };
            let d = hypot(&[tx - kb.x, ty - kb.y]);
            if d < 6.0 {
                self.tl.kis[i].done = true;
                if let Some(mi) = kb.m {
                    let dmg = Big::from(1.0).max(self.rate() * 0.2);
                    self.ginyu_hit(mi, dmg);
                } else {
                    let dmg = Big::from(1.0).max(self.rate() * if kb.disc { 2.0 } else { 0.2 });
                    self.hit_boss(dmg, tx, ty, false);
                }
                continue;
            }
            let sp = 260.0 * dt / d;
            let k = &mut self.tl.kis[i];
            k.x += (tx - k.x) * 1f64.min(sp);
            k.y += (ty - k.y) * 1f64.min(sp);
        }
        self.tl.kis.retain(|k| !k.done);
    }

    /// After the form checks: whis' staff, zeno, the space pod and meteors moving, the nimbus reaching the hero, orbs on the road.
    pub(crate) fn timeline_after(&mut self, t: f64, dt: f64) {
        if self.ang(A_STAFF) && self.tl.bz.is_some() {
            self.b.whis_until = self.b.whis_until.max(t + 1.0);
        }
        if self.tl.zen.is_none() && self.zeno_ready() && self.playing && self.tl.shen.is_none() && self.s.world == self.home() {
            let c = self.cap_pt(0.4, 1.7);
            self.tl.zen = Some(Npc { c, t0: t, ..Default::default() });
            self.event_ms("zeno-sama is here. \"you're strong! let's be friends!\" — tap him for the zeno button", 5000.0);
            self.cue(Cue::Sfx("dragon"));
        }
        let w = self.cam.w;
        if let Some(s) = self.tl.star.as_mut() {
            s.x += s.vx * dt;
            s.y += sin(t * 3.0) * 0.3;
            let gone = s.x > w + 12.0;
            let (sx, sy) = (s.x, s.y);
            if self.rng.random() < 0.9 {
                let y = sy + (self.rng.random() - 0.5) * 4.0;
                self.fx.push(Particle::new(sx - 7.0, y, &[0xffffff, 0xffd84a, 0xff8a3a]).v(-30.0, 0.0).life(0.45).size(2.0, 0.0));
            }
            if gone {
                self.tl.star = None;
            }
        }
        for m in self.tl.meteors.iter_mut() {
            if m.delay > 0.0 {
                m.delay -= dt;
                continue;
            }
            m.x += m.vx * dt;
            m.y += m.vy * dt;
        }
        let h = self.cam.h;
        self.tl.meteors.retain(|m| !m.dead && m.y < h + 10.0);
        if let Some((mut x, mut y)) = self.tl.cloud_fly {
            let k = self.kid_screen(10.0);
            x += (k.x - x) * dt * 1.8;
            y += (k.y - 10.0 - y) * dt * 1.8;
            self.tl.cloud_fly = Some((x, y));
            if hypot(&[k.x - x, k.y - 10.0 - y]) < 6.0 {
                self.tl.cloud_fly = None;
                self.riding = 10.0 + self.s.lvf(Upg::Cloud) * 2.0;
                self.event("riding flying nimbus — ×1.5");
            }
        }
        if self.s.world != 3 {
            for i in 0..self.tl.orbs.len() {
                let o = self.tl.orbs[i].clone();
                let d = atan2(sin(o.phi - self.phi), cos(o.phi - self.phi));
                if d.abs() < 0.06 && !o.done {
                    self.tl.orbs[i].done = true;
                    let k = self.kid_screen(16.0);
                    let n = self.lap_value() * self.mult(false) * if o.star { 3.0 } else { 1.0 };
                    self.gain_at(n, k.x, k.y - 12.0, true);
                    if o.star {
                        self.goal("ball", 1.0, false);
                        self.s.orbs7 += 1;
                        if self.s.orbs7 >= 7 {
                            self.s.orbs7 = 0;
                            self.summon();
                        } else {
                            let msg = format!("dragon ball {}/7", self.s.orbs7);
                            self.event(msg);
                        }
                    }
                    let k = self.kid_screen(16.0);
                    self.spray(k.x, k.y - 10.0, &[0xffffff, 0xffd84a, 0xff9a3c], 12, 90.0, 3.0, 0.6);
                }
            }
        }
        self.tl.orbs.retain(|o| !o.done);
    }

    /// The moon and the great ape, then the senzu bean.
    pub(crate) fn timeline_moon(&mut self, t: f64, dt: f64) {
        let session = self.session;
        let (w, h) = (self.cam.w, self.cam.h);
        if (session > 40.0 || self.s.world == 2) && self.s.world != 3 && self.tl.moon.is_none() && self.b.ape_until < t && tick(&mut self.tl.next_moon, dt) {
            let r = 9f64.max(js_round(w.min(h) * 0.07));
            self.tl.moon = Some(Moon { x: w * 0.2, y: h * 0.22, r, a: 0.0, born: t, leaving: false });
            self.once("moon", "a full moon is rising… click it to transform");
        }
        {
            // the full moon brings the night (the renderer fades the sea to it)
            let n = self.tl.moon.as_ref().is_some_and(|m| !m.leaving) || self.b.ape_until > t;
            self.tl.night = n;
            self.tl.night_k = 0f64.max(1f64.min(self.tl.night_k + (if n { dt } else { -dt }) / 0.8));
        }
        if let Some(m) = self.tl.moon.clone() {
            if (self.s.lv(Upg::Tail) > 0 || self.s.big_ape) && m.a > 0.3 && !m.leaving && t - m.born > 6.0 && self.b.ape_until < t {
                self.moon_transform();
            }
        }
        if self.b.ape_until > t && self.s.lv(Upg::Tail) > 0 {
            self.tl.ape.rage = 0f64.max(self.tl.ape.rage - dt * 0.1);
        }
        if let Some(m) = self.tl.moon.as_mut() {
            m.a = if m.leaving { m.a - dt * 1.5 } else { 1f64.min(m.a + dt * 1.2) };
            if !m.leaving && t - m.born > 12.0 {
                m.leaving = true;
            }
            if m.a <= 0.0 && m.leaving {
                self.tl.moon = None;
                self.tl.next_moon = if self.s.world == 2 { 40.0 } else { 180.0 + self.r() * 60.0 };
            }
        }
        self.charge(t);
        if self.s.lv(Upg::Senzu) > 0 && self.tl.bean.is_none() && tick(&mut self.tl.next_bean, dt) {
            let c = geom::mul(self.rand_cap(0.3, 0.9), 1.03);
            self.tl.bean = Some(Npc { c, ..Default::default() });
            self.tl.next_bean = 40.0 / self.s.lvf(Upg::Senzu);
            self.once("bean", "a senzu bean sprouted — tap it");
        }
    }

    // ── the pieces the timeline calls

    pub(crate) fn new_boss(&mut self, mut b: Boss) {
        self.tl.boss_ids += 1;
        b.id = self.tl.boss_ids;
        self.tl.boss = Some(b);
    }

    /// `krillinHit`: an ally krillin is the first thing every villain goes for.
    fn krillin_hit(&mut self, by: &str) {
        if !self.s.krillin_ally || self.s.hero == Hero::Krillin || self.tl.kril.is_some() || self.r() > 0.75 {
            return;
        }
        let c = self.frame3.road_pt(self.phi - 0.5);
        self.tl.kril = Some(Krillin { c, t0: self.t - 1.0, boom: self.t + 1.2, dead: 0.0, sx: None });
        self.event(format!("{by} goes straight for krillin…"));
    }

    pub(crate) fn kill_saiba(&mut self, i: usize) {
        if self.tl.saibas[i].soldier {
            if let Some(s) = self.tl.ship.as_mut() {
                s.ko += 1;
            }
        }
        self.goal("saiba", 1.0, false);
        if let Some(tr) = self.tl.tour.as_mut() {
            tr.ko += 1;
        }
        self.tl.saibas[i].dead = true;
        let n = Big::from(40.0).max(self.rate() * 3.0) * (1.0 + 0.5 * self.s.lvf(Upg::Armor));
        match self.tl.saibas[i].sx {
            Some((sx, sy)) => self.gain_at(n, sx, sy - 12.0, true),
            None => self.gain(n),
        }
        let at = self.tl.saibas[i].sx.map(|(x, y)| (x, y - 5.0));
        self.burst_seen(at, &[0xffffff, 0xa6e67e, 0x58b848, 0x2f7a2a], 16, 110.0);
    }

    pub(crate) fn ginyu_hit(&mut self, mi: usize, dmg: Big) {
        let arm = 1.0 + 0.5 * self.s.lvf(Upg::Armor);
        let g = self.tl.ginyu.as_mut().unwrap();
        let m = &mut g.members[mi];
        if m.dead {
            return;
        }
        m.hp -= dmg * arm;
        m.flash = 0.12;
        let (x, y, down) = (m.x, m.y, m.hp <= 0.0);
        self.burst_at(x, y - 12.0, &[0xffffff, 0xffe08a, 0xff9a3c], 5, 60.0);
        if down {
            self.tl.ginyu.as_mut().unwrap().members[mi].dead = true;
            self.burst_at(x, y - 10.0, &[0xffffff, 0xffe08a, 0xe0473e], 16, 140.0);
            if let Some(tr) = self.tl.tour.as_mut() {
                tr.ko += 2;
            }
            let g = self.tl.ginyu.as_ref().unwrap();
            if g.members.iter().all(|x| x.dead) {
                let (androids, max) = (g.androids, g.max);
                self.victory();
                self.ach(if androids { "androids" } else { "ginyu" });
                let prize = (max * 2.0).max(self.wrate() * 200.0) * (1.0 + 0.5 * self.lvl(N_BOUNTY));
                let (cx, cy) = (self.cam.cx, self.cam.cy - self.cam.r * 1.3);
                self.gain_at(prize, cx, cy, true);
                let who = if androids { "androids 17 and 18 are" } else { "the ginyu force is" };
                self.event(format!("{who} defeated! +{}", fmt_short(js_round(prize))));
                self.cue(Cue::Fx("star"));
                self.cue(Cue::Sfx("boom"));
                self.goal("boss", 1.0, false);
                self.tl.ginyu.as_mut().unwrap().done = self.t;
            }
        }
    }

    /// `hitBoss(dmg, x, y)`: the boss takes a hit; at zero he's down, and pays.
    pub(crate) fn hit_boss(&mut self, dmg: Big, x: f64, y: f64, big: bool) {
        if self.tl.boss.as_ref().unwrap().movie && self.movie_guard(dmg, x, y) {
            return;
        }
        let dmg = self.mech_hit(dmg, big);
        if dmg == 0.0 {
            return;
        }
        let t = self.t;
        let arm = 1.0 + 0.5 * self.s.lvf(Upg::Armor);
        let b = self.tl.boss.as_mut().unwrap();
        b.hp -= dmg * arm;
        b.flash = 0.12;
        b.hit_t = Some(t);
        self.cue(Cue::Sfx("hit"));
        self.burst_at(x, y, &[0xffffff, 0xffe08a, 0xff9a3c], 6, 70.0);
        let b = self.tl.boss.clone().unwrap();
        if b.hp <= 0.0 && !b.dead {
            {
                let bm = self.tl.boss.as_mut().unwrap();
                bm.dead = true;
                bm.t1 = t;
            }
            self.s.bosses += 1;
            self.goal("boss", 1.0, false);
            if let Some(tr) = self.tl.tour.as_mut() {
                tr.ko += 10;
            }
            self.tl.capsule = Some(Capsule { x: b.x, y: b.y - b.spr().h / 2.0 * b.k, vy: -40.0, t0: t, land: self.cam.cy - self.cam.r * 0.3 });
            let mut prize = if b.uni {
                self.wrate() * 15.0
            } else {
                (if b.movie { Big::ZERO } else { b.max * 1.5 }).max(self.wrate() * 90.0) * (1.0 + 0.5 * self.lvl(N_BOUNTY))
            };
            if b.uni {
                self.s.uni_stage += 1;
                if self.s.uni_stage as usize >= UNI_STAGES.len() {
                    let u = self.s.uni as usize;
                    self.s.uni_stage = 0;
                    self.s.uni += 1;
                    self.s.ustars += 1;
                    self.s.uni_best = self.s.uni_best.max(self.s.uni);
                    self.top_sync();
                    self.ach("universe");
                    if self.s.uni as usize >= LADDER.len() {
                        self.ach("multiverse");
                    }
                    if u < LADDER.len() {
                        self.ach(&format!("u{}", LADDER[u].0));
                    }
                    for n in [1, 5, 10] {
                        if u == LADDER.len() + n - 1 {
                            self.ach(&format!("inf{n}"));
                        }
                    }
                    let x = self.star_x().powf(if self.ang(A_STARS) { 2.0 } else { 1.0 });
                    let msg =
                        format!("{} cleared — a universe star: ×{} on everything. next: {}", uni_name(u), crate::json::num(x), uni_name(self.s.uni as usize));
                    self.after(2.6, Later::Event(msg, 4500.0));
                }
            }
            if b.saga {
                prize *= 2.0;
                self.s.saga += 1;
                if self.lvl(N_SAGA) > 0.0 {
                    self.s.seeds += 1.0;
                    self.s.ascend += 1.0;
                    self.after(5.2, Later::Event("legend — the villain drops a ki seed".into(), 2600.0));
                }
                if self.s.saga >= VILLAINS.len() as u32 {
                    self.ach("sagas");
                }
                let c = self.cap_pt(0.42, 2.9);
                self.tl.satan = Some(Npc { c, t0: t + 1.2, until: t + 9.0, prize: prize * 0.5, ..Default::default() });
                self.after(2.8, Later::Event("mr. satan: \"i did it! it was all me!\" — tap him for the prize money".into(), 4500.0));
            }
            self.victory();
            if self.s.beaten.insert(b.name.clone()) {
                // a story beat that opens a hero
                if let Some(c) = CHARS.iter().find(|c| matches!(c.3, Need::Beat(v) if v == b.name)) {
                    self.after(1.4, Later::Event(format!("{} joins you · pick him in the characters tab", c.2), 3200.0));
                }
            }
            if !self.s.foes.contains(&b.name) {
                self.s.foes.push(b.name.clone());
            }
            if self.s.bosses >= 10 {
                self.ach("villains10");
            }
            match b.name.as_str() {
                "frieza" => self.ach("frieza"),
                "nappa" if self.s.world == 2 => self.ach("nappa"),
                "cell" => self.ach("cell"),
                "beerus" => self.ach("beerus"),
                _ => {}
            }
            if ["frieza", "cell", "kid buu", "beerus"].iter().all(|n| self.s.beaten.contains(*n)) {
                self.ach("all4");
            }
            let bb = self.tl.boss.as_ref().unwrap();
            let (bx, by) = (bb.x, bb.y - (bb.spr().h + 10.0) * bb.k);
            self.gain_at(prize, bx, by, true);
            let p = fmt_short(js_round(prize));
            self.event(if b.name == "past vegeta" {
                format!("you beat your younger self — technically you also lost. +{p}")
            } else {
                format!("{} defeated — +{p}", b.name)
            });
            self.flash_t = 0.8;
            self.cue(Cue::Fx("star"));
            self.shake = 0.7;
            let (bx, by) = (b.x, b.y - b.spr().h / 2.0 * b.k);
            for _ in 0..4 {
                let x = bx + (self.r() - 0.5) * 20.0;
                let y = by + (self.r() - 0.5) * 20.0;
                self.burst_at(x, y, &[0xffffff, 0xffe08a, 0xff9a3c, 0xe0473e], 20, 180.0);
            }
        }
    }

    /// Where the spirit bomb hangs over the hero, and its radius (`spiritPos`).
    pub fn spirit_pos(&self) -> (f64, f64, f64) {
        let kd = self.kid_screen(0.0);
        let up = self.lift_now + 34.0 + self.tl.spirit * 10.0 + if self.b.ape_until > self.t { APE0.h * 2.3 } else { 0.0 };
        (kd.x + sin(kd.ang) * up, kd.y - cos(kd.ang) * up, 2.0 + self.tl.spirit * 9.0 * 1f64.max(self.cam.r / 60.0))
    }

    fn throw_spirit(&mut self) {
        let to = if let Some(b) = self.tl.boss.as_ref().filter(|b| !b.dead) {
            (b.x, b.y - b.spr().h / 2.0 * b.k)
        } else if let Some(m) = self.tl.ginyu.as_ref().filter(|g| g.done == 0.0).and_then(|g| g.members.iter().find(|x| !x.dead)) {
            (m.x, m.y - m.spr.h / 2.0 * m.k)
        } else {
            (self.cam.cx, self.cam.cy - self.cam.r * 1.5)
        };
        let from = self.spirit_pos();
        self.tl.spirit_shot = Some(SpiritShot { x0: from.0, y0: from.1, r: from.2, x1: to.0, y1: to.1, t0: self.t });
        self.tl.spirit = 0.0;
        self.tl.spirit_ready = false;
        self.ach("spirit");
        self.cue(Cue::Sfx("beam"));
    }

    fn spirit_blast(&mut self, x: f64, y: f64) {
        self.flash_t = 1.0;
        self.cue(Cue::Sfx("boom"));
        self.shake = 1.0;
        let r = self.cam.r * 1.1;
        self.inp.blasts.push(crate::input::Blast { x, y, r, t0: self.t, kaio: false });
        for i in 0..self.tl.saibas.len() {
            if !self.tl.saibas[i].dead && self.tl.saibas[i].sx.is_some() {
                self.kill_saiba(i);
            }
        }
        for i in 0..self.tl.meteors.len() {
            if !self.tl.meteors[i].dead {
                self.tl.meteors[i].dead = true;
                self.goal("meteor", 1.0, false);
            }
        }
        if self.tl.ginyu.as_ref().is_some_and(|g| g.done == 0.0) {
            for mi in 0..self.tl.ginyu.as_ref().unwrap().members.len() {
                let m = &self.tl.ginyu.as_ref().unwrap().members[mi];
                if !m.dead {
                    let hp = m.hp;
                    self.ginyu_hit(mi, hp + 1.0);
                }
            }
        }
        if self.tl.movie.is_some() {
            self.movie_blast(Big::from(f64::INFINITY));
        }
        if self.boss_up() {
            let f = self.finisher();
            self.hit_boss(f, x, y, true);
        }
        let g = (self.wrate() * 120.0).max(self.lap_value() * self.mult(false) * 60.0) * (1.0 + 0.5 * (self.s.spirit as f64 - 1.0));
        self.gain_at(g, x, y - 20.0, true);
        self.event(format!("spirit bomb! +{}", fmt_short(js_round(g))));
        self.victory();
        for _ in 0..5 {
            let bx = x + (self.r() - 0.5) * 40.0;
            let by = y + (self.r() - 0.5) * 40.0;
            self.burst_at(bx, by, &[0xffffff, 0xd8f0ff, 0x8fd8ff, 0x2f6ae0], 30, 260.0);
        }
    }

    /// The capsule pops open (the renderer calls it 8s after it lands, as game.js's drawing does).
    pub fn open_capsule(&mut self) {
        let c = self.tl.capsule.take().unwrap();
        self.flash_t = 0.3;
        let roll = self.r();
        self.burst_at(c.x, c.y, &[0xffffff, 0xe4e6ea, 0xe0332b], 22, 140.0);
        let t = self.t;
        if roll < 0.3 {
            self.b.senzu_until = t + 15.0 + 5.0 * self.lvl(N_SENZU);
            let msg = format!("capsule: senzu beans — ×{} for {}s", self.senzu_x(), 15.0 + 5.0 * self.lvl(N_SENZU));
            self.event(msg);
        } else if roll < 0.6 {
            let g = self.wrate() * 150.0;
            self.gain_at(g, c.x, c.y - 8.0, true);
            self.event(format!("capsule: +{}", fmt_short(js_round(g))));
        } else if roll < 0.82 {
            self.s.orbs7 += 1;
            if self.s.orbs7 >= 7 {
                self.s.orbs7 = 0;
                self.summon();
            } else {
                let msg = format!("capsule: a dragon ball! {}/7", self.s.orbs7);
                self.event(msg);
            }
            self.goal("ball", 1.0, false);
        } else {
            let r = (self.r() * 3.0) as u32;
            self.s.aura = 1 + (self.s.aura + r) % 4;
            self.event("capsule: a new aura colour");
        }
    }

    fn open_gadget(&mut self, x: f64, y: f64) {
        self.ach("westcity");
        self.burst_at(x, y - 5.0, &[0xffffff, 0xf2c84a, 0x4a8ad0], 18, 120.0);
        self.cue(Cue::Sfx("coin"));
        let roll = self.r();
        let t = self.t;
        if roll < 0.3 {
            self.b.robot_until = t + 10.0;
            self.event("capsule: a training robot — it taps for you for 10s");
        } else if roll < 0.55 {
            self.b.gadget_until = t + 15.0;
            self.event("capsule: a gravity machine — ×1.5 for 15s");
        } else if roll < 0.8 {
            self.b.bike_until = t + 12.0;
            self.event("capsule: a hover bike — full sprint for 12s");
        } else {
            self.tl.orbs.push(Orb { phi: self.phi + 0.8, star: true, done: false });
            self.event("capsule: a dragon radar — a dragon ball just ahead");
        }
    }

    /// game.js `topSync()`: the arena takes the universes erased so far, and is rebuilt if it's up.
    pub(crate) fn top_sync(&mut self) {
        self.top_uni = self.s.uni;
        if self.s.world == 9 {
            self.scenery();
        }
    }

    /// `trip(w)`: a visit, 45 seconds (snake way's run 75).
    pub(crate) fn trip(&mut self, w: u32) {
        self.travel(w);
        self.tl.namek_until = self.t + if self.s.world == 3 { 75.0 } else { 45.0 };
    }

    /// `travel(w)`: off to another world (or home).
    pub(crate) fn travel(&mut self, w: u32) {
        if !self.playing {
            return;
        }
        self.s.world = w;
        self.s.been |= 1 << w;
        self.cam.layout(w);
        self.scenery();
        self.flash_t = 1.0;
        self.shake = 0.5;
        let (x, y) = self.hand_pos();
        self.burst_at(x, y, &[0xffffff, 0xdfe6e8, 0x9adada], 40, 220.0);
        self.event_ms(TRAVEL[w as usize], if w >= 3 { 6000.0 } else { 2600.0 });
        if w != 0 {
            self.cue(crate::hud::Cue::Notify("trip", crate::hud::WORLD_FULL[w as usize].into()));
        }
        if let Some(&(_, a)) = WORLD_ACH.iter().find(|x| x.0 == w) {
            self.ach(a);
        }
        if w == 2 {
            self.ach("vegeta");
            self.tl.next_moon = 3.0;
            if self.tl.boss.is_none() {
                self.tl.next_nappa = 6.0;
            }
        }
        if w == 3 {
            self.start_snake();
            self.tl.meteors.clear();
            self.tl.storm = None;
            self.tl.moon = None;
        } else {
            self.tl.snk = None;
        }
        self.tl.bz = if w == 4 { Some(Beerus { c: self.cap_pt(0.3, 4.4), noise: 0.0, awake: 0.0 }) } else { None };
        self.tl.pud = None;
        self.tl.gadgets.clear();
        self.tl.next_gadget = 2.0;
    }

    // ── snake way

    fn start_snake(&mut self) {
        let mut orbs = Vec::new();
        for i in 0..16 {
            let p = 0.05 + i as f64 * 0.055 + self.r() * 0.02;
            let u = [-1.0, 0.0, 1.0][(self.r() * 3.0) as usize] * 0.52;
            orbs.push(SnakeOrb { p, u, s: p * END, got: false });
        }
        let mut ghosts = Vec::new();
        for i in 0..6 {
            let p = 0.1 + i as f64 * 0.13 + self.r() * 0.04;
            let ph = self.r() * 6.0;
            let u = (self.r() * 2.0 - 1.0) * 0.6;
            let h = 1.6 + self.r() * 1.4;
            ghosts.push(Ghost { p, ph, u, h, s: p * END + 10.0, dead: false, sx: None, r: 0.0 });
        }
        let sky = (0..18).map(|i| SkyOrb { p: 0.07 + i as f64 * 0.048 + self.r() * 0.012, got: false, miss: false }).collect();
        let (mut gaps, mut spikes) = (Vec::new(), Vec::new());
        let mut s = 45.0;
        while s < END - 70.0 {
            gaps.push((s, s + 3.4));
            let ss = s + 24.0 + self.r() * 10.0;
            let u = [-1.0, 0.0, 1.0][(self.r() * 3.0) as usize] * 0.52;
            spikes.push(Spike { s: ss, u });
            s += 62.0 + self.r() * 22.0;
        }
        let (w, h) = (self.cam.w, self.cam.h);
        self.tl.snk = Some(Snake {
            p: 0.0,
            phi0: self.phi,
            t0: self.t,
            done: 0.0,
            orbs,
            ghosts,
            sky,
            gaps,
            spikes,
            streak: 0,
            streak_t: 0.0,
            got: 0,
            blasted: 0,
            dash: 0.0,
            x: 0.0,
            spin: 0.0,
            hx: w / 2.0,
            hy: h / 2.0,
            sh: 28.0,
            shots: Vec::new(),
        });
        if self.snake_nimbus {
            self.riding = 30.0;
        }
        self.after(2.8, Later::SnakeTip);
    }

    fn straight(&self) -> bool {
        let p = self.tl.snk.as_ref().unwrap().p;
        (bend_s(p * END + 9.0) - bend_s(p * END)).abs() < 0.22
    }

    /// `blastGhost`: a lost soul sent back down to HFIL.
    pub(crate) fn blast_ghost(&mut self, gi: usize) {
        let t = self.t;
        let snk = self.tl.snk.as_mut().unwrap();
        snk.ghosts[gi].dead = true;
        snk.blasted += 1;
        if let Some((x, y)) = snk.ghosts[gi].sx {
            snk.shots.push((x, y, t));
        }
        self.s.souls += 1;
        if self.s.souls >= 10 {
            self.ach("souls10");
        }
        let at = self.tl.snk.as_ref().unwrap().ghosts[gi].sx;
        self.burst_seen(at, &[0xffffff, 0xdff4ff, 0xfff3a0], 18, 120.0);
        let n = Big::from(90.0).max(self.wrate() * 12.0);
        match self.tl.snk.as_ref().unwrap().ghosts[gi].sx {
            Some((sx, sy)) => self.gain_at(n, sx, sy - 8.0, true),
            None => self.gain(n),
        }
        self.cue(Cue::Sfx("beam"));
        self.ach("hfil");
    }

    pub(crate) fn snake_tap(&mut self, px: f64, py: f64) {
        let Some(snk) = self.tl.snk.as_ref() else { return };
        if snk.done != 0.0 {
            return;
        }
        if let Some(gi) = snk.ghosts.iter().position(|g| !g.dead && g.sx.is_some_and(|(x, y)| hypot(&[px - x, py - y]) < g.r + 8.0)) {
            self.blast_ghost(gi);
            return;
        }
        let dash = self.straight();
        if dash {
            self.tl.snk.as_mut().unwrap().dash = self.t + 0.8;
        }
        self.sprint = 1.2f64.min(self.sprint + if dash { 1.2 } else { 0.5 });
        if self.tl.jump_h <= 0.0 {
            self.tl.jump_v = 120.0;
        }
        let n = (1.0 + self.s.lvf(Upg::Boots) * self.ms(Upg::Boots)) * self.mult(false) * (1.0 + 0.5 * self.lvl(N_FIST));
        self.gain(n);
        self.cue(Cue::Sfx("tap"));
        self.cue(Cue::Bump);
    }

    pub(crate) fn update_snake(&mut self, t: f64, dt: f64) {
        if self.tl.snk.is_none() {
            self.start_snake();
        }
        let snk = self.tl.snk.as_mut().unwrap();
        snk.spin += dt * 0.35;
        if snk.done != 0.0 {
            let tg = -0.52 + 6.283 * js_round((snk.spin + 0.52) / 6.283);
            snk.spin += (tg - snk.spin) * 1f64.min(dt * 2.2) - dt * 0.35;
            if t - snk.done > BEAT {
                self.tl.namek_until = t;
            }
            return;
        }
        snk.p = 1f64.min(snk.p.max((self.phi - snk.phi0) / (6.283 * SN_LAPS)));
        let p = snk.p;
        for i in 0..self.tl.snk.as_ref().unwrap().orbs.len() {
            let o = &mut self.tl.snk.as_mut().unwrap().orbs[i];
            if !o.got && o.p <= p {
                o.got = true;
                self.tl.snk.as_mut().unwrap().got += 1;
                let n = Big::from(5.0).max(self.wrate() * 1.5);
                let snk = self.tl.snk.as_ref().unwrap();
                let (hx, hy) = (snk.hx, snk.hy);
                self.gain_at(n, hx, hy - 18.0, true);
                self.cue(Cue::Sfx("coin"));
            }
        }
        for g in self.tl.snk.as_mut().unwrap().ghosts.iter_mut() {
            if !g.dead && p > g.p + 0.1 {
                g.dead = true;
            }
        }
        for i in 0..self.tl.snk.as_ref().unwrap().sky.len() {
            let o = self.tl.snk.as_ref().unwrap().sky[i].clone();
            if !o.got && !o.miss && o.p <= p {
                if self.tl.jump_h > 10.0 {
                    let snk = self.tl.snk.as_mut().unwrap();
                    snk.sky[i].got = true;
                    snk.streak = 8.min(snk.streak + 1);
                    snk.streak_t = t;
                    let streak = snk.streak;
                    if streak >= 8 {
                        self.ach("streak");
                    }
                    let n = Big::from(40.0).max(self.wrate() * 8.0 * (1.0 + streak as f64 * 0.25));
                    let snk = self.tl.snk.as_ref().unwrap();
                    let (hx, hy) = (snk.hx, snk.hy);
                    self.gain_at(n, hx, hy - 26.0, true);
                    self.cue(Cue::Sfx("coin"));
                } else {
                    let snk = self.tl.snk.as_mut().unwrap();
                    snk.sky[i].miss = true;
                    snk.streak = 0;
                }
            }
        }
        let snk = self.tl.snk.as_mut().unwrap();
        let here = snk.p * END + 1.6;
        let o = snk.orbs.iter().find(|o| !o.got && o.s > here && o.s - here < 14.0).map(|o| o.u);
        let sp = snk.spikes.iter().find(|q| q.s > here && q.s - here < 6.0).map(|q| q.u);
        let lane = if snk.p > 0.9 {
            0.0
        } else if let Some(u) = o {
            u
        } else if let Some(u) = sp {
            if u != 0.0 {
                0.0
            } else {
                0.52
            }
        } else {
            0.0
        };
        snk.x += (lane - snk.x) * 1f64.min(dt * 5.0);
        if snk.p >= 1.0 {
            snk.done = t;
            let t0 = snk.t0;
            self.ach("snakeway");
            let g = Big::from(300.0).max(self.wrate() * 100.0);
            let snk = self.tl.snk.as_ref().unwrap();
            let (hx, hy) = (snk.hx, snk.hy);
            self.gain_at(g, hx, hy - 16.0, true);
            self.event(format!("made it to king kai's planet at {}s! +{}", to_fixed(t - t0, 0), fmt_short(js_round(g))));
            self.victory();
            self.cue(Cue::Sfx("form"));
            let snk = self.tl.snk.as_ref().unwrap();
            let (x, y) = (snk.hx, snk.hy);
            self.burst_at(x, y, &[0xffffff, 0xfff3a0, 0xffd23a, 0x8ad65a], 36, 160.0);
        }
    }

    // ── the dragon

    /// `summon()`: the dragon rises (or waits until you're off snake way and the fight is over).
    pub fn summon(&mut self) {
        if self.tl.shen.is_some() {
            return;
        }
        if self.s.world == 3 {
            self.tl.summon_later = true;
            return;
        }
        if self.boss_up() {
            if !self.tl.summon_later {
                self.event("seven dragon balls — the dragon waits until the fight is over");
            }
            self.tl.summon_later = true;
            return;
        }
        let porunga = self.s.world == 1;
        self.tl.shen = Some(Shen {
            t0: self.t,
            phase: Phase::Rise,
            phase_t: self.t,
            wishes: if porunga { 3 } else { 1 },
            porunga,
            t1: 0.0,
            offer: Vec::new(),
            offer_json: String::new(),
            look: self.tl.shen_look,
        });
        self.ach(if porunga { "porunga" } else { "shenron" });
        self.cue(crate::hud::Cue::Sfx("dragon"));
        self.cue(crate::hud::Cue::Notify("shenron", if porunga { "porunga" } else { "shenron" }.into()));
        self.event(if porunga { "porunga awakens — three wishes…" } else { "the eternal dragon awakens…" });
    }

    fn wish_ok(&self, key: &str) -> bool {
        match key {
            "form" => self.s.form < self.forms.len() - 1,
            "bigape" => self.s.ach.contains("ape") && !self.s.big_ape,
            "skills" => TREE.iter().enumerate().any(|(i, n)| self.s.tree[i] > 0 && self.s.tree[i] < n.max),
            "gear" => self.s.levels.iter().any(|&l| l > 0),
            "fly" => !self.wished(WishBuff::Fly),
            "idle" => self.passive() > 0.0,
            "fuse" | "bubbles" => self.s.lv(Upg::Partner) > 0,
            "kaio" => self.s.lv(Upg::Kaio) > 0,
            "trip" => self.s.world == self.home(),
            _ => true,
        }
    }

    /// `openWish()`: the dragon offers three (rarer ones less often), plus krillin while he's dead.
    fn open_wish(&mut self) {
        let t = self.t;
        let mut pool: Vec<(usize, f64)> = Vec::new();
        for (i, &(key, tier)) in WISHES[..KRILLIN_WISH].iter().enumerate() {
            if self.wish_ok(key) {
                let r = self.r();
                pool.push((i, crate::jsmath::pow(r, 1.0 / tier.odds())));
            }
        }
        pool.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());
        let mut offer: Vec<usize> = pool.iter().take(3).map(|p| p.0).collect();
        if let Some(w) = self.tl.wish_force.filter(|&w| self.wish_ok(WISHES[w].0) && !offer.contains(&w)) {
            offer.truncate(2);
            offer.push(w);
        }
        if self.s.krillin_dead && self.s.hero != Hero::Krillin {
            offer.push(KRILLIN_WISH);
        }
        let text = self.offer_json(&offer);
        let sh = self.tl.shen.as_mut().unwrap();
        sh.phase = Phase::Wish;
        sh.phase_t = t;
        sh.offer = offer;
        sh.offer_json = text.clone();
        self.cue(crate::hud::Cue::Wish(text));
    }

    /// Grants a wish by key (the HUD's pick, or the rarest of the three after 20s).
    pub fn pick(&mut self, key: &str) {
        self.pick_as(key, false);
    }

    /// game.js's `pick(k, auto)`: `auto` is the dragon choosing for you after 20s.
    fn pick_as(&mut self, key: &str, auto: bool) {
        let t = self.t;
        let Some(sh) = self.tl.shen.as_mut().filter(|s| s.phase == Phase::Wish) else { return };
        sh.phase = Phase::Granting;
        sh.phase_t = t;
        if let Some(&w) = sh.offer.iter().find(|&&w| WISHES[w].0 == key) {
            self.grant(WISHES[w].0);
            self.s.granted += 1;
            if auto {
                // the label as game.js reads it, after the grant
                let (_, label, _, tier) = self.wish_text(w);
                self.cue(Cue::WishDone);
                self.event_ms(format!("20s and no answer — the dragon grants the rarest: {label} ({tier})"), 4500.0);
            }
        }
        self.cue(Cue::Fx("super"));
        let sh = self.tl.shen.as_mut().unwrap();
        sh.wishes -= 1;
        if sh.wishes > 0 {
            self.after(1.4, Later::NextWish);
            return;
        }
        sh.phase = Phase::Leave;
        sh.t1 = t;
        sh.phase_t = t;
    }

    fn buff(&mut self, k: WishBuff, secs: f64, msg: &str) {
        self.wish_buff[k as usize] = self.t + secs;
        self.event(format!("your wish is granted — {msg}"));
    }

    fn grant(&mut self, key: &str) {
        let t = self.t;
        match key {
            "power" => {
                self.s.wishes += 1;
                self.event("your wish is granted — ×1.25 forever");
            }
            "form" => {
                if self.s.form >= self.forms.len() - 1 {
                    return;
                }
                let from = self.tl.preview.map_or(self.s.form, |p| p.0);
                self.tl.preview = Some((from, t + 60.0));
                self.transform(true);
            }
            "seeds" => {
                let g = self.wish_seeds();
                self.s.seeds += g;
                self.s.ascend += g;
                let msg = format!("your wish is granted — +{} ki seeds (×{} on everything)", big_string(g), fixed1(self.seed_boost()));
                self.event(msg);
                self.cue(crate::hud::Cue::TreeGift(format!("+{} ki seeds from shenron", big_string(g))));
            }
            "bigape" => {
                self.s.big_ape = true;
                self.tl.next_moon = self.tl.next_moon.min(8.0);
                self.event("your wish is granted — the next full moon makes a giant");
            }
            "fortune" => {
                let g = self.wrate() * 600.0;
                self.gain(g);
                self.event(format!("your wish is granted — +{}", fmt_short(g)));
            }
            "skills" => {
                for (i, n) in TREE.iter().enumerate() {
                    if self.s.tree[i] > 0 && self.s.tree[i] < n.max {
                        self.s.tree[i] += 1;
                    }
                }
                self.event("your wish is granted — every ki talent +1 rank");
                self.cue(crate::hud::Cue::TreeGift("+1 rank on every talent from shenron".into()));
            }
            "gear" => {
                for l in self.s.levels.iter_mut() {
                    if *l > 0 {
                        *l += 1;
                    }
                }
                for (n, id) in [(10, "tail10"), (25, "tail25"), (50, "tail50")] {
                    if self.s.lv(Upg::Tail) >= n {
                        self.ach(id);
                    }
                }
                self.event("your wish is granted — every shop upgrade +1 level");
            }
            "fly" => {
                self.buff(WishBuff::Fly, 30.0, "flying for 30s — laps ×1.8");
                self.ach("flight");
            }
            "fast" => self.buff(WishBuff::Fast, 180.0, "running 50% faster for 3 minutes"),
            "taps" => self.buff(WishBuff::Taps, 180.0, "taps ×3 for 3 minutes"),
            "idle" => self.buff(WishBuff::Idle, 180.0, "idle income ×3 for 3 minutes"),
            "laps" => self.buff(WishBuff::Laps, 180.0, "laps pay ×3 for 3 minutes"),
            "crit" => self.buff(WishBuff::Crit, 60.0, "every tap crits for 1 minute"),
            "combo" => self.buff(WishBuff::Combo, 120.0, "max combo for 2 minutes"),
            "senzu" => {
                self.b.senzu_until = self.b.senzu_until.max(t + 120.0);
                let msg = format!("your wish is granted — senzu ×{} for 2 minutes", self.senzu_x());
                self.event(msg);
            }
            "fuse" => {
                self.b.fuse_until = t + 30.0;
                self.ach("fusion");
                self.event("your wish is granted — fusion ha! ×2 for 30s");
            }
            "kaio" => {
                self.b.kaio_until = t + 15.0;
                self.b.kaio_ready = t + 15.0;
                let msg = format!("your wish is granted — {} ×{}, and you won't get tired", self.boost(), self.kaio_x());
                self.event(msg);
            }
            "bubbles" => {
                self.s.levels[Upg::Partner as usize] += 5;
                self.event("your wish is granted — bubbles +5 levels");
            }
            "trip" => {
                self.tl.pod_wish = 1;
                self.event("your wish is granted — a space pod is on its way");
            }
            "radar" => {
                self.s.orbs7 = 6.min(self.s.orbs7 + 3);
                let msg = format!("your wish is granted — {}/7 dragon balls already", self.s.orbs7);
                self.event(msg);
            }
            "again" => {
                self.tl.shen.as_mut().unwrap().wishes += 1;
                self.event("your wish is granted — one more wish!");
            }
            "satan" => {
                let g = self.wrate() * 30.0;
                self.gain(g);
                self.event(format!("mr. satan signs it with a flourish — +{}. it's worthless.", fmt_short(g)));
            }
            "krillin" => {
                self.s.krillin_dead = false;
                self.s.krillin_ally = true;
                self.s.krillin_revives += 1;
                self.tl.next_kril = 240.0;
                self.event("krillin is back! \"did i miss anything?\" — he trains with you: idle ×1.5 and destructo discs");
            }
            _ => unreachable!("no wish {key}"),
        }
    }

    /// The dragon's timeline (`shenStep`), every frame, playing or not.
    pub(crate) fn shen_step(&mut self, t: f64) {
        if self.tl.summon_later && self.s.world != 3 && self.tl.shen.is_none() && !self.boss_up() {
            self.tl.summon_later = false;
            self.summon();
        }
        let Some(sh) = self.tl.shen.as_ref() else { return };
        let (age, in_phase) = (t - sh.t0, t - sh.phase_t);
        match sh.phase {
            Phase::Rise if age > 4.4 + self.shen_delay() => self.open_wish(),
            Phase::Wish if in_phase > 20.0 => {
                // no answer: the rarest of the three (the first offered wins a tie)
                let three = &sh.offer[..sh.offer.len().min(3)];
                let best = three.iter().copied().reduce(|a, w| if WISHES[w].1 > WISHES[a].1 { w } else { a }).unwrap();
                self.pick_as(WISHES[best].0, true);
            }
            Phase::Granting if in_phase > 6.0 => self.open_wish(),
            Phase::Leave if t - sh.t1 > 1.7 => self.tl.shen = None,
            _ => {}
        }
    }

    // ── movies

    fn start_movie(&mut self, who: &'static str, t: f64, metal: bool) {
        let o = MOVIES.iter().find(|m| m.who == who).unwrap();
        let arm = 1.0 + 0.5 * self.s.lvf(Upg::Armor);
        let bb = self.s.lvf(Upg::Bigbang);
        let dps = (self.tap_power() * self.mult(true) * 6.0 * 4.0 * 1.5 * (1.0 + 0.5 * self.lvl(N_FIST)) * (1.0 + 0.5 * self.lvl(N_BRAWL))
            + if bb > 0.0 { self.wrate().max(self.lap_value() * self.mult(true)) * 12.0 * bb / 2.5 } else { Big::ZERO })
            * arm;
        let wr = self.wrate();
        let hp = Big::from(600.0).max(wr * 26.0).max(dps * o.hp[0]);
        let mh = Big::from(150.0).max(wr * 5.0).max(dps * o.hp[1]);
        let name = if metal { "metal cooler".to_string() } else { who.to_string() };
        let mut b = Boss::new(0, name, movie_dim(who), hp, t, t + 90.0);
        b.movie = true;
        b.struggled = true;
        self.new_boss(b);
        // metal cooler comes without his squadron: his clones are the guard
        let minions = (if metal { &[][..] } else { o.minions })
            .iter()
            .map(|&name| Henchman { name, spr: movie_dim(name), hp: mh, max: mh, twin: false, dead: false, x: None, y: 0.0, k: 1.0, flash: 0.0 })
            .collect();
        let metal = metal.then(|| self.metal_start());
        self.tl.movie = Some(Movie {
            o,
            boss: self.tl.boss_ids,
            t0: t,
            minions,
            twin: None,
            next_say: 0.0,
            flip_until: 0.0,
            flips: 0,
            web: None,
            next_web: t + 5.0,
            nova: None,
            over: 0.0,
            wob: if o.jelly { t + 1.6 } else { 0.0 },
            metal,
        });
        self.tl.last_movie = who;
        self.krillin_hit(who);
        self.cue(Cue::Sfx("boss"));
        self.shake = 0.5;
        let clones = self.tl.movie.as_ref().unwrap().metal.as_ref().map(|m| m.alive() > 0);
        self.event_ms(
            match clones {
                Some(true) => "metal coolers — break one, two more appear. find the real one",
                Some(false) => "metal cooler drops in",
                None => o.intro,
            },
            5000.0,
        );
    }

    fn say(&mut self, s: &str) {
        let t = self.t;
        let m = self.tl.movie.as_mut().unwrap();
        if t > m.next_say {
            m.next_say = t + 4.0;
            self.event(s);
        }
    }

    /// True when a hit on the movie villain is turned away.
    fn movie_guard(&mut self, dmg: Big, x: f64, y: f64) -> bool {
        let id = self.tl.boss.as_ref().unwrap().id;
        let Some(m) = self.tl.movie.as_ref().filter(|m| m.boss == id) else { return false };
        if !m.o.minions.is_empty() && m.minions.iter().any(|h| !h.dead) {
            let s = if m.o.who == "cooler" {
                "cooler: \"my squadron will deal with you\" — take them out first"
            } else {
                "bojack just laughs behind his gang — beat them first"
            };
            self.burst_at(x, y, &[0xffffff, 0xd8c8ff, 0x8a6ad8], 5, 60.0);
            self.say(s);
            return true;
        }
        let arm = 1.0 + 0.5 * self.s.lvf(Upg::Armor);
        let twin_up = m.twin.is_some_and(|i| !m.minions[i].dead);
        let b = self.tl.boss.as_mut().unwrap();
        if twin_up && b.hp - dmg * arm <= 0.0 {
            b.hp = Big::from(1.0);
            b.flash = 0.12;
            self.burst_at(x, y, &[0xffffff, 0xd8c8ff, 0x8a6ad8], 5, 60.0);
            self.say("his other half holds him together — beat the double first");
            return true;
        }
        false
    }

    /// Dr. gero (or android 19) is hit: he lets go, and what he drained comes back twice over.
    pub(crate) fn free_gero(&mut self) {
        let Some(g) = self.tl.gero.take() else { return };
        let n = (g.drained * 2.0).max(self.wrate() * 20.0);
        self.gain_at(n, g.x, g.y - g.spr.h - 4.0, true);
        self.ach("gero");
        self.event(format!("{} lets go — you take it all back, twice over: +{}", g.name, fmt_short(js_round(n))));
        self.burst_at(g.x, g.y - 10.0, &[0xffffff, 0xffe08a, 0xe0473e], 20, 160.0);
        self.cue(Cue::Sfx("hit"));
    }

    pub(crate) fn movie_hit(&mut self, i: usize, dmg: Big) {
        let arm = 1.0 + 0.5 * self.s.lvf(Upg::Armor);
        let h = &mut self.tl.movie.as_mut().unwrap().minions[i];
        if h.dead {
            return;
        }
        h.hp -= dmg * arm;
        h.flash = 0.12;
        let at = h.x.map(|x| (x, h.y - 10.0));
        self.burst_seen(at, &[0xffffff, 0xffe08a, 0xff9a3c], 5, 60.0);
        let h = &mut self.tl.movie.as_mut().unwrap().minions[i];
        if h.hp > 0.0 {
            return;
        }
        h.dead = true;
        let (name, twin) = (h.name, h.twin);
        self.burst_seen(at, &[0xffffff, 0xffe08a, 0xe0473e], 16, 140.0);
        if name == "bujin" {
            self.tl.movie.as_mut().unwrap().web = None;
        }
        let g = Big::from(100.0).max(self.wrate() * if twin { 20.0 } else { 5.0 });
        let h = &self.tl.movie.as_ref().unwrap().minions[i];
        match h.x {
            Some(hx) => {
                let hy = h.y - h.spr.h * h.k - 6.0;
                self.gain_at(g, hx, hy, true)
            }
            None => self.gain(g),
        }
        let m = self.tl.movie.as_ref().unwrap();
        if twin {
            self.event("one janemba down — the real one is open");
        } else if m.minions.iter().all(|x| x.dead) {
            let msg = if m.o.who == "cooler" { "cooler: \"useless. i'll do it myself\"" } else { "the gang is down — bojack steps up" };
            self.event(msg);
        }
    }

    pub(crate) fn break_web(&mut self, s: &str) {
        let m = self.tl.movie.as_mut().unwrap();
        m.web = None;
        m.next_web = self.t + 9.0;
        self.event(s);
        let (x, y) = self.hand_pos();
        self.burst_at(x, y, &[0xffffff, 0xff9af0, 0x9ae84a], 14, 120.0);
    }

    fn movie_tap(&mut self, px: f64, py: f64) -> bool {
        let t = self.t;
        let Some(m) = self.tl.movie.as_ref() else { return false };
        if m.over != 0.0 {
            return false;
        }
        if m.flip_until > t {
            self.burst_at(px, py, &[0xf0d0ff, 0xa66ae0], 5, 40.0);
        }
        if let Some(i) = self.clone_at(px, py) {
            self.combo = if t - self.last_click < 0.6 { self.combo_cap().min(self.combo + 0.1) } else { 1.0 };
            self.last_click = t;
            let dmg =
                self.tap_power() * self.mult(false) * self.botched() * self.combo * 6.0 * (1.0 + 0.5 * self.lvl(N_FIST)) * (1.0 + 0.5 * self.lvl(N_BRAWL));
            self.clone_hit(i, dmg);
            self.cue(Cue::Sfx("hit"));
            return true;
        }
        let m = self.tl.movie.as_ref().unwrap();
        let hit = m
            .minions
            .iter()
            .position(|h| !h.dead && h.x.is_some_and(|x| (px - x).abs() < (h.spr.w / 2.0 + 2.0) * h.k && py > h.y - (h.spr.h + 2.0) * h.k && py < h.y + 3.0));
        if let Some(i) = hit {
            self.combo = if t - self.last_click < 0.6 { self.combo_cap().min(self.combo + 0.1) } else { 1.0 };
            self.last_click = t;
            let dmg =
                self.tap_power() * self.mult(false) * self.botched() * self.combo * 6.0 * (1.0 + 0.5 * self.lvl(N_FIST)) * (1.0 + 0.5 * self.lvl(N_BRAWL));
            self.movie_hit(i, dmg);
            self.cue(Cue::Sfx("hit"));
            let m = self.tl.movie.as_mut().unwrap();
            if m.minions[i].name == "bujin" {
                if let Some(web) = m.web.as_mut() {
                    web.1 += 1;
                    if web.1 >= 3 {
                        self.break_web("you tore through the psychic web");
                    }
                }
            }
            return true;
        }
        if self.tl.movie.as_ref().unwrap().web.is_some() {
            self.webbed(px, py);
            return true;
        }
        false
    }

    fn movie_blast(&mut self, dmg: Big) {
        let Some(m) = self.tl.movie.as_ref() else { return };
        if m.over != 0.0 {
            return;
        }
        self.clones_wipe();
        let m = self.tl.movie.as_ref().unwrap();
        for i in 0..m.minions.len() {
            let h = &self.tl.movie.as_ref().unwrap().minions[i];
            if !h.dead && h.x.is_some() {
                self.movie_hit(i, dmg);
            }
        }
    }

    fn movie_tick(&mut self, t: f64) {
        let id = self.tl.boss.as_ref().map(|b| b.id);
        let m = self.tl.movie.as_ref().unwrap();
        if id != Some(m.boss) {
            self.tl.movie = None;
            return;
        }
        let o = m.o;
        let b = self.tl.boss.clone().unwrap();
        if b.dead {
            if m.over == 0.0 {
                self.clones_wipe();
                let m = self.tl.movie.as_mut().unwrap();
                m.over = t;
                m.web = None;
                m.flip_until = 0.0;
                for h in m.minions.iter_mut() {
                    h.dead = true;
                }
                if !b.fled {
                    let g = Big::from(500.0).max(self.wrate() * 70.0) * (1.0 + 0.5 * self.lvl(N_BOUNTY));
                    let (cx, cy) = (self.cam.cx, self.cam.cy - self.cam.r * 1.3);
                    self.gain_at(g, cx, cy, true);
                    self.ach(o.ach);
                    self.s.movies += 1;
                    if MOVIES.iter().all(|m| self.s.ach.contains(m.ach)) {
                        self.ach("movies3");
                    }
                    self.tl.movie_note = Some((t + 2.4, format!("{} — movie bonus +{}", o.win, fmt_short(js_round(g)))));
                }
            }
            return;
        }
        let m = self.tl.movie.as_mut().unwrap();
        if o.nova > 0.0 && m.metal.is_none() && m.nova.is_none() && t > m.t0 + 2.0 && m.minions.iter().all(|h| h.dead) {
            m.nova = Some((t, t + o.nova));
            let bm = self.tl.boss.as_mut().unwrap();
            bm.until = bm.until.max(t + o.nova + 2.0);
            self.event_ms(format!("cooler raises a supernova — {}s to bring him down", o.nova), 3500.0);
        }
        let m = self.tl.movie.as_mut().unwrap();
        if m.nova.is_some_and(|n| t > n.1) {
            self.flash_t = 1.0;
            self.shake = 1.0;
            self.b.tired_until = self.b.tired_until.max(t + 8.0);
            let (x, y, r) = (self.cam.cx, self.cam.cy - self.cam.r * 0.6, self.cam.r * 1.2);
            self.inp.blasts.push(crate::input::Blast { x, y, r, t0: t, kaio: false });
            self.cue(Cue::Sfx("boom"));
            self.event_ms("SUPERNOVA — you're knocked flat. tired ×0.75 for 8s, and cooler leaves you for dead", 4000.0);
            let bm = self.tl.boss.as_mut().unwrap();
            bm.dead = true;
            bm.fled = true;
            bm.t1 = t;
            return;
        }
        if o.split && m.twin.is_none() && b.hp < b.max * 0.5 {
            let hp = b.max * 0.35;
            m.minions.push(Henchman { name: "janemba", spr: b.spr(), hp, max: hp, twin: true, dead: false, x: None, y: 0.0, k: 1.0, flash: 0.0 });
            m.twin = Some(m.minions.len() - 1);
            m.wob = t + 1.0;
            self.shake = 0.5;
            self.event_ms("janemba splits in two! the real one won't fall while his double stands", 3500.0);
        }
        let m = self.tl.movie.as_mut().unwrap();
        if o.flip && m.flips < 3 && b.hp < b.max * (0.75 - 0.25 * m.flips as f64) {
            m.flips += 1;
            m.flip_until = t + 6.0;
            m.wob = t + 0.8;
            self.event_ms("janemba twists space — left is right for 6s: hit his reflection", 3500.0);
        }
        let m = self.tl.movie.as_mut().unwrap();
        if o.web && m.web.is_none() && t > m.next_web && m.minions.iter().any(|h| h.name == "bujin" && !h.dead) && t - m.t0 > 3.0 {
            m.web = Some((t, 0));
            self.event_ms("bujin's psychic web! your taps are stuck — tap bujin three times or fire a beam", 3500.0);
        }
        if self.tl.movie.as_ref().unwrap().web.is_some_and(|w| t - w.0 > 10.0) {
            self.break_web("the web frays and lets go");
        }
    }

    /// The full moon takes him: the great ape (a giant one with the wish), and the moon goes.
    pub(crate) fn moon_transform(&mut self) {
        let t = self.t;
        self.tl.ape = Ape { cd: 0.0, rage: 0.0, giant: self.s.big_ape, at: t, k: 2.3 };
        self.s.big_ape = false;
        self.b.ape_until = t + self.ape_len();
        self.tl.moon.as_mut().unwrap().leaving = true;
        self.ach("ape");
        let giant = self.tl.ape.giant;
        if giant {
            self.ach("giantape");
        }
        self.flash_t = 1.0;
        self.shake = 0.8;
        let tail = giant || self.s.lv(Upg::Tail) > 0;
        let msg = format!(
            "{} — ×{}{}",
            match self.ape_name(false) {
                "great ape" if giant => "a giant great ape",
                "great ape" => "great ape mode",
                own => own,
            },
            1.0 + self.ape_x(),
            if tail { format!(", tap to {}", if giant { "stomp" } else { "build rage" }) } else { String::new() }
        );
        self.event(msg);
        self.cue(Cue::Fx("super"));
        let q = self.kid_screen(20.0);
        self.spray(q.x, q.y, &[0xffffff, 0xffd0a0, 0x7a4a2a], 80, 220.0, 2.0, 1.0);
    }

    // ── taps

    /// `onClick(px, py)`: a tap at a spot on the canvas. Whatever's there takes it; anywhere else it trains.
    pub fn click(&mut self, px: f64, py: f64) {
        if !self.playing {
            return;
        }
        let t = self.t;
        if self.s.world == 3 && self.tl.snk.is_some() {
            self.snake_tap(px, py);
            return;
        }
        // a tap skips a boss's arrival
        if self.intro_skip() {
            return;
        }
        // a transformation's power-up takes every tap
        if self.xform_tap() {
            return;
        }
        // a tap on him while he eats knocks his ramen over
        if self.ramen_tap(px, py) {
            return;
        }
        // the self-destruct takes every tap; a cell jr., a piece of candy
        if self.cg_tap(px, py) || self.candy_tap(px, py) {
            return;
        }
        if let Some(d) = self.tl.dance.as_mut().filter(|d| d.done == 0.0) {
            if d.i < 3 && d.spoil != Some(d.i) {
                let b = d.beats[d.i];
                if (t - b).abs() < 0.32 {
                    d.hits += 1;
                    d.ok = t;
                    d.i += 1;
                } else if t > b - 0.8 {
                    d.spoil = Some(d.i);
                }
            }
            return;
        }
        let mut px = px;
        if let Some(m) = self.tl.movie.as_ref() {
            if m.flip_until > t {
                px = self.cam.w - px;
            }
            if self.movie_tap(px, py) {
                return;
            }
        }
        // hit's time skip swallows every tap
        if self.skipping() {
            self.cue(Cue::Sfx("tap"));
            return;
        }
        let npc_hit = |g: &Game, c: V3, r: f64| {
            let v = geom::ap(&g.cam.m, c);
            v[2] > 0.05 && hypot(&[px - (g.cam.cx + v[0] * g.cam.r), py - (g.cam.cy - v[1] * g.cam.r + g.cam.bob - 10.0)]) < r
        };
        if self.tl.bz.is_some() && t > self.tl.whis_ready && npc_hit(self, self.cap_pt(0.5, 3.3), 12.0) {
            self.tl.whis_ready = t + 45.0;
            self.b.whis_until = t + 20.0;
            self.event("whis: \"ohohoho — a little training?\" laps ×2 for 20s, but every tap is twice as loud");
            self.cue(Cue::Sfx("buy"));
            return;
        }
        if self.s.world == 7 && t > self.tl.chi_ready && npc_hit(self, self.cap_pt(0.45, 3.2), 12.0) {
            self.tl.chi_ready = t + 40.0;
            self.b.chi_until = t + 15.0;
            self.shake = 0.4;
            self.event("chi-chi: \"stop slacking and TRAIN!\" — a frying pan to the head: ×1.5 for 15s");
            self.cue(Cue::Sfx("hit"));
            return;
        }
        if self.s.world == 6 && t > self.tl.kame_ready && (npc_hit(self, self.cap_pt(0.5, 5.2), 14.0) || npc_hit(self, self.cap_pt(0.62, 4.1), 12.0)) {
            self.tl.kame_ready = t + 30.0;
            let turtle = npc_hit(self, self.cap_pt(0.5, 5.2), 14.0);
            let g = Big::from(200.0).max(self.rate() * if turtle { 15.0 } else { 30.0 });
            self.gain_at(g, px, py - 10.0, true);
            let p = fmt_short(js_round(g));
            let msg = if turtle {
                format!("umigame wakes up, yawns, and goes back to sleep. +{p}")
            } else {
                let what = ["bag of gold", "giant cake", "bicycle", "very convincing roshi"][(self.r() * 4.0) as usize];
                format!("oolong turns into a {what} — +{p}")
            };
            self.event(msg);
            return;
        }
        if self.tl.cling.is_some() {
            let k = self.kid_screen(12.0);
            if hypot(&[px - k.x, py - k.y]) < 16.0 {
                self.burst_at(k.x, k.y, &[0xffffff, 0xa6e67e, 0x58b848, 0x2f7a2a], 16, 110.0);
                let g = Big::from(60.0).max(self.wrate() * 20.0);
                self.gain_at(g, k.x, k.y - 16.0, true);
                self.event("shook the saibaman off — it pops harmlessly");
                self.tl.cling = None;
                return;
            }
        }
        // ginyu in your body, a deflect, a rescue; swapped in frieza's aim, a tap on yourself swaps back (no deflect)
        if self.ginyu_tap(px, py) || self.mech_tap(px, py) {
            return;
        }
        if let Some(s) = self.tl.struggle.as_mut() {
            s.p += 0.055;
            self.cue(Cue::Sfx("tap"));
            self.shake = self.shake.max(0.08);
            return;
        }
        if self.tl.spirit_ready && self.tl.spirit_shot.is_none() {
            let (bx, by, br) = self.spirit_pos();
            if hypot(&[px - bx, py - by]) < br + 8.0 {
                self.throw_spirit();
                return;
            }
        }
        if self.tl.fuse_offer <= t {
            self.bubbles_tap(px, py);
        }
        if let Some((mx, my, mk)) = self.tl.monkey_at {
            if self.tl.fuse_offer > t && hypot(&[px - mx, py - (my - 5.0 * mk)]) < 12.0 * mk {
                self.tl.fuse_offer = 0.0;
                self.b.fuse_until = t + 30.0;
                self.ach("fusion");
                self.flash_t = 1.0;
                self.shake = 0.6;
                self.event("fusion ha! vegebubs — ×2 for 30s");
                self.cue(Cue::Fx("super"));
                self.burst_at(mx, my - 6.0, &[0xffffff, 0xffe08a, 0xff9a3c, 0x6fb0ff], 50, 200.0);
                return;
            }
        }
        if let Some((x, y)) = self.tl.car.as_ref().and_then(|c| c.sx) {
            if hypot(&[px - x, py - (y - 6.0)]) < 16.0 {
                self.b.car_until = t + 15.0;
                self.event("riding with king kai — ×1.5 for 15s");
                self.cue(Cue::Sfx("coin"));
                self.burst_at(x, y - 6.0, &[0xffffff, 0xd8241e, 0xdfe3ea], 16, 110.0);
                self.tl.car = None;
                return;
            }
        }
        if let Some((x, y)) = self.tl.yam.as_ref().filter(|y| y.boom == 0.0 && !y.helped).and_then(|y| y.sx) {
            if hypot(&[px - x, py - (y - 3.0)]) < 12.0 {
                let ym = self.tl.yam.as_mut().unwrap();
                ym.helped = true;
                ym.until = t + 1.2;
                self.ach("yamcha");
                self.b.senzu_until = self.b.senzu_until.max(t + 10.0);
                let g = Big::from(200.0).max(self.wrate() * 40.0);
                self.gain_at(g, x, y - 10.0, true);
                let msg = format!("yamcha: \"i'm fine!\" — senzu ×{} for 10s", self.senzu_x());
                self.event(msg);
                self.cue(Cue::Sfx("coin"));
                return;
            }
        }
        if let Some((x, y)) = self.tl.greg.as_ref().and_then(|g| g.sx) {
            if hypot(&[px - x, py - (y - 4.0)]) < 10.0 {
                let g = Big::from(300.0).max(self.wrate() * 120.0) * (1.0 + 0.5 * 6f64.min(self.s.greg_wins as f64));
                self.s.greg_wins += 1;
                if self.s.greg_wins >= 5 && !self.s.ach.contains("greg5") {
                    self.ach("greg5");
                    self.s.spirit = 1;
                    self.after(4.2, Later::Event("king kai taught you the spirit bomb — it charges on its own, tap the ball".into(), 2600.0));
                }
                self.gain_at(g, x, y - 10.0, true);
                let msg = format!("you caught gregory! +{} — race {} won", fmt_short(js_round(g)), self.s.greg_wins);
                self.event(msg);
                self.cue(Cue::Sfx("coin"));
                self.burst_at(x, y - 4.0, &[0xffffff, 0xd8a868, 0xa8743a], 18, 120.0);
                self.tl.greg = None;
                return;
            }
        }
        if let Some((x, y)) = self.tl.kai.as_ref().filter(|k| k.flag == 0.0).and_then(|k| k.sx) {
            if hypot(&[px - x, py - (y - 8.0)]) < 12.0 {
                self.tl.kai.as_mut().unwrap().flag = 1.0;
                self.b.laugh_until = t + 10.0;
                self.event("ha! ha! ha! — ×1.25 for 10s");
                self.cue(Cue::Sfx("coin"));
                self.burst_at(x, y - 14.0, &[0xffffff, 0xbfe9ff, 0x3a7ad8], 14, 90.0);
                return;
            }
        }
        if let Some(g) = self.tl.gero.as_ref() {
            if hypot(&[px - g.x, py - (g.y - g.spr.h / 2.0)]) < 16.0 {
                self.free_gero();
                return;
            }
        }
        if let Some((x, y)) = self.tl.date.as_ref().filter(|d| d.kr && !d.paid).and_then(|d| d.sx2) {
            if hypot(&[px - x, py - (y - 9.0)]) < 11.0 {
                let d = self.tl.date.as_mut().unwrap();
                d.paid = true;
                d.until = d.until.min(t + 2.0);
                let g = Big::from(400.0).max(self.wrate() * 90.0);
                self.gain_at(g, x, y - 18.0, true);
                self.ach("wallet");
                self.event(format!("krillin hands over his whole wallet without looking: +{}", fmt_short(js_round(g))));
                self.cue(Cue::Sfx("coin"));
                return;
            }
        }
        if let Some(a) = self.tl.a16.as_mut() {
            if let Some(b) = a.birds.iter_mut().find(|b| b.free == 0.0 && b.sx.is_some_and(|(x, y)| hypot(&[px - x, py - y]) < 7.0)) {
                b.free = t;
                self.b.calm_until = t + 12.0;
                self.ach("birds");
                self.event("16: \"thank you.\" — calm ×1.25 for 12s");
                return;
            }
        }
        if let Some(i) = self.tl.gadgets.iter().position(|g| g.sx.is_some_and(|(x, y)| hypot(&[px - x, py - (y - 5.0)]) < 10.0)) {
            let (x, y) = self.tl.gadgets.remove(i).sx.unwrap();
            self.open_gadget(x, y);
            return;
        }
        if let Some((x, y)) = self.tl.pud.as_ref().and_then(|p| p.sx) {
            if hypot(&[px - x, py - (y - 4.0)]) < 11.0 {
                let g = Big::from(500.0).max(self.wrate() * 60.0);
                self.gain_at(g, x, y - 12.0, true);
                if let Some(bz) = self.tl.bz.as_mut() {
                    bz.awake = 0.0;
                    bz.noise = 0.0;
                }
                self.tl.pud = None;
                self.ach("pudding");
                self.event(format!("pudding! beerus dozes off happy — +{}", fmt_short(js_round(g))));
                self.cue(Cue::Sfx("coin"));
                return;
            }
        }
        if let Some((x, y)) = self.tl.roshi.as_ref().filter(|r| r.flag == 0.0).and_then(|r| r.sx) {
            if hypot(&[px - x, py - (y - 9.0)]) < 12.0 {
                let r = self.tl.roshi.as_mut().unwrap();
                r.flag = t;
                r.until = t + 5.0;
                self.shake = 0.5;
                self.event("roshi: \"MAX POWER!\"");
                self.cue(Cue::Sfx("form"));
                return;
            }
        }
        if let Some((x, y)) = self.tl.zen.as_ref().and_then(|z| z.sx) {
            if hypot(&[px - x, py - (y - 9.0)]) < 13.0 {
                self.cue(crate::hud::Cue::Sfx("coin"));
                self.event("zeno: \"want to push my button? it's fun!\"");
                self.cue(crate::hud::Cue::Zeno);
                return;
            }
        }
        if let Some(s) = self.tl.satan.clone() {
            if let Some((x, y)) = s.sx.filter(|_| t > s.t0) {
                if hypot(&[px - x, py - (y - 10.0)]) < 13.0 {
                    self.gain_at(s.prize, x, y - 20.0, true);
                    self.ach("satan");
                    self.event_ms(format!("hercule cash prize! +{} — \"keep it between us, kid\"", fmt_short(js_round(s.prize))), 3500.0);
                    self.cue(Cue::Sfx("coin"));
                    self.burst_at(x, y - 12.0, &[0xffffff, 0xf2c84a, 0xb88a1a], 18, 120.0);
                    self.tl.satan = None;
                    return;
                }
            }
        }
        if let Some((x, y)) = self.tl.door.as_ref().and_then(|d| d.sx) {
            if hypot(&[px - x, py - (y - 9.0)]) < 13.0 {
                self.tl.chamber_t0 = t;
                self.b.chamber_until = t + 15.0;
                self.flash_t = 1.0;
                self.ach("chamber");
                let msg = format!("hyperbolic time chamber — time slows, training ×{} for 15s", self.chamber_x());
                self.event(msg);
                self.cue(Cue::Sfx("form"));
                self.tl.door = None;
                return;
            }
        }
        if let Some(g) = self.tl.ginyu.as_ref().filter(|g| g.done == 0.0) {
            if let Some(mi) =
                g.members.iter().position(|m| !m.dead && (px - m.x).abs() < (m.spr.w / 2.0 + 2.0) * m.k && py > m.y - (m.spr.h + 2.0) * m.k && py < m.y + 3.0)
            {
                self.combo = if t - self.last_click < 0.6 { self.combo_cap().min(self.combo + 0.1) } else { 1.0 };
                self.last_click = t;
                let dmg =
                    self.tap_power() * self.mult(false) * self.botched() * self.combo * 6.0 * (1.0 + 0.5 * self.lvl(N_FIST)) * (1.0 + 0.5 * self.lvl(N_BRAWL));
                let x = self.ginyu_rude(mi);
                self.ginyu_hit(mi, dmg * x);
                if x > 1.0 {
                    self.ginyu_rude_pop(mi, dmg * x);
                }
                self.cue(Cue::Sfx("hit"));
                return;
            }
        }
        if let Some(c) = self.tl.capsule.as_ref() {
            if hypot(&[px - c.x, py - c.y]) < 11.0 {
                self.open_capsule();
                return;
            }
        }
        if let Some(s) = self.tl.star.clone() {
            if hypot(&[px - s.x, py - s.y]) < 13.0 {
                self.b.boost_until = t + 15.0;
                self.s.stars += 1;
                if self.s.stars >= 25 {
                    self.ach("stars25");
                }
                let g = Big::from(50.0).max(self.wrate() * 20.0);
                self.gain_at(g, s.x, s.y - 6.0, true);
                self.event("space pod caught — ×2 for 15s");
                self.goal("star", 1.0, false);
                self.cue(crate::hud::Cue::Fx("star"));
                self.spray(s.x, s.y, &[0xffffff, 0xffd84a, 0xff8a3a], 24, 120.0, 2.5, 0.7);
                self.tl.star = None;
                return;
            }
        }
        if let Some(i) = self.tl.meteors.iter().position(|m| !m.dead && m.delay <= 0.0 && hypot(&[px - m.x, py - m.y]) < 15.0) {
            let (mx, my) = (self.tl.meteors[i].x, self.tl.meteors[i].y);
            self.tl.meteors[i].dead = true;
            self.goal("meteor", 1.0, false);
            let n = self.meteor_pay();
            self.gain_at(n, mx, my - 6.0, true);
            self.burst_at(mx, my, &[0xffffff, 0xffb35a, 0xe0473e, 0x6c6f7c], 16, 110.0);
            return;
        }
        if let Some(m) = self.tl.moon.as_ref() {
            if m.a > 0.3 && !m.leaving && hypot(&[px - m.x, py - m.y]) < m.r + 6.0 {
                self.moon_transform();
                return;
            }
        }
        if let Some(i) = self.tl.saibas.iter().position(|sb| !sb.dead && sb.sx.is_some_and(|(x, y)| hypot(&[px - x, py - (y - 6.0)]) < 9.0)) {
            self.kill_saiba(i);
            return;
        }
        if let Some(b) = self.tl.boss.as_ref().filter(|b| !b.dead) {
            let s = b.spr();
            if (px - b.x).abs() < (s.w / 2.0 + 3.0) * b.k && py > b.y - (s.h + 2.0) * b.k && py < b.y + 4.0 {
                self.combo = if t - self.last_click < 0.6 { self.combo_cap().min(self.combo + 0.1) } else { 1.0 };
                self.last_click = t;
                let dmg =
                    self.tap_power() * self.mult(false) * self.botched() * self.combo * 6.0 * (1.0 + 0.5 * self.lvl(N_FIST)) * (1.0 + 0.5 * self.lvl(N_BRAWL));
                let x = self.mech_tap_x();
                if x > 0.0 {
                    self.hit_boss(dmg * x, px, py, false);
                }
                return;
            }
        }
        if let Some((x, y)) = self.tl.bean.as_ref().and_then(|b| b.sx) {
            if hypot(&[px - x, py - (y - 6.0)]) < 13.0 {
                self.b.senzu_until = t + 15.0 + 5.0 * self.lvl(N_SENZU);
                let msg = format!("senzu bean — ×{} for {}s", self.senzu_x(), 15.0 + 5.0 * self.lvl(N_SENZU));
                self.event(msg);
                self.spray(x, y, &[0xffffff, 0xb8f08a, 0x4fae3a], 18, 100.0, 3.0, 0.6);
                self.tl.bean = None;
                return;
            }
        }
        if self.ape_tap(px, py) {
            return;
        }
        // krillin's taps that would train throw his discs instead; goten's, while he's down, power him up
        if self.hero_disc_tap(px, py) || self.hero_power_tap() {
            return;
        }
        self.train_tap();
    }

    /// The great ape takes the taps that would have trained.
    fn ape_tap(&mut self, px: f64, py: f64) -> bool {
        let t = self.t;
        if self.b.ape_until <= t || !(self.tl.ape.giant || self.s.lv(Upg::Tail) > 0) {
            return false;
        }
        if t < self.tl.ape.cd {
            return true;
        }
        self.tl.ape.cd = t + 0.2;
        if self.tl.ape.giant {
            let g = Big::from(30.0).max(self.wrate() * 0.55 * (1.0 + self.ape_x()));
            self.gain_at(g, px, py - 8.0, true);
            self.shake = self.shake.max(0.6);
            self.burst_at(px, py, &[0xffffff, 0xe7e2d4, 0x9a8a70], 14, 150.0);
            self.cue(Cue::Sfx("hit"));
        }
        if self.s.lv(Upg::Tail) > 0 {
            let giant = self.tl.ape.giant;
            self.tl.ape.rage = 1f64.min(self.tl.ape.rage + if giant { 0.04 } else { 0.08 });
            let h = self.kid_screen(APE0.h * self.tl.ape.k * 0.7);
            if !giant {
                self.shake = self.shake.max(0.35);
                self.burst_at(px, py, &[0xffffff, 0xe7e2d4, 0x9a8a70], 8, 110.0);
            }
            if self.tl.ape.rage >= 1.0 {
                self.tl.ape.rage = 0.0;
                let g = Big::from(200.0).max(self.wrate() * 3.2 * (1.0 + self.ape_x()));
                self.gain_at(g, h.x, h.y - 20.0, true);
                self.b.ape_until = (self.tl.ape.at + self.ape_len() + 10.0).min(self.b.ape_until + 2.0);
                self.flash_t = 0.6;
                self.shake = 0.9;
                self.event("ROAAAR! +2s");
                self.cue(Cue::Fx("super"));
                self.burst_at(h.x, h.y, &[0xffffff, 0xfff27a, 0xe0332b], 40, 240.0);
            }
        }
        true
    }
}

pub fn uni_fighter(u: usize, k: usize) -> &'static str {
    let n = LADDER.len();
    if u < n {
        LADDER[u].3[k]
    } else {
        LADDER[if k == 2 { 5 + (u + k) % 2 } else { (u * 3 + k * 5) % n }].3[(u + k * 2) % 3]
    }
}

pub fn uni_name(u: usize) -> String {
    let n = LADDER.len();
    if u < n {
        LADDER[u].1.to_string()
    } else if u > n {
        format!("universe ∞ {}", u - n + 1)
    } else {
        "universe ∞".to_string()
    }
}

const TRAVEL: [&str; 13] = [
    "back on king kai's planet",
    "a space pod takes you to namek for 45 seconds — dragon balls ×2",
    "a space pod takes you to planet vegeta for 45 seconds — the moon is always full",
    "knocked into other world — run snake way back to king kai!",
    "a space pod takes you to beerus' planet — he's asleep. laps pay ×3 here, but every tap makes noise",
    "capsule corp, west city — bulma is handing out gadgets: tap the capsules",
    "kame house — master roshi's little island, out in the open sea",
    "a space pod drops you on mount paozu — goku's home, deep in dinosaur country",
    "a time machine drops you in trunks' future — the city is in ruins and the androids are still out there",
    "back in the null realm — the tournament of power goes on",
    "kami's lookout — mr. popo keeps the tiles swept, high above the clouds",
    "the sacred world of the kais — the supreme kai is expecting you",
    "yardrat — the locals keep blinking in and out of sight",
];
