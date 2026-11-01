//! Snake way is parked: a long run never goes there, and over a full rotation of trips idle and active players earn
//! what they did with it in the rotation (the AFK rule: idle loses nothing).

use planet_core::data::{Upg, ACH, SNAKE_ACH, SNAKE_WAY_ENABLED};
use planet_core::{Game, DT};

struct Run {
    /// power earned over the seconds of base income (`wrate`) it ran: what trips, laps and visitors pay on top
    paid: f64,
    trips: u32,
    on_snake_way: u32,
}

/// `secs` of a mid-game player who doesn't buy (so the rate stays put), with snake way in the rotation or not. Active
/// taps 5 a second for 5s of every 10 and uses the kaioken.
fn run(seed: u32, active: bool, snake_way: bool, secs: f64) -> Run {
    let mut g = Game::new(seed);
    g.snake_way = snake_way;
    g.start();
    for (u, n) in [(Upg::Boots, 30), (Upg::Partner, 30), (Upg::Gravity, 25), (Upg::Scouter, 20), (Upg::House, 15), (Upg::Cloud, 15), (Upg::Kaio, 3)] {
        g.s.levels[u as usize] = n;
    }
    g.s.pl = 1e5.into();
    g.s.best = g.s.pl;
    let (mut base, mut on_snake_way) = (0.0, 0);
    for f in 0..(secs / DT) as u32 {
        if active && f % 300 < 150 && f % 6 == 0 {
            g.train();
        }
        if active && f % 30 == 0 {
            g.kaioken();
        }
        g.frame((f + 1) as f64 * DT, DT);
        base += g.wrate().to_f64() * DT;
        on_snake_way += (g.s.world == 3) as u32;
    }
    Run { paid: g.s.pl.to_f64() / base, trips: g.s.trips, on_snake_way }
}

#[test]
fn snake_way_is_parked() {
    assert_eq!(Game::new(1).snake_way, SNAKE_WAY_ENABLED);
    assert!(!Game::new(1).snake_way);
    let mut g = Game::new(1);
    g.preview("#snake");
    assert!(g.snake_way, "the #snake preview hook still runs it");
}

#[test]
fn its_achievements_are_hidden_while_parked() {
    let mut g = Game::new(1);
    let listed = |g: &Game| SNAKE_ACH.iter().filter(|id| g.menu_json().contains(&format!("\"id\":\"{id}\""))).count();
    assert_eq!(listed(&g), 0);
    assert!(g.card_json().contains(&format!("\"achN\":{}", ACH.len() - SNAKE_ACH.len())));
    g.snake_way = true;
    assert_eq!(listed(&g), SNAKE_ACH.len());
    assert!(g.card_json().contains(&format!("\"achN\":{}", ACH.len())));
}

#[test]
fn a_long_run_never_enters_snake_way() {
    for active in [false, true] {
        let r = run(3, active, false, 75.0 * 60.0);
        // past snake way's slot in two rotations (trips 3 and 14)
        assert!(r.trips >= 15, "only {} trips", r.trips);
        assert_eq!(r.on_snake_way, 0);
    }
}

// 16 seeds left the ratio to luck: seeds 17-32 put it 7% off on main too
const SEEDS: u32 = 48;
/// At least a full rotation of 11 trips with snake way in it.
const ROTATION: f64 = 36.0 * 60.0;

#[test]
fn income_over_a_rotation_holds() {
    for active in [false, true] {
        let (mut was, mut now) = (0.0, 0.0);
        for seed in 1..=SEEDS {
            let a = run(seed, active, true, ROTATION);
            assert!(a.trips >= 11 && a.on_snake_way > 0, "seed {seed}: a full rotation, snake way in it ({} trips)", a.trips);
            was += a.paid.ln();
            now += run(seed, active, false, ROTATION).paid.ln();
        }
        let (was, now) = ((was / SEEDS as f64).exp(), (now / SEEDS as f64).exp());
        let who = if active { "active" } else { "idle" };
        eprintln!("{who}: per second of base income over a rotation ({SEEDS} seeds): with snake way ×{was:.4}, parked ×{now:.4}, ratio {:.4}", now / was);
        assert!((now / was - 1.0).abs() < 0.05, "{who} income moved {:+.1}%", (now / was - 1.0) * 100.0);
    }
}
