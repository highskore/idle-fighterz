//! Every hero's beam, boost and blast go by his own names wherever the player reads them: the shop rows, their
//! first-buy toasts, the hints, the toasts and achievements. Only vegeta fires a galick gun.

use planet_core::data::{hero_beam, hero_boost, hero_moves, ladder_of, Hero, Upg, CHARS, SHOP};
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
    row_of(g, "galick")
}

/// A shop row as JSON.
fn row_of(g: &Game, key: &str) -> String {
    let j = g.shop_json();
    let i = j.find(&format!("\"{key}\":{{")).expect("shop row");
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
        let toast = match hero {
            Hero::Piccolo => "hold anywhere to charge the special beam cannon: it spends his focus".to_string(),
            Hero::Tien => "hold anywhere to charge the kikoho: at a villain it stakes a fifth of your power".to_string(),
            _ => format!("hold anywhere to charge a {beam}"),
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

#[test]
fn every_hero_names_his_own_boost_blast_and_armor() {
    let mut seen = Vec::new();
    for &(hero, id, ..) in CHARS.iter() {
        let (boost, blast) = hero_moves(hero);
        assert!(!seen.contains(&boost) && !seen.contains(&blast), "{id}: {boost} / {blast} taken");
        seen.extend([boost, blast]);
        let mut g = game(hero);
        for name in [boost, blast] {
            assert!(!g.forms.iter().any(|f| f.name == name), "{id}: {name} is one of his forms");
            assert!(name != g.ape_name(false) && name != g.ape_name(true), "{id}: {name} is his giant");
        }

        for (key, name, toast) in
            [("kaio", boost, format!("{boost} unlocked — hit the red button")), ("bigbang", blast, format!("{blast} — double-tap anywhere"))]
        {
            assert!(row_of(&g, key).contains(&format!("\"label\":\"{name}\"")), "{id}: {}", row_of(&g, key));
            assert!(g.buy(key), "{id} buys {key}");
            assert!(g.events.iter().any(|e| e.0 == toast), "{id}: {:?}", g.events);
        }
        g.kaioken();
        assert!(g.events.iter().any(|e| e.0.starts_with(&format!("{boost}! ×"))), "{id}: {:?}", g.events);
        assert!(g.effects().contains(&format!("{boost} ×")), "{id}: {}", g.effects());
        assert!(g.hud_now().to_json().contains(&format!("\"kaio\":{{\"name\":\"{boost}\"")), "{id}");
        let look = hero_boost(hero);
        assert!(!look.short.is_empty() && look.short.len() <= 8, "{id}: the button's label {:?}", look.short);
        let hud = g.hud_now().to_json();
        assert!(hud.contains(&format!("\"short\":\"{}\",\"fill\":\"#{:06x}\"", look.short, look.fill)), "{id}: {hud}");
        // goku keeps the kaioken's red; the others' boosts aren't red
        assert_eq!(look.fill == 0xe0332b, hero == Hero::Goku, "{id}");
        assert_eq!(g.ach_name("kaioken", "kaioken"), boost, "{id}");
        assert_eq!(g.ach_text("kaioken", "use the kaioken"), format!("use {boost}"), "{id}");

        let armor = g.own_label(Upg::Armor).unwrap_or(SHOP[Upg::Armor as usize].label);
        assert_eq!(armor.contains("saiyan"), hero.saiyan(), "{id}: {armor}");
        assert!(g.buy("armor"), "{id} buys armor");
        let worn = g.events.iter().find(|e| e.0.ends_with(" on — hit villains harder")).expect("armor toast");
        assert_eq!(worn.0, format!("{armor} on — hit villains harder"), "{id}");
    }
}
