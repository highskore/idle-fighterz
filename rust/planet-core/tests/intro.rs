//! A saga boss's arrival: it plays by itself, holds the fight's clock until it's done, a tap skips to the shatter, the
//! toast names him and his reading, and reduced motion has no flash or shake.

use planet_core::intro::{BI_BLOW, BI_DUR};
use planet_core::{Game, DT};

fn raid(calm: bool) -> Game {
    let mut g = Game::new(7);
    g.calm = calm;
    g.preview("#saga4");
    g.start();
    g
}

fn step(g: &mut Game) {
    let t = g.t + DT;
    g.frame(t, DT);
}

fn until(g: &mut Game, t: f64) {
    while g.t < t - 1e-9 {
        step(g);
    }
}

#[test]
fn it_plays_by_itself_and_then_the_fight_starts() {
    let mut g = raid(false);
    step(&mut g);
    let b = g.tl.boss.as_ref().expect("the raid starts");
    assert!(b.saga && b.intro.is_some());
    let (t0, go, until0) = (g.t, b.go, b.until);
    assert!((go - (t0 + BI_DUR)).abs() < 1e-9, "the fight waits for the arrival");
    assert!((until0 - go - 40.0).abs() < 1e-9, "and still lasts 40s");
    let max = g.tl.boss.as_ref().unwrap().max;
    until(&mut g, t0 + BI_BLOW - 0.1);
    assert!(g.tl.kis.is_empty() && g.tl.boss.as_ref().unwrap().hp == max, "no ki blasts while he arrives");
    assert!(!g.events.iter().any(|e| e.0.contains("scouter")));
    until(&mut g, t0 + BI_BLOW + 0.1);
    let e = g.events.iter().find(|e| e.0.starts_with("the scouter can't take it! frieza, power ")).expect("the toast");
    assert!(e.0.ends_with(&planet_core::num::hud_fmt(planet_core::num::js_round(g.tl.boss.as_ref().unwrap().max))));
    assert!(g.flash_t > 0.0 && g.shake > 0.0, "the glass blows");
    until(&mut g, t0 + BI_DUR + 1.5);
    assert!(g.tl.boss.as_ref().unwrap().intro.is_none());
    assert!(g.tl.boss.as_ref().unwrap().hp < max, "then his ki blasts fly");
}

#[test]
fn a_tap_skips_it() {
    let mut g = raid(false);
    step(&mut g);
    until(&mut g, 1.0);
    let pl = g.s.pl;
    g.train();
    let b = g.tl.boss.as_ref().unwrap();
    assert!((b.go - g.t).abs() < 1e-9, "the fight starts now");
    assert!((b.until - g.t - 40.0).abs() < 1e-9);
    assert!(g.events.iter().any(|e| e.0.starts_with("the scouter can't take it!")), "the glass shatters at once");
    assert_eq!(g.s.pl, pl, "the tap only skipped");
    g.train();
    assert!(g.s.pl > pl, "the next tap trains");
}

#[test]
fn reduced_motion_has_no_flash_or_shake() {
    let mut g = raid(true);
    step(&mut g);
    until(&mut g, BI_DUR + 0.5);
    assert!(g.events.iter().any(|e| e.0.starts_with("the scouter can't take it!")));
    assert_eq!(g.flash_t, 0.0);
    assert_eq!(g.shake, 0.0);
}

#[test]
fn only_saga_bosses_arrive_behind_the_scouter() {
    let mut g = Game::new(7);
    g.preview("#tournament");
    g.start();
    for _ in 0..(40.0 / DT) as u32 {
        step(&mut g);
        if let Some(b) = g.tl.boss.as_ref() {
            assert!(b.intro.is_none());
        }
    }
}
