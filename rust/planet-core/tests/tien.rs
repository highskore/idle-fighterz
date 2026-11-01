//! Tien, tri-beam: his full beam at a villain is a kikoho that stakes a fifth of his power, back ×1.6 if the villain
//! falls within 10s, lost if not; left alone he finishes a weak villain with a small, safe one himself. The AFK rule
//! over whole runs: idle he keeps pace with an idle Vegeta, playing him earns about 2-3× his own idle, and nothing an
//! idle player does costs him anything.

use planet_core::data::{Hero, Upg, SHOP};
use planet_core::heroes::{KIKOHO_BACK, KIKOHO_SECS, KIKOHO_STAKE};
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
    /// buys, kaiokens when ready, taps 5 a second for 5s of every 10, and fires a kikoho at a villain under half his hp
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
            if f.is_multiple_of(15) && self.g.s.lv(Upg::Galick) > 0 && self.g.stake().is_none() {
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

/// A villain up (past his arrival), tien with a beam.
fn raid(saga: u32) -> Game {
    let mut g = Game::new(7);
    g.preview(&format!("#hero-tien#saga{saga}"));
    g.debug_set("galick", 1.0);
    g.start();
    while g.tl.boss.as_ref().is_none_or(|b| b.dead) {
        idle(&mut g, 0.5);
        assert!(g.t < 200.0, "a villain comes");
    }
    idle(&mut g, 8.0);
    // not in a beam struggle: that takes beams for itself
    g.tl.struggle = None;
    g
}

fn aim(g: &Game) -> (f64, f64) {
    let b = g.tl.boss.as_ref().unwrap();
    (b.x, b.y - b.spr().h / 2.0 * b.k)
}

#[test]
fn a_kikoho_stakes_a_fifth_and_pays_it_back_when_he_falls() {
    let mut g = raid(1);
    g.debug_set("pl", 1e6);
    let (x, y) = aim(&g);
    g.fire_beam(2.5, x, y);
    let st = g.stake().expect("a full beam at a villain is a kikoho").clone();
    assert!((st.n.to_f64() - 1e6 * KIKOHO_STAKE).abs() < 1.0, "a fifth of his power: {}", st.n.to_f64());
    assert!(!st.safe);
    assert!(g.crater().is_some(), "it leaves its crater");
    // he falls: the stake comes back ×1.6
    let before = g.s.pl.to_f64();
    g.tl.boss.as_mut().unwrap().hp = 1.0.into();
    let (bx, by) = aim(&g);
    g.tap(bx, by);
    idle(&mut g, 1.0);
    assert!(g.stake().is_none());
    assert!(g.s.pl.to_f64() - before >= st.n.to_f64() * KIKOHO_BACK * 0.99, "paid back ×{KIKOHO_BACK}");
}

#[test]
fn a_kikoho_that_doesnt_finish_him_is_lost() {
    let mut g = raid(1);
    g.debug_set("pl", 1e6);
    g.tl.boss.as_mut().unwrap().hp = g.tl.boss.as_ref().unwrap().max * 1e6;
    let (x, y) = aim(&g);
    g.fire_beam(2.5, x, y);
    let st = g.stake().unwrap().clone();
    let after_stake = g.s.pl.to_f64();
    idle(&mut g, KIKOHO_SECS + 1.0);
    assert!(g.stake().is_none(), "the stake runs out");
    assert!(g.s.pl.to_f64() < after_stake + st.n.to_f64() * 0.5, "and isn't handed back");
}

#[test]
fn idle_he_fires_only_safe_ones_at_a_weak_villain_and_never_loses_them() {
    let mut g = raid(1);
    g.debug_set("pl", 1e6);
    // healthy villain: nothing
    idle(&mut g, 2.0);
    assert!(g.stake().is_none(), "a healthy villain gets no kikoho from an idle tien");
    // under 30%, unkillable: a safe shot, then the stake handed back
    let b = g.tl.boss.as_mut().unwrap();
    b.max *= 1e9;
    b.hp = b.max * 0.2;
    idle(&mut g, 1.0);
    let st = g.stake().expect("a safe kikoho at a weak villain").clone();
    assert!(st.safe);
    let before = g.s.pl.to_f64();
    idle(&mut g, KIKOHO_SECS + 1.0);
    assert!(g.s.pl.to_f64() >= before + st.n.to_f64() * 0.99, "a safe stake is never lost");
}

#[test]
fn his_late_forms_and_fusion() {
    let ladder = planet_core::data::ladder_of(Hero::Tien, 0);
    let names: Vec<&str> = ladder.iter().map(|f| f.name).collect();
    assert_eq!(&names[9..], ["four witches", "multi-form"]);
    assert!(!names.contains(&"four-armed") && !names.contains(&"third eye open"), "no clashing placeholder names");
    let s = planet_core::sprite::hero("tien");
    assert!(s.forms[9].idle.w > s.forms[0].idle.w && s.forms[10].idle.w > s.forms[9].idle.w, "four arms, then two more of him");
    let mut g = Game::new(1);
    g.preview("#hero-tien#dance");
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
    assert!(said.iter().any(|s| s.starts_with("chiaotzu wants to do the fusion dance")), "{said:?}");
    assert_eq!(g.tl.fused_look, "FUSED.tienzu");
}

#[test]
fn other_heroes_stake_nothing() {
    let mut g = Game::new(7);
    g.preview("#saga1");
    g.debug_set("galick", 1.0);
    g.start();
    while g.tl.boss.as_ref().is_none_or(|b| b.dead) {
        idle(&mut g, 0.5);
    }
    idle(&mut g, 8.0);
    g.tl.struggle = None;
    let (x, y) = aim(&g);
    let pl = g.s.pl.to_f64();
    g.fire_beam(2.5, x, y);
    assert!(g.stake().is_none() && g.s.pl.to_f64() >= pl);
}

#[test]
#[ignore = "slow: whole runs, several seeds (cargo test --release -- --ignored tien)"]
fn the_afk_rule_over_whole_runs() {
    for mins in [30.0, 60.0] {
        let (ti, ta) = (earned(Hero::Tien, Play::Idle, mins), earned(Hero::Tien, Play::Active, mins));
        let (vi, va) = (earned(Hero::Vegeta, Play::Idle, mins), earned(Hero::Vegeta, Play::Active, mins));
        let (vs_vegeta, act) = (ratio(&ti, &vi), ratio(&ta, &ti));
        println!("{mins} min, {} seeds: idle tien / idle vegeta ×{vs_vegeta:.3}; active / idle ×{act:.3}", SEEDS.len());
        println!("(vegeta active / idle ×{:.3}; tien active / vegeta active ×{:.3})", ratio(&va, &vi), ratio(&ta, &va));
        assert!((0.8..=1.25).contains(&vs_vegeta), "idle, he keeps pace with an idle vegeta: ×{vs_vegeta}");
        // Picked: a tapping hero may match vegeta's own active/idle (×4.7–5.3 with this bot), so the ceiling is his.
        let cap = ratio(&va, &vi) * 1.05;
        assert!(act >= 2.0 && act <= cap, "playing him earns at least 2× his idle, no more than vegeta does: ×{act} (cap ×{cap})");
    }
}
