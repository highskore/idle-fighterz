//! The beam pierces: everything on its line and within its band is hit, not just the first thing, and the band
//! widens with the charge.

use planet_core::big::Big;
use planet_core::data::{Upg, A20};
use planet_core::timeline::{Gero, Meteor, Saiba};
use planet_core::Game;

/// A game with the galick gun at `lv`, playing; screen spots are set by hand, as the renderer would.
fn game(lv: u32) -> Game {
    let mut g = Game::new(7);
    g.start();
    g.s.levels[Upg::Galick as usize] = lv;
    g
}

/// A saibaman standing so that the beam's aim point (6px over his feet) is at (x, y).
fn saiba(g: &mut Game, x: f64, y: f64) {
    let c = g.frame3.n;
    g.tl.saibas.push(Saiba { c, born: 0.0, life: 99.0, soldier: false, dead: false, sx: Some((x, y + 6.0)) });
}

/// Points along the ray from his hands at (1, 0)·`d`, `off` pixels to its side.
fn along(g: &Game, d: f64, off: f64) -> (f64, f64) {
    let (hx, hy) = g.hand_pos();
    (hx + d, hy + off)
}

fn fire(g: &mut Game, c: f64) {
    let (hx, hy) = g.hand_pos();
    g.fire_beam(c, hx + 100.0, hy);
}

fn dead(g: &Game) -> Vec<bool> {
    g.tl.saibas.iter().map(|s| s.dead).collect()
}

#[test]
fn it_hits_every_saibaman_on_its_line() {
    for c in [0.5, 1.25, 2.5] {
        let mut g = game(1);
        for d in [20.0, 40.0, 60.0, 80.0, 140.0] {
            let (x, y) = along(&g, d, 0.0);
            saiba(&mut g, x, y);
        }
        fire(&mut g, c);
        assert_eq!(dead(&g), vec![true; 5], "charge {c}: the whole row");
        assert_eq!(g.inp.beam_hits.len(), 5, "a hit flash on each");
    }
}

#[test]
fn it_misses_what_is_off_its_line_or_behind_him() {
    let mut g = game(1);
    let c = 2.5;
    let band = g.beam_band(c, false);
    let (x, y) = along(&g, 50.0, 7.0 + band + 1.0);
    saiba(&mut g, x, y);
    let (x, y) = along(&g, -40.0, 0.0);
    saiba(&mut g, x, y);
    let (x, y) = along(&g, 50.0, 7.0 + band - 1.0);
    saiba(&mut g, x, y);
    fire(&mut g, c);
    assert_eq!(dead(&g), vec![false, false, true]);
}

#[test]
fn its_band_grows_with_the_charge() {
    let g = game(1);
    let bands: Vec<f64> = (1..=25).map(|i| g.beam_band(i as f64 / 10.0, false)).collect();
    assert!(bands.windows(2).all(|w| w[1] > w[0]), "{bands:?}");
    assert!(g.beam_band(2.5, true) > g.beam_band(2.5, false), "a final flash is wider");
    assert!(game(4).beam_band(2.5, false) > g.beam_band(2.5, false), "galick levels widen it");

    // a saibaman just off the line: a full charge reaches him, a short one doesn't
    let off = 7.0 + (g.beam_band(0.5, false) + g.beam_band(2.5, false)) / 2.0;
    let hit = |c: f64| {
        let mut g = game(1);
        let (x, y) = along(&g, 50.0, off);
        saiba(&mut g, x, y);
        fire(&mut g, c);
        g.tl.saibas[0].dead
    };
    assert!(!hit(0.5) && hit(2.5));
}

#[test]
fn meteors_and_gero_on_its_line_are_hit_too() {
    let mut g = game(1);
    for d in [30.0, 70.0] {
        let (x, y) = along(&g, d, 0.0);
        g.tl.meteors.push(Meteor { x, y, vx: 0.0, vy: 0.0, delay: 0.0, dead: false, sd: None });
    }
    let (x, y) = along(&g, 110.0, 0.0);
    g.tl.gero = Some(Gero { name: "dr. gero", spr: A20, x, y: y + A20.h / 2.0, t0: 0.0, drained: Big::from(1e3) });
    let pl = g.s.pl.to_f64();
    fire(&mut g, 1.5);
    assert!(g.tl.meteors.iter().all(|m| m.dead), "both meteors");
    assert!(g.tl.gero.is_none(), "gero lets go");
    assert!(g.s.pl.to_f64() > pl + 2e3 - 1.0, "and what he drained comes back twice over");
    assert_eq!(g.inp.beam_hits.len(), 3);
}
