//! Differential test: game.js (headless, via rust/difftest/run.js) against planet-core, same seed and inputs.
//! Each scenario's JS trace carries the inputs it applied frame by frame and a state sample every second; we replay
//! the inputs here and compare. Needs `node` on PATH; without it the tests skip.

use planet_core::data::{Upg, TREE};
use planet_core::num::{fmt_short, hud_fmt, hud_short};
use planet_core::Game;
use serde_json::Value;
use std::path::Path;
use std::process::Command;

const REL: f64 = 1e-9;

fn js(arg: &str) -> Option<Value> {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../difftest");
    let out = match Command::new("node").arg(dir.join("run.js")).arg(arg).output() {
        Ok(o) => o,
        Err(_) => {
            eprintln!("node not found: skipping the {arg} difftest");
            return None;
        }
    };
    assert!(out.status.success(), "run.js {arg} failed: {}", String::from_utf8_lossy(&out.stderr));
    Some(serde_json::from_slice(&out.stdout).expect("trace json"))
}

fn close(a: f64, b: f64) -> bool {
    a == b || (a - b).abs() <= REL * a.abs().max(b.abs())
}

#[derive(Default)]
struct Report {
    checked: usize,
    /// values within tolerance but not bit-identical, and the worst relative gap among them
    inexact: usize,
    worst: f64,
    bad: Vec<String>,
}

impl Report {
    fn num(&mut self, t: f64, field: &str, js: f64, rs: f64, exact: bool) {
        self.checked += 1;
        let ok = if exact { js == rs } else { close(js, rs) };
        if ok && js != rs {
            self.inexact += 1;
            self.worst = self.worst.max(((js - rs) / js.abs()).abs());
        }
        if !ok && self.bad.len() < 25 {
            self.bad.push(format!("t={t:.0}s {field}: js {js} rust {rs} (rel {:.2e})", ((js - rs) / js.abs().max(1e-300)).abs()));
        }
    }
}

fn scenario(name: &str) {
    let Some(tr) = js(name) else { return };
    let seed = tr["seed"].as_u64().unwrap() as u32;
    let dt = tr["dt"].as_f64().unwrap();
    let frames = tr["frames"].as_u64().unwrap() as usize;
    let inputs = tr["inputs"].as_array().unwrap();
    let samples = tr["samples"].as_array().unwrap();

    let mut g = Game::new(seed);
    g.off = tr["off"].as_array().unwrap().iter().map(|v| v.as_str().unwrap().to_string()).collect();
    g.start();
    let (mut t, mut ii, mut si) = (0.0f64, 0usize, 0usize);
    let mut rep = Report::default();
    for f in 0..frames {
        while ii < inputs.len() && inputs[ii]["f"].as_u64().unwrap() as usize == f {
            let i = &inputs[ii];
            let k = i["k"].as_str().unwrap_or("");
            match i["a"].as_str().unwrap() {
                "train" => g.train(),
                "buy" => {
                    g.buy(k);
                }
                "kaio" => g.kaioken(),
                "learn" => g.learn(k),
                "set" => g.debug_set(k, i["v"].as_f64().unwrap()),
                a => panic!("unknown input {a}"),
            }
            ii += 1;
        }
        t += dt;
        g.frame(t, dt);
        if (f + 1) % 30 == 0 {
            let s = &samples[si];
            si += 1;
            let n = |k: &str| s[k].as_f64().unwrap();
            let st = n("t");
            rep.num(st, "t", st, g.t, true);
            rep.num(st, "draws", n("draws"), g.rng.draws() as f64, true);
            rep.num(st, "session", n("session"), g.session, false);
            rep.num(st, "pl", n("pl"), g.s.pl, false);
            rep.num(st, "best", n("best"), g.s.best, false);
            rep.num(st, "runBest", n("runBest"), g.s.run_best, false);
            rep.num(st, "rate", n("rate"), g.rate(), false);
            rep.num(st, "wrate", n("wrate"), g.wrate(), false);
            rep.num(st, "mult", n("mult"), g.mult(false), false);
            rep.num(st, "multBare", n("multBare"), g.mult(true), false);
            rep.num(st, "laps", n("laps"), g.laps as f64, true);
            rep.num(st, "lapsTotal", n("lapsTotal"), g.s.laps_total as f64, true);
            rep.num(st, "phi", n("phi"), g.phi, false);
            rep.num(st, "sprint", n("sprint"), g.sprint, false);
            rep.num(st, "combo", n("combo"), g.combo, false);
            rep.num(st, "form", n("form"), g.s.form as f64, true);
            rep.num(st, "mastery", n("mastery"), g.s.mastery as f64, true);
            rep.num(st, "seeds", n("seeds"), g.s.seeds, false);
            rep.num(st, "ascend", n("ascend"), g.s.ascend, false);
            rep.num(st, "goalP", n("goalP"), g.s.goal_p, false);
            rep.num(st, "goalsDone", n("goalsDone"), g.s.goals_done as f64, true);
            rep.num(st, "orbs7", n("orbs7"), g.s.orbs7 as f64, true);
            rep.checked += 1;
            if s["goal"].as_str().unwrap() != g.s.goal && rep.bad.len() < 25 {
                rep.bad.push(format!("t={st:.0}s goal: js {} rust {}", s["goal"], g.s.goal));
            }
            for (i, node) in TREE.iter().enumerate() {
                rep.num(st, &format!("tree.{}", node.id), s["tree"][node.id].as_f64().unwrap_or(0.0), g.s.tree[i] as f64, true);
            }
            for u in Upg::ALL {
                rep.num(st, &format!("lv.{}", u.key()), s["levels"][u.key()].as_f64().unwrap(), g.s.lv(u) as f64, true);
                rep.num(st, &format!("cost.{}", u.key()), s["cost"][u.key()].as_f64().unwrap(), g.cost(u), false);
            }
        }
    }
    assert_eq!(si, samples.len());
    eprintln!(
        "{name}: {} samples, {} values compared, {} mismatches, {} inexact (worst rel {:.1e})",
        samples.len(),
        rep.checked,
        rep.bad.len(),
        rep.inexact,
        rep.worst
    );
    assert!(rep.bad.is_empty(), "{name} diverged:\n{}", rep.bad.join("\n"));
}

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
