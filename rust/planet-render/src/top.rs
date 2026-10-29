//! The tournament of power's arena (world 9): the null realm's void with its nebula, stars and floating rock
//! pillars, the gods' stands round the ring (emptied as universes are erased), and zeno's box with the grand priest.

use planet_core::data::LADDER;
use planet_core::jsmath::sin;
use planet_core::num::js_round;
use planet_core::sprite;
use planet_core::Game;

use crate::scene::{blit, hash, text, text_width, Ctx};
use crate::tones::top;
use crate::{bayer, h2, pk};

/// world.js `vnoise`: 2D value noise.
pub fn vnoise(x: f64, y: f64) -> f64 {
    let (xi, yi) = (x.floor(), y.floor());
    let (xf, yf) = (x - xi, y - yi);
    let u = xf * xf * (3.0 - 2.0 * xf);
    let v = yf * yf * (3.0 - 2.0 * yf);
    let (a, b, c, d) = (h2(xi, yi), h2(xi + 1.0, yi), h2(xi, yi + 1.0), h2(xi + 1.0, yi + 1.0));
    a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

/// game.js `mixc`: a colour moved toward another by k, rounded per channel.
pub fn mixc(a: u32, b: u32, k: f64) -> u32 {
    let m = |s: u32| js_round(((a >> s) & 255) as f64 + (((b >> s) & 255) as f64 - ((a >> s) & 255) as f64) * k) as u32;
    (m(16) << 16) | (m(8) << 8) | m(0)
}

/// The universes in the stands, left to right round the ring (`TOP.UNI`).
const UNI: [u32; 8] = [9, 10, 4, 3, 2, 6, 11, 7];
/// [god skin, god clothes, angel skin, banner] per universe (`TOP_GODS`)
fn gods(u: u32) -> [u32; 4] {
    match u {
        9 => [0x4a5a9a, 0xe0a040, 0x9ab8e8, 0x8a3a3a],
        10 => [0x9a9aa8, 0x6a3a9a, 0xa8c0f0, 0x3a7a5a],
        4 => [0xb8a49c, 0x3a6ac0, 0x8ab0e0, 0x8a6a2a],
        3 => [0x6a7080, 0x2a3a5a, 0x94b4e8, 0x2a5a8a],
        2 => [0xf4c8d0, 0x6ab0e0, 0xf0d8f0, 0xb04a8a],
        6 => [0x9a6ad0, 0x222222, 0x9ab8e8, 0x5a5ab0],
        11 => [0xf0e0d8, 0x8a2a6a, 0xd0e0f0, 0xc04a2a],
        _ => [0x8a5ac8, 0xf0f0f0, 0x9ab8e8, 0x2a8ab8],
    }
}

const PILLARS: [[f64; 4]; 7] = [
    [0.06, 0.5, 16.0, 48.0],
    [0.17, 0.2, 9.0, 22.0],
    [0.9, 0.58, 18.0, 54.0],
    [0.8, 0.14, 8.0, 18.0],
    [0.3, 0.82, 7.0, 16.0],
    [0.97, 0.28, 9.0, 26.0],
    [0.66, 0.9, 8.0, 14.0],
];

/// `TOP.erased`, as `topSync` keeps it: the universes cleared this cycle (none outside the multiverse).
fn erased(g: &Game, u: u32) -> bool {
    g.s.multi && LADDER[..(g.s.uni as usize).min(LADDER.len())].iter().any(|l| l.0 == u)
}

/// The baked void (`bakeVoid`): a dithered gradient with nebula.
pub fn bake(w: usize, h: usize) -> Vec<u32> {
    let mut b = vec![0; w * h];
    let k0 = 267.0 / (w.min(h) as f64);
    for y in 0..h {
        for x in 0..w {
            let g = y as f64 / h as f64 + (bayer(x as i32, y as i32) - 0.5) * 0.18;
            let mut c = if g < 0.45 {
                top::BG[0]
            } else if g < 0.8 {
                top::BG[1]
            } else {
                top::BG[2]
            };
            let (xx, yy) = (x as f64 * k0, y as f64 * k0);
            let n = vnoise(xx * 0.018 + 3.0, yy * 0.026) * 0.7 + vnoise(xx * 0.05, yy * 0.07) * 0.35;
            let bb = bayer(x as i32, y as i32) * 0.14;
            if n + bb > 0.78 {
                c = top::NEB[2];
            } else if n + bb > 0.66 {
                c = top::NEB[1];
            } else if n + bb > 0.55 {
                c = top::NEB[0];
            }
            b[y * w + x] = pk(c, 255);
        }
    }
    b
}

fn pillar(c: &mut Ctx, x0: f64, y0: f64, w: f64, h: f64, seed: f64) {
    let far = if w < 10.0 { 0.45 } else { 0.0 };
    let r4: Vec<u32> = top::ROCK.iter().map(|&cc| mixc(cc, top::BG[1], far)).collect();
    let rim = mixc(top::RIM, top::BG[1], far + 0.15);
    let taper = js_round(h * 0.45);
    let mut j = 0.0;
    while j < h + taper {
        let hw = if j < h {
            w / 2.0 * (1.0 + (h2(seed, ((j as i64) >> 2) as f64) - 0.5) * 0.22)
        } else {
            w / 2.0 * (1.0 - (j - h) / taper) * (1.0 + (h2(seed + 3.0, j) - 0.5) * 0.5)
        };
        if hw >= 0.6 {
            let mut i = -hw.ceil();
            while i <= hw.ceil() {
                if i.abs() <= hw && !(j < 2.0 && h2(seed + i * 7.0, j) < 0.35) {
                    let f = i / hw;
                    let edge = i.abs() > hw - 1.0;
                    let mut col = if edge {
                        r4[0]
                    } else if j < 3.0 {
                        rim
                    } else if f < -0.4 {
                        r4[3]
                    } else if f < 0.25 {
                        r4[2]
                    } else {
                        r4[1]
                    };
                    if !edge && j >= 3.0 && j as i64 % 7 == 6 && h2(seed + i, j) > 0.25 {
                        col = r4[1];
                    }
                    c.fb.px(x0 + i, y0 + j, col, 1.0);
                }
                i += 1.0;
            }
        }
        j += 1.0;
    }
}

const STAND: [&str; 16] = [
    "..oooooooooooooooooo..",
    ".owwwwwwwwwwwwwwwwwwo.",
    "owwwwwwwwwwwwwwwwwwwwo",
    "oWWWWWWWWWWWWWWWWWWWWo",
    "obbbbbbbbbbbbbbbbbbbbo",
    "obbbbbbbbbbbbbbbbbbbbo",
    "obbbbbbbbbbbbbbbbbbbbo",
    "obbbbbbbbbbbbbbbbbbbbo",
    "obbbbbbbbbbbbbbbbbbbbo",
    ".oBBBBBBBBBBBBBBBBBBo.",
    "..oorrrrrrrrrrrrrroo..",
    "....orrrrrrrrrrrro....",
    ".....orrrrrrrrrro.....",
    "......orrrRrrrro......",
    "........orrro.........",
    ".........oro..........",
];

/// `topStand`: two gods on a ledge with their universe's banner; erased ones stand empty and faded.
fn stand(c: &mut Ctx, g: &Game, x: f64, y: f64, u: u32) {
    let gd = gods(u);
    let gone = erased(g, u);
    let a = if gone { 0.45 } else { 1.0 };
    let (x, y) = (js_round(x) - 11.0, js_round(y) - 13.0);
    let mut p = |c: &mut Ctx, i: f64, j: f64, col: u32| c.fb.px(x + i, y + j, col, a);
    if !gone {
        let fig = |c: &mut Ctx, p: &mut dyn FnMut(&mut Ctx, f64, f64, u32), fx: f64, skin: u32, cloth: u32, angel: bool| {
            let inside = |ii: i64, jj: i64| jj >= 0 && jj < 9 && ii >= 0 && ii < 5 && !((jj == 0 || jj == 3) && (ii == 0 || ii == 4)) && !(jj == 8 && ii == 2);
            for j in 0..9i64 {
                for i in -1..=5i64 {
                    if inside(i, j) {
                        let col = if j < 4 {
                            if angel && j == 0 {
                                0xffffff
                            } else {
                                skin
                            }
                        } else if angel && j == 4 {
                            0x7ae0f4
                        } else {
                            cloth
                        };
                        p(c, fx + i as f64, j as f64, col);
                    } else if inside(i - 1, j) || inside(i + 1, j) || inside(i, j - 1) || inside(i, j + 1) {
                        p(c, fx + i as f64, j as f64, 0x0c0a14);
                    }
                }
            }
            p(c, fx + 1.0, 2.0, 0x0c0a14);
            p(c, fx + 3.0, 2.0, 0x0c0a14);
        };
        fig(c, &mut p, 4.0, gd[0], gd[1], false);
        fig(c, &mut p, 13.0, gd[2], 0x2a2a5a, true);
    }
    let ban = if gone { 0x2a2a34 } else { gd[3] };
    let pal = |ch: u8| match ch {
        b'o' => 0x0c0a14,
        b'w' => {
            if gone {
                0x9a98a8
            } else {
                0xf2f2f8
            }
        }
        b'W' => {
            if gone {
                0x6a687a
            } else {
                0xb8b6c8
            }
        }
        b'b' => ban,
        b'B' => mixc(ban, 0, 0.45),
        b'r' => top::ROCK[2],
        _ => top::ROCK[3],
    };
    for (j, row) in STAND.iter().enumerate() {
        for (i, ch) in row.bytes().enumerate() {
            if ch != b'.' {
                let col = if gone && ch != b'o' && h2(x + i as f64, j as f64) > 0.9 { 0x0c0a14 } else { pal(ch) };
                p(c, i as f64, 9.0 + j as f64, col);
            }
        }
    }
    let s = u.to_string();
    let tw = text_width(&s) as i64;
    text(c.fb, &s, x + 11.0 - (tw >> 1) as f64, 9.0 + 4.0 + y, if gone { 0x5a5868 } else { 0xffffff }, a);
}

/// `topPlaces`: zeno's box over the planet, the stands in an arc round it.
fn places(c: &Ctx, t: f64) -> ((f64, f64), Vec<(f64, f64, u32)>) {
    let port = c.w / c.h < 0.8;
    let bob = |i: f64| js_round(sin(t * 0.8 + i * 1.7) * 1.5);
    let (r, cx, cy) = (c.r, c.cx, c.cy);
    let rx = if port { (1.3 * r).min(c.w / 2.0 - 12.0) } else { 1.62 * r };
    let ry = if port { 1.55 * r } else { 1.22 * r };
    let bx = (cx, cy - r + if port { -r * 0.98 } else { 2.0 } + bob(9.0));
    let stands = UNI
        .iter()
        .enumerate()
        .map(|(i, &u)| {
            let a = (125.0 + i as f64 * 41.4) * std::f64::consts::PI / 180.0;
            (cx + planet_core::jsmath::cos(a) * rx, cy - sin(a) * ry + bob(i as f64), u)
        })
        .collect();
    (bx, stands)
}

fn bx(c: &mut Ctx, x: f64, y: f64) {
    let (x, y) = (js_round(x) - 32.0, js_round(y) - 36.0);
    blit(c.fb, sprite::get("TOP_SPR.boxB"), x, y, false);
    blit(c.fb, sprite::get("ZENO"), x + 7.0, y + 3.0, false);
    blit(c.fb, sprite::get("ZENO"), x + 33.0, y + 3.0, true);
    blit(c.fb, sprite::get("TOP_SPR.boxF"), x, y, false);
    blit(c.fb, sprite::get("TOP_SPR.plate"), x + 63.0, y + 32.0, false);
    blit(c.fb, sprite::get("TOP_SPR.priest"), x + 66.0, y + 2.0, false);
}

/// `drawVoid(t)`: the backdrop, the pillars, the stands and the box (all behind the planet in this layout).
pub fn draw_void(c: &mut Ctx, g: &Game, bake: &mut Option<(usize, usize, Vec<u32>)>, bare: bool) {
    let t = c.t;
    let (w, h) = (c.fb.w, c.fb.h);
    if bake.as_ref().is_none_or(|b| b.0 != w || b.1 != h) {
        *bake = Some((w, h, self::bake(w, h)));
    }
    if !bare {
        c.fb.buf.copy_from_slice(&bake.as_ref().unwrap().2);
        for k in 0..140 {
            let kf = k as f64;
            let x = (hash(kf * 3.1 + 1.0) * c.w).floor();
            let y = (hash(kf * 7.7 + 2.0) * c.h).floor();
            let big = hash(kf * 1.3) > 0.9;
            let tw = 0.35 + 0.65 * 0f64.max(sin(t * (0.6 + hash(kf) * 2.0) + kf));
            c.fb.px(x, y, top::STAR[k % 2], tw * if big { 1.0 } else { 0.55 });
            if big && tw > 0.75 {
                for (a, b) in [(-1.0, 0.0), (1.0, 0.0), (0.0, -1.0), (0.0, 1.0)] {
                    c.fb.px(x + a, y + b, top::STAR[1], 0.45);
                }
            }
        }
    }
    let k0 = c.w.min(c.h) / 267.0;
    for (i, [fx, fy, pw, ph]) in PILLARS.into_iter().enumerate() {
        let i = i as f64;
        pillar(c, js_round(c.w * fx), js_round(c.h * fy - ph * k0 / 2.0 + sin(t * 0.4 + i * 2.0) * 1.5), js_round(pw * k0), js_round(ph * k0), i * 31.0 + 7.0);
    }
    let (b, stands) = places(c, t);
    for (x, y, u) in stands {
        stand(c, g, x, y, u);
    }
    bx(c, b.0, b.1);
}
