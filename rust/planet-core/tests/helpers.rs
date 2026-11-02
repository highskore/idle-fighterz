//! The piccolo upgrade brings each hero their own helper: the shop names them and their arrival says who came; while
//! they're here they don't also turn up as themselves (visits, world npcs, raids); bubbles fusions are named per hero.

use planet_core::big::Big;
use planet_core::data::{bubbles_fusion, Hero, Upg, CHARS};
use planet_core::geom::ap;
use planet_core::{Game, DT};

fn playing(id: &str) -> Game {
    let mut g = Game::new(7);
    g.preview(&format!("#hero-{id}"));
    g.start();
    g
}

fn run(g: &mut Game, secs: f64) {
    for _ in 0..(secs / DT) as usize {
        let t = g.t + DT;
        g.frame(t, DT);
    }
}

fn own_helper(g: &mut Game) {
    g.s.levels[Upg::Piccolo as usize] = 1;
}

#[test]
fn each_hero_gets_their_own_helper_named_in_the_shop_and_the_toast() {
    let table = [
        ("vegeta", "bulma"),
        ("goku", "master roshi"),
        ("gohan", "piccolo"),
        ("trunks", "future gohan"),
        ("krillin", "android 18"),
        ("piccolo", "kid gohan"),
        ("a17", "android 16"),
        ("tien", "yamcha"),
        ("goten", "chi-chi"),
    ];
    assert_eq!(table.len(), CHARS.len());
    for (id, label) in table {
        let mut g = playing(id);
        g.s.best = Big::from(1e6);
        g.s.pl = Big::from(1e6);
        g.events.clear();
        assert!(g.buy_n("piccolo", 1), "{id} buys their helper");
        assert_eq!(g.own_label(Upg::Piccolo), Some(label), "{id}");
        assert_eq!(g.helper_here().map(|h| h.data().name), Some(label), "{id}");
        let arrives = g.helper().data().arrives;
        assert!(arrives.starts_with(label), "{id}: {arrives}");
        assert!(g.events.iter().any(|(s, _)| s == arrives), "{id}: {:?}", g.events);
    }
}

#[test]
fn roshi_stays_home_while_he_is_gokus_helper() {
    for (id, visits) in [("goku", false), ("vegeta", true)] {
        let mut g = playing(id);
        own_helper(&mut g);
        g.session = 100.0;
        g.tl.next_roshi = 0.0;
        run(&mut g, 5.0 * DT);
        assert_eq!(g.tl.roshi.is_some(), visits, "{id}");
    }
}

#[test]
fn a_visit_already_under_way_ends_when_the_same_character_becomes_the_helper() {
    let mut g = playing("goku");
    g.session = 100.0;
    g.tl.next_roshi = 0.0;
    run(&mut g, 5.0 * DT);
    assert!(g.tl.roshi.is_some(), "roshi wanders over before he's bought");
    own_helper(&mut g);
    run(&mut g, DT);
    assert!(g.tl.roshi.is_none());

    let mut g = playing("a17");
    g.session = 200.0;
    g.tl.next_a16 = 0.0;
    run(&mut g, 5.0 * DT);
    assert!(g.tl.a16.is_some(), "16 watches the birds before he's bought");
    own_helper(&mut g);
    run(&mut g, DT);
    assert!(g.tl.a16.is_none());
}

#[test]
fn sixteen_skips_the_birds_while_he_is_seventeens_helper() {
    for (id, birds) in [("a17", false), ("vegeta", true)] {
        let mut g = playing(id);
        own_helper(&mut g);
        g.session = 200.0;
        g.tl.next_a16 = 0.0;
        run(&mut g, 5.0 * DT);
        assert_eq!(g.tl.a16.is_some(), birds, "{id}");
    }
}

#[test]
fn yamcha_skips_his_crater_while_he_is_tiens_helper() {
    for (id, crater) in [("tien", false), ("vegeta", true)] {
        let mut g = playing(id);
        own_helper(&mut g);
        g.session = 200.0;
        g.tl.next_yam = 0.0;
        run(&mut g, 5.0 * DT);
        assert_eq!(g.tl.yam.is_some(), crater, "{id}");
    }
}

#[test]
fn eighteen_is_away_while_she_raids_with_seventeen() {
    let mut g = playing("krillin");
    own_helper(&mut g);
    assert!(!g.helper_away());
    g.session = 400.0;
    g.s.best = 1e6.into();
    g.tl.next_andro = 0.0;
    run(&mut g, 1.0);
    let raid = g.tl.ginyu.as_ref().expect("the androids raid");
    assert!(raid.members.iter().any(|m| m.name == "android 18"));
    assert!(g.helper_away(), "the 18 above the planet is the one raiding");
    // goku's roshi has no one in the raid to be
    let mut g = playing("goku");
    own_helper(&mut g);
    g.session = 400.0;
    g.s.best = 1e6.into();
    g.tl.next_andro = 0.0;
    run(&mut g, 1.0);
    assert!(g.tl.ginyu.is_some());
    assert!(!g.helper_away());
}

/// Taps the world npc standing at `cap_pt(th, a)`, turning the planet until it's on the near side.
fn tap_npc(g: &mut Game, th: f64, a: f64) {
    run(g, 1.0);
    for _ in 0..30 * 60 {
        let v = ap(&g.cam.m, g.frame3.cap_pt(th, a));
        if v[2] > 0.3 {
            let c = &g.cam;
            g.click(c.cx + v[0] * c.r, c.cy - v[1] * c.r + c.bob - 10.0);
            return;
        }
        run(g, DT);
    }
    panic!("the npc never came round");
}

#[test]
fn a_world_npc_who_is_the_helper_is_not_there_to_tap() {
    for (owned, buffs) in [(false, true), (true, false)] {
        let mut g = playing("goten");
        g.debug_set("world", 7.0);
        if owned {
            own_helper(&mut g);
        }
        g.events.clear();
        tap_npc(&mut g, 0.45, 3.2);
        assert_eq!(g.b.chi_until > g.t, buffs, "chi-chi's frying pan, helper owned: {owned}");
        assert_eq!(g.events.iter().any(|(s, _)| s.starts_with("chi-chi:")), buffs, "{:?}", g.events);

        let mut g = playing("goku");
        g.debug_set("world", 6.0);
        if owned {
            own_helper(&mut g);
        }
        g.events.clear();
        tap_npc(&mut g, 0.5, 5.2);
        assert_eq!(g.events.iter().any(|(s, _)| s.starts_with("umigame wakes up")), buffs, "the turtle, helper owned: {owned}: {:?}", g.events);
    }
}

#[test]
fn bubbles_fuses_into_each_heros_own_name() {
    let mut names: Vec<&str> = CHARS.iter().map(|c| bubbles_fusion(c.0)).collect();
    assert_eq!(bubbles_fusion(Hero::Vegeta), "vegebubs");
    names.sort();
    names.dedup();
    assert_eq!(names.len(), CHARS.len());

    let mut g = playing("goku");
    g.tl.fuse_offer = g.t + 10.0;
    g.tl.monkey_at = Some((100.0, 100.0, 1.0));
    g.events.clear();
    g.click(100.0, 95.0);
    assert!(g.events.iter().any(|(s, _)| s == "fusion ha! gobubs — ×2 for 30s"), "{:?}", g.events);
}
