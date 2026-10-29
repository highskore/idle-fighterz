//! Each world's props (game.js `scenery()` and its per-world builders): spheres on the planet, the future's slabs,
//! west city's painted streets, paozu's river, and the residents that stand on the cap.

use planet_core::geom::{add, cross, dot, mul, norm, V3};
use planet_core::jsmath::{atan2, cos, hypot, sin};
use planet_core::Game;
use std::f64::consts::PI;

use crate::scene::{hash, Ctx};
use crate::tones::{self, W2P};
use crate::{h2, pk};

/// A palette a west city solid names (`o.p`).
#[derive(Clone, Copy, Debug)]
pub enum Pn {
    Hull,
    Peach,
    Aqua,
    Pane,
    Stone,
}

#[derive(Clone, Debug)]
pub enum Kind {
    Leaf,
    Trunk,
    Stone,
    Knob,
    Karst,
    Pal { pal: Vec<u32>, lift: f64 },
    Dome { s: V3, door: V3 },
    Hq { s: V3, door: V3, side: V3, text: bool, p: Pn },
    Tower { s: Option<V3>, p: Pn, w: f64 },
    Pool { s: V3, lava: bool },
    Spot { pal: Vec<u32>, pal2: Vec<u32>, f: f64, seed: f64, lift: f64 },
    TopChunk,
}

/// A west city hover car's path: round a circle on the planet.
#[derive(Clone, Debug)]
pub struct Fly {
    n: V3,
    r: f64,
    q: f64,
    w: f64,
    h: f64,
}

impl Fly {
    pub fn at(&self, t: f64) -> V3 {
        on_circle(self.n, self.r, self.q + self.w * t, self.h)
    }
}

#[derive(Clone, Debug)]
pub struct Solid {
    pub c: V3,
    pub r: f64,
    pub kind: Kind,
    pub fly: Option<Fly>,
}

/// A skyscraper in the future: base, top, half-width.
#[derive(Clone, Debug)]
pub struct Slab {
    pub b: V3,
    pub t: V3,
    pub w: f64,
    pub seed: i64,
}

/// A street painted on west city's ground (`wcRoads`).
#[derive(Clone, Debug)]
pub struct Road {
    pub n: V3,
    pub lo: f64,
    pub hi: f64,
    pub a: V3,
    pub b: V3,
    pub pave: Pave,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Pave {
    Street,
    Pool,
    Plaza,
}

/// Paozu's river: |n·A + .05 sin(9 n·F)| < w.
#[derive(Clone, Debug)]
pub struct River {
    pub a: V3,
    pub w: f64,
    pub f: V3,
}

impl River {
    pub fn wet(&self, nb: V3) -> bool {
        (dot(nb, self.a) + 0.05 * sin(dot(nb, self.f) * 9.0)).abs() < self.w
    }
}

/// A resident standing on the cap (`w2Res`).
#[derive(Clone)]
pub struct Resident {
    pub spr: &'static str,
    pub c: V3,
    pub ph: f64,
    pub flip: u8,
    pub k: f64,
    pub hop: f64,
    pub blink: Vec<V3>,
}

/// Everything `scenery()` builds for a world.
#[derive(Default, Clone)]
pub struct Built {
    pub solids: Vec<Solid>,
    pub slabs: Vec<Slab>,
    pub roads: Vec<Road>,
    pub water: Option<River>,
    /// kame house: where the house and roshi stand
    pub kh: Option<(V3, V3)>,
    pub res: Vec<Resident>,
    pub pole: bool,
    pub smokes: Vec<V3>,
    pub fut_andro: Vec<V3>,
    /// paozu's dinos: (sprite, th, a, k, sway, hop)
    pub dinos: Vec<(&'static str, f64, f64, f64, f64, f64)>,
}

struct B<'a> {
    o: Built,
    g: &'a Game,
}

fn on_circle(n: V3, r: f64, q: f64, h: f64) -> V3 {
    let (a, b) = frame_of(n);
    mul(norm(add(mul(n, cos(r)), add(mul(a, cos(q)), b, sin(q)), sin(r))), h)
}

fn frame_of(n: V3) -> (V3, V3) {
    let a = norm(cross(n, if n[0].abs() < 0.9 { [1.0, 0.0, 0.0] } else { [0.0, 1.0, 0.0] }));
    (a, cross(n, a))
}

/// game.js's seeded `rnd`: a Park-Miller generator.
struct Pm(f64);

impl Pm {
    fn next(&mut self) -> f64 {
        self.0 = (self.0 * 16807.0) % 2147483647.0;
        self.0 / 2147483647.0
    }
}

impl B<'_> {
    fn cap(&self, th: f64, a: f64) -> V3 {
        self.g.frame3.cap_pt(th, a)
    }
    fn n(&self) -> V3 {
        self.g.frame3.n
    }
    fn push(&mut self, c: V3, r: f64, kind: Kind) {
        self.o.solids.push(Solid { c, r, kind, fly: None });
    }
    fn pal(&mut self, c: V3, r: f64, pal: &[u32], lift: f64) {
        self.push(c, r, Kind::Pal { pal: pal.to_vec(), lift });
    }
    fn door_of(&self, s: V3) -> V3 {
        mul(norm(cross(s, cross(self.n(), s))), -1.0)
    }
    fn bush(&mut self, th: f64, a: f64, r: f64) {
        let c = self.cap(th, a);
        self.push(c, r, Kind::Leaf);
    }
    fn rock(&mut self, th: f64, a: f64, r: f64) {
        let c = mul(self.cap(th, a), 1.0 - r * 0.3);
        self.push(c, r, Kind::Stone);
    }

    fn default_world(&mut self) {
        let dome = |b: &mut Self, th: f64, a: f64, r: f64| {
            let s = b.cap(th, a);
            let door = b.door_of(s);
            b.push(s, r, Kind::Dome { s, door });
            for i in 1..=5 {
                b.push(mul(s, 1.0 + r + 0.018 * i as f64), 0.009, Kind::Trunk);
            }
            b.push(mul(s, 1.0 + r + 0.11), 0.02, Kind::Knob);
        };
        let world = self.g.s.world;
        let tree = |b: &mut Self, th: f64, a: f64, k: f64| {
            let s = b.cap(th, a);
            if world != 0 {
                for i in 1..=7 {
                    b.push(mul(s, 1.0 + 0.05 * i as f64 * k), 0.022 * k, Kind::Trunk);
                }
                b.push(mul(s, 1.0 + 0.42 * k), 0.12 * k, Kind::Leaf);
                b.push(mul(s, 1.0 + 0.52 * k), 0.08 * k, Kind::Leaf);
            } else {
                let t1 = norm(cross(s, b.n()));
                for i in 1..=4 {
                    b.push(mul(s, 1.0 + 0.045 * i as f64 * k), 0.03 * k, Kind::Trunk);
                }
                b.push(add(mul(s, 1.0 + 0.26 * k), t1, 0.05 * k), 0.13 * k, Kind::Leaf);
                b.push(add(mul(s, 1.0 + 0.2 * k), t1, -0.08 * k), 0.1 * k, Kind::Leaf);
                b.push(mul(s, 1.0 + 0.33 * k), 0.09 * k, Kind::Leaf);
            }
        };
        dome(self, 0.3, 2.5, 0.25);
        dome(self, 0.82, 3.55, 0.17);
        let spots = [
            [0.75, 1.9, 0.15],
            [0.6, 5.1, 0.16],
            [1.05, 4.0, 0.13],
            [2.0, 2.2, 0.16],
            [2.3, 4.2, 0.15],
            [1.9, 0.05, 0.14],
            [2.6, 5.8, 0.13],
            [3.0, 2.4, 0.15],
            [1.25, 2.65, 0.12],
        ];
        let n = (self.g.scenery_house as usize).min(9);
        for [a, b, r] in &spots[..n] {
            dome(self, *a, *b, *r);
        }
        for (th, a, k) in
            [(0.95, 0.5, 1.05), (0.62, 1.35, 0.85), (1.0, 5.0, 0.95), (0.55, 5.8, 0.7), (2.25, 1.2, 1.0), (2.5, 3.4, 1.1), (2.1, 5.2, 0.9), (2.75, 0.2, 0.8)]
        {
            tree(self, th, a, k);
        }
        for (th, a, r) in [(0.7, 4.3, 0.07), (0.98, 2.2, 0.06), (0.4, 0.9, 0.05), (1.1, 3.0, 0.06), (2.3, 2.3, 0.08), (2.6, 4.5, 0.07)] {
            self.bush(th, a, r);
        }
        for (th, a, r) in [(0.62, 4.05, 0.05), (1.05, 1.7, 0.04), (2.4, 0.6, 0.05)] {
            self.rock(th, a, r);
        }
    }

    fn paozu(&mut self) {
        const ROOF: [u32; 5] = [0x6a1a10, 0x9a2c1a, 0xc8432a, 0xe86a44, 0xffa070];
        let mut rnd = Pm(12.0);
        let nn = self.n();
        let e = (self.g.frame3.e1, self.g.frame3.e2);
        self.o.water = Some(River { a: norm(add(e.0, e.1, -0.8)), w: 0.032, f: e.1 });
        let pillars = [
            [1.08, 0.3, 0.42, 0.1],
            [1.15, 0.95, 0.32, 0.085],
            [1.8, 0.9, 0.72, 0.11],
            [1.8, 2.15, 0.62, 0.1],
            [1.85, 2.7, 0.7, 0.11],
            [1.1, 2.6, 0.36, 0.09],
            [1.08, 3.4, 0.48, 0.1],
            [1.2, 4.2, 0.3, 0.08],
            [1.05, 5.4, 0.4, 0.1],
            [2.1, 3.0, 0.4, 0.09],
            [1.95, 4.6, 0.5, 0.1],
            [2.15, 5.9, 0.36, 0.085],
        ];
        for [th, a, h, r] in pillars {
            let lean = (rnd.next() - 0.5) * 0.06;
            let s = self.cap(th, a);
            let t1 = norm(cross(s, nn));
            let t2 = cross(s, t1);
            let n = (h / (r * 0.4)).ceil() as i64;
            let mut top = s;
            for i in 0..=n {
                let f = i as f64 / n as f64;
                let w = r * (0.8 + 0.35 * sin(PI * 1f64.min(f * 1.1))) * (1.0 - 0.25 * f);
                let r1 = rnd.next();
                let inner = add(mul(s, 1.0 + h * f), t1, lean * f * f + (r1 - 0.5) * r * 0.3);
                let r2 = rnd.next();
                top = add(inner, t2, (r2 - 0.5) * r * 0.3);
                self.push(top, w, Kind::Karst);
                if i > 1 && i < n - 1 && rnd.next() < 0.3 {
                    let d = if rnd.next() < 0.5 { t1 } else { t2 };
                    let sg = if rnd.next() < 0.5 { -1.0 } else { 1.0 };
                    self.push(add(top, d, sg * w * 0.8), w * 0.42, Kind::Leaf);
                }
            }
            self.push(mul(top, 1.0 + r * 0.45), r * 0.85, Kind::Leaf);
            self.push(add(mul(top, 1.0 + r * 0.8), t1, r * 0.35), r * 0.5, Kind::Leaf);
        }
        let forest = |b: &mut Self, rnd: &mut Pm, th0: f64, a0: f64, n: u32, sp: f64| {
            for _ in 0..n {
                let th = th0 + (rnd.next() - 0.5) * sp;
                let a = a0 + (rnd.next() - 0.5) * sp * 2.0 / 0.3f64.max(sin(th));
                let wet = b.o.water.as_ref().is_some_and(|w| w.wet(b.cap(th, a)));
                if (th - 1.571).abs() > 0.13 && !wet {
                    let k = 0.65 + rnd.next() * 0.5;
                    let s = b.cap(th, a);
                    b.push(mul(s, 1.0 + 0.03 * k), 0.02 * k, Kind::Trunk);
                    b.push(mul(s, 1.0 + 0.085 * k), 0.065 * k, Kind::Leaf);
                }
            }
        };
        for (th, a, n, sp) in [(0.85, 0.6, 10, 0.4), (0.8, 4.6, 12, 0.45), (0.55, 5.6, 6, 0.3), (0.95, 2.4, 8, 0.3), (2.2, 2.2, 14, 0.6), (2.3, 4.8, 12, 0.6)] {
            forest(self, &mut rnd, th, a, n, sp);
        }
        {
            let (th, a, r) = (0.55, 3.5, 0.15);
            let s = self.cap(th, a);
            let door = self.door_of(s);
            self.push(s, r, Kind::Dome { s, door });
            self.pal(mul(s, 1.0 + r * 0.55), r * 0.6, &ROOF, 0.0);
            for i in 0..=3 {
                self.push(add(mul(s, 1.0 + r * 0.62 + 0.022 * i as f64), door, -r * 0.42), 0.016, Kind::Stone);
            }
            let s = self.cap(0.66, 4.0);
            let door = self.door_of(s);
            self.push(s, 0.08, Kind::Dome { s, door });
        }
        self.bush(0.7, 2.0, 0.05);
        self.bush(0.32, 3.9, 0.04);
        self.rock(0.75, 3.0, 0.04);
        self.rock(0.6, 5.0, 0.035);
        self.o.dinos = vec![("DINOS.b", 0.3, 4.9, 0.75, 0.7, 0.0), ("DINOS.c", 0.36, 2.3, 0.83, 0.5, 0.0)];
    }

    fn westcity(&mut self) {
        let nn = self.n();
        let (e1, _e2) = (self.g.frame3.e1, self.g.frame3.e2);
        let face = |s: V3| norm(add([0.0, 0.0, 1.0], s, -s[2]));
        let ring = |b: &mut Self, n: V3, r: f64, w: f64, pave: Pave| {
            let (a, bb) = frame_of(n);
            let c = cos(r);
            let p = pave != Pave::Street;
            b.o.roads.push(Road { n, lo: if p { c } else { c - w }, hi: if p { 2.0 } else { c + w }, a, b: bb, pave });
        };
        let hq = |b: &mut Self, th: f64, a: f64, r: f64, text: bool, p: Pn| {
            let s = b.cap(th, a);
            let door = face(s);
            b.push(s, r, Kind::Hq { s, door, side: cross(s, door), text, p });
        };
        let tower = |b: &mut Self, th: f64, a: f64, h: f64, r: f64, p: Pn, top: Pn, w: f64| {
            let s = b.cap(th, a);
            let mut z = 0.0;
            while z <= h {
                b.push(mul(s, 1.0 + z), r, Kind::Tower { s: Some(s), p, w });
                z += r * 0.85;
            }
            b.push(mul(s, 1.0 + h + r * 0.55), r * 0.78, Kind::Tower { s: Some(s), p: top, w: 0.0 });
            for i in 1..=4 {
                b.push(mul(s, 1.0 + h + r * 1.2 + 0.016 * i as f64), 0.008, Kind::Tower { s: Some(s), p: Pn::Stone, w: 0.0 });
            }
        };
        let palm = |b: &mut Self, th: f64, a: f64, k: f64| {
            let s = b.cap(th, a);
            let t1 = norm(cross(s, nn));
            let t2 = cross(s, t1);
            for i in 1..=7 {
                let q = i as f64 / 7.0;
                b.push(add(mul(s, 1.0 + 0.045 * i as f64 * k), t1, 0.05 * k * (q * q)), 0.017 * k, Kind::Trunk);
            }
            let top = add(mul(s, 1.0 + 0.33 * k), t1, 0.05 * k);
            b.push(top, 0.03 * k, Kind::Leaf);
            for j in 0..6 {
                let d = add(mul(t1, cos(j as f64 * 1.05)), t2, sin(j as f64 * 1.05));
                for q in 1..=3 {
                    let q = q as f64;
                    b.push(add(add(top, d, 0.045 * q * k), s, -0.012 * q * q * k), (0.03 - 0.005 * q) * k, Kind::Leaf);
                }
            }
        };
        let car = |b: &mut Self, n: V3, r: f64, q0: f64, w: f64, p: Pn| {
            let (h, k) = (1.05, 1.0);
            for (dq, dh, rr, pp) in [(-0.032 * k, 0.0, 0.034 * k, p), (0.032 * k, 0.0, 0.034 * k, p), (0.0, 0.03 * k, 0.024 * k, Pn::Pane)] {
                let fly = Fly { n, r, q: q0 + dq / sin(r), w, h: h + dh };
                b.o.solids.push(Solid { c: fly.at(0.0), r: rr, kind: Kind::Tower { s: None, p: pp, w: 0.0 }, fly: Some(fly) });
            }
        };
        ring(self, e1, PI / 2.0, 0.03, Pave::Street);
        ring(self, nn, 0.62, 0.03, Pave::Street);
        let c1 = self.cap(0.32, 3.9);
        ring(self, c1, 0.15, 0.0, Pave::Pool);
        let c2 = self.cap(0.45, 1.6);
        ring(self, c2, 0.2, 0.0, Pave::Plaza);
        hq(self, 0.9, 1.6, 0.38, true, Pn::Hull);
        hq(self, 1.0, 0.98, 0.2, false, Pn::Hull);
        tower(self, 1.1, 2.25, 0.3, 0.06, Pn::Hull, Pn::Pane, 0.16);
        tower(self, 1.75, 1.0, 0.5, 0.07, Pn::Hull, Pn::Pane, 0.16);
        tower(self, 1.9, 0.7, 0.7, 0.06, Pn::Aqua, Pn::Pane, 0.16);
        tower(self, 1.8, 2.4, 0.6, 0.08, Pn::Peach, Pn::Pane, 0.16);
        tower(self, 2.0, 2.1, 0.9, 0.065, Pn::Hull, Pn::Pane, 0.16);
        for (th, a, k) in [(0.95, 0.5, 1.0), (0.62, 3.3, 0.85), (1.05, 5.6, 0.9), (0.75, 4.6, 1.0), (1.2, 3.2, 1.1), (0.4, 2.5, 0.7), (0.4, 1.3, 0.7)] {
            palm(self, th, a, k);
        }
        hq(self, 0.85, 4.0, 0.1, false, Pn::Peach);
        hq(self, 0.95, 5.0, 0.1, false, Pn::Aqua);
        hq(self, 0.85, 0.3, 0.1, false, Pn::Hull);
        car(self, nn, 0.62, 0.0, 0.5, Pn::Peach);
        car(self, nn, 0.62, 2.5, 0.5, Pn::Aqua);
        car(self, e1, PI / 2.0, 1.0, -0.4, Pn::Hull);
        self.bush(0.3, 5.2, 0.05);
        self.bush(0.55, 5.6, 0.04);
        self.bush(0.2, 0.6, 0.045);
        let spots = [
            [1.0, 3.5, 0.1],
            [0.45, 5.3, 0.1],
            [1.15, 4.5, 0.1],
            [1.25, 3.85, 0.09],
            [0.3, 5.85, 0.09],
            [0.85, 0.9, 0.1],
            [1.25, 5.2, 0.1],
            [0.85, 2.8, 0.09],
            [1.25, 0.2, 0.1],
        ];
        let n = (self.g.scenery_house as usize).min(spots.len());
        for (i, [a, b, r]) in spots[..n].iter().enumerate() {
            hq(self, *a, *b, *r, false, [Pn::Hull, Pn::Peach, Pn::Aqua][i % 3]);
        }
    }

    fn kame(&mut self) {
        let nn = self.n();
        let palm = |b: &mut Self, th: f64, a: f64, k: f64, lean: f64| {
            let s = b.cap(th, a);
            let t1 = norm(cross(s, nn));
            let t2 = cross(s, t1);
            for i in 1..=8 {
                let f = i as f64 / 8.0;
                b.push(add(mul(s, 1.0 + 0.34 * k * f), t1, lean * 0.1 * k * f * f), (0.028 - 0.008 * f) * k, Kind::Trunk);
            }
            let c = add(mul(s, 1.0 + 0.36 * k), t1, lean * 0.1 * k);
            b.push(c, 0.045 * k, Kind::Leaf);
            for j in 0..6 {
                let d = add(mul(t1, cos(j as f64 * 1.05 + 0.3)), t2, sin(j as f64 * 1.05 + 0.3));
                for m in 1..=4 {
                    let m = m as f64;
                    b.push(add(add(c, d, 0.055 * m * k), s, (0.02 * m - 0.014 * m * m) * k), (0.042 - 0.006 * m) * k, Kind::Leaf);
                }
            }
            for j in 0..3 {
                let j = j as f64;
                b.push(add(add(c, s, -0.035 * k), add(mul(t1, cos(j * 2.1)), t2, sin(j * 2.1)), 0.025 * k), 0.02 * k, Kind::Trunk);
            }
        };
        self.o.kh = Some((self.cap(0.1, 4.71), self.cap(0.34, 4.45)));
        palm(self, 0.5, 5.95, 1.0, 0.8);
        palm(self, 0.48, 3.3, 0.85, -0.7);
        self.rock(0.72, 5.6, 0.045);
        self.rock(0.62, 1.6, 0.035);
    }

    fn future(&mut self) {
        let nn = self.n();
        let tower = |b: &mut Self, deg: f64, h: f64, w: f64, lean: f64, smoke: bool, back: f64| {
            let f = deg * PI / 180.0;
            let zr = -0.38 * sin(atan2(sin(f) / 0.92, cos(f)));
            let z = zr.min(0.0) - 0.04 - back;
            let q = (1.0 - z * z).sqrt();
            let bb = [cos(f) * q, sin(f) * q, z];
            let s = norm(add(bb, [-sin(f), cos(f), 0.0], lean));
            let t = add(bb, s, if lean.abs() > 1.0 { h } else { (1.0 + h) / q - 1.0 });
            let seed = b.o.slabs.len() as i64 * 7 + 3;
            b.o.slabs.push(Slab { b: mul(bb, 0.97), t, w, seed });
            if smoke {
                b.o.smokes.push(add(t, s, 0.01));
            }
        };
        let rubble = |b: &mut Self, th: f64, a: f64, r: f64| {
            let p = b.cap(th, a);
            let t1 = norm(cross(p, nn));
            let t2 = cross(p, t1);
            b.push(mul(p, 1.0 - r * 0.3), r, Kind::Stone);
            b.push(add(mul(p, 1.0 - r * 0.4), t1, r * 0.9), r * 0.7, Kind::Leaf);
            b.push(add(mul(p, 1.0 - r * 0.5), t2, -r * 0.8), r * 0.6, Kind::Stone);
        };
        let pool = |b: &mut Self, th: f64, a: f64, r: f64, lava: bool| {
            let p = b.cap(th, a);
            b.push(mul(p, 1.0 - r * 2.3), r * 2.5, Kind::Pool { s: p, lava });
            if lava {
                b.o.smokes.push(mul(p, 1.02));
            }
        };
        let car = |b: &mut Self, th: f64, a: f64| {
            let p = b.cap(th, a);
            let d = norm(cross(nn, p));
            b.push(add(mul(p, 1.0 + 0.012), d, 0.022), 0.03, Kind::Trunk);
            b.push(add(mul(p, 1.0 + 0.012), d, -0.022), 0.03, Kind::Trunk);
            b.push(mul(p, 1.0 + 0.04), 0.022, Kind::Stone);
        };
        let (mut d, mut i) = (-32.0, 0.0);
        while d <= 212.0 {
            let r1 = hash(i * 3.7);
            let r2 = hash(i * 9.1 + 2.0);
            let up = 0f64.max(1.0 - (d - 90.0f64).abs() / 120.0);
            tower(
                self,
                d,
                (0.22 + 0.45 * r1 * r1 + if r1 > 0.8 { 0.2 } else { 0.0 }) * (0.3 + 1.5 * up * up),
                0.065 + 0.03 * r2,
                if r2 > 0.82 {
                    0.25
                } else if r2 < 0.12 {
                    -0.2
                } else {
                    0.0
                },
                i as i64 % 4 == 1,
                0.07,
            );
            if r2 > 0.35 {
                tower(self, d + 4.0, 0.1 + 0.14 * r2, 0.08 + 0.02 * r1, 0.0, false, 0.0);
            }
            d += (5.0 + 6.0 * hash(i * 5.3)) * (1.5 - 0.7 * 0f64.max(1.0 - (d - 90.0f64).abs() / 120.0));
            i += 1.0;
        }
        tower(self, 64.0, 0.3, 0.065, 1.6, false, 0.04);
        tower(self, 150.0, 0.26, 0.06, -1.5, false, 0.04);
        for (i, d) in [-48.0, -58.0, 228.0, 238.0].into_iter().enumerate() {
            tower(self, d, 0.12 + 0.06 * (i % 2) as f64, 0.085, 0.0, false, 0.0);
        }
        for (th, a) in [(1.42, 4.0), (1.43, 4.5), (1.7, 4.8), (1.42, 5.2), (1.72, 0.2), (1.42, 2.9)] {
            car(self, th, a);
        }
        for (th, a, r) in [(0.3, 0.9, 0.12), (0.7, 1.3, 0.1), (0.6, 3.0, 0.09), (0.5, 4.5, 0.1), (1.05, 5.4, 0.12), (0.25, 5.0, 0.09), (1.1, 3.5, 0.11)] {
            pool(self, th, a, r, false);
        }
        pool(self, 0.85, 2.2, 0.14, true);
        pool(self, 0.95, 4.2, 0.12, true);
        pool(self, 0.15, 2.6, 0.1, true);
        for (th, a, r) in [(0.85, 2.8, 0.05), (1.1, 1.7, 0.045), (0.45, 1.7, 0.04), (0.6, 5.8, 0.05), (1.15, 0.6, 0.045), (0.4, 3.9, 0.045), (1.2, 4.9, 0.04)] {
            rubble(self, th, a, r);
        }
        self.o.fut_andro = vec![self.cap(1.3, 3.55), self.cap(1.3, 3.78)];
    }

    fn w2(&mut self) {
        let world = self.g.s.world;
        let t = tones::tones(world);

        let nn = self.n();
        let mut rnd = Pm(31.0 + world as f64 * 7.0);
        let tan = |s: V3| {
            let t1 = norm(cross(s, nn));
            (t1, cross(s, t1))
        };
        let dome = |b: &mut Self, th: f64, a: f64, r: f64| {
            let s = b.cap(th, a);
            let door = b.door_of(s);
            b.push(s, r, Kind::Dome { s, door });
            s
        };
        // a column of spheres straight up from s, unless dir says otherwise
        let stack = |b: &mut Self, s: V3, h: f64, r0: f64, r1: f64, kind: Option<Kind>, p: Option<&[u32]>, dir: V3| {
            let n = (h / (r0.min(r1) * 0.8)).ceil() as i64;
            for i in 0..=n {
                let f = i as f64 / n as f64;
                let c = add(s, dir, h * f);
                let r = r0 + (r1 - r0) * f;
                match p {
                    Some(p) => b.pal(c, r, p, 0.0),
                    None => b.push(c, r, kind.clone().unwrap()),
                }
            }
            add(s, dir, h)
        };
        let res = |b: &mut Self, rnd: &mut Pm, spr: &'static str, th: f64, a: f64, flip: u8, k: f64| {
            let c = b.cap(th, a);
            let ph = rnd.next() * 9.0;
            b.o.res.push(Resident { spr, c, ph, flip, k, hop: 0.0, blink: vec![] });
        };
        if world == 2 {
            let city = |b: &mut Self, th: f64, a: f64, r: f64| {
                let s = dome(b, th, a, r);
                for i in 1..=4 {
                    b.push(mul(s, 1.0 + r + 0.018 * i as f64), 0.009, Kind::Trunk);
                }
                b.push(mul(s, 1.0 + r + 0.09), 0.018, Kind::Knob);
            };
            let s = dome(self, 0.3, 1.57, 0.3);
            let (t1, t2) = tan(s);
            self.pal(mul(s, 1.3), 0.066, W2P.0, 0.1);
            for i in 0..6 {
                let q = i as f64 / 6.0 * 6.283;
                let bb = norm(add(s, add(mul(t1, cos(q)), t2, sin(q)), 0.375));
                let top = stack(self, bb, 0.45, 0.048, 0.024, None, Some(&t.dome), s);
                self.pal(mul(top, 1.03), 0.03, &[0x6a1010, 0x9a1c1c, 0xd03030, 0xff6a5a], 0.1);
            }
            for i in 0..8 {
                let a = 2.4 + i as f64 * 0.7;
                let c = mul(self.cap(0.62, a), 1.06);
                self.pal(c, 0.02, W2P.0, 0.2);
                let c = self.cap(0.62, a);
                stack(self, c, 0.06, 0.022, 0.02, None, Some(&t.dome), c);
            }
            res(self, &mut rnd, "W2S.king", 0.42, 4.71, 0, 1.1);
            city(self, 1.1, 0.4, 0.12);
            city(self, 1.1, 2.75, 0.12);
            city(self, 0.95, 5.6, 0.1);
        }
        if world == 10 {
            let palm = |b: &mut Self, th: f64, a: f64, k: f64, lean: f64| {
                let s = b.cap(th, a);
                let (t1, t2) = tan(s);
                for i in 1..=8 {
                    let f = i as f64 / 8.0;
                    b.push(add(mul(s, 1.0 + 0.34 * k * f), t1, lean * 0.1 * k * f * f), (0.028 - 0.008 * f) * k, Kind::Trunk);
                }
                let c = add(mul(s, 1.0 + 0.36 * k), t1, lean * 0.1 * k);
                b.push(c, 0.045 * k, Kind::Leaf);
                for j in 0..6 {
                    let d = add(mul(t1, cos(j as f64 * 1.05 + 0.3)), t2, sin(j as f64 * 1.05 + 0.3));
                    for m in 1..=4 {
                        let m = m as f64;
                        b.push(add(add(c, d, 0.055 * m * k), s, (0.02 * m - 0.014 * m * m) * k), (0.042 - 0.006 * m) * k, Kind::Leaf);
                    }
                }
            };
            let s = dome(self, 0.3, 1.57, 0.22);
            let (t1, t2) = tan(s);
            self.pal(mul(s, 1.22), 0.044, W2P.0, 0.1);
            self.pal(mul(s, 1.28), 0.02, W2P.0, 0.2);
            for i in 0..6 {
                let q = i as f64 / 6.0 * 6.283 + 0.4;
                let bb = norm(add(s, add(mul(t1, cos(q)), t2, sin(q)), 0.253));
                let top = stack(self, bb, 0.2, 0.037, 0.031, None, Some(&t.dome), bb);
                self.pal(mul(top, 1.026), 0.042, &t.band, 0.1);
                self.pal(mul(top, 1.07), 0.022, &t.band, 0.2);
                self.pal(mul(top, 1.1), 0.011, &t.band, 0.3);
            }
            for (i, [d, r]) in [[0.98, 0.2], [1.08, 0.13], [1.17, 0.085], [1.25, 0.055], [1.31, 0.035]].into_iter().enumerate() {
                self.pal(mul(nn, -d), r, &t.under, (i & 1) as f64 * 0.12 - 0.04);
            }
            self.pal(mul(nn, -1.36), 0.03, W2P.0, 0.2);
            res(self, &mut rnd, "W2S.dende", 0.5, 4.35, 1, 1.0);
            res(self, &mut rnd, "W2S.popo", 0.5, 5.05, 2, 1.0);
            palm(self, 0.82, 0.3, 0.85, 0.5);
            palm(self, 0.82, 2.85, 0.85, -0.5);
            palm(self, 0.86, 3.72, 0.8, -0.3);
            palm(self, 0.86, 5.68, 0.8, 0.3);
            self.o.pole = true;
        }
        if world == 11 {
            let s = self.cap(0.95, 2.45);
            let (t1, t2) = tan(s);
            for i in 0..=9 {
                self.push(mul(s, 1.0 + 0.055 * i as f64), 0.07 - 0.004 * i as f64, Kind::Trunk);
            }
            for d in [1.0, -1.0] {
                for i in 1..=3 {
                    let i = i as f64;
                    self.push(add(mul(s, 1.0 + 0.32 + 0.05 * i), t1, d * 0.05 * i), 0.028, Kind::Trunk);
                }
            }
            let c = mul(s, 1.62);
            self.push(c, 0.2, Kind::Leaf);
            for j in 0..7 {
                let q = j as f64 * 0.9;
                self.push(add(add(add(c, t1, cos(q) * 0.19), t2, sin(q) * 0.19), s, -0.03), 0.12 + 0.03 * (j % 3) as f64, Kind::Leaf);
            }
            self.push(mul(s, 1.82), 0.14, Kind::Leaf);
            let mush = |b: &mut Self, th: f64, a: f64, k: f64, p: &[u32]| {
                let s = b.cap(th, a);
                let (t1, t2) = tan(s);
                let top = stack(b, s, 0.3 * k, 0.024 * k, 0.02 * k, Some(Kind::Trunk), None, s);
                b.pal(mul(top, 1.01), 0.075 * k, p, 0.05);
                for j in 0..7 {
                    let q = j as f64 * 0.9;
                    b.pal(add(add(mul(top, 1.0 - 0.015 * k), t1, cos(q) * 0.07 * k), t2, sin(q) * 0.07 * k), 0.05 * k, p, -0.05);
                }
            };
            for _ in 0..6 {
                let th = 0.42 + (rnd.next() - 0.5) * 0.13;
                let a = 4.15 + (rnd.next() - 0.5) * 0.27;
                let r = 0.09 * (0.5 + rnd.next() * 0.4);
                self.rock(th, a, r);
            }
            let c = mul(self.cap(0.42, 4.15), 1.018);
            self.push(c, 0.072, Kind::Stone);
            let c = mul(self.cap(0.42, 4.15), 1.095);
            self.o.res.push(Resident { spr: "W2S.zsword", c, ph: 0.0, flip: 0, k: 1.0, hop: 0.0, blink: vec![] });
            res(self, &mut rnd, "W2S.shin", 0.45, 4.85, 1, 1.0);
            res(self, &mut rnd, "W2S.kibito", 0.4, 5.55, 1, 1.0);
            mush(self, 0.95, 0.5, 0.9, &t.pinkg);
            mush(self, 1.15, 1.1, 0.7, &t.leaf);
            self.rock(0.6, 3.6, 0.05);
        }
        if world == 12 {
            let bulb = |b: &mut Self, rnd: &mut Pm, th: f64, a: f64, k: f64| {
                let s = b.cap(th, a);
                let (t1, _) = tan(s);
                let curl = (rnd.next() - 0.5) * 0.16;
                let mut c = s;
                for i in 1..=7 {
                    let f = i as f64 / 7.0;
                    c = add(mul(s, 1.0 + 0.32 * k * f), t1, curl * k * sin(f * 2.4));
                    b.push(c, (0.024 - 0.008 * f) * k, Kind::Trunk);
                }
                let seed = rnd.next() * 50.0;
                b.push(mul(c, 1.0 + 0.05 * k), 0.07 * k, Kind::Spot { pal: t.leaf.clone(), pal2: t.dot.clone(), f: 26.0, seed, lift: 0.0 });
                for d in [-1.0, 1.0] {
                    let seed = rnd.next() * 50.0;
                    b.push(
                        add(mul(s, 1.0 + 0.14 * k), t1, d * 0.06 * k),
                        0.03 * k,
                        Kind::Spot { pal: t.leaf.clone(), pal2: t.dot.clone(), f: 30.0, seed, lift: 0.0 },
                    );
                }
            };
            let hut = |b: &mut Self, th: f64, a: f64, r: f64| {
                let s = dome(b, th, a, r);
                let base = mul(s, 1.0 + r * 0.75);
                stack(b, base, r * 0.7, r * 0.62, r * 0.1, None, Some(&t.dome), base);
                b.pal(mul(s, 1.0 + r * 1.55), r * 0.12, &t.band, 0.2);
            };
            hut(self, 0.55, 1.0, 0.16);
            hut(self, 0.5, 2.3, 0.14);
            hut(self, 0.9, 1.65, 0.12);
            bulb(self, &mut rnd, 0.9, 0.4, 0.9);
            bulb(self, &mut rnd, 0.85, 3.0, 0.8);
            bulb(self, &mut rnd, 0.7, 5.8, 0.7);
            let folk = |b: &mut Self, rnd: &mut Pm, spr: &'static str, spots: &[(f64, f64)], flip: u8, hop: f64| {
                let blink = spots.iter().map(|&(th, a)| b.cap(th, a)).collect();
                let ph = rnd.next() * 3.0;
                b.o.res.push(Resident { spr, c: [0.0; 3], ph, flip, k: 1.0, hop, blink });
            };
            folk(self, &mut rnd, "W2S.elder", &[(0.3, 4.71), (0.3, 4.71)], 0, 0.0);
            folk(self, &mut rnd, "W2S.yard", &[(0.45, 5.5), (0.15, 1.0)], 1, 3.0);
            folk(self, &mut rnd, "W2S.yard2", &[(0.5, 3.95), (0.15, 2.2)], 0, 3.0);
        }
    }

    fn top(&mut self) {
        let mut rnd = Pm(77.0);
        let d = top_dmg(self.g);
        let n = planet_core::num::js_round(d * 26.0) as i64;
        for _ in 0..n {
            let th = 0.1 + rnd.next() * 1.35;
            let a = rnd.next() * 6.283;
            let r = (0.012 + rnd.next() * 0.022) * (1.0 + d * 0.8);
            if (th - 1.571).abs() < 0.12 {
                continue;
            }
            let c = mul(self.cap(th, a), 1.0 + r * 0.15);
            self.push(c, r, Kind::TopChunk);
        }
    }
}

/// `TOP.dmg` as `topSync` sets it: none at universe 9, most of the floor by 11, all of it in ∞.
pub fn top_dmg(g: &Game) -> f64 {
    if !g.s.multi {
        return 0.0;
    }
    let n = planet_core::data::LADDER.len() as f64;
    if g.top_uni as f64 >= n {
        1.0
    } else {
        0.7 * g.top_uni as f64 / (n - 1.0)
    }
}

/// `scenery()` for the game's world.
pub fn build(g: &Game) -> Built {
    let mut b = B { o: Built::default(), g };
    match g.s.world {
        9 => b.top(),
        5 => b.westcity(),
        6 => b.kame(),
        8 => b.future(),
        2 | 10 | 11 | 12 => b.w2(),
        7 => b.paozu(),
        _ => b.default_world(),
    }
    b.o
}

/// `slab(o, id)`: a skyscraper as an upright slab in screen space, with a window grid and a jagged broken top.
pub fn slab(c: &mut Ctx, o: &Slab, id: u16) {
    let m = c.m;
    let b = planet_core::geom::ap(&m, o.b);
    let t = planet_core::geom::ap(&m, o.t);
    let (x0_, y0_) = (c.cx + b[0] * c.r, c.cy - b[1] * c.r + c.bob);
    let (x1_, y1_) = (c.cx + t[0] * c.r, c.cy - t[1] * c.r + c.bob);
    let len = hypot(&[x1_ - x0_, y1_ - y0_]);
    let len = if len == 0.0 { 1.0 } else { len };
    let (ux, uy) = ((x1_ - x0_) / len, (y1_ - y0_) / len);
    let w = o.w * c.r;
    let (ww, hh) = (c.w, c.h);
    let sg = -uy * -0.62 + ux * -0.78;
    let side = if sg > 0.0 {
        1.0
    } else if sg < 0.0 {
        -1.0
    } else {
        1.0
    };
    let x0 = 0f64.max((x0_.min(x1_) - w - 4.0).floor()) as i64;
    let x1 = (ww - 1.0).min((x0_.max(x1_) + w + 4.0).ceil()) as i64;
    let y0 = 0f64.max((y0_.min(y1_) - w - 4.0).floor()) as i64;
    let y1 = (hh - 1.0).min((y0_.max(y1_) + w + 4.0).ceil()) as i64;
    let jag = w * 1.2;
    let seed = o.seed;
    let cut = |ci: i64| {
        len - jag * (0.35 + 0.65 * h2((ci >> 1) as f64, seed as f64)) - (if seed % 2 != 0 { 1.0 } else { -1.0 }) * (ci as f64 / (2.0 * w) - 0.5) * jag * 0.8
    };
    let road0 = c.tones.road[0];
    for y in y0..=y1 {
        for x in x0..=x1 {
            let (dx, dy) = (x as f64 + 0.5 - x0_, y as f64 + 0.5 - y0_);
            let al = dx * ux + dy * uy;
            let ac = -dx * uy + dy * ux;
            if al < 0.0 || ac < -w || ac > w {
                continue;
            }
            let ci = ((ac + w) as i64) as i32 as i64;
            let top = cut(ci);
            if al > top {
                continue;
            }
            if al > top - 5.0 && h2(((al as i64 as i32 as i64) * 7 + ci) as f64, seed as f64) > 0.78 {
                continue;
            }
            let bulge = 0f64.max(w * w - ac * ac).sqrt();
            let z = (b[2] + (t[2] - b[2]) * al / len) * c.r + bulge;
            let k = y as usize * c.fb.w + x as usize;
            if z <= c.fb.zb[k] as f64 {
                continue;
            }
            c.fb.zb[k] = z as f32;
            c.fb.ib[k] = id;
            let ai = al as i64 as i32 as i64;
            let lum = 0.4 + side * (ac / w) * 0.25;
            let col = if ai % 4 > 1 && ci % 3 == 1 && (ci as f64) < 2.0 * w - 1.0 && al < top - 2.0 {
                let q = h2(((ai >> 2) * 31 + ci) as f64, seed as f64);
                if q > 0.9 {
                    0xe8a050
                } else if q > 0.78 {
                    0x9aaab8
                } else {
                    road0
                }
            } else {
                let i = ((lum - if ai % 8 == 0 { 0.15 } else { 0.0 }) * 5.0) as i64 as i32;
                c.tones.dome[0.max(4.min(i)) as usize]
            };
            c.fb.buf[k] = pk(col, 255);
        }
    }
    let fs: &[f64] = if seed % 3 != 0 { &[-0.45] } else { &[-0.45, 0.35] };
    for &f in fs {
        let ac = f * w;
        let s = if f < 0.0 { -1.0 } else { 1.0 };
        let top = cut(((ac + w) as i64) as i32 as i64);
        for i in 0..3 {
            let i = i as f64;
            let al = top + i;
            let a2 = ac + s * i * 0.45;
            let x = planet_core::num::js_round(x0_ + ux * al - uy * a2);
            let y = planet_core::num::js_round(y0_ + uy * al + ux * a2);
            if x < 0.0 || y < 0.0 || x >= ww || y >= hh {
                continue;
            }
            let k = y as usize * c.fb.w + x as usize;
            let z = (b[2] + (t[2] - b[2]) * al / len) * c.r;
            if z <= c.fb.zb[k] as f64 {
                continue;
            }
            c.fb.zb[k] = z as f32;
            c.fb.ib[k] = id;
            c.fb.buf[k] = pk(if i < 2.0 { 0x4a3022 } else { 0x6a4028 }, 255);
        }
    }
}
