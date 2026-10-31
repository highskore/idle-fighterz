//! The hero's beam: the ball charging in his hands with its aim line and, at full charge, its crackle; then the
//! fired beam (galick gun, kamehameha, final flash; red under kaioken, wider as the great ape) with its crackle.

// game.js turns by 6.28, not TAU: the angles must round the same
#![allow(clippy::approx_constant)]

use planet_core::data::{Hero, Upg};
use planet_core::fx::Particle;
use planet_core::jsmath::{cos, hypot, pow, sin};
use planet_core::num::js_round;
use planet_core::Game;

use crate::bayer;
use crate::scene::Ctx;

/// game.js `BEAMS`/`KAIO_BEAM`; the kaioken palette has no aim line or ball edge.
struct Pal {
    aim: u32,
    ball: u32,
    ball_edge: u32,
    spark: u32,
    glow: u32,
    mid: u32,
    edge: u32,
}

const GALICK: Pal = Pal { aim: 0x9a5af0, ball: 0xd9b8ff, ball_edge: 0x8a4ae8, spark: 0xc9a2ff, glow: 0xb98af8, mid: 0xe2cbff, edge: 0x7a3ae0 };
const KAME: Pal = Pal { aim: 0x4aa8f0, ball: 0xb8e4ff, ball_edge: 0x2a8ae8, spark: 0xa2d8ff, glow: 0x7ac8ff, mid: 0xcdeeff, edge: 0x1f6ad8 };
/// Piccolo's special beam cannon: a bright yellow core in a violet sheath.
const SBC: Pal = Pal { aim: 0xffd84a, ball: 0xfff2a0, ball_edge: 0x8a4ae8, spark: 0xffe86a, glow: 0xd8b0ff, mid: 0xfff6c0, edge: 0x7a3ae0 };
const KAIO: Pal = Pal { aim: 0, ball: 0xffb0a4, ball_edge: 0, spark: 0xff9a8a, glow: 0xff6a5a, mid: 0xffc8bf, edge: 0xc8201a };

fn kame(g: &Game) -> bool {
    matches!(g.s.hero, Hero::Goku | Hero::Gohan | Hero::Krillin)
}

/// `BEAM()`
fn pal(g: &Game) -> &'static Pal {
    if kame(g) {
        &KAME
    } else if g.s.hero == Hero::Piccolo {
        &SBC
    } else {
        &GALICK
    }
}

fn bay(x: f64, y: f64) -> f64 {
    bayer(js_round(x) as i64 as i32, js_round(y) as i64 as i32)
}

/// `crackle`: a jagged bolt in six legs, a `core` line with a `c` fringe a pixel to its right. A zero-length leg
/// plots at NaN, which `st.px` drops.
#[allow(clippy::too_many_arguments)]
fn crackle(g: &mut Game, x0: f64, y0: f64, x1: f64, y1: f64, c: u32, core: u32, put: &mut dyn FnMut(f64, f64, u32, f64)) {
    let (mut px0, mut py0) = (x0, y0);
    let n = 6.0;
    let l = hypot(&[x1 - x0, y1 - y0]);
    let l = if l == 0.0 || l.is_nan() { 1.0 } else { l };
    let (nx, ny) = (-(y1 - y0) / l, (x1 - x0) / l);
    for i in 1..=6 {
        let i = i as f64;
        let j = if i == n { 0.0 } else { (g.rng.random() - 0.5) * l * 0.35 };
        let qx = x0 + (x1 - x0) * i / n + nx * j;
        let qy = y0 + (y1 - y0) * i / n + ny * j;
        let m = hypot(&[qx - px0, qy - py0]);
        let mut d = 0.0;
        while d <= m {
            let (xx, yy) = (px0 + (qx - px0) * d / m, py0 + (qy - py0) * d / m);
            if !xx.is_nan() && !yy.is_nan() {
                put(xx, yy, core, 1.0);
                put(xx + 1.0, yy, c, 0.7);
            }
            d += 0.5;
        }
        px0 = qx;
        py0 = qy;
    }
}

/// game.js's `if (charging > 0 && seen)`: the dotted aim line, the ball in his hands, its sparks and, full, its crackle.
pub fn draw_charge(c: &mut Ctx, g: &mut Game) {
    let ch = g.inp.charging;
    if ch <= 0.0 || !g.hero_seen {
        return;
    }
    let t = c.t;
    let p = pal(g);
    let (hx, hy) = g.hand_pos();
    let r = 2.0 + ch * 2.2;
    if let Some(d) = g.inp.drag {
        let (mut ax, mut ay) = (d.ax - hx, d.ay - hy);
        let al = hypot(&[ax, ay]);
        let al = if al == 0.0 || al.is_nan() { 1.0 } else { al };
        ax /= al;
        ay /= al;
        let mut d = r + 4.0;
        while d < al.min(400.0) {
            if ((d / 4.0) as i64 as i32).wrapping_add((t * 12.0) as i64 as i32) % 2 != 0 {
                c.fb.px(hx + ax * d, hy + ay * d, crate::mech::aim_col(g, ch).unwrap_or(p.aim), 1.0);
            }
            d += 4.0;
        }
    }
    let mut y = -r;
    while y <= r {
        let mut x = -r;
        while x <= r {
            let d = hypot(&[x, y]) / r;
            if d <= 1.0 && !(d > 0.7 && bay(hx + x, hy + y) > 0.5) {
                c.fb.px(
                    hx + x,
                    hy + y,
                    if d < 0.4 {
                        0xffffff
                    } else if d < 0.75 {
                        p.ball
                    } else {
                        p.ball_edge
                    },
                    1.0,
                );
            }
            x += 1.0;
        }
        y += 1.0;
    }
    if g.rng.random() < 0.9 {
        let a = g.rng.random() * 6.28;
        let rr = r + 6.0 + g.rng.random() * 8.0;
        g.fx.push(Particle::new(hx + cos(a) * rr, hy + sin(a) * rr, &[0xffffff, p.spark]).v(-cos(a) * rr * 3.0, -sin(a) * rr * 3.0).life(0.3));
    }
    if ch >= 2.4 {
        // `chargeCrackle`, with its faint tremble
        g.shake = g.shake.max(0.06);
        let kd = g.kid_screen(0.0);
        let (ux, uy) = (sin(kd.ang), -cos(kd.ang));
        let fb = &mut *c.fb;
        let mut put = |x: f64, y: f64, col: u32, a: f64| fb.px(x, y, col, a);
        for _ in 0..3 {
            let a = g.rng.random() * 6.28;
            let l = r + 8.0 + g.rng.random() * 14.0;
            crackle(g, hx + cos(a) * r, hy + sin(a) * r, hx + cos(a) * l, hy + sin(a) * l, p.spark, 0xffffff, &mut put);
        }
        if g.rng.random() < 0.6 {
            let h = 4.0 + g.rng.random() * 22.0;
            let s = (g.rng.random() - 0.5) * 12.0;
            let lift = g.lift_now;
            crackle(g, hx, hy, kd.x + ux * (lift + h) + cos(kd.ang) * s, kd.y + uy * (lift + h) + sin(kd.ang) * s, p.spark, 0xffffff, &mut put);
        }
    }
}

/// game.js's `if (beam)`: the fired beam (over the planet's face), the ball still lit in his hands (at his depth), a
/// flash on each thing it hit, a full charge's crackle and its sparks. It lets the beam go once it has faded, as
/// game.js does while drawing.
pub fn draw_beam(c: &mut Ctx, g: &mut Game) {
    let Some(b) = g.inp.beam else { return };
    let t = c.t;
    let age = t - b.t0;
    let life = 0.7 + b.c * 0.25;
    if age > life {
        g.inp.beam = None;
        return;
    }
    let bp = if b.kaio { &KAIO } else { pal(g) };
    let ff = b.ff && !kame(g) && !b.kaio;
    let w = (3.0 + b.c * 3.0)
        * if b.ff { 1.8 } else { 1.0 }
        * if b.ape { 1.5 } else { 1.0 }
        * (1.0 + 0.15 * (g.s.lvf(Upg::Galick) - 1.0))
        * (1.0 - pow(age / life, 3.0));
    let reach = 1f64.min(age / 0.12) * c.w.max(c.h) * 1.6;
    let (sw, sh) = (c.w, c.h);
    let fb = &mut *c.fb;
    // only the ball in his hands hides behind what's nearer than him; the beam itself is drawn over the planet's face,
    // so it visibly runs through everything it hits there
    let deep = std::cell::Cell::new(false);
    let mut px = |x: f64, y: f64, col: u32, a: f64| {
        let (xi, yi) = (js_round(x), js_round(y));
        if xi.is_nan() || yi.is_nan() {
            return;
        }
        let k = yi * sw + xi;
        if deep.get() && xi >= 0.0 && yi >= 0.0 && xi < sw && k < fb.zb.len() as f64 && fb.zb[k as usize] as f64 > b.z + 6.0 {
            return;
        }
        fb.px(x, y, col, a);
    };
    let mut d = 2.0;
    while d < reach {
        let (x0, y0) = (b.x + b.dx * d, b.y + b.dy * d);
        if x0 < -30.0 || y0 < -30.0 || x0 > sw + 30.0 || y0 > sh + 30.0 {
            break;
        }
        let ww = w * 1f64.min(0.35 + d / 18.0) * (1.0 + sin(d * 0.35 - t * 40.0) * 0.12);
        let gw = ww + 2.5;
        let mut o = -gw;
        while o <= gw {
            let a = o.abs() / if ww == 0.0 || ww.is_nan() { 1.0 } else { ww };
            let (xx, yy) = (x0 - b.dy * o, y0 + b.dx * o);
            if a > 1.0 {
                if bay(xx, yy) < 0.5 {
                    px(xx, yy, if ff { 0xffe066 } else { bp.glow }, 0.6);
                }
            } else {
                px(
                    xx,
                    yy,
                    if a < 0.4 {
                        0xffffff
                    } else if a < 0.75 {
                        if ff {
                            0xfff3a0
                        } else {
                            bp.mid
                        }
                    } else if ff {
                        0xffc21a
                    } else {
                        bp.edge
                    },
                    1.0,
                );
            }
            o += 0.6;
        }
        d += 0.6;
    }
    // the charged ball stays lit in his hands while the beam pours out
    let bw = w * 1.4;
    deep.set(true);
    let mut y = -bw;
    while y <= bw {
        let mut x = -bw;
        while x <= bw {
            let q = hypot(&[x, y]) / bw;
            if q <= 1.0 {
                px(
                    b.x + x,
                    b.y + y,
                    if q < 0.55 {
                        0xffffff
                    } else if ff {
                        0xfff3a0
                    } else {
                        bp.ball
                    },
                    1.0,
                );
            }
            x += 1.0;
        }
        y += 1.0;
    }
    deep.set(false);
    // a dark-ringed burst on everything it hit, so a beam through a crowd reads as hitting each one
    let k = age / 0.35;
    if k < 1.0 {
        let ring = if ff { 0xc8601a } else { bp.edge };
        let rr = 4.0 + 8.0 * k;
        for &(hx, hy) in &g.inp.beam_hits {
            let mut a = 0.0;
            while a < 6.28 {
                let (x, y) = (hx + cos(a) * rr, hy + sin(a) * rr);
                px(x, y, ring, 1.0);
                if k < 0.5 {
                    px(hx + cos(a) * (rr - 1.0), hy + sin(a) * (rr - 1.0), ring, 1.0);
                }
                a += 0.8 / rr;
            }
            if k < 0.5 {
                let l = 3.0 + 4.0 * (1.0 - k);
                let mut d = -l;
                while d <= l {
                    px(hx + d, hy, ring, 1.0);
                    px(hx, hy + d, ring, 1.0);
                    d += 1.0;
                }
                px(hx, hy, 0xffffff, 1.0);
            }
        }
    }
    if b.full {
        // `beamCrackle`: dark-cored bolts, so they read against the pale glow
        let (nx, ny) = (-b.dy, b.dx);
        let at = |d: f64, o: f64| (b.x + b.dx * d + nx * o, b.y + b.dy * d + ny * o);
        for _ in 0..6 {
            let d = 10.0 + g.rng.random() * reach.min(260.0);
            let sd = if g.rng.random() < 0.5 { -1.0 } else { 1.0 };
            let (x0, y0) = at(d, sd * (w + 1.0));
            let d1 = d + 8.0 + g.rng.random() * 12.0;
            let (x1, y1) = at(d1, sd * (w + 5.0 + g.rng.random() * 8.0));
            crackle(g, x0, y0, x1, y1, 0xffffff, bp.edge, &mut px);
        }
    }
    if b.z > 0.0 && g.rng.random() < 0.8 {
        let x = b.x + b.dx * g.rng.random() * 80.0;
        let y = b.y + b.dy * g.rng.random() * 80.0;
        let vx = (g.rng.random() - 0.5) * 60.0;
        let vy = (g.rng.random() - 0.5) * 60.0;
        g.fx.push(Particle::new(x, y, &[0xffffff, bp.spark, bp.edge]).v(vx, vy).life(0.4));
    }
}
