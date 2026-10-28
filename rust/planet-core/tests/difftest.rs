//! Differential test: game.js (headless, via rust/difftest/run.js) against planet-core, same seed and inputs.
//! Each scenario's JS trace carries the inputs it applied frame by frame and a state sample every second; we replay
//! the inputs here and compare. Needs `node` on PATH; without it the tests skip.

mod replay;

use planet_core::num::{fmt_short, hud_fmt, hud_short};
use replay::{js, scenario};

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
