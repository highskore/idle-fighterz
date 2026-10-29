//! The planet's and the props' shaders (game.js `shadePlanet`, `shadeKame`, `shadeW2`, `shadeTop`, `shadeDome`,
//! `shadeHQ`, `shadePool`).

use planet_core::geom::{dot, V3};
use planet_core::jsmath::{atan2, pow, sin};
use planet_core::num::js_round;

use crate::scene::{ap_t, tone, vnoise3, Ctx};
use crate::scenery::{Built, Pave, Pn};
use crate::tones::{top, W2P};
use crate::{bayer, h2};

const PZ_WATER: [u32; 5] = [0x1a4a7a, 0x2a6aa8, 0x4a94d0, 0x8ac8ee, 0xdaf2ff];
const FUT_SKY: [u32; 4] = [0x4e5866, 0x6a7480, 0x8a929c, 0xc4ccd4];
const FUT_FIRE: [u32; 4] = [0x5a1a0e, 0xa03a14, 0xe0702a, 0xffb050];
const FUT_FLECK: [u32; 2] = [0xc4d0dc, 0x8a96a2];

fn street(c: f64) -> bool {
    c.abs() < 0.7 && (c * 4.0 - js_round(c * 4.0)).abs() < 0.04
}

/// The axes `shadePlanet` reads off the road: its pole N and in-plane E1, E2, and where the hero is (`phi`).
pub struct Axes {
    pub n: V3,
    pub e1: V3,
    pub e2: V3,
    pub phi: f64,
    pub top_dmg: f64,
}

/// `shadePlanet(o, n, x, y)`
pub fn planet(c: &Ctx, b: &Built, ax: &Axes, n: V3, x: i64, y: i64) -> u32 {
    let t = c.tones;
    let nb = ap_t(&c.m, n);
    let lum = c.light(n) + pow(1.0 - n[2], 3.0) * 0.15;
    if c.world == 6 {
        return kame(c, ax, nb, lum, x, y);
    }
    if c.world == 9 {
        return top_floor(c, ax, nb, lum, x, y);
    }
    let dn = dot(nb, ax.n);
    if crate::tones::is_w2(c.world) {
        return w2(c, ax, nb, dn, lum, x, y);
    }
    if dn.abs() < 0.07 {
        return if c.world == 5 && dn.abs() < 0.006 && (atan2(dot(nb, ax.e2), dot(nb, ax.e1)) * 10.0 + 99.0) % 1.0 < 0.55 {
            0xf6d84a
        } else {
            tone(&t.road, lum + 0.2, x, y)
        };
    }
    for q in &b.roads {
        let d = dot(nb, q.n);
        if d < q.lo || d > q.hi {
            continue;
        }
        let (u, v) = (dot(nb, q.a), dot(nb, q.b));
        return match q.pave {
            Pave::Pool => tone(&t.glass, lum + if d - q.lo < 0.006 { -0.3 } else { 0.05 }, x, y),
            Pave::Plaza => tone(&t.stone, lum + 0.2 - (((u * 50.0).floor() as i64 + (v * 50.0).floor() as i64) & 1) as f64 * 0.1, x, y),
            Pave::Street => {
                if (d - (q.lo + q.hi) / 2.0).abs() < 0.005 && (atan2(v, u) * 12.0 + 99.0) % 1.0 < 0.55 {
                    0xf6d84a
                } else {
                    tone(&t.road, lum + 0.2, x, y)
                }
            }
        };
    }
    if b.water.as_ref().is_some_and(|w| w.wet(nb)) {
        return tone(&PZ_WATER, lum + 0.1 + sin(nb[0] * 60.0 + nb[1] * 45.0) * 0.08, x, y);
    }
    let patch = vnoise3(nb[0] * 3.0 + 9.0, nb[1] * 3.0, nb[2] * 3.0);
    let f = vnoise3(nb[0] * 24.0, nb[1] * 24.0 + 4.0, nb[2] * 24.0);
    if f > 0.9 && lum > 0.4 {
        return if c.world == 8 {
            FUT_FLECK[if f > 0.94 { 0 } else { 1 }]
        } else if f > 0.94 {
            0xffffff
        } else {
            0xfff2a8
        };
    }
    if c.world == 8 && patch > 0.45 && (street(nb[0]) || street(nb[1]) || street(nb[2])) {
        return tone(&t.road, lum + (f - 0.5) * 0.6, x, y);
    }
    tone(&t.grass, lum + (patch - 0.5) * 0.22, x, y)
}

/// `shadeKame`: sand, wet sand, a line of surf, shallows, open water with glints, and the hero's wake.
fn kame(c: &Ctx, ax: &Axes, nb: V3, lum: f64, x: i64, y: i64) -> u32 {
    let t = c.tones;
    let cc = dot(nb, ax.n);
    let w = vnoise3(nb[0] * 5.0 + 3.0, nb[1] * 5.0, nb[2] * 5.0 + 7.0) - 0.5;
    let tt = c.t;
    let e = cc - 0.66 + w * 0.1;
    if e < -0.1 && cc.abs() < 0.02 {
        let a = atan2(dot(nb, ax.e2), dot(nb, ax.e1));
        let back = ((ax.phi - a) % 6.283 + 6.283) % 6.283;
        if back < 0.9 && bayer(x as i32, y as i32) < (1.0 - back / 0.9) * 0.9 {
            return if lum > 0.35 { 0xffffff } else { 0xcfe6f2 };
        }
    }
    if e > 0.03 {
        return tone(&t.road, lum + w * 0.35, x, y);
    }
    if e > 0.0 {
        return tone(&t.band, lum, x, y);
    }
    if e > -0.02 - 0.01 * sin(tt * 2.2 + (nb[0] + nb[2]) * 20.0) {
        return if lum + (bayer(x as i32, y as i32) - 0.5) * 0.3 > 0.45 { 0xffffff } else { 0xcfe6f2 };
    }
    if e > -0.1 {
        return tone(&t.glass, lum + 0.1 + e * 2.5, x, y);
    }
    let g = vnoise3(nb[0] * 22.0 + tt * 0.15, nb[1] * 22.0, nb[2] * 22.0);
    if g > 0.86 && lum > 0.45 {
        return if g > 0.9 { 0xffffff } else { 0xbfe6ff };
    }
    tone(&t.grass, lum + (w - 0.2) * 0.3, x, y)
}

/// `shadeW2`: vegeta's cracked rock and gold forecourt, the lookout's tiles, kai meadows, yardrat's spotted soil.
fn w2(c: &Ctx, ax: &Axes, nb: V3, dn: f64, lum: f64, x: i64, y: i64) -> u32 {
    let t = c.tones;
    let (u, w) = (dot(nb, ax.e1), dot(nb, ax.e2));
    let road = dn.abs() < 0.07;
    let patch = vnoise3(nb[0] * 3.0 + 9.0, nb[1] * 3.0, nb[2] * 3.0);
    let f = vnoise3(nb[0] * 24.0, nb[1] * 24.0 + 4.0, nb[2] * 24.0);
    match c.world {
        2 => {
            if road {
                return tone(&t.road, lum + 0.2 - (((atan2(w, u) * 20.0).floor() as i64) & 1) as f64 * 0.06, x, y);
            }
            if dn > 0.8 {
                let (ga, gb) = (u * 14.0, w * 14.0);
                return if ga - ga.floor() < 0.08 || gb - gb.floor() < 0.08 { tone(&t.road, lum - 0.1, x, y) } else { tone(&t.band, lum + 0.15, x, y) };
            }
            if (vnoise3(nb[0] * 7.0 + 2.0, nb[1] * 7.0, nb[2] * 7.0) - 0.5).abs() < 0.018 {
                return tone(&t.stone, lum - 0.15, x, y);
            }
            if f > 0.9 && lum > 0.45 {
                return tone(&t.grass, lum + 0.3, x, y);
            }
            tone(&t.grass, lum + (patch - 0.5) * 0.3, x, y)
        }
        10 => {
            if dn < 0.55 {
                return if dn > 0.52 {
                    tone(W2P.0, lum + 0.2, x, y)
                } else {
                    tone(&t.under, lum - 0.1 + ((((0.52 - dn) * 10.0).floor() as i64) & 1) as f64 * 0.14, x, y)
                };
            }
            if dn < 0.57 {
                return tone(&t.grass, lum + 0.45, x, y);
            }
            let a = 1f64.min(dn).acos() * 1.2;
            let ga = a * 7.0;
            let gb = (atan2(w, u) + 3.1416) / 6.2832 * (8.0 + (a * 7.0).floor() * 4.0);
            let (fa, fb) = (ga - ga.floor(), gb - gb.floor());
            if fa < 0.08 || fb < 0.08 {
                return tone(&t.stone, lum + 0.1, x, y);
            }
            if ga.floor() as i64 % 3 == 2 {
                return tone(&t.stone, lum + 0.3, x, y);
            }
            tone(&t.grass, lum + if ((ga.floor() + gb.floor()) as i64) & 1 != 0 { 0.06 } else { -0.02 } + (f - 0.5) * 0.08, x, y)
        }
        11 => {
            if road {
                return tone(&t.road, lum + 0.15 + (f - 0.5) * 0.2, x, y);
            }
            if f > 0.88 && lum > 0.35 {
                return t.flower[if f > 0.93 { 0 } else { 1 }];
            }
            if patch > 0.68 {
                return tone(&t.pinkg, lum + (patch - 0.5) * 0.2, x, y);
            }
            tone(&t.grass, lum + (patch - 0.5) * 0.25, x, y)
        }
        _ => {
            if road {
                return tone(&t.road, lum + 0.2 + (f - 0.5) * 0.15, x, y);
            }
            let g = vnoise3(nb[0] * 8.0 + 1.0, nb[1] * 8.0, nb[2] * 8.0 + 5.0);
            if g > 0.64 {
                return tone(&t.spot, lum + if g > 0.67 { 0.15 } else { -0.3 }, x, y);
            }
            if f > 0.9 && lum > 0.4 {
                return t.dot[0];
            }
            tone(&t.grass, lum + (patch - 0.5) * 0.25, x, y)
        }
    }
}

/// `shadeTop`: the tournament of power's tiled ring, broken up as `TOP.dmg` rises.
fn top_floor(_c: &Ctx, ax: &Axes, nb: V3, mut lum: f64, x: i64, y: i64) -> u32 {
    let p = &top::TILES;
    let d = ax.top_dmg;
    let w = dot(nb, ax.n);
    let u = dot(nb, ax.e1);
    let v = dot(nb, ax.e2);
    let th = (-1f64).max(1f64.min(w)).acos();
    let sc = th / 1e-4f64.max(sin(th)) / top::TILE;
    let (xx, yy) = (u * sc, v * sc);
    let (ti, tj) = (xx.floor(), yy.floor());
    let (fu, fv) = (xx - ti, yy - tj);
    let road = (th - 1.571).abs() < 0.075;
    let seam = 0.08;
    if d > 0.0 {
        let thr = 0.2 + 0.32 * d - if road { 0.14 } else { 0.0 };
        let hv = vnoise3(nb[0] * 3.2 + 11.0, nb[1] * 3.2, nb[2] * 3.2) * 0.7 + h2(ti * 7.0 + tj * 131.0 + 5.0, tj * 17.0 + ti * 3.0) * 0.3;
        if hv < thr {
            let deep = thr - hv;
            if deep < 0.028 {
                return tone(p, lum * 0.55 - 0.1, x, y);
            }
            let s = h2((x * 7 + 1) as f64, (y * 13) as f64);
            return if s > 0.992 {
                top::STAR[1]
            } else if bayer(x as i32, y as i32) < 0.3 {
                top::BG[1]
            } else {
                top::BG[0]
            };
        }
        let cr = vnoise3(nb[0] * 8.0 + 3.0, nb[1] * 8.0, nb[2] * 8.0 + 5.0);
        if (cr - 0.5).abs() < 0.012 + 0.012 * d && vnoise3(nb[0] * 2.0 + 7.0, nb[1] * 2.0, nb[2] * 2.0) < 0.2 + d * 0.9 {
            return tone(p, lum * 0.35, x, y);
        }
        if hv < thr + 0.035 {
            lum -= 0.18;
        }
        lum -= d * 0.08;
    }
    let pal: &[u32] = if road { &top::TRIM } else { p };
    if fu < seam || fv < seam {
        return tone(pal, lum - 0.2, x, y);
    }
    tone(pal, lum + (h2(ti * 13.0 + 1.0, tj * 29.0 + 7.0) - 0.5) * 0.14 + if fu < seam * 2.5 || fv < seam * 2.5 { 0.06 } else { 0.0 }, x, y)
}

/// `shadeDome`: a capsule house with a door and two round windows.
pub fn dome(c: &Ctx, s: V3, door: V3, n: V3, x: i64, y: i64) -> u32 {
    use planet_core::geom::{add, cross, norm};
    let t = c.tones;
    let u = ap_t(&c.m, n);
    let up = dot(u, s);
    let lum = c.light(n);
    if up < 0.36 {
        if dot(u, door) > 0.9 && up < 0.3 {
            return 0x4a2a16;
        }
        return tone(&t.band, lum, x, y);
    }
    for a in [0.9, -0.9] {
        let w = norm(add(door, cross(s, door), a));
        if up < 0.72 && up > 0.44 && dot(u, w) > 0.955 {
            return if dot(u, w) > 0.975 { tone(&t.glass, lum + 0.2, x, y) } else { 0x3a2214 };
        }
    }
    tone(&t.dome, lum, x, y)
}

const GLYPH: [(u8, u32); 10] =
    [(b'C', 0x7927), (b'A', 0x2bed), (b'P', 0x6ba4), (b'S', 0x388e), (b'U', 0x5b6f), (b'L', 0x4927), (b'E', 0x79a7), (b'O', 0x2b6a), (b'R', 0x6bad), (b' ', 0)];
const LABEL: &[u8] = b"CAPSULE";

/// `shadeHQ`: capsule corp, lettered round its blue band.
#[allow(clippy::too_many_arguments)]
pub fn hq(c: &Ctx, s: V3, door: V3, side: V3, text: bool, p: Pn, n: V3, x: i64, y: i64) -> u32 {
    let t = c.tones;
    let u = ap_t(&c.m, n);
    let up = dot(u, s);
    let lum = c.light(n);
    let f = dot(u, door);
    let sd = dot(u, side);
    let ang = atan2(sd, f);
    if up < 0.1 {
        return tone(&t.stone, lum + 0.1, x, y);
    }
    if up < 0.36 {
        let col = ((ang / 1.7 + 0.5) * LABEL.len() as f64 * 4.0).floor();
        let row = ((0.33 - up) / 0.2 * 5.0).floor();
        if text && col >= 0.0 && col < LABEL.len() as f64 * 4.0 && (col as i64) % 4 < 3 && row >= 0.0 && row < 5.0 {
            let (ci, ri) = (col as i64, row as i64);
            let gl = GLYPH.iter().find(|g| g.0 == LABEL[(ci >> 2) as usize]).map(|g| g.1).unwrap_or(0) as i64;
            if (gl >> (14 - ri * 3 - ci % 4)) & 1 != 0 {
                return 0xffffff;
            }
        }
        if !text && ang.abs() < 0.22 && up < 0.3 {
            return 0x24304a;
        }
        return tone(&t.cc, lum + 0.15, x, y);
    }
    let w = (ang / (std::f64::consts::PI / 5.0) + 99.5) % 1.0;
    if up > 0.44 && up < 0.58 && (w - 0.5).abs() < 0.2 {
        return tone(&t.pane, lum + 0.25, x, y);
    }
    tone(p.pal(t), lum, x, y)
}

/// `shadePool`: a puddle mirroring the sky, or a smouldering crater.
pub fn pool(c: &Ctx, s: V3, lava: bool, n: V3, x: i64, y: i64) -> u32 {
    let t = c.tones;
    let k = (dot(ap_t(&c.m, n), s) - 0.92) * 12.5;
    let lum = c.light(n);
    if k < 0.2 {
        return tone(if lava { &t.trunk } else { &t.road }, lum * 0.8, x, y);
    }
    if lava {
        return tone(&FUT_FIRE, k + sin(c.t * 3.0 + x as f64 * 0.7 + y as f64 * 0.5) * 0.15 - 0.15, x, y);
    }
    tone(&FUT_SKY, 0.15 + k * 0.5 + sin(c.t * 6.0 + x as f64 * 0.9 + y as f64 * 1.3) * 0.12, x, y)
}
