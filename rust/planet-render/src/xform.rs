//! The transformation scene (planet-core's `xform`): the sky goes dark behind the planet and one enormous アア! shout
//! sits behind it, cropped by the card and shaking harder as he powers up; rocks tear loose and rise, lightning
//! strikes, his aura (the tap meter) swells, a column of light punches up out of him. When the form lands: the flash,
//! a sunburst in the form's colours, the rocks flung away. Reduced motion keeps it still: no shake, no lightning, no
//! flicker or flash, and a sunburst that doesn't turn.
//!
//! Its random numbers are its own (seeded by when the scene started), so the game's stream is left alone.

use planet_core::data::{ALL_FORMS, FORM_AURA};
use planet_core::geom::{add, ap, norm, V3};
use planet_core::jsmath::{atan2, cos, hypot, pow, sin};
use planet_core::num::js_round;
use planet_core::rng::Lcg;
use planet_core::xform::XForm;
use planet_core::Game;

use crate::scene::{Ctx, View};
use crate::top::{mixc, vnoise};
use crate::{bayer, h2};

const TAU: f64 = 6.2832;
const ROCK_O: u32 = 0x1e100a;
const ROCK_T: [u32; 4] = [0x3e2216, 0x5c341f, 0x7d4a2b, 0xa06a40];

struct Rock {
    c: V3,
    r: f64,
    /// how far he's powered up when it tears loose
    at: f64,
    sp: f64,
    ph: f64,
    at_screen: Option<(f64, f64)>,
    /// flung at the reveal: x, y, vx, vy
    fl: Option<[f64; 4]>,
}

struct Bolt {
    pts: Vec<(f64, f64)>,
    t0: f64,
}

/// One scene's drawing state.
pub struct XfFx {
    t0: f64,
    rng: Lcg,
    rocks: Vec<Rock>,
    bolts: Vec<Bolt>,
    flung: bool,
    /// the last lightning strike (the sky lights up)
    sky_t: f64,
    /// where the hero was last drawn: his feet, the surface's tilt, his lift and height
    kx: f64,
    ky: f64,
    ang: f64,
    lift: f64,
    hh: f64,
}

impl XfFx {
    fn new(g: &Game, x: &XForm) -> Self {
        let mut rng = Lcg::new((x.t0 * 1000.0) as u32 ^ 0x5eed_f0f0);
        let c0 = g.frame3.road_pt(g.phi);
        let rocks = (0..22)
            .map(|i| {
                let rv = norm([rng.random() - 0.5, rng.random() - 0.5, rng.random() - 0.5]);
                let k = 0.25 + rng.random();
                Rock {
                    c: norm(add(add(c0, [0.0, 0.0, 1.0], 0.6), rv, k)),
                    r: [1.0, 2.0, 2.0, 3.0, 3.0, 4.0][i % 6],
                    at: rng.random() * 0.4,
                    sp: 5.0 + rng.random() * 9.0,
                    ph: rng.random() * 6.28,
                    at_screen: None,
                    fl: None,
                }
            })
            .collect();
        XfFx { t0: x.t0, rng, rocks, bolts: Vec::new(), flung: false, sky_t: -9.0, kx: g.cam.cx, ky: g.cam.cy, ang: 0.0, lift: 0.0, hh: 22.0 }
    }

    /// A spot `ly` up his body and `lx` across it.
    fn loc(&self, lx: f64, ly: f64) -> (f64, f64) {
        let (ux, uy) = (sin(self.ang), -cos(self.ang));
        (self.kx + ux * (self.lift + ly) + cos(self.ang) * lx, self.ky + uy * (self.lift + ly) + sin(self.ang) * lx)
    }
}

fn form_ix(g: &Game, f: usize) -> usize {
    ALL_FORMS.iter().position(|a| a.0 == g.forms[f].name).unwrap_or(0)
}

fn pulse(t: f64, f: f64) -> f64 {
    let ph = (t * f) % 1.0;
    0f64.max(1.0 - ph * 3.0)
}

/// The next form's look flickers through his own as the power peaks.
fn flick(g: &Game, x: &XForm, t: f64) -> bool {
    !g.calm && x.rv.is_none() && x.p > 0.55 && ((t * (6.0 + x.p * 14.0)).floor() as i64) % if x.p > 0.85 { 2 } else { 3 } == 0
}

/// The ladder form to draw him in: the next one while it flickers through.
pub fn shown_form(g: &Game, t: f64) -> usize {
    match &g.xf {
        Some(x) if flick(g, x, t) => x.to,
        _ => g.s.form,
    }
}

/// His aura's colours, from his form's toward the next one's as he powers up.
fn cols(g: &Game, x: &XForm, t: f64) -> [u32; 3] {
    let a = FORM_AURA[form_ix(g, g.s.form)];
    let b = FORM_AURA[form_ix(g, x.to)];
    let k = if x.rv.is_some() || flick(g, x, t) { 1.0 } else { pow(x.p, 1.5) * 0.85 };
    [mixc(a[0], b[0], k), mixc(a[1], b[1], k), mixc(a[2], b[2], k)]
}

fn line(c: &mut Ctx, x0: f64, y0: f64, x1: f64, y1: f64, col: u32, a: f64) {
    let n = 1f64.max((hypot(&[x1 - x0, y1 - y0]) * 1.5).ceil());
    let mut i = 0.0;
    while i <= n {
        c.fb.px(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, col, a);
        i += 1.0;
    }
}

/// A pixel in front of whatever is deeper than `z` (the planet hides what's behind it).
fn z_put(c: &mut Ctx, x: f64, y: f64, col: u32, z: f64) {
    let (x, y) = (js_round(x), js_round(y));
    if x < 0.0 || y < 0.0 || x >= c.w || y >= c.h || c.fb.zb[(y * c.w + x) as usize] as f64 > z {
        return;
    }
    c.fb.px(x, y, col, 1.0);
}

fn fill(c: &mut Ctx, top: u32, bot: u32, k: f64) {
    let (w, h) = (c.w as i32, c.h as i32);
    for y in 0..h {
        for x in 0..w {
            let b = bayer(x, y);
            if b < k {
                c.fb.px(x as f64, y as f64, mixc(top, bot, y as f64 / c.h + (b - 0.5) * 0.12), 1.0);
            }
        }
    }
}

impl crate::scene::Scene {
    fn xf_sync(&mut self, g: &Game) -> Option<XForm> {
        let x = g.xf.clone();
        match &x {
            Some(x) if self.xf.as_ref().is_some_and(|f| f.t0 == x.t0) => {}
            Some(x) => self.xf = Some(XfFx::new(g, x)),
            None => self.xf = None,
        }
        x
    }

    /// Behind everything: the dark sky (the sunburst once the form lands) and the shout. The widget has no sky.
    pub(crate) fn xf_sky(&mut self, c: &mut Ctx, g: &Game, view: &View) {
        let Some(x) = self.xf_sync(g) else { return };
        let t = c.t;
        let f = FORM_AURA[form_ix(g, x.to)];
        let (gold, gl) = (f[2], f[1]);
        let fx = self.xf.as_ref().unwrap();
        let rv = x.since(t);
        if rv >= 0.0 {
            if view.bare {
                return;
            }
            // reduced motion has no flash, so the sunburst eases in rather than switching on
            let a = 0f64.max(1.0 - rv / g.xf_rev()).min(if g.calm { rv / 0.4 } else { 1.0 });
            let (hx, hy) = (fx.kx, fx.ky - fx.hh * 0.5);
            let spin = if g.calm { 0.0 } else { t * 0.4 };
            let c2 = mixc(gold, 0xffffff, 0.25);
            for y in 0..c.h as i32 {
                for xx in 0..c.w as i32 {
                    if bayer(xx, y) >= a {
                        continue;
                    }
                    let ang = atan2(y as f64 - hy, xx as f64 - hx) + spin;
                    let ray = ((ang + TAU) / (TAU / 22.0)).floor() as i64 % 2;
                    c.fb.px(xx as f64, y as f64, if ray == 1 { gl } else { c2 }, 1.0);
                }
            }
            return;
        }
        if !view.bare {
            let pl = if x.p > 0.25 && !g.calm { pulse(t, 0.8 + x.p * 1.6) * 1f64.min((x.p - 0.25) * 3.0) } else { 0.0 };
            let lit = if t - fx.sky_t < 0.07 { 0.16 } else { 0.0 };
            fill(c, mixc(mixc(0x0c0618, 0xb8a8ff, lit), gold, pl * 0.45), mixc(mixc(0x2a1c40, 0xe0d8ff, lit), gl, pl * 0.45), 1f64.min(x.p * 8.0));
        }
        if x.p > 0.1 {
            self.xf_shout(c, g, &x, view.bare);
        }
    }

    /// The shout: one enormous アア! behind the planet, cropped by the card, shaking harder as the power builds. The
    /// widget has no card around it, so there both characters fit whole inside its frame.
    fn xf_shout(&self, c: &mut Ctx, g: &Game, x: &XForm, bare: bool) {
        const A: [&[(f64, f64)]; 2] = [&[(0.08, 0.14), (0.92, 0.14), (0.86, 0.27), (0.62, 0.5)], &[(0.5, 0.36), (0.5, 0.62), (0.42, 0.82), (0.22, 0.97)]];
        let t = c.t;
        let (w, h) = (c.w, c.h);
        let ph = w / h < 0.8;
        let s = (if ph { w * 0.78 } else { h * 0.86 }) * (0.88 + x.p * 0.15);
        let (j, j2) = if g.calm { (0.0, 0.0) } else { (js_round(sin(t * 37.0) * (1.0 + x.p * 2.0)), js_round(cos(t * 29.0) * (1.0 + x.p * 2.0))) };
        let w0 = 1.2f64.max(s * 0.1);
        let mut gl: Vec<(bool, f64, f64, f64, f64)> = Vec::new(); // (bang, size, x, y, turn)
        if bare {
            // room for the shake (3), the outline (2) and the shadow (4) inside the frame
            let m = 9.0;
            // a character's reach from its centre at size s, turned: its strokes plus the brush's width
            let reach = |s: f64, rot: f64| {
                let (cr, sr) = (cos(rot), sin(rot));
                let mut b = [f64::MAX, f64::MIN, f64::MAX, f64::MIN];
                for &(u, v) in A.iter().flat_map(|k| k.iter()) {
                    let (lx, ly) = ((u - 0.5) * s, (v - 0.5) * s);
                    let (px, py) = (lx * cr - ly * sr, lx * sr + ly * cr);
                    b = [b[0].min(px), b[1].max(px), b[2].min(py), b[3].max(py)];
                }
                let r = 1.2f64.max(s * 0.1);
                [b[0] - r, b[1] + r, b[2] - r, b[3] + r]
            };
            let mut s = w.min(h) * 0.62 * (0.92 + x.p * 0.08);
            loop {
                // side by side, overlapping a little, and each no taller than the frame
                let (b, b2) = (reach(s, -0.1), reach(s * 0.85, 0.12));
                if b[1] - b[0] + b2[1] - b2[0] <= (w - 2.0 * m) * 1.15 && b[3] - b[2] <= h - 2.0 * m {
                    break;
                }
                s *= 0.95;
            }
            let place = |s: f64, x0: f64, y0: f64, rot: f64| {
                let b = reach(s, rot);
                (x0.max(m - b[0]).min(w - m - b[1]), y0.max(m - b[2]).min(h - m - b[3]))
            };
            let (x1, y1) = place(s, w * 0.28, h * 0.44, -0.1);
            let (x2, y2) = place(s * 0.85, w * 0.72, h * 0.56, 0.12);
            gl.push((false, s, x1 + j, y1 + j2, -0.1));
            gl.push((false, s * 0.85, x2 + j2, y2 + j, 0.12));
        } else if ph {
            gl.push((false, s, w * 0.3 + j, c.cy - c.r - s * 0.38 + j2, -0.1));
            gl.push((false, s * 0.85, w * 0.78 + j2, c.cy - c.r * 0.1 + j, 0.12));
        } else {
            gl.push((false, s, c.cx - c.r * 1.25 + j, h * 0.52 + j2, -0.1));
            // kept left of the power readout in the top right (its label, the number and the line under it)
            let s2 = s * 0.76;
            let x2 = (c.cx + c.r * 1.15).min(w * 0.8 - s2 * 0.42 - w0 - 4.0);
            gl.push((false, s2, x2 + j2, h * 0.64 + j, 0.1));
            if x.p > 0.6 {
                gl.push((true, s * 0.5, (c.cx + c.r * 2.1).min(w * 0.9) + j, h * 0.66, 0.18));
            }
        }
        const BANG: [&[(f64, f64)]; 2] = [&[(0.5, 0.04), (0.5, 0.66)], &[(0.5, 0.86), (0.5, 0.92)]];
        let (wi, hi) = (w as i64, h as i64);
        let mut mask = vec![false; (wi * hi) as usize];
        let mut dot = |x: f64, y: f64, r: f64| {
            let mut yy = (y - r).floor();
            while yy <= y + r {
                let mut xx = (x - r).floor();
                while xx <= x + r {
                    let (dx, dy) = (xx + 0.5 - x, yy + 0.5 - y);
                    if dx * dx + dy * dy <= r * r && xx >= 0.0 && yy >= 0.0 && xx < w && yy < h {
                        mask[(yy as i64 * wi + xx as i64) as usize] = true;
                    }
                    xx += 1.0;
                }
                yy += 1.0;
            }
        };
        for &(bang, gs, gx, gy, rot) in &gl {
            let (cr, sr) = (cos(rot), sin(rot));
            for stk in if bang { BANG } else { A } {
                let p: Vec<(f64, f64)> = stk
                    .iter()
                    .map(|&(u, v)| {
                        let (lx, ly) = ((u - 0.5) * gs, (v - 0.5) * gs);
                        (gx + lx * cr - ly * sr, gy + lx * sr + ly * cr)
                    })
                    .collect();
                let len: f64 = p.windows(2).map(|q| hypot(&[q[1].0 - q[0].0, q[1].1 - q[0].1])).sum();
                let mut d = 0.0;
                for q in p.windows(2) {
                    let ((x0, y0), (x1, y1)) = (q[0], q[1]);
                    let sl = hypot(&[x1 - x0, y1 - y0]);
                    let sl = if sl == 0.0 { 1.0 } else { sl };
                    let mut k = 0.0;
                    while k <= sl {
                        let uu = if len > 0.0 { (d + k) / len } else { 0.5 };
                        let taper = 0.55 + 0.45 * sin(std::f64::consts::PI * 1f64.min(0f64.max(uu * 0.9 + 0.05)));
                        dot(x0 + (x1 - x0) * k / sl, y0 + (y1 - y0) * k / sl, w0 * taper);
                        k += 0.35;
                    }
                    d += sl;
                }
            }
        }
        let m = |x: i64, y: i64| x >= 0 && y >= 0 && x < wi && y < hi && mask[(y * wi + x) as usize];
        let near = |x: i64, y: i64| (-1..=1).any(|dy| (-1..=1).any(|dx| (dx != 0 || dy != 0) && m(x + dx, y + dy)));
        for y in 0..hi {
            for x in 0..wi {
                if m(x, y) {
                    c.fb.px(x as f64, y as f64, if !m(x + 1, y + 1) { 0xcfc4f4 } else { 0xffffff }, 1.0);
                } else if near(x, y) || near(x - 1, y) || near(x + 1, y) {
                    c.fb.px(x as f64, y as f64, 0x0b0b0b, 1.0);
                } else if m(x - 2, y - 2) || m(x - 1, y - 2) || m(x - 2, y - 1) || m(x - 3, y - 3) || m(x - 4, y - 4) {
                    c.fb.px(x as f64, y as f64, 0x5a2a9a, 1.0);
                }
            }
        }
    }

    /// Before he's drawn: his aura, depth-tested against the planet. It's the tap meter: it grows with the power and
    /// kicks out on every tap.
    pub(crate) fn xf_pre(&mut self, c: &mut Ctx, g: &Game, kx: f64, ky: f64, ang: f64, lift: f64, depth: f64, spr_h: f64) {
        let Some(x) = g.xf.clone() else { return };
        let Some(fx) = self.xf.as_mut() else { return };
        (fx.kx, fx.ky, fx.ang, fx.lift, fx.hh) = (kx, ky, ang, lift, spr_h * 1.05);
        let t = c.t;
        let rv = x.since(t);
        let col = cols(g, &x, t);
        let grow = if rv >= 0.0 { 1.5 + 0f64.max(0.6 - rv) } else { 0.45 + x.p * 0.8 };
        let kick = if rv < 0.0 { 0f64.max(0.5 - (t - x.tap_t) * 2.5) } else { 0.0 };
        let s = grow + pulse(t, 1.0 + x.p * 1.5) * (0.15 + x.p * 0.35) + kick;
        let hh = fx.hh;
        let (ox, oy) = fx.loc(0.0, hh * 0.42);
        let (ux, uy, rx, ry) = (sin(ang), -cos(ang), cos(ang), sin(ang));
        let base = hh * 0.62 * s;
        let b = (base * 2.4).ceil();
        let mut y = (oy - b).floor();
        while y <= oy + b {
            let mut xx = (ox - b).floor();
            while xx <= ox + b {
                let (dx, dy) = (xx - ox, y - oy);
                let (lx, ly) = (dx * rx + dy * ry, -(dx * ux + dy * uy));
                let d0 = hypot(&[lx, ly]) / base;
                if d0 <= 2.4 {
                    let th = atan2(lx, ly);
                    let up = 0f64.max(cos(th));
                    let n = vnoise(th * 3.2 + 7.0, t * 7.0 - d0 * 2.2);
                    let r = (1.0 + 1.1 * pow(up, 1.6) * (0.45 + 0.75 * n)) * if lx * lx < base * base * 0.2 { 1.0 } else { 0.9 };
                    let d = d0 / r;
                    if !(d > 1.0 || (d > 0.9 && bayer(xx as i64 as i32, y as i64 as i32) < 0.5)) {
                        z_put(
                            c,
                            xx,
                            y,
                            if d > 0.74 {
                                col[2]
                            } else if d > 0.5 {
                                col[1]
                            } else {
                                col[0]
                            },
                            depth - 1.0,
                        );
                    }
                }
                xx += 1.0;
            }
            y += 1.0;
        }
    }

    /// In front of the world: the rocks, the lightning and the column of light.
    pub(crate) fn xf_front(&mut self, c: &mut Ctx, g: &Game, view: &View, dt: f64) {
        let Some(x) = g.xf.clone() else { return };
        let Some(fx) = self.xf.as_mut() else { return };
        let t = c.t;
        let col = cols(g, &x, t);
        let dur = g.xf_dur();
        let (w, h) = (c.w, c.h);
        let (hx, hy) = fx.loc(0.0, fx.hh * 0.55);
        // the reveal flings every rock he lifted away from him
        if x.rv.is_some() && !fx.flung {
            fx.flung = true;
            for i in 0..fx.rocks.len() {
                if let Some((sx, sy)) = fx.rocks[i].at_screen {
                    let (dx, dy) = (sx - fx.kx, sy - fx.ky);
                    let d = hypot(&[dx, dy]);
                    let d = if d == 0.0 { 1.0 } else { d };
                    let v1 = 80.0 + fx.rng.random() * 80.0;
                    let v2 = 80.0 + fx.rng.random() * 80.0;
                    fx.rocks[i].fl = Some([sx, sy, dx / d * v1, dy / d * v2 - 30.0]);
                }
            }
        }
        let mut rocks = std::mem::take(&mut fx.rocks);
        for r in rocks.iter_mut() {
            if let Some(f) = r.fl.as_mut() {
                f[0] += f[2] * dt;
                f[1] += f[3] * dt;
                f[3] += 60.0 * dt;
                let (rx, ry, rr, ph) = (f[0], f[1], r.r, r.ph);
                rock(c, rx, ry, rr, ph);
                continue;
            }
            if x.p < r.at {
                continue;
            }
            let v = ap(&c.m, r.c);
            if v[2] < 0.02 {
                r.at_screen = None;
                continue;
            }
            let age = (x.p - r.at) * dur;
            let (bx, by) = (c.cx + v[0] * c.r, c.cy - v[1] * c.r + c.bob);
            let rise = (age * r.sp * 1.7).min(26.0 + r.sp * 4.0) + sin(t * 2.0 + r.ph) * 1.5;
            let jx = if g.calm { 0.0 } else { js_round(sin(t * 40.0 + r.ph) * x.p * 0.8) };
            let (sx, sy) = (bx + jx, by - rise - r.r);
            r.at_screen = Some((sx, sy));
            let (rr, ph) = (r.r, r.ph);
            if age < 1.2 && fx.rng.random() < 0.3 {
                let dx = (fx.rng.random() - 0.5) * 4.0;
                let dy = fx.rng.random() * 2.0;
                c.fb.px(bx + dx, by - dy, 0xc8b89a, 1.0); // dust where it tore loose
            }
            rock(c, sx, sy, rr, ph);
        }
        fx.rocks = rocks;
        if x.rv.is_none() && !g.calm && fx.rng.random() < dt * (1.2 + x.p * 5.0) {
            let near = fx.rng.random() < 0.5;
            let tx = if near { hx + (fx.rng.random() - 0.5) * 30.0 } else { c.cx + (fx.rng.random() - 0.5) * c.r * 2.2 };
            let ty = if fx.rng.random() < 0.5 { hy - 6.0 } else { c.cy - c.r * 0.2 };
            let mut x0 = c.cx + (fx.rng.random() - 0.5) * w * 0.9;
            if w / h >= 0.8 && !view.bare {
                x0 = x0.min(w * 0.78); // not through the power readout
            }
            let pts = bolt(&mut fx.rng, x0, 0.0, tx, ty, 14, 16.0);
            fx.bolts.push(Bolt { pts, t0: t });
            fx.sky_t = t;
        }
        fx.bolts.retain(|b| t - b.t0 < 0.12);
        for b in &fx.bolts {
            for q in b.pts.windows(2) {
                let ((a, bb), (cc, d)) = (q[0], q[1]);
                line(c, a + 2.0, bb, cc + 2.0, d, 0xb8a0ff, 1.0);
                line(c, a - 1.0, bb, cc - 1.0, d, 0xb8a0ff, 0.6);
                for k in 0..2 {
                    line(c, a + k as f64, bb, cc + k as f64, d, 0xffffff, 1.0);
                }
            }
        }
        // a column of light punching up out of him
        if x.rv.is_none() && x.p > 0.7 {
            let cw = js_round(2.0 + (x.p - 0.7) * 20.0);
            let mut y = 0.0;
            while y < hy - 4.0 {
                let mut k = -cw;
                while k <= cw {
                    if bayer(js_round(hx + k) as i64 as i32, y as i32) < 1.0 - k.abs() / (cw + 1.0) - (1.0 - y / hy) * 0.3 {
                        c.fb.px(hx + k, y, if k.abs() < cw * 0.4 { 0xffffff } else { col[1] }, 1.0);
                    }
                    k += 1.0;
                }
                y += 1.0;
            }
        }
    }
}

fn rock(c: &mut Ctx, x: f64, y: f64, r: f64, sd: f64) {
    let n = r as i64 + 1;
    for yy in -n..=n {
        for xx in -n..=n {
            let (xf, yf) = (xx as f64, yy as f64);
            let d = hypot(&[xf, yf * 1.15]) / (r + 0.6 + 0.3 * sin(sd + atan2(yf, xf) * 3.0));
            if d > 1.0 {
                continue;
            }
            let l = -(xf + yf) / (r + 0.5) + (h2(xf + 9.0, yf + sd.floor()) - 0.5) * 0.4;
            let col = if d > 0.7 || (r < 1.5 && d > 0.55) {
                ROCK_O
            } else {
                ROCK_T[if l > 0.5 {
                    3
                } else if l > 0.0 {
                    2
                } else if l > -0.6 {
                    1
                } else {
                    0
                }]
            };
            c.fb.px(x + xf, y + yf, col, 1.0);
        }
    }
}

fn bolt(rng: &mut Lcg, x0: f64, y0: f64, x1: f64, y1: f64, n: usize, j: f64) -> Vec<(f64, f64)> {
    let l = hypot(&[x1 - x0, y1 - y0]);
    let l = if l == 0.0 { 1.0 } else { l };
    let (nx, ny) = (-(y1 - y0) / l, (x1 - x0) / l);
    let mut pts = vec![(x0, y0)];
    for i in 1..n {
        let q = (rng.random() - 0.5) * j;
        let k = i as f64 / n as f64;
        pts.push((x0 + (x1 - x0) * k + nx * q, y0 + (y1 - y0) * k + ny * q));
    }
    pts.push((x1, y1));
    pts
}
