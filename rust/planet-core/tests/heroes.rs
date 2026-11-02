//! The five heroes past game.js's four: each opens on its story beat (krillin from the start, piccolo after raditz,
//! android 17 after the androids, tien once yamcha is out of his crater, goten after kid buu), can be picked once open, has its own sprites
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
    g.s.ach.insert("yamcha");
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
    // (not mid-transformation: a form-up's scene plays out first)
    while g.xf.is_some() {
        step(&mut g);
    }
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

/// Vegeta at `form` with the power for the next one, the scene for it under way (and every hero open).
fn mid_scene(form: usize, pl: f64) -> Game {
    let mut g = Game::new(7);
    g.start();
    g.s.beaten.insert("raditz".into());
    g.s.form = form;
    g.s.pl = pl.into();
    g.xf_instant = false;
    while g.xf.is_none() {
        step(&mut g);
        assert!(g.t < 10.0, "the scene starts");
    }
    let x = g.xf.as_ref().unwrap();
    assert_eq!((x.from, x.to), (form, form + 1));
    g
}

#[test]
fn no_switching_heroes_mid_transformation() {
    // vegeta's ninth form up to his tenth, then piccolo (nine forms); his tenth up to his eleventh, then goku (ten)
    for (form, pl, id) in [(8, 3e14, "piccolo"), (9, 3e17, "goku")] {
        let mut g = mid_scene(form, pl);
        assert!(!g.pick_hero(id), "{id}: not while vegeta transforms");
        assert_eq!(g.s.hero, Hero::Vegeta);
        assert!(g.pick_hero("vegeta"), "picking the hero he already is is fine");
        g.tap(g.cam.w / 2.0, g.cam.h / 2.0);
        while g.xf.is_some() {
            step(&mut g);
            assert!(g.t < 30.0, "the scene ends");
        }
        assert!(g.pick_hero(id), "{id}: once the scene is over");
        assert!(g.s.form < g.forms.len());
        for _ in 0..60 {
            step(&mut g);
        }
    }
}

#[test]
fn each_heroes_run_state_survives_a_switch_until_the_run_ends() {
    let mut g = Game::new(7);
    g.start();
    g.s.beaten.insert("raditz".into());
    assert!(g.pick_hero("piccolo"));
    g.hero_rt.kind = planet_core::heroes::Kind::Piccolo { focus: 0.25 };
    assert!(g.pick_hero("krillin"));
    if let planet_core::heroes::Kind::Krillin { cuts, auto, .. } = &mut g.hero_rt.kind {
        (*cuts, *auto) = (7, 3.0);
    }
    assert!(g.pick_hero("vegeta"));
    assert!(g.pick_hero("piccolo"));
    assert_eq!(g.focus(), 0.25, "switching away and back doesn't refill his focus");
    assert!(g.pick_hero("krillin"));
    assert_eq!(g.cuts(), 7, "nor wipe krillin's barrage cuts");
    assert!(matches!(g.hero_rt.kind, planet_core::heroes::Kind::Krillin { auto: 3.0, .. }), "or his own disc's timer");
    assert!(!g.save_json().contains("cuts"), "none of it is saved");
    g.s.pl = 1e9.into();
    g.s.best = 1e9.into();
    g.b.asc_ready = 0.0;
    g.ascend();
    assert_eq!(g.cuts(), 0, "a new run starts him over");
    assert!(g.pick_hero("piccolo"));
    assert_eq!(g.focus(), 1.0, "and every hero");
}

fn godki_open(g: &Game) -> bool {
    g.shop().iter().any(|r| r.key == "godki")
}

#[test]
fn god_ki_opens_at_the_same_mark_for_every_hero() {
    for (id, h) in [("piccolo", Hero::Piccolo), ("tien", Hero::Tien), ("a17", Hero::A17), ("vegeta", Hero::Vegeta), ("goku", Hero::Goku)] {
        let mut g = Game::new(7);
        g.start();
        g.s.hero = h;
        g.forms = ladder_of(h, 0);
        let top = g.forms.len() - 1;
        g.s.form = top.min(8);
        g.s.run_best = 1e12.into();
        assert!(!godki_open(&g), "{id}: not below the mark");
        g.s.form = top;
        g.s.run_best = 2.5e14.into();
        assert!(godki_open(&g), "{id}: his top form with the power for the saiyans' tenth");
        let gods = g.s.gods;
        g.god_reset();
        assert_eq!(g.s.gods, gods + 1, "{id}");
    }
    // once limit III breaks, a nine-form hero's limit breakers sit at his ninth form's mark: still not god ki
    let mut g = Game::new(7);
    g.start();
    g.s.hero = Hero::Goten;
    g.s.limits = 3;
    g.forms = ladder_of(Hero::Goten, 3);
    g.s.form = 9;
    g.s.run_best = 1e12.into();
    assert!(!godki_open(&g), "a limit breaker at his ninth mark isn't the saiyans' 2e14");
}

#[test]
fn mastery_stars_cost_every_hero_at_least_what_goku_pays() {
    let first = |h: Hero| {
        let mut g = Game::new(7);
        g.start();
        g.s.hero = h;
        g.forms = ladder_of(h, 0);
        g.mastery_at(0).to_f64()
    };
    let goku = first(Hero::Goku);
    assert_eq!(goku, 2e17, "goku's first star at 2e17");
    for (_, h, ..) in CHARS.iter().map(|c| (c.1, c.0)) {
        assert!(first(h) >= goku, "{h:?}: a star costs at least goku's");
    }
    // and a star comes when the power gets there
    let mut g = Game::new(7);
    g.start();
    g.s.hero = Hero::Goku;
    g.forms = ladder_of(Hero::Goku, 0);
    g.s.form = g.forms.len() - 1;
    g.s.pl = 1e17.into();
    step(&mut g);
    assert_eq!(g.s.mastery, 0, "no star below 2e17");
    g.s.pl = 2.1e17.into();
    step(&mut g);
    assert_eq!(g.s.mastery, 1, "the first at 2e17");
}

#[test]
fn the_menu_gives_each_hero_his_playstyle_and_form_ladder() {
    let mut g = Game::new(7);
    g.start();
    g.s.form = 2;
    let m: serde_json::Value = serde_json::from_str(&g.menu_json()).unwrap();
    let chars = m["chars"].as_array().unwrap();
    for (c, &(h, id, ..)) in chars.iter().zip(CHARS.iter()) {
        assert_eq!(c["id"], id);
        assert!(!c["style"].as_str().unwrap().is_empty(), "{id} has a playstyle line");
        let forms = c["forms"].as_array().unwrap();
        if h == Hero::A17 {
            // no ladder: his strip is his overclock's looks, and he'd switch in at base
            let names: Vec<&str> = forms.iter().map(|f| f["name"].as_str().unwrap()).collect();
            assert_eq!(names, planet_core::a17::LOOK_NAMES);
            assert_eq!(c["form"], 0.0);
            continue;
        }
        let ladder = ladder_of(h, g.s.limits);
        assert_eq!(forms.len(), ladder.len(), "{id}'s strip is his whole ladder");
        for (f, l) in forms.iter().zip(&ladder) {
            assert_eq!(f["name"], l.name);
            assert_eq!(f["aura"], format!("#{:06x}", l.aura()[2]));
        }
        assert_eq!(c["form"], 2.0, "{id} shows the form he'd switch in at");
    }
    let piccolo = chars.iter().find(|c| c["id"] == "piccolo").unwrap();
    assert_eq!(piccolo["forms"][2]["name"], "demon king");
    assert_eq!(piccolo["forms"][0]["aura"], "#8ad87a", "a namekian's green aura");
    assert_eq!(chars[0]["forms"][1]["aura"], "#ffe02e", "super saiyan gold");
}

#[test]
fn only_saiyans_transform_on_the_full_moon() {
    use planet_core::data::Upg;
    for (h, saiyan) in [(Hero::Vegeta, true), (Hero::Goten, true), (Hero::Piccolo, false), (Hero::Krillin, false), (Hero::Tien, false), (Hero::A17, false)] {
        let mut g = Game::new(7);
        g.start();
        g.s.hero = h;
        g.s.ach.insert("ape");
        g.session = 41.0;
        g.tl.next_moon = 0.0;
        let mut rose = false;
        for _ in 0..30 * 5 {
            step(&mut g);
            rose |= g.tl.moon.is_some();
        }
        assert_eq!(rose, saiyan, "{h:?}: the moon");
        assert_eq!(g.unlocked(Upg::Tail), saiyan, "{h:?}: tail training");
        assert_eq!(g.menu_json().contains("\"id\":\"giantape\""), saiyan, "{h:?}: the great ape's achievements");
    }
    // switching away mid-transformation ends the great ape
    let mut g = Game::new(7);
    g.start();
    g.s.ach.insert("androids");
    g.session = 41.0;
    g.tl.next_moon = 0.0;
    g.s.levels[Upg::Tail as usize] = 1;
    while g.b.ape_until <= g.t && g.t < 30.0 {
        step(&mut g);
    }
    assert!(g.b.ape_until > g.t, "vegeta went great ape");
    assert!(g.pick_hero("a17"));
    assert!(g.b.ape_until <= g.t);
}

#[test]
fn switching_heroes_keeps_only_the_form_this_runs_power_reached() {
    // goten's marks come at half: his third form on power short of vegeta's third gives vegeta no free form
    let mut g = Game::new(7);
    g.preview("#hero-goten");
    g.start();
    g.s.form = 3;
    g.s.pl = (g.forms[3].at * 1.1).into();
    g.s.run_best = g.s.pl;
    assert!(g.s.run_best.to_f64() < ladder_of(Hero::Vegeta, 0)[3].at);
    assert!(g.pick_hero("vegeta"));
    assert!(g.s.form < 3, "no free form for vegeta: {}", g.s.form);
    assert!(g.s.run_best.to_f64() >= g.forms[g.s.form].at, "the form this run's power reached");
    // power reached and then spent keeps its form, for the same marks and for the same hero
    let mut g = Game::new(7);
    g.start();
    g.s.form = 3;
    g.s.run_best = (g.forms[3].at * 1.1).into();
    g.s.pl = 1e3.into();
    g.s.ach.insert("ss");
    assert!(g.pick_hero("goku"));
    assert_eq!(g.s.form, 3, "goku keeps super saiyan 3 after spending");
    assert!(g.pick_hero("goku"));
    assert_eq!(g.s.form, 3, "and re-picking him changes nothing");
    // a wished form holds through a switch until it wears off
    g.s.form = 6;
    g.tl.preview = Some((3, g.t + 60.0));
    assert!(g.pick_hero("vegeta"));
    assert_eq!(g.s.form, 6, "the wish isn't wasted");
}

#[test]
fn krillins_ally_bonus_isnt_his_own() {
    let mut g = Game::new(7);
    g.start();
    g.debug_set("partner", 3.0);
    g.s.krillin_ally = true;
    let with = g.passive().to_f64();
    assert!(with > 0.0);
    assert!(g.krillin_helps() && g.extra().contains("krillin: idle"));
    g.s.hero = Hero::Krillin;
    assert!(g.passive().to_f64() < with, "no ×1.5 from himself");
    assert!(!g.krillin_helps() && !g.extra().contains("krillin: idle"), "nor its HUD line");
    // nor his ki discs at a villain
    let mut g = Game::new(7);
    g.preview("#hero-krillin#saga1");
    g.start();
    g.s.krillin_ally = true;
    while g.tl.boss.as_ref().is_none_or(|b| g.t < b.go) && g.t < 120.0 {
        step(&mut g);
    }
    for _ in 0..30 {
        step(&mut g);
    }
    assert!(g.tl.boss.as_ref().is_some_and(|b| b.next_disc.is_none()), "no ally discs while you're krillin");
}

#[test]
fn goten_opens_the_multiverse_at_ultra_instincts_power_not_its_form_number() {
    let ui = planet_core::data::UI_FORM;
    let run = |pl: f64| {
        let mut g = Game::new(7);
        g.preview("#hero-goten");
        g.start();
        g.s.form = ui;
        g.s.pl = pl.into();
        g.s.run_best = g.s.pl;
        for _ in 0..30 {
            step(&mut g);
        }
        g.s.multi
    };
    let g = {
        let mut g = Game::new(7);
        g.preview("#hero-goten");
        g
    };
    assert!(!run(g.forms[ui].at * 1.01), "half the mark isn't ultra instinct's");
    assert!(run(planet_core::data::ALL_FORMS[ui].1 * 1.05), "ultra instinct's power opens it");
}

#[test]
fn a_form_hook_reads_the_heros_own_ladder() {
    let mut g = Game::new(7);
    g.preview("#hero-goten#form3");
    assert_eq!(g.s.pl.to_f64(), (ladder_of(Hero::Goten, 0)[3].at * 1.05).round(), "goten's third mark, not vegeta's");
}

#[test]
fn hooks_for_a_milestone_or_limit_that_doesnt_exist_dont_hang() {
    let mut g = Game::new(7);
    g.preview("#mile999");
    g.preview("#limit99999");
    assert!(g.s.limits <= 100);
}
