//! Regressions from the planet-core review: nothing taps for an idle player, a fight's taps beat a form-up, a reset
//! calls off the form-up under way, the cell games hold the stage, zeno forgets the story beats, ginyu's toasts have
//! their own slots, a stun restarts a held beam, fat buu's belly stops the ki, a big hit gets through kid buu's reform,
//! the formatters take NaN and Infinity, and the milestones stop at the top of the range.

use planet_core::big::{Big, E_MAX};
use planet_core::cellgames::CgPh;
use planet_core::intro::BI_DUR;
use planet_core::limits::milestone;
use planet_core::mech::*;
use planet_core::timeline::Moon;
use planet_core::xform::XForm;
use planet_core::{Game, DT};

fn game(seed: u32, hash: &str, sets: &[(&str, f64)]) -> Game {
    let mut g = Game::new(seed);
    g.preview(hash);
    for &(k, v) in sets {
        g.debug_set(k, v);
    }
    g.start();
    g
}

fn step(g: &mut Game) {
    let (cx, cy, r) = (g.cam.cx, g.cam.cy, g.cam.r);
    if let Some(b) = g.tl.boss.as_mut() {
        (b.k, b.x, b.y) = (1.0, cx + r * 1.45, cy - r * 0.75);
    }
    let t = g.t + DT;
    g.frame(t, DT);
}

fn run(g: &mut Game, secs: f64) {
    let to = g.t + secs;
    while g.t < to - 1e-9 {
        step(g);
    }
}

fn hp(g: &Game) -> f64 {
    let b = g.tl.boss.as_ref().unwrap();
    (b.hp / b.max).to_f64()
}

fn mech(g: &Game) -> Mech {
    g.tl.boss.as_ref().unwrap().mech.clone().expect("his mechanic")
}

/// A form-up scene starting now, as xform.rs starts one.
fn scene(g: &mut Game) {
    let f = g.s.form;
    g.xf = Some(XForm { t0: g.t, p: 0.0, taps: 0, tap_t: -9.0, rv: None, from: f, to: f + 1 });
}

#[test]
fn the_moon_never_taps_for_an_idle_player() {
    let sets = [("pl", 1e6), ("best", 5e4), ("boots", 2.0), ("partner", 10.0), ("house", 10.0), ("armor", 0.0), ("tail", 1.0)];
    let mut g = game(1, "#ginyu", &sets);
    let (mut moon, mut ape) = (false, false);
    while g.t < 60.0 {
        if g.swapped() && !moon {
            moon = true;
            let (w, h) = (g.cam.w, g.cam.h);
            g.tl.moon = Some(Moon { x: w * 0.2, y: h * 0.22, r: 9.0, a: 1.0, born: g.t - 6.5, leaving: false });
        }
        ape |= g.b.ape_until > g.t;
        step(&mut g);
    }
    assert!(moon, "ginyu swapped bodies");
    assert!(ape, "the moon still turns him into the great ape");
    let lost = g.tl.ginyu.as_ref().and_then(|gi| gi.mech.as_ref()).map_or(0.0, |m| m.lost.to_f64());
    assert_eq!(lost, 0.0, "no tap was made, so the swap took nothing");
}

#[test]
fn a_deflect_beats_a_form_up() {
    let mut g = game(7, "#saga4", &[]);
    run(&mut g, BI_DUR + F_FIRST + 0.5);
    assert!(matches!(mech(&g), Mech::Frieza { ph: Ph::Aim, .. }));
    scene(&mut g);
    let before = hp(&g);
    let k = g.kid_screen(12.0);
    g.tap(k.x, k.y);
    assert!(before - hp(&g) >= F_BACK * 0.99, "the tap deflects, the power-up doesn't take it");
    assert_eq!(g.xf.as_ref().unwrap().taps, 0);
}

#[test]
fn an_ascend_mid_scene_lands_no_form() {
    let mut g = Game::new(1);
    g.start();
    run(&mut g, 1.0);
    (g.s.pl, g.s.best) = (Big::from(3e4), Big::from(3e4));
    run(&mut g, 0.5);
    assert!(g.xf.is_some(), "the scene is on");
    (g.s.pl, g.s.best) = (Big::from(2e6), Big::from(2e6));
    assert!(g.buy("ascend"));
    run(&mut g, 9.0);
    assert_eq!(g.s.form, 0, "back to base, with {:?}", g.s.pl);
    assert!(g.xf.is_none());
}

#[test]
fn nothing_big_starts_during_the_cell_games() {
    let mut g = game(1, "#cellgames", &[("best", 1e6)]);
    while g.tl.cg.as_ref().is_none_or(|c| c.ph != CgPh::Count) {
        assert!(g.t < 30.0, "the games start");
        step(&mut g);
    }
    while g.tl.cg.as_ref().is_some_and(|c| matches!(c.ph, CgPh::Count | CgPh::Jrs)) {
        let tl = &mut g.tl;
        (tl.next_ginyu, tl.next_andro, tl.next_ship, tl.next_dance, tl.next_cling, tl.next_gero) = (0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
        g.session = g.session.max(300.0);
        step(&mut g);
        let tl = &g.tl;
        assert!(
            tl.ginyu.is_none() && tl.ship.is_none() && tl.dance.is_none() && tl.cling.is_none() && tl.gero.is_none(),
            "{:.1}s: something started in the games",
            g.t
        );
    }
}

#[test]
fn zeno_forgets_the_story_beats() {
    let mut g = game(1, "", &[]);
    g.s.gods = 100;
    (g.tl.cg_story, g.tl.cg_n, g.tl.candy_story, g.tl.candy_n) = (true, 3, true, 2);
    g.zeno_erase();
    assert_eq!(g.s.zeno, 1);
    assert_eq!((g.tl.cg_story, g.tl.cg_n, g.tl.candy_story, g.tl.candy_n), (false, 0, false, 0));
}

#[test]
fn a_boss_toast_never_silences_the_swap_warning() {
    let mut g = game(7, "#ginyu", &[("armor", 0.0), ("boots", 30.0)]);
    while g.tl.ginyu.as_ref().is_none_or(|gi| gi.mech.is_none()) {
        step(&mut g);
    }
    // a boss that came along since said something in every slot his mechanic has
    g.tl.mech_say[..4].fill(1e9);
    while !g.swapped() {
        assert!(g.t < 60.0, "ginyu swaps bodies");
        step(&mut g);
    }
    assert!(g.events.iter().any(|e| e.0.starts_with("ginyu took your body")));
}

#[test]
fn a_stun_restarts_a_held_beam() {
    let mut g = game(7, "#saga4", &[("galick", 1.0)]);
    step(&mut g);
    // no beam struggle, which would hold his clocks
    g.tl.boss.as_mut().unwrap().struggled = true;
    run(&mut g, BI_DUR + F_FIRST + 0.5);
    assert!(matches!(mech(&g), Mech::Frieza { ph: Ph::Aim, .. }));
    let k = g.kid_screen(12.0);
    g.pointer_down(k.x, k.y, k.x, k.y, 1, 0, false);
    run(&mut g, F_AIM);
    assert!(g.stunned(), "the death beam lands");
    while g.stunned() {
        step(&mut g);
    }
    step(&mut g);
    assert!(g.inp.charging < 0.1, "the charge starts over after the stun, not at {}", g.inp.charging);
}

#[test]
fn fat_buus_belly_stops_the_ki() {
    let mut g = game(1, "#candy", &[]);
    g.s.krillin_ally = true;
    while g.tl.candy.is_none() {
        assert!(g.t < 10.0, "buu comes");
        step(&mut g);
    }
    run(&mut g, 30.0);
    assert!(g.tl.boss.as_ref().is_some_and(|b| b.hp == b.max), "idle, nothing reaches him");
}

#[test]
fn a_big_hit_gets_through_kid_buus_reform() {
    let mut g = game(7, "#saga6", &[("armor", 400.0), ("galick", 1.0)]);
    run(&mut g, BI_DUR + 1.0);
    while !matches!(mech(&g), Mech::Buu { reforms: 1.., .. }) {
        assert!(g.t < BI_DUR + 30.0, "he reforms");
        step(&mut g);
    }
    let before = hp(&g);
    let b = g.tl.boss.as_ref().unwrap();
    let (x, y) = (b.x, b.y - b.spr().h / 2.0 * b.k);
    g.fire_beam(B_BIG, x, y);
    assert!(hp(&g) < before, "the big beam lands mid-reform");
}

#[test]
fn the_formatters_take_nan_and_infinity() {
    use planet_core::num::*;
    for (x, s) in [(f64::NAN, "NaN"), (f64::INFINITY, "Infinity"), (f64::NEG_INFINITY, "-Infinity")] {
        assert_eq!(fmt_short(x), s);
        assert_eq!(hud_fmt(x), s);
        assert_eq!(hud_short(x), s);
        assert_eq!(to_fixed(x, 1), s);
        assert_eq!(to_exponential(x, 1), s);
    }
}

#[test]
fn milestones_stop_at_the_top_of_the_range() {
    let top = E_MAX as f64;
    let i = (0..).find(|&i| milestone(i).0 > top).unwrap();
    for j in i..i + 50 {
        assert_eq!(milestone(j), (f64::INFINITY, None), "milestone {j} is past the top");
    }
    let mut g = game(1, "", &[]);
    (g.s.o9k, g.s.mile) = (true, i - 1);
    g.s.best = Big::exp10(top);
    run(&mut g, 2.0);
    assert_eq!(g.s.mile, i, "the last one fires once, then none");
}

#[test]
fn the_seeds_wish_is_a_flat_five() {
    for pl in [1e6, 1e40] {
        let mut g = game(1, "", &[("pl", pl), ("best", pl)]);
        g.summon();
        while g.tl.shen.as_ref().is_none_or(|s| s.phase != planet_core::timeline::Phase::Wish) {
            assert!(g.t < 60.0, "the dragon offers");
            step(&mut g);
        }
        let w = planet_core::data::WISHES.iter().position(|w| w.0 == "seeds").unwrap();
        g.tl.shen.as_mut().unwrap().offer = vec![w];
        let (seeds, ascend) = (g.s.seeds, g.s.ascend);
        g.pick("seeds");
        assert_eq!((g.s.seeds - seeds, g.s.ascend - ascend), (Big::from(5.0), Big::from(5.0)), "at {pl:e}");
    }
}

#[test]
fn the_ki_ceiling_line_waits_until_it_holds_you_back() {
    use planet_core::limits::{CEIL_HINT_S, CEIL_HINT_X};
    let mut g = game(1, "", &[("gravity", 120.0)]);
    step(&mut g);
    assert!(g.core() >= g.ceiling() * CEIL_HINT_X, "well past the ceiling");
    assert!(!g.limit_line().contains("ki ceiling"), "not at once");
    run(&mut g, CEIL_HINT_S + 1.0);
    assert!(g.limit_line().starts_with("ki ceiling · train to raise it"), "{}", g.limit_line());
    g.debug_set("gravity", 0.0);
    step(&mut g);
    assert!(!g.limit_line().contains("ki ceiling"), "gone once it stops");
}
