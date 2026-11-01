//! Scene building: one frame of game.js's draw (the part of `frame()` after `// ── draw`) from a `planet_core::Game`.
//! Statement order, float order and `Math.random` draws follow game.js, so the pixels come out identical and the
//! game's random stream stays where game.js leaves it. Screen spots game.js writes back while drawing (where the
//! hero, piccolo, bubbles and the visitors stand) are written back to the game the same way.

use planet_core::fx::Particle;
use planet_core::geom::{ap, dot, mul, norm, V3};
use planet_core::jsmath::{atan2, cos, hypot, pow, sin};
use planet_core::num::js_round;
use planet_core::sprite::{self, Sprite};
use planet_core::Game;

use crate::scenery::{Built, Kind, Pn, Solid};
use crate::tones::{self, Tones};
use crate::visitors::HeroAt;
use crate::{bayer, h2, pk, px, Framebuffer};

/// How the canvas is shown: the site (sky and cloud sea) or the floating desktop widget (no backdrop; its own clouds).
#[derive(Clone, Debug)]
pub struct View {
    /// `st.scale`: CSS pixels per game pixel (3 desktop, 2 phone; the widget 1 or 2)
    pub scale: f64,
    /// the widget with nothing behind it (`BARE`)
    pub bare: bool,
    /// the widget's clouds (`st.clouds`): 'a'..'e', or none
    pub clouds: Option<char>,
    /// `st.cloudAmt`, 1-5
    pub cloud_amt: f64,
}

impl View {
    pub fn site(scale: f64) -> Self {
        View { scale, bare: false, clouds: None, cloud_amt: 2.0 }
    }
}

/// What game.js keeps between frames for drawing only.
#[derive(Default)]
pub struct Scene {
    pub(crate) built: Built,
    /// the arena's baked void, for its canvas size
    void: Option<(usize, usize, Vec<u32>)>,

    /// shenron's track per look, built on first use
    tracks: std::collections::HashMap<usize, crate::shenron::Track>,
    key: Option<(u32, u32, u32)>,
    /// Where the drawing's random numbers come from: `None` shares the game's stream, as game.js does (the diffs need
    /// that); `Some` keeps the game's stream as it is headless, as the `--rust` page's game.js twin did
    pub own_rng: Option<planet_core::rng::Lcg>,
    /// the time chamber's last frame (`echo`), empty outside it
    pub(crate) echo: Vec<u32>,
    /// the last instant transmission's departure (`itxFx`)
    itx_fx: Option<ItxFx>,
    tones_key: Option<(u32, u8)>,
    pub tones: Option<Tones>,
    /// the transformation scene's rocks and lightning, while it runs
    pub(crate) xf: Option<crate::xform::XfFx>,
    /// a limit break's or a milestone's drawing state, while it plays
    pub(crate) mo: Option<crate::limits::MoFx>,
    /// a saga boss's arrival behind the scouter
    pub(crate) bi: Option<crate::intro::IntroFx>,
    /// this frame draws the bare widget (no sky)
    pub(crate) bare: bool,
    /// the sky's glass after a tier 4 shockwave, and the wave that last cracked it
    pub(crate) glass: Option<crate::waves::Glass>,
    pub(crate) glass_last: Option<f64>,
}

/// `V.norm([-.55, .7, .55])`, as game.js computes it.
fn light_dir() -> V3 {
    norm([-0.55, 0.7, 0.55])
}

/// game.js `vnoise3`.
pub fn vnoise3(x: f64, y: f64, z: f64) -> f64 {
    let (xi, yi, zi) = (x.floor(), y.floor(), z.floor());
    let (xf, yf, zf) = (x - xi, y - yi, z - zi);
    let s = |t: f64| t * t * (3.0 - 2.0 * t);
    let (u, v, w) = (s(xf), s(yf), s(zf));
    let hh = |a: f64, b: f64, c: f64| h2(a * 73.0 + c * 151.0, b * 37.0 - c * 17.0);
    let l = |a: f64, b: f64, t: f64| a + (b - a) * t;
    l(
        l(l(hh(xi, yi, zi), hh(xi + 1.0, yi, zi), u), l(hh(xi, yi + 1.0, zi), hh(xi + 1.0, yi + 1.0, zi), u), v),
        l(l(hh(xi, yi, zi + 1.0), hh(xi + 1.0, yi, zi + 1.0), u), l(hh(xi, yi + 1.0, zi + 1.0), hh(xi + 1.0, yi + 1.0, zi + 1.0), u), v),
        w,
    )
}

/// world.js `hash`.
pub fn hash(n: f64) -> f64 {
    let s = sin(n * 127.1 + 311.7) * 43758.5453;
    s - s.floor()
}

pub fn ap_t(m: &[f64; 9], v: V3) -> V3 {
    [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]]
}

/// `tone(pal, lum, x, y)`: a dithered pick from a palette.
pub fn tone(pal: &[u32], lum: f64, x: i64, y: i64) -> u32 {
    let n = pal.len() as f64;
    let i = ((lum + (bayer(x as i32, y as i32) - 0.5) * 0.2) * n).floor();
    pal[0f64.max((n - 1.0).min(i)) as usize]
}

fn mix_c(a: u32, b: u32, k: f64) -> u32 {
    let k = 0f64.max(1f64.min(k));
    let c = |sh: u32| js_round(((a >> sh) & 255) as f64 + (((b >> sh) & 255) as f64 - ((a >> sh) & 255) as f64) * k) as u32;
    (c(16) << 16) | (c(8) << 8) | c(0)
}

const F3: [(char, &str); 46] = [
    ('0', "111101101101111"),
    ('1', "010110010010111"),
    ('2', "111001111100111"),
    ('3', "111001111001111"),
    ('4', "101101111001001"),
    ('5', "111100111001111"),
    ('6', "111100111101111"),
    ('7', "111001010010010"),
    ('8', "111101111101111"),
    ('9', "111101111001111"),
    ('+', "000010111010000"),
    ('-', "000000111000000"),
    ('x', "000101010101000"),
    (' ', "000000000000000"),
    ('K', "101101110101101"),
    ('.', "000000000000010"),
    ('A', "010101111101101"),
    ('B', "110101110101110"),
    ('C', "011100100100011"),
    ('D', "110101101101110"),
    ('E', "111100110100111"),
    ('F', "111100110100100"),
    ('G', "011100101101011"),
    ('H', "101101111101101"),
    ('I', "111010010010111"),
    ('J', "001001001101010"),
    ('L', "100100100100111"),
    ('M', "101111111101101"),
    ('N', "110101101101101"),
    ('O', "010101101101010"),
    ('P', "110101110100100"),
    ('Q', "010101101110011"),
    ('R', "110101110101101"),
    ('S', "011100010001110"),
    ('T', "111010010010010"),
    ('U', "101101101101111"),
    ('V', "101101101101010"),
    ('W', "101101111111101"),
    ('X', "101101010101101"),
    ('Y', "101101010010010"),
    ('Z', "111001010100111"),
    ('!', "010010010000010"),
    ('\'', "010010000000000"),
    ('?', "000000000000000"),
    ('/', "000000000000000"),
    (',', "000000000000000"),
];

/// world.js `st.text` with the 3×5 font.
pub fn text(fb: &mut Framebuffer, s: &str, x: f64, y: f64, hex: u32, a: f64) {
    let mut cx = js_round(x);
    for ch in s.to_uppercase().chars() {
        let g = F3.iter().find(|f| f.0 == ch && !matches!(ch, '?' | '/' | ',')).map(|f| f.1).unwrap_or("000000000000000");
        for j in 0..5 {
            for i in 0..3 {
                if g.as_bytes()[j * 3 + i] == b'1' {
                    fb.px(cx + i as f64, y + j as f64, hex, a);
                }
            }
        }
        cx += 4.0;
    }
}

pub fn text_width(s: &str) -> f64 {
    s.chars().count() as f64 * 4.0 - 1.0
}

/// world.js `st.blit`: a sprite at a whole pixel, unscaled (night tint never applies on the planet).
pub fn blit(fb: &mut Framebuffer, spr: &Sprite, x: f64, y: f64, flip: bool) {
    let (x, y) = (js_round(x), js_round(y));
    for j in 0..spr.h {
        for i in 0..spr.w {
            let si = j * spr.w + if flip { spr.w - 1 - i } else { i };
            let c = spr.col[si];
            if c < 0 {
                continue;
            }
            fb.px(x + i as f64, y + j as f64, c as u32, 1.0);
        }
    }
}

/// The per-frame context: the camera and world, as game.js's closure sees them.
pub struct Ctx<'a> {
    pub fb: &'a mut Framebuffer,
    pub w: f64,
    pub h: f64,
    pub cx: f64,
    pub cy: f64,
    pub r: f64,
    pub m: [f64; 9],
    pub bob: f64,
    pub t: f64,
    pub l: V3,
    pub world: u32,
    pub tones: &'a Tones,
}

impl Ctx<'_> {
    pub fn light(&self, n: V3) -> f64 {
        0f64.max(dot(n, self.l)) * 0.78 + 0.22
    }

    /// `blitZ`: a sprite stood on (bx, by), tipped by ang, lifted, scaled by k, against the depth buffer.
    #[allow(clippy::too_many_arguments)]
    pub fn blit_z(&mut self, spr: &Sprite, bx: f64, by: f64, ang: f64, flip: bool, lift: f64, depth: f64, k: f64) {
        let (ux, uy, rx, ry) = (sin(ang), -cos(ang), cos(ang), sin(ang));
        let (ox, oy) = (bx + ux * lift, by + uy * lift);
        let rr = (hypot(&[spr.w as f64, spr.h as f64]) + 1.0) * k;
        let (w, h) = (self.w, self.h);
        let mut y = (oy - rr).floor();
        while y <= oy + rr {
            if y >= 0.0 && y < h {
                let mut x = (ox - rr).floor();
                while x <= ox + rr {
                    if x >= 0.0 && x < w {
                        let (dx, dy) = (x + 0.5 - ox, y + 0.5 - oy);
                        let (lx, ly) = ((dx * rx + dy * ry) / k, (dx * ux + dy * uy) / k);
                        let i = (lx + spr.ax + 0.5).floor();
                        let j = (spr.ay + 0.5 - ly).floor();
                        if i >= 0.0 && j >= 0.0 && i < spr.w as f64 && j < spr.h as f64 {
                            let i = if flip { spr.w - 1 - i as usize } else { i as usize };
                            let c = spr.col[j as usize * spr.w + i];
                            if c >= 0 {
                                let kk = y as usize * self.fb.w + x as usize;
                                if !(self.fb.zb[kk] as f64 > depth) {
                                    self.fb.buf[kk] = pk(c as u32, 255);
                                }
                            }
                        }
                    }
                    x += 1.0;
                }
            }
            y += 1.0;
        }
    }

    /// `kaioAura`: the sprite washed red, a pulsing red rim and flames licking up, depth-tested like the sprite.
    #[allow(clippy::too_many_arguments)]
    fn kaio_aura(&mut self, spr: &Sprite, bx: f64, by: f64, ang: f64, flip: bool, lift: f64, depth: f64, k: f64, t: f64) {
        let (ux, uy, rx, ry) = (sin(ang), -cos(ang), cos(ang), sin(ang));
        let (ox, oy) = (bx + ux * lift, by + uy * lift);
        let rr = (hypot(&[spr.w as f64, spr.h as f64]) + 6.0) * k;
        let on = |i: f64, j: f64| {
            i >= 0.0
                && j >= 0.0
                && i < spr.w as f64
                && j < spr.h as f64
                && spr.col[j as usize * spr.w + if flip { spr.w - 1 - i as usize } else { i as usize }] >= 0
        };
        let pulse = 0.5 + 0.5 * sin(t * 9.0);
        let f = (t * 12.0).floor();
        let wash = 0.12 + 0.08 * pulse;
        let mut y = (oy - rr).floor();
        while y <= oy + rr {
            if y >= 0.0 && y < self.h {
                let mut x = (ox - rr).floor();
                while x <= ox + rr {
                    if x >= 0.0 && x < self.w {
                        let kk = y as usize * self.fb.w + x as usize;
                        if !(self.fb.zb[kk] as f64 > depth) {
                            let (dx, dy) = (x + 0.5 - ox, y + 0.5 - oy);
                            let i = ((dx * rx + dy * ry) / k + spr.ax + 0.5).floor();
                            let j = (spr.ay + 0.5 - (dx * ux + dy * uy) / k).floor();
                            let b = &mut self.fb.buf[kk];
                            if on(i, j) {
                                let p = *b;
                                let (r, g, bl) = ((p & 255) as f64, ((p >> 8) & 255) as f64, ((p >> 16) & 255) as f64);
                                let rr2 = ((r + (255.0 - r) * wash) as i64 as u32) & 255;
                                let gg = (g * (1.0 - wash)) as u32;
                                let bb = (bl * (1.0 - wash)) as u32;
                                *b = pk(((rr2 << 16) | (gg << 8) | bb) & 0xffffff, 255);
                            } else if on(i - 1.0, j) || on(i + 1.0, j) || on(i, j - 1.0) || on(i, j + 1.0) {
                                *b = pk(if pulse > 0.5 { 0xff4a3a } else { 0xe0332b }, 255);
                            } else {
                                let fl = 2.0 + ((h2(i * 13.0 + f * 7.0, f) * 4.0) as i64) as f64;
                                let mut q = 0.0;
                                let mut n = 2.0;
                                while n <= fl {
                                    if on(i, j + n) {
                                        q = n;
                                        break;
                                    }
                                    n += 1.0;
                                }
                                if q != 0.0 {
                                    *b = pk(
                                        if q >= fl {
                                            0xffd0c0
                                        } else if q > 2.0 {
                                            0xff8a6a
                                        } else {
                                            0xff4a3a
                                        },
                                        255,
                                    );
                                } else if (on(i - 2.0, j) || on(i + 2.0, j) || on(i, j + 2.0)) && bayer(x as i32, y as i32) < 0.25 + 0.35 * pulse {
                                    *b = pk(0xb0201a, 255);
                                }
                            }
                        }
                    }
                    x += 1.0;
                }
            }
            y += 1.0;
        }
    }

    /// `sphere(o, id, shade)`: a depth-tested, shaded sphere.
    fn sphere(&mut self, c: V3, r: f64, id: u16, shade: &mut dyn FnMut(&Ctx, V3, i64, i64) -> u32) {
        let v = ap(&self.m, c);
        let (x_, y_, z_) = (self.cx + v[0] * self.r, self.cy - v[1] * self.r + self.bob, v[2] * self.r);
        let pr = r * self.r;
        let (w, h) = (self.w, self.h);
        let x0 = 0f64.max((x_ - pr).floor()) as i64;
        let x1 = (w - 1.0).min((x_ + pr).ceil()) as i64;
        let y0 = 0f64.max((y_ - pr).floor()) as i64;
        let y1 = (h - 1.0).min((y_ + pr).ceil()) as i64;
        let r2 = pr * pr;
        for y in y0..=y1 {
            let dy = y as f64 + 0.5 - y_;
            for x in x0..=x1 {
                let dx = x as f64 + 0.5 - x_;
                let q = r2 - dx * dx - dy * dy;
                if q < 0.0 {
                    continue;
                }
                let sq = q.sqrt();
                let z = z_ + sq;
                let k = y as usize * self.fb.w + x as usize;
                if z <= self.fb.zb[k] as f64 {
                    continue;
                }
                self.fb.zb[k] = z as f32;
                self.fb.ib[k] = id;
                let col = shade(self, [dx / pr, -dy / pr, sq / pr], x, y);
                self.fb.buf[k] = pk(col, 255);
            }
        }
    }
}

impl Scene {
    pub fn new() -> Self {
        Self::default()
    }

    /// world.js `particleSystem().step`: age, move and draw every particle, newest first.
    pub(crate) fn step_fx(fx: &mut Vec<Particle>, fb: &mut Framebuffer, dt: f64) {
        let mut i = fx.len();
        while i > 0 {
            i -= 1;
            let p = &mut fx[i];
            p.age += dt;
            if p.age >= p.life {
                fx.remove(i);
                continue;
            }
            p.vy += p.g * dt;
            p.vx *= 1.0 - p.drag * dt;
            p.vy *= 1.0 - p.drag * dt;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            let k = p.age / p.life;
            let s = 1f64.max(js_round(p.s + p.grow * k));
            let n = p.c.len() as f64;
            let ci = (n - 1.0).min((k * n).floor()) as usize;
            let (px0, py0, c) = (js_round(p.x), js_round(p.y), p.c[ci]);
            let mut j = 0.0;
            while j < s {
                let mut i2 = 0.0;
                while i2 < s {
                    let (x, y) = (px0 + i2, py0 + j);
                    if !(k > 0.45 && bayer(x as i64 as i32, y as i64 as i32) < (k - 0.45) * 1.9) {
                        fb.px(x, y, c, 1.0);
                    }
                    i2 += 1.0;
                }
                j += 1.0;
            }
        }
    }

    /// The scenery's solids for the game's world and the houses game.js last built (`Game::scenery_house`).
    fn sync(&mut self, g: &Game) {
        let key = (g.s.world, g.scenery_house.min(9), if g.s.world == 9 { g.top_uni } else { 0 });
        if self.key != Some(key) {
            self.key = Some(key);
            self.built = crate::scenery::build(g);
        }
        // janemba's jelly world and bojack's earth recolour the planet (`recolour`) until the movie ends; the sea stays
        let look = g.tl.movie.as_ref().map_or(0, |m| {
            if m.o.jelly {
                1
            } else if m.o.earth {
                2
            } else {
                0
            }
        });
        if self.tones_key != Some((g.s.world, look)) {
            self.tones_key = Some((g.s.world, look));
            let mut t = tones::tones(g.s.world);
            if look != 0 {
                let sea = t.sea.clone();
                t = if look == 1 { tones::jelly() } else { tones::tones(5) };
                t.sea = sea;
            }
            self.tones = Some(t);
        }
    }

    /// One frame's drawing, after `Game::frame(t, dt)` has run: game.js's `frame()` from `// ── draw` to `st.flush()`.
    pub fn draw(&mut self, fb: &mut Framebuffer, g: &mut Game, view: &View, dt0: f64) {
        g.drawn_here = true;
        // with its own generator, the drawing's random draws (particles) leave the game's stream alone
        if let Some(r) = self.own_rng.as_mut() {
            std::mem::swap(&mut g.rng, r);
        }
        self.draw_frame(fb, g, view, dt0);
        if let Some(r) = self.own_rng.as_mut() {
            std::mem::swap(&mut g.rng, r);
        }
    }

    fn draw_frame(&mut self, fb: &mut Framebuffer, g: &mut Game, view: &View, dt0: f64) {
        self.sync(g);
        self.bare = view.bare;
        let t = g.t;
        let dt = if g.b.chamber_until > t && g.s.world != 3 { dt0 * 0.3 } else { dt0 };
        fb.clear();
        let tones = self.tones.take().unwrap();
        let world = g.s.world;
        let mut c =
            Ctx { fb, w: g.cam.w, h: g.cam.h, cx: g.cam.cx, cy: g.cam.cy, r: g.cam.r, m: g.cam.m, bob: g.cam.bob, t, l: light_dir(), world, tones: &tones };
        if world == 3 && g.tl.snk.is_some() {
            crate::snake::draw(&mut c, g, view, dt);
            self.tones = Some(tones);
            return;
        }
        let dusk = g.dusk();
        let sea = dusk.as_ref().and_then(|d| crate::storm::sea(&tones.sea, d)).unwrap_or_else(|| sea_pal(&tones.sea, g.tl.night_k));
        if world != 9 {
            self.xf_sky(&mut c, g, view);
        }
        if world == 9 {
            crate::top::draw_void(&mut c, g, &mut self.void, view.bare);
            self.xf_sky(&mut c, g, view);
        } else if view.bare {
            if view.clouds.is_some() {
                draw_clouds(&mut c, view, &sea, false);
            }
        } else {
            draw_sea(&mut c, view, &sea, world, false, crate::waves::part(g, t));
        }
        self.mo_back(&mut c, g);
        self.waves_back(&mut c, g, view);
        if let Some(m) = g.tl.moon.clone() {
            draw_moon(&mut c, &m);
        }
        let mut id: u16 = 1;
        planet(&mut c, g, &self.built, id);
        id += 1;
        for o in self.built.solids.iter_mut() {
            if let Some(fly) = &o.fly {
                o.c = fly.at(t);
            }
            let o2 = o.clone();
            // buu's candy: a tree or a house he's zapped
            let sweet = crate::games::sweet(g, o2.c);
            if sweet != 0 {
                let (leaf, trunk) = (matches!(o2.kind, Kind::Leaf), matches!(o2.kind, Kind::Trunk));
                c.sphere(o2.c, o2.r, id, &mut |c, n, x, y| crate::games::candy_shade(c, sweet, leaf, trunk, n, x, y));
            } else {
                c.sphere(o2.c, o2.r, id, &mut |c, n, x, y| shade_solid(c, &o2, n, x, y));
            }
            id = id.wrapping_add(1);
        }
        for s in &self.built.slabs {
            crate::scenery::slab(&mut c, s, id);
            id = id.wrapping_add(1);
        }
        let orbs = g.tl.orbs.clone();
        for o in &orbs {
            let cc = mul(g.frame3.road_pt(o.phi), 1.14 + sin(t * 4.0 + o.phi) * 0.015);
            let pal = if o.star { tones.dorb.clone() } else { tones.orb.clone() };
            let star = o.star;
            c.sphere(cc, if star { 0.055 } else { 0.045 }, id, &mut |c, n, x, y| {
                if star {
                    tone(&pal, c.light(n) * 0.55 + 0.5, x, y)
                } else {
                    tone(&pal, c.light(n) * 0.5 + 0.55, x, y)
                }
            });
            id = id.wrapping_add(1);
        }
        if let Some(b) = g.tl.bean.as_mut() {
            let v = ap(&c.m, b.c);
            b.sx = if v[2] > 0.0 { Some((c.cx + v[0] * c.r, c.cy - v[1] * c.r + c.bob)) } else { None };
        }
        px::outline(c.fb);
        crate::games::draw_ring(&mut c, g);
        // the decor a milestone unlocked, stood off the road
        if let Some(l) = g.look(planet_core::looks::LookKind::Decor) {
            let p = g.frame3.cap_pt(1.15, 2.4);
            let v = ap(&c.m, p);
            if v[2] > 0.0 {
                let (sx, sy) = (c.cx + v[0] * c.r, c.cy - v[1] * c.r + c.bob);
                c.blit_z(planet_core::looks::decor_sprite(l.id), sx, sy, atan2(v[0], v[1]), false, 0.0, v[2] * c.r + 3.0, 1.4);
            }
        }
        // dragon balls get a red star on their face
        for o in &orbs {
            if !o.star {
                continue;
            }
            let v = ap(&c.m, mul(g.frame3.road_pt(o.phi), 1.14 + sin(t * 4.0 + o.phi) * 0.015));
            if v[2] < 0.1 {
                continue;
            }
            let x = js_round(c.cx + v[0] * c.r) - 1.0;
            let y = js_round(c.cy - v[1] * c.r + c.bob) - 1.0;
            let k = y * c.w + x;
            if k < 0.0 || k >= (c.fb.w * c.fb.h) as f64 || c.fb.zb[k as usize] as f64 > v[2] * c.r + 0.055 * c.r + 1.0 {
                continue;
            }
            let pat: &[&str] = if 0.055 * c.r >= 4.0 {
                &["...r...", "..rrr..", "rrrrrrr", ".rrrrr.", "..rrr..", ".rr.rr.", ".r...r."]
            } else {
                &["..r..", ".rrr.", "rrrrr", ".rrr.", ".r.r."]
            };
            let hh = (pat.len() >> 1) as f64;
            for (j, row) in pat.iter().enumerate() {
                for (i, ch) in row.bytes().enumerate() {
                    if ch == b'r' {
                        c.fb.px(x + i as f64 - hh, y + j as f64 - hh, 0xd8241e, 1.0);
                    }
                }
            }
        }
        // drawn after the planet's outline, depth-tested so the planet, trees and runner occlude him
        if let Some(sh) = g.tl.shen.clone() {
            c.fb.dm.fill(0);
            let mut sc = crate::shenron::Ctx {
                fb: &mut *c.fb,
                z: 0.0,
                w: c.w,
                h: c.h,
                cx: c.cx,
                cy: c.cy + c.bob,
                r: c.r,
                t,
                rise: 1f64.min((t - sh.t0) / 1.1),
                age: t - sh.t0 - g.shen_delay(),
                gone: if sh.phase == planet_core::timeline::Phase::Leave { 1f64.min((t - sh.t1) / 1.6) } else { 0.0 },
                glow: sh.look == 3,
            };
            if sh.porunga {
                crate::shenron::draw_porunga(&mut sc);
            } else {
                let tr = self.tracks.entry(sh.look).or_insert_with(|| crate::shenron::Track::new(sh.look));
                crate::shenron::draw(&mut sc, sh.look, tr);
            }
        }
        for i in 0..g.tl.saibas.len() {
            let sb = g.tl.saibas[i].clone();
            let v = ap(&c.m, sb.c);
            let up = 1f64.min(0f64.max((t - sb.born) / 0.5));
            let down = 1f64.min(0f64.max((sb.born + sb.life - t) / 0.5));
            if v[2] < 0.05 || up <= 0.0 {
                g.tl.saibas[i].sx = None;
                continue;
            }
            let (sx, sy) = (c.cx + v[0] * c.r, c.cy - v[1] * c.r + c.bob);
            g.tl.saibas[i].sx = Some((sx, sy));
            let hop = sin((t - sb.born) * 7.0).abs() * 2.0 * up * down;
            let spr = sprite::get(if sb.soldier { "SOLDIER" } else { "SAIBA" });
            c.blit_z(spr, sx, sy, atan2(v[0], v[1]), sin(t * 3.0 + sb.born) > 0.0, (up * down - 1.0) * 11.0 + hop, v[2] * c.r + 4.0, 1.1);
        }
        let hero = self.draw_hero(&mut c, g, dt);
        crate::snack::draw_ramen(&mut c, g, &hero);
        self.draw_visitors(&mut c, g, &hero, dt);
        crate::heroes::draw_discs(&mut c, g);
        crate::beam::draw_charge(&mut c, g);
        crate::effects::draw(&mut c, g);
        crate::beam::draw_beam(&mut c, g);
        if g.sprint > 0.3 && g.rng.random() < 0.6 {
            let kd = g.kid_screen(0.0);
            let vx = (g.rng.random() - 0.5) * 30.0;
            g.fx.push(Particle::new(kd.x, kd.y, &[0xffffff, 0xe7e2d4]).v(vx, -10.0).drag(3.0).life(0.4).size(1.0, 1.5));
        }
        if let Some((x, y)) = g.tl.cloud_fly {
            blit(c.fb, sprite::get("puff"), x - 13.0, y - 9.0, false);
        }
        self.draw_boss(&mut c, g, dt);
        crate::games::draw_candy(&mut c, g);
        self.draw_movie(&mut c, g, dt);
        self.draw_late(&mut c, g, dt);
        crate::games::draw(&mut c, g, &hero);
        for i in 0..g.tl.meteors.len() {
            if g.tl.meteors[i].delay <= 0.0 {
                self.draw_meteor(&mut c, g, i, view);
            }
        }
        Self::step_fx(&mut g.fx, c.fb, dt);
        if let Some(s) = &g.tl.star {
            blit(c.fb, sprite::get("POD"), s.x - 7.0, s.y - 7.0, false);
        }
        self.draw_gero(&mut c, g);
        if view.bare {
            if view.clouds.is_some() && world != 9 {
                draw_clouds(&mut c, view, &sea, true);
            }
        } else if world != 9 {
            draw_sea(&mut c, view, &sea, world, true, crate::waves::part(g, t));
        }
        if let Some(d) = &dusk {
            crate::storm::draw(c.fb, d, t, c.cx, c.cy + c.bob, c.r);
        }
        self.xf_front(&mut c, g, view, dt);
        crate::mech::draw(&mut c, g);
        crate::mech2::draw(&mut c, g);
        self.mo_front(&mut c, g, view);
        self.waves_front(&mut c, g, view);
        if g.flash_t > 0.0 {
            g.flash_t = 0f64.max(g.flash_t - dt * 1.8);
            let a = g.flash_t * g.flash_t * 0.85;
            let w = c.fb.w;
            for k in 0..c.fb.buf.len() {
                if (!view.bare || c.fb.buf[k] >> 24 != 0) && bayer((k % w) as i32, (k / w) as i32) < a {
                    c.fb.buf[k] = 0xffffffff;
                }
            }
        }
        crate::floats::draw(c.fb, g, dt);
        self.bi_draw(&mut c, g, view);
        self.tones = Some(tones);
    }

    fn draw_hero(&mut self, c: &mut Ctx, g: &mut Game, dt: f64) -> HeroAt {
        let t = c.t;
        // instant transmission: where he left from (with his facing and lift as last drawn), seen once
        if let Some((from, t0)) = g.tl.itx_fx {
            if self.itx_fx.as_ref().is_none_or(|b| b.t0 != t0) {
                self.itx_fx = Some(ItxFx { x: from.x, y: from.y, ang: from.ang, z: from.v[2], flip: g.flip_now, lift: g.lift_now, t0, fx: false });
            }
        }
        let kd = g.kid_screen(0.0);
        let form = &g.forms[g.s.form];
        let fi = form.look;
        let aura = form.aura();
        let hero = sprite::hero(hero_id(g));
        // his drawn size: goten is a kid, tien is tall
        let hk = 1.05 * sprite::hero_scale(hero_id(g));
        let shown = g.forms[crate::xform::shown_form(g, t)].look;
        let set = if g.b.fuse_until > t { &hero.fused } else { &hero.forms[shown] };
        let bl = match &self.itx_fx {
            Some(b) if t - b.t0 < 0.75 => t - b.t0,
            _ => -1.0,
        };
        let ahead = ap(&c.m, g.frame3.road_pt(g.phi + 0.05));
        let ax = c.cx + ahead[0] * c.r;
        let flip = ax < kd.x;
        let surf = c.world == 6;
        let fly = g.wished(planet_core::game::WishBuff::Fly) && !surf && g.b.ape_until <= t;
        let seated = (g.meditating() && !surf && !fly).then(|| crate::heroes::seated(g, t));
        let spr = if let Some(s) = seated.as_ref() {
            s
        } else if g.b.pose_until > t || g.tl.struggle.is_some() {
            &set.pose
        } else if g.tl.jump_h > 1.0 || surf || fly || g.eating() {
            &set.run[0]
        } else {
            &set.run[((t * (9.0 + g.sprint * 10.0)).floor() as i64 % 4) as usize]
        };
        let lift = g.tl.jump_h
            + if g.riding > 0.0 { 9.0 } else { 0.0 }
            + if surf && g.riding <= 0.0 { 3.0 + sin(t * 4.0) } else { 0.0 }
            + if fly { 18.0 } else { 0.0 };
        let depth = kd.v[2] * c.r + 6.0;
        g.flip_now = flip;
        g.lift_now = lift;
        self.xf_pre(c, g, kd.x, kd.y, kd.ang, lift, depth, spr.h as f64);
        let seen = {
            let x = js_round(kd.x + sin(kd.ang) * (lift + 8.0));
            let y = js_round(kd.y - cos(kd.ang) * (lift + 8.0));
            x < 0.0 || y < 0.0 || x >= c.w || y >= c.h || c.fb.zb[(y * c.w + x) as usize] as f64 <= depth + 4.0
        };
        g.hero_seen = seen;
        if g.riding > 0.0 {
            c.blit_z(sprite::get("puff"), kd.x, kd.y, kd.ang, flip, lift - 9.0, depth + 1.0, 1.25);
        }
        if surf && g.riding <= 0.0 {
            c.blit_z(sprite::get("SURFBOARD"), kd.x, kd.y, kd.ang, flip, lift - 2.0, depth + 1.0, 1.1);
            if seen && g.rng.random() < 0.45 {
                let s = if flip { 10.0 } else { -10.0 };
                let bx = kd.x + sin(kd.ang) * lift + s * cos(kd.ang);
                let by = kd.y - cos(kd.ang) * lift + s * sin(kd.ang);
                let vx = (if flip { 20.0 } else { -20.0 }) + (g.rng.random() - 0.5) * 20.0;
                let vy = -20.0 - g.rng.random() * 25.0;
                g.fx.push(Particle::new(bx, by, &[0xffffff, 0xcfe6f2]).v(vx, vy).drag(2.0).life(0.5));
            }
        }
        let kaio = g.b.kaio_until > t;
        let worn = g.look(planet_core::looks::LookKind::Aura);
        if seen && (g.tl.aura || g.b.boost_until > t || g.riding > 0.0 || g.s.form > 0 || kaio || g.s.aura > 0 || worn.is_some()) {
            let n = if g.s.form > 0 { 4 } else { 3 };
            for _ in 0..n {
                let a = kd.ang + (g.rng.random() - 0.5) * 0.9;
                let r = 4.0 + g.rng.random() * 8.0;
                let col: Vec<u32> = if kaio {
                    vec![0xffffff, 0xff9a8a, 0xe0332b]
                } else if let Some(l) = worn {
                    l.cols[..3].to_vec()
                } else if g.s.form == 0 && g.s.aura > 0 {
                    AURAS[((g.s.aura - 1) % 4) as usize].to_vec()
                } else {
                    aura.to_vec()
                };
                let p = Particle::new(kd.x + sin(kd.ang) * (lift + 10.0) + cos(a) * r, kd.y - cos(kd.ang) * (lift + 10.0) + sin(a) * r * 0.5, &col)
                    .v(sin(kd.ang) * 20.0, -cos(kd.ang) * 30.0)
                    .life(0.5)
                    .size(1.0, 1.0);
                g.fx.push(p);
            }
        }
        if let Some(l) = g.look(planet_core::looks::LookKind::Trail).filter(|_| seen && g.b.pose_until <= t) {
            // the trail: left behind him as he runs
            let ay = c.cy - ahead[1] * c.r + c.bob;
            let (dx, dy) = (ax - kd.x, ay - kd.y);
            let d = hypot(&[dx, dy]).max(1e-6);
            let (bx, by) = (kd.x + sin(kd.ang) * (lift + 8.0) - dx / d * 4.0, kd.y - cos(kd.ang) * (lift + 8.0) - dy / d * 4.0);
            let n = if l.id == "confetti" { 2 } else { 1 };
            for _ in 0..n {
                let (jx, jy) = ((g.rng.random() - 0.5) * 6.0, (g.rng.random() - 0.5) * 8.0);
                let col = l.cols[(g.rng.random() * 4.0) as usize % 4];
                let mut p = Particle::new(bx + jx, by + jy, &[col, l.cols[(g.rng.random() * 4.0) as usize % 4]])
                    .v(-dx / d * 25.0 + (g.rng.random() - 0.5) * 10.0, -dy / d * 25.0 - 6.0)
                    .drag(1.5)
                    .life(if l.id == "starlight" { 1.0 } else { 0.6 })
                    .size(1.0, if l.id == "sparks" { 0.5 } else { 0.0 });
                if l.id == "confetti" {
                    p.g = 70.0;
                }
                g.fx.push(p);
            }
        }
        if let Some(sp) = FORM_SPARK[fi].filter(|_| g.s.hero.saiyan()) {
            if seen && g.rng.random() < 0.35 {
                let mut x = kd.x + (g.rng.random() - 0.5) * 22.0;
                let mut y = kd.y - cos(kd.ang) * (lift + 14.0) + (g.rng.random() - 0.5) * 26.0;
                for _ in 0..6 {
                    c.fb.px(x, y, sp, 1.0);
                    x += (g.rng.random() - 0.5) * 4.0;
                    y += 1.0 + g.rng.random() * 2.0;
                }
            }
        }
        let draw_hero = |c: &mut Ctx, s: &Sprite, l: f64, d: f64, k: f64, x: f64, y: f64, a: f64| {
            c.blit_z(s, x, y, a, flip, l, d, k);
            if kaio {
                c.kaio_aura(s, x, y, a, flip, l, d, k, t);
            }
        };
        if g.b.ape_until > t && g.s.hero == planet_core::data::Hero::Krillin {
            // krillin's stand-in for the great ape: max power, bigger and bare-chested
            let mp = sprite::krillin_max_power();
            draw_hero(c, &mp.run[((t * 9.0).floor() as i64 % 4) as usize], lift, depth, hk * 1.3, kd.x, kd.y, kd.ang);
        } else if g.b.ape_until > t {
            // the great ape stomps: a little hop each step, a screen shake on landing
            // (the step and its shake are planet-core's: Game::draw_step)
            let step = (t * 3.2).floor();
            if g.inp.stomp {
                for _ in 0..8 {
                    let x = kd.x + (g.rng.random() - 0.5) * 30.0;
                    let vx = (g.rng.random() - 0.5) * 60.0;
                    let vy = -20.0 - g.rng.random() * 30.0;
                    g.fx.push(Particle::new(x, kd.y, &[0xffffff, 0xe7e2d4]).v(vx, vy).drag(2.0).life(0.5).size(2.0, 0.0));
                }
            }
            let (ux, uy) = (sin(kd.ang), -cos(kd.ang));
            let half = ((kd.x + ux * lift) / (1.001 - ux))
                .min((c.w - kd.x - ux * lift) / (1.001 + ux))
                .min((kd.y + uy * lift) / (1.001 - uy))
                .min((c.h - kd.y - uy * lift) / (1.001 + uy))
                - 3.0;
            // piccolo grows into a giant namekian: himself, huge, in place of the ape
            let namek = g.s.hero == planet_core::data::Hero::Piccolo;
            let a0 = if namek { &set.run[0] } else { sprite::get("APE.0") };
            let ape = &g.tl.ape;
            let want = 2.3 * (1.0 + 0.08 * g.tail_lv()) * if ape.giant { 1.0 + 0.5 * 1f64.min((t - ape.at) / 1.2) } else { 1.0 };
            let k = ape.k + (1.5f64.max(want.min(2.0 * half / (a0.w.max(a0.h) as f64))) - ape.k) * 1f64.min(dt * 2.0);
            g.tl.ape.k = k;
            let spr = if namek { &set.run[step as i64 as usize % 4] } else { sprite::get(if step as i64 % 2 == 0 { "APE.0" } else { "APE.1" }) };
            draw_hero(c, spr, lift + sin(t * 3.2 * std::f64::consts::PI).abs() * 3.0, depth + 30.0, k, kd.x, kd.y, kd.ang);
        } else if g.b.fused.is_some_and(|f| f.1 > t) {
            let look = g.tl.fused_look;
            let spr = if look == "FUSED.fat" {
                sprite::get(["FUSED.fat.0", "FUSED.fat.1", "FUSED.fat.2", "FUSED.fat.3"][(t * 4.0).floor() as usize % 4])
            } else {
                sprite::get(look)
            };
            draw_hero(c, spr, lift, depth, 1.05, kd.x, kd.y, kd.ang);
        } else if fly {
            // the flight wish: the superman pose, tipped toward the way he's going round the planet (not the screen
            // side the road heads to, which flew him backwards into his streak), and a short white-blue comet
            let pal = [0xffffff, 0xcdeeff, 0x7ac8ff];
            let (n, w0) = (14, 5.0);
            let sh = spr.h as f64 * hk;
            let (ux, uy) = (sin(kd.ang), -cos(kd.ang));
            let ay = c.cy - ahead[1] * c.r + c.bob;
            let (tx, ty) = (ax - kd.x, ay - kd.y);
            let tl = hypot(&[tx, ty]).max(1e-6);
            let back = tx * cos(kd.ang) + ty * sin(kd.ang) < 0.0;
            let dir = if back { -1.0 } else { 1.0 };
            let at = |j: f64| {
                let v = ap(&c.m, g.frame3.road_pt(g.phi - j * 0.013));
                let r = c.r + lift + sh * 0.4;
                (c.cx + v[0] * r, c.cy - v[1] * r + c.bob, v[2] * r)
            };
            for j in (1..=n).rev() {
                let p = at(j as f64);
                let q = at(j as f64 - 1.0);
                let (dx, dy) = (q.0 - p.0, q.1 - p.1);
                let ll = hypot(&[dx, dy]);
                let ll = if ll == 0.0 { 1.0 } else { ll };
                let (nx, ny) = (-dy / ll, dx / ll);
                let k = j as f64 / n as f64;
                let w = w0 * (1.0 - k) + 0.6;
                let zi = js_round(p.1) * c.w + js_round(p.0);
                // game.js reads past the buffer's end here (undefined, so never behind)
                if p.0 >= 0.0 && p.1 >= 0.0 && p.0 < c.w && p.1 < c.h && c.fb.zb.get(zi as usize).is_some_and(|&z| z as f64 > p.2 + 4.0) {
                    continue;
                }
                let mut s = 0.0;
                while s < 1.0 {
                    let mut e = -w - 1.5;
                    while e <= w + 1.5 {
                        let a = e.abs() / w;
                        let (x, y) = (p.0 + dx * s + nx * e, p.1 + dy * s + ny * e);
                        if a > 1.0 {
                            if bayer(js_round(x) as i64 as i32, js_round(y) as i64 as i32) < (1.0 - k) * 0.6 {
                                c.fb.px(x, y, pal[2], 0.5);
                            }
                        } else {
                            c.fb.px(
                                x,
                                y,
                                if a < 0.45 {
                                    pal[0]
                                } else if a < 0.8 {
                                    pal[1]
                                } else {
                                    pal[2]
                                },
                                1.0 - k * k * 0.5,
                            );
                        }
                        e += 0.5;
                    }
                    s += 0.34;
                }
            }
            let a2 = kd.ang + dir * 1.2;
            let (mx, my) = (kd.x + ux * (lift + sh / 2.0), kd.y + uy * (lift + sh / 2.0));
            if seen {
                // the comet's head: sparks shed behind him and a dithered glow round his body
                for _ in 0..3 {
                    let r = 5.0 + g.rng.random() * 7.0;
                    let a = g.rng.random() * 6.28;
                    g.fx.push(Particle::new(mx + cos(a) * r, my + sin(a) * r, &pal).v(-tx / tl * 25.0, -ty / tl * 25.0).life(0.35).size(1.0, 1.0));
                }
                let gl = 13.0;
                let mut y = -gl;
                while y <= gl {
                    let mut x = -gl;
                    while x <= gl {
                        let d = hypot(&[x, y]) / gl;
                        if d <= 1.0 && bayer(js_round(mx + x) as i64 as i32, js_round(my + y) as i64 as i32) < (1.0 - d) * 0.5 {
                            c.fb.px(mx + x, my + y, if d < 0.6 { pal[1] } else { pal[2] }, 0.6);
                        }
                        x += 1.0;
                    }
                    y += 1.0;
                }
            }
            let (bx, by) = (mx - sin(a2) * sh / 2.0, my + cos(a2) * sh / 2.0);
            c.blit_z(spr, bx, by, a2, back, 0.0, depth, hk);
            if kaio {
                c.kaio_aura(spr, bx, by, a2, back, 0.0, depth, hk, t);
            }
        } else if (0.0..0.18).contains(&bl) {
            // he steps in out of the light
            let ghost = itx_ghost(&itx_pose(&set.idle), bl / 0.18, t);
            c.blit_z(&ghost, kd.x, kd.y, kd.ang, flip, lift, depth, hk);
        } else if (0.0..0.75).contains(&bl) {
            draw_hero(c, &itx_pose(&set.idle), lift, depth, hk, kd.x, kd.y, kd.ang);
        } else {
            draw_hero(c, spr, lift, depth, hk, kd.x, kd.y, kd.ang);
        }
        if bl >= 0.0 {
            // where he stood: his shape fades out in a shimmer; where he lands, a ring of light pulls in
            let b = self.itx_fx.as_mut().unwrap();
            if bl < 0.35 {
                let ghost = itx_ghost(&set.idle, 1.0 - bl / 0.35, t);
                c.blit_z(&ghost, b.x, b.y, b.ang, b.flip, b.lift, b.z * c.r + 6.0, hk);
            }
            if bl < 0.3 && seen {
                let r = 3.0 + 16.0 * (1.0 - bl / 0.3);
                let (hx, hy) = (kd.x + sin(kd.ang) * (lift + 16.0), kd.y - cos(kd.ang) * (lift + 16.0));
                let mut a = 0.0;
                while a < 6.28 {
                    c.fb.px(hx + cos(a + bl * 9.0) * r, hy + sin(a + bl * 9.0) * r * 1.3, if a % 0.7 < 0.35 { 0xbff6ff } else { 0x2f8ae0 }, 1.0);
                    a += 0.35;
                }
            }
            if !b.fx {
                b.fx = true;
                let (bx, by, ba) = (b.x, b.y, b.ang);
                for _ in 0..14 {
                    let a = g.rng.random() * 6.28;
                    let vx = (g.rng.random() - 0.5) * 12.0;
                    let vy = -16.0 - g.rng.random() * 30.0;
                    g.fx.push(
                        Particle::new(bx + sin(ba) * 14.0 + cos(a) * 6.0, by - cos(ba) * 14.0 + sin(a) * 9.0, &[0xbff6ff, 0x7ae0f4, 0x2f8ae0])
                            .v(vx, vy)
                            .life(0.7),
                    );
                }
            }
        }
        HeroAt { x: kd.x, y: kd.y, ang: kd.ang, flip, lift, depth, seen }
    }

    fn draw_meteor(&mut self, c: &mut Ctx, g: &mut Game, i: usize, view: &View) {
        let t = c.t;
        if g.tl.meteors[i].sd.is_none() {
            g.tl.meteors[i].sd = Some(g.rng.random() * 9.0);
        }
        let m = g.tl.meteors[i].clone();
        let sd = m.sd.unwrap();
        let sp = hypot(&[m.vx, m.vy]);
        let sp = if sp == 0.0 { 1.0 } else { sp };
        let (dx, dy) = (m.vx / sp, m.vy / sp);
        let (nx, ny) = (-dy, dx);
        let (x, y) = (js_round(m.x), js_round(m.y));
        let spin = t * 1.6 + sd;
        let rad = |a: f64| 4.6 * (1.0 + 0.16 * sin(3.0 * (a - spin) + sd) + 0.09 * sin(5.0 * (a - spin) + 2.0 * sd));
        let inside = |xx: f64, yy: f64| hypot(&[xx, yy]) < rad(atan2(yy, xx));
        let cols = [0xfff6d0, 0xffd24a, 0xffa53a, 0xf0662a, 0xc83a22];
        let ll = 20.0;
        let mut s = ll;
        while s >= 1.0 {
            let k = s / ll;
            let w = 4.2 * pow(1.0 - k, 0.6) * (1.0 + 0.25 * sin(s * 0.9 - t * 30.0 + sd * 7.0));
            let mut o = -w;
            while o <= w {
                let (xx, yy) = (x - dx * s + nx * o, y - dy * s + ny * o);
                if !(k > 0.6 && bayer(js_round(xx) as i64 as i32, js_round(yy) as i64 as i32) >= 1.0 - (k - 0.6) / 0.4) {
                    let ww = if w == 0.0 { 1.0 } else { w };
                    c.fb.px(xx, yy, cols[4usize.min(((k * 0.8 + o.abs() / ww * 0.4) * 5.0).floor() as usize)], 1.0);
                }
                o += 0.5;
            }
            s -= 0.5;
        }
        const MO: u32 = 0x24160c;
        const MT: [u32; 4] = [0x4a3020, 0x6b4a32, 0x8a6446, 0xa8835e];
        const MCR: u32 = 0x3a2618;
        for yy in -6..=6 {
            for xx in -6..=6 {
                let (xf, yf) = (xx as f64, yy as f64);
                if !inside(xf, yf) {
                    continue;
                }
                let edge = !inside(xf + 1.0, yf) || !inside(xf - 1.0, yf) || !inside(xf, yf + 1.0) || !inside(xf, yf - 1.0);
                let lead = (xf * dx + yf * dy) / 4.6;
                if edge && lead < 0.35 {
                    c.fb.px(x + xf, y + yf, MO, 1.0);
                    continue;
                }
                let lx = cos(spin) * xf + sin(spin) * yf;
                let ly = -sin(spin) * xf + cos(spin) * yf;
                let cr = [[1.4, -1.0, 1.2], [-1.6, 1.2, 0.9], [0.4, 2.0, 0.7]].into_iter().find(|&[a, b, rr]| hypot(&[lx - a, ly - b]) < rr);
                let mut col = if let Some(cr) = cr {
                    if hypot(&[lx - cr[0], ly - cr[1]]) > cr[2] - 0.6 && lx - cr[0] + ly - cr[1] > 0.0 {
                        MT[3]
                    } else {
                        MCR
                    }
                } else {
                    let v = js_round(1.4 + ((-xf * 0.6 - yf * 0.8) / 4.6 + (bayer((x + xf) as i64 as i32, (y + yf) as i64 as i32) - 0.5) * 0.5) * 1.6);
                    MT[0f64.max(3f64.min(v)) as usize]
                };
                if lead > 0.45 {
                    col = if lead > 0.78 {
                        0xfff6d0
                    } else if lead > 0.6 {
                        0xffc04a
                    } else {
                        mix_c(col, 0xff7a2a, 0.6)
                    };
                }
                c.fb.px(x + xf, y + yf, col, 1.0);
            }
        }
        let mut a = -1.5;
        while a <= 1.5 {
            let ang = atan2(dy, dx) + a;
            let rr = rad(ang) + 1.0 + if sin(a * 7.0 - t * 25.0) > 0.3 { 0.6 } else { 0.0 };
            c.fb.px(x + cos(ang) * rr, y + sin(ang) * rr, if a.abs() < 0.6 { 0xfff3c0 } else { 0xffa53a }, 1.0);
            a += 0.12;
        }
        if !view.bare && !m.dead && g.rng.random() < 0.9 {
            let s0 = 16.0 + g.rng.random() * 6.0;
            let px0 = x - dx * s0 + (g.rng.random() - 0.5) * 3.0;
            let vx = (g.rng.random() - 0.5) * 4.0;
            g.fx.push(Particle::new(px0, y - dy * s0, &[0x9a948e, 0x7e7872, 0x625e5a, 0x4e4b48]).v(vx, -4.0).drag(1.5).life(0.7).size(2.0, 3.0));
        }
    }
}

pub(crate) fn hero_id(g: &Game) -> &'static str {
    use planet_core::data::Hero;
    match g.s.hero {
        Hero::Vegeta => "vegeta",
        Hero::Goku => "goku",
        Hero::Gohan => "gohan",
        Hero::Trunks => "trunks",
        Hero::Piccolo => "piccolo",
        Hero::Krillin => "krillin",
        Hero::Goten => "goten",
        Hero::Tien => "tien",
        Hero::A17 => "a17",
    }
}

/// Each form's sparks, by `ALL_FORMS` index.
const FORM_SPARK: [Option<u32>; 14] = [
    None,
    None,
    Some(0x9fdcff),
    Some(0x9fdcff),
    None,
    None,
    Some(0xc9a2ff),
    Some(0xffd0a0),
    Some(0xffffff),
    Some(0xffffff),
    Some(0x9fdcff),
    Some(0xf0e4ff),
    Some(0xc9a2ff),
    Some(0xd8f2ff),
];
/// The base form's capsule auras.
const AURAS: [[u32; 3]; 4] = [[0xffffff, 0xffc2e2, 0xf05aa8], [0xffffff, 0xb8f5dc, 0x2fbf8a], [0xffffff, 0xffd8a0, 0xf28a1c], [0xffffff, 0xd9c8ff, 0x7a4ae0]];

const NIGHT_SEA: [u32; 4] = [0x141a3a, 0x232c5a, 0x3a4a82, 0x6a7ab8];

/// `seaPal()`: the world's cloud sea, faded toward moonlit blue by night.
fn sea_pal(day: &[u32], k: f64) -> Vec<u32> {
    if k <= 0.0 {
        return day.to_vec();
    }
    day.iter()
        .enumerate()
        .map(|(i, &cc)| {
            let n = NIGHT_SEA[i];
            let ch = |sh: u32| js_round(((cc >> sh) & 255) as f64 + (((n >> sh) & 255) as f64 - ((cc >> sh) & 255) as f64) * k) as u32;
            (ch(16) << 16) | (ch(8) << 8) | ch(0)
        })
        .collect()
}

/// `drawSea(t, front)`: the scrolling cloud sea along the bottom.
/// `part`: a big shockwave parting the sea round where it landed (waves.rs).
fn draw_sea(c: &mut Ctx, view: &View, pal: &[u32], world: u32, front: bool, part: Option<(f64, f64)>) {
    let t = c.t;
    let glint = world == 8;
    let ck = 3.0 / view.scale;
    let base = c.h - (c.h * if front { 0.06 } else { 0.14 } * if view.scale == 2.0 { 0.7 } else { 1.0 });
    let w = c.w;
    let sp = (if front { 6.0 } else { 3.0 }) * ck;
    let rr = js_round((if front { 9.0 } else { 7.0 }) * ck);
    let mut i = -2.0;
    while i < w / (rr * 1.3) + 3.0 {
        let span = w + rr * 4.0;
        let px_ = ((i * rr * 1.3 - t * sp) % span + span) % span - rr * 2.0;
        let py = base + sin(i * 1.7) * rr * 0.45 + if front { 0.0 } else { -6.0 * ck };
        let (px_, py) = crate::waves::parted(part, w, c.h, px_, py, front);
        let r = rr * (0.8 + 0.4 * hash(i * 3.3 + if front { 9.0 } else { 0.0 }));
        let mut y = (py - r).floor();
        while y < c.h {
            let mut x = (px_ - r).floor();
            while x <= px_ + r {
                let (dx, dy) = (x - px_, y - py);
                if !((dy < 0.0 && dx * dx + dy * dy > r * r) || (dy >= 0.0 && dx.abs() > r)) {
                    let l = if dy < 0.0 { -(dx * 0.5 + dy * 0.9) / r } else { -0.6 - dy / (c.h - py + 1.0) };
                    let v = l + bayer(x as i64 as i32, y as i64 as i32) * 0.3;
                    let col = if glint && v < -0.2 && ((x as i64 * 3 + y as i64) & 7) == 0 && h2(x * 7.0 + ((t * 4.0) as i64) as f64, y) > 0.94 {
                        0xe0702a
                    } else {
                        pal[if v > 0.65 {
                            3
                        } else if v > 0.2 {
                            2
                        } else if v > -0.4 {
                            1
                        } else {
                            0
                        }]
                    };
                    c.fb.px(x, y, col, 1.0);
                }
                x += 1.0;
            }
            y += 1.0;
        }
        i += 1.0;
    }
}

const CLOUD_TPL: [&[[f64; 3]]; 7] = [
    &[[-0.18, -0.02, 0.14], [0.0, -0.08, 0.18], [0.18, -0.03, 0.13]],
    &[[-0.15, 0.0, 0.12], [0.0, -0.09, 0.17], [0.15, 0.0, 0.11]],
    &[[-0.16, -0.08, 0.17], [0.02, -0.03, 0.14], [0.17, 0.01, 0.11]],
    &[[-0.23, -0.02, 0.12], [-0.08, -0.07, 0.15], [0.08, -0.09, 0.16], [0.22, -0.03, 0.13]],
    &[[-0.055, -0.01, 0.1], [0.055, -0.04, 0.11]],
    &[[-0.22, 0.0, 0.13], [-0.07, -0.1, 0.18], [0.11, -0.12, 0.19], [0.25, -0.01, 0.12]],
    &[[-0.18, 0.01, 0.1], [-0.05, -0.04, 0.14], [0.11, -0.07, 0.17]],
];

fn cloud_lobes(tp: &[[f64; 3]], k: f64, scale: f64) -> Vec<[f64; 3]> {
    let s = (if hash(k * 3.1 + 9.0) < 0.5 { -1.0 } else { 1.0 }) * scale;
    let a = s.abs();
    let mut lobes: Vec<[f64; 3]> =
        tp.iter().enumerate().map(|(i, &[dx, dy, r])| [dx * s, dy * a, r * a + js_round(hash(k * 11.0 + i as f64 * 1.7) * 2.0) - 1.0]).collect();
    if tp.len() < 4 && hash(k * 2.3 + 4.0) > 0.6 {
        let mut p = tp[0];
        for &q in &tp[1..] {
            if q[1] - q[2] < p[1] - p[2] {
                p = q;
            }
        }
        let [dx, dy, r] = p;
        lobes.push([(dx + 0.07) * s, (dy - r * 0.55) * a, 0.09 * a]);
    }
    lobes
}

fn tone4(v: f64) -> usize {
    if v > 0.65 {
        3
    } else if v > 0.2 {
        2
    } else if v > -0.4 {
        1
    } else {
        0
    }
}

fn draw_cloud(c: &mut Ctx, x: f64, base: f64, lobes: &[[f64; 3]], pal: &[u32]) {
    let m = 1.0;
    let x0 = lobes.iter().map(|l| l[0] - l[2]).fold(f64::INFINITY, f64::min);
    let x1 = lobes.iter().map(|l| l[0] + l[2]).fold(f64::NEG_INFINITY, f64::max);
    let top = lobes.iter().map(|l| l[1] - l[2]).fold(f64::INFINITY, f64::min);
    let x = js_round((m - x0).max((c.w - m - x1).min(x)));
    let base = js_round((m - top).max((c.h - m - 1.0).min(base)));
    let band = -top * 0.35;
    let mut sorted = lobes.to_vec();
    sorted.sort_by(|p, q| q[1].partial_cmp(&p[1]).unwrap());
    for [dx, dy, r] in sorted {
        let (lx, ly) = (x + dx, base + dy);
        let mut y = (ly - r).floor();
        while y <= base {
            let mut px_ = (lx - r).floor();
            while px_ <= lx + r {
                let (ex, ey) = (px_ - lx, y - ly);
                if ex * ex + ey * ey <= r * r {
                    let v = -(ex * 0.5 + ey * 0.9) / r + bayer(px_ as i64 as i32, y as i64 as i32) * 0.3 - 0f64.max(y - (base - band)) / band * 0.9;
                    c.fb.px(px_, y, pal[3.min(tone4(v))], 1.0);
                }
                px_ += 1.0;
            }
            y += 1.0;
        }
    }
}

fn cloud_puff(c: &mut Ctx, x0: f64, y0: f64, r: f64, pal: &[u32], pale: usize) {
    let mut y = (y0 - r).floor();
    while y <= y0 + r {
        let mut x = (x0 - r).floor();
        while x <= x0 + r {
            let (dx, dy) = (x - x0, y - y0);
            if dx * dx + dy * dy <= r * r {
                let v = -(dx * 0.5 + dy * 0.9) / r + bayer(x as i64 as i32, y as i64 as i32) * 0.3;
                c.fb.px(x, y, pal[3.min(tone4(v) + pale)], 1.0);
            }
            x += 1.0;
        }
        y += 1.0;
    }
}

enum Puff {
    Round { x: f64, y: f64, r: f64, f: bool, pale: f64 },
    Cloud { lobes: Vec<[f64; 3]>, x: f64, y: f64, f: bool },
}

fn cloud_puffs(c: &Ctx, view: &View) -> Vec<Puff> {
    let (t, cx, cy, r) = (c.t, c.cx, c.cy, c.r);
    let mut p = Vec::new();
    let bob = |i: f64, k: f64| sin(t * 0.4 + i * 1.7) * r * k;
    let mut add = |x: f64, y: f64, rr: f64, f: bool, pale: f64| p.push(Puff::Round { x, y, r: rr, f, pale });
    match view.clouds {
        Some('e') => {
            let span = c.w.min(404.0 / view.scale);
            let x0 = (c.w - span) / 2.0;
            for l in 0..4 {
                let lf = l as f64;
                let rb = r * (0.13 + 0.05 * lf);
                let step = rb * (1.1 + 0.25 * (3.0 - lf));
                let n = 3f64.max(((span - 2.0 * rb) / step).ceil() + 1.0);
                let gap = (span - 2.0 * rb - 2.0) / (n - 1.0);
                let mut i = 0.0;
                while i < n {
                    let h = hash(i * 7.1 + lf * 13.3);
                    let rr = rb * (0.7 + 0.6 * h);
                    let sway = sin(t * (0.12 + 0.06 * lf) + i * 1.9 + lf * 2.1) * rb * 0.25;
                    let off = if l % 2 == 1 { 0.5 * if i < n - 1.0 { 1.0 } else { 0.0 } } else { 0.0 };
                    add(
                        x0 + rb + 1.0 + (i + off) * gap + sway,
                        c.h - rr - 1.0 - r * 0.2 * (3.0 - lf) - hash(i * 3.7 + lf * 5.9) * rb * if l == 3 { 0.5 } else { 0.9 } + bob(i * 4.0 + lf, 0.01),
                        rr,
                        l == 3,
                        if l < 2 { 1.0 } else { 0.0 },
                    );
                    i += 1.0;
                }
            }
        }
        Some('b') => {
            for i in 0..16 {
                let a = i as f64 / 16.0 * std::f64::consts::PI * 2.0 + t * 0.06;
                add(cx + cos(a) * r * 1.3, cy + r * 0.12 + sin(a) * r * 0.36, r * (0.11 + 0.04 * hash(i as f64 * 2.1)), sin(a) > 0.0, 0.0);
            }
        }
        Some('c') => {
            let amt = 1f64.max(5f64.min(if view.cloud_amt == 0.0 { 1.0 } else { view.cloud_amt }));
            let spots: [&[(f64, f64, bool)]; 5] = [
                &[(-1.3, 0.5, false), (1.3, 0.15, false), (-0.15, 1.1, true)],
                &[(1.0, 1.05, true), (-1.6, -0.3, false)],
                &[(1.6, 0.75, false), (-1.5, 1.05, false), (0.5, 1.35, true)],
                &[(1.45, -0.75, false), (-1.15, -1.3, false), (-0.6, 1.45, true)],
                &[(1.85, 0.2, false), (-1.9, 0.45, false), (0.3, -1.55, false)],
            ];
            let mut k = 0.0;
            for row in spots.iter().take(amt as usize) {
                for &(u, v, f) in row.iter() {
                    let tp = CLOUD_TPL[(hash(k * 7.3 + 0.5) * CLOUD_TPL.len() as f64).floor() as usize];
                    let lobes = cloud_lobes(tp, k, r * (0.7 + 0.6 * hash(k * 5.9 + 2.0)) * if amt >= 4.0 { 1.1 } else { 1.0 });
                    p.push(Puff::Cloud { lobes, x: cx + u * r + sin(t * 0.15 + k * 2.0) * r * 0.08, y: cy + v * r + r * 0.1, f });
                    k += 1.0;
                }
            }
        }
        Some('d') => {
            for i in 0..9 {
                let u = i as f64 / 8.0 * 2.0 - 1.0;
                add(cx + u * r * 1.45, cy + r * 0.9 + bob(i as f64, 0.02), r * (0.19 + 0.05 * hash(i as f64 * 3.7)), false, 0.0);
            }
            for i in 0..8 {
                let u = (i as f64 + 0.5) / 8.0 * 2.0 - 1.0;
                add(cx + u * r * 1.38, cy + r * 1.12 + bob(i as f64 + 9.0, 0.02), r * (0.17 + 0.04 * hash(i as f64 * 5.3)), true, 0.0);
            }
        }
        _ => {
            for i in 0..7 {
                let u = i as f64 / 6.0 * 2.0 - 1.0;
                add(cx + u * r * 1.05, cy + r * (0.8 + 0.12 * u * u) + bob(i as f64, 0.02), r * (0.17 + 0.13 * (1.0 - u * u)), false, 0.0);
            }
            for i in 0..6 {
                let u = (i as f64 + 0.5) / 6.0 * 2.0 - 1.0;
                add(cx + u * r * 0.95, cy + r * (1.02 + 0.06 * u * u) + bob(i as f64 + 7.0, 0.02), r * (0.15 + 0.09 * (1.0 - u * u)), true, 0.0);
            }
        }
    }
    p
}

/// `drawClouds(t, front)`: the widget's clouds, behind or in front of the planet.
fn draw_clouds(c: &mut Ctx, view: &View, pal: &[u32], front: bool) {
    let m = 1.0;
    for p in cloud_puffs(c, view) {
        match p {
            Puff::Cloud { lobes, x, y, f } => {
                if f == front {
                    draw_cloud(c, x, y, &lobes, pal);
                }
            }
            Puff::Round { x, y, r, f, pale } => {
                if f != front {
                    continue;
                }
                let r = 2f64.max(js_round(r));
                let px_ = js_round((c.w - m - r).min((m + r).max(x)));
                let py = js_round((c.h - m - r).min((m + r).max(y)));
                cloud_puff(c, px_, py, r, pal, 1f64.min(pale) as usize);
            }
        }
    }
}

fn draw_moon(c: &mut Ctx, m: &planet_core::timeline::Moon) {
    let (x, y, r, a) = (m.x, m.y, m.r, m.a);
    let mut yy = -r - 6.0;
    while yy <= r + 6.0 {
        let mut xx = -r - 6.0;
        while xx <= r + 6.0 {
            let d = hypot(&[xx, yy]);
            if d <= r - 1.0 {
                let n = h2(js_round(x + xx) * 3.0, js_round(y + yy) * 5.0);
                let crater = hypot(&[xx + r * 0.3, yy - r * 0.2]) < r * 0.22
                    || hypot(&[xx - r * 0.35, yy + r * 0.3]) < r * 0.16
                    || hypot(&[xx - r * 0.1, yy - r * 0.45]) < r * 0.12;
                let l = -(xx * 0.5 + yy * 0.6) / r + (n - 0.5) * 0.3;
                c.fb.px(
                    x + xx,
                    y + yy,
                    if crater {
                        0xe6c878
                    } else if l > 0.3 {
                        0xfffbe6
                    } else if l > -0.3 {
                        0xffeab0
                    } else {
                        0xf2d07e
                    },
                    a,
                );
            } else if d <= r {
                c.fb.px(x + xx, y + yy, 0xc89a3a, a);
            } else if d <= r + 7.0 && bayer(js_round(x + xx) as i64 as i32, js_round(y + yy) as i64 as i32) < (1.0 - (d - r) / 7.0) * 0.7 * a {
                c.fb.px(x + xx, y + yy, 0xffd978, 0.8);
            }
            xx += 1.0;
        }
        yy += 1.0;
    }
}

/// The planet itself: px.wasm's kernel on a plain grass world, the general sphere and `shadePlanet` elsewhere.
fn planet(c: &mut Ctx, g: &Game, b: &Built, id: u16) {
    let w = c.world;
    let (gl, rl) = (&c.tones.grass, &c.tones.road);
    if matches!(w, 5..=9) || tones::is_w2(w) || gl.len() > 8 || rl.len() > 8 {
        let ax = crate::shade::Axes { n: g.frame3.n, e1: g.frame3.e1, e2: g.frame3.e2, phi: g.phi, top_dmg: crate::scenery::top_dmg(g) };
        c.sphere([0.0, 0.0, 0.0], 1.0, id, &mut |c, n, x, y| crate::shade::planet(c, b, &ax, n, x, y));
        return;
    }
    let v = ap(&c.m, [0.0, 0.0, 0.0]);
    let n = g.frame3.n;
    let mut p = [0.0; 22];
    p[..5].copy_from_slice(&[c.cx + v[0] * c.r, c.cy - v[1] * c.r + c.bob, v[2] * c.r, c.r, id as f64]);
    p[5..14].copy_from_slice(&c.m);
    p[14..17].copy_from_slice(&c.l);
    p[17..20].copy_from_slice(&n);
    p[20] = gl.len() as f64;
    p[21] = rl.len() as f64;
    let (gl, rl) = (gl.clone(), rl.clone());
    px::planet(c.fb, &p, &gl, &rl);
}

/// One solid's shading (`SHADE[o.kind]`).
fn shade_solid(c: &Ctx, o: &Solid, n: V3, x: i64, y: i64) -> u32 {
    let t = c.tones;
    let lum = c.light(n);
    match &o.kind {
        Kind::Leaf => tone(&t.leaf, lum + (h2((x * 3) as f64, (y * 5) as f64) - 0.5) * 0.25, x, y),
        Kind::Trunk => tone(&t.trunk, lum, x, y),
        Kind::Stone => tone(&t.stone, lum, x, y),
        Kind::Knob => tone(&t.orb, lum + 0.25, x, y),
        Kind::Karst => {
            if h2((x * 5) as f64, (y * 3) as f64) > 0.9 && lum > 0.45 {
                tone(&t.leaf, lum, x, y)
            } else {
                tone(&t.stone, lum + (h2((x * 3) as f64, (y * 7) as f64) - 0.5) * 0.3, x, y)
            }
        }
        Kind::Pal { pal, lift } => tone(pal, lum + lift, x, y),
        Kind::Dome { s, door } => crate::shade::dome(c, *s, *door, n, x, y),
        Kind::Hq { s, door, side, text, p } => crate::shade::hq(c, *s, *door, *side, *text, *p, n, x, y),
        Kind::Tower { s, p, w } => {
            let up = if *w != 0.0 { dot(ap_t(&c.m, n), s.unwrap_or([0.0; 3])).abs() } else { 1.0 };
            if up < *w {
                tone(&t.pane, lum + if up < w * 0.4 { 0.3 } else { 0.0 }, x, y)
            } else {
                tone(p.pal(t), lum, x, y)
            }
        }
        Kind::Pool { s, lava } => crate::shade::pool(c, *s, *lava, n, x, y),
        Kind::TopChunk => tone(&crate::tones::top::TILES, lum * 0.8 - 0.12 + (h2((x * 5) as f64, (y * 3) as f64) - 0.5) * 0.2, x, y),
        Kind::Spot { pal, pal2, f, seed, lift } => {
            let q = ap_t(&c.m, n);
            let gg = vnoise3(q[0] * f + seed, q[1] * f, q[2] * f);
            if gg > 0.64 {
                tone(pal2, lum + 0.25, x, y)
            } else {
                tone(pal, lum + lift, x, y)
            }
        }
    }
}

impl Pn {
    pub fn pal<'a>(&self, t: &'a Tones) -> &'a [u32] {
        match self {
            Pn::Hull => &t.hull,
            Pn::Peach => &t.peach,
            Pn::Aqua => &t.aqua,
            Pn::Pane => &t.pane,
            Pn::Stone => &t.stone,
        }
    }
}

/// `itxFx`: where an instant transmission left from, and whether its sparkle has been thrown
struct ItxFx {
    x: f64,
    y: f64,
    ang: f64,
    z: f64,
    flip: bool,
    lift: f64,
    t0: f64,
    fx: bool,
}

/// `itxPose`: his standing sprite with the near arm raised, two fingers to the forehead, in his own colours.
fn itx_pose(spr: &Sprite) -> Sprite {
    let w = spr.w as i64;
    let dx = spr.ax as i64 - 8;
    let ix = |j: i64, i: i64| (j * w + i + dx) as usize;
    let mut col = spr.col.clone();
    let at = |j: i64, i: i64| spr.col[ix(j, i)];
    let o = at(16, 3);
    let glove = at(21, 13);
    let hand = if glove == 0xffffff { glove } else { at(12, 7) };
    let sleeve = at(19, 13);
    for j in 18..=23 {
        for i in 13..=15 {
            col[ix(j, i)] = -1;
        }
    }
    for j in 18..=22 {
        col[ix(j, 12)] = o;
    }
    let rows: [(i64, &[(i64, char)]); 10] = [
        (8, &[(11, 'o'), (12, 'o')]),
        (9, &[(10, 'o'), (11, 'h'), (12, 'h'), (13, 'o')]),
        (10, &[(10, 'o'), (11, 'h'), (12, 'h'), (13, 'h'), (14, 'o')]),
        (11, &[(11, 'o'), (12, 'h'), (13, 'h'), (14, 'h'), (15, 'o')]),
        (12, &[(12, 'o'), (13, 's'), (14, 's'), (15, 'o')]),
        (13, &[(12, 'o'), (13, 's'), (14, 's'), (15, 'o')]),
        (14, &[(12, 'o'), (13, 's'), (14, 's'), (15, 'o')]),
        (15, &[(12, 'o'), (13, 's'), (14, 's'), (15, 'o')]),
        (16, &[(12, 's'), (13, 's'), (14, 'o')]),
        (17, &[(12, 's'), (13, 'o')]),
    ];
    for (j, cells) in rows {
        for &(i, ch) in cells {
            col[ix(j, i)] = match ch {
                'o' => o,
                'h' => hand,
                _ => sleeve,
            };
        }
    }
    Sprite { col, ..spr.clone() }
}

/// `itxGhost`: `a` of the sprite's pixels, in blue light, dropping out row by row.
fn itx_ghost(spr: &Sprite, a: f64, t: f64) -> Sprite {
    let f = (t * 30.0).floor();
    let col = spr
        .col
        .iter()
        .enumerate()
        .map(|(n, &c)| {
            if c < 0 || h2(n as f64, f) > a {
                -1
            } else if (n / spr.w) % 2 == 1 {
                0x4aa8f0
            } else {
                0xbff6ff
            }
        })
        .collect();
    Sprite { col, ..spr.clone() }
}
