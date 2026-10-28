//! The planet's geometry as the timeline needs it: game.js's `V` and `M3`, the road and cap points, the view matrix
//! with its slow auto spin, and the screen layout. Where the hero stands on screen decides when the nimbus reaches him
//! and where his ki blasts fly from, so these keep game.js's operand order and use V8's `Math`.

use crate::data::W2L;
use crate::jsmath::{atan2, cos, hypot, sin};
use crate::num::js_round;

pub type V3 = [f64; 3];
pub type M3 = [f64; 9];

pub fn norm(a: V3) -> V3 {
    let l = hypot(&a);
    let l = if l == 0.0 { 1.0 } else { l };
    [a[0] / l, a[1] / l, a[2] / l]
}

pub fn cross(a: V3, b: V3) -> V3 {
    [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

pub fn dot(a: V3, b: V3) -> f64 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/// `V.add(a, b, k)`: a + b·k
pub fn add(a: V3, b: V3, k: f64) -> V3 {
    [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]
}

pub fn mul(a: V3, k: f64) -> V3 {
    [a[0] * k, a[1] * k, a[2] * k]
}

pub fn m_mul(a: &M3, b: &M3) -> M3 {
    let mut o = [0.0; 9];
    for (i, v) in o.iter_mut().enumerate() {
        let (r, c) = (i / 3, i % 3);
        *v = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    }
    o
}

pub fn ap(m: &M3, v: V3) -> V3 {
    [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]
}

/// `M3.apT`: the transpose applied, which for the view's rotation maps screen back to the planet.
pub fn ap_t(m: &M3, v: V3) -> V3 {
    [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]]
}

pub fn rx(a: f64) -> M3 {
    let (c, s) = (cos(a), sin(a));
    [1.0, 0.0, 0.0, 0.0, c, -s, 0.0, s, c]
}

/// `M3.rot(axis, a)`: a turn of `a` about a unit axis.
pub fn rot([x, y, z]: V3, a: f64) -> M3 {
    let (c, s) = (cos(a), sin(a));
    let cc = 1.0 - c;
    [
        c + x * x * cc,
        x * y * cc - z * s,
        x * z * cc + y * s,
        y * x * cc + z * s,
        c + y * y * cc,
        y * z * cc - x * s,
        z * x * cc - y * s,
        z * y * cc + x * s,
        c + z * z * cc,
    ]
}

pub fn ry(a: f64) -> M3 {
    let (c, s) = (cos(a), sin(a));
    [c, 0.0, s, 0.0, 1.0, 0.0, -s, 0.0, c]
}

pub fn ortho(m: &M3) -> M3 {
    let a = norm([m[0], m[1], m[2]]);
    let b0 = [m[3], m[4], m[5]];
    let d = dot(a, b0);
    let b = norm([b0[0] - a[0] * d, b0[1] - a[1] * d, b0[2] - a[2] * d]);
    let c = cross(a, b);
    [a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]]
}

/// The road's pole and its two in-plane axes.
pub struct Frame {
    pub n: V3,
    pub e1: V3,
    pub e2: V3,
}

impl Frame {
    pub fn new() -> Self {
        let n = norm([0.0, 0.38, 0.92]);
        let e1 = norm(cross([0.0, 1.0, 0.0], n));
        let e2 = cross(n, e1);
        Frame { n, e1, e2 }
    }

    pub fn road_pt(&self, phi: f64) -> V3 {
        norm(add(mul(self.e1, cos(phi)), self.e2, sin(phi)))
    }

    /// A point on the planet `th` off the road's pole, at angle `a` round it.
    pub fn cap_pt(&self, th: f64, a: f64) -> V3 {
        norm(add(mul(self.n, cos(th)), add(mul(self.e1, cos(a)), self.e2, sin(a)), sin(th)))
    }
}

impl Default for Frame {
    fn default() -> Self {
        Self::new()
    }
}

pub const AUTO_SPIN: f64 = 0.06;

/// The view: buffer size, the planet's centre and radius on it, the rotation, and the screen-shake offset.
#[derive(Clone, Debug)]
pub struct Cam {
    pub w: f64,
    pub h: f64,
    pub r: f64,
    pub cx: f64,
    pub cy: f64,
    pub m: M3,
    pub bob: f64,
    /// CSS pixels per buffer pixel (`st.scale`): a drag turns the planet by its on-screen size
    pub scale: f64,
}

/// A point on screen and the angle the planet's surface tilts at there (`kidScreen`).
#[derive(Clone, Copy, Debug)]
pub struct Spot {
    pub v: V3,
    pub x: f64,
    pub y: f64,
    pub ang: f64,
}

impl Cam {
    /// A view of a `w`×`h` buffer (game.js's `st.W`×`st.H`, in its big pixels).
    pub fn new(w: f64, h: f64) -> Self {
        let mut c = Cam { w, h, r: 40.0, cx: 0.0, cy: 0.0, m: [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0], bob: 0.0, scale: 3.0 };
        c.layout(0);
        c
    }

    /// `layout()`: the planet's size and place for the buffer and world.
    pub fn layout(&mut self, world: u32) {
        let (w, h) = (self.w, self.h);
        let wide = w / h >= 1.15;
        let fcx = if wide { 0.56 } else { 0.5 };
        self.r = js_round(if w / h < 0.8 {
            (w * 0.34).min(h * 0.22)
        } else if wide {
            (w * 0.19).min(h * 0.3)
        } else {
            (w * 0.28).min(h * 0.24)
        });
        self.cx = js_round(w * fcx);
        self.cy = js_round(h * if wide || w / h < 0.8 { 0.5 } else { 0.55 });
        if let Some(&(_, zoom, dy)) = W2L.iter().find(|l| l.0 == world) {
            self.r = js_round(self.r * zoom);
            self.cy += js_round(h * dy);
        }
    }

    /// The idle turn, one step (`M = ortho(ry(AUTO_SPIN·dt)·M)`).
    pub fn spin(&mut self, dt: f64) {
        self.m = ortho(&m_mul(&ry(AUTO_SPIN * dt), &self.m));
    }

    /// A drag's turn, or its inertia: `M = ortho(rx(ax)·ry(ay)·M)`.
    pub fn turn(&mut self, ax: f64, ay: f64) {
        self.m = ortho(&m_mul(&m_mul(&rx(ax), &ry(ay)), &self.m));
    }

    /// Where a point on the planet lands on screen, `lift` pixels off the surface.
    pub fn screen(&self, p: V3, lift: f64) -> Spot {
        let v = ap(&self.m, p);
        Spot { v, x: self.cx + v[0] * (self.r + lift), y: self.cy - v[1] * (self.r + lift) + self.bob, ang: atan2(v[0], v[1]) }
    }
}
