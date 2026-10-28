//! The differential test with drawing on: game.js draws every frame (run.js `<scenario>+draw`) and so does
//! planet-render, so the random draws particles spend and the screen spots the drawing writes back (where the
//! visitors, the boss and bubbles stand) feed the simulation on both sides, and the script taps what only the
//! drawing places. The state samples must match as in planet-core's difftest. Needs `node`; skips without.

#[path = "../../planet-core/tests/replay/mod.rs"]
mod replay;

use planet_render::scene::{Scene, View};
use planet_render::Framebuffer;

fn drawn(name: &str) {
    // the harness's 600×400 canvas: 200×134 game pixels at 3×
    let mut fb = Framebuffer::new(200, 134);
    let mut sc = Scene::new();
    let view = View::site(3.0);
    replay::scenario_with(&format!("{name}+draw"), &mut |g, dt| sc.draw(&mut fb, g, &view, dt));
}

#[test]
fn idle_drawn() {
    drawn("idle");
}

#[test]
fn active_drawn() {
    drawn("active");
}

#[test]
fn ascend_drawn() {
    drawn("ascend");
}

#[test]
fn late_drawn() {
    drawn("late");
}

#[test]
fn events_drawn() {
    drawn("events");
}

#[test]
fn multiverse_drawn() {
    drawn("multiverse");
}

#[test]
fn wishes_drawn() {
    drawn("wishes");
}
