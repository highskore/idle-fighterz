//! Every hero's beam goes by his own name wherever the player reads it: the shop row, its first-buy toast, the
//! full-power hint, the full-power achievement. Only vegeta fires a galick gun.

use planet_core::data::{hero_beam, ladder_of, Hero, Upg, CHARS};
use planet_core::Game;

fn game(hero: Hero) -> Game {
    let mut g = Game::new(7);
    g.s.hero = hero;
    g.forms = ladder_of(hero, 0);
    g.start();
    g.s.pl = 1e12.into();
    g.s.best = 1e12.into();
    g
}

/// The shop's beam row as JSON.
fn row(g: &Game) -> String {
    let j = g.shop_json();
    let i = j.find("\"galick\":{").expect("beam row");
    j[i..i + j[i..].find('}').unwrap()].to_string()
}

#[test]
fn every_hero_names_his_own_beam() {
    for &(hero, id, ..) in CHARS.iter() {
        let (beam, full) = hero_beam(hero);
        assert_eq!(beam.contains("galick"), hero == Hero::Vegeta, "{id}: {beam}");
        assert_eq!(full == "final flash", hero == Hero::Vegeta, "{id}: {full}");

        let mut g = game(hero);
        let label = if hero == Hero::Vegeta { "galick charge" } else { beam };
        assert!(row(&g).contains(&format!("\"label\":\"{label}\"")), "{id}: {}", row(&g));
        assert_eq!(g.own_label(Upg::Galick).is_none(), hero == Hero::Vegeta, "{id}");

        assert!(g.buy("galick"), "{id} buys the beam");
        let toast = if hero == Hero::Piccolo {
            "hold anywhere to charge the special beam cannon: it spends his focus".to_string()
        } else {
            format!("hold anywhere to charge a {beam}")
        };
        assert!(g.events.iter().any(|e| e.0 == toast), "{id}: {:?}", g.events);

        g.s.levels[Upg::Galick as usize] = 4;
        assert!(row(&g).contains(&format!(" and {full}\"")), "{id}: {}", row(&g));
        assert_eq!(g.ach_name("flash", "final flash!"), format!("{full}!"), "{id}");
        if hero != Hero::Vegeta {
            assert!(!row(&g).contains("galick charge") && !row(&g).contains("final flash"), "{id}: {}", row(&g));
        }
    }
}
