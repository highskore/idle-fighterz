//! Snake way (game.js `drawSnake` and its helpers): the snake's back in perspective from behind him, the cloud rows
//! scrolling past, the orbs, spines and lost souls on the road, king kai's planet growing at the end, and the arrival.
//! Drawn in place of the planet while `S.world === 3`.
#![allow(clippy::approx_constant)] // game.js's own 6.28 and 6.283

use planet_core::data::ALL_FORMS;
use planet_core::jsmath::{atan2, cos, hypot, pow, sin};
use planet_core::num::{js_round, to_fixed};
use planet_core::sprite::{self, Sprite};
use planet_core::Game;

use crate::scene::{hash, text, text_width, Ctx, Scene, View};
use crate::top::vnoise;
use crate::{bayer, h2, to_int32, Framebuffer};

const END: f64 = 400.0;
const BEAT: f64 = 3.6;
const PI: f64 = std::f64::consts::PI;

const EDGE: u32 = 0x3a1e0c;
const SKY: [u32; 2] = [0xfffbe2, 0xffd468];
const FLOOR: [u32; 2] = [0xffe48a, 0xe0a030];
const PUFF: [u32; 4] = [0xd99a2a, 0xf4c84a, 0xffe58a, 0xfffbe0];
const STREAK: u32 = 0xfffbe0;
const SHADOW: u32 = 0xb07a1a;

/// `bayer` with JS's `x & 3` on any number.
fn bay(x: f64, y: f64) -> f64 {
    bayer(to_int32(x), to_int32(y))
}

fn px(fb: &mut Framebuffer, x: f64, y: f64, c: u32) {
    fb.px(x, y, c, 1.0);
}

fn mix_c(a: u32, b: u32, k: f64) -> u32 {
    let k = 0f64.max(1f64.min(k));
    let c = |sh: u32| js_round(((a >> sh) & 255) as f64 + (((b >> sh) & 255) as f64 - ((a >> sh) & 255) as f64) * k) as u32;
    (c(16) << 16) | (c(8) << 8) | c(0)
}

fn bend_s(s: f64) -> f64 {
    (1.25 * sin(s * 0.045) + 0.6 * sin(s * 0.017 + 1.0)) * 1f64.min(0f64.max((END - 10.0 - s) / 40.0))
}

fn ease(k: f64) -> f64 {
    let k = 0f64.max(1f64.min(k));
    k * k * (3.0 - 2.0 * k)
}

/// The frame on snake way, after `st.clear()`: game.js `drawSnake`.
pub fn draw(c: &mut Ctx, g: &mut Game, view: &View, dt: f64) {
    let (w, h, t) = (c.w, c.h, c.t);
    let rw = w * if w / h < 0.8 { 0.6 } else { 0.42 };
    let hz = road_3d(c, g, view, rw);
    let snk = g.tl.snk.as_ref().unwrap();
    let p = snk.p;
    if (bend_s(p * END + 9.0) - bend_s(p * END)).abs() < 0.22 && snk.done == 0.0 && p < 0.99 {
        let y0 = js_round(hz + (h - hz) * 0.3);
        for i in 0..3 {
            let a = (t * 2.0 + i as f64 / 3.0) % 1.0;
            let y = y0 + a * (h - hz) * 0.25;
            let ww = 3.0 + a * 5.0;
            let mut xx = -ww;
            while xx <= ww {
                c.fb.px(w / 2.0 + xx, y - xx.abs() * 0.6, 0xfffbe0, 0.4 + 0.6 * (1.0 - a));
                xx += 1.0;
            }
        }
    }
    // streakTag
    if snk.streak >= 2 && t - snk.streak_t <= 1.4 {
        let mut s = to_fixed(1.0 + snk.streak as f64 * 0.25, 2);
        if s.ends_with('0') {
            s.pop();
        }
        label(c.fb, &format!("STREAK X{s}"), snk.hx, snk.hy - snk.sh - 14.0, 0xb07a10, 0xffffff);
    }
    // hud: the progress bar, the particles and the flash running down
    let bw = w - 40.0;
    let mut x = 0.0;
    while x < bw {
        for y in 0..2 {
            px(c.fb, 20.0 + x, h - 3.0 + y as f64, if x < bw * p { 0xd4a017 } else { 0xf2e2c0 });
        }
        x += 1.0;
    }
    Scene::step_fx(&mut g.fx, c.fb, dt);
    if g.flash_t > 0.0 {
        g.flash_t = 0f64.max(g.flash_t - dt * 1.8);
    }
    crate::floats::draw_snake(c.fb, g, dt);
}

fn label(fb: &mut Framebuffer, s: &str, x: f64, y: f64, c: u32, o: u32) {
    let x = js_round(x - text_width(s) / 2.0);
    let y = js_round(y);
    for (a, b) in [(-1.0, 0.0), (1.0, 0.0), (0.0, -1.0), (0.0, 1.0)] {
        text(fb, s, x + a, y + b, o, 1.0);
    }
    text(fb, s, x, y, c, 1.0);
}

/// The snake's back: `o` across (-1..1 is the road, past that its dark edge), `v` along.
fn snc(o: f64, v: f64) -> u32 {
    let au = o.abs();
    if au > 1.0 {
        return 0x3a1e0c;
    }
    if au > 0.9 {
        return 0x9a5a14;
    }
    if au > 0.78 {
        return if (v * 2.0).floor() % 2.0 != 0.0 { 0xffc84a } else { 0xfff6c0 };
    }
    if au > 0.74 {
        return 0x9a5a14;
    }
    let row = v.floor();
    let fv = v - row;
    let su = o * 4.2 + (row % 2.0) * 0.5;
    let fu = su - su.floor();
    let arc = pow((fu - 0.5) * 2.0, 2.0) * 0.55;
    if fv < arc + 0.12 && fv > arc {
        0xd8901e
    } else if fv < arc + 0.2 && fv > arc + 0.12 {
        0xfff0a0
    } else if au < 0.04 {
        0xe8a830
    } else {
        0xffd84a
    }
}

/// A torn break in his body: a colour, -1 where the road is whole, -2 for a hole on the widget.
#[allow(clippy::too_many_arguments)]
fn tear(gi: usize, gap: (f64, f64), s_at: f64, u: f64, o: f64, y: f64, t: f64, bare: bool) -> i64 {
    let ju = js_round(u * 9.0);
    let a = gap.0 + 0.55 * h2(ju + gi as f64 * 31.0, 7.0);
    let b = gap.1 - 0.55 * h2(ju + gi as f64 * 31.0, 11.0);
    if s_at < a || s_at > b {
        return -1;
    }
    if bare && s_at <= b - 0.5 {
        return -2;
    }
    if s_at > b - 0.5 {
        let f = (b - s_at) / 0.5;
        return if f < 0.22 {
            0xd8901e
        } else if f < 0.55 {
            if bay(o, y) < 0.5 {
                0x9a5a14
            } else {
                0x7a4010
            }
        } else {
            0x4a2008
        };
    }
    let d = 1f64.min((s_at - a).min(b - 0.5 - s_at) / ((b - 0.5 - a) / 2.0)).min((1.0 - u.abs()) * 2.2);
    let q = d + sin(o * 0.35 + t * 7.0 + y * 0.9) * 0.08 + (bay(o, y) - 0.5) * 0.25;
    if q < 0.1 {
        0x2a0804
    } else if q < 0.24 {
        if bay(o, y) < 0.55 {
            0xf0b060
        } else {
            0x7a2a10
        }
    } else if q < 0.45 {
        0x8a1a10
    } else if q < 0.66 {
        0xd0481e
    } else if q < 0.86 {
        0xff8a30
    } else {
        0xffd070
    }
}

/// A band of cloud puffs, lit from the upper left; `off` scrolls it.
#[allow(clippy::too_many_arguments)]
fn puff_row(fb: &mut Framebuffer, w: f64, h: f64, off: f64, y0: f64, r: f64, sd: f64, deep: bool) {
    let step = r * 1.4;
    let j0 = (off / step).floor() - 2.0;
    let mut j = j0;
    while j < j0 + w / step + 4.0 {
        let cx = j * step - off;
        let cy = y0 + sin(j * 1.9 + sd) * r * 0.35;
        let rr = r * (0.75 + 0.4 * hash(j * 3.1 + sd));
        let yb = if deep { h } else { h.min(cy + rr * 1.6) };
        j += 1.0;
        if cx + rr < 0.0 || cx - rr > w {
            continue;
        }
        let mut y = (cy - rr).floor();
        while y < yb {
            let mut x = (cx - rr).floor();
            while x <= cx + rr {
                let (dx, dy) = (x - cx, y - cy);
                if if dy < 0.0 { dx * dx + dy * dy > rr * rr } else { dx.abs() > rr } {
                    x += 1.0;
                    continue;
                }
                let l = if dy < 0.0 { -(dx * 0.5 + dy * 0.9) / rr } else { -0.5 - dy / (h - cy + 1.0) };
                let v = l + bay(x, y) * 0.3;
                px(
                    fb,
                    x,
                    y,
                    PUFF[if v > 0.65 {
                        3
                    } else if v > 0.2 {
                        2
                    } else if v > -0.4 {
                        1
                    } else {
                        0
                    }],
                );
                x += 1.0;
            }
            y += 1.0;
        }
    }
}

/// A procedural shape standing on (bx, by) tipped by ang; `f(u, v)` gives a colour or -1.
fn stamp(fb: &mut Framebuffer, bx: f64, by: f64, ang: f64, w: f64, h: f64, f: fn(f64, f64) -> i64) {
    let (ux, uy, rx, ry) = (sin(ang), -cos(ang), cos(ang), sin(ang));
    let rr = hypot(&[w, h]) + 1.0;
    let mut y = (by - rr).floor();
    while y <= by + rr {
        let mut x = (bx - rr).floor();
        while x <= bx + rr {
            let (dx, dy) = (x + 0.5 - bx, y + 0.5 - by);
            let u = (dx * rx + dy * ry) / w + 0.5;
            let v = (dx * ux + dy * uy) / h;
            if !(u < 0.0 || u > 1.0 || v < 0.0 || v > 1.0) {
                let c = f(u, v);
                if c >= 0 {
                    px(fb, x, y, c as u32);
                }
            }
            x += 1.0;
        }
        y += 1.0;
    }
}

fn kai_house(u: f64, v: f64) -> i64 {
    let e = pow(u - 0.5, 2.0) / 0.2 + pow(v - 0.42, 2.0) / 0.34;
    if v > 0.42 && e < 1.0 {
        return if e > 0.78 {
            0x7a1a12
        } else if u < 0.4 && v > 0.6 {
            0xff8a6a
        } else if u > 0.7 {
            0xb8301e
        } else {
            0xe0473a
        };
    }
    if v > 0.46 || u < 0.08 || u > 0.92 {
        return -1;
    }
    if u < 0.11 || u > 0.89 || v < 0.04 {
        return 0x5a4630;
    }
    if u > 0.42 && u < 0.58 && v < 0.34 {
        return 0x3a2a1e;
    }
    if hypot(&[(u - 0.74) * 1.4, v - 0.26]) < 0.09 {
        return 0x5ab8f2;
    }
    if u > 0.72 {
        0xcdbf9e
    } else {
        0xf6ecd4
    }
}

fn kai_tree(u: f64, v: f64) -> i64 {
    let can = [[0.5, 0.66, 0.34], [0.28, 0.52, 0.24], [0.72, 0.52, 0.24], [0.5, 0.86, 0.2]]
        .iter()
        .fold(9f64, |m, &[a, b, r]| m.min(hypot(&[u - a, (v - b) * 0.8]) / r));
    if can < 1.0 {
        return if can > 0.86 {
            0x173f16
        } else if u < 0.45 && v > 0.62 {
            0x8ad65a
        } else if u > 0.62 || v < 0.45 {
            0x2f7a26
        } else {
            0x4f9e36
        };
    }
    if u > 0.43 && u < 0.57 && v < 0.5 {
        if u > 0.51 {
            0x4a2a12
        } else {
            0x7a4a24
        }
    } else {
        -1
    }
}

/// Where king kai's and bubbles' heads were drawn, for their lines.
#[derive(Default)]
struct Folk {
    kk: Option<(f64, f64)>,
    bub: Option<(f64, f64)>,
}

/// King kai's planet: a slowly turning mini-world with a road ring round its cap, the house, the tree, king kai,
/// bubbles, gregory and the car going round. `beat`: seconds since he landed (-1 before).
#[allow(clippy::too_many_arguments)]
fn king_kai_planet(c: &mut Ctx, bare: bool, kx: f64, ky: f64, kr: f64, t: f64, spin: f64, beat: f64) -> Folk {
    let (w, h) = (c.w, c.h);
    let tilt = 0.42;
    let (ct, sn) = (cos(tilt), sin(tilt));
    let k = kr / 42.0;
    const G5: [u32; 6] = [0x2f7a26, 0x3f9330, 0x57ad3c, 0x78c64a, 0xa6de66, 0xd2f28e];
    let mut at = Folk::default();
    let hr = kr * 1.45 + 8.0;
    if !bare {
        let mut y = 0f64.max(ky - hr);
        while y < h.min(ky + hr) {
            let mut x = 0f64.max(kx - hr);
            while x < w.min(kx + hr) {
                let d = hypot(&[x - kx, y - ky]);
                if d >= kr && d <= hr {
                    c.fb.px(x, y, 0xfff4cc, pow(1.0 - (d - kr) / (hr - kr), 2.0) * 0.6);
                }
                x += 1.0;
            }
            y += 1.0;
        }
    }
    let (cs, ss) = (cos(spin), sin(spin));
    let mut y = -kr;
    while y <= kr {
        let yy = ky + y;
        if yy < 0.0 || yy >= h {
            y += 1.0;
            continue;
        }
        let mut x = -kr;
        while x <= kr {
            let xx = kx + x;
            let d = hypot(&[x, y]);
            if xx < 0.0 || xx >= w || d > kr + 0.3 {
                x += 1.0;
                continue;
            }
            if d > kr - 0.7 {
                px(c.fb, xx, yy, 0x1f3a1a);
                x += 1.0;
                continue;
            }
            let (nx, ny) = (x / kr, -y / kr);
            let nz = 0f64.max(1.0 - nx * nx - ny * ny).sqrt();
            let oy = ny * ct + nz * sn;
            let oz = -ny * sn + nz * ct;
            let ox = nx * cs - oz * ss;
            let oz2 = nx * ss + oz * cs;
            let l = nx * -0.5 + ny * 0.62 + nz * 0.6;
            let q = l * 0.8 + 0.45 + (bay(xx, yy) - 0.5) * 0.35 - if vnoise(ox * 5.0 + 9.0, oz2 * 5.0 + oy * 3.0) > 0.66 { 0.25 } else { 0.0 };
            let rd = (oy - 0.62).abs();
            let tuft = h2(((ox + 2.0) * kr * 0.55).floor(), ((oz2 + 2.0) * kr * 0.55).floor() + (oy * kr * 0.3).floor() * 57.0);
            let col = if rd < 0.05 {
                if rd > 0.04 {
                    0xa8a090
                } else if q > 0.5 {
                    0xfdfaf2
                } else {
                    0xd8d2c4
                }
            } else if kr > 30.0 && tuft > 0.985 {
                if tuft > 0.993 {
                    0xfff27a
                } else {
                    0xffffff
                }
            } else {
                G5[0f64.max(5f64.min(js_round(q * 4.2) - if kr > 20.0 && tuft > 0.91 { 1.0 } else { 0.0 })) as usize]
            };
            px(c.fb, xx, yy, col);
            x += 1.0;
        }
        y += 1.0;
    }
    if kr < 6.0 {
        return at;
    }
    // who lives there, carried round as it spins, far side hidden; the car drives the road ring faster than the spin
    enum Who {
        Tree,
        House,
        Spr { name: &'static str, s: f64, h: f64, kk: bool, bub: bool },
    }
    let monkey = if (t * 6.0).floor() % 2.0 == 0.0 { "MONKEY.0" } else { "MONKEY.1" };
    let folk: [(f64, Who, bool); 6] = [
        (-0.5, Who::Tree, false),
        (-0.16, Who::House, false),
        (0.14, Who::Spr { name: "KINGKAI", s: 0.62, h: 0.0, kk: true, bub: false }, false),
        (0.34, Who::Spr { name: monkey, s: 0.8, h: 9.0, kk: false, bub: true }, false),
        (0.5, Who::Spr { name: "GREGORY", s: 0.9, h: 13.0, kk: false, bub: false }, false),
        (0.74, Who::Spr { name: "KAICAR", s: 0.55, h: 0.0, kk: false, bub: false }, true),
    ];
    let mut pts: Vec<(usize, f64, f64, f64)> = Vec::new();
    for (i, (a, _, car)) in folk.iter().enumerate() {
        let lon = a * 2.6 + spin * if *car { 2.2 } else { 1.0 } + if *car { t * 0.5 } else { 0.0 };
        let lat = if *car { 0.67 } else { 0.9 + (i % 2) as f64 * 0.08 };
        let p = [cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon)];
        let z = p[1] * sn + p[2] * ct;
        if z > 0.05 {
            pts.push((i, p[0], p[1] * ct - p[2] * sn, z));
        }
    }
    pts.sort_by(|a, b| a.3.partial_cmp(&b.3).unwrap());
    for (i, x, y, z) in pts {
        let (a, who, _) = &folk[i];
        let (bx, by) = (kx + x * kr, ky - y * kr);
        let ang = atan2(x, y) * 0.8;
        let sz = 0.7 + 0.3 * z;
        match who {
            Who::Tree => stamp(c.fb, bx, by, ang, kr * 0.4 * sz, kr * 0.58 * sz, kai_tree),
            Who::House => stamp(c.fb, bx, by, ang, kr * 0.5 * sz, kr * 0.42 * sz, kai_house),
            Who::Spr { name, s, h: fh, kk, bub } => {
                if k * sz < 0.32 {
                    continue;
                }
                let wave = beat > 0.5 && *kk;
                let cheer = beat > 0.3 && *bub;
                let lift = if wave {
                    sin(beat * 7.0).abs() * 4.0 * k
                } else if cheer {
                    sin(beat * 14.0).abs() * 7.0 * k
                } else if *fh != 0.0 {
                    sin(t * fh + a).abs() * 3.0 * k
                } else {
                    0.0
                };
                let spr = sprite::get(name);
                let flip = if wave { (beat * 4.0).floor() % 2.0 == 0.0 } else { *a > 0.3 };
                c.blit_z(spr, bx, by, ang, flip, lift, 1e9, k * s * sz);
                let head = (bx, by - spr.h as f64 * k * s * sz - lift);
                if *kk {
                    at.kk = Some(head);
                }
                if *bub {
                    at.bub = Some(head);
                }
            }
        }
    }
    at
}

/// A lost soul: a white wisp with a curling tail and two dark eyes.
fn draw_ghost(fb: &mut Framebuffer, ox: f64, gy: f64, r: f64, ph: f64, t: f64) {
    let mut yy = -r;
    while yy <= r * 2.2 {
        let mut xx = -r - 2.0;
        while xx <= r + 2.0 {
            let tail = if yy > 0.0 { r * (1.0 - yy / (r * 2.2)) } else { r };
            let off = if yy > 0.0 { sin(yy / r * 2.0 + t * 5.0 + ph) * r * 0.35 } else { 0.0 };
            let d = if yy > 0.0 { (xx - off).abs() / 0.6f64.max(tail) } else { hypot(&[xx, yy]) / r };
            if d <= 1.0 {
                let c = if d > 0.8 {
                    0xb8c8dc
                } else if yy < -r * 0.3 && xx < 0.0 {
                    0xffffff
                } else {
                    0xeef3fa
                };
                px(fb, ox + xx, gy + yy, c);
            }
            xx += 1.0;
        }
        yy += 1.0;
    }
    if r >= 3.0 {
        for ex in [-0.35, 0.35] {
            let mut p = 0.0;
            while p < 1f64.max(r / 4.0) {
                let mut q = 0.0;
                while q < 1f64.max(r / 3.0) {
                    px(fb, ox + ex * r + p, gy - r * 0.15 + q + 0.0, 0x2a2440);
                    q += 1.0;
                }
                p += 1.0;
            }
        }
    }
}

/// Kinto'un: a puffy yellow cloud centred on (x, y), w wide.
fn draw_nimbus(fb: &mut Framebuffer, x: f64, y: f64, w: f64) {
    let r = 2f64.max(w / 4.0);
    const PUFFS: [[f64; 3]; 5] = [[-1.3, 0.25, 0.8], [1.3, 0.25, 0.8], [-0.6, -0.15, 1.0], [0.6, -0.1, 1.0], [0.0, 0.3, 0.9]];
    for pass in [0.0, 1.0] {
        for [dx, dy, rr] in PUFFS {
            let (cx0, cy0, rad) = (x + dx * r, y + dy * r, rr * r - pass);
            let mut yy = -rad - 1.0;
            while yy <= rad + 1.0 {
                let mut xx = -rad - 1.0;
                while xx <= rad + 1.0 {
                    let d = hypot(&[xx, yy]) / 1f64.max(rad);
                    if d <= 1.0 {
                        let c = if pass == 0.0 {
                            0x7a3e06
                        } else if yy < -rad * 0.35 && d < 0.65 {
                            0xfffbe0
                        } else if yy > rad * 0.35 {
                            0xeea21e
                        } else {
                            0xffe36a
                        };
                        px(fb, cx0 + xx, cy0 + yy, c);
                    }
                    xx += 1.0;
                }
                yy += 1.0;
            }
        }
    }
}

/// The halo the dead wear in the other world.
fn halo(fb: &mut Framebuffer, x: f64, y: f64, k: f64) {
    for (r, c) in [(1.0, 0x5a3a08), (0.0, 0)] {
        let mut a = 0.0;
        while a < 6.28 {
            let mut d = -r;
            while d <= r {
                let col = if r != 0.0 {
                    c
                } else if sin(a) < 0.0 {
                    0xfff8c8
                } else {
                    0xffd23a
                };
                px(fb, x + cos(a) * (5.0 * k + d), y + sin(a) * (1.6 * k + d) - 0.0, col);
                d += 1.0;
            }
            a += 0.04;
        }
    }
}

/// A sprite at any scale, feet centred on (x, y).
fn sblit_f(fb: &mut Framebuffer, spr: &Sprite, x: f64, y: f64, s: f64) {
    let (w, h) = (spr.w as f64 * s, spr.h as f64 * s);
    let (x0, y0) = (js_round(x - w / 2.0), js_round(y - h));
    let mut j = 0.0;
    while j < h.ceil() {
        let mut i = 0.0;
        while i < w.ceil() {
            let si = (spr.w - 1).min((i / s).floor() as usize);
            let sj = (spr.h - 1).min((j / s).floor() as usize);
            let c = spr.col[sj * spr.w + si];
            if c >= 0 {
                px(fb, x0 + i, y0 + j, c as u32);
            }
            i += 1.0;
        }
        j += 1.0;
    }
}

/// A golden orb: a twinkling star.
fn sky_dot(fb: &mut Framebuffer, x: f64, y: f64, t: f64) {
    let r = 2.0 + (t * 6.0).floor() % 2.0;
    let mut i = -r - 2.0;
    while i <= r + 2.0 {
        let c = if i.abs() <= 1.0 { 0xffffff } else { 0xffe36a };
        px(fb, x + i, y, c);
        px(fb, x, y + i, c);
        i += 1.0;
    }
    for (a, b) in [(-1.0, -1.0), (1.0, -1.0), (-1.0, 1.0), (1.0, 1.0)] {
        px(fb, x + a, y + b, 0xfff3a0);
    }
}

fn orb_dot(fb: &mut Framebuffer, x: f64, y: f64, r: f64) {
    let mut yy = -r;
    while yy <= r {
        let mut xx = -r;
        while xx <= r {
            let q = hypot(&[xx, yy]) / r;
            if q <= 1.0 {
                px(
                    fb,
                    x + xx,
                    y + yy,
                    if q < 0.45 {
                        0xffffff
                    } else if q < 0.8 {
                        0xffe08a
                    } else {
                        0xff9a2a
                    },
                );
            }
            xx += 1.0;
        }
        yy += 1.0;
    }
}

/// How high he hops every gap and spine on his own, from where he stands.
fn hop(snk: &planet_core::timeline::Snake, here: f64) -> f64 {
    for &(a, b) in &snk.gaps {
        let k = (here - a + 1.4) / (b - a + 2.8);
        if k > 0.0 && k < 1.0 {
            return sin(k * PI);
        }
    }
    for q in &snk.spikes {
        let k = (here - q.s + 1.0) / 2.0;
        if k > 0.0 && k < 1.0 && (q.u - snk.x).abs() < 0.4 {
            return sin(k * PI) * 0.7;
        }
    }
    0.0
}

enum Thing {
    Orb,
    Spike,
    Ghost(usize),
    Sky,
}

/// game.js `road3D`: everything but the chevrons and the hud. Returns the horizon.
fn road_3d(c: &mut Ctx, g: &mut Game, view: &View, rw: f64) -> f64 {
    let (w, h, t, bare) = (c.w, c.h, c.t, view.bare);
    let ph = w / h < 0.8;
    let snk = g.tl.snk.as_ref().unwrap();
    let p = snk.p;
    let s_h = p * END;
    let tb = if snk.done != 0.0 { t - snk.done } else { -1.0 };
    let lag = if tb >= 0.0 { 5.0 - 2.6 * ease(tb / 1.8) } else { 5.0 * ease((p - 0.93) / 0.07) };
    let cam = (if tb >= 0.0 { END } else { s_h }) - lag;
    let z_h = 1.6 + lag;
    let (h0, h1) = if ph { (0.4, 0.5) } else { (0.36, 0.52) };
    let hz = js_round(h * (h0 + (h1 - h0) * ease((p - 0.82) / 0.18)));
    let base = if ph { js_round(h * 0.74) } else { h - 4.0 };
    let sx = snk.x;
    let y_at = |z: f64| hz + 1.6 / z * (h - hz);
    let x_at = |s: f64, z: f64| w / 2.0 + (bend_s(s) - bend_s(cam) - sx) * rw * 1.6 / z;
    if !bare {
        let mut y = 0.0;
        while y < hz + 4.0 {
            let mut x = 0.0;
            while x < w {
                px(c.fb, x, y, mix_c(SKY[0], SKY[1], y / hz + (bay(x, y) - 0.5) * 0.1));
                x += 1.0;
            }
            y += 1.0;
        }
        let mut y = hz + 3.0;
        while y < h {
            let mut x = 0.0;
            while x < w {
                px(c.fb, x, y, mix_c(FLOOR[0], FLOOR[1], (y - hz) / (h - hz) + (bay(x, y) - 0.5) * 0.12));
                x += 1.0;
            }
            y += 1.0;
        }
        let fo = cam * 6.0 + t * 3.0;
        puff_row(c.fb, w, h, fo * 0.3, hz + 3.0, 4f64.max(w * 0.03), 1.0, false);
        puff_row(c.fb, w, h, fo * 0.6, hz + (h - hz) * 0.3, 6f64.max(w * 0.055), 2.0, false);
        puff_row(c.fb, w, h, fo, hz + (h - hz) * 0.7, 9f64.max(w * 0.09), 3.0, true);
    }
    // king kai's planet where the road ends: a speck at first, filling the sky by the end
    let z_e = END - cam;
    let y_e = y_at(0.5f64.max(z_e));
    let y_p = if ph { y_e.min(h * 0.64) } else { y_e };
    let m = w.min(h * 1.2);
    let kr = js_round(2f64.max(((y_p - 5.0) / 2.25).min(w * 0.44).min((3.0 + m * (0.04 * p + 0.2 * pow(p, 3.0))).max((h - hz) * 2.2 / z_e))));
    let x_end = x_at(END, 0.5f64.max(z_e));
    let kx = js_round((kr + 2.0).max((w - kr - 2.0).min(x_end)));
    let ky = js_round(y_p - kr * 0.9);
    let spin = snk.spin;
    let folk = king_kai_planet(c, bare, kx, ky, kr, t, spin, tb);
    let snk = g.tl.snk.as_ref().unwrap();
    let tip_y = ky + kr * 0.38;
    let w_e = (rw * 1.6 / 0.5f64.max(z_e)).min(kr * 0.55);
    if kr > 8.0 {
        let mut y = y_e.floor();
        while y > tip_y {
            let f = (y_e - y) / (y_e - tip_y);
            let hw = w_e + (kr * 0.2 - w_e) * f;
            let cc = kx + (x_end - kx) * (1.0 - f);
            let mut o = -hw - 1.5;
            while o <= hw + 1.5 {
                px(c.fb, cc + o, y, mix_c(snc(o / hw, f * 7.0), 0x6a4410, f * 0.35 + 0f64.max(o / hw) * 0.15));
                o += 1.0;
            }
            y -= 1.0;
        }
    }
    // the road: the snake's back in perspective, torn open at the gaps
    struct Seen {
        x: f64,
        y0: f64,
        y1: f64,
        w: f64,
    }
    let mut seen: Vec<Option<Seen>> = snk.gaps.iter().map(|_| None).collect();
    let mut y = h - 1.0;
    while y > hz + 1.0 {
        let q = (y - hz) / (h - hz);
        let z = 1.6 / q;
        let s_at = cam + z;
        let ww = rw * q;
        let cxr = x_at(s_at, z);
        let v = s_at * 3.2;
        let gi = snk.gaps.iter().position(|g| s_at > g.0 - 0.6 && s_at < g.1 + 0.6);
        if s_at > END {
            break;
        }
        let mut o = -ww - 2.0;
        while o <= ww + 2.0 {
            let u = o / ww;
            if u.abs() > 1.0 + 2.5 / ww {
                o += 1.0;
                continue;
            }
            let col = match gi {
                Some(gi) => tear(gi, snk.gaps[gi], s_at, u, cxr + o, y, t, bare),
                None => -1,
            };
            if col != -1 {
                if u.abs() <= 1.0 {
                    if col >= 0 {
                        px(c.fb, cxr + o, y, col as u32);
                    }
                    let gi = gi.unwrap();
                    let sg = seen[gi].get_or_insert(Seen { x: cxr, y0: y, y1: y, w: ww });
                    sg.y0 = sg.y0.min(y);
                }
                o += 1.0;
                continue;
            }
            px(c.fb, cxr + o, y, mix_c(snc(if u.abs() > 1.0 { 2.0 } else { u }, v), SKY[1], 0f64.max(0.55 - q) * 0.9));
            o += 1.0;
        }
        y -= 1.0;
    }
    // embers rising out of HFIL, and chunks of scale breaking off the near edge and tumbling in
    for (gi, sg) in seen.iter().enumerate() {
        let Some(sg) = sg else { continue };
        let gf = gi as f64;
        let span = sg.y1 - sg.y0 + 1.0 + sg.w * 0.5;
        for i in 0..12 {
            let fi = i as f64;
            let k = (t * (0.5 + hash(fi + gf * 9.0) * 0.5) + hash(fi * 3.7 + gf)) % 1.0;
            let ex = sg.x + (hash(fi * 1.3 + gf) - 0.5) * sg.w * 1.6 + sin(t * 3.0 + fi) * 2.0;
            let ey = sg.y1 - k * span;
            px(
                c.fb,
                ex,
                ey,
                if k > 0.7 {
                    0xffe08a
                } else if i % 2 != 0 {
                    0xff8a30
                } else {
                    0xffc040
                },
            );
            if sg.w > 40.0 {
                px(c.fb, ex, ey - 1.0, 0xffd070);
            }
        }
        for i in 0..3 {
            let fi = i as f64;
            let k = (t * 0.7 + fi / 3.0) % 1.0;
            let s = 1f64.max(js_round(sg.w * 0.05 * (1.0 - k)));
            let cx2 = sg.x + (hash(fi * 5.1 + gf) - 0.5) * sg.w * 1.3 * (1.0 - k * 0.5);
            let cy2 = sg.y1 + 2.0 - k * (sg.y1 - sg.y0) * 0.6;
            let mut yy = 0.0;
            while yy < s {
                let mut xx = 0.0;
                while xx < s {
                    px(c.fb, cx2 + xx, cy2 + yy, if yy == 0.0 { 0xffd84a } else { mix_c(0xc87a1e, 0x3a1206, k) });
                    xx += 1.0;
                }
                yy += 1.0;
            }
        }
    }
    // orbs, spines, golden orbs and ghosts, far to near
    let mut things: Vec<(f64, f64, Thing)> = Vec::new();
    things.extend(snk.orbs.iter().filter(|o| !o.got).map(|o| (o.s, o.u, Thing::Orb)));
    things.extend(snk.spikes.iter().map(|q| (q.s, q.u, Thing::Spike)));
    things.extend(snk.ghosts.iter().enumerate().filter(|(_, gh)| !gh.dead).map(|(i, gh)| (gh.s, gh.u + sin(t + gh.ph) * 0.15, Thing::Ghost(i))));
    things.extend(snk.sky.iter().filter(|o| !o.got && !o.miss).map(|o| (o.p * END + 1.6, sx, Thing::Sky)));
    things.retain(|o| o.0 - cam > 1.2 && o.0 - cam < 40.0 && o.0 < END);
    things.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap());
    let snk = g.tl.snk.as_mut().unwrap();
    for gh in snk.ghosts.iter_mut() {
        gh.sx = None;
    }
    for (s, u, kind) in things {
        let z = s - cam;
        let q = 1.6 / z;
        let y = hz + q * (h - hz);
        let ww = rw * q;
        let ox = x_at(s, z) + u * ww;
        let r = 1.5f64.max(7.0 * q * (rw / 130.0));
        match kind {
            Thing::Ghost(i) => {
                let gh = &mut snk.ghosts[i];
                let gy = y - r * gh.h * 2.4 + sin(t * 3.0 + gh.ph) * r * 0.4;
                let gr = 2f64.max(r * 1.5);
                gh.sx = Some((ox, gy));
                gh.r = gr;
                draw_ghost(c.fb, ox, gy, gr, gh.ph, t);
            }
            Thing::Sky => sky_dot(c.fb, ox, y - r * 7.0, t),
            Thing::Spike => {
                for [dx, hk, wk] in [[-0.9, 1.6, 0.55], [0.9, 1.6, 0.55], [0.0, 2.6, 0.7]] {
                    let hh = r * hk * 1.3;
                    let bw = r * wk * 1.3;
                    let bx = ox + dx * r;
                    let mut yy = 0.0;
                    while yy <= hh {
                        let half = bw * (1.0 - yy / hh);
                        let mut xx = -half;
                        while xx <= half {
                            let col = if xx.abs() > half - 1.0 {
                                EDGE
                            } else if xx > 0.0 {
                                0xa84a18
                            } else if yy > hh * 0.6 {
                                0xffe0a0
                            } else {
                                0xe07a2a
                            };
                            px(c.fb, bx + xx, y - yy, col);
                            xx += 1.0;
                        }
                        yy += 1.0;
                    }
                }
            }
            Thing::Orb => orb_dot(c.fb, ox, y - r * 2.2, r),
        }
    }
    // speed streaks, thicker in a dash; gone once he's there
    let dash = g.t < snk.dash;
    if tb < 0.0 {
        for i in 0..if dash { 18 } else { 10 } {
            let fi = i as f64;
            let k = (t * if dash { 3.0 } else { 1.8 } + fi * 0.37) % 1.0;
            let side = if i % 2 != 0 { -1.0 } else { 1.0 };
            let x0 = w / 2.0 + side * w * (0.38 + k * 0.2);
            let y0 = hz + (h - hz) * (0.2 + (fi * 0.29) % 0.7);
            let mut j = 0.0;
            while j < 6.0 + k * 8.0 {
                px(c.fb, x0 + side * j * 0.5, y0 + j, STREAK);
                j += 1.0;
            }
        }
    }
    // him, from behind: smaller as he runs on ahead, a last big leap onto the planet, then turning round on it
    let k = 1f64.max(js_round(w.min(h) / 110.0));
    let sc = k * 1.6 / z_h;
    let feet = hz + (base - hz) * 1.6 / z_h;
    let hx = w / 2.0 + (bend_s(cam + z_h) - bend_s(cam)) * rw * 1.6 / z_h;
    let leap = if tb < 0.0 && p > 0.975 { sin((p - 0.975) / 0.025 * PI) * 30.0 * k } else { 0.0 };
    let riding = g.riding > 0.0 && tb < 0.0;
    let jump = (if tb < 0.0 { hop(snk, cam + z_h) * 18.0 * k + g.tl.jump_h * k } else { 0.0 }) * (1.6 / z_h)
        + leap * 1f64.min(1.6 / z_h * 2.2)
        + if riding { 10.0 * sc } else { 0.0 };
    if riding {
        draw_nimbus(c.fb, hx, feet - jump + 2.0 * sc, 14.0 * sc * 2.1);
    }
    if jump > 0.0 {
        let mut yy = -2.0 * sc;
        while yy <= 2.0 * sc {
            let mut xx = -8.0 * sc;
            while xx <= 8.0 * sc {
                if pow(xx / (8.0 * sc), 2.0) + pow(yy / (2.0 * sc), 2.0) <= 1.0 && bay(hx + xx, feet - 2.0 + yy) < 0.5 {
                    px(c.fb, hx + xx, feet - 2.0 + yy, SHADOW);
                }
                xx += 1.0;
            }
            yy += 1.0;
        }
    }
    if leap > 0.0 {
        for i in 0..10 {
            let fi = i as f64;
            let yy = feet - jump + fi * 2.0 * sc + 4.0 * sc;
            for j in [-1.0, 0.0, 1.0] {
                if bay(hx + j, yy) < 0.7 - fi * 0.06 {
                    px(c.fb, hx + j * sc, yy, 0xfff3c0);
                }
            }
        }
    }
    let land = if tb >= 0.0 {
        1.0
    } else if p > 0.975 {
        ease((p - 0.975) / 0.025)
    } else {
        0.0
    };
    let fy = feet + (tip_y + 2.0 - feet) * land;
    let fx2 = hx + (kx - hx) * land;
    let form = &g.forms[g.s.form];
    let fi = ALL_FORMS.iter().position(|f| f.0 == form.name).unwrap_or(0);
    let hero = sprite::hero(crate::scene::hero_id(g));
    let back = &hero.backs.get(fi).unwrap_or(&hero.backs[0])[(t * 8.0).floor() as usize % 2];
    let spr = if tb > 0.35 { &hero.forms[fi].pose } else { back };
    sblit_f(c.fb, spr, fx2, fy - jump, sc);
    halo(c.fb, fx2, fy - jump - spr.h as f64 * sc - 2.0 * sc, sc);
    let snk = g.tl.snk.as_mut().unwrap();
    snk.hx = fx2;
    snk.hy = fy - jump - spr.h as f64 * sc / 2.0;
    snk.sh = spr.h as f64 * sc;
    // ki blasts: a bright streak from his hands to the ghost
    let (x0, y0) = (fx2, fy - jump - 14.0 * sc);
    for &(sx2, sy2, t0) in &snk.shots {
        let a = (t - t0) / 0.18;
        if a > 1.0 {
            continue;
        }
        let step = 1.0 / 20f64.max(hypot(&[sx2 - x0, sy2 - y0]));
        let mut i = 0.0;
        while i <= 1.0 {
            if i > a - 0.5 && i < a + 0.05 {
                for wd in [-1.0, 0.0, 1.0] {
                    px(c.fb, x0 + (sx2 - x0) * i + wd, y0 + (sy2 - y0) * i, if wd != 0.0 { 0xfff3a0 } else { 0xffffff });
                }
            }
            i += step;
        }
    }
    snk.shots.retain(|s| t - s.2 < 0.2);
    if tb >= 0.0 {
        arrival(c.fb, bare, t, tb, kx, ky, kr, &folk, fx2, fy);
    }
    hz
}

/// The landing: sparkles, king kai waves and calls out, bubbles cheers, then a soft white-out into the visit.
#[allow(clippy::too_many_arguments)]
fn arrival(fb: &mut Framebuffer, bare: bool, t: f64, tb: f64, kx: f64, ky: f64, kr: f64, folk: &Folk, hx: f64, feet: f64) {
    let w = fb.w as f64;
    for i in 0..14 {
        let fi = i as f64;
        let a = hash(fi * 2.3) * 6.283 + t * 0.3;
        let r = kr * (1.05 + 0.25 * hash(fi * 4.1));
        let tw = (t * 2.5 + hash(fi)) % 1.0;
        if tw > 0.6 {
            continue;
        }
        let (x, y) = (kx + cos(a) * r, ky + sin(a) * r);
        let s = js_round(1.0 + (1.0 - (tw - 0.3).abs() / 0.3) * 2.0);
        let mut d = -s;
        while d <= s {
            let c = if d != 0.0 { 0xfff3a0 } else { 0xffffff };
            px(fb, x + d, y, c);
            px(fb, x, y + d, c);
            d += 1.0;
        }
    }
    if tb < 0.5 {
        let r = tb / 0.5 * 40.0;
        let mut a = 0.0;
        while a < 6.28 {
            fb.px(hx + cos(a) * r, feet - 4.0 + sin(a) * r * 0.35, 0xfffbe0, 1.0 - tb / 0.5);
            a += 0.08;
        }
    }
    if let Some((x, y)) = folk.kk {
        if tb > 0.6 && tb < BEAT - 0.5 && (tb < 1.7 || tb > 2.4) {
            label(fb, if tb < 1.7 { "YOU MADE IT!" } else { "NOW, A JOKE..." }, 40f64.max((w - 40.0).min(x)), 6f64.max(y - 12.0), 0x1d1030, 0xffffff);
        }
    }
    if let Some((x, y)) = folk.bub {
        if tb > 1.7 && tb < 2.4 {
            label(fb, "OOK OOK!", 30f64.max((w - 30.0).min(x)), 6f64.max(y - 10.0), 0x7a4a24, 0xffffff);
        }
    }
    let f = (tb - (BEAT - 0.7)) / 0.7;
    if f > 0.0 {
        for y in 0..fb.h {
            for x in 0..fb.w {
                if (!bare || fb.buf[y * fb.w + x] >> 24 != 0) && bayer(x as i32, y as i32) < f * 0.85 {
                    px(fb, x as f64, y as f64, 0xffffff);
                }
            }
        }
    }
}
