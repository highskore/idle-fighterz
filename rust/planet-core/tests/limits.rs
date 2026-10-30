//! The ki limits and the milestones (limits.rs): the ladder, strain, breaking idle, the floor through god ki and zeno,
//! and (ignored, slow) the pacing bot that checks the AFK rule from a new game to e1e4 and beyond:
//! `PACE_H=60 cargo test --release -p planet-core --test limits -- --ignored --nocapture pace`

use planet_core::big::Big;
use planet_core::data::{Upg, ANGELS, MUI_FORM, TREE};
use planet_core::limits::milestone;
use planet_core::{Game, DT};

fn run_for(g: &mut Game, secs: f64) {
    let f0 = (g.t / DT).round() as u64;
    for f in f0..f0 + (secs / DT) as u64 {
        g.frame((f + 1) as f64 * DT, DT);
    }
}

#[test]
fn the_milestone_ladder() {
    let first: Vec<(f64, Option<u32>)> = (0..14).map(milestone).collect();
    assert_eq!(first[0], (10.0, Some(0)));
    assert_eq!(first.iter().skip(1).take(8).map(|m| m.0).collect::<Vec<_>>(), [20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0]);
    assert_eq!(first[9], (100.0, Some(1)));
    assert_eq!((first[10].0, first[11].0), (200.0, 300.0));
    assert_eq!(first[12].1, Some(2), "infinity: {}", first[12].0);
    // always rising, and endless
    let mut last = 0.0;
    for i in 0..400 {
        let (x, _) = milestone(i);
        assert!(x > last, "milestone {i}");
        last = x;
    }
    assert!(last > 1e7);
}

#[test]
fn idle_play_is_one_strain_a_second() {
    let mut g = Game::new(1);
    g.preview("#limit1");
    g.start();
    run_for(&mut g, 5.0);
    assert!((g.strain_now() - 1.0).abs() < 1e-6, "{}", g.strain_now());
}

#[test]
fn a_limit_breaks_idle_and_its_floor_holds() {
    let mut g = Game::new(1);
    g.preview("#limit1");
    g.start();
    g.s.meter = 0.0;
    assert!(g.at_limit());
    let need = g.break_need();
    run_for(&mut g, need + 2.0);
    assert_eq!(g.s.limits, 1, "limit I broke idle in {need}s of strain");
    // the old limit is the new floor: the engine stays past the ceiling, which is now creeping again
    assert!(g.core() >= g.ceiling());
    assert!(g.ceiling() >= Big::exp10(Game::limit_log(1)));
    assert!(!g.at_limit());
    // god ki keeps the limits and the ceiling never drops under the last limit
    g.s.form = MUI_FORM;
    g.god_reset();
    assert_eq!(g.s.limits, 1);
    assert!(g.ceiling() >= Big::exp10(Game::limit_log(1)));
    assert!(g.core() >= Big::exp10(Game::limit_log(1)), "the floor holds right after god ki");
}

#[test]
fn zeno_erases_no_limit() {
    let mut g = Game::new(1);
    g.preview("#limit3");
    g.start();
    g.s.limits = 3;
    let (creep, ceil) = (g.s.creep, g.ceiling());
    g.s.gods = 2;
    g.zeno_erase();
    assert_eq!(g.s.zeno, 1);
    assert_eq!((g.s.limits, g.s.creep), (3, creep));
    assert!(g.ceiling() >= ceil.min(Big::exp10(Game::limit_log(3))));
    assert!(g.core() >= Big::exp10(Game::limit_log(3)));
}

#[test]
fn limit_breaker_forms_come_from_limit_three() {
    let mut g = Game::new(1);
    g.preview("#limit3");
    g.start();
    let canon = g.forms.len();
    run_for(&mut g, 30.0);
    assert_eq!(g.s.limits, 3);
    assert_eq!(g.forms.len(), canon + 1);
    assert_eq!(g.forms[canon].name, "limit breaker I");
    // it lands as a scene once the break's own scene is over
    assert_eq!(g.s.form, canon, "{}", g.forms[g.s.form].name);
    assert!(g.s.ach.contains("lbform"));
}

#[test]
fn a_named_milestone_plays_and_boosts() {
    let mut g = Game::new(1);
    g.preview("#mile1");
    g.start();
    run_for(&mut g, 0.5);
    assert!(g.mo.is_some());
    assert!(g.b.boost_until > g.t + 25.0);
    assert!(g.s.ach.contains("googol"));
    run_for(&mut g, 6.0);
    assert!(g.mo.is_none());
}

#[test]
fn the_hud_line_names_the_limit_its_strain_and_the_next_milestone() {
    let mut g = Game::new(1);
    g.preview("#limit3");
    g.start();
    g.s.meter = g.break_need() * 0.634;
    let l = g.limit_line();
    assert!(l.starts_with("ki limit III (1.0Sp) — strain 63% · next: "), "{l}");
}

// ── the pacing bot

fn env(k: &str, d: f64) -> f64 {
    std::env::var(k).ok().and_then(|v| v.parse().ok()).unwrap_or(d)
}

#[derive(Default)]
struct Bot {
    gods: u32,
}

/// What a player checking in does: angels, zeno when it's ready, god ki every few universes, ascending when it at
/// least doubles the seeds, the tree and the shop cheapest first.
fn check_in(g: &mut Game, bot: &mut Bot) {
    for a in [0, 1, 4, 5, 6, 2, 3, 7] {
        g.learn_angel(ANGELS[a].id);
    }
    if g.zeno_ready() {
        g.buy("zeno");
        return;
    }
    if g.s.form >= MUI_FORM && g.god_now() >= 3 && g.s.uni >= 8 + 4 * bot.gods && g.s.pl >= g.god_cost() {
        g.buy("godki");
        bot.gods += 1;
        return;
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

const MARKS: [(f64, &str); 9] =
    [(10.0, "1e10"), (100.0, "1e100"), (308.25, "1.8e308"), (1000.0, "1e1000"), (1e4, "e1e4"), (1e5, "e1e5"), (1e6, "e1e6"), (1e7, "e1e7"), (1e8, "e1e8")];

/// Hours to each mark (milestones, then limits I…), for an idle or an active player.
fn pace_run(seed: u32, active: bool, hours: f64) -> (Vec<Option<f64>>, Vec<f64>) {
    let who = if active { "active" } else { "idle" };
    let mut g = Game::new(seed);
    g.start();
    let mut bot = Bot::default();
    let (mut marks, mut limits) = (vec![None; MARKS.len()], Vec::new());
    let every = if active { (10.0 / DT) as u64 } else { (900.0 / DT) as u64 };
    let (mut gods, mut zenos) = (0, 0);
    let mut watch: Option<(f64, &str)> = None;
    for f in 0..(hours * 3600.0 / DT) as u64 {
        if active && f % 300 < 150 && f % 6 == 0 {
            match g.tl.boss.as_ref().filter(|b| !b.dead).map(|b| (b.x, b.y - 8.0)) {
                Some((x, y)) => g.click(x, y),
                None => g.train(),
            }
        }
        if active && f % 30 == 0 {
            g.kaioken();
        }
        if f % every == every - 1 {
            check_in(&mut g, &mut bot);
        }
        g.frame((f + 1) as f64 * DT, DT);
        let h = g.t / 3600.0;
        let e = g.s.best.log10();
        for (i, m) in MARKS.iter().enumerate() {
            if marks[i].is_none() && e >= m.0 {
                marks[i] = Some(h);
            }
        }
        while limits.len() < g.s.limits as usize {
            limits.push(h);
            eprintln!("{who} s{seed}: {h:6.2}h limit {} breaks (best 1e{e:.0})", g.s.limits);
        }
        if g.s.gods > gods || g.s.zeno > zenos {
            let what = if g.s.zeno > zenos { "zeno" } else { "god ki" };
            (gods, zenos) = (g.s.gods, g.s.zeno);
            eprintln!("{who} s{seed}: {h:6.2}h {what}: core/ceiling 1e{:.1}, at limit {}", (g.core() / g.ceiling()).log10(), g.at_limit());
            watch = Some((g.t, what));
        }
        // how long until the engine is back on the ceiling after a reset
        if let Some((t0, what)) = watch {
            if g.core() >= g.ceiling() {
                eprintln!("{who} s{seed}: {h:6.2}h   back on the ceiling {:.0}s after {what}", g.t - t0);
                watch = None;
            }
        }
        if f % (3600.0 / DT) as u64 == 0 && f > 0 {
            eprintln!(
                "{who} s{seed}: {h:6.2}h best 1e{e:.1} limits {} meter {:.0}% strain/s {:.2} form {} uni {} gods {} zeno {}",
                g.s.limits,
                g.s.meter / g.break_need() * 100.0,
                g.strain_now(),
                g.forms[g.s.form].name,
                g.s.uni,
                g.s.gods,
                g.s.zeno
            );
        }
    }
    (marks, limits)
}

#[test]
#[ignore]
fn pace() {
    let hours = env("PACE_H", 60.0);
    let seed = env("PACE_SEED", 1.0) as u32;
    let only = env("PACE_ONLY", -1.0);
    let mut runs = Vec::new();
    for active in [false, true] {
        if only >= 0.0 && (only == 1.0) != active {
            runs.push((Vec::new(), Vec::new()));
            continue;
        }
        runs.push(pace_run(seed, active, hours));
    }
    let fmt = |x: Option<&f64>| x.map_or("—".to_string(), |h| format!("{h:.1}h"));
    eprintln!("\n| moment | idle | active | ratio |\n|---|---|---|---|");
    for (i, m) in MARKS.iter().enumerate() {
        let (a, b) = (runs[0].0.get(i).copied().flatten(), runs[1].0.get(i).copied().flatten());
        let r = match (a, b) {
            (Some(a), Some(b)) => format!("{:.1}×", a / b),
            _ => "—".into(),
        };
        eprintln!("| power {} | {} | {} | {r} |", m.1, fmt(a.as_ref()), fmt(b.as_ref()));
    }
    for n in 0..runs[0].1.len().max(runs[1].1.len()) {
        let (a, b) = (runs[0].1.get(n), runs[1].1.get(n));
        let r = match (a, b) {
            (Some(a), Some(b)) => format!("{:.1}×", a / b),
            _ => "—".into(),
        };
        eprintln!("| limit {} breaks | {} | {} | {r} |", n + 1, fmt(a), fmt(b));
    }
}
