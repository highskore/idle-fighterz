//! The boss mechanics keep the AFK rule. Over seeds, for each of the saga bosses with one (wave 1, and Broly):
//! - one fight: an idle player still beats him, needing a bounded bit more armor than without his mechanic;
//! - a campaign from his saga, buying as it goes (ignored: slow): how long idle takes to beat him with and without his
//!   mechanic, and how much sooner an active player who plays the mechanic does, and what each earns.
//!
//! And for wave 2's raids, the Ginyu Force and Metal Cooler: idle wins them as fast as without the mechanic, and
//! active play that plays it beats them sooner than active play that doesn't.
//!
//! `cargo test --release -p planet-core --test bosses -- --nocapture` prints the numbers.

use planet_core::data::{Upg, SHOP};
use planet_core::mech::{Mech, Ph, B_BIG, B_REFORMS, J_FULL};
use planet_core::{Game, DT};

const SEEDS: [u32; 12] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const BOSSES: [(&str, u32); 6] = [("frieza", 4), ("cell", 5), ("kid buu", 6), ("broly", 7), ("hit", 9), ("jiren", 11)];

#[derive(Clone, Copy, PartialEq)]
enum Play {
    Idle,
    /// 3 taps a second (on him while he's up, training otherwise) and plays the mechanic
    Active,
}

/// A run at saga `saga`, with `armor` levels and a few of everything else: he arrives at once.
fn game(seed: u32, saga: u32, armor: u32, mechs: bool) -> Game {
    game_at(seed, &format!("#saga{saga}"), armor, mechs, 1e4)
}

/// The same run at a preview hook, with the best power that unlocks what it previews.
fn game_at(seed: u32, hash: &str, armor: u32, mechs: bool, best: f64) -> Game {
    let mut g = Game::new(seed);
    g.no_mechs = !mechs;
    g.preview(hash);
    for (k, v) in [("pl", 1e4), ("best", best), ("boots", 2.0), ("partner", 10.0), ("house", 10.0), ("piccolo", 3.0), ("galick", 1.0), ("armor", armor as f64)]
    {
        g.debug_set(k, v);
    }
    g.start();
    g
}

/// Where planet-render would stand him (headless, nothing places him).
fn place(g: &mut Game) {
    let (cx, cy, r) = (g.cam.cx, g.cam.cy, g.cam.r);
    if let Some(b) = g.tl.boss.as_mut() {
        b.k = 0.9f64.max(r / 62.0);
        b.x = cx + r * 1.45;
        b.y = cy - r * 0.75;
    }
}

const POLICY: [&str; 13] = ["boots", "partner", "gravity", "scouter", "house", "piccolo", "cloud", "armor", "kaio", "galick", "senzu", "chamber", "bigbang"];

/// The difftest's `buyAll`: the cheapest open upgrade until none is affordable. Returns what it spent.
fn buy_all(g: &mut Game) -> f64 {
    let mut spent = 0.0;
    loop {
        let ok = POLICY
            .iter()
            .filter_map(|k| Upg::from_key(k))
            .filter(|&u| g.unlocked(u) && g.s.pl >= g.cost(u))
            .min_by(|&a, &b| g.cost(a).partial_cmp(&g.cost(b)).unwrap());
        let Some(u) = ok else { return spent };
        let c = g.cost(u);
        if !g.buy(SHOP[u as usize].key) {
            return spent;
        }
        spent += c.to_f64();
    }
}

struct Player {
    g: Game,
    f: u32,
    charge: f64,
    spent: f64,
}

impl Player {
    /// One frame of `play`; `shop` buys once a second.
    fn step(&mut self, play: Play, shop: bool) {
        let g = &mut self.g;
        place(g);
        if play == Play::Active {
            self.charge = act(g, self.f, self.charge);
        }
        if shop && self.f.is_multiple_of(30) {
            self.spent += buy_all(&mut self.g);
        }
        self.f += 1;
        self.g.frame(self.f as f64 * DT, DT);
    }
}

/// An active player's frame: the mechanic first (a deflect, a rescue, a finishing or full beam), else a tap 3 times a
/// second, on him while the fight is on. Returns the charge held.
fn act(g: &mut Game, f: u32, mut charge: f64) -> f64 {
    let fight = g.tl.boss.as_ref().filter(|b| !b.dead && g.t >= b.go && b.saga).cloned();
    let Some(b) = fight else {
        if f.is_multiple_of(10) {
            g.train();
        }
        return 0.0;
    };
    let (bx, by) = (b.x, b.y - b.spr().h / 2.0 * b.k);
    let want = match &b.mech {
        Some(Mech::Buu { zone: true, reforms, .. }) if *reforms < B_REFORMS => B_BIG + 0.2,
        Some(Mech::Jiren { .. }) if g.tl.struggle.is_none() && f % 300 < 120 => J_FULL + 0.1,
        // a full beam whenever broly's rage is up
        Some(Mech::Broly { .. }) if g.tl.struggle.is_none() && g.rage().unwrap_or(0.0) > 0.3 => J_FULL + 0.1,
        _ => 0.0,
    };
    let aim = matches!(&b.mech, Some(Mech::Frieza { ph: Ph::Aim, p0, .. }) if g.t - p0 > 0.4);
    let grab = match &b.mech {
        Some(Mech::Cell { ph: Ph::Reach, p0, who, .. }) if g.t - p0 > 0.3 => g.ally_spot(*who),
        Some(Mech::Cell { ph: Ph::Drain, .. }) => g.held_spot(),
        _ => None,
    };
    if aim {
        let k = g.kid_screen(12.0);
        g.tap(k.x, k.y);
    } else if let Some((x, y)) = grab {
        g.tap(x, y - 8.0);
    } else if want > 0.0 && g.tl.struggle.is_none() {
        // holding a charge: no taps meanwhile
        charge += DT;
        if charge >= want {
            g.fire_beam(charge, bx, by);
            charge = 0.0;
        }
        return charge;
    } else if f.is_multiple_of(10) && !g.skipping() {
        g.tap(bx, by);
    }
    0.0
}

/// One fight from his arrival, nothing bought: seconds from the fight's start to his fall, or None if he got away.
fn fight(seed: u32, saga: u32, armor: u32, mechs: bool) -> Option<f64> {
    fight_as(seed, saga, armor, mechs, Play::Idle)
}

fn fight_as(seed: u32, saga: u32, armor: u32, mechs: bool, play: Play) -> Option<f64> {
    let mut p = Player { g: game(seed, saga, armor, mechs), f: 0, charge: 0.0, spent: 0.0 };
    while p.f < (50.0 / DT) as u32 {
        p.step(play, false);
        if let Some(b) = p.g.tl.boss.as_ref().filter(|b| b.dead && b.saga) {
            return (!b.fled).then_some(b.t1 - b.go);
        }
    }
    None
}

fn mean(v: &[f64]) -> f64 {
    v.iter().sum::<f64>() / v.len().max(1) as f64
}

/// The least armor that lets idle beat him in every seed's fight, and the mean time it takes there.
fn idle_armor(saga: u32, mechs: bool) -> (u32, f64) {
    let all = |a: u32| SEEDS.iter().map(|&s| fight(s, saga, a, mechs)).collect::<Option<Vec<f64>>>();
    let (mut lo, mut hi) = (0, 120);
    assert!(all(hi).is_some(), "idle never wins");
    while lo < hi {
        let m = (lo + hi) / 2;
        if all(m).is_some() {
            hi = m;
        } else {
            lo = m + 1;
        }
    }
    (lo, mean(&all(lo).unwrap()))
}

#[test]
fn idle_beats_every_boss_with_a_bounded_bit_more_armor() {
    println!("one fight, idle: the least armor that wins it on every seed, and two levels past it the mean time to beat him");
    for (name, saga) in BOSSES {
        let ((a0, t0), (a1, t1)) = (idle_armor(saga, false), idle_armor(saga, true));
        let a = a0 + 2;
        let ttk = |mechs| mean(&SEEDS.map(|s| fight(s, saga, a, mechs).expect("idle wins two levels past the margin")));
        let (k0, k1) = (ttk(false), ttk(true));
        println!(
            "{name:8} least armor: {a0:2} ({t0:4.1}s) without the mechanic, {a1:2} ({t1:4.1}s) with it | armor {a}: {k0:4.1}s → {k1:4.1}s, ×{:.2}",
            k1 / k0
        );
        assert!(a1 <= a0 + 1, "{name}: idle needs at most one more armor level with his mechanic ({a0} → {a1})");
        assert!(k1 / k0 <= 1.1, "{name}: his mechanic slows an idle win by at most 10%: ×{}", k1 / k0);
    }
}

#[test]
fn active_play_beats_every_boss_without_armor() {
    println!("one fight, no armor, active (3 taps a second, playing the mechanic): mean time to beat him (wins)");
    for (name, saga) in BOSSES {
        let run = |mechs| SEEDS.map(|s| fight_as(s, saga, 0, mechs, Play::Active));
        let (x0, x1) = (run(false), run(true));
        let t = |v: &[Option<f64>]| mean(&v.iter().flatten().copied().collect::<Vec<_>>());
        let w = |v: &[Option<f64>]| v.iter().flatten().count();
        println!("{name:8} without the mechanic {:4.1}s ({:2}) | with it {:4.1}s ({:2})", t(&x0), w(&x0), t(&x1), w(&x1));
        assert_eq!(w(&x1), SEEDS.len(), "{name}: active play beats him");
    }
}

struct Campaign {
    /// seconds from his arrival to his fall (the whole window if he never falls)
    ttk: f64,
    won: bool,
    earned: f64,
}

/// From his arrival, `secs` of play with the shop: does he fall, when, and what's earned (held plus spent).
fn campaign(seed: u32, saga: u32, armor: u32, mechs: bool, play: Play, secs: f64) -> Campaign {
    let mut p = Player { g: game(seed, saga, armor, mechs), f: 0, charge: 0.0, spent: 0.0 };
    let e0 = p.g.s.pl.to_f64();
    let mut ttk = None;
    while (p.f as f64) * DT < secs {
        p.step(play, true);
        if ttk.is_none() && p.g.s.saga >= saga {
            ttk = Some(p.g.t);
        }
    }
    Campaign { ttk: ttk.unwrap_or(secs), won: ttk.is_some(), earned: p.g.s.pl.to_f64() + p.spent - e0 }
}

fn geo_mean(v: impl Iterator<Item = f64>) -> f64 {
    let v: Vec<f64> = v.collect();
    (v.iter().map(|x| x.ln()).sum::<f64>() / v.len() as f64).exp()
}

/// Slow (about 6 minutes): `cargo test --release -p planet-core --test bosses -- --ignored --nocapture`.
#[test]
#[ignore]
fn a_campaign_idle_and_active() {
    // starting where idle just beats him without his mechanic
    let secs = 2700.0;
    println!("45 min from his arrival, buying as it goes; mean time to beat him (wins) and earned, {} seeds", SEEDS.len());
    for (name, saga) in BOSSES {
        let a = idle_armor(saga, false).0;
        let run = |mechs, play| SEEDS.map(|s| campaign(s, saga, a, mechs, play, secs));
        let (i0, i1, x0, x1) = (run(false, Play::Idle), run(true, Play::Idle), run(false, Play::Active), run(true, Play::Active));
        let t = |c: &[Campaign]| mean(&c.iter().map(|c| c.ttk).collect::<Vec<_>>());
        let w = |c: &[Campaign]| c.iter().filter(|c| c.won).count();
        let r = |a: &[Campaign], b: &[Campaign]| geo_mean(a.iter().zip(b).map(|(x, y)| x.earned / y.earned));
        println!(
            "{name:8} armor {a:2} | idle {:5.0}s ({:2}) → {:5.0}s ({:2}) | active {:4.0}s ({:2}) → {:4.0}s ({:2}) | earned: idle ×{:.2}, active ×{:.2} of without; active/idle ×{:.2} (without ×{:.2})",
            t(&i0),
            w(&i0),
            t(&i1),
            w(&i1),
            t(&x0),
            w(&x0),
            t(&x1),
            w(&x1),
            r(&i1, &i0),
            r(&x1, &x0),
            r(&x1, &i1),
            r(&x0, &i0),
        );
        assert_eq!(w(&x1), SEEDS.len(), "{name}: active play beats him");
        assert!(t(&x1) < t(&i1), "{name}: active play beats him sooner");
    }
}

/// Where planet-render stands the ginyu force and metal cooler's clones (headless, nothing does).
fn place_raid(g: &mut Game) {
    place(g);
    let (cx, cy, r) = (g.cam.cx, g.cam.cy, g.cam.r);
    if let Some(gi) = g.tl.ginyu.as_mut() {
        for m in gi.members.iter_mut() {
            let s = m.i as f64 - 2.0;
            (m.k, m.x, m.y) = (0.9f64.max(r / 62.0), cx + s * r * 0.55, cy - r * 1.12 + s.abs() * r * 0.08);
        }
    }
    let slot = [(1.45, -0.75), (-1.45, -0.75), (2.3, -0.75), (-2.3, -0.75), (1.45, 0.4), (-1.45, 0.4), (2.3, 0.4), (-2.3, 0.4), (0.0, 1.4)];
    let core = g.tl.movie.as_ref().and_then(|m| m.metal.as_ref()).map(|m| m.slot(0));
    if let (Some(s), Some(b)) = (core, g.tl.boss.as_mut()) {
        (b.x, b.y) = (cx + slot[s].0 * r, cy + slot[s].1 * r);
    }
    if let Some(mt) = g.tl.movie.as_mut().and_then(|m| m.metal.as_mut()) {
        let slots = mt.clone_slots();
        for (c, s) in mt.clones.iter_mut().zip(slots) {
            c.k = 0.9f64.max(r / 62.0);
            c.x = s.map(|s| cx + slot[s].0 * r);
            c.y = s.map_or(0.0, |s| cy + slot[s].1 * r);
        }
    }
}

#[derive(Clone, Copy, PartialEq)]
enum Raid {
    Idle,
    /// 3 taps a second, playing the mechanic: rude taps on the poses, swapping straight back, hitting the real cooler
    Plays,
    /// 3 taps a second on whoever's first, ignoring the mechanic
    Mashes,
}

/// The ginyu force from its arrival, nothing bought: seconds to beat all five (None if they retreat), and what the
/// body change's wrong taps cost.
fn ginyu(seed: u32, armor: u32, mechs: bool, play: Raid) -> (Option<f64>, f64) {
    let mut g = game_at(seed, "#ginyu", armor, mechs, 5e4);
    let mut f = 0u32;
    let mut swap_at = None;
    while f < (80.0 / planet_core::DT) as u32 {
        place_raid(&mut g);
        if let Some(gi) = g.tl.ginyu.clone() {
            if gi.done != 0.0 {
                let won = gi.members.iter().all(|m| m.dead);
                let lost = gi.mech.map_or(0.0, |m| m.lost.to_f64());
                return (won.then_some(gi.done - gi.t0), lost);
            }
            if g.swapped() {
                swap_at.get_or_insert(g.t);
            }
            let tap = f.is_multiple_of(10);
            if play == Raid::Plays && g.swapped() && g.t - swap_at.unwrap() > 0.4 {
                let k = g.kid_screen(12.0);
                g.tap(k.x, k.y);
            } else if play != Raid::Idle && tap {
                // mid-pose, the one in the spotlight (any tap on a poser is rude), else the first standing
                let lit = planet_core::mech2::spotlit(g.t - gi.t0).filter(|_| play == Raid::Plays && g.posing());
                let pick = lit.and_then(|i| gi.members.get(i).filter(|m| !m.dead)).or_else(|| gi.members.iter().find(|m| !m.dead));
                if let Some(m) = pick {
                    g.tap(m.x, m.y - 6.0);
                }
            }
        }
        f += 1;
        g.frame(f as f64 * planet_core::DT, planet_core::DT);
    }
    (None, 0.0)
}

/// Metal cooler from his arrival, nothing bought: seconds to beat the real one (None if he gets away), and the share
/// of his hp taken off by then.
fn metal(seed: u32, armor: u32, mechs: bool, play: Raid) -> (Option<f64>, f64) {
    let mut g = game_at(seed, "#metal", armor, mechs, 3e5);
    let mut f = 0u32;
    let mut share = 0.0;
    while f < (120.0 / planet_core::DT) as u32 {
        place_raid(&mut g);
        if let (Some(m), Some(b)) = (g.tl.movie.clone(), g.tl.boss.clone()) {
            share = 1.0 - (b.hp / b.max).to_f64().max(0.0);
            if b.dead {
                return ((!b.fled).then_some(b.t1 - m.t0), share);
            }
            if play != Raid::Idle && f.is_multiple_of(10) && g.t - m.t0 > 1.5 {
                let clone = m.metal.as_ref().and_then(|mt| mt.clones.iter().find(|c| !c.dead() && c.x.is_some()).cloned());
                match clone.filter(|_| play == Raid::Mashes) {
                    Some(c) => g.tap(c.x.unwrap(), c.y - 8.0),
                    None => g.tap(b.x, b.y - 10.0),
                }
            }
        }
        f += 1;
        g.frame(f as f64 * planet_core::DT, planet_core::DT);
    }
    (None, share)
}

/// The least armor that wins on every seed, by a fight that may be lost.
fn least_armor(win: impl Fn(u32, u32) -> Option<f64>) -> u32 {
    let all = |a: u32| SEEDS.iter().all(|&s| win(s, a).is_some());
    let (mut lo, mut hi) = (0, 120);
    assert!(all(hi), "idle never wins");
    while lo < hi {
        let m = (lo + hi) / 2;
        if all(m) {
            hi = m;
        } else {
            lo = m + 1;
        }
    }
    lo
}

#[test]
fn idle_beats_the_wave_2_raids_as_fast_as_without() {
    println!("one raid, idle: the least armor that wins it on every seed; two levels past it the mean time to beat it");
    let fight = |s, a, m| ginyu(s, a, m, Raid::Idle).0;
    let (a0, a1) = (least_armor(|s, a| fight(s, a, false)), least_armor(|s, a| fight(s, a, true)));
    let a = a0 + 2;
    let ttk = |mechs| mean(&SEEDS.map(|s| fight(s, a, mechs).expect("idle wins two levels past the margin")));
    let (k0, k1) = (ttk(false), ttk(true));
    println!("ginyu    least armor: {a0:2} without the mechanic, {a1:2} with it | armor {a}: {k0:4.1}s → {k1:4.1}s, ×{:.2}", k1 / k0);
    assert!(a1 <= a0 + 1, "ginyu: idle needs at most one more armor level with the mechanic ({a0} → {a1})");
    assert!(k1 / k0 <= 1.1, "ginyu: the mechanic slows an idle win by at most 10%: ×{}", k1 / k0);
    // a movie villain's hp is sized to your taps (armor too), so idle never beats one in his 90s, with or without:
    // the measure is how much of him idle takes, as a time to beat him at that pace
    for a in [0, 10, 40] {
        let share = |mechs| mean(&SEEDS.map(|s| metal(s, a, mechs, Raid::Idle).1));
        let (s0, s1) = (share(false), share(true));
        println!("metal    armor {a:2}: idle takes {:4.1}% of him → {:4.1}% in 90s, a time to beat him ×{:.2}", s0 * 100.0, s1 * 100.0, s0 / s1);
        assert!(s0 / s1 <= 1.1, "metal cooler: the clones slow idle by at most 10%: ×{}", s0 / s1);
    }
}

#[test]
fn playing_the_wave_2_raids_beats_ignoring_them() {
    println!("one raid, no armor, 3 taps a second: mean time to beat it (wins), and what the body change cost");
    let a = 0;
    let run = |mechs, play| SEEDS.map(|s| ginyu(s, a, mechs, play));
    let (x0, plays, mash, idle) = (run(false, Raid::Plays), run(true, Raid::Plays), run(true, Raid::Mashes), run(true, Raid::Idle));
    let t = |v: &[(Option<f64>, f64)]| mean(&v.iter().filter_map(|x| x.0).collect::<Vec<_>>());
    let lost = |v: &[(Option<f64>, f64)]| mean(&v.iter().map(|x| x.1).collect::<Vec<_>>());
    println!(
        "ginyu    armor {a:2} | idle wins {} | active without the mechanic {:4.1}s | playing it {:4.1}s (lost {:.0}) | mashing {:4.1}s (lost {:.0})",
        idle.iter().filter(|x| x.0.is_some()).count(),
        t(&x0),
        t(&plays),
        lost(&plays),
        t(&mash),
        lost(&mash)
    );
    assert!(plays.iter().all(|x| x.0.is_some()), "playing it beats the force");
    assert!(t(&plays) < t(&mash), "sooner than mashing through it");
    assert!(lost(&mash) > lost(&plays), "mashing through the body change costs");
    let run = |mechs, play| SEEDS.map(|s| metal(s, 0, mechs, play).0);
    let (x0, plays, mash) = (run(false, Raid::Plays), run(true, Raid::Plays), run(true, Raid::Mashes));
    let t = |v: &[Option<f64>]| mean(&v.iter().flatten().copied().collect::<Vec<_>>());
    let w = |v: &[Option<f64>]| v.iter().flatten().count();
    println!(
        "metal    armor  0 | active without the mechanic {:4.1}s ({}) | hitting the real one {:4.1}s ({}) | hitting the clones first {:4.1}s ({})",
        t(&x0),
        w(&x0),
        t(&plays),
        w(&plays),
        t(&mash),
        w(&mash)
    );
    assert_eq!(w(&plays), SEEDS.len(), "hitting the real one beats him");
    assert!(t(&plays) < t(&mash), "and sooner than hitting the clones");
}
