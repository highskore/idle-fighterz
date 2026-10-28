//! The HUD bridge: one owner of a running game that a page (wasm) or the native widget (Tauri IPC) drives with plain
//! calls and strings. Inputs go in as calls; what the HUD should show comes out of `frame_json` as a delta message
//! (only what changed since the last one), and the menus come back as JSON on request. rust/HUD.md documents it.

use crate::game::Game;
use crate::hud::Hud;
use crate::json::{self, Obj};
use crate::DT;

pub struct Bridge {
    pub game: Game,
    /// the fixed step's clock (the game's `t`)
    pub t: f64,
    bank: f64,
    sent_hud: Option<Hud>,
    sent_shop: String,
    sent_offer: f64,
    sent_world: Option<u32>,
}

impl Bridge {
    /// A new game on a `w`×`h` buffer at `scale` CSS pixels a buffer pixel, its randomness seeded with `seed`.
    pub fn new(seed: u32, w: f64, h: f64, scale: f64) -> Self {
        let mut game = Game::new(seed);
        game.resize(w, h, scale);
        Bridge { game, t: 0.0, bank: 0.0, sent_hud: None, sent_shop: String::new(), sent_offer: f64::NAN, sent_world: None }
    }

    /// Reads the stored save (`localStorage['hs-power']`): a new visit keeps its daily bonus date.
    pub fn load(&mut self, saved: &str) {
        self.game.load_json(saved);
    }

    /// Starts play on the day `today` (`new Date().toDateString()`); `now_ms` is `Date.now()`.
    pub fn start(&mut self, today: &str, now_ms: f64) {
        self.clock(now_ms);
        self.game.start_on(today);
    }

    /// Sets the wall clock (`Date.now()`) achievements are stamped with, for steps run with `step_one`.
    pub fn clock(&mut self, now_ms: f64) {
        self.game.epoch_ms = now_ms - (self.t * 1000.0).floor();
    }

    /// Runs the fixed steps `elapsed` real seconds cover (at most 8, so a stall can't snowball); returns how many.
    pub fn step(&mut self, elapsed: f64, now_ms: f64) -> u32 {
        self.clock(now_ms);
        self.bank += elapsed;
        let mut n = 0;
        while self.bank >= DT && n < 8 {
            self.bank -= DT;
            self.step_one();
            n += 1;
        }
        if n == 8 {
            self.bank = 0.0;
        }
        n
    }

    /// Exactly one fixed step; returns the new time (a renderer stepping in lockstep runs its own frame at it).
    pub fn step_one(&mut self) -> f64 {
        self.t += DT;
        self.game.frame(self.t, DT);
        self.t
    }

    /// What the HUD needs since the last call, as `{hud?, shop?, wish?, world?, events, cues}`:
    /// - `hud`: `ui.update`'s argument (plus `night`, `world`, `shen`, `look`), when anything on it changed
    /// - `shop`: `ui.shop`'s argument, when a row changed
    /// - `wish`: `ui.wish`'s list, when the dragon makes an offer
    /// - `world`: the world, when it changed (the page's `ui.hell(false)` and `ui.world(w)`)
    /// - `events`: `[[text, ms], ...]` for `ui.event`; `cues`: `[[call, arg?], ...]` for the other `ui` calls
    ///
    /// The HUD and the shop only come while playing, as game.js only sends them then.
    pub fn frame_json(&mut self) -> String {
        let g = &mut self.game;
        let mut o = Obj::new();
        if g.playing {
            if self.sent_hud.as_ref() != Some(&g.hud) {
                o = o.raw("hud", g.hud.to_json());
                self.sent_hud = Some(g.hud.clone());
            }
            let shop = g.shop_json();
            if shop != self.sent_shop {
                o = o.raw("shop", &shop);
                self.sent_shop = shop;
            }
        }
        match g.wish_offer() {
            Some((at, list)) if at != self.sent_offer => {
                o = o.raw("wish", list);
                self.sent_offer = at;
            }
            None => self.sent_offer = f64::NAN,
            _ => {}
        }
        if self.sent_world != Some(g.s.world) {
            o = o.num("world", g.s.world as f64);
            self.sent_world = Some(g.s.world);
        }
        o.raw("events", g.take_events_json()).raw("cues", g.take_cues_json()).end()
    }

    /// Forces the next `frame_json` to carry the whole HUD and shop (a page that just (re)built its DOM).
    pub fn resend(&mut self) {
        self.sent_hud = None;
        self.sent_shop.clear();
        self.sent_world = None;
        self.sent_offer = f64::NAN;
    }

    /// A probe for a renderer running in lockstep: `{t, pl, draws, mult, passive}`.
    pub fn probe_json(&self) -> String {
        let g = &self.game;
        Obj::new().num("t", self.t).num("pl", g.s.pl).num("draws", g.rng.draws() as f64).num("mult", g.mult(false)).num("passive", g.passive()).end()
    }

    /// Applies a renderer's screen spots (`spots.rs`); ignores anything that isn't JSON.
    pub fn spots(&mut self, s: &str) {
        if let Some(v) = json::parse(s) {
            self.game.set_spots(&v);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sends_what_changed() {
        let mut b = Bridge::new(1, 200.0, 134.0, 3.0);
        b.start("Wed Oct 28 2026", 1.7e12);
        b.step(1.0 / 30.0 + 1e-9, 1.7e12);
        let first = b.frame_json();
        assert!(first.contains("\"hud\":") && first.contains("\"shop\":") && first.contains("\"world\":0"));
        assert_eq!(b.frame_json(), r#"{"events":[],"cues":[]}"#);
        b.game.train();
        let tap = b.frame_json();
        assert!(tap.contains("[\"sfx\",\"tap\"]") && tap.contains("[\"bump\"]"), "{tap}");
        b.step(0.1, 1.7e12);
        assert!(b.frame_json().contains("\"hud\":"), "the tap's power shows on the next frame");
    }
}
