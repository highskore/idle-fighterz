//! planet-native: the Powerrr widget's renderer (stage 5). Tauri hosts it; frames go to a wgpu texture (or a
//! softbuffer surface as the fallback) instead of a web view's canvas, and a small web view overlays the HTML HUD.
//!
//! No window or GPU dependencies yet: this crate only fixes the seam the Tauri side will call.

use planet_core::{Clock, Game};
use planet_render::Framebuffer;

/// Where finished frames go: a wgpu texture upload or a softbuffer present.
pub trait Surface {
    fn present(&mut self, fb: &Framebuffer);
}

pub struct Widget<S: Surface> {
    pub game: Game,
    clock: Clock,
    fb: Framebuffer,
    surface: S,
}

impl<S: Surface> Widget<S> {
    pub fn new(seed: u32, w: usize, h: usize, surface: S) -> Self {
        let mut game = Game::new(seed);
        game.start();
        Widget { game, clock: Clock::default(), fb: Framebuffer::new(w, h), surface }
    }

    /// One display tick: simulate, then present (drawing joins in stage 1).
    pub fn tick(&mut self, elapsed: f64) {
        self.clock.advance(&mut self.game, elapsed, 8);
        self.surface.present(&self.fb);
    }
}
