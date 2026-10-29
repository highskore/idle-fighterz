//! Golden traces: the regression test of the Rust engine, now that game.js is frozen and Rust moves on without it.
//!
//! Each scenario replays its script (`rust/golden/<name>.inputs.json`: the inputs game.js's drawn run applied, see
//! `script.mjs`) through planet-core with planet-render drawing every frame, as the drawn difftest does, and checks it
//! against `rust/golden/<name>.trace`: per simulated second the world, form, power and random draws, a hash of the whole
//! state sample (the difftest's: timeline, economy, upgrades, tree, the HUD, the shop, the dragon's offer, the toasts and
//! cues, and every ten seconds the save and the menus), and an FNV-1a hash of each of its 30 frames. When they were
//! recorded the frame hashes were game.js's own.
//!
//! A change that means to change what the game does or draws re-records them, `npm run golden:update`
//! (`GOLDEN_UPDATE=1`), and the new traces are reviewed with the change: the diff shows from which second of which
//! scenario it differs. Each scenario is its own test; run them side by side with `--test-threads`.

#[path = "../../planet-core/tests/replay/mod.rs"]
mod replay;

use planet_core::data::{Upg, TREE};
use planet_core::Game;
use planet_render::scene::{Scene, View};
use planet_render::Framebuffer;
use serde_json::Value;
use std::fmt::Write;
use std::path::PathBuf;

struct Fnv(u32);

impl Fnv {
    fn new() -> Self {
        Fnv(0x811c9dc5)
    }
    fn bytes(&mut self, b: &[u8]) {
        for &x in b {
            self.0 = (self.0 ^ x as u32).wrapping_mul(16777619);
        }
    }
    fn num(&mut self, v: f64) {
        self.bytes(&v.to_bits().to_le_bytes());
    }
    fn str(&mut self, s: &str) {
        self.bytes(s.as_bytes());
        self.bytes(&[0]);
    }
}

/// drawn.rs's frame hash, over the packed pixels: the first golden frames are game.js's (run.js `+draw`).
fn frame_hash(buf: &[u32]) -> u32 {
    let mut h: u32 = 0x811c9dc5;
    for &w in buf {
        h = (h ^ w).wrapping_mul(16777619);
    }
    h
}

/// The state sample at the end of a second, as one hash (the toasts and cues are those of the second).
fn sample(g: &Game, f: usize, events: &[String], cues: &[String]) -> u32 {
    let mut h = Fnv::new();
    for v in [g.t, g.rng.draws() as f64, g.session, g.s.pl, g.s.best, g.s.run_best, g.rate(), g.wrate(), g.mult(false), g.mult(true)] {
        h.num(v);
    }
    for v in [g.laps as f64, g.s.laps_total as f64, g.phi, g.sprint, g.combo, g.s.form as f64, g.s.mastery as f64, g.s.seeds, g.s.ascend] {
        h.num(v);
    }
    for v in [g.s.goal_p, g.s.goals_done as f64, g.s.orbs7 as f64] {
        h.num(v);
    }
    h.str(g.s.goal);
    for (i, _) in TREE.iter().enumerate() {
        h.num(g.s.tree[i] as f64);
    }
    for u in Upg::ALL {
        h.num(g.s.lv(u) as f64);
        h.num(g.cost(u));
    }
    for (name, v) in replay::timeline_sample(g) {
        h.str(name);
        h.num(v.unwrap_or(f64::NAN));
    }
    h.str(&g.hud().to_json());
    h.str(&g.shop);
    if let Some((_, offer)) = g.wish_offer() {
        h.str(&offer);
    }
    for s in events.iter().chain(cues) {
        h.str(s);
    }
    if (f + 1).is_multiple_of(300) {
        for s in [g.save_json(), g.menu_json(), g.angels_json(), g.ascend_info_json(), g.god_info_json(), g.zeno_info_json(), g.card_json()] {
            h.str(&s);
        }
    }
    h.0
}

fn dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../golden")
}

/// The scenario's trace, a line a simulated second.
fn record(name: &str) -> Vec<String> {
    let path = dir().join(format!("{name}.inputs.json"));
    let sc: Value = serde_json::from_slice(&std::fs::read(&path).unwrap_or_else(|e| panic!("{}: {e}", path.display()))).expect("script json");
    let (dt, frames) = (sc["dt"].as_f64().unwrap(), sc["frames"].as_u64().unwrap() as usize);
    let inputs = sc["inputs"].as_array().unwrap();
    let mut g = Game::new(sc["seed"].as_u64().unwrap() as u32);
    g.epoch_ms = sc["epoch"].as_f64().unwrap();
    g.calm = sc["calm"].as_bool().unwrap();
    if let Some(saved) = sc["saved"].as_str() {
        g.load_json(saved);
    }
    g.start_on(sc["today"].as_str().unwrap());
    // the harness's 600×400 canvas: 200×134 game pixels at 3×
    let (mut fb, mut scene, view) = (Framebuffer::new(200, 134), Scene::new(), View::site(3.0));
    let (mut t, mut ii) = (0.0f64, 0usize);
    let (mut events, mut cues, mut hashes) = (Vec::new(), Vec::new(), String::new());
    let mut lines = Vec::with_capacity(frames / 30);
    let drain = |g: &mut Game, events: &mut Vec<String>, cues: &mut Vec<String>| {
        events.extend(g.events.drain(..).map(|(s, ms)| format!("{:.3} {s} {ms}", g.t)));
        cues.extend(g.cues.drain(..).map(|c| format!("{:.3} {}", g.t, c.to_json())));
    };
    for f in 0..frames {
        while ii < inputs.len() && inputs[ii]["f"].as_u64().unwrap() as usize == f {
            replay::apply(&mut g, &inputs[ii]);
            ii += 1;
        }
        drain(&mut g, &mut events, &mut cues);
        t += dt;
        g.sim(t, dt);
        scene.draw(&mut fb, &mut g, &view, dt);
        let _ = write!(hashes, "{:08x}", frame_hash(&fb.buf));
        g.timeouts();
        drain(&mut g, &mut events, &mut cues);
        if (f + 1).is_multiple_of(30) {
            let st = sample(&g, f, &events, &cues);
            lines.push(format!("{} {} {} {:.6e} {} {st:08x} {hashes}", (f + 1) / 30, g.s.world, g.s.form, g.s.pl, g.rng.draws()));
            events.clear();
            cues.clear();
            hashes.clear();
        }
    }
    lines
}

const HEADER: &str = "# second world form power draws state-hash frame-hashes(30)";

fn golden(name: &str) {
    let got = record(name);
    let path = dir().join(format!("{name}.trace"));
    if std::env::var("GOLDEN_UPDATE").is_ok_and(|v| v == "1") {
        let old = std::fs::read_to_string(&path).unwrap_or_default();
        let was: Vec<&str> = old.lines().filter(|l| !l.starts_with('#')).collect();
        let changed = got.iter().zip(&was).filter(|(a, b)| a != b).count() + got.len().abs_diff(was.len());
        let first = got.iter().zip(&was).position(|(a, b)| a != b).or((got.len() != was.len()).then(|| got.len().min(was.len())));
        std::fs::write(
            &path,
            format!("# {name}: golden trace (rust/planet-render/tests/golden.rs), re-record with npm run golden:update\n{HEADER}\n{}\n", got.join("\n")),
        )
        .unwrap();
        match first {
            None => eprintln!("{name}: unchanged, {} seconds", got.len()),
            Some(s) => eprintln!("{name}: re-recorded, {changed} of {} seconds changed, the first at second {}", got.len(), s + 1),
        }
        return;
    }
    let want = std::fs::read_to_string(&path).unwrap_or_else(|_| panic!("no golden trace {}: npm run golden:update records it", path.display()));
    let want: Vec<&str> = want.lines().filter(|l| !l.starts_with('#')).collect();
    let bad: Vec<usize> = (0..got.len().max(want.len())).filter(|&i| got.get(i).map(String::as_str) != want.get(i).copied()).collect();
    if let Some(&i) = bad.first() {
        let (g, w) = (got.get(i).map_or("(none)", String::as_str), want.get(i).copied().unwrap_or("(none)"));
        let col = |l: &str, k: usize| l.split(' ').nth(k).unwrap_or("").to_string();
        let what = if col(g, 5) != col(w, 5) { "the state" } else { "a frame" };
        let frame =
            (0..30).find(|k| col(g, 6).get(k * 8..k * 8 + 8) != col(w, 6).get(k * 8..k * 8 + 8)).map_or(String::new(), |k| format!(", frame {}", i * 30 + k));
        panic!(
            "{name}: {} of {} seconds differ from rust/golden/{name}.trace; the first is second {} ({what}{frame})\n  want {}\n  got  {}\n\
             if the change means it, re-record with npm run golden:update and commit the traces",
            bad.len(),
            want.len(),
            i + 1,
            &w[..w.len().min(80)],
            &g[..g.len().min(80)]
        );
    }
    eprintln!("{name}: {} seconds, {} frames, all as recorded", got.len(), got.len() * 30);
}

#[test]
fn taps() {
    golden("taps");
}

#[test]
fn idle() {
    golden("idle");
}

#[test]
fn active() {
    golden("active");
}

#[test]
fn lookout() {
    golden("lookout");
}

#[test]
fn calm() {
    golden("calm");
}

#[test]
fn itx() {
    golden("itx");
}

#[test]
fn attacks() {
    golden("attacks");
}

#[test]
fn walls() {
    golden("walls");
}

#[test]
fn input() {
    golden("input");
}

#[test]
fn ascend() {
    golden("ascend");
}

#[test]
fn late() {
    golden("late");
}

#[test]
fn events() {
    golden("events");
}

#[test]
fn multiverse() {
    golden("multiverse");
}

#[test]
fn wishes() {
    golden("wishes");
}

#[test]
fn snake() {
    golden("snake");
}

#[test]
fn daily() {
    golden("daily");
}

#[test]
fn toptaste() {
    golden("toptaste");
}

#[test]
fn sides() {
    golden("sides");
}
