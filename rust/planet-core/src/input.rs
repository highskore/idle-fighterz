//! Pointer and keyboard input: game.js's canvas listeners and what they call. A press that barely moves is a tap (two
//! close together throw a big bang), a drag spins the planet with inertia, a held press charges a beam, and on snake
//! way the press itself acts. Coordinates come in twice: CSS pixels (`clientX`/`clientY`, which the drag turns by) and
//! the buffer pixels game.js's `st.toBuf` maps them to (which everything on the planet is hit-tested in).

use crate::data::{Upg, N_BEAM};
use crate::game::Game;
use crate::jsmath::{cos, hypot, log, sin};

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
    /// the pointer, and where it went down in buffer pixels (a second finger landing with it is a two-finger tap)
    pub id: i32,
    pub bx: f64,
    pub by: f64,
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
    pub bang: Option<Bang>,
    pub bang_ready: f64,
    /// the last tap's time and spot, for double-tap detection (`t` is -9 once a pair has fired)
    pub last_tap: (f64, f64, f64),
    pub blasts: Vec<Blast>,
    /// the great ape's step (`floor(t·3.2)`): each new one stomps
    pub ape_step: f64,
}

impl Default for Input {
    fn default() -> Self {
        Input {
            drag: None,
            vrx: 0.0,
            vry: 0.0,
            idle_t: 99.0,
            yaw: 0.0,
            w2_pole: false,
            charging: 0.0,
            beam: None,
            bang: None,
            bang_ready: 0.0,
            last_tap: (-9.0, 0.0, 0.0),
            blasts: Vec::new(),
            ape_step: 0.0,
        }
    }
}

impl Game {
    /// `pointerdown`: (x, y) in CSS pixels, (bx, by) in buffer pixels, the browser's `pointerId` and `button`. A
    /// right-click, or a second finger landing with the first, is instant transmission.
    pub fn pointer_down(&mut self, x: f64, y: f64, bx: f64, by: f64, id: i32, button: i32) {
        if self.playing && self.s.world == 3 && self.tl.snk.is_some() {
            self.snake_tap(bx, by);
            return;
        }
        if button == 2 {
            self.blink(bx, by);
            return;
        }
        if let Some(d) = self.inp.drag.filter(|d| d.id != id && self.s.lv(Upg::Itx) > 0 && self.t - d.t < 0.4 && d.moved <= 6.0) {
            self.blink((d.bx + bx) / 2.0, (d.by + by) / 2.0);
            self.inp.drag = None;
            self.inp.charging = 0.0;
            return;
        }
        self.inp.drag = Some(Drag { x, y, moved: 0.0, t: self.t, ax: bx, ay: by, id, bx, by });
    }

    /// `pointermove`: aims a charging beam, or spins the planet once the press has moved past 6px.
    pub fn pointer_move(&mut self, x: f64, y: f64, bx: f64, by: f64) {
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
                self.cam.m = crate::geom::rot(self.frame3.n, self.inp.yaw);
            } else {
                self.cam.turn(dy * k, dx * k);
            }
            self.inp.idle_t = 0.0;
        }
    }

    /// `pointerup` at (bx, by): fires a charged beam, or taps if the press didn't move.
    pub fn pointer_up(&mut self, bx: f64, by: f64) {
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
        let t = self.t;
        let (lt, lx, ly) = self.inp.last_tap;
        let dbl = t - lt < 0.32 && hypot(&[px - lx, py - ly]) < 30.0;
        self.inp.last_tap = (if dbl { -9.0 } else { t }, px, py);
        if dbl && self.playing && self.s.lv(Upg::Bigbang) > 0 && self.inp.bang.is_none() && t > self.inp.bang_ready {
            self.throw_bang(px, py);
            return;
        }
        self.click(px, py);
    }

    /// The beam's charge, once a frame (`frame()` between the moon and the senzu bean).
    pub(crate) fn charge(&mut self, t: f64) {
        match self.inp.drag {
            Some(d) if (d.moved <= 6.0 || self.inp.charging > 0.0) && self.s.lv(Upg::Galick) > 0 && t - d.t > 0.3 => {
                self.inp.charging = 2.5f64.min(t - d.t - 0.3);
            }
            None => self.inp.charging = 0.0,
            _ => {}
        }
    }

    /// A full charge, in seconds of rate: levels add a little, never compound.
    pub fn beam_pay(&self) -> f64 {
        self.wrate() * 4.0 * (1.0 + 0.25 * log(1f64.max(self.s.lvf(Upg::Galick)))) * (1.0 + 0.25 * self.lvl(N_BEAM))
    }

    /// Kaioken times the great ape, on beam and big bang damage (never on what they pay).
    pub fn atk_buff(&self) -> f64 {
        let t = self.t;
        (if self.b.kaio_until > t { self.kaio_x() } else { 1.0 }) * (if self.b.ape_until > t { 1.0 + self.ape_x() } else { 1.0 })
    }

    /// On a universe's wall a buff adds at most up to a quarter of it a hit, like a spirit bomb.
    fn wall_cap(&self, d: f64, bare: f64) -> f64 {
        let b = self.tl.boss.as_ref().unwrap();
        if b.uni {
            bare.max(d.min(b.max * 0.25 / (1.0 + 0.5 * self.s.lvf(Upg::Armor))))
        } else {
            d
        }
    }

    /// `fireBeam(c, tx, ty)`: a beam of charge `c` toward (tx, ty) hits whatever is on its line, and pays.
    pub fn fire_beam(&mut self, c: f64, tx: f64, ty: f64) {
        if self.s.world == 3 {
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
        self.cue(crate::hud::Cue::Sfx("beam"));
        self.shake = self.shake.max(0.2 + c * 0.15);
        if let Some(s) = self.tl.star.as_ref() {
            let (rx, ry) = (s.x - kx, s.y - ky);
            if rx * dir[0] + ry * dir[1] > 0.0 && (rx * dir[1] - ry * dir[0]).abs() < 8.0 + c * 3.0 {
                let (sx, sy) = (s.x, s.y);
                self.click(sx, sy);
            }
        }
        if c >= 2.4 {
            self.goal("beam", 1.0, false);
        }
        let ff = self.s.lv(Upg::Galick) >= 5 && c >= 2.4;
        if let Some(b) = self.inp.beam.as_mut() {
            b.ff = ff;
            b.full = c >= 2.4;
        }
        if ff {
            self.ach("flash");
        }
        let pts = self.beam_pay() * c / 2.5 * if ff { 1.25 } else { 1.0 };
        let dmg = pts * self.atk_buff();
        let galick = self.s.lvf(Upg::Galick);
        let on_line = |x: f64, y: f64, w: f64| {
            let (rx, ry) = (x - kx, y - ky);
            rx * dir[0] + ry * dir[1] > 0.0 && (rx * dir[1] - ry * dir[0]).abs() < w + c * 3.0 * if ff { 2.0 } else { 1.0 } * (1.0 + 0.15 * (galick - 1.0))
        };
        for i in 0..self.tl.saibas.len() {
            let sb = &self.tl.saibas[i];
            if !sb.dead && sb.sx.is_some_and(|(x, y)| on_line(x, y - 6.0, 7.0)) {
                self.kill_saiba(i);
            }
        }
        if self.tl.ginyu.as_ref().is_some_and(|g| g.done == 0.0) {
            for mi in 0..self.tl.ginyu.as_ref().unwrap().members.len() {
                let m = &self.tl.ginyu.as_ref().unwrap().members[mi];
                if !m.dead && on_line(m.x, m.y - m.spr.h / 2.0 * m.k, m.spr.w / 2.0 * m.k) {
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
                if !h.dead && h.x.is_some_and(|x| on_line(x, h.y - h.spr.h / 2.0 * h.k, h.spr.w / 2.0 * h.k)) {
                    self.movie_hit(i, dmg * 2.0);
                }
            }
        }
        if let Some(b) = self.tl.boss.as_ref().filter(|b| !b.dead) {
            let s = b.spr();
            if on_line(b.x, b.y - s.h / 2.0 * b.k, s.w / 2.0 * b.k) {
                let d = self.wall_cap(dmg * 4.0, pts * 4.0);
                self.hit_boss(d);
            }
        }
        self.gain(pts);
        self.cue(crate::hud::Cue::Fx("buy"));
        for i in 0..self.tl.meteors.len() {
            let m = &self.tl.meteors[i];
            if m.dead || m.delay > 0.0 {
                continue;
            }
            let (rx, ry) = (m.x - kx, m.y - ky);
            let (along, off) = (rx * dir[0] + ry * dir[1], (rx * dir[1] - ry * dir[0]).abs());
            if along > 0.0 && off < 6.0 + c * 3.0 {
                self.tl.meteors[i].dead = true;
                self.goal("meteor", 1.0, false);
                let n = self.meteor_pay();
                self.gain(n);
            }
        }
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
        self.inp.blasts.retain(|b| (t - b.t0) / 0.45 <= 1.0);
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
            self.shake = self.shake.max(0.35);
        }
        if self.inp.charging >= 2.4 && self.hero_seen {
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
        let bb = self.s.lvf(Upg::Bigbang);
        let r = 18.0 * (1.0 + 0.25 * (bb - 1.0)) * 1f64.max(self.cam.r / 50.0);
        self.inp.blasts.push(Blast { x, y, r: r * if self.b.ape_until > self.t { 1.6 } else { 1.0 }, t0: self.t, kaio: self.b.kaio_until > self.t });
        self.shake = self.shake.max(0.45);
        let n = self.beam_pay() * (1.3 + 0.05 * bb.log2());
        self.gain(n);
        for i in 0..self.tl.saibas.len() {
            let sb = &self.tl.saibas[i];
            if !sb.dead && sb.sx.is_some_and(|(sx, sy)| hypot(&[sx - x, sy - 6.0 - y]) < r + 6.0) {
                self.kill_saiba(i);
            }
        }
        for i in 0..self.tl.meteors.len() {
            let m = &self.tl.meteors[i];
            if !m.dead && m.delay <= 0.0 && hypot(&[m.x - x, m.y - y]) < r + 4.0 {
                self.tl.meteors[i].dead = true;
                self.goal("meteor", 1.0, false);
                let n = self.meteor_pay();
                self.gain(n);
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
        }
        if let Some(b) = self.tl.boss.as_ref().filter(|b| !b.dead) {
            let s = b.spr();
            if hypot(&[b.x - x, b.y - s.h / 2.0 * b.k - y]) < r + s.w / 2.0 * b.k {
                let dmg = self.wall_cap(hit(self) * 12.0 * bb, self.rate().max(self.lap_value() * self.mult(false)) * 12.0 * bb);
                self.hit_boss(dmg);
            }
        }
        if let Some(s) = self.tl.star.as_ref() {
            if hypot(&[s.x - x, s.y - y]) < r {
                let (sx, sy) = (s.x, s.y);
                self.click(sx, sy);
            }
        }
        self.burst(36);
    }

    /// The idle turn and a drag's inertia, both paused while a press is down.
    pub(crate) fn spin(&mut self, dt: f64) {
        self.inp.idle_t += dt;
        if self.inp.drag.is_none() {
            let i = &mut self.inp;
            if i.vrx.abs() + i.vry.abs() > 0.001 {
                self.cam.turn(i.vrx * dt, i.vry * dt);
                i.vrx *= 0.06f64.powf(dt);
                i.vry *= 0.06f64.powf(dt);
            }
            self.cam.spin(dt);
            // the lookout sits on korin's tower, so it only ever turns round its own axis
            if self.w2_pole() {
                if self.inp.vry.abs() > 0.001 {
                    self.inp.yaw += self.inp.vry * dt;
                }
                self.inp.yaw += crate::geom::AUTO_SPIN * dt;
                self.cam.m = crate::geom::rot(self.frame3.n, self.inp.yaw);
            }
        }
    }

    fn w2_pole(&self) -> bool {
        self.inp.w2_pole
    }
}
