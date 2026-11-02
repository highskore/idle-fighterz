//! Attacks scale the world: a full-charge beam or a big bang lands as a shockwave that grows with the run's best power.
//! Tier 1 is a flash, tier 2 a blue shock ring across the planet, tier 3 a gold ring that shakes the card and parts the
//! cloud sea, tier 4 a white-out and the sky cracking like glass round a void hole, healing over about 3s.
//! Nothing is saved: a wave is drawn and forgotten. planet-render draws them (`waves.rs`).

use crate::big::Big;
use crate::hud::Cue;
use crate::Game;

/// The run's best power each tier starts at.
pub const SCALE_AT: [f64; 4] = [2e8, 2e11, 2e14, 2e17];

/// How long a wave of each tier is drawn: its ring, then (tier 3) the cloud sea closing, (tier 4) the sky healing.
pub const WAVE_LIFE: [f64; 5] = [0.0, 0.35, 0.7, 4.5, 4.8];

/// A beam's wave lands when the beam reaches it (game.js's beam grows to full reach in 0.12s).
pub const BEAM_REACH: f64 = 0.12;

/// A shockwave, for the renderer: where it landed, when, and how big.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Wave {
    pub x: f64,
    pub y: f64,
    pub t0: f64,
    pub tier: u8,
}

/// The tier a run's best power reaches (0: no wave).
pub fn tier_of(best: Big) -> u8 {
    SCALE_AT.iter().filter(|&&v| best >= Big::from(v)).count() as u8
}

impl Game {
    /// A full beam or a big bang lands at (x, y) after `delay`: a wave of the run's tier, the screen shake it brings and,
    /// from tier 3, the card's own shake (the page's, which reduced motion skips).
    pub(crate) fn wave(&mut self, x: f64, y: f64, delay: f64) {
        let tier = tier_of(self.s.run_best);
        if tier == 0 {
            return;
        }
        self.inp.waves.push(Wave { x, y, t0: self.t + delay, tier });
        self.shake = self.shake.max([0.0, 0.3, 0.6, 1.4, 1.6][tier as usize]);
        if tier >= 3 {
            self.cue(Cue::Quake);
        }
    }

    /// Drops the waves that have played out.
    pub(crate) fn waves_step(&mut self, t: f64) {
        self.inp.waves.retain(|w| t - w.t0 <= WAVE_LIFE[w.tier as usize]);
    }

    /// `#scaleN` (1–4): a run at tier N's best power with the final flash, a full beam at the sky 3s in and every 6s
    /// after (`#scaleNbang`: a big bang).
    pub(crate) fn waves_preview(&mut self, hash: &str) {
        let Some(i) = hash.find(crate::hooks::key("scale")) else { return };
        let Some(n) = hash[i + 5..].chars().next().and_then(|c| c.to_digit(10)).filter(|n| (1..=4).contains(n)) else { return };
        let best = Big::from(SCALE_AT[n as usize - 1] * 1.5);
        self.s.best = self.s.best.max(best);
        self.s.run_best = self.s.run_best.max(best);
        self.s.levels[crate::data::Upg::Galick as usize] = self.s.levels[crate::data::Upg::Galick as usize].max(5);
        self.s.levels[crate::data::Upg::Bigbang as usize] = self.s.levels[crate::data::Upg::Bigbang as usize].max(1);
        self.tl.later.push((3.0, crate::timeline::Later::Wave(hash[i..].contains(crate::hooks::key("bang")))));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tiers_follow_the_runs_best() {
        assert_eq!(tier_of(Big::from(1e8)), 0);
        assert_eq!(tier_of(Big::from(2e8)), 1);
        assert_eq!(tier_of(Big::from(5e13)), 2);
        assert_eq!(tier_of(Big::from(2e14)), 3);
        assert_eq!(tier_of(Big::from(1e300) * 1e10), 4);
    }
}
