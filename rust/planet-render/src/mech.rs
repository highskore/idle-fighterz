//! The boss mechanics (planet-core's `mech`), drawn over the fight: Frieza's pink death-beam laser with a pulsing ring
//! and a timer bar on your fighter; Cell's segmented tail with yellow ki running up it, the ally dangling under him and
//! his hp bar refilling with a small "+4"; Kid Buu's pink regen outline, steam and a pink hp bar notched at 25%; Hit's
//! violet time skip with a clock face and an afterimage; Jiren's red aura, weak beams coming back red and a charge
//! gauge. Shapes and colour only: words go in the toasts, and the "+4" is a gain-float-sized number. Reduced motion
//! drops the pulsing, flicker and wobble.

use planet_core::jsmath::{cos, hypot, sin};
use planet_core::mech::{Ally, Mech, Ph, B_REFORMS, B_REFORM_T, B_ZONE, C_CAP, C_REACH, F_AIM, H_SKIP, J_BACK, J_FULL};
use planet_core::num::js_round;
use planet_core::sprite::{self, Sprite};
use planet_core::Game;

use crate::scene::{text, Ctx};
use crate::{bayer, h2};

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

fn ring(c: &mut Ctx, x: f64, y: f64, r: f64, col: u32, a: f64, th: u32) {
    let step = 0.6 / r.max(1.0);
    let mut q = 0.0;
    while q < 6.283 {
        for d in 0..th {
            c.fb.px(x + cos(q) * (r + d as f64), y + sin(q) * (r + d as f64), col, a);
        }
        q += step;
    }
}

/// A beam from (x0, y0) to (x1, y1): a white core, `core` and `edge` bands, a dithered `glow` round it.
#[allow(clippy::too_many_arguments)]
fn ray(c: &mut Ctx, x0: f64, y0: f64, x1: f64, y1: f64, w: f64, core: u32, edge: u32, glow: Option<u32>, wob: f64) {
    let l = hypot(&[x1 - x0, y1 - y0]).max(1.0);
    let (dx, dy) = ((x1 - x0) / l, (y1 - y0) / l);
    let t = c.t;
    let mut d = 0.0;
    while d < l {
        let ww = w * (1.0 + sin(d * 0.4 - t * 40.0) * wob);
        let gw = ww + if glow.is_some() { 2.0 } else { 0.0 };
        let mut o = -gw;
        while o <= gw {
            let a = o.abs() / if ww == 0.0 { 1.0 } else { ww };
            let (x, y) = (x0 + dx * d - dy * o, y0 + dy * d + dx * o);
            if a > 1.0 {
                if let Some(gc) = glow {
                    if bayer(js_round(x) as i32, js_round(y) as i32) < 0.5 {
                        c.fb.px(x, y, gc, 0.6);
                    }
                }
            } else {
                c.fb.px(
                    x,
                    y,
                    if a < 0.4 {
                        0xffffff
                    } else if a < 0.75 {
                        core
                    } else {
                        edge
                    },
                    1.0,
                );
            }
            o += 0.6;
        }
        d += 0.6;
    }
}

fn line(c: &mut Ctx, x0: f64, y0: f64, x1: f64, y1: f64, col: u32, a: f64) {
    let n = 1f64.max((hypot(&[x1 - x0, y1 - y0]) * 1.5).ceil());
    let mut i = 0.0;
    while i <= n {
        c.fb.px(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, col, a);
        i += 1.0;
    }
}

/// Dizzy stars round a stunned fighter's head.
fn dizzy(c: &mut Ctx, x: f64, y: f64, t: f64) {
    for i in 0..3 {
        let a = t * 5.0 + i as f64 * 2.09;
        let (sx, sy) = (x + cos(a) * 7.0, y + sin(a) * 2.2);
        c.fb.px(sx, sy, 0xffe066, 1.0);
        for (ox, oy) in [(-1.0, 0.0), (1.0, 0.0), (0.0, -1.0), (0.0, 1.0)] {
            c.fb.px(sx + ox, sy + oy, 0xffc21a, 1.0);
        }
    }
}

/// The boss's sprite pixel at (i, j) as he's drawn (facing left), or none.
fn at(spr: &Sprite, i: i64, j: i64) -> bool {
    i >= 0 && j >= 0 && (i as usize) < spr.w && (j as usize) < spr.h && spr.col[j as usize * spr.w + (spr.w - 1 - i as usize)] >= 0
}

/// A rim round the boss's silhouette, `d` pixels out (in sprite pixels): `col(d, x, y)` picks each pixel's colour.
fn rim(c: &mut Ctx, spr: &Sprite, bx: f64, by: f64, k: f64, dmax: u32, col: &mut dyn FnMut(u32, f64, f64) -> Option<u32>) {
    for j in 0..spr.h as i64 {
        for i in 0..spr.w as i64 {
            if !at(spr, i, j) {
                continue;
            }
            for (a, b) in [(1, 0), (-1, 0), (0, 1), (0, -1)] {
                if at(spr, i + a, j + b) {
                    continue;
                }
                for d in 1..=dmax {
                    let x = bx + (i as f64 - spr.ax + (a * d as i64) as f64) * k;
                    let y = by + (j as f64 - spr.h as f64 + (b * d as i64) as f64) * k;
                    if let Some(cc) = col(d, x, y) {
                        c.fb.px(x, y, cc, 1.0);
                    }
                }
            }
        }
    }
}

/// The boss's sprite again at (bx, by), in colour or washed in one.
fn redraw(c: &mut Ctx, spr: &Sprite, bx: f64, by: f64, k: f64, wash: Option<u32>, a: f64) {
    for j in 0..spr.h {
        for i in 0..spr.w {
            let col = spr.col[j * spr.w + (spr.w - 1 - i)];
            if col < 0 {
                continue;
            }
            let mut yy = 0.0;
            while yy < k {
                let mut xx = 0.0;
                while xx < k {
                    c.fb.px(bx + (i as f64 - spr.ax) * k + xx, by + (j as f64 - spr.h as f64) * k + yy, wash.unwrap_or(col as u32), a);
                    xx += 1.0;
                }
                yy += 1.0;
            }
        }
    }
}

/// The small number in the gain floats' look (3×5, a white outline).
fn tick(c: &mut Ctx, s: &str, x: f64, y: f64, col: u32) {
    let x0 = js_round(x - crate::scene::text_width(s) / 2.0);
    let y0 = js_round(y);
    for (ox, oy) in [(-1.0, 0.0), (1.0, 0.0), (0.0, -1.0), (0.0, 1.0)] {
        text(c.fb, s, x0 + ox, y0 + oy, 0xffffff, 1.0);
    }
    text(c.fb, s, x0, y0, col, 1.0);
}

/// The hp bar draw_boss draws: its left edge, width and top.
fn bar(b: &planet_core::timeline::Boss, spr: &Sprite) -> (f64, f64, f64) {
    let bw = js_round(20.0 * b.k);
    (js_round(b.x - bw / 2.0), bw, js_round(b.y - spr.h as f64 * b.k - 7.0))
}

fn ally_sprite(a: Ally, t: f64) -> (&'static Sprite, f64) {
    match a {
        Ally::Bubbles => (sprite::get(if (t * 14.0).floor() as i64 % 2 == 0 { "MONKEY.0" } else { "MONKEY.1" }), 1.7),
        Ally::Piccolo => (sprite::get("PICCOLO"), 0.95),
        Ally::Krillin => (sprite::get("KRILLIN"), 1.0),
    }
}

/// Whether Cell has lifted this ally off the planet (planet-render then doesn't draw him on the road).
pub fn held(g: &Game, a: Ally) -> bool {
    matches!(g.tl.boss.as_ref().and_then(|b| b.mech.as_ref()), Some(Mech::Cell { ph: Ph::Drain, who, .. }) if *who == a)
}

/// The charge's aim line against a boss with a charge to beat: grey until it's enough, then gold (Jiren); red once
/// it's a finishing blow (Kid Buu, low).
pub fn aim_col(g: &Game, ch: f64) -> Option<u32> {
    match g.tl.boss.as_ref().filter(|b| !b.dead).and_then(|b| b.mech.as_ref()) {
        Some(Mech::Jiren { .. }) => Some(if ch >= J_FULL { 0xffc21a } else { 0x9a9aa8 }),
        Some(Mech::Buu { zone: true, reforms, .. }) if *reforms < B_REFORMS && ch >= planet_core::mech::B_BIG => Some(0xe0302a),
        _ => None,
    }
}

/// A hero spot the drawing reuses: (x, y) of his middle.
fn hero(g: &Game) -> (f64, f64) {
    let k = g.kid_screen(10.0);
    (k.x, k.y)
}

/// The tail's curve from his back to `to`, at `q` (0 to 1).
fn tail_at(from: (f64, f64), to: (f64, f64), lift: f64, k: f64, q: f64) -> (f64, f64) {
    let (ax, ay) = from;
    let (bx, by) = (to.0, to.1 - 4.0);
    let mx = ax.max(bx) + 30.0 * k * lift + (1.0 - lift) * ((ax + bx) / 2.0 - ax.max(bx) + 10.0);
    let my = if lift > 0.0 { (ay + by) / 2.0 } else { ay.max(by) + 24.0 };
    let u = 1.0 - q;
    (u * u * ax + 2.0 * u * q * mx + q * q * bx, u * u * ay + 2.0 * u * q * my + q * q * by)
}

/// Before the flash: everything the mechanics draw.
pub fn draw(c: &mut Ctx, g: &mut Game) {
    let t = c.t;
    let calm = g.calm;
    let Some(b) = g.tl.boss.clone().filter(|b| !b.dead) else { return };
    let Some(spr) = crate::visitors::boss_sprite(g, &b) else { return };
    let k = b.k;
    let mid = (b.x, b.y - spr.h as f64 / 2.0 * k);
    let (hx, hy) = hero(g);
    match b.mech.clone() {
        Some(Mech::Frieza { ph, p0, deflected, .. }) => {
            let (fx0, fy0) = (b.x - 9.0 * k, b.y - 25.0 * k);
            if ph == Ph::Aim {
                let q = ((t - p0) / F_AIM).clamp(0.0, 1.0);
                let glow = 1.0 + q * 2.5;
                ray(c, fx0, fy0, hx, hy, 1.1, 0xffc0ec, 0xd84aa8, Some(0xff8ad0), if calm { 0.0 } else { 0.3 });
                disc(c, fx0, fy0, glow + 1.0, 0xd84aa8, 1.0);
                disc(c, fx0, fy0, glow, 0xffc0ec, 1.0);
                c.fb.px(fx0, fy0, 0xffffff, 1.0);
                let pr = 11.0 + if calm { 0.0 } else { sin(t * 12.0) * 1.5 };
                ring(c, hx, hy, pr, 0xffffff, 1.0, 2);
                ring(c, hx, hy, pr + 3.0, 0xff8ad0, 0.9, 1);
                if !calm {
                    for d in 0..3 {
                        ring(c, hx, hy, pr + 5.0 + (t * 20.0 + d as f64 * 4.0) % 12.0, 0xff8ad0, 0.4, 1);
                    }
                }
                // the timer: how long until it fires
                let bw = 22.0;
                let (bx, by) = (js_round(hx - bw / 2.0), js_round(hy + pr + 5.0));
                let mut x = -1.0;
                while x <= bw {
                    for y in -1..=2 {
                        let y = y as f64;
                        let col = if x < 0.0 || x == bw || y < 0.0 || y == 2.0 {
                            0x1d1030
                        } else if x < bw * (1.0 - q) {
                            0xff8ad0
                        } else {
                            0xffffff
                        };
                        c.fb.px(bx + x, by + y, col, 1.0);
                    }
                    x += 1.0;
                }
            }
            if ph == Ph::Fire {
                if deflected {
                    // it goes back the way it came, into him
                    ray(c, hx, hy, fx0, fy0, 2.2, 0xffc0ec, 0xd84aa8, Some(0xff8ad0), if calm { 0.0 } else { 0.2 });
                    burst_star(c, mid.0, mid.1, t, 0xffc0ec);
                } else {
                    ray(c, fx0, fy0, hx, hy, 2.2, 0xc890ff, 0x7a2ad8, Some(0xff8ad0), if calm { 0.0 } else { 0.2 });
                    burst_star(c, hx, hy, t, 0xc890ff);
                }
            }
        }
        Some(Mech::Cell { ph, p0, who, healed, .. }) if ph == Ph::Reach || ph == Ph::Drain => {
            let tb = (b.x - 6.0 * k, b.y - 14.0 * k);
            let road = g.ally_spot(who).unwrap_or((hx, hy));
            let held_at = g.held_spot().unwrap_or(road);
            let lift = if ph == Ph::Drain { ((t - p0) / 0.5).min(1.0) } else { 0.0 };
            let to = (road.0 + (held_at.0 - road.0) * lift, road.1 + (held_at.1 - road.1) * lift);
            let reach = if ph == Ph::Reach { ((t - p0) / C_REACH).min(1.0) } else { 1.0 };
            let n = 60.0;
            let upto = js_round(n * reach) as i64;
            for i in 0..=upto {
                let q = i as f64 / n;
                let (x, y) = tail_at(tb, to, lift, k, q);
                let w = 2.4 - q * 0.8;
                let mut yy = -w - 1.0;
                while yy <= w + 1.0 {
                    let mut xx = -w - 1.0;
                    while xx <= w + 1.0 {
                        let d = hypot(&[xx, yy]);
                        if d <= w {
                            c.fb.px(x + xx, y + yy, if (i >> 2) % 2 == 1 { 0x6cc94e } else { 0x3a8a34 }, 1.0);
                        } else if d <= w + 1.0 {
                            c.fb.px(x + xx, y + yy, 0x0b140c, 1.0);
                        }
                        xx += 1.0;
                    }
                    yy += 1.0;
                }
                if i % 7 == 3 {
                    c.fb.px(x, y, 0x15171c, 1.0);
                }
            }
            let (tx, ty) = tail_at(tb, to, lift, k, reach);
            disc(c, tx, ty, 3.0, 0x3a8a34, 1.0);
            disc(c, tx, ty, 2.0, 0xa8ec84, 1.0);
            disc(c, tx, ty, 1.0, 0x15171c, 1.0);
            if ph == Ph::Drain {
                let (s, kk) = ally_sprite(who, t);
                let sway = if calm { 0.0 } else { sin(t * 7.0) * 0.4 };
                c.blit_z(s, to.0, to.1 + 9.0, sway, true, 0.0, 1e9, kk);
                // his ki runs up the tail into him
                for i in 0..5 {
                    let q = 1.0 - ((t * 1.4 + i as f64 / 5.0) % 1.0);
                    let (x, y) = tail_at(tb, to, lift, k, q);
                    disc(c, x, y, 2.0, 0xffe066, 1.0);
                    c.fb.px(x, y, 0xffffff, 1.0);
                }
                // the hp bar refills: what he's taken back glows, and a small +4 ticks off it
                let (bx, bw, by) = bar(&b, spr);
                let f = 0f64.max((b.hp / b.max).to_f64()).min(1.0);
                let mut x = (bw * (f - healed).max(0.0)).floor();
                while x < bw * f {
                    for y in 0..=1 {
                        c.fb.px(bx + x, by + y as f64, if !calm && (t * 8.0).floor() as i64 % 2 == 1 { 0xffffff } else { 0xffe066 }, 1.0);
                    }
                    x += 1.0;
                }
                if healed < C_CAP - 1e-9 {
                    tick(c, "+4", bx + bw + 8.0, by - 2.0 - (t * 10.0) % 6.0, 0x2f9a4a);
                }
            }
        }
        Some(Mech::Buu { zone, reforms, reform_t, .. }) if zone => {
            let regen = reforms < B_REFORMS;
            if regen {
                let pulse = if calm { 0.6 } else { 0.5 + 0.5 * sin(t * 7.0) };
                rim(c, spr, b.x, b.y, k, 2, &mut |d, x, y| {
                    if d == 1 {
                        Some(0xff4aa0)
                    } else if bayer(js_round(x) as i32, js_round(y) as i32) < pulse {
                        Some(0xffc0dc)
                    } else {
                        None
                    }
                });
                // pink steam off his head
                let top = b.y - spr.h as f64 * k;
                for i in 0..5 {
                    let ph = (t * 1.1 + i as f64 / 5.0) % 1.0;
                    let n = (t * 1.1 + i as f64 / 5.0).floor();
                    let x = b.x + (h2(i as f64, n) - 0.5) * 14.0 * k + sin(t * 3.0 + i as f64) * 2.0;
                    let y = top + 4.0 - ph * 16.0;
                    let r = 1.0 + ph * 2.0;
                    let col = if ph < 0.3 {
                        0xffffff
                    } else if ph < 0.65 {
                        0xffc0dc
                    } else {
                        0xf28ab8
                    };
                    let mut yy = -r;
                    while yy <= r {
                        let mut xx = -r;
                        while xx <= r {
                            if xx * xx + yy * yy <= r * r && !(ph > 0.45 && bayer(js_round(x + xx) as i32, js_round(y + yy) as i32) < (ph - 0.45) * 1.9) {
                                c.fb.px(x + xx, y + yy, col, 1.0);
                            }
                            xx += 1.0;
                        }
                        yy += 1.0;
                    }
                }
                // his bar pulses pink, notched where he started regenerating
                let (bx, bw, by) = bar(&b, spr);
                let f = 0f64.max((b.hp / b.max).to_f64());
                let mut x = 0.0;
                while x < bw * f {
                    for y in 0..=1 {
                        c.fb.px(bx + x, by + y as f64, if pulse > 0.5 { 0xff8ad0 } else { 0xf28ab8 }, 1.0);
                    }
                    x += 1.0;
                }
                let zx = js_round(bx + bw * B_ZONE);
                for y in -2..=3 {
                    c.fb.px(zx, by + y as f64, 0x1d1030, 1.0);
                }
            }
            // a reform: pink blobs fly back together
            let q = (t - reform_t) / B_REFORM_T;
            if (0.0..1.0).contains(&q) {
                for i in 0..10 {
                    let a = i as f64 * 0.628 + reform_t;
                    let r = (1.0 - q) * 22.0 * k / 2.0 + 2.0;
                    disc(c, mid.0 + cos(a) * r, mid.1 + sin(a) * r, 2.0 + (1.0 - q) * 2.0, if i % 2 == 0 { 0xff8ad0 } else { 0xffc0dc }, 1.0);
                }
            }
        }
        Some(Mech::Hit { ph, p0, .. }) => match ph {
            Ph::Glint => {
                let (ex, ey) = (b.x - 2.0 * k, b.y - spr.h as f64 * k + 9.0 * k);
                let gl = ((t - p0) / 0.3).min(1.0) * 6.0;
                let mut d = -gl;
                while d <= gl {
                    c.fb.px(ex + d, ey, 0xffffff, 1.0);
                    c.fb.px(ex, ey + d * 0.6, 0xffffff, 1.0);
                    d += 1.0;
                }
            }
            Ph::Skip => {
                // the world drains to violet; he alone moves, a step closer, his old spot an afterimage
                for p in c.fb.buf.iter_mut() {
                    let al = *p >> 24;
                    if al == 0 {
                        continue;
                    }
                    let (r, gg, bb) = (*p & 255, (*p >> 8) & 255, (*p >> 16) & 255);
                    let l = r as f64 * 0.3 + gg as f64 * 0.59 + bb as f64 * 0.11;
                    let ch = |m: f64, a: f64| (l * m + a).min(255.0) as u32;
                    *p = (al << 24) | (ch(0.95, 40.0) << 16) | (ch(0.62, 18.0) << 8) | ch(0.78, 30.0);
                }
                let e = t - p0;
                let step = if calm { 30.0 } else { 30.0 * (e / 0.15).min(1.0) };
                for (off, a) in [(22.0, 0.25), (12.0, 0.45)] {
                    redraw(c, spr, b.x + off - step, b.y, k, Some(0xb07ae0), a);
                }
                redraw(c, spr, b.x - step, b.y, k, None, 1.0);
                // a clock face over the planet, its hand sweeping
                let (ox, oy, r) = (c.cx, c.cy - c.r * 0.1, c.r * 0.55);
                ring(c, ox, oy, r, 0xe0c8ff, 0.8, 2);
                for i in 0..12 {
                    let a = i as f64 * 0.5236;
                    let mut d = r - 5.0;
                    while d < r - 1.0 {
                        c.fb.px(ox + cos(a) * d, oy + sin(a) * d, 0xe0c8ff, 0.9);
                        d += 1.0;
                    }
                }
                let a = -1.571 + e / H_SKIP * 6.0;
                let mut d = 0.0;
                while d < r - 6.0 {
                    c.fb.px(ox + cos(a) * d, oy + sin(a) * d, 0xffffff, 1.0);
                    d += 1.0;
                }
                disc(c, ox, oy, 2.0, 0xffffff, 1.0);
                // the hero's ki hangs in the air, streaking
                for kb in &g.tl.kis {
                    for d in 1..10 {
                        c.fb.px(kb.x - d as f64, kb.y, 0xe0c8ff, 0.5 - d as f64 * 0.04);
                    }
                }
            }
            Ph::Open => {
                let gl = 1.0 - (t - p0) / planet_core::mech::H_OPEN;
                rim(c, spr, b.x, b.y, k, 1, &mut |_, _, _| Some(if gl > 0.5 { 0xfff27a } else { 0xffd84a }));
            }
            _ => {}
        },
        Some(Mech::Jiren { refl, stag }) => {
            let flick = if calm { 0.0 } else { sin(t * 13.0) };
            rim(c, spr, b.x, b.y, k, 2, &mut |d, x, y| {
                if d == 1 {
                    Some(0xff6a5a)
                } else if flick + bayer(js_round(x) as i32, js_round(y) as i32) > 0.4 {
                    Some(0xffb0a4)
                } else {
                    None
                }
            });
            let (sx, sy) = (b.x - (spr.w as f64 / 2.0 + 5.0) * k, mid.1);
            // a weak beam comes back at you, red, in an arc under the shot
            if let Some((t0, _)) = refl {
                let back = ((t - t0) / J_BACK).min(1.0);
                arc_back(c, sx, sy, hx, hy, back);
            } else if g.stunned() {
                arc_back(c, sx, sy, hx, hy, 1.0);
            }
            // a full one breaks his guard: red shards fly off
            let q = (t - stag) / 0.5;
            if (0.0..1.0).contains(&q) {
                for i in 0..10 {
                    let a = i as f64 * 0.628 + 0.3;
                    let r = 6.0 + q * 26.0;
                    let (x, y) = (mid.0 + cos(a) * r, mid.1 + sin(a) * r);
                    let col = if i % 2 == 0 { 0xff6a5a } else { 0xffb0a4 };
                    line(c, x, y, x + cos(a + 1.2) * 4.0, y + sin(a + 1.2) * 4.0, col, 1.0 - q);
                }
            }
            // the charge against what breaks through
            let ch = g.inp.charging;
            if ch > 0.0 {
                let gw = 30.0;
                let (gx, gy) = (js_round(hx - gw / 2.0), js_round(hy + 18.0));
                let q = ch / 2.5;
                let mut x = -1.0;
                while x <= gw {
                    for y in -1..=3 {
                        let y = y as f64;
                        let col = if x < 0.0 || x == gw || y < 0.0 || y == 3.0 {
                            0x1d1030
                        } else if x < gw * q {
                            if ch >= J_FULL {
                                0xffc21a
                            } else {
                                0x8fd8ff
                            }
                        } else {
                            0xffffff
                        };
                        c.fb.px(gx + x, gy + y, col, 1.0);
                    }
                    x += 1.0;
                }
                let nt = js_round(gx + gw * J_FULL / 2.5);
                for y in -3..=5 {
                    c.fb.px(nt, gy + y as f64, 0xd8241e, 1.0);
                }
            }
        }
        _ => {}
    }
    if g.stunned() {
        if calm {
            for i in 0..3 {
                c.fb.px(hx - 6.0 + i as f64 * 6.0, hy - 14.0, 0xffe066, 1.0);
            }
        } else {
            dizzy(c, hx, hy - 14.0, t);
        }
    }
}

fn arc_back(c: &mut Ctx, sx: f64, sy: f64, hx: f64, hy: f64, back: f64) {
    let (qx, qy) = ((sx + hx) / 2.0, sy.max(hy) + 34.0);
    let p = |u: f64| {
        let v = 1.0 - u;
        (v * v * sx + 2.0 * v * u * qx + u * u * hx, v * v * sy + 2.0 * v * u * qy + u * u * hy)
    };
    let seg = 24;
    let upto = js_round(seg as f64 * back) as i64;
    for i in 0..upto {
        let (x0, y0) = p(i as f64 / seg as f64);
        let (x1, y1) = p((i + 1) as f64 / seg as f64);
        ray(c, x0, y0, x1, y1, 2.9, 0xffb0a4, 0xd8241e, Some(0xff6a5a), 0.0);
    }
    if upto > 0 {
        let (x, y) = p(upto as f64 / seg as f64);
        disc(c, x, y, 3.0, 0xffffff, 1.0);
    }
    disc(c, sx, sy, 4.0, 0xffffff, 1.0);
}

fn burst_star(c: &mut Ctx, x: f64, y: f64, t: f64, col: u32) {
    for i in 0..8 {
        let a = i as f64 * 0.785 + t * 3.0;
        let mut d = 6.0;
        while d < 13.0 {
            c.fb.px(x + cos(a) * d, y + sin(a) * d, if i % 2 == 1 { 0xffffff } else { col }, 1.0);
            d += 1.0;
        }
    }
}
