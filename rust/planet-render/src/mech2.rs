//! Boss mechanics, wave 2 (planet-core's `mech2`): the Ginyu Force in their signature poses under warm spotlights, the
//! body change as two souls crossing and each body wearing the other's ghost; Broly in a green flame aura that grows
//! with his rage (his raging sprite from halfway, a rage gauge under his hp bar); Metal Cooler in steel, his clones
//! see-through and glitching, the real one solid with a crisp white edge. Shapes and colour only: words go in the
//! toasts. Reduced motion drops the flicker, the jitter, the sparks and the souls' flight.

use std::sync::OnceLock;

use planet_core::jsmath::{cos, sin};
use planet_core::mech2::{spotlit, GPh, Metal, G_TELL, R_FORM, R_GROW};
use planet_core::num::js_round;
use planet_core::sprite::{shape_sprite, Grid, Pal, Sprite};
use planet_core::timeline::{Boss, Ginyu};
use planet_core::Game;

use crate::scene::{text, text_width, Ctx};
use crate::{bayer, h2};

type Pts = Vec<[f64; 2]>;

fn mir(w: f64, p: &[[f64; 2]]) -> Pts {
    p.iter().map(|&[x, y]| [w - x, y]).collect()
}

fn sym(w: f64, half: &[[f64; 2]]) -> Pts {
    let mut v = half.to_vec();
    v.extend(mir(w, half).into_iter().rev());
    v
}

fn oline(g: &mut Grid, p: &[[f64; 2]], w0: f64, w1: f64, c: char) {
    g.line(p, w0 + 2.0, w1 + 2.0, 'o');
    g.line(p, w0, w1, c);
}

const BRO_WILD: [[f64; 2]; 14] = [
    [15.0, 0.2],
    [17.0, 3.0],
    [19.6, -0.2],
    [20.2, 3.4],
    [24.4, 1.0],
    [22.8, 5.2],
    [28.6, 4.4],
    [24.8, 8.0],
    [29.6, 10.0],
    [25.0, 11.0],
    [28.4, 15.2],
    [23.0, 13.4],
    [20.5, 15.0],
    [18.0, 13.0],
];
const BRO_TALL: [[f64; 2]; 14] = [
    [15.0, -0.4],
    [16.8, 3.0],
    [18.8, -0.4],
    [19.8, 3.4],
    [23.4, 0.6],
    [22.6, 4.6],
    [28.0, 2.6],
    [25.0, 7.2],
    [29.6, 7.6],
    [25.6, 10.4],
    [29.4, 13.2],
    [23.6, 12.8],
    [21.0, 15.0],
    [18.0, 13.0],
];

/// game.js's `broly({ pose, mane, mouth })`, for the guard pose he arrives in and the flexing, roaring rage form
/// (which game.js draws but never uses).
pub fn broly(rage: bool) -> Sprite {
    let w = 30.0;
    let pal = Pal::new(&[
        ('o', 0x141008),
        ('h', 0xc8e040),
        ('H', 0x8aa424),
        ('j', 0xf2ff9c),
        ('s', 0xeab486),
        ('S', 0xb87c58),
        ('k', 0x1a120c),
        ('w', 0xffffff),
        ('g', 0xf2c43a),
        ('G', 0xa8801a),
        ('r', 0xff2a3a),
        ('e', 0xc8202c),
        ('E', 0x861420),
        ('p', 0xf6f4ee),
        ('P', 0xc4c2c8),
        ('d', 0x3a2a1c),
        ('D', 0x241810),
    ]);
    let sh = [('h', 'H'), ('g', 'G'), ('e', 'E'), ('p', 'P'), ('s', 'S'), ('d', 'D')];
    shape_sprite(
        30,
        38,
        |g| {
            g.poly(&sym(w, if rage { &BRO_WILD } else { &BRO_TALL }), 'h');
            for p in [[[19.5, 1.5], [18.6, 5.5]], [[23.0, 2.4], [20.6, 7.0]], [[26.4, 5.0], [22.4, 9.0]], [[27.6, 9.6], [23.4, 11.0]]] {
                g.line(&p, 1.0, 1.0, 'j');
                g.line(&mir(w, &p), 1.0, 1.0, 'j');
            }
            g.poly(&[[8.0, 26.0], [22.0, 26.0], [26.0, 33.6], [19.4, 34.6], [15.0, 30.5], [10.6, 34.6], [4.0, 33.6]], 'p');
            g.line(&[[15.0, 28.0], [15.0, 31.0]], 1.0, 1.0, 'P');
            g.line(&[[9.0, 28.0], [7.6, 33.0]], 1.0, 1.0, 'P');
            g.line(&[[21.0, 28.0], [22.4, 33.0]], 1.0, 1.0, 'P');
            for x in [6.0, 19.0] {
                g.rect(x as i64, 34, 5, 1, 'g');
                g.poly(&[[x + 0.4, 35.0], [x + 4.6, 35.0], [x + 4.0, 37.2], [x + 1.0, 37.2]], 'd');
            }
            g.poly(&[[11.0, 12.0], [19.0, 12.0], [26.0, 15.4], [24.6, 20.0], [21.6, 26.0], [8.4, 26.0], [5.4, 20.0], [4.0, 15.4]], 's');
            g.ell(5.6, 17.4, 3.6, 3.2, 's');
            g.ell(24.4, 17.4, 3.6, 3.2, 's');
            g.line(&[[7.8, 15.8], [8.4, 19.6]], 1.0, 1.0, 'S');
            g.line(&[[22.2, 15.8], [21.6, 19.6]], 1.0, 1.0, 'S');
            g.line(&[[8.6, 20.4], [11.0, 21.4], [14.0, 20.6]], 1.0, 1.0, 'S');
            g.line(&[[21.4, 20.4], [19.0, 21.4], [16.0, 20.6]], 1.0, 1.0, 'S');
            g.line(&[[15.0, 17.6], [15.0, 25.0]], 1.0, 1.0, 'S');
            for y in [22, 24] {
                g.set(12, y, 'S');
                g.set(17, y, 'S');
            }
            g.line(&[[10.0, 14.4], [15.0, 17.4], [20.0, 14.4]], 1.6, 1.6, 'g');
            g.set(15, 17, 'r');
            g.set(12, 15, 'G');
            g.set(18, 15, 'G');
            g.rect(8, 25, 14, 2, 'g');
            g.rect(14, 25, 2, 2, 'r');
            g.poly(&[[17.0, 26.5], [21.0, 26.5], [21.6, 31.0], [19.2, 30.0], [18.0, 31.4]], 'e');
            if rage {
                for m in [false, true] {
                    let f = |p: &[[f64; 2]]| if m { mir(w, p) } else { p.to_vec() };
                    oline(g, &f(&[[23.6, 17.0], [27.0, 16.4]]), 4.4, 4.0, 's');
                    oline(g, &f(&[[27.0, 17.0], [27.0, 10.6]]), 4.0, 3.6, 's');
                    let [x, y] = f(&[[27.0, 9.6]])[0];
                    g.ell(x, y, 2.1, 2.0, 's');
                    let [x, y] = f(&[[25.4, 13.0]])[0];
                    g.rect(js_round(x) as i64, js_round(y) as i64, 3, 1, 'g');
                    g.line(&f(&[[25.4, 15.4], [25.4, 17.6]]), 1.0, 1.0, 'g');
                    g.line(&f(&[[26.0, 13.4], [28.0, 13.4]]), 1.0, 1.0, 'S');
                }
            } else {
                let a = [[5.0, 18.0], [6.0, 23.0], [11.0, 23.0]];
                for (p, fx) in [(a.to_vec(), 11.6), (mir(w, &a), 18.4)] {
                    oline(g, &p, 4.6, 4.0, 's');
                    g.ell(fx, 22.4, 2.3, 2.1, 's');
                }
                g.rect(5, 21, 3, 2, 'g');
                g.rect(22, 21, 3, 2, 'g');
            }
            g.ell(15.0, 9.4, 3.9, 4.4, 's');
            g.poly(&[[10.6, 3.0], [19.4, 3.0], [19.4, 7.4], [18.2, 6.4], [17.0, 7.6], [15.6, 6.0], [14.4, 7.6], [13.0, 6.0], [11.8, 7.6], [10.6, 7.2]], 'h');
            g.rect(11, 7, 8, 1, 'g');
            g.rect(14, 7, 2, 1, 'r');
            for x in [12, 13, 16, 17, 11, 18] {
                g.set(x, 8, 'k');
            }
            g.rect(12, 9, 2, 1, 'w');
            g.rect(16, 9, 2, 1, 'w');
            g.set(14, 9, 'S');
            g.set(15, 9, 'S');
            if rage {
                g.rect(13, 11, 4, 2, 'k');
                g.rect(13, 11, 4, 1, 'w');
            } else {
                g.rect(13, 11, 4, 1, 'w');
                g.set(12, 11, 'k');
                g.set(17, 11, 'k');
                g.rect(13, 12, 4, 1, 'k');
            }
        },
        &pal,
        &sh,
    )
}

pub fn broly_rage() -> &'static Sprite {
    static S: OnceLock<Sprite> = OnceLock::new();
    S.get_or_init(|| broly(true))
}

/// Each member's signature pose: left arm, right arm, left leg, right leg, in his own 16×22 coordinates.
const G_POSES: [[&[[f64; 2]]; 4]; 5] = [
    // ginyu: the full special pose
    [
        &[[3.5, 10.5], [0.0, 7.0], [-1.5, 1.5]],
        &[[12.5, 10.5], [15.5, 8.0], [12.5, 4.5]],
        &[[6.0, 16.0], [2.5, 17.5], [4.0, 21.0]],
        &[[10.0, 16.0], [10.5, 21.0]],
    ],
    // jeice: thrown out on a diagonal
    [&[[3.5, 10.5], [-0.5, 7.5], [-3.5, 5.0]], &[[12.5, 10.5], [16.0, 13.0], [18.5, 15.5]], &[[6.0, 16.0], [4.0, 21.0]], &[[10.0, 16.0], [12.5, 21.0]]],
    // burter: arms wide
    [&[[3.5, 10.5], [-0.5, 10.0], [-3.5, 9.0]], &[[12.5, 10.5], [16.5, 10.0], [19.5, 9.0]], &[[6.0, 16.0], [3.5, 21.0]], &[[10.0, 16.0], [12.5, 21.0]]],
    // recoome: arms up, a squat
    [
        &[[3.5, 10.5], [1.0, 6.5], [0.5, 1.5]],
        &[[12.5, 10.5], [15.0, 6.5], [15.5, 1.5]],
        &[[6.0, 16.0], [2.5, 19.0], [2.5, 21.0]],
        &[[10.0, 16.0], [13.5, 19.0], [13.5, 21.0]],
    ],
    // guldo: a ring over his head
    [&[[3.5, 10.5], [0.5, 6.5], [4.0, 2.5]], &[[12.5, 10.5], [15.5, 6.5], [12.0, 2.5]], &[[6.0, 16.0], [7.0, 21.0]], &[[10.0, 16.0], [9.0, 21.0]]],
];
const G_LOOK: [(u32, u32); 5] = [(0x9a6ad8, 0), (0xe0503a, 0xf6f4ee), (0x4a7ad8, 0), (0xf2c8a2, 0xe8702a), (0x7acb5c, 0)];

/// A member (by `GINYU` index) in his pose: ginyuMember's parts on a 26×25 canvas, the arms and legs moved.
fn ginyu_pose_of(i: usize) -> Sprite {
    let (skin, hair) = G_LOOK[i];
    let p = G_POSES[i];
    let (dx, dy) = (5.0, 3.0);
    let mv = |q: &[[f64; 2]]| q.iter().map(|&[x, y]| [x + dx, y + dy]).collect::<Pts>();
    let pal = Pal::new(&[
        ('o', 0x14101e),
        ('s', skin),
        ('S', skin),
        ('h', hair),
        ('H', hair),
        ('k', 0x1a1a24),
        ('w', 0xf6f4ee),
        ('W', 0xc8c4b8),
        ('y', 0xf2c84a),
        ('Y', 0xb88a1a),
    ]);
    shape_sprite(
        26,
        25,
        |g| {
            let ell = |g: &mut Grid, x: f64, y: f64, a: f64, b: f64, c| g.ell(x + dx, y + dy, a, b, c);
            let rect = |g: &mut Grid, x: i64, y: i64, w: i64, h: i64, c| g.rect(x + dx as i64, y + dy as i64, w, h, c);
            let set = |g: &mut Grid, x: i64, y: i64, c| g.set(x + dx as i64, y + dy as i64, c);
            if i == 1 {
                ell(g, 8.0, 3.5, 4.4, 3.0, 'h');
                rect(g, 3, 4, 2, 6, 'h');
                rect(g, 11, 4, 2, 6, 'h');
            }
            ell(g, 8.0, 5.5, 3.6, 3.6, 's');
            if i == 0 {
                g.line(&mv(&[[5.5, 3.0], [4.0, -1.0]]), 1.4, 1.0, 'k');
                g.line(&mv(&[[10.5, 3.0], [12.0, -1.0]]), 1.4, 1.0, 'k');
            }
            if i == 3 {
                rect(g, 4, 0, 9, 3, 'h');
            }
            set(g, 6, 5, 'k');
            set(g, 10, 5, 'k');
            if i == 4 {
                set(g, 5, 3, 'k');
                set(g, 11, 3, 'k');
            }
            rect(g, 7, 8, 3, 1, 'k');
            for leg in [p[2], p[3]] {
                g.line(&mv(leg), 2.0, 2.0, 'k');
            }
            g.poly(&mv(&[[4.0, 10.0], [12.0, 10.0], [12.0, 16.0], [4.0, 16.0]]), 'w');
            ell(g, 3.5, 10.5, 2.2, 1.6, 'y');
            ell(g, 12.5, 10.5, 2.2, 1.6, 'y');
            for arm in [p[0], p[1]] {
                g.line(&mv(arm), 1.8, 1.6, 'k');
                let [x, y] = arm[arm.len() - 1];
                ell(g, x, y, 1.0, 1.0, 's');
            }
        },
        &pal,
        &[('w', 'W'), ('y', 'Y')],
    )
}

pub fn ginyu_pose(i: usize) -> &'static Sprite {
    static S: OnceLock<Vec<Sprite>> = OnceLock::new();
    &S.get_or_init(|| (0..5).map(ginyu_pose_of).collect())[i]
}

/// Cooler in steel: his colours to a blue-grey ramp; the real one keeps his red eyes, the clones' are dead.
fn steel_of(lit: bool) -> Sprite {
    let mut s = planet_core::sprite::baked().get("MOVIE.cooler").expect("cooler's sprite").clone();
    for c in s.col.iter_mut().filter(|c| **c >= 0) {
        let (r, g, b) = ((*c >> 16) & 255, (*c >> 8) & 255, *c & 255);
        *c = if r > 180 && g < 90 && b < 90 {
            if lit {
                0xff2a1a
            } else {
                0x6a7488
            }
        } else {
            let q = js_round(40.0 + (r as f64 * 0.3 + g as f64 * 0.59 + b as f64 * 0.11) / 255.0 * 200.0) as i32;
            (js_round(q as f64 * 0.86) as i32) << 16 | (js_round(q as f64 * 0.92) as i32) << 8 | 255.min(q + 18)
        };
    }
    s
}

pub fn steel(lit: bool) -> &'static Sprite {
    static S: OnceLock<[Sprite; 2]> = OnceLock::new();
    &S.get_or_init(|| [steel_of(true), steel_of(false)])[if lit { 0 } else { 1 }]
}

/// Broly's size against his rage (the tap box grows with it, as it reads `Boss::k`).
pub fn rage_k(g: &Game) -> f64 {
    g.rage().map_or(1.0, |r| 1.0 + R_GROW * r)
}

/// His sprite: the raging one once he's halfway there.
pub fn rage_sprite(g: &Game) -> Option<&'static Sprite> {
    g.rage().filter(|&r| r >= R_FORM).map(|_| broly_rage())
}

/// The nine spots the metal coolers take round the planet (0 is the usual boss spot), in radii from its centre: two
/// columns a side on a wide card, a column a side plus rows over and under the planet on a square or tall one.
const SLOTS_WIDE: [(f64, f64); 9] =
    [(1.45, -0.75), (-1.45, -0.75), (2.3, -0.75), (-2.3, -0.75), (1.45, 0.4), (-1.45, 0.4), (2.3, 0.4), (-2.3, 0.4), (0.0, 1.4)];
const SLOTS_TALL: [(f64, f64); 9] =
    [(1.45, -0.75), (-1.45, -0.75), (1.45, 0.4), (-1.45, 0.4), (0.0, -1.55), (-0.75, -1.5), (0.75, -1.5), (-0.75, 1.55), (0.75, 1.55)];

/// Where a metal cooler stands in `slot`, kept on the card with his hp bar. `i` staggers the bob.
pub fn slot_spot(c: &Ctx, slot: usize, spr: &Sprite, k: f64, i: f64) -> (f64, f64) {
    let (sx, sy) = if c.w > c.h * 1.6 { SLOTS_WIDE[slot] } else { SLOTS_TALL[slot] };
    let half = ((spr.w as f64 - spr.ax + 1.0) * k).max(10.0 * k + 1.0);
    let x = (c.cx + sx * c.r).min(c.w - half - 3.0).max(half + 3.0);
    let y = (c.cy + sy * c.r).max(spr.h as f64 * k + 10.0).min(c.h - 4.0) + sin(c.t * 2.0 + i) * 3.0;
    (x, y)
}

/// A sprite standing on (x, y), scaled by k and facing left (as bosses face), washed in a colour or not, faded, its
/// rows shifted by `shift`.
#[allow(clippy::too_many_arguments)]
fn blit(c: &mut Ctx, spr: &Sprite, x: f64, y: f64, k: f64, wash: Option<u32>, a: f64, shift: &dyn Fn(usize) -> f64) {
    for j in 0..spr.h {
        let sh = shift(j);
        for i in 0..spr.w {
            let col = spr.col[j * spr.w + (spr.w - 1 - i)];
            if col < 0 {
                continue;
            }
            let mut yy = 0.0;
            while yy < k {
                let mut xx = 0.0;
                while xx < k {
                    c.fb.px(x + (i as f64 - spr.ax) * k + xx + sh, y + (j as f64 - spr.h as f64) * k + yy, wash.unwrap_or(col as u32), a);
                    xx += 1.0;
                }
                yy += 1.0;
            }
        }
    }
}

/// The pixels just outside a sprite's silhouette (facing left), in screen space: `f(x, y, i, j)`.
fn edge(spr: &Sprite, x: f64, y: f64, k: f64, f: &mut dyn FnMut(f64, f64, i64, i64)) {
    let at = |i: i64, j: i64| i >= 0 && j >= 0 && (i as usize) < spr.w && (j as usize) < spr.h && spr.col[j as usize * spr.w + (spr.w - 1 - i as usize)] >= 0;
    for j in -1..=spr.h as i64 {
        for i in -1..=spr.w as i64 {
            if !at(i, j) && (at(i + 1, j) || at(i - 1, j) || at(i, j + 1) || at(i, j - 1)) {
                f(x + (i as f64 - spr.ax) * k, y + (j as f64 - spr.h as f64) * k, i, j);
            }
        }
    }
}

fn disc(c: &mut Ctx, x: f64, y: f64, r: f64, col: u32, a: f64) {
    let r = r.round();
    let mut yy = -r;
    while yy <= r {
        let mut xx = -r;
        while xx <= r {
            if xx * xx + yy * yy <= r * r {
                c.fb.px(x + xx, y + yy, col, a);
            }
            xx += 1.0;
        }
        yy += 1.0;
    }
}

/// A small bar: its left edge, width, the row, the share filled, and its colours.
fn gauge(c: &mut Ctx, bx: f64, bw: f64, by: f64, f: f64, fill: u32, empty: u32, rim: u32) {
    let mut x = -1.0;
    while x <= bw {
        for y in -1..=1 {
            let col = if x < 0.0 || x == bw || y != 0 {
                rim
            } else if x < bw * f {
                fill
            } else {
                empty
            };
            c.fb.px(bx + x, by + y as f64, col, 1.0);
        }
        x += 1.0;
    }
}

/// Spotlights on the posing ginyu force, before the members: a warm cone from the top of the card onto each, the
/// one posing brighter, with a pool of light at his feet.
pub fn spotlights(c: &mut Ctx, gi: &Ginyu, bare: bool) {
    if gi.done != 0.0 || !gi.mech.as_ref().is_some_and(|m| m.ph == GPh::Pose) {
        return;
    }
    let e = c.t - gi.t0;
    let who = spotlit(e);
    let hold = who.is_none() && e >= 1.2;
    for mb in gi.members.iter().filter(|m| !m.dead) {
        let on = who == Some(mb.i) || hold;
        let (w0, w1) = if on { (4.0, 17.0) } else { (3.0, 11.0) };
        let (w0, w1) = (w0 * mb.k, w1 * mb.k);
        let (col, a, th) = if on { (0xffe066, 0.6, 0.85) } else { (0xfff2c0, 0.3, 0.55) };
        let a = if bare { a * 0.6 } else { a };
        let foot = mb.y + 2.0;
        let mut y = 0.0;
        while y < foot {
            let w = w0 + (w1 - w0) * y / foot;
            let mut x = -w;
            while x <= w {
                if bayer(js_round(mb.x + x) as i32, y as i32) < th {
                    c.fb.px(mb.x + x, y, col, a);
                }
                x += 1.0;
            }
            y += 1.0;
        }
        let mut x = -w1;
        while x <= w1 {
            for yy in -3..=3 {
                let yy = yy as f64;
                if x * x / (w1 * w1) + yy * yy / 9.0 <= 1.0 {
                    c.fb.px(mb.x + x, foot + yy, col, if on { 0.7 } else { 0.4 });
                }
            }
            x += 1.0;
        }
    }
}

/// The sprite a ginyu member stands in, and whether he holds still (no flipping): his pose, or ginyu himself while
/// he's taking or has your body.
pub fn member_look(gi: &Ginyu, i: usize) -> Option<(&'static Sprite, bool)> {
    let m = gi.mech.as_ref().filter(|_| gi.done == 0.0)?;
    match m.ph {
        GPh::Pose => Some((ginyu_pose(i), true)),
        GPh::Tell | GPh::Swap if i == 0 => Some((ginyu_pose(0), true)),
        _ => None,
    }
}

/// Metal Cooler's clones, drawn and placed (planet-core reads their spots for taps and beams): see-through, their
/// rows jittering now and then, each with an hp bar of its own. No names: the real one goes unnamed too.
pub fn draw_clones(c: &mut Ctx, m: &mut Metal, k: f64, dt: f64, calm: bool) {
    let t = c.t;
    let spr = steel(false);
    let slots = m.clone_slots();
    for (i, cl) in m.clones.iter_mut().enumerate() {
        cl.flash = 0f64.max(cl.flash - dt);
        let Some(s) = slots[i] else {
            cl.x = None;
            continue;
        };
        cl.k = k;
        let (x, y) = slot_spot(c, s, spr, k, i as f64 + 1.0);
        (cl.x, cl.y) = (Some(x), y);
        let ent = 1f64.min((t - cl.t0) / planet_core::mech2::M_FADE);
        let fi = i as f64;
        let jit = move |j: usize| {
            if calm || (t * 9.0 + j as f64 * 0.7 + fi * 3.0).floor() as i64 % 7 != 0 {
                0.0
            } else if j % 2 == 1 {
                2.0
            } else {
                -2.0
            }
        };
        blit(c, spr, x, y, k, (cl.flash > 0.0).then_some(0xffffff), 0.72 * ent, &jit);
        hp_bar(c, x, y, spr, k, (cl.hp / cl.max).to_f64(), ent);
    }
}

/// The boss's hp bar, as draw_boss draws it, at (x, y).
fn hp_bar(c: &mut Ctx, x: f64, y: f64, spr: &Sprite, k: f64, f: f64, a: f64) {
    if a < 1.0 {
        return;
    }
    let bw = js_round(20.0 * k);
    let bx = js_round(x - bw / 2.0);
    let by = js_round(y - spr.h as f64 * k - 7.0);
    let f = 0f64.max(f);
    let mut xx = -1.0;
    while xx <= bw {
        for yy in -1..=2 {
            let yy = yy as f64;
            let col = if xx < 0.0 || xx == bw || yy < 0.0 || yy == 2.0 {
                0x1d1030
            } else if xx < bw * f {
                if f > 0.3 {
                    0x34d873
                } else {
                    0xe0473e
                }
            } else {
                0xffffff
            };
            c.fb.px(bx + xx, by + yy, col, 1.0);
        }
        xx += 1.0;
    }
}

/// Before the flash, after wave 1's: Broly's flame and gauge, the real Metal Cooler's edge, and the ginyu force's
/// rude crits, the glow before the body change, and the change itself.
pub fn draw(c: &mut Ctx, g: &mut Game) {
    let t = c.t;
    let calm = g.calm;
    if let Some(b) = g.tl.boss.clone().filter(|b| !b.dead) {
        if let Some(r) = g.rage() {
            if let Some(spr) = crate::visitors::boss_sprite(g, &b) {
                flame(c, &b, spr, r, calm);
            }
        }
        if g.tl.movie.as_ref().is_some_and(|m| m.metal.is_some()) && t - b.t0 > 1.2 {
            let spr = steel(true);
            edge(spr, b.x, b.y, b.k, &mut |x, y, _, _| c.fb.px(x, y, 0xffffff, 0.95));
        }
    }
    if let Some(gi) = g.tl.ginyu.clone().filter(|gi| gi.done == 0.0) {
        if let Some(m) = gi.mech.clone() {
            ginyu_fx(c, g, &gi, &m, calm);
        }
    }
}

fn flame(c: &mut Ctx, b: &Boss, spr: &Sprite, r: f64, calm: bool) {
    let t = c.t;
    let k = b.k;
    for pass in 0..2 {
        edge(spr, b.x, b.y, k, &mut |x, y, i, j| {
            let fl = if calm { 0.75 } else { 0.55 + 0.45 * sin(t * 13.0 + i as f64 * 1.3 + j as f64 * 0.7) };
            let h = (4.0 + r * 16.0) * fl * if pass == 1 { 0.5 } else { 1.0 };
            let w = if pass == 1 { 1.0 } else { 2.0 };
            let mut d = 0.0;
            while d < h {
                let yy = y - d;
                let a = 1.0 - d / h;
                let sx = x + if calm { 0.0 } else { sin(d * 0.5 + t * 9.0 + i as f64) * 1.2 } + (x - b.x) * d * 0.02;
                let mut o = -w;
                while o <= w {
                    if bayer(js_round(sx + o) as i32, js_round(yy) as i32) < a {
                        let col = if pass == 1 {
                            0xf0ffd0
                        } else if d < h * 0.3 {
                            0xb8ff7a
                        } else if d < h * 0.7 {
                            0x5ae04a
                        } else {
                            0x2a9a3a
                        };
                        c.fb.px(sx + o, yy, col, if pass == 1 { 0.9 } else { 0.85 });
                    }
                    o += 1.0;
                }
                d += 1.0;
            }
        });
    }
    // he's drawn again over his own flame
    blit(c, spr, b.x, b.y, k, (b.flash > 0.0).then_some(0xffffff), 1.0, &|_| 0.0);
    if !calm {
        let n = 3 + js_round(r * 5.0) as i64;
        for s in 0..n {
            let u = t * 1.2 + s as f64 * 0.37;
            let ph = u % 1.0;
            let x = b.x + (h2(s as f64, u.floor()) - 0.5) * spr.w as f64 * k;
            let y = b.y - spr.h as f64 * k * (0.2 + ph * 0.9);
            c.fb.px(x, y, 0xffffff, 1.0 - ph);
            c.fb.px(x, y + 1.0, 0xb8ff7a, 1.0 - ph);
        }
    }
    // his hp bar and name again over the flame, and the rage gauge under the bar
    hp_bar(c, b.x, b.y, spr, k, (b.hp / b.max).to_f64(), 1.0);
    let nm = b.name.to_uppercase();
    let (nx, ny) = (js_round(b.x - text_width(&nm) / 2.0), js_round(b.y - spr.h as f64 * k - 7.0) - 8.0);
    for (ox, oy) in [(-1.0, 0.0), (1.0, 0.0), (0.0, -1.0), (0.0, 1.0)] {
        text(c.fb, &nm, nx + ox, ny + oy, 0xffffff, 1.0);
    }
    text(c.fb, &nm, nx, ny, 0x1d1030, 1.0);
    let bw = js_round(20.0 * k);
    let bx = js_round(b.x - bw / 2.0);
    let by = js_round(b.y - spr.h as f64 * k - 7.0) + 4.0;
    let fill = if !calm && r > 0.8 && (t * 10.0).floor() as i64 % 2 == 1 { 0xffffff } else { 0xc8f03a };
    gauge(c, bx, bw, by, r, fill, 0x2a3a2e, 0x10301a);
}

fn ginyu_fx(c: &mut Ctx, g: &Game, gi: &Ginyu, m: &planet_core::mech2::GinyuMech, calm: bool) {
    let t = c.t;
    // a rude crit: gold spikes off the member
    let (rt, ri) = m.rude;
    let q = (t - rt) / 0.5;
    if (0.0..1.0).contains(&q) {
        let mb = &gi.members[ri];
        let (x, y) = (mb.x, mb.y - 14.0 * mb.k);
        for s in 0..8 {
            let a = s as f64 * 0.785;
            let r0 = 3.0 + q * 10.0;
            let mut d = r0;
            while d < r0 + 5.0 {
                c.fb.px(x + cos(a) * d, y + sin(a) * d, if s % 2 == 1 { 0xffe066 } else { 0xffffff }, 1.0 - q * 0.5);
                d += 1.0;
            }
        }
    }
    let gm = &gi.members[0];
    if gm.dead {
        return;
    }
    let gs = ginyu_pose(0);
    let (gx, gy) = (gm.x, gm.y - gs.h as f64 / 2.0 * gm.k);
    match m.ph {
        GPh::Tell => {
            let p = if calm { 0.7 } else { ((t - m.p0) / G_TELL).min(1.0) };
            edge(gs, gm.x, gm.y, gm.k, &mut |x, y, _, _| {
                if bayer(js_round(x) as i32, js_round(y) as i32) < p {
                    c.fb.px(x, y, 0xfff6c0, 1.0);
                }
            });
        }
        GPh::Swap => {
            let kd = g.kid_screen(12.0);
            let age = t - m.p0;
            let q = if calm { 1.0 } else { (age / 1.4).min(1.0) };
            if q < 1.0 {
                // two souls crossing on an arc: yours up into his body, his down into yours
                let (mx, my) = ((gx + kd.x) / 2.0, gy.min(kd.y) - 26.0);
                let p = |u: f64, up: bool| {
                    let v = 1.0 - u;
                    let (a0, a1) = if up { ((kd.x, kd.y), (gx, gy)) } else { ((gx, gy), (kd.x, kd.y)) };
                    let my = my + if up { 0.0 } else { 30.0 };
                    (v * v * a0.0 + 2.0 * v * u * mx + u * u * a1.0, v * v * a0.1 + 2.0 * v * u * my + u * u * a1.1)
                };
                for (up, col) in [(true, 0xbfe9ff), (false, 0xc8a0ff)] {
                    for s in 0..10 {
                        let (x, y) = p(0f64.max(q - s as f64 * 0.03), up);
                        disc(c, x, y, 1f64.max(3.0 - s as f64 * 0.3), col, 1.0 - s as f64 * 0.08);
                    }
                    let (x, y) = p(q, up);
                    disc(c, x, y, 3.0, 0xffffff, 1.0);
                }
            }
            if q >= 1.0 || age > 1.0 {
                // and each body wears the other's ghost
                let ga = if calm { 0.42 } else { 0.35 + 0.15 * sin(t * 6.0) };
                let kd0 = g.kid_screen(0.0);
                blit(c, gs, kd0.x + 1.0, kd0.y - 1.0, 1.0, Some(0xc8a0ff), ga, &|_| 0.0);
                let hero = planet_core::sprite::hero(crate::scene::hero_id(g));
                let look = g.forms[g.s.form].look;
                let hs = &hero.forms[look.min(hero.forms.len() - 1)].pose;
                blit(c, hs, gm.x, gm.y, gm.k, Some(0xbfe9ff), ga, &|_| 0.0);
            }
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn the_broly_port_draws_game_js_broly() {
        let baked = planet_core::sprite::baked().get("VILLAINS.6.spr").expect("broly");
        assert_eq!(&super::broly(false), baked, "broly({{ pose: 'guard', mane: 'tall' }})");
        let r = super::broly_rage();
        assert_eq!((r.w, r.h), (baked.w, baked.h), "the rage form keeps his canvas, so his tap box holds");
    }
}
