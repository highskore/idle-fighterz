//! The ramen break keeps the AFK rule. Over seeds, from a break starting, for a minute and for two:
//! - idle with the break earns at least ×0.9 of idle without it (it pays more: he stops, then runs on full);
//! - an active player who trains and leaves him be earns more than twice idle; knocking the bowl over costs a little.
//!
//! `cargo test --release -p planet-core --test ramen -- --nocapture` prints the numbers.

use planet_core::ramen::{FULL_S, RAMEN_EAT};
use planet_core::{Game, DT};

const SEEDS: [u32; 12] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

#[derive(Clone, Copy, PartialEq)]
enum Play {
    Idle,
    /// 3 training taps a second, never on him
    Active,
    /// the same, but the first tap of the break lands on him
    Rude,
}

fn game(seed: u32, events: bool) -> Game {
    let mut g = Game::new(seed);
    g.no_events = !events;
    g.preview("#ramen");
    for (k, v) in [("pl", 2e4), ("best", 2e4), ("boots", 8.0), ("partner", 10.0), ("house", 6.0), ("piccolo", 2.0)] {
        g.debug_set(k, v);
    }
    g.start();
    g
}

/// Power earned over `secs` from the start (nothing is bought).
fn earned(seed: u32, events: bool, play: Play, secs: f64) -> f64 {
    let mut g = game(seed, events);
    let p0 = g.s.pl.to_f64();
    let mut rude = play == Play::Rude;
    let n = (secs / DT) as u32;
    for f in 1..=n {
        if play != Play::Idle && f % 10 == 0 {
            if rude && g.eating() {
                let k = g.kid_screen(10.0);
                g.tap(k.x, k.y);
                rude = false;
            } else {
                g.train();
            }
        }
        g.frame(f as f64 * DT, DT);
    }
    g.s.pl.to_f64() - p0
}

fn mean(v: impl Iterator<Item = f64>) -> f64 {
    let v: Vec<f64> = v.collect();
    v.iter().sum::<f64>() / v.len() as f64
}

#[test]
fn ramen_keeps_the_afk_rule() {
    for secs in [RAMEN_EAT + FULL_S + 20.0, 120.0] {
        let idle = mean(SEEDS.iter().map(|&s| earned(s, true, Play::Idle, secs) / earned(s, false, Play::Idle, secs)));
        let active = mean(SEEDS.iter().map(|&s| earned(s, true, Play::Active, secs) / earned(s, true, Play::Idle, secs)));
        let rude = mean(SEEDS.iter().map(|&s| earned(s, true, Play::Rude, secs) / earned(s, true, Play::Active, secs)));
        println!("{secs}s from a break: idle ×{idle:.3} of no break; active ×{active:.2} of idle; knocking it over ×{rude:.3} of leaving it");
        assert!(idle >= 0.9, "idle with the break earns ×{idle:.3} of without");
        assert!(active >= 2.0, "active earns ×{active:.2} of idle");
        assert!(rude < 1.0, "knocking the bowl over costs nothing");
    }
}

#[test]
fn a_tap_on_him_knocks_it_over_and_a_training_tap_does_not() {
    let mut g = game(1, true);
    for f in 1..=60 {
        if f % 5 == 0 {
            g.train();
        }
        g.frame(f as f64 * DT, DT);
    }
    assert!(g.eating(), "training taps knocked his bowl over");
    let k = g.kid_screen(10.0);
    g.tap(k.x, k.y);
    assert!(!g.eating());
    assert!(g.b.tired_until > g.t, "no penalty");
    assert!(g.b.ramen_until <= g.t, "a full belly anyway");
}

#[test]
fn left_alone_he_runs_on_full_and_it_comes_again() {
    let mut g = game(2, true);
    let mut breaks = 0;
    let mut eating = false;
    for f in 1..=(1500.0 / DT) as u32 {
        g.frame(f as f64 * DT, DT);
        if g.eating() && !eating {
            breaks += 1;
        }
        eating = g.eating();
    }
    assert!(breaks >= 3, "{breaks} breaks in 25 minutes");
    assert!(g.tl.ramens == breaks);
}
