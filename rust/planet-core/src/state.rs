use crate::data::{Hero, Upg, ANGELS, TREE};
use std::collections::BTreeSet;

/// The persistent state: game.js's `S`.
#[derive(Clone, Debug, Default)]
pub struct Save {
    pub pl: f64,
    pub best: f64,
    pub run_best: f64,
    pub levels: [u32; 14],
    pub world: u32,
    pub orbs7: u32,
    pub wishes: u32,
    pub granted: u32,
    /// every ki seed ever earned (the boost counts these, spent or not)
    pub ascend: f64,
    /// seeds left to spend in the tree
    pub seeds: f64,
    pub form: usize,
    pub tree: [u32; TREE.len()],
    pub saga: u32,
    pub uni: u32,
    pub uni_stage: u32,
    pub multi: bool,
    pub multi_t: f64,
    pub uni_best: u32,
    pub ustars: u32,
    pub mastery: u32,
    pub godki: u32,
    pub god_total: u32,
    pub gods: u32,
    pub angel: [bool; ANGELS.len()],
    pub auto_at: usize,
    pub zeno: u32,
    pub form_top: usize,
    pub form_top_name: &'static str,
    pub hero: Hero,
    pub goal: &'static str,
    pub goal_p: f64,
    pub goals_done: u32,
    pub laps_total: u32,
    pub namek_at: f64,
    pub krillin_ally: bool,
    pub krillin_dead: bool,
    pub krillin_revives: u32,
    /// space pods caught
    pub stars: u32,
    pub greg_wins: u32,
    /// dr. gero and android 19 take turns
    pub geros: u32,
    /// the scouter broke (power over 9000)
    pub o9k: bool,
    pub bosses: u32,
    pub tour_best: u32,
    pub movies: u32,
    pub trips: u32,
    /// seconds left of a visit in progress
    pub namek_left: f64,
    /// lost souls blasted on snake way
    pub souls: u32,
    /// the next full moon makes a giant
    pub big_ape: bool,
    /// the spirit bomb level (gregory's reward)
    pub spirit: u32,
    /// the base form's capsule aura colour
    pub aura: u32,
    pub beaten: BTreeSet<String>,
    pub foes: Vec<String>,
    pub ach: BTreeSet<&'static str>,
}

impl Save {
    pub fn new() -> Self {
        Save { goal: "combo", ..Default::default() }
    }

    pub fn lv(&self, u: Upg) -> u32 {
        self.levels[u as usize]
    }

    pub fn lvf(&self, u: Upg) -> f64 {
        self.levels[u as usize] as f64
    }
}
