//! game.js's `floats`: the "+N" that rises from wherever a gain lands. The simulation adds them, in game.js's order,
//! and the renderer ages, draws and drops them.

use crate::game::Game;
use crate::num::{fmt_short, js_round};

#[derive(Clone, Debug)]
pub struct Float {
    pub x: f64,
    pub y: f64,
    pub s: String,
    pub life: f64,
    pub gold: bool,
    pub red: bool,
}

impl Game {
    /// `gain(n, x, y, gold)`: the gain, and its "+N" at (x, y).
    pub fn gain_at(&mut self, n: f64, x: f64, y: f64, gold: bool) {
        self.gain(n);
        let n = js_round(n).max(1.0);
        self.floats.push(Float { x, y, s: format!("+{}", fmt_short(n)), life: 1.0, gold, red: false });
    }

    /// `buffPop(dmg, x, y)`: the red damage a buffed hit does to a boss.
    pub(crate) fn buff_pop(&mut self, dmg: f64, x: f64, y: f64) {
        if self.atk_buff() > 1.0 {
            let s = fmt_short(js_round(dmg * (1.0 + 0.5 * self.s.lvf(crate::data::Upg::Armor))));
            self.floats.push(Float { x, y: y - 8.0, s, life: 1.0, gold: false, red: true });
        }
    }

    /// a tap stuck in bujin's web
    pub(crate) fn webbed(&mut self, x: f64, y: f64) {
        self.floats.push(Float { x, y: y - 6.0, s: "webbed!".into(), life: 0.7, gold: false, red: false });
    }
}
