//! The Cell Games and Buu's candy keep the AFK rule. Over seeds, from each event starting (its preview hook), over a
//! window that covers it:
//! - idle with the event earns at least ×0.9 of idle without it (`no_events`), and the event resolves on its own;
//! - an active player (training taps, and playing the event: the Cell Jr.s, the boss, the self-destruct, the candy)
//!   earns more than twice idle.
//!
//! `cargo test --release -p planet-core --test events -- --nocapture` prints the numbers.

use planet_core::candy::Target;
use planet_core::cellgames::CgPh;
use planet_core::{Game, DT};

const SEEDS: [u32; 12] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

fn game(seed: u32, hook: &str, events: bool) -> Game {
    let mut g = Game::new(seed);
    g.no_events = !events;
    g.preview(hook);
    for (k, v) in [("pl", 3e5), ("best", 3e5), ("boots", 12.0), ("partner", 12.0), ("house", 8.0), ("piccolo", 6.0), ("armor", 3.0), ("galick", 1.0)] {
        g.debug_set(k, v);
    }
    g.start();
    g
}

/// Where planet-render would stand the boss (headless, nothing places him).
fn place(g: &mut Game) {
    let (cx, cy, r) = (g.cam.cx, g.cam.cy, g.cam.r);
    if let Some(b) = g.tl.boss.as_mut() {
        b.k = 0.9f64.max(r / 62.0);
        b.x = cx + r * 1.45;
        b.y = cy - r * 0.75;
    }
}

/// An active frame: play the event if there's something to tap, else train, 3 taps a second.
fn act(g: &mut Game, f: u32) {
    if !f.is_multiple_of(10) {
        return;
    }
    if let Some(cg) = g.tl.cg.as_ref() {
        match cg.ph {
            CgPh::Boom if !cg.flaring(g.t) => {
                g.tap(1.0, 1.0);
                return;
            }
            CgPh::Boom => return,
            CgPh::Jrs => {
                if let Some(i) = (0..cg.jrs.len()).find(|&i| cg.jrs[i].dead.is_none() && g.jr_spot(i).is_some()) {
                    let (x, y) = g.jr_spot(i).unwrap();
                    g.tap(x, y - 6.0);
                    return;
                }
            }
            _ => {}
        }
    }
    if let Some(c) = g.tl.candy.as_ref().filter(|c| c.over.is_none()) {
        let tgt: Vec<Target> = c.done.iter().map(|d| d.0).collect();
        if let Some((x, y)) = tgt.into_iter().find_map(|x| g.target_spot(x)) {
            g.tap(x, y);
            return;
        }
    }
    if let Some(b) = g.tl.boss.as_ref().filter(|b| !b.dead && g.t >= b.go) {
        let (x, y) = (b.x, b.y - b.spr().h / 2.0 * b.k);
        g.tap(x, y);
        return;
    }
    g.train();
}

/// Power earned over `secs` (nothing is bought), and whether the event was over by then.
fn run(seed: u32, hook: &str, events: bool, active: bool, secs: f64) -> (f64, bool) {
    let mut g = game(seed, hook, events);
    let p0 = g.s.pl.to_f64();
    for f in 1..=(secs / DT) as u32 {
        place(&mut g);
        if active {
            act(&mut g, f);
        }
        g.frame(f as f64 * DT, DT);
    }
    (g.s.pl.to_f64() - p0, g.tl.cg.is_none() && g.tl.candy.is_none())
}

fn mean(v: impl Iterator<Item = f64>) -> f64 {
    let v: Vec<f64> = v.collect();
    v.iter().sum::<f64>() / v.len() as f64
}

fn check(hook: &str, secs: f64) {
    let idle = mean(SEEDS.iter().map(|&s| {
        let (with, over) = run(s, hook, true, false, secs);
        assert!(over, "{hook}: seed {s} still on after {secs}s idle");
        with / run(s, hook, false, false, secs).0
    }));
    let active = mean(SEEDS.iter().map(|&s| run(s, hook, true, true, secs).0 / run(s, hook, true, false, secs).0));
    let base = mean(SEEDS.iter().map(|&s| run(s, hook, false, true, secs).0 / run(s, hook, false, false, secs).0));
    println!("{hook} over {secs}s: idle ×{idle:.3} of no event; active ×{active:.2} of idle (×{base:.2} without the event)");
    assert!(idle >= 0.9, "{hook}: idle earns ×{idle:.3} of no event");
    assert!(active >= 2.0, "{hook}: active earns ×{active:.2} of idle");
}

#[test]
fn the_cell_games_keep_the_afk_rule() {
    check("#cellgames", 120.0);
}

#[test]
fn buus_candy_keeps_the_afk_rule() {
    check("#candy", 90.0);
}

#[test]
fn the_games_come_as_a_story_beat_then_again_much_later() {
    let mut g = Game::new(3);
    g.start();
    g.debug_set("pl", 1e6);
    g.debug_set("best", 1e6);
    g.s.saga = 5;
    let mut started = Vec::new();
    for f in 1..=(3.0 * 3600.0 / DT) as u32 {
        let on = g.tl.cg.is_some();
        g.frame(f as f64 * DT, DT);
        if g.tl.cg.is_some() && !on {
            started.push(g.t);
        }
    }
    assert!(started.len() >= 2, "{started:?}");
    let story = planet_core::cellgames::CG_STORY;
    assert!(started[0] >= story && started[0] < story + 600.0, "the story beat came at {}", started[0]);
    let gap = started[1] - started[0];
    assert!(gap >= 2700.0, "the repeat came {gap}s later");
}
