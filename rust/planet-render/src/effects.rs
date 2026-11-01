//! The ki effects drawn between the visitors and the boss: the spirit bomb gathering over the hero and its throw, the
//! beam struggle, and the capsule a beaten boss drops (its fall and its opening run here, as in game.js).

use planet_core::data::Hero;
use planet_core::fx::Particle;
use planet_core::jsmath::{cos, hypot, sin};
use planet_core::num::js_round;
use planet_core::Game;

use crate::bayer;
use crate::scene::Ctx;

/// `ball(x, y, r)`: a pale blue ki ball with a dithered halo.
fn ball(c: &mut Ctx, x: f64, y: f64, r: f64) {
    let mut yy = -r - 2.0;
    while yy <= r + 2.0 {
        let mut xx = -r - 2.0;
        while xx <= r + 2.0 {
            let d = hypot(&[xx, yy]);
            if d <= r {
                c.fb.px(
                    x + xx,
                    y + yy,
                    if d < r * 0.45 {
                        0xffffff
                    } else if d < r * 0.8 {
                        0xd8f0ff
                    } else {
                        0x8fd8ff
                    },
                    1.0,
                );
            } else if d <= r + 2.0 && bayer(js_round(x + xx) as i64 as i32, js_round(y + yy) as i64 as i32) < 0.5 {
                c.fb.px(x + xx, y + yy, 0x8fd8ff, 0.6);
            }
            xx += 1.0;
        }
        yy += 1.0;
    }
}

/// `BEAM()`: goku and gohan fire a blue kamehameha, vegeta and trunks a purple galick gun (mid, edge).
fn beam_pal(g: &Game) -> (u32, u32) {
    if matches!(g.s.hero, Hero::Goku | Hero::Gohan | Hero::Krillin | Hero::Goten) {
        (0xcdeeff, 0x1f6ad8)
    } else if g.s.hero == Hero::Tien {
        (0xfff8d8, 0xd88a18)
    } else if g.s.hero == Hero::Piccolo {
        (0xfff6c0, 0x7a3ae0)
    } else {
        (0xe2cbff, 0x7a3ae0)
    }
}

pub fn draw(c: &mut Ctx, g: &mut Game) {
    let t = c.t;
    // the big bang in flight: an arcing blue ki ball with a trail (it lands in planet-core's draw_step)
    if let Some(b) = g.inp.bang {
        let k = 1f64.min((t - b.t0) / b.dur);
        let x = b.x0 + (b.x1 - b.x0) * k;
        let y = b.y0 + (b.y1 - b.y0) * k - sin(k * std::f64::consts::PI) * 14.0;
        let r = 3.0 + k * 2.0;
        let mut yy = -r - 2.0;
        while yy <= r + 2.0 {
            let mut xx = -r - 2.0;
            while xx <= r + 2.0 {
                let d = hypot(&[xx, yy]);
                if d <= r {
                    c.fb.px(x + xx, y + yy, if d < r * 0.5 { 0xffffff } else { 0x8fd8ff }, 1.0);
                } else if d <= r + 2.0 && bayer(js_round(x + xx) as i64 as i32, js_round(y + yy) as i64 as i32) < 0.5 {
                    c.fb.px(x + xx, y + yy, 0x4a9aff, 0.7);
                }
                xx += 1.0;
            }
            yy += 1.0;
        }
        g.fx.push(Particle::new(x, y, &[0xffffff, 0x8fd8ff, 0x2f6ae0]).life(0.25).size(2.0, 0.0));
    }
    // the spirit bomb: a pale blue ball over his head, motes of energy streaming in from the planet
    if g.s.spirit > 0 && g.tl.spirit_shot.is_none() && g.tl.spirit > 0.04 && g.playing {
        let (bx, by, br) = g.spirit_pos();
        let r = br * if g.tl.spirit_ready { 1.0 + sin(t * 8.0) * 0.08 } else { 1.0 };
        ball(c, bx, by, r);
        if !g.tl.spirit_ready && g.rng.random() < 0.6 {
            let a = g.rng.random() * 6.28;
            let (sx, sy) = (c.cx + cos(a) * c.r * 1.05, c.cy + c.bob + sin(a) * c.r * 1.05);
            g.fx.push(Particle::new(sx, sy, &[0xffffff, 0xd8f0ff, 0x8fd8ff]).v((bx - sx) * 1.6, (by - sy) * 1.6).life(0.55));
        }
    }
    if let Some(s) = g.tl.spirit_shot.clone() {
        let k = 1f64.min((t - s.t0) / 0.7);
        let e = k * k;
        ball(c, s.x0 + (s.x1 - s.x0) * e, s.y0 + (s.y1 - s.y0) * e, s.r);
    }
    // the beam struggle: his beam against the villain's, meeting at the clash point
    if let (Some(st), Some(b)) = (g.tl.struggle.clone(), g.tl.boss.clone()) {
        let (hx, hy) = g.hand_pos();
        let spr_h = b.spr().h;
        let (bx, by) = (b.x, b.y - spr_h / 2.0 * b.k);
        let p = 0.04f64.max(0.96f64.min(st.p));
        let (qx, qy) = (hx + (bx - hx) * p, hy + (by - hy) * p);
        let ray = |c: &mut Ctx, x0: f64, y0: f64, x1: f64, y1: f64, w: f64, core: u32, edge: u32| {
            let l = hypot(&[x1 - x0, y1 - y0]);
            let l = if l == 0.0 { 1.0 } else { l };
            let (dx, dy) = ((x1 - x0) / l, (y1 - y0) / l);
            let mut d = 0.0;
            while d < l {
                let ww = w * (1.0 + sin(d * 0.4 - t * 40.0) * 0.12);
                let mut o = -ww;
                while o <= ww {
                    c.fb.px(
                        x0 + dx * d - dy * o,
                        y0 + dy * d + dx * o,
                        if o.abs() < ww * 0.45 {
                            0xffffff
                        } else if o.abs() < ww * 0.8 {
                            core
                        } else {
                            edge
                        },
                        1.0,
                    );
                    o += 0.6;
                }
                d += 0.6;
            }
        };
        let w = 3.0 + c.r / 40.0;
        let (mid, edge) = beam_pal(g);
        ray(c, hx, hy, qx, qy, w, mid, edge);
        ray(c, bx, by, qx, qy, w, 0xffd8a0, 0xe0603a);
        ball(c, qx, qy, w * 2.2 + sin(t * 30.0) * 1.2);
        if g.rng.random() < 0.9 {
            let vx = (g.rng.random() - 0.5) * 160.0;
            let vy = (g.rng.random() - 0.5) * 160.0;
            g.fx.push(Particle::new(qx, qy, &[0xffffff, 0xfff3a0, 0xffb35a]).v(vx, vy).life(0.3));
        }
    }
    // the big bang's blasts, newest first (planet-core's draw_step lets the spent ones go)
    for b in g.inp.blasts.iter().rev() {
        let k = (t - b.t0) / 0.45;
        let rr = b.r * (0.3 + 0.7 * k.sqrt());
        let mut yy = -rr;
        while yy <= rr {
            let mut xx = -rr;
            while xx <= rr {
                let d = hypot(&[xx, yy]);
                if d <= rr {
                    let edge = d > rr - 2.0;
                    if edge || bayer(js_round(b.x + xx) as i64 as i32, js_round(b.y + yy) as i64 as i32) <= (1.0 - k) * 0.8 {
                        let col = if edge {
                            if k < 0.5 {
                                0xffffff
                            } else if b.kaio {
                                0xff6a5a
                            } else {
                                0x8fd8ff
                            }
                        } else if d < rr * 0.4 {
                            0xffffff
                        } else if b.kaio {
                            0xffb0a4
                        } else {
                            0xbfe9ff
                        };
                        c.fb.px(b.x + xx, b.y + yy, col, 1.0);
                    }
                }
                xx += 1.0;
            }
            yy += 1.0;
        }
    }
    // the capsule a beaten boss drops (planet-core's draw_step moves it and opens it)
    if let Some(cp) = g.tl.capsule.clone() {
        {
            let (x, y) = (js_round(cp.x), js_round(cp.y));
            for yy in -3..=3 {
                for xx in -6..=6 {
                    let (xf, yf) = (xx as f64, yy as f64);
                    let q = hypot(&[0f64.max(xf.abs() - 3.0), yf]);
                    if q > 3.0 {
                        continue;
                    }
                    let edge = q > 2.2;
                    c.fb.px(
                        x + xf,
                        y + yf,
                        if edge {
                            0x2a2a30
                        } else if xx == 0 {
                            0x9a9ca4
                        } else if xx < 0 {
                            0xffffff
                        } else {
                            0xd9dbe0
                        },
                        1.0,
                    );
                }
            }
            c.fb.px(x + 3.0, y - 4.0, 0xe0332b, 1.0);
            c.fb.px(x + 4.0, y - 4.0, 0xe0332b, 1.0);
            if ((t * 4.0) as i64) % 2 != 0 {
                c.fb.px(x - 2.0, y - 1.0, 0xffffff, 1.0);
            }
        }
    }
}
