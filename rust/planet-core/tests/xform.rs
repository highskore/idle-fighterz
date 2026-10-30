//! The transformation scene: idle he still transforms, taps hurry it and earn the surge, reduced motion is shorter,
//! and over a run the surge keeps the AFK rule (active play earns about 2-3× idle, not more).

use planet_core::data::{Upg, SHOP};
use planet_core::xform::{SURGE_S, SURGE_TAPS, XF_DUR, XF_DUR_CALM, XF_REV};
use planet_core::{Game, DT};

/// A game just past super saiyan's mark, playing.
fn at_the_mark(calm: bool) -> Game {
    let mut g = Game::new(7);
    g.calm = calm;
    g.start();
    g.s.pl = g.forms[1].at * 1.02;
    g.s.best = g.s.pl;
    g
}

fn step(g: &mut Game, f: &mut u32) {
    *f += 1;
    g.frame(*f as f64 * DT, DT);
}

/// Seconds from the scene's start to the form landing, tapping every `tap_every` frames (0: never).
fn land(g: &mut Game, tap_every: u32) -> f64 {
    let mut f = 0;
    step(g, &mut f);
    let t0 = g.xf.as_ref().expect("the scene starts").t0;
    while g.s.form == 0 {
        if tap_every > 0 && f % tap_every == 0 {
            g.train();
        }
        step(g, &mut f);
        assert!(g.t - t0 < 30.0, "the form never landed");
    }
    g.t - t0
}

#[test]
fn idle_still_transforms() {
    let mut g = at_the_mark(false);
    let s = land(&mut g, 0);
    assert!((s - XF_DUR).abs() < 0.1, "idle, the form lands after {XF_DUR}s, not {s}");
    assert!(g.b.surge_until <= g.t, "no surge without taps");
    assert!(g.events.iter().any(|e| e.0.starts_with(g.forms[1].name)), "the form's name comes in the usual toast");
    // the reveal, then the scene is over
    let mut f = (g.t / DT).round() as u32;
    for _ in 0..((XF_REV + 0.2) / DT) as u32 {
        step(&mut g, &mut f);
    }
    assert!(g.xf.is_none());
}

#[test]
fn taps_hurry_it_and_earn_the_surge() {
    let mut g = at_the_mark(false);
    let s = land(&mut g, 6); // 5 taps a second
    assert!(s < XF_DUR * 0.7, "tapping lands it sooner: {s}s");
    assert!(g.b.surge_until > g.t + SURGE_S - 0.1, "and earns the surge");
    let e = g.events.iter().find(|e| e.0.starts_with(g.forms[1].name)).unwrap();
    assert!(e.0.contains("power surge"), "the surge rides in the form's toast: {}", e.0);
    let with = g.mult(false);
    g.b.surge_until = 0.0;
    assert!(with > g.mult(false), "the surge raises the multiplier");
}

#[test]
fn a_few_taps_hurry_it_without_a_surge() {
    let mut g = at_the_mark(false);
    let mut f = 0;
    step(&mut g, &mut f);
    for _ in 0..SURGE_TAPS - 1 {
        g.train();
    }
    while g.s.form == 0 {
        step(&mut g, &mut f);
    }
    assert!(g.b.surge_until <= g.t);
}

#[test]
fn reduced_motion_is_shorter_and_still() {
    let mut g = at_the_mark(true);
    let s = land(&mut g, 0);
    assert!((s - XF_DUR_CALM).abs() < 0.1, "reduced motion: {s}s");
    assert_eq!(g.shake, 0.0);
    assert_eq!(g.flash_t, 0.0, "no flash");
}

#[test]
fn a_preview_hook_shows_its_form_at_once() {
    let mut g = Game::new(7);
    g.preview("#form4");
    g.start();
    let mut f = 0;
    step(&mut g, &mut f);
    assert_eq!(g.s.form, 4);
    assert!(g.xf.is_none());
    let mut g = Game::new(7);
    g.preview("#xform");
    g.start();
    step(&mut g, &mut f);
    assert!(g.xf.is_some(), "#xform opens on the scene");
}

const POLICY: [&str; 13] = ["boots", "partner", "gravity", "scouter", "house", "piccolo", "cloud", "armor", "kaio", "galick", "senzu", "chamber", "bigbang"];

/// The difftest's `buyAll`: the cheapest open upgrade until none is affordable. Returns what it spent.
fn buy_all(g: &mut Game) -> f64 {
    let mut spent = 0.0;
    loop {
        let ok =
            POLICY.iter().filter_map(|k| Upg::from_key(k)).filter(|&u| g.unlocked(u) && g.s.pl >= g.cost(u)).min_by(|&a, &b| g.cost(a).total_cmp(&g.cost(b)));
        let Some(u) = ok else { return spent };
        let c = g.cost(u);
        if !g.buy(SHOP[u as usize].key) {
            return spent;
        }
        spent += c;
    }
}

#[derive(Clone, Copy, PartialEq)]
enum Play {
    /// never taps; checks in once a second to buy
    Idle,
    /// taps every `every` frames (6: 5 a second) for 5s of every 10, buys, kaioken when ready; `scenes` off leaves
    /// every transformation alone (no taps into it: no surge, no hurrying)
    Active { every: u32, scenes: bool },
}

struct Run {
    g: Game,
    spent: f64,
    f: u32,
    scenes: u32,
}

impl Run {
    fn new(seed: u32) -> Self {
        let mut g = Game::new(seed);
        g.start();
        Run { g, spent: 0.0, f: 0, scenes: 0 }
    }

    /// Power earned: what's held plus what was spent.
    fn earned(&self) -> f64 {
        self.g.s.pl + self.spent
    }

    /// One frame of a player. `instant` lands each form at once, as before forms came as a scene.
    fn step(&mut self, play: Play, instant: bool) {
        let (g, f) = (&mut self.g, self.f);
        if let Play::Active { every, scenes } = play {
            let building = g.xf.as_ref().is_some_and(|x| x.rv.is_none());
            if f % 300 < 150 && f % every == 0 && (scenes || !building) {
                g.train();
            }
        }
        if f % 30 == 0 {
            self.spent += buy_all(g);
            if play != Play::Idle {
                g.kaioken();
            }
        }
        g.xf_instant |= instant;
        let had = g.xf.as_ref().map(|x| x.t0);
        g.frame((f + 1) as f64 * DT, DT);
        if g.xf.is_some() && g.xf.as_ref().map(|x| x.t0) != had {
            self.scenes += 1;
        }
        self.f += 1;
    }
}

const SEEDS: [u32; 24] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];

fn geo_mean(v: impl Iterator<Item = f64>) -> f64 {
    let v: Vec<f64> = v.collect();
    (v.iter().map(|x| x.ln()).sum::<f64>() / v.len() as f64).exp()
}

/// The same game up to its first transformation (a casual active player), then `play` for `secs`: the power earned in
/// that window. Every branch shares the history, so the window shows the scene's own effect, not a run's luck.
fn window(seed: u32, play: Play, instant: bool, secs: f64) -> f64 {
    let lead = Play::Active { every: 15, scenes: true };
    let mut r = Run::new(seed);
    while r.g.xf.is_none() {
        r.step(lead, false);
        assert!(r.f < 30 * 60 * 40, "no transformation in 40 minutes");
    }
    let at = r.f - 1;
    let mut r = Run::new(seed);
    while r.f < at {
        r.step(lead, false);
    }
    let e0 = r.earned();
    for _ in 0..(secs / DT) as u32 {
        r.step(play, instant);
    }
    r.earned() - e0
}

#[test]
fn the_surge_keeps_the_afk_rule() {
    // the 45 seconds from the first form-up: the scene, its reveal and the surge
    let secs = 45.0;
    let w = |play, instant| SEEDS.map(|s| window(s, play, instant, secs));
    let heavy = Play::Active { every: 6, scenes: true };
    let (idle, idle0) = (w(Play::Idle, false), w(Play::Idle, true));
    let (act, act0, alone) = (w(heavy, false), w(heavy, true), w(Play::Active { every: 6, scenes: false }, false));
    let r = |a: [f64; 24], b: [f64; 24]| geo_mean(a.iter().zip(b.iter()).map(|(x, y)| x / y));
    let (idle_cost, play_pay, vs_old, afk, afk0) = (r(idle, idle0), r(act, alone), r(act, act0), r(act, idle), r(act0, idle0));
    println!("the {secs}s from the first form-up, {} seeds: idle with the scene / an instant form ×{idle_cost:.3}", SEEDS.len());
    println!("active playing the scene / leaving it alone ×{play_pay:.3}; / an instant form ×{vs_old:.3}");
    println!("active / idle ×{afk:.3} (with instant forms ×{afk0:.3})");
    assert!(idle_cost > 0.8, "idle, the scene only delays the form (and pauses his laps) a few seconds: ×{idle_cost}");
    assert!(play_pay > 1.0, "playing the scene pays: ×{play_pay}");
    assert!(vs_old > 0.95, "against the old one-frame form, an active player loses at most a couple of seconds of income: ×{vs_old}");
    assert!((2.0..=3.5).contains(&afk), "around a form-up, active play earns about 2-3× idle: ×{afk}");

    // and over whole runs, idle still transforms on its own
    let mut r = Run::new(7);
    for _ in 0..30 * 60 * 30 {
        r.step(Play::Idle, false);
    }
    assert!(r.scenes > 0 && r.g.s.form > 0, "idle, he still transforms");
}
