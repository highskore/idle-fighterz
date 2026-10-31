//! The five heroes past game.js's four: each opens on its story beat (krillin from the start, piccolo after raditz,
//! android 17 after the androids, tien after cell, goten after kid buu), can be picked once open, has its own sprites
//! and form names, and `#hero-<id>` plays him without setting off the hook his id spells.

use planet_core::data::{ladder_of, Hero, CHARS};
use planet_core::{sprite, Game, DT};

fn open(g: &Game, id: &str) -> bool {
    let menu = g.menu_json();
    let m = &menu[menu.find("\"chars\":").unwrap()..];
    let i = m.find(&format!("\"id\":\"{id}\",\"name\"")).unwrap_or_else(|| panic!("{id} in the characters tab"));
    m[i..].split('}').next().unwrap().contains("\"open\":true")
}

fn step(g: &mut Game) {
    let t = g.t + DT;
    g.frame(t, DT);
}

#[test]
fn nine_heroes_and_only_krillin_is_new_and_open_from_the_start() {
    let mut g = Game::new(7);
    g.start();
    assert_eq!(CHARS.len(), 9);
    for (id, want) in [("vegeta", true), ("krillin", true), ("piccolo", false), ("a17", false), ("tien", false), ("goten", false)] {
        assert_eq!(open(&g, id), want, "{id}");
    }
    assert!(g.pick_hero("krillin"));
    assert_eq!(g.s.hero, Hero::Krillin);
    assert!(!g.pick_hero("piccolo"), "piccolo waits for raditz");
}

#[test]
fn story_beats_open_the_rest() {
    let mut g = Game::new(7);
    g.start();
    g.s.beaten.insert("raditz".into());
    g.s.ach.insert("androids");
    g.s.ach.insert("cell");
    g.s.beaten.insert("kid buu".into());
    for id in ["piccolo", "a17", "tien", "goten"] {
        assert!(open(&g, id), "{id}");
        assert!(g.pick_hero(id), "{id}");
    }
}

#[test]
fn beating_raditz_brings_piccolo() {
    let mut g = Game::new(7);
    g.preview("#saga1");
    g.debug_set("armor", 400.0);
    g.debug_set("boots", 200.0);
    g.start();
    let mut said = Vec::new();
    while g.t < 120.0 && !g.s.beaten.contains("raditz") {
        if let Some(b) = g.tl.boss.as_ref() {
            let (x, y) = (b.x, b.y - b.spr().h / 2.0 * b.k);
            g.tap(x, y);
        }
        step(&mut g);
        said.extend(g.events.drain(..).map(|e| e.0));
    }
    assert!(g.s.beaten.contains("raditz"), "raditz falls");
    for _ in 0..90 {
        step(&mut g);
        said.extend(g.events.drain(..).map(|e| e.0));
    }
    assert!(said.iter().any(|s| s.starts_with("piccolo joins you")), "{said:?}");
    assert!(g.pick_hero("piccolo"));
}

#[test]
fn the_hero_hook_plays_him_and_only_him() {
    let mut g = Game::new(7);
    g.preview("#hero-krillin");
    assert_eq!(g.s.hero, Hero::Krillin);
    let mut plain = Game::new(7);
    plain.preview("");
    assert_eq!(g.session, plain.session, "#hero-krillin doesn't also call krillin's visit");
    assert_eq!(g.tl.next_kril, plain.tl.next_kril);
    let mut v = Game::new(7);
    v.preview("#hero-vegeta");
    assert_eq!(v.s.world, plain.s.world, "#hero-vegeta doesn't fly to planet vegeta");
}

#[test]
fn every_hero_has_sprites_and_a_ladder() {
    for &(h, id, ..) in CHARS.iter() {
        let s = sprite::hero(id);
        assert!(!std::ptr::eq(s, sprite::hero("vegeta")) || id == "vegeta", "{id} has his own sprites");
        let ladder = ladder_of(h, 0);
        assert!(ladder.len() >= 9, "{id}");
        assert_eq!(ladder[0].name, "base");
        assert_eq!(ladder[1].name == "super saiyan", h.saiyan(), "{id}: {}", ladder[1].name);
        for f in &ladder {
            assert!(f.look < s.forms.len(), "{id}: {}", f.name);
        }
    }
}

#[test]
fn the_save_names_the_new_hero() {
    let mut g = Game::new(7);
    g.start();
    assert!(g.pick_hero("krillin"));
    assert!(g.save_json().contains("\"hero\":\"krillin\""));
}
