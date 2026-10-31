//! planet-core's `waves` drawn: the hit itself grows with the run's best power.
//!
//! - Tier 1: an impact star and a small ring, a flash.
//! - Tier 2: a blue shock ring racing out across the planet.
//! - Tier 3: a gold ring with an orange wake, and the cloud sea parts round where it landed (the page shakes the card).
//! - Tier 4: a white-out, then the sky cracks like glass round a hole of void, and heals from the tips in.
//!
//! All of it from `hash`, so the game's random stream is left alone. Reduced motion drops the flashes and the white-out;
//! the floating widget (no sky behind it) keeps its rings and flashes on what's drawn, without the glass.

use planet_core::jsmath::{cos, hypot, pow, sin};
use planet_core::waves::Wave;
use planet_core::Game;

use crate::scene::{hash, Ctx, Scene, View};
use crate::{bayer, h2};
use planet_core::num::js_round;

const RINGS: [f64; 4] = [15.0, 28.0, 46.0, 72.0];

/// The sky's cracks round a tier 4 hit: rays out from it (points with their distance along), and rings across them.
pub(crate) struct Glass {
    t0: f64,
    rays: Vec<Vec<(f64, f64, f64)>>,
    rings: Vec<Vec<(f64, f64)>>,
}

impl Glass {
    fn new(c: &Ctx, x: f64, y: f64, t0: f64) -> Self {
        let (n, far) = (15, hypot(&[c.w, c.h]));
        let mut rays = Vec::with_capacity(n);
        for i in 0..n {
            let fi = i as f64;
            let a0 = fi / n as f64 * 6.283 + hash(fi * 3.7 + 1.0) * 0.3;
            let (mut px, mut py, mut d) = (x, y, 0.0);
            let mut pts = vec![(x, y, 0.0)];
            while d < far {
                let step = 5.0 + hash(fi * 11.0 + d) * 12.0;
                let a = a0 + (hash(fi * 5.0 + d * 0.3) - 0.5) * 0.35;
                px += cos(a) * step;
                py += sin(a) * step;
                d += step;
                pts.push((px, py, d));
            }
            rays.push(pts);
        }
        let s = 1f64.max(c.r / 60.0);
        let rings = RINGS
            .iter()
            .enumerate()
            .map(|(j, &r)| rays.iter().enumerate().map(|(i, ray)| at(ray, r * (0.85 + hash(i as f64 * 7.0 + j as f64) * 0.3) * s)).collect())
            .collect();
        Glass { t0, rays, rings }
    }
}

/// The point `r` along a ray.
fn at(ray: &[(f64, f64, f64)], r: f64) -> (f64, f64) {
    for j in 1..ray.len() {
        if ray[j].2 >= r {
            let (p, q) = (ray[j - 1], ray[j]);
            let f = (r - p.2) / (q.2 - p.2);
            return (p.0 + (q.0 - p.0) * f, p.1 + (q.1 - p.1) * f);
        }
    }
    let l = ray[ray.len() - 1];
    (l.0, l.1)
}

/// How long a tier's ring takes to race out.
fn ring_life(tier: u8) -> f64 {
    [0.0, 0.35, 0.7, 1.0, 1.2][tier as usize]
}

/// An impact star: long spikes on the axes, short ones on the diagonals, a hot core; `k` 0..1 is its age.
fn star(c: &mut Ctx, x: f64, y: f64, s: f64, k: f64) {
    let cols = [0xffffff, 0xfff2b0, 0xffc83a];
    let (l, rot) = (s * (1.0 - k * 0.6), k * 0.4);
    for i in 0..8 {
        let odd = i % 2 == 1;
        let a = i as f64 * std::f64::consts::FRAC_PI_4 + rot;
        let len = if odd { 0.45 } else { 1.0 } * l;
        let (ux, uy) = (cos(a), sin(a));
        let mut d = 0.0;
        while d < len {
            let w = 0f64.max((1.0 - d / len) * if odd { 1.2 } else { 2.2 });
            let mut o = -w;
            while o <= w {
                c.fb.px(x + ux * d - uy * o, y + uy * d + ux * o, if o.abs() < w * 0.45 { cols[0] } else { cols[1] }, 1.0);
                o += 0.5;
            }
            d += 0.5;
        }
    }
    let cr = s * 0.3 * (1.0 - k);
    if cr <= 0.0 {
        return;
    }
    let mut yy = -cr;
    while yy <= cr {
        let mut xx = -cr;
        while xx <= cr {
            let q = hypot(&[xx, yy]) / cr;
            if q <= 1.0 {
                c.fb.px(x + xx, y + yy, if q < 0.6 { cols[0] } else { cols[2] }, 1.0);
            }
            xx += 1.0;
        }
        yy += 1.0;
    }
}

/// A ring `th` thick, squashed to `ry` (a ring lying across the planet), with a dithered wake behind it.
fn ring(c: &mut Ctx, x: f64, y: f64, r: f64, th: f64, col: u32, ry: f64, a: f64, wake: f64) {
    let n = (r * 7.0).ceil().max(0.0) as usize;
    for i in 0..n {
        let an = i as f64 / n as f64 * 6.283;
        let (ca, sa) = (cos(an), sin(an));
        let mut o = 0.0;
        while o < th {
            c.fb.px(x + ca * (r - o), y + sa * (r - o) * ry, col, a);
            o += 0.5;
        }
        let mut o = th;
        while o < th + wake {
            let (px, py) = (x + ca * (r - o), y + sa * (r - o) * ry);
            if bayer(js_round(px) as i32, js_round(py) as i32) < (1.0 - (o - th) / wake) * 0.7 {
                c.fb.px(px, py, col, a * 0.7);
            }
            o += 1.0;
        }
    }
}

/// A white veil over the frame (in the widget, only over what's drawn).
fn veil(c: &mut Ctx, a: f64, bare: bool) {
    if a <= 0.0 {
        return;
    }
    let w = c.fb.w;
    for k in 0..c.fb.buf.len() {
        if !bare || c.fb.buf[k] >> 24 != 0 {
            c.fb.px((k % w) as f64, (k / w) as f64, 0xffffff, a);
        }
    }
}

/// One crack: a dark line with a white edge and a pale blue one.
fn crack(c: &mut Ctx, x0: f64, y0: f64, x1: f64, y1: f64) {
    let n = hypot(&[x1 - x0, y1 - y0]).ceil();
    let d = if n == 0.0 { 1.0 } else { n };
    let (nx, ny) = (-(y1 - y0) / d, (x1 - x0) / d);
    let mut i = 0.0;
    while i <= n {
        let (x, y) = (x0 + (x1 - x0) * i / d, y0 + (y1 - y0) * i / d);
        c.fb.px(x, y, 0x1a1438, 1.0);
        c.fb.px(x + nx, y + ny, 0xffffff, 0.9);
        if bayer(js_round(x - nx) as i32, js_round(y - ny) as i32) < 0.5 {
            c.fb.px(x - nx, y - ny, 0x8aa0d8, 0.7);
        }
        i += 1.0;
    }
}

/// Whether (x, y) is inside the polygon `h`.
fn inside(h: &[(f64, f64)], x: f64, y: f64) -> bool {
    let mut on = false;
    let mut j = h.len() - 1;
    for i in 0..h.len() {
        if (h[i].1 > y) != (h[j].1 > y) && x < (h[j].0 - h[i].0) * (y - h[i].1) / (h[j].1 - h[i].1) + h[i].0 {
            on = !on;
        }
        j = i;
    }
    on
}

/// The newest wave of at least `tier` that has landed, with its age.
fn landed(g: &Game, t: f64, tier: u8) -> Option<(Wave, f64)> {
    g.inp.waves.iter().rev().find(|w| w.tier >= tier && t >= w.t0).map(|w| (*w, t - w.t0))
}

/// How far the cloud sea is parted, and round which x: it opens in 0.3s, holds, then closes over 2s.
pub(crate) fn part(g: &Game, t: f64) -> Option<(f64, f64)> {
    let (w, age) = landed(g, t, 3)?;
    let open = 1f64.min(age / 0.3);
    let k = open * open * (3.0 - 2.0 * open) * 0f64.max(1.0 - 0f64.max(age - 2.5) / 2.0);
    (k > 0.0).then_some((w.x, k))
}

/// Moves a cloud of the sea at (x, y) aside for a parting `p` (`part`'s): out from the hit and down into the sea.
pub(crate) fn parted(p: Option<(f64, f64)>, w: f64, h: f64, x: f64, y: f64, front: bool) -> (f64, f64) {
    let Some((at, k)) = p else { return (x, y) };
    let d = x - at;
    let side = if d > 0.0 {
        1.0
    } else if d < 0.0 {
        -1.0
    } else {
        0.0
    };
    let near = 0f64.max(1.0 - d.abs() / (w * 0.4));
    (x + side * k * w * 0.1 * 0f64.max(1.0 - d.abs() / (w * 0.6)), y + k * h * if front { 0.1 } else { 0.13 } * near * near)
}

impl Scene {
    /// Behind the planet, over the sky: the glass of a tier 4 hit, cracking out and healing in.
    pub(crate) fn waves_back(&mut self, c: &mut Ctx, g: &Game, view: &View) {
        let t = c.t;
        if view.bare {
            self.glass = None;
            return;
        }
        if let Some((w, _)) = landed(g, t, 4) {
            if self.glass.is_none() && self.glass_last != Some(w.t0) {
                self.glass_last = Some(w.t0);
                self.glass = Some(Glass::new(c, w.x, w.y, w.t0));
            }
        }
        let Some(gl) = self.glass.as_ref() else { return };
        let age = t - gl.t0;
        let heal = 0f64.max((age - 1.6) / 3.2);
        if heal >= 1.0 || age < 0.0 {
            self.glass = None;
            return;
        }
        if age < 0.12 {
            return;
        }
        let vis = hypot(&[c.w, c.h]) * (1.0 - heal) * 1f64.min((age - 0.12) / 0.12);
        // the void through the hole in the middle
        if heal < 0.6 {
            let h = &gl.rings[0];
            let a = if heal > 0.3 { 1.0 - (heal - 0.3) / 0.3 } else { 1.0 };
            let (x0, x1) = h.iter().fold((f64::INFINITY, f64::NEG_INFINITY), |m, p| (m.0.min(p.0), m.1.max(p.0)));
            let (y0, y1) = h.iter().fold((f64::INFINITY, f64::NEG_INFINITY), |m, p| (m.0.min(p.1), m.1.max(p.1)));
            let mut y = y0.floor();
            while y <= y1 {
                let mut x = x0.floor();
                while x <= x1 {
                    if inside(h, x, y) {
                        let col = if h2(x * 7.0, y * 13.0) > 0.97 {
                            0xffffff
                        } else if bayer(x as i32, y as i32) < 0.3 {
                            0x1a1438
                        } else {
                            0x0c0a1c
                        };
                        c.fb.px(x, y, col, a);
                    }
                    x += 1.0;
                }
                y += 1.0;
            }
        }
        for ray in &gl.rays {
            for j in 1..ray.len() {
                let (p, q) = (ray[j - 1], ray[j]);
                if q.2 > vis {
                    let f = 0f64.max((vis - p.2) / (q.2 - p.2));
                    crack(c, p.0, p.1, p.0 + (q.0 - p.0) * f, p.1 + (q.1 - p.1) * f);
                    break;
                }
                crack(c, p.0, p.1, q.0, q.1);
            }
        }
        let s = 1f64.max(c.r / 60.0);
        for (j, rg) in gl.rings.iter().enumerate() {
            if RINGS[j] * s > vis {
                continue;
            }
            for i in 0..rg.len() {
                if j > 0 && hash(i as f64 * 13.0 + j as f64 * 7.0) < 0.25 {
                    continue;
                }
                let (p, q) = (rg[i], rg[(i + 1) % rg.len()]);
                crack(c, p.0, p.1, q.0, q.1);
            }
        }
    }

    /// Over everything, before the flash: the stars and rings of each wave, and its flash (none under reduced motion).
    pub(crate) fn waves_front(&mut self, c: &mut Ctx, g: &Game, view: &View) {
        let t = c.t;
        let s = 1f64.max(c.r / 60.0);
        let mut flash = 0f64;
        for w in &g.inp.waves {
            let age = t - w.t0;
            if age < 0.0 {
                continue;
            }
            let tier = w.tier;
            flash = flash.max([0.0, 0.2, 0.4, 0.6, 0.0][tier as usize] * 0f64.max(1.0 - age / 0.3));
            let k = age / ring_life(tier);
            if k > 1.0 {
                continue;
            }
            if tier == 1 {
                star(c, w.x, w.y, 30.0 * s, k);
                ring(c, w.x, w.y, (8.0 + k * 22.0) * s, 2.0, 0xffffff, 1.0, 1.0 - k, 0.0);
                ring(c, w.x, w.y, (8.0 + k * 22.0) * s + 2.0, 1.0, 0x8fd8ff, 1.0, 1.0 - k, 0.0);
                continue;
            }
            let big = [0.0, 0.0, 2.4, 3.2, 4.0][tier as usize] * c.r;
            let e = 1.0 - pow(1.0 - k, 2.2);
            star(c, w.x, w.y, (26.0 + tier as f64 * 6.0) * s, 1f64.min(k * 1.6));
            if tier >= 3 {
                ring(c, w.x, w.y, 10.0 * s + big * e * 0.55, 2.5, 0xff9a1a, 1.0, 1.0 - k * 0.5, 8.0);
            }
            ring(c, w.x, w.y, 6.0 * s + big * e, 3.0, if tier >= 3 { 0xffb020 } else { 0x4aa8ff }, 0.32, 1.0 - k * 0.4, 12.0);
            ring(c, w.x, w.y, 6.0 * s + big * e - 3.0, 1.5, 0xffffff, 0.32, 1.0 - k * 0.4, 0.0);
            if tier >= 3 {
                ring(c, w.x, w.y, 4.0 * s + big * e * 1.35, 1.5, 0xffffff, 1.0, (1.0 - k) * 0.8, 4.0);
            }
        }
        // the white-out: whole for 0.1s, then fading for 0.4s, under the glass it brings
        if let Some(gl) = self.glass.as_ref() {
            let a = t - gl.t0;
            flash = flash.max(if a < 0.1 {
                1.0
            } else if a < 0.5 {
                1.0 - (a - 0.1) / 0.4
            } else {
                0.0
            });
        }
        if view.bare {
            if let Some((_, a)) = landed(g, t, 4).filter(|(_, a)| *a < 0.5) {
                flash = flash.max(if a < 0.1 { 1.0 } else { 1.0 - (a - 0.1) / 0.4 });
            }
        }
        if !g.calm {
            veil(c, flash, view.bare);
        }
    }
}
