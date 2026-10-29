//! shenron.js's drawing: the eternal dragon's scaled serpent body along a 3D track round the planet with its head
//! riding the end, and porunga over the planet with his tail coiled round it. Depth-tested against the planet.

use planet_core::jsmath::{atan2, cos, exp, hypot, pow, sin};
use planet_core::num::js_round;
use planet_core::sprite::{self, Sprite};

use crate::{pk, Framebuffer};

const PAL_G: u32 = 0x2f9a3a;
const PAL_L: u32 = 0x55c04f;
const PAL_Y: u32 = 0xff9f2e;
const PAL_YY: u32 = 0xffe066;
const B_O: u32 = 0x0b2412;
const B_T: [u32; 4] = [0x1c6a2a, 0x2f9a3a, 0x55c04f, 0xa6e67e];
const B_B: [u32; 3] = [0xcdb47a, 0xf4e7bf, 0xfff6dc];
const SPINE: u32 = 0x1c6a2a;
const SPINE_HI: u32 = 0x55c04f;

/// shenron.js's `ctx`: pixels depth-tested at `z + dz`.
pub struct Ctx<'a> {
    pub fb: &'a mut Framebuffer,
    pub z: f64,
    pub w: f64,
    pub h: f64,
    pub cx: f64,
    pub cy: f64,
    pub r: f64,
    pub t: f64,
    pub rise: f64,
    pub age: f64,
    pub gone: f64,
    pub glow: bool,
}

impl Ctx<'_> {
    fn px(&mut self, x: f64, y: f64, hex: u32, dz: f64) {
        let (x, y) = (js_round(x), js_round(y));
        if x < 0.0 || y < 0.0 || x >= self.w || y >= self.h {
            return;
        }
        let k = y as usize * self.fb.w + x as usize;
        let z = self.z + dz;
        if self.fb.zb[k] as f64 > z {
            return;
        }
        self.fb.zb[k] = z as f32;
        self.fb.buf[k] = pk(hex, 255);
        self.fb.dm[k] = 1;
    }
}

struct Head {
    spr: &'static str,
    whiskers: &'static [(f64, f64, f64)],
}

const HEADS: [Head; 3] = [
    Head { spr: "SHENRON.HEADS.0.spr", whiskers: &[(4.0, 12.0, -1.0), (6.0, 13.0, -1.0)] },
    Head { spr: "SHENRON.HEADS.1.spr", whiskers: &[(14.0, 26.0, -1.0), (29.0, 26.0, 1.0)] },
    Head { spr: "SHENRON.HEADS.2.spr", whiskers: &[(1.0, 8.0, -1.0)] },
];

struct Look {
    head: usize,
    k: f64,
    r: f64,
    flat: bool,
}

const LOOKS: [Look; 4] = [
    Look { head: 0, k: 1.0, r: 0.12, flat: false },
    Look { head: 1, k: 1.0, r: 0.12, flat: false },
    Look { head: 2, k: 2.0, r: 0.1, flat: true },
    Look { head: 1, k: 2.0, r: 0.17, flat: false },
];

fn path(look: usize, u: f64) -> [f64; 3] {
    use std::f64::consts::PI;
    match look {
        0 => {
            if u < 0.8 {
                let a = 2.1 + u / 0.8 * 6.283 * 1.55;
                return [cos(a) * 1.38, 1.3 - u / 0.8 * 2.45, sin(a) * 1.38];
            }
            let v = (u - 0.8) / 0.2;
            let a = 2.1 + 6.283 * 1.55;
            let e = [cos(a) * 1.38, -1.15];
            [e[0] + (0.5 - e[0]) * v + sin(v * PI) * 0.35, e[1] + (-1.7 - e[1]) * v - sin(v * PI) * 0.25, 1.2]
        }
        1 => {
            let q = (u - 0.2) / 0.08;
            [sin(u * 6.283 * 1.25) * 1.55 * (1.0 - u * 0.55), 1.45 - u * 3.05, -1.1 + 2.5 * exp(-(q * q))]
        }
        2 => [2.1 - u * 3.75, -1.38 + sin(u * 6.283 * 2.0) * 0.26, 0.5],
        _ => [sin(u * 6.283 * 1.5 + 0.4) * 1.75 * (1.0 - u * 0.7), 1.35 - u * 2.75, -1.2],
    }
}

/// The entry spiral then the pose, by arc length (`track(look)`).
pub struct Track {
    pts: Vec<[f64; 3]>,
    cum: Vec<f64>,
    total: f64,
    body: f64,
    max_x: f64,
    min_y: f64,
}

impl Track {
    pub fn new(look: usize) -> Self {
        let p0 = path(look, 0.0);
        let a1 = atan2(p0[2], p0[0]);
        let r1 = hypot(&[p0[0], p0[2]]);
        let turns = 1.75;
        let mut pts = Vec::with_capacity(1201);
        for i in 0..=600 {
            let v = i as f64 / 600.0;
            let a = a1 - (1.0 - v) * turns * 6.283;
            let left = (1.0 - v) * turns * 6.283;
            let r = if left > std::f64::consts::PI { 1.45 } else { r1 + (1.45 - r1) * (left / std::f64::consts::PI) };
            pts.push([cos(a) * r, -2.9 + (p0[1] + 2.9) * v * v * (3.0 - 2.0 * v), sin(a) * r]);
        }
        let pre = pts.len();
        for i in 1..=600 {
            pts.push(path(look, i as f64 / 600.0));
        }
        let mut cum = vec![0.0];
        for i in 1..pts.len() {
            let (p, q) = (pts[i], pts[i - 1]);
            cum.push(cum[i - 1] + hypot(&[p[0] - q[0], p[1] - q[1], p[2] - q[2]]));
        }
        let (mut max_x, mut min_y) = (0f64, 0f64);
        for p in &pts[pre..] {
            max_x = max_x.max(p[0].abs());
            min_y = min_y.min(p[1]);
        }
        let total = cum[cum.len() - 1];
        let body = total - cum[pre - 1];
        Track { pts, cum, total, body, max_x, min_y }
    }

    fn at(&self, d: f64) -> [f64; 3] {
        if d <= 0.0 {
            let p = self.pts[0];
            return [p[0], p[1] + d, p[2]];
        }
        let (mut lo, mut hi) = (0usize, self.cum.len() - 1);
        while hi - lo > 1 {
            let m = (lo + hi) >> 1;
            if self.cum[m] < d {
                lo = m;
            } else {
                hi = m;
            }
        }
        let den = self.cum[hi] - self.cum[lo];
        let f = 1f64.min((d - self.cum[lo]) / if den == 0.0 { 1.0 } else { den });
        let (p, q) = (self.pts[lo], self.pts[hi]);
        [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f, p[2] + (q[2] - p[2]) * f]
    }
}

fn tube(ctx: &mut Ctx, x: f64, y: f64, nx: f64, ny: f64, r: f64, s: f64, flat: bool) {
    let mut o = -r;
    while o <= r {
        let q = o / r;
        let (px, py) = (x + nx * o, y + ny * o);
        let c = if o.abs() > r - 1.0 {
            B_O
        } else if flat {
            if q < -0.62 {
                if (s / 3.0).floor() as i64 % 2 != 0 {
                    PAL_Y
                } else {
                    PAL_G
                }
            } else if q > 0.35 {
                if (s / 5.0).floor() as i64 % 3 != 0 {
                    PAL_YY
                } else {
                    PAL_Y
                }
            } else if q < -0.3 {
                PAL_L
            } else {
                PAL_G
            }
        } else if q > 0.3 {
            let plate = (s % 4.0) < 1.0;
            if plate || q > 0.75 {
                B_B[0]
            } else if q < 0.45 {
                B_B[2]
            } else {
                B_B[1]
            }
        } else {
            let mut l = 0.55 * 0f64.max(1.0 - q * q).sqrt() - ny * q * 0.5 + 0.1;
            let sc = (((s / 3.0).floor() as i64 + ((q + 1.0) * r / 2.2).floor() as i64) & 1) == 0 && (s % 3.0) < 1.0;
            if sc {
                l -= 0.3;
            }
            B_T[if l > 0.62 {
                3
            } else if l > 0.38 {
                2
            } else if l > 0.12 {
                1
            } else {
                0
            }]
        };
        ctx.px(px, py, c, 0f64.max(1.0 - q * q).sqrt() * r);
        o += 0.5;
    }
}

fn limb(ctx: &mut Ctx, x0: f64, y0: f64, x1: f64, y1: f64, w0: f64, w1: f64, flat: bool) {
    let l = hypot(&[x1 - x0, y1 - y0]);
    let l = if l == 0.0 { 1.0 } else { l };
    let (ux, uy) = ((x1 - x0) / l, (y1 - y0) / l);
    let mut j = 0.0;
    while j <= l {
        let w = w0 + (w1 - w0) * j / l;
        let (x, y) = (x0 + ux * j, y0 + uy * j);
        let mut o = -w;
        while o <= w {
            let c = if o.abs() > w - 1.0 {
                B_O
            } else if flat {
                PAL_G
            } else if o < -w * 0.2 {
                B_T[2]
            } else {
                B_T[1]
            };
            ctx.px(x - uy * o, y + ux * o, c, 0.0);
            o += 0.5;
        }
        j += 0.5;
    }
}

fn talons(ctx: &mut Ctx, x: f64, y: f64, dx: f64, dy: f64, n: u32, len: f64, spread: f64) {
    for i in 0..n {
        let a = (i as f64 - (n as f64 - 1.0) / 2.0) * spread;
        let cx = dx * cos(a) - dy * sin(a);
        let cy = dx * sin(a) + dy * cos(a);
        let mut j = 0.0;
        while j < len {
            let curl = j / len;
            ctx.px(x + cx * j - cy * curl * 1.5, y + cy * j + cx * curl * 1.5, if j > len * 0.55 { B_B[2] } else { B_B[0] }, 0.0);
            j += 0.5;
        }
    }
}

/// a jointed leg: thigh out and back, shin forward, three talons gripping the air (`ctx.legs` 2)
fn leg(ctx: &mut Ctx, x: f64, y: f64, nx: f64, ny: f64, r: f64, ph: f64, flat: bool, tx: f64, ty: f64) {
    let sw = sin(ph * 2.0) * 0.25;
    let w = 2.5f64.max(r * 0.7);
    let kx = x + (nx * 0.85 - tx * 0.5) * r * 2.3 + tx * sw * r;
    let ky = y + (ny * 0.85 - ty * 0.5) * r * 2.3 + ty * sw * r;
    let fx = kx + (nx * 0.55 + tx * 0.85) * r * 1.9;
    let fy = ky + (ny * 0.55 + ty * 0.85) * r * 1.9;
    limb(ctx, x + nx * r * 0.3, y + ny * r * 0.3, kx, ky, w * 1.15, w * 0.85, flat);
    limb(ctx, kx, ky, fx, fy, w * 0.85, w * 0.6, flat);
    talons(ctx, fx, fy, tx * 0.8 + nx * 0.6, ty * 0.8 + ny * 0.6, 3, w * 2.4, 0.6);
}

fn blit(ctx: &mut Ctx, spr: &Sprite, bx: f64, by: f64, flip: bool, k: f64) {
    let mut y = (by - spr.ay * k).floor();
    while y < by + (spr.h as f64 - spr.ay) * k {
        let mut x = (bx - spr.ax * k).floor();
        while x < bx + (spr.w as f64 - spr.ax) * k {
            let i = ((x + 0.5 - bx) / k + spr.ax).floor();
            let j = ((y + 0.5 - by) / k + spr.ay).floor();
            if i >= 0.0 && j >= 0.0 && i < spr.w as f64 && j < spr.h as f64 {
                let i = if flip { spr.w - 1 - i as usize } else { i as usize };
                let c = spr.col[j as usize * spr.w + i];
                if c >= 0 {
                    ctx.px(x, y, c as u32, 0.0);
                }
            }
            x += 1.0;
        }
        y += 1.0;
    }
}

/// `eyes(hd)`: either end of each row's red-white eye pixels (`R`), one in.
fn eyes(spr: &Sprite) -> Vec<(f64, f64)> {
    let mut out = Vec::new();
    for y in 0..spr.h {
        let row = &spr.col[y * spr.w..(y + 1) * spr.w];
        let first = row.iter().position(|&c| c == 0xffe0e0);
        let last = row.iter().rposition(|&c| c == 0xffe0e0);
        if let Some(x) = first {
            out.push((x as f64 + 1.0, y as f64 + 1.0));
            if let Some(x2) = last {
                if x2 > x {
                    out.push((x2 as f64 - 1.0, y as f64 + 1.0));
                }
            }
        }
    }
    out
}

struct Pt {
    x: f64,
    y: f64,
    z: f64,
    s: f64,
    u: f64,
}

/// `SHENRON.draw(ctx, look)`
pub fn draw(ctx: &mut Ctx, look: usize, tr: &Track) {
    let l = &LOOKS[look];
    let hd = &HEADS[l.head];
    let spr = sprite::get(hd.spr);
    let (w, h, t) = (ctx.w, ctx.h, ctx.t);
    let hk = 0.7f64.max(1.5f64.min(ctx.r / 60.0)) * l.k;
    let top = spr.ay * hk + 4.0;
    let e1 = 1f64.min(ctx.age / 4.0);
    let head = tr.total * (1.0 - pow(1.0 - e1, 2.2));
    let tail = head - tr.body;
    let ux = ctx.r.min((w / 2.0 - 8.0) / tr.max_x);
    let up = ctx.r.min(4f64.max(ctx.cy - ctx.r - top) / 0.01f64.max(-1.0 - tr.min_y));
    let lift = -ctx.gone * ctx.gone * h * 1.3;
    let (cx, cy, r) = (ctx.cx, ctx.cy, ctx.r);
    let to_s = |a: f64| {
        let p = tr.at(a);
        let u = (a - tail) / tr.body;
        let wob = sin(u * 15.0 - t * 2.4) * 0.045 * (1.0 - u * 0.6);
        let y = if p[1] >= -1.0 { cy + p[1] * r } else { cy - r + (p[1] + 1.0) * up };
        [cx + (p[0] + wob) * ux, y + lift, p[2]]
    };
    let mut pts = Vec::new();
    let mut prev = to_s(tail);
    let mut s = 0.0;
    pts.push(Pt { x: prev[0], y: prev[1], z: prev[2], s: 0.0, u: 0.0 });
    for k in 1..=2400 {
        let a = tail + tr.body * k as f64 / 2400.0;
        let p = to_s(a);
        let d = hypot(&[p[0] - prev[0], p[1] - prev[1]]);
        if d < 0.45 && k < 2400 {
            continue;
        }
        s += d;
        pts.push(Pt { x: p[0], y: p[1], z: p[2], s, u: k as f64 / 2400.0 });
        prev = p;
    }
    let rmax = 3f64.max(ctx.r * l.r);
    let n = pts.len();
    let legs_at = [0.3, 0.5, 0.68, 0.85];
    for i in 1..n - 1 {
        let p = &pts[i];
        ctx.z = p.z * ctx.r;
        let (tx, ty) = (pts[i + 1].x - pts[i - 1].x, pts[i + 1].y - pts[i - 1].y);
        let tl = hypot(&[tx, ty]);
        let tl = if tl == 0.0 { 1.0 } else { tl };
        let (mut nx, mut ny) = (ty / tl, -tx / tl);
        if l.flat && ny < 0.0 {
            nx = -nx;
            ny = -ny;
        }
        let rr = rmax * (0.22 + 0.78 * 1f64.min(p.u * 4.0)) * (1.0 - 0.15 * 0f64.max((p.u - 0.9) * 10.0));
        tube(ctx, p.x, p.y, nx, ny, rr, p.s, l.flat);
        if !l.flat && (p.s / 9.0).floor() != (pts[i - 1].s / 9.0).floor() && p.u > 0.08 && p.u < 0.97 {
            let mut j = 1.0;
            while j < rr * 0.9 {
                let ww = (1.0 - j / (rr * 0.9)) * 2.4;
                let mut o = -ww;
                while o <= ww {
                    ctx.px(
                        p.x - nx * (rr + j - 0.5) + (tx / tl) * o,
                        p.y - ny * (rr + j - 0.5) + (ty / tl) * o,
                        if j > rr * 0.55 { SPINE_HI } else { SPINE },
                        0.0,
                    );
                    o += 0.5;
                }
                j += 1.0;
            }
        }
        for f in legs_at {
            if pts[i - 1].u < f && p.u >= f {
                leg(ctx, p.x, p.y, nx, ny, rr, t + f * 7.0, l.flat, tx / tl, ty / tl);
            }
        }
    }
    let (e, e0) = (&pts[n - 1], &pts[n.saturating_sub(8)]);
    ctx.z = e.z * ctx.r + ctx.r * 0.25;
    let fl = l.head != 1 && e.x > e0.x;
    let (ex_, ey_) = (e.x, e.y);
    blit(ctx, spr, ex_, ey_, fl, hk);
    for &(wx, wy, side) in hd.whiskers {
        let mut x = ex_ + ((if fl { spr.w as f64 - 1.0 - wx } else { wx }) - spr.ax) * hk;
        let mut y = ey_ + (wy - spr.ay) * hk;
        let dir = side * if fl { -1.0 } else { 1.0 };
        let len = 40.0 * hk;
        let mut j = 0.0;
        while j < len {
            let a = j / len;
            x += dir * 0.5;
            y += 0.18 + sin(t * 3.0 + j * 0.16) * 0.32;
            let c = if a > 0.8 && (j as i64) % 2 != 0 { B_B[0] } else { B_B[1] };
            ctx.px(x, y, c, 0.0);
            if a < 0.6 {
                ctx.px(x, y + 1.0, B_B[0], 0.0);
            }
            j += 0.5;
        }
    }
    if ctx.glow {
        for (ex, ey) in eyes(spr) {
            let x = ex_ + ((if fl { spr.w as f64 - 1.0 - ex } else { ex }) - spr.ax) * hk;
            let y = ey_ + (ey - spr.ay) * hk;
            let mut a = 0.0;
            while a < 6.28 {
                ctx.px(x + cos(a) * (2.0 + hk), y + sin(a) * (1.0 + hk * 0.6), 0xff5a4a, 0.0);
                a += 0.4;
            }
        }
    }
}

/// `SHENRON.drawPorunga(ctx)`
pub fn draw_porunga(ctx: &mut Ctx) {
    let spr = sprite::get("SHENRON.PORUNGA");
    let top = ctx.cy - ctx.r * 0.75;
    let k = 0.8f64.max((ctx.r * 2.6 / spr.w as f64).min((top - 4.0) / 52.0));
    let rise = 1.0 - pow(1.0 - ctx.rise, 3.0);
    let t = ctx.t;
    let bx = ctx.cx;
    let by = top + (spr.ay - 52.0) * k + (1.0 - rise) * ctx.h * 1.1 - ctx.gone * ctx.gone * ctx.h * 1.4 + sin(t * 1.3) * 2.0;
    let lift = by - (ctx.cy + ctx.r * 0.1);
    let mut pts = Vec::with_capacity(901);
    for i in 0..=900 {
        let u = i as f64 / 900.0;
        let a = -1.3 + u * 6.283 * 0.95;
        let rr = 1.32 - u * 0.12;
        pts.push([
            ctx.cx + cos(a) * rr * ctx.r + sin(u * 9.0 + t * 1.5) * 2.0,
            ctx.cy + (-0.15 + u * 0.95) * ctx.r + lift * (1.0 - u * 0.4),
            sin(a) * rr * ctx.r,
            u,
        ]);
    }
    let mut s_acc = 0.0;
    for i in 1..pts.len() - 1 {
        let [x, y, z, u] = pts[i];
        let (tx, ty) = (pts[i + 1][0] - pts[i - 1][0], pts[i + 1][1] - pts[i - 1][1]);
        let tl = hypot(&[tx, ty]);
        let tl = if tl == 0.0 { 1.0 } else { tl };
        s_acc += hypot(&[x - pts[i - 1][0], y - pts[i - 1][1]]);
        if y > ctx.h + 20.0 || y < -20.0 {
            continue;
        }
        ctx.z = z;
        tube(ctx, x, y, ty / tl, -tx / tl, 1.5f64.max(ctx.r * 0.16 * (1.0 - u * 0.8)), s_acc, false);
    }
    ctx.z = -ctx.r * 1.6;
    blit(ctx, spr, bx, by, false, k);
    if rise > 0.9 && ctx.gone == 0.0 {
        for ex in [27.5, 38.5] {
            let x = bx + (ex - spr.ax) * k;
            let y = by + (20.5 - spr.ay) * k;
            let mut a = 0.0;
            while a < 6.28 {
                ctx.px(x + cos(a) * (k + 1.5), y + sin(a) * (k * 0.6 + 1.0), 0xff5a4a, 0.0);
                a += 0.5;
            }
        }
    }
}
