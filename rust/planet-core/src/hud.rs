//! What the HTML HUD reads: a per-frame snapshot, the shop rows and the menus, all as data. See rust/HUD.md.

use crate::game::Game;

/// A one-shot UI call game.js makes besides `ui.event`: a sound, a title effect, the tap bump.
#[derive(Clone, Debug, PartialEq)]
pub enum Cue {
    /// `ui.sfx(kind)`
    Sfx(&'static str),
    /// `ui.fx(kind)`
    Fx(&'static str),
    /// `ui.fx('form', i)`
    Form(usize),
    /// `ui.bump()`: the power number pops on a tap
    Bump,
    /// `ui.achieved()`: an achievement landed (the page recounts them)
    Achieved,
    /// `ui.zeno()`: zeno was tapped; the page asks about his button
    Zeno,
    /// `ui.treeGift(text)`
    TreeGift(String),
}

impl Game {
    pub(crate) fn cue(&mut self, c: Cue) {
        self.cues.push(c);
    }
}
