//! Shenron's summon as a storm over the whole page ("flash, then dusk"): the first strikes drop the page and sky to a
//! dim slate for about a second, then they settle into a lilac-grey page under a dusky violet sky while a pillar of
//! light goes up and his entry waits for it. This is its timeline and the page's colours, which the bridge sends as
//! `sky`; planet-render's `storm` draws the rest. Porunga keeps his own summon. Reduced motion: no lightning, flashes,
//! pillar or wait, only the colours.

use crate::json::Obj;
use crate::num::js_round;
use crate::timeline::Phase;
use crate::Game;

/// How long his entry waits for the pillar (none under reduced motion).
pub const DELAY: f64 = 0.9;
/// How strong the pillar gets: a soft cream glow, not a glare.
pub const PILLAR: f64 = 0.6;
/// When each bolt strikes, in seconds from the summon.
pub const STRIKES: [f64; 7] = [0.2, 0.75, 1.35, 2.3, 3.4, 4.6, 5.9];

/// Where the storm settles: page, sky top and bottom.
const PAGE: u32 = 0xd6d2e4;
const TOP: u32 = 0x3a3a6e;
const BOT: u32 = 0x9a7a9a;
/// The page as it is without him: white, the sky #fcfcfb.
const DAY_PAGE: u32 = 0xffffff;
const DAY_SKY: u32 = 0xfcfcfb;
/// What lightning lights the page and sky with.
const FLASH: u32 = 0xe6e2ff;

pub fn sm(x: f64) -> f64 {
    if x <= 0.0 {
        0.0
    } else if x >= 1.0 {
        1.0
    } else {
        x * x * (3.0 - 2.0 * x)
    }
}

pub fn c01(x: f64) -> f64 {
    x.clamp(0.0, 1.0)
}

/// `a` toward `b` by `k`, per channel.
pub fn mix(a: u32, b: u32, k: f64) -> u32 {
    let ch = |sh: u32| js_round(((a >> sh) & 255) as f64 + (((b >> sh) & 255) as f64 - ((a >> sh) & 255) as f64) * k) as u32;
    (ch(16) << 16) | (ch(8) << 8) | ch(0)
}

fn hex(c: u32) -> String {
    format!("#{c:06x}")
}

/// The storm at one moment of a summon.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Dusk {
    /// seconds since the summon
    pub age: f64,
    /// 1 while he's here, to 0 as he leaves
    pub out: f64,
    pub calm: bool,
}

impl Dusk {
    /// How far into the dusk look.
    pub fn k(&self) -> f64 {
        sm(self.age / 0.5) * self.out
    }

    /// The dim slate the first strikes drop everything to.
    pub fn dark(&self) -> f64 {
        if self.calm {
            return 0.0;
        }
        sm((self.age - 0.15) / 0.08) * (1.0 - sm((self.age - 0.5) / 0.8)) * self.out
    }

    /// Whether bolt `i` shows now: 0.24s each, with a flicker off in the middle.
    pub fn strike(&self, i: usize) -> bool {
        let d = self.age - STRIKES[i];
        !self.calm && !(d < 0.0 || d > 0.24 || (d > 0.07 && d < 0.12))
    }

    /// Whether a bolt lights the page.
    pub fn lit(&self) -> bool {
        (0..STRIKES.len()).any(|i| self.strike(i)) && self.out > 0.5
    }

    /// How far up the pillar has grown.
    pub fn rise(&self) -> f64 {
        sm((self.age - 0.2) / 0.4)
    }

    /// The pillar's strength: up first, fading once he's out.
    pub fn pillar(&self) -> f64 {
        if self.calm {
            return 0.0;
        }
        self.rise() * c01(1.0 - (self.age - 2.6) / 1.4) * self.out
    }

    /// The page's background, the sky's top and bottom, and the footer's opacity.
    pub fn page(&self) -> (u32, u32, u32, f64) {
        let (k, dk) = (self.k(), self.dark());
        let f = if self.lit() { 0.32 * (1.0 - dk * 0.8) } else { 0.0 };
        let pg = mix(mix(mix(DAY_PAGE, PAGE, k), 0x14122a, dk), FLASH, f * 0.4);
        let top = mix(mix(mix(DAY_SKY, TOP, k), 0x0c0a1c, dk), FLASH, f);
        let bot = mix(mix(mix(DAY_SKY, BOT, k), 0x1a1630, dk), FLASH, f * 0.7);
        (pg, top, bot, 1.0 - 0.2 * k)
    }

    /// The bridge's `sky` message: the page's colours, and the pillar above the card (its strength `pil`, centre `x` and
    /// width `w` in buffer pixels) for a canvas whose planet is at `cx` with radius `r`.
    pub fn to_json(&self, cx: f64, r: f64) -> String {
        let (pg, top, bot, foot) = self.page();
        let round = |v: f64| js_round(v * 1000.0) / 1000.0;
        Obj::new()
            .str("page", &hex(pg))
            .str("top", &hex(top))
            .str("bot", &hex(bot))
            .num("foot", round(foot))
            .num("pil", round(self.pillar() * PILLAR * 0.85))
            .num("x", round(cx))
            .num("w", round(r * 0.2 * 2.0 * 1.2))
            .end()
    }
}

impl Game {
    /// The storm while shenron is out (not porunga).
    pub fn dusk(&self) -> Option<Dusk> {
        let sh = self.tl.shen.as_ref().filter(|s| !s.porunga)?;
        let gone = if sh.phase == Phase::Leave { 1f64.min((self.t - sh.t1) / 1.6) } else { 0.0 };
        Some(Dusk { age: self.t - sh.t0, out: 1.0 - gone, calm: self.calm })
    }

    /// How long shenron's entry waits for the pillar.
    pub fn shen_delay(&self) -> f64 {
        match &self.tl.shen {
            Some(sh) if !sh.porunga && !self.calm => DELAY,
            _ => 0.0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(age: f64, calm: bool) -> Dusk {
        Dusk { age, out: 1.0, calm }
    }

    #[test]
    fn dims_then_settles_into_dusk() {
        let (pg, top, _, _) = at(0.3, false).page();
        assert!(pg < 0x404040 && top < 0x202020, "the first strike's dim slate: {pg:06x} {top:06x}");
        assert_eq!(at(3.0, false).page(), (PAGE, TOP, BOT, 0.8));
    }

    #[test]
    fn reduced_motion_keeps_only_the_colours() {
        let calm = |a: f64| at(a, true);
        assert!((0..600).all(|i| !calm(i as f64 / 100.0).lit() && calm(i as f64 / 100.0).pillar() == 0.0 && calm(i as f64 / 100.0).dark() == 0.0));
        assert_eq!(calm(3.0).page(), (PAGE, TOP, BOT, 0.8));
    }

    #[test]
    fn the_wish_waits_for_the_pillar_unless_calm() {
        let open_at = |calm: bool| {
            let mut b = crate::bridge::Bridge::new(1, 200.0, 134.0, 3.0);
            b.set_calm(calm);
            b.start("Wed Oct 28 2026", 1.7e12);
            b.game.summon();
            let t0 = b.game.t;
            while b.game.wish_offer().is_none() {
                b.step_one();
            }
            b.game.t - t0
        };
        let (late, calm) = (open_at(false), open_at(true));
        assert!((late - 5.3).abs() < 0.04 && (calm - 4.4).abs() < 0.04, "{late} {calm}");
    }

    #[test]
    fn the_bridge_sends_the_sky_while_he_is_out() {
        let mut b = crate::bridge::Bridge::new(1, 200.0, 134.0, 3.0);
        b.start("Wed Oct 28 2026", 1.7e12);
        b.frame_json();
        b.game.summon();
        b.step(0.5, 1.7e12);
        let m = b.frame_json();
        assert!(m.contains(r##""sky":{"page":"#"##), "{m}");
        b.game.tl.shen = None;
        assert!(b.frame_json().contains(r#""sky":null"#));
        assert!(!b.frame_json().contains("sky"));
    }

    #[test]
    fn leaving_eases_back_to_day() {
        let d = Dusk { age: 9.0, out: 0.0, calm: false };
        assert_eq!(d.page(), (DAY_PAGE, DAY_SKY, DAY_SKY, 1.0));
    }
}
