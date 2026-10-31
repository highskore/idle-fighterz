//! Prototype only (scratch/heroes): each playstyle pitch's moment for the heroes picker, drawn round the hero that
//! planet-core's `proto` holds at the front of the planet. Shapes and colour only; the words are the core's toast.

use planet_core::data::Hero;
use planet_core::fx::Particle;
use planet_core::geom::Spot;
use planet_core::jsmath::{cos, sin};
use planet_core::proto::MOMENT;
use planet_core::sprite::{self, make_sprite, Pal, Sprite};
use planet_core::Game;

use crate::bayer;
use crate::scene::Ctx;

fn at(g: &Game, phi: f64, lift: f64) -> Spot {
    g.cam.screen(g.frame3.road_pt(phi), lift)
}

/// A point `up` above a spot, along its local up, and `side` along the ground.
fn up(s: &Spot, up: f64, side: f64) -> (f64, f64) {
    (s.x + sin(s.ang) * up + cos(s.ang) * side, s.y - cos(s.ang) * up + sin(s.ang) * side)
}

fn fig(c: &mut Ctx, g: &Game, spr: &Sprite, phi: f64, lift: f64, k: f64, flip: bool) -> Spot {
    let s = at(g, phi, 0.0);
    if s.v[2] > 0.0 {
        c.blit_z(spr, s.x, s.y, s.ang, flip, lift, s.v[2] * c.r + 6.0, k);
    }
    s
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
    let step = 0.5 / rx.max(1.0);
    let mut q = 0.0;
    while q < 6.283 {
        c.fb.px((x + cos(q) * rx).round(), (y + sin(q) * ry).round(), col, a);
        q += step;
    }
}

/// A dithered glow: full inside `r0`, fading out to `r1`.
fn glow(c: &mut Ctx, x: f64, y: f64, r0: f64, r1: f64, col: u32, a: f64) {
    let (x0, y0) = ((x - r1).floor().max(0.0) as i32, (y - r1).floor().max(0.0) as i32);
    let (x1, y1) = ((x + r1).ceil().min(c.w - 1.0) as i32, (y + r1).ceil().min(c.h - 1.0) as i32);
    for yy in y0..=y1 {
        for xx in x0..=x1 {
            let d = ((xx as f64 - x).powi(2) + (yy as f64 - y).powi(2)).sqrt();
            let k = if d <= r0 { 1.0 } else { 1.0 - (d - r0) / (r1 - r0).max(1.0) };
            if k > 0.0 && bayer(xx, yy) < k * a {
                c.fb.px(xx as f64, yy as f64, col, 1.0);
            }
        }
    }
}

fn line(c: &mut Ctx, x0: f64, y0: f64, x1: f64, y1: f64, w: f64, col: u32, a: f64) {
    let n = ((x1 - x0).abs().max((y1 - y0).abs()) * 1.5).ceil().max(1.0) as i32;
    for i in 0..=n {
        let f = i as f64 / n as f64;
        let (x, y) = (x0 + (x1 - x0) * f, y0 + (y1 - y0) * f);
        if w <= 1.0 {
            c.fb.px(x.round(), y.round(), col, a);
        } else {
            disc(c, x, y, w / 2.0, col, a);
        }
    }
}

/// A beam that widens from `w0` to `w1`: a white core inside a coloured body.
fn beam(c: &mut Ctx, x0: f64, y0: f64, x1: f64, y1: f64, w0: f64, w1: f64, body: u32, edge: u32) {
    let n = ((x1 - x0).abs().max((y1 - y0).abs()) * 1.2).ceil().max(1.0) as i32;
    for i in 0..=n {
        let f = i as f64 / n as f64;
        let (x, y) = (x0 + (x1 - x0) * f, y0 + (y1 - y0) * f);
        let w = w0 + (w1 - w0) * f;
        disc(c, x, y, w / 2.0 + 1.0, edge, 1.0);
        disc(c, x, y, w / 2.0, body, 1.0);
        disc(c, x, y, (w / 4.0).max(0.6), 0xffffff, 1.0);
    }
}

fn stars(c: &mut Ctx, x: f64, y: f64, t: f64) {
    for i in 0..3 {
        let q = t * 4.0 + i as f64 * 2.09;
        let (sx, sy) = (x + cos(q) * 7.0, y + sin(q) * 2.5);
        for (dx, dy) in [(0.0, 0.0), (1.0, 0.0), (-1.0, 0.0), (0.0, 1.0), (0.0, -1.0)] {
            c.fb.px(sx.round() + dx, sy.round() + dy, if dx == 0.0 && dy == 0.0 { 0xffffff } else { 0xffd23a }, 1.0);
        }
    }
}

/// The top or bottom rows of a sprite (a saibaman cut in two).
fn half(s: &Sprite, top: bool, at: usize) -> Sprite {
    let (j0, j1) = if top { (0, at) } else { (at, s.h) };
    let col = s.col[j0 * s.w..j1 * s.w].to_vec();
    let emit = s.emit[j0 * s.w..j1 * s.w].to_vec();
    Sprite { w: s.w, h: j1 - j0, col, emit, ax: s.ax, ay: if top { s.ay - at as f64 } else { s.ay.min((j1 - j0) as f64) } }
}

fn student() -> Sprite {
    make_sprite(
        &["..ooo..", ".ohhho.", ".ossso.", ".oEsEo.", "..oso..", ".oaaao.", "oaaaaao", "osaaaso", ".ouuuo.", ".opopo.", ".opopo.", ".oo.oo."],
        &Pal::new(&[('o', 0x120c18), ('h', 0x1a1826), ('s', 0xf6c8a2), ('E', 0x120c18), ('a', 0xf4f4f6), ('u', 0x2f8a46), ('p', 0xf4f4f6)]),
        "",
        None,
        None,
    )
}

fn poacher() -> Sprite {
    make_sprite(
        &[
            "..ooooo..",
            ".okkkkko.",
            "ooooooooo",
            "..ossso..",
            "..osEso..",
            "...oso...",
            "..ogggo.o",
            ".oggggoko",
            ".osgggsko",
            "..obbbo.o",
            "..obobo..",
            "..obobo..",
            "..oo.oo..",
        ],
        &Pal::new(&[('o', 0x120c18), ('k', 0xd8a040), ('s', 0xe8b48a), ('E', 0x120c18), ('g', 0xc8463a), ('b', 0x4a3a2a)]),
        "",
        None,
        None,
    )
}

fn cape() -> Sprite {
    make_sprite(
        &["....oooo......", "...ohhhho.....", "..okkkkkko....", "..ohhhhhho.oo.", "oooooooooooaao", "oaaaaaaaaaaAAo", ".oAAAAAAAAAAo.", "..oooooooooo.."],
        &Pal::new(&[('o', 0x120c18), ('h', 0xf4f4f6), ('k', 0x7a4ab0), ('a', 0xf4f4f6), ('A', 0xc2c6d2)]),
        "",
        None,
        None,
    )
}

pub fn draw(c: &mut Ctx, g: &mut Game) {
    let Some(p) = g.proto.clone() else { return };
    let t = c.t;
    let el = p.el(t);
    let into = el - MOMENT;
    let phi = g.phi;
    let me = at(g, phi, 0.0);
    let ahead = at(g, phi + 0.3, 0.0);
    let flip = ahead.x < me.x;
    let run = ((t * 9.0).floor() as i64 % 4) as usize;
    let hand = up(&me, g.lift_now + 15.0, if flip { -6.0 } else { 6.0 });
    match (g.s.hero, p.opt) {
        (Hero::Piccolo, 'A') if p.look > 0 => meditate(c, g, &me, p.look, p.focus, t),
        (Hero::Piccolo, 'A') => {
            // focus rings settle round him as he meditates; pebbles lift off the ground
            let (cx, cy) = up(&me, g.lift_now + 15.0, 0.0);
            for i in 0..3 {
                let f = ((t * 0.35 + i as f64 / 3.0) % 1.0 + 1.0) % 1.0;
                let r = 30.0 - f * 20.0;
                ring(c, cx, cy, r, r * 0.42, if i == 1 { 0xb8f0a0 } else { 0xffffff }, 0.25 + f * 0.6);
            }
            for i in 0..6 {
                let q = i as f64 * 1.05 + t * 0.4;
                let (x, y) = up(&me, 4.0 + 6.0 * (sin(t * 1.3 + i as f64) * 0.5 + 0.5) + i as f64 % 3.0 * 3.0, cos(q) * 22.0);
                disc(c, x, y, 1.0, if i % 2 == 0 { 0x8e95a4 } else { 0xc2c6d2 }, 1.0);
            }
        }
        (Hero::Piccolo, 'B') => {
            // the weighted cape and turban, dropped where he stood: a crater and dust
            let s = at(g, phi - 0.3, 0.0);
            if s.v[2] > 0.0 {
                let (x, y) = up(&s, 0.0, 0.0);
                glow(c, x, y + 1.0, 6.0, 13.0, 0x6a5a3a, 0.7);
                c.blit_z(&cape(), s.x, s.y, s.ang, flip, -1.0, s.v[2] * c.r + 8.0, 1.35);
                if g.rng.random() < 0.5 {
                    let vx = (g.rng.random() - 0.5) * 50.0;
                    g.fx.push(
                        Particle::new(x + vx * 0.2, y - 2.0, &[0xffffff, 0xd8cfb8]).v(vx, -15.0 - g.rng.random() * 20.0).drag(2.0).life(0.7).size(1.0, 2.0),
                    );
                }
            }
            let (cx, cy) = up(&me, 15.0, 0.0);
            ring(c, cx, cy, 18.0 + (t * 30.0) % 12.0, 9.0 + (t * 15.0) % 6.0, 0xffffff, 0.6);
        }
        (Hero::Piccolo, 'C') => {
            // kid gohan trains at his heels; a masenko up into the sky
            let gohan = &sprite::hero("gohan").forms[0];
            let s = fig(c, g, &gohan.run[(run + 2) % 4], phi + 0.32, 0.0, 0.78, flip);
            if into > -1.5 {
                let (x0, y0) = up(&s, 18.0, 0.0);
                let (x1, y1) = (x0 - 150.0, y0 - 70.0);
                beam(c, x0, y0, x1, y1, 2.0, 7.0, 0xffe14a, 0xffa21a);
                glow(c, x0, y0, 3.0, 7.0, 0xfff6b0, 0.9);
            }
            let (x, y) = up(&me, 18.0, if flip { 10.0 } else { -10.0 });
            stars(c, x, y, t);
        }
        (Hero::Krillin, 'A') => {
            // three saibamen ahead; the disc has cut two and is on its way to the third
            let saiba = sprite::get("SAIBA");
            let (top, bot) = (half(saiba, true, 5), half(saiba, false, 5));
            let mut pts = vec![hand];
            for (i, d) in [0.28, 0.46, 0.66].into_iter().enumerate() {
                let s = at(g, phi + d, 0.0);
                if s.v[2] <= 0.0 {
                    continue;
                }
                let dep = s.v[2] * c.r + 4.0;
                if i < 2 {
                    c.blit_z(&bot, s.x, s.y, s.ang, !flip, 0.0, dep, 1.1);
                    c.blit_z(&top, s.x, s.y, s.ang + 0.35, !flip, 9.0 + i as f64 * 2.0, dep, 1.1);
                    let (x, y) = up(&s, 7.0, 0.0);
                    if g.rng.random() < 0.5 {
                        g.fx.push(
                            Particle::new(x, y, &[0xffffff, 0x9cf0b8, 0x58b848]).v((g.rng.random() - 0.5) * 60.0, -30.0 * g.rng.random()).drag(2.0).life(0.4),
                        );
                    }
                } else {
                    c.blit_z(saiba, s.x, s.y, s.ang, !flip, 0.0, dep, 1.1);
                }
                pts.push(up(&s, 7.0, 0.0));
            }
            if pts.len() == 4 {
                let f = 0.55;
                let (dx, dy) = (pts[2].0 + (pts[3].0 - pts[2].0) * f, pts[2].1 + (pts[3].1 - pts[2].1) * f);
                pts[3] = (dx, dy);
                for w in pts.windows(2) {
                    line(c, w[0].0, w[0].1, w[1].0, w[1].1, 1.0, 0xfff2a0, 0.7);
                }
                ring(c, dx, dy, 7.0, 2.0, 0xffb81e, 1.0);
                ring(c, dx, dy, 6.0, 1.6, 0xffe14a, 1.0);
                ring(c, dx, dy, 4.0, 1.0, 0xffffff, 1.0);
                glow(c, dx, dy, 2.0, 9.0, 0xfff6b0, 0.6);
            }
        }
        (Hero::Krillin, 'B') => {
            // solar flare: a white blast from his head, the villain blinded with stars round his head
            let foe = sprite::get("FRIEZA");
            let s = fig(c, g, foe, phi + 0.42, 0.0, 1.0, !flip);
            let (fx, fy) = up(&s, foe.h as f64 + 3.0, 0.0);
            stars(c, fx, fy, t);
            let (x, y) = up(&me, 26.0, 0.0);
            let k = (1.0 - (into + 0.6).max(0.0) / 1.2).clamp(0.25, 1.0);
            glow(c, x, y, 4.0 * k, 26.0 * k, 0xffffff, 0.8);
            for i in 0..12 {
                let q = i as f64 * 0.5236 + t * 0.3;
                line(c, x + cos(q) * 14.0, y + sin(q) * 14.0, x + cos(q) * 40.0 * k, y + sin(q) * 40.0 * k, 1.0, 0xfff2a0, 0.9);
            }
        }
        (Hero::Krillin, 'C') => {
            // android 18 runs the laps; a tag spark where they slapped hands
            let s = fig(c, g, sprite::get("A18"), phi - 0.3, (sin(t * 18.0)).abs() * 2.0, 1.0, flip);
            let (x0, y0) = up(&s, 14.0, 0.0);
            let (x1, y1) = up(&me, 14.0, 0.0);
            let (x, y) = ((x0 + x1) / 2.0, (y0 + y1) / 2.0);
            glow(c, x, y, 2.0, 8.0, 0xfff2a0, 0.9);
            for i in 0..8 {
                let q = i as f64 * 0.785 + t;
                line(c, x + cos(q) * 4.0, y + sin(q) * 4.0, x + cos(q) * 9.0, y + sin(q) * 9.0, 1.0, 0xffd23a, 1.0);
            }
        }
        (Hero::Goten, 'A') => {
            // gold sparkles round the fused gotenks
            for _ in 0..3 {
                let (x, y) = up(&me, 8.0 + g.rng.random() * 26.0, (g.rng.random() - 0.5) * 30.0);
                g.fx.push(Particle::new(x, y, &[0xffffff, 0xfff2a0, 0xffc81e]).v(0.0, -12.0).life(0.6));
            }
            let (cx, cy) = up(&me, 16.0, 0.0);
            ring(c, cx, cy, 22.0 + (t * 24.0) % 10.0, 10.0, 0xffe14a, 0.5);
        }
        (Hero::Goten, 'B') => {
            // roshi shows the kamehameha; goten copies it; the moves he's learnt orbit his head
            let roshi = sprite::get("ROSHI");
            let s = fig(c, g, roshi, phi + 0.42, 0.0, 1.0, flip);
            let (x0, y0) = up(&s, 12.0, if flip { 4.0 } else { -4.0 });
            beam(c, x0, y0, x0 - 120.0, y0 - 80.0, 2.0, 6.0, 0x6ac8ff, 0x2f7ae0);
            beam(c, hand.0, hand.1, hand.0 - 110.0, hand.1 - 95.0, 1.5, 4.0, 0x6ac8ff, 0x2f7ae0);
            let (cx, cy) = up(&me, 36.0, 0.0);
            for (i, col) in [0x6ac8ff, 0xffe14a, 0xb07ae8, 0xffa0d0].into_iter().enumerate() {
                let q = t * 2.0 + i as f64 * 1.5708;
                disc(c, cx + cos(q) * 14.0, cy + sin(q) * 4.0, 3.0, 0x120c18, 1.0);
                disc(c, cx + cos(q) * 14.0, cy + sin(q) * 4.0, 2.0, col, 1.0);
                c.fb.px((cx + cos(q) * 14.0).round() - 1.0, (cy + sin(q) * 4.0).round() - 1.0, 0xffffff, 1.0);
            }
        }
        (Hero::Tien, 'A') => {
            // the multi-form: three more tiens round the lap, each with a split-off shimmer
            let set = &sprite::hero("tien").forms[0];
            for (i, d) in [-0.36, 0.36, 0.72].into_iter().enumerate() {
                let s = fig(c, g, &set.run[(run + i + 1) % 4], phi + d, 0.0, 1.05, flip);
                if s.v[2] > 0.0 && g.rng.random() < 0.4 {
                    let (x, y) = up(&s, 14.0 + (g.rng.random() - 0.5) * 20.0, (g.rng.random() - 0.5) * 14.0);
                    g.fx.push(Particle::new(x, y, &[0xffffff, 0xe8f0ff]).v(0.0, -10.0).life(0.5));
                }
            }
        }
        (Hero::Tien, 'B') => {
            // the tri-beam: a triangle of ki crushing cell into a triangular crater; it costs tien his own power
            let foe = sprite::get("CELL");
            let s = at(g, phi + 0.45, 0.0);
            let (gx, gy) = up(&s, 0.0, 0.0);
            let r = 16.0;
            let tri = [(gx, gy - r * 0.55), (gx - r, gy + r * 0.3), (gx + r, gy + r * 0.3)];
            for k in 0..3 {
                let (a, b) = (tri[k], tri[(k + 1) % 3]);
                line(c, a.0, a.1, b.0, b.1, 2.0, 0x3a2a18, 0.85);
            }
            fig(c, g, foe, phi + 0.45, -3.0, 1.0, !flip);
            let (tx, ty) = up(&s, 14.0, 0.0);
            beam(c, hand.0, hand.1, tx, ty, 3.0, 22.0, 0xfff2a0, 0xffb81e);
            glow(c, tx, ty, 8.0, 18.0, 0xffffff, 0.8);
            for _ in 0..2 {
                let (x, y) = up(&me, 6.0 + g.rng.random() * 22.0, (g.rng.random() - 0.5) * 12.0);
                g.fx.push(Particle::new(x, y, &[0xff8a8a, 0xd8344a]).v((g.rng.random() - 0.5) * 20.0, -25.0).life(0.6));
            }
        }
        (Hero::Tien, 'C') => {
            // his dojo's students jog the lap behind him; one graduates in a burst of sparkles
            let stu = student();
            for i in 0..4 {
                let hop = if i == 3 { (sin(t * 6.0)).abs() * 8.0 } else { (sin(t * 16.0 + i as f64)).abs() * 1.5 };
                let s = fig(c, g, &stu, phi + 0.18 + i as f64 * 0.14, hop, 1.45, flip);
                if i == 3 && s.v[2] > 0.0 {
                    let (x, y) = up(&s, hop + 8.0, 0.0);
                    glow(c, x, y, 2.0, 7.0, 0xfff2a0, 0.4);
                    if g.rng.random() < 0.25 {
                        g.fx.push(
                            Particle::new(x, y, &[0xffffff, 0xffe14a, 0xffa21a])
                                .v((g.rng.random() - 0.5) * 50.0, -30.0 * g.rng.random() - 10.0)
                                .drag(1.5)
                                .life(0.6),
                        );
                    }
                }
            }
        }
        (Hero::A17, 'A') => {
            // rapid fire that never runs dry: a fan of green ki blasts up and ahead
            for i in 0..14 {
                let f = ((t * 1.6 + i as f64 / 14.0) % 1.0 + 1.0) % 1.0;
                let q = -2.75 + ((i * 5) % 9) as f64 * 0.09;
                let (x, y) = (hand.0 + cos(q) * (8.0 + f * 85.0), hand.1 + sin(q) * (8.0 + f * 85.0));
                disc(c, x, y, 3.5, 0x1a7a3a, 1.0);
                disc(c, x, y, 2.5, 0x5ae08a, 1.0);
                disc(c, x, y, 1.2, 0xffffff, 1.0);
            }
            glow(c, hand.0, hand.1, 3.0, 8.0, 0xc8ffd8, 0.9);
        }
        (Hero::A17, 'B') => {
            // the preserve: dinos and birds he protects; a poacher running off with his net
            for (d, name, k) in [(0.2, "DINOS.d", 0.5), (-0.28, "DINOS.c", 0.42), (0.36, "DINOS.b", 0.42)] {
                if sprite::baked().contains_key(name) {
                    fig(c, g, sprite::get(name), phi + d, 0.0, k, d < 0.0);
                }
            }
            let s = fig(c, g, &poacher(), phi + 0.56, (sin(t * 16.0)).abs() * 2.0, 1.5, flip);
            if s.v[2] > 0.0 {
                let (x, y) = up(&s, 18.0, if flip { 8.0 } else { -8.0 });
                ring(c, x, y, 5.0, 4.0, 0xb8a070, 1.0);
            }
            for (i, b) in ["BIRD_A", "BIRD_B", "BIRD_C"].into_iter().enumerate() {
                let (x, y) = up(&me, 50.0 + i as f64 * 12.0 + sin(t * 2.0 + i as f64) * 3.0, (i as f64 - 1.0) * 26.0 + t * 6.0 % 10.0);
                crate::scene::blit(c.fb, sprite::get(b), x, y, i % 2 == 0);
            }
        }
        (Hero::A17, 'C') => {
            // a barrier round him eats nappa's blasts
            let foe = sprite::get("NAPPA");
            let s = fig(c, g, foe, phi + 0.48, 0.0, 1.0, !flip);
            let (cx, cy) = up(&me, 15.0, 0.0);
            let r = 23.0;
            let (x0, y0) = up(&s, 16.0, if flip { 6.0 } else { -6.0 });
            for i in 0..3 {
                let f = ((t * 1.6 + i as f64 / 3.0) % 1.0 + 1.0) % 1.0;
                let (bx, by) = (x0 + (cx - x0) * f, y0 + (cy - y0) * f);
                let d = ((bx - cx).powi(2) + (by - cy).powi(2)).sqrt();
                if d > r {
                    glow(c, bx, by, 2.0, 5.0, 0xffd06a, 1.0);
                    disc(c, bx, by, 1.5, 0xffffff, 1.0);
                }
            }
            let mut yy = -r;
            while yy <= r {
                let mut xx = -r;
                while xx <= r {
                    let d = (xx * xx + yy * yy).sqrt();
                    if d <= r {
                        let hex = ((xx + 40.0) as i32 / 4 + (yy + 40.0) as i32 / 4) % 3 == 0;
                        let a = if d > r - 1.5 {
                            1.0
                        } else if hex {
                            0.35
                        } else {
                            0.15
                        };
                        if bayer((cx + xx) as i32, (cy + yy) as i32) < a {
                            c.fb.px(cx + xx, cy + yy, if d > r - 1.5 { 0xe8fff0 } else { 0x9cf0b8 }, 1.0);
                        }
                    }
                    xx += 1.0;
                }
                yy += 1.0;
            }
            let q = if x0 < cx { 3.14159 } else { 0.0 };
            let (hx, hy) = (cx + cos(q) * r, cy - 4.0);
            glow(c, hx, hy, 3.0, 9.0, 0xffffff, 1.0);
        }
        _ => {}
    }
}

/// Small deterministic noise in 0..1.
fn hz(i: f64, k: f64) -> f64 {
    let x = sin(i * 12.9898 + k * 78.233) * 43758.5453;
    x - x.floor()
}

/// A point in the hero's frame: `u` along the ground (right), `v` up, from where he stands.
fn local(me: &Spot, u: f64, v: f64) -> (f64, f64) {
    up(me, v, u)
}

/// Piccolo sitting cross-legged, for the meditation looks (prototype sprite).
pub fn meditation_sprite(g: &Game) -> Option<Sprite> {
    let p = g.proto.as_ref()?;
    if g.s.hero != Hero::Piccolo || p.opt != 'A' || p.look == 0 {
        return None;
    }
    static S: std::sync::OnceLock<Sprite> = std::sync::OnceLock::new();
    Some(
        S.get_or_init(|| {
            let mut rows: Vec<&str> = planet_core::sprite::PICCOLO_HEAD.to_vec();
            rows.extend_from_slice(&[
                "...oyyobbbbyyo..",
                "..oyyyoaaaaoyyo.",
                "..oYYosssssoYYo.",
                "..oaasSSsSSsaao.",
                "...oaaaaaaaaAo..",
                "...ouuuuuuuuuo..",
                ".oppppppppppppo.",
                "oppPPpwwwwpPPppo",
                ".oooooooooooooo.",
            ]);
            make_sprite(
                &rows,
                &Pal::new(&[
                    ('o', 0x120c18),
                    ('s', 0x5bb043),
                    ('S', 0x3c7f2e),
                    ('h', 0xf4f4f6),
                    ('H', 0xc2c6d2),
                    ('k', 0x7a4ab0),
                    ('K', 0x4e2c78),
                    ('E', 0x120c18),
                    ('r', 0xffffff),
                    ('M', 0x24401c),
                    ('a', 0x5a3a9a),
                    ('A', 0x3e2670),
                    ('b', 0x5a3a9a),
                    ('y', 0xf4f4f6),
                    ('Y', 0xc2c6d2),
                    ('u', 0x3a6ad8),
                    ('p', 0x5a3a9a),
                    ('P', 0x3e2670),
                    ('w', 0x8a4a2a),
                ]),
                "",
                None,
                None,
            )
        })
        .clone(),
    )
}

/// A spot on the planet `d` along the road from him and `k` across it (radians).
fn surf(g: &Game, d: f64, k: f64) -> Spot {
    let p = g.frame3.road_pt(g.phi + d);
    let n = g.frame3.n;
    g.cam.screen(planet_core::geom::norm([p[0] + n[0] * k, p[1] + n[1] * k, p[2] + n[2] * k]), 0.0)
}

/// Piccolo A's meditation looks for the second picker. `f` is focus, 0..1. No rings or circles anywhere.
fn meditate(c: &mut Ctx, g: &mut Game, me: &Spot, look: u32, f: f64, t: f64) {
    let lift = g.lift_now;
    match look {
        // 1: a calm aura, a tall flame shape hugging him, brighter and taller with focus, with motes rising off it
        1 => {
            let (w0, h0) = (9.0 + 6.0 * f, 30.0 + 16.0 * f);
            let mut v = -2.0;
            while v <= h0 {
                let k = (v / h0).clamp(0.0, 1.0);
                let w = w0 * (std::f64::consts::PI * (0.15 + 0.85 * k)).sin().powf(0.6) * (1.0 + 0.12 * sin(t * 7.0 + v * 0.35)) * (1.0 - 0.6 * k * k);
                let mut u = -w;
                while u <= w {
                    let edge = 1.0 - (u.abs() / w.max(0.5));
                    let a = if edge < 0.25 { 0.4 + 0.6 * f } else { 0.08 + 0.2 * f };
                    let (x, y) = local(me, u, lift + v - 2.0);
                    let (xi, yi) = (x.round(), y.round());
                    if xi >= 0.0 && yi >= 0.0 && xi < c.w && yi < c.h && bayer(xi as i32, yi as i32) < a {
                        let col = if edge < 0.22 {
                            if f > 0.5 {
                                0x6ae07a
                            } else {
                                0x9ce89a
                            }
                        } else {
                            0xb8f0a0
                        };
                        c.fb.px(xi, yi, col, 1.0);
                    }
                    u += 1.0;
                }
                v += 1.0;
            }
            if g.rng.random() < 0.2 + 0.6 * f {
                let (x, y) = local(me, (g.rng.random() - 0.5) * 2.0 * w0, lift + g.rng.random() * h0);
                g.fx.push(Particle::new(x, y, &[0xffffff, 0x6ae07a]).v(sin(me.ang) * 18.0, -cos(me.ang) * 26.0).life(0.7));
            }
        }
        // 2: pebbles lift off the planet round him, higher and more of them with focus; they bob and turn slowly
        2 => {
            let n = 4 + (8.0 * f) as usize;
            for i in 0..n {
                let fi = i as f64;
                let sp = surf(g, (hz(fi, 1.0) - 0.5) * 0.7, (hz(fi, 14.0) - 0.5) * 0.35);
                if sp.v[2] <= 0.0 {
                    continue;
                }
                let h = (3.0 + hz(fi, 2.0) * 26.0) * (0.25 + 0.75 * f) + sin(t * 1.4 + fi * 1.7) * 2.0;
                let (gx, gy) = local(&sp, 0.0, -1.0);
                c.fb.px(gx.round(), gy.round(), 0x6a5a3a, 1.0);
                c.fb.px(gx.round() + 1.0, gy.round(), 0x6a5a3a, 1.0);
                let (x, y) = local(&sp, 0.0, h);
                let col = if hz(fi, 4.0) > 0.5 { 0x8a7f70 } else { 0xa89d8a };
                for (dx, dy) in [(0.0, 0.0), (1.0, 0.0), (0.0, 1.0), (1.0, 1.0)] {
                    c.fb.px(x.round() + dx, y.round() + dy, col, 1.0);
                }
                {
                    for (dx, dy) in [(-1.0, 0.0), (-1.0, 1.0), (0.0, -1.0), (1.0, -1.0), (2.0, 0.0), (2.0, 1.0), (0.0, 2.0), (1.0, 2.0)] {
                        c.fb.px(x.round() + dx, y.round() + dy, 0x4a4238, 1.0);
                    }
                }
                c.fb.px(x.round(), y.round(), 0xe8e0d0, 1.0);
                if f > 0.5 && hz(fi, 5.0) > 0.5 {
                    c.fb.px(x.round(), y.round() + 3.0 + (t * 6.0 + fi) % 3.0, 0xd8cfb8, 1.0);
                }
            }
        }
        // 3: a rising wind: his cape streams up and out, streaks climb past him and leaves spiral up
        3 => {
            let flap = sin(t * 9.0) * 2.0 + sin(t * 13.0) * 1.0;
            let reach = 6.0 + 8.0 * f;
            for k in 0..3 {
                let kk = k as f64 * 1.5;
                let (x0, y0) = local(me, -5.0 + kk * 3.0, lift + 20.0);
                let (x1, y1) = local(me, -6.0 + kk * 3.0 - reach * 0.4 + flap * (0.5 + kk * 0.2), lift + 22.0 + reach + flap * 0.4 - kk);
                line(c, x0, y0, x1, y1, 1.0, if k % 2 == 0 { 0xc2c6d2 } else { 0x8e95a4 }, 1.0);
            }
            let n = 3 + (8.0 * f) as usize;
            for i in 0..n {
                let fi = i as f64;
                let ph = ((t * (0.6 + 0.4 * f) + hz(fi, 6.0)) % 1.0 + 1.0) % 1.0;
                let u = (hz(fi, 7.0) - 0.5) * 60.0 + sin(t * 2.0 + fi) * 3.0;
                let (x0, y0) = local(me, u, ph * 70.0);
                let (x1, y1) = local(me, u + 2.0 * sin(t * 4.0 + fi), ph * 70.0 + 3.0 + 3.0 * f);
                line(c, x0, y0, x1, y1, 1.0, 0x7aa0c8, 0.5 + 0.4 * (1.0 - ph));
            }
            for i in 0..(3 + (9.0 * f) as usize) {
                let fi = i as f64;
                let ph = ((t * 0.35 + hz(fi, 8.0)) % 1.0 + 1.0) % 1.0;
                let (x, y) = local(me, sin(ph * 9.0 + fi * 2.0) * (10.0 + 10.0 * ph), ph * 60.0 + 4.0);
                let col = if i % 2 == 0 { 0x58b848 } else { 0x9ad85a };
                c.fb.px(x.round(), y.round(), col, 1.0);
                c.fb.px(x.round() + 1.0, y.round(), col, 1.0);
                c.fb.px(x.round(), y.round() - 1.0, 0x2f7a2a, 1.0);
            }
        }
        // 4: ki gathering: specks drift in from all round and are drawn into his chest, faster and thicker with focus
        4 => {
            let (cx, cy) = local(me, 0.0, lift + 14.0);
            let n = 6 + (22.0 * f) as usize;
            for i in 0..n {
                let fi = i as f64;
                let ph = ((t * (0.35 + 0.35 * f) + hz(fi, 9.0)) % 1.0 + 1.0) % 1.0;
                let a = hz(fi, 10.0) * 6.283 + ph * 1.2;
                let d = (1.0 - ph) * (30.0 + 30.0 * hz(fi, 11.0));
                let (x, y) = (cx + cos(a) * d, cy + sin(a) * d * 0.75);
                let (tx, ty) = (cx + cos(a) * (d + 3.0 + 3.0 * f), cy + sin(a) * (d + 3.0 + 3.0 * f) * 0.75);
                line(c, tx, ty, x, y, 1.0, 0x58c87a, 0.35 + 0.5 * ph);
                c.fb.px(x.round(), y.round(), if ph > 0.7 { 0x2e9a50 } else { 0x58c87a }, 1.0);
            }
            let core = 1.0 + 2.0 * f + sin(t * 5.0) * 0.4;
            for (dx, dy) in [(0.0, 0.0), (1.0, 0.0), (-1.0, 0.0), (0.0, 1.0), (0.0, -1.0)] {
                if (dx as f64).abs() + (dy as f64).abs() <= core {
                    c.fb.px(cx.round() + dx, cy.round() + dy, 0xffffff, 1.0);
                }
            }
        }
        // 5: the planet's grass leans toward him, further with focus, a shiver running through it
        5 => {
            let (hx, hy) = (me.x, me.y);
            for i in 0..60 {
                let fi = i as f64;
                let sp = surf(g, (hz(fi, 12.0) - 0.5) * 0.8, (hz(fi, 15.0) - 0.5) * 0.5);
                if sp.v[2] <= 0.05 {
                    continue;
                }
                let (dx, dy) = (hx - sp.x, hy - sp.y);
                let d = (dx * dx + dy * dy).sqrt();
                if d < 6.0 {
                    continue;
                }
                let (ux, uy) = (sin(sp.ang), -cos(sp.ang));
                let k = (0.25 + 0.75 * f) * (1.0 - (d / 90.0).min(0.85)) + sin(t * 3.0 + fi) * 0.06;
                let len = 4.0 + hz(fi, 13.0) * 3.0 + 2.0 * f;
                let (lx, ly) = (ux * (1.0 - k) + dx / d * k, uy * (1.0 - k) + dy / d * k);
                let l = (lx * lx + ly * ly).sqrt();
                let (x1, y1) = (sp.x + lx / l * len, sp.y + ly / l * len);
                line(
                    c,
                    sp.x,
                    sp.y,
                    x1,
                    y1,
                    1.0,
                    if i % 3 == 0 {
                        0x2f7a2a
                    } else if i % 3 == 1 {
                        0x3f9a34
                    } else {
                        0x58b848
                    },
                    1.0,
                );
                c.fb.px(x1.round(), y1.round(), 0x8ad05a, 1.0);
            }
        }
        // 6: his spirit rises: a pale green afterimage of him lifts out of his body and drifts up, clearer with focus
        6 => {
            let Some(spr) = meditation_sprite(g) else { return };
            let spr = &spr;
            let rise = 5.0 + 9.0 * f + sin(t * 1.6) * 1.5;
            let side = 7.0 + 7.0 * f;
            let a = 0.15 + 0.45 * f;
            for j in 0..spr.h {
                for i in 0..spr.w {
                    let col = spr.col[j * spr.w + if g.flip_now { spr.w - 1 - i } else { i }];
                    if col < 0 {
                        continue;
                    }
                    let u = i as f64 - spr.ax + 0.5 + sin(t * 2.0 + j as f64 * 0.3) * 0.6;
                    let v = spr.ay - j as f64 + lift + rise;
                    let (x, y) = local(me, u * 1.05 + side, v * 1.05);
                    let (xi, yi) = (x.round(), y.round());
                    if xi >= 0.0 && yi >= 0.0 && xi < c.w && yi < c.h && bayer(xi as i32, yi as i32) < a {
                        let lum = ((col >> 16 & 255) + (col >> 8 & 255) + (col & 255)) as f64 / 765.0;
                        c.fb.px(xi, yi, if lum > 0.55 { 0xb8f0c0 } else { 0x4ec870 }, 1.0);
                    }
                }
            }
            if g.rng.random() < 0.3 + 0.4 * f {
                let (x, y) = local(me, (g.rng.random() - 0.5) * 14.0, lift + rise + 28.0);
                g.fx.push(Particle::new(x, y, &[0xffffff, 0xc8ffd8]).v(sin(me.ang) * 10.0, -cos(me.ang) * 14.0).life(0.8));
            }
        }
        _ => {}
    }
}
