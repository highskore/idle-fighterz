//! Every hero's beam, boost, blast and armor go by his own names wherever the player reads them: the shop rows, their
//! first-buy toasts, the hints, the toasts, the boost button and the achievements.

use planet_core::data::{hero_beam, hero_blast, hero_boost, ladder_of, Hero, Upg, CHARS, SHOP};
use planet_core::Game;
use serde_json::Value;

fn game(hero: Hero) -> Game {
    let mut g = Game::new(7);
    g.s.hero = hero;
    g.forms = ladder_of(hero, 0);
    g.start();
    g.s.pl = 1e12.into();
    g.s.best = 1e12.into();
    g
}

/// A shop row's field.
fn row(g: &Game, key: &str, field: &str) -> String {
    let j: Value = serde_json::from_str(&g.shop_json()).unwrap();
    j[key][field].as_str().expect("shop row field").to_string()
}

/// The HUD's boost button field.
fn button(g: &Game, field: &str) -> String {
    let j: Value = serde_json::from_str(&g.hud_now().to_json()).unwrap();
    j["kaio"][field].as_str().expect("kaio field").to_string()
}

#[test]
fn every_hero_names_his_own_beam() {
    for &(hero, id, ..) in CHARS.iter() {
        let (beam, full) = hero_beam(hero);
        let mut g = game(hero);
        let label = if hero == Hero::Vegeta { "galick charge" } else { beam };
        assert_eq!(row(&g, "galick", "label"), label, "{id}");

        assert!(g.buy("galick"), "{id} buys the beam");
        let toast = match hero {
            Hero::Piccolo => "hold anywhere to charge the special beam cannon: it spends his focus".to_string(),
            Hero::Tien => "hold anywhere to charge the kikoho: at a villain it stakes a fifth of your power".to_string(),
            _ => format!("hold anywhere to charge a {beam}"),
        };
        assert!(g.events.iter().any(|e| e.0 == toast), "{id}: {:?}", g.events);

        g.s.levels[Upg::Galick as usize] = 4;
        let what = row(&g, "galick", "what");
        assert!(what.ends_with(&format!(" and {full}")), "{id}: {what}");
        assert_eq!(g.ach_name("flash", "final flash!"), format!("{full}!"), "{id}");
        if hero != Hero::Vegeta {
            assert!(!what.contains("final flash"), "{id}: {what}");
        }
    }
}

#[test]
fn every_hero_names_his_own_boost_blast_and_armor() {
    let mut seen = Vec::new();
    for &(hero, id, ..) in CHARS.iter() {
        let look = hero_boost(hero);
        let (boost, blast) = (look.name, hero_blast(hero));
        assert!(!seen.contains(&boost) && !seen.contains(&blast), "{id}: {boost} / {blast} taken");
        seen.extend([boost, blast]);
        let mut g = game(hero);
        for name in [boost, look.short, blast] {
            assert!(!g.forms.iter().any(|f| f.name == name), "{id}: {name} is one of his forms");
            assert!(name != g.ape_name(false) && name != g.ape_name(true), "{id}: {name} is his giant");
        }
        assert!(!look.short.is_empty() && look.short.len() <= 8, "{id}: the button's label {:?}", look.short);

        // 17's boost pins his overclock instead, and says so
        let kaio_toast = if hero == Hero::A17 {
            "infinite energy — hit the button to pin your overclock at the top".to_string()
        } else {
            format!("{boost} unlocked — hit the {} button", look.short)
        };
        for (key, name, toast) in [("kaio", boost, kaio_toast), ("bigbang", blast, format!("{blast} — double-tap anywhere"))] {
            assert_eq!(row(&g, key, "label"), name, "{id}");
            assert!(g.buy(key), "{id} buys {key}");
            assert!(g.events.iter().any(|e| e.0 == toast), "{id}: {:?}", g.events);
        }
        assert_eq!((button(&g, "name"), button(&g, "short")), (boost.to_string(), look.short.to_string()), "{id}");
        assert_eq!(button(&g, "fill"), format!("#{:06x}", look.fill), "{id}");
        g.kaioken();
        assert!(g.events.iter().any(|e| e.0.starts_with(&format!("{boost}! "))), "{id}: {:?}", g.events);
        if hero != Hero::A17 {
            assert!(g.effects().contains(&format!("{boost} ×")), "{id}: {}", g.effects());
        }
        assert_eq!(g.ach_name("kaioken", "kaioken"), boost, "{id}");
        assert_eq!(g.ach_text("kaioken", "use the kaioken"), format!("use {boost}"), "{id}");

        let armor = g.own_label(Upg::Armor).unwrap_or(SHOP[Upg::Armor as usize].label);
        assert_eq!(armor.contains("saiyan"), hero.saiyan(), "{id}: {armor}");
        assert!(g.buy("armor"), "{id} buys armor");
        let worn = g.events.iter().find(|e| e.0.ends_with(" on — hit villains harder")).expect("armor toast");
        assert_eq!(worn.0, format!("{armor} on — hit villains harder"), "{id}");
    }
}
