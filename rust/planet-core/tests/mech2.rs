//! Each wave 2 mechanic does what it says, and idle play never feels it: a tap on a posing Ginyu Force member is a
//! free crit; the body change swaps back on a tap on your hero, costs the other taps (capped, never past your form)
//! and never stops your ki; Broly's rage cuts your taps and beams but not your ki, and big hits calm him; Metal
//! Cooler's clones split two for one, up to their caps, swap places, pay nothing, and never take your ki.

use planet_core::big::Big;
use planet_core::mech2::*;
use planet_core::{Game, DT};

fn game(hash: &str, sets: &[(&str, f64)], mechs: bool) -> Game {
    let mut g = Game::new(7);
    g.no_mechs = !mechs;
    g.preview(hash);
    for &(k, v) in sets {
        g.debug_set(k, v);
    }
    g.start();
    g
}

/// Where planet-render stands the boss, the ginyu force and metal cooler's clones (headless, nothing does).
fn place(g: &mut Game) {
    let (cx, cy, r) = (g.cam.cx, g.cam.cy, g.cam.r);
    if let Some(b) = g.tl.boss.as_mut() {
        (b.k, b.x, b.y) = (1.0, cx + r * 1.45, cy - r * 0.75);
    }
    if let Some(gi) = g.tl.ginyu.as_mut() {
        for m in gi.members.iter_mut() {
            let s = m.i as f64 - 2.0;
            (m.k, m.x, m.y) = (1.0, cx + s * r * 0.55, cy - r * 1.12 + s.abs() * r * 0.08);
        }
    }
    if let Some(mt) = g.tl.movie.as_mut().and_then(|m| m.metal.as_mut()) {
        let slots = mt.clone_slots();
        for (c, s) in mt.clones.iter_mut().zip(slots) {
            c.k = 1.0;
            c.x = s.map(|s| cx + (s as f64 - 4.0) * r * 0.35);
            c.y = cy + r * 1.2;
        }
    }
}

fn step(g: &mut Game) {
    place(g);
    let t = g.t + DT;
    g.frame(t, DT);
}

fn run(g: &mut Game, secs: f64) {
    let to = g.t + secs;
    while g.t < to - 1e-9 {
        step(g);
    }
}

fn until(g: &mut Game, ok: impl Fn(&Game) -> bool, secs: f64) {
    let to = g.t + secs;
    while !ok(g) {
        assert!(g.t < to, "timed out");
        step(g);
    }
}

fn gm(g: &Game) -> GinyuMech {
    g.tl.ginyu.as_ref().unwrap().mech.clone().expect("the ginyu force's mechanic")
}

fn member_hp(g: &Game, i: usize) -> f64 {
    let m = &g.tl.ginyu.as_ref().unwrap().members[i];
    (m.hp / m.max).to_f64()
}

fn tap_member(g: &mut Game, i: usize) {
    place(g);
    let m = &g.tl.ginyu.as_ref().unwrap().members[i];
    let (x, y) = (m.x, m.y - 6.0);
    g.tap(x, y);
}

const STRONG: [(&str, f64); 2] = [("armor", 0.0), ("boots", 30.0)];

#[test]
fn a_tap_mid_pose_is_a_free_crit() {
    let mut g = game("#ginyu", &STRONG, true);
    until(&mut g, |g| g.tl.ginyu.is_some(), 5.0);
    assert!(g.posing());
    assert!(g.events.iter().any(|e| e.0.starts_with("the ginyu force poses")));
    run(&mut g, 2.0);
    let h0 = member_hp(&g, 2);
    tap_member(&mut g, 2);
    let rude = h0 - member_hp(&g, 2);
    assert!(rude > 0.0);
    assert!(g.floats.iter().any(|f| f.gold), "a gold crit number");
    // the same tap after the poses
    let mut g2 = game("#ginyu", &STRONG, true);
    until(&mut g2, |g| g.tl.ginyu.as_ref().is_some_and(|g| g.mech.as_ref().unwrap().ph == GPh::Fight), 15.0);
    run(&mut g2, 0.7);
    let h0 = member_hp(&g2, 2);
    tap_member(&mut g2, 2);
    let plain = h0 - member_hp(&g2, 2);
    assert!(rude / plain >= 1.9, "×{} the plain tap", rude / plain);
}

#[test]
fn the_body_change_keeps_your_ki_and_swaps_back_on_your_hero() {
    let mut g = game("#ginyu", &[("armor", 0.0)], true);
    until(&mut g, |g| g.tl.ginyu.is_some(), 5.0);
    let t0 = g.tl.ginyu.as_ref().unwrap().t0;
    until(&mut g, |g| g.swapped(), G_POSE + G_AFTER + G_TELL + 1.0);
    assert!(g.t - t0 >= G_POSE + G_AFTER + G_TELL - 0.05, "idle: 12s after the poses");
    assert!(g.events.iter().any(|e| e.0.starts_with("ginyu took your body")));
    // ki flies on while he has your body
    let kis = |g: &Game| g.tl.kis.len();
    let mut seen = 0;
    for _ in 0..60 {
        step(&mut g);
        seen = seen.max(kis(&g));
    }
    assert!(seen > 0, "idle ki keeps flying");
    let h0 = member_hp(&g, 0);
    let k = g.kid_screen(12.0);
    g.tap(k.x, k.y);
    assert!(!g.swapped());
    assert_eq!(gm(&g).ph, GPh::Over);
    assert!(h0 - member_hp(&g, 0) >= G_BACK * 0.99, "ginyu takes 20%");
}

#[test]
fn the_wrong_taps_cost_power_capped_and_never_a_form() {
    let mut g = game("#ginyu", &[("pl", 6e4), ("best", 6e4), ("boots", 20.0)], true);
    until(&mut g, |g| g.swapped(), 40.0);
    let w = g.wrate();
    let floor = g.forms[g.s.form].at;
    for _ in 0..300 {
        g.train();
        step(&mut g);
        if !g.swapped() {
            break;
        }
    }
    let lost = gm(&g).lost;
    assert!(lost > 0.0, "a wrong tap costs");
    assert!(lost <= w * G_LOSS * 1.001, "capped at 10s of rate");
    assert!(g.s.pl >= Big::from(floor), "never below the form's mark");
    assert!(g.floats.iter().any(|f| f.red), "a red loss");
}

#[test]
fn the_androids_have_no_poses() {
    let mut g = game("#androids", &[], true);
    until(&mut g, |g| g.tl.ginyu.is_some(), 10.0);
    assert!(g.tl.ginyu.as_ref().unwrap().mech.is_none());
}

fn boss_hp(g: &Game) -> f64 {
    let b = g.tl.boss.as_ref().unwrap();
    (b.hp / b.max).to_f64()
}

fn broly(mechs: bool, hash: &str) -> Game {
    let mut g = game(hash, &[("galick", 1.0)], mechs);
    until(&mut g, |g| g.tl.boss.as_ref().is_some_and(|b| g.t > b.go + 0.1), 20.0);
    g
}

#[test]
fn broly_rages_and_your_taps_land_softer() {
    let mut g = broly(true, "#saga7");
    assert!(g.rage().unwrap() < 0.01);
    run(&mut g, 8.0);
    assert!(g.rage().unwrap() > 0.05, "it builds");
    assert!(g.events.iter().any(|e| e.0.starts_with("broly is getting angrier")) || g.rage().unwrap() < 0.2);
    let tap = |g: &mut Game| {
        run(g, 3.0);
        until(g, |g| g.tl.struggle.is_none(), 10.0);
        run(g, 1.0);
        let b = g.tl.boss.clone().unwrap();
        let h0 = boss_hp(g);
        g.tap(b.x, b.y - 10.0);
        h0 - boss_hp(g)
    };
    let mut g = broly(true, "#broly-rage");
    let raged = tap(&mut g);
    assert!(g.rage().unwrap() >= 0.999, "full rage: {:?} struggle {:?}", g.rage(), g.tl.struggle);
    assert!(g.events.iter().any(|e| e.0 == "broly is at full rage"));
    let calm = tap(&mut broly(false, "#broly-rage"));
    assert!((raged / calm - 0.5).abs() < 0.02, "half at full rage: ×{}", raged / calm);
}

#[test]
fn broly_never_slows_your_ki() {
    let (mut a, mut b) = (broly(true, "#saga7"), broly(false, "#saga7"));
    run(&mut a, 30.0);
    run(&mut b, 30.0);
    assert_eq!(boss_hp(&a), boss_hp(&b), "idle, his rage changes nothing");
}

#[test]
fn a_full_beam_calms_him() {
    let mut g = broly(true, "#broly-rage");
    let r0 = g.rage().unwrap();
    assert!(r0 > 0.85, "the hook starts him nearly raging: {r0}");
    let b = g.tl.boss.clone().unwrap();
    g.fire_beam(2.5, b.x, b.y - 10.0);
    assert!(r0 - g.rage().unwrap() >= R_CALM - 0.01);
    assert!(g.events.iter().any(|e| e.0 == "that rocked him — his rage drops"));
    // at most once every 3s
    let r1 = g.rage().unwrap();
    g.fire_beam(2.5, b.x, b.y - 10.0);
    assert!(r1 - g.rage().unwrap() < 0.01);
}

fn metal(mechs: bool, sets: &[(&str, f64)]) -> Game {
    let mut g = game("#metal", sets, mechs);
    until(&mut g, |g| g.tl.movie.is_some(), 10.0);
    g
}

fn mt(g: &Game) -> Metal {
    g.tl.movie.as_ref().unwrap().metal.clone().expect("metal cooler")
}

#[test]
fn every_other_cooler_is_metal() {
    let g = metal(true, &[]);
    assert_eq!(g.tl.boss.as_ref().unwrap().name, "metal cooler");
    assert_eq!(mt(&g).alive(), M_START as usize);
    assert!(g.tl.movie.as_ref().unwrap().minions.is_empty(), "no squadron");
    let mut g = game("#cooler", &[], true);
    until(&mut g, |g| g.tl.movie.is_some(), 10.0);
    assert!(g.tl.movie.as_ref().unwrap().metal.is_none(), "the first cooler is today's");
}

#[test]
fn a_broken_clone_splits_in_two_up_to_the_caps() {
    let mut g = metal(true, &[("boots", 40.0)]);
    let pl = g.s.pl;
    let mut most = 0;
    for _ in 0..600 {
        place(&mut g);
        let m = mt(&g);
        most = most.max(m.alive());
        let Some(c) = m.clones.iter().find(|c| !c.dead() && c.x.is_some()) else { break };
        let (x, y) = (c.x.unwrap(), c.y - 8.0);
        let s0 = m.shuffles;
        let n0 = m.clones.len();
        let alive0 = m.alive();
        for _ in 0..200 {
            g.tap(x, y);
            if mt(&g).shuffles > s0 {
                break;
            }
            step(&mut g);
        }
        let m = mt(&g);
        assert_eq!(m.shuffles, s0 + 1, "every metal cooler swaps places");
        let born = m.clones.len() - n0;
        assert!(born <= 2);
        if born < 2 {
            assert!(m.spawned == M_TOTAL || alive0 - 1 + born == M_ALIVE);
        }
        step(&mut g);
    }
    let m = mt(&g);
    assert_eq!(m.spawned, M_TOTAL);
    assert_eq!(m.alive(), 0, "and then they're done");
    assert!(most <= M_ALIVE);
    assert!(g.events.iter().any(|e| e.0.starts_with("no more spares")));
    assert!(g.s.pl - pl < g.wrate() * 5.0, "clones pay nothing (bar the trickle of income)");
}

#[test]
fn the_core_moves_with_every_break() {
    let m = Metal { shuffles: 0, ..Default::default() };
    assert_eq!(m.slot(0), 0, "he starts on the usual spot");
    for s in 0..20 {
        let m = Metal { shuffles: s, ..Default::default() };
        let all: std::collections::HashSet<usize> = (0..M_SLOTS).map(|r| m.slot(r)).collect();
        assert_eq!(all.len(), M_SLOTS, "nine coolers, nine spots");
    }
}

#[test]
fn idle_ki_goes_to_the_real_one() {
    let (mut a, mut b) = (metal(true, &[("armor", 30.0)]), metal(false, &[("armor", 30.0)]));
    assert_eq!(mt(&b).alive(), 0, "the baseline has no clones");
    run(&mut a, 40.0);
    run(&mut b, 40.0);
    assert_eq!(boss_hp(&a), boss_hp(&b), "idle, the clones change nothing");
    assert_eq!(mt(&a).alive(), M_START as usize, "and idle never breaks one");
}

#[test]
fn the_spirit_bomb_wipes_the_clones() {
    let mut g = metal(true, &[("armor", 30.0)]);
    g.s.spirit = 1;
    g.tl.spirit = 1.0;
    until(&mut g, |g| g.tl.spirit_ready, 5.0);
    let (x, y, _) = g.spirit_pos();
    g.tap(x, y);
    let gone = |g: &Game| g.tl.movie.as_ref().and_then(|m| m.metal.as_ref()).is_none_or(|m| m.alive() == 0);
    until(&mut g, gone, 5.0);
    if let Some(m) = g.tl.movie.as_ref().and_then(|m| m.metal.as_ref()) {
        assert_eq!(m.spawned, M_START, "none step out");
    }
}
