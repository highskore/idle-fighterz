//! A saga boss's arrival (planet-core's `intro`): Vegeta's scouter eyepiece (green glass, a dark frame, the white
//! housing and its red lamp) swings in small. Its reading climbs in small LCD digits while the glass swells to fill
//! the view, jitters, fills with static and cracks; it reads OVERLOAD and ERR, shatters across the whole view, and he
//! stands revealed, locked in red brackets. The LCD digits are the only text, and only inside the scouter. Reduced
//! motion keeps the glass still (no jitter, static or blinking) and lets the glass fall away gently. On the bare
//! widget the glass is fainter, so the desktop shows through it.
//!
//! Its random numbers are its own (seeded by the boss), so the game's stream is left alone.

use planet_core::big::Big;
use planet_core::intro::{BI_BLOW, BI_DUR, BI_LOCK};
use planet_core::jsmath::{atan2, cos, hypot, pow, sin};
use planet_core::num::{hud_fmt, js_round, to_fixed};
use planet_core::rng::Lcg;
use planet_core::Game;

use crate::scene::{Ctx, View};
use crate::top::mixc;
use crate::{h2, pk};

const LCD: u32 = 0x8dffae;
const LCD_D: u32 = 0x0a3a1a;
const RED: u32 = 0xff4a3a;
/// The glass starts to swell, and how long the shards fly.
const GROW: f64 = 1.0;
const FLY: f64 = 1.5;

struct Crack {
    pts: Vec<(f64, f64)>,
    at: f64,
}

struct Shard {
    x: f64,
    y: f64,
    vx: f64,
    vy: f64,
    g: f64,
    pts: [(f64, f64); 3],
    rot: f64,
    vr: f64,
}

#[derive(Clone, Copy)]
struct Lens {
    x: f64,
    y: f64,
    hw: f64,
    hh: f64,
    rot: f64,
    /// how far it has swelled toward the whole view
    gr: f64,
}

impl Lens {
    fn at(e: f64, w: f64, h: f64) -> Lens {
        let wide = w > h;
        let off = (1.0 - ease(e / 0.3)) * if wide { w * 0.6 } else { h * 0.6 };
        let (mut x, mut y) = if wide { (w * 0.66 + off, h * 0.5) } else { (w * 0.5, h * 0.25 - off) };
        let (mut hw, mut hh) = if wide { (w * 0.23, h * 0.37) } else { (w * 0.44, h * 0.17) };
        let mut rot = if wide { -0.07 } else { -0.05 };
        let gr = ease((e - GROW) / (BI_BLOW - GROW - 0.25));
        x += (w * 0.5 - x) * gr;
        y += (h * 0.5 - y) * gr;
        hw += (w * 0.58 - hw) * gr;
        hh += (h * 0.6 - hh) * gr;
        rot *= 1.0 - gr;
        Lens { x, y, hw, hh, rot, gr }
    }

    /// Signed distance to the rounded glass: negative inside.
    fn sd(&self, x: f64, y: f64) -> f64 {
        let cr = 9.0;
        let (ca, sa) = (cos(self.rot), sin(self.rot));
        let (dx, dy) = (x - self.x, y - self.y);
        let lx = (dx * ca + dy * sa).abs() - (self.hw - cr);
        let ly = (-dx * sa + dy * ca).abs() - (self.hh - cr);
        hypot(&[lx.max(0.0), ly.max(0.0)]) + lx.max(ly).min(0.0) - cr
    }

    /// A spot on the glass in its own units (-1 to 1 across).
    fn spot(&self, u: f64, v: f64) -> (f64, f64) {
        let (ca, sa) = (cos(self.rot), sin(self.rot));
        (self.x + u * self.hw * ca - v * self.hh * sa, self.y + u * self.hw * sa + v * self.hh * ca)
    }
}

/// One arrival's drawing state.
pub struct IntroFx {
    id: u32,
    rng: Lcg,
    o: (f64, f64),
    cracks: Vec<Crack>,
    shards: Vec<Shard>,
    last: Option<Lens>,
}

impl IntroFx {
    fn new(id: u32, t0: f64) -> Self {
        let mut rng = Lcg::new((t0 * 1000.0) as u32 ^ 0x5c0_7e75);
        let o = (-0.35 + rng.random() * 0.2, -0.3 + rng.random() * 0.2);
        let cracks = (0..10)
            .map(|i| {
                let mut a = i as f64 / 10.0 * 6.28 + rng.random() * 0.4;
                let (mut u, mut v) = o;
                let mut pts = vec![(u, v)];
                for _ in 0..8 {
                    a += (rng.random() - 0.5) * 0.8;
                    let l = 0.12 + rng.random() * 0.2;
                    u += cos(a) * l;
                    v += sin(a) * l * 1.6;
                    pts.push((u, v));
                }
                Crack { pts, at: i as f64 / 10.0 * 0.7 }
            })
            .collect();
        IntroFx { id, rng, o, cracks, shards: Vec::new(), last: None }
    }
}

fn ease(k: f64) -> f64 {
    let k = 0f64.max(1f64.min(k));
    k * k * (3.0 - 2.0 * k)
}

fn clamp01(k: f64) -> f64 {
    0f64.max(1f64.min(k))
}

fn rect(c: &mut Ctx, x: f64, y: f64, w: f64, h: f64, col: u32) {
    for j in 0..h.max(0.0) as i64 {
        for i in 0..w.max(0.0) as i64 {
            c.fb.px(x + i as f64, y + j as f64, col, 1.0);
        }
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

/// The scouter's own 3×5 LCD digits and the few letters it needs.
fn glyph(ch: char) -> &'static str {
    match ch {
        'A' => ".#.|#.#|###|#.#|#.#",
        'B' => "##.|#.#|##.|#.#|##.",
        'C' => "###|#..|#..|#..|###",
        'D' => "##.|#.#|#.#|#.#|##.",
        'E' => "###|#..|##.|#..|###",
        'G' => "###|#..|#.#|#.#|###",
        'I' => "###|.#.|.#.|.#.|###",
        'K' => "#.#|#.#|##.|#.#|#.#",
        'L' => "#..|#..|#..|#..|###",
        'M' => "#...#|##.##|#.#.#|#...#|#...#",
        'N' => "#..#|##.#|#.##|#..#|#..#",
        'O' => "###|#.#|#.#|#.#|###",
        'P' => "##.|#.#|##.|#..|#..",
        'Q' => "###|#.#|#.#|###|..#",
        'R' => "##.|#.#|##.|#.#|#.#",
        'S' => "###|#..|###|..#|###",
        'T' => "###|.#.|.#.|.#.|.#.",
        'V' => "#.#|#.#|#.#|#.#|.#.",
        'X' => "#.#|#.#|.#.|#.#|#.#",
        ',' => "..|..|..|.#|#.",
        '.' => ".|.|.|.|#",
        '0' => "###|#.#|#.#|#.#|###",
        '1' => ".#.|##.|.#.|.#.|###",
        '2' => "###|..#|###|#..|###",
        '3' => "###|..#|###|..#|###",
        '4' => "#.#|#.#|###|..#|..#",
        '5' => "###|#..|###|..#|###",
        '6' => "###|#..|###|#.#|###",
        '7' => "###|..#|.#.|.#.|.#.",
        '8' => "###|#.#|###|#.#|###",
        '9' => "###|#.#|###|..#|###",
        _ => "..|..|..|..|..",
    }
}

fn lcd_text(c: &mut Ctx, s: &str, x: f64, y: f64, col: u32) {
    let mut px = js_round(x);
    for ch in s.to_uppercase().chars() {
        let g = glyph(ch);
        let mut w = 0;
        for (j, row) in g.split('|').enumerate() {
            w = row.len();
            for (i, q) in row.bytes().enumerate() {
                if q == b'#' {
                    c.fb.px(px + i as f64, y + j as f64, col, 1.0);
                }
            }
        }
        px += w as f64 + 1.0;
    }
}

/// A line of the readout with its drop shadow.
fn lcd(c: &mut Ctx, s: &str, x: f64, y: f64, col: u32) {
    let (x, y) = (js_round(x), js_round(y));
    lcd_text(c, s, x + 1.0, y + 1.0, LCD_D);
    lcd_text(c, s, x, y, col);
}

/// The green of the glass over one pixel; `edge` darkens it toward the frame.
fn glass(buf: &mut [u32], k: usize, scan: f64, edge: f64, bare: bool) {
    let p = buf[k];
    let (r, g, b, al) = (p & 255, (p >> 8) & 255, (p >> 16) & 255, p >> 24);
    if al == 0 {
        // on the bare widget the glass is fainter, so the desktop shows through it
        let a = if bare { 90.0 + edge * 110.0 } else { 140.0 + edge * 115.0 };
        buf[k] = pk(mixc(0xbfeccb, 0x1f6a3a, edge), js_round(a * scan) as u32);
        return;
    }
    let l = (r as f64 * 0.3 + g as f64 * 0.59 + b as f64 * 0.11) / 255.0;
    let ch = |m: f64, a: f64| ((m * l + a).min(255.0) * scan) as u32;
    let gc = (ch(110.0, 8.0) << 16) | (ch(240.0, 30.0) << 8) | ch(140.0, 20.0);
    buf[k] = pk(mixc((r << 16) | (g << 8) | b, mixc(gc, 0x0a3a1a, edge * 0.6), 0.55), al);
}

impl crate::scene::Scene {
    /// The scouter over the finished frame, while a saga boss arrives.
    pub(crate) fn bi_draw(&mut self, c: &mut Ctx, g: &Game, view: &View) {
        let Some(b) = g.tl.boss.as_ref() else {
            self.bi = None;
            return;
        };
        let Some(i) = b.intro.as_ref() else {
            self.bi = None;
            return;
        };
        if self.bi.as_ref().is_none_or(|f| f.id != b.id) {
            self.bi = Some(IntroFx::new(b.id, i.t0));
        }
        let fx = self.bi.as_mut().unwrap();
        let (t, w, h, calm, bare) = (c.t, c.w, c.h, g.calm, view.bare);
        let e = i.e(t);
        let be = e - BI_BLOW;
        let stress = clamp01((e - 0.8) / (BI_BLOW - 0.8));
        let inc = clamp01((e - 0.35) / (BI_LOCK - 0.55));
        let spr = b.spr();
        // where he'll stand, and where the reading comes from: off the view, up and to his right
        let ent = 1f64.min((t - b.t0) / 1.2);
        let (px0, py0) = (b.x - (1.0 - ent.max(0.0)) * w * 0.4, b.y - spr.h * b.k * 0.5);
        let from = (px0 + w * 0.4, py0 - h * 0.3);
        if be < 0.0 {
            let ln = Lens::at(e, w, h);
            fx.last = Some(ln);
            let wide = w > h;
            let by = if wide { ln.y + ln.hh * 0.15 } else { ln.y + ln.hh + 4.0 };
            // the band to his ear, under the frame
            if wide {
                let bx0 = ln.x + ln.hw - 4.0;
                if bx0 < w {
                    rect(c, js_round(bx0), js_round(by) - 4.0, js_round(w - bx0), 9.0, 0x23262e);
                    rect(c, js_round(bx0), js_round(by) - 3.0, js_round(w - bx0), 7.0, 0xd8d8e2);
                    rect(c, js_round(bx0), js_round(by) + 2.0, js_round(w - bx0), 2.0, 0xa8a8b8);
                }
            }
            // the glass, with the overload inside it: rows jitter, static, a glint
            let ext = hypot(&[ln.hw, ln.hh]) + 8.0;
            let (fw, fh) = (c.fb.w as i64, c.fb.h as i64);
            let y0 = 0.max((ln.y - ext).floor() as i64);
            let y1 = fh.min((ln.y + ext).ceil() as i64);
            let x0 = 0.max((ln.x - ext).floor() as i64);
            let x1 = fw.min((ln.x + ext).ceil() as i64);
            let ft = (t * 30.0).floor();
            let mut row = vec![0u32; fw as usize];
            for y in y0..y1 {
                let jit = if !calm && stress > 0.3 && h2((y >> 1) as f64, ft) > 1.0 - stress * 0.3 {
                    js_round((h2(y as f64, ft) - 0.5) * 18.0 * stress) as i64
                } else {
                    0
                };
                let base = (y * fw) as usize;
                if jit != 0 {
                    row.copy_from_slice(&c.fb.buf[base..base + fw as usize]);
                }
                for x in x0..x1 {
                    let d = ln.sd(x as f64 + 0.5, y as f64 + 0.5);
                    if d > 4.5 {
                        continue;
                    }
                    let k = base + x as usize;
                    if d > 0.0 {
                        c.fb.buf[k] = pk(
                            if d < 1.3 {
                                0x6a7080
                            } else if d < 3.4 {
                                0x2c3038
                            } else {
                                0x14161c
                            },
                            255,
                        );
                        continue;
                    }
                    if jit != 0 {
                        c.fb.buf[k] = row[(x + jit).clamp(0, fw - 1) as usize];
                    }
                    let edge = 0f64.max(1.0 + d / 10.0);
                    glass(&mut c.fb.buf, k, if y % 3 == 0 { 0.84 } else { 1.0 }, edge * 0.8, bare);
                    if ((x as f64 - ln.x) + (y as f64 - ln.y) * 0.9 + ln.hw * 0.35).abs() < 2.5 {
                        let p = c.fb.buf[k];
                        let rgb = ((p & 255) << 16) | (p & 0xff00) | ((p >> 16) & 255);
                        c.fb.buf[k] = pk(mixc(rgb, 0xffffff, 0.3), p >> 24);
                    }
                    if !calm && stress > 0.35 && h2(x as f64 + (t * 50.0).floor() * 7.0, y as f64) > 1.0 - (stress - 0.35) * 0.05 {
                        c.fb.buf[k] = pk(0xeaffe0, 255);
                    }
                }
            }
            // cracks run across the glass
            for cr in &fx.cracks {
                if stress < cr.at {
                    continue;
                }
                let n = (cr.pts.len() as f64 * 1f64.min((stress - cr.at) * 2.5 + 0.2)).ceil() as usize;
                for s in 1..n.min(cr.pts.len()) {
                    let (ax, ay) = ln.spot(cr.pts[s - 1].0, cr.pts[s - 1].1);
                    let (bx, by2) = ln.spot(cr.pts[s].0, cr.pts[s].1);
                    let m = 1f64.max((hypot(&[bx - ax, by2 - ay]) * 1.5).ceil());
                    let mut q = 0.0;
                    while q <= m {
                        let (x, y) = (ax + (bx - ax) * q / m, ay + (by2 - ay) * q / m);
                        if ln.sd(x, y) < -1.0 {
                            c.fb.px(x, y, 0xffffff, 1.0);
                            c.fb.px(x + 1.0, y + 1.0, LCD_D, 0.7);
                        }
                        q += 1.0;
                    }
                }
            }
            // the housing and its lamp, until the glass is most of the view
            let hx = js_round(if wide { ln.x + ln.hw - 6.0 } else { ln.x + ln.hw - 26.0 });
            let hy = js_round(if wide { by - 9.0 } else { ln.y + ln.hh - 3.0 });
            if hx < w - 2.0 && hy > -16.0 && ln.gr < 0.6 {
                let lamp = if calm || (t * 4.0).floor() as i64 % 2 == 1 { 0xff4a3a } else { 0x8a1a10 };
                rect(c, hx, hy, 14.0, 18.0, 0x14161c);
                rect(c, hx + 1.0, hy + 1.0, 12.0, 16.0, 0xeeeef4);
                rect(c, hx + 1.0, hy + 13.0, 12.0, 3.0, 0xb8b8c8);
                rect(c, hx + 4.0, hy + 4.0, 5.0, 4.0, lamp);
            }
            // inside: a marker on the glass's edge toward where he comes from, pinging
            let (bx0, by0, bx1, by1) = (ln.x - ln.hw + 6.0, ln.y - ln.hh + 6.0, ln.x + ln.hw - 6.0, ln.y + ln.hh - 6.0);
            let (dx, dy) = (from.0 - px0, from.1 - py0);
            let m = 9.0;
            let tx = if dx > 0.0 { (bx1 - m - px0) / dx } else { (bx0 + m - px0) / dx };
            let ty = if dy > 0.0 { (by1 - m - py0) / dy } else { (by0 + m - py0) / dy };
            let tt = tx.min(ty);
            let (mx, my) = (px0 + dx * tt, py0 + dy * tt);
            let l = hypot(&[dx, dy]);
            let (ux, uy) = (dx / l, dy / l);
            if e > 0.3 && ln.sd(mx, my) < -2.0 {
                for k in 0..3 {
                    let r = ((e * 1.6 + k as f64 / 3.0) % 1.0) * 26.0;
                    let a = 1.0 - r / 26.0;
                    let mut q = -1.2;
                    while q <= 1.2 {
                        let ang = atan2(-uy, -ux) + q;
                        c.fb.px(mx + cos(ang) * r, my + sin(ang) * r, 0xc8ffd8, a * 0.9);
                        q += 0.04;
                    }
                }
                let col = if calm || (t * 6.0).floor() as i64 % 2 == 1 { RED } else { 0xffb08a };
                let n = 9.0;
                let mut j = 0.0;
                while j < n {
                    let mut i2 = -j;
                    while i2 <= j {
                        let (ax, ay) = (mx - ux * (n - j) - uy * i2 * 0.75, my - uy * (n - j) + ux * i2 * 0.75);
                        c.fb.px(ax, ay, if i2.abs() >= j - 0.5 || j >= n - 0.5 { LCD_D } else { col }, 1.0);
                        i2 += 0.5;
                    }
                    j += 0.5;
                }
            }
            // the readout, climbing until it can't
            let over = stress > 0.85;
            let err = !calm && (t * 10.0).floor() as i64 % 2 == 1;
            let val = if e >= BI_LOCK { 1.0 } else { (1.08f64).min(pow(inc, 1.7) * (1.0 + (h2((t * 20.0).floor(), 3.0) - 0.5) * 0.25 * (1.0 - inc * 0.6))) };
            let tx = js_round(8f64.max(ln.x - ln.hw + 10.0));
            let ty = js_round(if wide { (h - 40.0).min(ln.y + ln.hh - 38.0) } else { 26f64.max(ln.y - ln.hh + 10.0) });
            let km = to_fixed(9.6 * (1.0 - inc) + 0.05, 1) + " KM";
            let num = hud_fmt(js_round(i.read * Big::from(val)));
            lcd(c, if over { "OVERLOAD" } else { "INCOMING" }, tx, ty, if over { RED } else { LCD });
            let shown = if !over {
                num
            } else if err {
                "999,999,999".into()
            } else {
                "ERR ERR ERR".into()
            };
            lcd(c, &shown, tx, ty + 8.0, if over { 0xffffff } else { LCD });
            lcd(c, &km, tx, ty + 16.0, LCD);
            let bw = 40.0;
            rect(c, tx, ty + 24.0, bw, 3.0, LCD_D);
            let f = val.min(1.0);
            rect(
                c,
                tx,
                ty + 24.0,
                js_round(bw * f),
                3.0,
                if over && err {
                    0xffffff
                } else if f > 0.8 {
                    RED
                } else {
                    LCD
                },
            );
            for k in 0..=4 {
                c.fb.px(tx + k as f64 * bw / 4.0, ty + 28.0, LCD, 1.0);
            }
        }
        // the shatter: the whole view's glass flies apart
        if (0.0..FLY).contains(&be) {
            let ln = fx.last.unwrap_or_else(|| Lens::at(BI_BLOW, w, h));
            if fx.shards.is_empty() {
                let (ox, oy) = ln.spot(fx.o.0, fx.o.1);
                let (n, sp0) = if calm { (24, 40.0) } else { (40, 120.0) };
                for _ in 0..n {
                    let r = &mut fx.rng;
                    let (x, y) = ln.spot(r.random() * 2.0 - 1.0, r.random() * 2.0 - 1.0);
                    let a = atan2(y - oy, x - ox);
                    let sp = sp0 + r.random() * sp0 * 1.3;
                    let z = 5.0 + r.random() * 12.0;
                    let mut pts = [(0.0, 0.0); 3];
                    for (k, p) in pts.iter_mut().enumerate() {
                        let q = k as f64 * 2.1 + r.random() * 0.9;
                        *p = (cos(q) * z, sin(q) * z);
                    }
                    let rot = r.random() * 6.0;
                    let vr = (r.random() - 0.5) * if calm { 3.0 } else { 9.0 };
                    fx.shards.push(Shard { x, y, vx: cos(a) * sp, vy: sin(a) * sp - 30.0, g: 110.0, pts, rot, vr });
                }
            }
            let a = 1.0 - be / FLY;
            for sh in &fx.shards {
                let (x, y) = (sh.x + sh.vx * be, sh.y + sh.vy * be + sh.g * be * be * 0.5);
                let r = sh.rot + sh.vr * be;
                let p3 = sh.pts.map(|(px, py)| (x + px * cos(r) - py * sin(r), y + px * sin(r) + py * cos(r)));
                let (lx, hx) = (p3.iter().map(|p| p.0).fold(f64::MAX, f64::min), p3.iter().map(|p| p.0).fold(f64::MIN, f64::max));
                let (ly, hy) = (p3.iter().map(|p| p.1).fold(f64::MAX, f64::min), p3.iter().map(|p| p.1).fold(f64::MIN, f64::max));
                let mut yy = 0f64.max(ly.floor());
                while yy <= (h - 1.0).min(hy) {
                    let mut xx = 0f64.max(lx.floor());
                    while xx <= (w - 1.0).min(hx) {
                        let inside = (0..3).all(|k| {
                            let (ax, ay) = p3[k];
                            let (bx, by) = p3[(k + 1) % 3];
                            let (qx, qy) = p3[(k + 2) % 3];
                            ((bx - ax) * (yy - ay) - (by - ay) * (xx - ax)) * ((bx - ax) * (qy - ay) - (by - ay) * (qx - ax)) >= 0.0
                        });
                        if inside {
                            c.fb.px(xx, yy, 0x8de8a8, 0.7 * a);
                        }
                        xx += 1.0;
                    }
                    yy += 1.0;
                }
                line(c, p3[0].0, p3[0].1, p3[1].0, p3[1].1, 0xffffff, a);
                line(c, p3[1].0, p3[1].1, p3[2].0, p3[2].1, 0xeaffe0, a * 0.8);
                line(c, p3[2].0, p3[2].1, p3[0].0, p3[0].1, 0x2c8a4a, a * 0.8);
            }
        }
        // locked: red brackets close in on him
        if be >= 0.0 && e < BI_DUR {
            let lk = ease(be / 0.22);
            let bw = spr.w * b.k * 0.62 + 3.0 + (1.0 - lk) * w * 0.4;
            let bh = spr.h * b.k * 0.55 + 3.0 + (1.0 - lk) * h * 0.4;
            let (ccx, ccy) = (b.x, b.y - spr.h * b.k * 0.5);
            let col = if lk >= 1.0 && !calm && (t * 8.0).floor() as i64 % 2 == 1 { 0xffffff } else { RED };
            let a = 6.0;
            for (sx, sy) in [(-1.0, -1.0), (1.0, -1.0), (-1.0, 1.0), (1.0, 1.0)] {
                let (x, y) = (ccx + sx * bw, ccy + sy * bh);
                for wd in [0.0, 1.0] {
                    line(c, x - sx * wd, y - sy * wd, x - sx * a, y - sy * wd, col, 1.0);
                    line(c, x - sx * wd, y - sy * wd, x - sx * wd, y - sy * a, col, 1.0);
                }
            }
        }
    }
}
