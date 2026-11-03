//! The tournament of power from the moment the multiverse opens. Universe fighters are sized on the damage the
//! multiverse opened on, so an active player beats the first one in his first fight and idle wears him down; and
//! (ignored, slow) a pacing bot plays each hero from a new game to the unlock, then an idle, a tapping and a full-on
//! player go on for an hour, and every universe fight is logged:
//! `cargo test --release -p planet-core --test multiverse -- --ignored --nocapture`

use planet_core::big::Big;
use planet_core::data::{Upg, ANGELS, TREE, UNI_STEP, VILLAINS};
use planet_core::{Game, DT};

fn env(k: &str, d: f64) -> f64 {
    std::env::var(k).ok().and_then(|v| v.parse().ok()).unwrap_or(d)
}

/// limits.rs's pacing check-in, without god ki and zeno: angels, ascending, the tree and the shop cheapest first.
fn check_in(g: &mut Game) {
    for a in [0, 1, 4, 5, 6, 2, 3, 7] {
        g.learn_angel(ANGELS[a].id);
    }
    if g.ascend_unlocked() && g.t >= g.b.asc_ready && g.s.pl >= g.ascend_cost() && g.seeds_now() >= g.s.ascend.max(Big::from(1.0)) {
        g.buy("ascend");
    }
    loop {
        let mut pick: Option<(Big, &str)> = None;
        for (i, n) in TREE.iter().enumerate() {
            if g.node_open(i) && g.s.tree[i] < n.max {
                let c = Game::rank_cost(n, g.s.tree[i]);
                if c <= g.s.seeds && pick.as_ref().is_none_or(|p| c < p.0) {
                    pick = Some((c, n.id));
                }
            }
        }
        let Some((_, id)) = pick else { break };
        g.learn(id);
    }
    for _ in 0..3000 {
        let mut pick: Option<(Big, Upg)> = None;
        for u in Upg::ALL {
            let c = g.cost(u);
            if g.unlocked(u) && c <= g.s.pl && pick.as_ref().is_none_or(|p| c < p.0) {
                pick = Some((c, u));
            }
        }
        let Some((_, u)) = pick else { break };
        g.buy(u.key());
    }
}

/// Where planet-render would stand him (headless, nothing places him).
fn place(g: &mut Game) {
    let (cx, cy, r) = (g.cam.cx, g.cam.cy, g.cam.r);
    if let Some(b) = g.tl.boss.as_mut() {
        b.k = 0.9f64.max(r / 62.0);
        b.x = cx + r * 1.45;
        b.y = cy - r * 0.75;
    }
}

#[derive(Clone, Copy, PartialEq, Debug)]
enum Play {
    Idle,
    /// 3 taps a second on him, no beams
    Taps,
    /// 5 taps a second on him, a full beam every 8s, kaioken whenever
    Full,
}

struct Bot {
    g: Game,
    f: u64,
    play: Play,
    charge: f64,
    /// damage to the universe fighter up: taps, beams, the rest
    by: [f64; 3],
    shop: bool,
}

impl Bot {
    fn new(seed: u32, hero: &str, play: Play) -> Self {
        let mut g = Game::new(seed);
        g.preview(&format!("#hero-{hero}"));
        g.start();
        Bot { g, f: 0, play, charge: 0.0, by: [0.0; 3], shop: true }
    }

    fn uni_hp(&self) -> f64 {
        self.g.tl.boss.as_ref().filter(|b| b.uni).map_or(0.0, |b| b.hp.to_f64())
    }

    /// One frame of `play` in a universe fight; out of one, limits.rs's pacing tapper (idle: nothing). Checks in
    /// every 10s, or every 15 min idle.
    fn step(&mut self) {
        let f = self.f;
        place(&mut self.g);
        let h0 = self.uni_hp();
        let mut src = 2;
        if self.play != Play::Idle {
            let g = &mut self.g;
            let uni = g.tl.boss.as_ref().filter(|b| !b.dead && b.uni && g.t >= b.go).map(|b| (b.x, b.y - b.spr().h / 2.0 * b.k));
            let full = self.play == Play::Full;
            if full && f.is_multiple_of(30) {
                g.kaioken();
            }
            match uni {
                Some((x, y)) if full && g.tl.struggle.is_none() && f % 240 < 75 && g.s.lv(Upg::Galick) > 0 => {
                    self.charge += DT;
                    if self.charge >= 2.5 {
                        g.fire_beam(self.charge, x, y);
                        self.charge = 0.0;
                        src = 1;
                    }
                }
                Some((x, y)) if f.is_multiple_of(if full { 6 } else { 10 }) => {
                    g.click(x, y);
                    src = 0;
                }
                None if f % 300 < 150 && f.is_multiple_of(6) => match g.tl.boss.as_ref().filter(|b| !b.dead).map(|b| (b.x, b.y - 8.0)) {
                    Some((x, y)) => g.click(x, y),
                    None => g.train(),
                },
                _ => {}
            }
        }
        let h1 = self.uni_hp();
        let every = if self.play == Play::Idle { (900.0 / DT) as u64 } else { (10.0 / DT) as u64 };
        if self.shop && f % every == every - 1 {
            check_in(&mut self.g);
        }
        self.f += 1;
        self.g.frame(self.f as f64 * DT, DT);
        let h2 = self.uni_hp();
        if h0 > 0.0 {
            self.by[src] += (h0.max(0.0) - h1.max(0.0)).max(0.0);
        }
        if h1 > 0.0 {
            self.by[2] += (h1.max(0.0) - h2.max(0.0)).max(0.0);
        }
    }
}

/// One universe fight, as it went.
struct Fight {
    at: f64,
    tag: String,
    hp: f64,
    rate: f64,
    dealt: f64,
    by: [f64; 3],
    won: bool,
    secs: f64,
}

/// Plays to the unlock with the full-on pacer (the quickest route there), then `mins` more as `play`: when it opened
/// (hours), the power held then, and the fights.
fn from_unlock(seed: u32, hero: &str, play: Play, mins: f64) -> (f64, f64, Vec<Fight>) {
    let mut bot = Bot::new(seed, hero, Play::Full);
    while !bot.g.s.multi {
        bot.step();
        assert!(bot.g.t < 40.0 * 3600.0, "{hero}: no multiverse in 40h");
    }
    let (t0, pw) = (bot.g.t, bot.g.s.pl.to_f64());
    bot.play = play;
    let mut fights: Vec<Fight> = Vec::new();
    let mut cur = None;
    while bot.g.t - t0 < mins * 60.0 {
        bot.step();
        let g = &bot.g;
        let Some(b) = g.tl.boss.as_ref().filter(|b| b.uni) else { continue };
        if cur != Some(b.id) {
            cur = Some(b.id);
            bot.by = [0.0; 3];
            let tag = format!("{} {}", b.tag, b.name);
            fights.push(Fight { at: (g.t - t0) / 60.0, tag, hp: b.max.to_f64(), rate: g.rate().to_f64(), dealt: 0.0, by: [0.0; 3], won: false, secs: 0.0 });
        }
        let ft = fights.last_mut().unwrap();
        ft.dealt = 1.0 - (b.hp / b.max).to_f64().max(0.0);
        ft.by = bot.by.map(|d| d / ft.hp);
        if b.dead && ft.secs == 0.0 {
            ft.won = !b.fled;
            ft.secs = b.t1 - b.t0;
        }
    }
    (t0 / 3600.0, pw, fights)
}

#[test]
#[ignore]
fn the_tournament_from_the_unlock() {
    let mins = env("UNI_MIN", 60.0);
    let seed = env("UNI_SEED", 1.0) as u32;
    let heroes = std::env::var("UNI_HEROES").unwrap_or("vegeta,goku,krillin,piccolo,goten".into());
    for hero in heroes.split(',') {
        for play in [Play::Idle, Play::Taps, Play::Full] {
            let who = format!("{play:?}").to_lowercase();
            let (h, pw, fights) = from_unlock(seed, hero, play, mins);
            eprintln!("\n{hero} {who}: multiverse at {h:.2}h, power {pw:.2e}");
            for f in &fights {
                eprintln!(
                    "  {:5.1}m {:24} hp {:.2e} rate {:.2e}/s → {:5.1}% (taps {:.1}% beams {:.1}% rest {:.1}%) {}",
                    f.at,
                    f.tag,
                    f.hp,
                    f.rate,
                    f.dealt * 100.0,
                    f.by[0] * 100.0,
                    f.by[1] * 100.0,
                    f.by[2] * 100.0,
                    if f.won { format!("won in {:.1}s", f.secs) } else { "held".into() }
                );
            }
            let first = fights.iter().find(|f| f.won).map_or("—".into(), |f| format!("{:.1}m", f.at));
            let by = |m: f64| fights.iter().filter(|f| f.won && f.at <= m).count();
            eprintln!("  {hero} {who}: first win {first}; wins by 10/30/60m: {}/{}/{}; fights {}", by(10.0), by(30.0), by(60.0), fights.len());
        }
    }
}

/// A run that has just cleared the sagas, its forms landed, so the multiverse opens on the next frame; it buys nothing.
fn at_unlock(hero: &str, play: Play) -> Bot {
    let mut g = Game::new(1);
    g.preview(&format!("#hero-{hero}"));
    for (k, v) in [("pl", 1e9), ("best", 1e9), ("boots", 25.0), ("partner", 25.0), ("house", 25.0), ("piccolo", 10.0), ("armor", 10.0)] {
        g.debug_set(k, v);
    }
    g.start();
    for _ in 0..(10.0 / DT) as u32 {
        g.frame(g.t + DT, DT);
    }
    g.s.saga = VILLAINS.len() as u32;
    g.session = 200.0;
    Bot { g, f: 0, play, charge: 0.0, by: [0.0; 3], shop: false }
}

/// Plays until universe 9's first fighter falls or has held `fights` times, or `secs` pass: when he fell (seconds
/// from the unlock), and his hp share left each time he held.
fn fight_bergamo(bot: &mut Bot, fights: usize, secs: f64) -> (Option<f64>, Vec<f64>) {
    let t0 = bot.g.t;
    let (mut seen, mut held) = (None, Vec::new());
    while held.len() < fights && bot.g.t - t0 < secs {
        bot.step();
        let Some(b) = bot.g.tl.boss.as_ref().filter(|b| b.uni) else { continue };
        assert_eq!(b.name, "bergamo");
        if !b.dead {
            seen = Some(b.id);
        } else if seen == Some(b.id) {
            if !b.fled {
                return (Some(b.t1 - t0), held);
            }
            held.push((b.hp / b.max).to_f64());
            seen = None;
        }
    }
    (None, held)
}

#[test]
fn an_active_player_buying_nothing_beats_the_first_fighter_within_six_minutes_of_the_unlock() {
    for hero in ["vegeta", "krillin", "goten", "piccolo"] {
        let mut bot = at_unlock(hero, Play::Taps);
        let (won, held) = fight_bergamo(&mut bot, 99, 360.0);
        assert!(won.is_some(), "{hero}: bergamo still holds: {held:?}");
        assert!(!held.is_empty(), "{hero}: he takes more than one fight");
    }
}

#[test]
fn idle_wears_the_first_fighter_down_and_he_comes_back_as_hurt_as_he_left() {
    let mut bot = at_unlock("vegeta", Play::Idle);
    let (won, held) = fight_bergamo(&mut bot, 2, 600.0);
    assert!(won.is_none(), "idle takes more than two fights");
    assert!(held[0] < 0.99, "an idle fight hurts him: {held:?}");
    assert!(held[1] < held[0] - 0.02, "the second starts where the first left off: {held:?}");
}

#[test]
fn universe_hp_is_counted_in_the_damage_the_multiverse_opened_on() {
    let (mut a, mut b) = (at_unlock("vegeta", Play::Idle).g, at_unlock("vegeta", Play::Idle).g);
    b.debug_set("armor", 40.0);
    for g in [&mut a, &mut b] {
        g.frame(g.t + DT, DT);
        assert!(g.s.multi);
    }
    let r = (b.uni_hp(0, 0) / a.uni_hp(0, 0)).to_f64();
    assert!((r - 21.0 / 6.0).abs() < 1e-9, "armor 10 → 40 hits ×3.5 harder, and he's ×3.5 bigger: {r}");
    assert!(((a.uni_hp(1, 0) / a.uni_hp(0, 0)).to_f64() - UNI_STEP).abs() < 1e-9);
    // growing after the unlock doesn't grow him
    let hp = a.uni_hp(0, 0);
    a.debug_set("armor", 80.0);
    assert!(a.uni_hp(0, 0) == hp);
}
