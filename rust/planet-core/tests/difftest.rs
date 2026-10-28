//! Differential test: game.js (headless, via rust/difftest/run.js) against planet-core, same seed and inputs.
//! Each scenario's JS trace carries the inputs it applied frame by frame and a state sample every second; we replay
//! the inputs here and compare. Needs `node` on PATH; without it the tests skip.

mod replay;

use planet_core::num::{fmt_short, hud_fmt, hud_short};
use planet_core::Game;
use replay::{js, js_args, scenario};

#[test]
fn idle() {
    scenario("idle");
}

#[test]
fn active() {
    scenario("active");
}

#[test]
fn ascend() {
    scenario("ascend");
}

#[test]
fn late() {
    scenario("late");
}

#[test]
fn events() {
    scenario("events");
}

#[test]
fn multiverse() {
    scenario("multiverse");
}

#[test]
fn wishes() {
    scenario("wishes");
}

#[test]
fn lookout() {
    scenario("lookout");
}

#[test]
fn itx() {
    scenario("itx");
}

#[test]
fn attacks() {
    scenario("attacks");
}

#[test]
fn walls() {
    scenario("walls");
}

#[test]
fn input() {
    scenario("input");
}

#[test]
fn snake() {
    scenario("snake");
}

#[test]
fn daily() {
    scenario("daily");
}

/// planet-core's save, written mid-run, read back by game.js and by planet-core: both keep its daily date, and the
/// next day's visit gets the bonus on both sides.
#[test]
fn save_round_trip() {
    let mut g = Game::new(3);
    g.epoch_ms = 1793188800000.0;
    g.start_on("Mon Oct 26 2026");
    for i in 1..=600 {
        if i % 4 == 0 {
            g.train();
        }
        g.frame(i as f64 / 30.0, 1.0 / 30.0);
    }
    let saved = g.save_json();
    let file = std::env::temp_dir().join(format!("planet-save-{}.json", std::process::id()));
    std::fs::write(&file, &saved).unwrap();
    let Some(js) = js_args(&["load", file.to_str().unwrap()]) else { return };
    std::fs::remove_file(&file).ok();
    assert_eq!(js["daily"].as_str(), Some(js["today"].as_str().unwrap()), "game.js moved the date on");
    let mut back = Game::new(3);
    back.load_json(&saved);
    assert_eq!(back.s.daily.as_deref(), Some("Mon Oct 26 2026"));
    back.start_on(js["today"].as_str().unwrap());
    assert_eq!(back.b.daily_until, js["dailyUntil"].as_f64().unwrap());
    assert_eq!(back.s.orbs7 as f64, js["orbs7"].as_f64().unwrap());
    assert_eq!(js["dailyUntil"].as_f64(), Some(300.0), "a day later: the bonus");
    // and what game.js writes back parses as the same daily on our side
    let mut again = Game::new(3);
    again.load_json(js["stored"].as_str().unwrap());
    assert_eq!(again.s.daily.as_deref(), js["today"].as_str());
    eprintln!("save round trip: {} bytes, daily {:?}", saved.len(), back.s.daily);
}

#[test]
fn number_formatting() {
    let Some(cases) = js("fmt") else { return };
    let mut bad = Vec::new();
    for c in cases.as_array().unwrap() {
        let n = c["n"].as_f64().unwrap();
        for (what, js, rs) in [("fmtShort", &c["short"], fmt_short(n)), ("fmt", &c["fmt"], hud_fmt(n)), ("short", &c["shop"], hud_short(n))] {
            if js.as_str().unwrap() != rs {
                bad.push(format!("{what}({n}): js {js} rust {rs:?}"));
            }
        }
    }
    eprintln!("fmt: {} numbers, {} mismatches", cases.as_array().unwrap().len(), bad.len());
    assert!(bad.is_empty(), "{}", bad.join("\n"));
}

#[test]
fn taps() {
    scenario("taps");
}
