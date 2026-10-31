//! Krillin, destructo disc: taps throw discs that cut everything along their line, a chain paying more with every cut;
//! left alone he throws one himself every few seconds. The AFK rule over whole runs: idle he keeps pace with an idle
//! Vegeta, playing him (aiming discs between training taps) earns about 2-3× his own idle, and nothing an idle player
//! does costs him anything.

use planet_core::data::{Hero, Upg, SHOP};
use planet_core::heroes::{BARRAGE_CUTS, DISC_AUTO, DISC_GAP};
use planet_core::{Game, DT};

const POLICY: [&str; 13] = ["boots", "partner", "gravity", "scouter", "house", "piccolo", "cloud", "armor", "kaio", "galick", "senzu", "chamber", "bigbang"];

/// The difftest's `buyAll`: the cheapest open upgrade until none is affordable. Returns what it spent.
fn buy_all(g: &mut Game) -> f64 {
    let mut spent = 0.0;
    loop {
        let ok = POLICY
            .iter()
            .filter_map(|k| Upg::from_key(k))
            .filter(|&u| g.unlocked(u) && g.s.pl >= g.cost(u))
            .min_by(|&a, &b| g.cost(a).partial_cmp(&g.cost(b)).unwrap());
        let Some(u) = ok else { return spent };
        let c = g.cost(u);
        if !g.buy(SHOP[u as usize].key) {
            return spent;
        }
        spent += c.to_f64();
    }
}

#[derive(Clone, Copy, PartialEq, Debug)]
enum Play {
    /// never taps; checks in once a second to buy
    Idle,
    /// buys, kaiokens when ready, and for 5s of every 10 taps every 0.4s (as fast as his discs come): at the nearest
    /// target, or on himself
    Active,
}

struct Run {
    g: Game,
    spent: f64,
    f: u32,
}

impl Run {
    fn new(seed: u32, hero: Hero) -> Self {
        let mut g = Game::new(seed);
        g.s.hero = hero;
        g.forms = planet_core::data::ladder_of(hero, 0);
        g.start();
        Run { g, spent: 0.0, f: 0 }
    }

    fn earned(&self) -> f64 {
        self.g.s.pl.to_f64() + self.spent
    }

    fn step(&mut self, play: Play) {
        let f = self.f;
        if play == Play::Active && f % 300 < 150 && f.is_multiple_of(12) {
            // his taps are discs: at the nearest target, or on himself (straight ahead) when there's none
            let (x, y) = self.g.nearest_target().unwrap_or_else(|| {
                let k = self.g.kid_screen(14.0);
                (k.x, k.y)
            });
            self.g.tap(x, y);
        }
        if f.is_multiple_of(30) {
            self.spent += buy_all(&mut self.g);
            if play != Play::Idle {
                self.g.kaioken();
            }
        }
        self.g.frame((f + 1) as f64 * DT, DT);
        self.f += 1;
    }

    fn play(&mut self, play: Play, secs: f64) {
        for _ in 0..(secs / DT) as u32 {
            self.step(play);
        }
    }
}

const SEEDS: [u32; 24] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24];

fn geo_mean(v: &[f64]) -> f64 {
    (v.iter().map(|x| x.ln()).sum::<f64>() / v.len() as f64).exp()
}

fn earned(hero: Hero, play: Play, mins: f64) -> Vec<f64> {
    SEEDS
        .iter()
        .map(|&s| {
            let mut r = Run::new(s, hero);
            r.play(play, mins * 60.0);
            r.earned()
        })
        .collect()
}

fn ratio(a: &[f64], b: &[f64]) -> f64 {
    geo_mean(&a.iter().zip(b).map(|(x, y)| x / y).collect::<Vec<_>>())
}

#[test]
fn a_disc_cuts_everything_along_its_line_and_a_chain_pays_more() {
    let mut r = Run::new(7, Hero::Krillin);
    // once he runs round to the side facing us (and before his own disc flies)
    while r.g.kid_screen(0.0).v[2] < 0.4 {
        r.play(Play::Idle, 0.1);
        assert!(r.g.t < 60.0);
    }
    // three orbs on the road next to him, on the side facing us: one disc at the farthest cuts all three
    let phi = r.g.phi;
    let front = |d: f64| r.g.cam.screen(r.g.frame3.road_pt(phi + d), 4.0).v[2] > 0.05;
    let dir = if front(0.14) { 1.0 } else { -1.0 };
    assert!(front(0.14 * dir));
    r.g.tl.orbs = [0.06, 0.1, 0.14].iter().map(|d| planet_core::timeline::Orb { phi: phi + d * dir, star: false, done: false }).collect();
    let p = r.g.cam.screen(r.g.frame3.road_pt(phi + 0.14 * dir), 4.0);
    let (cuts, before) = (r.g.cuts(), r.earned());
    r.g.tap(p.x, p.y);
    let said: Vec<String> = r.g.events.drain(..).map(|e| e.0).collect();
    assert_eq!(r.g.cuts() - cuts, 3, "one throw, three cuts");
    assert!(said.iter().any(|s| s.starts_with("destructo disc! 3 cut in one throw · chain ×4")), "{said:?}");
    assert!(r.earned() > before);
    assert_eq!(r.g.discs().len(), 1, "the disc flies");
    r.g.tap(p.x, p.y);
    assert_eq!(r.g.discs().len(), 1, "one disc every {DISC_GAP}s, however fast you tap");
}

#[test]
fn left_alone_he_throws_by_himself() {
    let mut r = Run::new(3, Hero::Krillin);
    r.play(Play::Idle, 600.0);
    assert!(r.g.cuts() > 0, "idle, krillin's own discs (one every {DISC_AUTO}s) cut things");
}

#[test]
fn the_barrage_takes_a_fifth_of_a_villain() {
    let mut g = Game::new(7);
    g.preview("#hero-krillin#saga3");
    g.start();
    while g.tl.boss.is_none() || g.tl.boss.as_ref().is_some_and(|b| b.max <= 0.0) {
        let t = g.t + DT;
        g.frame(t, DT);
        assert!(g.t < 200.0, "a villain comes");
    }
    for _ in 0..30 * 6 {
        let t = g.t + DT;
        g.frame(t, DT);
    }
    let b = g.tl.boss.as_ref().unwrap();
    let (hp0, max) = (b.hp.to_f64(), b.max.to_f64());
    if let planet_core::heroes::Kind::Krillin { cuts, .. } = &mut g.hero_rt.kind {
        *cuts = BARRAGE_CUTS;
    }
    for _ in 0..30 {
        let t = g.t + DT;
        g.frame(t, DT);
    }
    // a tap on empty sky: with the barrage charged, the disc goes for the villain
    g.tap(g.cam.w * 0.05, g.cam.h * 0.05);
    let hp1 = g.tl.boss.as_ref().map_or(0.0, |b| b.hp.to_f64());
    assert!(hp0 - hp1 >= max * 0.19 || g.tl.boss.as_ref().is_none_or(|b| b.dead), "the barrage: {hp0} → {hp1} of {max}");
    assert_eq!(g.cuts(), 0);
}

#[test]
fn other_heroes_are_untouched() {
    for h in [Hero::Vegeta, Hero::Goku, Hero::Piccolo] {
        let r = Run::new(1, h);
        assert_eq!(r.g.cuts(), 0, "{h:?}");
        assert!(r.g.discs().is_empty());
    }
}

#[test]
fn he_never_visits_himself() {
    let mut r = Run::new(5, Hero::Krillin);
    r.play(Play::Idle, 900.0);
    assert!(r.g.tl.kril.is_none() && !r.g.s.krillin_dead && r.g.tl.date.is_none(), "no krillin visit, death or date for krillin");
}

#[test]
#[ignore = "slow: whole runs, several seeds (cargo test --release -- --ignored krillin)"]
fn the_afk_rule_over_whole_runs() {
    for mins in [30.0, 60.0] {
        let (ki, ka) = (earned(Hero::Krillin, Play::Idle, mins), earned(Hero::Krillin, Play::Active, mins));
        let vi = earned(Hero::Vegeta, Play::Idle, mins);
        let (vs_vegeta, act) = (ratio(&ki, &vi), ratio(&ka, &ki));
        println!("{mins} min, {} seeds: idle krillin / idle vegeta ×{vs_vegeta:.3}; active / idle ×{act:.3}", SEEDS.len());
        assert!((0.8..=1.25).contains(&vs_vegeta), "idle, he keeps pace with an idle vegeta: ×{vs_vegeta}");
        assert!((2.0..=3.0).contains(&act), "playing him earns about 2-3× his idle: ×{act}");
    }
}

#[test]
fn his_own_late_forms_moon_and_fusion() {
    let ladder = planet_core::data::ladder_of(Hero::Krillin, 0);
    let names: Vec<&str> = ladder.iter().map(|f| f.name).collect();
    assert_eq!(&names[9..], ["solar flare", "taiyoken sun"], "past the shared nine, his own two");
    assert!(!names.contains(&"max power"), "max power is his moon form now, not a form name");
    let s = planet_core::sprite::hero("krillin");
    assert!(s.forms[9].idle.w > s.forms[0].idle.w, "the solar flare blazes behind him");
    let mut r = Run::new(1, Hero::Krillin);
    assert_eq!(r.g.ape_name(false), "max power");
    assert_eq!(planet_core::sprite::get("FUSED.roshillin").h, planet_core::sprite::hero("krillin").forms[0].idle.h);
    // the fusion dance: master roshi asks, three beats on time make roshillin
    r.g.preview("#dance");
    r.g.tl.next_dance = 0.0;
    r.g.session = 400.0;
    let mut said = Vec::new();
    for _ in 0..30 * 10 {
        if let Some(d) = r.g.tl.dance.clone() {
            if d.i < 3 && (d.beats[d.i] - r.g.t).abs() < 0.05 {
                // a real tap on him: the beat takes it before any disc would
                let k = r.g.kid_screen(14.0);
                r.g.tap(k.x, k.y);
            }
        }
        r.play(Play::Idle, DT);
        said.extend(r.g.events.drain(..).map(|e| e.0));
    }
    assert!(said.iter().any(|s| s.starts_with("master roshi wants to do the fusion dance")), "{said:?}");
    assert!(said.iter().any(|s| s.contains("roshillin")), "{said:?}");
    assert_eq!(r.g.tl.fused_look, "FUSED.roshillin");
}

#[test]
fn a_chain_is_his_combo_and_his_taps_still_hit_what_they_touch() {
    let mut r = Run::new(7, Hero::Krillin);
    while r.g.kid_screen(0.0).v[2] < 0.4 {
        r.play(Play::Idle, 0.1);
    }
    r.g.s.goal = "combo";
    r.g.s.goal_p = 0.0;
    let phi = r.g.phi;
    let front = |d: f64| r.g.cam.screen(r.g.frame3.road_pt(phi + d), 4.0).v[2] > 0.05;
    let dir = if front(0.14) { 1.0 } else { -1.0 };
    r.g.tl.orbs = [0.06, 0.1].iter().map(|d| planet_core::timeline::Orb { phi: phi + d * dir, star: false, done: false }).collect();
    let p = r.g.cam.screen(r.g.frame3.road_pt(phi + 0.1 * dir), 4.0);
    r.g.tap(p.x, p.y);
    assert_eq!(r.g.combo, 2.0, "two cuts in one throw are a ×2 combo");
    assert_ne!(r.g.s.goal, "combo", "and they meet \"hit a ×2 combo\"");
    // a villain tapped is hit by hand, not thrown at
    let mut g = Game::new(7);
    g.preview("#hero-krillin#saga1");
    g.start();
    while g.tl.boss.as_ref().is_none_or(|b| b.hp.to_f64() <= 0.0) {
        let t = g.t + DT;
        g.frame(t, DT);
        assert!(g.t < 200.0);
    }
    // past his arrival (the scouter intro takes every tap)
    for _ in 0..30 * 8 {
        let t = g.t + DT;
        g.frame(t, DT);
    }
    let b = g.tl.boss.as_ref().unwrap();
    let (x, y, hp0) = (b.x, b.y - b.spr().h / 2.0 * b.k, b.hp.to_f64());
    g.tap(x, y);
    assert!(g.tl.boss.as_ref().is_some_and(|b| b.hp.to_f64() < hp0), "the tap hits him");
    assert!(g.discs().is_empty(), "no disc for a tap that hit something");
}

/// A villain on the planet with the barrage charged, `armor` levels of armor, from the moment he's up.
fn charged_at_a_villain(armor: u32) -> Game {
    let mut g = Game::new(7);
    g.preview("#hero-krillin#saga3");
    g.s.levels[Upg::Armor as usize] = armor;
    g.start();
    while g.tl.boss.is_none() || g.tl.boss.as_ref().is_some_and(|b| b.max <= 0.0) {
        let t = g.t + DT;
        g.frame(t, DT);
        assert!(g.t < 200.0, "a villain comes");
    }
    if let planet_core::heroes::Kind::Krillin { cuts, .. } = &mut g.hero_rt.kind {
        *cuts = BARRAGE_CUTS;
    }
    g
}

#[test]
fn armor_doesnt_grow_the_barrage() {
    let mut g = charged_at_a_villain(10);
    while g.tl.boss.as_ref().is_some_and(|b| g.t < b.go) {
        let t = g.t + DT;
        g.frame(t, DT);
    }
    let t = g.t + 1.0;
    g.frame(t, DT);
    let b = g.tl.boss.as_ref().unwrap();
    let (hp0, max) = (b.hp.to_f64(), b.max.to_f64());
    assert!(hp0 > max * 0.5, "{hp0} of {max}");
    g.tap(g.cam.w * 0.05, g.cam.h * 0.05);
    let hp1 = g.tl.boss.as_ref().unwrap().hp.to_f64();
    let took = (hp0 - hp1) / max;
    assert!((0.19..=0.21).contains(&took), "a fifth of his hp with armor ×6 too: took {took}");
}

#[test]
fn no_barrage_before_the_villain_arrives() {
    let mut g = charged_at_a_villain(0);
    let b = g.tl.boss.as_ref().unwrap();
    assert!(g.t < b.go, "he's still on his way in");
    let hp0 = b.hp.to_f64();
    // a tap now skips his entrance: his own disc is what could go for him early
    if let planet_core::heroes::Kind::Krillin { auto, .. } = &mut g.hero_rt.kind {
        *auto = 0.01;
    }
    let (x, y) = g.hand_pos();
    g.tl.meteors.push(planet_core::timeline::Meteor { x: x + 30.0, y, vx: 0.0, vy: 0.0, delay: 0.0, dead: false, sd: None });
    let t = g.t + DT;
    g.frame(t, DT);
    assert!(g.discs().len() == 1, "he throws");
    assert!(g.tl.boss.as_ref().is_some_and(|b| g.t < b.go));
    assert_eq!(g.tl.boss.as_ref().unwrap().hp.to_f64(), hp0);
    assert!(g.cuts() >= BARRAGE_CUTS, "the barrage waits for him");
}

/// Krillin facing us, a fresh saibaman on the road just ahead of him, nothing else to cut, and his own disc due.
fn saiba_ahead() -> Run {
    let mut r = Run::new(7, Hero::Krillin);
    while r.g.kid_screen(0.0).v[2] < 0.6 {
        r.play(Play::Idle, 0.1);
        assert!(r.g.t < 60.0);
    }
    r.g.tl.meteors.clear();
    r.g.tl.orbs.clear();
    let c = r.g.frame3.road_pt(r.g.phi + 0.12);
    let born = r.g.t - 1.0;
    r.g.tl.saibas = vec![planet_core::timeline::Saiba { c, born, life: 16.0, soldier: false, dead: false, sx: None }];
    if let planet_core::heroes::Kind::Krillin { auto, .. } = &mut r.g.hero_rt.kind {
        *auto = 0.01;
    }
    r
}

#[test]
fn his_own_disc_finds_a_saibaman_without_the_renderer() {
    let mut r = saiba_ahead();
    r.step(Play::Idle);
    assert!(r.g.tl.saibas[0].dead, "the core sees the saibaman itself, drawn or not");
}

#[test]
fn no_disc_of_his_own_while_hes_stunned() {
    let mut r = saiba_ahead();
    r.g.tl.stun_until = r.g.t + 1.0;
    r.play(Play::Idle, 0.5);
    assert!(r.g.cuts() == 0 && r.g.discs().is_empty(), "stunned, he throws nothing");
    r.play(Play::Idle, 1.0);
    assert_eq!(r.g.cuts(), 1, "and throws once he's back on his feet");
}

#[test]
fn playing_krillin_theres_no_other_krillin() {
    for seed in 1..=6 {
        let mut g = Game::new(seed);
        g.preview("#hero-krillin#androids");
        g.s.krillin_ally = true;
        g.start();
        while g.tl.ginyu.is_none() {
            let t = g.t + DT;
            g.frame(t, DT);
            assert!(g.t < 30.0, "the androids drop in");
        }
        assert!(g.tl.kril.is_none(), "seed {seed}: nobody goes for a krillin ally while you are krillin");
    }
    let mut g = Game::new(7);
    g.preview("#hero-krillin");
    g.s.krillin_dead = true;
    g.start();
    g.summon();
    while g.tl.shen.as_ref().is_some_and(|s| s.offer.is_empty()) {
        let t = g.t + DT;
        g.frame(t, DT);
        assert!(g.t < 60.0, "the dragon offers");
    }
    assert!(!g.tl.shen.as_ref().unwrap().offer.contains(&planet_core::data::KRILLIN_WISH), "no wishing krillin back to krillin");
}

#[test]
fn the_androids_dont_drop_in_on_seventeen() {
    let mut g = Game::new(7);
    g.preview("#hero-a17#androids");
    g.start();
    for _ in 0..30 * 20 {
        let t = g.t + DT;
        g.frame(t, DT);
    }
    assert!(g.tl.ginyu.is_none(), "17 doesn't drop in on himself");
}

#[test]
fn a_botched_dance_slows_taps_not_idle_income() {
    let botch = |on: bool| {
        let mut g = Game::new(7);
        g.start();
        g.s.levels[Upg::Partner as usize] = 5;
        g.s.levels[Upg::Boots as usize] = 300;
        for _ in 0..30 {
            let t = g.t + DT;
            g.frame(t, DT);
        }
        if on {
            g.b.fused = Some((0.75, g.t + 15.0));
        }
        let rate = g.rate().to_f64();
        let pl = g.s.pl.to_f64();
        g.train();
        (rate, g.s.pl.to_f64() - pl)
    };
    let ((r0, tap0), (r1, tap1)) = (botch(false), botch(true));
    assert_eq!(r1, r0, "idle income doesn't feel a botched dance");
    assert!((tap1 / tap0 - 0.75).abs() < 0.02, "taps do: ×{}", tap1 / tap0);
}
