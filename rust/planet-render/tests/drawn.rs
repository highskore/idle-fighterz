//! The differential test with drawing on: game.js draws every frame (run.js `<scenario>+draw`) and so does
//! planet-render. The random draws particles spend and the screen spots the drawing writes back feed the simulation
//! on both sides, the script also taps what only the drawing places, and the state samples must match as in
//! planet-core's difftest. Every frame is also compared: run.js records an FNV-1a hash of each frame game.js draws
//! (without the floating gain numbers, which planet-render doesn't draw yet), and planet-render's frame must hash the
//! same; a frame that doesn't is saved under rust/target/difftest for a look.
//!
//! game.js's traces are cached under rust/target/difftest, keyed by a hash of the JS, so a Rust-only change replays
//! against them in seconds. Each scenario is its own test: run them side by side with `--test-threads=4`.
//! Needs `node`; skips without.

#[path = "../../planet-core/tests/replay/mod.rs"]
mod replay;

use planet_render::scene::{Scene, View};
use planet_render::Framebuffer;
use std::path::Path;

fn fnv(buf: &[u32]) -> u32 {
    let mut h: u32 = 0x811c9dc5;
    for &w in buf {
        h = (h ^ w).wrapping_mul(16777619);
    }
    h
}

fn drawn(name: &str) {
    let full = format!("{name}+draw");
    let Some(tr) = replay::js(&full) else { return };
    let want: Vec<u32> = tr["hashes"].as_array().expect("frame hashes").iter().map(|v| v.as_u64().unwrap() as u32).collect();
    // the harness's 600×400 canvas: 200×134 game pixels at 3×
    let mut fb = Framebuffer::new(200, 134);
    let mut sc = Scene::new();
    let view = View::site(3.0);
    let (mut f, mut bad, mut first) = (0usize, 0usize, Vec::new());
    let dump = Path::new(env!("CARGO_MANIFEST_DIR")).join("../target/difftest");
    replay::scenario_with(&full, &mut |g, dt| {
        sc.draw(&mut fb, g, &view, dt);
        if fnv(&fb.buf) != want[f] {
            bad += 1;
            if first.len() < 5 {
                first.push(format!("frame {f} (t={:.2}s)", g.t));
                let _ = std::fs::create_dir_all(&dump);
                let _ = std::fs::write(dump.join(format!("{full}-frame{f}.rgba")), fb.rgba());
            }
        }
        f += 1;
    });
    eprintln!("{full}: {f} frames drawn, {} identical to game.js's, {bad} differ", f - bad);
    assert_eq!(f, want.len());
    assert!(bad == 0, "{full}: {bad} of {f} frames differ, first {first:?}");
}

#[test]
fn taps_drawn() {
    drawn("taps");
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
fn lookout_drawn() {
    drawn("lookout");
}

#[test]
fn calm_drawn() {
    drawn("calm");
}

#[test]
fn itx_drawn() {
    drawn("itx");
}

#[test]
#[ignore = "game.js takes over 10 minutes to draw it; cargo test -- --ignored"]
fn ascend_drawn() {
    drawn("ascend");
}

#[test]
#[ignore = "game.js takes over 10 minutes to draw it; cargo test -- --ignored"]
fn late_drawn() {
    drawn("late");
}

#[test]
#[ignore = "game.js takes over 10 minutes to draw it; cargo test -- --ignored"]
fn events_drawn() {
    drawn("events");
}

#[test]
#[ignore = "game.js takes over 10 minutes to draw it; cargo test -- --ignored"]
fn multiverse_drawn() {
    drawn("multiverse");
}

#[test]
#[ignore = "game.js takes over 10 minutes to draw it; cargo test -- --ignored"]
fn wishes_drawn() {
    drawn("wishes");
}
