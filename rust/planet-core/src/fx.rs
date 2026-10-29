//! world.js's particles: squares of pixels that grow and dissolve. The simulation and the renderer add to one list
//! (`Game::fx`), in game.js's order, and the renderer steps and draws it.

#[derive(Clone, Debug)]
pub struct Particle {
    pub x: f64,
    pub y: f64,
    pub vx: f64,
    pub vy: f64,
    pub g: f64,
    pub drag: f64,
    pub life: f64,
    pub age: f64,
    pub s: f64,
    pub grow: f64,
    pub c: Vec<u32>,
}

impl Particle {
    /// `fx.add({ x, y, c })` with world.js's defaults
    pub fn new(x: f64, y: f64, c: &[u32]) -> Self {
        Particle { x, y, vx: 0.0, vy: 0.0, g: 0.0, drag: 0.0, life: 1.0, age: 0.0, s: 1.0, grow: 0.0, c: c.to_vec() }
    }
    pub fn v(mut self, vx: f64, vy: f64) -> Self {
        self.vx = vx;
        self.vy = vy;
        self
    }
    pub fn life(mut self, l: f64) -> Self {
        self.life = l;
        self
    }
    pub fn size(mut self, s: f64, grow: f64) -> Self {
        self.s = s;
        self.grow = grow;
        self
    }
    pub fn drag(mut self, d: f64) -> Self {
        self.drag = d;
        self
    }
}
