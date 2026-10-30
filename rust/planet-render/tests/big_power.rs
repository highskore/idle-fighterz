//! Endless scaling: power driven past 1e1000 and on to 10^(2·10^6), drawn every frame. Zeno's favour (×10 an erase),
//! set through the test hook, stands in for hours of late game: what the game makes of it is real play, taps, the
//! cheapest-first shop, ascending and the bosses sized on it. Nothing may come out Infinity or NaN, every number the
//! HUD and the save get must read back, and the text switches to e-notation. The final power is pinned, so CI
//! (x86-64) checks the extended form lands on the same bits as on arm64.

use planet_core::big::Big;
use planet_core::data::Upg;
use planet_core::num::{fmt_short, hud_fmt, hud_short};
use planet_core::Game;
use planet_render::scene::{Scene, View};
use planet_render::Framebuffer;

const DT: f64 = 1.0 / 30.0;

/// Every number in a JSON text the game sends reads back: no `null` (a non-finite number) and no Infinity or NaN text.
fn readable(what: &str, s: &str) {
    assert!(!s.contains("null") && !s.contains("NaN") && !s.contains("Infinity") && !s.contains(":inf"), "{what}: {s}");
}

fn finite(what: &str, b: Big) {
    assert!(b.log10().is_finite() || b == 0.0, "{what}: {b:?}");
    assert!(b.to_f64().is_finite(), "{what}: {b:?}");
}

/// Buys the cheapest affordable upgrade, up to 200 a second (a held buy button's pace, roughly).
fn shop(g: &mut Game) {
    for _ in 0..200 {
        let Some(u) = Upg::ALL.into_iter().filter(|&u| g.unlocked(u) && g.s.pl >= g.cost(u)).min_by(|a, b| g.cost(*a).partial_cmp(&g.cost(*b)).unwrap()) else {
            return;
        };
        assert!(g.buy(u.key()));
    }
}

fn play(g: &mut Game, fb: &mut Framebuffer, scene: &mut Scene, view: &View, t: &mut f64, secs: usize) {
    for f in 0..secs * 30 {
        if f % 4 == 0 {
            g.train();
        }
        *t += DT;
        g.sim(*t, DT);
        scene.draw(fb, g, view, DT);
        g.timeouts();
        g.events.clear();
        g.cues.clear();
        if (f + 1) % 30 == 0 {
            shop(g);
            for (what, v) in [("pl", g.s.pl), ("best", g.s.best), ("rate", g.rate()), ("wrate", g.wrate()), ("mult", g.mult(false)), ("seeds", g.s.seeds)] {
                finite(what, v);
            }
            for u in Upg::ALL {
                finite(u.key(), g.cost(u));
            }
            if let Some(b) = g.tl.boss.as_ref() {
                finite("boss hp", b.hp);
                finite("boss max", b.max);
            }
            readable("hud", &g.hud().to_json());
            readable("shop", &g.shop);
            for s in [g.save_json(), g.card_json(), g.ascend_info_json(), g.god_info_json()] {
                readable("box", &s);
            }
            for s in [fmt_short(g.s.pl), hud_fmt(g.s.pl), hud_short(g.rate())] {
                assert!(!s.contains("inf") && !s.contains("NaN"), "{s}");
            }
        }
    }
}

#[test]
fn power_past_1e1000() {
    let mut g = Game::new(7);
    g.epoch_ms = 1.7e12;
    g.preview("#raid");
    g.start_on("Fri Oct 30 2026");
    let (mut fb, mut scene, view) = (Framebuffer::new(200, 134), Scene::new(), View::site(3.0));
    let mut t = 0.0;

    g.debug_set("zeno", 1000.0);
    play(&mut g, &mut fb, &mut scene, &view, &mut t, 60);
    assert!(g.s.pl > Big::exp10(1000.0), "{}", g.s.pl.to_text());
    assert!(g.rate() > Big::exp10(1000.0));
    assert!(g.s.levels.iter().sum::<u32>() > 100, "the shop keeps up: {:?}", g.s.levels);
    let (m, x) = planet_core::num::hud_big(g.s.pl);
    assert!(m.len() == 4 && x.starts_with("e1,0"), "{m} {x}");
    let hud = g.hud().to_json();
    assert!(hud.contains(&format!("\"pl\":{}", g.hud().pl.to_json())) && hud.contains("\"pl\":\"") && hud.contains("\"rate\":\""), "{hud}");

    // the ki ceiling is a gameplay cap and stays: the capped engine is a small power past it
    assert!(g.capped(g.core()) < g.core() || g.core() <= g.ceiling());

    // ascending turns ~1e1000 power into ~1e500 ki seeds
    g.b.asc_ready = 0.0;
    let before = g.s.ascend;
    assert!(g.buy("ascend"));
    assert!(g.s.ascend > before && g.s.ascend > Big::exp10(400.0), "{}", g.s.ascend.to_text());
    play(&mut g, &mut fb, &mut scene, &view, &mut t, 30);

    // on to an exponent in the millions
    g.debug_set("zeno", 2_000_000.0);
    play(&mut g, &mut fb, &mut scene, &view, &mut t, 30);
    assert!(g.s.pl > Big::exp10(2e6), "{}", g.s.pl.to_text());
    let s = fmt_short(g.s.pl);
    assert!(s.contains("e2.0M"), "{s}");
    assert!(g.s.best >= g.s.pl);

    // the extended form lands on the same bits on every target
    assert_eq!(g.s.pl.to_text(), "4.363083605199433e2000185");
}
