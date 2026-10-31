//! Goten, born super saiyan: his forms come at a tenth of the marks, but each drops after a minute and a half; he
//! rests in base, then powers up again, the scene replaying straight to his best form, or at once when you tap. The
//! AFK rule over whole runs: idle he keeps pace with an idle Vegeta, playing him earns about 2-3× his own idle, and
//! nothing an idle player does costs him anything.

use planet_core::data::{Hero, Upg, MUI_FORM, SHOP};
use planet_core::heroes::{GOTEN_MARK, GOTEN_REST, GOTEN_UP};
use planet_core::{Game, DT};

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

#[derive(Clone, Copy, PartialEq, Debug)]
enum Play {
    /// never taps; checks in once a second to buy
    Idle,
    /// buys, kaiokens when ready, taps 5 a second for 5s of every 10 (into the scene too)
    Active,
}

struct Run {
    g: Game,
    spent: f64,
    f: u32,
}

impl Run {
    fn new(seed: u32, hero: Hero) -> Self {
        let mut g = Game::new(seed);
        g.s.hero = hero;
        g.forms = planet_core::data::ladder_of(hero, 0);
        g.start();
        Run { g, spent: 0.0, f: 0 }
    }

    fn earned(&self) -> f64 {
        self.g.s.pl.to_f64() + self.spent
    }

    fn step(&mut self, play: Play) {
        let f = self.f;
        if play == Play::Active && f % 300 < 150 && f.is_multiple_of(6) {
            self.g.train();
        }
        if f.is_multiple_of(30) {
            self.spent += buy_all(&mut self.g);
            if play != Play::Idle {
                self.g.kaioken();
            }
        }
        self.g.frame((f + 1) as f64 * DT, DT);
        self.f += 1;
    }

    fn play(&mut self, play: Play, secs: f64) {
        for _ in 0..(secs / DT) as u32 {
            self.step(play);
        }
    }
}

const SEEDS: [u32; 24] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];

fn geo_mean(v: &[f64]) -> f64 {
    (v.iter().map(|x| x.ln()).sum::<f64>() / v.len() as f64).exp()
}

fn earned(hero: Hero, play: Play, mins: f64) -> Vec<f64> {
    SEEDS
        .iter()
        .map(|&s| {
            let mut r = Run::new(s, hero);
            r.play(play, mins * 60.0);
            r.earned()
        })
        .collect()
}

fn ratio(a: &[f64], b: &[f64]) -> f64 {
    geo_mean(&a.iter().zip(b).map(|(x, y)| x / y).collect::<Vec<_>>())
}

#[test]
fn his_forms_come_early() {
    let (g, v) = (planet_core::data::ladder_of(Hero::Goten, 0), planet_core::data::ladder_of(Hero::Vegeta, 0));
    assert_eq!(g.len(), 9, "the shared nine, no late forms");
    for i in 1..9 {
        assert!((g[i].at - v[i].at * GOTEN_MARK).abs() < 1e-6 * v[i].at, "{}", g[i].name);
        assert_eq!(g[i].x, v[i].x);
    }
}

/// A game of his at `pl` power, no buying, just time passing.
fn at(hero: &str, pl: f64) -> Game {
    let mut g = Game::new(7);
    g.preview(&format!("#hero-{hero}"));
    g.start();
    g.debug_set("pl", pl);
    g
}

fn idle(g: &mut Game, secs: f64) {
    for _ in 0..(secs / DT).round() as u32 {
        let t = g.t + DT;
        g.frame(t, DT);
    }
}

/// Until he's formed up and the scene is over.
fn formed(g: &mut Game) {
    while g.s.form < 1 || g.xf.is_some() {
        idle(g, 0.5);
        assert!(g.t < 300.0, "he forms up");
    }
}

#[test]
fn he_drops_rests_and_powers_up_again() {
    let mut g = at("goten", 2e4);
    formed(&mut g);
    let best = g.s.form;
    idle(&mut g, GOTEN_UP + 1.0);
    assert_eq!(g.s.form, 0, "a minute and a half later he's back in base");
    assert!(g.powered_down().is_some());
    assert_eq!(g.held_form(), best, "but the form still counts as his");
    idle(&mut g, GOTEN_REST - 2.0);
    assert_eq!(g.s.form, 0, "he rests");
    idle(&mut g, 4.0);
    assert!(g.xf.is_some(), "then powers up again by himself");
    formed(&mut g);
    assert_eq!(g.s.form, best, "straight back to his best");
}

#[test]
fn a_tap_while_hes_down_powers_him_up_at_once() {
    let mut g = at("goten", 2e4);
    formed(&mut g);
    idle(&mut g, GOTEN_UP + 1.0);
    assert!(g.powered_down().is_some());
    g.train();
    assert!(g.powered_down().is_none(), "a tap powers him up at once");
    idle(&mut g, DT * 2.0);
    assert!(g.xf.is_some(), "the scene replays");
}

#[test]
fn his_dropped_form_still_counts_for_god_ki() {
    let mut g = at("goten", 2e11);
    formed(&mut g);
    while g.xf.is_some() || g.s.form < MUI_FORM - 1 {
        idle(&mut g, 0.5);
        assert!(g.t < 300.0);
    }
    let best = g.s.form;
    idle(&mut g, GOTEN_UP + 1.0);
    assert_eq!(g.s.form, 0);
    assert_eq!(g.held_form(), best);
}

#[test]
fn gotenks() {
    let mut g = Game::new(1);
    g.preview("#hero-goten#dance");
    g.start();
    let mut said = Vec::new();
    for _ in 0..30 * 12 {
        if let Some(d) = g.tl.dance.clone() {
            if d.i < 3 && (d.beats[d.i] - g.t).abs() < 0.05 {
                let k = g.kid_screen(14.0);
                g.tap(k.x, k.y);
            }
        }
        idle(&mut g, DT);
        said.extend(g.events.drain(..).map(|e| e.0));
    }
    assert!(said.iter().any(|s| s.starts_with("kid trunks wants to do the fusion dance")), "{said:?}");
    assert_eq!(g.tl.fused_look, "FUSED.gotenks");
}

#[test]
fn other_heroes_hold_their_forms() {
    let mut g = at("goku", 5e4);
    formed(&mut g);
    idle(&mut g, GOTEN_UP + GOTEN_REST + 5.0);
    assert!(g.s.form >= 1 && g.powered_down().is_none());
}

#[test]
#[ignore = "slow: whole runs, several seeds (cargo test --release -- --ignored goten)"]
fn the_afk_rule_over_whole_runs() {
    for mins in [30.0, 60.0] {
        let (gi, ga) = (earned(Hero::Goten, Play::Idle, mins), earned(Hero::Goten, Play::Active, mins));
        let (vi, va) = (earned(Hero::Vegeta, Play::Idle, mins), earned(Hero::Vegeta, Play::Active, mins));
        let (vs_vegeta, act) = (ratio(&gi, &vi), ratio(&ga, &gi));
        println!("(vegeta active / idle ×{:.3}; goten active / vegeta active ×{:.3})", ratio(&va, &vi), ratio(&ga, &va));
        println!("{mins} min, {} seeds: idle goten / idle vegeta ×{vs_vegeta:.3}; active / idle ×{act:.3}", SEEDS.len());
        assert!((0.8..=1.25).contains(&vs_vegeta), "idle, he keeps pace with an idle vegeta: ×{vs_vegeta}");
        // his bar (picked): up to about ×3.2, his taps a kid's tenth
        assert!((2.0..=3.2).contains(&act), "playing him earns about 2-3× his idle: ×{act}");
    }
}
