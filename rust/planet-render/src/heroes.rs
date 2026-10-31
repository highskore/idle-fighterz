//! The new heroes' own drawing. Piccolo meditating: he sits cross-legged, and only his cape moves, streaming back
//! and rippling in a wind that grows with his focus. No particles, glow or rings.

use planet_core::jsmath::sin;
use planet_core::sprite::{piccolo_seated, Sprite};
use planet_core::Game;

/// How far back (in sprite pixels) the cape streams at no focus and at full.
const CAPE_CALM: f64 = 0.6;
const CAPE_FULL: f64 = 5.0;

/// Piccolo seated at time `t`, his cape fluttering with his focus.
pub fn seated(g: &Game, t: f64) -> Sprite {
    let s = piccolo_seated();
    let mut spr = s.body.clone();
    let amp = CAPE_CALM + (CAPE_FULL - CAPE_CALM) * g.focus();
    let (top, bottom) = s.cape.iter().fold((usize::MAX, 0), |(a, b), p| (a.min(p.0), b.max(p.0)));
    for j in top..=bottom {
        let span: Vec<_> = s.cape.iter().filter(|p| p.0 == j).collect();
        let (a, b) = (span.iter().map(|p| p.1).min().unwrap(), span.iter().map(|p| p.1).max().unwrap() + 1);
        // nothing at the shoulders, the most at the hem; a ripple runs down it
        let down = (j - top) as f64 / (bottom - top).max(1) as f64;
        let shift = (amp * down * (0.55 + 0.45 * sin(t * 2.6 - j as f64 * 0.55))).round() as usize;
        let a = a.saturating_sub(shift);
        for i in a..b {
            let c = if i == a || j == bottom {
                0x120c18
            } else if i == a + 1 {
                0xc2c6d2
            } else {
                0xf4f4f6
            };
            let k = j * spr.w + i;
            if spr.col[k] < 0 {
                spr.col[k] = c;
            }
        }
    }
    spr
}
