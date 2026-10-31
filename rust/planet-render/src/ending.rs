//! PROTOTYPE (design picker only): planet-core's `ending` moments drawn. Sky work goes behind the planet
//! (`end_back`); sprites, the camera pull-back, the big bang and the glitches go over everything (`end_front`). The
//! bare widget gets its sky as a round pocket behind the planet, so the desktop still shows round it.

use planet_core::geom::ap;
use planet_core::jsmath::{atan2, cos, hypot, sin};
use planet_core::sprite::{self, Sprite};
use planet_core::Game;

use crate::limits::{glow, line, star};
use crate::scene::{Ctx, View};
use crate::top::mixc;
use crate::{bayer, h2, pk};

/// Whether a moment hides the cloud sea (the void and the night skies have nothing under them).
pub fn no_sea(g: &Game) -> bool {
    g.end.as_ref().is_some_and(|e| matches!((e.v, e.stage), (b'A', _) | (b'B', 1) | (b'B', 2) | (b'C', 1) | (b'C', 2) | (b'C', 3) | (b'D', 2) | (b'E', 2)))
}

fn hero_head(g: &Game) -> (f64, f64) {
    let k = g.kid_screen(g.lift_now);
    (k.x + sin(k.ang) * 17.0, k.y - cos(k.ang) * 17.0)
}

/// Paints the sky: every empty pixel (inside a round pocket on the bare widget) gets `f(x, y)`.
fn sky(c: &mut Ctx, view: &View, f: impl Fn(f64, f64) -> u32) {
    let (cx, cy, rr) = (c.cx, c.cy + c.bob, c.r * 1.8);
    let w = c.fb.w;
    for k in 0..c.fb.buf.len() {
        if c.fb.buf[k] >> 24 != 0 {
            continue;
        }
        let (x, y) = ((k % w) as f64, (k / w) as f64);
        if view.bare {
            let d = hypot(&[x - cx, y - cy]);
            if bayer(x as i32, y as i32) > ((rr - d) / (rr * 0.18)).min(1.0) {
                continue;
            }
        }
        c.fb.buf[k] = pk(f(x, y), 255);
    }
}

fn stars_at(x: f64, y: f64, thresh: f64) -> bool {
    h2(x, y) > thresh
}

/// A friend (or king kai) stood on the road `d` radians from the hero.
fn stand(c: &mut Ctx, g: &Game, spr: &Sprite, d: f64, k: f64) {
    let v = ap(&c.m, g.frame3.road_pt(g.phi + d));
    if v[2] > 0.05 {
        let (sx, sy) = (c.cx + v[0] * c.r, c.cy - v[1] * c.r + c.bob);
        c.blit_z(spr, sx, sy, atan2(v[0], v[1]), true, 0.0, v[2] * c.r + 6.0, k);
    }
}

/// Shrinks the whole frame toward the planet's centre (k < 1), leaving the rest empty.
fn shrink(c: &mut Ctx, kx: f64, ky: f64) {
    let (w, h) = (c.fb.w, c.fb.h);
    let (cx, cy) = (c.cx, c.cy + c.bob);
    let src = c.fb.buf.clone();
    for y in 0..h {
        for x in 0..w {
            let sx = (cx + (x as f64 + 0.5 - cx) / kx).floor();
            let sy = (cy + (y as f64 + 0.5 - cy) / ky).floor();
            c.fb.buf[y * w + x] = if sx >= 0.0 && sy >= 0.0 && (sx as usize) < w && (sy as usize) < h { src[sy as usize * w + sx as usize] } else { 0 };
        }
    }
    c.fb.zb.fill(-1e9);
}

/// Tints every drawn pixel toward `col` by `k`.
fn tint(c: &mut Ctx, col: u32, k: f64) {
    for p in c.fb.buf.iter_mut() {
        let a = *p >> 24;
        if a == 0 {
            continue;
        }
        let rgb = ((*p & 255) << 16) | (*p & 0xff00) | ((*p >> 16) & 255);
        *p = pk(mixc(rgb, col, k), a);
    }
}

fn grad(y: f64, h: f64, x: f64, stops: &[u32]) -> u32 {
    let g = (y / h + (bayer(x as i32, y as i32) - 0.5) * 0.12).clamp(0.0, 0.999) * (stops.len() - 1) as f64;
    let i = g.floor() as usize;
    mixc(stops[i], stops[(i + 1).min(stops.len() - 1)], ((g - i as f64) * 3.0).floor() / 3.0)
}

/// The universes' colours, for the hunger's sky.
const UNIS: [u32; 12] = [0xc84a4a, 0x58b848, 0x8a6ad0, 0x9aa6b8, 0xf08ac0, 0x48d0a8, 0xe0473e, 0x8a5ac8, 0xe0a040, 0x6ab0e0, 0xb04a8a, 0x3a7a5a];

impl crate::scene::Scene {
    pub(crate) fn end_back(&mut self, c: &mut Ctx, g: &Game, view: &View) {
        let Some(e) = g.end.clone() else { return };
        let (w, h) = (c.w, c.h);
        match (e.v, e.stage) {
            (b'A', 1) => {
                // the hunger: eight universes' patches of sky have gone black; four still glow
                let spots: Vec<(f64, f64)> = (0..12).map(|i| (h2(i as f64, 3.0) * w, h2(i as f64, 9.0) * h * 0.8)).collect();
                sky(c, view, |x, y| {
                    let mut col = 0x07060e;
                    for (i, &(sx, sy)) in spots.iter().enumerate().take(4) {
                        let d = hypot(&[x - sx, y - sy]) / (w * 0.16);
                        if d < 1.0 && bayer(x as i32, y as i32) < (1.0 - d) * 0.9 {
                            col = mixc(0x1a1430, UNIS[i], 0.45 * (1.0 - d));
                        }
                    }
                    if stars_at(x, y, 0.993) && spots.iter().take(4).any(|&(sx, sy)| hypot(&[x - sx, y - sy]) < w * 0.2) {
                        col = 0xffffff;
                    }
                    col
                });
            }
            (b'A', _) => sky(c, view, |x, y| if stars_at(x, y, 0.9993) { 0x4a4a5a } else { 0x040408 }),
            (b'B', 1) | (b'B', 2) | (b'C', 3) => {}
            (b'C', 1) => sky(c, view, |x, y| if stars_at(x, y, 0.997) { 0x9fb8ff } else { grad(y, h, x, &[0x05061a, 0x0c1240, 0x1a1050]) }),
            (b'C', 2) => {}
            (b'D', 1) => sky(c, view, |x, y| grad(y, h, x, &[0x2a2060, 0x6a3a8a, 0xd0607a, 0xff9a5a, 0xffc070])),
            (b'D', 2) => sky(c, view, |x, y| if stars_at(x, y, 0.995) { 0xfff6d0 } else { grad(y, h, x, &[0x050820, 0x0a1438, 0x142050, 0x1e2a60]) }),
            (b'D', 3) => sky(c, view, |x, y| grad(y, h, x, &[0x7ab8f0, 0xa8d0f0, 0xf0e0c0, 0xffd090])),
            _ => {}
        }
    }

    pub(crate) fn end_front(&mut self, c: &mut Ctx, g: &Game, view: &View) {
        let Some(e) = g.end.clone() else { return };
        let a = e.age(c.t);
        match (e.v, e.stage) {
            (b'A', 1) => a1(c, g, a),
            (b'A', _) => {
                stand(c, g, sprite::get("KINGKAI"), -0.22, 0.9);
                let (hx, hy) = hero_head(g);
                glow(c, hx, hy + 10.0, c.r * 0.9, 0xffe8b0, 0.22);
            }
            (b'B', st @ (1 | 2)) => b12(c, view, a, st),
            (b'B', 3) => {
                stand(c, g, sprite::get("ZENO"), -0.3, 1.0);
            }
            (b'C', 1) => c1(c, g, a),
            (b'C', 2) => c2(c, view, a),
            (b'C', 3) => c3(c, view, a),
            (b'D', 1) => {
                tint(c, 0xff8a4a, 0.18);
                for (i, n) in ["PICCOLO", "KRILLIN", "BULMA", "ROSHI", "YAMCHA"].iter().enumerate() {
                    let d = [-0.22, -0.37, -0.52, -0.67, -0.82][i];
                    stand(c, g, sprite::get(n), d, 0.85);
                }
            }
            (b'D', 2) => {
                tint(c, 0x101a48, 0.45);
                stand(c, g, sprite::get("KINGKAI"), -0.22, 0.9);
                let v = ap(&c.m, g.frame3.road_pt(g.phi - 0.17));
                let (fx, fy) = (c.cx + v[0] * c.r, c.cy - v[1] * c.r + c.bob);
                glow(c, fx, fy - 2.0, c.r * 0.3, 0xffa040, 0.6);
                for i in 0..10 {
                    let k = (c.t * 1.3 + i as f64 * 0.37) % 1.0;
                    c.fb.px(fx + sin(i as f64 * 2.1 + c.t) * 3.0, fy - 3.0 - k * 16.0, [0xffe060, 0xff9a40][i % 2], 1.0 - k);
                }
            }
            (b'E', 1) => e1(c, a),
            (b'E', 2) => e2(c, view, a),
            _ => {}
        }
    }
}

/// A universe being eaten: its ring of colour collapses into him and its stars stream in.
fn a1(c: &mut Ctx, g: &Game, a: f64) {
    let (hx, hy) = hero_head(g);
    let col = 0x8a5ac8;
    let k = (a % 3.0) / 3.0;
    let rad = (1.0 - k) * c.w.max(c.h) * 0.8 + 6.0;
    let mut th = 0.0;
    while th < 6.283 {
        for j in 0..4 {
            let r = rad + j as f64 * 3.0;
            let (x, y) = (hx + cos(th) * r, hy + sin(th) * r * 0.8);
            if bayer(x as i32, y as i32) < 0.95 - j as f64 * 0.2 {
                c.fb.px(x, y, if j == 0 { 0xffffff } else { mixc(col, 0xff9ad8, j as f64 / 4.0) }, 0.9);
            }
        }
        th += 0.5 / rad;
    }
    for i in 0..48 {
        let ang = h2(i as f64, 1.0) * 6.283;
        let d0 = c.w * (0.25 + h2(i as f64, 2.0) * 0.6);
        let p = ((a * 0.6 + h2(i as f64, 4.0)) % 1.0).powi(2);
        let d = d0 * (1.0 - p);
        let (x, y) = (hx + cos(ang) * d, hy + sin(ang) * d * 0.8);
        let (x1, y1) = (hx + cos(ang) * (d + 8.0 + p * 18.0), hy + sin(ang) * (d + 8.0 + p * 18.0) * 0.8);
        line(c, x, y, x1, y1, mixc(col, 0xffffff, 0.5), 0.7);
        c.fb.px(x, y, 0xffffff, 1.0);
    }
    glow(c, hx, hy + 4.0, 26.0, 0xd8b0ff, 0.6);
    glow(c, hx, hy + 4.0, 12.0, 0xffffff, 0.8);
}

/// The pull-back: the world shrinks to a toy, the void opens round it and the zenos lean in.
fn b12(c: &mut Ctx, view: &View, a: f64, st: u8) {
    let k = if st == 1 { 0.62 - (a * 0.01).min(0.05) } else { 0.27 };
    shrink(c, k, k);
    let (cx, cy, r) = (c.cx, c.cy + c.bob, c.r * k);
    let (w, h) = (c.w, c.h);
    sky(c, view, |x, y| {
        if stars_at(x, y, 0.994) {
            return [0xffffff, 0xffe02e, 0x9fe6ff][(h2(y, x) * 3.0) as usize % 3];
        }
        let n = crate::top::vnoise(x * 0.03, y * 0.04);
        let base = grad(y, h, x, &[0x140a2a, 0x2a1450, 0x3a1a5a]);
        if n + bayer(x as i32, y as i32) * 0.2 > 0.78 {
            mixc(base, 0xb06ad0, 0.35)
        } else {
            base
        }
    });
    let zeno = sprite::get("ZENO");
    let pr = (c.r * 1.8).min(h * 0.5);
    let (w, h) = if view.bare { (pr * 2.0, cy + pr) } else if h > w { (w, cy + c.r * 1.25) } else { (w, h) };
    let x0 = if view.bare { cx - pr } else { 0.0 };
    if st == 1 {
        // they rise in from the bottom corners, looking at it
        let s = pr * 0.8 / zeno.h as f64;
        c.blit_z(zeno, x0 + w * 0.2, h + zeno.h as f64 * s * 0.3, 0.0, false, 0.0, 1e9, s);
        c.blit_z(zeno, x0 + w * 0.8, h + zeno.h as f64 * s * 0.3, 0.0, true, 0.0, 1e9, s);
    } else {
        let s = pr * 1.0 / zeno.h as f64;
        let dx = r + zeno.w as f64 * s * 0.55;
        c.blit_z(zeno, cx - dx, h + zeno.h as f64 * s * 0.18, 0.0, false, 0.0, 1e9, s);
        c.blit_z(zeno, cx + dx, h + zeno.h as f64 * s * 0.18, 0.0, true, 0.0, 1e9, s);
        for i in 0..8 {
            let th = i as f64 / 8.0 * 6.283 + c.t * 0.8;
            star(c, cx + cos(th) * (r + 8.0), cy + sin(th) * (r + 8.0), 1.0 + (sin(c.t * 5.0 + i as f64) * 0.5 + 0.5) * 1.5, [0xffe02e, 0xff9ad8, 0x9fe6ff][i % 3]);
        }
    }
}

/// Everything falls into him: the colour drains, the stars streak in.
fn c1(c: &mut Ctx, g: &Game, a: f64) {
    let (hx, hy) = hero_head(g);
    let w = c.fb.w;
    for k in 0..c.fb.buf.len() {
        let p = c.fb.buf[k];
        if p >> 24 == 0 {
            continue;
        }
        let (x, y) = ((k % w) as f64, (k / w) as f64);
        if hypot(&[x - hx, y - hy]) < 14.0 {
            continue;
        }
        let rgb = ((p & 255) << 16) | (p & 0xff00) | ((p >> 16) & 255);
        let l = (((rgb >> 16) & 255) as f64 * 0.3 + ((rgb >> 8) & 255) as f64 * 0.59 + (rgb & 255) as f64 * 0.11) / 255.0;
        c.fb.buf[k] = pk(mixc(rgb, mixc(0x0a0c30, 0x8a9ad8, l), 0.6), p >> 24);
    }
    for i in 0..90 {
        let ang = h2(i as f64, 7.0) * 6.283;
        let d0 = c.w.max(c.h) * (0.2 + h2(i as f64, 8.0) * 0.8);
        let p = (a * 0.35 + h2(i as f64, 5.0)) % 1.0;
        let d = d0 * (1.0 - p * p);
        let len = 6.0 + p * 40.0;
        let (x0, y0) = (hx + cos(ang) * d, hy + sin(ang) * d);
        let (x1, y1) = (hx + cos(ang) * (d + len), hy + sin(ang) * (d + len));
        line(c, x0, y0, x1, y1, [0x9fb8ff, 0xffffff, 0xffe8a0][i % 3], 0.75);
    }
    glow(c, hx, hy + 4.0, 40.0, 0xbfd0ff, 0.7);
    glow(c, hx, hy + 4.0, 16.0, 0xffffff, 1.0);
}

/// The bang: a white bloom with a ring of new colour racing out, and the first stars of a new universe.
fn c2(c: &mut Ctx, view: &View, a: f64) {
    let (cx, cy) = (c.cx, c.cy + c.bob);
    let rad = 30.0 + a * 46.0;
    let w = c.fb.w;
    let rr = c.r * 1.8;
    for k in 0..c.fb.buf.len() {
        let (x, y) = ((k % w) as f64, (k / w) as f64);
        let d = hypot(&[x - cx, y - cy]);
        if view.bare && bayer(x as i32, y as i32) > ((rr - d) / (rr * 0.18)).min(1.0) {
            c.fb.buf[k] = 0;
            continue;
        }
        let col = if d < rad - 10.0 {
            mixc(0xffffff, 0xfff4d0, (d / rad).powi(2))
        } else if d < rad + 6.0 {
            [0xff9ad8, 0xffe02e, 0x9fe6ff, 0xb59cff][((d - rad + 10.0) / 4.0) as usize % 4]
        } else if stars_at(x, y, 0.993) {
            [0xffffff, 0xffe8a0, 0x9fe6ff][(h2(y, x) * 3.0) as usize % 3]
        } else {
            grad(y, c.h, x, &[0x0a0828, 0x1a1050, 0x2a1460])
        };
        c.fb.buf[k] = pk(col, 255);
    }
}

/// A new world condenses: the planet grows out of a dust ring, and the old you shines overhead.
fn c3(c: &mut Ctx, view: &View, a: f64) {
    let k = (0.45 + a * 0.06).min(1.0);
    shrink(c, k, k);
    let (cx, cy, r) = (c.cx, c.cy + c.bob, c.r * k);
    let (w, h) = (c.w, c.h);
    sky(c, view, |x, y| if stars_at(x, y, 0.996) { 0xd8e0ff } else { grad(y, h, x, &[0x090620, 0x1a1050, 0x2a1a6a]) });
    for i in 0..140 {
        let th = h2(i as f64, 11.0) * 6.283 + c.t * 0.3;
        let rr = r * (1.35 + h2(i as f64, 12.0) * 0.45);
        let (x, y) = (cx + cos(th) * rr, cy + sin(th) * rr * 0.32);
        if sin(th) < 0.0 && hypot(&[x - cx, y - cy]) < r {
            continue;
        }
        c.fb.px(x, y, [0xc8a07a, 0x8a6a5a, 0xe8d0b0][i % 3], 0.9);
    }
    let pr = (c.r * 1.8).min(h * 0.5);
    let (sx, sy) = if view.bare { (cx - pr * 0.55, cy - pr * 0.55) } else { (w * 0.2, h * 0.16) };
    glow(c, sx, sy, 14.0, 0xfff0a0, 0.7);
    star(c, sx, sy, 4.0 + sin(c.t * 4.0), 0xffe02e);
}

/// The world tearing: bands slide, the red slips off, blocks invert.
fn e1(c: &mut Ctx, a: f64) {
    let (w, h) = (c.fb.w, c.fb.h);
    let seed = (a * 7.0).floor();
    let src = c.fb.buf.clone();
    for y in 0..h {
        let band = (y / 6) as f64;
        let off = if h2(band, seed) > 0.6 { ((h2(seed, band) - 0.5) * 40.0) as i64 } else { 0 };
        for x in 0..w {
            let sx = (x as i64 - off).rem_euclid(w as i64) as usize;
            let mut p = src[y * w + sx];
            let rx = (sx + w - 3) % w;
            let red = src[y * w + rx] & 255;
            if p >> 24 != 0 || red != 0 {
                p = (p & 0xffffff00) | red | 0xff000000;
            }
            c.fb.buf[y * w + x] = p;
        }
    }
    for b in 0..7 {
        let (bx, by) = ((h2(b as f64, seed + 1.0) * w as f64) as usize, (h2(seed + 2.0, b as f64) * h as f64) as usize);
        let (bw, bh) = (8 + (h2(b as f64, 5.0) * 40.0) as usize, 2 + (h2(5.0, b as f64) * 8.0) as usize);
        for y in by..(by + bh).min(h) {
            for x in bx..(bx + bw).min(w) {
                let p = c.fb.buf[y * w + x];
                if p >> 24 != 0 {
                    c.fb.buf[y * w + x] = (p & 0xff000000) | (!p & 0xffffff);
                }
            }
        }
    }
}

/// An old set switching off: the picture squashes to a line, then a dot.
fn e2(c: &mut Ctx, view: &View, a: f64) {
    let ky = (1.0 - a / 1.0).max(0.012);
    let kx = if a > 1.0 { (1.0 - (a - 1.0) / 1.2).max(0.04) } else { 1.0 };
    let (cx, cy) = (c.cx, c.cy + c.bob);
    shrink(c, kx, ky);
    let w = c.fb.w;
    let rr = c.r * 1.8;
    for k in 0..c.fb.buf.len() {
        let (x, y) = ((k % w) as f64, (k / w) as f64);
        if view.bare && bayer(x as i32, y as i32) > ((rr - hypot(&[x - cx, y - cy])) / (rr * 0.18)).min(1.0) {
            continue;
        }
        let p = c.fb.buf[k];
        if p >> 24 == 0 || (y - cy).abs() > 2.0 {
            c.fb.buf[k] = pk(0x000000, 255);
        } else {
            let rgb = ((p & 255) << 16) | (p & 0xff00) | ((p >> 16) & 255);
            c.fb.buf[k] = pk(mixc(rgb, 0xffffff, 0.6), 255);
        }
    }
    let half = c.w * kx * 0.5;
    line(c, cx - half, cy, cx + half, cy, 0xffffff, 1.0);
    glow(c, cx, cy, 10.0 + half * 0.1, 0x9fd8ff, 0.8);
    glow(c, cx, cy, 5.0, 0xffffff, 1.0);
}
