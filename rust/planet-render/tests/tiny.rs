//! `tiny`: a canvas a pixel across, its planet shaking, still draws without indexing off the framebuffer.

use planet_core::bridge::Bridge;
use planet_core::data::{ladder_of, CHARS};
use planet_render::scene::{Scene, View};
use planet_render::Framebuffer;

fn play(hash: &str, hero: &str, w: usize, h: usize) {
    let mut b = Bridge::new(1, w as f64, h as f64, 3.0);
    b.game.set_view(w as f64, h as f64, false);
    b.game.preview(hash);
    let now = 1.7e12;
    b.start("Wed Oct 28 2026", now);
    let &(hh, ..) = CHARS.iter().find(|c| c.1 == hero).unwrap();
    b.game.s.hero = hh;
    b.game.forms = ladder_of(hh, b.game.s.limits);
    let (mut fb, mut sc, view) = (Framebuffer::new(w, h), Scene::new(), View::site(3.0));
    let dt = 1.0 / 30.0;
    for f in 1..=90 {
        let t = f as f64 * dt;
        b.game.shake = 1.0; // the screen shake's bob lifts everything a pixel or two, above the top row here
        b.frame_drawn(t, dt, now + t * 1000.0, &mut |g, dt| sc.draw(&mut fb, g, &view, dt));
    }
}

#[test]
fn the_lookouts_pole_on_a_one_pixel_canvas() {
    for hero in ["krillin", "goten", "gohan"] {
        play("lookout", hero, 1, 1);
    }
}
