//! Every hero's helper draws above the planet, perch and all, and isn't drawn while they're away raiding.

use planet_core::data::{Upg, CHARS};
use planet_core::{Game, DT};
use planet_render::scene::{Scene, View};
use planet_render::Framebuffer;

fn draw(g: &mut Game, secs: f64) {
    let (mut fb, mut sc, view) = (Framebuffer::new(200, 134), Scene::new(), View { scale: 1.0, bare: true, clouds: None, cloud_amt: 2.0 });
    for _ in 0..(secs / DT) as usize {
        let t = g.t + DT;
        g.frame(t, DT);
        sc.draw(&mut fb, g, &view, 0.0);
    }
}

fn with_helper(id: &str) -> Game {
    let mut g = Game::new(7);
    g.preview(&format!("#hero-{id}"));
    g.start();
    g.s.levels[Upg::Piccolo as usize] = 1;
    g
}

#[test]
fn every_heros_helper_draws() {
    for &(_, id, _, _) in CHARS.iter() {
        let mut g = with_helper(id);
        // round the planet, so the helper comes to the near side
        draw(&mut g, 10.0);
    }
}

#[test]
fn a_raiding_helper_is_not_drawn_above_the_planet_too() {
    let mut g = with_helper("krillin");
    let mut n = 0;
    while g.tl.piccolo_at.is_none() {
        draw(&mut g, DT);
        n += 1;
        assert!(n < 30 * 60, "18 never came round");
    }
    g.session = 400.0;
    g.s.best = 1e6.into();
    g.tl.next_andro = 0.0;
    draw(&mut g, 1.0);
    assert!(g.tl.ginyu.as_ref().is_some_and(|r| r.members.iter().any(|m| m.name == "android 18")));
    assert_eq!(g.tl.piccolo_at, None);
}
