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
    sent_world: Option<u32>,
}

impl Bridge {
    /// A new game on a `w`×`h` buffer at `scale` CSS pixels a buffer pixel, its randomness seeded with `seed`.
    pub fn new(seed: u32, w: f64, h: f64, scale: f64) -> Self {
        let mut game = Game::new(seed);
        game.resize(w, h, scale);
        Bridge { game, t: 0.0, bank: 0.0, sent_hud: None, sent_shop: String::new(), sent_world: None }
    }

    /// Reads the stored save (`localStorage['hs-power']`): a new visit keeps its daily bonus date.
    pub fn load(&mut self, saved: &str) {
        self.game.load_json(saved);
    }

    /// prefers-reduced-motion (page.html's `st.calm`): no screen shake. Set it before stepping, as game.js reads it every frame.
    pub fn set_calm(&mut self, calm: bool) {
        self.game.calm = calm;
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
        let n = self.step_drawn(elapsed, now_ms, &mut |_, _| {});
        self.game.fx.clear(); // undrawn, nothing ages the particles out
        n
    }

    /// `step`, with `draw` run in every step where game.js draws (see `step_one_drawn`).
    pub fn step_drawn(&mut self, elapsed: f64, now_ms: f64, draw: &mut dyn FnMut(&mut crate::Game, f64)) -> u32 {
        self.clock(now_ms);
        self.bank += elapsed;
        let mut n = 0;
        while self.bank >= DT && n < 8 {
            self.bank -= DT;
            self.step_one_drawn(draw);
            n += 1;
        }
        if n == 8 {
            self.bank = 0.0;
        }
        n
    }

    /// Exactly one fixed step; returns the new time (a renderer stepping in lockstep runs its own frame at it).
    pub fn step_one(&mut self) -> f64 {
        let t = self.step_one_drawn(&mut |_, _| {});
        self.game.fx.clear(); // undrawn, nothing ages the particles out
        t
    }

    /// One fixed step with `draw` run where game.js draws: after the frame's logic, before the timeouts due.
    pub fn step_one_drawn(&mut self, draw: &mut dyn FnMut(&mut crate::Game, f64)) -> f64 {
        self.t += DT;
        self.game.sim(self.t, DT);
        draw(&mut self.game, DT);
        self.game.timeouts();
        self.t
    }

    /// What the HUD needs since the last call, as `{hud?, shop?, world?, events, cues}`:
    /// - `hud`: `ui.update`'s argument (plus `night`, `world`, `shen`, `look`), when anything on it changed
    /// - `shop`: `ui.shop`'s last argument (`Game::shop`, the copy the difftest checks), when a row changed
    /// - `world`: the world, when it changed (the page's `ui.hell(false)` and `ui.world(w)`)
    /// - `events`: `[[text, ms], ...]` for `ui.event`; `cues`: `[[call, arg?], ...]` for the other `ui` calls, the
    ///   dragon's offer (`wish`) and instant transmission's picker (`itxPick`) among them
    ///
    /// The HUD only comes while playing, as game.js only calls `ui.update` then.
    pub fn frame_json(&mut self) -> String {
        let g = &mut self.game;
        let mut o = Obj::new();
        if g.playing && self.sent_hud.as_ref() != Some(&g.hud) {
            o = o.raw("hud", g.hud.to_json());
            self.sent_hud = Some(g.hud.clone());
        }
        if g.shop != self.sent_shop {
            o = o.raw("shop", &g.shop);
            self.sent_shop.clone_from(&g.shop);
        }
        if self.sent_world != Some(g.s.world) {
            o = o.num("world", g.s.world as f64);
            self.sent_world = Some(g.s.world);
        }
        o.raw("events", g.take_events_json()).raw("cues", g.take_cues_json()).end()
    }

    /// Forces the next `frame_json` to carry the whole HUD and shop, and the dragon's offer while it waits (a page that
    /// just (re)built its DOM).
    pub fn resend(&mut self) {
        self.sent_hud = None;
        self.sent_shop.clear();
        self.sent_world = None;
        if let Some((_, list)) = self.game.wish_offer() {
            self.game.cue(crate::hud::Cue::Wish(list));
        }
    }

    /// A probe for a renderer running in lockstep: `{t, pl, draws, mult, passive}`.
    pub fn probe_json(&self) -> String {
        let g = &self.game;
        Obj::new().num("t", self.t).num("pl", g.s.pl).num("draws", g.rng.draws() as f64).num("mult", g.mult(false)).num("passive", g.passive()).end()
    }

    /// Applies a renderer's screen spots (`spots.rs`); ignores anything `json::parse` refuses.
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

    #[test]
    fn the_first_frame_shows_the_goal() {
        let mut b = Bridge::new(1, 200.0, 134.0, 3.0);
        b.start("Wed Oct 28 2026", 1.7e12);
        let first = b.frame_json();
        assert!(first.contains(r#""goal":{"text":"hit a ×2 combo","p":0,"n":1}"#), "{first}");
        assert!(first.contains(r#""form":{"name":"base""#), "{first}");
    }

    #[test]
    fn the_shop_sent_is_the_one_built_with_the_hud() {
        let mut b = Bridge::new(1, 200.0, 134.0, 3.0);
        b.start("Wed Oct 28 2026", 1.7e12);
        b.game.s.pl = 1e6;
        b.step_one();
        let m: String = b.frame_json();
        assert!(m.contains(&format!(r#""shop":{}"#, b.game.shop)), "{m}");
        // what changes after the HUD point (drawing, timeouts) waits for the next syncShop, as in game.js: the frame
        // ships the shop the difftest compared, not a second copy built later
        b.game.s.pl = 0.0;
        let m = b.frame_json();
        assert!(!m.contains("\"shop\""), "{m}");
    }

    #[test]
    fn hostile_text_is_ignored() {
        let mut b = Bridge::new(1, 200.0, 134.0, 3.0);
        for bad in ["[".repeat(100_000), "{\"a\":".repeat(100_000), r#"{"lift":1e999}"#.into()] {
            b.load(&bad);
            b.spots(&bad);
        }
        b.load(&format!(r#"{{"daily":"Tue Oct 27 2026","pad":"{}"}}"#, "x".repeat(json::MAX_LEN)));
        b.spots(&format!(r#"{{"lift":7,"pad":"{}"}}"#, "x".repeat(json::MAX_LEN)));
        assert_eq!(b.game.s.daily, None);
        assert_eq!(b.game.lift_now, 0.0);
        b.spots(r#"{"lift":7}"#);
        assert_eq!(b.game.lift_now, 7.0);
    }

    #[test]
    fn calm_skips_the_shake_and_its_draw() {
        let run = |calm: bool| {
            let mut b = Bridge::new(1, 200.0, 134.0, 3.0);
            b.set_calm(calm);
            b.start("Wed Oct 28 2026", 1.7e12);
            b.game.shake = 1.0;
            b.step_one();
            (b.game.cam.bob, b.game.rng.draws())
        };
        let (shaken, d) = (run(false), run(true));
        assert_eq!(d, (0.0, shaken.1 - 1));
    }
}
