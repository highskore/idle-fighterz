//! The small extras: the ramen break's bowl (steam, chopsticks, a noodle on its way up; knocked over, a puddle).
//! Shapes only, no random draws; reduced motion keeps the steam still.

use planet_core::jsmath::{cos, sin};
use planet_core::ramen::SPILL_T;
use planet_core::Game;

use crate::scene::Ctx;
use crate::visitors::HeroAt;

/// A pixel `i` across and `j` up from (x, y), in a frame tipped by `ang` (the planet's up at the hero).
fn put(c: &mut Ctx, x: f64, y: f64, ang: f64, i: f64, j: f64, col: u32, a: f64) {
    let (ux, uy, rx, ry) = (sin(ang), -cos(ang), cos(ang), sin(ang));
    c.fb.px(x + rx * i + ux * j, y + ry * i + uy * j, col, a);
}

/// Rows top down; '.' is clear.
fn pattern(c: &mut Ctx, x: f64, y: f64, ang: f64, rows: &[&str], pal: &dyn Fn(u8) -> u32) {
    let w = rows[0].len() as f64;
    for (j, row) in rows.iter().enumerate() {
        for (i, ch) in row.bytes().enumerate() {
            if ch != b'.' {
                put(c, x, y, ang, i as f64 - (w - 1.0) / 2.0, (rows.len() - 1 - j) as f64, pal(ch), 1.0);
            }
        }
    }
}

const BOWL: [&str; 4] = [".nnpnn.", "rrrrrrr", ".rwrwr.", "..rrr.."];

fn bowl_col(ch: u8) -> u32 {
    match ch {
        b'n' => 0xf6d36b,
        b'p' => 0xff9ad0,
        b'w' => 0xffffff,
        _ => 0xd8341e,
    }
}

/// The ramen break, over the hero as he was just drawn.
pub fn draw_ramen(c: &mut Ctx, g: &Game, hero: &HeroAt) {
    let Some(r) = g.tl.ramen.as_ref() else { return };
    if !hero.seen {
        return;
    }
    let t = c.t;
    let f = if hero.flip { -1.0 } else { 1.0 };
    let (ux, uy, rx, ry) = (sin(hero.ang), -cos(hero.ang), cos(hero.ang), sin(hero.ang));
    if let Some(s) = r.spilt {
        // the bowl upside down on the ground before him, broth spreading
        let k = 1f64.min((t - s) / 0.25);
        let a = 1f64.min((SPILL_T - (t - s)) / 0.3).max(0.0);
        let (bx, by) = (hero.x + rx * f * 7.0, hero.y + ry * f * 7.0);
        for i in -4..=4 {
            if (i as f64).abs() <= 1.0 + k * 3.0 {
                put(c, bx, by, hero.ang, i as f64, 0.0, if i % 2 == 0 { 0xf2c55a } else { 0xf6d36b }, a);
            }
        }
        pattern(c, bx, by - uy, hero.ang, &["..rrr..", ".rrrrr.", "rrrrrrr"], &bowl_col);
        return;
    }
    // the bowl in his hands, at his chest
    let (bx, by) = (hero.x + ux * (hero.lift + 10.0) + rx * f * 5.0, hero.y + uy * (hero.lift + 10.0) + ry * f * 5.0);
    pattern(c, bx, by, hero.ang, &BOWL, &bowl_col);
    // chopsticks up to his mouth, and a noodle riding them every so often
    let (mx, my) = (bx - rx * f * 2.0 + ux * 8.0, by - ry * f * 2.0 + uy * 8.0);
    for k in 0..=6 {
        let q = k as f64 / 6.0;
        let (sx, sy) = (bx + rx * f * 1.0 + ux * 4.0, by + ry * f * 1.0 + uy * 4.0);
        c.fb.px(sx + (mx - sx) * q, sy + (my - sy) * q, 0x8a5a2a, 1.0);
        c.fb.px(sx + rx * f + (mx - sx) * q, sy + ry * f + (my - sy) * q, 0x6a4020, 1.0);
    }
    if !g.calm {
        let q = ((t - r.t0) * 0.8).fract();
        if q < 0.6 {
            let (sx, sy) = (bx + ux * 4.0, by + uy * 4.0);
            for k in 0..3 {
                let p = (q / 0.6 - k as f64 * 0.08).max(0.0);
                c.fb.px(sx + (mx - sx) * p, sy + (my - sy) * p, 0xf6d36b, 1.0);
            }
        }
    }
    // steam
    for k in 0..3 {
        let kk = k as f64;
        let rise = if g.calm { 0.5 } else { (t * 0.9 + kk * 0.33).fract() };
        let sway = if g.calm { 0.0 } else { sin(t * 3.0 + kk * 2.0) };
        let i = kk * 2.0 - 2.0 + sway;
        put(c, bx, by, hero.ang, i, 5.0 + rise * 6.0, 0xffffff, 0.85 * (1.0 - rise));
        put(c, bx, by, hero.ang, i, 6.0 + rise * 6.0, 0xffffff, 0.6 * (1.0 - rise));
    }
}
