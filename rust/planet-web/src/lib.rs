//! planet-web: the WebAssembly build drawn into the existing canvas on highskore.com (stage 4).
//!
//! This is the surface wasm-bindgen will export; it stays a plain Rust API until the HUD bridge stage, so nothing is
//! wired into the web build yet. JS keeps the HTML HUD: it calls `step` from requestAnimationFrame, copies `pixels()`
//! into ImageData, and reads `hud()` to fill the DOM the way game.js's `ui.update` does today.

use planet_core::{Clock, Game};
use planet_render::Framebuffer;

pub struct WebGame {
    pub game: Game,
    clock: Clock,
    pub fb: Framebuffer,
}

/// What `ui.update` hands page.html each frame (the subset planet-core has so far).
#[derive(Clone, Debug, PartialEq)]
pub struct Hud {
    pub pl: f64,
    pub best: f64,
    pub rate: f64,
    pub laps: u32,
    pub time: f64,
    pub combo: f64,
    pub form: &'static str,
    pub form_x: f64,
}

impl WebGame {
    pub fn new(seed: u32, w: usize, h: usize) -> Self {
        let mut game = Game::new(seed);
        game.start();
        WebGame { game, clock: Clock::default(), fb: Framebuffer::new(w, h) }
    }

    /// Advances the simulation by real elapsed seconds in fixed steps; returns how many ran.
    pub fn step(&mut self, elapsed: f64) -> u32 {
        self.clock.advance(&mut self.game, elapsed, 8)
    }

    pub fn tap(&mut self) {
        self.game.train();
    }

    pub fn buy(&mut self, key: &str) -> bool {
        self.game.buy(key)
    }

    pub fn pixels(&self) -> &[u8] {
        self.fb.rgba()
    }

    pub fn hud(&self) -> Hud {
        let g = &self.game;
        let f = &g.forms[g.s.form];
        Hud { pl: g.s.pl, best: g.s.best, rate: g.rate(), laps: g.laps, time: g.session, combo: g.combo, form: f.name, form_x: f.x }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_second_of_play_earns_income() {
        let mut w = WebGame::new(1, 8, 8);
        assert_eq!(w.step(1.01), 8); // capped per call
        for _ in 0..12 {
            w.step(0.1);
        }
        assert!(w.hud().pl >= 1.0);
        assert_eq!(w.pixels().len(), 8 * 8 * 4);
    }
}
