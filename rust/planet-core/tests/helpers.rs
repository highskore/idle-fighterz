//! The piccolo upgrade brings each hero his own helper: the shop names him and his arrival says who came; roshi's
//! visit skips while he's goku's helper; bubbles fusions are named per hero.

use planet_core::big::Big;
use planet_core::data::{bubbles_fusion, Helper, Hero, Upg, CHARS};
use planet_core::{Game, DT};

fn playing(id: &str) -> Game {
    let mut g = Game::new(7);
    g.preview(&format!("#hero-{id}"));
    g.start();
    g
}

#[test]
fn each_hero_gets_his_own_helper_named_in_the_shop_and_the_toast() {
    for &(hero, id, _, _) in CHARS.iter() {
        let mut g = playing(id);
        g.s.best = Big::from(1e6);
        g.s.pl = Big::from(1e6);
        g.events.clear();
        assert!(g.buy_n("piccolo", 1), "{id} buys his helper");
        let h = Helper::of(hero);
        assert_eq!(g.helper_here(), Some(h));
        assert_eq!(g.own_label(Upg::Piccolo), Some(h.name()), "{id}");
        assert!(g.events.iter().any(|(s, _)| s == h.arrives()), "{id}: {:?}", g.events);
    }
    assert_eq!(Helper::of(Hero::Piccolo).name(), "kid gohan");
    assert_eq!(Helper::of(Hero::Gohan).name(), "piccolo");
}

#[test]
fn roshi_stays_home_while_he_is_gokus_helper() {
    for (id, visits) in [("goku", false), ("vegeta", true)] {
        let mut g = playing(id);
        g.s.levels[Upg::Piccolo as usize] = 1;
        g.session = 100.0;
        g.tl.next_roshi = 0.0;
        for _ in 0..5 {
            let t = g.t + DT;
            g.frame(t, DT);
        }
        assert_eq!(g.tl.roshi.is_some(), visits, "{id}");
    }
}

#[test]
fn every_bubbles_fusion_has_its_own_name() {
    let mut names: Vec<&str> = CHARS.iter().map(|c| bubbles_fusion(c.0)).collect();
    assert_eq!(bubbles_fusion(Hero::Vegeta), "vegebubs");
    names.sort();
    names.dedup();
    assert_eq!(names.len(), CHARS.len());
}
