//! planet-core's `limits` drawn: a limit breaking and the named milestones.
//!
//! - A limit breaks as **time stops**: the world drains to violet-grey and the grand priest's halo, ringed with clock
//!   ticks, settles over the planet; he alone stays in colour, the frozen world cracks round him as he pushes, then the
//!   colour floods back out from him in a ring and the halo lifts away. No flash.
//! - A milestone is **the sky reacting**, with no one on screen: a green scouter wave sweeping out and every scouter in
//!   the sky popping (1e10); the sky splitting open on the gods' realm (1e100, and red for beerus at infinity); claps of
//!   thunder in gold, rings racing out from the planet and stars raining (zeno, the grand priest).
//!
//! Its random numbers are its own (seeded by when the scene started), so the game's stream is left alone. Reduced
//! motion keeps the colours and shapes and drops the sky flashes.

use planet_core::jsmath::{cos, hypot, sin};
use planet_core::limits::{Kind, Moment, BREAK_UP, MILE_HIT};
use planet_core::rng::Lcg;
use planet_core::Game;

use crate::scene::{Ctx, View};
use crate::top::mixc;
use crate::{bayer, pk};

pub struct MoFx {
    t0: f64,
    rng: Lcg,
    cracks: Vec<Vec<(f64, f64)>>,
    pops: Vec<(f64, f64, f64)>,
}

/// How a named milestone plays (`Kind::Mile` index): past the table they take turns.
#[derive(Clone, Copy, PartialEq)]
enum Sky {
    /// the scouter wave; its pops' colour
    Scan(u32),
    /// the sky splits; its realm's two colours
    Rift(u32, u32),
    /// claps of thunder: how many, and the colours
    Claps(u32, [u32; 3]),
}

const GOLD: [u32; 3] = [0xffffff, 0xffe02e, 0xff9ad8];
const PALE: [u32; 3] = [0xffffff, 0xd8ecff, 0x9fe6ff];

fn sky_of(k: u32) -> Sky {
    match k {
        0 => Sky::Scan(0x9cf0b8),
        1 => Sky::Rift(0x3a1c6a, 0xb89cff),
        2 => Sky::Rift(0x4a0e1a, 0xff8a5a),
        3 => Sky::Claps(2, GOLD),
        4 => Sky::Claps(2, PALE),
        5 => Sky::Claps(4, GOLD),
        6 => Sky::Scan(0xffe02e),
        _ => sky_of([1, 2, 3, 4, 6][((k - 7) % 5) as usize]),
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

fn disc(c: &mut Ctx, x: f64, y: f64, r: f64, col: u32, a: f64) {
    let mut yy = (y - r).floor();
    while yy <= y + r {
        let mut xx = (x - r).floor();
        while xx <= x + r {
            let (dx, dy) = (xx + 0.5 - x, yy + 0.5 - y);
            if dx * dx + dy * dy <= r * r {
                c.fb.px(xx, yy, col, a);
            }
            xx += 1.0;
        }
        yy += 1.0;
    }
}

/// A soft dithered glow: thinner away from the centre.
fn glow(c: &mut Ctx, x: f64, y: f64, r: f64, col: u32, k: f64) {
    let mut yy = (y - r).floor();
    while yy <= y + r {
        let mut xx = (x - r).floor();
        while xx <= x + r {
            let d = hypot(&[xx + 0.5 - x, yy + 0.5 - y]) / r;
            if d < 1.0 && bayer(xx as i32, yy as i32) < (1.0 - d) * (1.0 - d) * k {
                c.fb.px(xx, yy, col, 1.0);
            }
            xx += 1.0;
        }
        yy += 1.0;
    }
}

/// A four-point twinkle.
fn star(c: &mut Ctx, x: f64, y: f64, s: f64, col: u32) {
    for i in -(s as i32)..=(s as i32) {
        let a = 1.0 - (i.abs() as f64) / (s + 1.0);
        c.fb.px(x + i as f64, y, col, a);
        c.fb.px(x, y + i as f64, col, a);
    }
    c.fb.px(x, y, 0xffffff, 1.0);
}

/// A crack: a jagged walk from (0, 0) heading `ang`, with branches.
fn crack(rng: &mut Lcg, ang: f64, len: f64, out: &mut Vec<Vec<(f64, f64)>>, depth: u32) {
    let mut p = vec![(0.0, 0.0)];
    let (mut x, mut y, mut a) = (0.0, 0.0, ang);
    let mut d = 0.0;
    while d < len {
        let st = 3.0 + rng.random() * 5.0;
        a += (rng.random() - 0.5) * 0.9;
        x += cos(a) * st;
        y += sin(a) * st;
        d += st;
        p.push((x, y));
        if depth < 2 && rng.random() < 0.18 {
            let sa = a + (rng.random() - 0.5) * 2.2;
            let mut sub = Vec::new();
            crack(rng, sa, (len - d) * 0.6, &mut sub, depth + 1);
            out.extend(sub.into_iter().map(|s| s.into_iter().map(|q| (q.0 + x, q.1 + y)).collect()));
        }
    }
    out.push(p);
}

fn hero_head(g: &Game) -> (f64, f64) {
    let k = g.kid_screen(g.lift_now);
    (k.x + sin(k.ang) * 17.0, k.y - cos(k.ang) * 17.0)
}

impl crate::scene::Scene {
    fn mo_sync(&mut self, g: &Game) -> Option<Moment> {
        let m = g.mo.clone()?;
        if self.mo.as_ref().is_none_or(|f| f.t0 != m.t0) {
            self.mo = Some(MoFx { t0: m.t0, rng: Lcg::new((m.t0 * 1000.0) as u32 ^ 0xce11), cracks: Vec::new(), pops: Vec::new() });
        }
        Some(m)
    }

    /// Behind the planet: the sky splitting open.
    pub(crate) fn mo_back(&mut self, c: &mut Ctx, g: &Game) {
        let Some(m) = self.mo_sync(g) else {
            self.mo = None;
            return;
        };
        if let Kind::Mile(k) = m.kind {
            if let Sky::Rift(a, b) = sky_of(k) {
                rift(c, m.age(c.t), a, b);
            }
        }
    }

    /// Over everything, before the flash.
    pub(crate) fn mo_front(&mut self, c: &mut Ctx, g: &mut Game, view: &View) {
        let Some(m) = self.mo_sync(g) else { return };
        let a = m.age(c.t);
        match m.kind {
            Kind::Break(_) => self.timestop(c, g, view, a),
            Kind::Mile(k) => match sky_of(k) {
                Sky::Scan(col) => self.scan(c, g, a, col),
                Sky::Rift(..) => {
                    let hit = a - MILE_HIT;
                    if (0.0..0.5).contains(&hit) {
                        glow(c, c.cx, c.cy + c.bob - c.r * 1.6, c.r * 1.2, 0xffffff, 0.6 * (1.0 - hit * 2.0));
                    }
                }
                Sky::Claps(n, cols) => self.claps(c, g, view, a, n, cols),
            },
        }
    }

    fn timestop(&mut self, c: &mut Ctx, g: &Game, view: &View, a: f64) {
        let (hx, hy) = hero_head(g);
        let (cx, cy) = (c.cx, c.cy + c.bob);
        let freeze = ((a - 0.25) / 0.3).clamp(0.0, 1.0);
        let b = a - BREAK_UP;
        // the colour comes back in a ring from him
        let back = if b < 0.0 { -1.0 } else { b * 240.0 };
        if freeze > 0.0 && back < c.w * 1.5 {
            let w = c.fb.w;
            for k in 0..c.fb.buf.len() {
                let v = c.fb.buf[k];
                let (x, y) = ((k % w) as f64, (k / w) as f64);
                let d = hypot(&[x - hx, y - hy]);
                if v >> 24 == 0 {
                    // the page's sky behind the canvas gets a violet-grey veil (the widget keeps its desktop)
                    if !view.bare && d >= back && bayer(x as i32, y as i32) < freeze * 0.4 {
                        c.fb.buf[k] = pk(0x6a5a8a, 255);
                    }
                    continue;
                }
                if d < 9.0 || d < back {
                    if back > 0.0 && (d - back).abs() < 2.5 {
                        c.fb.buf[k] = pk(0xffffff, 255);
                    }
                    continue;
                }
                let (r, gg, bb) = ((v & 255) as f64, ((v >> 8) & 255) as f64, ((v >> 16) & 255) as f64);
                let l = (r * 0.3 + gg * 0.59 + bb * 0.11) / 255.0;
                let col = mixc(((r as u32) << 16) | ((gg as u32) << 8) | bb as u32, mixc(0x241a3c, 0xe2dcf4, l), freeze);
                c.fb.buf[k] = pk(col, v >> 24);
            }
        }
        // the halo, ringed with clock ticks, settling over the planet and lifting away
        let hk = if b < 0.0 { ((a - 0.4) / 1.2).clamp(0.0, 1.0) } else { (1.0 - b / 1.4).max(0.0) };
        if hk > 0.0 {
            let hy0 = (cy - c.r * 1.25).max(c.r * 0.3) - (1.0 - hk) * 20.0 - b.max(0.0) * 30.0;
            let (rx, ry) = (c.r * 0.95, c.r * 0.2);
            let mut th = 0.0;
            while th < 6.283 {
                let (x, y) = (cx + cos(th) * rx, hy0 + sin(th) * ry);
                c.fb.px(x, y, 0xfff6d0, hk);
                c.fb.px(x, y + 1.0, 0xffd860, hk * 0.8);
                th += 0.5 / rx;
            }
            for i in 0..12 {
                let th = i as f64 / 12.0 * 6.283 + if g.calm { 0.0 } else { a * 0.4 };
                let (x, y) = (cx + cos(th) * (rx + 4.0), hy0 + sin(th) * (ry + 2.0));
                c.fb.px(x, y, 0xffffff, hk);
                c.fb.px(x, y - 1.0, 0xffffff, hk * 0.7);
            }
            glow(c, cx, hy0, c.r * 0.6, 0xfff6d0, 0.25 * hk);
        }
        // the frozen world cracks round him as he pushes
        let fx = self.mo.as_mut().unwrap();
        if fx.cracks.is_empty() {
            for i in 0..11 {
                let ang = i as f64 / 11.0 * 6.283 + fx.rng.random() * 0.4;
                let len = 30.0 + fx.rng.random() * 50.0;
                crack(&mut fx.rng, ang, len, &mut fx.cracks, 0);
            }
        }
        if b < 0.0 && a > 1.3 {
            let k = ((a - 1.3) / (BREAK_UP - 1.4)).min(1.0);
            let cr = std::mem::take(&mut fx.cracks);
            for p in &cr {
                let n = ((p.len() as f64 - 1.0) * k).floor() as usize;
                for q in p.windows(2).take(n) {
                    line(c, hx + q[0].0 + 1.0, hy + q[0].1, hx + q[1].0 + 1.0, hy + q[1].1, 0x8a7ab8, 0.6);
                    line(c, hx + q[0].0, hy + q[0].1, hx + q[1].0, hy + q[1].1, 0xffffff, 1.0);
                }
            }
            self.mo.as_mut().unwrap().cracks = cr;
        }
        // his aura flares as he pushes, and settles
        let k = if b < 0.0 { a / BREAK_UP } else { (-(b) * 1.5).exp() };
        glow(c, hx, hy + 6.0, 14.0 + k * 16.0, 0xfff1a0, 0.5 * k);
        glow(c, hx, hy + 6.0, 8.0 + k * 8.0, 0xffffff, 0.6 * k);
    }

    /// The scouter wave from him, out past the card, and every scouter in the sky popping as it passes.
    fn scan(&mut self, c: &mut Ctx, g: &Game, a: f64, col: u32) {
        let (hx, hy) = hero_head(g);
        let reach = c.w.max(c.h) * 1.1;
        if a < MILE_HIT + 0.3 {
            let rad = a / MILE_HIT * reach;
            let mut th = 0.0;
            while th < 6.283 {
                for j in 0..4 {
                    let (x, y) = (hx + cos(th) * (rad - j as f64 * 2.0), hy + sin(th) * (rad - j as f64 * 2.0) * 0.75);
                    if bayer(x as i32, y as i32) < 0.9 - j as f64 * 0.22 {
                        c.fb.px(x, y, if j == 0 { 0xffffff } else { col }, 0.9);
                    }
                }
                th += 0.6 / rad.max(4.0);
            }
        }
        let fx = self.mo.as_mut().unwrap();
        if fx.pops.is_empty() {
            for _ in 0..46 {
                let (x, y) = (fx.rng.random() * c.w, fx.rng.random() * c.h * 0.85);
                let d = hypot(&[x - hx, (y - hy) / 0.75]) / reach;
                fx.pops.push((x, y, d * MILE_HIT + 0.1 + fx.rng.random() * 0.25));
            }
        }
        let pops = fx.pops.clone();
        for &(x, y, t0) in &pops {
            let k = a - t0;
            if (0.0..1.4).contains(&k) {
                if k < 0.18 {
                    disc(c, x, y, 2.0 + k * 40.0, 0xffffff, 1.0 - k * 4.0);
                    disc(c, x, y, 2.0 + k * 26.0, col, 1.0);
                }
                glow(c, x, y - k * 8.0, 3.0 + k * 8.0, 0x9a9a9a, (1.0 - k / 1.4) * 1.1);
            }
        }
    }

    /// Claps of thunder: the sky flashes, rings race out from the planet, and stars rain.
    fn claps(&mut self, c: &mut Ctx, g: &Game, view: &View, a: f64, n: u32, cols: [u32; 3]) {
        let hit = a - MILE_HIT;
        let (cx, cy) = (c.cx, c.cy + c.bob);
        for i in 0..n {
            let k = hit - i as f64 * 0.45;
            if !(0.0..1.6).contains(&k) {
                continue;
            }
            if k < 0.12 && !view.bare && !g.calm {
                let w = c.fb.w;
                for p in 0..c.fb.buf.len() {
                    if c.fb.zb[p] < -1e8 && bayer((p % w) as i32, (p / w) as i32) < 0.55 - k * 4.0 {
                        c.fb.buf[p] = pk(mixc(cols[1], 0xffffff, 0.5), 255);
                    }
                }
            }
            let rad = c.r * 1.1 + k * c.w * 0.7;
            let mut th = 0.0;
            while th < 6.283 {
                for j in 0..3 {
                    let (x, y) = (cx + cos(th) * (rad - j as f64 * 3.0), cy + sin(th) * (rad - j as f64 * 3.0));
                    c.fb.px(x, y, cols[(j + i as usize) % 3], (1.0 - k / 1.6) * (1.0 - j as f64 * 0.25));
                }
                th += 0.6 / rad;
            }
        }
        if hit > 0.0 && hit < 3.2 {
            let fx = self.mo.as_mut().unwrap();
            if fx.pops.is_empty() {
                for _ in 0..40 {
                    fx.pops.push((fx.rng.random() * c.w, -fx.rng.random() * c.h * 0.6, 0.0));
                }
            }
            let pops = fx.pops.clone();
            for (i, &(x, y, _)) in pops.iter().enumerate() {
                let yy = y + hit * (60.0 + (i % 5) as f64 * 14.0);
                let s = 1.0 + ((c.t * 9.0 + i as f64).sin() * 0.5 + 0.5) * 2.0;
                star(c, x + sin(hit * 2.0 + i as f64) * 4.0, yy, s, [cols[1], cols[2], 0xffffff, 0x9fe6ff][i % 4]);
            }
        }
    }
}

/// The sky splits open behind the planet on a starry realm, then seals.
fn rift(c: &mut Ctx, a: f64, deep: u32, lit: u32) {
    let open = if a < MILE_HIT { (a / MILE_HIT).powi(2) } else { (1.0 - (a - 3.2) / 1.2).clamp(0.0, 1.0) };
    if open <= 0.0 {
        return;
    }
    let (cx, w, h) = (c.cx, c.w, c.h);
    let half = (w * 0.13).max(14.0) * open;
    for y in 0..h as i64 {
        let yf = y as f64;
        let jag = (crate::h2(0.0, (yf / 3.0).floor()) - 0.5) * 6.0 + sin(yf * 0.05) * 6.0;
        let hw = half * (1.0 - ((yf - h * 0.42) / (h * 0.6)).powi(2)).max(0.0);
        if hw < 0.5 {
            continue;
        }
        let (x0, x1) = (cx + jag - hw, cx + jag + hw);
        let mut x = x0.floor();
        while x <= x1 {
            let e = ((x - x0).min(x1 - x)) / hw.max(1.0);
            let col = if e < 0.12 {
                0xffffff
            } else if e < 0.25 {
                mixc(lit, 0xffffff, 0.6)
            } else if crate::h2(x, yf) > 0.97 {
                0xffffff
            } else {
                mixc(mixc(deep, lit, (sin(x * 0.08 + yf * 0.03) * 0.5 + 0.5) * 0.9), 0xffe8a0, (e - 0.25).max(0.0) * 0.5 * (sin(yf * 0.11) * 0.5 + 0.5))
            };
            c.fb.px(x, yf, col, 1.0);
            x += 1.0;
        }
        for o in 1..4 {
            let of = o as f64;
            if bayer((x0 - of) as i32, y as i32) < 0.5 - of * 0.12 {
                c.fb.px(x0 - of, yf, mixc(lit, 0xffffff, 0.7), 1.0);
            }
            if bayer((x1 + of) as i32, y as i32) < 0.5 - of * 0.12 {
                c.fb.px(x1 + of, yf, mixc(lit, 0xffffff, 0.7), 1.0);
            }
        }
    }
}
