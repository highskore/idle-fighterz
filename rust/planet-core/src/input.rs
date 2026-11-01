//! Pointer and keyboard input: game.js's canvas listeners and what they call. A press that barely moves is a tap (two
//! close together throw a big bang), a drag spins the planet with inertia, a held press charges a beam, and on snake
//! way the press itself acts. Coordinates come in twice: CSS pixels (`clientX`/`clientY`, which the drag turns by) and
//! the buffer pixels game.js's `st.toBuf` maps them to (which everything on the planet is hit-tested in).

use crate::big::Big;
use crate::data::{Upg, N_BEAM};
use crate::game::Game;
use crate::jsmath::{cos, hypot, sin};

/// A press in progress (game.js's `drag`).
#[derive(Clone, Copy, Debug)]
pub struct Drag {
    /// the last pointer position, in CSS pixels
    pub x: f64,
    pub y: f64,
    /// how far it has moved in all, in CSS pixels; past 6 it's a drag, not a tap
    pub moved: f64,
    /// `st.t` when it went down: a beam starts charging 0.3s in
    pub t: f64,
    /// where the beam aims, in buffer pixels
    pub ax: f64,
    pub ay: f64,
    /// the pointer, and whether it's a finger (two landing together may be a two-finger tap)
    pub id: i32,
    pub touch: bool,
}

/// game.js's `two`: two fingers that landed together, at home with nothing on. If both lift within 0.25s of each other,
/// unmoved, it's a two-finger tap; otherwise the first lift's tap, held back until then, happens after all.
#[derive(Clone, Copy, Debug)]
pub struct Two {
    pub ids: [i32; 2],
    /// each finger's last position and how far it has moved, in CSS pixels
    pub xy: [(f64, f64); 2],
    pub moved: [f64; 2],
    /// the first lift: its time and buffer spot
    pub lift: Option<(f64, f64, f64)>,
}

/// A fired beam, for the renderer.
#[derive(Clone, Copy, Debug)]
pub struct Beam {
    pub t0: f64,
    pub c: f64,
    pub x: f64,
    pub y: f64,
    pub dx: f64,
    pub dy: f64,
    pub z: f64,
    /// a full charge at beam lv 5: the final flash
    pub ff: bool,
    pub full: bool,
    /// fired under kaioken (drawn red) or as the great ape (drawn 1.5× wider)
    pub kaio: bool,
    pub ape: bool,
}

/// The big bang ball in flight: it explodes at (x1, y1) after `dur` seconds.
#[derive(Clone, Copy, Debug)]
pub struct Bang {
    pub x0: f64,
    pub y0: f64,
    pub x1: f64,
    pub y1: f64,
    pub t0: f64,
    pub dur: f64,
}

/// An explosion ring, for the renderer (gone after 0.45s).
#[derive(Clone, Copy, Debug)]
pub struct Blast {
    pub x: f64,
    pub y: f64,
    /// drawn 1.6× wider under the great ape (its hit radius doesn't change)
    pub r: f64,
    pub t0: f64,
    /// under kaioken: drawn red
    pub kaio: bool,
}

/// The input state game.js keeps in `mount()`'s closure.
#[derive(Clone, Debug)]
pub struct Input {
    pub drag: Option<Drag>,
    pub two: Option<Two>,
    /// the spin a drag leaves behind, radians a second round x and y
    pub vrx: f64,
    pub vry: f64,
    /// seconds since the last drag
    pub idle_t: f64,
    /// kami's lookout turns only round the road's pole: how far it has turned
    pub yaw: f64,
    /// game.js `w2Pole`: korin's tower is up
    pub w2_pole: bool,
    /// how long the beam has charged (0 when not), up to 2.5
    pub charging: f64,
    pub beam: Option<Beam>,
    /// where the fired beam hit something, for the renderer's hit flashes
    pub beam_hits: Vec<(f64, f64)>,
    pub bang: Option<Bang>,
    pub bang_ready: f64,
    /// the last tap's time and spot, for double-tap detection (`t` is -9 once a pair has fired)
    pub last_tap: (f64, f64, f64),
    pub blasts: Vec<Blast>,
    /// the shockwaves full beams and big bangs land as (waves.rs)
    pub waves: Vec<crate::waves::Wave>,
    /// the great ape's step (`floor(t·3.2)`): each new one stomps
    pub ape_step: f64,
    /// whether the great ape stomped this frame (the renderer kicks up dust then)
    pub stomp: bool,
}

impl Default for Input {
    fn default() -> Self {
        Input {
            drag: None,
            two: None,
            vrx: 0.0,
            vry: 0.0,
            idle_t: 99.0,
            yaw: 0.0,
            w2_pole: false,
            charging: 0.0,
            beam: None,
            beam_hits: Vec::new(),
            bang: None,
            bang_ready: 0.0,
            last_tap: (-9.0, 0.0, 0.0),
            blasts: Vec::new(),
            waves: Vec::new(),
            ape_step: 0.0,
            stomp: false,
        }
    }
}

impl Game {
    /// `pointerdown`: (x, y) in CSS pixels, (bx, by) in buffer pixels, the browser's `pointerId` and `button`, and
    /// whether `pointerType` is `touch`. A right-click opens instant transmission once it's owned; a second finger
    /// landing within 0.12s of the first, at home with nothing on, may be a two-finger tap (`pointer_up` decides).
    #[allow(clippy::too_many_arguments)]
    pub fn pointer_down(&mut self, x: f64, y: f64, bx: f64, by: f64, id: i32, button: i32, touch: bool) {
        if self.playing && self.s.world == 3 && self.tl.snk.is_some() {
            self.snake_tap(bx, by);
            return;
        }
        if button == 2 && self.s.lv(Upg::Itx) > 0 {
            self.itx_open();
            return;
        }
        if let Some(d) = self.inp.drag.filter(|d| touch && d.touch && d.id != id && self.t - d.t <= 0.12 && d.moved <= 6.0 && self.itx_can()) {
            self.inp.two = Some(Two { ids: [d.id, id], xy: [(d.x, d.y), (x, y)], moved: [d.moved, 0.0], lift: None });
        }
        self.inp.drag = Some(Drag { x, y, moved: 0.0, t: self.t, ax: bx, ay: by, id, touch });
    }

    /// Not a two-finger tap after all: the tap held back from the first lift happens now.
    fn two_miss(&mut self) {
        if let Some((_, x, y)) = self.inp.two.take().and_then(|w| w.lift) {
            self.tap(x, y);
        }
    }

    /// `pointermove` of pointer `id`: aims a charging beam, or spins the planet once the press has moved past 6px.
    pub fn pointer_move(&mut self, x: f64, y: f64, bx: f64, by: f64, id: i32) {
        if let Some(w) = self.inp.two.as_mut() {
            if let Some(i) = w.ids.iter().position(|&p| p == id) {
                let p = &mut w.xy[i];
                w.moved[i] += (x - p.0).abs() + (y - p.1).abs();
                *p = (x, y);
                if w.moved[i] <= 6.0 {
                    return;
                }
                self.two_miss();
            }
        }
        let Some(d) = self.inp.drag.as_mut() else { return };
        let (dx, dy) = (x - d.x, y - d.y);
        d.x = x;
        d.y = y;
        d.moved += dx.abs() + dy.abs();
        if self.inp.charging > 0.0 {
            d.ax = bx;
            d.ay = by;
            return;
        }
        if d.moved > 6.0 {
            let k = 1.1 / (self.cam.r * self.cam.scale);
            let pole = self.w2_pole();
            self.inp.vry = dx * k * 30.0;
            self.inp.vrx = if pole { 0.0 } else { dy * k * 30.0 };
            if pole {
                self.inp.yaw += dx * k;
                self.cam.m = self.lookout_m();
            } else {
                self.cam.turn(dy * k, dx * k);
            }
            self.inp.idle_t = 0.0;
        }
    }

    /// `pointerup` of pointer `id` at (bx, by): fires a charged beam, or taps if the press didn't move. The second
    /// finger of a two-finger tap opens instant transmission instead.
    pub fn pointer_up(&mut self, bx: f64, by: f64, id: i32) {
        if let Some(w) = self.inp.two.filter(|w| w.ids.contains(&id) && (w.lift.is_some() || self.inp.charging <= 0.15)) {
            match w.lift {
                None => self.inp.two.as_mut().unwrap().lift = Some((self.t, bx, by)),
                Some((t, _, _)) if self.t - t <= 0.25 && self.itx_can() => {
                    self.inp.two = None;
                    self.itx_open();
                }
                Some(_) => self.two_miss(),
            }
            self.inp.charging = 0.0;
            self.inp.drag = None;
            return;
        }
        self.inp.two = None;
        if let Some(d) = self.inp.drag {
            if self.inp.charging > 0.15 {
                self.fire_beam(self.inp.charging, d.ax, d.ay);
            } else if d.moved <= 6.0 {
                self.tap(bx, by);
            }
        }
        self.inp.charging = 0.0;
        self.inp.drag = None;
    }

    pub fn pointer_cancel(&mut self) {
        self.inp.drag = None;
        self.inp.charging = 0.0;
        self.inp.two = None;
    }

    /// `keydown` with `e.key.toLowerCase()`; true when the game took it (the page then calls `preventDefault`).
    /// The page filters repeats, modifier keys and typing in fields before calling this.
    pub fn key(&mut self, k: &str) -> bool {
        if !self.playing {
            return false;
        }
        if self.s.world == 3 && self.tl.snk.is_some() {
            if k == "f" {
                let gi = self.tl.snk.as_ref().unwrap().ghosts.iter().position(|g| !g.dead && g.sx.is_some());
                if let Some(gi) = gi {
                    self.blast_ghost(gi);
                }
            } else if matches!(k, " " | "arrowup" | "arrowright" | "w" | "d") {
                self.snake_tap(-99.0, -99.0);
            } else {
                return false;
            }
        } else if k == " " {
            self.train();
        } else {
            return false;
        }
        true
    }

    /// `tap(px, py)`: a second tap within 0.32s and 30px throws a big bang; anything else goes to `onClick`.
    pub fn tap(&mut self, px: f64, py: f64) {
        if self.playing && (self.intro_skip() || self.skipping()) {
            return;
        }
        let t = self.t;
        let (lt, lx, ly) = self.inp.last_tap;
        let dbl = t - lt < 0.32 && hypot(&[px - lx, py - ly]) < 30.0;
        self.inp.last_tap = (if dbl { -9.0 } else { t }, px, py);
        if dbl && self.playing && self.s.lv(Upg::Bigbang) > 0 && self.inp.bang.is_none() && t > self.inp.bang_ready && !self.stunned() && !self.swapped() {
            self.throw_bang(px, py);
            return;
        }
        self.click(px, py);
    }

    /// The beam's charge, once a frame (`frame()` between the moon and the senzu bean).
    pub(crate) fn charge(&mut self, t: f64) {
        match self.inp.drag {
            // a stun or hit's time skip holds the charge off, and the hold starts over after it
            Some(mut d) if self.stunned() || self.skipping() => {
                self.inp.charging = 0.0;
                d.t = t;
                self.inp.drag = Some(d);
            }
            Some(d) if (d.moved <= 6.0 || self.inp.charging > 0.0) && self.s.lv(Upg::Galick) > 0 && t - d.t > 0.3 => {
                self.inp.charging = 2.5f64.min(t - d.t - 0.3);
            }
            None => self.inp.charging = 0.0,
            _ => {}
        }
    }

    /// A full charge, in seconds of rate: levels add, never compound.
    pub fn beam_pay(&self) -> Big {
        self.wrate() * 4.0 * Self::beam_x_at(self.s.lvf(Upg::Galick)) * (1.0 + 0.25 * self.lvl(N_BEAM))
    }

    /// Kaioken times the great ape, on beam and big bang damage (never on what they pay).
    pub fn atk_buff(&self) -> f64 {
        let t = self.t;
        (if self.b.kaio_until > t { self.kaio_x() } else { 1.0 }) * (if self.b.ape_until > t { 1.0 + self.ape_x() } else { 1.0 })
    }

    /// On a universe's wall a buff adds at most up to a quarter of it a hit, like a spirit bomb.
    fn wall_cap(&self, d: Big, bare: Big) -> Big {
        let b = self.tl.boss.as_ref().unwrap();
        if b.uni {
            bare.max(d.min(b.max * 0.25 / (1.0 + 0.5 * self.s.lvf(Upg::Armor))))
        } else {
            d
        }
    }

    /// `fireBeam(c, tx, ty)`: a beam of charge `c` toward (tx, ty) hits whatever is on its line, and pays.
    pub fn fire_beam(&mut self, c: f64, tx: f64, ty: f64) {
        if self.s.world == 3 || self.intro_skip() || self.skipping() {
            return;
        }
        let t = self.t;
        if let Some(bz) = self.tl.bz.as_mut().filter(|b| b.awake == 0.0) {
            bz.noise += 0.35;
        }
        if let Some(a) = self.tl.a16.as_mut().filter(|a| t < a.until - 1.0) {
            a.until = t + 1.0;
            self.event("16: \"please… the birds.\" he walks off");
        }
        if let Some(s) = self.tl.struggle.as_mut() {
            s.p += 0.12 * c;
            return;
        }
        if self.cg_push(Some(c)) {
            self.inp.beam = None;
            self.cue(crate::hud::Cue::Sfx("beam"));
            return;
        }
        let mut tx = tx;
        if self.tl.movie.as_ref().is_some_and(|m| m.flip_until > t) {
            tx = self.cam.w - tx;
        }
        let (kx, ky) = self.hand_pos();
        let kd = self.kid_screen(0.0);
        let (mut dx, mut dy) = (tx - kx, ty - ky);
        let mut dl = hypot(&[dx, dy]);
        if dl < 4.0 {
            dx = sin(kd.ang);
            dy = -cos(kd.ang);
            dl = 1.0;
        }
        let dir = [dx / dl, dy / dl];
        self.inp.beam = Some(Beam {
            t0: t,
            c,
            x: kx,
            y: ky,
            dx: dir[0],
            dy: dir[1],
            z: kd.v[2] * (self.cam.r + 12.0),
            ff: false,
            full: false,
            kaio: self.b.kaio_until > t,
            ape: self.b.ape_until > t,
        });
        self.inp.beam_hits.clear();
        self.cue(crate::hud::Cue::Sfx("beam"));
        self.shake = self.shake.max(0.2 + c * 0.15);
        let ff = self.s.lv(Upg::Galick) >= 5 && c >= 2.4;
        let band = self.beam_band(c, ff);
        // it pierces: everything within `w` (the target's own half-size) plus the beam's band of its line is hit
        let on_line = |x: f64, y: f64, w: f64| {
            let (rx, ry) = (x - kx, y - ky);
            rx * dir[0] + ry * dir[1] > 0.0 && (rx * dir[1] - ry * dir[0]).abs() < w + band
        };
        if let Some(s) = self.tl.star.as_ref() {
            if on_line(s.x, s.y, 8.0) {
                let (sx, sy) = (s.x, s.y);
                self.inp.beam_hits.push((sx, sy));
                self.click(sx, sy);
            }
        }
        if c >= 2.4 {
            self.goal("beam", 1.0, false);
            self.strain_beam();
        }
        if let Some(b) = self.inp.beam.as_mut() {
            b.ff = ff;
            b.full = c >= 2.4;
        }
        if ff {
            self.ach("flash");
        }
        let pts = self.beam_pay() * c / 2.5 * if ff { 1.25 } else { 1.0 };
        let dmg = pts * self.atk_buff();
        for i in 0..self.tl.saibas.len() {
            let sb = &self.tl.saibas[i];
            if let Some((x, y)) = sb.sx.filter(|&(x, y)| !sb.dead && on_line(x, y - 6.0, 7.0)) {
                self.inp.beam_hits.push((x, y - 6.0));
                self.kill_saiba(i);
            }
        }
        if self.tl.ginyu.as_ref().is_some_and(|g| g.done == 0.0) {
            for mi in 0..self.tl.ginyu.as_ref().unwrap().members.len() {
                let m = &self.tl.ginyu.as_ref().unwrap().members[mi];
                let (x, y) = (m.x, m.y - m.spr.h / 2.0 * m.k);
                if !m.dead && on_line(x, y, m.spr.w / 2.0 * m.k) {
                    self.inp.beam_hits.push((x, y));
                    self.ginyu_hit(mi, dmg * 2.0);
                }
            }
        }
        if self.tl.movie.as_ref().is_some_and(|m| m.over == 0.0) {
            if self.tl.movie.as_ref().unwrap().web.is_some() {
                self.break_web("your beam burns through the psychic web");
            }
            for i in 0..self.tl.movie.as_ref().unwrap().minions.len() {
                let h = &self.tl.movie.as_ref().unwrap().minions[i];
                let y = h.y - h.spr.h / 2.0 * h.k;
                if let Some(x) = h.x.filter(|&x| !h.dead && on_line(x, y, h.spr.w / 2.0 * h.k)) {
                    self.inp.beam_hits.push((x, y));
                    self.movie_hit(i, dmg * 2.0);
                }
            }
            let cs = self.tl.movie.as_ref().unwrap().metal.as_ref().map_or(vec![], |m| m.clones.clone());
            let d = crate::data::movie_dim("cooler");
            for (i, cl) in cs.iter().enumerate() {
                let y = cl.y - d.h / 2.0 * cl.k;
                if let Some(x) = cl.x.filter(|&x| !cl.dead() && on_line(x, y, d.w / 2.0 * cl.k)) {
                    self.inp.beam_hits.push((x, y));
                    self.clone_hit(i, dmg * 2.0);
                }
            }
        }
        if let Some(b) = self.tl.boss.as_ref().filter(|b| !b.dead) {
            let s = b.spr();
            if on_line(b.x, b.y - s.h / 2.0 * b.k, s.w / 2.0 * b.k) {
                let (bx, by) = (b.x, b.y - s.h / 2.0 * b.k);
                self.inp.beam_hits.push((bx, by));
                // jiren bats a weak one back; a full one breaks through for more
                if let Some(x) = self.mech_beam(c) {
                    let d = self.wall_cap(dmg * 4.0 * x, pts * 4.0 * x);
                    self.hit_boss(d, bx, by, c >= crate::mech::B_BIG);
                    let b = self.tl.boss.as_ref().unwrap();
                    let (bx, by) = (b.x, b.y - b.spr().h * b.k);
                    self.buff_pop(d, bx, by);
                }
            }
        }
        self.gain_at(pts, kx, ky - 16.0, true);
        self.hero_beam(c, kx, ky - 26.0);
        self.cue(crate::hud::Cue::Fx("buy"));
        for i in 0..self.tl.meteors.len() {
            let m = &self.tl.meteors[i];
            if m.dead || m.delay > 0.0 {
                continue;
            }
            if on_line(m.x, m.y, 6.0) {
                let (mx, my) = (m.x, m.y);
                self.inp.beam_hits.push((mx, my));
                self.tl.meteors[i].dead = true;
                self.goal("meteor", 1.0, false);
                let n = self.meteor_pay();
                self.gain_at(n, mx, my - 6.0, true);
                self.burst_at(mx, my, &[0xffffff, 0xffb35a, 0xe0473e, 0x6c6f7c], 16, 110.0);
            }
        }
        if let Some(g) = self.tl.gero.as_ref().filter(|g| on_line(g.x, g.y - g.spr.h / 2.0, g.spr.w / 2.0)) {
            self.inp.beam_hits.push((g.x, g.y - g.spr.h / 2.0));
            self.free_gero();
        }
        if c >= 2.4 {
            // the wave lands on what it hit nearest where you aimed, or where you aimed
            let near = |&(x, y): &(f64, f64)| hypot(&[x - tx, y - ty]);
            let (wx, wy) = self.inp.beam_hits.iter().copied().min_by(|a, b| near(a).total_cmp(&near(b))).unwrap_or((tx, ty));
            self.wave(wx, wy, crate::waves::BEAM_REACH);
        }
    }

    /// How far off its line a beam of charge `c` reaches past a target's own half-size: wider with the charge, twice
    /// as wide as a final flash, +15% a galick level.
    pub fn beam_band(&self, c: f64, ff: bool) -> f64 {
        c * 3.0 * if ff { 2.0 } else { 1.0 } * (1.0 + 0.15 * (self.s.lvf(Upg::Galick) - 1.0))
    }

    /// `throwBang(x, y)`: the ki ball leaves his hand; it explodes when it lands (see `bang_step`).
    pub fn throw_bang(&mut self, x: f64, y: f64) {
        let (hx, hy) = self.hand_pos();
        self.inp.bang_ready = self.t + 2.5;
        self.inp.bang = Some(Bang { x0: hx, y0: hy, x1: x, y1: y, t0: self.t, dur: 0.38 });
    }

    /// What game.js does to the game while it draws, after the frame's logic: the big bang lands, a great ape's
    /// stomp shakes the screen (and a full beam charge, while the renderer sees the hero), the capsule a boss drops
    /// falls and opens itself after 8s. None of it on snake way, where
    /// game.js draws the road instead. `dt` is the frame's (time-chamber) step.
    pub(crate) fn draw_step(&mut self, t: f64, dt: f64) {
        self.inp.stomp = false;
        self.inp.blasts.retain(|b| (t - b.t0) / 0.45 <= 1.0);
        self.waves_step(t);
        if self.s.world == 3 && self.tl.snk.is_some() {
            return;
        }
        if let Some(b) = self.inp.bang {
            if 1f64.min((t - b.t0) / b.dur) >= 1.0 {
                self.explode(b.x1, b.y1);
                self.inp.bang = None;
            }
        }
        if self.b.ape_until > t && (t * 3.2).floor() != self.inp.ape_step {
            self.inp.ape_step = (t * 3.2).floor();
            self.inp.stomp = true;
            self.shake = self.shake.max(0.35);
        }
        if self.inp.charging >= 2.4 && self.hero_seen && !self.drawn_here {
            self.shake = self.shake.max(0.06);
        }
        if let Some(c) = self.tl.capsule.as_mut() {
            if c.y < c.land {
                c.vy += 160.0 * dt;
                c.y = c.land.min(c.y + c.vy * dt);
            } else {
                c.y = c.land + crate::jsmath::sin((t - c.t0) * 4.0) * 1.5;
            }
            if t - c.t0 > 8.0 {
                self.open_capsule();
            }
        }
    }

    /// `explode(x, y)`: a blast that pays a bit more than a full beam, plus whatever it hits.
    fn explode(&mut self, x: f64, y: f64) {
        self.cue(crate::hud::Cue::Sfx("boom"));
        self.cg_push(None);
        self.strain_bang();
        let bb = self.s.lvf(Upg::Bigbang);
        let r = 18.0 * (1.0 + 0.25 * (bb - 1.0)) * 1f64.max(self.cam.r / 50.0);
        self.inp.blasts.push(Blast { x, y, r: r * if self.b.ape_until > self.t { 1.6 } else { 1.0 }, t0: self.t, kaio: self.b.kaio_until > self.t });
        self.shake = self.shake.max(0.45);
        self.wave(x, y, 0.0);
        let n = self.beam_pay() * Self::bang_x_at(bb);
        self.gain_at(n, x, y - 10.0, true);
        for i in 0..self.tl.saibas.len() {
            let sb = &self.tl.saibas[i];
            if !sb.dead && sb.sx.is_some_and(|(sx, sy)| hypot(&[sx - x, sy - 6.0 - y]) < r + 6.0) {
                self.kill_saiba(i);
            }
        }
        for i in 0..self.tl.meteors.len() {
            let m = &self.tl.meteors[i];
            if !m.dead && m.delay <= 0.0 && hypot(&[m.x - x, m.y - y]) < r + 4.0 {
                let (mx, my) = (m.x, m.y);
                self.tl.meteors[i].dead = true;
                self.goal("meteor", 1.0, false);
                let n = self.meteor_pay();
                self.gain_at(n, mx, my - 6.0, true);
            }
        }
        // rate() already adds kaioken and the ape; the bare hit times atk_buff lets them stack as on a beam
        let hit = |g: &Game| g.rate().max(g.lap_value() * g.mult(false)).max(g.wrate().max(g.lap_value() * g.mult(true)) * g.atk_buff());
        if self.tl.ginyu.as_ref().is_some_and(|g| g.done == 0.0) {
            for mi in 0..self.tl.ginyu.as_ref().unwrap().members.len() {
                let m = &self.tl.ginyu.as_ref().unwrap().members[mi];
                if !m.dead && hypot(&[m.x - x, m.y - m.spr.h / 2.0 * m.k - y]) < r + 6.0 {
                    let dmg = hit(self) * 8.0 * bb;
                    self.ginyu_hit(mi, dmg);
                }
            }
        }
        if self.tl.movie.as_ref().is_some_and(|m| m.over == 0.0) {
            let dmg = hit(self) * 8.0 * bb;
            for i in 0..self.tl.movie.as_ref().unwrap().minions.len() {
                let h = &self.tl.movie.as_ref().unwrap().minions[i];
                if !h.dead && h.x.is_some_and(|hx| hypot(&[hx - x, h.y - h.spr.h / 2.0 * h.k - y]) < r + 6.0) {
                    self.movie_hit(i, dmg);
                }
            }
            let cs = self.tl.movie.as_ref().unwrap().metal.as_ref().map_or(vec![], |m| m.clones.clone());
            let d = crate::data::movie_dim("cooler");
            for (i, cl) in cs.iter().enumerate() {
                if !cl.dead() && cl.x.is_some_and(|cx| hypot(&[cx - x, cl.y - d.h / 2.0 * cl.k - y]) < r + 6.0) {
                    self.clone_hit(i, dmg);
                }
            }
        }
        if let Some(b) = self.tl.boss.as_ref().filter(|b| !b.dead) {
            let s = b.spr();
            if hypot(&[b.x - x, b.y - s.h / 2.0 * b.k - y]) < r + s.w / 2.0 * b.k {
                let mx = self.mech_bang();
                let dmg = self.wall_cap(hit(self) * 12.0 * bb, self.rate().max(self.lap_value() * self.mult(false)) * 12.0 * bb) * mx;
                self.hit_boss(dmg, x, y, true);
                self.buff_pop(dmg, x, y - 10.0);
            }
        }
        if let Some(s) = self.tl.star.as_ref() {
            if hypot(&[s.x - x, s.y - y]) < r {
                let (sx, sy) = (s.x, s.y);
                self.click(sx, sy);
            }
        }
        self.burst_at(x, y, &[0xffffff, 0xbfe9ff, 0x6fb0ff, 0x2f6ae0], 36, 220.0);
    }

    /// The idle turn and a drag's inertia, both paused while a press is down.
    pub(crate) fn spin(&mut self, dt: f64) {
        self.inp.idle_t += dt;
        if self.inp.drag.is_none() {
            let i = &mut self.inp;
            if i.vrx.abs() + i.vry.abs() > 0.001 {
                self.cam.turn(i.vrx * dt, i.vry * dt);
                i.vrx *= crate::jsmath::pow(0.06, dt);
                i.vry *= crate::jsmath::pow(0.06, dt);
            }
            self.cam.spin(dt);
            // the lookout sits on korin's tower, so it only ever turns round its own axis
            if self.w2_pole() {
                if self.inp.vry.abs() > 0.001 {
                    self.inp.yaw += self.inp.vry * dt;
                }
                self.inp.yaw += crate::geom::AUTO_SPIN * dt;
                self.cam.m = self.lookout_m();
            }
        }
    }

    fn w2_pole(&self) -> bool {
        self.inp.w2_pole
    }

    /// The lookout's view: turned `yaw` round its pole, which stands up on screen tipped 25° toward us, so the tiles
    /// are seen from a little above with korin's tower straight below.
    fn lookout_m(&self) -> crate::geom::M3 {
        let n = self.frame3.n;
        let tip = crate::jsmath::atan2(n[1], n[2]) - 65f64.to_radians();
        crate::geom::m_mul(&crate::geom::rx(tip), &crate::geom::rot(n, self.inp.yaw))
    }
}
