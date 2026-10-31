//! planet-core: the power planet's game state and fixed-step simulation, shared by the web (wasm) and native builds.
//! It never touches pixels; planet-render draws from it.

pub mod big;
pub mod bridge;
pub mod buy;
pub mod data;
pub mod dusk;
pub mod floats;
pub mod fx;
pub mod game;
pub mod geom;
pub mod hud;
pub mod input;
pub mod intro;
pub mod jsmath;
pub mod json;
pub mod limits;
pub mod looks;
pub mod mech;
pub mod num;
pub mod proto;
pub mod rng;
pub mod save;
pub mod spots;
pub mod sprite;
pub mod state;
pub mod timeline;
pub mod xform;

pub use game::Game;

/// The step game.js runs at 30 fps; the fixed-step driver feeds `Game::frame` with it.
pub const DT: f64 = 1.0 / 30.0;

/// Fixed-step clock: banks real elapsed time and hands out whole steps, so the simulation is the same at any frame rate.
#[derive(Clone, Debug, Default)]
pub struct Clock {
    pub t: f64,
    bank: f64,
}

impl Clock {
    /// Runs as many fixed steps as `elapsed` seconds cover (at most `max_steps`, so a long pause can't stall a frame).
    pub fn advance(&mut self, game: &mut Game, elapsed: f64, max_steps: u32) -> u32 {
        self.bank += elapsed;
        let mut n = 0;
        while self.bank >= DT && n < max_steps {
            self.bank -= DT;
            self.t += DT;
            game.frame(self.t, DT);
            n += 1;
        }
        if n == max_steps {
            self.bank = 0.0;
        }
        n
    }
}
