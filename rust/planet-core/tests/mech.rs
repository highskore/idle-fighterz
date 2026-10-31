//! Each boss mechanic does what it says: Frieza's beam stuns unless deflected (and a deflect costs him 3%), Cell
//! heals off an ally until you rescue him, Kid Buu reforms from small hits but falls to a big one, Hit's skip
//! swallows taps, and Jiren bounces weak beams but takes ×1.5 from full ones.

use planet_core::intro::BI_DUR;
use planet_core::mech::*;
use planet_core::{Game, DT};

fn raid(saga: u32, sets: &[(&str, f64)]) -> Game {
    let mut g = Game::new(7);
    g.preview(&format!("#saga{saga}"));
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

fn until(g: &mut Game, t: f64) {
    while g.t < t - 1e-9 {
        step(g);
    }
}

fn mech(g: &Game) -> Mech {
    g.tl.boss.as_ref().unwrap().mech.clone().expect("his mechanic")
}

fn hp(g: &Game) -> f64 {
    (g.tl.boss.as_ref().unwrap().hp / g.tl.boss.as_ref().unwrap().max).to_f64()
}

#[test]
fn frieza_stuns_unless_deflected() {
    let mut g = raid(4, &[]);
    until(&mut g, BI_DUR + F_FIRST + F_AIM + 0.1);
    assert!(g.stunned(), "idle, the death beam lands");
    assert!(g.events.iter().any(|e| e.0.starts_with("death beam")));
    let mut g = raid(4, &[]);
    until(&mut g, BI_DUR + F_FIRST + 0.5);
    assert!(matches!(mech(&g), Mech::Frieza { ph: Ph::Aim, .. }));
    let before = hp(&g);
    let k = g.kid_screen(12.0);
    g.tap(k.x, k.y);
    assert!(before - hp(&g) >= F_BACK * 0.99, "the deflect sends 3% back");
    until(&mut g, BI_DUR + F_FIRST + F_AIM + 0.1);
    assert!(!g.stunned(), "and the beam never lands");
}

#[test]
fn cell_heals_off_an_ally_until_rescued() {
    let mut g = raid(5, &[("partner", 4.0), ("armor", 60.0)]);
    until(&mut g, BI_DUR + C_FIRST + C_REACH + 1.0);
    let Mech::Cell { ph, who, healed, .. } = mech(&g) else { panic!() };
    assert_eq!((ph, who), (Ph::Drain, Ally::Bubbles));
    assert!(healed > 0.0, "he heals while he drains");
    let (x, y) = g.held_spot().unwrap();
    g.tap(x, y - 8.0);
    let Mech::Cell { ph, healed: h2, .. } = mech(&g) else { panic!() };
    assert_eq!(ph, Ph::Idle, "rescued");
    let to = g.t + 1.0;
    until(&mut g, to);
    let Mech::Cell { healed: h3, .. } = mech(&g) else { panic!() };
    assert_eq!(h2, h3, "no more healing");
    assert!(g.events.iter().any(|e| e.0 == "bubbles breaks free and smacks cell"));
}

#[test]
fn cell_heals_at_most_his_cap() {
    let mut g = raid(5, &[("partner", 4.0), ("armor", 30.0)]);
    until(&mut g, BI_DUR + 40.0);
    if let Some(Mech::Cell { healed, .. }) = g.tl.boss.as_ref().and_then(|b| b.mech.clone()) {
        assert!(healed <= C_CAP + 1e-9);
    }
}

#[test]
fn kid_buu_reforms_from_small_hits_and_falls_to_a_big_one() {
    let mut g = raid(6, &[("armor", 400.0), ("galick", 1.0)]);
    until(&mut g, BI_DUR + 1.0);
    let mut reformed = false;
    while g.t < BI_DUR + 30.0 && !reformed {
        step(&mut g);
        reformed = matches!(mech(&g), Mech::Buu { reforms: 1.., .. });
    }
    assert!(reformed, "the ki blasts can't finish him: he reforms");
    assert!(!g.tl.boss.as_ref().unwrap().dead);
    let to = g.t + B_REFORM_T + 0.05;
    until(&mut g, to);
    let b = g.tl.boss.as_ref().unwrap();
    let (x, y) = (b.x, b.y - b.spr().h / 2.0 * b.k);
    g.fire_beam(B_BIG, x, y);
    assert!(g.tl.boss.as_ref().unwrap().dead, "a big beam finishes him");
}

#[test]
fn hit_skips_time_and_swallows_taps() {
    let mut g = raid(9, &[]);
    until(&mut g, BI_DUR + H_FIRST + H_GLINT + 0.2);
    assert!(g.skipping());
    let (pl, hp0) = (g.s.pl, hp(&g));
    g.train();
    let b = g.tl.boss.as_ref().unwrap();
    let (x, y) = (b.x, b.y - b.spr().h / 2.0 * b.k);
    g.tap(x, y);
    assert_eq!((g.s.pl, hp(&g)), (pl, hp0), "taps do nothing while time is skipped");
    until(&mut g, BI_DUR + H_FIRST + H_GLINT + H_SKIP + 0.2);
    assert!(!g.skipping());
    g.tap(x, y);
    assert!(hp(&g) < hp0, "the opening");
}

#[test]
fn jiren_bounces_weak_beams_and_takes_full_ones_harder() {
    let mut g = raid(11, &[("galick", 1.0)]);
    until(&mut g, BI_DUR + 0.5);
    let hp0 = hp(&g);
    let b = g.tl.boss.as_ref().unwrap();
    let (x, y) = (b.x, b.y - b.spr().h / 2.0 * b.k);
    g.fire_beam(1.0, x, y);
    assert_eq!(hp(&g), hp0, "a weak beam does nothing to him");
    let to = g.t + J_BACK + 0.05;
    until(&mut g, to);
    assert!(g.stunned(), "it comes back at you");
    let to = g.t + J_STUN;
    until(&mut g, to);
    let hp1 = hp(&g);
    g.fire_beam(2.5, x, y);
    let full = hp1 - hp(&g);
    let mut g2 = raid(11, &[("galick", 1.0)]);
    g2.no_mechs = true;
    until(&mut g2, g.t);
    let h = hp(&g2);
    g2.fire_beam(2.5, x, y);
    assert!(full > (h - hp(&g2)) * 1.4, "a full one breaks through for ×1.5");
}

#[test]
fn a_stun_never_touches_training() {
    let mut g = raid(4, &[]);
    until(&mut g, BI_DUR + F_FIRST + F_AIM + 0.1);
    assert!(g.stunned());
    let pl = g.s.pl;
    g.train();
    assert!(g.s.pl > pl);
}

#[test]
fn cell_grabs_who_is_really_there() {
    // playing piccolo, the ally meditating in his place is kid gohan
    let mut g = Game::new(7);
    g.preview("#hero-piccolo#saga5");
    g.debug_set("piccolo", 1.0);
    g.debug_set("armor", 60.0);
    g.start();
    until(&mut g, BI_DUR + C_FIRST + C_REACH + 1.0);
    let Mech::Cell { who, .. } = mech(&g) else { panic!() };
    assert_eq!(who, Ally::Piccolo);
    assert!(g.events.iter().any(|e| e.0.starts_with("cell grabs kid gohan")), "{:?}", g.events);
    // playing krillin, a krillin ally isn't there to grab
    let mut g = Game::new(7);
    g.preview("#hero-krillin#saga5");
    g.debug_set("armor", 60.0);
    g.s.krillin_ally = true;
    g.start();
    until(&mut g, BI_DUR + C_FIRST + C_REACH + 1.0);
    assert!(matches!(mech(&g), Mech::Cell { ph: Ph::Idle, .. }), "nobody to grab");
}
