//! planet-web: the WebAssembly build for highskore.com.
//!
//! `Planet` is the HUD bridge (planet-core's `Bridge`) exported with wasm-bindgen: page.html's JS shim
//! (`rust/planet-web/shim.js`) calls it from requestAnimationFrame and from the canvas's pointer events, and feeds
//! the HTML HUD from `frame()`. Every value crossing is a number, a bool or a JSON string, the same messages the native
//! widget sends over Tauri IPC (rust/HUD.md). `WebGame` is the framebuffer side stage 1 draws into.

use planet_core::bridge::Bridge;
use planet_core::hud::Hud;
use planet_core::{Clock, Game};
use planet_render::Framebuffer;
use wasm_bindgen::prelude::*;

/// The running game, as page.html's shim sees it.
#[wasm_bindgen]
pub struct Planet(Bridge, Option<Drawn>);

/// planet-render drawing the game into a framebuffer the page puts on its canvas (replacing the game.js twin).
struct Drawn {
    scene: planet_render::scene::Scene,
    fb: Framebuffer,
    view: planet_render::scene::View,
}

#[wasm_bindgen]
impl Planet {
    /// A game on a `w`×`h` buffer (`st.W`×`st.H`) at `scale` CSS pixels a buffer pixel.
    #[wasm_bindgen(constructor)]
    pub fn new(seed: u32, w: f64, h: f64, scale: f64) -> Planet {
        Planet(Bridge::new(seed, w, h, scale), None)
    }

    /// The stored save's text (`localStorage['hs-power']`); a new visit keeps its daily bonus date.
    pub fn load(&mut self, saved: &str) {
        self.0.load(saved);
    }

    /// prefers-reduced-motion (`st.calm`): no screen shake. Set it before the first step.
    pub fn set_calm(&mut self, calm: bool) {
        self.0.set_calm(calm);
    }

    /// The page's `data-cx`: where across the canvas the planet's centre sits (game.js's `layout()` reads it).
    pub fn set_cx(&mut self, fcx: f64) {
        let g = &mut self.0.game;
        g.cam.fcx = Some(fcx);
        g.cam.layout(g.s.world);
    }

    pub fn start(&mut self, today: &str, now_ms: f64) {
        self.0.start(today, now_ms);
    }

    /// Advances by real elapsed seconds in fixed steps; returns how many ran.
    pub fn step(&mut self, elapsed: f64, now_ms: f64) -> u32 {
        self.0.step(elapsed, now_ms)
    }

    /// The delta message for the HUD (see `Bridge::frame_json`).
    pub fn frame(&mut self) -> String {
        self.0.frame_json()
    }

    pub fn resend(&mut self) {
        self.0.resend();
    }

    pub fn resize(&mut self, w: f64, h: f64, scale: f64) {
        self.0.game.resize(w, h, scale);
        if let Some(d) = self.1.as_mut() {
            d.fb = Framebuffer::new(w as usize, h as usize);
            d.view.scale = scale;
        }
    }

    // ── input: (x, y) in CSS pixels (clientX/Y), (bx, by) in buffer pixels (st.toBuf), the pointerId, and for a
    // press its button and whether pointerType is touch

    #[allow(clippy::too_many_arguments)]
    pub fn pointer_down(&mut self, x: f64, y: f64, bx: f64, by: f64, id: i32, button: i32, touch: bool) {
        self.0.game.pointer_down(x, y, bx, by, id, button, touch);
    }

    pub fn pointer_move(&mut self, x: f64, y: f64, bx: f64, by: f64, id: i32) {
        self.0.game.pointer_move(x, y, bx, by, id);
    }

    pub fn pointer_up(&mut self, bx: f64, by: f64, id: i32) {
        self.0.game.pointer_up(bx, by, id);
    }

    pub fn pointer_cancel(&mut self) {
        self.0.game.pointer_cancel();
    }

    /// `e.key.toLowerCase()`; true when the game took it.
    pub fn key(&mut self, k: &str) -> bool {
        self.0.game.key(k)
    }

    pub fn train(&mut self) {
        self.0.game.train();
    }

    pub fn kaioken(&mut self) {
        self.0.game.kaioken();
    }

    // ── the HUD's buttons

    pub fn buy(&mut self, key: &str) -> bool {
        self.0.game.buy(key)
    }

    pub fn learn(&mut self, id: &str) {
        self.0.game.learn(id);
    }

    pub fn respec(&mut self) {
        self.0.game.respec();
    }

    pub fn learn_angel(&mut self, id: &str) {
        self.0.game.learn_angel(id);
    }

    pub fn auto_next(&mut self) {
        self.0.game.auto_next();
    }

    /// Instant transmission: the gesture or the button opens the picker (a `cues` entry), and a world from it jumps.
    pub fn itx(&mut self) {
        self.0.game.itx_open();
    }

    pub fn itx_jump(&mut self, w: u32) {
        self.0.game.itx_jump(w);
    }

    /// A wish from the dragon's offer.
    pub fn pick_wish(&mut self, key: &str) {
        self.0.game.pick(key);
    }

    pub fn pick_hero(&mut self, id: &str) -> bool {
        self.0.game.pick_hero(id)
    }

    // ── what the page asks for, as JSON

    pub fn menu(&self) -> String {
        self.0.game.menu_json()
    }

    pub fn angels(&self) -> String {
        self.0.game.angels_json()
    }

    pub fn ascend_info(&self) -> String {
        self.0.game.ascend_info_json()
    }

    pub fn god_info(&self) -> String {
        self.0.game.god_info_json()
    }

    pub fn zeno_info(&self) -> String {
        self.0.game.zeno_info_json()
    }

    pub fn card(&self) -> String {
        self.0.game.card_json()
    }

    /// What to store under `localStorage['hs-power']`.
    pub fn save(&self) -> String {
        self.0.game.save_json()
    }

    pub fn playing(&self) -> bool {
        self.0.game.playing
    }

    // ── drawing with planet-render

    /// Draw the game with planet-render from now on, into a buffer of the game's size. `widget` is the floating
    /// widget (no backdrop); `clouds` its cloud shape ('a'..'e', or empty) and `amount` (1-5). The drawing shares the
    /// game's random numbers, as game.js does.
    pub fn draw_with_rust(&mut self, widget: bool, clouds: &str, amount: f64) {
        let c = &self.0.game.cam;
        let (w, h, scale) = (c.w as usize, c.h as usize, c.scale);
        self.0.game.set_view(c.w, c.h, widget);
        let view = planet_render::scene::View { scale, bare: widget, clouds: clouds.chars().next(), cloud_amt: amount };
        self.1 = Some(Drawn { scene: planet_render::scene::Scene::new(), fb: Framebuffer::new(w, h), view });
    }

    /// game.js's preview hooks (`location.hash` on dev hosts), as `mount()` applies them: call it before `start`.
    pub fn preview(&mut self, hash: &str) {
        self.0.game.preview(hash);
    }

    /// `frame(t, dt)` as page.html calls it, drawn with planet-render (call `draw_with_rust` first); `pixels_ptr` then
    /// holds the frame.
    pub fn frame_drawn(&mut self, t: f64, dt: f64, now_ms: f64) {
        match self.1.as_mut() {
            Some(d) => self.0.frame_drawn(t, dt, now_ms, &mut |g, dt| d.scene.draw(&mut d.fb, g, &d.view, dt)),
            None => self.0.frame_drawn(t, dt, now_ms, &mut |_, _| {}),
        }
    }

    /// `step`, drawing every step with planet-render (call `draw_with_rust` first). Then `pixels_ptr` holds the frame.
    pub fn step_drawn(&mut self, elapsed: f64, now_ms: f64) -> u32 {
        let Some(d) = self.1.as_mut() else { return self.0.step(elapsed, now_ms) };
        self.0.step_drawn(elapsed, now_ms, &mut |g, dt| d.scene.draw(&mut d.fb, g, &d.view, dt))
    }

    /// Where the frame's RGBA bytes are in the module's memory (`w`×`h`×4 of them, as ImageData takes them, the widget's
    /// rim applied when it's bare), so the page puts them on the canvas without a copy; 0 before `draw_with_rust`.
    pub fn pixels_ptr(&mut self) -> *const u8 {
        let Some(d) = self.1.as_mut() else { return std::ptr::null() };
        if d.view.bare {
            planet_render::px::rim(&mut d.fb);
        }
        d.fb.rgba().as_ptr()
    }

    /// `[hero, form, fused]`: which sprite the share card shows (game.js's `card().spr`).
    pub fn look(&self) -> String {
        let g = &self.0.game;
        let hero = planet_core::data::CHARS.iter().find(|c| c.0 == g.s.hero).map_or("vegeta", |c| c.1);
        format!("[\"{hero}\",{},{}]", g.s.form, g.b.fuse_until > g.t)
    }
}

/// The game plus the framebuffer planet-render draws into (stage 1); not exported yet.
pub struct WebGame {
    pub game: Game,
    clock: Clock,
    pub fb: Framebuffer,
}

impl WebGame {
    pub fn new(seed: u32, w: usize, h: usize) -> Self {
        let mut game = Game::new(seed);
        game.start();
        WebGame { game, clock: Clock::default(), fb: Framebuffer::new(w, h) }
    }

    /// Advances the simulation by real elapsed seconds in fixed steps; returns how many ran.
    pub fn step(&mut self, elapsed: f64) -> u32 {
        self.clock.advance(&mut self.game, elapsed, 8)
    }

    pub fn tap(&mut self) {
        self.game.train();
    }

    pub fn buy(&mut self, key: &str) -> bool {
        self.game.buy(key)
    }

    pub fn pixels(&self) -> &[u8] {
        self.fb.rgba()
    }

    /// What `ui.update` gets (planet-core builds it once a frame while playing).
    pub fn hud(&self) -> &Hud {
        self.game.hud()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_second_of_play_earns_income() {
        let mut w = WebGame::new(1, 8, 8);
        assert_eq!(w.step(1.01), 8); // capped per call
        for _ in 0..12 {
            w.step(0.1);
        }
        assert!(w.hud().pl >= 1.0);
        assert_eq!(w.pixels().len(), 8 * 8 * 4);
    }

    #[test]
    fn the_bridge_round_trips_a_tap() {
        let mut p = Planet::new(7, 200.0, 134.0, 3.0);
        p.start("Wed Oct 28 2026", 1.7e12);
        p.step(0.05, 1.7e12);
        assert!(p.frame().contains("\"hud\":"));
        p.pointer_down(300.0, 200.0, 100.0, 66.0, 1, 0, false);
        p.pointer_up(100.0, 66.0, 1);
        assert!(p.frame().contains("[\"sfx\",\"tap\"]"));
        assert!(p.save().contains("\"daily\":\"Wed Oct 28 2026\""));
    }
}
