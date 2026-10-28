/// The seeded generator that stands in for `Math.random`: the same 32-bit LCG the JS test harness installs,
/// so a seed and a script of inputs replay identically on both sides.
#[derive(Clone, Debug)]
pub struct Lcg {
    state: u32,
    draws: u64,
}

impl Lcg {
    pub fn new(seed: u32) -> Self {
        Self { state: if seed == 0 { 1 } else { seed }, draws: 0 }
    }

    /// A float in [0, 1).
    pub fn random(&mut self) -> f64 {
        self.draws += 1;
        self.state = self.state.wrapping_mul(1664525).wrapping_add(1013904223);
        self.state as f64 / 4294967296.0
    }

    /// Burns draws that JS spends on cosmetic particles, keeping the stream aligned with game.js.
    pub fn skip(&mut self, n: u32) {
        for _ in 0..n {
            self.random();
        }
    }

    pub fn draws(&self) -> u64 {
        self.draws
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_the_js_harness_sequence() {
        // (rs * 1664525 + 1013904223) >>> 0, rs = 1
        let mut r = Lcg::new(1);
        assert_eq!(r.random(), 1015568748.0 / 4294967296.0);
        assert_eq!(r.random(), 1586005467.0 / 4294967296.0);
        assert_eq!(r.draws(), 2);
    }
}
