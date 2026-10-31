//! The new heroes' own drawing. Piccolo meditating: he sits cross-legged, and only his cape moves, streaming back
//! and rippling in a wind that grows with his focus. No particles, glow or rings. Krillin's destructo discs: flat
//! spinning yellow discs that fly out along their line, with a faint trail.

use planet_core::heroes::DISC_FLIGHT;
use planet_core::jsmath::{cos, sin};
use planet_core::sprite::{piccolo_seated, Sprite};
use planet_core::Game;

use crate::scene::Ctx;

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

/// Krillin's discs in the air: each flies from his hand to the end of its line, a flat spinning disc (a giant one for
/// the barrage) with a faint trail behind it.
pub fn draw_discs(c: &mut Ctx, g: &Game) {
    let t = c.t;
    for d in g.discs() {
        let k = ((t - d.t0) / DISC_FLIGHT).clamp(0.0, 1.0);
        let (x, y) = (d.x0 + (d.x1 - d.x0) * k, d.y0 + (d.y1 - d.y0) * k);
        let (tx, ty) = (d.x0 + (d.x1 - d.x0) * (k - 0.35).max(0.0), d.y0 + (d.y1 - d.y0) * (k - 0.35).max(0.0));
        let n = 24;
        for i in 0..n {
            let f = i as f64 / n as f64;
            c.fb.px((tx + (x - tx) * f).round(), (ty + (y - ty) * f).round(), 0xfff2a0, 0.25 + 0.5 * f);
        }
        let (rx, ry) = if d.big { (14.0, 4.0) } else { (6.0, 1.8) };
        let spin = t * 40.0;
        let mut q = 0.0;
        while q < 6.283 {
            for (s, col) in [(1.0, 0xffb81e), (0.75, 0xffe14a), (0.4, 0xffffff)] {
                c.fb.px((x + cos(q) * rx * s).round(), (y + sin(q) * ry * s).round(), col, 1.0);
            }
            q += 0.25;
        }
        // a glint goes round the rim as it spins
        c.fb.px((x + cos(spin) * rx).round(), (y + sin(spin) * ry).round(), 0xffffff, 1.0);
    }
}
