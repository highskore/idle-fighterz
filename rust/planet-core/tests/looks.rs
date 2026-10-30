//! The looks the milestones unlock (looks.rs): locked until their milestone, worn one of a kind, and in the menu and
//! on the share card.

use planet_core::looks::{LookKind, LOOKS};
use planet_core::{Game, DT};

fn run_for(g: &mut Game, secs: f64) {
    let f0 = (g.t / DT).round() as u64;
    for f in f0..f0 + (secs / DT) as u64 {
        g.frame((f + 1) as f64 * DT, DT);
    }
}

#[test]
fn each_named_milestone_unlocks_one_of_every_kind() {
    for k in [0, 1, 3] {
        let kinds: Vec<LookKind> = LOOKS.iter().filter(|l| l.mile == k).map(|l| l.kind).collect();
        assert_eq!(kinds, LookKind::ALL, "milestone {k}");
    }
}

#[test]
fn looks_stay_locked_until_their_milestone() {
    let mut g = Game::new(1);
    g.start();
    g.wear("aura", "scouter");
    assert_eq!(g.look(LookKind::Aura).map(|l| l.id), None);
    g.preview("#mile0");
    run_for(&mut g, 0.5);
    g.wear("aura", "scouter");
    assert_eq!(g.look(LookKind::Aura).map(|l| l.id), Some("scouter"));
    // 1e100's isn't open yet
    g.wear("aura", "realm");
    assert_eq!(g.look(LookKind::Aura).map(|l| l.id), Some("scouter"));
    // again takes it off
    g.wear("aura", "scouter");
    assert!(g.look(LookKind::Aura).is_none());
}

#[test]
fn the_menu_lists_them_and_the_card_wears_the_frame() {
    let mut g = Game::new(1);
    g.preview("#looks1");
    g.start();
    let m = g.menu_json();
    assert!(m.contains(r#""kind":"frame","label":"share card","on":"angel""#), "{m}");
    assert!(m.contains(r#"{"id":"button","name":"zeno's button","open":false,"need":"1e1000"}"#), "{m}");
    assert!(g.card_json().contains(r#""frame":"angel""#));
    g.wear("frame", "");
    assert!(g.card_json().contains(r#""frame":"""#));
}

#[test]
fn a_named_milestone_says_what_it_unlocked() {
    let mut g = Game::new(1);
    g.preview("#mile1");
    g.start();
    let mut said = String::new();
    for _ in 0..8 {
        run_for(&mut g, 1.0);
        for (s, _) in g.events.drain(..) {
            said.push_str(&s);
        }
    }
    assert!(said.contains("new looks: the gods' violet, whis's staff, angel's ring, starlight"), "{said}");
}
