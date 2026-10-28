//! game.js's floating gain numbers: each "+N" rises and fades, outlined in white, then drops out of `Game::floats`.

use crate::scene::{text, text_width};
use crate::Framebuffer;
use planet_core::num::js_round;
use planet_core::Game;

/// The end of `frame()`'s draw, after the flash: ages, draws and drops the floats.
pub fn draw(fb: &mut Framebuffer, g: &mut Game, dt: f64) {
    step(fb, g, dt, true);
}

/// The same in snake way's `hud()`: unfaded, and darker gold.
pub fn draw_snake(fb: &mut Framebuffer, g: &mut Game, dt: f64) {
    step(fb, g, dt, false);
}

fn step(fb: &mut Framebuffer, g: &mut Game, dt: f64, fade: bool) {
    for f in g.floats.iter_mut() {
        f.life -= dt * 0.8;
        f.y -= dt * 16.0;
        if f.life <= 0.0 {
            continue;
        }
        let (x, y) = (js_round(f.x - text_width(&f.s) / 2.0), js_round(f.y));
        let a = if fade { 1f64.min(f.life * 2.0) } else { 1.0 };
        for (ox, oy) in [(-1.0, 0.0), (1.0, 0.0), (0.0, -1.0), (0.0, 1.0)] {
            text(fb, &f.s, x + ox, y + oy, 0xffffff, a);
        }
        let c = match (f.red, f.gold, fade) {
            (true, ..) => 0xd8241e,
            (_, true, true) => 0xd99a1c,
            (_, true, false) => 0xb07a10,
            (_, _, true) => 0x111111,
            _ => 0x1d1030,
        };
        text(fb, &f.s, x, y, c, a);
    }
    g.floats.retain(|f| f.life > 0.0);
}
