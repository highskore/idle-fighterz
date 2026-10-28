//! The hero's attacks: a charged beam (`fireBeam`) and the big bang's explosion (`explode`), in game.js order.
//! Drawing state (the beam, the blast ring, the damage pops) is left to the renderer.

use crate::data::*;
use crate::game::Game;
use crate::jsmath::{cos, hypot, log, sin};

impl Game {
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

    /// A full charge, in seconds of the bare rate.
    pub fn beam_pay(&self) -> f64 {
        self.wrate() * 4.0 * (1.0 + 0.25 * log(self.s.lvf(Upg::Galick).max(1.0))) * (1.0 + 0.25 * self.lvl(N_BEAM))
    }

    /// `fireBeam(c, tx, ty)`: a beam charged for `c` seconds toward (tx, ty).
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
        let tx = if self.tl.movie.as_ref().is_some_and(|m| m.flip_until > t) { self.cam.w - tx } else { tx };
        let (kx, ky) = self.hand_pos();
        let (mut dx, mut dy) = (tx - kx, ty - ky);
        let mut dl = hypot(&[dx, dy]);
        if dl < 4.0 {
            let ang = self.kid_screen(0.0).ang;
            dx = sin(ang);
            dy = -cos(ang);
            dl = 1.0;
        }
        let dir = [dx / dl, dy / dl];
        self.shake = self.shake.max(0.2 + c * 0.15);
        if let Some(s) = self.tl.star.clone() {
            let (rx, ry) = (s.x - kx, s.y - ky);
            if rx * dir[0] + ry * dir[1] > 0.0 && (rx * dir[1] - ry * dir[0]).abs() < 8.0 + c * 3.0 {
                self.click(s.x, s.y);
            }
        }
        if c >= 2.4 {
            self.goal("beam", 1.0, false);
        }
        let galick = self.s.lvf(Upg::Galick);
        let ff = galick >= 5.0 && c >= 2.4;
        if ff {
            self.ach("flash");
        }
        let pts = self.beam_pay() * c / 2.5 * (if ff { 1.25 } else { 1.0 });
        let dmg = pts * self.atk_buff();
        let on_line = |x: f64, y: f64, w: f64| {
            let (rx, ry) = (x - kx, y - ky);
            rx * dir[0] + ry * dir[1] > 0.0 && (rx * dir[1] - ry * dir[0]).abs() < w + c * 3.0 * (if ff { 2.0 } else { 1.0 }) * (1.0 + 0.15 * (galick - 1.0))
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

    /// `explode(x, y)`: the big bang lands. It pays a bit more than a full beam; what it hits takes damage on top.
    pub fn explode(&mut self, x: f64, y: f64) {
        let bb = self.s.lvf(Upg::Bigbang);
        let r = 18.0 * (1.0 + 0.25 * (bb - 1.0)) * 1f64.max(self.cam.r / 50.0);
        self.shake = self.shake.max(0.45);
        let pay = self.beam_pay() * (1.3 + 0.05 * bb.log2()); // std log2 is V8's for every integer below 1375
        self.gain(pay);
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
                    let d = hit(self) * 8.0 * bb;
                    self.ginyu_hit(mi, d);
                }
            }
        }
        if self.tl.movie.as_ref().is_some_and(|m| m.over == 0.0) {
            let d = hit(self) * 8.0 * bb;
            for i in 0..self.tl.movie.as_ref().unwrap().minions.len() {
                let h = &self.tl.movie.as_ref().unwrap().minions[i];
                if !h.dead && h.x.is_some_and(|hx| hypot(&[hx - x, h.y - h.spr.h / 2.0 * h.k - y]) < r + 6.0) {
                    self.movie_hit(i, d);
                }
            }
        }
        if let Some(b) = self.tl.boss.as_ref().filter(|b| !b.dead) {
            let s = b.spr();
            if hypot(&[b.x - x, b.y - s.h / 2.0 * b.k - y]) < r + s.w / 2.0 * b.k {
                let d = self.wall_cap(hit(self) * 12.0 * bb, self.rate().max(self.lap_value() * self.mult(false)) * 12.0 * bb);
                self.hit_boss(d);
            }
        }
        if let Some(s) = self.tl.star.clone() {
            if hypot(&[s.x - x, s.y - y]) < r {
                self.click(s.x, s.y);
            }
        }
        self.rng.skip(72);
    }
}
