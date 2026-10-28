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
    js_args(&[arg])
}

fn js_args(args: &[&str]) -> Option<Value> {
    let arg = args[0];
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../difftest");
    let out = match Command::new("node").arg(dir.join("run.js")).args(args).output() {
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
    /// the first few inexact values, for the log
    loose: Vec<String>,
    bad: Vec<String>,
}

impl Report {
    fn num(&mut self, t: f64, field: &str, js: f64, rs: f64, exact: bool) {
        self.checked += 1;
        let ok = if exact { js == rs } else { close(js, rs) };
        if ok && js != rs {
            self.inexact += 1;
            self.worst = self.worst.max(((js - rs) / js.abs()).abs());
            if self.loose.len() < 5 {
                self.loose.push(format!("t={t:.0}s {field}: js {js} rust {rs}"));
            }
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
    g.epoch_ms = tr["epoch"].as_f64().unwrap();
    if let Some(saved) = tr["saved"].as_str() {
        g.load_json(saved);
    }
    g.start_on(tr["today"].as_str().unwrap());
    let (mut t, mut ii, mut si) = (0.0f64, 0usize, 0usize);
    let mut rep = Report::default();
    let n = |i: &Value, k: &str| i[k].as_f64().unwrap();
    let mut saves = 0;
    let mut events: Vec<(f64, String, f64)> = Vec::new();
    let mut hud = Report::default();
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
                "click" => g.click(i["x"].as_f64().unwrap(), i["y"].as_f64().unwrap()),
                "summon" => g.summon(),
                "pick" => g.pick(k),
                "blink" => g.blink(i["x"].as_f64().unwrap(), i["y"].as_f64().unwrap()),
                "down" => {
                    g.pointer_down(n(i, "x"), n(i, "y"), n(i, "bx"), n(i, "by"), i["id"].as_i64().unwrap_or(1) as i32, i["button"].as_i64().unwrap_or(0) as i32)
                }
                "move" => g.pointer_move(n(i, "x"), n(i, "y"), n(i, "bx"), n(i, "by")),
                "up" => g.pointer_up(n(i, "bx"), n(i, "by")),
                "cancel" => g.pointer_cancel(),
                "key" => {
                    g.key(k);
                }
                a => panic!("unknown input {a}"),
            }
            ii += 1;
        }
        events.extend(g.events.drain(..).map(|(s, ms)| (g.t, s, ms)));
        t += dt;
        g.frame(t, dt);
        events.extend(g.events.drain(..).map(|(s, ms)| (g.t, s, ms)));
        if (f + 1) % 30 == 0 {
            let s = &samples[si];
            si += 1;
            if !s["save"].is_null() {
                saves += 1;
                compare_save(&mut rep, &s["save"], &g);
                let m = &s["menus"];
                for (what, rs) in [
                    ("menu", g.menu_json()),
                    ("angels", g.angels_json()),
                    ("ascendInfo", g.ascend_info_json()),
                    ("godInfo", g.god_info_json()),
                    ("zenoInfo", g.zeno_info_json()),
                    ("card", g.card_json()),
                ] {
                    deep(&mut hud, g.t, what, &m[what], &serde_json::from_str(&rs).unwrap());
                }
            }
            if !s["hud"].is_null() {
                let mut js = s["hud"].clone();
                js["time"] = js["time"].as_f64().unwrap().floor().into();
                deep(&mut hud, g.t, "hud", &js, &serde_json::from_str(&g.hud().to_json()).unwrap());
            }
            // the wish box while the dragon waits
            match (s["offer"].is_null(), g.wish_offer()) {
                (true, None) => hud.checked += 1,
                (false, Some((_, rs))) => deep(&mut hud, g.t, "offer", &s["offer"], &serde_json::from_str(&rs).unwrap()),
                (_, rs) => hud.bad.push(format!("t={:.0}s offer: js {} rust {:?}", g.t, s["offer"], rs)),
            }
            if !s["shop"].is_null() {
                let rs: Value = serde_json::from_str(&g.shop_at_hud).unwrap();
                let keys = |v: &Value| v.as_object().unwrap().keys().cloned().collect::<Vec<_>>();
                hud.checked += 1;
                if keys(&s["shop"]) != keys(&rs) && hud.bad.len() < 25 {
                    hud.bad.push(format!("t={:.0}s shop rows: js {:?} rust {:?}", g.t, keys(&s["shop"]), keys(&rs)));
                }
                deep(&mut hud, g.t, "shop", &s["shop"], &rs);
            }
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
            for (pair, (name, rs)) in s["tl"].as_array().unwrap().iter().zip(timeline_sample(&g)) {
                assert_eq!(pair[0].as_str().unwrap(), name);
                match (pair[1].as_f64(), rs) {
                    (Some(js), Some(rs)) => rep.num(st, name, js, rs, false),
                    (None, None) => rep.checked += 1,
                    (js, rs) => {
                        rep.checked += 1;
                        if rep.bad.len() < 25 {
                            rep.bad.push(format!("t={st:.0}s {name}: js {js:?} rust {rs:?}"));
                        }
                    }
                }
            }
        }
    }
    assert_eq!(si, samples.len());
    // every toast, in order, with its time and how long it stays up
    let jev = tr["events"].as_array().unwrap();
    for (i, (je, re)) in jev.iter().zip(&events).enumerate() {
        hud.checked += 1;
        let (jt, js, jms) = (je[0].as_f64().unwrap(), je[1].as_str().unwrap(), je[2].as_f64().unwrap());
        if ((jt - re.0).abs() > 0.006 || js != re.1 || jms != re.2) && hud.bad.len() < 25 {
            hud.bad.push(format!("event {i}: js {jt} {js:?} {jms}ms, rust {:.2} {:?} {}ms", re.0, re.1, re.2));
        }
    }
    hud.checked += 1;
    if jev.len() != events.len() && hud.bad.len() < 25 {
        hud.bad.push(format!("{} toasts in js, {} in rust", jev.len(), events.len()));
    }
    // what game.js last wrote to localStorage carries the same daily bonus date
    let stored = serde_json::from_str::<Value>(tr["stored"].as_str().unwrap()).unwrap();
    assert_eq!(stored["daily"].as_str(), g.s.daily.as_deref(), "the stored daily date");
    eprintln!(
        "{name}: {} samples ({saves} with the save), {} values compared, {} mismatches, {} inexact (worst rel {:.1e})",
        samples.len(),
        rep.checked,
        rep.bad.len(),
        rep.inexact,
        rep.worst
    );
    for l in &rep.loose {
        eprintln!("  inexact {l}");
    }
    eprintln!("{name} hud: {} values compared (snapshot, shop, menus, toasts), {} mismatches, {} inexact", hud.checked, hud.bad.len(), hud.inexact);
    assert!(rep.bad.is_empty(), "{name} diverged:\n{}", rep.bad.join("\n"));
    assert!(hud.bad.is_empty(), "{name}: the HUD differs:\n{}", hud.bad.join("\n"));
}

/// A JSON value from game.js against planet-core's: every key game.js has, numbers within tolerance, the rest exact.
fn deep(rep: &mut Report, t: f64, path: &str, js: &Value, rs: &Value) {
    match (js, rs) {
        (Value::Object(a), Value::Object(b)) => {
            for (k, v) in a {
                match b.get(k) {
                    Some(r) => deep(rep, t, &format!("{path}.{k}"), v, r),
                    None => {
                        rep.checked += 1;
                        if rep.bad.len() < 25 {
                            rep.bad.push(format!("t={t:.0}s {path}.{k}: js {v}, missing in rust"));
                        }
                    }
                }
            }
        }
        (Value::Array(a), Value::Array(b)) if a.len() == b.len() => {
            for (i, (v, r)) in a.iter().zip(b).enumerate() {
                deep(rep, t, &format!("{path}[{i}]"), v, r);
            }
        }
        (Value::Number(a), Value::Number(b)) => rep.num(t, path, a.as_f64().unwrap(), b.as_f64().unwrap(), false),
        _ => {
            rep.checked += 1;
            if js != rs && rep.bad.len() < 25 {
                rep.bad.push(format!("t={t:.0}s {path}: js {js} rust {rs}"));
            }
        }
    }
}

/// The save JSON against game.js's `JSON.stringify(S)`: every key game.js has must match; keys game.js hasn't created
/// yet must hold what game.js reads for a missing one (0, an empty object or list).
fn compare_save(rep: &mut Report, js: &Value, g: &Game) {
    let rs: Value = serde_json::from_str(&g.save_json()).expect("save_json is JSON");
    let t = g.t;
    let bad = |rep: &mut Report, what: String| {
        if rep.bad.len() < 25 {
            rep.bad.push(format!("t={t:.0}s save.{what}"));
        }
    };
    let (js, rs) = (js.as_object().unwrap(), rs.as_object().unwrap());
    for (k, v) in js {
        let Some(r) = rs.get(k) else {
            bad(rep, format!("{k}: missing in rust (js {v})"));
            continue;
        };
        match (v, r) {
            (Value::Number(a), Value::Number(b)) => rep.num(t, &format!("save.{k}"), a.as_f64().unwrap(), b.as_f64().unwrap(), false),
            (Value::Object(a), Value::Object(b)) => {
                rep.checked += 1;
                if a != b {
                    bad(rep, format!("{k}: js {v} rust {r}"));
                }
            }
            _ => {
                rep.checked += 1;
                if v != r {
                    bad(rep, format!("{k}: js {v} rust {r}"));
                }
            }
        }
    }
    for (k, r) in rs {
        if js.contains_key(k) {
            continue;
        }
        rep.checked += 1;
        let unset = match r {
            Value::Number(n) => n.as_f64() == Some(0.0),
            Value::Object(o) => o.is_empty(),
            Value::Array(a) => a.is_empty(),
            Value::String(s) => s.is_empty(),
            _ => false,
        };
        if !unset {
            bad(rep, format!("{k}: rust {r}, js has none"));
        }
    }
}

/// The timeline's state, in run.js's `tl` order: what's up in the sky and how the run is going.
fn timeline_sample(g: &Game) -> Vec<(&'static str, Option<f64>)> {
    let (s, tl) = (&g.s, &g.tl);
    let n = |v: f64| Some(v);
    let b = |v: bool| Some(if v { 1.0 } else { 0.0 });
    vec![
        ("world", n(s.world as f64)),
        ("saga", n(s.saga as f64)),
        ("uni", n(s.uni as f64)),
        ("uniStage", n(s.uni_stage as f64)),
        ("ustars", n(s.ustars as f64)),
        ("multi", b(s.multi)),
        ("granted", n(s.granted as f64)),
        ("wishes", n(s.wishes as f64)),
        ("bosses", n(s.bosses as f64)),
        ("trips", n(s.trips as f64)),
        ("tourBest", n(s.tour_best as f64)),
        ("stars", n(s.stars as f64)),
        ("krillinDead", b(s.krillin_dead)),
        ("geros", n(s.geros as f64)),
        ("movies", n(s.movies as f64)),
        ("boss", tl.boss.as_ref().map(|b| b.hp)),
        ("bossDead", tl.boss.as_ref().map(|b| if b.dead { 1.0 } else { 0.0 })),
        ("ginyu", tl.ginyu.as_ref().map(|g| g.members.iter().fold(0.0, |a, m| a + m.hp.max(0.0)))),
        ("shen", tl.shen.as_ref().map(|s| s.phase as u8 as f64)),
        ("orbs", n(tl.orbs.len() as f64)),
        ("meteors", n(tl.meteors.len() as f64)),
        ("saibas", n(tl.saibas.len() as f64)),
        ("kis", n(tl.kis.len() as f64)),
        ("star", tl.star.as_ref().map(|s| s.x)),
        ("cloud", tl.cloud_fly.map(|c| c.0)),
        ("moon", tl.moon.as_ref().map(|m| m.a)),
        ("apeUntil", n(g.b.ape_until)),
        ("riding", n(g.riding)),
        ("tour", tl.tour.as_ref().map(|t| t.ko as f64)),
        ("movie", tl.movie.as_ref().and(tl.boss.as_ref()).map(|b| b.hp)),
        ("storm", tl.storm.as_ref().map(|s| s.hit as f64)),
        ("snake", tl.snk.as_ref().map(|s| s.p)),
        ("greg", tl.greg.as_ref().map(|g| g.c[0])),
        ("gero", tl.gero.as_ref().map(|g| g.x)),
        ("dance", tl.dance.as_ref().map(|d| d.hits as f64)),
        ("struggle", tl.struggle.as_ref().map(|s| s.p)),
        ("m0", n(g.cam.m[0])),
        ("m2", n(g.cam.m[2])),
        ("bob", n(g.cam.bob)),
        ("namekUntil", n(tl.namek_until)),
        ("nextBoss", n(tl.next_boss)),
        ("fused", g.b.fused.map(|f| f.0)),
        ("preview", tl.preview.map(|p| p.1)),
        ("jumpH", n(tl.jump_h)),
        ("charging", n(g.inp.charging)),
        ("dragged", g.inp.drag.map(|d| d.moved)),
        ("vrx", n(g.inp.vrx)),
        ("vry", n(g.inp.vry)),
        ("m4", n(g.cam.m[4])),
        ("beam", g.inp.beam.map(|b| b.c)),
        ("beamDx", g.inp.beam.map(|b| b.dx)),
        ("bang", g.inp.bang.map(|b| b.x1)),
        ("bangReady", n(g.inp.bang_ready)),
        ("lastTap", n(g.inp.last_tap.0)),
        ("daily", n(g.b.daily_until)),
        ("blinkReady", n(tl.blink_ready)),
        ("nextStar", n(tl.next_star)),
        ("nextCloud", n(tl.next_cloud)),
    ]
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
