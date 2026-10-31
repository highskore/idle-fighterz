//! Piccolo, meditation: left alone he builds focus (his steady income ×0.5 to ×1), taps and the special beam cannon spend
//! it for income. The AFK rule over whole runs: idle he keeps pace with an idle Vegeta, playing him (meditate, then
//! fire the cannon, or just tap) earns about 2-3× his own idle, and an idle player never loses focus.

use planet_core::data::{Hero, Upg, SHOP};
use planet_core::heroes::{FOCUS_REST, FOCUS_RISE, FOCUS_TAP};
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
    /// buys, kaiokens when ready, taps 5 a second for 5s of every 10 and fires a full beam once a minute
    Active,
    /// piccolo's way: buys, kaiokens, leaves him to meditate and fires the cannon once a minute (taps in bursts only
    /// before he has a beam)
    Meditate,
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

    fn fire(&mut self) {
        let g = &mut self.g;
        let (x, y) = match g.tl.boss.as_ref() {
            Some(b) => (b.x, b.y - b.spr().h / 2.0 * b.k),
            None => (g.cam.cx, g.cam.cy - g.cam.r * 1.5),
        };
        g.fire_beam(2.5, x, y);
    }

    fn step(&mut self, play: Play) {
        let f = self.f;
        let beam = self.g.s.lv(Upg::Galick) > 0;
        match play {
            Play::Idle => {}
            Play::Active => {
                if f % 300 < 150 && f.is_multiple_of(6) {
                    self.g.train();
                }
                if beam && f % 1800 == 900 {
                    self.fire();
                }
            }
            Play::Meditate => {
                if !beam && f % 600 < 150 && f.is_multiple_of(6) {
                    self.g.train();
                }
                if beam && f % 1800 == 900 {
                    self.fire();
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

const SEEDS: [u32; 12] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

fn geo_mean(v: &[f64]) -> f64 {
    (v.iter().map(|x| x.ln()).sum::<f64>() / v.len() as f64).exp()
}

/// Power earned over `mins` minutes for each seed.
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
fn focus_is_spent_by_taps_and_the_cannon_and_meditation_brings_it_back() {
    let mut r = Run::new(7, Hero::Piccolo);
    assert_eq!(r.g.focus(), 1.0, "a run starts at full focus");
    r.play(Play::Idle, FOCUS_REST + 0.5);
    assert!(r.g.meditating(), "left alone, he sits down to meditate");
    assert_eq!(r.g.hero_x(), 1.0, "full focus is ×1 on his steady income");
    let before = r.earned();
    r.g.train();
    assert!(!r.g.meditating(), "a tap stands him up");
    assert!((r.g.focus() - (1.0 - FOCUS_TAP)).abs() < 1e-9, "a tap spends a slice of focus");
    assert!(r.earned() > before, "and pays it out");
    let before = r.earned();
    r.fire();
    assert_eq!(r.g.focus(), 0.0, "a full cannon spends it all");
    assert_eq!(r.g.hero_x(), 0.5, "no focus: his steady income halves");
    assert!(r.earned() > before);
    r.play(Play::Idle, FOCUS_REST + 1.0 / FOCUS_RISE + 1.0);
    assert_eq!(r.g.focus(), 1.0, "a hundred seconds of meditation bring it all back");
}

#[test]
fn idle_his_focus_only_grows() {
    let mut r = Run::new(3, Hero::Piccolo);
    let mut last = 0.0;
    for _ in 0..30 * 60 * 10 {
        r.step(Play::Idle);
        let f = r.g.focus();
        assert!(f >= last || f == 0.0 && r.g.s.ascend > 0.0, "idle, focus never drops: {last} → {f}");
        last = f;
    }
    assert!(r.g.hero_x() >= 0.5);
}

#[test]
fn other_heroes_are_untouched() {
    for h in [Hero::Vegeta, Hero::Goku, Hero::Krillin] {
        let r = Run::new(1, h);
        assert_eq!(r.g.hero_x(), 1.0, "{h:?}");
        assert_eq!(r.g.focus(), 0.0, "{h:?}");
    }
}

#[test]
fn his_form_ups_are_his_own() {
    let mut g = Game::new(7);
    g.preview("#hero-piccolo#form1");
    g.start();
    for _ in 0..30 * 15 {
        let t = g.t + DT;
        g.frame(t, DT);
    }
    assert!(g.s.form >= 1, "he forms up");
    assert!(!g.s.ach.contains("ss"), "no super saiyan for a namekian (and so no goku)");
    assert_ne!(g.forms[1].aura(), planet_core::data::FORM_AURA[1], "his aura isn't super saiyan gold");
}

#[test]
#[ignore = "slow: whole runs, several seeds (cargo test --release -- --ignored piccolo)"]
fn the_afk_rule_over_whole_runs() {
    for mins in [30.0, 60.0] {
        let (pi, pm, pa) = (earned(Hero::Piccolo, Play::Idle, mins), earned(Hero::Piccolo, Play::Meditate, mins), earned(Hero::Piccolo, Play::Active, mins));
        let vi = earned(Hero::Vegeta, Play::Idle, mins);
        let (vs_vegeta, med, act) = (ratio(&pi, &vi), ratio(&pm, &pi), ratio(&pa, &pi));
        println!(
            "{mins} min, {} seeds: idle piccolo / idle vegeta ×{vs_vegeta:.3}; meditate-and-cannon / idle ×{med:.3}; tapping / idle ×{act:.3}",
            SEEDS.len()
        );
        assert!((0.8..=1.25).contains(&vs_vegeta), "idle, he keeps pace with an idle vegeta: ×{vs_vegeta}");
        assert!((2.0..=3.0).contains(&med), "playing him his way earns about 2-3× his idle: ×{med}");
        assert!((2.0..=3.2).contains(&act), "tapping him like anyone else still earns about 2-3× his idle: ×{act}");
    }
}
