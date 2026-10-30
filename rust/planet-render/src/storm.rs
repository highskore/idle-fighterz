//! Shenron's storm on the canvas (planet-core's `dusk`): the cloud sea turns to dark storm clouds, everything but the
//! dragon dims toward violet, lightning strikes from the top, a cream pillar of light rises from a ring of the seven
//! balls over the planet. Drawn after the front clouds; nothing here paints over the dragon. Its own random numbers.

use planet_core::dusk::{Dusk, STRIKES};
use planet_core::jsmath::{cos, hypot, sin};
use planet_core::num::js_round;

use crate::{bayer, Framebuffer};

/// The storm clouds the sea turns to, and how far.
const SEA: [u32; 4] = [0x2e2c4e, 0x45426a, 0x65608a, 0x9690b6];
const SEA_K: f64 = 0.9;
/// The pillar, from its core out.
const PILLAR_C: [u32; 4] = [0xfff8e8, 0xffe8b0, 0xf0c070, 0xb88a6a];
const BOLT: [u32; 2] = [0xffffff, 0xa8a0ff];

/// The cloud sea's palette under the storm, or `None` while the storm hasn't touched it.
pub fn sea(day: &[u32], d: &Dusk) -> Option<Vec<u32>> {
    let k = d.k() * SEA_K;
    (k > 0.0).then(|| day.iter().zip(SEA).map(|(&c, n)| planet_core::dusk::mix(c, n, k)).collect())
}

/// A pixel anywhere but on the dragon.
fn px(fb: &mut Framebuffer, x: f64, y: f64, hex: u32) {
    let (xi, yi) = (js_round(x), js_round(y));
    if xi >= 0.0 && yi >= 0.0 && xi < fb.w as f64 && yi < fb.h as f64 && fb.dm[yi as usize * fb.w + xi as usize] != 0 {
        return;
    }
    fb.px(x, y, hex, 1.0);
}

/// Everything drawn but the dragon, multiplied toward (mr, mg, mb) by `f`; the sky stays clear for the page's.
fn tint(fb: &mut Framebuffer, f: f64, mr: f64, mg: f64, mb: f64) {
    if f <= 0.0 {
        return;
    }
    let (kr, kg, kb) = (1.0 - f + f * mr, 1.0 - f + f * mg, 1.0 - f + f * mb);
    for (p, &m) in fb.buf.iter_mut().zip(&fb.dm) {
        if *p >> 24 == 0 || m != 0 {
            continue;
        }
        let (r, g, b) = ((*p & 255) as f64 * kr, ((*p >> 8) & 255) as f64 * kg, ((*p >> 16) & 255) as f64 * kb);
        *p = (255 << 24) | ((b as u32) << 16) | ((g as u32) << 8) | r as u32;
    }
}

/// The bolts' own LCG, so the game's random numbers stay where they are.
fn rnd(s: &mut u32) -> f64 {
    *s = s.wrapping_mul(1664525).wrapping_add(1013904223);
    *s as f64 / 4294967296.0
}

/// One jagged run of a bolt and its forks, down to 62% of the card.
fn seg(fb: &mut Framebuffer, seed: &mut u32, mut x: f64, mut y: f64, n: u32, w: i32, h: f64) {
    for _ in 0..n {
        let nx = x + (rnd(seed) - 0.5) * 14.0;
        let ny = y + 4.0 + rnd(seed) * 7.0;
        let mut q = 0.0;
        while q <= 1.0 {
            let (bx, by) = (x + (nx - x) * q, y + (ny - y) * q);
            for o in -w - 1..=w + 1 {
                px(fb, bx + o as f64, by, if o.abs() <= w { BOLT[0] } else { BOLT[1] });
            }
            q += 0.08;
        }
        if w > 0 && rnd(seed) < 0.22 {
            let n2 = 3 + (rnd(seed) * 4.0) as u32;
            seg(fb, seed, nx, ny, n2, 0, h);
        }
        x = nx;
        y = ny;
        if y > h * 0.62 {
            break;
        }
    }
}

/// The pillar of light from the balls up out of the card: `h` tall from `yb`, `w` wide, at strength `a`.
fn pillar(fb: &mut Framebuffer, t: f64, x0: f64, yb: f64, h: f64, w: f64, a: f64) {
    if a <= 0.0 || h <= 0.0 {
        return;
    }
    let mut y = js_round(yb - h);
    while y <= yb {
        let band = ((y + t * 140.0) as i64) % 12 < 4;
        let ww = w * (1.0 + 0.25 * sin(y * 0.3 + t * 20.0));
        let mut dx = -(ww * 2.2).ceil();
        while dx <= ww * 2.2 {
            let (ad, xx) = (dx.abs(), js_round(x0 + dx));
            let c = if ad <= ww * 0.3 {
                PILLAR_C[0]
            } else if ad <= ww * 0.65 {
                if band {
                    PILLAR_C[0]
                } else {
                    PILLAR_C[1]
                }
            } else if ad <= ww {
                PILLAR_C[2]
            } else if bayer(xx as i32, y as i32) < (1.0 - (ad - ww) / (ww * 1.2)) * 0.7 {
                PILLAR_C[3]
            } else {
                0
            };
            if c != 0 && bayer(xx as i32 + 3, y as i32 + 1) < a {
                px(fb, xx, y, c);
            }
            dx += 1.0;
        }
        y += 1.0;
    }
}

/// The seven balls in a slow ring above the planet, each with a pulsing dithered glow.
#[allow(clippy::too_many_arguments)]
fn ball_ring(fb: &mut Framebuffer, t: f64, r: f64, x0: f64, y0: f64, rr: f64, glow: f64, calm: bool) {
    let br = 2.5f64.max(r * 0.055);
    let spin = if calm { 0.0 } else { t * 0.5 };
    let mut balls: Vec<(f64, f64, f64, f64)> = (0..7)
        .map(|i| {
            let a = i as f64 / 7.0 * 6.283 + spin;
            (i as f64, x0 + cos(a) * rr, y0 + sin(a) * rr * 0.32, sin(a))
        })
        .collect();
    balls.sort_by(|a, b| a.3.partial_cmp(&b.3).unwrap());
    for (i, bx, by, _) in balls {
        let pulse = if calm { 0.5 } else { 0.5 + 0.5 * sin(t * 5.0 + i * 0.9) };
        let gr = br * (2.6 + pulse * 1.6);
        let mut yy = -gr;
        while yy <= gr {
            let mut xx = -gr;
            while xx <= gr {
                let d = hypot(&[xx, yy]);
                let (x, y) = (js_round(bx + xx), js_round(by + yy));
                if d > br && d < gr && bayer(x as i32, y as i32) < (1.0 - (d - br) / (gr - br)) * glow {
                    px(fb, x, y, if d < br * 1.6 { 0xffe066 } else { 0xff9a2e });
                }
                xx += 1.0;
            }
            yy += 1.0;
        }
        let mut yy = -br - 1.0;
        while yy <= br + 1.0 {
            let mut xx = -br - 1.0;
            while xx <= br + 1.0 {
                let d = hypot(&[xx, yy]);
                if d <= br + 0.5 {
                    let l = -(xx + yy) / br;
                    let c = if d > br - 0.5 {
                        0x7a2a08
                    } else if l > 0.9 {
                        0xfff6d0
                    } else if l > 0.1 {
                        0xffb43a
                    } else {
                        0xe8741e
                    };
                    px(fb, bx + xx, by + yy, c);
                }
                xx += 1.0;
            }
            yy += 1.0;
        }
        px(fb, bx, by, 0xd8241e);
        if br > 3.0 {
            px(fb, bx + 1.0, by, 0xd8241e);
            px(fb, bx, by + 1.0, 0xd8241e);
        }
    }
}

/// The storm over everything drawn so far, the planet at (`cx`, `cy`) with radius `r`; the dragon's pixels are `fb.dm`.
pub fn draw(fb: &mut Framebuffer, d: &Dusk, t: f64, cx: f64, cy: f64, r: f64) {
    let (k, dk) = (d.k(), d.dark());
    tint(fb, 0.18 * k + dk * 0.6, 0.8 - dk * 0.5, 0.8 - dk * 0.5, 0.95 - dk * 0.3);
    let h = fb.h as f64;
    for (i, _) in STRIKES.iter().enumerate() {
        if d.strike(i) {
            let mut seed = i as u32 * 977 + 13;
            let x = fb.w as f64 * (0.08 + rnd(&mut seed) * 0.84);
            seg(fb, &mut seed, x, -2.0, 40, (i % 2) as i32, h);
        }
    }
    let yb = cy - r - 7.0;
    if !d.calm {
        // solid at full strength, like the bolts; dithered only while it rises and fades
        pillar(fb, t, cx, yb, (cy + 10.0) * d.rise(), 5f64.max(r * 0.2), d.pillar());
    }
    ball_ring(fb, t, r, cx, yb, r * 0.5, d.out, d.calm);
}
