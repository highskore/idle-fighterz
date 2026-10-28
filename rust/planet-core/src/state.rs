use crate::data::{Hero, Upg, ANGELS, TREE};
use std::collections::BTreeSet;

/// The persistent state: game.js's `S`, minus what belongs to stage-3 events (bosses, trips, wishes in progress).
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
