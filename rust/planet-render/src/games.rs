//! The Cell Games (planet-core's `cellgames`) and Buu's candy (`candy`), drawn: Cell's tiled ring laid on the planet,
//! Cell waiting in it over a row of countdown pips, the Cell Jr.s hopping round it and Gohan's shots at them, perfect
//! Cell swelling to self-destruct with your beam and his blast meeting between you, the end (a white burst, or the
//! planet going up) and the halos after; fat Buu's antenna zaps, the trees and houses turned to stripy candy, and the
//! wrapped sweets bubbles and piccolo become. Shapes and colour only (the words are toasts), no random draws; reduced
//! motion keeps things from hopping, flickering and wobbling.

use planet_core::candy::{Target, CANDY_ZAP, HOUSES, TREES};
use planet_core::cellgames::{jr_sprite, CgPh, CG_COUNT, CG_END, CG_FUSE};
use planet_core::geom::{add, ap, cross, dot, norm, V3};
use planet_core::jsmath::{atan2, cos, hypot, sin};
use planet_core::num::js_round;
use planet_core::sprite::{self, Sprite};
use planet_core::Game;

use crate::bayer;
use crate::scene::{tone, Ctx};
use crate::visitors::HeroAt;

const TILE: [u32; 4] = [0xa8a49a, 0xc8c4b8, 0xe2dfd4, 0xf4f2ea];
const TILE_DARK: [u32; 4] = [0x6a665e, 0x86827a, 0x9e9a90, 0xb4b0a6];

fn line(c: &mut Ctx, x0: f64, y0: f64, x1: f64, y1: f64, col: u32, a: f64) {
    let n = 1f64.max((hypot(&[x1 - x0, y1 - y0]) * 1.5).ceil());
    let mut i = 0.0;
    while i <= n {
        c.fb.px(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, col, a);
        i += 1.0;
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

fn ring(c: &mut Ctx, x: f64, y: f64, rx: f64, ry: f64, col: u32, a: f64) {
    let n = (rx.max(ry) * 7.0).max(12.0);
    for i in 0..n as i64 {
        let q = i as f64 / n * 6.283;
        c.fb.px(x + cos(q) * rx, y + sin(q) * ry, col, a);
    }
}

/// A sprite at (x, y) (its feet), scaled by `k`, in its colours or washed in one.
fn big(c: &mut Ctx, spr: &Sprite, x: f64, y: f64, k: f64, wash: Option<(u32, f64)>) {
    for j in 0..spr.h {
        for i in 0..spr.w {
            let col = spr.col[j * spr.w + (spr.w - 1 - i)];
            if col < 0 {
                continue;
            }
            let (x0, y0) = ((x + (i as f64 - spr.ax) * k).floor(), (y + (j as f64 - spr.h as f64) * k).floor());
            let (x1, y1) = ((x + (i as f64 + 1.0 - spr.ax) * k).floor(), (y + (j as f64 + 1.0 - spr.h as f64) * k).floor());
            let mut yy = y0;
            while yy < y1.max(y0 + 1.0) {
                let mut xx = x0;
                while xx < x1.max(x0 + 1.0) {
                    c.fb.px(xx, yy, col as u32, 1.0);
                    if let Some((w, a)) = wash {
                        c.fb.px(xx, yy, w, a);
                    }
                    xx += 1.0;
                }
                yy += 1.0;
            }
        }
    }
}

fn stand_ang(v: V3) -> f64 {
    atan2(v[0], v[1]) * 1f64.min((v[0] * v[0] + v[1] * v[1]) * 1.6)
}

/// Two directions along the planet at `p`, as planet-core lays the ring out.
fn tangents(g: &Game, p: V3) -> (V3, V3) {
    let a = norm(cross(p, g.frame3.n));
    (a, cross(p, a))
}

/// The ring, laid on the planet's face (under whatever stands on it).
pub fn draw_ring(c: &mut Ctx, g: &Game) {
    let Some(cg) = g.tl.cg.as_ref() else { return };
    let fade = match cg.ph {
        CgPh::Over(_) => 1f64.min((c.t - cg.t0) / CG_END),
        _ => 0.0,
    };
    let scorched = matches!(cg.ph, CgPh::Over(false));
    let (a, b) = tangents(g, cg.ring);
    let s = 0.22;
    let step = 0.45 / c.r;
    let mut u = -s;
    while u <= s {
        let mut v = -s;
        while v <= s {
            let q = norm(add(add(cg.ring, a, u), b, v));
            let w = ap(&c.m, q);
            if w[2] > 0.02 {
                let (x, y) = (js_round(c.cx + w[0] * c.r), js_round(c.cy - w[1] * c.r + c.bob));
                if x >= 0.0 && y >= 0.0 && x < c.w && y < c.h && c.fb.zb[(y * c.w + x) as usize] as f64 <= w[2] * c.r + 1.5 {
                    let (fu, fv) = ((u + s) / (2.0 * s) * 5.0, (v + s) / (2.0 * s) * 5.0);
                    let seam = fu.fract() < 0.07 || fv.fract() < 0.07;
                    let edge = u.abs() > s * 0.9 || v.abs() > s * 0.9;
                    let lum = c.light(w) - if seam { 0.25 } else { 0.0 } - if edge { 0.12 } else { 0.0 } + ((fu.floor() + fv.floor()) % 2.0) * 0.06;
                    let pal = if scorched { &TILE_DARK } else { &TILE };
                    if fade == 0.0 || bayer(x as i32, y as i32) >= fade {
                        c.fb.px(x, y, tone(pal, lum, x as i64, y as i64), 1.0);
                    }
                }
            }
            v += step;
        }
        u += step;
    }
}

/// The games over the planet, once its characters are drawn.
pub fn draw(c: &mut Ctx, g: &mut Game, hero: &HeroAt) {
    let t = c.t;
    if let Some(cg) = g.tl.cg.clone() {
        let w = ap(&c.m, cg.ring);
        let (rx, ry) = (c.cx + w[0] * c.r, c.cy - w[1] * c.r + c.bob);
        if matches!(cg.ph, CgPh::Count | CgPh::Jrs) && w[2] > 0.05 {
            let cell = sprite::get("CELL");
            c.blit_z(cell, rx, ry, stand_ang(w), true, 0.0, w[2] * c.r + 4.0, 1.0);
            if cg.ph == CgPh::Count {
                // the countdown: a pip a second, out one by one
                let left = (CG_COUNT - (t - cg.t0)).ceil().max(0.0);
                let y = js_round(ry - cell.h as f64 - 5.0);
                for i in 0..CG_COUNT as i64 {
                    let x = js_round(rx - 14.0 + i as f64 * 3.0);
                    let lit = (i as f64) < left;
                    let blink = lit && i as f64 == left - 1.0 && !g.calm && ((t - cg.t0) * 4.0).floor() as i64 % 2 == 1;
                    let col = if lit && !blink { 0xfff27a } else { 0x4a4658 };
                    for (ox, oy) in [(0.0, 0.0), (1.0, 0.0), (0.0, 1.0), (1.0, 1.0)] {
                        c.fb.px(x + ox, y + oy, col, 1.0);
                    }
                }
            }
        }
        if cg.ph == CgPh::Jrs {
            let (hx, hy) = g.hand_pos();
            for (i, j) in cg.jrs.iter().enumerate() {
                let Some((x, y)) = g.jr_spot(i) else { continue };
                if let Some(d) = j.dead {
                    // gohan's shot streaks in
                    if j.gohan && t - d < 0.3 && hero.seen {
                        let q = (t - d) / 0.3;
                        line(
                            c,
                            hx + (x - hx) * (q - 0.3).max(0.0),
                            hy + (y - 6.0 - hy) * (q - 0.3).max(0.0),
                            hx + (x - hx) * q,
                            hy + (y - 6.0 - hy) * q,
                            0xfff27a,
                            1.0 - q * 0.5,
                        );
                    }
                    continue;
                }
                let v = ap(&c.m, j.c);
                let hop = if g.calm { 0.0 } else { sin(t * 7.0 + i as f64 * 1.3).abs() * 3.0 };
                c.blit_z(jr_sprite(), x, y, stand_ang(v), sin(t * 2.0 + i as f64) > 0.0, hop, v[2] * c.r + 4.0, 1.0);
            }
        }
        if let CgPh::Boom | CgPh::Over(_) = cg.ph {
            let cell = sprite::get("CELL");
            let (bx, by, k) = if cg.at.0 != 0.0 { cg.at } else { (c.cx + c.r * 1.45, (c.cy - c.r * 0.75).max(cell.h as f64 + 18.0), 0.9f64.max(c.r / 62.0)) };
            let q = 1f64.min((t - cg.t0) / CG_FUSE);
            match cg.ph {
                CgPh::Boom => {
                    let kk = k * (1.0 + 0.45 * q) + if g.calm { 0.0 } else { sin(t * 14.0) * 0.04 * q };
                    let flare = cg.flaring(t);
                    let wash = if flare { Some((0xffffff, if g.calm { 0.45 } else { 0.6 + 0.3 * sin(t * 30.0) })) } else { Some((0xffa040, 0.15 + 0.25 * q)) };
                    big(c, cell, bx, by + (kk - k) * cell.h as f64 * 0.3, kk, wash);
                    // your beam against his blast, meeting where the push stands
                    let (hx, hy) = g.hand_pos();
                    let (tx, ty) = (bx - 6.0 * kk, by - cell.h as f64 * kk * 0.45);
                    let p = cg.p.clamp(0.0, 1.0);
                    let (mx, my) = (hx + (tx - hx) * p, hy + (ty - hy) * p);
                    let wob = |o: f64| if g.calm { 0.0 } else { sin(t * 40.0 + o) * 0.6 };
                    for d in [-1.0, 0.0, 1.0] {
                        line(c, hx, hy + d + wob(d), mx, my + d + wob(d * 2.0), if d == 0.0 { 0xffffff } else { 0x8ad8ff }, 1.0);
                        line(c, tx, ty + d + wob(d * 3.0), mx, my + d + wob(d), if d == 0.0 { 0xfff2c0 } else { 0xff9a3c }, 1.0);
                    }
                    let r = 3.0 + if g.calm { 0.0 } else { sin(t * 25.0).abs() * 1.5 };
                    disc(c, mx, my, r + 1.0, if flare { 0xff9a3c } else { 0x8ad8ff }, 0.7);
                    disc(c, mx, my, r, 0xffffff, 1.0);
                }
                CgPh::Over(won) => {
                    let e = (t - cg.t0) / CG_END;
                    if won {
                        ring(c, bx, by - cell.h as f64 * k * 0.5, 4.0 + e * 40.0, 3.0 + e * 30.0, 0xffffff, 1.0 - e);
                        ring(c, bx, by - cell.h as f64 * k * 0.5, 2.0 + e * 30.0, 1.5 + e * 22.0, 0x8ad8ff, 1.0 - e);
                    } else {
                        let (pcx, pcy) = (c.cx, c.cy + c.bob);
                        for (d, col) in [(0.0, 0xffffff), (4.0, 0xfff27a), (8.0, 0xff9a3c), (12.0, 0xe0473e)] {
                            ring(c, pcx, pcy, c.r * 0.9 + e * 50.0 + d, c.r * 0.9 + e * 50.0 + d, col, (1.0 - e) * 0.9);
                        }
                    }
                }
                _ => {}
            }
        }
    }
    draw_halos(c, g, hero);
}

/// After the planet went up: halos over everyone.
fn draw_halos(c: &mut Ctx, g: &Game, hero: &HeroAt) {
    let t = c.t;
    if g.tl.halo_until <= t {
        return;
    }
    let bob = |o: f64| if g.calm { 0.0 } else { sin(t * 3.0 + o) };
    let halo = |c: &mut Ctx, x: f64, y: f64| {
        ring(c, x, y, 4.0, 1.2, 0xfff27a, 1.0);
        c.fb.px(x - 2.0, y - 1.0, 0xffffff, 1.0);
    };
    if hero.seen {
        let (ux, uy) = (sin(hero.ang), -cos(hero.ang));
        halo(c, hero.x + ux * (hero.lift + 25.0), hero.y + uy * (hero.lift + 25.0) + bob(0.0));
    }
    if let Some((x, y, k)) = g.tl.monkey_at {
        halo(c, x, y - 13.0 * k + bob(1.0));
    }
    if let Some((x, y)) = g.tl.piccolo_at {
        halo(c, x, y - 26.0 + bob(2.0));
    }
    if let Some((x, y)) = g.tl.greg.as_ref().and_then(|gr| gr.sx) {
        halo(c, x, y - 14.0 + bob(3.0));
    }
    if let Some((x, y)) = g.tl.kai.as_ref().and_then(|k| k.sx) {
        halo(c, x, y - 22.0 + bob(4.0));
    }
}

// ── Buu's candy

const PINK: [u32; 4] = [0xc84a8a, 0xf07ab0, 0xffa6cf, 0xffd8ea];
const MINT: [u32; 4] = [0x3aa88a, 0x5ad0a8, 0x9ae8d0, 0xd8fff0];
const CANE: [u32; 4] = [0xb81e2a, 0xe0303a, 0xff6a6a, 0xffb0b0];
const WHITE: [u32; 4] = [0xc8c0d0, 0xe4e0ea, 0xf6f4fa, 0xffffff];

/// Which of king kai's planet's candy a solid at `p` belongs to: 0 none, 1 a tree, 2 a house.
pub fn sweet(g: &Game, p: V3) -> u8 {
    let Some(cd) = g.tl.candy.as_ref() else { return 0 };
    if g.s.world != 0 {
        return 0;
    }
    let p = norm(p);
    for (x, _) in &cd.done {
        match *x {
            Target::Tree(i) if dot(p, g.frame3.cap_pt(TREES[i][0], TREES[i][1])) > cos(0.17 * TREES[i][2]) => return 1,
            Target::House(i) if dot(p, g.frame3.cap_pt(HOUSES[i][0], HOUSES[i][1])) > cos(HOUSES[i][2] * 0.95) => return 2,
            _ => {}
        }
    }
    0
}

/// A solid turned to candy: gumdrop leaves, candy-cane trunks, swirled houses.
pub fn candy_shade(c: &Ctx, kind: u8, leaf: bool, trunk: bool, n: V3, x: i64, y: i64) -> u32 {
    let lum = c.light(n);
    if kind == 1 && leaf {
        let sparkle = if (x * 7 + y * 13) % 23 == 0 { 0.3 } else { 0.0 };
        tone(&PINK, lum + sparkle, x, y)
    } else if trunk {
        tone(if (x + y).div_euclid(2) % 2 == 0 { &CANE } else { &WHITE }, lum, x, y)
    } else if kind == 2 {
        tone(if (x - y).div_euclid(3) % 2 == 0 { &PINK } else { &WHITE }, lum + 0.1, x, y)
    } else {
        tone(&MINT, lum, x, y)
    }
}

/// A wrapped sweet (bubbles and piccolo, candied), or a lollipop where there's no scenery to turn.
fn sweet_prop(c: &mut Ctx, x: f64, y: f64, lolly: bool, t: f64, calm: bool) {
    let rows: &[&str] = if lolly {
        &[".ppp.", "pwppw", "ppwpp", "wppwp", ".ppp.", "..s..", "..s..", "..s.."]
    } else {
        &["w.......w", "ww.ppp.ww", "wwpwpwpww", "ww.ppp.ww", "w.......w"]
    };
    let (h, w) = (rows.len() as f64, rows[0].len() as f64);
    for (j, row) in rows.iter().enumerate() {
        for (i, ch) in row.bytes().enumerate() {
            let col = match ch {
                b'p' => 0xf07ab0,
                b'w' => 0xffffff,
                b's' => 0xe8dcc0,
                _ => continue,
            };
            c.fb.px(x + i as f64 - (w / 2.0).floor(), y + j as f64 - h, col, 1.0);
        }
    }
    // a twinkle says it can be tapped
    if !calm && (t * 2.0).fract() < 0.25 {
        c.fb.px(x + w / 2.0, y - h - 1.0, 0xffffff, 1.0);
    }
}

/// Buu's zap on its way, and the candy that isn't scenery.
pub fn draw_candy(c: &mut Ctx, g: &Game) {
    let t = c.t;
    let Some(cd) = g.tl.candy.as_ref().filter(|cd| cd.over.is_none()) else { return };
    for (x, _) in &cd.done {
        if matches!(x, Target::Bubbles | Target::Piccolo | Target::Spot(_)) {
            if let Some((sx, sy)) = g.target_spot(*x) {
                let lolly = matches!(x, Target::Spot(_));
                let (_, up) = g.target_at(*x).unwrap();
                sweet_prop(c, sx, sy + up, lolly, t, g.calm);
            }
        }
    }
    if let (Some((x, t1)), Some(b)) = (cd.zap, g.tl.boss.as_ref().filter(|b| b.id == cd.boss)) {
        let Some((tx, ty)) = g.target_spot(x) else { return };
        let spr = planet_core::candy::buu_sprite();
        let (ax, ay) = (b.x + 3.0 * b.k, b.y - spr.h as f64 * b.k + 2.0);
        let q = 1f64.min((t - t1) / CANDY_ZAP);
        let n = 1f64.max((hypot(&[tx - ax, ty - ay]) * 1.5).ceil());
        let (dx, dy) = ((tx - ax) / n, (ty - ay) / n);
        let l = hypot(&[dx, dy]).max(1e-9);
        let mut i = 0.0;
        while i <= n * q {
            let wob = if g.calm { 0.0 } else { sin(i * 0.5 - t * 20.0) * 2.0 };
            let (x, y) = (ax + dx * i - dy / l * wob, ay + dy * i + dx / l * wob);
            c.fb.px(x, y, 0xff7ac0, 1.0);
            c.fb.px(x, y + 1.0, 0xffd0e8, 1.0);
            i += 1.0;
        }
        disc(c, ax + dx * n * q, ay + dy * n * q, 2.0, 0xffffff, 1.0);
    }
}
