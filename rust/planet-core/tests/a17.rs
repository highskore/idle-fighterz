//! Android 17, infinite energy: no forms to see, his marks come quietly; his overclock (100%-250%) multiplies
//! everything, climbs with every blast and beam, cools when he's left alone, and infinite energy pins it at the top.
//! The AFK rule over whole runs: idle he keeps pace with an idle Vegeta, and playing him earns at least 2× his idle,
//! no more than playing Vegeta does over his.

use planet_core::a17::{AUTO_BEAM, LOOK_NAMES, OC_MAX, OC_TAP};
use planet_core::data::{Hero, Upg, SHOP};
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
    /// buys, kaiokens when ready, taps 5 a second for 5s of every 10, and fires a full beam at a villain under half his hp
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
        if play == Play::Active {
            if f % 300 < 150 && f.is_multiple_of(6) {
                self.g.train();
            }
            if f.is_multiple_of(15) && self.g.s.lv(Upg::Galick) > 0 {
                if let Some((x, y)) = self.g.tl.boss.as_ref().filter(|b| !b.dead && (b.hp / b.max).to_f64() < 0.5).map(|b| (b.x, b.y - b.spr().h / 2.0 * b.k)) {
                    self.g.fire_beam(2.5, x, y);
                }
            }
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

const SEEDS: [u32; 48] = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41,
    42, 43, 44, 45, 46, 47, 48,
];

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

fn idle(g: &mut Game, secs: f64) {
    for _ in 0..(secs / DT).round() as u32 {
        let t = g.t + DT;
        g.frame(t, DT);
    }
}

fn seventeen() -> Game {
    let mut g = Game::new(7);
    g.preview("#hero-a17");
    g.start();
    g
}

#[test]
fn blasts_climb_the_overclock_and_it_cools_back_to_100() {
    let mut g = seventeen();
    assert_eq!(g.overclock(), 1.0);
    let x0 = g.mult(false);
    for _ in 0..20 {
        g.train();
        idle(&mut g, 0.1);
    }
    assert!(g.overclock() > 1.0 + 15.0 * OC_TAP && g.overclock() < 1.0 + 20.0 * OC_TAP, "{}", g.overclock());
    assert!(g.mult(false) > x0 * (1.0 + 0.15 * planet_core::a17::OC_GAIN), "it multiplies everything");
    idle(&mut g, 10.0);
    assert!(g.overclock() < 1.15 && g.overclock() > 1.0, "it cools: {}", g.overclock());
    idle(&mut g, 300.0);
    assert!(g.overclock() < 1.0001, "and rests at its floor");
    for _ in 0..600 {
        g.train();
        idle(&mut g, 0.02);
    }
    assert!(g.overclock() > OC_MAX - 0.01, "it tops out");
    assert_eq!(g.oc_look(), Some(2));
    assert_eq!(g.hud_now().form_name, "redline 250%");
}

#[test]
fn infinite_energy_pins_it_with_no_tiredness() {
    let mut g = seventeen();
    g.debug_set("kaio", 1.0);
    g.kaioken();
    assert_eq!(g.overclock(), OC_MAX);
    assert!(g.pinned().is_some());
    assert!(g.b.kaio_until <= g.t && g.b.tired_until <= g.t, "no kaioken, no tiredness");
    assert!(!g.s.ach.contains("kaioken"));
    idle(&mut g, 10.0);
    assert_eq!(g.overclock(), OC_MAX, "pinned while it lasts");
    idle(&mut g, 10.0);
    assert!(g.pinned().is_none() && g.overclock() < OC_MAX);
}

#[test]
fn his_marks_come_quietly_and_his_strip_is_his_looks() {
    let mut g = seventeen();
    g.s.pl = (g.forms[3].at * 1.01).into();
    let mut said = Vec::new();
    idle(&mut g, 1.0);
    said.extend(g.events.drain(..).map(|e| e.0));
    assert_eq!(g.s.form, 3, "the marks he holds the power for");
    assert!(g.xf.is_none(), "no transformation scene");
    assert!(said.iter().all(|s| !s.contains('×')), "and no form toast: {said:?}");
    assert!(!g.s.ach.contains("ss") && !g.s.ach.contains("mui"));
    let menu: serde_json::Value = serde_json::from_str(&g.menu_json()).unwrap();
    let me = menu["chars"].as_array().unwrap().iter().find(|c| c["id"] == "a17").unwrap();
    let strip: Vec<&str> = me["forms"].as_array().unwrap().iter().map(|f| f["name"].as_str().unwrap()).collect();
    assert_eq!(strip, LOOK_NAMES);
}

#[test]
fn idle_he_beams_by_himself_and_the_overclock_stays_at_its_floor() {
    let mut g = Game::new(7);
    g.preview("#hero-a17#saga1");
    g.debug_set("galick", 1.0);
    g.start();
    let mut beams = 0;
    for _ in 0..(3.0 * AUTO_BEAM / DT) as u32 {
        let had = g.inp.beam.is_some();
        idle(&mut g, DT);
        beams += (!had && g.inp.beam.is_some()) as u32;
    }
    assert!(beams >= 1, "an auto-beam");
    assert_eq!(g.overclock(), 1.0);
}

#[test]
fn eighteen_and_sixteen_raid_him_and_the_dance_makes_android_35() {
    let mut g = Game::new(1);
    g.preview("#hero-a17#dance");
    g.start();
    let mut said = Vec::new();
    for _ in 0..30 * 12 {
        if let Some(d) = g.tl.dance.clone() {
            if d.i < 3 && (d.beats[d.i] - g.t).abs() < 0.05 {
                let k = g.kid_screen(14.0);
                g.tap(k.x, k.y);
            }
        }
        idle(&mut g, DT);
        said.extend(g.events.drain(..).map(|e| e.0));
    }
    assert!(said.iter().any(|s| s.starts_with("android 18 wants to do the fusion dance")), "{said:?}");
    assert_eq!(g.tl.fused_look, "FUSED.android35");
    let mut g = seventeen();
    g.session = 400.0;
    g.s.best = 1e6.into();
    g.tl.next_andro = 0.0;
    idle(&mut g, 1.0);
    let raid = g.tl.ginyu.as_ref().expect("the androids raid him too");
    let names: Vec<&str> = raid.members.iter().map(|m| m.name).collect();
    assert_eq!(names, ["android 18", "android 16"]);
}

#[test]
#[ignore = "slow: whole runs, several seeds (cargo test --release -- --ignored a17)"]
fn the_afk_rule_over_whole_runs() {
    for mins in [30.0, 60.0] {
        let (si, sa) = (earned(Hero::A17, Play::Idle, mins), earned(Hero::A17, Play::Active, mins));
        let (vi, va) = (earned(Hero::Vegeta, Play::Idle, mins), earned(Hero::Vegeta, Play::Active, mins));
        let (vs_vegeta, act) = (ratio(&si, &vi), ratio(&sa, &si));
        println!("{mins} min, {} seeds: idle 17 / idle vegeta ×{vs_vegeta:.3}; active / idle ×{act:.3}", SEEDS.len());
        println!("(vegeta active / idle ×{:.3}; 17 active / vegeta active ×{:.3})", ratio(&va, &vi), ratio(&sa, &va));
        assert!((0.8..=1.25).contains(&vs_vegeta), "idle, he keeps pace with an idle vegeta: ×{vs_vegeta}");
        // picked: a hero may match vegeta's own active/idle (×4.7-5.3 with this bot), so the ceiling is his
        let cap = ratio(&va, &vi) * 1.05;
        assert!(act >= 2.0 && act <= cap, "playing him earns at least 2× his idle, no more than vegeta does: ×{act} (cap ×{cap})");
    }
}
